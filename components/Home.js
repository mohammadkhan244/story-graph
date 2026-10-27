'use client';
import { useEffect, useMemo, useState } from 'react';
import { SETS, artSvg, decision } from '@/lib/cards';
import BrandBar from './BrandBar';

/* Four cards at a time. Click a card, the exercise starts. */
export default function Home() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [set, setSet] = useState(0);
  const [deal, setDeal] = useState(0);
  const [chosen, setChosen] = useState(null);

  useEffect(() => {
    fetch('/api/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j); })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  const sets = useMemo(() => {
    if (!data) return [];
    const bySlug = Object.fromEntries(data.prompts.map((p) => [p.slug, p]));
    const used = new Set();
    const out = SETS.map((s) => ({ ...s, cards: s.slugs.filter((x) => bySlug[x]).map((x) => { used.add(x); return bySlug[x]; }) }))
      .filter((s) => s.cards.length);
    const extra = data.prompts.filter((p) => !used.has(p.slug));
    for (let i = 0; i < extra.length; i += 4) out.push({ label: 'More', cards: extra.slice(i, i + 4) });
    return out;
  }, [data]);

  function pick(p) {
    setChosen(p.slug);
    setTimeout(() => { window.location.href = `/p/${p.slug}`; }, 380);
  }
  function next() { setSet((set + 1) % sets.length); setDeal(deal + 1); }

  const cur = sets[set];
  return (
    <main>
      <BrandBar />
      <section className="home-head">
        <h1>Find out what story is controlling your decisions.</h1>
        <ol className="howto" aria-label="How it works">
          <li><span className="howto-n">1</span><strong>Pick a decision</strong><span>One you’re facing, or one your team keeps circling.</span></li>
          <li><span className="howto-n">2</span><strong>Write for 10 minutes</strong><span>A day in that future. No planning, no polish.</span></li>
          <li><span className="howto-n">3</span><strong>See where you land</strong><span>Your story on a map next to everyone else’s, then draw where you’d rather be.</span></li>
        </ol>
      </section>
      <h2 className="pick-head">What decision are you facing?</h2>
      {err && <p className="warn center">{err}</p>}
      {!data && !err && <p className="note center">Shuffling the deck…</p>}
      {cur && (
        <>
          <div className={'deck' + (chosen ? ' leaving' : '')} key={deal} role="list" aria-label={cur.label}>
            {cur.cards.map((p, i) => (
              <div role="listitem" key={p.slug}>
                <button type="button" className={'pcard' + (chosen === p.slug ? ' chosen' : '')} style={{ '--i': i }}
                  onClick={() => pick(p)} disabled={!!chosen}>
                  <span className="pcard-art" dangerouslySetInnerHTML={{ __html: artSvg(p.slug) }} />
                  <span className="pcard-q">{decision(p.slug, p.title).q}</span>
                  <span className="pcard-why">{decision(p.slug, p.title).why}</span>
                  <span className="pcard-meta">{p.n === 0 ? 'Be the first' : `${p.n} ${p.n === 1 ? 'story' : 'stories'} so far`}</span>
                </button>
              </div>
            ))}
          </div>
          {sets.length > 1 && (
            <>
              <div className="deck-actions">
                <button type="button" className="textlink" onClick={next}>Show me other decisions ↻</button>
              </div>
              <div className="set-dots" aria-hidden="true">{sets.map((_, i) => <span key={i} className={i === set ? 'on' : ''} />)}</div>
            </>
          )}
        </>
      )}
      {data && data.past.length > 0 && (
        <footer className="foot">
          <span>Maps from live sessions:</span>
          <span className="row">{data.past.map((s) => <a key={s.id} href={`/s/${s.id}`}>{s.title}</a>)}</span>
        </footer>
      )}
    </main>
  );
}
