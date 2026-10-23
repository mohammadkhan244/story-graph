'use client';
import { useEffect, useState } from 'react';

export default function PromptMenu() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('prompts');

  useEffect(() => {
    fetch('/api/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j); })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  if (err) return <main className="wrap narrow"><p className="warn">{err}</p></main>;
  if (!data) return <main className="wrap narrow"><p className="note">Loading…</p></main>;

  const { prompts, past } = data;

  return (
    <main className="wrap">
      <header className="top">
        <h1>Story Map</h1>
        <p className="sub">Write a short story about the future, then see where it lands among everyone else's.</p>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'prompts'} onClick={() => setTab('prompts')}>Prompts</button>
        <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past sessions ({past.length})</button>
      </div>

      {tab === 'prompts' && (
        <div className="prompt-list">
          {prompts.length === 0
            ? <p className="note">No prompts available yet.</p>
            : prompts.map((p) => (
              <a key={p.id} href={`/p/${p.slug}`} className="prompt-card">
                <span className="prompt-card-year">{p.year}</span>
                <h3 className="prompt-card-title">{p.title}</h3>
                <p className="prompt-card-bq">{p.big_question}</p>
                <span className="prompt-card-meta">{p.n === 0 ? 'No stories yet' : `${p.n} ${p.n === 1 ? 'story' : 'stories'}`}</span>
              </a>
            ))}
        </div>
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
