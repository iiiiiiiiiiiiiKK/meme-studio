# Meme Studio — Deployment guide

Meme Studio is a **pure static single-page application**. There is no server, no database and no environment variable. Deployment is "upload `dist/`".

## 1. Build

```bash
npm ci
npm run build      # runs the type check first, then vite build
```

The output is in `dist/`:

```
dist/
  index.html
  assets/*.css
  assets/*.js
  models/rvm.bin, rvm.json, blazeface.*, facemesh.*
```

`vite.config.ts` sets `base: './'`, so the bundle uses relative paths and works from a domain root **and** from a sub-path such as `https://user.github.io/repo/`.

## 2. GitHub Pages (recommended, used by this project)

The repository contains `.github/workflows/deploy.yml`:

1. Push to `main`.
2. The workflow installs dependencies, type-checks, runs the unit tests, builds `dist/` and publishes it to GitHub Pages.
3. Enable **Settings → Pages → Source: GitHub Actions** once for the repository.

Live URL: <https://iiiiiiiiiiiiiKK.github.io/meme-studio/>

Manual alternative:

```bash
npm run build
# publish the ./dist folder with any static host
```

## 3. Any other static host

| Host | Build command | Publish directory |
| --- | --- | --- |
| Netlify | `npm run build` | `dist` |
| Vercel | `npm run build` | `dist` |
| Cloudflare Pages | `npm run build` | `dist` |
| Nginx / Apache | — | copy `dist/` into the web root |

No rewrite rules are needed: the app uses hash routing (`/#/create`), so every path resolves to `index.html`.

## 4. Service worker / offline notes

The app has **no service worker** in this release. The model files are cached by the browser's HTTP cache, and the local library lives in IndexedDB, but a full offline PWA experience requires adding a service worker — see the roadmap in [ARCHITECTURE.md](ARCHITECTURE.md).

To serve the app offline today, download the whole `dist/` folder and open `index.html` from disk — but note that `file://` origins restrict some browser APIs (IndexedDB works, clipboard access does not).

## 5. Model hosting

The three model files live in `public/models/` and are copied into `dist/models/` at build time. Total size: **~6.2 MB**.

They are served from the same origin as the app, so no cross-origin issues arise and the browser caches them after the first load.

If you would rather load them from a CDN, point `modelBasePath` in `src/lib/ai.ts` at that URL:

```ts
const MODEL_BASE = 'https://your-cdn.example/models/';
```

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Local AI engine failed to start" | WebGL and WASM both unavailable | Enable hardware acceleration, or accept the labelled colour fallback |
| Models 404 after deploy | `public/models` was not copied | Ensure the build ran after the models were added; `dist/models` must exist |
| Blank page, no assets load | The site is served from a sub-path without `base: './'` | Keep `base: './'` in `vite.config.ts` |
| "Local storage is unavailable" toast | Browser blocked IndexedDB (private mode, strict policy) | Use a normal window; the app keeps working but cannot save |
| Engine status stays "Loading" | The model download is slow | Wait; the download is cached afterwards |
