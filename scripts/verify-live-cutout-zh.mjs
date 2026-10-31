import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

/**
 * Verifies the *live* deployment end to end: the engine must load its models
 * from the project sub-path and actually cut a real figure, and the interface
 * must switch to Chinese.
 */
const url = 'https://iiiiiiiiiiiiiKK.github.io/meme-studio/';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript("try { localStorage.setItem('meme-studio:locale','zh'); } catch {}");
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push('[http ' + r.status() + '] ' + r.url());
});

await page.goto(url + '#/create', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 30000 });
const buffer = readFileSync('node_modules/@vladmandic/human/assets/screenshot-vrm.jpg');
await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
  name: 'figure.jpg',
  mimeType: 'image/jpeg',
  buffer,
});
await page.waitForTimeout(1200);
await page.getByTestId('run-analysis').click();

let body = '';
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2500);
  body = await page.evaluate(() => document.body.innerText);
  if (/张人脸|faces? ·/.test(body)) break;
}
const summary = body.match(/[^\n]*(张人脸|faces? ·)[^\n]*/);
console.log('analysis:', summary ? summary[0].trim() : 'TIMEOUT');
const badge = body.match(/神经网络人物蒙版|色彩蒙版（回退）|Neural person matte|Colour fallback matte/);
console.log('matte:', badge ? badge[0] : 'none');
const size = body.match(/\d+×\d+ · 保留透明通道|\d+×\d+ · alpha kept/);
console.log('result:', size ? size[0] : 'none');
console.log('save button:', await page.getByRole('button', { name: /保存到我的空间|Save to My Space/ }).isVisible().catch(() => false));
await page.screenshot({ path: 'docs/screenshots/zh-live-cutout.png' });
console.log('errors:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
await browser.close();
