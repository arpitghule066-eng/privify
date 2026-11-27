// @ts-check
/**
 * @file Central constants for RedactLocal.
 * All entity types, labels, colors, limits, and messages live here.
 * @module constants
 */

/** @enum {string} Entity type identifiers */
export const ENTITY_TYPES = Object.freeze({
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  IPV4: 'IPV4',
  IPV6: 'IPV6',
  PAN: 'PAN',
  AADHAAR: 'AADHAAR',
  CARD: 'CARD',
  PERSON: 'PERSON',
  ADDRESS: 'ADDRESS',
});

/** @enum {string} Redaction mode identifiers */
export const MODES = Object.freeze({
  FULL: 'full',
  PARTIAL: 'partial',
  PSEUDO: 'pseudo',
});

/** Human-readable labels for entity types */
export const ENTITY_LABELS = Object.freeze({
  EMAIL: 'Email',
  PHONE: 'Phone',
  IPV4: 'IPv4',
  IPV6: 'IPv6',
  PAN: 'PAN',
  AADHAAR: 'Aadhaar',
  CARD: 'Card',
  PERSON: 'Person',
  ADDRESS: 'Address',
});

/** Colors for entity type highlights (WCAG AA compliant in both themes) */
export const ENTITY_COLORS = Object.freeze({
  EMAIL: { bg: '#e8f0fe', border: '#1a73e8', dark_bg: '#1a3a5c', dark_border: '#8ab4f8' },
  PHONE: { bg: '#fce8e6', border: '#d93025', dark_bg: '#5c1a1a', dark_border: '#f28b82' },
  IPV4: { bg: '#e6f4ea', border: '#188038', dark_bg: '#1a3c2a', dark_border: '#81c995' },
  IPV6: { bg: '#e6f4ea', border: '#188038', dark_bg: '#1a3c2a', dark_border: '#81c995' },
  PAN: { bg: '#fef7e0', border: '#f9ab00', dark_bg: '#5c4a0a', dark_border: '#fdd663' },
  AADHAAR: { bg: '#f3e8fd', border: '#8430ce', dark_bg: '#3c1a5c', dark_border: '#c58af9' },
  CARD: { bg: '#fce8f0', border: '#c5221f', dark_bg: '#5c1a2a', dark_border: '#f28b82' },
  PERSON: { bg: '#e0f2f1', border: '#00796b', dark_bg: '#1a3c3a', dark_border: '#80cbc4' },
  ADDRESS: { bg: '#fff3e0', border: '#e65100', dark_bg: '#5c2a0a', dark_border: '#ffb74d' },
});

/** Icons/symbols for entity types (not color-only distinction) */
export const ENTITY_ICONS = Object.freeze({
  EMAIL: '✉',
  PHONE: '☎',
  IPV4: '🌐',
  IPV6: '🌐',
  PAN: '🪪',
  AADHAAR: '🆔',
  CARD: '💳',
  PERSON: '👤',
  ADDRESS: '📍',
});

/** Pseudo-mode label prefixes */
export const PSEUDO_PREFIXES = Object.freeze({
  EMAIL: 'USER',
  PHONE: 'PHONE',
  CARD: 'CARD',
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  IPV4: 'IP',
  IPV6: 'IP',
  PERSON: 'PERSON',
  ADDRESS: 'ADDRESS',
});

/** Overlap resolution priority (higher index = higher priority) */
export const ENTITY_PRIORITY = Object.freeze({
  PHONE: 0,
  IPV4: 1,
  IPV6: 2,
  EMAIL: 3,
  PAN: 4,
  AADHAAR: 5,
  CARD: 6,
  PERSON: 7,
  ADDRESS: 8,
});

/** Application limits */
export const LIMITS = Object.freeze({
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  DEBOUNCE_MS: 250,
  WORKER_TIMEOUT_MS: 30000,
  AI_TIMEOUT_MS: 15000,
  AI_CHUNK_SIZE: 4000,
  CHUNK_RENDER_LINES: 500,
  LARGE_INPUT_BYTES: 200 * 1024,
});

/** Allowed file extensions for upload */
export const ALLOWED_EXTENSIONS = Object.freeze(['.txt', '.csv']);

/** Allowed MIME types for upload */
export const ALLOWED_MIMES = Object.freeze([
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  '',
]);

/** localStorage key for theme */
export const THEME_STORAGE_KEY = 'redactlocal-theme';

/** User-facing messages */
export const MESSAGES = Object.freeze({
  FILE_TOO_LARGE: 'File too large. Maximum size is 5 MB.',
  FILE_INVALID_TYPE: 'Invalid file type. Only .txt and .csv files are allowed.',
  FILE_BINARY: 'Binary files are not supported.',
  FILE_REJECTED: 'File rejected.',
  COPIED: 'Copied!',
  CLEARED: 'All data cleared.',
  NO_INPUT: 'No input to process.',
  PROCESSING: 'Processing…',
  DOWNLOAD_READY: 'Download started.',
  MAPPING_WARNING: 'The mapping file contains real PII values. Only export it if you need it for de-pseudonymization. Continue?',
  AI_NOT_AVAILABLE: 'Not available on this browser',
  AI_READY: 'Ready (on-device)',
  AI_DOWNLOADING: 'Model downloading…',
  AI_ERROR: 'AI assist error: falling back to regex-only.',
  REPORT_EXPORTED: 'Audit report exported.',
});
