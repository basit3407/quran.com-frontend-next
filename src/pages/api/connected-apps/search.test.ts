// @vitest-environment node
/* eslint-disable react-func/max-lines-per-function, @typescript-eslint/naming-convention, max-lines, no-script-url */
import { NextApiRequest, NextApiResponse } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from './search';

import { indexedCard } from '@/tests/helpers/connected-app-card';

const request = async (
  query: Record<string, unknown> = { q: 'Indexed', locale: 'en' },
  headers = {},
  method = 'GET',
) => {
  const result = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    setHeader: (key: string, value: string) => {
      result.headers[key] = value;
    },
    status: (code: number) => {
      result.status = code;
      return res;
    },
    json: (body: unknown) => {
      result.body = body;
    },
    end: () => {},
  };
  await handler(
    { query, headers, method } as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return result;
};

const upstream = (body: unknown = { apps: [indexedCard] }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.stubEnv('CONNECTED_APPS_PLATFORM_ORIGIN', 'https://platform.example');
  vi.stubEnv('CONNECTED_APPS_PUBLIC_READ_TOKEN', 'dummy-fixture-token');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => upstream()),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('public Connected Apps search adapter', () => {
  it('uses only the published public route, fixed limit, and server credential, ignoring foreign headers', async () => {
    const result = await request(
      { q: ' ＩＮＤＥＸＥＤ—Companion ', locale: 'AR' },
      {
        cookie: 'private-session',
        authorization: 'Bearer browser-secret',
        'x-api-gateway-token': 'foreign',
        'x-qf-admin-email': 'admin@example.com',
        'x-qf-user-id': 'private-user',
        'x-qf-service-permissions': 'admin',
      },
    );
    expect(result.status).toBe(200);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      'https://platform.example/v1/public/connected-apps/search?q=indexed+companion&locale=ar&limit=20',
    );
    expect(options).toMatchObject({
      headers: { Accept: 'application/json', 'x-api-gateway-token': 'dummy-fixture-token' },
      credentials: 'omit',
      redirect: 'error',
    });
    expect(Object.keys(options.headers)).toHaveLength(2);
  });

  it('allowlists presentation fields and never exposes review, draft, owner, or provenance fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      upstream({
        apps: [
          {
            ...indexedCard,
            developerNote: 'private note',
            ownerEmail: 'private@example.com',
            draftRevision: {},
            review: {},
            provenance: {},
            programStatus: 'indexed',
            publicationStatus: 'published',
          },
        ],
        internalToken: 'private',
      }),
    );
    const result = await request();
    expect(result.body).toEqual({
      apps: [
        {
          id: indexedCard.id,
          title: indexedCard.title,
          description: indexedCard.description,
          tagline: indexedCard.tagline,
          iconSrc: indexedCard.iconUrl,
          iconAlt: indexedCard.iconAlt,
          categories: ['study-tools'],
          webHref: 'https://example.com/companion',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|dummy-fixture-token|draftRevision|provenance/,
    );
    expect(result.headers['Set-Cookie']).toBeUndefined();
  });

  it.each([
    { q: '' },
    { q: 'a' },
    { q: '---' },
    { q: 'x'.repeat(101) },
    { q: ['indexed', 'other'] },
    { q: 'indexed', locale: ['en', 'ar'] },
    { q: 'indexed', locale: '../private' },
    { q: 'indexed', limit: '999' },
    { q: 'indexed', url: 'https://foreign.example' },
  ])('rejects malformed query %j without upstream access', async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts Unicode scalar boundaries and rejects non-GET requests', async () => {
    expect((await request({ q: 'قرآن' })).status).toBe(200);
    expect((await request({ q: 'x'.repeat(100) })).status).toBe(200);
    expect((await request({}, {}, 'POST')).status).toBe(405);
  });

  it('binds ETag/cache identity to query and locale and supports conditional reads', async () => {
    const base = await request();
    expect(base.headers['Cache-Control']).toContain('public');
    expect((await request({ q: 'Indexed', locale: 'ar' })).headers.ETag).not.toBe(
      base.headers.ETag,
    );
    expect((await request({ q: 'Companion' })).headers.ETag).not.toBe(base.headers.ETag);
    expect((await request(undefined, { 'if-none-match': `W/${base.headers.ETag}` })).status).toBe(
      304,
    );
  });

  it.each([401, 403, 500, 302])('redacts upstream failure %s', async (status) => {
    vi.mocked(fetch).mockResolvedValue(upstream({ secret: 'dummy-fixture-token' }, status));
    expect(await request()).toMatchObject({
      status: 503,
      body: { error: 'search_unavailable' },
      headers: { 'Cache-Control': 'no-store' },
    });
  });

  it.each([
    { apps: [{}] },
    { apps: Array(21).fill(indexedCard) },
    { private: 'sensitive' },
    { apps: [{ ...indexedCard, links: [{ platform: 'web', url: 'javascript:alert(1)' }] }] },
    { apps: [{ ...indexedCard, iconUrl: '/api/private' }] },
  ])('fails closed on malformed public data %j', async (body) => {
    vi.mocked(fetch).mockResolvedValue(upstream(body));
    expect((await request()).body).toEqual({ error: 'search_unavailable' });
  });

  it('bounds response size and redacts thrown transport errors', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('x'.repeat(256 * 1024 + 1)));
    expect((await request()).status).toBe(503);
    vi.mocked(fetch).mockRejectedValue(new Error('secret credentials https://private.example'));
    expect((await request()).body).toEqual({ error: 'search_unavailable' });
  });

  it('fails closed with missing credentials or unsafe configured origin', async () => {
    vi.stubEnv('CONNECTED_APPS_PUBLIC_READ_TOKEN', '');
    expect((await request()).status).toBe(503);
    vi.stubEnv('CONNECTED_APPS_PUBLIC_READ_TOKEN', 'dummy-fixture-token');
    vi.stubEnv('CONNECTED_APPS_PLATFORM_ORIGIN', 'http://foreign.example');
    expect((await request()).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('aborts a hung upstream within five seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(
      (url, options) =>
        new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = request();
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).status).toBe(503);
  });
});
