import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Server-only authenticated read. The service role is never returned to a
 * browser; the caller's identity comes from auth.getUser(), not request JSON.
 */
export async function GET(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'Feature unavailable' }, { status: 503 });
  }

  const url = new URL(request.url);
  const curseId = url.searchParams.get('curseId');
  if (!curseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(curseId)) {
    return NextResponse.json({ error: 'Invalid curse ID' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Read-only route; auth refresh is handled by middleware.
        },
      },
    },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: rows, error: rpcError } = await admin.rpc('reveal_due_izzy_secret_curse', {
    p_curse_id: curseId,
    p_owner_id: data.user.id,
  });
  if (rpcError) {
    return NextResponse.json({ error: 'Unable to load consequence' }, { status: 503 });
  }
  const curse = Array.isArray(rows) ? rows[0] : null;
  if (!curse) {
    // Sealed, resolved, or unauthorized records are indistinguishable.
    return NextResponse.json({ curse: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    curse: {
      id: curse.curse_id,
      state: curse.curse_state,
      consequenceText: curse.consequence_text,
      revealedAt: curse.revealed_at,
      seenAt: curse.seen_at,
      changed: curse.changed,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
