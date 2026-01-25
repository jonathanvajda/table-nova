/**
 * @file Shared typedefs (JSDoc types).
 */

/**
 * @typedef {'camelCase'|'PascalCase'|'snake_case'|'SHOUT_CASE'} PredicateCasing
 */

/**
 * @typedef {Object} PredicateOptions
 * @property {boolean} prefixHas
 * @property {PredicateCasing} casing
 * @property {'ordinal'|'index'} whenNoHeader
 */

/**
 * @typedef {Object} PreviewData
 * @property {string[]|null} header
 * @property {string[][]} rows
 */

/**
 * @typedef {Object} FileOptions
 * @property {boolean} treatFirstRowAsHeader
 * @property {(','|'\t'|null)} delimiterHint
 * @property {PredicateOptions} predicate
 * @property {PreviewData|null} preview
 * @property {Record<string, string>} datatypesByColumnKey
 */

/**
 * @typedef {Object} StagedFile
 * @property {string} id
 * @property {File} file
 * @property {FileOptions} options
 */

export {};
