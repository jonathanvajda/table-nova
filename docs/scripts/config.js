// docs/scripts/config.js

/**
 * Centralized configuration and IRI constants.
 */

export const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  dcterms: 'http://purl.org/dc/terms/',
  cco: 'https://www.commoncoreontologies.org/',
  bfo: 'http://purl.obolibrary.org/obo/',
  ex: 'https://example.org/doc-inst/'
};

export const IRI = {
  namedIndividual: NS.owl + 'NamedIndividual',
  informationContentEntity: NS.cco + 'ont00000958',
  hasTextValue: NS.cco + 'ont00001765',
  hasContinuantPart: NS.bfo + 'BFO_0000178',
  continuantPartOf: NS.bfo + 'BFO_0000176',
  dctermsType: NS.dcterms + 'type',
  label: NS.rdfs + 'label',

  hasSiblingIndex: NS.ex + 'has_sibling_index',
  hasImmediatelyPriorDocumentPart: NS.ex + 'has_immediately_prior_document_part',
  hasImmediatelyPosteriorDocumentPart: NS.ex + 'has_immediately_posterior_document_part',
  hasStyleName: NS.ex + 'has_style_name',
  hasStyleId: NS.ex + 'has_style_id',
  hasHeadingLevel: NS.ex + 'has_heading_level'
};

export const PART_TYPES_WITH_TEXT_VALUE = new Set([
  'paragraph',
  'sentence',
  'word',
  'list_item',
  'header',
  'footer',
  'table_cell'
]);

export const HEADING_STYLE_PATTERN = /heading\s*([1-9][0-9]*)/i;