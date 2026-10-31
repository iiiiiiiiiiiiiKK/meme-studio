import { test, expect } from '@playwright/test';

/**
 * Localisation: the language switch must actually translate the interface,
 * persist across reloads, and cover the primary navigation.
 */
test.describe('localisation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 20000 });
  });

  test('switches the whole interface to Chinese and remembers it', async ({ page }) => {
    // English by default.
    await expect(page.getByTestId('nav-home')).toContainText('Home');
    await expect(page.getByTestId('nav-create')).toContainText('Create');

    // Switch to Chinese in Settings.
    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: '中文' }).click();

    // Navigation is translated.
    await expect(page.getByTestId('nav-home')).toContainText('首页');
    await expect(page.getByTestId('nav-discover')).toContainText('发现');
    await expect(page.getByTestId('nav-create')).toContainText('创作');
    await expect(page.getByTestId('nav-library')).toContainText('我的空间');

    // The document language attribute follows the locale.
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    // It survives a reload.
    await page.reload();
    await page.waitForSelector('h1', { timeout: 20000 });
    await expect(page.getByTestId('nav-home')).toContainText('首页');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    // Switching back restores English.
    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByTestId('nav-home')).toContainText('Home');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Chinese pages render real translated copy, not raw keys', async ({ page }) => {
    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: '中文' }).click();
    await page.getByTestId('nav-home').click();

    const main = page.getByTestId('main');
    await expect(main).toContainText('Meme 素材工厂');
    // No untranslated "key{placeholder}" leftovers anywhere on the page.
    const text = (await page.locator('body').innerText()) ?? '';
    expect(text).not.toMatch(/\{count\}|\{name\}|\{size\}|\{w\}×\{h\}/);
  });
});
