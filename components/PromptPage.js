'use client';
import { useEffect, useRef, useState } from 'react';
import MapView from './MapView';

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* Detect whether signals are typed objects {type,text} or legacy strings */
function isObjectSignals(signals) {
  return Array.isArray(signals) && signals.length > 0 && typeof signals[0] === 'object';
}

function SignalPicker({ signals, onPick }) {
  return (
    <div className="signal-picker narrow">
      <p className="note signal-picker-note">These are made-up signals. Signals are signs that something is changing. Pick the one that grabs you.</p>
      <div className="signal-grid">
        {signals.map((s) => (
          <button key={s.type} className="signal-card" onClick={() => onPick(s)}>
            <span className="signal-type-label">{s.type}</span>
            <p className="signal-text">{s.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const CAREER_EXAMPLE = 'I wake up at 6 and the first thing I check is…';
const BIZ_EXAMPLE = 'I wake up at 6 and the first thing I check is…';

export default function PromptPage({ slug }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(null); // 'pick-signal' | 'write'
  const [pickedSignal, setPickedSignal] = useState(null);
  const [mine, setMine] = useState(null);
  const [map, setMap] = useState(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [hp, setHp] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [warning, setWarning] = useState('');
  const latest = useRef({});

  useEffect(() => {
    fetch(`/api/p/${slug}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j);
        setMap(j.map);
        const hasObjSignals = isObjectSignals(j.session.signals);
        const initialStep = hasObjSignals ? 'pick-signal' : 'write';

        /* Restore draft */
        const dk = 'sm-draft-' + j.session.id;
        const d = ls.get(dk);
        if (d) {
          setName(d.name || '');
          setNotice(d.notice || '');
          setHeadline(d.headline || '');
          setText(d.text || '');
          if (d.pickedSignal) { setPickedSignal(d.pickedSignal); setStep('write'); }
          else setStep(initialStep);
        } else {
          setStep(initialStep);
        }

        /* Restore submitted story */
        const prev = ls.get('sm-mine-' + j.session.id);
        if (prev) setMine(prev);
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [slug]);

  const session = data && data.session;
  const dk = session ? 'sm-draft-' + session.id : null;

  useEffect(() => {
    latest.current = { name, notice, headline, text, hp, pickedSignal };
    if (!dk) return;
    const t = setTimeout(() => ls.set(dk, { name, notice, headline, text, pickedSignal }), 600);
    return () => clearTimeout(t);
  }, [name, notice, headline, text, hp, pickedSignal, dk]);

  async function submit() {
    const cur = latest.current;
    if (cur.text.trim().length < 20) { setMsg('Write a little more before submitting.'); return; }
    setBusy(true); setMsg('Placing your story on the map…');
    const signalVal = cur.pickedSignal ? cur.pickedSignal.type : (cur.notice || '');
    try {
      const r = await fetch(`/api/p/${slug}/stories`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: cur.name, signal: signalVal, headline: cur.headline, text: cur.text, website: cur.hp }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not submit.');
      ls.set('sm-mine-' + session.id, j.story);
      ls.del(dk);
      setMine(j.story);
      if (j.map) setMap(j.map);
      if (j.warning) setWarning(j.warning);
    } catch (e) {
      setMsg(String(e.message || e)); setBusy(false); setArmed(false);
    }
  }

  if (err) return <main className="wrap narrow"><p className="warn">{err}</p></main>;
  if (!data || !step) return <main className="wrap narrow"><p className="note">Loading…</p></main>;

  const hasObjSignals = isObjectSignals(session.signals);
  const isGeneral = !hasObjSignals;
  const exampleOpener = session.slug === 'your-career' ? CAREER_EXAMPLE : session.slug === 'your-business' ? BIZ_EXAMPLE : null;

  return (
    <main className="wrap">
      <header className="top">
        <a href="/" className="note">← Story Map</a>
      </header>

      {mine ? (
        /* Post-submit: show story + map */
        <div className="grid">
          <div className="col">
            <section className="panel stack">
              <h2>Your story</h2>
              {mine.headline && <p className="story-headline">"{mine.headline}"</p>}
              <p className="storytext">{mine.body}</p>
              {warning && <p className="note warn">{warning}</p>}
              <div className="row">
                <button className="ghost" onClick={() => {
                  ls.del('sm-mine-' + session.id);
                  setMine(null); setWarning(''); setText(''); setName('');
                  setNotice(''); setHeadline(''); setPickedSignal(null);
                  setStep(hasObjSignals ? 'pick-signal' : 'write');
                }}>Write another</button>
              </div>
            </section>
          </div>
          <div className="col"><MapView map={map} youId={mine.id} /></div>
        </div>
      ) : step === 'pick-signal' ? (
        /* Signal picker step */
        <div>
          <div className="narrow" style={{ marginBottom: 20 }}>
            <span className="prompt-card-year">{session.year}</span>
            <h2 style={{ margin: '4px 0 8px', fontSize: 24, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>{session.title}</h2>
            <p className="prompt" style={{ marginBottom: 0 }}>{session.bigQuestion}</p>
          </div>
          <SignalPicker signals={session.signals} onPick={(s) => { setPickedSignal(s); setStep('write'); }} />
        </div>
      ) : (
        /* Writing step */
        <div className="narrow stack">
          <div>
            <span className="prompt-card-year">{session.year}</span>
            <p className="prompt" style={{ margin: '4px 0 0' }}>{session.bigQuestion}</p>
          </div>

          {pickedSignal && (
            <blockquote className="signal-pin">
              <span className="signal-type-label">{pickedSignal.type}</span>
              {pickedSignal.text}
            </blockquote>
          )}

          {session.instructions ? (
            <div className="instructions">{session.instructions}</div>
          ) : null}

          <section className="panel stack">
            <div className="two">
              <div>
                <label htmlFor="pw-name">Name (shown on the map)</label>
                <input id="pw-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to stay anonymous" />
              </div>
              {isGeneral ? (
                <div>
                  <label htmlFor="pw-notice">What's one thing you're noticing now that points this way? (optional)</label>
                  <input id="pw-notice" maxLength={200} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Something you're seeing or feeling" />
                </div>
              ) : <div />}
            </div>
            <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label></div>
            <div>
              {exampleOpener && <p className="note" style={{ marginBottom: 6, fontStyle: 'italic' }}>{exampleOpener}</p>}
              <textarea className="page" aria-label="Your story" value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={exampleOpener || "Start writing…"}
                disabled={busy} />
            </div>
            <div>
              <label htmlFor="pw-headline">Scenario headline — name your future in 3–5 words (optional)</label>
              <input id="pw-headline" maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Trust is back, finally" />
            </div>
            <div className="row">
              <button type="button" className={armed ? 'armed' : ''} disabled={busy}
                onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; } submit(); }}>
                {armed ? 'Tap again to submit' : 'Submit story'}
              </button>
              {pickedSignal && (
                <button type="button" className="quiet" onClick={() => { setPickedSignal(null); setStep('pick-signal'); }}>← Change signal</button>
              )}
              <span className="status" role="status">{msg || (text ? 'Draft saved on this device.' : '')}</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
