'use client';
import { useEffect, useRef, useState } from 'react';
import { testimonials } from '@/lib/testimonials';

function Avatar({ item }) {
  const initials = item.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const style = item.photo ? { backgroundImage: `url(${item.photo})` } : undefined;
  return <div className="tm-avatar" style={style} aria-hidden="true">{item.photo ? null : initials}</div>;
}

export default function Testimonials() {
  const count = testimonials.length;
  const [idx, setIdx] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const idxRef = useRef(0);
  idxRef.current = idx;

  function scrollToSlide(i) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
  }

  function goTo(i) {
    const next = ((i % count) + count) % count;
    setIdx(next);
    setExpandedIdx(null);
    scrollToSlide(next);
  }

  // Sync dot index when user swipes on mobile
  useEffect(() => {
    const el = trackRef.current;
    if (!el || count < 2) return;
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const i = Math.round(el.scrollLeft / el.offsetWidth);
        if (i !== idxRef.current) {
          setIdx(i);
          setExpandedIdx(null);
        }
      }, 150);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => { el.removeEventListener('scroll', handler); clearTimeout(timer); };
  }, [count]);

  // Auto-advance every 8 s, pauses on hover/focus, respects reduced-motion
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        const next = (idxRef.current + 1) % count;
        setIdx(next);
        setExpandedIdx(null);
        scrollToSlide(next);
      }
    }, 8000);
    return () => clearInterval(id);
  }, [count]);

  if (!count) return null;

  return (
    <section
      className={`tm-section${count >= 2 ? ' tm-has-nav' : ''}`}
      aria-label="Testimonials"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={() => { pausedRef.current = false; }}
    >
      <div
        className={`tm-track${count >= 2 ? ' tm-multi' : ''}`}
        ref={count >= 2 ? trackRef : null}
      >
        {testimonials.map((item, i) => (
          <div
            className="tm-slide"
            key={i}
            aria-hidden={count >= 2 && i !== idx ? true : undefined}
          >
            <div className="tm-card">
              <blockquote className="tm-pull">
                <p>&#8220;{expandedIdx === i ? item.full : item.pull}&#8221;</p>
              </blockquote>
              {item.pull !== item.full && (
                <button
                  type="button"
                  className="textlink tm-toggle"
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  aria-expanded={expandedIdx === i}
                >
                  {expandedIdx === i ? 'Show less' : 'Read more'}
                </button>
              )}
              <div className="tm-byline">
                <Avatar item={item} />
                <div>
                  <div className="tm-name">{item.name}</div>
                  <div className="tm-role">{item.role}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {count >= 2 && (
        <div className="tm-nav">
          <button type="button" className="tm-arrow" onClick={() => goTo(idx - 1)} aria-label="Previous testimonial">&#8592;</button>
          <div className="tm-dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`tm-dot${i === idx ? ' on' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === idx ? true : undefined}
              />
            ))}
          </div>
          <button type="button" className="tm-arrow" onClick={() => goTo(idx + 1)} aria-label="Next testimonial">&#8594;</button>
        </div>
      )}
    </section>
  );
}
