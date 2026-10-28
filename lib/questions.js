// Shared question and direction logic used by Flow, Admin, and Presenter.
// questions() returns JSX arrays — call it in 'use client' components only.

export function questions(axes, me) {
  if (!me) return [];
  if (me.stays || !me.arrow) return [
    <>What has to stay true for you to remain where your dot is?</>,
    <>What could pull your dot away from here without you noticing?</>,
    <>Who is already living where you are, and what do they know that you don't?</>,
    <>What's one move you could make this week that would tell you staying here is right?</>,
  ];
  const dx = me.arrow.x - me.x, dy = me.arrow.y - me.y;
  const a = Math.abs(dx) >= Math.abs(dy) ? axes.x : axes.y;
  const from = (Math.abs(dx) >= Math.abs(dy) ? me.x : me.y) < 0 ? a.low : a.high;
  const to = (Math.abs(dx) >= Math.abs(dy) ? me.arrow.x : me.arrow.y) < 0 ? a.low : a.high;
  const P = from === to ? <>further toward <em>{to}</em></> : <>from <em>{from}</em> toward <em>{to}</em></>;
  return [
    <>What needs to happen first to move you {P}?</>,
    <>What must be true for that future to exist, for you, for the people around you, and for the wider world?</>,
    <>Where is that future already being built, or resisted?</>,
    <>What's the hardest part of getting there to believe?</>,
    <>What's one move you could make this week that would tell you if this direction is right?</>,
  ];
}

// Plain-text summary of a story's direction, e.g.:
// "Doing the craft + Mostly alone → toward Mostly with people"
// "Would stay here"   "No arrow yet"
export function directionLine(axes, dot) {
  if (!dot || dot.x == null) return '';
  if (dot.stays) return 'Would stay here';
  if (dot.ax == null || dot.ay == null) return 'No arrow yet';
  const xPole = dot.x < 0 ? axes.x.low : axes.x.high;
  const yPole = dot.y < 0 ? axes.y.low : axes.y.high;
  const dx = dot.ax - dot.x, dy = dot.ay - dot.y;
  const isX = Math.abs(dx) >= Math.abs(dy);
  const a = isX ? axes.x : axes.y;
  const dest = (isX ? dot.ax : dot.ay) < 0 ? a.low : a.high;
  const src = (isX ? dot.x : dot.y) < 0 ? a.low : a.high;
  const toward = src === dest ? `further toward ${dest}` : `toward ${dest}`;
  return `${xPole} + ${yPole} → ${toward}`;
}
