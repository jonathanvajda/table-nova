/**
 * @file Parse CSV/TSV text and XLSX ArrayBuffers into a common tabular shape.
 */

/**
 * @typedef {'csv'|'tsv'|'xlsx'|'unknown'} TabularKind
 */

/**
 * @typedef {Object} TabularData
 * @property {string[]|null} header    // first row (if present)
 * @property {string[][]} rows         // remaining rows
 */

/**
 * Detects tabular kind by filename extension.
 * @param {string} filename
 * @returns {TabularKind}
 */
export function detectTabularType(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.txt')) return 'csv';
  return 'unknown';
}

/**
 * Heuristically detects delimiter from a single line.
 * @param {string} line
 * @returns {','|'\t'}
 */
export function detectDelimiterFromLine(line) {
  const comma = (line.match(/,/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  return tab > comma ? '\t' : ',';
}

/**
 * Splits CSV/TSV into rows of cells.
 * Minimal RFC4180-ish parsing: supports quotes and escaped quotes.
 * @param {string} text
 * @param {','|'\t'|null} delimiterHint
 * @returns {TabularData}
 */
export function parseCsvOrTsvText(text, delimiterHint = null) {
  const src = String(text ?? '');
  const lines = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? '';
  const delim = delimiterHint ?? detectDelimiterFromLine(firstNonEmpty);

  /** @type {string[][]} */
  const all = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    all.push(parseLine(line, delim));
  }

  if (all.length === 0) return { header: null, rows: [] };
  const header = normalizeRow(all[0]);
  const rows = all.slice(1).map(normalizeRow);
  return { header, rows };
}

/**
 * Parses a single CSV/TSV line.
 * @param {string} line
 * @param {','|'\t'} delim
 * @returns {string[]}
 */
export function parseLine(line, delim) {
  /** @type {string[]} */
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }

  out.push(cur);
  return out;
}

/**
 * Normalizes a row to trimmed strings (keeps empty cells).
 * @param {string[]} row
 * @returns {string[]}
 */
export function normalizeRow(row) {
  return (row || []).map((c) => String(c ?? '').trim());
}

let _xlsxMod = null;

/**
 * Parses an XLSX ArrayBuffer into TabularData (first sheet, first row as header candidate).
 * @param {ArrayBuffer} buf
 * @returns {Promise<TabularData>}
 */
export async function parseXlsxArrayBuffer(buf) {
  const XLSX = await getXlsx();
  const wb = XLSX.read(buf, { type: 'array' });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return { header: null, rows: [] };

  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  const all = aoa.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []));
  if (all.length === 0) return { header: null, rows: [] };

  const header = all[0];
  const rows = all.slice(1);
  return { header, rows };
}

/**
 * Loads SheetJS (xlsx) via esm.sh, cached.
 * @returns {Promise<any>}
 */
async function getXlsx() {
  if (_xlsxMod) return _xlsxMod;
  // Pinned for reproducibility.
  _xlsxMod = await import('https://esm.sh/xlsx@0.18.5');
  return _xlsxMod;
}
