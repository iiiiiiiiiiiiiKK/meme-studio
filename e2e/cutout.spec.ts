import { test, expect } from '@playwright/test';
import zlib from 'node:zlib';

test.describe('cutout flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create');
    await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 15000 });
  });

  test('uploads an image and runs the local analysis', async ({ page }) => {
    const input = page.locator('input[type="file"][accept="image/*"]');
    await input.setInputFiles({
      name: 'red-square.png',
      mimeType: 'image/png',
      buffer: minimalPng(160, 160),
    });

    // The dropzone heading should be replaced by the cutout toolbar.
    await expect(page.locator('text=Local AI').first()).toBeVisible({ timeout: 15000 });

    const btn = page.getByTestId('run-analysis');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toBeDisabled();

    // The engine warms up and the status pill flips to Ready.
    await expect(page.locator('text=Ready').first()).toBeVisible({ timeout: 180000 });

    // An analysis summary is rendered afterwards.
    await expect(page.locator('text=/face/i').first()).toBeVisible({ timeout: 20000 });
  });
});

/** Hand-coded RGBA PNG: a red square on a transparent background. */
function minimalPng(width: number, height: number): Buffer {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8;
      const p = (y * width + x) * 4;
      raw[p] = inside ? 214 : 0;
      raw[p + 1] = inside ? 46 : 0;
      raw[p + 2] = inside ? 58 : 0;
      raw[p + 3] = inside ? 255 : 0;
    }
  }
  const stride = width * 4 + 1;
  const scanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    scanlines[y * stride] = 0; // filter: none
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
