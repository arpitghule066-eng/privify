// @ts-check
/**
 * @file Playwright accessibility tests (axe-core WCAG 2.2 AA, keyboard flow, mobile).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Privify — Accessibility', () => {
  test('has zero axe-core violations across empty, loaded, modes, dark theme, and error states', async ({ page }) => {
    await page.goto('/');

    // Empty state
    let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // Loaded sample + full mode
    await page.click('#btn-load-sample');
    await expect(page.locator('#count-total')).toHaveText('21');
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // Partial mode
    await page.click('#mode-partial');
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // Pseudo mode
    await page.click('#mode-pseudo');
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // Dark theme
    await page.click('#theme-toggle');
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // Error message state
    await page.setInputFiles('#file-input', {
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });
    await expect(page.locator('#status-message')).toContainText('Invalid file type');
    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('supports keyboard-only navigation and activation', async ({ page }) => {
    await page.goto('/');

    // First Tab reaches skip link
    await page.keyboard.press('Tab');
    await expect(page.locator('#skip-link')).toBeFocused();

    // Focus Load Sample Text button and activate via Enter
    await page.locator('#btn-load-sample').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#count-total')).toHaveText('21');
  });

  test('has no horizontal overflow and stacks panes on 375x812 mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.click('#btn-load-sample');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const origBox = await page.locator('#diff-original').boundingBox();
    const sanBox = await page.locator('#diff-sanitized').boundingBox();
    expect(origBox).not.toBeNull();
    expect(sanBox).not.toBeNull();
    if (origBox && sanBox) {
      expect(sanBox.y).toBeGreaterThanOrEqual(origBox.y + origBox.height - 1);
    }
  });
});
