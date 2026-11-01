'use client';
import { useState, useEffect } from 'react';

export default function FictioneeringBlock({ prefillEmail = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { if (!loaded) setTimedOut(true); }, 6000);
    return () => clearTimeout(t);
  }, [loaded]);

  const subUrl = 'https://fictioneering-newsletter.themohammadkhan.com/subscribe?utm_source=story-map'
    + (prefillEmail ? `&email=${encodeURIComponent(prefillEmail)}` : '');

  return (
    <div style={{ background: '#fffdf6', color: '#0c1012', border: '1px solid #8d9d9d', borderRadius: 12, padding: '24px 20px' }}>
      <span style={{ fontFamily: 'var(--labelf)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 11, color: '#5a6068', display: 'block', marginBottom: 8 }}>Fictioneering</span>
      <p style={{ fontFamily: 'var(--title)', fontWeight: 400, fontSize: 22, lineHeight: 1.25, margin: '0 0 6px', color: '#0c1012' }}>Learn how to apply your story.</p>
      <p style={{ fontFamily: 'var(--body)', fontSize: 15, margin: '0 0 16px', color: '#3a4048', lineHeight: 1.55 }}>Weekly essays on using fiction to make real decisions. Free.</p>
      {timedOut ? (
        <a href={subUrl} target="_blank" rel="noreferrer" style={{ color: '#0c1012', textDecoration: 'underline', fontSize: 15 }}>Subscribe on Substack →</a>
      ) : (
        <>
          <iframe
            src="https://fictioneering-newsletter.themohammadkhan.com/embed?transparent=1&light=1"
            title="Subscribe to Fictioneering"
            loading="lazy"
            style={{ border: 0, background: 'transparent', width: '100%', maxWidth: 480, height: 150, display: 'block', margin: '0 auto' }}
            scrolling="no"
            onLoad={() => setLoaded(true)}
          />
          {!loaded && (
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13 }}>
              <a href={subUrl} target="_blank" rel="noreferrer" style={{ color: '#5a6068', textDecoration: 'underline' }}>Subscribe on Substack →</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
