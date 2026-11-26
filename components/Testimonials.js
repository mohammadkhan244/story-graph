'use client';
import { useRef } from 'react';
import { testimonials } from '@/data/testimonials';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function Photo({ t }) {
  if (t.photo) {
    return (
      <div
        className="tm-photo"
        style={{ backgroundImage: `url(${t.photo})` }}
        role="img"
        aria-label={t.name}
      />
    );
  }
  return (
    <div className="tm-photo tm-photo-initials" aria-hidden="true">
      {getInitials(t.name)}
    </div>
  );
}

function Card({ t, dup }) {
  const paras = t.quote.split('\n\n');
  return (
    <div
      className="tm-card"
      aria-hidden={dup ? 'true' : undefined}
      {...(dup ? { 'data-dup': '' } : {})}
    >
      <Photo t={t} />
      <div className="tm-name">{t.name}</div>
      <div className="tm-role">{t.role}</div>
      <blockquote className="tm-quote">
        {paras.map((para, pi) => (
          <p key={pi}>
            {pi === 0 && '“'}{para}{pi === paras.length - 1 && '”'}
          </p>
        ))}
      </blockquote>
    </div>
  );
}

function packColumns(items, targetChars = 600) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.quote.length - a.quote.length);
  const cols = [];
  for (const item of sorted) {
    let placed = false;
    for (const col of cols) {
      const colChars = col.reduce((s, x) => s + x.quote.length, 0);
      if (colChars + item.quote.length <= targetChars) {
        col.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) cols.push([item]);
  }
  return cols;
}

export function TestimonialsFeatured() {
  const featured = testimonials.filter(t => t.featured);
  const reelRef = useRef(null);

  function pause() { if (reelRef.current) reelRef.current.style.animationPlayState = 'paused'; }
  function resume() { if (reelRef.current) reelRef.current.style.animationPlayState = 'running'; }

  if (!featured.length) return null;

  return (
    <section
      className="tmfeat-section"
      aria-label="What people are saying"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
    >
      <div className="tmfeat-viewport">
        <div className="tmfeat-reel" ref={reelRef}>
          {featured.map((t, i) => <Card key={i} t={t} />)}
          {featured.map((t, i) => <Card key={'d' + i} t={t} dup />)}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsWall() {
  const wall = testimonials.filter(t => !t.featured);
  const cols = packColumns(wall);
  const reelRef = useRef(null);

  function pause() { if (reelRef.current) reelRef.current.style.animationPlayState = 'paused'; }
  function resume() { if (reelRef.current) reelRef.current.style.animationPlayState = 'running'; }

  if (!cols.length) return null;

  return (
    <section
      className="tmwall-section"
      aria-label="More testimonials"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
    >
      <div className="tmwall-viewport">
        <div className="tmwall-reel" ref={reelRef}>
          {cols.map((col, ci) => (
            <div key={ci} className="tmwall-col">
              {col.map((t, ti) => <Card key={ti} t={t} />)}
            </div>
          ))}
          {cols.map((col, ci) => (
            <div key={'d' + ci} className="tmwall-col" aria-hidden="true" data-dup="">
              {col.map((t, ti) => <Card key={ti} t={t} />)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Testimonials() {
  return (
    <>
      <TestimonialsFeatured />
      <TestimonialsWall />
    </>
  );
}
