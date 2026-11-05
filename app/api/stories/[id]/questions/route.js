import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';
import { askQuestions } from '@/lib/claude';
import { fallbackStrings, classifyArrow } from '@/lib/questions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const r05 = (v) => Math.round((Number(v) || 0) * 2) / 2;
const cacheKey = (b) => b.stays ? 'stays' : `${r05(b.arrow.x)},${r05(b.arrow.y)}`;

const COUNT = { stay: 5, deepen: 5, balance: 5, cross: 5 };

const INSTRUCTIONS = {
  stay: `Write exactly 5 questions. Plain language only — under 15 words per question, one idea each, no em dashes, no jargon.
- Q1: Something in their story written as a fact that is actually a wish — quote a specific phrase from the story inside the question.
- Q2: What keeps them where they are right now.
- Q3: What could pull them in a different direction without them noticing.
- Q4: Who else lives in this position, and what do they know that this writer doesn't.
- Q5: One small thing this week (under 2 hours) that would tell them staying is right.`,

  deepen: `Write exactly 5 questions. Plain language only — under 15 words per question, one idea each, no em dashes, no jargon.
- Q1: Something in their story written as a certainty that might be what they most want to believe — quote a specific phrase.
- Q2: What going further in this direction would actually cost them.
- Q3: What they are still holding back from this direction.
- Q4: What full commitment to this direction looks like on a completely ordinary Tuesday.
- Q5: One small thing this week (under 2 hours) that would tell them whether they have gone too far.`,

  balance: `Write exactly 5 questions. Plain language only — under 15 words per question, one idea each, no em dashes, no jargon.
- Q1: Something left out of their story that they almost wrote — quote a phrase from the story or ask about the gap between what they described and what they seem to want.
- Q2: What from where they are now they want to keep.
- Q3: What they would be glad to let go of as they move toward the middle.
- Q4: What a balanced version of this looks like on a completely ordinary day.
- Q5: One small step this week (under 2 hours) that would tell them it is working.`,

  cross: `Write exactly 5 questions. Plain language only — under 15 words per question, one idea each, no em dashes, no jargon.
- Q1: Something in their story written as a fact that is actually a wish — quote a specific phrase.
- Q2: What has to happen first for this move to be possible.
- Q3: What must be true about them and the world around them for this to work.
- Q4: Where this future is already happening somewhere, even in a small way.
- Q5: The hardest part of this direction to believe right now.`,
};

function buildPrompt(session, story, dot, b, type) {
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
    directionBlock = `Arrow type: ${type}. The writer drew ${size} (${toward} on the ${primaryAxis} axis). Arrow at (${ax2}, ${ay2}).`;
  }

  const axisDesc = (a, dir) =>
    `${dir} axis — ${a.name || dir}: "${a.low || '?'}" (${a.lowDesc ? a.lowDesc + ' ' : ''}) / "${a.high || '?'}" (${a.highDesc || ''})`;

  const dotBlock = dot.x != null
    ? `Their dot: (${dot.x}, ${dot.y}) — closer to "${xPole}" and "${yPole}".`
    : 'Their dot has not been placed yet.';

  const count = COUNT[type];

  return `You are writing ${count} reflection questions for one specific writer based on their own story.

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

${INSTRUCTIONS[type]}

Rules for all questions:
- Every question must use at least one specific phrase, word, or detail from their story (quoted inside the question), except where a question specifically asks about an absence or a gap.
- Questions only. No advice. No answers. No reassurance. No em dashes.
- Write for the writer using "you", not "they".

Return ONLY valid JSON: {"questions":["Q1","Q2",...]}`;
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
    const type = b.stays ? 'stay' : classifyArrow(dot, b.arrow);
    const expectedCount = COUNT[type];

    let questions;
    try {
      const prompt = buildPrompt(session, story, dot, b, type);
      const result = await Promise.race([
        askQuestions(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      if (!Array.isArray(result.questions) || result.questions.length !== expectedCount) throw new Error('bad response');
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
