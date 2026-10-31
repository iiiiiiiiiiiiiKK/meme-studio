import { execSync } from 'node:child_process';

/** Frees the preview port so the Playwright `webServer` can bind it cleanly. */
export default function globalTeardown(): void {
  try {
    execSync(
      'powershell -NoProfile -Command "foreach ($p in (Get-NetTCPConnection -State Listen -LocalPort 4288 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique) { try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch {} }"',
      { stdio: 'inherit', timeout: 30_000 },
    );
  } catch (error) {
    console.error('globalTeardown: port cleanup failed', error);
  }
}