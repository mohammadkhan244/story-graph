'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import StoryMap, { fmt, signalColors } from './StoryMap';
import { questions, directionLine } from '@/lib/questions';

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
  return j;
}

function Armed({ label, armedLabel, onConfirm, className = 'quiet', disabled }) {
  const [a, setA] = useState(false);
  return (
    <button type="button" className={a ? 'armed' : className} disabled={disabled}
      onClick={() => { if (!a) { setA(true); setTimeout(() => setA(false), 4000); return; } setA(false); onConfirm(); }}>
      {a ? armedLabel : label}
    </button>
  );
}

function Login({ configured, onDone }) {
  const [pw, setPw] = useState(''); const [msg, setMsg] = useState('');
  if (!configured) return <section className="panel narrow"><h2>Admin</h2><p>Set <span className="mono">ADMIN_PASSWORD</span> in your Vercel project settings, redeploy, then come back.</p></section>;
  return (
    <form className="panel narrow stack" onSubmit={async (e) => { e.preventDefault(); setMsg(''); try { await api('/api/admin/login', 'POST', { password: pw }); onDone(); } catch (er) { setMsg(er.message); } }}>
      <h2>Admin sign-in</h2>
      <div><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div className="row"><button type="submit">Sign in</button><span className="status warn">{msg}</span></div>
    </form>
  );
}

const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const emptyAxis = { name: '', low: '', high: '', why: '', lowDesc: '', highDesc: '' };

/* Serialize signals (possibly {type,text} objects) to one-per-line "TYPE: text" */
function signalsToText(signals) {
  if (!Array.isArray(signals)) return '';
  return signals.map((s) => {
    if (typeof s === 'string') return s;
    return `${s.type}: ${s.text}`;
  }).join('\n');
}

/* Parse "TYPE: text" lines back to objects (or plain strings for old sessions) */
function textToSignals(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^([^:]{1,40}):\s+(.+)/.exec(l);
    return m ? { type: m[1].trim(), text: m[2].trim() } : l;
  }).slice(0, 12);
}

export default function Admin() {
  const [auth, setAuth] = useState(null);
  const [list, setList] = useState([]);
  const [selId, setSelId] = useState(null);
  const [det, setDet] = useState(null);
  const [status, setStatus] = useState({ t: '', warn: false });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState({ title: '', prompt: '', big_question: '', instructions: '', year: '', signals: '', minutes: 10 });
  const [nw, setNw] = useState({ title: '', prompt: '', signals: '', minutes: 10 });
  const [axes, setAxes] = useState({ x: emptyAxis, y: emptyAxis });
  const [cands, setCands] = useState([]);
  const [selDot, setSelDot] = useState(null);
  const [open, setOpen] = useState({});
  const [whatIfArrow, setWhatIfArrow] = useState(null);
  const [whatIfDrawing, setWhatIfDrawing] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [includeTest, setIncludeTest] = useState(false);
  const loadedFor = useRef(null);

  const say = (t, warn = false) => setStatus({ t, warn });

  const loadList = useCallback(async () => {
    try { const j = await api('/api/admin/sessions'); setList(j.sessions); if (!selId && j.sessions[0]) setSelId(j.sessions[0].id); }
    catch (e) { if (e.status === 401) setAuth({ admin: false, configured: true }); else say(e.message, true); }
  }, [selId]);

  const loadDet = useCallback(async (id) => {
    if (!id) return;
    try {
      const j = await api(`/api/admin/sessions/${id}`);
      setDet(j);
      if (loadedFor.current !== id) {
        loadedFor.current = id;
        const s = j.session;
        setForm({
          title: s.title, prompt: s.prompt,
          big_question: s.big_question || '',
          instructions: s.instructions || '',
          year: s.year || '',
          signals: signalsToText(s.signals || []),
          minutes: s.minutes,
          hidden: !!s.hidden,
        });
        setAxes(s.axes ? { x: { ...emptyAxis, ...s.axes.x }, y: { ...emptyAxis, ...s.axes.y } } : { x: emptyAxis, y: emptyAxis });
        setCands(s.cands || []); setSelDot(null);
      }
    } catch (e) { say(e.message, true); }
  }, []);

  useEffect(() => {
    api('/api/admin/login').then((j) => {
      setAuth(j);
      if (j.admin) api('/api/admin/test-mode').then((t) => setTestMode(t.testMode)).catch(() => {});
    }).catch(() => setAuth({ admin: false, configured: false }));
  }, []);
  useEffect(() => { if (auth && auth.admin) loadList(); }, [auth, loadList]);
  useEffect(() => {
    if (!auth || !auth.admin || !selId) return;
    loadDet(selId);
    const t = setInterval(() => { if (!document.hidden) loadDet(selId); }, 4000);
    return () => clearInterval(t);
  }, [auth, selId, loadDet]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setWhatIfArrow(null); setWhatIfDrawing(false); }, [selDot]);

  if (!auth) return <main className="wrap"><p className="note">Loading…</p></main>;
  if (!auth.admin) return <main className="wrap"><header className="top"><h1>Story Map</h1><span className="chip">Admin</span></header><Login configured={auth.configured} onDone={() => setAuth({ admin: true, configured: true })} /></main>;

  const s = det && det.session;
  const stories = (det && det.stories) || [];
  const isPrompt = s && s.kind === 'open' && s.slug;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = s ? (isPrompt ? `${origin}/p/${s.slug}` : s.is_default ? `${origin}/` : `${origin}/s/${s.id}`) : '';
  const endsAt = s && s.ends_at ? new Date(s.ends_at).getTime() : null;
  const isOpen = s && s.status === 'open' && (!endsAt || now < endsAt);
  const placed = stories.filter((x) => x.x != null).length;
  const axesOK = ['x', 'y'].every((k) => axes[k].name && axes[k].low && axes[k].high);
  const sameAxis = (a, b) => !!a && !!b && a.name === b.name && a.low === b.low && a.high === b.high;
  const axesDirty = !!s && axesOK && !(s.axes && sameAxis(s.axes.x, axes.x) && sameAxis(s.axes.y, axes.y));
  const points = stories
    .filter((x) => includeTest || !x.is_test)
    .map((x) => ({
      id: x.id, label: (x.name || '').trim() || 'Anonymous', signal: x.signal,
      x: x.x, y: x.y,
      arrow: x.ax != null && x.ay != null ? { x: x.ax, y: x.ay } : null,
      stays: !!x.stays,
    }));
  const { tags, color } = signalColors(points);
  const dot = stories.find((x) => x.id === selDot);

  async function act(fn, label) {
    setBusy(true); say(label + '…');
    try { await fn(); await loadDet(selId); await loadList(); }
    catch (e) { say(e.message, true); setBusy(false); return; }
    setBusy(false);
  }
  const patch = (body, done) => act(async () => { await api(`/api/admin/sessions/${s.id}`, 'PATCH', body); say(done); }, 'Saving');

  return (
    <main className="wrap">
      <header className="top">
        <h1>Story Map</h1><span className="chip">Admin</span>
        <span style={{ flex: 1 }} />
        {testMode && <span className="test-badge">TEST MODE</span>}
        <label className="check">
          <input type="checkbox" checked={testMode} onChange={async (e) => {
            await api('/api/admin/test-mode', 'POST', { on: e.target.checked });
            setTestMode(e.target.checked);
          }} /> Test mode
        </label>
        <button className="quiet" onClick={async () => { await api('/api/admin/login', 'DELETE'); setAuth({ admin: false, configured: true }); }}>Sign out</button>
      </header>
      <div className="grid">
        <div className="col">
          <section className="panel">
            <h2>Prompts &amp; Sessions</h2>
            <ul className="list">
              {list.map((x) => {
                const tag = x.kind === 'open' && x.slug
                  ? `prompt${x.hidden ? ' · hidden' : ''} · ${x.n}`
                  : x.is_default ? `default · ${x.n}` : x.published ? `shared · ${x.n}` : `${x.status} · ${x.n}`;
                return (
                  <li key={x.id}>
                    <button className="item" aria-current={x.id === selId} onClick={() => { setSelId(x.id); loadedFor.current = null; }}>
                      {x.title} <span className="tag">· {tag}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <details style={{ marginTop: 8 }}>
              <summary className="note" style={{ cursor: 'pointer' }}>New session</summary>
              <form className="stack" style={{ marginTop: 10 }} onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const j = await api('/api/admin/sessions', 'POST', { ...nw, signals: textToSignals(nw.signals) });
                  setNw({ title: '', prompt: '', signals: '', minutes: 10 });
                  loadedFor.current = null; setSelId(j.id); await loadList();
                  say('Session created. Copy its link below.');
                }
                catch (er) { say(er.message, true); }
              }}>
                <div><label htmlFor="n-t">Title</label><input id="n-t" value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} placeholder="Sensemakers · Nov 3" /></div>
                <div><label htmlFor="n-p">Prompt</label><textarea id="n-p" rows={3} value={nw.prompt} onChange={(e) => setNw({ ...nw, prompt: e.target.value })} /></div>
                <div><label htmlFor="n-s">Signals (one per line, or TYPE: text)</label><textarea id="n-s" rows={3} value={nw.signals} onChange={(e) => setNw({ ...nw, signals: e.target.value })} /></div>
                <div className="two"><div><label htmlFor="n-m">Minutes</label><input id="n-m" type="number" min={1} max={120} value={nw.minutes} onChange={(e) => setNw({ ...nw, minutes: e.target.value })} /></div><div /></div>
                <div><button type="submit">Create session</button></div>
              </form>
            </details>
          </section>

          {s && (
            <section className="panel stack">
              <h2>{isPrompt ? 'Open prompt' : s.is_default ? 'Default link' : 'This session'}</h2>
              <div className="row">
                <input readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
                <button className="ghost" onClick={() => { navigator.clipboard.writeText(link).then(() => say('Link copied.'), () => say('Select the link and copy it.', true)); }}>Copy link</button>
                <a className="textlink" href={`/present/${s.id}`} target="_blank" rel="noreferrer">Open presenter screen ↗</a>
              </div>
              <div className={'status' + (isOpen ? ' ok' : '')}>
                {isOpen ? (endsAt ? `Open · ${mmss(endsAt - now)} left` : 'Open, no timer') : isPrompt ? 'Always open' : 'Closed'} · {stories.length} stories
              </div>

              {/* Session-only: timer controls */}
              {!s.is_default && !isPrompt && (
                <div className="row">
                  <button disabled={busy} onClick={() => patch({ start: true, minutes: form.minutes }, 'Timer started.')}>Start {form.minutes}-min timer</button>
                  <button className="ghost" disabled={busy} onClick={() => patch({ open: true }, 'Open with no timer.')}>Open, no timer</button>
                  <button className="quiet" disabled={busy || !isOpen} onClick={() => patch({ stop: true }, 'Closed.')}>Close</button>
                </div>
              )}

              {/* Prompt-only: create session from this prompt */}
              {isPrompt && (
                <div>
                  <button className="ghost" disabled={busy} onClick={() => act(async () => {
                    const j = await api('/api/admin/sessions', 'POST', { fromPromptId: s.id, minutes: 10 });
                    loadedFor.current = null; setSelId(j.id);
                    say('Session created from this prompt. Copy its link below.');
                  }, 'Creating session')}>Create timed session from this prompt</button>
                </div>
              )}

              <details>
                <summary className="note" style={{ cursor: 'pointer' }}>Edit {isPrompt ? 'prompt' : 'session'} settings</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  <div><label htmlFor="e-t">Title</label><input id="e-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><label htmlFor="e-p">Prompt (shown to writers / used for Claude context)</label><textarea id="e-p" rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></div>
                  {isPrompt && <>
                    <div><label htmlFor="e-bq">Big question (shown on menu card)</label><input id="e-bq" value={form.big_question} onChange={(e) => setForm({ ...form, big_question: e.target.value })} /></div>
                    <div><label htmlFor="e-inst">Writing instructions (shown while writing)</label><textarea id="e-inst" rows={5} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
                    <div><label htmlFor="e-yr">Year</label><input id="e-yr" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
                  </>}
                  <div><label htmlFor="e-s">Signals (one per line, or TYPE: text)</label><textarea id="e-s" rows={6} value={form.signals} onChange={(e) => setForm({ ...form, signals: e.target.value })} /></div>
                  <div className="two">
                    {!isPrompt && <div><label htmlFor="e-m">Minutes</label><input id="e-m" type="number" min={1} max={120} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></div>}
                    {isPrompt && <label className="check"><input type="checkbox" checked={!!form.hidden} onChange={(e) => setForm({ ...form, hidden: e.target.checked })} /> Hide from menu</label>}
                    <div />
                  </div>
                  <div className="row">
                    <button className="ghost" disabled={busy} onClick={() => {
                      const body = {
                        title: form.title, prompt: form.prompt,
                        signals: textToSignals(form.signals),
                        minutes: form.minutes,
                      };
                      if (isPrompt) {
                        body.big_question = form.big_question;
                        body.instructions = form.instructions;
                        body.year = form.year;
                        body.hidden = !!form.hidden;
                      }
                      patch(body, 'Saved.');
                    }}>Save settings</button>
                    {!s.is_default && !isPrompt && (
                      <Armed label="Delete session" armedLabel="Tap again to delete" onConfirm={() => act(async () => {
                        await api(`/api/admin/sessions/${s.id}`, 'DELETE');
                        setSelId(null); setDet(null); loadedFor.current = null; say('Deleted.');
                      }, 'Deleting')} />
                    )}
                  </div>
                </div>
              </details>
            </section>
          )}

          {s && (
            <section className="panel">
              <h2>Stories ({stories.length})</h2>
              {stories.length === 0 ? <p className="note">Stories appear here as people submit.</p> : stories.map((x) => {
                const xArrow = x.ax != null && x.ay != null ? { x: x.ax, y: x.ay } : null;
                const xQs = s.axes && x.x != null ? questions(s.axes, { x: x.x, y: x.y, stays: !!x.stays, arrow: xArrow }) : [];
                return (
                  <details key={x.id} className="story" open={!!open[x.id]} onToggle={(e) => setOpen({ ...open, [x.id]: e.currentTarget.open })}>
                    <summary>
                      <i className="sw" style={{ background: color(x.signal) }} />
                      <strong>{(x.name || '').trim() || 'Anonymous'}</strong>
                      <span className="tag">{x.signal || 'no signal'}{x.source === 'seed-recap' ? ' · recap' : ''}{x.x == null ? ' · not placed' : ''}{x.is_test ? ' · ' : ''}{x.is_test && <span className="test-tag">TEST</span>}</span>
                      {x.headline && <span className="tag" style={{ fontStyle: 'italic' }}> · "{x.headline}"</span>}
                      {s.axes && x.x != null && <span className="tag"> · {directionLine(s.axes, x)}</span>}
                    </summary>
                    <div className="stack" style={{ padding: '6px 0 8px' }}>
                      <p className="storytext">{x.body}</p>
                      {xQs.length > 0 && (
                        <div>
                          <span className="kicker" style={{ display: 'block', marginBottom: 6 }}>Questions they saw</span>
                          <ol className="qs-list">
                            {xQs.map((q, i) => <li key={i}>{q}</li>)}
                          </ol>
                        </div>
                      )}
                      <div><Armed label="Delete story" armedLabel="Tap again to delete" onConfirm={() => act(async () => { await api(`/api/admin/stories/${x.id}`, 'DELETE'); say('Story deleted.'); }, 'Deleting')} /></div>
                    </div>
                  </details>
                );
              })}
            </section>
          )}

          {s && (
            <section className="panel stack">
              <h2>Axes</h2>
              <button disabled={busy || stories.length < 2} onClick={() => act(async () => {
                const j = await api(`/api/admin/sessions/${s.id}/axes`, 'POST');
                setCands(j.cands);
                const [i, k] = j.pair;
                setAxes({ x: { ...j.cands[i] }, y: { ...j.cands[k] } });
                say('Axes proposed. Adjust if you like, then save.');
              }, 'Reading the stories for axes')}>Find axes from these stories</button>
              {['x', 'y'].map((k) => (
                <div key={k}>
                  <label htmlFor={'sel-' + k}>{k === 'x' ? 'Horizontal axis' : 'Vertical axis'}</label>
                  <select id={'sel-' + k} value={cands.findIndex((c) => c.name === axes[k].name && c.low === axes[k].low && c.high === axes[k].high)}
                    onChange={(e) => { const c = cands[+e.target.value]; if (c) setAxes({ ...axes, [k]: { ...c } }); }}>
                    <option value={-1}>Custom</option>
                    {cands.map((c, i) => <option key={i} value={i}>{c.name}: {c.low} / {c.high}</option>)}
                  </select>
                  <div className="stack" style={{ marginTop: 6, gap: 8 }}>
                    <input aria-label="Axis name" placeholder="Axis name" value={axes[k].name} onChange={(e) => setAxes({ ...axes, [k]: { ...axes[k], name: e.target.value, why: '' } })} />
                    <div className="two">
                      <input aria-label="Low pole" placeholder={k === 'x' ? 'Left pole' : 'Bottom pole'} value={axes[k].low} onChange={(e) => setAxes({ ...axes, [k]: { ...axes[k], low: e.target.value, why: '' } })} />
                      <input aria-label="High pole" placeholder={k === 'x' ? 'Right pole' : 'Top pole'} value={axes[k].high} onChange={(e) => setAxes({ ...axes, [k]: { ...axes[k], high: e.target.value, why: '' } })} />
                    </div>
                    <div className="two">
                      <input aria-label="Low description" placeholder="Low pole description (optional)" value={axes[k].lowDesc || ''} onChange={(e) => setAxes({ ...axes, [k]: { ...axes[k], lowDesc: e.target.value } })} style={{ fontSize: 13 }} />
                      <input aria-label="High description" placeholder="High pole description (optional)" value={axes[k].highDesc || ''} onChange={(e) => setAxes({ ...axes, [k]: { ...axes[k], highDesc: e.target.value } })} style={{ fontSize: 13 }} />
                    </div>
                  </div>
                  {axes[k].why && <p className="why">{axes[k].why}</p>}
                </div>
              ))}
              <div className="row">
                <button className="ghost" disabled={busy || !axesOK || !axesDirty} onClick={() => patch({ axes }, 'Axes saved. Place the stories again to use them.')}>Save axes</button>
                <button disabled={busy || !s.axes || axesDirty || stories.length === 0} onClick={() => act(async () => {
                  const j = await api(`/api/admin/sessions/${s.id}/place`, 'POST');
                  say(`Placed ${j.placed} of ${j.total}. Drag any dot you disagree with.`);
                }, 'Placing stories')}>Place all stories</button>
              </div>
              {isPrompt && <p className="note">New stories on open prompts are placed immediately as they come in.</p>}
              {s.is_default && !isPrompt && <p className="note">New stories on the default link are placed one at a time on these axes as they come in.</p>}
            </section>
          )}
          {stories.some((x) => x.is_test) && (
            <section className="panel stack">
              <h2>Test stories</h2>
              <p className="note">{stories.filter((x) => x.is_test).length} test {stories.filter((x) => x.is_test).length === 1 ? 'story' : 'stories'} in this session. Test stories are excluded from public maps and counts.</p>
              <Armed label="Delete all test stories" armedLabel="Tap again to confirm" onConfirm={() => act(async () => {
                const j = await api('/api/admin/test-stories', 'DELETE');
                say(`Deleted ${j.deleted} test ${j.deleted === 1 ? 'story' : 'stories'}.`);
              }, 'Deleting')} />
            </section>
          )}
          <div className={'status' + (status.warn ? ' warn' : '')} role="status">{status.t}</div>
        </div>

        <div className="col">
          {s && (
            <section className="panel">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ marginBottom: 0 }}>Map · {placed} of {stories.length} placed {isPrompt ? '· always visible' : s.published ? '· visible to writers' : '· only you see this'}</h2>
                {stories.some((x) => x.is_test) && (
                  <label className="check" style={{ fontSize: 12 }}>
                    <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Include test
                  </label>
                )}
              </div>
              <StoryMap axes={s.axes || axes} quads={s.quads} points={points} selId={selDot}
                onSelect={(pid) => { setSelDot(pid === selDot ? null : pid); }}
                onMove={(id, x, y) => {
                  setDet({ ...det, stories: stories.map((t) => (t.id === id ? { ...t, x, y, moved: true } : t)) });
                  setSelDot(id);
                  api(`/api/admin/stories/${id}`, 'PATCH', { x, y }).catch((e) => say(e.message, true));
                }}
                arrowFor={whatIfDrawing ? selDot : null}
                onArrow={whatIfDrawing ? ((_id, xy) => { setWhatIfArrow(xy); setWhatIfDrawing(false); }) : undefined}
                whatIfFor={whatIfArrow && selDot ? selDot : null}
                whatIfTo={whatIfArrow}
                showArrows />
              {tags.length > 0 && <div className="legend">{tags.map((t) => <span key={t}><i className="sw" style={{ background: color(t) }} />{t}</span>)}</div>}
            </section>
          )}
          {s && s.readout && <section className="panel"><h2>What the map shows</h2><p className="readout">{s.readout}</p></section>}
          {dot && dot.x != null && s.axes && (() => {
            const dotForQ = { x: dot.x, y: dot.y, stays: !!dot.stays, arrow: dot.ax != null ? { x: dot.ax, y: dot.ay } : null };
            const realQs = questions(s.axes, dotForQ);
            const wiQs = whatIfArrow ? questions(s.axes, { ...dotForQ, arrow: whatIfArrow }) : [];
            return (
              <section className="panel stack">
                <h2>
                  {(dot.name || '').trim() || 'This story'}
                  {dot.stays ? ' · would stay' : dot.ax != null ? ` · ${directionLine(s.axes, dot)}` : ' · no arrow yet'}
                </h2>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => { setWhatIfArrow(null); setWhatIfDrawing(true); }}>
                    {whatIfDrawing ? 'Tap the map…' : 'What if…'}
                  </button>
                  {whatIfArrow && !whatIfDrawing && <button type="button" className="quiet" onClick={() => setWhatIfDrawing(true)}>Redraw</button>}
                  {whatIfArrow && <button type="button" className="quiet" onClick={() => setWhatIfArrow(null)}>Clear what if</button>}
                  {whatIfDrawing && <button type="button" className="quiet" onClick={() => setWhatIfDrawing(false)}>Cancel</button>}
                </div>
                {(realQs.length > 0 || wiQs.length > 0) && (
                  <div className={wiQs.length ? 'qs-cols' : ''}>
                    {realQs.length > 0 && (
                      <div>
                        {wiQs.length > 0 && <div className="kicker" style={{ marginBottom: 6 }}>Their direction</div>}
                        <ol className="qs-list">
                          {realQs.map((q, i) => <li key={i}>{q}</li>)}
                        </ol>
                      </div>
                    )}
                    {wiQs.length > 0 && (
                      <div>
                        <div className="kicker" style={{ marginBottom: 6 }}>What if</div>
                        <ol className="qs-list">
                          {wiQs.map((q, i) => <li key={i}>{q}</li>)}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })()}
          {dot && dot.x != null && (
            <section className="panel stack">
              <h2>Why {(dot.name || '').trim() || 'this story'} sits here</h2>
              {dot.headline && <p className="story-headline">"{dot.headline}"</p>}
              {['x', 'y'].map((k) => (
                <div key={k}>
                  <div><strong>{(s.axes || axes)[k].name}</strong> <span className="mono">{fmt(dot[k])}</span></div>
                  {dot[k + 'w'] && <p className="why">{dot[k + 'w']}</p>}
                  {dot[k + 'q'] && <div className="ev"><q>{dot[k + 'q']}</q>{!dot.body.includes(dot[k + 'q']) && <div className="note warn">Not found word for word in the story.</div>}</div>}
                </div>
              ))}
              {dot.moved && <p className="note">You moved this dot. Claude placed it at {fmt(dot.ox ?? dot.x)}, {fmt(dot.oy ?? dot.y)}.</p>}
            </section>
          )}
          {s && !s.is_default && !isPrompt && (
            <section className="panel stack">
              <h2>Share the map</h2>
              <div><label htmlFor="lm">Dot labels</label>
                <select id="lm" value={s.label_mode} onChange={(e) => patch({ label_mode: e.target.value }, 'Saved.')}>
                  <option value="anon">Anonymous (Story 1, 2, 3)</option>
                  <option value="names">Names people typed</option>
                </select>
              </div>
              <p className="note">Sharing shows this map to everyone with the session link, and lists it under Past sessions on the default link.</p>
              <div className="row">
                {!s.published
                  ? <button disabled={busy || placed === 0} onClick={() => patch({ published: true }, 'Shared.')}>Share map</button>
                  : <button className="quiet" disabled={busy} onClick={() => patch({ published: false }, 'Hidden again.')}>Hide map</button>}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
