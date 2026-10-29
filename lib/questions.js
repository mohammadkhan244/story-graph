// Shared question and direction logic used by Flow, Admin, and Presenter.
// questions() returns JSX arrays — call it in 'use client' components only.
// questionStrings() and fallbackStrings() return plain strings — safe server-side.

// stay  — no arrow (or explicitly stayed)
// deepen  — arrow ends in the same quadrant AND farther from center
// pullback — arrow ends in the same quadrant AND closer to center
// cross   — arrow ends in a different quadrant
export function classifyArrow(dot, arrow) {
  if (!arrow || dot.x == null || dot.y == null) return 'stay';
  const dotQx = dot.x < 0 ? -1 : 1, dotQy = dot.y < 0 ? -1 : 1;
  const arrQx = arrow.x < 0 ? -1 : 1, arrQy = arrow.y < 0 ? -1 : 1;
  if (dotQx !== arrQx || dotQy !== arrQy) return 'cross';
  return Math.hypot(arrow.x, arrow.y) >= Math.hypot(dot.x, dot.y) ? 'deepen' : 'pullback';
}

export function questions(axes, me) {
  if (!me) return [];

  if (me.stays || !me.arrow) return [
    <>What did you write in your story as a fact that might actually be a wish?</>,
    <>What has to stay true for you to remain where your dot is?</>,
    <>What could pull you away from here without you noticing?</>,
    <>Who is already living where you are, and what do they know that you don't?</>,
    <>What is one move you could make this week that would tell you staying here is still right?</>,
  ];

  const type = classifyArrow({ x: me.x, y: me.y }, me.arrow);

  if (type === 'deepen') return [
    <>What did you write as a certainty in your story that might be the thing you most want to believe?</>,
    <>What would it cost you to go further in this direction than you have already planned?</>,
    <>What are you still holding back from this direction, and what would actually happen if you stopped?</>,
    <>What does full commitment to this direction look like on a completely ordinary day?</>,
    <>What would be the sign, if you saw it, that you had gone too far?</>,
    <>What is one move you could make this week that would test whether you are ready to go further?</>,
  ];

  if (type === 'pullback') return [
    <>What did you leave out of your story that you almost put in?</>,
    <>What about the direction you drew feels like too much — the distance, the destination, or both?</>,
    <>If you eased off, what from where you already are would you want to keep?</>,
    <>What would pulling back cost you, in the near term and over time?</>,
  ];

  // cross
  const dx = me.arrow.x - me.x, dy = me.arrow.y - me.y;
  const a = Math.abs(dx) >= Math.abs(dy) ? axes.x : axes.y;
  const from = (Math.abs(dx) >= Math.abs(dy) ? me.x : me.y) < 0 ? a.low : a.high;
  const to = (Math.abs(dx) >= Math.abs(dy) ? me.arrow.x : me.arrow.y) < 0 ? a.low : a.high;
  const P = from === to ? <>further toward <em>{to}</em></> : <>from <em>{from}</em> toward <em>{to}</em></>;
  return [
    <>What did you write as a fact in your story that might actually be a wish?</>,
    <>What needs to happen first to move you {P}?</>,
    <>What must be true for that future to exist — for you, for the people around you, and for the wider world?</>,
    <>Where is that future already being built somewhere, or actively resisted?</>,
    <>What is one move you could make this week that would tell you if this direction is right?</>,
  ];
}

// Plain-text version of questions() for server-side use (API fallback).
export function questionStrings(axes, me) {
  if (!me) return [];

  if (me.stays || !me.arrow) return [
    "What did you write in your story as a fact that might actually be a wish?",
    "What has to stay true for you to remain where your dot is?",
    "What could pull you away from here without you noticing?",
    "Who is already living where you are, and what do they know that you don't?",
    "What is one move you could make this week that would tell you staying here is still right?",
  ];

  const type = classifyArrow({ x: me.x, y: me.y }, me.arrow);

  if (type === 'deepen') return [
    "What did you write as a certainty in your story that might be the thing you most want to believe?",
    "What would it cost you to go further in this direction than you have already planned?",
    "What are you still holding back from this direction, and what would actually happen if you stopped?",
    "What does full commitment to this direction look like on a completely ordinary day?",
    "What would be the sign, if you saw it, that you had gone too far?",
    "What is one move you could make this week that would test whether you are ready to go further?",
  ];

  if (type === 'pullback') return [
    "What did you leave out of your story that you almost put in?",
    "What about the direction you drew feels like too much — the distance, the destination, or both?",
    "If you eased off, what from where you already are would you want to keep?",
    "What would pulling back cost you, in the near term and over time?",
  ];

  // cross
  const dx = me.arrow.x - me.x, dy = me.arrow.y - me.y;
  const a = Math.abs(dx) >= Math.abs(dy) ? axes.x : axes.y;
  const from = (Math.abs(dx) >= Math.abs(dy) ? me.x : me.y) < 0 ? a.low : a.high;
  const to = (Math.abs(dx) >= Math.abs(dy) ? me.arrow.x : me.arrow.y) < 0 ? a.low : a.high;
  const P = from === to ? `further toward ${to}` : `from ${from} toward ${to}`;
  return [
    "What did you write as a fact in your story that might actually be a wish?",
    `What needs to happen first to move you ${P}?`,
    "What must be true for that future to exist — for you, for the people around you, and for the wider world?",
    "Where is that future already being built somewhere, or actively resisted?",
    "What is one move you could make this week that would tell you if this direction is right?",
  ];
}

// Fallback for when the API call fails.
// For cross arrows: substitutes pole-specific DIRECTION_BANK questions into Q3+Q4.
// For other types: returns questionStrings as-is.
export function fallbackStrings(axes, me) {
  const qs = questionStrings(axes, me);
  if (!me || me.stays || !me.arrow) return qs;
  const type = classifyArrow({ x: me.x, y: me.y }, me.arrow);
  if (type !== 'cross' || qs.length < 5) return qs;
  const dx = me.arrow.x - me.x, dy = me.arrow.y - me.y;
  const isX = Math.abs(dx) >= Math.abs(dy);
  const a = isX ? axes.x : axes.y;
  const dest = (isX ? me.arrow.x : me.arrow.y) < 0 ? a.low : a.high;
  const bank = DIRECTION_BANK[dest];
  if (!bank || bank.length < 2) return qs;
  return [qs[0], qs[1], bank[0], bank[1], qs[4]];
}

// Plain-text summary of a story's direction, e.g.:
// "Doing the craft + Mostly alone -> toward Mostly with people"
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

// Pre-written pole-specific questions used as fallback Q3+Q4 for cross arrows when Claude is unavailable.
// Keys are the exact pole strings from the seeded axes.
export const DIRECTION_BANK = {
  "It's done to me": [
    "Where in your world has following someone else's lead actually produced better results than your own direction would have?",
    "What version of yourself could trust the system enough to stop fighting it, and what would that cost?",
  ],
  "I'm steering it": [
    "Who in your world has taken the wheel on something this size, and what had to break down before they got the authority to do it?",
    "What are you still waiting for permission to do that nobody is actually withholding?",
  ],
  "Others decided": [
    "Where in your life have you discovered that you were fine with a decision you did not make, and what made it possible to trust the outcome?",
    "What would letting someone else make the call here free you to focus on instead?",
  ],
  "I had a say": [
    "Who in your world has built real influence without formal authority, and what did they have to do consistently to earn it?",
    "What is the decision that keeps happening above you that you actually know more about than the person making it?",
  ],
  "Stick to what's proven": [
    "Where in your work has reliability bought you something that novelty never could, and who noticed?",
    "What is the version of doing this the same way that would still feel like genuine skill rather than habit?",
  ],
  "Bet on the new idea": [
    "Who in your field has backed the unproven thing and come out right, and what were they willing to lose when they made the call?",
    "What is the smallest version of the new approach you could run without anyone needing to approve it?",
  ],
  "Verified at every step": [
    "Where in your life has being legible to a system actually protected you rather than constrained you?",
    "What is the trade you make when you choose to be known, and does the protection you get equal the exposure you give up?",
  ],
  "Free to be unknown": [
    "What would you do differently if nothing you did attached to your name, and does that answer tell you something about what is stopping you now?",
    "Who in your world has chosen to be harder to track, and what kind of freedom did that actually create for them?",
  ],
  "Prove every step": [
    "What is the part of your process you would be most reluctant to show, and is that hesitation telling you something useful?",
    "Who in your world actually trusts the documentation more than the person doing the work, and what broke their trust in the first place?",
  ],
  "Trusted on results": [
    "Who in your world has earned the kind of trust where nobody asks how they got there, and what did they have to deliver to reach that point?",
    "What would you have to stop explaining if results were the only thing that counted?",
  ],
  "Stays at the top": [
    "Where have you seen concentrated authority actually serve the work rather than protect the people who hold it?",
    "What is the decision that genuinely needs to stay near the top because only someone there can see the whole picture?",
  ],
  "Spread across everyone": [
    "Where in your world is decision-making already distributed, not as an experiment but as a real practice, and what holds it together?",
    "What would have to be true about accountability for authority to reach the people closest to the work without everything falling apart?",
  ],
  "Narrow specialist": [
    "Who in your field has gone narrower rather than broader and found more rather than less demand for it, and what did they give up to get there?",
    "What is the thing you know more deeply than almost anyone around you that you have stopped treating as valuable because it feels ordinary to you now?",
  ],
  "Broad generalist": [
    "Where in your world is breadth actually rewarded in practice, not just talked about, and what does it look like to be that person?",
    "What do you gain access to by being useful across many things that you could not get by being known for one?",
  ],
  "To prove compliance": [
    "Where in your world has a formal credential or logged hour actually opened a door that nothing else would have opened?",
    "What would it mean to meet the requirements in a way that also served what you actually care about, rather than treating them as entirely separate?",
  ],
  "Out of curiosity": [
    "What is the thing you have been learning on your own that nobody has asked you to learn and that you have not yet figured out how to make useful?",
    "Who in your world learns openly and without needing it to count, and how do they protect that time against everything else that wants to fill it?",
  ],
  "Efficient, scored networking": [
    "When has a connection you optimized for outcome actually delivered, and what did you notice about the other person's experience of it?",
    "What is the clearest version of what you are trying to get from the people you connect with, and are you willing to say it out loud?",
  ],
  "Authentic relationships": [
    "Who in your professional world maintains genuine connections without the calculation, and what have they given up to keep those relationships uncomplicated?",
    "What is the relationship you already have that has nothing to do with what the other person can do for you, and what does it tell you about what you actually want?",
  ],
  "Same path, further along": [
    "Who in your world chose to go further down the same road rather than turn, and what does their story look like ten years later?",
    "What would it mean to become the best version of what you already are, and what is standing between you and that version right now?",
  ],
  "A different path entirely": [
    "Who in your world has made the turn, not talked about it but actually made it, and what were they willing to lose when they did?",
    "What is the version of yourself you have already half-let-go of that you have not yet admitted you have let go of?",
  ],
  "Same business, bigger": [
    "Where in your industry are the businesses that scaled what they already did rather than transforming it, and what made that work or fail for them?",
    "What would have to stay exactly the same for this to feel like growth rather than just more of the same weight?",
  ],
  "A different business entirely": [
    "Who in your market has transformed the model rather than scaled it, and what did they have in place before the change that made the change survivable?",
    "What is the part of your current business that you have been quietly building a case against for longer than you want to admit?",
  ],
  "Growth runs us": [
    "Where in your organization are the cracks that the growth exposed, not to fix them now but to understand what they were covering up before?",
    "What would it cost you to say out loud, to yourself and to the people depending on you, that the current pace is not sustainable?",
  ],
  "We run the growth": [
    "Who in your world has actually absorbed a surge like this cleanly, and what did they have in place before it arrived that you did not?",
    "What is the thing you handled best in this stretch that you are not sure will survive the next wave if you do not make it structural?",
  ],
  "We're locked in": [
    "Where in your history has a commitment that felt like a trap eventually created the constraint that produced your best work?",
    "What would change about how you operate if you stopped treating the lock-in as a mistake and started treating it as the conditions you are working in?",
  ],
  "We can change course": [
    "Who in your field stays genuinely flexible rather than just describing themselves as flexible, and what does that cost them in terms of momentum?",
    "What is the thing you are keeping options open on that might be costing you more than just making the call and moving forward?",
  ],
  "People work around it": [
    "Who in your organization resists the automation most consistently, and what are they actually protecting when they do?",
    "What would it take to create the conditions where the people avoiding the system would tell you the real reason?",
  ],
  "People rely on it": [
    "Who in your team adopted the automation earliest and most completely, and what did they see in it that the others did not?",
    "What is the work that used to matter that nobody does anymore, and have you actually made peace with that or just stopped mentioning it?",
  ],
  "We bent to fit the system": [
    "Where in your organization are the people who adapted to the new system fastest, and what did they give up to get there?",
    "What is the thing you used to do before the new system that the system cannot do, and have you stopped missing it or just stopped admitting you miss it?",
  ],
  "The system fits how we work": [
    "Where in your world has a system actually been built around the people using it rather than the other way around, and what made that possible?",
    "What would have to be true about decision-making, timing, and resources for something like that to have been achievable here?",
  ],
  "The world around me": [
    "Where in your life have you had something stuck resolve because of circumstances rather than your own action, and what did you notice about how that felt?",
    "What would it mean to you if this resolved without your having to change, and is that actually what you want or just what is easier to want?",
  ],
  "Me": [
    "Who in your world has changed how they see something stuck rather than waiting for it to move, and what shifted first, the way they saw it or the way they acted?",
    "What is the version of yourself that would have to be wrong for this to resolve from the inside, and how long have you been defending that version?",
  ],
  "It happened to me": [
    "Where in your life do things actually get resolved by events rather than by your choices, and is that as bad as the story about it sounds?",
    "What would it mean to you if the resolution came without your steering it, would it still count as yours, and does your answer to that tell you something?",
  ],
  "I steered it": [
    "Who in your world has moved something stuck by choosing rather than waiting, and what was the thing they had to decide before they could decide anything else?",
    "What is the version of this that you already know how to steer but have not yet started steering, and what are you waiting for?",
  ],
  "AI does it, we check it": [
    "Where in your work has AI taking the lead actually freed you to focus on the parts that matter most to you, and where has it not?",
    "What is the thing you have handed to AI that you are no longer sure you could do yourself if you needed to?",
  ],
  "We do it, AI helps": [
    "Who in your field has drawn this line clearly, keeping human judgment as the primary driver, and what do they gain and what do they give up by holding it?",
    "What is the part of the process you could give to AI but have chosen not to, and is that about quality or about something else?",
  ],
  "Close to where I started": [
    "Who in your world has taken a leap and landed not far from where they began, and has that turned out to be a bad thing or just a different kind of thing?",
    "What would it mean to you if the distance turned out to be smaller than the leap felt, would that be a failure or just a more honest measure of where you actually were?",
  ],
  "Somewhere new": [
    "Who in your world is already in a place genuinely different from where they started, and what did the journey look like from the outside during the hard part?",
    "What is the thing you are most afraid would not survive the genuine newness, and is that fear protecting you or protecting the version of you that does not have to change?",
  ],
  "Others decide": [
    "Where in your life have you flourished most while following a direction you did not choose, and what made it possible to do good work inside someone else's call?",
    "What is the story you tell about your own agency that this direction would complicate, and is that story still serving you?",
  ],
  "I decide": [
    "Who in your world has claimed the decision and owned the consequences rather than deferring, and what does their situation look like now that the dust has settled?",
    "What are you still waiting for before you treat this decision as genuinely yours, and is anyone actually withholding it?",
  ],
  "Doing the craft": [
    "Who in your world stayed in the craft rather than moving to running things, and what do they have that the people who moved away gave up?",
    "What is the thing about doing the work directly that you have not been able to explain to the people who manage from a distance?",
  ],
  "Running the machine": [
    "Who in your world made the shift from doing to running and has no regret about it, and what did they give themselves permission to care about differently?",
    "What is the craft work you still want to do that the running of things keeps pushing out, and is that a cost you have actually made peace with?",
  ],
  "Mostly alone": [
    "Who in your world protects deep solo time as a real strategic choice rather than a default, and how do they hold it against the pull of collaboration?",
    "What is the work you only know how to do alone, and what does that tell you about what the presence of others actually costs you?",
  ],
  "Mostly with people": [
    "Who in your world has built a work life that is genuinely sustained by other people rather than depleted by them, and what do they do differently?",
    "What is the thing you can only find out by being in the room with people, and are you getting enough of that or have you been letting it slide?",
  ],
};
