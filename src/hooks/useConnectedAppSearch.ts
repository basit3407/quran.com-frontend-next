import useSWR from 'swr';

import useDebounce from './useDebounce';

import { AppTile, isValidAppSearch, normalizeAppSearch } from '@/utils/connectedApps';

const fetchSearch = async (url: string): Promise<AppTile[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Search unavailable');
    const body = await response.json();
    if (!Array.isArray(body.apps)) throw new Error('Invalid search response');
    return body.apps;
  } finally {
    clearTimeout(timeout);
  }
};

interface ConnectedAppSearchResult {
  apps: AppTile[];
  loading: boolean;
  error: boolean;
  invalid: boolean;
  retry: () => void;
}

const useConnectedAppSearch = (query: string, locale: string): ConnectedAppSearchResult => {
  const normalizedQuery = normalizeAppSearch(query);
  const debouncedQuery = useDebounce(normalizedQuery, 300);
  const valid = isValidAppSearch(normalizedQuery);
  const settled = normalizedQuery === debouncedQuery;
  const key =
    valid && settled
      ? `/api/connected-apps/search?${new URLSearchParams({ q: debouncedQuery, locale })}`
      : null;
  // SWR keys bind both q and locale; an old request cannot replace the current key's result.
  const { data, error, mutate } = useSWR<AppTile[]>(key, fetchSearch, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  return {
    apps: key && !error ? data || [] : [],
    loading: valid && (!settled || (!data && !error)),
    error: !!key && !!error,
    invalid: !!query.trim() && !valid,
    retry: () => {
      mutate();
    },
  };
};

export default useConnectedAppSearch;
