export interface AppLinks {
  androidHref?: string;
  iosHref?: string;
  webHref?: string;
}

export type AppCategory =
  | 'study-tools'
  | 'reflections'
  | 'popular'
  | 'quran-reader'
  | 'community'
  | 'hadith-sunnah'
  | 'audio';

export interface AppTile extends AppLinks {
  id: string;
  title: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  categories: AppCategory[];
  tagline?: string;
}

export const SEARCH_LIMIT = 20;

// Match Rust's char::is_alphanumeric: Alphabetic (including Other_Alphabetic marks) | Number.
// The repository targets ES5 in tsc; the runtime supports Unicode property escapes.
// eslint-disable-next-line prefer-regex-literals
const SEARCH_SEPARATOR = new RegExp('[^\\p{Alphabetic}\\p{N}]+', 'gu');

export const normalizeAppSearch = (value: string): string =>
  // Platform lowercases each NFKC scalar independently, without contextual final sigma casing.
  Array.from(value.normalize('NFKC'), (character) => character.toLowerCase())
    .join('')
    .replace(SEARCH_SEPARATOR, ' ')
    .trim();

export const isValidAppSearch = (value: string): boolean => {
  const { length } = Array.from(normalizeAppSearch(value));
  return length >= 2 && length <= 100;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const requiredText = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) {
    throw new Error('Invalid public app card');
  }
  return value;
};

const publicUrl = (value: unknown): string => {
  const raw = requiredText(value, 2048);
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid public app URL');
  }
  return url.href;
};

const iconUrl = (value: unknown): string => {
  const raw = requiredText(value, 2048);
  // Relative images must stay on the static /images surface, never the API.
  const decoded = decodeURIComponent(raw);
  if (/^\/images\/[\w./%-]+$/.test(raw) && !decoded.includes('..') && !decoded.includes('\\')) {
    return raw;
  }
  return publicUrl(raw);
};

const CATEGORIES: AppCategory[] = [
  'study-tools',
  'reflections',
  'popular',
  'quran-reader',
  'community',
  'hadith-sunnah',
  'audio',
];

const projectCard = (value: unknown): AppTile => {
  if (!isRecord(value) || !Array.isArray(value.links) || !Array.isArray(value.categories)) {
    throw new Error('Invalid public app card');
  }
  const id = requiredText(value.id, 36);
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    throw new Error('Invalid public app ID');
  }
  const links: AppLinks = {};
  value.links.forEach((link) => {
    if (!isRecord(link)) throw new Error('Invalid public app link');
    // Exact platform checks avoid inherited object keys becoming presentation fields.
    if (link.platform === 'web') links.webHref = publicUrl(link.url);
    if (link.platform === 'ios') links.iosHref = publicUrl(link.url);
    if (link.platform === 'android') links.androidHref = publicUrl(link.url);
  });
  if (!Object.keys(links).length) throw new Error('Missing public app destination');
  const categories = value.categories.flatMap((category) => {
    if (!isRecord(category) || category.active !== true) return [];
    return CATEGORIES.includes(category.slug as AppCategory) ? [category.slug as AppCategory] : [];
  });
  return {
    id,
    title: requiredText(value.title, 200),
    description: typeof value.description === 'string' ? value.description.slice(0, 2000) : '',
    tagline: typeof value.tagline === 'string' ? value.tagline.slice(0, 500) : undefined,
    iconSrc: iconUrl(value.iconUrl),
    iconAlt: requiredText(value.iconAlt, 500),
    categories,
    ...links,
  };
};

// Never spread upstream objects: review/owner/status/provenance data is not presentation data.
// Publication authorization is exclusively Platform's published-only endpoint, not a client flag.
export const projectPublicAppSearch = (value: unknown): AppTile[] => {
  if (!isRecord(value) || !Array.isArray(value.apps) || value.apps.length > SEARCH_LIMIT) {
    throw new Error('Invalid public app search response');
  }
  return value.apps.map(projectCard);
};

const destinationIdentity = (value: string): string => {
  const url = new URL(value);
  url.hash = '';
  ['hl', 'utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => url.searchParams.delete(key));
  url.searchParams.sort();
  return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`;
};

export const mergeAppSearchResults = (legacy: AppTile[], published: AppTile[]): AppTile[] => {
  const ids = new Set<string>();
  const destinations = new Set<string>();
  return [...legacy, ...published].filter((app) => {
    const urls = [app.webHref, app.iosHref, app.androidHref]
      .filter(Boolean)
      .map(destinationIdentity);
    if (ids.has(app.id) || urls.some((url) => destinations.has(url))) return false;
    ids.add(app.id);
    urls.forEach((url) => destinations.add(url));
    return true;
  });
};
