/**
 * @file Project-portfolio storage for Table Nova runs.
 */

import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  createProjectPortfolioStores,
  ensureProjectPortfolioProject,
  openProjectPortfolioDatabase
} from '../shared/indexeddb-data-management/index.js';

const TABLE_NOVA_PROJECT_ID = DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;
const TABLE_NOVA_RUN_KIND = 'tabular-to-rdf';

/**
 * @typedef {import('../rdf/buildDataset.js').QuadRecord} QuadRecord
 * @typedef {import('../rdf/schema.js').ColumnSchema} ColumnSchema
 */

/**
 * @typedef {Object} StoredRun
 * @property {string} graphIri
 * @property {string} filename
 * @property {string} createdAtIso
 * @property {QuadRecord[]} quads
 * @property {ColumnSchema[]} [columnSchemas]
 * @property {string} [ontologyTurtle]
 * @property {Record<string, string[]>} [sampleValuesByPredicate]
 */

/**
 * Opens the shared project portfolio for Table Nova.
 *
 * @returns {Promise<{db: IDBDatabase, stores: ReturnType<typeof createProjectPortfolioStores>}>}
 */
export async function openTableNovaDb() {
  const db = await openProjectPortfolioDatabase();
  const stores = createProjectPortfolioStores(db);
  await ensureProjectPortfolioProject(stores, {
    projectId: TABLE_NOVA_PROJECT_ID,
    label: 'Default Project',
    storageBackend: 'indexeddb'
  });
  return { db, stores };
}

/**
 * Stores a Table Nova transformation run in the shared portfolio.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {StoredRun} run
 * @returns {Promise<void>}
 */
export async function putRun(db, run) {
  const runId = createRunIdFromGraphIri(run.graphIri);
  await db.stores.runs.storeRunRecord({
    runId,
    projectId: TABLE_NOVA_PROJECT_ID,
    runKind: TABLE_NOVA_RUN_KIND,
    label: run.filename || run.graphIri,
    createdAt: run.createdAtIso,
    payload: { ...run, runId, appId: 'table-nova' },
    inputArtifactIds: [],
    outputArtifactIds: []
  });
}

/**
 * Lists Table Nova runs as metadata expected by the existing UI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @returns {Promise<Array<Pick<StoredRun,'graphIri'|'filename'|'createdAtIso'>>>}
 */
export async function listRuns(db) {
  const records = await db.stores.runs.listRunRecords({
    projectId: TABLE_NOVA_PROJECT_ID,
    runKind: TABLE_NOVA_RUN_KIND
  });
  return records
    .map((record) => record.payload)
    .filter(Boolean)
    .map(({ graphIri, filename, createdAtIso }) => ({ graphIri, filename, createdAtIso }))
    .sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
}

/**
 * Deletes a Table Nova run by graph IRI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
export async function deleteRun(db, graphIri) {
  await db.stores.runs.deleteRunRecord(createRunIdFromGraphIri(graphIri));
}

/**
 * Gets a full Table Nova run by graph IRI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {string} graphIri
 * @returns {Promise<StoredRun|null>}
 */
export async function getRunDataset(db, graphIri) {
  const record = await db.stores.runs.getRunRecord(createRunIdFromGraphIri(graphIri));
  return record?.payload || null;
}

/**
 * Converts Table Nova's existing graph-IRI key into a shared run id.
 *
 * @param {string} graphIri
 * @returns {string}
 */
function createRunIdFromGraphIri(graphIri) {
  return `run:table-nova:${encodeURIComponent(String(graphIri || 'default'))}`;
}
