const SILVERFORT_GRAPHQL_ENDPOINT = 'https://api.cloudplatform.app.silverfort.com/graphql';
const PRODUCTION_ORIGIN = 'https://benji1703.github.io';

export function isAllowedOrigin(origin) {
  if (origin === PRODUCTION_ORIGIN) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin ?? '');
}

export default async function handler(request, response) {
  const origin = request.headers.origin;
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!isAllowedOrigin(origin)) {
    return response.status(403).json({ errors: [{ message: 'This relay does not allow the requesting origin.' }] });
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Organization');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ errors: [{ message: 'Only POST is supported.' }] });

  const authorization = request.headers.authorization;
  const organization = request.headers.organization;
  if (!authorization || !organization) {
    return response.status(400).json({ errors: [{ message: 'Organization and Authorization headers are required.' }] });
  }

  try {
    const upstream = await fetch(SILVERFORT_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        Organization: organization,
        'Content-Type': 'application/json',
      },
      body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {}),
    });
    const body = await upstream.text();
    response.status(upstream.status);
    response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json; charset=utf-8');
    return response.send(body);
  } catch {
    return response.status(502).json({ errors: [{ message: 'The Silverfort GraphQL endpoint could not be reached.' }] });
  }
}
