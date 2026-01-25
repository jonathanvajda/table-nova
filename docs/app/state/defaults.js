/**
 * @file Default app settings and namespace bases.
 */

export const TABLENOVA_DEFAULTS = Object.freeze({
  // Swap these bases later when you have a real domain.
  baseInstanceIri: 'https://example.org/TableNova/id/',
  basePredicateIri: 'https://example.org/TableNova/ns#',
  baseRunIri: 'https://example.org/TableNova/run/',

  prefixes: {
    table-nova: 'https://example.org/TableNova/ns#',
    owid: 'https://example.org/TableNova/id/',
    xsd: 'http://www.w3.org/2001/XMLSchema#'
  },

  fileOptions: {
    treatFirstRowAsHeader: true,
    delimiterHint: null, // ',' or '\t' or null (auto)
    predicate: {
      prefixHas: true,
      casing: 'camelCase', // camelCase | PascalCase | snake_case | SHOUTCASE
      whenNoHeader: 'ordinal' // ordinal (A,B,AA...) or index (1..n) - MVP uses ordinal
    },
    // preview cached after user clicks Preview
    preview: null,
    // columnKey -> xsd datatype IRI
    datatypesByColumnKey: {}
  }
});
