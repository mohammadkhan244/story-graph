'use client';
import { useRef, useState } from 'react';
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
  const [draft, setDraft] = useState(null); // live arrow head while drawing
  const ax = (axes && axes.x) || {}, ay = (axes && axes.y) || {};
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

  const n = points.length;
  const ordered = [...points].sort((a, b) => (a.id === youId) - (b.id === youId));
  return (
    <svg ref={svgRef} className={'map' + (drawing ? ' drawing' : '') + (big ? ' big' : '') + (reveal ? ' reveal' : '')}
      viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${n} stories`} {...surface}>
      {[...Array(11)].map((_, i) => (
        <g key={'g' + i}>
          <line className="grid" x1={px(i - 5)} y1={M} x2={px(i - 5)} y2={H - M} />
          <line className="grid" x1={M} y1={py(i - 5)} x2={W - M} y2={py(i - 5)} />
        </g>
      ))}
      <rect className="frame" x={M} y={M} width={W - 2 * M} height={H - 2 * M} />
      <line className="axis" x1={px(0)} y1={M} x2={px(0)} y2={H - M} />
      <line className="axis" x1={M} y1={py(0)} x2={W - M} y2={py(0)} />
      {quads && (
        <>
          <text className="qlab" x={M + 12} y={H - M - 12}>{short(quads.ll, 30)}</text>
          <text className="qlab" x={W - M - 12} y={H - M - 12} textAnchor="end">{short(quads.hl, 30)}</text>
          <text className="qlab" x={M + 12} y={M + 24}>{short(quads.lh, 30)}</text>
          <text className="qlab" x={W - M - 12} y={M + 24} textAnchor="end">{short(quads.hh, 30)}</text>
        </>
      )}
      <text className="pole" x={M} y={H - M + 24}>← {short(ax.low || '', 30)}{ax.lowDesc && <title>{ax.low}: {ax.lowDesc}</title>}</text>
      <text className="pole" x={W - M} y={H - M + 24} textAnchor="end">{short(ax.high || '', 30)} →{ax.highDesc && <title>{ax.high}: {ax.highDesc}</title>}</text>
      <text className="axname" x={W / 2} y={H - 18} textAnchor="middle">{ax.name || ''}</text>
      <text className="pole" x={M - 22} y={H - M} transform={`rotate(-90 ${M - 22} ${H - M})`}>← {short(ay.low || '', 30)}{ay.lowDesc && <title>{ay.low}: {ay.lowDesc}</title>}</text>
      <text className="pole" x={M - 22} y={M} textAnchor="end" transform={`rotate(-90 ${M - 22} ${M})`}>{short(ay.high || '', 30)} →{ay.highDesc && <title>{ay.high}: {ay.highDesc}</title>}</text>
      <text className="axname" x={20} y={H / 2} textAnchor="middle" transform={`rotate(-90 20 ${H / 2})`}>{ay.name || ''}</text>

      {background.map((p) => <circle key={'bg' + p.id} className="bgdot" cx={px(p.x)} cy={py(p.y)} r={4} />)}

      {pastArrowEnds && (() => {
        const me = points.find((p) => p.id === youId);
        if (!me || me.x == null) return null;
        return pastArrowEnds.map((end, i) => (
          <Arrow key={'past' + i} id={'past' + i} from={me} to={end} color="#79998b" width={1.5} opacity={0.3} dash="6 4" />
        ));
      })()}

      {showArrows && points.filter((p) => p.arrow && p.x != null && p.id !== youId).map((p) => (
        <Arrow key={'a' + p.id} id={'a' + p.id} from={p} to={p.arrow} color="#afbeb1" width={2} opacity={0.45} />
      ))}
      {(() => {
        const me = points.find((p) => p.id === youId);
        if (!me || me.x == null) return null;
        const head = drawing && arrowFor === youId && draft ? draft : (showArrows ? me.arrow : null);
        return head ? <Arrow id="mine" from={me} to={head} color="#fffdf6" width={3.5} /> : null;
      })()}
      {drawing && arrowFor !== youId && origin && draft && <Arrow id="draft" from={origin} to={draft} color="#fffdf6" width={3} />}

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

      {ordered.map((p, i) => {
        const scored = p.x != null && p.y != null;
        if (!scored) return null;
        let x = p.x, y = p.y;
        if (drag && drag.id === p.id && drag.moved) { x = drag.x; y = drag.y; }
        const you = youId && p.id === youId;
        const sel = selId === p.id;
        const hollow = p.source === 'card-exercise';
        const lines = labelLines(p.label || '');
        return (
          <g key={p.id} className={'dot' + (you ? ' you' : '') + (onMove ? ' drag' : '')} tabIndex={drawing ? -1 : 0} role="button"
            style={{ '--i': i }}
            aria-label={`${you ? 'Your story' : p.label}, ${fmt(p.x)} across, ${fmt(p.y)} up`}
            transform={`translate(${px(x)} ${py(y)})`}
            onClick={(e) => { if (drawing) return; e.stopPropagation(); if (!(drag && drag.moved)) onSelect && onSelect(p.id); }}
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
              ) : (
                <Mark shape={shape(p.signal)} r={sel ? 10 : 8} fill={hollow ? 'none' : '#afbeb1'} stroke={sel ? '#fffdf6' : '#afbeb1'} sw={sel ? 3 : 2} />
              )}
            </g>
            {(showLabels || you || sel) && (
              <text className={'dlab' + (you ? ' me' : '')} textAnchor="middle" y={you ? 38 : 24}>
                {you ? <tspan x="0" dy="0">You</tspan> : lines.map((ln, k) => <tspan key={k} x="0" dy={k ? '1.15em' : '0'}>{ln}</tspan>)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
