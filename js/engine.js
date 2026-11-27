// @ts-check
/**
 * @file Processing engine — combines detection and redaction.
 * Pure module used by both the Web Worker and unit tests.
 * @module engine
 */

import { detect } from './detectors.js';
import { redact } from './redactor.js';

/**
 * Process text: detect PII entities and redact them.
 * @param {string} text - Input text.
 * @param {{ mode?: string, enabledTypes?: Set<string>, strictAadhaar?: boolean, typedLabels?: boolean }} [opts]
 * @returns {{ entities: Array, output: string, mapping: Map<string, string>, replacements: Array, counts: Object }}
 */
export function process(text, opts = {}) {
  const mode = opts.mode || 'full';
  const entities = detect(text, {
    enabledTypes: opts.enabledTypes,
    strictAadhaar: opts.strictAadhaar,
  });

  const { output, mapping, replacements } = redact(text, entities, mode, {
    typedLabels: opts.typedLabels,
  });

  const counts = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] || 0) + 1;
  }

  return { entities, output, mapping, replacements, counts };
}
