import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { imageStillHasExif, stripImageMeta } from '../../../../lib/stripImageMeta';
import { readServerSupabaseConfig } from '../../../../lib/supabaseRuntimeConfig';
import { applyPendingCookies, readSessionUser } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 1_500_000;

export async function POST(request: NextRequest) {
  const session = await readSessionUser(request);
  if (!session.user) {
    return applyPendingCookies(NextResponse.json({ error: 'Sign-in required' }, { status: 401 }), session.pendingCookies);
  }
  const config = await readServerSupabaseConfig();
  if (!config) {
    return applyPendingCookies(NextResponse.json({ error: 'Storage is not configured' }, { status: 503 }), session.pendingCookies);
  }
  const form = await request.formData();
  const instanceId = String(form.get('instanceId') ?? '');
  const photo = form.get('photo');
  if (!/^[0-9a-f-]{36}$/i.test(instanceId) || !(photo instanceof File)) {
    return applyPendingCookies(NextResponse.json({ error: 'Choose a photo for a finished quest.' }, { status: 400 }), session.pendingCookies);
  }
  if (!TYPES.has(photo.type) || photo.size < 1 || photo.size > MAX_BYTES) {
    return applyPendingCookies(NextResponse.json({ error: 'Use a JPEG, PNG, or WebP under 1.5 MB.' }, { status: 400 }), session.pendingCookies);
  }
  const clean = stripImageMeta(new Uint8Array(await photo.arrayBuffer()), photo.type);
  if (imageStillHasExif(clean)) {
    return applyPendingCookies(NextResponse.json({ error: 'That photo still has hidden details.' }, { status: 400 }), session.pendingCookies);
  }
  const client = createServerClient(config.url, config.key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const quest = await client.from('companion_quests').select('bond_id, status').eq('instance_id', instanceId).maybeSingle();
  if (quest.error || !quest.data || quest.data.status !== 'completed') {
    return applyPendingCookies(NextResponse.json({ error: 'Finish the quest first.' }, { status: 409 }), session.pendingCookies);
  }
  const path = `${quest.data.bond_id}/${instanceId}`;
  const uploaded = await client.storage.from('companion-proof').upload(path, clean, { contentType: photo.type, upsert: false });
  if (uploaded.error && !/already exists/i.test(uploaded.error.message)) {
    return applyPendingCookies(NextResponse.json({ error: 'The photo could not be saved.' }, { status: 502 }), session.pendingCookies);
  }
  const registered = await client.rpc('companion_register_proof', {
    p_instance: instanceId, p_path: path, p_type: photo.type, p_bytes: clean.byteLength,
  });
  if (registered.error) {
    return applyPendingCookies(NextResponse.json({ error: 'The photo could not be saved.' }, { status: 403 }), session.pendingCookies);
  }
  return applyPendingCookies(NextResponse.json({ saved: true }), session.pendingCookies);
}
