/**
 * @file Browser download helpers.
 */

import { downloadTextFile as downloadBrowserTextFile } from '../shared/format-registry/browser-file-actions.js';

/**
 * Downloads text content as a file.
 * @param {string} filename
 * @param {string} text
 * @param {string} [mime]
 * @returns {void}
 */
export function downloadTextFile(filename, text, mime = '') {
  downloadBrowserTextFile(filename, text, { mimeType: mime || undefined });
}
