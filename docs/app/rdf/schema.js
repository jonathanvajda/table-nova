/**
 * @file Table Nova RDF schema helpers (IRI + predicate building, literals).
 */

/**
 * @typedef {import('../state/types.js').PredicateOptions} PredicateOptions
 */

/**
 * Converts an arbitrary string into a URL-safe slug.
 * - Treats dots as separators (e.g., "file.tar.gz" -> "file-tar-gz").
 * - Collapses repeated separators.
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '-')              // dot becomes separator
    .replace(/\s+/g, '-')             // whitespace to separator
    .replace(/[^a-z0-9_-]+/g, '-')    // drop everything else -> separator
    .replace(/-+/g, '-')              // collapse runs
    .replace(/^-+|-+$/g, '')          // trim separators
    || 'file';
}

/**
 * Builds a run graph IRI that encodes filename and UTC midnight date stamp.
 * @param {{baseRunIri: string, filename: string, now: Date}} params
 * @returns {string}
 */
export function buildRunGraphIri({ baseRunIri, filename, now }) {
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const date = utc.toISOString().slice(0, 10); // YYYY-MM-DD
  const file = slugify(filename.replace(/\.[^.]+$/, ''));
  const base = ensureTrailingSlash(baseRunIri);
  return `${base}${date}/${file}`;
}

/**
 * Ensures a string ends with a slash.
 * @param {string} iri
 * @returns {string}
 */
export function ensureTrailingSlash(iri) {
  const s = String(iri ?? '');
  return s.endsWith('/') ? s : `${s}/`;
}

/**
 * Makes a stable column-key list.
 * - If treatFirstRowAsHeader is true: uses header labels (deduped).
 * - Otherwise: uses ColumnA, ColumnB ... based on max column count.
 * @param {string[]|null} header
 * @param {string[][]} rows
 * @param {boolean} treatFirstRowAsHeader
 * @returns {string[]}
 */
export function buildColumnKeys(header, rows, treatFirstRowAsHeader) {
  if (treatFirstRowAsHeader && Array.isArray(header) && header.length > 0) {
    return dedupeKeys(header.map((h) => (String(h ?? '').trim() || 'Column')));
  }

  const counts = [
    Array.isArray(header) ? header.length : 0,
    ...(rows || []).map((r) => (Array.isArray(r) ? r.length : 0))
  ];
  const max = Math.max(0, ...counts);
  return Array.from({ length: max }, (_, i) => `Column${toExcelLetters(i)}`);
}

/**
 * Dedupe column keys while preserving order.
 * @param {string[]} keys
 * @returns {string[]}
 */
export function dedupeKeys(keys) {
  /** @type {Record<string, number>} */
  const seen = {};
  return (keys || []).map((k) => {
    const base = String(k || 'Column').trim() || 'Column';
    const n = (seen[base] ?? 0) + 1;
    seen[base] = n;
    return n === 1 ? base : `${base}_${n}`;
  });
}

/**
 * Converts a zero-based index to Excel-style letters: 0->A, 25->Z, 26->AA.
 * @param {number} index
 * @returns {string}
 */
export function toExcelLetters(index) {
  let n = Math.max(0, Math.floor(index));
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Builds predicate IRIs for a list of column keys.
 * @param {string[]} columnKeys
 * @param {PredicateOptions} predicateOptions
 * @param {string} basePredicateIri
 * @returns {Record<string, string>} columnKey -> predicate IRI
 */
export function buildPredicateIrisForColumns(columnKeys, predicateOptions, basePredicateIri) {
  const base = String(basePredicateIri ?? '');
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of columnKeys) {
    const local = buildPredicateLocalName(key, predicateOptions);
    out[key] = `${base}${local}`;
  }
  return out;
}

/**
 * Builds a predicate local name from a column key and predicate options.
 * @param {string} columnKey
 * @param {PredicateOptions} predicateOptions
 * @returns {string}
 */
export function buildPredicateLocalName(columnKey, predicateOptions) {
  const raw = String(columnKey ?? '').trim() || 'Column';
  const prefixHas = Boolean(predicateOptions?.prefixHas ?? true);
  const casing = predicateOptions?.casing ?? 'camelCase';

  const phrase = prefixHas ? `has ${raw}` : raw;
  const tokens = tokenizeWords(phrase);

  if (casing === 'snake_case') return tokens.map((t) => t.toLowerCase()).join('_');
  if (casing === 'SHOUT_CASE') return tokens.map((t) => t.toUpperCase()).join('_');
  if (casing === 'PascalCase') return tokens.map(capitalize).join('');
  // default camelCase
  return tokens.length === 0 ? 'hasValue' : [tokens[0].toLowerCase(), ...tokens.slice(1).map(capitalize)].join('');
}

/**
 * Tokenizes a phrase into alphanumeric word tokens.
 * @param {string} phrase
 * @returns {string[]}
 */
export function tokenizeWords(phrase) {
  const cleaned = String(phrase ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.split(' ') : [];
}

/**
 * Capitalizes a token.
 * @param {string} token
 * @returns {string}
 */
export function capitalize(token) {
  const s = String(token ?? '');
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';
}

/**
 * Builds a row instance IRI (FQDN base + UUID path segment).
 * @param {{baseInstanceIri: string, rowIndex: number}} params
 * @returns {string}
 */
export function buildRowInstanceIri({ baseInstanceIri, rowIndex }) {
  const base = ensureTrailingSlash(baseInstanceIri);
  const uuid = crypto.randomUUID();
  // Keep a hint of ordering without leaking data: row index.
  return `${base}${uuid}?row=${encodeURIComponent(String(rowIndex))}`;
}

let _n3Mod = null;

/**
 * Builds an RDFJS term for a cell value according to an xsd datatype.
 * Special case: if datatype is xsd:anyURI and value looks like an absolute IRI, returns a NamedNode.
 * @param {string} value
 * @param {string} datatypeIri
 * @returns {Promise<any>} RDFJS Term (NamedNode or Literal)
 */
export async function buildLiteralObject(value, datatypeIri) {
  const N3 = await getN3();
  const { DataFactory } = N3;
  const v = String(value ?? '').trim();
  const dt = String(datatypeIri ?? 'http://www.w3.org/2001/XMLSchema#string');

  if (dt.endsWith('#anyURI') && looksLikeAbsoluteIri(v)) {
    return DataFactory.namedNode(v);
  }

  if (dt.endsWith('#boolean')) {
    return DataFactory.literal(toBooleanLexical(v), DataFactory.namedNode(dt));
  }

  if (dt.endsWith('#integer')) {
    return DataFactory.literal(toIntegerLexical(v), DataFactory.namedNode(dt));
  }

  if (dt.endsWith('#decimal') || dt.endsWith('#double') || dt.endsWith('#float')) {
    return DataFactory.literal(toNumberLexical(v), DataFactory.namedNode(dt));
  }

  if (dt.endsWith('#dateTime')) {
    return DataFactory.literal(toDateTimeLexical(v), DataFactory.namedNode(dt));
  }

  return DataFactory.literal(v, DataFactory.namedNode(dt));
}

/**
 * Determines whether a string looks like an absolute IRI.
 * @param {string} s
 * @returns {boolean}
 */
export function looksLikeAbsoluteIri(s) {
  return /^https?:\/\//i.test(String(s ?? ''));
}

/**
 * Coerces a value into xsd:boolean lexical form.
 * @param {string} s
 * @returns {string}
 */
export function toBooleanLexical(s) {
  const v = String(s ?? '').trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return 'true';
  if (v === '0' || v === 'false' || v === 'no' || v === 'n') return 'false';
  return v ? 'true' : 'false';
}

/**
 * Coerces into xsd:integer lexical form (best-effort).
 * @param {string} s
 * @returns {string}
 */
export function toIntegerLexical(s) {
  const n = parseInt(String(s ?? '').trim(), 10);
  return Number.isFinite(n) ? String(n) : '0';
}

/**
 * Coerces into numeric lexical form (decimal/double/float best-effort).
 * @param {string} s
 * @returns {string}
 */
export function toNumberLexical(s) {
  const n = Number(String(s ?? '').trim());
  return Number.isFinite(n) ? String(n) : '0';
}

/**
 * Coerces into xsd:dateTime lexical form (ISO 8601 best-effort).
 * @param {string} s
 * @returns {string}
 */
export function toDateTimeLexical(s) {
  const raw = String(s ?? '').trim();
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

/**
 * Loads N3 via esm.sh (pinned), cached.
 * @returns {Promise<any>}
 */
async function getN3() {
  if (_n3Mod) return _n3Mod;
  _n3Mod = await import('https://esm.sh/n3@2.0.1');
  return _n3Mod;
}
