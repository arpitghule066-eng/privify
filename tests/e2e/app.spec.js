// @ts-check
/**
 * @file Playwright E2E functional UI tests for RedactLocal.
 */
import { test, expect } from '@playwright/test';

test.describe('RedactLocal — Functional UI', () => {
  test('loads sample text and displays expected entity counts', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');

    await expect(page.locator('#count-total')).toHaveText('21');
    await expect(page.locator('#count-EMAIL')).toHaveText('4');
    await expect(page.locator('#count-PHONE')).toHaveText('4');
    await expect(page.locator('#count-IP')).toHaveText('4');
    await expect(page.locator('#count-PAN')).toHaveText('3');
    await expect(page.locator('#count-AADHAAR')).toHaveText('3');
    await expect(page.locator('#count-CARD')).toHaveText('3');
  });

  test('switches between full, partial, and pseudo modes accurately', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');

    await expect(page.locator('#diff-sanitized')).toContainText('[REDACTED]');

    await page.click('#mode-partial');
    await expect(page.locator('#diff-sanitized')).toContainText('XXXX XXXX XXXX 1111');
    await expect(page.locator('#diff-sanitized')).toContainText('J***@Example.com');

    await page.click('#mode-pseudo');
    await expect(page.locator('#diff-sanitized')).toContainText('USER_01');
    await expect(page.locator('#diff-sanitized')).toContainText('PHONE_01');

    // Both occurrences of John Doe's email map to USER_01
    const sanitizedText = await page.locator('#diff-sanitized').innerText();
    const user01Matches = sanitizedText.match(/USER_01/g) || [];
    expect(user01Matches.length).toBeGreaterThanOrEqual(2);
  });

  test('does not highlight Luhn-invalid card decoy in diff-original', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');

    const markedTexts = await page.locator('#diff-original mark').allInnerTexts();
    expect(markedTexts).not.toContain('1234 5678 9012 3456');
    expect(markedTexts).not.toContain('4111111111111112');
  });

  test('unchecking toggle-EMAIL disables email detection', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');
    await expect(page.locator('#count-EMAIL')).toHaveText('4');

    await page.uncheck('#toggle-EMAIL');
    await expect(page.locator('#count-EMAIL')).toHaveText('0');
    await expect(page.locator('#diff-sanitized')).toContainText('John.Doe@Example.com');
  });

  test('downloads sanitized output without raw email', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');
    await expect(page.locator('#btn-download')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-download'),
    ]);

    expect(download.suggestedFilename()).toBe('sanitized_output.txt');
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('utf8');
    expect(content).not.toContain('John.Doe@Example.com');
    expect(content).toContain('[REDACTED]');
  });

  test('exports audit report JSON with counts only and no raw PII', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-export-report'),
    ]);

    expect(download.suggestedFilename()).toBe('audit-report.json');
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('utf8');
    const report = JSON.parse(content);

    expect(report.totalEntities).toBe(21);
    expect(report.counts.EMAIL).toBe(4);
    expect(content).not.toContain('John.Doe@Example.com');
    expect(content).not.toContain('ABCPE1234F');
  });

  test('clears all state when Clear is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-load-sample');
    await expect(page.locator('#count-total')).toHaveText('21');

    await page.click('#btn-clear');
    await expect(page.locator('#input-text')).toHaveValue('');
    await expect(page.locator('#count-total')).toHaveText('0');
    await expect(page.locator('#btn-download')).toBeDisabled();
  });

  test('degrades gracefully when Gemini Nano is unavailable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ai-status')).toContainText('Not available on this browser');
    await expect(page.locator('#toggle-ai-assist')).toBeDisabled();
  });
});
