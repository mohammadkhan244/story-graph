/* v2: interactive flow. Adds the four decision prompts and "Something you keep circling",
   and (once) rewrites every open prompt's instructions to the neutral Sensemakers rules,
   with the EWS anchor line. Axes for career/business change only if they have no stories yet. */

export const RULES =
  "Start with a specific morning. Where are you? What do you see first?\n" +
  "Write whatever shows up. Don't plan it. Don't make it realistic. Don't make it good or bad.\n" +
  "If you catch yourself explaining (\"I think AI will…\"), go back to the scene. What are you doing right now?";

const WHO = {
  name: 'Who decided', low: 'Others decided', high: 'I had a say',
  lowDesc: "The call was made without your input. Someone above you, or the situation itself, determined the direction.",
  highDesc: "Your view shaped the outcome. You had real input into how this unfolded.",
};

export const NEW_PROMPTS = [
  {
    id: 'handle-more-demand', slug: 'handle-more-demand', title: 'Handle more demand', year: null, sort: 1,
    big_question: 'What happens when twice as many people need what you make?',
    ask: { label: "What's growing?", placeholder: 'orders, users, support tickets…', lead: "It's a year after {x} doubled." },
    axes: { x: { name: 'How the growth went', low: 'Growth runs us', high: 'We run the growth', lowDesc: "The demand took over. You're stretched, reactive, and the system is straining.", highDesc: "You absorbed the growth. The team, the tools, or the process scaled cleanly." }, y: WHO },
  },
  {
    id: 'build-or-buy', slug: 'build-or-buy', title: 'Build or buy a tool', year: null, sort: 2,
    big_question: 'You needed a tool. You either built it or bought it.',
    ask: { label: 'What tool?', placeholder: 'an internal scheduling tool…', lead: "It's a year after you chose whether to build or buy {x}." },
    axes: { x: { name: 'Where it left you', low: "We're locked in", high: 'We can change course', lowDesc: "The choice committed you. Switching now would be expensive or disruptive.", highDesc: "The choice kept your options open. You could still go a different way if needed." }, y: WHO },
  },
  {
    id: 'automate-a-process', slug: 'automate-a-process', title: 'Automate a process', year: null, sort: 3,
    big_question: 'A process that people did by hand now runs on its own.',
    ask: { label: 'What process?', placeholder: 'invoice approvals…', lead: "It's a year after you automated {x}." },
    axes: { x: { name: 'How people live with it', low: 'People work around it', high: 'People rely on it', lowDesc: "The automation created friction. People found ways to avoid it.", highDesc: "The automation fit. People adopted it and built on it." }, y: WHO },
  },
  {
    id: 'replace-a-system', slug: 'replace-a-system', title: 'Replace a system', year: null, sort: 4,
    big_question: 'The old system is gone. Something new runs in its place.',
    ask: { label: 'What system?', placeholder: 'our spreadsheet scheduling…', lead: "It's a year after you replaced {x}." },
    axes: { x: { name: 'How it turned out', low: 'We bent to fit the system', high: 'The system fits how we work', lowDesc: "You adapted to the new system. Your workflows changed to match what it could do.", highDesc: "The system adapted to you. It fit the way you already work." }, y: WHO },
  },
  {
    id: 'keep-circling', slug: 'keep-circling', title: 'Something you keep circling', year: null, sort: 7,
    big_question: 'A decision that won’t resolve. An idea that won’t leave.',
    ask: { label: 'What do you keep coming back to?', placeholder: 'the thing that keeps taking up space…', lead: "It's five years from now. What you kept circling ({x}) has resolved." },
    axes: {
      x: { name: 'What changed', low: 'The world around me', high: 'Me', lowDesc: "The circumstances shifted and the thing resolved. You didn't have to change.", highDesc: "You changed. The way you see it, want it, or approach it shifted from the inside." },
      y: { name: "Who's steering", low: 'It happened to me', high: 'I steered it', lowDesc: "The resolution came from outside. Events, other people, or time made the call.", highDesc: "You made it happen. You chose, acted, or accepted, and the thing moved." },
    },
  },
  {
    id: 'bring-in-ai', slug: 'bring-in-ai', title: 'Bring AI into our work', year: null, sort: 15,
    big_question: 'Everyone is asking whether to bring AI into the team’s work.',
    ask: { label: 'What work would AI take on?', placeholder: 'our support inbox, code reviews…', lead: "It's a year after AI took on {x}." },
    axes: { x: { name: 'How the work changed', low: 'AI does it, we check it', high: 'We do it, AI helps', lowDesc: "AI runs the process. Your role is to review, catch errors, and flag edge cases.", highDesc: "You run the process. AI handles the parts that would slow you down." }, y: WHO },
  },
  {
    id: 'take-the-leap', slug: 'take-the-leap', title: 'Take the leap', year: null, sort: 16,
    big_question: 'A big move keeps calling.',
    ask: { label: 'What leap?', placeholder: 'leaving my job to start something…', lead: "It's two years after you decided about {x}." },
    axes: {
      x: { name: 'Where it took you', low: 'Close to where I started', high: 'Somewhere new', lowDesc: "The leap didn't move you far from where you began. The change was smaller than it felt.", highDesc: "The leap moved you. You ended up somewhere genuinely different from where you started." },
      y: { name: "Who's steering", low: 'Others decide', high: 'I decide', lowDesc: "The direction came from circumstances, other people, or momentum you couldn't control.", highDesc: "You chose the direction. The path was yours to own." },
    },
  },
];

/* Scene lead line for prompts that don't ask a question first. */
const SCENES = {
  'your-career': "It's a Tuesday, ten years from now. You're getting ready for work.",
  'your-business': "It's a Tuesday, ten years from now. You walk into your business.",
};
const SORTS = {
  'your-career': 5, 'your-business': 6, 'professional-learning': 8,
  'innovation-vs-efficiency': 9, 'hierarchy-vs-democratization': 10, 'specialist-vs-generalist': 11,
  'relationships-and-advancement': 12, 'anonymity-vs-authentication': 13, 'proof-of-work': 14,
};
const CRAFT_AXES = {
  x: { name: 'Where my day goes', low: 'Doing the craft', high: 'Running the machine', lowDesc: "You do the hands-on work yourself. Most of your day is making, writing, or building.", highDesc: "You manage the people and systems that do the work. Most of your day is decisions and coordination." },
  y: { name: 'Who I spend it with', low: 'Mostly alone', high: 'Mostly with people', lowDesc: "Most of your day is solo. You work independently, with minimal interruption.", highDesc: "Most of your day is with others. Clients, a team, or partners fill most of your time." },
};

export async function seedV2(p) {
  await p.query(`create table if not exists meta (key text primary key, at timestamptz not null default now())`);

  for (const pr of NEW_PROMPTS) {
    await p.query(
      `insert into sessions (id,title,prompt,signals,minutes,is_default,status,axes,published,label_mode,
         kind,slug,big_question,instructions,year,sort,ask)
       values ($1,$2,$3,'[]',10,false,'open',$4,true,'names','open',$5,$6,$7,$8,$9,$10)
       on conflict (id) do nothing`,
      [pr.id, pr.title, pr.big_question, JSON.stringify(pr.axes), pr.slug, pr.big_question, RULES, pr.year, pr.sort, JSON.stringify(pr.ask)]
    );
  }

  const done = await p.query(`select 1 from meta where key='v2-interactive'`);
  if (done.rows.length) return;
  await p.query(`update sessions set instructions=$1 where kind='open' and slug is not null`, [RULES]);
  for (const [slug, scene] of Object.entries(SCENES)) {
    await p.query(`update sessions set scene=$2 where slug=$1`, [slug, scene]);
  }
  for (const [slug, sort] of Object.entries(SORTS)) {
    await p.query(`update sessions set sort=$2 where slug=$1`, [slug, sort]);
  }
  await p.query(
    `update sessions s set axes=$1 where s.slug in ('your-career','your-business')
       and not exists (select 1 from stories t where t.session_id=s.id)`,
    [JSON.stringify(CRAFT_AXES)]
  );
  await p.query(`insert into meta (key) values ('v2-interactive') on conflict do nothing`);

  /* v3: add lowDesc/highDesc to axes by matching current pole text (covers prompts + live sessions).
     Uses jsonb merge so name/low/high/why are never touched. */
  const doneV3 = await p.query(`select 1 from meta where key='v3-axis-desc'`);
  if (!doneV3.rows.length) {
    const xDescs = [
      { low: "Stick to what's proven", high: 'Bet on the new idea', lowDesc: "You default to tested approaches. Better to deliver something reliable than chase the next thing.", highDesc: "You back the unproven approach. Better to learn something new than repeat the known." },
      { low: 'Verified at every step', high: 'Free to be unknown', lowDesc: "Your identity is confirmed continuously. Every system knows exactly who you are.", highDesc: "You move without a persistent trace. You choose what gets attached to your name." },
      { low: 'Prove every step', high: 'Trusted on results', lowDesc: "Your process earns trust. You document and show your work at every stage.", highDesc: "Your output earns trust. How you got there is your own business." },
      { low: 'Stays at the top', high: 'Spread across everyone', lowDesc: "Authority concentrates in a few roles. Decisions flow down from the top.", highDesc: "Authority goes to whoever is closest to the problem. Decisions are made where the work is." },
      { low: 'Narrow specialist', high: 'Broad generalist', lowDesc: "You're known for one thing done deeply. Depth is your currency.", highDesc: "You're useful across many things. Breadth is your currency." },
      { low: 'To prove compliance', high: 'Out of curiosity', lowDesc: "Learning is something you demonstrate. A credential, a logged hour.", highDesc: "Learning is something you pursue. You follow what interests you, not what gets recorded." },
      { low: 'Efficient, scored networking', high: 'Authentic relationships', lowDesc: "Connections are optimized. You build the relationships most likely to produce outcomes.", highDesc: "Connections are genuine. You build them regardless of payoff." },
      { low: 'Same path, further along', high: 'A different path entirely', lowDesc: "You're doing what you've always done, just further along the same road.", highDesc: "You took a turn. The work, the context, or the identity shifted substantially." },
      { low: 'Same business, bigger', high: 'A different business entirely', lowDesc: "The core is the same. You scaled or refined it but the fundamental offer didn't change.", highDesc: "The business transformed. The model, the market, or the offering shifted substantially." },
      { low: 'Growth runs us', high: 'We run the growth', lowDesc: "The demand took over. You're stretched, reactive, and the system is straining.", highDesc: "You absorbed the growth. The team, the tools, or the process scaled cleanly." },
      { low: "We're locked in", high: 'We can change course', lowDesc: "The choice committed you. Switching now would be expensive or disruptive.", highDesc: "The choice kept your options open. You could still go a different way if needed." },
      { low: 'People work around it', high: 'People rely on it', lowDesc: "The automation created friction. People found ways to avoid it.", highDesc: "The automation fit. People adopted it and built on it." },
      { low: 'We bent to fit the system', high: 'The system fits how we work', lowDesc: "You adapted to the new system. Your workflows changed to match what it could do.", highDesc: "The system adapted to you. It fit the way you already work." },
      { low: 'The world around me', high: 'Me', lowDesc: "The circumstances shifted and the thing resolved. You didn't have to change.", highDesc: "You changed. The way you see it, want it, or approach it shifted from the inside." },
      { low: 'AI does it, we check it', high: 'We do it, AI helps', lowDesc: "AI runs the process. Your role is to review, catch errors, and flag edge cases.", highDesc: "You run the process. AI handles the parts that would slow you down." },
      { low: 'Close to where I started', high: 'Somewhere new', lowDesc: "The leap didn't move you far from where you began. The change was smaller than it felt.", highDesc: "The leap moved you. You ended up somewhere genuinely different from where you started." },
      { low: 'Doing the craft', high: 'Running the machine', lowDesc: "You do the hands-on work yourself. Most of your day is making, writing, or building.", highDesc: "You manage the people and systems that do the work. Most of your day is decisions and coordination." },
    ];
    const yDescs = [
      { low: "It's done to me", high: "I'm steering it", lowDesc: "The decisions about your work are made above you or around you. You're executing someone else's plan.", highDesc: "You're making the calls. The direction, the pace, the trade-offs are yours to own." },
      { low: 'Others decided', high: 'I had a say', lowDesc: "The call was made without your input. Someone above you, or the situation itself, determined the direction.", highDesc: "Your view shaped the outcome. You had real input into how this unfolded." },
      { low: 'It happened to me', high: 'I steered it', lowDesc: "The resolution came from outside. Events, other people, or time made the call.", highDesc: "You made it happen. You chose, acted, or accepted, and the thing moved." },
      { low: 'Others decide', high: 'I decide', lowDesc: "The direction came from circumstances, other people, or momentum you couldn't control.", highDesc: "You chose the direction. The path was yours to own." },
      { low: 'Mostly alone', high: 'Mostly with people', lowDesc: "Most of your day is solo. You work independently, with minimal interruption.", highDesc: "Most of your day is with others. Clients, a team, or partners fill most of your time." },
    ];
    for (const d of xDescs) {
      await p.query(
        `update sessions set axes = axes || jsonb_build_object('x', (axes->'x') || $1::jsonb)
         where (axes->'x'->>'low') = $2 and (axes->'x'->>'high') = $3 and (axes->'x'->>'lowDesc') is null`,
        [JSON.stringify({ lowDesc: d.lowDesc, highDesc: d.highDesc }), d.low, d.high]
      );
    }
    for (const d of yDescs) {
      await p.query(
        `update sessions set axes = axes || jsonb_build_object('y', (axes->'y') || $1::jsonb)
         where (axes->'y'->>'low') = $2 and (axes->'y'->>'high') = $3 and (axes->'y'->>'lowDesc') is null`,
        [JSON.stringify({ lowDesc: d.lowDesc, highDesc: d.highDesc }), d.low, d.high]
      );
    }
    await p.query(`insert into meta (key) values ('v3-axis-desc') on conflict do nothing`);
  }
}
