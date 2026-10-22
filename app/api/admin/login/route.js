import { NextResponse } from 'next/server';
import { COOKIE, adminToken, passwordOk, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ admin: isAdmin(), configured: !!process.env.ADMIN_PASSWORD });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'ADMIN_PASSWORD is not set on the server.' }, { status: 500 });
  if (!passwordOk(b.password)) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  const res = NextResponse.json({ admin: true });
  res.cookies.set(COOKIE, adminToken(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
