// @ts-check
/**
 * @file Performance budget tests for 1 MB inputs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { process } from '../js/engine.js';
import { redact } from '../js/redactor.js';
import { MODES } from '../js/constants.js';
import { SAMPLE_TEXT } from '../js/samples.js';

describe('performance — 1 MB budgets', () => {
  it('processes 1 MB of mixed sample text across all 3 modes under 1500 ms', () => {
    const repeats = Math.ceil((1024 * 1024) / SAMPLE_TEXT.length);
    const bigText = SAMPLE_TEXT.repeat(repeats).slice(0, 1024 * 1024);

    const t0 = performance.now();
    const full = process(bigText, { mode: MODES.FULL });
    const partial = redact(bigText, full.entities, MODES.PARTIAL);
    const pseudo = redact(bigText, full.entities, MODES.PSEUDO);
    const elapsed = performance.now() - t0;

    assert.ok(full.entities.length > 0);
    assert.ok(partial.output.length > 0);
    assert.ok(pseudo.output.length > 0);
    assert.ok(elapsed < 1500, `1 MB process + 3 modes took ${elapsed.toFixed(1)} ms (budget 1500 ms)`);
  });

  it('switches mode (redact only) on 1 MB input under 300 ms', () => {
    const repeats = Math.ceil((1024 * 1024) / SAMPLE_TEXT.length);
    const bigText = SAMPLE_TEXT.repeat(repeats).slice(0, 1024 * 1024);
    const { entities } = process(bigText, { mode: MODES.FULL });

    const t0 = performance.now();
    const res = redact(bigText, entities, MODES.PSEUDO);
    const elapsed = performance.now() - t0;

    assert.ok(res.output.length > 0);
    assert.ok(elapsed < 300, `1 MB mode switch took ${elapsed.toFixed(1)} ms (budget 300 ms)`);
  });
});
