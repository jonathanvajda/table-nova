import { detectTabularType, parseLine, parseCsvOrTsvText, detectDelimiterFromLine } from '../app/tabular/parseTabular.js';

test('detectTabularType detects extensions', () => {
  expect(detectTabularType('a.csv')).toBe('csv');
  expect(detectTabularType('a.tsv')).toBe('tsv');
  expect(detectTabularType('a.xlsx')).toBe('xlsx');
  expect(detectTabularType('a.unknown')).toBe('unknown');
});

test('detectDelimiterFromLine prefers tabs when more tabs than commas', () => {
  expect(detectDelimiterFromLine('a,b,c')).toBe(',');
  expect(detectDelimiterFromLine('a\tb\tc')).toBe('\t');
});

test('parseLine supports quotes and escaped quotes', () => {
  expect(parseLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
  expect(parseLine('"a""b",c', ',')).toEqual(['a"b', 'c']);
});

test('parseCsvOrTsvText returns header + rows', () => {
  const t = 'first,last\nAda,Lovelace\nAlan,Turing\n';
  const out = parseCsvOrTsvText(t, ',');
  expect(out.header).toEqual(['first', 'last']);
  expect(out.rows).toEqual([['Ada', 'Lovelace'], ['Alan', 'Turing']]);
});
