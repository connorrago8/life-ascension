import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, authenticationErrorResponse } from '../../../lib/apiKeyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return authenticationErrorResponse(auth);
  return NextResponse.json(
    { user_id: auth.userId, auth_method: auth.method, scopes: auth.scopes },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
