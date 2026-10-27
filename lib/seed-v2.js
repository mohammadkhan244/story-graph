/* v2: interactive flow. Adds the four decision prompts and "Something you keep circling",
   and (once) rewrites every open prompt's instructions to the neutral Sensemakers rules,
   with the EWS anchor line. Axes for career/business change only if they have no stories yet. */

export const RULES =
  "Start with a specific morning. Where are you? What do you see first?\n" +
  "Write whatever shows up. Don't plan it. Don't make it realistic. Don't make it good or bad.\n" +
  "If you catch yourself explaining (\"I think AI will…\"), go back to the scene. What are you doing right now?";

const WHO = { name: 'Who decided', low: 'Others decided', high: 'I had a say' };

export const NEW_PROMPTS = [
  {
    id: 'handle-more-demand', slug: 'handle-more-demand', title: 'Handle more demand', year: null, sort: 1,
    big_question: 'What happens when twice as many people need what you make?',
    ask: { label: "What's growing?", placeholder: 'orders, users, support tickets…', lead: "It's a year after {x} doubled." },
    axes: { x: { name: 'How the growth went', low: 'Growth runs us', high: 'We run the growth' }, y: WHO },
  },
  {
    id: 'build-or-buy', slug: 'build-or-buy', title: 'Build or buy a tool', year: null, sort: 2,
    big_question: 'You needed a tool. You either built it or bought it.',
    ask: { label: 'What tool?', placeholder: 'an internal scheduling tool…', lead: "It's a year after you chose whether to build or buy {x}." },
    axes: { x: { name: 'Where it left you', low: "We're locked in", high: 'We can change course' }, y: WHO },
  },
  {
    id: 'automate-a-process', slug: 'automate-a-process', title: 'Automate a process', year: null, sort: 3,
    big_question: 'A process that people did by hand now runs on its own.',
    ask: { label: 'What process?', placeholder: 'invoice approvals…', lead: "It's a year after you automated {x}." },
    axes: { x: { name: 'How people live with it', low: 'People work around it', high: 'People rely on it' }, y: WHO },
  },
  {
    id: 'replace-a-system', slug: 'replace-a-system', title: 'Replace a system', year: null, sort: 4,
    big_question: 'The old system is gone. Something new runs in its place.',
    ask: { label: 'What system?', placeholder: 'our spreadsheet scheduling…', lead: "It's a year after you replaced {x}." },
    axes: { x: { name: 'How it turned out', low: 'We bent to fit the system', high: 'The system fits how we work' }, y: WHO },
  },
  {
    id: 'keep-circling', slug: 'keep-circling', title: 'Something you keep circling', year: null, sort: 7,
    big_question: 'A decision that won’t resolve. An idea that won’t leave.',
    ask: { label: 'What do you keep coming back to?', placeholder: 'the thing that keeps taking up space…', lead: "It's five years from now. What you kept circling ({x}) has resolved." },
    axes: {
      x: { name: 'What changed', low: 'The world around me', high: 'Me' },
      y: { name: "Who's steering", low: 'It happened to me', high: 'I steered it' },
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
  x: { name: 'Where my day goes', low: 'Doing the craft', high: 'Running the machine' },
  y: { name: 'Who I spend it with', low: 'Mostly alone', high: 'Mostly with people' },
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
}
