// @ts-check
/**
 * @file Unit tests for redactor module.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../js/detectors.js';
import { redact } from '../js/redactor.js';
import { MODES } from '../js/constants.js';

describe('redactor — full mode', () => {
  it('replaces entities with [REDACTED] by default', () => {
    const text = 'mail a@b.co';
    const entities = detect(text);
    const { output } = redact(text, entities, MODES.FULL);
    assert.equal(output, 'mail [REDACTED]');
  });

  it('replaces entities with typed labels when typedLabels is true', () => {
    const text = 'mail a@b.co';
    const entities = detect(text);
    const { output } = redact(text, entities, MODES.FULL, { typedLabels: true });
    assert.equal(output, 'mail [REDACTED:EMAIL]');
  });
});

describe('redactor — partial mode', () => {
  it('partially masks card, email, IPv4, Aadhaar, PAN, and phone', () => {
    assert.equal(redact('4111 1111 1111 1111', detect('4111 1111 1111 1111'), MODES.PARTIAL).output, 'XXXX XXXX XXXX 1111');
    assert.equal(redact('4111-1111-1111-1111', detect('4111-1111-1111-1111'), MODES.PARTIAL).output, 'XXXX-XXXX-XXXX-1111');
    assert.equal(redact('john@ex.com', detect('john@ex.com'), MODES.PARTIAL).output, 'j***@ex.com');
    assert.equal(redact('192.168.1.10', detect('192.168.1.10'), MODES.PARTIAL).output, '192.168.XXX.XXX');
    assert.equal(redact('2345 6789 0124', detect('2345 6789 0124'), MODES.PARTIAL).output, 'XXXX XXXX 0124');
    assert.equal(redact('ABCPE1234F', detect('ABCPE1234F'), MODES.PARTIAL).output, 'XXXXXX234F');
    assert.equal(redact('+91 98765 43210', detect('+91 98765 43210'), MODES.PARTIAL).output, '+XX XXXXX X3210');
  });
});

describe('redactor — pseudo mode', () => {
  it('maps case-variant emails to the same pseudonym', () => {
    const text = 'John.Doe@Example.com … john.doe@example.com … x@y.com';
    const entities = detect(text);
    const { output, mapping } = redact(text, entities, MODES.PSEUDO);
    assert.equal(output, 'USER_01 … USER_01 … USER_02');
    assert.equal(mapping.get('USER_01'), 'John.Doe@Example.com');
    assert.equal(mapping.get('USER_02'), 'x@y.com');
  });

  it('maps format-variant phone numbers to the same pseudonym', () => {
    const text = '+91 98765 43210 and 09876543210';
    const entities = detect(text);
    const { output } = redact(text, entities, MODES.PSEUDO);
    assert.equal(output, 'PHONE_01 and PHONE_01');
  });

  it('handles 120 distinct emails with 2-digit then 3-digit zero-padded labels', () => {
    const emails = Array.from({ length: 120 }, (_, i) => `user${i}@example.com`);
    const text = emails.join(' ');
    const entities = detect(text);
    const { output } = redact(text, entities, MODES.PSEUDO);
    assert.ok(output.includes('USER_01'));
    assert.ok(output.includes('USER_99'));
    assert.ok(output.includes('USER_100'));
    assert.ok(output.includes('USER_120'));
  });
});

describe('redactor — integrity and offsets', () => {
  it('preserves special $& $1 $$ patterns around entities byte-for-byte', () => {
    const text = 'Price $$100 $& $1 for a@b.co end $$';
    const entities = detect(text);
    const { output } = redact(text, entities, MODES.FULL);
    assert.equal(output, 'Price $$100 $& $1 for [REDACTED] end $$');
  });

  it('produces replacements whose outStart/outEnd slice output to exact replacement', () => {
    const text = 'Hi a@b.co, call +91 98765 43210';
    const entities = detect(text);
    const { output, replacements } = redact(text, entities, MODES.PSEUDO);
    assert.equal(replacements.length, 2);
    for (const r of replacements) {
      assert.equal(output.slice(r.outStart, r.outEnd), r.replacement);
    }
  });

  it('is deterministic for same input and mode', () => {
    const text = 'a@b.co and 192.168.1.1';
    const e1 = detect(text);
    const e2 = detect(text);
    const r1 = redact(text, e1, MODES.PSEUDO);
    const r2 = redact(text, e2, MODES.PSEUDO);
    assert.equal(r1.output, r2.output);
  });
});
