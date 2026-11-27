// @ts-check
/**
 * @file Unit tests for file I/O validation and reading.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, readFile, getSanitizedFilename, ValidationError } from '../js/fileio.js';
import { LIMITS } from '../js/constants.js';

function fakeFile(name, type, size, content = '') {
  return {
    name,
    type,
    size,
    async text() {
      return content;
    },
  };
}

describe('fileio — validateFile', () => {
  it('accepts valid .txt and .CSV files within size limit', () => {
    assert.doesNotThrow(() => validateFile(fakeFile('notes.txt', 'text/plain', 100)));
    assert.doesNotThrow(() => validateFile(fakeFile('DATA.CSV', 'text/csv', 200)));
    assert.doesNotThrow(() => validateFile(fakeFile('data.csv', 'application/vnd.ms-excel', 200)));
    assert.doesNotThrow(() => validateFile(fakeFile('plain.txt', '', 200)));
  });

  it('rejects disallowed extensions including double extensions', () => {
    assert.throws(() => validateFile(fakeFile('malware.exe', 'application/octet-stream', 10)), ValidationError);
    assert.throws(() => validateFile(fakeFile('notes.txt.exe', 'text/plain', 10)), ValidationError);
    assert.throws(() => validateFile(fakeFile('doc.pdf', 'application/pdf', 10)), ValidationError);
  });

  it('rejects disallowed MIME types even with .txt extension', () => {
    assert.throws(() => validateFile(fakeFile('fake.txt', 'application/pdf', 10)), ValidationError);
  });

  it('rejects files larger than 5 MB', () => {
    assert.throws(
      () => validateFile(fakeFile('huge.txt', 'text/plain', LIMITS.MAX_FILE_BYTES + 1)),
      ValidationError,
    );
  });
});

describe('fileio — readFile and filename helpers', () => {
  it('rejects files containing NUL bytes', async () => {
    await assert.rejects(
      () => readFile(/** @type {any} */ (fakeFile('bin.txt', 'text/plain', 5, 'ab\u0000cd'))),
      ValidationError,
    );
  });

  it('strips leading UTF-8 BOM and preserves original line endings', async () => {
    const content = '\uFEFFline1\r\nline2\nline3';
    const text = await readFile(/** @type {any} */ (fakeFile('bom.txt', 'text/plain', 20, content)));
    assert.equal(text, 'line1\r\nline2\nline3');
  });

  it('builds sanitized output filenames', () => {
    assert.equal(getSanitizedFilename(), 'sanitized_output.txt');
    assert.equal(getSanitizedFilename('report.csv'), 'report_sanitized.csv');
    assert.equal(getSanitizedFilename('my.notes.txt'), 'my.notes_sanitized.txt');
  });
});
