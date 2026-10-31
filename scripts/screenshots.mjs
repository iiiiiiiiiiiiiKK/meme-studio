import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4288';
const OUT = path.resolve(process.cwd(), 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

async function shoot(name, url, viewport, prepare) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (prepare) await prepare(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log('captured', name);
  await context.close();
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

await shoot('01-home', '/#/', desktop);
await shoot('02-discover', '/#/discover', desktop);
await shoot('03-create-empty', '/#/create', desktop);
await shoot('04-templates', '/#/templates', desktop);
await shoot('05-library', '/#/library', desktop);
await shoot('06-settings', '/#/settings', desktop);
await shoot('07-batch', '/#/batch', desktop);

// Editor with a text layer on the canvas. The editor needs a project, so the
// script creates one from a built-in canvas preset first.
await shoot('08-editor', '/#/templates', desktop, async (page) => {
  await page.waitForSelector('[data-testid="preset-use-builtin-square"]', { timeout: 20000 });
  await page.getByTestId('preset-use-builtin-square').click();
  await page.waitForSelector('[data-testid="add-text-layer"]', { timeout: 20000 });
  await page.getByTestId('add-text-layer').click();
  await page.waitForTimeout(600);
  const textarea = page.getByTestId('text-layer-content').first();
  await textarea.fill('LOCAL FIRST');
  await page.waitForTimeout(500);
  await page.getByTestId('add-ellipse-layer').click();
  await page.waitForTimeout(600);
});

// Mobile home + create.
await shoot('09-mobile-home', '/#/', phone);
await shoot('10-mobile-create', '/#/create', phone);
await shoot('11-mobile-discover', '/#/discover', phone);

await browser.close();
console.log('screenshots written to', OUT);
