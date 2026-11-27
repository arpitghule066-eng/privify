// @ts-check
/**
 * @file Redaction engine — transforms detected entities per mode.
 * Pure functions — no DOM, no side effects.
 * @module redactor
 */

import { MODES, PSEUDO_PREFIXES, ENTITY_TYPES } from './constants.js';

/**
 * Redact entities in text according to the specified mode.
 * Single left-to-right pass — no String.replace.
 * @param {string} text - Original text.
 * @param {Array<{id:string, type:string, value:string, start:number, end:number, normalized:string, brand?:string}>} entities - Sorted, non-overlapping.
 * @param {string} mode - 'full', 'partial', or 'pseudo'.
 * @param {{ typedLabels?: boolean }} [options]
 * @returns {{ output: string, mapping: Map<string, string>, replacements: Array<{entityId:string, type:string, original:string, replacement:string, outStart:number, outEnd:number}> }}
 */
export function redact(text, entities, mode, options = {}) {
  const typedLabels = options.typedLabels || false;
  const mapping = new Map();
  const pseudoCounters = {};
  const pseudoMap = new Map();

  const parts = [];
  /** @type {Array<{entityId:string, type:string, original:string, replacement:string, outStart:number, outEnd:number}>} */
  const replacements = [];
  let cursor = 0;
  let outPos = 0;

  for (const entity of entities) {
    if (entity.start > cursor) {
      const seg = text.slice(cursor, entity.start);
      parts.push(seg);
      outPos += seg.length;
    }

    const replacement = getReplacementText(entity, mode, typedLabels, pseudoCounters, pseudoMap, mapping);
    const outStart = outPos;
    const outEnd = outStart + replacement.length;

    parts.push(replacement);
    replacements.push({
      entityId: entity.id,
      type: entity.type,
      original: entity.value,
      replacement,
      outStart,
      outEnd,
    });

    outPos = outEnd;
    cursor = entity.end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return { output: parts.join(''), mapping, replacements };
}

/**
 * Get replacement text for a single entity.
 * @param {Object} entity - The entity to redact.
 * @param {string} mode - Redaction mode.
 * @param {boolean} typedLabels - Whether to include type in full-mode labels.
 * @param {Object} pseudoCounters - Counter state for pseudo mode.
 * @param {Map} pseudoMap - normalized→label mapping for pseudo mode.
 * @param {Map} mapping - Output mapping (populated in pseudo mode).
 * @returns {string} Replacement text.
 */
function getReplacementText(entity, mode, typedLabels, pseudoCounters, pseudoMap, mapping) {
  if (mode === MODES.FULL) {
    return typedLabels ? `[REDACTED:${entity.type}]` : '[REDACTED]';
  }

  if (mode === MODES.PARTIAL) {
    return partialRedact(entity);
  }

  if (mode === MODES.PSEUDO) {
    return pseudoRedact(entity, pseudoCounters, pseudoMap, mapping);
  }

  return '[REDACTED]';
}

/**
 * Partial redaction — keep minimal identifying context.
 * @param {Object} entity - Entity to partially redact.
 * @returns {string} Partially redacted text.
 */
function partialRedact(entity) {
  const { type, value } = entity;

  switch (type) {
    case ENTITY_TYPES.EMAIL: {
      const atIdx = value.indexOf('@');
      if (atIdx <= 0) return 'X***@unknown';
      return value[0] + '***@' + value.slice(atIdx + 1);
    }

    case ENTITY_TYPES.CARD:
    case ENTITY_TYPES.AADHAAR:
    case ENTITY_TYPES.PHONE: {
      return maskDigitsKeepLast4(value);
    }

    case ENTITY_TYPES.PAN: {
      if (value.length <= 4) return value;
      return 'X'.repeat(value.length - 4) + value.slice(-4);
    }

    case ENTITY_TYPES.IPV4: {
      const octets = value.split('.');
      return octets[0] + '.' + octets[1] + '.XXX.XXX';
    }

    case ENTITY_TYPES.IPV6: {
      const groups = value.split(':');
      const first2 = groups.slice(0, 2).join(':');
      const rest = groups.slice(2).map(() => 'XXXX').join(':');
      return first2 + ':' + rest;
    }

    case ENTITY_TYPES.PERSON:
      return maskNamePartial(value);

    case ENTITY_TYPES.ADDRESS:
      return '[ADDRESS]';

    default:
      return '[REDACTED]';
  }
}

/**
 * Mask digits in a value, keeping the last 4 digits visible.
 * Preserves separators (spaces, dashes) and prefix characters (+).
 * @param {string} value - Original value with possible separators.
 * @returns {string} Masked value.
 */
function maskDigitsKeepLast4(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return value;

  const keepCount = 4;
  const totalDigits = digits.length;
  const maskCount = totalDigits - keepCount;

  let digitIndex = 0;
  let result = '';

  for (const ch of value) {
    if (/\d/.test(ch)) {
      if (digitIndex < maskCount) {
        result += 'X';
      } else {
        result += ch;
      }
      digitIndex++;
    } else {
      result += ch;
    }
  }

  return result;
}

/**
 * Partial mask for person names: first char + asterisks per word.
 * @param {string} name - Full name.
 * @returns {string} Masked name.
 */
function maskNamePartial(name) {
  return name.split(/\s+/).map(w => {
    if (w.length <= 1) return w[0] + '*';
    return w[0] + '*'.repeat(w.length - 1);
  }).join(' ');
}

/**
 * Pseudonym redaction — consistent labels for same normalized values.
 * @param {Object} entity - Entity to pseudonymize.
 * @param {Object} counters - Per-type counters.
 * @param {Map} pseudoMap - normalized→label map.
 * @param {Map} mapping - Full mapping for export.
 * @returns {string} Pseudonym label.
 */
function pseudoRedact(entity, counters, pseudoMap, mapping) {
  const key = entity.type + ':' + entity.normalized;
  if (pseudoMap.has(key)) {
    return pseudoMap.get(key);
  }

  const prefix = PSEUDO_PREFIXES[entity.type] || entity.type;
  const count = (counters[entity.type] || 0) + 1;
  counters[entity.type] = count;

  const label = prefix + '_' + String(count).padStart(2, '0');
  pseudoMap.set(key, label);
  mapping.set(label, entity.value);

  return label;
}
