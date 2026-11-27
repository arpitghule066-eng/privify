// @ts-check
/**
 * @file Diff view renderer — builds side-by-side highlighted comparison.
 * DOM module — uses only createElement/createTextNode.
 * @module diff
 */

import { LIMITS } from './constants.js';

/**
 * Render a side-by-side diff of original and sanitized text.
 * @param {{ original: HTMLElement, sanitized: HTMLElement }} containers
 * @param {string} originalText - Original input text.
 * @param {string} sanitizedText - Sanitized output text.
 * @param {Array} entities - Detected entities with positions in original.
 * @param {Array} replacements - Replacement records with positions in output.
 */
export function renderDiff(containers, originalText, sanitizedText, entities, replacements) {
  containers.original.textContent = '';
  containers.sanitized.textContent = '';

  const origLines = originalText.split('\n');
  const sanLines = sanitizedText.split('\n');
  const maxLines = Math.max(origLines.length, sanLines.length);

  const isLarge = originalText.length > LIMITS.LARGE_INPUT_BYTES;

  if (isLarge) {
    renderChunked(containers, origLines, sanLines, maxLines, entities, replacements, originalText, sanitizedText);
  } else {
    const origFrag = buildPane(origLines, entities, 'pii', originalText, 0);
    const sanFrag = buildPane(sanLines, replacements.map(r => ({
      ...r,
      start: r.outStart,
      end: r.outEnd,
      value: r.replacement,
      type: r.type,
      id: r.entityId,
    })), 'redacted', sanitizedText, 0);

    containers.original.appendChild(origFrag);
    containers.sanitized.appendChild(sanFrag);
  }

  setupSyncScroll(containers.original, containers.sanitized);
  setupHoverLink(containers.original, containers.sanitized);
}

/**
 * Build a document fragment for one pane.
 * @param {string[]} lines - Lines of text.
 * @param {Array} markers - Entities or replacements to highlight.
 * @param {string} markerClass - CSS class prefix ('pii' or 'redacted').
 * @param {string} fullText - Complete text for offset calculations.
 * @param {number} startLineIdx - Starting line index for numbering.
 * @returns {DocumentFragment}
 */
function buildPane(lines, markers, markerClass, fullText, startLineIdx, startCharOffset = 0) {
  const frag = document.createDocumentFragment();
  let charOffset = startCharOffset;

  for (let i = 0; i < lines.length; i++) {
    const lineEl = document.createElement('div');
    lineEl.className = 'diff-line';

    const numEl = document.createElement('span');
    numEl.className = 'line-number';
    numEl.textContent = String(startLineIdx + i + 1);
    lineEl.appendChild(numEl);

    const contentEl = document.createElement('span');
    contentEl.className = 'line-content';

    const lineStart = charOffset;
    const lineEnd = charOffset + lines[i].length;

    const lineMarkers = markers.filter(m => {
      const mStart = m.start ?? m.outStart;
      const mEnd = m.end ?? m.outEnd;
      return mStart < lineEnd && mEnd > lineStart;
    });

    if (lineMarkers.length > 0) {
      lineEl.classList.add('changed');
      renderLineWithMarkers(contentEl, lines[i], lineMarkers, lineStart, markerClass);
    } else {
      contentEl.appendChild(document.createTextNode(lines[i]));
    }

    lineEl.appendChild(contentEl);
    frag.appendChild(lineEl);

    charOffset = lineEnd + 1; // +1 for \n
  }

  return frag;
}

/**
 * Render a single line with highlighted markers.
 * @param {HTMLElement} container - Line content container.
 * @param {string} lineText - Text of the line.
 * @param {Array} markers - Markers that overlap this line.
 * @param {number} lineStart - Char offset of line start in full text.
 * @param {string} markerClass - 'pii' or 'redacted'.
 */
function renderLineWithMarkers(container, lineText, markers, lineStart, markerClass) {
  let pos = 0;

  for (const marker of markers) {
    const mStart = (marker.start ?? marker.outStart) - lineStart;
    const mEnd = (marker.end ?? marker.outEnd) - lineStart;
    const clampStart = Math.max(0, mStart);
    const clampEnd = Math.min(lineText.length, mEnd);

    if (clampStart > pos) {
      container.appendChild(document.createTextNode(lineText.slice(pos, clampStart)));
    }

    if (clampStart < clampEnd) {
      const mark = document.createElement('mark');
      const type = marker.type;
      mark.className = `${markerClass} pii-${type}`;
      mark.setAttribute('data-entity-id', marker.id ?? marker.entityId);
      mark.setAttribute('title', type);
      mark.setAttribute('aria-label', markerClass === 'pii'
        ? `${type} detected`
        : `replaced with ${marker.value ?? marker.replacement}`);
      mark.appendChild(document.createTextNode(lineText.slice(clampStart, clampEnd)));
      container.appendChild(mark);
    }

    pos = clampEnd;
  }

  if (pos < lineText.length) {
    container.appendChild(document.createTextNode(lineText.slice(pos)));
  }
}

/**
 * Render large input in RAF chunks to avoid UI freeze.
 * @param {{ original: HTMLElement, sanitized: HTMLElement }} containers
 * @param {string[]} origLines
 * @param {string[]} sanLines
 * @param {number} maxLines
 * @param {Array} entities
 * @param {Array} replacements
 * @param {string} originalText
 * @param {string} sanitizedText
 */
function renderChunked(containers, origLines, sanLines, maxLines, entities, replacements, originalText, sanitizedText) {
  let lineIdx = 0;
  const chunkSize = LIMITS.CHUNK_RENDER_LINES;

  function renderNextChunk() {
    const end = Math.min(lineIdx + chunkSize, maxLines);
    const origChunk = origLines.slice(lineIdx, end);
    const sanChunk = sanLines.slice(lineIdx, end);

    const origCharOffset = origLines.slice(0, lineIdx).reduce((s, l) => s + l.length + 1, 0);
    const sanCharOffset = sanLines.slice(0, lineIdx).reduce((s, l) => s + l.length + 1, 0);

    const origFrag = buildPane(origChunk, entities, 'pii', originalText, lineIdx, origCharOffset);
    const sanFrag = buildPane(sanChunk, replacements.map(r => ({
      ...r,
      start: r.outStart,
      end: r.outEnd,
      value: r.replacement,
      type: r.type,
      id: r.entityId,
    })), 'redacted', sanitizedText, lineIdx, sanCharOffset);

    containers.original.appendChild(origFrag);
    containers.sanitized.appendChild(sanFrag);

    lineIdx = end;
    if (lineIdx < maxLines) {
      requestAnimationFrame(renderNextChunk);
    }
  }

  requestAnimationFrame(renderNextChunk);
}

/**
 * Set up synchronized scrolling between two panes.
 * @param {HTMLElement} pane1
 * @param {HTMLElement} pane2
 */
function setupSyncScroll(pane1, pane2) {
  let syncing = false;

  const syncScroll = (source, target) => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    syncing = false;
  };

  pane1.addEventListener('scroll', () => syncScroll(pane1, pane2), { passive: true });
  pane2.addEventListener('scroll', () => syncScroll(pane2, pane1), { passive: true });
}

/**
 * Set up hover/focus linking between marks in both panes.
 * @param {HTMLElement} pane1
 * @param {HTMLElement} pane2
 */
function setupHoverLink(pane1, pane2) {
  const highlight = (entityId) => {
    for (const pane of [pane1, pane2]) {
      const marks = pane.querySelectorAll(`[data-entity-id="${entityId}"]`);
      for (const mark of marks) {
        mark.classList.add('highlight');
      }
    }
  };

  const unhighlight = (entityId) => {
    for (const pane of [pane1, pane2]) {
      const marks = pane.querySelectorAll(`[data-entity-id="${entityId}"]`);
      for (const mark of marks) {
        mark.classList.remove('highlight');
      }
    }
  };

  for (const pane of [pane1, pane2]) {
    pane.addEventListener('mouseover', (e) => {
      const mark = /** @type {HTMLElement} */ (e.target).closest('[data-entity-id]');
      if (mark) highlight(mark.getAttribute('data-entity-id'));
    });

    pane.addEventListener('mouseout', (e) => {
      const mark = /** @type {HTMLElement} */ (e.target).closest('[data-entity-id]');
      if (mark) unhighlight(mark.getAttribute('data-entity-id'));
    });

    pane.addEventListener('focusin', (e) => {
      const mark = /** @type {HTMLElement} */ (e.target).closest('[data-entity-id]');
      if (mark) highlight(mark.getAttribute('data-entity-id'));
    });

    pane.addEventListener('focusout', (e) => {
      const mark = /** @type {HTMLElement} */ (e.target).closest('[data-entity-id]');
      if (mark) unhighlight(mark.getAttribute('data-entity-id'));
    });
  }
}
