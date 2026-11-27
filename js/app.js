// @ts-check
/**
 * @file Main application module — UI wiring, events, state, rendering.
 * DOM module — coordinates all other modules.
 * @module app
 */

import { ENTITY_TYPES, MODES, LIMITS, THEME_STORAGE_KEY, MESSAGES } from './constants.js';
import { process } from './engine.js';
import { redact } from './redactor.js';
import { renderDiff } from './diff.js';
import { validateFile, readFile, downloadText, getSanitizedFilename, ValidationError } from './fileio.js';
import { parseCSV, stringifyCSV, neutralizeFormulas } from './csv.js';
import { SAMPLE_TEXT, SAMPLE_CSV } from './samples.js';
import { isAiAvailable, detectWithAI } from './ai-assist.js';

/**
 * Application state.
 * @type {{
 *   inputText: string,
 *   mode: string,
 *   enabledTypes: Set<string>,
 *   strictAadhaar: boolean,
 *   csvSafe: boolean,
 *   aiAssist: boolean,
 *   entities: Array,
 *   output: string,
 *   mapping: Map<string, string>,
 *   replacements: Array,
 *   counts: Object,
 *   fileName: string | null,
 *   isCSV: boolean,
 *   worker: Worker | null,
 *   requestId: number,
 *   debounceTimer: number | null,
 *   aiAbortController: AbortController | null,
 * }}
 */
const state = {
  inputText: '',
  mode: MODES.FULL,
  enabledTypes: new Set([
    ENTITY_TYPES.EMAIL, ENTITY_TYPES.PHONE,
    ENTITY_TYPES.IPV4, ENTITY_TYPES.IPV6,
    ENTITY_TYPES.PAN, ENTITY_TYPES.AADHAAR, ENTITY_TYPES.CARD,
  ]),
  strictAadhaar: false,
  csvSafe: true,
  aiAssist: false,
  entities: [],
  output: '',
  mapping: new Map(),
  replacements: [],
  counts: {},
  fileName: null,
  isCSV: false,
  worker: null,
  requestId: 0,
  debounceTimer: null,
  aiAbortController: null,
};

/** @type {Object<string, HTMLElement>} */
const els = {};

/**
 * Update state and trigger re-render.
 * @param {Partial<typeof state>} patch - State properties to update.
 */
function setState(patch) {
  Object.assign(state, patch);
}

/**
 * Cache element references by ID.
 */
function cacheElements() {
  const ids = [
    'input-text', 'file-input', 'drop-zone',
    'btn-load-sample', 'btn-load-sample-csv', 'btn-clear',
    'mode-full', 'mode-partial', 'mode-pseudo',
    'toggle-EMAIL', 'toggle-PHONE', 'toggle-IP',
    'toggle-PAN', 'toggle-AADHAAR', 'toggle-CARD',
    'toggle-strict-aadhaar', 'toggle-csv-safe', 'toggle-ai-assist',
    'ai-status',
    'count-total', 'count-EMAIL', 'count-PHONE', 'count-IP',
    'count-PAN', 'count-AADHAAR', 'count-CARD',
    'count-PERSON', 'count-ADDRESS',
    'diff-original', 'diff-sanitized',
    'btn-download', 'btn-copy', 'btn-export-report', 'btn-export-mapping',
    'status-message', 'theme-toggle',
  ];
  for (const id of ids) {
    els[id] = document.getElementById(id);
  }
}

/**
 * Initialize the Web Worker for detection.
 */
function initWorker() {
  try {
    state.worker = new Worker('./js/worker.js', { type: 'module' });
    state.worker.addEventListener('message', handleWorkerMessage);
    state.worker.addEventListener('error', () => {
      state.worker = null;
    });
  } catch (_e) {
    state.worker = null;
  }
}

/**
 * Handle worker response.
 * @param {MessageEvent} event
 */
function handleWorkerMessage(event) {
  const { requestId, result, error } = event.data;
  if (requestId !== state.requestId) return;

  if (error) {
    setStatus(error, 'error');
    return;
  }

  setState({
    entities: result.entities,
    output: result.output,
    mapping: new Map(result.mappingEntries),
    replacements: result.replacements,
    counts: result.counts,
  });

  renderResults();
}

/**
 * Set the status message.
 * @param {string} message
 * @param {'error' | 'success' | ''} [type='']
 */
function setStatus(message, type = '') {
  const el = els['status-message'];
  if (!el) return;
  el.textContent = message;
  el.className = type;
}

/**
 * Trigger processing with debounce.
 */
function scheduleProcess() {
  if (state.debounceTimer !== null) {
    clearTimeout(state.debounceTimer);
  }
  state.debounceTimer = setTimeout(() => {
    processInput();
  }, LIMITS.DEBOUNCE_MS);
}

/**
 * Process the current input text.
 */
function processInput() {
  const text = state.inputText;
  if (!text) {
    clearResults();
    return;
  }

  state.requestId++;
  const reqId = state.requestId;

  const opts = {
    mode: state.mode,
    enabledTypes: state.enabledTypes,
    strictAadhaar: state.strictAadhaar,
    typedLabels: false,
  };

  if (state.worker) {
    state.worker.postMessage({
      requestId: reqId,
      text,
      options: {
        ...opts,
        enabledTypes: Array.from(opts.enabledTypes),
      },
    });
  } else {
    // Fallback: run on main thread
    const result = process(text, opts);
    if (reqId !== state.requestId) return;

    setState({
      entities: result.entities,
      output: result.output,
      mapping: result.mapping,
      replacements: result.replacements,
      counts: result.counts,
    });
    renderResults();
  }

  // AI assist (if enabled)
  if (state.aiAssist) {
    runAIAssist(text);
  }
}

/**
 * Run AI-assisted detection.
 * @param {string} text
 */
async function runAIAssist(text) {
  if (state.aiAbortController) {
    state.aiAbortController.abort();
  }
  state.aiAbortController = new AbortController();

  try {
    const aiEntities = await detectWithAI(text, { signal: state.aiAbortController.signal });
    if (aiEntities.length > 0) {
      // Show AI counts
      const personCount = aiEntities.filter(e => e.type === 'PERSON').length;
      const addressCount = aiEntities.filter(e => e.type === 'ADDRESS').length;
      updateAICounts(personCount, addressCount);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus(MESSAGES.AI_ERROR, 'error');
    }
  }
}

/**
 * Update AI-detected entity counts.
 * @param {number} persons
 * @param {number} addresses
 */
function updateAICounts(persons, addresses) {
  const personEl = els['count-PERSON'];
  const addressEl = els['count-ADDRESS'];
  if (personEl) personEl.textContent = String(persons);
  if (addressEl) addressEl.textContent = String(addresses);

  // Show AI stat spans
  const aiStats = document.querySelectorAll('.ai-stat');
  for (const el of aiStats) {
    el.hidden = false;
  }
}

/**
 * Render the processed results.
 */
function renderResults() {
  updateCounts();
  renderDiff(
    { original: els['diff-original'], sanitized: els['diff-sanitized'] },
    state.inputText,
    state.output,
    state.entities,
    state.replacements,
  );

  // Enable/disable buttons
  els['btn-download'].disabled = false;
  els['btn-copy'].disabled = false;
  els['btn-export-report'].disabled = false;
  els['btn-export-mapping'].disabled = state.mode !== MODES.PSEUDO;

  // Status announcement
  announceResults();
}

/**
 * Update count displays.
 */
function updateCounts() {
  const c = state.counts;
  const total = state.entities.length;

  els['count-total'].textContent = String(total);
  els['count-EMAIL'].textContent = String(c.EMAIL || 0);
  els['count-PHONE'].textContent = String(c.PHONE || 0);
  els['count-IP'].textContent = String((c.IPV4 || 0) + (c.IPV6 || 0));
  els['count-PAN'].textContent = String(c.PAN || 0);
  els['count-AADHAAR'].textContent = String(c.AADHAAR || 0);
  els['count-CARD'].textContent = String(c.CARD || 0);
}

/**
 * Announce results to screen readers.
 */
function announceResults() {
  const c = state.counts;
  const total = state.entities.length;
  const parts = [];
  if (c.EMAIL) parts.push(`${c.EMAIL} emails`);
  if (c.PHONE) parts.push(`${c.PHONE} phones`);
  if (c.IPV4 || c.IPV6) parts.push(`${(c.IPV4 || 0) + (c.IPV6 || 0)} IPs`);
  if (c.PAN) parts.push(`${c.PAN} PANs`);
  if (c.AADHAAR) parts.push(`${c.AADHAAR} Aadhaar numbers`);
  if (c.CARD) parts.push(`${c.CARD} cards`);

  const msg = parts.length > 0
    ? `Found ${total} sensitive items: ${parts.join(', ')}.`
    : 'No sensitive items found.';
  setStatus(msg, 'success');
}

/**
 * Clear all results and state.
 */
function clearResults() {
  setState({
    entities: [],
    output: '',
    mapping: new Map(),
    replacements: [],
    counts: {},
  });

  els['count-total'].textContent = '0';
  els['count-EMAIL'].textContent = '0';
  els['count-PHONE'].textContent = '0';
  els['count-IP'].textContent = '0';
  els['count-PAN'].textContent = '0';
  els['count-AADHAAR'].textContent = '0';
  els['count-CARD'].textContent = '0';
  els['count-PERSON'].textContent = '0';
  els['count-ADDRESS'].textContent = '0';

  els['diff-original'].textContent = '';
  els['diff-sanitized'].textContent = '';

  els['btn-download'].disabled = true;
  els['btn-copy'].disabled = true;
  els['btn-export-report'].disabled = true;
  els['btn-export-mapping'].disabled = true;
}

/**
 * Handle mode change.
 */
function onModeChange() {
  const checked = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="mode"]:checked'));
  const mode = checked?.value || MODES.FULL;
  setState({ mode });

  if (state.inputText) {
    const { output, mapping, replacements } = redact(state.inputText, state.entities, mode);
    setState({ output, mapping, replacements });
    renderResults();
  }
}

/**
 * Handle entity type toggle change.
 * @param {Event} event
 */
function onToggleChange(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  const id = target.id;

  if (id === 'toggle-IP') {
    if (target.checked) {
      state.enabledTypes.add(ENTITY_TYPES.IPV4);
      state.enabledTypes.add(ENTITY_TYPES.IPV6);
    } else {
      state.enabledTypes.delete(ENTITY_TYPES.IPV4);
      state.enabledTypes.delete(ENTITY_TYPES.IPV6);
    }
  } else {
    const type = id.replace('toggle-', '');
    if (target.checked) {
      state.enabledTypes.add(type);
    } else {
      state.enabledTypes.delete(type);
    }
  }

  if (state.inputText) processInput();
}

/**
 * Handle file upload.
 * @param {File} file
 */
async function handleFile(file) {
  try {
    validateFile(file);
    const text = await readFile(file);
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    setState({
      inputText: text,
      fileName: file.name,
      isCSV,
    });

    els['input-text'].value = text;
    processInput();
  } catch (err) {
    if (err instanceof ValidationError) {
      setStatus(err.message, 'error');
    } else {
      setStatus(MESSAGES.FILE_REJECTED, 'error');
    }
  }
}

/**
 * Handle download.
 */
function handleDownload() {
  let output = state.output;

  if (state.isCSV && state.csvSafe) {
    const rows = parseCSV(output);
    const safe = neutralizeFormulas(rows);
    output = stringifyCSV(safe);
  }

  const filename = getSanitizedFilename(state.fileName);
  const mime = state.isCSV ? 'text/csv' : 'text/plain';
  downloadText(output, filename, mime);
  setStatus(MESSAGES.DOWNLOAD_READY, 'success');
}

/**
 * Handle copy to clipboard.
 */
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(state.output);
    setStatus(MESSAGES.COPIED, 'success');
  } catch (_err) {
    setStatus('Copy failed. Please use Ctrl+C.', 'error');
  }
}

/**
 * Handle export audit report.
 */
function handleExportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    mode: state.mode,
    counts: { ...state.counts },
    totalEntities: state.entities.length,
    inputChars: state.inputText.length,
    outputChars: state.output.length,
  };

  downloadText(JSON.stringify(report, null, 2), 'audit-report.json', 'application/json');
  setStatus(MESSAGES.REPORT_EXPORTED, 'success');
}

/**
 * Handle export mapping (pseudo mode only).
 */
function handleExportMapping() {
  if (!confirm(MESSAGES.MAPPING_WARNING)) return;

  const obj = Object.fromEntries(state.mapping);
  downloadText(JSON.stringify(obj, null, 2), 'mapping.json', 'application/json');
}

/**
 * Handle clear.
 */
function handleClear() {
  setState({
    inputText: '',
    fileName: null,
    isCSV: false,
  });
  els['input-text'].value = '';
  els['file-input'].value = '';
  clearResults();
  setStatus(MESSAGES.CLEARED, 'success');
}

/**
 * Initialize theme.
 */
function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeButton(saved);
  }
}

/**
 * Toggle theme.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  updateThemeButton(next);
}

/**
 * Update theme toggle button text.
 * @param {string} theme
 */
function updateThemeButton(theme) {
  els['theme-toggle'].textContent = theme === 'dark' ? '☀️' : '🌙';
  els['theme-toggle'].setAttribute('aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

/**
 * Initialize AI assist status.
 */
async function initAIStatus() {
  const { status } = await isAiAvailable();
  const statusEl = els['ai-status'];
  const toggleEl = /** @type {HTMLInputElement} */ (els['toggle-ai-assist']);

  if (status === 'available') {
    statusEl.textContent = MESSAGES.AI_READY;
  } else if (status === 'downloadable') {
    statusEl.textContent = MESSAGES.AI_DOWNLOADING;
  } else {
    statusEl.textContent = MESSAGES.AI_NOT_AVAILABLE;
    toggleEl.disabled = true;
  }
}

/**
 * Register service worker.
 */
function registerSW() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker registration failed — app works fine without it
    });
  }
}

/**
 * Bind all event listeners.
 */
function bindEvents() {
  bindInputEvents();
  bindActionEvents();
}

/**
 * Bind input, sample, mode, and toggle event listeners.
 */
function bindInputEvents() {
  els['input-text'].addEventListener('input', () => {
    setState({ inputText: els['input-text'].value, fileName: null, isCSV: false });
    scheduleProcess();
  });

  els['btn-load-sample'].addEventListener('click', () => {
    setState({ inputText: SAMPLE_TEXT, fileName: null, isCSV: false });
    els['input-text'].value = SAMPLE_TEXT;
    processInput();
  });

  els['btn-load-sample-csv'].addEventListener('click', () => {
    setState({ inputText: SAMPLE_CSV, fileName: 'sample.csv', isCSV: true });
    els['input-text'].value = SAMPLE_CSV;
    processInput();
  });

  for (const id of ['mode-full', 'mode-partial', 'mode-pseudo']) {
    els[id].addEventListener('change', onModeChange);
  }

  for (const id of ['toggle-EMAIL', 'toggle-PHONE', 'toggle-IP', 'toggle-PAN', 'toggle-AADHAAR', 'toggle-CARD']) {
    els[id].addEventListener('change', onToggleChange);
  }

  els['toggle-strict-aadhaar'].addEventListener('change', (e) => {
    setState({ strictAadhaar: /** @type {HTMLInputElement} */ (e.target).checked });
    if (state.inputText) processInput();
  });

  els['toggle-csv-safe'].addEventListener('change', (e) => {
    setState({ csvSafe: /** @type {HTMLInputElement} */ (e.target).checked });
  });

  els['toggle-ai-assist'].addEventListener('change', (e) => {
    setState({ aiAssist: /** @type {HTMLInputElement} */ (e.target).checked });
    if (state.inputText && state.aiAssist) {
      runAIAssist(state.inputText);
    }
  });
}

/**
 * Bind file upload, drag/drop, export, and theme event listeners.
 */
function bindActionEvents() {
  els['file-input'].addEventListener('change', (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (file) handleFile(file);
  });

  const dropZone = els['drop-zone'];
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  els['btn-download'].addEventListener('click', handleDownload);
  els['btn-copy'].addEventListener('click', handleCopy);
  els['btn-export-report'].addEventListener('click', handleExportReport);
  els['btn-export-mapping'].addEventListener('click', handleExportMapping);
  els['btn-clear'].addEventListener('click', handleClear);
  els['theme-toggle'].addEventListener('click', toggleTheme);
}

/**
 * Initialize the application.
 */
function init() {
  cacheElements();
  initTheme();
  initWorker();
  bindEvents();
  initAIStatus();
  registerSW();
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
