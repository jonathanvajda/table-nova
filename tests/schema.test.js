import {
  slugify,
  toExcelLetters,
  buildColumnKeys,
  buildPredicateLocalName,
  tokenizeWords
} from '../app/rdf/schema.js';

test('slugify creates safe slugs', () => {
  expect(slugify('My File (v1).csv')).toBe('my-file-v1-csv');
});

test('toExcelLetters converts indexes', () => {
  expect(toExcelLetters(0)).toBe('A');
  expect(toExcelLetters(25)).toBe('Z');
  expect(toExcelLetters(26)).toBe('AA');
  expect(toExcelLetters(27)).toBe('AB');
});

test('buildColumnKeys uses header when enabled', () => {
  const keys = buildColumnKeys(['first name', 'email address'], [['Ada', 'a@b']], true);
  expect(keys).toEqual(['first name', 'email address']);
});

test('buildColumnKeys uses ordinals when no header', () => {
  const keys = buildColumnKeys(['x','y','z'], [['1','2','3']], false);
  expect(keys).toEqual(['ColumnA', 'ColumnB', 'ColumnC']);
});

test('tokenizeWords splits punctuation and underscores', () => {
  expect(tokenizeWords('has email_address!!')).toEqual(['has', 'email', 'address']);
});

test('buildPredicateLocalName respects casing and has-prefix', () => {
  const opts = { prefixHas: true, casing: 'camelCase', whenNoHeader: 'ordinal' };
  expect(buildPredicateLocalName('email address', opts)).toBe('hasEmailAddress');

  const opts2 = { prefixHas: true, casing: 'PascalCase', whenNoHeader: 'ordinal' };
  expect(buildPredicateLocalName('email address', opts2)).toBe('HasEmailAddress');

  const opts3 = { prefixHas: true, casing: 'snake_case', whenNoHeader: 'ordinal' };
  expect(buildPredicateLocalName('email address', opts3)).toBe('has_email_address');

  const opts4 = { prefixHas: false, casing: 'camelCase', whenNoHeader: 'ordinal' };
  expect(buildPredicateLocalName('email address', opts4)).toBe('emailAddress');
});
