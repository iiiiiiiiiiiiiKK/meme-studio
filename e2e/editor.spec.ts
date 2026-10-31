import { test, expect } from '@playwright/test';

/**
 * Flow C: upload images → add layers → position them → add text → save the
 * project → reopen it and confirm the layers survived.
 */
test.describe('editor flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
  });

  test('creates a project, edits it, saves it and reopens it', async ({ page }) => {
    // Start a blank project from the Templates page (1080 square canvas preset).
    await page.getByTestId('nav-templates').click();
    await page.waitForSelector('text=1080 Square Canvas', { timeout: 15000 });
    await page.getByTestId('preset-use-builtin-square').click();

    // The editor should open with a 1080×1080 transparent canvas.
    await page.waitForSelector('[data-testid="add-text-layer"]', { timeout: 20000 });
    await expect(page.locator('text=1080×1080').first()).toBeVisible({ timeout: 15000 });

    // Add a text layer and edit its content.
    await page.getByTestId('add-text-layer').click();
    await page.waitForTimeout(400);
    const textarea = page.getByTestId('text-layer-content').first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill('LOCAL FIRST');
    await page.waitForTimeout(300);

    // The layer list shows the new layer.
    await expect(page.locator('text=LOCAL FIRST').first()).toBeVisible({ timeout: 15000 });

    // Undo removes the change, redo restores it.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);

    // Save the project.
    await page.getByTestId('editor-save').click();
    await expect(page.getByText('Project saved to this device.')).toBeVisible({ timeout: 20000 });

    // The project must now exist in My Space.
    await page.getByTestId('nav-library').click();
    await page.waitForSelector('text=Projects', { timeout: 15000 });
    await expect(page.getByText('1080 Square Canvas', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // Reload the page and reopen the project: the text layer must still be there.
    await page.goto('/');
    await page.waitForSelector('h1:has-text("meme asset factory")', { timeout: 15000 });
    await page.getByTestId('nav-library').click();
    await page.waitForSelector('text=Projects', { timeout: 15000 });
    await page.getByText('1080 Square Canvas', { exact: true }).first().click();
    await page.waitForSelector('[data-testid="text-layer-content"]', { timeout: 20000 });
    await expect(page.getByTestId('text-layer-content').first()).toHaveValue('LOCAL FIRST');
  });

  test('export dialog reports the real output size', async ({ page }) => {
    await page.getByTestId('nav-templates').click();
    await page.waitForSelector('text=1080 Square Canvas', { timeout: 15000 });
    await page.getByTestId('preset-use-builtin-square').click();
    await page.waitForSelector('[data-testid="editor-export"]', { timeout: 20000 });

    await page.getByTestId('editor-export').click();
    await expect(page.getByText('Export canvas')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Output: 1080 × 1080 px')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Estimated size:/)).toBeVisible();

    // 2x scale doubles the output dimensions.
    await page.getByRole('button', { name: '2x' }).click();
    await expect(page.getByText('Output: 2160 × 2160 px')).toBeVisible({ timeout: 15000 });

    // PNG keeps alpha; the dialog must state that the checkerboard is not baked in.
    await expect(page.getByText(/checkerboard you see on the stage is never baked in/i)).toBeVisible();
  });
});
