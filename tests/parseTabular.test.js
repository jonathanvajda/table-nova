import { detectTabularType } from '../docs/app/tabular/parseTabular.js';
import {
  applyHeaderRowOptions,
  detectCsvOrTsvDelimiter,
  parseDelimitedLine,
  parseDelimitedTextAsHeaderRows
} from '../docs/app/shared/tabular-io/index.js';

test('detectTabularType detects extensions', () => {
  expect(detectTabularType('a.csv')).toBe('csv');
  expect(detectTabularType('a.tsv')).toBe('tsv');
  expect(detectTabularType('a.xlsx')).toBe('xlsx');
  expect(detectTabularType('a.unknown')).toBe('unknown');
});

test('shared detectCsvOrTsvDelimiter prefers tabs when more tabs than commas', () => {
  expect(detectCsvOrTsvDelimiter('a,b,c')).toBe(',');
  expect(detectCsvOrTsvDelimiter('a\tb\tc')).toBe('\t');
});

test('shared parseDelimitedLine supports quotes and escaped quotes', () => {
  expect(parseDelimitedLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
  expect(parseDelimitedLine('"a""b",c', ',')).toEqual(['a"b', 'c']);
});

test('shared parseDelimitedTextAsHeaderRows returns header + rows', () => {
  const t = 'first,last\nAda,Lovelace\nAlan,Turing\n';
  const out = parseDelimitedTextAsHeaderRows(t, ',');
  expect(out.header).toEqual(['first', 'last']);
  expect(out.rows).toEqual([['Ada', 'Lovelace'], ['Alan', 'Turing']]);
});

test('applyHeaderRowOptions can choose a later 1-based header row', () => {
  const parsed = parseDelimitedTextAsHeaderRows('Report export\nGenerated today\nfirst,last\nAda,Lovelace\n', ',');
  const out = applyHeaderRowOptions(parsed, true, 3);
  expect(out.header).toEqual(['first', 'last']);
  expect(out.rows).toEqual([['Ada', 'Lovelace']]);
});

test('applyHeaderRowOptions leaves no-header data unchanged', () => {
  const parsed = parseDelimitedTextAsHeaderRows('a,b\n1,2\n', ',');
  const out = applyHeaderRowOptions(parsed, false, 2);
  expect(out).toBe(parsed);
});
