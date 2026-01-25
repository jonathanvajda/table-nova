/**
 * @file Build RDF datasets from tabular data.
 */

/**
 * @typedef {import('../state/types.js').FileOptions} FileOptions
 * @typedef {import('../tabular/parseTabular.js').TabularData} TabularData
 */

/**
 * @typedef {Object} QuadRecord
 * @property {string} s
 * @property {string} p
 * @property {string} g
 * @property {'iri'|'literal'} oType
 * @property {string} oValue
 * @property {string} [datatypeIri]
 * @property {string} [lang]
 */

let _n3Mod = null;

/**
 * Builds an RDF dataset (N3.Store) and storable quads from tabular data.
 * @param {{
 *   tabular: TabularData,
 *   options: FileOptions,
 *   baseInstanceIri: string,
 *   predicateIris: Record<string, string>,
 *   graphIri: string,
 *   buildRowInstanceIri: (params: {baseInstanceIri: string, rowIndex: number}) => string,
 *   buildLiteralObject: (value: string, datatypeIri: string) => Promise<any>
 * }} params
 * @returns {Promise<{dataset: any, quads: QuadRecord[]}>}
 */
export async function buildDatasetFromTabular({
  tabular,
  options,
  baseInstanceIri,
  predicateIris,
  graphIri,
  buildRowInstanceIri,
  buildLiteralObject
}) {
  const { DataFactory, Store } = N3;

  const store = new Store();
  const g = DataFactory.namedNode(graphIri);

  const columnKeys = Object.keys(predicateIris);

  // Determine data rows (if treatFirstRowAsHeader is false, we re-insert the header row as a data row).
  const dataRows = options.treatFirstRowAsHeader
    ? (tabular.rows || [])
    : [
        ...(Array.isArray(tabular.header) ? [tabular.header] : []),
        ...(tabular.rows || [])
      ];

  /** @type {QuadRecord[]} */
  const records = [];

  for (let r = 0; r < dataRows.length; r += 1) {
    const row = dataRows[r] || [];
    const subjectIri = buildRowInstanceIri({ baseInstanceIri, rowIndex: r });
    const s = DataFactory.namedNode(subjectIri);

    for (let c = 0; c < columnKeys.length; c += 1) {
      const key = columnKeys[c];
      const pIri = predicateIris[key];
      if (!pIri) continue;

      const cell = row[c];
      if (cell === undefined || cell === null || String(cell).trim() === '') continue;

      const datatype = options.datatypesByColumnKey?.[key] || 'http://www.w3.org/2001/XMLSchema#string';
      const obj = await buildLiteralObject(String(cell), datatype);

      const p = DataFactory.namedNode(pIri);
      const q = DataFactory.quad(s, p, obj, g);
      store.addQuad(q);

      if (obj.termType === 'NamedNode') {
        records.push({ s: subjectIri, p: pIri, g: graphIri, oType: 'iri', oValue: obj.value });
      } else {
        records.push({
          s: subjectIri,
          p: pIri,
          g: graphIri,
          oType: 'literal',
          oValue: obj.value,
          datatypeIri: obj.datatype?.value,
          lang: obj.language || undefined
        });
      }
    }
  }

  return { dataset: store, quads: records };
}

/**
 * Rebuilds an N3.Store dataset from stored quads.
 * @param {QuadRecord[]} records
 * @returns {Promise<{dataset: any}>}
 */
export async function datasetFromQuads(records) {
  const { DataFactory, Store } = N3;

  const store = new Store();
  for (const rec of records || []) {
    const s = DataFactory.namedNode(rec.s);
    const p = DataFactory.namedNode(rec.p);
    const g = DataFactory.namedNode(rec.g);

    const o = rec.oType === 'iri'
      ? DataFactory.namedNode(rec.oValue)
      : DataFactory.literal(rec.oValue, DataFactory.namedNode(rec.datatypeIri || 'http://www.w3.org/2001/XMLSchema#string'));

    store.addQuad(DataFactory.quad(s, p, o, g));
  }

  return { dataset: store };
}