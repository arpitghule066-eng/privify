// @ts-check
/**
 * @file Unit tests for CSV module.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, stringifyCSV, neutralizeFormulas } from '../js/csv.js';

describe('csv — parseCSV and stringifyCSV', () => {
  it('round-trips quoted fields with commas, escaped quotes, and newlines', () => {
    const rows = [
      ['Name', 'Notes'],
      ['Doe, John', 'Line 1\nLine 2 with "quotes"'],
    ];
    const csv = stringifyCSV(rows);
    const parsed = parseCSV(csv);
    assert.deepEqual(parsed, rows);
  });

  it('handles CRLF and LF line endings', () => {
    const parsed = parseCSV('a,b\r\n1,2\n3,4');
    assert.deepEqual(parsed, [['a', 'b'], ['1', '2'], ['3', '4']]);
  });
});

describe('csv — neutralizeFormulas', () => {
  it('prefixes dangerous formula starters with single quote', () => {
    const rows = [['=SUM(A1)', '@cmd', '+HYPERLINK("http://x")', '-cmd', '\tval', '\rval']];
    const safe = neutralizeFormulas(rows);
    assert.deepEqual(safe, [["'=SUM(A1)", "'@cmd", "'+HYPERLINK(\"http://x\")", "'-cmd", "'\tval", "'\rval"]]);
  });

  it('does not modify negative numbers, phone numbers, or plain text', () => {
    const rows = [['-42', '+91 98765 43210', 'plain text', '']];
    const safe = neutralizeFormulas(rows);
    assert.deepEqual(safe, rows);
  });
});
