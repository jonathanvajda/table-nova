/**
 * @file IndexedDB storage for Table Nova runs (named graphs).
 */

/**
 * @typedef {import('../rdf/buildDataset.js').QuadRecord} QuadRecord
 */

/**
 * @typedef {Object} StoredRun
 * @property {string} graphIri
 * @property {string} filename
 * @property {string} createdAtIso
 * @property {QuadRecord[]} quads
 */

const DB_NAME = 'table-nova';
const DB_VERSION = 1;
const STORE_RUNS = 'runs';

/**
 * Opens (or creates) the Table Nova IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openTableNovaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        const store = db.createObjectStore(STORE_RUNS, { keyPath: 'graphIri' });
        store.createIndex('createdAtIso', 'createdAtIso', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB.'));
  });
}

/**
 * Stores a run.
 * @param {IDBDatabase} db
 * @param {StoredRun} run
 * @returns {Promise<void>}
 */
export function putRun(db, run) {
  return tx(db, 'readwrite', (store) => store.put(run));
}

/**
 * Lists runs (metadata only).
 * @param {IDBDatabase} db
 * @returns {Promise<Array<Pick<StoredRun,'graphIri'|'filename'|'createdAtIso'>>>}
 */
export function listRuns(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_RUNS, 'readonly').objectStore(STORE_RUNS).getAll();
    req.onsuccess = () => {
      const all = /** @type {StoredRun[]} */ (req.result || []);
      const sorted = all
        .map(({ graphIri, filename, createdAtIso }) => ({ graphIri, filename, createdAtIso }))
        .sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
      resolve(sorted);
    };
    req.onerror = () => reject(req.error || new Error('Failed to list runs.'));
  });
}

/**
 * Deletes a run by graph IRI.
 * @param {IDBDatabase} db
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
export function deleteRun(db, graphIri) {
  return tx(db, 'readwrite', (store) => store.delete(graphIri));
}

/**
 * Gets a full run (including quads) by graph IRI.
 * @param {IDBDatabase} db
 * @param {string} graphIri
 * @returns {Promise<StoredRun|null>}
 */
export function getRunDataset(db, graphIri) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_RUNS, 'readonly').objectStore(STORE_RUNS).get(graphIri);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Failed to read run.'));
  });
}

/**
 * Runs a single object store operation inside a transaction.
 * @param {IDBDatabase} db
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest} op
 * @returns {Promise<void>}
 */
export function tx(db, mode, op) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_RUNS, mode);
    const store = t.objectStore(STORE_RUNS);
    op(store);

    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error || new Error('IndexedDB transaction failed.'));
    t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted.'));
  });
}
