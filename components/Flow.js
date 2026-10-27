'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import StoryMap, { Mark, signalColors } from './StoryMap';
import BrandBar from './BrandBar';
import { cardSvg, signalIcon } from '@/lib/cards';

const ANCHOR = 'Start with a specific morning. Where are you? What do you see first?';
const STEPS = ['Scene', 'Write', 'Name', 'Map', 'Think'];
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const DRIFT = /\b(I think|I believe|I guess|AI will|in the future|probably|people will)\b/i;

function leadLine(s, context) {
  if (s.ask && context) return s.ask.lead.replace('{x}', context);
  if (s.scene) return s.scene;
  if (s.signals && s.signals.length && s.year) return `It's ${s.year}. The signal you picked is now how everyone lives.`;
  return s.bigQuestion || s.prompt;
}
const side = (v, a) => (v < -0.8 ? a.low : v > 0.8 ? a.high : null);

function where(axes, p) {
  const xs = side(p.x, axes.x), ys = side(p.y, axes.y);
  if (!xs && !ys) return <>Your story sits near the middle of both axes.</>;
  if (xs && ys) return <>Your story leans toward <em>{xs}</em> and <em>{ys}</em>.</>;
  return <>Your story leans toward <em>{xs || ys}</em>.</>;
}
function corners(points, me) {
  const q = (p) => (p.x < 0 ? 'l' : 'h') + (p.y < 0 ? 'l' : 'h');
  const counts = { ll: 0, lh: 0, hl: 0, hh: 0 };
  points.forEach((p) => { if (p.x != null) counts[q(p)]++; });
  const mine = me ? q(me) : null;
  const empty = Object.keys(counts).filter((k) => counts[k] === 0);
  return { same: mine ? counts[mine] - 1 : 0, empty };
}
function cornerName(k, axes) { return `${k[0] === 'l' ? axes.x.low : axes.x.high} · ${k[1] === 'l' ? axes.y.low : axes.y.high}`; }

function questions(axes, me) {
  if (!me) return [];
  if (me.stays || !me.arrow) return [
    <>What has to stay true for you to remain where your dot is?</>,
    <>What could pull your dot away from here without you noticing?</>,
    <>Who is already living where you are, and what do they know that you don't?</>,
    <>What's one move you could make this week that would tell you staying here is right?</>,
  ];
  const dx = me.arrow.x - me.x, dy = me.arrow.y - me.y;
  const a = Math.abs(dx) >= Math.abs(dy) ? axes.x : axes.y;
  const from = (Math.abs(dx) >= Math.abs(dy) ? me.x : me.y) < 0 ? a.low : a.high;
  const to = (Math.abs(dx) >= Math.abs(dy) ? me.arrow.x : me.arrow.y) < 0 ? a.low : a.high;
  const P = from === to ? <>further toward <em>{to}</em></> : <>from <em>{from}</em> toward <em>{to}</em></>;
  return [
    <>What needs to happen first to move you {P}?</>,
    <>What must be true for that future to exist, for you, for the people around you, and for the wider world?</>,
    <>Where is that future already being built, or resisted?</>,
    <>What's the hardest part of getting there to believe?</>,
    <>What's one move you could make this week that would tell you if this direction is right?</>,
  ];
}

export default function Flow({ mode, id }) {
  const isSession = mode === 'session';
  const base = isSession ? `/api/sessions/${id}` : `/api/p/${id}`;
  const mineKey = `sm-mine-${mode}-${id}`;
  const draftKey = `sm-draft-${mode}-${id}`;

  const [s, setS] = useState(null);
  const [map, setMap] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('loading');
  const [context, setContext] = useState('');
  const [signal, setSignal] = useState(null);
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [headline, setHeadline] = useState('');
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [hp, setHp] = useState('');
  const [msg, setMsg] = useState('');
  const [mine, setMine] = useState(null); // {story, token}
  const [drawing, setDrawing] = useState(false);
  const [peek, setPeek] = useState(null);
  const [qi, setQi] = useState(0);
  const [notes, setNotes] = useState({});
  const [listening, setListening] = useState(false);
  const [reveal, setReveal] = useState(false);
  const recRef = useRef(null);
  const taRef = useRef(null);

  async function load() {
    const r = await fetch(base, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Could not load.');
    setS(j.session); if (j.map) setMap(j.map);
    return j;
  }

  useEffect(() => {
    load().then((j) => {
      const m = ls.get(mineKey);
      const d = ls.get(draftKey);
      if (m) { setMine(m); setStage(j.map ? 'map' : 'waiting'); return; }
      if (d) { setContext(d.context || ''); setSignal(d.signal || null); setText(d.text || ''); setStartedAt(d.startedAt || null); }
      const sess = j.session;
      if (isSession && !(sess.status === 'open')) { setStage('closed'); return; }
      const needsScene = (sess.ask && !d?.context) || (sess.signals && sess.signals.length && !d?.signal);
      setStage(d && d.text ? 'write' : needsScene ? 'scene' : 'write');
    }).catch((e) => setErr(String(e.message || e)));
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* keep the draft safe on this device */
  useEffect(() => {
    if (stage === 'loading' || mine) return;
    const t = setTimeout(() => ls.set(draftKey, { context, signal, text, startedAt }), 500);
    return () => clearTimeout(t);
  }, [context, signal, text, startedAt, stage, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  /* sessions: wait for the host to open writing, or to share the map */
  useEffect(() => {
    if (!isSession || !['closed', 'waiting'].includes(stage)) return;
    const t = setInterval(() => load().then((j) => {
      if (stage === 'closed' && j.session.status === 'open') setStage(j.session.ask || (j.session.signals || []).length ? 'scene' : 'write');
      if (stage === 'waiting' && j.map) { setReveal(true); setStage('map'); }
    }).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const sharedEnd = s && s.endsAt ? new Date(s.endsAt).getTime() : null;
  const minutes = (s && s.minutes) || 10;
  const end = isSession && sharedEnd ? sharedEnd : startedAt ? startedAt + minutes * 60000 : null;
  const left = end ? end - now : minutes * 60000;
  const over = end ? left <= 0 : false;

  useEffect(() => {
    if (isSession && stage === 'write' && sharedEnd && over && text.trim().length >= 20) setStage('name');
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  function startWriting() {
    if (!startedAt) setStartedAt(Date.now());
    setTimeout(() => taRef.current && taRef.current.focus(), 50);
  }

  function toggleMic() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setMsg('Speaking works in Chrome and Safari. Typing works everywhere.'); return; }
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-US';
    r.onresult = (e) => {
      let add = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) add += e.results[i][0].transcript;
      if (add) setText((t) => (t && !/\s$/.test(t) ? t + ' ' : t) + add.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
    if (!startedAt) setStartedAt(Date.now());
  }

  async function submit() {
    setStage('placing'); setMsg('');
    try {
      const r = await fetch(`${base}/stories`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, headline, name, shared: isSession ? false : shared, context, signal: signal ? `${signal.type}: ${signal.text}` : '', website: hp }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save your story.');
      const m = { story: j.story, token: j.token };
      ls.set(mineKey, m); ls.del(draftKey); setMine(m);
      if (j.warning) setMsg(j.warning);
      if (j.map) { setMap(j.map); setReveal(true); setTimeout(() => setStage('map'), 900); }
      else setStage('waiting');
    } catch (e) { setMsg(String(e.message || e)); setStage('name'); }
  }

  async function saveArrow(body) {
    if (!mine) return;
    const r = await fetch(`/api/stories/${mine.story.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: mine.token, ...body }) });
    if (!r.ok) { setMsg('Could not save your arrow. Try again.'); return false; }
    return true;
  }

  const points = useMemo(() => {
    const pts = (map && map.points) || [];
    if (!mine) return pts;
    const has = pts.some((p) => p.id === mine.story.id);
    return has ? pts : [...pts, { ...mine.story, label: 'You' }];
  }, [map, mine]);
  const me = mine ? points.find((p) => p.id === mine.story.id) : null;
  const myQs = s && map && map.axes ? questions(map.axes, me) : [];

  function setArrow(_id, xy) {
    setMap((m) => ({ ...m, points: m.points.map((p) => (p.id === mine.story.id ? { ...p, arrow: xy, stays: false } : p)) }));
    saveArrow({ arrow: xy });
    setDrawing(false);
  }
  function stay() {
    setMap((m) => ({ ...m, points: m.points.map((p) => (p.id === mine.story.id ? { ...p, arrow: null, stays: true } : p)) }));
    saveArrow({ stays: true }); setDrawing(false);
  }
  function restart() {
    ls.del(mineKey); ls.del(draftKey);
    window.location.reload();
  }
  useEffect(() => { if (mine) setNotes(ls.get('sm-notes-' + mine.story.id) || {}); }, [mine]);
  function note(i, v) { const n = { ...notes, [i]: v }; setNotes(n); if (mine) ls.set('sm-notes-' + mine.story.id, n); }

  if (err) return <main className="flow"><BrandBar /><p className="warn center">{err}</p></main>;
  if (!s || stage === 'loading') return <main className="flow"><BrandBar /><p className="note center">Loading…</p></main>;

  const stepIdx = { scene: 0, write: 1, name: 2, placing: 2, waiting: 3, map: 3, think: 4, end: 4 }[stage] ?? 0;
  const lead = leadLine(s, context);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const drift = DRIFT.test(text.slice(-180));
  const { tags, shape } = signalColors(points);

  return (
    <main className="flow">
      <BrandBar right={!isSession && <a className="textlink" href="/">Choose a different question</a>} />
      {!['closed'].includes(stage) && (
        <div className="steps" aria-label="Progress">
          {STEPS.map((t, i) => <div key={t} className={i < stepIdx ? 'done' : i === stepIdx ? 'on' : ''}>{t}</div>)}
        </div>
      )}

      {stage === 'closed' && (
        <section className="stage center" style={{ gap: 18, paddingTop: 40 }}>
          <div className="mini-card" style={{ width: 120 }} dangerouslySetInnerHTML={{ __html: cardSvg(s.cardSlug || s.slug || 'keep-circling', s.title) }} />
          <h3>{s.title}</h3>
          <p className="sub">Writing hasn’t started yet. This page opens by itself when it does.</p>
        </section>
      )}

      {stage === 'scene' && (
        <section className="stage">
          <div className="stage-head">
            <div className="mini-card" dangerouslySetInnerHTML={{ __html: cardSvg(s.cardSlug || s.slug || 'keep-circling', s.title) }} />
            {s.ask ? <h3>{s.ask.label}</h3> : <h3>Pick the signal that grabs you.</h3>}
            {!s.ask && <p className="sub">These are made-up signals: signs that something is changing.</p>}
          </div>
          {s.ask ? (
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (context.trim()) setStage('write'); }}>
              <input autoFocus aria-label={s.ask.label} value={context} maxLength={140} onChange={(e) => setContext(e.target.value)} placeholder={s.ask.placeholder} />
              <div className="center"><button className="big" type="submit" disabled={!context.trim()}>Set the scene →</button></div>
            </form>
          ) : (
            <div className="signals">
              {s.signals.map((g, i) => (
                <button key={i} type="button" className="sigcard" style={{ '--i': i }} onClick={() => { setSignal(g); setStage('write'); }}>
                  <svg className="sig-art" viewBox="0 0 100 92" dangerouslySetInnerHTML={{ __html: signalIcon(g.type) }} />
                  <span className="sig-type">{g.type}</span>
                  <span>{g.text}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {stage === 'write' && (
        <section className="stage">
          <div className="stage-head" style={{ marginBottom: 10 }}>
            <p className="scene">{lead}</p>
            <p className="anchor">{ANCHOR}</p>
          </div>
          {signal && (
            <div className="pinned">
              <svg viewBox="0 0 100 92" dangerouslySetInnerHTML={{ __html: signalIcon(signal.type) }} />
              <div><div className="sig-type kicker">{signal.type}</div>{signal.text}
                <div><button type="button" className="textlink change" style={{ marginTop: 6 }} onClick={() => setStage('scene')}>Pick another</button></div></div>
            </div>
          )}
          <div className="rules"><span>Don’t plan it</span><span>Don’t make it good</span><span>Anything is valid</span><span>Keep going</span></div>
          {!startedAt && !(isSession && sharedEnd) ? (
            <div className="center" style={{ marginTop: 26, gap: 14 }}>
              <button className="big primary" type="button" onClick={startWriting}>Start my {minutes} minutes</button>
              <button type="button" className="textlink" onClick={toggleMic}>Or speak it instead 🎙</button>
            </div>
          ) : (
            <>
              <div className="writebar">
                <span className={'timer' + (end && left < 60000 ? ' low' : '')} aria-live="off">{over ? '00:00' : mmss(left)}</span>
                <span className="row">
                  <span className="note">{words} words</span>
                  <button type="button" className={'quiet mic' + (listening ? ' live' : '')} onClick={toggleMic}>{listening ? 'Listening… tap to stop' : 'Speak 🎙'}</button>
                </span>
              </div>
              <textarea ref={taRef} className="page" aria-label="Your story" value={text} onChange={(e) => { setText(e.target.value); if (!startedAt) setStartedAt(Date.now()); }} placeholder="I wake up and the first thing I see is…" />
              {drift && <p className="nudge">Stay in the scene. What are you doing right now?</p>}
              {over && <p className="nudge">Time. Finish your sentence, then give it a name.</p>}
              <div className="center" style={{ marginTop: 18 }}>
                <button className="big" type="button" disabled={text.trim().length < 20} onClick={() => { if (recRef.current) recRef.current.stop(); setStage('name'); }}>I’m done writing →</button>
              </div>
            </>
          )}
          {msg && <p className="note center" style={{ marginTop: 10 }}>{msg}</p>}
        </section>
      )}

      {stage === 'name' && (
        <section className="stage narrow">
          <div className="stage-head">
            <h3>Give this future a name.</h3>
            <p className="sub">Three to five words. What you’d call this world.</p>
          </div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input autoFocus aria-label="Scenario headline" value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} placeholder="The quiet takeover" style={{ font: "400 24px var(--title)", textAlign: 'center' }} />
            <div>
              <label htmlFor="nm">{isSession ? 'Name on the shared screen (optional)' : 'Your name (optional)'}</label>
              <input id="nm" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to stay anonymous" />
            </div>
            {!isSession && <label className="check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Let others read my story</label>}
            <div className="hp" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
            <div className="center" style={{ gap: 10, marginTop: 8 }}>
              <button className="big primary" type="submit">Place my story on the map</button>
              <button type="button" className="textlink" onClick={() => setStage('write')}>Back to my story</button>
            </div>
            {msg && <p className="warn center">{msg}</p>}
          </form>
        </section>
      )}

      {stage === 'placing' && (
        <section className="stage placing">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            {[34, 54, 74, 88].map((r, i) => <ellipse key={i} cx="90" cy="90" rx={r} ry={r * 0.55} fill="none" stroke={i % 2 ? '#79998b' : '#afbeb1'} strokeWidth="1.5" />)}
            <circle cx="90" cy="90" r="8" fill="#a72f39" />
          </svg>
          <h3>Reading your story…</h3>
          <p className="sub">Finding where it lands among everyone else’s.</p>
        </section>
      )}

      {stage === 'waiting' && (
        <section className="stage center" style={{ gap: 16, paddingTop: 30 }}>
          <h3>Your story is in. Look up at the screen.</h3>
          <p className="sub">Your dot shows up here when the map is shared.</p>
          {mine && <div className="peek narrow" style={{ textAlign: 'left' }}>{mine.story.headline && <strong>{mine.story.headline}</strong>}<p className="storytext">{mine.story.body}</p></div>}
        </section>
      )}

      {(stage === 'map' || stage === 'think' || stage === 'end') && map && map.axes && (
        <section className="stage mapgrid">
          <div>
            <div className="mapwrap">
              <StoryMap axes={map.axes} quads={map.quads} points={points} background={map.background || []}
                youId={mine && mine.story.id} selId={peek} reveal={reveal}
                onSelect={(pid) => setPeek(pid === peek ? null : pid)}
                arrowFor={drawing && mine ? mine.story.id : null} onArrow={setArrow} />
            </div>
            <div className="legend">
              <span><svg viewBox="-10 -10 20 20"><circle r="7" fill="#a72f39" /></svg>You</span>
              {tags.length > 1 && tags.slice(0, 5).map((t) => (
                <span key={t}><svg viewBox="-10 -10 20 20"><Mark shape={shape(t)} r={6} fill="#afbeb1" stroke="#afbeb1" /></svg>{t.split(':')[0]}</span>
              ))}
              {points.some((p) => p.source === 'card-exercise') && <span><svg viewBox="-10 -10 20 20"><circle r="6" fill="none" stroke="#afbeb1" strokeWidth="2" /></svg>From the 90-second card exercise</span>}
              {points.some((p) => p.arrow) && <span>→ where they’d rather be</span>}
            </div>
          </div>
          <div className="side">
            {stage === 'map' && me && me.x != null && (
              <div className="landed">
                <span className="kicker">Where you landed</span>
                <p className="where">{where(map.axes, me)}</p>
                {me.xq && <p className="quote">“{me.xq}”</p>}
                {(() => {
                  const c = corners(points, me);
                  return (
                    <p className="note">
                      {c.same > 0 ? `${c.same} ${c.same === 1 ? 'other story' : 'other stories'} landed in your corner. ` : 'Nobody else is in your corner yet. '}
                      {c.empty.length > 0 && <>Nobody has written the <em>{cornerName(c.empty[0], map.axes)}</em> corner.</>}
                    </p>
                  );
                })()}
                {!drawing ? (
                  <div className="stack" style={{ marginTop: 6 }}>
                    <button className="big primary" type="button" onClick={() => { setDrawing(true); setPeek(null); }}>{me.arrow || me.stays ? 'Redraw my arrow' : 'Draw where you’d rather be'}</button>
                    {(me.arrow || me.stays) && <button className="big" type="button" onClick={() => { setQi(0); setStage('think'); }}>Think it through →</button>}
                  </div>
                ) : (
                  <div className="stack" style={{ marginTop: 6 }}>
                    <p className="nudge">Tap or drag on the map to where you’d rather be. Anywhere you like.</p>
                    <div className="row">
                      <button type="button" onClick={stay}>I’d stay here</button>
                      <button type="button" className="quiet" onClick={() => setDrawing(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {stage === 'map' && me && me.x == null && <p className="sub">Your story is saved but not placed yet. {msg}</p>}

            {stage === 'think' && myQs.length > 0 && (
              <div className="qcard" key={qi}>
                <div className="qdots">{myQs.map((_, i) => <span key={i} className={i <= qi ? 'on' : ''} />)}</div>
                <p className="q">{myQs[qi]}</p>
                {!isSession && <textarea rows={3} aria-label="Your notes (only on this device)" placeholder="Jot it down. Only you can see this." value={notes[qi] || ''} onChange={(e) => note(qi, e.target.value)} />}
                <div className="row">
                  {qi > 0 && <button type="button" className="quiet" onClick={() => setQi(qi - 1)}>Back</button>}
                  {qi < myQs.length - 1
                    ? <button type="button" onClick={() => setQi(qi + 1)}>Next question</button>
                    : <button type="button" onClick={() => setStage('end')}>Done</button>}
                  <button type="button" className="textlink" onClick={() => setStage('map')}>Redraw arrow</button>
                </div>
              </div>
            )}

            {stage === 'end' && (
              <div className="stack">
                <h3>A narrative only runs if nothing interrupts it.</h3>
                <p className="sub">You just drew the interrupt.</p>
                <div className="endcards">
                  {!isSession && <button type="button" className="endcard" onClick={restart}><strong>Write another</strong>Same question, new story.</button>}
                  <a className="endcard" href="/"><strong>Try a different question</strong>Four more cards are waiting.</a>
                  <a className="endcard" href="https://early-warning-system-kappa.vercel.app/" target="_blank" rel="noreferrer"><strong>Get the full reading</strong>Write Your Future reads what your story assumes.</a>
                </div>
              </div>
            )}

            {peek && (() => {
              const p = points.find((x) => x.id === peek);
              if (!p || p.id === (mine && mine.story.id)) return null;
              return (
                <div className="peek">
                  <span className="kicker">{p.label}</span>
                  {p.headline && <strong style={{ font: '400 20px var(--title)' }}>{p.headline}</strong>}
                  {p.body ? <p className="storytext">{p.body}</p> : <p className="note">This writer kept their story private.</p>}
                  {p.stays && <p className="note">Would stay where they are.</p>}
                </div>
              );
            })()}
          </div>
        </section>
      )}
    </main>
  );
}
