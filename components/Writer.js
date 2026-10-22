'use client';
import { useEffect, useRef, useState } from 'react';

const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export const mineKey = (id) => 'sm-mine-' + id;
export const loadMine = (id) => ls.get(mineKey(id));
export const clearMine = (id) => ls.del(mineKey(id));

/* The writing page. Shared timer when the host started one (endsAt), otherwise a
   personal timer that starts on the first keystroke and only nudges. */
export default function Writer({ session, onSubmitted }) {
  const dk = 'sm-draft-' + session.id;
  const [name, setName] = useState('');
  const [signal, setSignal] = useState('');
  const [text, setText] = useState('');
  const [hp, setHp] = useState('');
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const auto = useRef(false);
  const latest = useRef({});

  useEffect(() => {
    const d = ls.get(dk);
    if (d) { setName(d.name || ''); setSignal(d.signal || ''); setText(d.text || ''); setStartedAt(d.startedAt || null); }
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [dk]);

  useEffect(() => {
    latest.current = { name, signal, text, hp };
    const t = setTimeout(() => ls.set(dk, { name, signal, text, startedAt }), 600);
    return () => clearTimeout(t);
  }, [name, signal, text, hp, startedAt, dk]);

  const shared = session.endsAt ? new Date(session.endsAt).getTime() : null;
  const personal = startedAt ? startedAt + session.minutes * 60000 : null;
  const end = shared || personal;
  const left = end ? end - now : session.minutes * 60000;
  const over = end ? left <= 0 : false;

  async function submit() {
    const cur = latest.current;
    if (cur.text.trim().length < 20) { setMsg('Write a little more before submitting.'); return; }
    setBusy(true); setMsg(session.isDefault ? 'Placing your story on the map…' : 'Submitting…');
    try {
      const r = await fetch(`/api/sessions/${session.id}/stories`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: cur.name, signal: cur.signal, text: cur.text, website: cur.hp }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not submit.');
      ls.set(mineKey(session.id), j.story);
      ls.del(dk);
      onSubmitted && onSubmitted(j);
    } catch (e) {
      setMsg(String(e.message || e)); setBusy(false); setArmed(false);
    }
  }

  useEffect(() => {
    if (shared && over && !auto.current && !busy) {
      auto.current = true;
      if (latest.current.text.trim().length >= 20) submit();
      else setMsg('Time is up.');
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function onType(v) { setText(v); if (!startedAt && !shared && v.trim()) setStartedAt(Date.now()); }

  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Write</h2>
        <span className={'timer' + (end && left < 60000 ? ' low' : '')} aria-live="off">{over ? '00:00' : mmss(left)}</span>
      </div>
      <p className="prompt">{session.prompt}</p>
      <p className="note">
        {shared ? 'Everyone has the same clock. Whatever you have is submitted when it hits zero.'
          : startedAt ? (over ? 'Time is up. Finish your sentence and submit.' : 'Keep going. Don\'t edit, just write.')
          : `${session.minutes} minutes. The clock starts when you type.`}
      </p>
      <div className="two">
        <div><label htmlFor="w-name">Name (shown on the map)</label><input id="w-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to stay anonymous" /></div>
        {session.signals && session.signals.length > 0 ? (
          <div><label htmlFor="w-sig">Signal</label>
            <select id="w-sig" value={signal} onChange={(e) => setSignal(e.target.value)}>
              <option value="">Which one did you pick?</option>
              {session.signals.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : <div />}
      </div>
      <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label></div>
      <textarea className="page" aria-label="Your story" value={text} onChange={(e) => onType(e.target.value)} placeholder="It's a Tuesday in 2038. I wake up and…" disabled={busy} />
      <div className="row">
        <button type="button" className={armed ? 'armed' : ''} disabled={busy}
          onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; } submit(); }}>
          {armed ? 'Tap again to submit' : 'Submit story'}
        </button>
        <span className="status" role="status">{msg || (text ? 'Draft saved on this device.' : '')}</span>
      </div>
    </section>
  );
}
