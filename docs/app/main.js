/**
 * @file Main UI wiring for Table Nova.
 */

import { TABLENOVA_DEFAULTS } from './state/defaults.js';
import {
  createLogger,
  createToastBus,
  safeAsync
} from './ui/telemetry.js';
import {
  readFileAsArrayBuffer,
  readFileAsText
} from './io/fileReaders.js';
import {
  detectTabularType,
  parseCsvOrTsvText,
  parseXlsxArrayBuffer
} from './tabular/parseTabular.js';
import {
  buildColumnKeys,
  buildPredicateIrisForColumns,
  buildRowInstanceIri,
  buildRunGraphIri,
  buildLiteralObject
} from './rdf/schema.js';
import {
  datasetToSerializations
} from './rdf/serialize.js';
import {
  openTableNovaDb,
  putRun,
  listRuns,
  deleteRun,
  getRunDataset
} from './storage/indexedDb.js';
import {
  downloadTextFile
} from './io/download.js';
import {
  renderStagedFiles,
  renderFileOptionsPanel,
  renderOutputs,
  renderRunsList,
  setRunButtonEnabled,
  setDropzoneDragState,
  mountTabs,
  mountTableSortingAndFiltering
} from './ui/render.js';

/**
 * @typedef {import('./state/types.js').StagedFile} StagedFile
 */

const log = createLogger({ scope: 'main', enabled: true });
const toasts = createToastBus({ rootId: 'TableNovaToasts' });

const dom = {
  dropzone: /** @type {HTMLElement} */ (document.getElementById('TableNovaDropzone')),
  fileInput: /** @type {HTMLInputElement} */ (document.getElementById('TableNovaFileInput')),
  fileList: /** @type {HTMLElement} */ (document.getElementById('TableNovaFileList')),
  optionsPanel: /** @type {HTMLElement} */ (document.getElementById('TableNovaOptionsPanel')),
  runBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaRunBtn')),
  clearBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaClearBtn')),
  turtleText: /** @type {HTMLTextAreaElement} */ (document.getElementById('TableNovaTurtleText')),
  jsonldText: /** @type {HTMLTextAreaElement} */ (document.getElementById('TableNovaJsonLdText')),
  quadTable: /** @type {HTMLTableElement} */ (document.getElementById('TableNovaQuadTable')),
  quadFilter: /** @type {HTMLInputElement} */ (document.getElementById('TableNovaQuadFilter')),
  exportTurtleBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportTurtleBtn')),
  exportTrigBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportTrigBtn')),
  exportNTriplesBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportNTriplesBtn')),
  exportNQuadsBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportNQuadsBtn')),
  exportJsonLdTriplesBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonLdTriplesBtn')),
  exportJsonLdGraphBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonLdGraphBtn')),
  runList: /** @type {HTMLElement} */ (document.getElementById('TableNovaRunList'))
};

let stagedFiles = /** @type {StagedFile[]} */ ([]);
let db = null;
let lastOutput = null; // { filename, graphIri, turtle, trig, ntriples, nquads, jsonldTriples, jsonldGraph, quads }

/**
 * @param {FileList|File[]} files
 * @returns {StagedFile[]}
 */
function toStagedFiles(files) {
  return Array.from(files).map((f) => ({
    id: crypto.randomUUID(),
    file: f,
    options: structuredClone(TABLENOVA_DEFAULTS.fileOptions)
  }));
}

/**
 * @param {StagedFile[]} next
 * @returns {void}
 */
function setStagedFiles(next) {
  stagedFiles = next;
  renderStagedFiles(dom.fileList, stagedFiles, handleRemoveStagedFile);
  setRunButtonEnabled(dom.runBtn, stagedFiles.length > 0);
  renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);
}

/**
 * @param {string} stagedId
 * @returns {void}
 */
function handleRemoveStagedFile(stagedId) {
  log.info('remove_staged_file', { stagedId });
  setStagedFiles(stagedFiles.filter((s) => s.id !== stagedId));
  toasts.show({ title: 'Removed', body: 'File removed from staging.' });
}

/**
 * @returns {void}
 */
function handleClearStaged() {
  log.info('clear_staged');
  setStagedFiles([]);
  toasts.show({ title: 'Cleared', body: 'Staging area cleared.' });
}

/**
 * @param {string} stagedId
 * @param {import('./state/types.js').FileOptions} nextOptions
 * @returns {void}
 */
function handleUpdateFileOptions(stagedId, nextOptions) {
  log.info('update_file_options', { stagedId, nextOptions });
  setStagedFiles(stagedFiles.map((s) => (s.id === stagedId ? { ...s, options: nextOptions } : s)));
}

/**
 * @param {string} stagedId
 * @returns {Promise<void>}
 */
async function handlePreviewFile(stagedId) {
  const staged = stagedFiles.find((s) => s.id === stagedId);
  if (!staged) return;

  await safeAsync(log, async () => {
    const { file, options } = staged;
    const kind = detectTabularType(file.name);

    const tabular = await (kind === 'xlsx'
      ? parseXlsxArrayBuffer(await readFileAsArrayBuffer(file))
      : parseCsvOrTsvText(await readFileAsText(file), options.delimiterHint));

    // Render preview rows and datatype pickers via the options panel renderer.
    // We store the preview metadata into options so it can drive datatype UI.
    const preview = tabular.rows.slice(0, 5);
    const header = tabular.header;

    const nextOptions = {
      ...options,
      preview: {
        header,
        rows: preview
      },
      datatypesByColumnKey: options.datatypesByColumnKey ?? {}
    };

    handleUpdateFileOptions(stagedId, nextOptions);
    toasts.show({ title: 'Preview ready', body: `Showing first ${preview.length} rows.` });
  }, (err) => {
    toasts.show({ title: 'Preview failed', body: String(err?.message || err) });
  });
}

/**
 * @returns {Promise<void>}
 */
async function handleRun() {
  if (!db) return;

  if (stagedFiles.length === 0) {
    toasts.show({ title: 'Nothing to run', body: 'Add a file to the staging area first.' });
    return;
  }

  // MVP: run first staged file. (Easy to extend to multi-file runs later.)
  const staged = stagedFiles[0];

  await safeAsync(log, async () => {
    const { file, options } = staged;
    const kind = detectTabularType(file.name);

    const tabular = await (kind === 'xlsx'
      ? parseXlsxArrayBuffer(await readFileAsArrayBuffer(file))
      : parseCsvOrTsvText(await readFileAsText(file), options.delimiterHint));

    const columnKeys = buildColumnKeys(tabular.header, tabular.rows, options.treatFirstRowAsHeader);
    const predicateIris = buildPredicateIrisForColumns(columnKeys, options.predicate, TABLENOVA_DEFAULTS.basePredicateIri);

    const graphIri = buildRunGraphIri({
      baseRunIri: TABLENOVA_DEFAULTS.baseRunIri,
      filename: file.name,
      now: new Date()
    });

    const { dataset, quads } = await import('./rdf/buildDataset.js').then((m) =>
      m.buildDatasetFromTabular({
        tabular,
        options,
        baseInstanceIri: TABLENOVA_DEFAULTS.baseInstanceIri,
        predicateIris,
        graphIri,
        buildRowInstanceIri,
        buildLiteralObject
      })
    );

    const ser = await datasetToSerializations({
      dataset,
      graphIri,
      prefixes: TABLENOVA_DEFAULTS.prefixes
    });

    await putRun(db, {
      graphIri,
      filename: file.name,
      createdAtIso: new Date().toISOString(),
      quads
    });

    lastOutput = {
      filename: file.name,
      graphIri,
      quads,
      ...ser
    };

    renderOutputs(dom, lastOutput);
    mountTableSortingAndFiltering(dom.quadTable, dom.quadFilter);
    await refreshRunsList();

    toasts.show({ title: 'Run complete', body: `Stored named graph in IndexedDB.` });
  }, (err) => {
    toasts.show({ title: 'Run failed', body: String(err?.message || err) });
  });
}

/**
 * @returns {Promise<void>}
 */
async function refreshRunsList() {
  if (!db) return;

  const runs = await listRuns(db);
  renderRunsList(dom.runList, runs, handleDeleteRun, handleLoadRunToOutput);
}

/**
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
async function handleDeleteRun(graphIri) {
  if (!db) return;

  await safeAsync(log, async () => {
    await deleteRun(db, graphIri);
    await refreshRunsList();
    toasts.show({ title: 'Deleted', body: 'Named graph removed from IndexedDB.' });
  }, (err) => {
    toasts.show({ title: 'Delete failed', body: String(err?.message || err) });
  });
}

/**
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
async function handleLoadRunToOutput(graphIri) {
  if (!db) return;

  await safeAsync(log, async () => {
    const run = await getRunDataset(db, graphIri);
    if (!run) throw new Error('Run not found.');

    // Re-serialize on demand so UI is consistent with current serializer.
    const { dataset } = await import('./rdf/buildDataset.js').then((m) =>
      m.datasetFromQuads(run.quads)
    );

    const ser = await datasetToSerializations({
      dataset,
      graphIri,
      prefixes: TABLENOVA_DEFAULTS.prefixes
    });

    lastOutput = {
      filename: run.filename,
      graphIri: run.graphIri,
      quads: run.quads,
      ...ser
    };

    renderOutputs(dom, lastOutput);
    mountTableSortingAndFiltering(dom.quadTable, dom.quadFilter);
    toasts.show({ title: 'Loaded', body: 'Run loaded from IndexedDB.' });
  }, (err) => {
    toasts.show({ title: 'Load failed', body: String(err?.message || err) });
  });
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDrop(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, false);

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const next = [...stagedFiles, ...toStagedFiles(files)];
  setStagedFiles(next);

  // Automatically select the latest file for configuration in options UI.
  renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);

  toasts.show({ title: 'Added', body: `${files.length} file(s) added to staging.` });
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDragOver(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, true);
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDragLeave(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, false);
}

/**
 * @returns {void}
 */
function handleFileInputChange() {
  const files = dom.fileInput.files;
  if (!files || files.length === 0) return;
  setStagedFiles([...stagedFiles, ...toStagedFiles(files)]);
  dom.fileInput.value = '';
  toasts.show({ title: 'Added', body: `${files.length} file(s) added to staging.` });
}

/**
 * @param {string} kind
 * @returns {void}
 */
function handleExport(kind) {
  if (!lastOutput) {
    toasts.show({ title: 'Nothing to export', body: 'Run a file or load a saved run first.' });
    return;
  }

  const base = lastOutput.filename.replace(/\.[^.]+$/, '');
  const graphSlug = lastOutput.graphIri.split('/').slice(-2).join('_').replace(/[^a-zA-Z0-9._-]/g, '_');

  const map = {
    turtle: { text: lastOutput.turtle, ext: 'ttl' },
    trig: { text: lastOutput.trig, ext: 'trig' },
    ntriples: { text: lastOutput.ntriples, ext: 'nt' },
    nquads: { text: lastOutput.nquads, ext: 'nq' },
    jsonldTriples: { text: lastOutput.jsonldTriples, ext: 'jsonld' },
    jsonldGraph: { text: lastOutput.jsonldGraph, ext: 'jsonld' }
  };

  const pick = map[kind];
  if (!pick) return;

  downloadTextFile(`${base}.${graphSlug}.${pick.ext}`, pick.text);
  toasts.show({ title: 'Exported', body: `Downloaded ${pick.ext.toUpperCase()}.` });
}

/**
 * @returns {void}
 */
function handleExportTurtle() { handleExport('turtle'); }

/**
 * @returns {void}
 */
function handleExportTrig() { handleExport('trig'); }

/**
 * @returns {void}
 */
function handleExportNTriples() { handleExport('ntriples'); }

/**
 * @returns {void}
 */
function handleExportNQuads() { handleExport('nquads'); }

/**
 * @returns {void}
 */
function handleExportJsonLdTriples() { handleExport('jsonldTriples'); }

/**
 * @returns {void}
 */
function handleExportJsonLdGraph() { handleExport('jsonldGraph'); }

/**
 * @returns {Promise<void>}
 */
async function init() {
  mountTabs(document.querySelector('.table-nova-tabs'), document.querySelectorAll('.table-nova-tabpanel'));

  renderStagedFiles(dom.fileList, stagedFiles, handleRemoveStagedFile);
  setRunButtonEnabled(dom.runBtn, false);

  // IndexedDB
  db = await openTableNovaDb();
  await refreshRunsList();

  // File selection in options panel
  document.addEventListener('table-nova:selected-file-changed', () => {
    renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);
  });

  // Dropzone
  dom.dropzone.addEventListener('drop', handleDrop);
  dom.dropzone.addEventListener('dragover', handleDragOver);
  dom.dropzone.addEventListener('dragleave', handleDragLeave);
  dom.fileInput.addEventListener('change', handleFileInputChange);

  // Buttons
  dom.runBtn.addEventListener('click', handleRun);
  dom.clearBtn.addEventListener('click', handleClearStaged);

  // Exports
  dom.exportTurtleBtn.addEventListener('click', handleExportTurtle);
  dom.exportTrigBtn.addEventListener('click', handleExportTrig);
  dom.exportNTriplesBtn.addEventListener('click', handleExportNTriples);
  dom.exportNQuadsBtn.addEventListener('click', handleExportNQuads);
  dom.exportJsonLdTriplesBtn.addEventListener('click', handleExportJsonLdTriples);
  dom.exportJsonLdGraphBtn.addEventListener('click', handleExportJsonLdGraph);

  toasts.show({ title: 'Ready', body: 'Drop a file to begin.' });
}

init().catch((err) => {
  log.error('init_failed', { err });
  toasts.show({ title: 'Init failed', body: String(err?.message || err) });
});
