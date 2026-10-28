'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import StoryMap, { Mark, signalColors } from './StoryMap';
import BrandBar from './BrandBar';
import { artSvg, decision, signalIcon } from '@/lib/cards';
import { questions } from '@/lib/questions';

const ANCHOR = 'Start with a specific morning. Where are you? What do you see first?';
const TEST_STORIES = [
  "I wake up and the phone is already full of messages. The project launched last night and the numbers are worse than expected. I sit at the kitchen table trying to decide whether to tell the team or wait for the next data pull.",
  "The office is quiet. Everyone has gone remote and I am one of two people still coming in. I make coffee and look at the empty desks and think about the decision I made six months ago to stay in my role.",
  "I am in the middle of a conversation with someone who disagrees with everything I have done this year. They are not wrong. I am nodding and taking notes and wondering what happens next.",
];
const STEPS = ['Scene', 'Write', 'Name', 'Map', 'Think'];
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const DRIFT = /\b(I think|I believe|I guess|AI will|in the future|probably|people will)\b/i;

function leadLine(s, context, signal) {
  if (s.ask && context) return s.ask.lead.replace('{x}', context);
  if (s.scene) return s.scene;
  if (signal && s.year) return `It's ${s.year}. The signal you picked is now how everyone lives.`;
  return s.prompt || s.bigQuestion;
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
function cornerPoles(k, axes) { return `${k[0] === 'l' ? axes.x.low : axes.x.high} + ${k[1] === 'l' ? axes.y.low : axes.y.high}`; }

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
  const [pastArrows, setPastArrows] = useState([]);
  const arrowsKey = `sm-past-arrows-${mode}-${id}`;
  const [peek, setPeek] = useState(null);
  const [qi, setQi] = useState(0);
  const [notes, setNotes] = useState({});
  const [listening, setListening] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [readingStage, setReadingStage] = useState('idle'); // idle | picking | loading | done
  const [readingResult, setReadingResult] = useState(null);
  const [readingStageVal, setReadingStageVal] = useState('');
  const [readingLens, setReadingLens] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [fillIdx, setFillIdx] = useState(0);
  const recRef = useRef(null);
  const taRef = useRef(null);
  const readingKey = `sm-reading-${mode}-${id}`;

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
    ls.del(mineKey); ls.del(draftKey); ls.del(arrowsKey); ls.del(readingKey);
    window.location.reload();
  }

  async function fetchReading() {
    setReadingStage('loading'); setMsg('');
    try {
      const r = await fetch(`/api/stories/${mine.story.id}/reading`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mine.token, stage: readingStageVal, lens: readingLens }),
      });
      const j = await r.json();
      if (!r.ok) { setReadingStage('picking'); setMsg(j.error || 'Could not get reading.'); return; }
      ls.set(readingKey, j.reading);
      setReadingResult(j.reading);
      setReadingStage('done');
    } catch (e) { setReadingStage('picking'); setMsg(String(e.message || e)); }
  }
  function tryAnotherDirection() {
    if (me && me.arrow) {
      const updated = [...pastArrows, me.arrow].slice(-4);
      setPastArrows(updated);
      ls.set(arrowsKey, updated);
    }
    setQi(0);
    setDrawing(true);
    setStage('map');
  }
  useEffect(() => {
    if (mine) {
      setNotes(ls.get('sm-notes-' + mine.story.id) || {});
      setPastArrows(ls.get(arrowsKey) || []);
      const saved = ls.get(readingKey);
      if (saved) { setReadingResult(saved); setReadingStage('done'); }
    }
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTestMode(document.cookie.split(';').some((c) => c.trim() === 'sm_test=1'));
  }, []);
  function note(i, v) { const n = { ...notes, [i]: v }; setNotes(n); if (mine) ls.set('sm-notes-' + mine.story.id, n); }

  if (err) return <main className="flow"><BrandBar /><p className="warn center">{err}</p></main>;
  if (!s || stage === 'loading') return <main className="flow"><BrandBar /><p className="note center">Loading…</p></main>;

  const stepIdx = { scene: 0, write: 1, name: 2, placing: 2, waiting: 3, map: 3, think: 4, end: 4 }[stage] ?? 0;
  const lead = leadLine(s, context, signal);
  const slug = s.cardSlug || s.slug || 'keep-circling';
  const dec = decision(slug, s.title);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const drift = DRIFT.test(text.slice(-180));
  const { tags, shape } = signalColors(points);

  return (
    <main className="flow">
      <BrandBar right={!isSession && <a className="textlink" href="/">Choose a different decision</a>} />
      {!['closed'].includes(stage) && (
        <div className="steps" aria-label="Progress">
          {STEPS.map((t, i) => <div key={t} className={i < stepIdx ? 'done' : i === stepIdx ? 'on' : ''}>{t}</div>)}
        </div>
      )}

      {stage === 'closed' && (
        <section className="stage center" style={{ gap: 18, paddingTop: 40 }}>
          <div className="icon-badge" dangerouslySetInnerHTML={{ __html: artSvg(slug) }} />
          <h3>{dec.q}</h3>
          <p className="sub">Writing hasn't started yet. This page opens by itself when it does.</p>
        </section>
      )}

      {stage === 'scene' && (
        <section className="stage">
          <div className="stage-head">
            <div className="icon-badge" dangerouslySetInnerHTML={{ __html: artSvg(slug) }} />
            <h3>{dec.q}</h3>
            {dec.why && <p className="sub">{dec.why}</p>}
          </div>
          {s.ask ? (
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (context.trim()) setStage('write'); }}>
              <label htmlFor="ask">{s.ask.label}</label>
              <input id="ask" autoFocus value={context} maxLength={140} onChange={(e) => setContext(e.target.value)} placeholder={s.ask.placeholder} />
              <p className="note">One line is enough. It sets the scene for your story.</p>
              <div className="center"><button className="big primary" type="submit" disabled={!context.trim()}>Write for {minutes} minutes →</button></div>
            </form>
          ) : (
            <>
              <div className="twoways">
                <div className="way">
                  <span className="kicker">Already have something in mind?</span>
                  <button className="big primary" type="button" onClick={() => { setSignal(null); setStage('write'); }}>Write for {minutes} minutes →</button>
                </div>
                <div className="way">
                  <span className="kicker">Want a nudge?</span>
                  <p className="sub">Pick a signal below. Signals are made-up glimpses of how this could change. They're there to get you imagining, not to tell you what to write.</p>
                </div>
              </div>
              <div className="signals">
                {s.signals.map((g, i) => (
                  <button key={i} type="button" className="sigcard" style={{ '--i': i }} onClick={() => { setSignal(g); setStage('write'); }}>
                    <svg className="sig-art" viewBox="0 0 100 92" dangerouslySetInnerHTML={{ __html: signalIcon(g.type) }} />
                    <span className="sig-type">{g.type}</span>
                    <span>{g.text}</span>
                  </button>
                ))}
              </div>
            </>
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
                <div className="row" style={{ marginTop: 8 }}><button type="button" className="textlink change" onClick={() => setStage('scene')}>Pick another</button><button type="button" className="textlink change" onClick={() => setSignal(null)}>Write without it</button></div></div>
            </div>
          )}
          <div className="rules"><span>Don't plan it</span><span>Don't make it good</span><span>Anything is valid</span><span>Keep going</span></div>
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
              {testMode && (
                <div style={{ marginTop: 6, textAlign: 'center' }}>
                  <button type="button" className="quiet" onClick={() => {
                    setText(TEST_STORIES[fillIdx % TEST_STORIES.length]);
                    setFillIdx((f) => f + 1);
                    if (!startedAt) setStartedAt(Date.now());
                  }}>Fill with a sample story</button>
                </div>
              )}
              <div className="center" style={{ marginTop: 18 }}>
                <button className="big" type="button" disabled={!testMode && text.trim().length < 20} onClick={() => { if (recRef.current) recRef.current.stop(); setStage('name'); }}>I'm done writing →</button>
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
            <p className="sub">Three to five words. What you'd call this world.</p>
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
          <p className="sub">Finding where it lands among everyone else's.</p>
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
                arrowFor={drawing && mine ? mine.story.id : null} onArrow={setArrow}
                pastArrowEnds={pastArrows.length ? pastArrows : undefined} />
            </div>
            {map.axes && (map.axes.x.lowDesc || map.axes.y.lowDesc) && (
              <div className="axis-legend">
                <span className="kicker">What the axes mean</span>
                {['x', 'y'].map((k) => {
                  const ax = map.axes[k];
                  if (!ax || (!ax.lowDesc && !ax.highDesc)) return null;
                  const dir = k === 'x' ? 'Horizontal' : 'Vertical';
                  return (
                    <div key={k} className="axis-legend-row">
                      <strong>{dir}: {ax.name}</strong>
                      {ax.lowDesc && <span><em>← {ax.low}</em> {ax.lowDesc}</span>}
                      {ax.highDesc && <span><em>{ax.high} →</em> {ax.highDesc}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="legend">
              <span><svg viewBox="-10 -10 20 20"><circle r="7" fill="#a72f39" /></svg>You</span>
              {tags.length > 1 && tags.slice(0, 5).map((t) => (
                <span key={t}><svg viewBox="-10 -10 20 20"><Mark shape={shape(t)} r={6} fill="#afbeb1" stroke="#afbeb1" /></svg>{t.split(':')[0]}</span>
              ))}
              {points.some((p) => p.source === 'card-exercise') && <span><svg viewBox="-10 -10 20 20"><circle r="6" fill="none" stroke="#afbeb1" strokeWidth="2" /></svg>From the 90-second card exercise</span>}
              {points.some((p) => p.arrow) && <span>→ where they'd rather be</span>}
            </div>
          </div>
          <div className="side">
            {stage === 'map' && me && me.x != null && (
              <div className="landed">
                <span className="kicker">Where you landed</span>
                <p className="where">{where(map.axes, me)}</p>
                {me.xq && <p className="quote">"{me.xq}"</p>}
                {(() => {
                  const c = corners(points, me);
                  return (
                    <p className="note">
                      {c.same === 0 ? "You're the first story in this corner. " : `You're one of ${c.same + 1} stories in this corner. `}
                      {c.empty.length > 0 && <>Nobody has written this corner yet: <em>{cornerPoles(c.empty[0], map.axes)}</em>.</>}
                    </p>
                  );
                })()}
                {!drawing ? (
                  <div className="stack" style={{ marginTop: 6 }}>
                    <button className="big primary" type="button" onClick={() => { setDrawing(true); setPeek(null); }}>{me.arrow || me.stays ? 'Redraw my arrow' : "Draw where you'd rather be"}</button>
                    {(me.arrow || me.stays) && <button className="big" type="button" onClick={() => { setQi(0); setStage('think'); }}>Think it through →</button>}
                  </div>
                ) : (
                  <div className="stack" style={{ marginTop: 6 }}>
                    <p className="nudge">Tap or drag on the map to where you'd rather be. Anywhere you like.</p>
                    <div className="row">
                      <button type="button" onClick={stay}>I'd stay here</button>
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
                  <button type="button" className="textlink" onClick={tryAnotherDirection}>Try another direction</button>
                </div>
              </div>
            )}

            {stage === 'end' && (
              <div className="stack">
                <h3>A narrative only runs if nothing interrupts it.</h3>
                <p className="sub">You just drew the interrupt.</p>
                <div className="endcards">
                  {!isSession && <button type="button" className="endcard" onClick={restart}><strong>Write another</strong>Same question, new story.</button>}
                  <a className="endcard" href="/"><strong>Try a different decision</strong>Four more cards are waiting.</a>
                </div>
                <button type="button" className="textlink" onClick={tryAnotherDirection}>Try another direction</button>
                {!isSession && (
                  <div className="reading-panel">
                    {readingStage === 'idle' && (
                      <button type="button" className="endcard reading-cta" onClick={() => setReadingStage('picking')}>
                        <strong>Get your reading</strong>What your story reveals that you didn't plan to write.
                      </button>
                    )}
                    {readingStage === 'picking' && (
                      <div className="stack">
                        <span className="kicker">Where are you with this decision?</span>
                        <div className="stage-picks">
                          {[['early', 'Just starting', "You're still figuring out what you want."],
                            ['mid', 'In the middle', "You've gone some distance. Not done yet."],
                            ['deep', 'Deep in it', "You've been here a long time. This is your world."]].map(([val, label, desc]) => (
                            <button key={val} type="button"
                              className={'stage-pick' + (readingStageVal === val ? ' on' : '')}
                              onClick={() => setReadingStageVal(val)}>
                              <strong>{label}</strong>{desc}
                            </button>
                          ))}
                        </div>
                        <div>
                          <label htmlFor="rlens" className="note">A lens or worldview to read it through (optional)</label>
                          <input id="rlens" value={readingLens} onChange={(e) => setReadingLens(e.target.value)}
                            placeholder="e.g. stoicism, systems thinking…" maxLength={200} />
                        </div>
                        <div className="row">
                          <button type="button" className="big primary" disabled={!readingStageVal} onClick={fetchReading}>Read my story</button>
                          <button type="button" className="quiet" onClick={() => setReadingStage('idle')}>Not now</button>
                        </div>
                        {msg && <p className="warn">{msg}</p>}
                      </div>
                    )}
                    {readingStage === 'loading' && (
                      <div className="reading-loading">
                        <svg viewBox="0 0 180 180" aria-hidden="true">
                          {[34, 54, 74, 88].map((r, i) => <ellipse key={i} cx="90" cy="90" rx={r} ry={r * 0.55} fill="none" stroke={i % 2 ? '#79998b' : '#afbeb1'} strokeWidth="1.5" />)}
                          <circle cx="90" cy="90" r="8" fill="#a72f39" />
                        </svg>
                        <p className="sub">Reading your story…</p>
                      </div>
                    )}
                    {readingStage === 'done' && readingResult && (() => {
                      const raw = readingResult.raw || '';
                      const chunks = ('## ' + raw.replace(/^\s*## /, '')).split(/\n(?=## )/);
                      const sections = chunks.map((chunk) => {
                        const nl = chunk.indexOf('\n');
                        const header = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/^## /, '').trim();
                        const body = nl === -1 ? '' : chunk.slice(nl + 1).trim();
                        return { header, body };
                      }).filter((s) => s.header);
                      let oneMoveText = '';
                      const renderedSections = sections.map((sec) => {
                        let body = sec.body;
                        if (sec.header.startsWith('PART 8')) {
                          const omIdx = body.search(/\bONE MOVE\b/);
                          if (omIdx !== -1) { oneMoveText = body.slice(omIdx + 8).trim(); body = body.slice(0, omIdx).trim(); }
                        }
                        return { ...sec, body };
                      });
                      return (
                        <div className="reading-sections">
                          {renderedSections.map(({ header, body }) => {
                            const isPart8 = header.startsWith('PART 8');
                            return (
                              <details key={header} className={'reading-section' + (isPart8 ? ' highlight' : '')} open={isPart8 || undefined}>
                                <summary>{header}</summary>
                                <div className="reading-body">
                                  {body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                              </details>
                            );
                          })}
                          {oneMoveText && (
                            <div className="one-move-card">
                              <span className="kicker">One Move</span>
                              <p>{oneMoveText}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
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
