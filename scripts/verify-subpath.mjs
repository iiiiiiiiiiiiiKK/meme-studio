import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

/**
 * End-to-end check of the *deployed* layout: the build is served under
 * `/meme-studio/` and the local AI engine must load its models from that
 * sub-path (this is exactly what broke the GitHub Pages deployment once).
 */
const base = 'http://127.0.0.1:4290/meme-studio/';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push('[http ' + r.status() + '] ' + r.url());
});
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console] ' + m.text());
});

await page.goto(base + '#/create', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 20000 });

const buffer = readFileSync('node_modules/@vladmandic/human/assets/screenshot-vrm.jpg');
await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
  name: 'figure.jpg',
  mimeType: 'image/jpeg',
  buffer,
});
await page.waitForTimeout(1000);
await page.getByTestId('run-analysis').click();

let body = '';
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2500);
  body = await page.evaluate(() => document.body.innerText);
  if (/faces? ·|张人脸/.test(body)) break;
}
const match = body.match(/[^\n]*(faces? ·|张人脸)[^\n]*/);
console.log('analysis:', match ? match[0].trim() : 'TIMEOUT');
console.log('result panel:', await page.getByRole('button', { name: /Save to My Space|保存到我的空间/ }).isVisible().catch(() => false));
const badge = body.match(/Neural person matte|Colour fallback matte|神经网络人物蒙版|色彩蒙版（回退）/);
console.log('matte badge:', badge ? badge[0] : 'none');
console.log('errors:', errors.length ? errors.slice(0, 6).join('\n') : 'none');
await browser.close();
