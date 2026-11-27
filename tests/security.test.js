// @ts-check
/**
 * @file Static security scans of source files.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function listFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const JS_FILES = listFiles(join(ROOT, 'js'));
const CSS_FILES = listFiles(join(ROOT, 'css'));
const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const SW_JS = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const FIREBASE_JSON = readFileSync(join(ROOT, 'firebase.json'), 'utf8');

describe('security — static source scans', () => {
  it('contains no unsafe DOM sinks or eval patterns in js/, index.html, css/', () => {
    const banned = [
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'document.write',
      'eval(',
      'new Function',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'sendBeacon',
      'importScripts',
    ];
    const files = [...JS_FILES, ...CSS_FILES, join(ROOT, 'index.html')];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of banned) {
        assert.equal(content.includes(pattern), false, `Found banned "${pattern}" in ${file}`);
      }
      assert.equal(content.includes('fetch('), false, `Found fetch( in ${file}`);
    }
  });

  it('contains no console.log or remote http/https URLs in shipped client files', () => {
    const files = [...JS_FILES, ...CSS_FILES, join(ROOT, 'index.html')];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      assert.equal(content.includes('console.log'), false, `Found console.log in ${file}`);
      assert.equal(/https?:\/\//i.test(content), false, `Found http(s):// URL in ${file}`);
    }
  });

  it('uses localStorage only with key privify-theme', () => {
    for (const file of JS_FILES) {
      const content = readFileSync(file, 'utf8');
      assert.equal(content.includes('sessionStorage'), false, `Found sessionStorage in ${file}`);
      if (content.includes('localStorage')) {
        assert.ok(content.includes('THEME_STORAGE_KEY') || content.includes('privify-theme'));
      }
    }
  });

  it('enforces strict CSP and module scripts in index.html without inline JS/CSS/handlers', () => {
    assert.ok(INDEX_HTML.includes('http-equiv="Content-Security-Policy"'));
    assert.ok(INDEX_HTML.includes("script-src 'self'"));
    assert.ok(INDEX_HTML.includes("require-trusted-types-for 'script'"));
    assert.equal(/<style[\s>]/i.test(INDEX_HTML), false);
    assert.equal(/\son[a-z]+=/i.test(INDEX_HTML), false);
    assert.equal(/\sstyle=/i.test(INDEX_HTML), false);
    const scripts = INDEX_HTML.match(/<script\b[^>]*>/gi) || [];
    assert.ok(scripts.length > 0);
    for (const tag of scripts) {
      assert.ok(tag.includes('type="module"'), `Script tag missing type="module": ${tag}`);
      assert.ok(tag.includes('src='), `Inline script without src: ${tag}`);
    }
  });

  it('restricts sw.js to same-origin GET requests', () => {
    assert.ok(SW_JS.includes('url.origin !== self.location.origin'));
    assert.ok(SW_JS.includes("request.method !== 'GET'"));
  });

  it('configures all required security headers in firebase.json', () => {
    const required = [
      'Content-Security-Policy',
      "frame-ancestors 'none'",
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ];
    for (const header of required) {
      assert.ok(FIREBASE_JSON.includes(header), `firebase.json missing ${header}`);
    }
  });
});
