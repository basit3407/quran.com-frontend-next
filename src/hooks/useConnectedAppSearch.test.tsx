/* eslint-disable react-func/max-lines-per-function */
import React from 'react';

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useConnectedAppSearch from './useConnectedAppSearch';

import { appSearchQueryCases } from '@/tests/helpers/connected-app-search-query';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children,
  );
const reply = (title: string) => ({ ok: true, json: async () => ({ apps: [{ title }] }) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('published app search client', () => {
  it.each(appSearchQueryCases)(
    'uses the Platform-normalized SWR query and validation for $query',
    async ({ query, expected, valid }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply('Indexed Companion')));
      const { result, rerender } = renderHook(({ q }) => useConnectedAppSearch(q, 'ar'), {
        initialProps: { q: query },
        wrapper,
      });
      expect(result.current.invalid).toBe(!valid);
      if (!valid) {
        expect(fetch).not.toHaveBeenCalled();
        return;
      }
      await waitFor(() => expect(result.current.apps[0]?.title).toBe('Indexed Companion'));
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(
        `/api/connected-apps/search?${new URLSearchParams({ q: expected, locale: 'ar' })}`,
      );
      expect(options.credentials).toBe('omit');
      rerender({ q: expected });
      expect(result.current.apps[0]?.title).toBe('Indexed Companion');
      expect(result.current.loading).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('never fetches or retains Indexed results for an empty query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply('Indexed Companion')));
    const { result, rerender } = renderHook(({ q }) => useConnectedAppSearch(q, 'en'), {
      initialProps: { q: '' },
      wrapper,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.apps).toEqual([]);
    rerender({ q: 'indexed' });
    await waitFor(() => expect(result.current.apps[0]?.title).toBe('Indexed Companion'));
    rerender({ q: '' });
    expect(result.current.apps).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('ignores an older query response that finishes after the latest request', async () => {
    let finishOld: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('q=older')) {
          return new Promise((resolve) => {
            finishOld = resolve;
          });
        }
        return Promise.resolve(reply('Newest Companion'));
      }),
    );
    const { result, rerender } = renderHook(({ q }) => useConnectedAppSearch(q, 'en'), {
      initialProps: { q: 'older' },
      wrapper,
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ q: 'newest' });
    expect(result.current.apps).toEqual([]);
    await waitFor(() => expect(result.current.apps[0]?.title).toBe('Newest Companion'));
    await act(async () => {
      finishOld(reply('Older Companion'));
    });
    expect(result.current.apps[0]?.title).toBe('Newest Companion');
  });

  it('ignores an older locale response, exposes errors, and supports a bounded explicit retry', async () => {
    let finishEnglish: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('locale=en')) {
          return new Promise((resolve) => {
            finishEnglish = resolve;
          });
        }
        return Promise.resolve({ ok: false });
      }),
    );
    const { result, rerender } = renderHook(
      ({ locale }) => useConnectedAppSearch('indexed', locale),
      { initialProps: { locale: 'en' }, wrapper },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ locale: 'ar' });
    await waitFor(() => expect(result.current.error).toBe(true));
    await act(async () => {
      finishEnglish(reply('English stale'));
    });
    expect(result.current.apps).toEqual([]);
    vi.mocked(fetch).mockResolvedValue(reply('Arabic current') as unknown as Response);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.apps[0]?.title).toBe('Arabic current'));
  });

  it('shows validation rather than false empty results for invalid nonempty queries', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderHook(() => useConnectedAppSearch('---', 'en'), { wrapper });
    expect(result.current.invalid).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
