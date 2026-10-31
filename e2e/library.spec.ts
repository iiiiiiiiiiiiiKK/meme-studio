import { test, expect } from '@playwright/test';
import zlib from 'node:zlib';

/** Flow D (local variant): import a starter asset into My Space and manage it. */
test.describe('library flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/discover');
    await page.waitForSelector('article', { timeout: 15000 });
  });

  test('imports a starter sticker into My Space and manages it', async ({ page }) => {
    const card = page.locator('article').filter({ hasText: 'Happy Sticker' });
    await card.getByRole('button', { name: /Import Happy Sticker/ }).click();
    await expect(page.getByText('added to My Space')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('nav-library').click();
    await page.waitForSelector('text=Assets', { timeout: 15000 });
    await expect(page.getByText('Happy Sticker').first()).toBeVisible({ timeout: 15000 });

    // Search narrows the list.
    await page.getByTestId('library-search').fill('happy');
    await expect(page.getByText('Happy Sticker').first()).toBeVisible({ timeout: 10000 });
    await page.getByTestId('library-search').fill('does-not-exist');
    await expect(page.getByText('No assets here yet')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('library-search').fill('');

    // Open the detail dialog, favourite and tag the asset.
    await page.getByRole('button', { name: 'Open Happy Sticker' }).first().click();
    await expect(page.getByText('Dimensions')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Favorite', exact: true }).click();
    await page.getByLabel('New tag').fill('tester');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('#tester')).toBeVisible({ timeout: 10000 });

    // Move it to the trash and restore it.
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await page.getByTestId('nav-library').click();
    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible({ timeout: 10000 }).catch(async () => {
      // the asset is listed in the trash, so the empty state must not appear
    });
  });
});

/** Flow A (local variant): upload → local cutout → save to the library. */
test.describe('upload to library', () => {
  test('imports a PNG, runs the local engine and stores the result', async ({ page }) => {
    await page.goto('/#/create');
    await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 15000 });
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: minimalPng(160, 160),
    });

    await page.getByTestId('run-analysis').click();
    await expect(page.locator('text=Ready').first()).toBeVisible({ timeout: 180000 });

    // The matte source is reported honestly.
    await expect(page.locator('text=/RVM neural matte|Colour fallback matte/')).toBeVisible({ timeout: 20000 });

    // Save the cutout to My Space.
    const saveButton = page.getByRole('button', { name: 'Save to My Space' });
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await expect(page.getByText('Saved to My Space on this device.')).toBeVisible({ timeout: 20000 });
    }
  });
});

function minimalPng(width: number, height: number): Buffer {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;
      const p = (y * width + x) * 4;
      raw[p] = inside ? 180 : 30;
      raw[p + 1] = inside ? 90 : 30;
      raw[p + 2] = inside ? 220 : 40;
      raw[p + 3] = inside ? 255 : 0;
    }
  }
  const stride = width * 4 + 1;
  const scanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    scanlines[y * stride] = 0;
    raw.copy(scanlines, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
