/**
 * @file Render helpers (DOM updates) for Table Nova UI.
 */

/**
 * @typedef {import('../state/types.js').StagedFile} StagedFile
 * @typedef {import('../state/types.js').FileOptions} FileOptions
 */

const XSD = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Enables or disables the Run button.
 * @param {HTMLButtonElement} btn
 * @param {boolean} enabled
 * @returns {void}
 */
export function setRunButtonEnabled(btn, enabled) {
  btn.disabled = !enabled;
}

/**
 * Toggles dropzone dragover state.
 * @param {HTMLElement} dropzone
 * @param {boolean} isOver
 * @returns {void}
 */
export function setDropzoneDragState(dropzone, isOver) {
  dropzone.classList.toggle('table-nova-dropzone--dragover', Boolean(isOver));
}

/**
 * Renders staged files list.
 * @param {HTMLElement} listEl
 * @param {StagedFile[]} stagedFiles
 * @param {(stagedId: string) => void} [onRemove]
 * @returns {void}
 */
export function renderStagedFiles(listEl, stagedFiles, onRemove) {
  listEl.innerHTML = '';
  for (const s of stagedFiles || []) {
    listEl.appendChild(buildStagedFileItem(s));
  }

  if (onRemove) {
    mountRemoveHandler(listEl, onRemove);
  }
}

/**
 * Builds a staged-file LI element.
 * @param {StagedFile} staged
 * @returns {HTMLLIElement}
 */
export function buildStagedFileItem(staged) {
  const li = document.createElement('li');
  li.className = 'table-nova-fileitem';

  const meta = document.createElement('div');
  meta.className = 'table-nova-fileitem__meta';

  const name = document.createElement('div');
  name.className = 'table-nova-fileitem__name';
  name.textContent = staged.file?.name || '(unnamed)';

  const sub = document.createElement('div');
  sub.className = 'table-nova-fileitem__sub';
  sub.textContent = `${formatBytes(staged.file?.size || 0)} • ${staged.file?.type || 'application/octet-stream'}`;

  meta.appendChild(name);
  meta.appendChild(sub);

  const btn = document.createElement('button');
  btn.className = 'table-nova-btn table-nova-btn--icon';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Remove file');
  btn.textContent = '×';
  btn.dataset.TableNovaRemoveStagedId = staged.id;

  li.appendChild(meta);
  li.appendChild(btn);
  return li;
}

/**
 * Mounts delegated click handler for remove buttons.
 * @param {HTMLElement} listEl
 * @param {(stagedId: string) => void} onRemove
 * @returns {void}
 */
export function mountRemoveHandler(listEl, onRemove) {
  if (listEl.dataset.TableNovaRemoveHandlerMounted === '1') return;
  listEl.dataset.TableNovaRemoveHandlerMounted = '1';
  listEl.addEventListener('click', (e) => handleRemoveClick(e, onRemove));
}

/**
 * Handles clicks on remove buttons.
 * @param {MouseEvent} e
 * @param {(stagedId: string) => void} onRemove
 * @returns {void}
 */
export function handleRemoveClick(e, onRemove) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const btn = t.closest('[data-table-nova-remove-staged-id]');
  if (!btn) return;

  const id = /** @type {HTMLElement} */ (btn).dataset.TableNovaRemoveStagedId;
  if (id) onRemove(id);
}

/**
 * Renders the per-file options panel.
 * @param {HTMLElement} panelEl
 * @param {StagedFile[]} stagedFiles
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @param {(stagedId: string) => Promise<void>} onPreview
 * @returns {void}
 */
export function renderFileOptionsPanel(panelEl, stagedFiles, onUpdateOptions, onPreview) {
  panelEl.innerHTML = '';

  if (!stagedFiles || stagedFiles.length === 0) {
    const p = document.createElement('p');
    p.className = 'table-nova-muted';
    p.textContent = 'Add a file to configure preview, header handling, predicate casing, and datatypes.';
    panelEl.appendChild(p);
    return;
  }

  const selectedId = getSelectedStagedId(stagedFiles);
  const staged = stagedFiles.find((s) => s.id === selectedId) || stagedFiles[0];

  // File selector
  if (stagedFiles.length > 1) {
    panelEl.appendChild(buildFileSelector(stagedFiles, staged.id));
  }

  panelEl.appendChild(buildHeaderOption(staged, onUpdateOptions));
  panelEl.appendChild(buildPredicateOptions(staged, onUpdateOptions));
  panelEl.appendChild(buildPreviewSection(staged, onUpdateOptions, onPreview));
}

/**
 * Returns the currently selected stagedId (stored in panel dataset).
 * @param {StagedFile[]} stagedFiles
 * @returns {string}
 */
export function getSelectedStagedId(stagedFiles) {
  const first = stagedFiles?.[0]?.id || '';
  const saved = document.body.dataset.owSelectedStagedId;
  return saved && stagedFiles.some((s) => s.id === saved) ? saved : first;
}

/**
 * Builds file selector UI.
 * @param {StagedFile[]} stagedFiles
 * @param {string} selectedId
 * @returns {HTMLElement}
 */
export function buildFileSelector(stagedFiles, selectedId) {
  const wrap = document.createElement('div');
  wrap.className = 'table-nova-field';

  const label = document.createElement('label');
  label.className = 'table-nova-label';
  label.textContent = 'File';

  const sel = document.createElement('select');
  sel.className = 'table-nova-select';
  sel.addEventListener('change', (e) => handleSelectFileChange(e, stagedFiles));

  for (const s of stagedFiles) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.file?.name || s.id;
    opt.selected = s.id === selectedId;
    sel.appendChild(opt);
  }

  wrap.appendChild(label);
  wrap.appendChild(sel);
  return wrap;
}

/**
 * Handles staged file selection change.
 * @param {Event} e
 * @param {StagedFile[]} stagedFiles
 * @returns {void}
 */
export function handleSelectFileChange(e, stagedFiles) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const id = target.value;
  if (!stagedFiles.some((s) => s.id === id)) return;
  document.body.dataset.owSelectedStagedId = id;

  // Trigger a re-render by dispatching a custom event; main.js already re-renders on state updates,
  // but selection changes are local, so we re-render via bubbling event.
  document.dispatchEvent(new CustomEvent('table-nova:selected-file-changed', { detail: { stagedId: id } }));
}

/**
 * Builds header option (treat first row as header).
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {HTMLElement}
 */
export function buildHeaderOption(staged, onUpdateOptions) {
  const wrap = document.createElement('div');
  wrap.className = 'table-nova-field';

  const row = document.createElement('div');
  row.className = 'table-nova-checkboxrow';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = Boolean(staged.options?.treatFirstRowAsHeader ?? true);
  cb.addEventListener('change', (e) => handleHeaderToggle(e, staged, onUpdateOptions));

  const label = document.createElement('label');
  label.className = 'table-nova-label';
  label.textContent = 'Treat first row as header';

  row.appendChild(cb);
  row.appendChild(label);

  wrap.appendChild(row);
  return wrap;
}

/**
 * Handles header checkbox toggle.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleHeaderToggle(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;

  const next = { ...staged.options, treatFirstRowAsHeader: Boolean(target.checked) };
  onUpdateOptions(staged.id, next);
}

/**
 * Builds predicate options UI (prefixHas + casing).
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {HTMLElement}
 */
export function buildPredicateOptions(staged, onUpdateOptions) {
  const container = document.createElement('div');
  container.className = 'table-nova-preview';
  container.setAttribute('aria-label', 'Predicate schema');

  const header = document.createElement('div');
  header.className = 'table-nova-preview__header';

  const title = document.createElement('h3');
  title.className = 'table-nova-preview__title';
  title.textContent = 'Predicate schema';

  header.appendChild(title);
  container.appendChild(header);

  // prefixHas
  const prefixRow = document.createElement('div');
  prefixRow.className = 'table-nova-checkboxrow';
  prefixRow.style.marginTop = '0.5rem';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = Boolean(staged.options?.predicate?.prefixHas ?? true);
  cb.addEventListener('change', (e) => handlePrefixHasToggle(e, staged, onUpdateOptions));

  const lbl = document.createElement('label');
  lbl.className = 'table-nova-label';
  lbl.textContent = "Append 'has' before casing";

  prefixRow.appendChild(cb);
  prefixRow.appendChild(lbl);

  // casing
  const casingField = document.createElement('div');
  casingField.className = 'table-nova-field';
  casingField.style.marginTop = '0.75rem';

  const casingLabel = document.createElement('label');
  casingLabel.className = 'table-nova-label';
  casingLabel.textContent = 'Casing';

  const sel = document.createElement('select');
  sel.className = 'table-nova-select';
  sel.addEventListener('change', (e) => handleCasingChange(e, staged, onUpdateOptions));

  const options = [
    { value: 'camelCase', text: 'camelCase' },
    { value: 'PascalCase', text: 'PascalCase' },
    { value: 'snake_case', text: 'snake_case' },
    { value: 'SHOUTCASE', text: 'SHOUTCASE' }
  ];

  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text;
    o.selected = opt.value === (staged.options?.predicate?.casing ?? 'camelCase');
    sel.appendChild(o);
  }

  casingField.appendChild(casingLabel);
  casingField.appendChild(sel);

  container.appendChild(prefixRow);
  container.appendChild(casingField);

  return container;
}

/**
 * Handles prefixHas toggle.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handlePrefixHasToggle(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;
  const next = {
    ...staged.options,
    predicate: { ...staged.options.predicate, prefixHas: Boolean(target.checked) }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Handles casing change.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleCasingChange(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const next = {
    ...staged.options,
    predicate: { ...staged.options.predicate, casing: /** @type {any} */ (target.value) }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Builds preview section with optional datatype selectors.
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @param {(stagedId: string) => Promise<void>} onPreview
 * @returns {HTMLElement}
 */
export function buildPreviewSection(staged, onUpdateOptions, onPreview) {
  const container = document.createElement('section');
  container.className = 'table-nova-preview';

  const header = document.createElement('div');
  header.className = 'table-nova-preview__header';

  const title = document.createElement('h3');
  title.className = 'table-nova-preview__title';
  title.textContent = 'Preview data';

  const btn = document.createElement('button');
  btn.className = 'table-nova-btn table-nova-btn--tertiary';
  btn.type = 'button';
  btn.textContent = staged.options?.preview ? 'Refresh preview' : 'Preview first 5 rows';
  btn.addEventListener('click', () => onPreview(staged.id));

  header.appendChild(title);
  header.appendChild(btn);

  container.appendChild(header);

  if (!staged.options?.preview) {
    const p = document.createElement('p');
    p.className = 'table-nova-muted';
    p.style.margin = '0.5rem 0 0';
    p.textContent = 'Click Preview to inspect rows and set column datatypes.';
    container.appendChild(p);
    return container;
  }

  const body = document.createElement('div');
  body.className = 'table-nova-preview__body';

  const table = buildPreviewTable(staged);
  body.appendChild(table);

  const dtHelp = document.createElement('p');
  dtHelp.className = 'table-nova-muted';
  dtHelp.style.margin = '0.75rem 0 0';
  dtHelp.textContent = 'Datatype selections apply to the whole column (default xsd:string).';

  body.appendChild(dtHelp);
  container.appendChild(body);

  mountDatatypeSelectHandlers(container, staged, onUpdateOptions);
  return container;
}

/**
 * Builds a preview table (first 5 rows).
 * @param {StagedFile} staged
 * @returns {HTMLElement}
 */
export function buildPreviewTable(staged) {
  const preview = staged.options?.preview;
  const header = preview?.header || [];
  const rows = preview?.rows || [];

  const table = document.createElement('table');
  table.className = 'table-nova-table';

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');

  const effectiveCols = Math.max(header.length, ...(rows.map((r) => r.length)));
  const colKeys = Array.from({ length: effectiveCols }, (_, i) => header[i] || `Column${i + 1}`);

  for (let i = 0; i < effectiveCols; i += 1) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = colKeys[i];
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (let i = 0; i < effectiveCols; i += 1) {
      const td = document.createElement('td');
      td.textContent = String(r?.[i] ?? '');
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // Datatype selector row
  const dtr = document.createElement('tr');
  dtr.dataset.TableNovaDatatypeRow = '1';
  for (let i = 0; i < effectiveCols; i += 1) {
    const td = document.createElement('td');
    const sel = document.createElement('select');
    sel.className = 'table-nova-select';
    sel.dataset.TableNovaDatatypeColIndex = String(i);
    sel.appendChild(optionOf(`${XSD}string`, 'xsd:string'));
    sel.appendChild(optionOf(`${XSD}boolean`, 'xsd:boolean'));
    sel.appendChild(optionOf(`${XSD}integer`, 'xsd:integer'));
    sel.appendChild(optionOf(`${XSD}decimal`, 'xsd:decimal'));
    sel.appendChild(optionOf(`${XSD}double`, 'xsd:double'));
    sel.appendChild(optionOf(`${XSD}dateTime`, 'xsd:dateTime'));
    sel.appendChild(optionOf(`${XSD}date`, 'xsd:date'));
    sel.appendChild(optionOf(`${XSD}anyURI`, 'xsd:anyURI'));
    td.appendChild(sel);
    dtr.appendChild(td);
  }
  tbody.appendChild(dtr);

  table.appendChild(tbody);
  return table;
}

/**
 * Makes an <option> element.
 * @param {string} value
 * @param {string} label
 * @returns {HTMLOptionElement}
 */
export function optionOf(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

/**
 * Mounts datatype change handlers for preview table selects.
 * @param {HTMLElement} root
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function mountDatatypeSelectHandlers(root, staged, onUpdateOptions) {
  const selects = Array.from(root.querySelectorAll('select[data-table-nova-datatype-col-index]'));
  selects.forEach((sel) => {
    const idx = Number(sel.getAttribute('data-table-nova-datatype-col-index') || '0');
    const key = getColumnKeyForDatatype(staged, idx);
    const existing = staged.options?.datatypesByColumnKey?.[key];
    if (existing) sel.value = existing;

    sel.addEventListener('change', (e) => handleDatatypeChange(e, staged, idx, onUpdateOptions));
  });
}

/**
 * Determines column key string for a datatype selector.
 * If the file treats first row as header, we use header[idx]; otherwise ColumnA/ColumnB... (stable with schema rules).
 * @param {StagedFile} staged
 * @param {number} colIndex
 * @returns {string}
 */
export function getColumnKeyForDatatype(staged, colIndex) {
  const header = staged.options?.preview?.header || [];
  const label = header?.[colIndex];
  if (staged.options?.treatFirstRowAsHeader && label) return label;
  return `Column${excelLetters(colIndex)}`;
}

/**
 * Converts index to Excel letters.
 * @param {number} index
 * @returns {string}
 */
export function excelLetters(index) {
  let n = Math.max(0, Math.floor(index));
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Handles datatype dropdown change.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {number} colIndex
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleDatatypeChange(e, staged, colIndex, onUpdateOptions) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const key = getColumnKeyForDatatype(staged, colIndex);
  const next = {
    ...staged.options,
    datatypesByColumnKey: { ...(staged.options?.datatypesByColumnKey || {}), [key]: target.value }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Renders outputs into the output area.
 * @param {any} dom
 * @param {any} lastOutput
 * @returns {void}
 */
export function renderOutputs(dom, lastOutput) {
  dom.turtleText.value = lastOutput?.turtle || '';
  dom.jsonldText.value = lastOutput?.jsonldGraph || '';

  // Keep raw quads for sorting/filtering mount.
  dom.quadTable.__TableNovaQuads = lastOutput?.quads || [];

  renderQuadTable(dom.quadTable, lastOutput?.quads || []);
}

/**
 * Renders the quad table body.
 * @param {HTMLTableElement} table
 * @param {any[]} quads
 * @returns {void}
 */
export function renderQuadTable(table, quads) {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const q of quads || []) {
    const tr = document.createElement('tr');
    tr.appendChild(td(q.s));
    tr.appendChild(td(q.p));
    tr.appendChild(td(formatObject(q)));
    tr.appendChild(td(q.g));
    tbody.appendChild(tr);
  }
}

/**
 * Formats stored quad object for display.
 * @param {any} q
 * @returns {string}
 */
export function formatObject(q) {
  if (!q) return '';
  if (q.oType === 'iri') return `<${q.oValue}>`;
  const dt = q.datatypeIri ? `^^<${q.datatypeIri}>` : '';
  const lang = q.lang ? `@${q.lang}` : '';
  return `"${escapeLiteral(q.oValue)}"${lang}${dt}`;
}

/**
 * Escapes a literal value for display.
 * @param {string} s
 * @returns {string}
 */
export function escapeLiteral(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\"');
}

/**
 * Builds a TD element with text.
 * @param {string} s
 * @returns {HTMLTableCellElement}
 */
export function td(s) {
  const el = document.createElement('td');
  el.textContent = String(s ?? '');
  return el;
}

/**
 * Renders run list with delete/load controls.
 * @param {HTMLElement} listEl
 * @param {Array<{graphIri: string, filename: string, createdAtIso: string}>} runs
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function renderRunsList(listEl, runs, onDelete, onLoad) {
  listEl.innerHTML = '';
  for (const r of runs || []) {
    listEl.appendChild(buildRunItem(r));
  }
  mountRunListHandlers(listEl, onDelete, onLoad);
}

/**
 * Builds a run list item.
 * @param {{graphIri: string, filename: string, createdAtIso: string}} run
 * @returns {HTMLLIElement}
 */
export function buildRunItem(run) {
  const li = document.createElement('li');
  li.className = 'table-nova-runitem';

  const meta = document.createElement('div');
  meta.className = 'table-nova-fileitem__meta';

  const name = document.createElement('div');
  name.className = 'table-nova-fileitem__name';
  name.textContent = run.filename;

  const sub = document.createElement('div');
  sub.className = 'table-nova-fileitem__sub';
  sub.textContent = `${run.createdAtIso} • ${run.graphIri}`;

  meta.appendChild(name);
  meta.appendChild(sub);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.35rem';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'table-nova-btn table-nova-btn--tertiary';
  loadBtn.type = 'button';
  loadBtn.textContent = 'Load';
  loadBtn.dataset.TableNovaLoadGraphIri = run.graphIri;

  const delBtn = document.createElement('button');
  delBtn.className = 'table-nova-btn table-nova-btn--icon';
  delBtn.type = 'button';
  delBtn.textContent = '×';
  delBtn.setAttribute('aria-label', 'Delete run');
  delBtn.dataset.TableNovaDeleteGraphIri = run.graphIri;

  actions.appendChild(loadBtn);
  actions.appendChild(delBtn);

  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

/**
 * Mounts click handlers for run list (delegated).
 * @param {HTMLElement} listEl
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function mountRunListHandlers(listEl, onDelete, onLoad) {
  if (listEl.dataset.TableNovaRunHandlersMounted === '1') return;
  listEl.dataset.TableNovaRunHandlersMounted = '1';
  listEl.addEventListener('click', (e) => handleRunListClick(e, onDelete, onLoad));
}

/**
 * Handles run list click.
 * @param {MouseEvent} e
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function handleRunListClick(e, onDelete, onLoad) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const del = t.closest('[data-table-nova-delete-graph-iri]');
  if (del) {
    const iri = /** @type {HTMLElement} */ (del).dataset.TableNovaDeleteGraphIri;
    if (iri) void onDelete(iri);
    return;
  }

  const load = t.closest('[data-table-nova-load-graph-iri]');
  if (load) {
    const iri = /** @type {HTMLElement} */ (load).dataset.TableNovaLoadGraphIri;
    if (iri) void onLoad(iri);
  }
}

/**
 * Mounts tab switching behavior.
 * @param {HTMLElement|null} tabsEl
 * @param {NodeListOf<HTMLElement>} panels
 * @returns {void}
 */
export function mountTabs(tabsEl, panels) {
  if (!tabsEl) return;
  if (tabsEl.dataset.owTabsMounted === '1') return;
  tabsEl.dataset.owTabsMounted = '1';

  tabsEl.addEventListener('click', (e) => handleTabClick(e, tabsEl, panels));
}

/**
 * Handles tab click.
 * @param {MouseEvent} e
 * @param {HTMLElement} tabsEl
 * @param {NodeListOf<HTMLElement>} panels
 * @returns {void}
 */
export function handleTabClick(e, tabsEl, panels) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const btn = t.closest('button[data-tab]');
  if (!btn) return;

  const tab = btn.getAttribute('data-tab');
  if (!tab) return;

  const buttons = Array.from(tabsEl.querySelectorAll('button[data-tab]'));
  buttons.forEach((b) => b.classList.toggle('table-nova-tab--active', b === btn));

  panels.forEach((p) => p.classList.toggle('table-nova-tabpanel--active', p.getAttribute('data-panel') === tab));
}

/**
 * Adds sorting and filtering controls to the quad table.
 * @param {HTMLTableElement} table
 * @param {HTMLInputElement} filterInput
 * @returns {void}
 */
export function mountTableSortingAndFiltering(table, filterInput) {
  if (table.dataset.owSortMounted === '1') return;
  table.dataset.owSortMounted = '1';

  const thead = table.querySelector('thead');
  if (thead) thead.addEventListener('click', (e) => handleSortHeaderClick(e, table));

  filterInput.addEventListener('input', (e) => handleFilterInput(e, table));
}

/**
 * Handles clicking on table headers for sorting.
 * @param {MouseEvent} e
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function handleSortHeaderClick(e, table) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const th = t.closest('th[data-sort]');
  if (!th) return;

  const key = th.getAttribute('data-sort') || 's';
  const currentKey = table.dataset.owSortKey || 's';
  const currentDir = table.dataset.owSortDir || 'asc';
  const nextDir = currentKey === key && currentDir === 'asc' ? 'desc' : 'asc';

  table.dataset.owSortKey = key;
  table.dataset.owSortDir = nextDir;

  applySortAndFilter(table);
}

/**
 * Handles filter input.
 * @param {Event} e
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function handleFilterInput(e, table) {
  const t = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!t) return;
  table.dataset.TableNovaFilter = t.value || '';
  applySortAndFilter(table);
}

/**
 * Applies sorting and filtering to the current quad list.
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function applySortAndFilter(table) {
  const raw = /** @type {any[]} */ (table.__TableNovaQuads || []);
  const filter = String(table.dataset.TableNovaFilter || '').toLowerCase().trim();

  let out = raw.slice();

  if (filter) {
    out = out.filter((q) => {
      const o = formatObject(q);
      return [q.s, q.p, o, q.g].some((v) => String(v ?? '').toLowerCase().includes(filter));
    });
  }

  const key = table.dataset.owSortKey || 's';
  const dir = table.dataset.owSortDir || 'asc';
  const mult = dir === 'desc' ? -1 : 1;

  out.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * mult);

  renderQuadTable(table, out);
}

/**
 * Formats bytes for display.
 * @param {number} n
 * @returns {string}
 */
export function formatBytes(n) {
  const bytes = Number(n || 0);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
