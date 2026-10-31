import { execSync } from 'node:child_process';

/**
 * Ensures a fresh production bundle exists before the suite runs: the
 * Playwright `webServer` only serves `dist/`, so a stale or missing build
 * would silently test old code.
 */
export default function globalSetup(): void {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      execSync('npx vite build', { stdio: 'inherit', timeout: 600_000 });
      return;
    } catch (error) {
      console.error(`vite build attempt ${attempt} failed`, error);
      if (attempt === 3) throw error;
    }
  }
}
