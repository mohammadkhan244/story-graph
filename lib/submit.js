import { q, newId, newToken, hashToken, publicPoints, mapFields } from '@/lib/db';
import { placeOne, compareRounds, generateAxesForDecision } from '@/lib/claude';

const DEFAULT_AXES = {
  x: { name: 'Who holds the wheel', low: 'Others decide', high: 'I decide', lowDesc: '', highDesc: '' },
  y: { name: 'Time ahead', low: 'Right now', high: 'Years out', lowDesc: '', highDesc: '' },
};

/* Shared by open prompts (/p/slug) and live sessions (/s/id). */
export function readStory(b) {
  return {
    body: String(b.text || '').trim(),
    name: String(b.name || '').trim().slice(0, 60),
    signal: String(b.signal || '').trim().slice(0, 300),
    headline: String(b.headline || '').trim().slice(0, 120),
    context: String(b.context || '').trim().slice(0, 160),
    shared: b.shared === true,
    participantId: String(b.participant_id || '').trim().slice(0, 32) || null,
    round: Math.max(1, Math.min(2, parseInt(b.round || 1, 10))) || 1,
    role: String(b.role || '').trim().slice(0, 60) || null,
  };
}

export function invalid(st) {
  if (st.body.length < 20) return 'Write a little more before submitting.';
  if (st.body.length > 8000) return 'That story is too long (8,000 characters max).';
  return null;
}

export async function saveAndPlace(s, st) {
  const id = newId(12);
  const token = newToken();
  const stRound = st.round || 1;
  await q(
    `insert into stories (id,session_id,name,signal,body,headline,context,shared,token_hash,is_test,participant_id,round,role)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, s.id, st.name, st.signal, st.body, st.headline, st.context, st.shared, hashToken(token), st.isTest || false, st.participantId || null, stRound, st.role || null]
  );
  const story = { id, name: st.name, signal: st.signal, headline: st.headline, body: st.body, context: st.context, shared: st.shared, x: null, y: null, round: stRound, participant_id: st.participantId || null, role: st.role || null };

  let warning = null;
  let axesForPlacement = s.axes;
  if (!axesForPlacement) {
    try {
      const axesArr = await generateAxesForDecision(s.prompt);
      axesForPlacement = { x: axesArr[0], y: axesArr[1] };
    } catch {
      axesForPlacement = DEFAULT_AXES;
    }
    await q('update sessions set axes=$2 where id=$1', [s.id, JSON.stringify(axesForPlacement)]);
  }
  if (axesForPlacement) {
    try {
      const anchors = await q(
        'select body,x,y from stories where session_id=$1 and x is not null and id<>$2 and is_test=false order by created_at desc limit 8',
        [s.parent_id || s.id, id]
      );
      let ctx = stRound === 2 && s.rounds && s.rounds[1] ? s.rounds[1].prompt : s.prompt;
      if (st.context) ctx += `\n\nWhat the writer named first: ${st.context}`;
      if (st.signal) ctx += `\n\nSignal the writer chose: ${st.signal}`;
      const sc = await placeOne(ctx, axesForPlacement, story, anchors);
      await q('update stories set x=$2,y=$3,ox=$2,oy=$3,xq=$4,yq=$5,xw=$6,yw=$7 where id=$1',
        [id, sc.x, sc.y, sc.xq, sc.yq, sc.xw, sc.yw]);
      Object.assign(story, sc);
    } catch (e) {
      console.error(e);
      warning = 'Your story is saved, but placing it on the map failed. Try again in a minute.';
    }
  }

  // For Round 2: compare with Round 1 story if same participant_id exists
  if (stRound === 2 && st.participantId) {
    try {
      const r1 = await q(
        'select body from stories where session_id=$1 and participant_id=$2 and round=1 and id<>$3 limit 1',
        [s.id, st.participantId, id]
      );
      if (r1.length > 0) {
        const flip = await compareRounds(r1[0].body, st.body);
        await q('update stories set flip=$2 where id=$1', [id, JSON.stringify(flip)]);
        story.flip = flip;
      }
    } catch (e) {
      console.error('compareRounds error:', e);
    }
  }

  return { story, token, warning };
}

/* Stories for an open prompt's public map: its own, plus stories from live sessions
   created from it (shown as Anonymous). Excludes test stories unless show_public=true or includeTest=true. */
export async function promptMap(s, includeTest = false) {
  const testFilter = includeTest ? 'true' : '(t.is_test = false or t.show_public = true)';
  const rows = await q(
    `select t.*, (t.session_id <> $1) as via_session from stories t
     where (t.session_id = $1 or t.session_id in (select id from sessions where parent_id = $1))
     and ${testFilter}
     order by t.created_at`,
    [s.id]
  );
  return { ...mapFields(s), points: publicPoints(s, rows) };
}

export async function sessionMap(s, withBackground, includeTest = false) {
  const testFilter = includeTest ? 'true' : '(is_test=false or show_public=true)';
  const rows = await q(`select * from stories where session_id=$1 and ${testFilter} order by created_at`, [s.id]);
  const map = { ...mapFields(s), points: publicPoints(s, rows) };
  if (withBackground && s.parent_id) {
    const bg = await q(`select * from stories where session_id=$1 and x is not null and ${testFilter} order by created_at`, [s.parent_id]);
    map.background = bg.map((t) => ({ id: t.id, x: t.x, y: t.y }));
  }
  return map;
}
