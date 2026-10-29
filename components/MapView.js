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

export default function MapView({ id }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    fetch(`/api/m/${id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) setErr(j.error); else setData(j); })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <main className="wrap"><BrandBar /><p className="warn" style={{ padding: '24px 16px' }}>{err}</p></main>;
  if (!data) return <main className="wrap"><BrandBar /><p className="note" style={{ padding: '24px 16px' }}>Loading…</p></main>;

  const { map, title, bigQuestion, prompt, ctaSlug, storyCount } = data;
  const selP = map.points.find((p) => p.id === sel);

  let arrowType = null;
  if (selP && map.axes && (selP.stays || selP.arrow)) {
    arrowType = selP.stays ? 'stay' : classifyArrow({ x: selP.x, y: selP.y }, selP.arrow);
  }
  const qs = selP && map.axes && (selP.stays || selP.arrow) ? questions(map.axes, selP) : [];

  return (
    <main className="wrap">
      <BrandBar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <h1 style={{ font: '400 28px/1.2 var(--title)', marginBottom: 4 }}>{bigQuestion || title}</h1>
        <p className="note" style={{ marginBottom: 20 }}>{storyCount} {storyCount === 1 ? 'story' : 'stories'} placed</p>

        {prompt && (
          <div style={{ marginBottom: 24, padding: '14px 16px', borderLeft: '2px solid #afbeb1', background: 'rgba(175,190,177,0.07)', borderRadius: '0 6px 6px 0' }}>
            <span className="kicker" style={{ display: 'block', marginBottom: 6 }}>The prompt</span>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{prompt}</p>
          </div>
        )}

        <div className="mapwrap">
          <StoryMap
            axes={map.axes}
            quads={map.quads}
            points={map.points}
            selId={sel}
            onSelect={(pid) => setSel(pid === sel ? null : pid)}
            showArrows
            reveal
          />
        </div>

        {!sel && storyCount > 0 && (
          <p className="note" style={{ marginTop: 12, textAlign: 'center' }}>Tap a dot to see their story and what questions they were asked.</p>
        )}

        {selP && (
          <div className="peek" style={{ marginTop: 16 }}>
            {/* Name + arrow badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
              <div>
                {selP.headline && (
                  <strong style={{ font: '400 20px var(--title)', display: 'block', marginBottom: 4 }}>
                    {selP.headline}
                  </strong>
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

            {/* Placement quotes — current situation */}
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

            {/* Questions they were asked */}
            {qs.length > 0 && (
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(175,190,177,0.2)' }}>
                <span className="kicker" style={{ display: 'block', marginBottom: 10 }}>Questions they were asked</span>
                <ol className="qs-list">
                  {qs.map((q, i) => <li key={i}>{q}</li>)}
                </ol>
              </div>
            )}
          </div>
        )}

        {ctaSlug && (
          <div style={{ marginTop: 40, padding: '28px 24px', background: 'rgba(175,190,177,0.12)', border: '1px solid rgba(175,190,177,0.25)', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ margin: '0 0 14px', fontSize: 18, fontFamily: 'var(--title)' }}>Want to see where your story lands?</p>
            <a href={`/p/${ctaSlug}`} style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
              Write yours →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
