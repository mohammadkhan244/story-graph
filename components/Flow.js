'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import StoryMap, { Mark, signalColors } from './StoryMap';
import BrandBar from './BrandBar';
import LoadingBar from './LoadingBar';
import FictioneeringBlock from './FictioneeringBlock';
import { artSvg, decision, signalIcon } from '@/lib/cards';
import { questions, directionContext } from '@/lib/questions';

function inlineMd(text) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
function renderMd(text) {
  const out = [];
  let listItems = [], listOrdered = false, k = 0;
  const flush = () => {
    if (!listItems.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    out.push(<Tag key={k++} style={{ margin: '6px 0', paddingLeft: 20 }}>{listItems}</Tag>);
    listItems = [];
  };
  for (const line of text.split('\n')) {
    const t = line.trim();
    // ### or #### sub-heading within a card body
    if (/^#{2,4}\s/.test(t)) {
      flush();
      out.push(<p key={k++} className="reading-subhead">{inlineMd(t.replace(/^#+\s+/, ''))}</p>);
    // ALL-CAPS standalone line like NAME IT / WHY IT MATTERS / THE EVIDENCE IN YOUR STORY
    } else if (t.length >= 3 && t.length <= 55 && /^[A-Z][A-Z\s]+$/.test(t)) {
      flush();
      out.push(<p key={k++} className="reading-subhead">{t}</p>);
    // ALL-CAPS label prefix like EYEWITNESS: / EXPLAINER: / EXPERT:
    } else if (/^[A-Z]{3,}:\s+/.test(t)) {
      flush();
      const ci = t.indexOf(':');
      const lbl = t.slice(0, ci);
      const rest = t.slice(ci + 1).trim();
      out.push(<p key={k++} style={{ margin: '0 0 10px' }}><span className="reading-subhead-inline">{lbl}: </span>{inlineMd(rest)}</p>);
    } else if (/^[-*]\s/.test(t)) {
      listOrdered = false;
      listItems.push(<li key={k++} style={{ marginBottom: 4 }}>{inlineMd(t.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(t)) {
      listOrdered = true;
      listItems.push(<li key={k++} style={{ marginBottom: 4 }}>{inlineMd(t.replace(/^\d+\.\s/, ''))}</li>);
    } else {
      flush();
      if (t) out.push(<p key={k++} style={{ margin: '0 0 10px' }}>{inlineMd(t)}</p>);
    }
  }
  flush();
  return out;
}

// Italicise story excerpts (text inside double-quote pairs) inside question strings.
function renderQ(q) {
  if (typeof q !== 'string') return q; // JSX element from template — pass through
  const parts = q.split(/([“"][^”"]*[”"])/);
  if (parts.length === 1) return inlineMd(q);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <em key={i} className="story-q">{part}</em>
      : <span key={i}>{inlineMd(part)}</span>
  );
}
// Truncate a quote at a word boundary; show at least `min` chars, cap at `max`.
function truncateQuote(q, max = 120, min = 60) {
  if (!q || q.length <= max) return q;
  let cut = q.lastIndexOf(' ', max);
  if (cut < min) cut = q.indexOf(' ', min);
  if (cut < 0 || cut >= q.length) return q;
  return q.slice(0, cut) + '…';
}

const PLACING_STAGES = [
  { target: 18, label: 'Saving your story…', detail: '', duration: 500 },
  { target: 42, label: 'Reading your story…', detail: 'Understanding what you wrote.', duration: 1500 },
  { target: 64, label: 'Finding where it lands…', detail: 'Comparing with all other futures.', duration: 2000 },
  { target: 82, label: 'Placing your dot…', detail: 'Positioning on both axes.', duration: 1500 },
  { target: 94, label: 'Almost there…', detail: '', duration: 2500 },
];
const READING_STAGES = [
  { target: 12, label: 'Reading your story…', detail: 'Taking in what you wrote.', duration: 1200 },
  { target: 28, label: 'Finding the unspoken…', detail: "What you didn't plan to write.", duration: 2200 },
  { target: 46, label: 'Mapping the narrative…', detail: 'Emotional arc and turning points.', duration: 2800 },
  { target: 64, label: 'Reading between the lines…', detail: 'Patterns, fears, desires.', duration: 2800 },
  { target: 80, label: 'Writing your reading…', detail: 'Eight sections, your story.', duration: 3200 },
  { target: 93, label: 'Finishing up…', detail: '', duration: 2500 },
  { target: 97, label: 'Still working…', detail: 'Claude is writing your reading. Can take up to 90 seconds.', duration: 65000 },
];
const EMAIL_STAGES = [
  { target: 35, label: 'Sending…', detail: '', duration: 600 },
  { target: 70, label: 'Delivering…', detail: '', duration: 1200 },
  { target: 88, label: 'Almost there…', detail: '', duration: 1800 },
  { target: 94, label: 'Still sending…', detail: '', duration: 25000 },
];
const QUESTIONS_STAGES = [
  { target: 28, label: 'Reading your story…', detail: 'Understanding where you landed.', duration: 1200 },
  { target: 68, label: 'Writing your questions…', detail: 'Tailored to your story and direction.', duration: 2800 },
  { target: 93, label: 'Almost ready…', detail: '', duration: 1800 },
];

const ANCHOR = 'Start with a specific morning. Where are you? What do you see first?';
const TEST_STORIES = [
  "I wake up and the phone is already full of messages. The project launched last night and the numbers are worse than expected. I sit at the kitchen table trying to decide whether to tell the team or wait for the next data pull.",
  "The office is quiet. Everyone has gone remote and I am one of two people still coming in. I make coffee and look at the empty desks and think about the decision I made six months ago to stay in my role.",
  "I am in the middle of a conversation with someone who disagrees with everything I have done this year. They are not wrong. I am nodding and taking notes and wondering what happens next.",
];
const STEPS = ['Scene', 'Write', 'Name', 'Map', 'Think'];
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const DRIFT = /\b(I think|I believe|I guess|AI will|in the future|probably|people will)\b/i;

function leadLine(s, context, signal) {
  if (s.ask && context) return s.ask.lead.replace('{x}', context);
  if (s.scene) return s.scene;
  if (signal && s.year) return `It's ${s.year}. The signal you picked is now how everyone lives.`;
  return s.prompt || s.bigQuestion;
}
const side = (v, a) => (v < -0.8 ? a.low : v > 0.8 ? a.high : null);

function where(axes, p) {
  const xs = side(p.x, axes.x), ys = side(p.y, axes.y);
  if (!xs && !ys) return <>Your story sits near the middle of both axes.</>;
  if (xs && ys) return <>Your story leans toward <em>{xs}</em> and <em>{ys}</em>.</>;
  return <>Your story leans toward <em>{xs || ys}</em>.</>;
}
function corners(points, me) {
  const q = (p) => (p.x < 0 ? 'l' : 'h') + (p.y < 0 ? 'l' : 'h');
  const counts = { ll: 0, lh: 0, hl: 0, hh: 0 };
  points.forEach((p) => { if (p.x != null) counts[q(p)]++; });
  const mine = me ? q(me) : null;
  const empty = Object.keys(counts).filter((k) => counts[k] === 0);
  return { same: mine ? counts[mine] - 1 : 0, empty };
}
function cornerPoles(k, axes) { return `${k[0] === 'l' ? axes.x.low : axes.x.high} + ${k[1] === 'l' ? axes.y.low : axes.y.high}`; }

export default function Flow({ mode, id }) {
  const isSession = mode === 'session';
  const base = isSession ? `/api/sessions/${id}` : `/api/p/${id}`;
  const mineKey = `sm-mine-${mode}-${id}`;
  const draftKey = `sm-draft-${mode}-${id}`;

  const [s, setS] = useState(null);
  const [map, setMap] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('loading');
  const [context, setContext] = useState('');
  const [signal, setSignal] = useState(null);
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [headline, setHeadline] = useState('');
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [hp, setHp] = useState('');
  const [msg, setMsg] = useState('');
  const [mine, setMine] = useState(null); // {story, token}
  const [drawing, setDrawing] = useState(false);
  const [pastArrows, setPastArrows] = useState([]);
  const arrowsKey = `sm-past-arrows-${mode}-${id}`;
  const [peek, setPeek] = useState(null);
  const [qi, setQi] = useState(0);
  const [notes, setNotes] = useState({});
  const [listening, setListening] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [readingStage, setReadingStage] = useState('idle'); // idle | picking | loading | done | error
  const [qCardDismissed, setQCardDismissed] = useState(false);
  const [readingResult, setReadingResult] = useState(null);
  const [readingStageVal, setReadingStageVal] = useState('');
  const [readingLens, setReadingLens] = useState('');
  const [readingCardIdx, setReadingCardIdx] = useState(0);
  const [testMode, setTestMode] = useState(false);
  const [fillIdx, setFillIdx] = useState(0);
  const [resumeMode, setResumeMode] = useState(false);
  const [pastMine, setPastMine] = useState(null);
  const [sharedStory, setSharedStory] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailFollowUp, setEmailFollowUp] = useState(false);
  const [emailHp, setEmailHp] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // idle | sending | sent | error
  const [myQsData, setMyQsData] = useState(null); // null = use template
  const [myQsLoading, setMyQsLoading] = useState(false);
  const [arrowEffect, setArrowEffect] = useState(null); // 'Yes' | 'A little' | 'No' | null
  const [showMap, setShowMap] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timerBanner, setTimerBanner] = useState('');
  const recRef = useRef(null);
  const taRef = useRef(null);
  const mapRef = useRef(null);
  const bannerTimer = useRef(null);
  const readingTouchX = useRef(null);
  const lastEndsAt = useRef(undefined);
  const lastPausedAt = useRef(undefined);
  const readingKey = `sm-reading-${mode}-${id}`;
  const questionsKey = `sm-questions-${mode}-${id}`;

  async function load() {
    const r = await fetch(base, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Could not load.');
    setS(j.session); if (j.map) setMap(j.map);
    return j;
  }

  useEffect(() => {
    load().then((j) => {
      const m = ls.get(mineKey);
      const d = ls.get(draftKey);
      const sess = j.session;

      if (isSession) {
        if (m) {
          setMine(m);
          const hasDir = m.story && (m.story.arrow || m.story.stays);
          setStage(j.map ? (hasDir ? 'end' : 'map') : 'waiting');
          return;
        }
        if (!(sess.status === 'open')) { setStage('closed'); return; }
        if (d) { setContext(d.context || ''); setSignal(d.signal || null); setText(d.text || ''); setStartedAt(d.startedAt || null); }
        const needsScene = (sess.ask && !d?.context) || (sess.signals && sess.signals.length && !d?.signal);
        setStage(d && d.text ? 'write' : needsScene ? 'scene' : 'write');
        return;
      }

      // Prompt: never auto-jump past the ask step; keep old token for "See your last story" link
      if (m) setPastMine(m);
      if (d && d.text) {
        setContext(d.context || ''); setSignal(d.signal || null); setText(d.text || ''); setStartedAt(d.startedAt || null);
        setResumeMode(true);
      } else if (d) {
        setContext(d.context || ''); setSignal(d.signal || null);
      }
      const needsScene = sess.ask || (sess.signals && sess.signals.length);
      setStage(needsScene ? 'scene' : 'write');
    }).catch((e) => setErr(String(e.message || e)));
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* keep the draft safe on this device */
  useEffect(() => {
    if (stage === 'loading' || mine) return;
    const t = setTimeout(() => ls.set(draftKey, { context, signal, text, startedAt }), 500);
    return () => clearTimeout(t);
  }, [context, signal, text, startedAt, stage, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  function showBanner(text) {
    if (!text) return;
    setTimerBanner(text);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setTimerBanner(''), 3000);
  }

  /* sessions: wait for open/map (closed/waiting) and sync timer state (write) */
  useEffect(() => {
    if (!isSession || !['closed', 'waiting', 'write'].includes(stage)) return;
    if (stage !== 'write') { lastEndsAt.current = undefined; lastPausedAt.current = undefined; }
    const t = setInterval(() => load().then((j) => {
      const sess = j.session;
      if (stage === 'closed' && sess.status === 'open') setStage(sess.ask || (sess.signals || []).length ? 'scene' : 'write');
      if (stage === 'waiting' && j.map) { setReveal(true); setStage('map'); }
      if (stage === 'write') {
        if (lastEndsAt.current === undefined) {
          lastEndsAt.current = sess.endsAt; lastPausedAt.current = sess.pausedAt;
        } else {
          const pe = lastEndsAt.current, pp = lastPausedAt.current;
          const ne = sess.endsAt, np = sess.pausedAt;
          if (!pe && ne) showBanner(`Timer started: ${mmss(new Date(ne).getTime() - Date.now())}`);
          else if (!pp && np) showBanner(`Timer paused: ${mmss((sess.remainingSeconds || 0) * 1000)}`);
          else if (pp && !np) showBanner('Timer resumed');
          else if (pe && ne && pe !== ne && !np) { const r = new Date(ne).getTime() - Date.now(); if (r > 0) showBanner(`Timer restarted: ${mmss(r)}`); }
          lastEndsAt.current = ne; lastPausedAt.current = np;
        }
      }
    }).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPaused = isSession && !!(s && s.pausedAt);
  const sharedEndRaw = s && s.endsAt ? new Date(s.endsAt).getTime() : null;
  // An already-expired session timer shouldn't bypass the "Start my X minutes" button —
  // treat it as no timer so each visitor gets their own pacing.
  const sharedEnd = sharedEndRaw && sharedEndRaw > now ? sharedEndRaw : null;
  const minutes = (s && s.minutes) || 10;
  const end = isSession && sharedEnd ? sharedEnd : startedAt ? startedAt + minutes * 60000 : null;
  const left = isPaused
    ? (s.remainingSeconds != null ? s.remainingSeconds * 1000 : end ? Math.max(0, end - now) : minutes * 60000)
    : (end ? end - now : minutes * 60000);
  const over = !isPaused && (end ? left <= 0 : false);

  function startWriting() {
    if (!startedAt) setStartedAt(Date.now());
    setTimeout(() => taRef.current && taRef.current.focus(), 50);
  }

  function toggleMic() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setMsg('Speaking works in Chrome and Safari. Typing works everywhere.'); return; }
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-US';
    r.onresult = (e) => {
      let add = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) add += e.results[i][0].transcript;
      if (add) setText((t) => (t && !/\s$/.test(t) ? t + ' ' : t) + add.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
    if (!startedAt) setStartedAt(Date.now());
  }

  async function submit() {
    setSubmitting(true); setStage('placing'); setMsg('');
    try {
      const r = await fetch(`${base}/stories`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, headline, name, shared, context, signal: signal ? `${signal.type}: ${signal.text}` : '', website: hp, started_at: startedAt }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save your story.');
      const m = { story: j.story, token: j.token };
      ls.set(mineKey, m); ls.del(draftKey); setMine(m); setResumeMode(false); setPastMine(null);
      if (j.warning) setMsg(j.warning);
      if (j.map) { setMap(j.map); setReveal(true); setTimeout(() => setStage('map'), 900); }
      else setStage('waiting');
    } catch (e) { setMsg(String(e.message || e)); setStage('name'); }
    finally { setSubmitting(false); }
  }

  async function saveArrow(body) {
    if (!mine) return;
    const r = await fetch(`/api/stories/${mine.story.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: mine.token, ...body }) });
    if (!r.ok) { setMsg('Could not save your arrow. Try again.'); return false; }
    return true;
  }

  const points = useMemo(() => {
    const pts = (map && map.points) || [];
    if (!mine) return pts;
    const has = pts.some((p) => p.id === mine.story.id);
    return has ? pts : [...pts, { ...mine.story, label: 'You' }];
  }, [map, mine]);
  const me = mine ? points.find((p) => p.id === mine.story.id) : null;
  const myQsTemplate = s && map && map.axes ? questions(map.axes, me) : [];
  const myQs = myQsData ? myQsData : myQsTemplate;

  function setArrow(_id, xy) {
    setMap((m) => ({ ...m, points: m.points.map((p) => (p.id === mine.story.id ? { ...p, arrow: xy, stays: false } : p)) }));
    // Also update mine.story so test stories (excluded from map.points) track their arrow
    const updated = { ...mine, story: { ...mine.story, arrow: xy, stays: false } };
    setMine(updated); ls.set(mineKey, updated);
    saveArrow({ arrow: xy });
    setDrawing(false);
    setQi(0); setQCardDismissed(false); setStage('end');
    fetchPersonalizedQuestions({ arrow: xy });
  }
  function stay() {
    setMap((m) => ({ ...m, points: m.points.map((p) => (p.id === mine.story.id ? { ...p, arrow: null, stays: true } : p)) }));
    const updated = { ...mine, story: { ...mine.story, arrow: null, stays: true } };
    setMine(updated); ls.set(mineKey, updated);
    saveArrow({ stays: true }); setDrawing(false);
    setQi(0); setQCardDismissed(false); setStage('end');
    fetchPersonalizedQuestions({ stays: true });
  }
  function restart() {
    ls.del(mineKey); ls.del(draftKey); ls.del(arrowsKey); ls.del(readingKey); ls.del(questionsKey);
    window.location.reload();
  }

  async function fetchReading() {
    setReadingStage('loading'); setMsg('');
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 110_000);
    try {
      const r = await fetch(`/api/stories/${mine.story.id}/reading`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mine.token, stage: readingStageVal, lens: readingLens }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const j = await r.json();
      if (!r.ok) { setReadingStage('error'); setMsg(j.error || 'Could not get reading.'); return; }
      ls.set(readingKey, j.reading);
      setReadingResult(j.reading);
      setReadingCardIdx(0);
      setReadingStage('done');
    } catch (e) {
      clearTimeout(to);
      setReadingStage('error');
      setMsg(e.name === 'AbortError' ? 'Took too long. Try again.' : String(e.message || 'Something went wrong.'));
    }
  }
  function scrollToMap() {
    setTimeout(() => {
      if (mapRef.current && typeof window !== 'undefined' && window.innerWidth < 860) {
        mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  }
  function tryAnotherDirection() {
    if (me && me.arrow) {
      const updated = [...pastArrows, me.arrow].slice(-4);
      setPastArrows(updated);
      ls.set(arrowsKey, updated);
    }
    setQi(0); setQCardDismissed(false);
    setDrawing(true);
    setShowMap(true);
    setStage('map');
    scrollToMap();
  }
  useEffect(() => {
    if (mine) {
      setNotes(ls.get('sm-notes-' + mine.story.id) || {});
      setPastArrows(ls.get(arrowsKey) || []);
      const saved = ls.get(readingKey);
      if (saved) { setReadingResult(saved); setReadingCardIdx(0); setReadingStage('done'); }
      const savedQs = ls.get(questionsKey);
      if (savedQs) setMyQsData(savedQs);
      setSharedStory(mine.story.shared ?? false);
    }
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTestMode(sessionStorage.getItem('sm_test') === '1');
  }, []);
  useEffect(() => {
    // Keep map visible on all stages — user controls visibility with the toggle button
    setShowMap(true);
  }, [stage]);

  async function fetchPersonalizedQuestions(body) {
    if (!mine) return;
    setMyQsLoading(true);
    setMyQsData(null);
    try {
      const r = await fetch(`/api/stories/${mine.story.id}/questions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mine.token, ...body }),
      });
      const j = await r.json();
      if (r.ok && Array.isArray(j.questions)) {
        ls.set(questionsKey, j.questions);
        setMyQsData(j.questions);
      }
    } catch {}
    setMyQsLoading(false);
  }
  async function saveArrowEffect(v) {
    setArrowEffect(v);
    if (!mine) return;
    await fetch(`/api/stories/${mine.story.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mine.token, arrow_effect: v }),
    }).catch(() => {});
  }
  async function toggleShared(v) {
    if (!mine) return;
    setSharedStory(v);
    setMap((m) => m ? {
      ...m,
      points: m.points.map((p) => p.id === mine.story.id ? { ...p, body: v ? mine.story.body : null, context: v ? mine.story.context : null } : p),
    } : m);
    await fetch(`/api/stories/${mine.story.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mine.token, shared: v }),
    });
  }
  function note(i, v) { const n = { ...notes, [i]: v }; setNotes(n); if (mine) ls.set('sm-notes-' + mine.story.id, n); }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!mine || !emailAddr.trim()) return;
    setEmailStatus('sending');
    try {
      const r = await fetch(`/api/stories/${mine.story.id}/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mine.token, email: emailAddr.trim(), follow_up: emailFollowUp, website: emailHp, readingRaw: readingResult?.raw || null }),
      });
      const j = await r.json();
      if (!r.ok) { setEmailStatus('error'); return; }
      setEmailStatus('sent');
    } catch { setEmailStatus('error'); }
  }

  if (err) return <main className="flow"><BrandBar /><p className="warn center">{err}</p></main>;
  if (!s || stage === 'loading') return <main className="flow"><BrandBar /><p className="note center">Loading…</p></main>;

  const stepIdx = { scene: 0, write: 1, name: 2, placing: 2, waiting: 3, map: 3, think: 4, end: 4 }[stage] ?? 0;
  const lead = leadLine(s, context, signal);
  const slug = s.cardSlug || s.slug || 'keep-circling';
  const dec = decision(s.cardSlug || s.slug, s.title);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const drift = DRIFT.test(text.slice(-180));
  const { tags, shape } = signalColors(points);

  return (
    <main className="flow">
      <BrandBar right={!isSession && (
        <a className="textlink decision-link" href="/" aria-label="Choose a different decision">
          <span className="decision-full">Choose a different decision</span>
          <span className="decision-short" aria-hidden="true">↺ Decisions</span>
        </a>
      )} />
      {!['closed'].includes(stage) && (
        <div className="steps" aria-label="Progress">
          {STEPS.map((t, i) => <div key={t} className={i < stepIdx ? 'done' : i === stepIdx ? 'on' : ''}>{t}</div>)}
        </div>
      )}

      {stage === 'closed' && (
        <section className="stage center" style={{ gap: 18, paddingTop: 40 }}>
          <div className="icon-badge" dangerouslySetInnerHTML={{ __html: artSvg(slug) }} />
          <h3>{s.bigQuestion || s.title || dec.q}</h3>
          <p className="sub">Writing hasn't started yet. This page opens by itself when it does.</p>
        </section>
      )}

      {stage === 'scene' && (
        <section className="stage">
          <div className="stage-head">
            <div className="icon-badge" dangerouslySetInnerHTML={{ __html: artSvg(slug) }} />
            <h3>{s.bigQuestion || dec.q}</h3>
            {!s.bigQuestion && dec.why && <p className="sub">{dec.why}</p>}
          </div>
          {resumeMode ? (
            <div className="stack" style={{ maxWidth: 480, margin: '0 auto', gap: 14 }}>
              <p className="sub">You have an unfinished draft for this prompt.</p>
              <div className="row">
                <button className="big primary" type="button" onClick={() => setStage('write')}>Continue your draft →</button>
                <button type="button" className="quiet" onClick={() => {
                  setText(''); setContext(''); setSignal(null); setStartedAt(null);
                  ls.del(draftKey); setResumeMode(false);
                }}>Start fresh</button>
              </div>
              {pastMine && <p className="note center"><button type="button" className="textlink" onClick={() => { setMine(pastMine); setStage(map ? 'map' : 'waiting'); }}>See your last story →</button></p>}
            </div>
          ) : (
            <>
              {s.ask ? (
                <form className="ask" onSubmit={(e) => { e.preventDefault(); if (context.trim()) setStage('write'); }}>
                  <label htmlFor="ask">{s.ask.label}</label>
                  <input id="ask" autoFocus value={context} maxLength={140} onChange={(e) => setContext(e.target.value)} placeholder={s.ask.placeholder} />
                  <p className="note">One line is enough. It sets the scene for your story.</p>
                  <div className="center"><button className="big primary" type="submit" disabled={!context.trim()}>Write for {minutes} minutes →</button></div>
                </form>
              ) : (
                <>
                  <div className="twoways">
                    <div className="way">
                      <span className="kicker">Already have something in mind?</span>
                      <button className="big primary" type="button" onClick={() => { setSignal(null); setStage('write'); }}>Write for {minutes} minutes →</button>
                    </div>
                    <div className="way">
                      <span className="kicker">Want a nudge?</span>
                      <p className="sub">Pick a signal below. Signals are made-up glimpses of how this could change. They're there to get you imagining, not to tell you what to write.</p>
                    </div>
                  </div>
                  <div className="signals">
                    {s.signals.map((g, i) => (
                      <button key={i} type="button" className="sigcard" style={{ '--i': i }} onClick={() => { setSignal(g); setStage('write'); }}>
                        <svg className="sig-art" viewBox="0 0 100 92" dangerouslySetInnerHTML={{ __html: signalIcon(g.type) }} />
                        {g.type && <span className="sig-type">{g.type}</span>}
                        <span>{g.text}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {pastMine && <p className="note center" style={{ marginTop: 14 }}><button type="button" className="textlink" onClick={() => { setMine(pastMine); setStage(map ? 'map' : 'waiting'); }}>See your last story →</button></p>}
            </>
          )}
        </section>
      )}

      {stage === 'write' && (
        <section className="stage">
          <div className="stage-head" style={{ marginBottom: 10 }}>
            {(s.bigQuestion || dec.q) && <p className="kicker">{s.bigQuestion || dec.q}</p>}
            {(() => {
              if (!lead) return null;
              const raw = lead.split('. ');
              const parts = raw.length > 1
                ? raw.map((p, i) => i < raw.length - 1 ? p + '.' : p).filter(Boolean)
                : [lead];
              if (parts.length <= 1) return <p className="scene">{lead}</p>;
              return (
                <div className="scene-block">
                  {parts.map((line, i) => <p key={i} className={i === 0 ? 'scene scene-ctx' : 'scene'}>{line}</p>)}
                </div>
              );
            })()}
            {s.ask && context && <p className="note center" style={{ marginTop: 4 }}><button type="button" className="textlink change" onClick={() => setStage('scene')}>Change</button></p>}
            <p className="anchor">{ANCHOR}</p>
          </div>
          {signal && (
            <div className="pinned">
              <svg viewBox="0 0 100 92" dangerouslySetInnerHTML={{ __html: signalIcon(signal.type) }} />
              <div><div className="sig-type kicker">{signal.type}</div>{signal.text}
                <div className="row" style={{ marginTop: 8 }}><button type="button" className="textlink change" onClick={() => setStage('scene')}>Pick another</button><button type="button" className="textlink change" onClick={() => setSignal(null)}>Write without it</button></div></div>
            </div>
          )}
          <div className="rules"><span>Don't plan it</span><span>Don't make it good</span><span>Anything is valid</span><span>Keep going</span></div>
          {timerBanner && <div className="timer-banner" role="status" aria-live="polite">{timerBanner}</div>}
          {!startedAt && !(isSession && sharedEnd) ? (
            <div className="center" style={{ marginTop: 26, gap: 14 }}>
              <button className="big primary" type="button" onClick={startWriting}>Start my {minutes} minutes</button>
              <button type="button" className="textlink" onClick={toggleMic}>Or speak it instead 🎙</button>
            </div>
          ) : (
            <>
              <div className="writebar">
                <span className={'timer' + (!isPaused && end && left < 60000 ? ' low' : '') + (isPaused ? ' paused' : '')} aria-live="off">{isPaused ? '⏸ ' + mmss(left) : over ? '00:00' : mmss(left)}</span>
                <span className="row">
                  <span className="note">{words} words</span>
                  <button type="button" className={'quiet mic' + (listening ? ' live' : '')} onClick={toggleMic}>{listening ? 'Listening… tap to stop' : 'Speak 🎙'}</button>
                </span>
              </div>
              <textarea ref={taRef} className="page" aria-label="Your story" value={text} onChange={(e) => { setText(e.target.value); if (!startedAt) setStartedAt(Date.now()); }} placeholder="I wake up and the first thing I see is…" />
              {drift && <p className="nudge">Stay in the scene. What are you doing right now?</p>}
              {over && <p className="nudge">Time. Finish your sentence, then give it a name.</p>}
              {testMode && (
                <div style={{ marginTop: 6, textAlign: 'center' }}>
                  <button type="button" className="quiet" onClick={() => {
                    setText(TEST_STORIES[fillIdx % TEST_STORIES.length]);
                    setFillIdx((f) => f + 1);
                    if (!startedAt) setStartedAt(Date.now());
                  }}>Fill with a sample story</button>
                </div>
              )}
              <div className="center" style={{ marginTop: 18 }}>
                <button className="big" type="button" disabled={!testMode && text.trim().length < 20} onClick={() => { if (recRef.current) recRef.current.stop(); setStage('name'); }}>I'm done writing →</button>
              </div>
            </>
          )}
          {msg && <p className="note center" style={{ marginTop: 10 }}>{msg}</p>}
        </section>
      )}

      {stage === 'name' && (
        <section className="stage narrow">
          <div className="stage-head">
            <h3>Give this future a name.</h3>
            <p className="sub">Three to five words. What you'd call this world.</p>
          </div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input autoFocus aria-label="Scenario headline" value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} placeholder="The quiet takeover" style={{ font: "400 24px var(--title)", textAlign: 'center' }} />
            <div>
              <label htmlFor="nm">{isSession ? 'Name on the shared screen (optional)' : 'Your name (optional)'}</label>
              <input id="nm" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to stay anonymous" />
            </div>
            <label className="check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Let others read my full story on the map (your name shows only if you add one)</label>
            <div className="hp" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
            <div className="center" style={{ gap: 10, marginTop: 8 }}>
              <button className="big primary" type="submit" disabled={submitting}>{submitting ? 'Placing your story…' : 'Place my story on the map'}</button>
              <button type="button" className="textlink" disabled={submitting} onClick={() => setStage('write')}>Back to my story</button>
            </div>
            {msg && <p className="warn center">{msg}</p>}
          </form>
        </section>
      )}

      {stage === 'placing' && (
        <section className="stage placing">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            {[34, 54, 74, 88].map((r, i) => <ellipse key={i} cx="90" cy="90" rx={r} ry={r * 0.55} fill="none" stroke={i % 2 ? '#79998b' : '#afbeb1'} strokeWidth="1.5" />)}
            <circle cx="90" cy="90" r="8" fill="#a72f39" />
          </svg>
          <h3>Placing your story…</h3>
          <LoadingBar stages={PLACING_STAGES} />
        </section>
      )}

      {stage === 'waiting' && (
        <section className="stage center" style={{ gap: 16, paddingTop: 30 }}>
          <h3>Your story is in. Look up at the screen.</h3>
          <p className="sub">Your dot shows up here when the map is shared.</p>
          {mine && <div className="peek narrow" style={{ textAlign: 'left' }}>{mine.story.headline && <strong>{mine.story.headline}</strong>}<p className="storytext">{mine.story.body}</p></div>}
        </section>
      )}

      {(stage === 'map' || stage === 'think' || stage === 'end') && map && map.axes && (
        <section className="stage mapgrid" data-stage={stage}>
          <div>
            <div className={showMap ? 'mapwrap' : 'mapwrap map-collapsed'} ref={mapRef}>
              <StoryMap axes={map.axes} quads={map.quads} points={points} background={map.background || []}
                youId={mine && mine.story.id} selId={peek} reveal={reveal}
                onSelect={(pid) => setPeek(pid === peek ? null : pid)}
                arrowFor={drawing && mine ? mine.story.id : null} onArrow={setArrow}
                pastArrowEnds={pastArrows.length ? pastArrows : undefined} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '8px 4px 2px', flexWrap: 'wrap' }}>
              <p style={{ font: '12px var(--body)', color: 'var(--sage)', margin: 0 }}>● You  → where you'd rather be</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {(stage === 'think' || stage === 'end') && mine && me && me.x != null && (
                  <button type="button" className="textlink" onClick={tryAnotherDirection}>Redraw arrow ↺</button>
                )}
                {(stage === 'think' || stage === 'end') && (
                  <button type="button" className="textlink map-toggle" onClick={() => setShowMap(v => !v)}>
                    {showMap ? 'Hide map' : 'Show map ↓'}
                  </button>
                )}
              </div>
            </div>
            {/* End-stage secondary links: small, under the map */}
            {stage === 'end' && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                {!isSession && <button type="button" className="textlink" style={{ fontSize: 13 }} onClick={restart}>Write another ↺</button>}
                <a className="textlink" style={{ fontSize: 13 }} href="/">Try a different decision →</a>
              </div>
            )}
            {/* Mobile-only drawing controls appear directly under the map */}
            {stage === 'map' && drawing && (
              <div className="draw-mobile-hint">
                <p className="nudge">Tap or drag on the map to where you'd rather be. Anywhere you like.</p>
                <div className="row">
                  <button type="button" onClick={stay}>I'd stay here</button>
                  <button type="button" className="quiet" onClick={() => setDrawing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
          <div className="side">
            {stage === 'map' && me && me.x != null && (
              <div className="landed">
                <span className="kicker">Where you landed</span>
                <p className="where">{where(map.axes, me)}</p>
                {me.xq && <p className="quote">"{truncateQuote(me.xq)}"</p>}
                {(() => {
                  const c = corners(points, me);
                  return (
                    <p className="note">
                      {c.same === 0 ? "You're the first story in this corner. " : `You're one of ${c.same + 1} stories in this corner. `}
                      {c.empty.length > 0 && <>Nobody has written this corner yet: <em>{cornerPoles(c.empty[0], map.axes)}</em>.</>}
                    </p>
                  );
                })()}
                {!drawing ? (
                  <div className="stack" style={{ marginTop: 6 }}>
                    <button className="big primary" type="button" onClick={() => { setDrawing(true); setPeek(null); scrollToMap(); }}>{me.arrow || me.stays ? 'Redraw my arrow' : "Draw where you'd rather be"}</button>
                  </div>
                ) : (
                  <div className="stack draw-desktop-hint" style={{ marginTop: 6 }}>
                    <p className="nudge">Tap or drag on the map to where you'd rather be. Anywhere you like.</p>
                    <div className="row">
                      <button type="button" onClick={stay}>I'd stay here</button>
                      <button type="button" className="quiet" onClick={() => setDrawing(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <label className="check" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={sharedStory} onChange={(e) => toggleShared(e.target.checked)} />
                  Let others read my full story
                </label>
              </div>
            )}
            {stage === 'map' && me && me.x == null && <p className="sub">Your story is saved but not placed yet. {msg}</p>}
            {stage === 'map' && s && s.kind === 'visitor' && (
              <p className="note" style={{ borderTop: '1px solid var(--frame)', paddingTop: 10, marginTop: 2 }}>
                Your own map. When others bring this decision, they'll appear here.
              </p>
            )}

            {stage === 'think' && (myQsLoading || myQs.length > 0) && (
              <div className="qcard" key={myQsLoading ? 'loading' : qi}>
                {myQsLoading ? (
                  <LoadingBar stages={QUESTIONS_STAGES} />
                ) : (
                  <>
                    {qi === 0 && me && (me.arrow || me.stays) && map && map.axes && (
                      <p className="context-line" style={{ font: '13px var(--body)', color: 'var(--sage)', margin: '0 0 10px' }}>
                        {directionContext(map.axes, me)}
                      </p>
                    )}
                    <div className="qdots">
                      {myQs.map((_, i) => <span key={i} className={i <= qi ? 'on' : ''} />)}
                    </div>
                    <p className="q">{renderQ(myQs[qi])}</p>
                    {!isSession && <textarea rows={3} aria-label="Your notes (only on this device)" placeholder="Jot it down. Only you can see this." value={notes[qi] || ''} onChange={(e) => note(qi, e.target.value)} />}
                    <div className="row">
                      {qi > 0 && <button type="button" className="quiet" onClick={() => setQi(qi - 1)}>Back</button>}
                      {qi < myQs.length - 1
                        ? <button type="button" onClick={() => setQi(qi + 1)}>Next question</button>
                        : <button type="button" onClick={() => setStage('end')}>Done</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {stage === 'end' && (
              <div className="stack">
                {/* Questions appear first, as swipeable cards, before analysis/email */}
                {!qCardDismissed && (myQsLoading || myQs.length > 0) && (
                  <div className="qcard" key={myQsLoading ? 'loading' : qi}>
                    {myQsLoading ? (
                      <LoadingBar stages={QUESTIONS_STAGES} />
                    ) : (
                      <>
                        {qi === 0 && me && (me.arrow || me.stays) && map && map.axes && (
                          <p className="context-line" style={{ font: '13px var(--body)', color: 'var(--sage)', margin: '0 0 10px' }}>
                            {directionContext(map.axes, me)}
                          </p>
                        )}
                        <div className="qdots">
                          {myQs.map((_, i) => <span key={i} className={i <= qi ? 'on' : ''} />)}
                        </div>
                        <p className="q">{renderQ(myQs[qi])}</p>
                        {!isSession && <textarea rows={3} aria-label="Your notes (only on this device)" placeholder="Jot it down. Only you can see this." value={notes[qi] || ''} onChange={(e) => note(qi, e.target.value)} />}
                        <div className="row">
                          {qi > 0 && <button type="button" className="quiet" onClick={() => setQi(qi - 1)}>Back</button>}
                          {qi < myQs.length - 1
                            ? <button type="button" onClick={() => setQi(qi + 1)}>Next question</button>
                            : <button type="button" onClick={() => setQCardDismissed(true)}>Done</button>}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <h3>A narrative only runs if nothing interrupts it.</h3>
                <p className="sub">You just drew the interrupt.</p>
                {mine && (
                  <div style={{ borderTop: '1px solid var(--frame)', paddingTop: 14, marginTop: 2 }}>
                    <p style={{ font: '14px var(--body)', color: 'var(--sage)', margin: '0 0 10px' }}>
                      Did drawing the arrow change how you see this decision?
                    </p>
                    {arrowEffect ? (
                      <p style={{ font: '13px var(--body)', color: 'var(--sage)', margin: 0 }}>You said: {arrowEffect}</p>
                    ) : (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        {['Yes', 'A little', 'No'].map((v) => (
                          <button key={v} type="button" className="ghost" style={{ fontSize: 14 }} onClick={() => saveArrowEffect(v)}>{v}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="note workshop-note" style={{ marginTop: 4 }}>Facing this decision as a team? <a className="textlink" href="https://engineering-workshops.themohammadkhan.com/?utm_source=story-map">Run it in a workshop →</a></p>
                <div className="reading-panel">
                  {readingStage === 'idle' && (
                    <button type="button" className="endcard reading-cta" onClick={() => setReadingStage('picking')}>
                      <strong>Get your reading</strong>What your story reveals that you didn't plan to write.
                    </button>
                  )}
                  {readingStage === 'error' && (
                    <div className="stack">
                      <p className="warn" style={{ margin: 0 }}>{msg || 'Could not get reading.'}</p>
                      <div className="row">
                        <button type="button" className="big primary" onClick={fetchReading}>Try again</button>
                        <button type="button" className="quiet" onClick={() => setReadingStage('idle')}>Not now</button>
                      </div>
                    </div>
                  )}
                  {readingStage === 'picking' && (
                    <div className="stack">
                      <span className="kicker">Where are you with this decision?</span>
                      <div className="stage-picks">
                        {[['early', 'Just starting', "You're still figuring out what you want."],
                          ['mid', 'In the middle', "You've gone some distance. Not done yet."],
                          ['deep', 'Deep in it', "You've been here a long time. This is your world."]].map(([val, label, desc]) => (
                          <button key={val} type="button"
                            className={'stage-pick' + (readingStageVal === val ? ' on' : '')}
                            onClick={() => setReadingStageVal(val)}>
                            <strong>{label}</strong>{desc}
                          </button>
                        ))}
                      </div>
                      <div className="row">
                        <button type="button" className="big primary" disabled={!readingStageVal} onClick={fetchReading}>Read my story</button>
                        <button type="button" className="quiet" onClick={() => setReadingStage('idle')}>Not now</button>
                      </div>
                      {msg && <p className="warn">{msg}</p>}
                    </div>
                  )}
                  {readingStage === 'loading' && (
                    <div className="reading-loading">
                      <svg viewBox="0 0 180 180" aria-hidden="true">
                        {[34, 54, 74, 88].map((r, i) => <ellipse key={i} cx="90" cy="90" rx={r} ry={r * 0.55} fill="none" stroke={i % 2 ? '#79998b' : '#afbeb1'} strokeWidth="1.5" />)}
                        <circle cx="90" cy="90" r="8" fill="#a72f39" />
                      </svg>
                      <LoadingBar stages={READING_STAGES} />
                    </div>
                  )}
                  {readingStage === 'done' && readingResult && (() => {
                    const raw = readingResult.raw || '';
                    const chunks = ('## ' + raw.replace(/^\s*## /, '')).split(/\n(?=## )/);
                    const cards = chunks.map((chunk) => {
                      const nl = chunk.indexOf('\n');
                      const header = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/^## /, '').trim();
                      const body = nl === -1 ? '' : chunk.slice(nl + 1).trim();
                      return { header, body };
                    }).filter((s) => s.header && s.body.trim());
                    if (!cards.length) return <button type="button" className="quiet" onClick={() => setReadingStage('idle')}>Try getting your reading again</button>;
                    return (
                      <div>
                        <p className="note" style={{ margin: '0 0 10px', fontSize: 13 }}>The full reading will be in your email — expand any section to read it now.</p>
                        <div className="reading-sections">
                          {cards.map((c, i) => (
                            <details key={i} className={'reading-section' + (c.header.startsWith('PART 3') ? ' highlight' : '')} open={i === 0}>
                              <summary>{c.header}</summary>
                              <div className="reading-body">{renderMd(c.body)}</div>
                            </details>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {mine && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--frame)', paddingTop: 18 }}>
                    <div className="panel" style={{ borderRadius: 12, padding: '20px 20px 18px' }}>
                      <div className="stack" style={{ gap: 12 }}>
                        <strong style={{ font: '400 20px var(--title)', color: 'var(--paper)', display: 'block' }}>Keep your story</strong>
                        {emailStatus === 'sent' ? (
                          <div>
                            <p className="ok" style={{ margin: 0 }}>Sent. Check your inbox.</p>
                            <p className="note" style={{ marginTop: 8, fontSize: 13 }}>Didn't receive it? Check spam, or <button type="button" className="textlink" onClick={() => setEmailStatus('idle')}>try a different email</button>.</p>
                          </div>
                        ) : emailStatus === 'sending' ? (
                          <LoadingBar stages={EMAIL_STAGES} />
                        ) : (
                          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                              <label htmlFor="em-email">Email</label>
                              <input id="em-email" type="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)}
                                placeholder="you@example.com" autoComplete="email" />
                            </div>
                            <label className="check">
                              <input type="checkbox" checked={emailFollowUp} onChange={(e) => setEmailFollowUp(e.target.checked)} />
                              Want me to follow up with you about this?
                            </label>
                            <div className="hp" aria-hidden="true">
                              <input tabIndex={-1} autoComplete="off" value={emailHp} onChange={(e) => setEmailHp(e.target.value)} />
                            </div>
                            <div>
                              <button className="big primary" type="submit" disabled={!emailAddr.trim()}>
                                Email it to me
                              </button>
                              {emailStatus === 'error' && <p className="warn" style={{ margin: '8px 0 0' }}>Couldn't send. Try again.</p>}
                            </div>
                            <p className="note" style={{ margin: 0 }}>We'll email your story and reading. No newsletter unless you ask.</p>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {mine && <FictioneeringBlock prefillEmail={emailAddr} />}
              </div>
            )}

            {peek && (() => {
              const p = points.find((x) => x.id === peek);
              if (!p || p.id === (mine && mine.story.id)) return null;
              const arrowNote = p.arrow && map && map.axes ? (() => {
                const dx = p.arrow.x - p.x, dy = p.arrow.y - p.y;
                const isX = Math.abs(dx) >= Math.abs(dy);
                const a = isX ? map.axes.x : map.axes.y;
                const dest = (isX ? p.arrow.x : p.arrow.y) < 0 ? a.low : a.high;
                const src = (isX ? p.x : p.y) < 0 ? a.low : a.high;
                return src === dest ? `Going further toward ${dest}` : `Moving toward ${dest}`;
              })() : null;
              return (
                <div className="peek">
                  {p.headline && <strong style={{ font: '400 22px var(--title)', display: 'block' }}>{p.headline}</strong>}
                  <span className="kicker">{p.label}</span>
                  {p.body ? (
                    <>
                      {(p.context || p.signal) && <p className="note">{[p.context, p.signal].filter(Boolean).join(' · ')}</p>}
                      <p className="storytext">{p.body}</p>
                    </>
                  ) : (
                    <p className="note">This writer kept their story private.</p>
                  )}
                  {p.stays ? <p className="note">Would stay where they are.</p> : arrowNote ? <p className="note">{arrowNote}</p> : null}
                </div>
              );
            })()}
          </div>
        </section>
      )}
    </main>
  );
}
