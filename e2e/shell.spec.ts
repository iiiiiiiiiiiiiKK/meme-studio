import { test, expect } from '@playwright/test';

test.describe('shell and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
  });

  test('home renders the hero and the author X link', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('meme asset factory');
    const xLink = page.getByTestId('author-x-link');
    await expect(xLink).toBeVisible({ timeout: 10000 });
    await expect(xLink).toHaveAttribute('href', 'https://x.com/0xkillcoin');
  });

  test('primary navigation reaches every page', async ({ page }) => {
    for (const [route, marker] of [
      ['home', /meme asset factory/i],
      ['discover', /starter collection/i],
      ['create', /Local AI/],
      ['batch', /Queue dozens/i],
      ['library', /My Space/],
      ['templates', /Parameter presets/i],
      ['settings', /affects only this browser/i],
    ] as const) {
      await page.getByTestId(`nav-${route}`).click();
      await expect(page.getByRole('main')).toContainText(marker);
      await page.goto('/');
      await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 10000 });
    }
  });

  test('theme toggle persists across a reload', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /Switch to light theme/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('discover search filters the starter pack', async ({ page }) => {
    await page.getByTestId('nav-discover').click();
    await page.waitForSelector('article', { timeout: 15000 });
    const cards = page.locator('article');
    await expect(cards).toHaveCount(12);
    await page.getByTestId('discover-search').fill('smug');
    await expect(cards).toHaveCount(1);
    await page.getByTestId('discover-search').fill('zzzznonexistent');
    await expect(page.getByText('Nothing matches that filter')).toBeVisible();
  });
});
