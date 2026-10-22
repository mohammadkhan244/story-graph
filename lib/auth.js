import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const COOKIE = 'sm_admin';

export function adminToken() {
  return crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update('story-map-admin-v1').digest('hex');
}

export function passwordOk(pw) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const c = cookies().get(COOKIE);
  if (!c) return false;
  const a = Buffer.from(c.value), b = Buffer.from(adminToken());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function denied() {
  return NextResponse.json({ error: 'Not signed in as admin' }, { status: 401 });
}

export function fail(e, status = 500) {
  console.error(e);
  return NextResponse.json({ error: String((e && e.message) || e) }, { status });
}
