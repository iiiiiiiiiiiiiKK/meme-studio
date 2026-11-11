import { test, expect } from '@playwright/test';

/**
 * A saved project must survive a reload with its image layers intact.
 *
 * Before the fix, an image layer stored an object URL that only existed in the
 * document that created it, so reopening the project showed an empty canvas.
 * The fix rehydrates every layer from its IndexedDB blob (`lib/hydrate.ts`).
 */
test.describe('project persistence', () => {
  test('an imported sticker still renders after the project is reopened', async ({ page }) => {
    await page.goto('/#/discover');
    await page.waitForSelector('article', { timeout: 20000 });

    const card = page.locator('article').filter({ hasText: 'Happy Sticker' }).first();
    await card.getByRole('button', { name: /Import Happy Sticker/ }).click();
    await expect(page.getByText(/added to My Space|已加入/)).toBeVisible({ timeout: 20000 });

    await page.getByTestId('nav-library').click();
    await page.waitForSelector('text=/Assets|素材/', { timeout: 20000 });

    // Open the asset in the editor — this creates a project with one image layer.
    await page.getByRole('button', { name: /Open Happy Sticker/ }).first().click();
    await page.waitForSelector('text=/Dimensions|尺寸/', { timeout: 20000 });
    await page.getByRole('button', { name: /Open in editor/ }).first().click();
    await page.waitForSelector('[data-testid="editor-save"]', { timeout: 30000 });

    // Confirm the layer actually painted before the reload.
    await expect(page.locator('[data-layer-id]')).toHaveCount(1, { timeout: 20000 });

    // Reload and reopen the same project from Home.
    await page.goto('/#/home');
    const projectCard = page.locator('[data-testid^="project-"]').first();
    await expect(projectCard).toBeVisible({ timeout: 20000 });
    await projectCard.click();
    await page.waitForSelector('[data-testid="editor-save"]', { timeout: 30000 });

    // The image layer must still be there and must have a live (rebuildable) source.
    const layer = page.locator('[data-layer-id]').first();
    await expect(layer).toBeVisible({ timeout: 20000 });
    const img = layer.locator('img');
    await expect(img).toBeVisible({ timeout: 20000 });
    const natural = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natural).toBeGreaterThan(0);
  });
});
