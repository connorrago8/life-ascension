import { engagementJson } from '../../../../lib/push/http';
import { publicVapidKey, pushIsConfigured } from '../../../../lib/push/serverConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = pushIsConfigured();
  return engagementJson({ configured, publicKey: configured ? publicVapidKey() : null });
}
