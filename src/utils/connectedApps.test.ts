import { describe, expect, it } from 'vitest';

import {
  isValidAppSearch,
  mergeAppSearchResults,
  normalizeAppSearch,
  projectPublicAppSearch,
} from './connectedApps';

import { indexedCard } from '@/tests/helpers/connected-app-card';

describe('Connected App presentation', () => {
  it('normalizes compatibility text, punctuation, case, and Unicode lengths', () => {
    expect(normalizeAppSearch(' ＱＵＲＡＮ—Study__TOOLS\t\n')).toBe('quran study tools');
    expect(isValidAppSearch('a—')).toBe(false);
    expect(isValidAppSearch('قرآن')).toBe(true);
    expect(isValidAppSearch('x'.repeat(100))).toBe(true);
    expect(isValidAppSearch('x'.repeat(101))).toBe(false);
  });

  it('preserves localized plain text, does not inject HTML, and strips private category fields', () => {
    const [card] = projectPublicAppSearch({
      apps: [
        {
          ...indexedCard,
          title: 'دراسة القرآن',
          description: '<script>alert(1)</script>',
          owner: 'private',
          categories: [
            { slug: 'study-tools', active: true, internalNote: 'private' },
            { slug: 'community', active: false },
            { slug: 'internal-category', active: true },
          ],
        },
      ],
    });
    expect(card.title).toBe('دراسة القرآن');
    expect(card.description).toBe('<script>alert(1)</script>'); // React renders plain text.
    expect(card.categories).toEqual(['study-tools']);
    expect(JSON.stringify(card)).not.toContain('private');
  });

  it('never projects inherited platform names as destination fields', () => {
    const [card] = projectPublicAppSearch({
      apps: [
        {
          ...indexedCard,
          links: [
            ...indexedCard.links,
            { platform: '__proto__', url: 'https://foreign.example/' },
            { platform: 'toString', url: 'https://foreign.example/' },
          ],
        },
      ],
    });
    expect(Object.keys(card).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'tagline',
        'iconSrc',
        'iconAlt',
        'categories',
        'webHref',
      ].sort(),
    );
  });

  it('rejects encoded icon traversal out of the static image surface', () => {
    ['/images/%2e%2e/api/private', '/images/%5c..%5capi/private'].forEach((icon) => {
      expect(() => projectPublicAppSearch({ apps: [{ ...indexedCard, iconUrl: icon }] })).toThrow();
    });
  });

  it('deduplicates stable IDs and official destinations across legacy and published results', () => {
    const [card] = projectPublicAppSearch({ apps: [indexedCard] });
    const legacy = { ...card, id: 'legacy-companion', webHref: 'https://example.com/companion/' };
    expect(mergeAppSearchResults([legacy], [card])).toEqual([legacy]);
    expect(mergeAppSearchResults([], [card, card])).toEqual([card]);
    expect(
      mergeAppSearchResults([legacy], [{ ...card, webHref: 'https://other.example/' }]),
    ).toHaveLength(2);
  });
});
