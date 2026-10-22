'use client';
import { useState } from 'react';
import StoryMap, { fmt, signalColors } from './StoryMap';

function Evidence({ axis, val, q, why }) {
  return (
    <div>
      <div><strong>{axis.name || 'Axis'}</strong> <span className="mono">{fmt(val)}</span></div>
      {why && <p className="why">{why}</p>}
      {q && <div className="ev"><q>{q}</q></div>}
    </div>
  );
}

/* Read-only map panel used on the public pages. */
export default function MapView({ map, youId, title = 'Where everyone landed', showQuotes = true }) {
  const [sel, setSel] = useState(null);
  if (!map || !map.axes) return <section className="panel"><p className="note">This map has no axes yet.</p></section>;
  const pts = map.points || [];
  const { tags, color } = signalColors(pts);
  const p = pts.find((x) => x.id === sel);
  return (
    <div className="stack">
      <section className="panel">
        <h2>{title} · {pts.length} {pts.length === 1 ? 'story' : 'stories'}</h2>
        <StoryMap axes={map.axes} quads={map.quads} points={pts} youId={youId} selId={sel} onSelect={setSel} />
        {tags.length > 0 && (
          <div className="legend">{tags.map((t) => <span key={t}><i className="sw" style={{ background: color(t) }} />{t}</span>)}</div>
        )}
      </section>
      {map.readout && <section className="panel"><h2>What the map shows</h2><p className="readout">{map.readout}</p></section>}
      {p && showQuotes && (p.xq || p.yq) && (
        <section className="panel stack">
          <h2>Why {p.id === youId ? 'your story' : p.label} sits here</h2>
          <Evidence axis={map.axes.x} val={p.x} q={p.xq} why={p.xw} />
          <Evidence axis={map.axes.y} val={p.y} q={p.yq} why={p.yw} />
        </section>
      )}
    </div>
  );
}
