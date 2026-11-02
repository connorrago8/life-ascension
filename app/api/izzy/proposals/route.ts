import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !secret) {
    return NextResponse.json({ error: 'Inbox unavailable' }, { status: 503 });
  }
  const store = await cookies();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {},
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: proposals, error: readError } = await admin.rpc(
    'list_owned_izzy_proposals',
    { p_owner_id: data.user.id },
  );
  if (readError) {
    return NextResponse.json({ error: 'Unable to load inbox' }, { status: 503 });
  }
  return NextResponse.json(
    { proposals: proposals ?? [] },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !secret) {
    return NextResponse.json({ error: 'Inbox unavailable' }, { status: 503 });
  }
  const store = await cookies();
  const client = createServerClient(url, anon, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const proposalId = body?.proposalId;
  const companionId = body?.companionId;
  const dueDate = body?.dueDate;
  if (!Number.isSafeInteger(proposalId) || proposalId < 1 ||
      typeof companionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companionId) ||
      typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: 'Invalid approval request' }, { status: 400 });
  }
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: questId, error: approvalError } = await admin.rpc(
    'approve_owned_izzy_proposal',
    { p_owner_id: data.user.id, p_proposal_id: proposalId,
      p_companion_id: companionId, p_due_date: dueDate },
  );
  if (approvalError) {
    return NextResponse.json({ error: 'Unable to approve proposal' }, { status: 409 });
  }
  return NextResponse.json({ questId }, { headers: { 'Cache-Control': 'private, no-store' } });
}
