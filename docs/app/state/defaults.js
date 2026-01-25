/**
 * @file Default app settings and namespace bases.
 */

export const TABLENOVA_DEFAULTS = Object.freeze({
  // Swap these bases later when you have a real domain.
  baseInstanceIri: 'https://example.org/TableNova/instance#',
  basePredicateIri: 'https://example.org/TableNova/',
  baseRunIri: 'https://example.org/TableNova/run#',

  prefixes: {
    tablenova: 'https://example.org/TableNova/',
    tablenovaid: 'https://example.org/TableNova/instance#',
    xsd: 'http://www.w3.org/2001/XMLSchema#'
  },

  fileOptions: {
    treatFirstRowAsHeader: true,
    delimiterHint: null, // ',' or '\t' or null (auto)
    predicate: {
      prefixHas: true,
      casing: 'camelCase', // camelCase | PascalCase | snake_case | SHOUT_CASE
      whenNoHeader: 'ordinal' // ordinal (A,B,AA...) or index (1..n) - MVP uses ordinal
    },
    // preview cached after user clicks Preview
    preview: null,
    // columnKey -> xsd datatype IRI
    datatypesByColumnKey: {}
  }
});
