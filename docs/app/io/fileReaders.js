/**
 * @file File reading helpers for browser File objects.
 *
 * Table Nova keeps this small facade so existing parser modules do not need to
 * know where the promoted browser file package lives.
 */

export {
  readFileAsArrayBuffer,
  readFileAsText
} from '../shared/browser-file-io/index.js';
