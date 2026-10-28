import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';
import { askQuestions } from '@/lib/claude';
import { fallbackStrings } from '@/lib/questions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const r05 = (v) => Math.round((Number(v) || 0) * 2) / 2;
const cacheKey = (b) => b.stays ? 'stays' : `${r05(b.arrow.x)},${r05(b.arrow.y)}`;

function buildPrompt(session, story, dot, b) {
  const ax = (session.axes && session.axes.x) || {};
  const ay = (session.axes && session.axes.y) || {};
  const xPole = (dot.x != null ? dot.x : 0) < 0 ? ax.low : ax.high;
  const yPole = (dot.y != null ? dot.y : 0) < 0 ? ay.low : ay.high;

  let directionBlock;
  if (b.stays) {
    directionBlock = 'The writer chose to stay where they are.';
  } else {
    const { x: ax2, y: ay2 } = b.arrow;
    const xDest = ax2 < 0 ? ax.low : ax.high;
    const yDest = ay2 < 0 ? ay.low : ay.high;
    const dx = ax2 - (dot.x || 0), dy = ay2 - (dot.y || 0);
    const dist = Math.hypot(dx, dy);
    const size = dist >= 3 ? 'a long move' : dist >= 1.5 ? 'a moderate move' : 'a short move';
    const isX = Math.abs(dx) >= Math.abs(dy);
    const primaryAxis = isX ? ax.name : ay.name;
    const fromPole = isX ? xPole : yPole;
    const toPole = isX ? xDest : yDest;
    const toward = fromPole === toPole ? `further toward "${toPole}"` : `from "${fromPole}" toward "${toPole}"`;
    directionBlock = `The writer drew an arrow making ${size} (${toward} on the ${primaryAxis} axis, arrow at ${ax2}, ${ay2}).`;
  }

  const axisDesc = (a, dir) =>
    `${dir} axis — ${a.name || dir}: "${a.low || '?'}" (${a.lowDesc ? a.lowDesc + ' ' : ''}) / "${a.high || '?'}" (${a.highDesc || ''})`;

  const dotBlock = dot.x != null
    ? `Their dot: (${dot.x}, ${dot.y}) — closer to "${xPole}" and "${yPole}".`
    : 'Their dot has not been placed yet.';

  return `You are writing five reflection questions for one specific writer based on their own story.

STORY MAP PROMPT
${session.prompt || session.big_question || ''}

THE WRITER'S STORY
${story.body}

WHERE THEY PLACED THEMSELVES
${dotBlock}
${axisDesc(ax, 'Horizontal')}
${axisDesc(ay, 'Vertical')}

DIRECTION
${directionBlock}

Write exactly 5 questions. Rules:
- Every question must use at least one specific phrase, word, or detail from their story (quote it inside the question, in quotation marks).
- Q1: What needs to happen first for this move to be possible?
- Q2: What must be true for this future to exist, for this writer, for the people around them, and for the wider world?
- Q3: Where is this future already being built somewhere, or actively resisted?
- Q4: What is the hardest part of believing this direction is right?
- Q5: What is one move this week, taking under 2 hours and costing under $50, that would test whether this direction is right?
- If they chose to stay: Q1-Q4 explore what anchors them and what might shift them without their noticing; Q5 is a small test of whether staying is still right.
- Questions only. No advice. No answers. No reassurance. No em dashes.
- Write for the writer using "you", not "they".

Return ONLY valid JSON: {"questions":["Q1","Q2","Q3","Q4","Q5"]}`;
}

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    if (!b.stays && (!b.arrow || b.arrow.x == null || b.arrow.y == null)) {
      return NextResponse.json({ error: 'Provide arrow or stays.' }, { status: 400 });
    }

    const story = (await q('select id, body, x, y, token_hash, questions, session_id from stories where id=$1', [params.id]))[0];
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    const isWriter = b.token && story.token_hash && hashToken(b.token) === story.token_hash;
    const isAdminCall = !isWriter && isAdmin();
    if (!isWriter && !isAdminCall) return denied();

    const canCache = isWriter; // no caching for admin what-if calls
    const key = cacheKey(b);

    if (canCache && story.questions && story.questions[key]) {
      return NextResponse.json({ questions: story.questions[key], cached: true });
    }

    const session = (await q('select prompt, big_question, axes from sessions where id=$1', [story.session_id]))[0];
    const dot = { x: story.x, y: story.y };

    let questions;
    try {
      const prompt = buildPrompt(session, story, dot, b);
      const result = await Promise.race([
        askQuestions(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      if (!Array.isArray(result.questions) || result.questions.length !== 5) throw new Error('bad response');
      questions = result.questions.map((s) => String(s).trim());
    } catch {
      const axes = (session && session.axes) || {};
      const me = b.stays ? { x: dot.x, y: dot.y, stays: true } : { x: dot.x, y: dot.y, arrow: b.arrow };
      questions = fallbackStrings(axes, me);
    }

    if (canCache && questions.length > 0) {
      await q(
        `update stories set questions = coalesce(questions, '{}') || $2::jsonb where id = $1`,
        [story.id, JSON.stringify({ [key]: questions })]
      );
    }

    return NextResponse.json({ questions });
  } catch (e) { return fail(e); }
}
