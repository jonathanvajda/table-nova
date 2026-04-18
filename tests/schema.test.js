import {
  slugify,
  toExcelLetters,
  buildColumnKeys,
  buildPredicateLocalName,
  tokenizeWords,
  detectHeaderStyle,
  buildColumnSchemas
} from '../docs/app/rdf/schema.js';

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

test('detectHeaderStyle recognizes common field naming schemes', () => {
  expect(detectHeaderStyle('Meeting Date')).toBe('human');
  expect(detectHeaderStyle('meetingDate')).toBe('camelCase');
  expect(detectHeaderStyle('MeetingDate')).toBe('PascalCase');
  expect(detectHeaderStyle('approval_date')).toBe('snake_case');
  expect(detectHeaderStyle('LOCATION')).toBe('SHOUT_CASE');
  expect(detectHeaderStyle('APPROVAL_DATE')).toBe('SHOUTING_SNAKE');
});

test('buildColumnSchemas normalizes labels, predicates, identifiers, and datatypes', () => {
  const schemas = buildColumnSchemas({
    header: ['meetingDate', 'location', 'approval_date'],
    rows: [['2026-01-01', 'Room 1', '2026-02-01']],
    treatFirstRowAsHeader: true,
    predicateOptions: { prefixHas: true, casing: 'snake_case', whenNoHeader: 'ordinal' },
    basePredicateIri: 'https://example.org/TableNova/',
    datatypesByColumnKey: {
      meetingDate: 'http://www.w3.org/2001/XMLSchema#date',
      approval_date: 'http://www.w3.org/2001/XMLSchema#date'
    }
  });

  expect(schemas.map((s) => s.predicateLocalName)).toEqual(['has_meeting_date', 'has_location', 'has_approval_date']);
  expect(schemas.map((s) => s.label)).toEqual(['Meeting Date', 'Location', 'Approval Date']);
  expect(schemas.map((s) => s.originalHeader)).toEqual(['meetingDate', 'location', 'approval_date']);
  expect(schemas[0].datatypeIri).toBe('http://www.w3.org/2001/XMLSchema#date');
  expect(schemas[1].datatypeIri).toBe('http://www.w3.org/2001/XMLSchema#string');
});

test('buildColumnSchemas supports editable label and predicate overrides', () => {
  const schemas = buildColumnSchemas({
    header: ['meetingDate'],
    rows: [['2026-01-01']],
    treatFirstRowAsHeader: true,
    predicateOptions: { prefixHas: true, casing: 'snake_case', whenNoHeader: 'ordinal' },
    basePredicateIri: 'https://example.org/TableNova/',
    columnSchemaOverridesByKey: {
      meetingDate: { label: 'Session Date', predicateLocalName: 'has_session_date' }
    }
  });

  expect(schemas[0].label).toBe('Session Date');
  expect(schemas[0].predicateLocalName).toBe('has_session_date');
  expect(schemas[0].predicateIri).toBe('https://example.org/TableNova/has_session_date');
});

test('buildColumnSchemas suffixes normalized predicate collisions', () => {
  const schemas = buildColumnSchemas({
    header: ['location', 'LOCATION'],
    rows: [['HQ', 'HQ']],
    treatFirstRowAsHeader: true,
    predicateOptions: { prefixHas: true, casing: 'snake_case', whenNoHeader: 'ordinal' },
    basePredicateIri: 'https://example.org/TableNova/'
  });

  expect(schemas.map((s) => s.predicateLocalName)).toEqual(['has_location', 'has_location_2']);
});
