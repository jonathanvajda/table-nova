// docs/scripts/config.js

/**
 * Centralized configuration and IRI constants.
 */

import { namespacePrefixMapFromRegistry } from '../app/shared/namespace-registry/namespace-registry.js';

const STANDARD_PREFIXES = namespacePrefixMapFromRegistry();

export const NS = {
  rdf: STANDARD_PREFIXES.rdf,
  rdfs: STANDARD_PREFIXES.rdfs,
  owl: STANDARD_PREFIXES.owl,
  dcterms: STANDARD_PREFIXES.dcterms,
  cco: STANDARD_PREFIXES.cco2,
  bfo: STANDARD_PREFIXES.obo,
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
