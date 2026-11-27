// @ts-check
/**
 * @file Branch-coverage tests for edge cases in fileio, ai-assist,
 * redactor, detectors and engine.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, downloadText, getSanitizedFilename, ValidationError } from '../js/fileio.js';
import { isAiAvailable, detectWithAI } from '../js/ai-assist.js';
import { redact } from '../js/redactor.js';
import { detect, normalize } from '../js/detectors.js';
import { process as processText } from '../js/engine.js';
import { LIMITS } from '../js/constants.js';

/**
 * Append a Luhn check digit to a numeric prefix.
 * @param {string} prefix - Digits without the check digit.
 * @returns {string} Luhn-valid number.
 */
function withLuhn(prefix) {
  let sum = 0;
  const digits = [...prefix].reverse().map(Number);
  digits.forEach((d, i) => {
    let v = i % 2 === 0 ? d * 2 : d;
    if (v > 9) v -= 9;
    sum += v;
  });
  return prefix + String((10 - (sum % 10)) % 10);
}

/**
 * Build a minimal entity for redaction tests.
 * @param {string} type - Entity type.
 * @param {string} value - Entity text.
 * @returns {Object} Entity spanning the whole text.
 */
function entity(type, value) {
  return { id: 'e1', type, value, start: 0, end: value.length, confidence: 'high', normalized: value };
}

/**
 * Create a fake File-like object with a text() method.
 * @param {string} content - File contents.
 * @returns {{ text: () => Promise<string> }} File stub.
 */
function fakeFile(content) {
  return { text: async () => content };
}

describe('fileio — reading and filenames', () => {
  it('rejects files containing NUL bytes as binary', async () => {
    await assert.rejects(readFile(/** @type {any} */ (fakeFile('abc\u0000def'))), ValidationError);
  });

  it('strips a leading UTF-8 BOM', async () => {
    assert.equal(await readFile(/** @type {any} */ (fakeFile('﻿hello'))), 'hello');
  });

  it('returns plain text unchanged', async () => {
    assert.equal(await readFile(/** @type {any} */ (fakeFile('plain'))), 'plain');
  });

  it('names sanitized output after the original file', () => {
    assert.equal(getSanitizedFilename(), 'sanitized_output.txt');
    assert.equal(getSanitizedFilename('notes'), 'notes_sanitized');
    assert.equal(getSanitizedFilename('data.csv'), 'data_sanitized.csv');
  });

  it('downloads via a temporary link and revokes the object URL', () => {
    const calls = [];
    const anchor = { href: '', download: '', click: () => calls.push('click') };
    const g = /** @type {any} */ (globalThis);
    const saved = { document: g.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    g.document = {
      createElement: () => anchor,
      body: { appendChild: () => calls.push('append'), removeChild: () => calls.push('remove') },
    };
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = (url) => { calls.push(`revoke:${url}`); };
    try {
      downloadText('safe text', 'out.txt');
      assert.equal(anchor.download, 'out.txt');
      assert.deepEqual(calls, ['append', 'click', 'remove', 'revoke:blob:test']);
    } finally {
      g.document = saved.document;
      URL.createObjectURL = saved.create;
      URL.revokeObjectURL = saved.revoke;
    }
  });
});

describe('ai-assist — availability states', () => {
  const g = /** @type {any} */ (globalThis);
  afterEach(() => { delete g.LanguageModel; delete g.ai; });

  it('reports available via availability()', async () => {
    g.LanguageModel = { availability: async () => 'available' };
    assert.deepEqual(await isAiAvailable(), { available: true, status: 'available' });
  });

  it('reports downloadable via availability()', async () => {
    g.LanguageModel = { availability: async () => 'downloadable' };
    assert.equal((await isAiAvailable()).status, 'downloadable');
  });

  it('supports the legacy capabilities() API', async () => {
    g.ai = { languageModel: { capabilities: async () => ({ available: 'readily' }) } };
    assert.equal((await isAiAvailable()).available, true);
    g.ai = { languageModel: { capabilities: async () => ({ available: 'after-download' }) } };
    assert.equal((await isAiAvailable()).status, 'downloadable');
  });

  it('treats unknown states, missing APIs and errors as unavailable', async () => {
    g.LanguageModel = { availability: async () => 'no' };
    assert.equal((await isAiAvailable()).status, 'unavailable');
    g.LanguageModel = {};
    assert.equal((await isAiAvailable()).status, 'unavailable');
    g.LanguageModel = { availability: async () => { throw new Error('boom'); } };
    assert.equal((await isAiAvailable()).status, 'unavailable');
  });
});

describe('ai-assist — detection edge cases', () => {
  /**
   * Build a mock factory whose session returns the given prompt result.
   * @param {() => Promise<string>} prompt - Prompt implementation.
   * @param {boolean} [withDestroy=true] - Whether the session has destroy().
   * @returns {Object} Mock LanguageModel factory.
   */
  const factoryFor = (prompt, withDestroy = true) => ({
    create: async () => (withDestroy ? { prompt, destroy() {} } : { prompt }),
  });

  it('returns no entities when no model is available', async () => {
    assert.deepEqual(await detectWithAI('Alice'), []);
  });

  it('supports a callable factory without create()', async () => {
    const factory = async () => ({ prompt: async () => '[{"type":"PERSON","text":"Alice"}]' });
    const res = await detectWithAI('Hi Alice', { factory });
    assert.deepEqual(res.map((e) => [e.text, e.start]), [['Alice', 3]]);
  });

  it('extracts a JSON array wrapped in extra prose', async () => {
    const res = await detectWithAI('Bob lives here', {
      factory: factoryFor(async () => 'Sure! [{"type":"PERSON","text":"Bob"}] done', false),
    });
    assert.equal(res.length, 1);
  });

  it('ignores non-array JSON, malformed items and missing brackets', async () => {
    for (const reply of ['{"type":"PERSON"}', 'no json here', '[null, {"type":1,"text":"x"}]']) {
      assert.deepEqual(await detectWithAI('Bob', { factory: factoryFor(async () => reply) }), []);
    }
  });

  it('swallows model errors but propagates aborts', async () => {
    const failing = factoryFor(async () => { throw new Error('model crashed'); });
    assert.deepEqual(await detectWithAI('Bob', { factory: failing }), []);
    const aborting = factoryFor(async () => { throw new DOMException('Aborted', 'AbortError'); });
    await assert.rejects(detectWithAI('Bob', { factory: aborting }), { name: 'AbortError' });
  });

  it('stops before prompting when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const factory = factoryFor(async () => '[]');
    await assert.rejects(detectWithAI('Bob', { factory, signal: controller.signal }), { name: 'AbortError' });
  });

  it('maps offsets correctly across multiple chunks', async () => {
    const text = 'x'.repeat(LIMITS.AI_CHUNK_SIZE) + 'Carol';
    const res = await detectWithAI(text, {
      factory: factoryFor(async () => '[{"type":"PERSON","text":"Carol"}]'),
    });
    assert.deepEqual(res.map((e) => e.start), [LIMITS.AI_CHUNK_SIZE]);
  });
});

describe('redactor — partial mode edge cases', () => {
  /**
   * Redact a single entity covering the whole value.
   * @param {string} type - Entity type.
   * @param {string} value - Entity text.
   * @param {string} [mode='partial'] - Redaction mode.
   * @returns {string} Redacted output.
   */
  const one = (type, value, mode = 'partial') => redact(value, [entity(type, value)], mode).output;

  it('masks malformed emails safely', () => {
    assert.equal(one('EMAIL', '@x.com'), 'X***@unknown');
  });

  it('keeps very short PAN and digit values intact', () => {
    assert.equal(one('PAN', 'ABC'), 'ABC');
    assert.equal(one('PHONE', '123'), '123');
  });

  it('masks IPv6, person names and addresses', () => {
    assert.equal(one('IPV6', '2001:db8:1:2'), '2001:db8:XXXX:XXXX');
    assert.equal(one('PERSON', 'Jo Ann B'), 'J* A** B*');
    assert.equal(one('ADDRESS', '42 Main St'), '[ADDRESS]');
  });

  it('falls back to [REDACTED] for unknown types and modes', () => {
    assert.equal(one('UNKNOWN', 'secret'), '[REDACTED]');
    assert.equal(one('EMAIL', 'a@b.co', 'bogus-mode'), '[REDACTED]');
  });
});

describe('detectors — normalization and card brands', () => {
  it('expands compressed IPv6 addresses on either side', () => {
    assert.equal(normalize('IPV6', '::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
    assert.equal(normalize('IPV6', 'FE80::'), 'fe80:0000:0000:0000:0000:0000:0000:0000');
  });

  it('returns unknown types unchanged', () => {
    assert.equal(normalize('OTHER', 'Value'), 'Value');
  });

  it('identifies Mastercard, Discover, RuPay and unknown brands', () => {
    const cases = [
      [withLuhn('510510510510510'), 'mastercard'],
      [withLuhn('601111111111111'), 'discover'],
      [withLuhn('608112345678901'), 'rupay'],
      [withLuhn('900000000000000'), 'unknown'],
    ];
    for (const [number, brand] of cases) {
      const cards = detect(`card ${number} end`).filter((e) => e.type === 'CARD');
      assert.equal(cards.length, 1, `expected one card for ${number}`);
      assert.equal(/** @type {any} */ (cards[0]).brand, brand);
    }
  });
});

describe('engine — defaults', () => {
  it('uses full redaction when no mode is given', () => {
    const res = processText('mail a@b.co');
    assert.equal(res.output, 'mail [REDACTED]');
    assert.equal(res.counts.EMAIL, 1);
  });
});
