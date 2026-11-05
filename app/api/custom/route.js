import { NextResponse } from 'next/server';
import { q, newId } from '@/lib/db';
import { fail } from '@/lib/auth';
import { matchCard, generateAxesForDecision } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// In-memory rate limit: 5 per IP per day. Resets at midnight UTC.
const rl = new Map();
function rateCheck(ip) {
  const now = Date.now();
  const v = rl.get(ip);
  const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
  if (v && v.resetAt > now) {
    if (v.count >= 5) return false;
    v.count++;
    return true;
  }
  rl.set(ip, { count: 1, resetAt: midnight.getTime() });
  return true;
}

export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));

    // Honeypot
    if (b._hp) return NextResponse.json({ ok: true });

    const text = String(b.text || '').trim().slice(0, 140);
    if (!text) return NextResponse.json({ error: 'Decision text is required.' }, { status: 400 });

    // Rate limit by IP (skip in test/mock mode)
    if (process.env.MOCK_CLAUDE !== '1') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      if (!rateCheck(ip)) return NextResponse.json({ error: 'Too many requests. Try again tomorrow.' }, { status: 429 });
    }

    // Try to match an existing card (unless caller forces custom path)
    if (!b.force) {
      const match = await matchCard(text);
      if (match.slug && match.question) {
        return NextResponse.json({ card: true, slug: match.slug, question: match.question });
      }
    }

    // Generate axes for the decision
    const axes = await generateAxesForDecision(text);
    const [ax, ay] = axes;

    const id = newId(8);
    const scene = `It's five years from now. ${text.endsWith('.') ? text.slice(0, -1) : text} has played out.`;
    const instructions = "Don't plan it. Don't make it good. Anything is valid. Keep going.";

    await q(
      `insert into sessions (id, title, prompt, instructions, scene, axes, status, kind, hidden, signals, minutes)
       values ($1, $2, $3, $4, $5, $6, 'open', 'visitor', true, '[]', 10)`,
      [id, text.slice(0, 120), text, instructions, scene, JSON.stringify({ x: ax, y: ay })]
    );

    return NextResponse.json({ id });
  } catch (e) { return fail(e); }
}
