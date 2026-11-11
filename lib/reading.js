import Anthropic from '@anthropic-ai/sdk';
import { q } from '@/lib/db';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const EXPECTED = ['## PART 1', '## PART 2', '## PART 3'];

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
- PART 3 — EMOTIONAL FIELD & DEFAULT NARRATIVE: Do not read withdrawal, detachment, or observer stances as loneliness, fear, or avoidance. If the writer's lens treats these as correct epistemic or ontological positions, name the emotion underneath accurately — do not project deficit where their framework sees function. For the default narrative: STOP before naming it. Ask: did this person fall into this narrative, or did they build it? If the story shows internal consistency, decades of development, or deliberate philosophical positioning — the narrative is their methodology, not a trap. Replace WHAT IT MAKES INVISIBLE with WHAT THIS CONFIRMS: one to two sentences on what the story validates about the direction they are already in.
---`;

  return `You are analyzing a 10-minute clarity sprint. Someone has been circling a decision, idea, or question and wrote a story where it resolved. Surface what their writing reveals that analytical thinking couldn't reach.

For every finding, quote their exact words as evidence. If something is absent from the story, name it — absence is information.

${calibrationBlock}

What they're circling: ${idea || 'not specified'}
Headline they gave it: ${headline || 'not specified'}
Story they wrote:
${story}

Respond with exactly these sections in exactly this order, using exactly these headers:

## PART 1 — THE WORLDVIEW UNDERNEATH
What does this story assume to be permanently true about how the world works — about people, systems, and what gets rewarded? What future does this worldview create if it's right? What falls through the cracks if it's wrong?

## PART 2 — WHAT YOU DIDN'T PLAN TO WRITE
Two or three things that surfaced in the writing that the person didn't consciously plan to include. Quote exact phrases. Explain why each feels unplanned rather than constructed.

## PART 3 — THE EMOTIONAL FIELD & DEFAULT NARRATIVE
Name 3–4 emotional states embedded in the story without being directly stated. For each: quote the exact phrase that carries the emotion, name the specific emotion, explain what it reveals about what this person values or fears. Be precise — not "sadness" but "grief at what was left behind."

Then name the default narrative running underneath this story — the invisible belief or tension that has been shaping decisions without being named. Format it as:

YOUR DEFAULT NARRATIVE
One sentence. The exact narrative running underneath — the sentence that makes someone say "that's exactly the story I've been living." It names a structural belief: what must be true, what is at stake, what is being protected. The person should feel seen by this sentence, not labeled.

WHY THIS SHAPES YOUR DECISIONS
Two to three sentences. Not "here is what you have." Make it feel like consequence: what this narrative has already built in the background — decisions made, paths taken, options quietly ruled out — without the person ever consciously choosing it. The reader should feel the weight of recognising something that was already running.

WHAT IT MAKES INVISIBLE
One to two sentences. Not what is wrong with the narrative — what it makes structurally impossible to see or do as long as it stays unnamed. Frame it as an opening, not a verdict.

The tone throughout should feel like discovery, not diagnosis. The person should read this and think "how did it know that" — not "I'm being analyzed."`;
}

export const MOCK_READING = `## PART 1 — THE WORLDVIEW UNDERNEATH
This story assumes that the world rewards those who stay oriented while everything shifts around them. The future this creates is one where steadiness becomes rare enough to be valuable. What falls through the cracks is the possibility that the disorientation is the point — that it is trying to tell you something rather than be survived.

## PART 2 — WHAT YOU DIDN'T PLAN TO WRITE
Three things surfaced that the writer did not plan to include. First, the detail about the empty desks — it arrives without commentary, which is how unplanned observations arrive. Second, the phrase "one of two people" — the writer named their own rarity without seeming to notice. Third, the word "wondering" in the final sentence — it signals that the story doesn't resolve, which the writer may not have intended to admit.

## PART 3 — THE EMOTIONAL FIELD & DEFAULT NARRATIVE
Four emotional states run under the surface of this story without being named directly.

"The numbers are worse than expected" — carries the specific anxiety of being responsible for a result you didn't cause alone. Not fear of failure. Accountability without control.

"I sit at the kitchen table" — carries the particular stillness of someone who has stopped moving in order to think. Not calm. Suspended action.

"I am one of two people still coming in" — carries a quiet pride that is immediately complicated by isolation. Not loneliness. The cost of a decision that turned out to be right.

"I am nodding and taking notes" — carries something close to performed agreement. Not dishonesty. Strategic patience.

YOUR DEFAULT NARRATIVE
The story you keep living is: I stay because staying is proof that I was right to stay.

WHY THIS SHAPES YOUR DECISIONS
This narrative has been building a particular kind of evidence — decisions that justify themselves by the fact that you haven't left. The commitment reads as conviction. The staying reads as certainty. It has quietly ruled out every exit that couldn't be framed as failure.

WHAT IT MAKES INVISIBLE
As long as this stays unnamed, leaving will always feel like betraying your own judgment. What it makes impossible to see is that you could change course and still have been right to stay as long as you did.`;

export async function generateReading(story, session, { stage = 'early', lens = '' } = {}) {
  if (story.reading) return story.reading;

  const idea = story.context || (session && (session.scene || session.big_question || session.prompt)) || '';

  if (process.env.MOCK_CLAUDE === '1') {
    const reading = { raw: MOCK_READING };
    await q('update stories set reading=$1 where id=$2', [JSON.stringify(reading), story.id]);
    return reading;
  }

  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const prompt = buildPrompt(idea, story.headline || '', story.body, stage, lens);

  async function callClaude() {
    const r = await client.messages.create({
      model: MODEL, max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });
    return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  let raw = await callClaude();
  if (!headersPresent(raw)) raw = await callClaude();

  const reading = { raw };
  await q('update stories set reading=$1 where id=$2', [JSON.stringify(reading), story.id]);
  return reading;
}
