// @ts-check
/**
 * @file Validation functions for PII entities.
 * Pure functions — no DOM, no side effects.
 * @module validators
 */

/**
 * Luhn checksum validation for credit card numbers.
 * @param {string} digits - Digit string (separators should be stripped first).
 * @returns {boolean} True if the Luhn checksum is valid.
 */
export function luhn(digits) {
  if (!digits || digits.length === 0) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = digits.charCodeAt(i) - 48;
    if (ch < 0 || ch > 9) return false;
    let n = ch;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum > 0 && sum % 10 === 0;
}

/**
 * Verhoeff checksum validation for Aadhaar numbers.
 * @param {string} digits - 12-digit string (separators stripped).
 * @returns {boolean} True if the Verhoeff checksum is valid.
 */
export function verhoeff(digits) {
  if (!digits || digits.length === 0) return false;

  const d = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
  ];

  const p = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
  ];

  let c = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    const ch = digits.charCodeAt(len - 1 - i) - 48;
    if (ch < 0 || ch > 9) return false;
    c = d[c][p[i % 8][ch]];
  }
  return c === 0;
}

/**
 * Validate an IPv4 address string.
 * @param {string} ip - Dotted-decimal IPv4 string.
 * @returns {boolean} True if valid (0–255 per octet, no leading zeros).
 */
export function isValidIPv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) return false;
    if (part.length > 1 && part[0] === '0') return false;
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return false;
  }
  return true;
}

/**
 * Validate an IPv6 address string (full and :: compressed forms).
 * @param {string} ip - IPv6 string.
 * @returns {boolean} True if valid.
 */
export function isValidIPv6(ip) {
  if (!ip) return false;
  const lower = ip.toLowerCase();
  if (lower.includes(':::')) return false;

  const doubleColonCount = (lower.match(/::/g) || []).length;
  if (doubleColonCount > 1) return false;

  if (doubleColonCount === 1) {
    return isValidCompressedIPv6(lower);
  }

  const groups = lower.split(':');
  return groups.length === 8 && groups.every(isValidHextet);
}

/**
 * Validate a :: compressed IPv6 address.
 * @param {string} lower - Lowercase IPv6 string with a single ::.
 * @returns {boolean} True if valid.
 */
function isValidCompressedIPv6(lower) {
  const [leftPart, rightPart] = lower.split('::');
  const left = leftPart === '' ? [] : leftPart.split(':');
  const right = rightPart === '' ? [] : rightPart.split(':');
  if (left.length + right.length > 7) return false;
  return left.every(isValidHextet) && right.every(isValidHextet);
}

/**
 * Validate a single IPv6 hextet.
 * @param {string} hextet - A single group of an IPv6 address.
 * @returns {boolean} True if valid (1-4 hex chars).
 */
function isValidHextet(hextet) {
  if (hextet.length === 0 || hextet.length > 4) return false;
  return /^[0-9a-f]{1,4}$/.test(hextet);
}

/**
 * Validate an Indian PAN (Permanent Account Number).
 * @param {string} pan - 10-character PAN string.
 * @returns {boolean} True if valid format.
 */
export function isValidPAN(pan) {
  if (!pan || pan.length !== 10) return false;
  const upper = pan.toUpperCase();
  return /^[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]$/.test(upper);
}
