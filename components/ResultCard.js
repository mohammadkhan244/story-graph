'use client';
import { normalizeQuads } from './StoryMap';

function getQuadrant(qn, x, y) {
  if (!qn) return null;
  if (x < 0 && y >= 0) return qn.tl;
  if (x >= 0 && y >= 0) return qn.tr;
  if (x < 0 && y < 0) return qn.bl;
  return qn.br;
}

/* Within 10% of the ±5 range = within 1.0 unit of 0 */
function nearAxisNote(axes, x, y) {
  const nx = Math.abs(x) < 1.0, ny = Math.abs(y) < 1.0;
  if (!nx && !ny) return null;
  const ax = axes.x, ay = axes.y;
  if (nx && ny) return `Your story sits close to the center of both axes.`;
  if (nx) return `Your story sits close to the line between ${ax.low} and ${ax.high}.`;
  return `Your story sits close to the line between ${ay.low} and ${ay.high}.`;
}

function AxisSlider({ axisName, low, high, value, arrowValue }) {
  const pct = (value + 5) / 10;
  const nearLow = value < 0;
  const absNorm = Math.abs(value / 5);
  const nearPole = nearLow ? low : high;

  let desc;
  if (absNorm < 0.05) desc = 'Right in the middle';
  else if (absNorm < 0.25) desc = `Leans slightly toward: ${nearPole}`;
  else if (absNorm < 0.60) desc = `Leans clearly toward: ${nearPole}`;
  else desc = `Leans strongly toward: ${nearPole}`;

  const fillLeft = `${Math.min(pct, 0.5) * 100}%`;
  const fillWidth = `${Math.abs(pct - 0.5) * 100}%`;
  const pinLeft = `${pct * 100}%`;
  const arrowPct = arrowValue != null ? `${((arrowValue + 5) / 10) * 100}%` : null;

  return (
    <div className="as-wrap">
      {axisName && <span className="kicker as-name">{axisName}</span>}
      <div className="as-poles">
        <span style={{ fontWeight: nearLow ? 700 : 400, color: nearLow ? 'var(--paper)' : 'var(--muted)' }}>{low}</span>
        <span style={{ fontWeight: !nearLow ? 700 : 400, color: !nearLow ? 'var(--paper)' : 'var(--muted)' }}>{high}</span>
      </div>
      <div className="as-track">
        <div className="as-fill" style={{ left: fillLeft, width: fillWidth }} />
        <div className="as-pin" style={{ left: pinLeft }} />
        {arrowPct && <div className="as-ring" style={{ left: arrowPct }} />}
      </div>
      <p className="note as-desc">{desc}</p>
    </div>
  );
}

export default function ResultCard({ axes, quadrants, quads, x, y, arrow, kicker = 'YOUR STORY LANDED IN' }) {
  if (!axes || x == null || y == null) return null;

  const qn = normalizeQuads(quadrants, quads);
  const quad = qn ? getQuadrant(qn, x, y) : null;

  const nearNote = nearAxisNote(axes, x, y);
  const hasArrow = !!(arrow && arrow.x != null);

  return (
    <div className="result-card">
      <span className="kicker rc-kicker">{kicker}</span>
      {quad?.name && <h3 className="rc-name">{quad.name}</h3>}
      {quad?.meaning && <p className="rc-meaning">{quad.meaning}</p>}
      {nearNote && <p className="note rc-note">{nearNote}</p>}

      <div className="rc-sliders">
        <AxisSlider
          axisName={axes.x.name}
          low={axes.x.low}
          high={axes.x.high}
          value={x}
          arrowValue={hasArrow ? arrow.x : null}
        />
        <AxisSlider
          axisName={axes.y.name}
          low={axes.y.low}
          high={axes.y.high}
          value={y}
          arrowValue={hasArrow ? arrow.y : null}
        />
      </div>

      {hasArrow && (
        <div className="rc-legend">
          <span><span className="rc-dot-ruby">●</span> Where your story landed</span>
          <span><span className="rc-dot-ring">◌</span> Where you'd rather be</span>
        </div>
      )}
    </div>
  );
}
