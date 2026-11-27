// @ts-check
/**
 * @file Integration tests for the processing engine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { process } from '../js/engine.js';
import { MODES } from '../js/constants.js';
import { SAMPLE_TEXT } from '../js/samples.js';

describe('engine — process integration', () => {
  it('processes SAMPLE_TEXT across full, partial, and pseudo modes', () => {
    const full = process(SAMPLE_TEXT, { mode: MODES.FULL });
    assert.ok(full.output.includes('[REDACTED]'));
    assert.ok(!full.output.includes('John.Doe@Example.com'));
    assert.ok(!full.output.includes('4111 1111 1111 1111'));
    assert.equal(full.entities.length, 21);

    const partial = process(SAMPLE_TEXT, { mode: MODES.PARTIAL });
    assert.ok(partial.output.includes('J***@Example.com'));
    assert.ok(partial.output.includes('XXXX XXXX XXXX 1111'));

    const pseudo = process(SAMPLE_TEXT, { mode: MODES.PSEUDO });
    assert.ok(pseudo.output.includes('USER_01'));
    assert.ok(pseudo.output.includes('PHONE_01'));
    assert.ok(pseudo.mapping.size > 0);
  });

  it('is idempotent in full mode (re-processing output finds 0 new PII)', () => {
    const first = process(SAMPLE_TEXT, { mode: MODES.FULL });
    const second = process(first.output, { mode: MODES.FULL });
    assert.equal(second.entities.length, 0);
    assert.equal(second.output, first.output);
  });

  it('leaves decoys untouched in SAMPLE_TEXT', () => {
    const { output } = process(SAMPLE_TEXT, { mode: MODES.FULL });
    assert.ok(output.includes('999.1.1.1'));
    assert.ok(output.includes('ABCDE1234F'));
    assert.ok(output.includes('1234 5678 9012 3456'));
    assert.ok(output.includes('4111111111111112'));
    assert.ok(output.includes('1.2.3.4.5'));
  });
});
