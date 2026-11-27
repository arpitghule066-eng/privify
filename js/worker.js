// @ts-check
/**
 * @file Web Worker for off-main-thread PII detection and redaction.
 * Runs engine.process() so the UI never freezes during detection.
 * @module worker
 */

import { process } from './engine.js';

self.addEventListener('message', (event) => {
  const { requestId, text, options } = event.data;
  try {
    const enabledTypes = options.enabledTypes
      ? new Set(options.enabledTypes)
      : undefined;

    const result = process(text, {
      ...options,
      enabledTypes,
    });

    self.postMessage({
      requestId,
      result: {
        entities: result.entities,
        output: result.output,
        replacements: result.replacements,
        counts: result.counts,
        mappingEntries: Array.from(result.mapping.entries()),
      },
    });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error.message,
    });
  }
});
