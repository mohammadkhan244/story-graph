import { NextResponse } from 'next/server';
import { q, hashToken } from '@/lib/db';
import { fail } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const EXPECTED = ['## YOUR OWN WORDS', '## PART 0', '## PART 1', '## PART 2', '## PART 3', '## PART 4', '## PART 5', '## PART 6', '## PART 8'];

function headersPresent(text) {
  return EXPECTED.every((h) => text.includes(h));
}

function buildPrompt(idea, headline, story, stage, lens) {
  const calibrationBlock = `---
Calibration instruction (runs before all sections)

Before analyzing, read the story and the context below.

Where they are: ${stage}
Their lens, tradition, or worldview (if provided): ${lens}

Step 1 — Determine interpretive mode:
- If stage is "early" or "mid": use DISCOVERY mode. The writer may not fully know what they want. Surface what analytical thinking couldn't reach. Treat the default narrative as something worth examining.

- If stage is "deep": use VERIFICATION mode. Stop here before continuing. Do not proceed with the default analytical frame. The writer has an established worldview they have been developing deliberately. Your job is not to examine whether their stance is correct — it is to surface what the story reveals within their existing framework.

Step 2 — If a lens is provided:
This is not background context. It is an instruction. Read it before touching the story. Any term in the story that could belong to this lens or tradition — treat it as intentional, precise, and load-bearing. Do not reinterpret it through a therapeutic, creator-economy, or psychological frame. If you find yourself doing so, stop and correct.

Step 3 — VERIFICATION mode hard rules:
- YOUR OWN WORDS: Do not look for what slipped past editorial control. Look for the line that is most precisely true — where the writer said something more exactly than they may have realized. Precision is the tell, not accident.
- PART 2 — EMOTIONAL FIELD: Do not read withdrawal, detachment, or observer stances as loneliness, fear, or avoidance. If the writer's lens treats these as correct epistemic or ontological positions, name the emotion underneath accurately — do not project deficit where their framework sees function.
- PART 8 — DEFAULT NARRATIVE: STOP before naming the narrative. Ask: did this person fall into this narrative, or did they build it? If the story shows internal consistency, decades of development, or deliberate philosophical positioning — the narrative is their methodology, not a trap. Do not apply WHAT IT COSTS. Replace it with WHAT THIS CONFIRMS: one to two sentences on what the story validates about the direction they are already in. Do not suggest they test whether their stance is correct. Do not prescribe engagement, participation, or openness to feedback as the ONE MOVE unless the story itself shows signs of avoidance, not deliberate design.
---`;

  return `You are analyzing a 10-minute clarity sprint. Someone has been circling a decision, idea, or question and wrote a story where it resolved. Surface what their writing reveals that analytical thinking couldn't reach.

For every finding, quote their exact words as evidence. If something is absent from the story, name it — absence is information.

${calibrationBlock}

What they're circling: ${idea || 'not specified'}
Headline they gave it: ${headline || 'not specified'}
Narrative name they gave it: not named
Story they wrote:
${story}

Question shown to user: What surprised you the most when writing it?
Their answer: not answered

Respond with exactly these sections in exactly this order, using exactly these headers:

## YOUR OWN WORDS
Find the single most unplanned line in this story — the one that reads like it slipped past the writer's conscious control. Not the most dramatic line, not the most poetic line — the one that was written before the writer could decide whether to write it.

Return it in exactly this format with nothing before or after:

"[the line]"
[Why this line stood out — what makes it feel unplanned rather than constructed. 2-3 sentences. Reference specific words or details from the line itself, not general observations about the story.]
Before you read further, consider: [One question specific to this line and this person only. Not a clarifying question — a deepening one. It must be answerable only by this specific person about this specific line. It must open something rather than explain something. It cannot apply to any other story or any other writer.]

## PART 0 — THE WORLDVIEW UNDERNEATH
What does this story assume to be permanently true about how the world works — about people, systems, and what gets rewarded? What future does this worldview create if it's right? What falls through the cracks if it's wrong?

## PART 1 — WHAT YOU DIDN'T PLAN TO WRITE
Two or three things that surfaced in the writing that the person didn't consciously plan to include. Quote exact phrases. Explain why each feels unplanned rather than constructed.

## PART 2 — THE EMOTIONAL FIELD UNDERNEATH
Name 4-6 emotional states embedded in the story without being directly stated. For each: quote the exact phrase that carries the emotion, name the specific emotion, explain what it reveals about what this person actually values or fears. Be precise — not "sadness" but "grief at what was left behind."

## PART 3 — THE ASSUMPTIONS RUNNING YOUR STORY
The 5 most load-bearing assumptions in this story. Rank 1-5, most load-bearing first. Format each exactly as:
[number]. "[exact quote from story]" — [why this assumption is load-bearing]

## PART 4 — WHAT MUST BE TRUE FOR THIS FUTURE TO EXIST
4 conditions — technological, social, relational, or systemic — that the world would need to meet for this story's version of success to be possible. These are not assumptions about the person. They are conditions about the world. Quote story evidence where relevant.

## PART 5 — WHAT TO WATCH FOR RIGHT NOW
3 signals classified exactly as:
EYEWITNESS: [something they'd notice in daily life without trying — no research required]
EXPLAINER: [something that connects this signal to other domains or industries]
EXPERT: [something only people deep in this space would catch]

## PART 6 — WHAT'S MISSING AND WHAT THAT MEANS
What was conspicuously absent from the story given what they said they were circling? Name it directly. Absence of evidence is evidence.

## PART 8 — DEFAULT NARRATIVE

NAME IT
One sentence. The exact narrative running underneath this story — the invisible belief or tension that has been shaping decisions without being named. Not a character type or archetype ("the visionary," "the teacher-mystic"). Not a summary of their views. The sentence that makes someone say "that's exactly the story I've been living." It names a structural belief — what must be true, what is at stake, what is being protected — in the specific form this writer's story reveals it.

WHY IT MATTERS
Two to three sentences. What this narrative has already been building in the background — decisions made, paths taken, energy spent — without the person choosing it consciously. Make it feel like recognition, not accusation.

THE EVIDENCE IN YOUR STORY
Two to four specific moments from the story that prove this narrative is already active. Each one should feel like a fingerprint, not a critique.

WHAT IT COSTS
One to two sentences. Not what's wrong with the narrative — what it makes impossible to see or do while it stays invisible. This is the reason naming it matters.

ONE MOVE
One specific action that addresses both what the analysis revealed and what the Default Narrative has been building. Under 2 hours. Under $50. Produces real signal from actual humans — not planning, not research, not more thinking. It must be specific to what this person actually wrote and it must test whether the narrative is load-bearing or optional. Not "reflect on it." Something that produces actual signal.

The tone throughout should feel like discovery, not diagnosis. The person should read this and think "how did it know that" — not "I'm being analyzed."`;
}

const MOCK_READING = `## YOUR OWN WORDS
"[mock unplanned line from your story]"
This line stands out because it bypassed the writer's editorial filter. It names something specific before the writer could decide whether to include it.
Before you read further, consider: What were you trying not to say when you wrote this?

## PART 0 — THE WORLDVIEW UNDERNEATH
This story assumes that the world rewards those who stay oriented while everything shifts around them. The future this creates is one where steadiness becomes rare enough to be valuable. What falls through the cracks is the possibility that the disorientation is the point — that it is trying to tell you something rather than be survived.

## PART 1 — WHAT YOU DIDN'T PLAN TO WRITE
Three things surfaced that the writer did not plan to include.

## PART 2 — THE EMOTIONAL FIELD UNDERNEATH
Four emotional states run under the surface of this story without being named directly.

## PART 3 — THE ASSUMPTIONS RUNNING YOUR STORY
1. "[quote from story]" — this assumption is the most load-bearing because it determines what counts as success.
2. "[quote]" — this frames what kind of problem this is.
3. "[quote]" — this sets the timeline.
4. "[quote]" — this defines who else matters.
5. "[quote]" — this determines what would count as failure.

## PART 4 — WHAT MUST BE TRUE FOR THIS FUTURE TO EXIST
Four conditions the world would need to meet for this story's version of success to be possible.

## PART 5 — WHAT TO WATCH FOR RIGHT NOW
EYEWITNESS: Something you would notice in daily life without trying.
EXPLAINER: Something that connects this signal to other domains.
EXPERT: Something only people deep in this space would catch.

## PART 6 — WHAT'S MISSING AND WHAT THAT MEANS
The story does not mention [absence]. Given what you said you were circling, this absence is significant. It suggests the thing you most need to decide has not yet been named in the story.

## PART 8 — DEFAULT NARRATIVE

NAME IT
The story you keep living is: the only way through is to be more prepared than the situation requires.

WHY IT MATTERS
This narrative has been building something quietly. The decisions that came from it were not wrong — they were the decisions of someone who learned early that readiness was protection. The cost has been invisible because it has always felt like competence.

THE EVIDENCE IN YOUR STORY
The evidence is in the specific moments where the story stopped moving forward and started cataloguing.

WHAT IT COSTS
This narrative makes it almost impossible to start something before you feel ready. The bar for readiness keeps rising because it is doing a job the story does not name.

ONE MOVE
Find one person who recently made the move you keep circling. Ask them what they wish they had known at the moment they decided. Not advice — what they actually felt in the room when it became real. Under an hour, free, and it will tell you whether your preparation is for the decision or for the story about the decision.`;

export async function POST(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    const story = (await q('select * from stories where id=$1', [params.id]))[0];
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (!b.token || hashToken(b.token) !== story.token_hash) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    if (story.reading) return NextResponse.json({ reading: story.reading });

    const stage = ['early', 'mid', 'deep'].includes(b.stage) ? b.stage : 'early';
    const lens = String(b.lens || '').trim().slice(0, 200);

    const session = story.session_id
      ? (await q('select * from sessions where id=$1', [story.session_id]))[0]
      : null;
    const idea = story.context || (session && (session.scene || session.big_question || session.prompt)) || '';

    if (process.env.MOCK_CLAUDE === '1') {
      const reading = { raw: MOCK_READING };
      await q('update stories set reading=$1 where id=$2', [JSON.stringify(reading), params.id]);
      return NextResponse.json({ reading });
    }

    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    const client = new Anthropic();
    const prompt = buildPrompt(idea, story.headline || '', story.body, stage, lens);

    async function callClaude() {
      const r = await client.messages.create({
        model: MODEL, max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    }

    let raw = await callClaude();
    if (!headersPresent(raw)) raw = await callClaude();

    const reading = { raw };
    await q('update stories set reading=$1 where id=$2', [JSON.stringify(reading), params.id]);
    return NextResponse.json({ reading });
  } catch (e) { return fail(e); }
}
