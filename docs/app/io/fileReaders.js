/**
 * @file File reading helpers for browser File objects.
 */

/**
 * Reads a File as UTF-8 text.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Failed to read file as text.'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(file);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Reads a File as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Failed to read file as ArrayBuffer.'));
      reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(err);
    }
  });
}
