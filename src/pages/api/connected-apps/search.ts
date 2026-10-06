import { createHash } from 'crypto';

import { NextApiRequest, NextApiResponse } from 'next';

import {
  isValidAppSearch,
  normalizeAppSearch,
  projectPublicAppSearch,
  SEARCH_LIMIT,
} from '@/utils/connectedApps';

const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 256 * 1024;

const readPublicResponse = async (response: Response): Promise<unknown> => {
  if (!response.body) throw new Error('Missing response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    // Bounded even when upstream omits or lies about Content-Length.
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel();
  }
};

const searchEndpoint = (): URL => {
  // This is a dedicated direct Platform public-read origin, NOT the general cookie proxy.
  const url = new URL(process.env.CONNECTED_APPS_PLATFORM_ORIGIN || '');
  const localFixture =
    process.env.NODE_ENV === 'development' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (!localFixture && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Invalid configuration');
  }
  return new URL('/v1/public/connected-apps/search', url);
};

// eslint-disable-next-line react-func/max-lines-per-function
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const { q, locale = 'en' } = req.query;
  if (
    typeof q !== 'string' ||
    q.length > 1000 ||
    !isValidAppSearch(q) ||
    typeof locale !== 'string' ||
    !/^[a-zA-Z0-9-]{1,32}$/.test(locale) ||
    Object.keys(req.query).some((key) => !['q', 'locale'].includes(key))
  ) {
    res.status(400).json({ error: 'invalid_search' });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = searchEndpoint();
    const token = process.env.CONNECTED_APPS_PUBLIC_READ_TOKEN?.trim();
    // Fail closed rather than accidentally using ambient credentials or direct unauthenticated access.
    if (!token) throw new Error('Missing configuration');
    const normalizedQuery = normalizeAppSearch(q);
    const normalizedLocale = locale.toLowerCase();
    url.search = new URLSearchParams({
      q: normalizedQuery,
      locale: normalizedLocale,
      limit: String(SEARCH_LIMIT),
    }).toString();
    const upstream = await fetch(url, {
      method: 'GET',
      // Exact Platform public-read header. No browser headers are forwarded.
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: { Accept: 'application/json', 'x-api-gateway-token': token },
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!upstream.ok) throw new Error('Public search unavailable');
    const body = { apps: projectPublicAppSearch(await readPublicResponse(upstream)) };
    // ETag represents only the redacted presentation, and binds query, locale, and fixed limit.
    const digest = createHash('sha256')
      .update(JSON.stringify([normalizedQuery, normalizedLocale, SEARCH_LIMIT, body]))
      .digest('hex');
    const etag = `"connected-apps:${digest}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
    const candidates = String(req.headers['if-none-match'] || '')
      .split(',')
      .map((value) => value.trim().replace(/^W\//, ''));
    if (candidates.includes(etag) || candidates.includes('*')) {
      res.status(304).end();
      return;
    }
    res.status(200).json(body);
  } catch {
    // Never return/log an upstream body, URL, headers, credential, or exception message.
    res.status(503).json({ error: 'search_unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}
