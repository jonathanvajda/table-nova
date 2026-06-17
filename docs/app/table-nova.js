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
  applyHeaderRowOptions,
  detectTabularType,
  parseCsvOrTsvText,
  parseXlsxArrayBuffer
} from './tabular/parseTabular.js';
import {
  buildColumnSchemas,
  buildRowInstanceIri,
  buildRunGraphIri,
  buildLiteralObject
} from './rdf/schema.js';
import {
  buildOntologyDataset,
  ontologyRecordsFromDataset
} from './rdf/ontology.js';
import {
  datasetToSerializations
} from './rdf/serialize.js';
import {
  buildDraftMetadataArtifacts,
  buildSampleValuesByPredicate
} from './metadataDrafts.js';
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
const toasts = createToastBus({ rootId: 'toast-container' });

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
  exportDataDictionaryBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportDataDictionaryBtn')),
  exportJsonSchemaBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonSchemaBtn')),
  outputScopeInputs: /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="TableNovaOutputScope"]')),
  runList: /** @type {HTMLElement} */ (document.getElementById('TableNovaRunList'))
};

let stagedFiles = /** @type {StagedFile[]} */ ([]);
let db = null;
let lastOutput = null; // { filename, graphIri, views: {abox, tbox, both}, quads, columnSchemas, sampleValuesByPredicate }

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
  const scrollState = captureOptionsScrollState();
  stagedFiles = next;
  renderStagedFiles(dom.fileList, stagedFiles, handleRemoveStagedFile);
  setRunButtonEnabled(dom.runBtn, stagedFiles.length > 0);
  renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);
  restoreOptionsScrollState(scrollState);
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

    const normalized = normalizeTabularForOptions(tabular, options);
    const preview = normalized.rows.slice(0, 5);
    const header = normalized.header;

    const nextOptions = {
      ...options,
      preview: {
        header,
        rows: preview
      },
      datatypesByColumnKey: options.datatypesByColumnKey ?? {},
      columnSchemaOverridesByKey: options.columnSchemaOverridesByKey ?? {}
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

    const normalized = normalizeTabularForOptions(tabular, options);

    const columnSchemas = buildColumnSchemas({
      header: normalized.header,
      rows: normalized.rows,
      treatFirstRowAsHeader: options.treatFirstRowAsHeader,
      predicateOptions: options.predicate,
      basePredicateIri: TABLENOVA_DEFAULTS.basePredicateIri,
      datatypesByColumnKey: options.datatypesByColumnKey,
      columnSchemaOverridesByKey: options.columnSchemaOverridesByKey
    });
    const sampleValuesByPredicate = buildSampleValuesByPredicate({
      rows: getProcessedDataRows(normalized, options),
      columnSchemas
    });

    const graphIri = buildRunGraphIri({
      baseRunIri: TABLENOVA_DEFAULTS.baseRunIri,
      filename: file.name,
      now: new Date()
    });

    const { dataset, quads } = await import('./rdf/buildDataset.js').then((m) =>
      m.buildDatasetFromTabular({
        tabular: normalized,
        options,
        baseInstanceIri: TABLENOVA_DEFAULTS.baseInstanceIri,
        columnSchemas,
        graphIri,
        buildRowInstanceIri,
        buildLiteralObject
      })
    );

    const outputPackage = await buildOutputPackage({
      dataset,
      graphIri,
      filename: file.name,
      quads,
      columnSchemas,
      sampleValuesByPredicate
    });

    await putRun(db, {
      graphIri,
      filename: file.name,
      createdAtIso: new Date().toISOString(),
      quads,
      columnSchemas,
      ontologyTurtle: outputPackage.views.tbox.turtle,
      sampleValuesByPredicate
    });

    lastOutput = outputPackage;

    renderCurrentOutputs();
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

    lastOutput = await buildOutputPackage({
      dataset,
      graphIri,
      filename: run.filename,
      quads: run.quads || [],
      columnSchemas: run.columnSchemas || [],
      sampleValuesByPredicate: run.sampleValuesByPredicate || {}
    });

    renderCurrentOutputs();
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

  const scope = getOutputScope();
  const view = lastOutput.views?.[scope];
  if (!view) return;

  const map = {
    turtle: { text: view.turtle, ext: `${scope}.ttl` },
    trig: { text: view.trig, ext: `${scope}.trig` },
    ntriples: { text: view.ntriples, ext: `${scope}.nt` },
    nquads: { text: view.nquads, ext: `${scope}.nq` },
    jsonldTriples: { text: view.jsonldTriples, ext: `${scope}.jsonld` },
    jsonldGraph: { text: view.jsonldGraph, ext: `${scope}.dataset.jsonld` }
  };

  const pick = map[kind];
  if (!pick) return;

  downloadTextFile(`${buildExportBaseName(lastOutput)}.${pick.ext}`, pick.text);
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
 * @returns {{dataDictionaryCsv: string, jsonSchemaText: string}|null}
 */
function buildCurrentDraftMetadata() {
  if (!lastOutput) {
    toasts.show({ title: 'Nothing to export', body: 'Run a file or load a saved run first.' });
    return null;
  }

  return buildDraftMetadataArtifacts({
    filename: lastOutput.filename,
    columnSchemas: lastOutput.columnSchemas || [],
    quads: lastOutput.quads || [],
    sampleValuesByPredicate: lastOutput.sampleValuesByPredicate || {}
  });
}

/**
 * @returns {void}
 */
function handleExportDataDictionary() {
  const draftMetadata = buildCurrentDraftMetadata();
  if (!draftMetadata || !lastOutput) return;

  downloadTextFile(
    `${buildExportBaseName(lastOutput)}.draft-data-dictionary.csv`,
    draftMetadata.dataDictionaryCsv,
    'text/csv;charset=utf-8'
  );
  toasts.show({ title: 'Exported', body: 'Downloaded draft data dictionary.' });
}

/**
 * @returns {void}
 */
function handleExportJsonSchema() {
  const draftMetadata = buildCurrentDraftMetadata();
  if (!draftMetadata || !lastOutput) return;

  downloadTextFile(
    `${buildExportBaseName(lastOutput)}.draft-json-schema.json`,
    draftMetadata.jsonSchemaText,
    'application/schema+json;charset=utf-8'
  );
  toasts.show({ title: 'Exported', body: 'Downloaded draft JSON schema.' });
}

/**
 * @returns {'abox'|'tbox'|'both'}
 */
function getOutputScope() {
  const selected = Array.from(dom.outputScopeInputs || []).find((input) => input.checked)?.value;
  return selected === 'tbox' || selected === 'both' ? selected : 'abox';
}

/**
 * @returns {void}
 */
function renderCurrentOutputs() {
  renderOutputs(dom, lastOutput, getOutputScope());
}

/**
 * @param {{dataset: any, graphIri: string, filename: string, quads: any[], columnSchemas: any[], sampleValuesByPredicate?: Record<string, string[]>}} params
 * @returns {Promise<any>}
 */
async function buildOutputPackage({ dataset, graphIri, filename, quads, columnSchemas, sampleValuesByPredicate = {} }) {
  const tboxDataset = buildOntologyDataset(columnSchemas);
  const bothDataset = mergeDatasets(dataset, tboxDataset);
  const tboxQuads = ontologyRecordsFromDataset(tboxDataset);
  const prefixes = TABLENOVA_DEFAULTS.prefixes;

  const [aboxSer, tboxSer, bothSer] = await Promise.all([
    datasetToSerializations({ dataset, graphIri, prefixes }),
    datasetToSerializations({ dataset: tboxDataset, graphIri, prefixes }),
    datasetToSerializations({ dataset: bothDataset, graphIri, prefixes })
  ]);

  const views = {
    abox: { ...aboxSer, quads: quads || [] },
    tbox: { ...tboxSer, quads: tboxQuads },
    both: { ...bothSer, quads: [...(quads || []), ...tboxQuads] }
  };

  return {
    filename,
    graphIri,
    quads,
    columnSchemas,
    sampleValuesByPredicate,
    ontologyTurtle: tboxSer.turtle,
    views,
    ...aboxSer
  };
}

/**
 * @param {{filename: string, graphIri: string}} output
 * @returns {string}
 */
function buildExportBaseName(output) {
  const base = String(output?.filename || 'table-nova-output').replace(/\.[^.]+$/, '');
  const graphSlug = String(output?.graphIri || '')
    .split('/')
    .slice(-2)
    .join('_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${base}.${graphSlug || 'run'}`;
}

/**
 * @param  {...any} datasets
 * @returns {any}
 */
function mergeDatasets(...datasets) {
  const N3 = /** @type {any} */ (globalThis).N3;
  const { Store } = N3;
  const out = new Store();
  for (const ds of datasets) {
    for (const q of ds?.getQuads?.(null, null, null, null) || []) {
      out.addQuad(q);
    }
  }
  return out;
}

/**
 * Applies header row options to a parsed table.
 * @param {import('./tabular/parseTabular.js').TabularData} tabular
 * @param {import('./state/types.js').FileOptions} options
 * @returns {import('./tabular/parseTabular.js').TabularData}
 */
function normalizeTabularForOptions(tabular, options) {
  return applyHeaderRowOptions(tabular, Boolean(options?.treatFirstRowAsHeader ?? true), options?.headerRowNumber || 1);
}

/**
 * Builds the row slice used for draft metadata examples.
 * @param {import('./tabular/parseTabular.js').TabularData} tabular
 * @param {import('./state/types.js').FileOptions} options
 * @returns {string[][]}
 */
function getProcessedDataRows(tabular, options) {
  if (Boolean(options?.treatFirstRowAsHeader ?? true)) {
    return tabular.rows || [];
  }

  return [
    ...(Array.isArray(tabular.header) ? [tabular.header] : []),
    ...(tabular.rows || [])
  ];
}

/**
 * Captures page and options table scroll positions before an options re-render.
 * @returns {{windowX: number, windowY: number, scrollers: Array<{selector: string, index: number, left: number, top: number}>}}
 */
function captureOptionsScrollState() {
  const scrollers = Array.from(dom.optionsPanel.querySelectorAll('.table-nova-tablewrap')).map((el, index) => ({
    selector: '.table-nova-tablewrap',
    index,
    left: el.scrollLeft,
    top: el.scrollTop
  }));

  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    scrollers
  };
}

/**
 * Restores scroll positions after an options re-render.
 * @param {{windowX: number, windowY: number, scrollers: Array<{selector: string, index: number, left: number, top: number}>}} state
 * @returns {void}
 */
function restoreOptionsScrollState(state) {
  requestAnimationFrame(() => {
    for (const item of state.scrollers || []) {
      const el = dom.optionsPanel.querySelectorAll(item.selector)[item.index];
      if (el) {
        el.scrollLeft = item.left;
        el.scrollTop = item.top;
      }
    }
    window.scrollTo(state.windowX, state.windowY);
  });
}

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
  document.addEventListener('tablenova:selected-file-changed', () => {
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
  dom.exportDataDictionaryBtn.addEventListener('click', handleExportDataDictionary);
  dom.exportJsonSchemaBtn.addEventListener('click', handleExportJsonSchema);
  dom.outputScopeInputs.forEach((input) => input.addEventListener('change', renderCurrentOutputs));

  toasts.show({ title: 'Ready', body: 'Drop a file to begin.' });
}

init().catch((err) => {
  log.error('init_failed', { err });
  toasts.show({ title: 'Init failed', body: String(err?.message || err) });
});
