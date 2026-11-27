// @ts-check
/**
 * @file File I/O utilities — validation, reading, and downloading.
 * DOM module — interacts with File API and DOM for downloads.
 * @module fileio
 */

import { LIMITS, ALLOWED_EXTENSIONS, ALLOWED_MIMES, MESSAGES } from './constants.js';

/**
 * Custom validation error.
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - Error message.
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a file for upload.
 * @param {File} file - File to validate.
 * @throws {ValidationError} If the file is invalid.
 */
export function validateFile(file) {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(MESSAGES.FILE_INVALID_TYPE);
  }

  if (name.lastIndexOf('.') !== name.indexOf('.') && !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(MESSAGES.FILE_INVALID_TYPE);
  }

  // Check for double extension attacks like .txt.exe
  const parts = name.split('.');
  if (parts.length > 2) {
    const realExt = '.' + parts[parts.length - 1];
    if (!ALLOWED_EXTENSIONS.includes(realExt)) {
      throw new ValidationError(MESSAGES.FILE_INVALID_TYPE);
    }
  }

  if (!ALLOWED_MIMES.includes(file.type)) {
    throw new ValidationError(MESSAGES.FILE_INVALID_TYPE);
  }

  if (file.size > LIMITS.MAX_FILE_BYTES) {
    throw new ValidationError(MESSAGES.FILE_TOO_LARGE);
  }
}

/**
 * Read a file's text content, stripping BOM and rejecting binary.
 * @param {File} file - File to read.
 * @returns {Promise<string>} File content.
 * @throws {ValidationError} If the file contains NUL bytes.
 */
export async function readFile(file) {
  const text = await file.text();

  if (text.includes('\u0000')) {
    throw new ValidationError(MESSAGES.FILE_BINARY);
  }

  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }

  return text;
}

/**
 * Download text as a file.
 * @param {string} text - Content to download.
 * @param {string} filename - File name for the download.
 * @param {string} [mime='text/plain'] - MIME type.
 */
export function downloadText(text, filename, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Generate the sanitized output filename.
 * @param {string} [originalName] - Original file name, if any.
 * @returns {string} Sanitized filename.
 */
export function getSanitizedFilename(originalName) {
  if (!originalName) return 'sanitized_output.txt';
  const dotIdx = originalName.lastIndexOf('.');
  if (dotIdx === -1) return originalName + '_sanitized';
  const base = originalName.slice(0, dotIdx);
  const ext = originalName.slice(dotIdx);
  return base + '_sanitized' + ext;
}
