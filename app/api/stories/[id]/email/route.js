import { NextResponse } from 'next/server';
import { q, newId, hashToken } from '@/lib/db';
import { fail } from '@/lib/auth';
import { Resend } from 'resend';
import { generateReading } from '@/lib/reading';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Per-process IP rate limiter: 10 sends per hour per IP
const ipLog = new Map();
function checkIp(ip) {
  const now = Date.now(), window = 3_600_000;
  const hits = (ipLog.get(ip) || []).filter((t) => now - t < window);
  if (hits.length >= 10) return false;
  hits.push(now);
  ipLog.set(ip, hits);
  return true;
}

function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActiveQuestions(story) {
  const qs = story.questions;
  if (!qs || typeof qs !== 'object') return [];
  if (story.stays) return qs['stays'] || [];
  if (story.ax != null && story.ay != null) {
    const r = (v) => Math.round((Number(v) || 0) * 2) / 2;
    const key = `${r(story.ax)},${r(story.ay)}`;
    if (qs[key]) return qs[key];
  }
  const vals = Object.values(qs);
  return vals.length ? vals[0] : [];
}

function arrowDirection(story, axes) {
  if (story.stays) return 'You chose to stay';
  if (story.ax == null || story.ay == null) return '';
  const ax = (axes && axes.x) || {}, ay = (axes && axes.y) || {};
  const dx = story.ax - (story.x || 0), dy = story.ay - (story.y || 0);
  const isX = Math.abs(dx) >= Math.abs(dy);
  const a = isX ? ax : ay;
  const srcVal = isX ? story.x : story.y;
  const dstVal = isX ? story.ax : story.ay;
  const src = (srcVal || 0) < 0 ? a.low : a.high;
  const dst = dstVal < 0 ? a.low : a.high;
  const dotQx = (story.x || 0) < 0 ? -1 : 1, dotQy = (story.y || 0) < 0 ? -1 : 1;
  const arrQx = story.ax < 0 ? -1 : 1, arrQy = story.ay < 0 ? -1 : 1;
  const type = dotQx !== arrQx || dotQy !== arrQy ? 'cross'
    : Math.hypot(story.ax, story.ay) >= Math.hypot(story.x || 0, story.y || 0) ? 'deepen' : 'pullback';
  const label = { deepen: 'Deepen', pullback: 'Pull back', cross: 'Cross' }[type];
  const toward = src === dst ? `further toward "${dst}"` : `from "${src}" toward "${dst}"`;
  return `${label}: ${toward}`;
}

function escMd(text) {
  // Strip basic markdown markers for plain-email rendering
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function buildReadingHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const chunks = ('## ' + raw.replace(/^\s*## /, '')).split(/\n(?=## )/);
  const sections = chunks.map((chunk) => {
    const nl = chunk.indexOf('\n');
    const header = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/^## /, '').trim();
    const body = nl === -1 ? '' : chunk.slice(nl + 1).trim();
    return { header, body };
  }).filter((s) => s.header && s.body.trim());
  if (!sections.length) return '';
  return `<tr><td style="padding:28px 0;border-bottom:1px solid #e8e4da;">
  <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a9098;margin:0 0 20px;font-family:Arial,sans-serif;">Your reading</p>
  ${sections.map(({ header, body }) => `
  <p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5a6068;margin:0 0 6px;font-family:Arial,sans-serif;">${esc(header)}</p>
  ${body.split(/\n{2,}/).map((para) => `<p style="font-size:15px;line-height:1.7;color:#0c1012;margin:0 0 12px;">${escMd(para.trim().replace(/\n/g, ' '))}</p>`).join('')}
  `).join('<hr style="border:none;border-top:1px solid #e8e4da;margin:16px 0;">')}
</td></tr>`;
}

function buildHtml(story, session, questions, baseUrl) {
  const axes = session.axes || {};
  const ax = axes.x || {}, ay = axes.y || {};
  const xPole = story.x != null ? ((story.x || 0) < 0 ? ax.low : ax.high) : null;
  const yPole = story.y != null ? ((story.y || 0) < 0 ? ay.low : ay.high) : null;
  const quadrant = [xPole, yPole].filter(Boolean).join(' + ');
  const xPoleDesc = story.x != null ? ((story.x || 0) < 0 ? ax.lowDesc : ax.highDesc) : null;
  const yPoleDesc = story.y != null ? ((story.y || 0) < 0 ? ay.lowDesc : ay.highDesc) : null;
  const direction = arrowDirection(story, axes);
  const bigQ = session.big_question || session.prompt || '';
  const storyUrl = session.slug
    ? `${baseUrl}/p/${session.slug}`
    : `${baseUrl}/s/${story.session_id}`;
  const mapUrl = `${baseUrl}/m/${story.session_id}`;

  const questionsHtml = questions.length
    ? `<ol style="margin:8px 0 0;padding-left:22px;">${questions.map((q) => `<li style="margin-bottom:10px;font-size:15px;line-height:1.65;color:#0c1012;">${esc(q)}</li>`).join('')}</ol>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(story.headline ? `Your story: ${story.headline} · ${session.title || ''}` : `Your story: ${session.title || 'Story Map'}`)}</title>
</head>
<body style="margin:0;padding:0;background:#fffdf6;font-family:Georgia,serif;color:#0c1012;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffdf6">
<tr><td align="center" style="padding:48px 16px 64px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

<tr><td style="padding-bottom:28px;border-bottom:1px solid #e8e4da;">
  ${bigQ ? `<p style="font-size:12px;color:#8a9098;margin:0 0 12px;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif;">${esc(bigQ)}</p>` : ''}
  <h1 style="font-family:'Gilda Display',Georgia,serif;font-size:32px;font-weight:400;line-height:1.15;margin:0;color:#0c1012;">${esc(story.headline || 'Your story')}</h1>
</td></tr>

<tr><td style="padding:28px 0;border-bottom:1px solid #e8e4da;">
  <p style="font-size:16px;line-height:1.8;margin:0;color:#0c1012;white-space:pre-wrap;">${esc(story.body || '')}</p>
</td></tr>

${quadrant ? `<tr><td style="padding:24px 0;border-bottom:1px solid #e8e4da;">
  <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a9098;margin:0 0 8px;font-family:Arial,sans-serif;">Where you landed</p>
  <p style="font-size:20px;font-family:'Gilda Display',Georgia,serif;font-weight:400;margin:0 0 ${xPoleDesc || yPoleDesc ? '12px' : '0'};color:#0c1012;">${esc(quadrant)}</p>
  ${xPoleDesc ? `<p style="font-size:14px;color:#5a6068;margin:0 0 4px;line-height:1.55;">${esc(xPoleDesc)}</p>` : ''}
  ${yPoleDesc ? `<p style="font-size:14px;color:#5a6068;margin:0;line-height:1.55;">${esc(yPoleDesc)}</p>` : ''}
</td></tr>` : ''}

${direction ? `<tr><td style="padding:24px 0;border-bottom:1px solid #e8e4da;">
  <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a9098;margin:0 0 8px;font-family:Arial,sans-serif;">Where you want to go</p>
  <p style="font-size:16px;margin:0;line-height:1.55;color:#0c1012;">${esc(direction)}</p>
</td></tr>` : ''}

${questionsHtml ? `<tr><td style="padding:24px 0;border-bottom:1px solid #e8e4da;">
  <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a9098;margin:0 0 4px;font-family:Arial,sans-serif;">Your questions</p>
  ${questionsHtml}
</td></tr>` : ''}

${buildReadingHtml(story.reading && story.reading.raw)}

<tr><td style="padding:28px 0;border-bottom:1px solid #e8e4da;">
  <a href="${esc(mapUrl)}" style="display:inline-block;padding:13px 28px;background:#a72f39;color:#fffdf6;text-decoration:none;font-size:15px;font-family:Arial,sans-serif;font-weight:700;border-radius:8px;letter-spacing:0.01em;">See your story on the map →</a>
</td></tr>

<tr><td style="padding:24px 0;border-bottom:1px solid #e8e4da;">
  <a href="https://engineering-workshops.themohammadkhan.com/?utm_source=story-map" style="display:inline-block;padding:11px 24px;background:transparent;color:#3a4a40;text-decoration:none;font-size:14px;font-family:Arial,sans-serif;font-weight:600;border-radius:8px;border:1.5px solid #79998b;letter-spacing:0.01em;">Facing this decision as a team? Run it in a workshop →</a>
</td></tr>

<tr><td style="padding:24px 0;border-bottom:1px solid #e8e4da;">
  <a href="https://fictioneering-newsletter.themohammadkhan.com/subscribe?utm_source=story-map-email" style="display:inline-block;padding:11px 24px;background:transparent;color:#3a4a40;text-decoration:none;font-size:14px;font-family:Arial,sans-serif;font-weight:600;border-radius:8px;border:1.5px solid #8d9d9d;letter-spacing:0.01em;">Subscribe to Fictioneering →</a>
  <p style="font-size:12px;color:#8a9098;margin:8px 0 0;font-family:Arial,sans-serif;">Weekly essays on using fiction to make real decisions.</p>
</td></tr>

<tr><td style="padding:28px 0 0;">
  <p style="font-size:12px;color:#8a9098;margin:0;font-family:Arial,sans-serif;">Story Map by Mohammad Khan &middot; <a href="https://story-map.themohammadkhan.com" style="color:#a72f39;text-decoration:none;">story-map.themohammadkhan.com</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function POST(req, { params }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const b = await req.json().catch(() => ({}));

    // Honeypot
    if (b.website) return NextResponse.json({ ok: true });

    // Token
    if (!b.token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    // Email
    const email = String(b.email || '').trim().toLowerCase();
    if (!validEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

    // IP rate limit
    if (!checkIp(ip)) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });

    // Load story + session
    const story = (await q('select * from stories where id=$1', [params.id]))[0];
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (hashToken(b.token) !== story.token_hash) {
      return NextResponse.json({ error: 'Not your story' }, { status: 403 });
    }
    const session = (await q('select * from sessions where id=$1', [story.session_id]))[0] || {};

    // Story send limit: 3 unique emails max; re-send to same address always allowed
    const existing = (await q('select id from emails where story_id=$1 and email=$2', [params.id, email]))[0];
    if (!existing) {
      const sendCount = parseInt(
        (await q('select count(*) as c from emails where story_id=$1', [params.id]))[0].c,
        10,
      );
      if (sendCount >= 3) {
        return NextResponse.json({ error: 'This story has reached its email limit.' }, { status: 429 });
      }
    }

    const followUp = !!b.follow_up;

    // Upsert — new row or update follow_up on re-send
    await q(
      `insert into emails (id, story_id, email, follow_up, created_at)
       values ($1, $2, $3, $4, now())
       on conflict (story_id, email) do update set follow_up = excluded.follow_up`,
      [newId(), params.id, email, followUp],
    );

    // Use client-provided reading when available; otherwise check DB, then generate
    let emailStory = story;
    if (b.readingRaw && typeof b.readingRaw === 'string' && b.readingRaw.length > 100) {
      emailStory = { ...story, reading: { raw: b.readingRaw } };
    } else if (!story.reading && story.body) {
      try {
        const reading = await generateReading(story, session);
        if (reading) emailStory = { ...story, reading };
      } catch (e) {
        console.warn('Reading generation for email failed:', e.message);
      }
    }

    // Build and send email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://story-map.themohammadkhan.com';
    const questions = getActiveQuestions(emailStory);
    const html = buildHtml(emailStory, session, questions, baseUrl);
    const headline = story.headline || '';
    const subject = headline
      ? `Your story: ${headline} · ${session.title || 'Story Map'}`
      : `Your story: ${session.title || 'Story Map'}`;

    if (process.env.MOCK_CLAUDE === '1') {
      console.log('\n--- MOCK EMAIL ---');
      console.log('To:', email);
      console.log('Subject:', subject);
      console.log(html.slice(0, 1000), '\n...(truncated)\n');
      console.log('--- END MOCK EMAIL ---\n');
    } else if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY.replace(/^﻿/, ''));
      const from = process.env.EMAIL_FROM || 'Story Map <stories@story-map.themohammadkhan.com>';
      const { error } = await resend.emails.send({ from, to: email, subject, html });
      if (error) {
        const msg = error.message || JSON.stringify(error);
        console.error('Resend error:', msg);
        return NextResponse.json({ error: `Resend: ${msg}` }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Email sending is not configured.' }, { status: 500 });
    }

    // Make CRM webhook — fire and forget, skip for test stories
    if (!story.is_test && process.env.MAKE_WEBHOOK_URL) {
      const ax = (session.axes && session.axes.x) || {};
      const ay = (session.axes && session.axes.y) || {};
      const xPole = story.x != null ? (story.x < 0 ? ax.low : ax.high) || '' : '';
      const yPole = story.y != null ? (story.y < 0 ? ay.low : ay.high) || '' : '';
      const quadrant = [xPole, yPole].filter(Boolean).join(' + ');
      const direction = arrowDirection(story, session.axes);
      const webhookMapUrl = `${baseUrl}/m/${story.session_id}`;
      const bigQ = session.big_question || session.prompt || '';
      const source = session.kind === 'session' ? 'session' : 'card';
      const payload = {
        name: (story.name || '').trim() || email,
        email,
        follow_up: followUp,
        status: 'To contact',
        known: 'Cold - 0 prior contact',
        intro_via: 'Story Map',
        source,
        notes: `${session.title || ''} | ${bigQ} | ${story.headline || ''} | Landed: ${quadrant} | Wants: ${direction || 'no direction'} | ${webhookMapUrl}`,
        created_at: new Date().toISOString(),
      };
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.MAKE_WEBHOOK_SECRET) headers['X-Story-Map-Secret'] = process.env.MAKE_WEBHOOK_SECRET;
      fetch(process.env.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).catch((e) => console.error('Make webhook failed:', e.message));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
