const HOST = /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::\d{1,5})?$/i;

type OriginSource = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string };
};

/** Public origin for redirects. Prefer the forwarded host so a preview stays on that preview. */
export function requestOrigin(request: OriginSource): string {
  const forwardedHost = firstHeader(request.headers.get('x-forwarded-host'));
  const forwardedProto = firstHeader(request.headers.get('x-forwarded-proto'));
  if ((forwardedProto === 'http' || forwardedProto === 'https') && HOST.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

function firstHeader(value: string | null): string {
  return value?.split(',')[0]?.trim() ?? '';
}
