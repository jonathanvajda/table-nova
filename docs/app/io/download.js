/**
 * @file Browser download helpers.
 */

/**
 * Downloads text content as a file.
 * @param {string} filename
 * @param {string} text
 * @param {string} [mime]
 * @returns {void}
 */
export function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
