/**
 * @file UI telemetry helpers (logger, toasts, safe async wrapper).
 */

/**
 * @typedef {Object} Logger
 * @property {(event: string, data?: any) => void} info
 * @property {(event: string, data?: any) => void} warn
 * @property {(event: string, data?: any) => void} error
 */

/**
 * Creates a scoped logger.
 * @param {{scope: string, enabled: boolean}} params
 * @returns {Logger}
 */
export function createLogger({ scope, enabled }) {
  /**
   * @param {'info'|'warn'|'error'} level
   * @param {string} event
   * @param {any} data
   * @returns {void}
   */
  function emit(level, event, data) {
    if (!enabled) return;
    const payload = data ?? {};
    // eslint-disable-next-line no-console
    console[level](`[tablenova:${scope}] ${event}`, payload);
  }

  return Object.freeze({
    info: (event, data) => emit('info', event, data),
    warn: (event, data) => emit('warn', event, data),
    error: (event, data) => emit('error', event, data)
  });
}

/**
 * @typedef {Object} ToastBus
 * @property {(toast: {title: string, body: string, kind?: 'success'|'warning'|'error', timeoutMs?: number}) => void} show
 */

/**
 * Creates a lightweight toast bus.
 * @param {{rootId: string}} params
 * @returns {ToastBus}
 */
export function createToastBus({ rootId }) {
  const root = /** @type {HTMLElement|null} */ (document.getElementById(rootId));

  /**
   * @param {{title: string, body: string, kind?: 'success'|'warning'|'error'}} toast
   * @returns {HTMLElement}
   */
  function buildToastEl({ title, body, kind }) {
    const el = document.createElement('div');
    const status = kind || inferToastKind(title);
    el.className = `toast ${status} show`;
    el.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.textContent = body ? `${title}: ${body}` : title;
    el.appendChild(text);
    return el;
  }

  return Object.freeze({
    show: ({ title, body, kind, timeoutMs = 2600 }) => {
      if (!root) return;
      const el = buildToastEl({ title, body, kind });
      root.appendChild(el);
      window.setTimeout(() => el.remove(), timeoutMs);
    }
  });
}

/**
 * Infers a shared toast style from the title used by Table Nova call sites.
 * @param {string} title
 * @returns {'success'|'warning'|'error'}
 */
export function inferToastKind(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('fail') || t.includes('error')) return 'error';
  if (t.includes('nothing') || t.includes('removed') || t.includes('cleared') || t.includes('deleted')) return 'warning';
  return 'success';
}

/**
 * Safely runs an async function with logging and an optional error handler.
 * @template T
 * @param {{error: (event: string, data?: any) => void}} log
 * @param {() => Promise<T>} fn
 * @param {(err: any) => void} [onError]
 * @returns {Promise<T|undefined>}
 */
export async function safeAsync(log, fn, onError) {
  try {
    return await fn();
  } catch (err) {
    log.error('safeAsync_error', { err });
    if (onError) onError(err);
    return undefined;
  }
}
