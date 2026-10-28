'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import StoryMap from './StoryMap';
import BrandBar from './BrandBar';
import { questions } from '@/lib/questions';

/* The screen you share in the room. Dots arrive live; you reveal them, then let the map drive the talk. */
const DISCUSS = [
  'Where did you land? Does it surprise you?',
  'Why is the group gathered here?',
  "Who is the outlier, and what do they see that the rest of us don't?",
  "What's in the empty corner? Why did nobody write it?",
  'Look at your arrow. What needs to happen first?',
  'What have you seen in your own life that put your dot there?',
];
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
  return j;
}

export default function Presenter({ id }) {
  const [auth, setAuth] = useState(null);
  const [d, setD] = useState(null);
  const [qr, setQr] = useState('');
  const [shown, setShown] = useState(false);
  const [names, setNames] = useState(true);
  const [arrows, setArrows] = useState(true);
  const [earlier, setEarlier] = useState(true);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [drawFor, setDrawFor] = useState(null);
  const [whatIfArrow, setWhatIfArrow] = useState(null);
  const [whatIfDrawing, setWhatIfDrawing] = useState(false);
  const [wiQsData, setWiQsData] = useState(null);
  const [wiQsLoading, setWiQsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mins, setMins] = useState(10);
  const [msg, setMsg] = useState('');

  const link = typeof window !== 'undefined' ? `${window.location.origin}/s/${id}` : '';

  async function load() {
    try { setD(await api(`/api/admin/sessions/${id}/present`)); }
    catch (e) { if (e.status === 401) setAuth({ admin: false }); else setMsg(e.message); }
  }
  useEffect(() => {
    api('/api/admin/login').then(setAuth).catch(() => setAuth({ admin: false }));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!auth || !auth.admin) return;
    load();
    const t = setInterval(() => { if (!document.hidden && !drawFor) load(); }, 3000);
    return () => clearInterval(t);
  }, [auth, drawFor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (link) QRCode.toDataURL(link, { margin: 1, width: 300, color: { dark: '#0c1012', light: '#fffdf6' } }).then(setQr).catch(() => {});
  }, [link]);
  useEffect(() => { setWhatIfArrow(null); setWhatIfDrawing(false); setDrawFor(null); setWiQsData(null); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!whatIfArrow || !sel) { setWiQsData(null); return; }
    setWiQsLoading(true); setWiQsData(null);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    fetch(`/api/stories/${sel}/questions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arrow: whatIfArrow }), signal: ctrl.signal,
    }).then((r) => r.json()).then((j) => { if (Array.isArray(j.questions)) setWiQsData(j.questions); })
      .catch(() => {}).finally(() => { clearTimeout(to); setWiQsLoading(false); });
    return () => { ctrl.abort(); clearTimeout(to); };
  }, [whatIfArrow, sel]);

  if (!auth) return <main className="wrap"><BrandBar /><p className="note">Loading…</p></main>;
  if (!auth.admin) return <main className="wrap narrow"><BrandBar /><p className="sub">Sign in at <a href="/?admin">/?admin</a>, then come back to this page.</p></main>;
  if (!d) return <main className="wrap"><BrandBar /><p className="note">Loading the room… {msg}</p></main>;

  const s = d.session, map = d.map;
  const isSession = s.kind !== 'open';
  const endsAt = s.endsAt ? new Date(s.endsAt).getTime() : null;
  const open = s.status === 'open' && (!endsAt || now < endsAt);
  const placed = map.points.length;
  const pts = names ? map.points : map.points.map((p, i) => ({ ...p, label: `Story ${i + 1}` }));

  async function patch(body) { try { await api(`/api/admin/sessions/${id}`, 'PATCH', body); await load(); } catch (e) { setMsg(e.message); } }
  async function drawArrow(pid, xy) {
    setDrawFor(null);
    try { await api(`/api/admin/stories/${pid}`, 'PATCH', { arrow: xy }); await load(); } catch (e) { setMsg(e.message); }
  }
  const selP = map.points.find((p) => p.id === sel);

  return (
    <main>
      <BrandBar right={<a className="textlink" href="/?admin">Admin</a>} />
      <div className="present">
        <section>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3>{s.title}</h3>
            <div className="toggles">
              <button type="button" className="quiet" aria-pressed={names} onClick={() => setNames(!names)}>Names</button>
              <button type="button" className="quiet" aria-pressed={arrows} onClick={() => setArrows(!arrows)}>Arrows</button>
              {map.background && map.background.length > 0 && <button type="button" className="quiet" aria-pressed={earlier} onClick={() => setEarlier(!earlier)}>Earlier groups</button>}
            </div>
          </div>
          <div className="mapwrap">
            {shown ? (
              <StoryMap big axes={map.axes} quads={map.quads} points={pts} background={earlier ? map.background || [] : []}
                selId={sel} onSelect={(pid) => setSel(pid === sel ? null : pid)} reveal showArrows={arrows}
                arrowFor={drawFor || (whatIfDrawing ? sel : null)}
                onArrow={drawFor ? drawArrow : whatIfDrawing ? ((_id, xy) => { setWhatIfArrow(xy); setWhatIfDrawing(false); }) : undefined}
                whatIfFor={whatIfArrow && sel ? sel : null}
                whatIfTo={whatIfArrow} />
            ) : (
              <div className="center" style={{ padding: '120px 20px', gap: 18 }}>
                <span className="kicker">Stories in</span>
                <span className="bigcount">{placed}</span>
                <button className="big primary" type="button" disabled={!placed} onClick={() => setShown(true)}>Reveal the map</button>
              </div>
            )}
          </div>
          {msg && <p className="warn">{msg}</p>}
        </section>

        <aside className="stack">
          {isSession && (
            <div className="joinbox">
              {qr && <img src={qr} alt="QR code for the session link" />}
              <div className="stack" style={{ gap: 6 }}>
                <span className="kicker">Join on your phone</span>
                <span className="url">{link.replace(/^https?:\/\//, '')}</span>
              </div>
            </div>
          )}
          {isSession && (
            <div className="panel stack">
              <span className="kicker">Writing</span>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="timer">{open ? (endsAt ? mmss(endsAt - now) : 'Open') : 'Closed'}</span>
                <span className="note">{d.total} written · {placed} on the map</span>
              </div>
              <div className="row">
                <input type="number" min={1} max={60} value={mins} onChange={(e) => setMins(e.target.value)} style={{ width: 80 }} aria-label="Minutes" />
                <button type="button" onClick={() => patch({ start: true, minutes: mins })}>Start {mins}-min timer</button>
                <button type="button" className="quiet" disabled={!open} onClick={() => patch({ stop: true })}>Close</button>
              </div>
              <label className="check"><input type="checkbox" checked={!!s.published} onChange={(e) => patch({ published: e.target.checked })} /> Show the map on everyone's phone</label>
            </div>
          )}
          <div className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="kicker">Ask the room · {qi + 1}/{DISCUSS.length}</span>
              <span className="row">
                <button type="button" className="quiet" onClick={() => setQi((qi + DISCUSS.length - 1) % DISCUSS.length)}>←</button>
                <button type="button" className="quiet" onClick={() => setQi((qi + 1) % DISCUSS.length)}>→</button>
              </span>
            </div>
            <p className="discuss">{DISCUSS[qi]}</p>
          </div>
          {selP && (
            <div className="peek">
              <span className="kicker">{names ? selP.label : 'Selected story'}</span>
              {selP.headline && <strong style={{ font: '400 22px var(--title)' }}>{selP.headline}</strong>}
              {selP.xq && <p className="quote">"{selP.xq}"</p>}
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setWhatIfDrawing(false); setDrawFor(drawFor === selP.id ? null : selP.id); }}>
                  {drawFor === selP.id ? 'Tap the map…' : 'Set their arrow (saves)'}
                </button>
                <button type="button" className="quiet" onClick={() => { setDrawFor(null); setWhatIfArrow(null); setWhatIfDrawing(!whatIfDrawing); }}>
                  {whatIfDrawing ? 'Tap the map…' : 'What if…'}
                </button>
                {(drawFor || whatIfDrawing) && <button type="button" className="quiet" onClick={() => { setDrawFor(null); setWhatIfDrawing(false); }}>Cancel</button>}
                {whatIfArrow && !whatIfDrawing && <button type="button" className="quiet" onClick={() => setWhatIfArrow(null)}>Clear what if</button>}
              </div>
            </div>
          )}
          {selP && map.axes && (selP.arrow || selP.stays || whatIfArrow) && (() => {
            const realQs = questions(map.axes, selP);
            const wiQs = wiQsData || [];
            const showWi = whatIfArrow && (wiQsLoading || wiQs.length > 0);
            return (
              <div className="panel stack">
                <div className={showWi ? 'qs-cols qs-large' : 'qs-large'}>
                  {realQs.length > 0 && (
                    <div>
                      {showWi && <div className="kicker" style={{ marginBottom: 8 }}>Their direction</div>}
                      <ol className="qs-list">
                        {realQs.map((q, i) => <li key={i}>{q}</li>)}
                      </ol>
                    </div>
                  )}
                  {showWi && (
                    <div>
                      <div className="kicker" style={{ marginBottom: 8 }}>What if</div>
                      {wiQsLoading ? (
                        <p className="note" style={{ fontStyle: 'italic' }}>Writing your questions…</p>
                      ) : (
                        <ol className="qs-list">
                          {wiQs.map((q, i) => <li key={i}>{q}</li>)}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </aside>
      </div>
    </main>
  );
}
