'use client';
import { useRef, useState } from 'react';

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const W = 640, H = 640, M = 64;
const px = (x) => M + ((x + 5) / 10) * (W - 2 * M);
const py = (y) => H - M - ((y + 5) / 10) * (H - 2 * M);
const unpx = (v) => ((v - M) / (W - 2 * M)) * 10 - 5;
const unpy = (v) => ((H - M - v) / (H - 2 * M)) * 10 - 5;
const r1 = (v) => Math.max(-5, Math.min(5, Math.round(v * 10) / 10));
const short = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
/* Split label into 1–2 lines at the last space within maxChars */
function labelLines(label, maxChars = 13) {
  if (label.length <= maxChars) return [label];
  const sp = label.lastIndexOf(' ', maxChars);
  if (sp < 1) return [short(label, maxChars + 1)];
  return [label.slice(0, sp), label.slice(sp + 1)];
}
export const fmt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1);

export function signalColors(points) {
  const tags = [];
  points.forEach((p) => { if (p.signal && !tags.includes(p.signal)) tags.push(p.signal); });
  return { tags, color: (s) => COLORS[Math.max(0, tags.indexOf(s)) % COLORS.length] };
}

function initialOf(label) {
  if (/^Story \d+$/.test(label)) return label.slice(6);
  return (String(label || '?').trim().charAt(0) || '?').toUpperCase();
}

export default function StoryMap({ axes, quads, points, youId, selId, onSelect, onMove }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null); // {id,x,y,sx,sy,moved}
  const ax = (axes && axes.x) || {}, ay = (axes && axes.y) || {};
  const { color } = signalColors(points);

  function toXY(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: r1(unpx(p.x)), y: r1(unpy(p.y)) };
  }

  const n = points.length;
  return (
    <svg ref={svgRef} className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="2x2 map of stories">
      <rect className="ax" x={M} y={M} width={W - 2 * M} height={H - 2 * M} />
      <line className="axc" x1={px(0)} y1={M} x2={px(0)} y2={H - M} />
      <line className="axc" x1={M} y1={py(0)} x2={W - M} y2={py(0)} />
      {quads && (
        <>
          <text className="qlab" x={M + 10} y={H - M - 10}>{short(quads.ll, 30)}</text>
          <text className="qlab" x={W - M - 10} y={H - M - 10} textAnchor="end">{short(quads.hl, 30)}</text>
          <text className="qlab" x={M + 10} y={M + 22}>{short(quads.lh, 30)}</text>
          <text className="qlab" x={W - M - 10} y={M + 22} textAnchor="end">{short(quads.hh, 30)}</text>
        </>
      )}
      <text className="pole" x={M} y={H - M + 22}>← {short(ax.low || 'left pole', 32)}</text>
      <text className="pole" x={W - M} y={H - M + 22} textAnchor="end">{short(ax.high || 'right pole', 32)} →</text>
      <text className="pole" x={W / 2} y={H - 14} textAnchor="middle">{ax.name || ''}</text>
      <text className="pole" x={M - 18} y={H - M} transform={`rotate(-90 ${M - 18} ${H - M})`}>← {short(ay.low || 'bottom pole', 32)}</text>
      <text className="pole" x={M - 18} y={M} textAnchor="end" transform={`rotate(-90 ${M - 18} ${M})`}>{short(ay.high || 'top pole', 32)} →</text>
      <text className="pole" x={14} y={H / 2} textAnchor="middle" transform={`rotate(-90 14 ${H / 2})`}>{ay.name || ''}</text>
      {points.map((p, i) => {
        const scored = p.x != null && p.y != null;
        let x = scored ? p.x : Math.cos((i / Math.max(n, 1)) * Math.PI * 2) * 0.9;
        let y = scored ? p.y : Math.sin((i / Math.max(n, 1)) * Math.PI * 2) * 0.9;
        if (drag && drag.id === p.id && drag.moved) { x = drag.x; y = drag.y; }
        const you = youId && p.id === youId;
        const c = color(p.signal);
        const sel = selId === p.id || you;
        const cls = 'dot' + (onMove ? ' drag' : '') + (youId && !you ? ' other' : '');
        return (
          <g key={p.id} className={cls} tabIndex={0} role="button"
            aria-label={`${p.label}${scored ? `, ${fmt(p.x)} across, ${fmt(p.y)} up` : ', not placed yet'}`}
            transform={`translate(${px(x)} ${py(y)})`}
            onClick={() => { if (!(drag && drag.moved)) onSelect && onSelect(p.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect && onSelect(p.id); } }}
            onPointerDown={onMove ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: p.id, x, y, sx: e.clientX, sy: e.clientY, moved: false }); } : undefined}
            onPointerMove={onMove ? (e) => {
              if (!drag || drag.id !== p.id) return;
              if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
              setDrag({ ...drag, ...toXY(e), moved: true });
            } : undefined}
            onPointerUp={onMove ? () => {
              if (drag && drag.id === p.id && drag.moved) onMove(p.id, drag.x, drag.y);
              setTimeout(() => setDrag(null), 0);
            } : undefined}
            onPointerCancel={onMove ? () => setDrag(null) : undefined}
          >
            {you && <circle r={22} fill="none" stroke={c} strokeWidth={2} opacity={0.5} />}
            <circle r={you ? 17 : 15} fill={scored ? c : 'none'} stroke={c} strokeWidth={sel ? 4 : 2} strokeDasharray={scored ? undefined : '3 3'} />
            <text className="dtxt" textAnchor="middle" y={4} style={{ fill: scored ? 'var(--dot-ink)' : c }}>{you ? '★' : initialOf(p.label)}</text>
            {you ? (
              <text className="dlab" textAnchor="middle" y={36}>You</text>
            ) : (() => {
              const lines = labelLines(p.label);
              return lines.length === 1
                ? <text className="dlab" textAnchor="middle" y={32}>{lines[0]}</text>
                : <text className="dlab" textAnchor="middle"><tspan x={0} y={32}>{lines[0]}</tspan><tspan x={0} dy={13}>{lines[1]}</tspan></text>;
            })()}
          </g>
        );
      })}
    </svg>
  );
}
