// @ts-check
/**
 * @file Unit tests for validators module.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { luhn, verhoeff, isValidIPv4, isValidIPv6, isValidPAN } from '../js/validators.js';

describe('validators — luhn', () => {
  it('accepts valid Visa, Mastercard, and Amex card numbers', () => {
    assert.equal(luhn('4111111111111111'), true);
    assert.equal(luhn('5500000000000004'), true);
    assert.equal(luhn('378282246310005'), true);
  });

  it('rejects 16-digit numbers that fail Luhn', () => {
    assert.equal(luhn('1234567890123456'), false);
    assert.equal(luhn('4111111111111112'), false);
  });

  it('rejects empty string, all zeros, and non-digit characters', () => {
    assert.equal(luhn(''), false);
    assert.equal(luhn('0000000000000000'), false);
    assert.equal(luhn('4111-1111-1111-1111'), false);
    assert.equal(luhn('abcd'), false);
  });
});

describe('validators — verhoeff', () => {
  it('accepts valid Verhoeff 12-digit Aadhaar numbers', () => {
    assert.equal(verhoeff('234567890124'), true);
    assert.equal(verhoeff('987654321096'), true);
  });

  it('rejects invalid Verhoeff checksums and malformed inputs', () => {
    assert.equal(verhoeff('234567890125'), false);
    assert.equal(verhoeff('123456789012'), false);
    assert.equal(verhoeff(''), false);
    assert.equal(verhoeff('23456789012a'), false);
  });
});

describe('validators — isValidIPv4', () => {
  it('accepts valid IPv4 addresses', () => {
    assert.equal(isValidIPv4('192.168.1.10'), true);
    assert.equal(isValidIPv4('255.255.255.255'), true);
    assert.equal(isValidIPv4('0.0.0.0'), true);
    assert.equal(isValidIPv4('10.0.0.5'), true);
  });

  it('rejects out-of-range octets, leading zeros, and wrong segment counts', () => {
    assert.equal(isValidIPv4('256.1.1.1'), false);
    assert.equal(isValidIPv4('01.2.3.4'), false);
    assert.equal(isValidIPv4('1.2.3'), false);
    assert.equal(isValidIPv4('1.2.3.4.5'), false);
    assert.equal(isValidIPv4('999.1.1.1'), false);
    assert.equal(isValidIPv4('192.168..1'), false);
  });
});

describe('validators — isValidIPv6', () => {
  it('accepts valid full and compressed IPv6 addresses', () => {
    assert.equal(isValidIPv6('2001:db8::1'), true);
    assert.equal(isValidIPv6('::1'), true);
    assert.equal(isValidIPv6('2001:0db8:0000:0000:0000:0000:0000:0001'), true);
    assert.equal(isValidIPv6('fe80::'), true);
  });

  it('rejects invalid IPv6 addresses', () => {
    assert.equal(isValidIPv6('2001:db8:::1'), false);
    assert.equal(isValidIPv6('2001::db8::1'), false);
    assert.equal(isValidIPv6(''), false);
    assert.equal(isValidIPv6('2001:db8:zzzz::1'), false);
    assert.equal(isValidIPv6('1:2:3:4:5:6:7'), false);
  });
});

describe('validators — isValidPAN', () => {
  it('accepts valid Indian PAN numbers', () => {
    assert.equal(isValidPAN('ABCPE1234F'), true);
    assert.equal(isValidPAN('abcpe1234f'), true);
  });

  it('rejects PAN numbers with invalid 4th char or wrong format', () => {
    assert.equal(isValidPAN('ABCDE1234F'), false);
    assert.equal(isValidPAN('ABCPE123F'), false);
    assert.equal(isValidPAN(''), false);
    assert.equal(isValidPAN('1234567890'), false);
  });
});
