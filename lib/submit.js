import { q, newId, newToken, hashToken, publicPoints, mapFields } from '@/lib/db';
import { placeOne } from '@/lib/claude';

/* Shared by open prompts (/p/slug) and live sessions (/s/id). */
export function readStory(b) {
  return {
    body: String(b.text || '').trim(),
    name: String(b.name || '').trim().slice(0, 60),
    signal: String(b.signal || '').trim().slice(0, 300),
    headline: String(b.headline || '').trim().slice(0, 120),
    context: String(b.context || '').trim().slice(0, 160),
    shared: b.shared === true,
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
  await q(
    `insert into stories (id,session_id,name,signal,body,headline,context,shared,token_hash,is_test)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, s.id, st.name, st.signal, st.body, st.headline, st.context, st.shared, hashToken(token), st.isTest || false]
  );
  const story = { id, name: st.name, signal: st.signal, headline: st.headline, body: st.body, context: st.context, shared: st.shared, x: null, y: null };

  let warning = null;
  if (s.axes) {
    try {
      const anchors = await q(
        'select body,x,y from stories where session_id=$1 and x is not null and id<>$2 and is_test=false order by created_at desc limit 8',
        [s.parent_id || s.id, id]
      );
      let ctx = s.prompt;
      if (st.context) ctx += `\n\nWhat the writer named first: ${st.context}`;
      if (st.signal) ctx += `\n\nSignal the writer chose: ${st.signal}`;
      const sc = await placeOne(ctx, s.axes, story, anchors);
      await q('update stories set x=$2,y=$3,ox=$2,oy=$3,xq=$4,yq=$5,xw=$6,yw=$7 where id=$1',
        [id, sc.x, sc.y, sc.xq, sc.yq, sc.xw, sc.yw]);
      Object.assign(story, sc);
    } catch (e) {
      console.error(e);
      warning = 'Your story is saved, but placing it on the map failed. Try again in a minute.';
    }
  }
  return { story, token, warning };
}

/* Stories for an open prompt's public map: its own, plus stories from live sessions
   created from it (shown as Anonymous). Excludes test stories. */
export async function promptMap(s) {
  const rows = await q(
    `select t.*, (t.session_id <> $1) as via_session from stories t
     where (t.session_id = $1 or t.session_id in (select id from sessions where parent_id = $1))
     and t.is_test = false
     order by t.created_at`,
    [s.id]
  );
  return { ...mapFields(s), points: publicPoints(s, rows) };
}

export async function sessionMap(s, withBackground) {
  const rows = await q('select * from stories where session_id=$1 and is_test=false order by created_at', [s.id]);
  const map = { ...mapFields(s), points: publicPoints(s, rows) };
  if (withBackground && s.parent_id) {
    const bg = await q('select * from stories where session_id=$1 and x is not null and is_test=false order by created_at', [s.parent_id]);
    map.background = bg.map((t) => ({ id: t.id, x: t.x, y: t.y }));
  }
  return map;
}
