// @ts-check
/**
 * @file On-device Gemini Nano (Chrome built-in AI) integration.
 * Provides optional AI-powered name and address detection that runs
 * entirely on-device — no network requests.
 * @module ai-assist
 */

import { LIMITS } from './constants.js';

/**
 * Check if on-device AI (Gemini Nano) is available.
 * @returns {Promise<{available: boolean, status: string}>}
 */
export async function isAiAvailable() {
  try {
    const LanguageModel = globalThis.LanguageModel || globalThis.ai?.languageModel;
    if (!LanguageModel) {
      return { available: false, status: 'unavailable' };
    }

    const caps = typeof LanguageModel.availability === 'function'
      ? await LanguageModel.availability()
      : (typeof LanguageModel.capabilities === 'function'
        ? (await LanguageModel.capabilities()).available
        : 'unavailable');

    if (caps === 'available' || caps === 'readily') {
      return { available: true, status: 'available' };
    }
    if (caps === 'downloadable' || caps === 'after-download') {
      return { available: false, status: 'downloadable' };
    }
    return { available: false, status: 'unavailable' };
  } catch (_err) {
    return { available: false, status: 'unavailable' };
  }
}

const SYSTEM_PROMPT = `You are a PII detector. Given text, find all person names and physical addresses.
Return ONLY valid JSON: [{"type":"PERSON"|"ADDRESS","text":"exact text from input"}]
Rules:
- "text" must appear verbatim in the input
- Only use types PERSON or ADDRESS
- Return [] if nothing found
- No explanation, only the JSON array`;

const ALLOWED_TYPES = new Set(['PERSON', 'ADDRESS']);

/**
 * Detect person names and addresses using on-device AI.
 * @param {string} text - Input text.
 * @param {{ signal?: AbortSignal, factory?: Object }} [options]
 * @returns {Promise<Array<{type: string, text: string, start: number, end: number}>>}
 */
export async function detectWithAI(text, options = {}) {
  const { signal, factory } = options;

  const LanguageModel = factory || globalThis.LanguageModel || globalThis.ai?.languageModel;
  if (!LanguageModel) return [];

  const session = typeof LanguageModel.create === 'function'
    ? await LanguageModel.create({ systemPrompt: SYSTEM_PROMPT })
    : await LanguageModel({ systemPrompt: SYSTEM_PROMPT });

  const chunks = splitIntoChunks(text, LIMITS.AI_CHUNK_SIZE);
  const results = [];

  for (const chunk of chunks) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const entities = await promptChunk(session, chunk, signal);
    results.push(...entities);
  }

  if (session.destroy) session.destroy();

  return results;
}

/**
 * Prompt the AI session for a single text chunk with timeout.
 * @param {Object} session - AI session.
 * @param {{ text: string, offset: number }} chunk - Text chunk.
 * @param {AbortSignal} [signal] - Optional abort signal.
 * @returns {Promise<Array<{type: string, text: string, start: number, end: number}>>}
 */
async function promptChunk(session, chunk, signal) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    const response = await Promise.race([
      session.prompt(chunk.text, { signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI timeout')), LIMITS.AI_TIMEOUT_MS);
      }),
    ]);
    return parseAIResponse(response, chunk.text, chunk.offset);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Split text into chunks of approximately maxSize characters.
 * @param {string} text - Full text.
 * @param {number} maxSize - Maximum chunk size.
 * @returns {Array<{text: string, offset: number}>}
 */
function splitIntoChunks(text, maxSize) {
  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    const end = Math.min(offset + maxSize, text.length);
    chunks.push({ text: text.slice(offset, end), offset });
    offset = end;
  }
  return chunks;
}

/**
 * Parse and validate the AI model's JSON response.
 * @param {string} response - Raw model output.
 * @param {string} chunkText - The chunk that was sent.
 * @param {number} chunkOffset - Offset of the chunk in the original text.
 * @returns {Array<{type: string, text: string, start: number, end: number}>}
 */
function parseAIResponse(response, chunkText, chunkOffset) {
  let parsed;
  try {
    const trimmed = response.trim();
    const jsonStr = trimmed.startsWith('[') ? trimmed : extractJSON(trimmed);
    parsed = JSON.parse(jsonStr);
  } catch (_e) {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const results = [];
  for (const item of parsed) {
    if (!item || typeof item.type !== 'string' || typeof item.text !== 'string') continue;
    if (!ALLOWED_TYPES.has(item.type)) continue;

    const idx = chunkText.indexOf(item.text);
    if (idx === -1) continue;

    results.push({
      type: item.type,
      text: item.text,
      start: chunkOffset + idx,
      end: chunkOffset + idx + item.text.length,
    });
  }

  return results;
}

/**
 * Try to extract a JSON array from a response that may contain extra text.
 * @param {string} text - Raw response.
 * @returns {string} JSON string.
 */
function extractJSON(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return '[]';
  return text.slice(start, end + 1);
}
