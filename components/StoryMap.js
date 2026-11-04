'use client';
import { useEffect, useRef, useState } from 'react';
import { SHAPES } from '@/lib/cards';

/* Brand map: ink field, sage dots, your dot is the one ruby signal on screen.
   Signals are told apart by shape, card-exercise stories by hollow dots. */
const W = 640, H = 640, M = 70;
const px = (x) => M + ((x + 5) / 10) * (W - 2 * M);
const py = (y) => H - M - ((y + 5) / 10) * (H - 2 * M);
const unpx = (v) => ((v - M) / (W - 2 * M)) * 10 - 5;
const unpy = (v) => ((H - M - v) / (H - 2 * M)) * 10 - 5;
const r1 = (v) => Math.max(-5, Math.min(5, Math.round(v * 10) / 10));
const short = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
function labelLines(label, maxChars = 14) {
  if (label.length <= maxChars) return [label];
  const sp = label.lastIndexOf(' ', maxChars);
  if (sp < 1) return [short(label, maxChars + 1)];
  return [label.slice(0, sp), short(label.slice(sp + 1), maxChars + 1)];
}
export const fmt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Number(n) || 0).toFixed(1);

/* Kept for the admin legend: signals map to sage tones + a shape. */
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

export default function StoryMap({
  axes, quads, points = [], background = [], youId, selId, onSelect, onMove,
  arrowFor, onArrow, showArrows = true, showLabels = true, reveal = false, big = false,
  pastArrowEnds, whatIfFor, whatIfTo,
}) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tooltipPole, setTooltipPole] = useState(null);
  const [svgWidth, setSvgWidth] = useState(W);
  const [tapLabel, setTapLabel] = useState(null);   // mobile: id of dot whose name is showing
  const [expandPole, setExpandPole] = useState(null); // mobile: id of pole showing full text
  const ax = (axes && axes.x) || {}, ay = (axes && axes.y) || {};
  const isMobile = svgWidth < 640;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setSvgWidth(e.contentRect.width); });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // fs(base) → the SVG font-size that renders as at least 13px on screen
  const scale = svgWidth / W;
  const fs = (base) => Math.ceil(Math.max(base, 13 / Math.max(scale, 0.05)));

  useEffect(() => {
    if (!tooltipPole) return;
    const handler = (e) => { if (e.key === 'Escape') setTooltipPole(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tooltipPole]);

  function poleProps(id, name, desc) {
    if (!desc) return {};
    const active = tooltipPole === id;
    return {
      role: 'button',
      tabIndex: 0,
      style: { cursor: 'pointer', textDecoration: active ? 'underline' : 'none' },
      'aria-label': `${name}: ${desc}`,
      onClick: (e) => { e.stopPropagation(); setTooltipPole(active ? null : id); },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setTooltipPole(active ? null : id); }
      },
    };
  }

  const { shape } = signalColors(points);

  function toXY(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: r1(unpx(p.x)), y: r1(unpy(p.y)) };
  }

  const drawing = !!arrowFor && !!onArrow;
  const origin = drawing ? points.find((p) => p.id === arrowFor) : null;
  const surface = drawing ? {
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); setDraft(toXY(e)); },
    onPointerMove: (e) => { if (draft) setDraft(toXY(e)); },
    onPointerUp: (e) => { const d = toXY(e); setDraft(null); onArrow(arrowFor, d); },
  } : {};

  // ── Label placement: x-clamping + overlap detection ────────────────────────
  // Returns Map<id, {show: boolean, cx: number}> where cx is clamped absolute x in SVG.
  const ordered = [...points].sort((a, b) => (a.id === youId) - (b.id === youId));
  const labelMap = new Map();
  {
    const accepted = []; // already-placed bboxes {x1,y1,x2,y2}

    function tryLabel(p) {
      if (p.x == null || p.y == null) { labelMap.set(p.id, { show: false, cx: 0 }); return; }
      const you = !!(youId && p.id === youId);
      const sel = selId === p.id;

      if (isMobile) {
        labelMap.set(p.id, { show: you || tapLabel === p.id, cx: px(p.x) });
        return;
      }

      if (!(showLabels || you || sel)) { labelMap.set(p.id, { show: false, cx: 0 }); return; }

      const lines = p.isTest ? ['TEST'] : you ? ['You'] : labelLines(p.label || '');
      const fsize = big ? 13 : (you ? 13 : 11);
      const maxLen = Math.max(...lines.map((l) => l.length), 1);
      const tw = maxLen * fsize * 0.62;
      const th = lines.length * fsize * 1.4;
      const rawCx = px(p.x);
      const cx = Math.min(W - M - tw / 2, Math.max(M + tw / 2, rawCx));
      const ly = py(p.y) + (you ? 36 : 22);
      const bbox = { x1: cx - tw / 2 - 2, y1: ly - 2, x2: cx + tw / 2 + 2, y2: ly + th + 2 };

      const overlapping = !you && !sel &&
        accepted.some((b) => bbox.x2 >= b.x1 && bbox.x1 <= b.x2 && bbox.y2 >= b.y1 && bbox.y1 <= b.y2);

      if (!overlapping) {
        accepted.push(bbox);
        labelMap.set(p.id, { show: true, cx });
      } else {
        labelMap.set(p.id, { show: false, cx: rawCx });
      }
    }

    // Priority: you → selected → rest
    const youPt = points.find((p) => p.id === youId);
    const selPt = selId && selId !== youId ? points.find((p) => p.id === selId) : null;
    if (youPt) tryLabel(youPt);
    if (selPt) tryLabel(selPt);
    for (const p of ordered) {
      if (p.id !== youId && p.id !== selId) tryLabel(p);
    }
  }

  // Mobile: render a pole label span with tap-to-expand for long text
  function mPole(id, arrow, text, align) {
    if (!text) return null;
    const expanded = expandPole === id;
    const tooLong = text.length > 18;
    return (
      <span
        key={id}
        className="map-pole-label"
        style={{ textAlign: align || 'left', cursor: tooLong ? 'pointer' : 'default' }}
        role={tooLong ? 'button' : undefined}
        aria-label={text}
        onClick={tooLong ? (e) => { e.stopPropagation(); setExpandPole(expanded ? null : id); } : undefined}
      >
        {arrow} {expanded ? text : short(text, 18)}
        {tooLong && !expanded && <span style={{ color: 'var(--muted)', fontSize: '0.85em' }}> tap</span>}
      </span>
    );
  }

  const n = points.length;

  return (
    <>
      {/* ── Y-high label above SVG (mobile only) ── */}
      {isMobile && (
        <div className="map-y-high">
          {mPole('yhigh', '↑', ay.high)}
          {ay.name && <span className="map-axname-badge">{ay.name}</span>}
        </div>
      )}

      <svg ref={svgRef}
        className={'map' + (drawing ? ' drawing' : '') + (big ? ' big' : '') + (reveal ? ' reveal' : '')}
        viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${n} stories`} {...surface}
        onClick={() => { if (!drawing) { tooltipPole && setTooltipPole(null); tapLabel && setTapLabel(null); } }}>

        {/* Grid */}
        {[...Array(11)].map((_, i) => (
          <g key={'g' + i}>
            <line className="grid" x1={px(i - 5)} y1={M} x2={px(i - 5)} y2={H - M} />
            <line className="grid" x1={M} y1={py(i - 5)} x2={W - M} y2={py(i - 5)} />
          </g>
        ))}
        <rect className="frame" x={M} y={M} width={W - 2 * M} height={H - 2 * M} />
        <line className="axis" x1={px(0)} y1={M} x2={px(0)} y2={H - M} />
        <line className="axis" x1={M} y1={py(0)} x2={W - M} y2={py(0)} />

        {/* Quad corner names — desktop only; mobile shows them in the legend below */}
        {!isMobile && quads && (
          <>
            <text className="qlab" x={M + 12} y={H - M - 12} style={{ fontSize: fs(15) }}>{short(quads.ll, 30)}</text>
            <text className="qlab" x={W - M - 12} y={H - M - 12} textAnchor="end" style={{ fontSize: fs(15) }}>{short(quads.hl, 30)}</text>
            <text className="qlab" x={M + 12} y={M + 24} style={{ fontSize: fs(15) }}>{short(quads.lh, 30)}</text>
            <text className="qlab" x={W - M - 12} y={M + 24} textAnchor="end" style={{ fontSize: fs(15) }}>{short(quads.hh, 30)}</text>
          </>
        )}

        {/* Axis labels — desktop only; mobile shows them as HTML below */}
        {!isMobile && (
          <>
            {/* X axis — below frame */}
            <text className="pole" x={M} y={H - M + 24} style={{ fontSize: fs(13) }} {...poleProps('xlow', ax.low, ax.lowDesc)}>← {short(ax.low || '', 28)}</text>
            <text className="pole" x={W - M} y={H - M + 24} textAnchor="end" style={{ fontSize: fs(13) }} {...poleProps('xhigh', ax.high, ax.highDesc)}>{short(ax.high || '', 28)} →</text>
            <text className="axname" x={W / 2} y={H - 18} textAnchor="middle" style={{ fontSize: fs(13) }}>{ax.name || ''}</text>
            {/* Y axis — name top-left; poles left-aligned at the left edge of the plot */}
            <text className="axname" x={M} y={M - 26} style={{ fontSize: fs(13) }}>{ay.name || ''}</text>
            <text className="pole" x={M + 8} y={M + 42} textAnchor="start" style={{ fontSize: fs(13) }} {...poleProps('yhigh', ay.high, ay.highDesc)}>↑ {short(ay.high || '', 22)}</text>
            <text className="pole" x={M + 8} y={H - M - 25} textAnchor="start" style={{ fontSize: fs(13) }} {...poleProps('ylow', ay.low, ay.lowDesc)}>↓ {short(ay.low || '', 22)}</text>
          </>
        )}

        {/* Background dots */}
        {background.map((p) => <circle key={'bg' + p.id} className="bgdot" cx={px(p.x)} cy={py(p.y)} r={4} />)}

        {/* Past arrow ghosts */}
        {pastArrowEnds && (() => {
          const me = points.find((p) => p.id === youId);
          if (!me || me.x == null) return null;
          return pastArrowEnds.map((end, i) => (
            <Arrow key={'past' + i} id={'past' + i} from={me} to={end} color="#79998b" width={1.5} opacity={0.3} dash="6 4" />
          ));
        })()}

        {/* Other people's arrows */}
        {showArrows && points.filter((p) => p.arrow && p.x != null && p.id !== youId).map((p) => (
          <Arrow key={'a' + p.id} id={'a' + p.id} from={p} to={p.arrow} color="#afbeb1" width={2} opacity={0.45} />
        ))}

        {/* Your arrow */}
        {(() => {
          const me = points.find((p) => p.id === youId);
          if (!me || me.x == null) return null;
          const head = drawing && arrowFor === youId && draft ? draft : (showArrows ? me.arrow : null);
          return head ? <Arrow id="mine" from={me} to={head} color="#fffdf6" width={3.5} /> : null;
        })()}

        {/* Draft arrow while drawing (admin: other dot) */}
        {drawing && arrowFor !== youId && origin && draft && <Arrow id="draft" from={origin} to={draft} color="#fffdf6" width={3} />}

        {/* What-if arrow */}
        {whatIfFor && whatIfTo && (() => {
          const wif = points.find((p) => p.id === whatIfFor);
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
          const hollow = p.source === 'card-exercise';
          const testDot = !!p.isTest;
          const ld = labelMap.get(p.id) || { show: false, cx: px(x) };
          const lines = labelLines(p.label || '');
          const lx = ld.cx - px(x); // relative x offset for text (clamped)
          return (
            <g key={p.id} className={'dot' + (you ? ' you' : '') + (onMove ? ' drag' : '')}
              tabIndex={drawing ? -1 : 0} role="button"
              style={{ '--i': i }}
              aria-label={`${you ? 'Your story' : p.label}, ${fmt(p.x)} across, ${fmt(p.y)} up`}
              transform={`translate(${px(x)} ${py(y)})`}
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
                  <>
                    <circle r={22} className="halo" />
                    <circle r={13} fill="#a72f39" stroke="#fffdf6" strokeWidth={2.5} />
                  </>
                ) : testDot ? (
                  <Mark shape="circle" r={sel ? 10 : 8} fill="none" stroke="#a72f39" sw={sel ? 3 : 2} />
                ) : (
                  <>
                    {p.body != null && <circle r={sel ? 16 : 14} fill="none" stroke="#afbeb1" strokeWidth={1.5} opacity={0.45} />}
                    <Mark shape={shape(p.signal)} r={sel ? 10 : 8} fill={hollow ? 'none' : '#afbeb1'} stroke={sel ? '#fffdf6' : '#afbeb1'} sw={sel ? 3 : 2} />
                  </>
                )}
              </g>
              {ld.show && (
                <text className={'dlab' + (you ? ' me' : '')} textAnchor="middle" y={you ? 38 : 24} style={{ fontSize: fs(you ? 13 : 11) }}>
                  {you
                    ? <tspan x={lx} dy="0">You</tspan>
                    : testDot
                    ? <tspan x={lx} dy="0" style={{ fill: '#a72f39' }}>TEST</tspan>
                    : lines.map((ln, k) => <tspan key={k} x={lx} dy={k ? '1.15em' : '0'}>{ln}</tspan>)}
                </text>
              )}
            </g>
          );
        })}

        {/* Pole tooltip (desktop only) */}
        {!isMobile && tooltipPole && (() => {
          const TW = 240, TH = 80;
          const poles = {
            xlow:  ax.lowDesc  ? { label: ax.low,  desc: ax.lowDesc,  tx: M,      ty: H - M - 10 } : null,
            xhigh: ax.highDesc ? { label: ax.high, desc: ax.highDesc, tx: W - M,  ty: H - M - 10, end: true } : null,
            ylow:  ay.lowDesc  ? { label: ay.low,  desc: ay.lowDesc,  tx: M + 8,  ty: H - M - 25 } : null,
            yhigh: ay.highDesc ? { label: ay.high, desc: ay.highDesc, tx: M + 8,  ty: M + 42 } : null,
          };
          const tp = poles[tooltipPole];
          if (!tp) return null;
          const fx = tp.end ? Math.max(M, tp.tx - TW) : Math.min(W - M - TW, tp.tx);
          const fy = Math.max(M, tp.ty - TH - 8);
          return (
            <foreignObject x={fx} y={fy} width={TW} height={TH} style={{ overflow: 'visible' }}>
              <div style={{ background: '#1a2326', border: '1px solid #344245', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#b8cdc4', lineHeight: 1.45, pointerEvents: 'none' }}>
                <strong style={{ fontFamily: 'var(--labelf)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d4dfdc', display: 'block', marginBottom: 4 }}>{tp.label}</strong>
                {tp.desc}
              </div>
            </foreignObject>
          );
        })()}
      </svg>

      {/* ── Mobile axis labels + quad legend (below SVG) ── */}
      {isMobile && (
        <div className="map-mobile-labels">
          {ay.low && (
            <div className="map-y-low">
              {mPole('ylow', '↓', ay.low)}
            </div>
          )}
          <div className="map-x-row">
            {mPole('xlow', '←', ax.low)}
            {ax.name && <span className="map-axname-x">{ax.name}</span>}
            {mPole('xhigh', '', ax.high ? ax.high + ' →' : '', 'right')}
          </div>
          {quads && (
            <div className="map-quad-legend" role="list" aria-label="Quadrant names">
              <div role="listitem">↖ {short(quads.lh || '', 22)}</div>
              <div role="listitem" style={{ textAlign: 'right' }}>↗ {short(quads.hh || '', 22)}</div>
              <div role="listitem">↙ {short(quads.ll || '', 22)}</div>
              <div role="listitem" style={{ textAlign: 'right' }}>↘ {short(quads.hl || '', 22)}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
