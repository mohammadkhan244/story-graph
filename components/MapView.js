'use client';
import { useEffect, useState } from 'react';
import StoryMap from './StoryMap';
import BrandBar from './BrandBar';
import { classifyArrow, questions } from '@/lib/questions';

const ARROW_LABEL = {
  stay: 'Staying here',
  deepen: 'Going deeper',
  pullback: 'Pulling back',
  cross: 'Changing direction',
};

/* Returns a plain-English description of a direction, e.g.:
   "from Passively receives toward Inside the narrator's mind"
   "further toward Actively seeks"
   "pulling back toward Passively receives" */
function describeDirection(axes, dot, arrow, stays) {
  if (stays || !arrow || !axes) return 'staying put';
  const type = classifyArrow({ x: dot.x, y: dot.y }, arrow);
  const dx = arrow.x - dot.x, dy = arrow.y - dot.y;
  const isX = Math.abs(dx) >= Math.abs(dy);
  const a = isX ? axes.x : axes.y;
  const src = (isX ? dot.x : dot.y) < 0 ? a.low : a.high;
  const dst = (isX ? arrow.x : arrow.y) < 0 ? a.low : a.high;
  if (type === 'deepen') return `going further toward "${dst}"`;
  if (type === 'pullback') return `pulling back toward "${dst}"`;
  if (src === dst) return `going further toward "${dst}"`;
  return `from "${src}" toward "${dst}"`;
}

export default function MapView({ id }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [whatIfDrawing, setWhatIfDrawing] = useState(false);
  const [whatIfArrow, setWhatIfArrow] = useState(null);
  const [wiQsData, setWiQsData] = useState(null);
  const [wiQsLoading, setWiQsLoading] = useState(false);
  const [ctaEl, setCtaEl] = useState(null);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    fetch(`/api/m/${id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) setErr(j.error); else setData(j); })
      .catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    setWhatIfArrow(null);
    setWhatIfDrawing(false);
    setWiQsData(null);
  }, [sel]);

  useEffect(() => {
    if (!whatIfArrow || !sel) { setWiQsData(null); return; }
    setWiQsLoading(true);
    setWiQsData(null);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    fetch(`/api/stories/${sel}/questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arrow: whatIfArrow }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.questions)) setWiQsData(j.questions); })
      .catch(() => {})
      .finally(() => { clearTimeout(to); setWiQsLoading(false); });
    return () => { ctrl.abort(); clearTimeout(to); };
  }, [whatIfArrow, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ctaEl) return;
    const obs = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0.1 });
    obs.observe(ctaEl);
    return () => obs.disconnect();
  }, [ctaEl]);

  if (err) return <main className="wrap"><BrandBar /><p className="warn" style={{ padding: '24px 16px' }}>{err}</p></main>;
  if (!data) return <main className="wrap"><BrandBar /><p className="note" style={{ padding: '24px 16px' }}>Loading…</p></main>;

  const { map, title, bigQuestion, prompt, ctaSlug, storyCount } = data;
  const selP = map.points.find((p) => p.id === sel);

  let arrowType = null;
  if (selP && map.axes && (selP.stays || selP.arrow)) {
    arrowType = selP.stays ? 'stay' : classifyArrow({ x: selP.x, y: selP.y }, selP.arrow);
  }
  const realQs = selP && map.axes && (selP.stays || selP.arrow)
    ? questions(map.axes, selP)
    : [];

  const wiQsTemplate = whatIfArrow && selP && map.axes
    ? questions(map.axes, { ...selP, arrow: whatIfArrow, stays: false })
    : [];
  const wiQs = wiQsData ? wiQsData.map((q) => q) : wiQsTemplate;
  const showWi = !!whatIfArrow;
  const drawing = whatIfDrawing && !!sel;

  const wiDescription = whatIfArrow && selP && map.axes
    ? describeDirection(map.axes, selP, whatIfArrow, false)
    : '';
  const realDescription = selP && map.axes
    ? describeDirection(map.axes, selP, selP.arrow, selP.stays)
    : '';

  return (
    <main className="wrap">
      <BrandBar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--note)', lineHeight: 1.55 }}>Each dot is a 10-minute story someone wrote about this decision. Where it lands shows the future they pictured first.</p>
        <h1 style={{ font: '400 28px/1.2 var(--title)', marginBottom: 4 }}>{bigQuestion || title}</h1>
        <p className="note" style={{ marginBottom: 20 }}>{storyCount} {storyCount === 1 ? 'story' : 'stories'} placed</p>

        {prompt && (
          <div style={{ marginBottom: 24, padding: '14px 16px', borderLeft: '2px solid #afbeb1', background: 'rgba(175,190,177,0.07)', borderRadius: '0 6px 6px 0' }}>
            <span className="kicker" style={{ display: 'block', marginBottom: 6 }}>The prompt</span>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{prompt}</p>
          </div>
        )}

        {drawing && (
          <p style={{ textAlign: 'center', marginBottom: 8, fontSize: 14, color: '#a5c7d1', fontStyle: 'italic' }}>
            Tap anywhere on the map to draw your arrow
          </p>
        )}

        <div className="mapwrap">
          <StoryMap
            axes={map.axes}
            quads={map.quads}
            points={map.points}
            selId={sel}
            onSelect={drawing ? undefined : (pid) => setSel(pid === sel ? null : pid)}
            showArrows
            reveal
            arrowFor={drawing ? sel : null}
            onArrow={drawing ? ((_dotId, xy) => { setWhatIfArrow(xy); setWhatIfDrawing(false); }) : undefined}
            whatIfFor={showWi ? sel : null}
            whatIfTo={whatIfArrow}
          />
        </div>

        {!sel && storyCount > 0 && (
          <p className="note" style={{ marginTop: 12, textAlign: 'center' }}>Tap a dot to read their story and explore what questions they faced.</p>
        )}

        {selP && (
          <div className="peek" style={{ marginTop: 16 }}>

            {/* Name + arrow badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
              <div>
                {selP.headline && (
                  <strong style={{ font: '400 20px var(--title)', display: 'block', marginBottom: 4 }}>{selP.headline}</strong>
                )}
                <span className="kicker">{selP.label}</span>
              </div>
              {arrowType && (
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(175,190,177,0.18)', padding: '4px 10px', borderRadius: 20, color: '#afbeb1', whiteSpace: 'nowrap' }}>
                  {ARROW_LABEL[arrowType]}
                </span>
              )}
            </div>

            {/* Signal · context */}
            {(selP.signal || selP.context) && (
              <p className="note" style={{ marginBottom: 8 }}>
                {[selP.context, selP.signal].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Placement — where they currently sit */}
            {(selP.xq || selP.yq) && (
              <p style={{ fontStyle: 'italic', opacity: 0.65, fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 }}>
                {[selP.xq, selP.yq].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Story body */}
            {selP.body ? (
              <p className="storytext" style={{ margin: '0 0 14px', maxHeight: 300, overflow: 'auto' }}>{selP.body}</p>
            ) : (
              <p className="note" style={{ margin: '0 0 14px' }}>This story is kept private.</p>
            )}

            {/* Arrow exploration controls */}
            <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <button type="button" className="quiet" onClick={() => {
                setWhatIfArrow(null);
                setWiQsData(null);
                setWhatIfDrawing(!whatIfDrawing);
              }}>
                {drawing
                  ? 'Tap the map to place your arrow…'
                  : showWi
                  ? 'Try a different direction'
                  : 'Where would you go from here?'}
              </button>
              {(drawing || showWi) && (
                <button type="button" className="quiet" onClick={() => {
                  setWhatIfArrow(null);
                  setWhatIfDrawing(false);
                  setWiQsData(null);
                }}>Cancel</button>
              )}
            </div>

            {/* Questions panels */}
            {(showWi || realQs.length > 0) && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(175,190,177,0.2)' }}>

                {/* What-if questions — full experiential framing */}
                {showWi && (
                  <div style={{ marginBottom: realQs.length > 0 ? 24 : 0 }}>
                    <p style={{ font: '400 18px var(--title)', margin: '0 0 4px' }}>
                      You drew your arrow {wiDescription}
                    </p>
                    <p className="note" style={{ margin: '0 0 12px' }}>
                      Here's what the exercise would ask you from here:
                    </p>
                    {wiQsLoading && !wiQsData ? (
                      <p className="note" style={{ fontStyle: 'italic' }}>Writing your questions…</p>
                    ) : (
                      <ol className="qs-list">
                        {wiQs.map((q, i) => <li key={i}>{q}</li>)}
                      </ol>
                    )}
                  </div>
                )}

                {/* Their actual direction — shown as comparison when what-if is active */}
                {realQs.length > 0 && (
                  <div>
                    {showWi && (
                      <p className="note" style={{ margin: '0 0 10px' }}>
                        For comparison — where they actually drew their arrow ({realDescription}):
                      </p>
                    )}
                    {!showWi && (
                      <span className="kicker" style={{ display: 'block', marginBottom: 10 }}>Questions they were asked</span>
                    )}
                    <ol className="qs-list">
                      {realQs.map((q, i) => <li key={i}>{q}</li>)}
                    </ol>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {ctaSlug && (
          <div ref={setCtaEl} style={{ marginTop: 40, padding: '36px 24px', background: 'rgba(175,190,177,0.08)', border: '1px solid rgba(175,190,177,0.2)', borderRadius: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <p style={{ margin: 0, font: '400 22px/1.25 var(--title)', maxWidth: '28ch', textWrap: 'balance' }}>See where your story lands</p>
            <p className="note" style={{ margin: 0, fontSize: 14 }}>10 minutes of writing. Your dot appears next to these.</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <a href={`/p/${ctaSlug}`} style={{ display: 'inline-block', padding: '14px 32px', background: 'var(--ruby-site)', color: 'var(--paper)', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>
                Write about this decision →
              </a>
              <a href="/" className="textlink">Pick a different decision</a>
            </div>
          </div>
        )}
      </div>

      {ctaSlug && (
        <div className={`sticky-cta${ctaVisible ? ' out' : ''}`}>
          <a href={`/p/${ctaSlug}`}>Write about this decision →</a>
        </div>
      )}
    </main>
  );
}
