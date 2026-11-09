'use client';
import { useEffect, useMemo, useState } from 'react';
import { SETS, SUITS, artSvg, decision } from '@/lib/cards';
import BrandBar from './BrandBar';

/* Four cards at a time. Click a card, the exercise starts. */
export default function Home() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [set, setSet] = useState(0);
  const [deal, setDeal] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customHp, setCustomHp] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customResult, setCustomResult] = useState(null); // { card:true, slug, question } | null
  const [customErr, setCustomErr] = useState('');

  useEffect(() => {
    fetch('/api/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j); })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  const sets = useMemo(() => {
    if (!data) return [];

    // Build custom sets from featured sessions (prepended as first set(s))
    const customCards = (data.featured || []).map((s) => ({
      ...s,
      // Link to parent card's /p/<slug> for live sessions with a parent, else /p/<slug> or /s/<id>
      href: s.parent_slug ? `/p/${s.parent_slug}` : s.slug ? `/p/${s.slug}` : `/s/${s.id}`,
    }));
    const customSets = [];
    for (let i = 0; i < customCards.length; i += 4) {
      customSets.push({ label: 'Custom', cards: customCards.slice(i, i + 4) });
    }

    const bySlug = Object.fromEntries(data.prompts.map((p) => [p.slug, p]));
    const used = new Set();
    const out = SETS.map((s) => ({ ...s, cards: s.slugs.filter((x) => bySlug[x]).map((x) => { used.add(x); return bySlug[x]; }) }))
      .filter((s) => s.cards.length);
    const extra = data.prompts.filter((p) => !used.has(p.slug));
    for (let i = 0; i < extra.length; i += 4) out.push({ label: 'More', cards: extra.slice(i, i + 4) });
    return [...out, ...customSets];
  }, [data]);

  function pick(p) {
    setChosen(p.href || p.slug);
    setTimeout(() => { window.location.href = p.href || `/p/${p.slug}`; }, 380);
  }
  function next() { setSet((set + 1) % sets.length); setDeal(deal + 1); }

  async function handleCustom(e, force = false) {
    if (e) e.preventDefault();
    if (!customText.trim()) return;
    setCustomLoading(true); setCustomErr(''); setCustomResult(null);
    try {
      const r = await fetch('/api/custom', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: customText.trim(), _hp: customHp, force }),
      });
      const j = await r.json();
      if (!r.ok) { setCustomErr(j.error || 'Something went wrong. Try again.'); return; }
      if (j.card) { setCustomResult(j); return; }
      if (j.id) { window.location.href = `/s/${j.id}`; }
    } catch { setCustomErr('Something went wrong. Try again.'); }
    finally { setCustomLoading(false); }
  }

  const cur = sets[set];
  const suit = (cur && SUITS[cur.label]) ?? SUITS['At work'];
  return (
    <main>
      <BrandBar />
      <section className="home-head">
        <h1>Test a big decision<br /><span style={{color:"var(--sage)"}}>before you have to live with it.</span></h1>
        <p className="home-subline">A 10-minute writing exercise that shows what spreadsheets miss.</p>
        <ol className="howto" aria-label="How it works">
          <li><span className="howto-n">1</span><strong>Pick a decision</strong></li>
          <li><span className="howto-n">2</span><strong>Write for 10 minutes</strong></li>
          <li><span className="howto-n">3</span><strong>See where you land</strong></li>
        </ol>
        <p className="howto-example">A founder planning a move abroad wrote a day in his new city. The loneliness he was leaving showed up in the story anyway.</p>
      </section>
      <h2 className="pick-head">What decision are you facing?</h2>
      {err && <p className="warn center">{err}</p>}
      {!data && !err && <p className="note center">Shuffling the deck…</p>}
      {cur && (
        <>
          <div className={'deck' + (chosen ? ' leaving' : '')} key={deal} role="list" aria-label={cur.label}>
            {cur.cards.map((p, i) => (
              <div role="listitem" key={p.slug}>
                <button
                  type="button"
                  title={decision(p.slug, p.big_question || p.title).why}
                  className={'pcard' + (chosen === (p.href || p.slug) ? ' chosen' : '')}
                  style={{ '--i': i, '--face': suit.face, '--art': suit.art, '--text': suit.text, '--edge': suit.edge }}
                  onClick={() => pick(p)}
                  disabled={!!chosen}
                >
                  <span className="pcard-corner pcard-corner-tl" aria-hidden="true">{suit.initial}<span className="pcard-corner-pip" /></span>
                  <span className="pcard-corner pcard-corner-br" aria-hidden="true">{suit.initial}<span className="pcard-corner-pip" /></span>
                  <span className="pcard-art" dangerouslySetInnerHTML={{ __html: artSvg(p.slug, true) }} />
                  <span className="pcard-q">{decision(p.slug, p.big_question || p.title).q}</span>
                  <span className="pcard-why">{decision(p.slug, p.big_question || p.title).why}</span>
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
      {/* "My decision isn't here" — inline custom decision entry */}
      {cur && !customOpen && (
        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <button type="button" className="textlink" onClick={() => { setCustomOpen(true); setCustomResult(null); setCustomErr(''); }}>
            Facing a different decision? Write your own →
          </button>
        </p>
      )}
      {customOpen && (
        <div style={{ maxWidth: 560, margin: '24px auto 0' }}>
          <form className="ask" onSubmit={(e) => handleCustom(e, false)}>
            <label htmlFor="custom-text">Describe your decision in one line</label>
            <input
              id="custom-text" autoFocus value={customText} maxLength={140}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. Should I move to a bigger city?"
            />
            <div className="hp" aria-hidden="true">
              <input tabIndex={-1} autoComplete="off" value={customHp} onChange={(e) => setCustomHp(e.target.value)} />
            </div>
            {customResult && customResult.card ? (
              <div className="stack" style={{ background: 'var(--ink-2)', border: '1px solid var(--frame)', borderRadius: 10, padding: 16, gap: 10 }}>
                <p className="sub">This sounds like: <em style={{ color: 'var(--paper)', fontStyle: 'normal' }}>{customResult.question}</em> Write on that map?</p>
                <div className="row">
                  <button type="button" className="primary" onClick={() => { window.location.href = `/p/${customResult.slug}`; }}>Yes, use it</button>
                  <button type="button" className="quiet" onClick={() => { setCustomLoading(true); setCustomResult(null); handleCustom(null, true); }}>No, mine is different</button>
                </div>
              </div>
            ) : (
              <div className="center">
                <button className="big primary" type="submit" disabled={!customText.trim() || customLoading}>
                  {customLoading ? 'Finding your map…' : 'Continue →'}
                </button>
              </div>
            )}
            {customErr && <p className="warn center">{customErr}</p>}
          </form>
          <p style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="textlink" style={{ fontSize: 13 }} onClick={() => { setCustomOpen(false); setCustomResult(null); setCustomErr(''); }}>← Back to cards</button>
          </p>
        </div>
      )}
      {data && data.past.filter(s => !s.archived && s.n > 0).length > 0 && (
        <footer className="foot">
          <span>See where others landed in past sessions:</span>
          <span className="row">
            {data.past.filter(s => !s.archived && s.n > 0).map((s) => (
              <a key={s.id} href={`/m/${s.id}`}>{s.title}</a>
            ))}
          </span>
        </footer>
      )}
    </main>
  );
}
