import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NAME = 'sm_test';
const opts = (maxAge) => ({
  httpOnly: false,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export async function GET() {
  if (!isAdmin()) return denied();
  try {
    const c = cookies().get(NAME);
    return NextResponse.json({ testMode: c?.value === '1' });
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  if (!isAdmin()) return denied();
  try {
    const b = await req.json().catch(() => ({}));
    const res = NextResponse.json({ ok: true });
    if (b.on) {
      res.cookies.set(NAME, '1', opts(60 * 60 * 24 * 30));
    } else {
      res.cookies.set(NAME, '', opts(0));
    }
    return res;
  } catch (e) { return fail(e); }
}
