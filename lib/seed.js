/* First-run seed: the open prompt behind the default link, plus the 10/20/2026 Sensemakers
   session, rebuilt from the spoken recaps in the transcript (not the written stories). */

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
  axes: OPEN.axes,
  quads: { ll: 'Soothed into compliance', hl: 'Comfort on my terms', lh: 'Captured and aware', hh: 'Opting out at a cost' },
  readout:
    'All four stories sit in the top half: everyone noticed a price under the comfort. Three of four hand control to the system, and only one imagines choosing. Nobody wrote comfort on their own terms, and nobody wrote resistance. Four stories is a small sample.',
};

const STORIES = [
  {
    signal: 'Sci-fi snippet', x: -3, y: 1,
    xq: 'it only gives me news that fits my calm state', xw: 'The link decides what she gets to know.',
    yq: 'On an offline device I find out the Capitol is under attack.', yw: 'The cost appears only when the system fails.',
    body: "I wake up and my neural link, which is integrated with the house and an autonomous companion, starts breakfast. It knows my order. During meditation the link helps calm my mind and reads my vitals, including exercise after my pregnancy. An interface asks whether I want to know what is going on in the world, but it only gives me news that fits my calm state, the feel-good, cozy things. Out on a walk I sense something is off. I try to tap into the link and it is not working. On an offline device I find out the Capitol is under attack. The story matched how I feel now: ambient uncertainty. I did not write any resistance.",
  },
  {
    signal: 'Smart glasses', x: -4, y: 4,
    xq: "I can't remember my own memories because I outsource my thinking to the thing.", xw: 'Even memory is handed to the device.',
    yq: 'waive my rights and hand over my health logs or my voting history', yw: 'The price is named directly: rights, data, memory.',
    body: "Smart glasses have replaced phones. The feed scrolls on my eyes and is called blip. A free version shows ads, or I pay $50 a month for ad-free views of my own memories. I can't remember my own memories because I outsource my thinking to the thing. I wonder where my friend Sharon is but I can't find her on this social media anymore. To find her I spend my free token, or waive my rights and hand over my health logs or my voting history. Meta probably owns it. I wonder whether the virus in 2020 really happened or whether I imagined it. A Mandela effect. My job is to train an AI, like everyone's. We are in it right now, this is just an extreme version. We just allowed it.",
  },
  {
    signal: 'AI-curated life', x: -5, y: 2,
    xq: "I can't change it because the AI says it is good for me.", xw: 'No override at all.',
    yq: "I'm not given the option to say no.", yw: 'Notices the missing consent, not a deeper cost.',
    body: "I walk into work and the AI notices I'm sluggish, so it plays early 2000s pop music to pick me up. I don't enjoy that music, but I can't change it because the AI says it is good for me. Algorithms have collected all of my data into one profile and I'm not given the option to say no.",
  },
  {
    signal: 'Calm-editing patent', x: 2, y: 5,
    xq: "I wouldn't choose this unless it were fully local to me", xw: 'The only story where the narrator keeps the choice.',
    yq: "could decide I'm a flight risk and lay me off", yw: 'Follows the data all the way to losing her job.',
    body: "I tried to write a helpful version. I log off work cranky and stressed, and when I walk into the living room my latest comfort show starts playing. My watch or phone reminds me to eat because it has been far too long, and suggests the easiest thing in my fridge. I kept hitting a wall, because for this to exist I would have to give a company permission to sell my data. That company could sell the fact that I'm stressed to my employer, who could decide I'm a flight risk and lay me off before I quit. I wouldn't choose this unless it were fully local to me, and I can't see that as a real business model. I had thoughts about resisting it but did not write them into the story.",
  },
];

export async function seed(p) {
  await p.query(
    `insert into sessions (id,title,prompt,signals,minutes,is_default,status,axes,published,label_mode)
     values ($1,$2,$3,$4,10,true,'open',$5,true,'names') on conflict do nothing`,
    [OPEN.id, OPEN.title, OPEN.prompt, JSON.stringify(OPEN.signals), JSON.stringify(OPEN.axes)]
  );
  await p.query(
    `insert into sessions (id,title,prompt,signals,minutes,is_default,status,axes,quads,readout,published,label_mode,created_at)
     values ($1,$2,$3,$4,10,false,'closed',$5,$6,$7,true,'anon','2026-10-20T18:00:00Z') on conflict do nothing`,
    [S1020.id, S1020.title, S1020.prompt, JSON.stringify(S1020.signals), JSON.stringify(S1020.axes), JSON.stringify(S1020.quads), S1020.readout]
  );
  let i = 0;
  for (const s of STORIES) {
    i++;
    await p.query(
      `insert into stories (id,session_id,name,signal,body,x,y,ox,oy,xq,yq,xw,yw,source,created_at)
       values ($1,$2,'',$3,$4,$5,$6,$5,$6,$7,$8,$9,$10,'seed-recap',$11) on conflict do nothing`,
      ['seed1020-' + i, S1020.id, s.signal, s.body, s.x, s.y, s.xq, s.yq, s.xw, s.yw, `2026-10-20T18:0${i}:00Z`]
    );
  }
}
