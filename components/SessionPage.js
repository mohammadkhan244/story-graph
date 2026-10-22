'use client';
import { useEffect, useState } from 'react';
import Writer, { loadMine } from './Writer';
import MapView from './MapView';

/* A session link. Writers write; after submitting they see only their own story
   until the host shares the map. Finished, shared sessions are browsable here. */
export default function SessionPage({ id }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState(null);

  async function load() {
    try {
      const r = await fetch(`/api/sessions/${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load.');
      setData(j); setErr('');
    } catch (e) { setErr(String(e.message || e)); }
  }
  useEffect(() => {
    setMine(loadMine(id));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err && !data) return <main className="wrap narrow"><p className="warn">{err}</p></main>;
  if (!data) return <main className="wrap narrow"><p className="note">Loading…</p></main>;
  const { session, map } = data;
  const endsAt = session.endsAt ? new Date(session.endsAt).getTime() : null;
  const open = session.status === "open" && (!endsAt || Date.now() < endsAt + 30000);

  let body;
  if (mine) {
    body = (
      <div className={map ? 'grid' : 'narrow stack'}>
        <div className="col">
          <section className="panel stack">
            <h2>Your story is in</h2>
            <p className="storytext">{mine.body}</p>
            {!map && <p className="note">The host sees the map first. It appears here when they share it, no need to refresh.</p>}
          </section>
        </div>
        {map && <div className="col"><MapView map={map} youId={mine.id} /></div>}
      </div>
    );
  } else if (open) {
    body = <div className="narrow"><Writer session={session} onSubmitted={(j) => { setMine(j.story); load(); }} /></div>;
  } else if (map) {
    body = <div className="narrow"><MapView map={map} /></div>;
  } else {
    body = (
      <section className="panel narrow">
        <h2>{session.status === 'open' ? 'Time is up' : 'Not open yet'}</h2>
        <p className="prompt">{session.prompt}</p>
        <p className="note">This page opens by itself when the host starts writing.</p>
      </section>
    );
  }

  return (
    <main className="wrap">
      <header className="top">
        <h1>{session.title}</h1>
        <a className="note" href="/">Story Map</a>
      </header>
      {body}
    </main>
  );
}
