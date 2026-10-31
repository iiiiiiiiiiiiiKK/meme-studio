import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Captures the README screenshots from the production build, in both English and
 * Chinese, so the documentation matches what users actually see.
 *
 * Usage: start `vite preview` on port 4288 first, then run this script.
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4288';
const OUT = path.resolve(process.cwd(), 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

async function shoot(name, url, viewport, locale, prepare) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (locale) {
    await context.addInitScript(`try { localStorage.setItem('meme-studio:locale', '${locale}'); } catch {}`);
  }
  const page = await context.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (prepare) await prepare(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log('captured', name);
  await context.close();
}

// English set
await shoot('01-home', '/#/', desktop, 'en');
await shoot('02-discover', '/#/discover', desktop, 'en');
await shoot('03-create-empty', '/#/create', desktop, 'en');
await shoot('04-templates', '/#/templates', desktop, 'en');
await shoot('05-library', '/#/library', desktop, 'en');
await shoot('06-settings', '/#/settings', desktop, 'en');
await shoot('07-batch', '/#/batch', desktop, 'en');
await shoot('08-editor', '/#/templates', desktop, 'en', async (page) => {
  await page.getByTestId('preset-use-builtin-square').click();
  await page.waitForSelector('[data-testid="add-text-layer"]', { timeout: 20000 });
  await page.getByTestId('add-text-layer').click();
  await page.waitForTimeout(600);
  await page.getByTestId('text-layer-content').first().fill('LOCAL FIRST');
  await page.waitForTimeout(500);
  await page.getByTestId('add-ellipse-layer').click();
  await page.waitForTimeout(600);
});
await shoot('09-mobile-home', '/#/', phone, 'en');
await shoot('10-mobile-create', '/#/create', phone, 'en');
await shoot('11-mobile-discover', '/#/discover', phone, 'en');

// Chinese set
await shoot('zh-01-home', '/#/', desktop, 'zh');
await shoot('zh-02-discover', '/#/discover', desktop, 'zh');
await shoot('zh-03-create', '/#/create', desktop, 'zh');
await shoot('zh-04-settings', '/#/settings', desktop, 'zh');
await shoot('zh-05-batch', '/#/batch', desktop, 'zh');
await shoot('zh-06-mobile-home', '/#/', phone, 'zh');
await shoot('zh-07-mobile-create', '/#/create', phone, 'zh');

await browser.close();
console.log('screenshots written to', OUT);
