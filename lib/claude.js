import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

function parseJSON(t) {
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('Claude did not return JSON');
  return JSON.parse(t.slice(s, e + 1));
}

async function askJSON(prompt, maxTokens = 4000) {
  if (process.env.MOCK_CLAUDE === '1') return mock(prompt);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic();
  const r = await client.messages.create({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
  return parseJSON(r.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

const clamp = (v) => Math.max(-5, Math.min(5, Math.round((Number(v) || 0) * 10) / 10));
const payload = (stories) => JSON.stringify(stories.map((s, i) => ({ id: 'p' + (i + 1), text: s.body })));
const axisLine = (a, lo, hi) => `${a.name}. ${lo} pole (-5): ${a.low}. ${hi} pole (+5): ${a.high}.`;

export async function proposeAxes(prompt, stories) {
  const p = `A facilitator ran a writing exercise. Every person wrote a short first-person story from the same prompt. The aim is to compare the stories on a 2x2 map whose axes come from the stories themselves.

Prompt the writers received:
${prompt}

Stories (JSON):
${payload(stories)}

Find 6 candidate axes. Rules:
- Each axis is a dimension on which these stories actually differ, visible in the text. Prefer dimensions about what a story assumes or notices: who holds control, what is given up, whether the narrator acts or only receives, where the narrator's attention goes, who benefits.
- Avoid a plain good/bad or utopian/dystopian axis.
- Each pole is a concrete opposite, at most 5 words.
- Axes should be as independent of each other as possible.
- 'why' is one sentence naming which stories sit at which pole.
- 'pair' is the indexes (0-based) of the two axes that would spread these stories across the most quadrants.

Reply with only JSON: {"axes":[{"name":"","low":"","high":"","why":""}],"pair":[0,1]}`;
  const r = await askJSON(p);
  const axes = (r.axes || []).filter((a) => a && a.name && a.low && a.high).slice(0, 8)
    .map((a) => ({ name: String(a.name), low: String(a.low), high: String(a.high), why: String(a.why || '') }));
  if (axes.length < 2) throw new Error('Claude did not find two usable axes');
  let [i, j] = Array.isArray(r.pair) ? r.pair.map((n) => n | 0) : [0, 1];
  if (!axes[i]) i = 0;
  if (!axes[j] || j === i) j = i === 0 ? 1 : 0;
  return { cands: axes, pair: [i, j] };
}

/* Score a whole session together; also names quadrants and writes a readout. */
export async function placeAll(prompt, axes, stories) {
  const p = `Place each story on two axes of a 2x2 map.

Prompt the writers received:
${prompt}

Horizontal axis: ${axisLine(axes.x, 'Left', 'Right')}
Vertical axis: ${axisLine(axes.y, 'Bottom', 'Top')}

Stories (JSON):
${payload(stories)}

Rules:
- Score every story from -5 to 5 on each axis, one decimal allowed. 0 means neutral or silent on that axis. Use the full range where stories differ.
- Base each score only on the story text.
- For each axis give 'xQuote'/'yQuote': an exact contiguous quote from that story, at most 20 words, as evidence, and 'xWhy'/'yWhy': one plain sentence.
- Name the four quadrants as scenario headlines of 3 to 5 words. Keys: ll = left+bottom, hl = right+bottom, lh = left+top, hh = right+top.
- 'readout': at most 3 plain sentences on where stories cluster, where they split, and which quadrant is empty and what that may say about what this group did not imagine. Note the sample size if under 8.

Reply with only JSON: {"scores":[{"id":"","x":0,"xQuote":"","xWhy":"","y":0,"yQuote":"","yWhy":""}],"quadrants":{"ll":"","hl":"","lh":"","hh":""},"readout":""}`;
  const r = await askJSON(p, 8000);
  const out = {};
  for (const s of r.scores || []) {
    const m = /^p(\d+)$/.exec(String(s.id));
    const st = m && stories[parseInt(m[1], 10) - 1];
    if (!st) continue;
    out[st.id] = { x: clamp(s.x), y: clamp(s.y), xq: String(s.xQuote || ''), yq: String(s.yQuote || ''), xw: String(s.xWhy || ''), yw: String(s.yWhy || '') };
  }
  const qd = r.quadrants || {};
  return { scores: out, quads: { ll: String(qd.ll || ''), hl: String(qd.hl || ''), lh: String(qd.lh || ''), hh: String(qd.hh || '') }, readout: String(r.readout || '') };
}

/* Score one new story against fixed axes (default link). Uses placed stories as anchors. */
export async function placeOne(prompt, axes, story, anchors) {
  const ref = anchors.slice(-8).map((a) => ({ text: a.body.slice(0, 600), x: a.x, y: a.y }));
  const p = `Place one story on two fixed axes of a 2x2 map. Score in absolute terms: -5 means the story sits fully at the low pole, +5 fully at the high pole, 0 neutral or silent.

Prompt the writer received:
${prompt}

Horizontal axis: ${axisLine(axes.x, 'Left', 'Right')}
Vertical axis: ${axisLine(axes.y, 'Bottom', 'Top')}

Already-placed stories, for calibration (JSON):
${JSON.stringify(ref)}

The story to place:
${JSON.stringify(story.body)}

Give 'xQuote'/'yQuote': exact contiguous quotes from the story, at most 20 words each, and 'xWhy'/'yWhy': one plain sentence each.

Reply with only JSON: {"x":0,"xQuote":"","xWhy":"","y":0,"yQuote":"","yWhy":""}`;
  const r = await askJSON(p, 1500);
  return { x: clamp(r.x), y: clamp(r.y), xq: String(r.xQuote || ''), yq: String(r.yQuote || ''), xw: String(r.xWhy || ''), yw: String(r.yWhy || '') };
}

/* Deterministic stand-in for local testing (MOCK_CLAUDE=1). */
function mock(prompt) {
  if (prompt.includes('Find 6 candidate axes')) {
    return { axes: [
      { name: 'Who steers', low: 'System decides', high: 'I decide', why: 'mock' },
      { name: 'Cost noticed', low: 'Surface comfort', high: 'Price underneath', why: 'mock' },
      { name: 'Attention', low: 'Inward', high: 'Outward', why: 'mock' },
    ], pair: [0, 1] };
  }
  const h = (t) => { let n = 0; for (const c of t) n = (n * 31 + c.charCodeAt(0)) % 997; return (n % 100) / 10 - 5; };
  if (prompt.includes('Place each story')) {
    const ids = [...prompt.matchAll(/"id":"(p\d+)","text":"([^"]{0,40})/g)];
    return { scores: ids.map((m) => ({ id: m[1], x: h(m[2]), y: h(m[2] + 'y'), xQuote: m[2].slice(0, 20), yQuote: m[2].slice(0, 20), xWhy: 'mock', yWhy: 'mock' })),
      quadrants: { ll: 'Mock LL', hl: 'Mock HL', lh: 'Mock LH', hh: 'Mock HH' }, readout: 'Mock readout.' };
  }
  const body = (prompt.split('The story to place:\n')[1] || '').slice(1, 41);
  return { x: h(body), y: h(body + 'y'), xQuote: body.slice(0, 20), yQuote: body.slice(0, 20), xWhy: 'mock', yWhy: 'mock' };
}
