'use client';
import { useRef } from 'react';
import { testimonials } from '@/data/testimonials';

function Card({ t }) {
  const paras = t.quote.split('\n\n');
  return (
    <div className="tm-card">
      <blockquote className="tm-quote">
        {paras.map((para, pi) => (
          <p key={pi}>
            {pi === 0 && '“'}{para}{pi === paras.length - 1 && '”'}
          </p>
        ))}
      </blockquote>
      <div className="tm-byline">
        <div className="tm-name">{t.name}</div>
        <div className="tm-role">{t.role}</div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const reelRef = useRef(null);

  function pause() {
    if (reelRef.current) reelRef.current.style.animationPlayState = 'paused';
  }
  function resume() {
    if (reelRef.current) reelRef.current.style.animationPlayState = 'running';
  }

  if (!testimonials.length) return null;

  return (
    <section
      className="tm-section"
      aria-label="Testimonials"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
    >
      <div className="tm-viewport">
        <div className="tm-reel" ref={reelRef}>
          {testimonials.map((t, i) => <Card key={i} t={t} />)}
          {testimonials.map((t, i) => (
            <div key={'d' + i} className="tm-card" aria-hidden="true" data-dup="">
              <blockquote className="tm-quote">
                {t.quote.split('\n\n').map((para, pi, arr) => (
                  <p key={pi}>
                    {pi === 0 && '“'}{para}{pi === arr.length - 1 && '”'}
                  </p>
                ))}
              </blockquote>
              <div className="tm-byline">
                <div className="tm-name">{t.name}</div>
                <div className="tm-role">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
