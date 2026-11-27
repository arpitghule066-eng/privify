// @ts-check
/**
 * @file Unit tests for AI assist module with mocked LanguageModel.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAiAvailable, detectWithAI } from '../js/ai-assist.js';

describe('ai-assist — availability and detection', () => {
  it('returns unavailable when LanguageModel is absent', async () => {
    const res = await isAiAvailable();
    assert.equal(res.available, false);
    assert.equal(res.status, 'unavailable');
  });

  it('maps valid JSON entities with verbatim offsets', async () => {
    const factory = {
      async create() {
        return {
          async prompt() {
            return JSON.stringify([
              { type: 'PERSON', text: 'Alice Smith' },
              { type: 'ADDRESS', text: '42 Main St' },
            ]);
          },
          destroy() {},
        };
      },
    };
    const text = 'Contact Alice Smith at 42 Main St today.';
    const res = await detectWithAI(text, { factory });
    assert.equal(res.length, 2);
    assert.equal(res[0].type, 'PERSON');
    assert.equal(text.slice(res[0].start, res[0].end), 'Alice Smith');
    assert.equal(res[1].type, 'ADDRESS');
    assert.equal(text.slice(res[1].start, res[1].end), '42 Main St');
  });

  it('returns empty array without throwing on invalid JSON', async () => {
    const factory = {
      async create() {
        return {
          async prompt() {
            return 'not valid json at all';
          },
          destroy() {},
        };
      },
    };
    const res = await detectWithAI('Hello Alice', { factory });
    assert.deepEqual(res, []);
  });

  it('drops hallucinated text not present verbatim and disallowed types like SSN', async () => {
    const factory = {
      async create() {
        return {
          async prompt() {
            return JSON.stringify([
              { type: 'PERSON', text: 'Ghost Name' },
              { type: 'SSN', text: 'Alice' },
              { type: 'PERSON', text: 'Alice' },
            ]);
          },
          destroy() {},
        };
      },
    };
    const res = await detectWithAI('Hello Alice', { factory });
    assert.equal(res.length, 1);
    assert.equal(res[0].text, 'Alice');
  });

  it('rejects cleanly when AbortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const factory = {
      async create() {
        return {
          async prompt() {
            return '[]';
          },
          destroy() {},
        };
      },
    };
    await assert.rejects(
      () => detectWithAI('Hello Alice', { signal: controller.signal, factory }),
      { name: 'AbortError' },
    );
  });
});
