'use client';
import { useEffect, useState } from 'react';
import Writer, { loadMine, clearMine } from './Writer';
import MapView from './MapView';

export default function Home() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState(null);
  const [warning, setWarning] = useState('');
  const [tab, setTab] = useState('write');

  async function load() {
    try {
      const r = await fetch('/api/public', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load.');
      setData(j);
      setMine(loadMine(j.session.id));
    } catch (e) { setErr(String(e.message || e)); }
  }
  useEffect(() => { load(); }, []);

  if (err) return <main className="wrap narrow"><p className="warn">{err}</p></main>;
  if (!data) return <main className="wrap narrow"><p className="note">Loading…</p></main>;
  const { session, map, past } = data;
  const placed = mine && map.points.some((p) => p.id === mine.id);

  return (
    <main className="wrap">
      <header className="top">
        <h1>Story Map</h1>
        <p className="sub">Write a short story about the future, then see where it lands among everyone else's.</p>
      </header>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>Your story</button>
        <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past sessions ({past.length})</button>
      </div>

      {tab === 'write' && (
        !mine ? (
          <div className="narrow stack">
            <Writer session={session} onSubmitted={(j) => { setMine(j.story); setWarning(j.warning || ''); if (j.map) setData({ ...data, map: j.map }); }} />
            <p className="note">{map.points.length} {map.points.length === 1 ? 'person has' : 'people have'} written so far. You'll see the map after you submit, so it can't steer your story.</p>
          </div>
        ) : (
          <div className="grid">
            <div className="col">
              <section className="panel stack">
                <h2>Your story</h2>
                <p className="prompt" style={{ fontSize: 15 }}>{session.prompt}</p>
                <p className="storytext">{mine.body}</p>
                {warning && <p className="note warn">{warning}</p>}
                {!placed && !warning && <p className="note">Your story isn't on the map yet.</p>}
                <div className="row"><button className="ghost" onClick={() => { clearMine(session.id); setMine(null); setWarning(''); load(); }}>Write another</button></div>
              </section>
            </div>
            <div className="col"><MapView map={map} youId={mine.id} /></div>
          </div>
        )
      )}

      {tab === 'past' && (
        <section className="panel narrow">
          <h2>Sessions</h2>
          {past.length === 0 ? <p className="note">No shared sessions yet.</p> : (
            <ul className="list">
              {past.map((s) => (
                <li key={s.id}>
                  <a href={`/s/${s.id}`}>
                    <strong>{s.title}</strong> <span className="tag">· {s.n} stories</span>
                    <div className="note">{s.prompt}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
