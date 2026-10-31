import { test, expect } from '@playwright/test';

/**
 * Mobile layout checks. The app must work on a 390px-wide phone: no horizontal
 * scroll, no clipped controls, and a bottom tab bar instead of the desktop
 * sidebar.
 */
test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('home page fits the viewport without horizontal scrolling', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    // The desktop sidebar is hidden, the bottom tab bar is visible.
    await expect(page.getByTestId('nav-home')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  });

  test('the bottom tab bar navigates between pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
    const tabs = page.getByRole('navigation', { name: 'Mobile navigation' });
    await tabs.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Local cutout studio')).toBeVisible({ timeout: 15000 });
    await tabs.getByRole('button', { name: 'Batch' }).click();
    await expect(page.getByText('Queue dozens of photos')).toBeVisible({ timeout: 15000 });
    await tabs.getByRole('button', { name: 'Space' }).click();
    await expect(page.getByText('Everything here is stored in IndexedDB')).toBeVisible({ timeout: 15000 });
  });

  test('the mobile navigation drawer opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  });

  test('the author X link is reachable on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
    const link = page.getByTestId('author-x-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
  });

  test('discover cards stay inside the viewport on a phone', async ({ page }) => {
    await page.goto('/#/discover');
    await page.waitForSelector('article', { timeout: 15000 });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
