// @ts-check
/**
 * @file Checks that tracked repo files are under the 10 MB limit.
 */

import { statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Get total size of files in a directory, excluding ignored dirs.
 * @param {string} dir - Directory to measure.
 * @param {Set<string>} ignore - Directory names to skip.
 * @returns {number} Total bytes.
 */
function dirSize(dir, ignore) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full, ignore);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

const IGNORE = new Set(['node_modules', '_site', 'coverage', 'test-results', 'playwright-report', '.lighthouseci', '.firebase', '.git']);
const totalBytes = dirSize(ROOT, IGNORE);
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

console.log(`Repo size: ${totalMB} MB (${totalBytes} bytes)`);

if (totalBytes > MAX_BYTES) {
  console.error(`FAIL: Repo size ${totalMB} MB exceeds limit of 10 MB`);
  process.exit(1);
} else {
  console.log('PASS: Under 10 MB limit');
}
