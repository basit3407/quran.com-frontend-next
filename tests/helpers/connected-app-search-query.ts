// Expected values mirror Platform's NFKC -> scalar lowercase -> Alphabetic | Number contract.
// In particular, Alphabetic includes some combining marks, not only Unicode letters.
// eslint-disable-next-line import/prefer-default-export
export const appSearchQueryCases = [
  { query: 'اَ', expected: 'اَ', valid: true },
  { query: ' قُرْآن ', expected: 'قُرْآن', valid: true },
  { query: 'ΟΣ', expected: 'οσ', valid: true },
  { query: 'का', expected: 'का', valid: true },
  { query: 'שָ', expected: 'שָ', valid: true },
  { query: 'A\u0345', expected: 'a\u0345', valid: true },
  { query: ' ＱＵＲＡＮ—Study__TOOLS\t\n', expected: 'quran study tools', valid: true },
  { query: ' Ⅻ—½__١٢ ', expected: 'xii 1 2 ١٢', valid: true },
  { query: 'A\u0301—B', expected: 'á b', valid: true },
  { query: 'İ—AB', expected: 'i ab', valid: true },
  { query: '𐐀𐐁', expected: '𐐨𐐩', valid: true },
  { query: 'اَ'.repeat(50), expected: 'اَ'.repeat(50), valid: true },
  { query: `${'اَ'.repeat(50)}ا`, expected: `${'اَ'.repeat(50)}ا`, valid: false },
  { query: '𐐀'.repeat(100), expected: '𐐨'.repeat(100), valid: true },
  { query: '𐐀'.repeat(101), expected: '𐐨'.repeat(101), valid: false },
  { query: 'a—', expected: 'a', valid: false },
  { query: '---\t\n', expected: '', valid: false },
];
