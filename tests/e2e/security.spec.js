// @ts-check
/**
 * @file Playwright E2E security tests for RedactLocal.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('RedactLocal — Security', () => {
  test('makes zero network requests after initial page load', async ({ page }) => {
    const postLoadRequests = [];
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    page.on('request', (req) => {
      postLoadRequests.push(req.url());
    });

    await page.click('#btn-load-sample');
    await expect(page.locator('#count-total')).toHaveText('21');
    await page.click('#mode-partial');
    await page.click('#mode-pseudo');
    await page.click('#btn-load-sample-csv');
    await page.click('#btn-clear');

    expect(postLoadRequests).toEqual([]);
  });

  test('renders XSS payloads as literal plain text with zero console errors or dialogs', async ({ page }) => {
    const errors = [];
    const dialogs = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss();
    });

    await page.goto('/');
    const payload = '<img src=x onerror=alert(1)> <script>alert(1)</script>';
    await page.fill('#input-text', payload);

    await expect(page.locator('#diff-original')).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#diff-sanitized')).toContainText('<script>alert(1)</script>');
    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('rejects disallowed or oversized file uploads and accepts noisy-sample.txt', async ({ page }) => {
    await page.goto('/');

    // Reject .exe
    await page.setInputFiles('#file-input', {
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });
    await expect(page.locator('#status-message')).toContainText('Invalid file type');

    // Reject .pdf
    await page.setInputFiles('#file-input', {
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(page.locator('#status-message')).toContainText('Invalid file type');

    // Reject > 5 MB
    await page.setInputFiles('#file-input', {
      name: 'huge.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 'a'),
    });
    await expect(page.locator('#status-message')).toContainText('File too large');

    // Accept samples/noisy-sample.txt
    const samplePath = resolve(import.meta.dirname, '../../samples/noisy-sample.txt');
    const sampleBuf = readFileSync(samplePath);
    await page.setInputFiles('#file-input', {
      name: 'noisy-sample.txt',
      mimeType: 'text/plain',
      buffer: sampleBuf,
    });
    await expect(page.locator('#count-total')).toHaveText('21');
  });
});
