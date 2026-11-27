# Security Policy & Threat Model — RedactLocal

RedactLocal is designed on a **zero-trust, zero-network** principle: sensitive user data never leaves the browser tab.

## Threat Model

| Threat | Attack Vector | Mitigation | Verification / Test |
|---|---|---|---|
| **Data Exfiltration** | Malicious script, dependency, or telemetry sending PII over the network | Zero runtime dependencies; no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` in app code; strict CSP (`default-src 'none'`); Service Worker restricted to same-origin `GET` | `tests/security.test.js` (static scan) & `tests/e2e/security.spec.js` (0 network requests after load) |
| **XSS via Pasted / Uploaded Text** | Crafting `<img src=x onerror=alert(1)>` or `<script>` in input text | Zero unsafe DOM sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`); all DOM built via `createElement` + `createTextNode` / `textContent`; CSP enforces `require-trusted-types-for 'script'` | `tests/security.test.js` & `tests/e2e/security.spec.js` |
| **CSV Formula Injection** | Malicious cell starting with `=`, `@`, `+`, `-`, `\t`, `\r` executing in Excel/Sheets | `neutralizeFormulas()` prefixes dangerous cells with `'` on CSV export when `toggle-csv-safe` is enabled; RFC 4180 quoting | `tests/csv.test.js` |
| **ReDoS (Regex Denial of Service)** | Pathological input like `'a'.repeat(50000) + '@'` causing catastrophic backtracking | Linear-time regexes with no nested quantifiers; fresh `RegExp` per call; detection offloaded to a Web Worker | `tests/detectors.test.js` (< 200 ms budget) |
| **Malicious File Upload** | Uploading executables (`.exe`), double-extensions (`.txt.exe`), oversized files, or binary payloads | `validateFile()` enforces `.txt`/`.csv` extension, MIME allowlist, ≤ 5 MB size; `readFile()` rejects NUL (`\u0000`) bytes and strips BOM | `tests/fileio.test.js` & `tests/e2e/security.spec.js` |
| **Clickjacking** | Embedding RedactLocal in an attacker's `<iframe>` | `X-Frame-Options: DENY` and `CSP: frame-ancestors 'none'` in `firebase.json` and `scripts/serve.mjs` | `tests/security.test.js` |
| **Supply Chain Compromise** | Compromised npm runtime dependency | Zero runtime dependencies; zero build step; `devDependencies` limited to ESLint, Playwright, axe-core | `package.json` & `scripts/build-site.mjs` |
| **Mapping File Leakage** | Accidental exposure of pseudonym-to-PII `mapping.json` | Mapping kept in memory only; never persisted to storage; export disabled outside `pseudo` mode and gated by `confirm()` warning | `js/app.js` & `tests/security.test.js` |
| **Shoulder-Surfing / Persistence** | Leaving sensitive text in `localStorage`, `sessionStorage`, cookies, or `IndexedDB` | Zero persistence of raw input or mappings; only UI theme (`redactlocal-theme`) stored in `localStorage`; Clear button wipes all state | `tests/security.test.js` & `tests/e2e/app.spec.js` |

## Security Headers

Served by `firebase.json` (production) and `scripts/serve.mjs` (local):
- `Content-Security-Policy`: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; require-trusted-types-for 'script'; frame-ancestors 'none'; upgrade-insecure-requests`
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `no-referrer`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy`: `same-origin`

## Reporting a Vulnerability

If you discover a security vulnerability in RedactLocal, please report it privately via the repository's **Security** tab on GitHub (or open a confidential security advisory) rather than a public issue. We will acknowledge reports within 48 hours.
