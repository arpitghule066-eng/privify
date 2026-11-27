// @ts-check
/**
 * @file Unit tests for detectors module.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../js/detectors.js';
import { ENTITY_TYPES } from '../js/constants.js';
import { SAMPLE_TEXT } from '../js/samples.js';

describe('detectors — individual entity types', () => {
  it('detects EMAIL with exact start/end/value and normalized lowercase', () => {
    const text = 'Contact John.Doe@Example.com for help';
    const res = detect(text);
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.EMAIL);
    assert.equal(res[0].value, 'John.Doe@Example.com');
    assert.equal(res[0].normalized, 'john.doe@example.com');
    assert.equal(text.slice(res[0].start, res[0].end), 'John.Doe@Example.com');
  });

  it('detects Indian, US, and international PHONE numbers', () => {
    const res1 = detect('Call +91 98765 43210 now');
    assert.equal(res1.length, 1);
    assert.equal(res1[0].type, ENTITY_TYPES.PHONE);
    assert.equal(res1[0].value, '+91 98765 43210');
    assert.equal(res1[0].normalized, '9876543210');

    const res2 = detect('US line: (555) 123-4567');
    assert.equal(res2.length, 1);
    assert.equal(res2[0].type, ENTITY_TYPES.PHONE);

    const res3 = detect('Alt: 555-123-4567');
    assert.equal(res3.length, 1);
    assert.equal(res3[0].type, ENTITY_TYPES.PHONE);
  });

  it('detects valid IPV4 and rejects invalid IPv4 or version strings', () => {
    assert.equal(detect('Host 192.168.1.10 up').length, 1);
    assert.equal(detect('IP 999.1.1.1').length, 0);
    assert.equal(detect('version 1.2.3.4.5').length, 0);
  });

  it('detects IPV6 addresses', () => {
    const res = detect('Gateway 2001:db8::1 active');
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.IPV6);
    assert.equal(res[0].value, '2001:db8::1');
  });

  it('detects valid PAN and rejects invalid 4th-char PAN', () => {
    const res = detect('PAN: ABCPE1234F and decoy ABCDE1234F');
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.PAN);
    assert.equal(res[0].value, 'ABCPE1234F');
    assert.equal(res[0].normalized, 'ABCPE1234F');
  });

  it('detects CARD only when Luhn passes and assigns brand', () => {
    assert.equal(detect('Card: 1234 5678 9012 3456').length, 0);
    assert.equal(detect('1234567812345678').length, 0);
    assert.equal(detect('4111111111111112').length, 0);

    const res = detect('Card 4111-1111-1111-1111 ok');
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.CARD);
    assert.equal(res[0].brand, 'visa');
  });

  it('assigns high/medium confidence for Aadhaar and respects strictAadhaar', () => {
    const valid = detect('Aadhaar: 2345 6789 0124');
    assert.equal(valid.length, 1);
    assert.equal(valid[0].confidence, 'high');

    const invalidDefault = detect('Aadhaar: 1234 5678 9012');
    assert.equal(invalidDefault.length, 0, 'starts with 1 so not Aadhaar');

    const invalidVerhoeff = detect('Aadhaar: 2345 6789 0125');
    assert.equal(invalidVerhoeff.length, 1);
    assert.equal(invalidVerhoeff[0].confidence, 'medium');

    const strict = detect('Aadhaar: 2345 6789 0125', { strictAadhaar: true });
    assert.equal(strict.length, 0);
  });
});

describe('detectors — overlap, options, unicode, and safety', () => {
  it('prefers EMAIL over PHONE when email contains 10 digits', () => {
    const res = detect('Mail 9876543210@upi.example today');
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.EMAIL);
  });

  it('respects enabledTypes option', () => {
    const res = detect('a@b.co +91 98765 43210', {
      enabledTypes: new Set([ENTITY_TYPES.PHONE]),
    });
    assert.equal(res.length, 1);
    assert.equal(res[0].type, ENTITY_TYPES.PHONE);
  });

  it('returns non-overlapping entities sorted by start', () => {
    const res = detect(SAMPLE_TEXT);
    for (let i = 1; i < res.length; i++) {
      assert.ok(res[i].start >= res[i - 1].end, `Overlap at index ${i}`);
    }
  });

  it('detects expected entity counts on SAMPLE_TEXT', () => {
    const res = detect(SAMPLE_TEXT);
    const counts = {};
    for (const e of res) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    assert.equal(counts.EMAIL, 4);
    assert.equal(counts.PHONE, 4);
    assert.equal(counts.IPV4, 3);
    assert.equal(counts.IPV6, 1);
    assert.equal(counts.PAN, 3);
    assert.equal(counts.AADHAAR, 3);
    assert.equal(counts.CARD, 3);
  });

  it('handles Unicode/emoji around entities without shifting offsets', () => {
    const text = '📧 a@b.co';
    const res = detect(text);
    assert.equal(res.length, 1);
    assert.equal(text.slice(res[0].start, res[0].end), 'a@b.co');
  });

  it('returns empty array for empty string and handles 1 MB random text', () => {
    assert.deepEqual(detect(''), []);
    const big = 'lorem ipsum dolor sit amet 12345 '.repeat(32000);
    const res = detect(big);
    assert.ok(Array.isArray(res));
  });

  it('completes ReDoS stress inputs in under 200 ms', () => {
    const t0 = performance.now();
    detect('a'.repeat(50000) + '@');
    const t1 = performance.now();
    assert.ok(t1 - t0 < 200, `Email ReDoS took ${t1 - t0}ms`);

    const t2 = performance.now();
    detect('1 '.repeat(50000));
    const t3 = performance.now();
    assert.ok(t3 - t2 < 200, `Digit ReDoS took ${t3 - t2}ms`);
  });
});
