import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin, denied, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  if (!isAdmin()) return denied();
  try {
    const r = await q('delete from stories where is_test = true returning id');
    return NextResponse.json({ deleted: r.length });
  } catch (e) { return fail(e); }
}
