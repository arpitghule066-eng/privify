// @ts-check
/**
 * @file PII detection engine.
 * Pure functions — no DOM, no side effects.
 * Detects EMAIL, PHONE, IPV4, IPV6, PAN, AADHAAR, and CARD entities.
 * @module detectors
 */

import { ENTITY_TYPES, ENTITY_PRIORITY } from './constants.js';
import { luhn, verhoeff, isValidIPv4, isValidIPv6, isValidPAN } from './validators.js';

let entityIdCounter = 0;

/**
 * Generate a unique entity ID.
 * @returns {string} Unique entity identifier.
 */
function nextId() {
  return `entity-${++entityIdCounter}`;
}

/**
 * Reset the entity ID counter (for testing).
 */
export function resetIdCounter() {
  entityIdCounter = 0;
}

// --- Regex source strings (compiled once) ---
const EMAIL_SRC = '(?<![\\w.])([A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,})(?![\\w.])';
const PHONE_INDIAN_SRC = '(?<!\\d)(?:\\+91[\\s\\-]?|91[\\s\\-]?|0)?([6-9]\\d{4}[\\s\\-]?\\d{5}|[6-9]\\d{9})(?!\\d)';
const PHONE_INTL_SRC = '(?<!\\d)(\\+\\d{1,3}[\\s\\-]?(?:\\(\\d{1,4}\\)[\\s\\-]?)?(?:\\d[\\s\\-]?){7,12}\\d)(?!\\d)';
const PHONE_US_SRC = '(?<!\\d)(?:\\(\\d{3}\\)[\\s\\-]?|\\d{3}[\\s\\-])\\d{3}[\\s\\-]\\d{4}(?!\\d)';
const IPV4_SRC = '(?<![\\.\\d])(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})(?![\\.\\d])';
const IPV6_SRC = '(?<![:\\w])([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){2}:(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){3}:(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){4}:(?:[0-9a-fA-F]{1,4}:)?[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){5}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:)(?![:\\w])';
const PAN_SRC = '(?<![A-Za-z0-9])([A-Za-z]{3}[PCHFATBLJGpchfatbljg][A-Za-z]\\d{4}[A-Za-z])(?![A-Za-z0-9])';
const AADHAAR_SRC = '(?<!\\d|\\d[\\s\\-])([2-9]\\d{3}([\\s\\-]?)\\d{4}\\2\\d{4})(?!\\d|[\\s\\-]\\d)';
const CARD_SRC = '(?<!\\d)(\\d(?:[\\s\\-]?\\d){12,18})(?!\\d)';

/**
 * Normalize an entity value for consistent pseudonymization.
 * @param {string} type - Entity type.
 * @param {string} value - Raw entity value.
 * @returns {string} Normalized value.
 */
export function normalize(type, value) {
  switch (type) {
    case ENTITY_TYPES.EMAIL:
      return value.toLowerCase();
    case ENTITY_TYPES.PHONE:
      return value.replace(/\D/g, '').slice(-10);
    case ENTITY_TYPES.CARD:
    case ENTITY_TYPES.AADHAAR:
      return value.replace(/\D/g, '');
    case ENTITY_TYPES.PAN:
      return value.toUpperCase();
    case ENTITY_TYPES.IPV4:
      return value.toLowerCase();
    case ENTITY_TYPES.IPV6:
      return expandIPv6(value.toLowerCase());
    default:
      return value;
  }
}

/**
 * Expand a compressed IPv6 address to full form.
 * @param {string} ip - IPv6 address (possibly compressed).
 * @returns {string} Fully expanded IPv6.
 */
function expandIPv6(ip) {
  let groups;
  if (ip.includes('::')) {
    const parts = ip.split('::');
    const left = parts[0] === '' ? [] : parts[0].split(':');
    const right = parts[1] === '' ? [] : parts[1].split(':');
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill('0000');
    groups = [...left, ...middle, ...right];
  } else {
    groups = ip.split(':');
  }
  return groups.map(g => g.padStart(4, '0')).join(':');
}

/**
 * Detect a specific card brand from the IIN prefix.
 * @param {string} digits - Card number digits only.
 * @returns {string} Brand name.
 */
function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(60|65|81|82)/.test(digits)) return 'rupay';
  if (/^6(?:011|5)/.test(digits)) return 'discover';
  return 'unknown';
}

/**
 * Run all detectors on the input text.
 * @param {string} text - Input text to scan.
 * @param {{ enabledTypes?: Set<string>, strictAadhaar?: boolean }} [options]
 * @returns {Array<{id:string, type:string, value:string, start:number, end:number, confidence:string, normalized:string, brand?:string}>}
 */
export function detect(text, options = {}) {
  const enabledTypes = options.enabledTypes || new Set(Object.values(ENTITY_TYPES));
  const strictAadhaar = options.strictAadhaar || false;

  resetIdCounter();

  /** @type {Array<{id:string, type:string, value:string, start:number, end:number, confidence:string, normalized:string, brand?:string}>} */
  const candidates = [];

  if (enabledTypes.has(ENTITY_TYPES.EMAIL)) {
    findMatches(text, EMAIL_SRC, ENTITY_TYPES.EMAIL, candidates);
  }

  if (enabledTypes.has(ENTITY_TYPES.PHONE)) {
    findPhones(text, candidates);
  }

  if (enabledTypes.has(ENTITY_TYPES.IPV4)) {
    findIPv4(text, candidates);
  }

  if (enabledTypes.has(ENTITY_TYPES.IPV6)) {
    findIPv6(text, candidates);
  }

  if (enabledTypes.has(ENTITY_TYPES.PAN)) {
    findPAN(text, candidates);
  }

  if (enabledTypes.has(ENTITY_TYPES.AADHAAR)) {
    findAadhaar(text, candidates, strictAadhaar);
  }

  if (enabledTypes.has(ENTITY_TYPES.CARD)) {
    findCards(text, candidates);
  }

  return resolveOverlaps(candidates);
}

/**
 * Generic regex match finder.
 * @param {string} text - Input text.
 * @param {string} src - Regex source string.
 * @param {string} type - Entity type.
 * @param {Array} candidates - Array to push results into.
 */
function findMatches(text, src, type, candidates) {
  const re = new RegExp(src, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    const start = m.index + (m[0].indexOf(value));
    candidates.push({
      id: nextId(),
      type,
      value,
      start,
      end: start + value.length,
      confidence: 'high',
      normalized: normalize(type, value),
    });
  }
}

/**
 * Find phone number candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 */
function findPhones(text, candidates) {
  for (const src of [PHONE_INDIAN_SRC, PHONE_US_SRC, PHONE_INTL_SRC]) {
    const re = new RegExp(src, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const value = m[0];
      const digits = value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) continue;
      candidates.push({
        id: nextId(),
        type: ENTITY_TYPES.PHONE,
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 'high',
        normalized: normalize(ENTITY_TYPES.PHONE, value),
      });
    }
  }
}

/**
 * Find IPv4 candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 */
function findIPv4(text, candidates) {
  const re = new RegExp(IPV4_SRC, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    if (!isValidIPv4(value)) continue;
    candidates.push({
      id: nextId(),
      type: ENTITY_TYPES.IPV4,
      value,
      start: m.index,
      end: m.index + value.length,
      confidence: 'high',
      normalized: normalize(ENTITY_TYPES.IPV4, value),
    });
  }
}

/**
 * Find IPv6 candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 */
function findIPv6(text, candidates) {
  const re = new RegExp(IPV6_SRC, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    if (!isValidIPv6(value)) continue;
    candidates.push({
      id: nextId(),
      type: ENTITY_TYPES.IPV6,
      value,
      start: m.index,
      end: m.index + value.length,
      confidence: 'high',
      normalized: normalize(ENTITY_TYPES.IPV6, value),
    });
  }
}

/**
 * Find PAN candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 */
function findPAN(text, candidates) {
  const re = new RegExp(PAN_SRC, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    if (!isValidPAN(value)) continue;
    candidates.push({
      id: nextId(),
      type: ENTITY_TYPES.PAN,
      value,
      start: m.index,
      end: m.index + value.length,
      confidence: 'high',
      normalized: normalize(ENTITY_TYPES.PAN, value),
    });
  }
}

/**
 * Find Aadhaar candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 * @param {boolean} strictAadhaar - Drop medium-confidence matches.
 */
function findAadhaar(text, candidates, strictAadhaar) {
  const re = new RegExp(AADHAAR_SRC, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 12) continue;
    const isValid = verhoeff(digits);
    const confidence = isValid ? 'high' : 'medium';
    if (strictAadhaar && confidence === 'medium') continue;
    candidates.push({
      id: nextId(),
      type: ENTITY_TYPES.AADHAAR,
      value,
      start: m.index,
      end: m.index + value.length,
      confidence,
      normalized: normalize(ENTITY_TYPES.AADHAAR, value),
    });
  }
}

/**
 * Find credit/debit card candidates.
 * @param {string} text - Input text.
 * @param {Array} candidates - Array to push results into.
 */
function findCards(text, candidates) {
  const re = new RegExp(CARD_SRC, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] || m[0];
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhn(digits)) continue;
    candidates.push({
      id: nextId(),
      type: ENTITY_TYPES.CARD,
      value,
      start: m.index,
      end: m.index + value.length,
      confidence: 'high',
      normalized: normalize(ENTITY_TYPES.CARD, value),
      brand: detectCardBrand(digits),
    });
  }
}

/**
 * Resolve overlapping entity candidates.
 * Rules: longer span wins; on tie, higher priority wins.
 * @param {Array} candidates - Unsorted, possibly overlapping entities.
 * @returns {Array} Non-overlapping entities sorted by start.
 */
function resolveOverlaps(candidates) {
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => {
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return (ENTITY_PRIORITY[b.type] ?? -1) - (ENTITY_PRIORITY[a.type] ?? -1);
  });

  /** @type {Array} */
  const taken = [];

  for (const candidate of candidates) {
    let lo = 0;
    let hi = taken.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (taken[mid].end <= candidate.start) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo < taken.length && taken[lo].start < candidate.end) {
      continue;
    }
    taken.splice(lo, 0, candidate);
  }

  // Re-assign sequential IDs (taken is already sorted by start)
  let idNum = 0;
  for (const entity of taken) {
    entity.id = `entity-${++idNum}`;
  }

  return taken;
}
