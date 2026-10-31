import { test, expect } from '@playwright/test';
import zlib from 'node:zlib';

/**
 * Flow B: queue several images → process them in Batch Studio → export a ZIP.
 * A single unreadable file must not abort the whole batch.
 */
test.describe('batch studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/batch');
    await page.waitForSelector('text=Batch Studio', { timeout: 15000 });
  });

  test('queues images, processes them and exports a ZIP', async ({ page }) => {
    const input = page.locator('input[type="file"][multiple][accept="image/*"]').first();
    await input.setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: minimalPng(120, 120, 200, 40, 40) },
      { name: 'two.png', mimeType: 'image/png', buffer: minimalPng(120, 120, 40, 200, 40) },
    ]);

    // Both files are queued.
    await expect(page.getByText('2 files')).toBeVisible({ timeout: 15000 });

    // Start the batch and wait for the queue to drain.
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/done · .* working · .* queued · .* failed/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('2 done · 0 working · 0 queued · 0 failed')).toBeVisible({ timeout: 180000 });

    // Export the ZIP.
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Export ZIP' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/meme-studio-batch-.*\.zip/);
  });

  test('a broken file does not abort the whole batch', async ({ page }) => {
    const input = page.locator('input[type="file"][multiple][accept="image/*"]').first();
    await input.setInputFiles([
      { name: 'good.png', mimeType: 'image/png', buffer: minimalPng(120, 120, 40, 200, 40) },
      { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a real png') },
    ]);

    await expect(page.getByText('2 files')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Start' }).click();

    // The batch finishes with one failure and one success.
    await expect(page.getByText('1 done · 0 working · 0 queued · 1 failed')).toBeVisible({ timeout: 180000 });
    await expect(page.getByText('Retry failed')).toBeVisible({ timeout: 15000 });
  });
});

/** Hand-coded RGBA PNG with a coloured square. */
function minimalPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8;
      const p = (y * width + x) * 4;
      raw[p] = inside ? r : 20;
      raw[p + 1] = inside ? g : 20;
      raw[p + 2] = inside ? b : 20;
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
