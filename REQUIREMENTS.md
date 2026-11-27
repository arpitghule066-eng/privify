# Requirements Traceability Matrix — RedactLocal

Every mandatory requirement from the brief mapped to its implementation, file, function, and automated test.

| # | Requirement | Feature / Implementation | File(s) | Function(s) / ID(s) | Automated Test(s) |
|---|---|---|---|---|---|
| 1 | 100% client-side, zero network calls | No `fetch`/`XHR`/`WebSocket`/CDN; CSP `default-src 'none'` | `index.html`, `js/*`, `sw.js` | CSP meta tag | `tests/security.test.js`, `tests/e2e/security.spec.js` (`makes zero network requests after initial page load`) |
| 2 | Email detection | Regex + word boundaries + lowercase normalization | `js/detectors.js` | `detect()`, `normalize()` | `tests/detectors.test.js` (`detects EMAIL with exact start/end/value`) |
| 3 | Phone detection (IN, US, Intl) | Multi-pattern phone regex, 7–15 digits, last-10 normalization | `js/detectors.js` | `findPhones()`, `normalize()` | `tests/detectors.test.js` (`detects Indian, US, and international PHONE numbers`) |
| 4 | IPv4 & IPv6 detection | Octet bounds 0–255 (no leading zero), full & `::` IPv6 | `js/validators.js`, `js/detectors.js` | `isValidIPv4()`, `isValidIPv6()`, `findIPv4()`, `findIPv6()` | `tests/validators.test.js`, `tests/detectors.test.js` |
| 5 | Indian PAN detection | `[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]` validation | `js/validators.js`, `js/detectors.js` | `isValidPAN()`, `findPAN()` | `tests/validators.test.js`, `tests/detectors.test.js` |
| 6 | Aadhaar detection + Verhoeff | 12-digit `[2-9]...` + Verhoeff checksum + `strictAadhaar` | `js/validators.js`, `js/detectors.js` | `verhoeff()`, `findAadhaar()` | `tests/validators.test.js`, `tests/detectors.test.js` |
| 7 | Credit/Debit Card + Luhn | 13–19 digits, Luhn checksum required, IIN brand tagging | `js/validators.js`, `js/detectors.js` | `luhn()`, `findCards()`, `detectCardBrand()` | `tests/validators.test.js`, `tests/detectors.test.js`, `tests/e2e/app.spec.js` |
| 8 | Overlap resolution | Longest span wins, tie-break priority `CARD > AADHAAR > PAN > EMAIL > IPV6 > IPV4 > PHONE` | `js/detectors.js` | `resolveOverlaps()` | `tests/detectors.test.js` (`prefers EMAIL over PHONE`, `returns non-overlapping entities`) |
| 9 | Full redaction mode | `[REDACTED]` or `[REDACTED:TYPE]`, idempotent | `js/redactor.js` | `redact()` | `tests/redactor.test.js`, `tests/engine.test.js` |
| 10 | Partial redaction mode | Keep last 4 / domain / first 2 octets | `js/redactor.js` | `partialRedact()`, `maskDigitsKeepLast4()` | `tests/redactor.test.js`, `tests/e2e/app.spec.js` |
| 11 | Pseudo redaction mode | Consistent `USER_01`, `PHONE_01`, etc. across case/format variants | `js/redactor.js` | `pseudoRedact()` | `tests/redactor.test.js`, `tests/e2e/app.spec.js` |
| 12 | Side-by-side diff view | Line-aligned, synced scroll, hover/focus link, chunked > 200 KB | `js/diff.js` | `renderDiff()`, `setupSyncScroll()`, `setupHoverLink()` | `tests/e2e/app.spec.js`, `tests/e2e/a11y.spec.js` |
| 13 | Live per-type & total counts | `count-total`, `count-EMAIL`, etc. with `aria-live="polite"` | `index.html`, `js/app.js` | `updateCounts()`, `announceResults()` | `tests/e2e/app.spec.js` |
| 14 | 1-click sample loader (TXT + CSV) | `btn-load-sample`, `btn-load-sample-csv` | `js/samples.js`, `js/app.js` | `SAMPLE_TEXT`, `SAMPLE_CSV` | `tests/e2e/app.spec.js` |
| 15 | File upload & drag-drop + validation | `.txt`/`.csv`, ≤ 5 MB, MIME check, no NUL bytes, BOM strip | `js/fileio.js`, `js/app.js` | `validateFile()`, `readFile()`, `ValidationError` | `tests/fileio.test.js`, `tests/e2e/security.spec.js` |
| 16 | CSV formula injection defense | Prefix `=`, `@`, `\t`, `\r`, `+`/`-` non-digit with `'` | `js/csv.js`, `js/app.js` | `parseCSV()`, `stringifyCSV()`, `neutralizeFormulas()` | `tests/csv.test.js` |
| 17 | Download, Copy, Audit Report, Mapping | `btn-download`, `btn-copy`, `btn-export-report`, `btn-export-mapping` | `js/fileio.js`, `js/app.js` | `downloadText()`, `handleExportReport()`, `handleExportMapping()` | `tests/e2e/app.spec.js` |
| 18 | XSS protection | No `innerHTML`/`eval`, `require-trusted-types-for 'script'` | `js/diff.js`, `index.html` | `renderLineWithMarkers()` | `tests/security.test.js`, `tests/e2e/security.spec.js` |
| 19 | Web Worker & Efficiency | Off-main-thread `engine.process()`, 250 ms debounce, mode switch reuses entities | `js/worker.js`, `js/app.js`, `js/detectors.js` | `onModeChange()`, `resolveOverlaps()` | `tests/performance.test.js` |
| 20 | Google Services (privacy-preserving) | On-device Gemini Nano (`ai-assist.js`), Firebase Hosting (`firebase.json`), Lighthouse CI, MD3 tokens, PWA (`sw.js`) | `js/ai-assist.js`, `firebase.json`, `lighthouserc.json`, `css/styles.css`, `sw.js` | `isAiAvailable()`, `detectWithAI()` | `tests/ai-assist.test.js`, `tests/e2e/app.spec.js` |
| 21 | WCAG 2.2 AA Accessibility | Skip link, landmarks, keyboard flow, contrast, 320px/mobile, `prefers-reduced-motion` | `index.html`, `css/styles.css`, `js/diff.js` | `#skip-link`, `aria-live`, `role="region"` | `tests/e2e/a11y.spec.js` |
