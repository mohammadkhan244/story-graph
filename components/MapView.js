'use client';
import { useEffect, useState } from 'react';
import StoryMap from './StoryMap';
import BrandBar from './BrandBar';

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

  const { map, title, bigQuestion, ctaSlug, storyCount } = data;
  const selP = map.points.find((p) => p.id === sel);

  return (
    <main className="wrap">
      <BrandBar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <h1 style={{ font: '400 28px/1.2 var(--title)', marginBottom: 4 }}>{bigQuestion || title}</h1>
        <p className="note" style={{ marginBottom: 20 }}>{storyCount} {storyCount === 1 ? 'story' : 'stories'} placed</p>
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

        {selP && (
          <div className="peek" style={{ marginTop: 16 }}>
            {selP.headline && (
              <strong style={{ font: '400 20px var(--title)', display: 'block', marginBottom: 6 }}>
                {selP.headline}
              </strong>
            )}
            <span className="kicker">{selP.label}</span>
            {selP.body ? (
              <>
                {(selP.context || selP.signal) && (
                  <p className="note" style={{ marginTop: 4 }}>
                    {[selP.context, selP.signal].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="storytext" style={{ marginTop: 8, maxHeight: 260, overflow: 'auto' }}>{selP.body}</p>
              </>
            ) : (
              <p className="note" style={{ marginTop: 6 }}>This story is kept private.</p>
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
