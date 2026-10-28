// Read-only, Preview-only source-routing probe for deployment-bound QA review.
// This does not attest hosted database isolation or authorize migrations.
import { readServerSupabaseConfig } from '../../../lib/supabaseRuntimeConfig';
import { createServiceRoleClient } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };
const QA_URL = 'https://njqwwimzrsunheehnnnt.supabase.co';
// Only the founder-designated protected QA branch can attest QA routing.
const QA_BRANCH = 'audit/qa-isolation-and-reliability-20261027';

export async function GET(): Promise<Response> {
  // No diagnostic endpoint in Production, local development, or unknown targets.
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview') {
    return new Response(null, { status: 404, headers: noStore });
  }

  try {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    const config = await readServerSupabaseConfig();
    // A valid server public config is not sufficient if a privileged Preview
    // client can be constructed. Never return or log either credential.
    const privilegedDenied = createServiceRoleClient() === null;
    if (!sha || !/^[a-f0-9]{40}$/i.test(sha) ||
        process.env.VERCEL_GIT_COMMIT_REF !== QA_BRANCH ||
        config?.url !== QA_URL || !privilegedDenied) {
      return Response.json({ status: 'blocked' }, { status: 503, headers: noStore });
    }
    return Response.json({
      status: 'source-routing-guard-pass',
      sha,
      serverPublicTarget: 'qa',
      privilegedClient: 'denied',
      scope: 'runtime-configuration-only',
    }, { headers: noStore });
  } catch {
    return Response.json({ status: 'blocked' }, { status: 503, headers: noStore });
  }
}
