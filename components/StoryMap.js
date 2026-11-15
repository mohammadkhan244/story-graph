'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { SHAPES } from '@/lib/cards';

const W = 640, H = 640, M = 28;
const px = (x) => M + ((x + 5) / 10) * (W - 2 * M);
const py = (y) => H - M - ((y + 5) / 10) * (H - 2 * M);
const unpx = (v) => ((v - M) / (W - 2 * M)) * 10 - 5;
const unpy = (v) => ((H - M - v) / (H - 2 * M)) * 10 - 5;
const r1 = (v) => Math.max(-5, Math.min(5, Math.round(v * 10) / 10));
const short = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* Quadrant tint colors */
const TINTS = { tl: '#1d2b31', tr: '#222c28', bl: '#232a31', br: '#2b2924' };

/* Convert old {ll,hl,lh,hh} names-only format to new {tl,tr,bl,br} with name+meaning */
export function normalizeQuads(quadrants, quads) {
  if (quadrants && (quadrants.tl || quadrants.tr || quadrants.bl || quadrants.br)) return quadrants;
  if (!quads) return null;
  return {
    tl: { name: String(quads.lh || ''), meaning: '' },
    tr: { name: String(quads.hh || ''), meaning: '' },
    bl: { name: String(quads.ll || ''), meaning: '' },
    br: { name: String(quads.hl || ''), meaning: '' },
  };
}

function wrapSvg(text, maxChars = 28) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > maxChars && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
export const fmt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Number(n) || 0).toFixed(1);

function spreadOverlaps(points, threshold = 0.4, radius = 0.4) {
  const clusters = [];
  const pointCluster = new Map();
  const sorted = [...points]
    .filter((p) => p.x != null && p.y != null)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const p of sorted) {
    let best = null, bestDist = Infinity;
    for (const c of clusters) {
      const d = Math.hypot(p.x - c.cx, p.y - c.cy);
      if (d < threshold && d < bestDist) { best = c; bestDist = d; }
    }
    if (best) { best.members.push(p); pointCluster.set(p.id, best); }
    else { const c = { cx: p.x, cy: p.y, members: [p] }; clusters.push(c); pointCluster.set(p.id, c); }
  }
  for (const c of clusters) {
    c.cx = c.members.reduce((s, p) => s + p.x, 0) / c.members.length;
    c.cy = c.members.reduce((s, p) => s + p.y, 0) / c.members.length;
  }
  return points.map((p) => {
    if (p.x == null || p.y == null) return p;
    const c = pointCluster.get(p.id);
    if (!c || c.members.length < 2) return p;
    const idx = c.members.indexOf(p);
    const angle = (idx / c.members.length) * Math.PI * 2 - Math.PI / 2;
    return { ...p, x: c.cx + radius * Math.cos(angle), y: c.cy + radius * Math.sin(angle) };
  });
}

const TONES = ['#afbeb1', '#d4dfdc', '#79998b', '#b8cdc4', '#8d9d9d'];
export function signalColors(points) {
  const tags = [];
  points.forEach((p) => { if (p.signal && p.source !== 'card-exercise' && !tags.includes(p.signal)) tags.push(p.signal); });
  return {
    tags,
    color: (s) => TONES[Math.max(0, tags.indexOf(s)) % TONES.length],
    shape: (s) => SHAPES[Math.max(0, tags.indexOf(s)) % SHAPES.length],
  };
}

export function Mark({ shape, r, fill, stroke, sw = 2, dash }) {
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash };
  if (shape === 'square') return <rect x={-r * 0.85} y={-r * 0.85} width={r * 1.7} height={r * 1.7} rx={2} {...common} />;
  if (shape === 'triangle') return <polygon points={`0,${-r} ${r * 0.95},${r * 0.75} ${-r * 0.95},${r * 0.75}`} {...common} />;
  if (shape === 'diamond') return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} {...common} />;
  if (shape === 'hex') {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 3 * i + Math.PI / 6; return `${Math.cos(a) * r},${Math.sin(a) * r}`; }).join(' ');
    return <polygon points={pts} {...common} />;
  }
  return <circle r={r} {...common} />;
}

function Arrow({ from, to, color, width, opacity = 1, id, dash }) {
  const x1 = px(from.x), y1 = py(from.y), x2 = px(to.x), y2 = py(to.y);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 8) return null;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const sx = x1 + ux * 16, sy = y1 + uy * 16;
  const hx = x2 - ux * 12, hy = y2 - uy * 12;
  const a = 0.5, s = 12;
  const l1 = `${x2 - s * (ux * Math.cos(a) - uy * Math.sin(a))},${y2 - s * (uy * Math.cos(a) + ux * Math.sin(a))}`;
  const l2 = `${x2 - s * (ux * Math.cos(-a) - uy * Math.sin(-a))},${y2 - s * (uy * Math.cos(-a) + ux * Math.sin(-a))}`;
  return (
    <g opacity={opacity} key={id} className="arrow">
      <line x1={sx} y1={sy} x2={hx} y2={hy} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
      <polygon points={`${x2},${y2} ${l1} ${l2}`} fill={color} opacity={dash ? 0.35 : 1} />
    </g>
  );
}

/* Quadrant title rendered outside the SVG */
function QuadTitle({ qt, side, isMobile }) {
  const [open, setOpen] = useState(false);
  if (!qt || !qt.name) return <div className={`map-qt map-qt-${side}`} />;
  const hasMeaning = !!qt.meaning;
  return (
    <div className={`map-qt map-qt-${side}`}>
      {isMobile && hasMeaning ? (
        <button className="map-qt-btn" onClick={() => setOpen((v) => !v)}>
          <span className="map-qt-name">{qt.name}</span>
          {open && <span className="map-qt-meaning">{qt.meaning}</span>}
        </button>
      ) : (
        <>
          <span className="map-qt-name">{qt.name}</span>
          {!isMobile && hasMeaning && <span className="map-qt-meaning">{qt.meaning}</span>}
        </>
      )}
    </div>
  );
}

export default function StoryMap({
  axes, quads, quadrants: quadrantsProp, points = [], background = [], youId, selId, onSelect, onMove,
  arrowFor, onArrow, showArrows = true, showLabels = true, reveal = false, big = false,
  pastArrowEnds, whatIfFor, whatIfTo,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  const [svgWidth, setSvgWidth] = useState(0);
  const [tapLabel, setTapLabel] = useState(null);
  const [hovered, setHovered] = useState(null);

  const ax = (axes && axes.x) || {}, ay = (axes && axes.y) || {};
  const isMobile = svgWidth < 640;
  const displayPoints = spreadOverlaps(points);
  const qn = normalizeQuads(quadrantsProp, quads);
  const hasQuads = !!(qn && (qn.tl?.name || qn.tr?.name || qn.bl?.name || qn.br?.name));

  useEffect(() => {
    // Observe the outer layout div — its width is stable and doesn't depend on
    // isMobile, so measuring it avoids the feedback loop that caused flickering.
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setSvgWidth(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = svgWidth / W;

  function toXY(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: r1(unpx(p.x)), y: r1(unpy(p.y)) };
  }

  const drawing = !!arrowFor && !!onArrow;
  const origin = drawing ? displayPoints.find((p) => p.id === arrowFor) : null;
  const surface = drawing ? {
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); setDraft(toXY(e)); },
    onPointerMove: (e) => { if (draft) setDraft(toXY(e)); },
    onPointerUp: (e) => { const d = toXY(e); setDraft(null); onArrow(arrowFor, d); },
  } : {};

  const ordered = [...displayPoints].sort((a, b) => (a.id === youId) - (b.id === youId));
  const { shape } = signalColors(points);

  /* Label visibility: YOU always, others on hover/tap/select; presenter showLabels=all */
  function showLabel(p) {
    if (p.id === youId) return true;
    if (p.isTest) return true;
    if (isMobile) return tapLabel === p.id;
    return showLabels || hovered === p.id || selId === p.id;
  }

  /* Clamp label x so it doesn't overflow the plot */
  function labelCx(x, labelText) {
    const tw = (labelText.length * 7 + 12);
    return Math.min(W - M - tw / 2, Math.max(M + tw / 2, px(x)));
  }

  const n = points.length;

  /* Percentage of M within the SVG viewBox, used for axis box positioning */
  const mPct = `${(M / W * 100).toFixed(3)}%`;

  return (
    <div className="map-layout" ref={containerRef} onClick={() => { tapLabel && setTapLabel(null); }}>

      {/* Quadrant titles above — OUTSIDE the dark mapwrap box */}
      {hasQuads && (
        <div className="map-qt-row map-qt-top">
          <QuadTitle qt={qn.tl} side="tl" isMobile={isMobile} />
          <QuadTitle qt={qn.tr} side="tr" isMobile={isMobile} />
        </div>
      )}

      {/* The dark map box */}
      <div className="mapwrap">

      {/* Map row: left axis box + SVG container + right axis box */}
      <div className="map-with-axes">
        {!isMobile && axes && ax.low && (
          <div className="map-axis-box map-axis-side-left">← {ax.low}</div>
        )}

        <div className="map-axis-box-container">
          {axes && ay.high && (
            <div className="map-axis-box map-axis-top" style={{ top: mPct }}>↑ {ay.high}</div>
          )}

          <svg ref={svgRef}
            className={'map' + (drawing ? ' drawing' : '') + (big ? ' big' : '') + (reveal ? ' reveal' : '')}
            viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${n} stories`} {...surface}
            onClick={(e) => { if (!drawing) tapLabel && setTapLabel(null); }}>

            {/* Quadrant tint rects (clipped to rounded rectangle) */}
            <defs>
              <clipPath id={`pc-${uid}`}>
                <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} rx={8} />
              </clipPath>
            </defs>
            <g clipPath={`url(#pc-${uid})`}>
              <rect x={M} y={M} width={px(0) - M} height={py(0) - M} fill={TINTS.tl} />
              <rect x={px(0)} y={M} width={W - M - px(0)} height={py(0) - M} fill={TINTS.tr} />
              <rect x={M} y={py(0)} width={px(0) - M} height={H - M - py(0)} fill={TINTS.bl} />
              <rect x={px(0)} y={py(0)} width={W - M - px(0)} height={H - M - py(0)} fill={TINTS.br} />
            </g>

            {/* Center axis lines */}
            <line x1={px(0)} y1={M} x2={px(0)} y2={H - M} stroke="#8d9d9d" strokeWidth={1} />
            <line x1={M} y1={py(0)} x2={W - M} y2={py(0)} stroke="#8d9d9d" strokeWidth={1} />

            {/* Background dots */}
            {background.map((p) => <circle key={'bg' + p.id} className="bgdot" cx={px(p.x)} cy={py(p.y)} r={3} />)}

            {/* Past arrow ghosts */}
            {pastArrowEnds && (() => {
              const me = points.find((p) => p.id === youId);
              if (!me || me.x == null) return null;
              return pastArrowEnds.map((end, i) => (
                <Arrow key={'past' + i} id={'past' + i} from={me} to={end} color="#79998b" width={1.5} opacity={0.3} dash="6 4" />
              ));
            })()}

            {/* Other people's arrows */}
            {displayPoints.filter((p) => p.arrow && p.x != null && p.id !== youId && (showArrows || p.id === selId)).map((p) => (
              <Arrow key={'a' + p.id} id={'a' + p.id} from={p} to={p.arrow} color="#afbeb1" width={2} opacity={p.id === selId ? 0.85 : 0.45} />
            ))}

            {/* Your arrow */}
            {(() => {
              const me = displayPoints.find((p) => p.id === youId);
              if (!me || me.x == null) return null;
              const head = drawing && arrowFor === youId && draft ? draft : (showArrows ? me.arrow : null);
              return head ? <Arrow id="mine" from={me} to={head} color="#fffdf6" width={3.5} /> : null;
            })()}

            {/* Draft arrow while drawing (admin: other dot) */}
            {drawing && arrowFor !== youId && origin && draft && <Arrow id="draft" from={origin} to={draft} color="#fffdf6" width={3} />}

            {/* What-if arrow */}
            {whatIfFor && whatIfTo && (() => {
              const wif = displayPoints.find((p) => p.id === whatIfFor);
              if (!wif || wif.x == null) return null;
              const mx = (px(wif.x) + px(whatIfTo.x)) / 2;
              const my = (py(wif.y) + py(whatIfTo.y)) / 2 - 12;
              return (
                <g className="whatif-arrow">
                  <Arrow id="whatif" from={wif} to={whatIfTo} color="#a5c7d1" width={2.5} dash="9 5" />
                  <text x={mx} y={my} textAnchor="middle" className="whatif-lbl">what if</text>
                </g>
              );
            })()}

            {/* Dots */}
            {ordered.map((p, i) => {
              const scored = p.x != null && p.y != null;
              if (!scored) return null;
              let x = p.x, y = p.y;
              if (drag && drag.id === p.id && drag.moved) { x = drag.x; y = drag.y; }
              const you = !!(youId && p.id === youId);
              const sel = selId === p.id;
              const testDot = !!p.isTest;
              const hollow = p.source === 'card-exercise';
              const lbl = showLabel(p);
              const labelText = you ? 'YOU' : (p.isTest ? 'TEST' : short(p.label || '', 20));
              const lcx = labelCx(x, labelText) - px(x);

              return (
                <g key={p.id} className={'dot' + (you ? ' you' : '') + (onMove ? ' drag' : '')}
                  tabIndex={drawing ? -1 : 0} role="button"
                  style={{ '--i': i }}
                  aria-label={`${you ? 'Your story' : (p.label || 'Story')}, ${fmt(p.x)} across, ${fmt(p.y)} up`}
                  transform={`translate(${px(x)} ${py(y)})`}
                  onMouseEnter={!you && !drawing ? () => setHovered(p.id) : undefined}
                  onMouseLeave={!you && !drawing ? () => setHovered(null) : undefined}
                  onClick={(e) => {
                    if (drawing) return;
                    e.stopPropagation();
                    if (drag && drag.moved) return;
                    if (isMobile && !you) setTapLabel(tapLabel === p.id ? null : p.id);
                    onSelect && onSelect(p.id);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect && onSelect(p.id); } }}
                  onPointerDown={onMove && !drawing ? (e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: p.id, x, y, sx: e.clientX, sy: e.clientY, moved: false }); } : undefined}
                  onPointerMove={onMove && !drawing ? (e) => {
                    if (!drag || drag.id !== p.id) return;
                    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
                    setDrag({ ...drag, ...toXY(e), moved: true });
                  } : undefined}
                  onPointerUp={onMove && !drawing ? () => { if (drag && drag.id === p.id && drag.moved) onMove(p.id, drag.x, drag.y); setTimeout(() => setDrag(null), 0); } : undefined}
                >
                  <g className="pop">
                    {you ? (
                      <circle r={13} fill="#a72f39" stroke="#fffdf6" strokeWidth={3} />
                    ) : testDot ? (
                      <Mark shape="circle" r={sel ? 10 : 8} fill="none" stroke="#a72f39" sw={sel ? 3 : 2} />
                    ) : (
                      <>
                        {p.body != null && <circle r={sel ? 16 : 14} fill="none" stroke="#afbeb1" strokeWidth={1.5} opacity={0.45} />}
                        <Mark shape={shape(p.signal)} r={sel ? 10 : 8}
                          fill={hollow ? 'none' : '#afbeb1'}
                          stroke={sel ? '#fffdf6' : '#0c1012'}
                          sw={2} />
                      </>
                    )}
                  </g>

                  {/* Label / tooltip */}
                  {lbl && labelText && (
                    <text
                      className={'dlab' + (you ? ' me' : testDot ? ' test' : '')}
                      textAnchor="middle"
                      y={you ? 28 : (isMobile ? -18 : -18)}
                      style={{ fontSize: you ? 11 : 11 }}>
                      <tspan x={lcx}>{labelText}</tspan>
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {axes && ay.low && (
            <div className="map-axis-box map-axis-bottom" style={{ bottom: mPct }}>↓ {ay.low}</div>
          )}
        </div>

        {!isMobile && axes && ax.high && (
          <div className="map-axis-box map-axis-side-right">{ax.high} →</div>
        )}
      </div>

      {/* Mobile: x-axis row below the plot */}
      {isMobile && axes && (ax.low || ax.high) && (
        <div className="map-axis-sides-mobile">
          {ax.low && <span className="map-axis-box">← {ax.low}</span>}
          {ax.high && <span className="map-axis-box">{ax.high} →</span>}
        </div>
      )}

      </div>{/* end mapwrap */}

      {/* Quadrant titles below — OUTSIDE the dark mapwrap box */}
      {hasQuads && (
        <div className="map-qt-row map-qt-bottom">
          <QuadTitle qt={qn.bl} side="bl" isMobile={isMobile} />
          <QuadTitle qt={qn.br} side="br" isMobile={isMobile} />
        </div>
      )}

      {/* Hint text */}
      {onSelect && (
        <p className="note map-hint">Tap any dot to see whose story it is.</p>
      )}
    </div>
  );
}
