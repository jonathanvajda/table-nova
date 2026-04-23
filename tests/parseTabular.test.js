import { applyHeaderRowOptions, detectTabularType, parseLine, parseCsvOrTsvText, detectDelimiterFromLine } from '../docs/app/tabular/parseTabular.js';

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

test('applyHeaderRowOptions can choose a later 1-based header row', () => {
  const parsed = parseCsvOrTsvText('Report export\nGenerated today\nfirst,last\nAda,Lovelace\n', ',');
  const out = applyHeaderRowOptions(parsed, true, 3);
  expect(out.header).toEqual(['first', 'last']);
  expect(out.rows).toEqual([['Ada', 'Lovelace']]);
});

test('applyHeaderRowOptions leaves no-header data unchanged', () => {
  const parsed = parseCsvOrTsvText('a,b\n1,2\n', ',');
  const out = applyHeaderRowOptions(parsed, false, 2);
  expect(out).toBe(parsed);
});
