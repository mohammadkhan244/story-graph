/* Seed: runs on every cold start, all inserts use on conflict do nothing so it's idempotent.
   The old OPEN session stays as a fallback (no slug → hidden from menu).
   The Oct 20 Sensemakers session stays as the first past session.
   Nine new open prompts are added for the prompt menu. */

const sigInst = (year) =>
  `It's ${year}. The signal you chose is now normal. Everyone lives this way.\nWalk me through your day in first person, present tense, as if you're living it right now. Your morning, your work, your evening. What's delightful? What's frustrating? What surprised you about how life actually works here?\n- Don't worry about writing a good story.\n- Don't think. Just brain to page.\n- Anything you write is valid.`;

const CAREER_INST =
  `It's 2036. Walk me through a Tuesday in your work life, in first person, present tense. What do you do all day? Who do you work with? What did you stop doing? What's the part that would surprise you today? Don't plan it. Brain to page.`;

const BIZ_INST =
  `It's 2036. Walk me through a Tuesday at your business, in first person, present tense. Who are your customers now? What do you sell? What does your team look like? What did you stop doing that you do today? Don't plan it. Brain to page.`;

const YAXIS = {
  name: "Who's steering", low: "It's done to me", high: "I'm steering it",
  lowDesc: "The decisions about your work are made above you or around you. You're executing someone else's plan.",
  highDesc: "You're making the calls. The direction, the pace, the trade-offs are yours to own.",
};

const OPEN = {
  id: 'open',
  title: 'Open prompt',
  prompt: "It's 2038. Write an ordinary Tuesday in that world, in first person. What has changed about what feels real?",
  signals: ['AI curates what I see', 'Devices read my body', 'Most of my day is virtual', 'Something else'],
  axes: {
    x: { name: 'Who steers', low: 'The system decides', high: 'I decide' },
    y: { name: 'What the story notices', low: 'Comfort on the surface', high: 'The price underneath' },
  },
};

const S1020 = {
  id: 'sensemakers-2026-10-20',
  title: 'Sensemakers · Oct 20, 2026',
  prompt: "How might our sense of what's real change by 2038? Pick one of five signals and write an ordinary Tuesday in that world, in first person.",
  signals: ['Calm-editing patent', 'Virtual-world hours', 'Sci-fi snippet', 'AI-curated life', 'Smart glasses'],
  axes: {
    x: { name: "Narrator's agency", low: "Passively receives system's choices", high: 'Actively seeks or works around' },
    y: { name: 'Locus of the threat', low: "Inside the narrator's mind", high: 'External systems and data' },
  },
  quads: { ll: 'Calm Blinds, Quiet Surrender', hl: 'Inner Doubt, Private Workarounds', lh: 'Managed Lives, Harnessed Data', hh: 'Contesting the Data Economy' },
  readout:
    'With only four stories, any pattern is tentative, but three of them sit in the upper left, where institutions and data systems make the choices and the narrator receives them. One story leans toward agency, and even that writer said they kept their resistance out of the text. The lower half is nearly empty, and the right side has no story with a strong, active workaround, which may mean this group imagined threats as external and did not picture people resisting or struggling inside their own minds.',
};

/* Anonymous names replace real names from the live session. The animal assignment is
   stable so the map doesn't shuffle on each seed run. */
const STORIES = [
  {
    id: 'seed1020-1',
    name: 'Anonymous Wombat',
    signal: 'Sci-fi snippet', x: -2.5, y: 2.5,
    xq: 'it only gives me news that fits my calm state, the feel-good, cozy things',
    xw: "The narrator's one act of agency is going offline; the rest of the day is decided for her.",
    yq: 'On an offline device I find out the Capitol is under attack.',
    yw: 'An external political event is named as the concrete cost of the filtered feed.',
    body: "I wake up and my neural link, which is integrated with the house and an autonomous companion, starts breakfast. It knows my order. During meditation the link helps calm my mind and reads my vitals, including exercise after my pregnancy. An interface asks whether I want to know what is going on in the world, but it only gives me news that fits my calm state, the feel-good, cozy things. Out on a walk I sense something is off. I try to tap into the link and it is not working. On an offline device I find out the Capitol is under attack. The story matched how I feel now: ambient uncertainty. I did not write any resistance.",
  },
  {
    id: 'seed1020-2',
    name: 'Anonymous Narwhal',
    signal: 'Smart glasses', x: -4, y: 4,
    xq: "I can't remember my own memories because I outsource my thinking to the thing.",
    xw: 'Memory itself is delegated; the narrator acts only within what the system permits.',
    yq: 'waive my rights and hand over my health logs or my voting history',
    yw: 'The exact institutional exchange is named: privacy traded for access.',
    body: "Smart glasses have replaced phones. The feed scrolls on my eyes and is called blip. A free version shows ads, or I pay $50 a month for ad-free views of my own memories. I can't remember my own memories because I outsource my thinking to the thing. I wonder where my friend Sharon is but I can't find her on this social media anymore. To find her I spend my free token, or waive my rights and hand over my health logs or my voting history. Meta probably owns it. I wonder whether the virus in 2020 really happened or whether I imagined it. A Mandela effect. My job is to train an AI, like everyone's. We are in it right now, this is just an extreme version. We just allowed it.",
  },
  {
    id: 'seed1020-3',
    name: 'Anonymous Lynx',
    signal: 'AI-curated life', x: -5, y: 2,
    xq: "I can't change it because the AI says it is good for me.",
    xw: "No override is possible; the AI's decision is final and the narrator accepts it.",
    yq: "Algorithms have collected all of my data into one profile and I'm not given the option to say no.",
    yw: "The external system is named but the narrator doesn't follow the cost any further.",
    body: "I walk into work and the AI notices I'm sluggish, so it plays early 2000s pop music to pick me up. I don't enjoy that music, but I can't change it because the AI says it is good for me. Algorithms have collected all of my data into one profile and I'm not given the option to say no.",
  },
  {
    id: 'seed1020-4',
    name: 'Anonymous Gecko',
    signal: 'Calm-editing patent', x: 2, y: 4,
    xq: "I wouldn't choose this unless it were fully local to me",
    xw: 'The only story where the narrator holds a condition; she imagines different terms.',
    yq: "could decide I'm a flight risk and lay me off",
    yw: 'She follows the data economy to a named institutional consequence: losing her job.',
    body: "I tried to write a helpful version. I log off work cranky and stressed, and when I walk into the living room my latest comfort show starts playing. My watch or phone reminds me to eat because it has been far too long, and suggests the easiest thing in my fridge. I kept hitting a wall, because for this to exist I would have to give a company permission to sell my data. That company could sell the fact that I'm stressed to my employer, who could decide I'm a flight risk and lay me off before I quit. I wouldn't choose this unless it were fully local to me, and I can't see that as a real business model. I had thoughts about resisting it but did not write them into the story.",
  },
];

const PROMPTS = [
  {
    id: 'innovation-vs-efficiency',
    slug: 'innovation-vs-efficiency',
    title: 'Innovation vs. Efficiency',
    year: 2038,
    sort: 1,
    big_question: 'How might expectations around experimentation vs. proven methods shift by 2038?',
    prompt: "It's 2038. How might expectations around experimentation vs. proven methods shift?",
    axes: {
      x: { name: 'Appetite for risk', low: "Stick to what's proven", high: 'Bet on the new idea', lowDesc: "You default to tested approaches. Better to deliver something reliable than chase the next thing.", highDesc: "You back the unproven approach. Better to learn something new than repeat the known." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: 'Predictive algorithm that scores project innovation risk and blocks funding for high-risk ideas' },
      { type: 'Headline', text: 'Studies show 80% of companies that run innovation days still pick low-risk projects.' },
      { type: 'Trend', text: 'Professionals increasingly hide experimental work, showing only proven methods to avoid career risk' },
      { type: 'Product', text: 'Public betting platform on corporate innovation projects, crowd confidence scores influence funding decisions' },
      { type: 'Sci-fi', text: "The meeting continued without her input. Her coworker proposed an idea, a risky one. But the leadership shot it down. A low score. They chose to do the same thing as before. She hid her sketch of a new idea in her bag." },
    ],
  },
  {
    id: 'anonymity-vs-authentication',
    slug: 'anonymity-vs-authentication',
    title: 'Anonymity vs. Constant Authentication',
    year: 2045,
    sort: 2,
    big_question: 'How might anonymity & authentication change by 2045?',
    prompt: "It's 2045. How might anonymity & authentication change?",
    axes: {
      x: { name: 'Being known', low: 'Verified at every step', high: 'Free to be unknown', lowDesc: "Your identity is confirmed continuously. Every system knows exactly who you are.", highDesc: "You move without a persistent trace. You choose what gets attached to your name." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: 'Continuous biometric authentication system requiring heartbeat verification for all access' },
      { type: 'Headline', text: 'Universities now require biometric verification proving applicants are human, not AI' },
      { type: 'Trend', text: 'Continuous identity verification required for banking, delivery apps, even home entry' },
      { type: 'Product', text: "Next-gen Ring doorbells unlock only after biometric verification of human visitor" },
      { type: 'Sci-fi', text: "She didn't need to show ID. The system pinged her as human. She stood at the door waiting for it to unlock. Her sister was on the other side, waving. But the system hadn't pre-authorized the visit" },
    ],
  },
  {
    id: 'proof-of-work',
    slug: 'proof-of-work',
    title: 'Verification & Proof of Work',
    year: 2038,
    sort: 3,
    big_question: 'How might verification and proof-of-work transform professional life by 2038?',
    prompt: "It's 2038. How might verification and proof-of-work transform professional life?",
    axes: {
      x: { name: 'How work is trusted', low: 'Prove every step', high: 'Trusted on results', lowDesc: "Your process earns trust. You document and show your work at every stage.", highDesc: "Your output earns trust. How you got there is your own business." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: "Continuous keystroke biometrics creating unique 'work DNA' for authorship verification" },
      { type: 'Headline', text: "Academic institutions see 400% increase in AI-detector appeals; students must now submit 'process portfolios'" },
      { type: 'Sci-fi', text: "She spent more time documenting her thinking than doing the actual work. But that WAS the work now—proof she'd thought at all." },
      { type: 'Trend', text: 'Professional licenses now require "decision journals" showing thought process, not just outcomes' },
      { type: 'Product', text: '"ProofChain"—a tool that timestamps and attributes every decision, creating verifiable work provenance' },
    ],
  },
  {
    id: 'hierarchy-vs-democratization',
    slug: 'hierarchy-vs-democratization',
    title: 'Hierarchy vs. Democratization',
    year: 2045,
    sort: 4,
    big_question: 'How might power structures shift when AI gives everyone executive-level capabilities by 2045?',
    prompt: "It's 2045. How might power structures shift when AI gives everyone executive-level capabilities?",
    axes: {
      x: { name: 'Where power sits', low: 'Stays at the top', high: 'Spread across everyone', lowDesc: "Authority concentrates in a few roles. Decisions flow down from the top.", highDesc: "Authority goes to whoever is closest to the problem. Decisions are made where the work is." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: 'AI system that automates regulatory compliance workflows, allowing junior staff to handle tasks requiring senior expertise' },
      { type: 'Headline', text: 'Companies now rotate leadership quarterly as junior-staff produce executive level work with AI.' },
      { type: 'Trend', text: 'Junior staff hide AI work to appear naturally talented' },
      { type: 'Product', text: 'AI tools allowing financial analysis mimicking McKinsey level consultant work' },
      { type: 'Sci-fi', text: "Her email pinged. Spreadsheet analysis needed by EOD. She opened the AI, generated the report, forwarded it to leadership. The bonus came through that afternoon. In the meeting the next day, they asked her to explain her methodology. She couldn't." },
    ],
  },
  {
    id: 'specialist-vs-generalist',
    slug: 'specialist-vs-generalist',
    title: 'Easy Hiring vs. Broad Capability',
    year: 2038,
    sort: 5,
    big_question: 'How might professional identity change when jobs favor specialists but markets reward generalists by 2038?',
    prompt: "It's 2038. How might professional identity change when jobs favor specialists but markets reward generalists?",
    axes: {
      x: { name: 'Professional identity', low: 'Narrow specialist', high: 'Broad generalist', lowDesc: "You're known for one thing done deeply. Depth is your currency.", highDesc: "You're useful across many things. Breadth is your currency." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: "System that categorizes people into narrow skill boxes, auto-rejecting applications that don't fit." },
      { type: 'Trend', text: 'More professionals are going into freelance or solopreneur jobs where breadth is valued.' },
      { type: 'Headline', text: 'Study shows 70% of job postings list specialist titles with 5+ unrelated skill requirements' },
      { type: 'Product', text: "'PolyMatch', an app that connects generalists with companies valuing breadth over narrow expertise" },
      { type: 'Sci-fi', text: "'What do you really do?' the interviewer asked. He'd spent three hours tailoring his resume to match their narrow description. 'I analyze data,' he said, leaving out everything else. The interviewer nodded. 'We need someone focused.'" },
    ],
  },
  {
    id: 'professional-learning',
    slug: 'professional-learning',
    title: 'The Future of Professional Learning',
    year: 2038,
    sort: 6,
    big_question: 'How might professional learning change by 2038?',
    prompt: "It's 2038. How might professional learning change?",
    axes: {
      x: { name: 'Why people learn', low: 'To prove compliance', high: 'Out of curiosity', lowDesc: "Learning is something you demonstrate. A credential, a logged hour.", highDesc: "Learning is something you pursue. You follow what interests you, not what gets recorded." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: "Neural interface that tracks 'learning events'—proving you acquired new knowledge" },
      { type: 'Headline', text: "Major corporations now mandate quarterly 'skill audits'—employees must prove continuous learning" },
      { type: 'Sci-fi', text: "She couldn't remember the last time she'd done her actual job. Every month was learning the new way to do the job she used to know how to do." },
      { type: 'Trend', text: 'Professional liability insurance requires documented learning hours—not just continuing ed credits, but proof you applied new knowledge' },
      { type: 'Product', text: '"LearnLedger"—tracks micro-credentials, validates skill currency, flags obsolescence risks' },
    ],
  },
  {
    id: 'relationships-and-advancement',
    slug: 'relationships-and-advancement',
    title: 'Career Advancement & Relationships',
    year: 2038,
    sort: 7,
    big_question: 'How might career advancement and professional relationships change by 2038?',
    prompt: "It's 2038. How might career advancement and professional relationships change?",
    axes: {
      x: { name: 'How people connect', low: 'Efficient, scored networking', high: 'Authentic relationships', lowDesc: "Connections are optimized. You build the relationships most likely to produce outcomes.", highDesc: "Connections are genuine. You build them regardless of payoff." },
      y: YAXIS,
    },
    signals: [
      { type: 'Patent', text: 'Continuous professional relationship tracking system that scores every interaction for career advancement potential' },
      { type: 'Headline', text: 'MIT, Princeton, Harvard mandate relationship portfolio submissions for graduation' },
      { type: 'Sci-fi', text: "His phone pinged. Cheryll. Perfect connection for your sales journey. His phone pinged again. Avoid Steve. Complete opposite of your journey. He walked past Steve toward Cheryll, even though Steve was holding the book he'd just published." },
      { type: 'Trend', text: "Newer professionals don't bother with project portfolios, they build relationship portfolios" },
      { type: 'Product', text: "LinkedIn's \"people you should know\" feature now auto-schedules virtual coffee-chats with people who will help you build your career" },
    ],
  },
  {
    id: 'your-career',
    slug: 'your-career',
    title: 'Your Career in 10 Years',
    year: 2036,
    sort: 8,
    big_question: "Let's imagine your career 10 years from now. What are you doing?",
    prompt: CAREER_INST,
    instructions: CAREER_INST,
    axes: {
      x: { name: "How far you've moved", low: 'Same path, further along', high: 'A different path entirely', lowDesc: "You're doing what you've always done, just further along the same road.", highDesc: "You took a turn. The work, the context, or the identity shifted substantially." },
      y: YAXIS,
    },
    signals: [],
  },
  {
    id: 'your-business',
    slug: 'your-business',
    title: 'Your Business in 10 Years',
    year: 2036,
    sort: 9,
    big_question: 'What does your business look like 10 years from now?',
    prompt: BIZ_INST,
    instructions: BIZ_INST,
    axes: {
      x: { name: 'How much it changed', low: 'Same business, bigger', high: 'A different business entirely', lowDesc: "The core is the same. You scaled or refined it but the fundamental offer didn't change.", highDesc: "The business transformed. The model, the market, or the offering shifted substantially." },
      y: YAXIS,
    },
    signals: [],
  },
];

export async function seed(p) {
  /* Legacy open prompt – kept as fallback, hidden from menu (no slug) */
  await p.query(
    `insert into sessions (id,title,prompt,signals,minutes,is_default,status,axes,published,label_mode,kind,sort)
     values ($1,$2,$3,$4,10,true,'open',$5,true,'names','open',999) on conflict (id) do nothing`,
    [OPEN.id, OPEN.title, OPEN.prompt, JSON.stringify(OPEN.signals), JSON.stringify(OPEN.axes)]
  );

  /* Oct 20 Sensemakers session – insert first, then always update axes/quads/readout/label_mode
     so production data reflects the corrected axes and anonymized names. */
  await p.query(
    `insert into sessions (id,title,prompt,signals,minutes,is_default,status,axes,quads,readout,published,label_mode,created_at,kind)
     values ($1,$2,$3,$4,10,false,'closed',$5,$6,$7,true,'names','2026-10-20T18:00:00Z','open')
     on conflict (id) do update set axes=$5, quads=$6, readout=$7, label_mode='names', kind='open'`,
    [S1020.id, S1020.title, S1020.prompt, JSON.stringify(S1020.signals), JSON.stringify(S1020.axes), JSON.stringify(S1020.quads), S1020.readout]
  );
  let i = 0;
  for (const s of STORIES) {
    i++;
    await p.query(
      `insert into stories (id,session_id,name,signal,body,x,y,ox,oy,xq,yq,xw,yw,source,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$6,$7,$8,$9,$10,$11,'seed-recap',$12)
       on conflict (id) do update set name=$3, x=$6, y=$7, ox=$6, oy=$7, xq=$8, yq=$9, xw=$10, yw=$11`,
      [s.id, S1020.id, s.name, s.signal, s.body, s.x, s.y, s.xq, s.yq, s.xw, s.yw, `2026-10-20T18:0${i}:00Z`]
    );
  }

  /* New open prompts */
  for (const pr of PROMPTS) {
    const inst = pr.instructions || (pr.signals.length > 0 ? sigInst(pr.year) : '');
    await p.query(
      `insert into sessions
         (id,title,prompt,signals,minutes,is_default,status,axes,published,label_mode,
          kind,slug,big_question,instructions,year,sort)
       values ($1,$2,$3,$4,10,false,'open',$5,true,'names','open',$6,$7,$8,$9,$10)
       on conflict (id) do nothing`,
      [
        pr.id, pr.title, pr.prompt, JSON.stringify(pr.signals),
        JSON.stringify(pr.axes),
        pr.slug, pr.big_question, inst, pr.year, pr.sort,
      ]
    );
  }
}
