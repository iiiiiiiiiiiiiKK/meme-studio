import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

/**
 * Self-contained diagnostics runner.
 *
 * Starts its own Vite dev server (so it never races with an externally managed
 * one), runs the real pipeline on the given photos and prints the measured
 * numbers, then shuts the server down.
 */
const files = process.argv.slice(2);
const PORT = 5250;
const PAGE = `http://127.0.0.1:${PORT}/dev/diag.html`;

function waitForPort(port, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error('dev server did not start'));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const server = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
  stdio: 'ignore',
  shell: true,
  cwd: process.cwd(),
});

let browser;
try {
  await waitForPort(PORT);
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console]', m.text());
  });

  await page.goto(PAGE, { waitUntil: 'networkidle' });

  for (const file of files) {
    const buffer = readFileSync(file);
    const name = path.basename(file);
    const ext = path.extname(file).slice(1).toLowerCase() || 'jpg';
    await page.setInputFiles('#file', {
      name,
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
      buffer,
    });

    let text = '';
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(2000);
      text = await page.locator('#log').innerText();
      if (text.includes('done') || text.includes('ERROR')) break;
    }
    console.log(`\n================ ${name} ================`);
    console.log(text);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
