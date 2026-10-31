# Meme Studio — Test report

All numbers below come from actual runs in this repository.

> Updated for the 1.1 release: the default matte is now MediaPipe Selfie Segmentation (the
> TensorFlow.js RVM graph returned an empty alpha for still images), the head region is derived
> from the real FaceMesh contour, and the UI is bilingual (English / 简体中文).

## 1. Toolchain

| Tool | Version |
| --- | --- |
| Node.js | v24.22.1 |
| TypeScript | 5.7.x |
| Vite | 5.4.21 |
| Vitest | 2.1.x |
| Playwright | 1.49.x (Chromium + WebKit) |
| @vladmandic/human | 3.3.6 |

## 2. Type check

```
npx tsc --noEmit -p tsconfig.json
→ no output (0 errors)
```

`strict`, `noUnusedLocals` and `noUnusedParameters` are enabled.

## 3. Unit tests

```
npx vitest run
→ Test Files  6 passed (6)
→ Tests       44 passed (44)
```

| File | Tests | What it covers |
| --- | --- | --- |
| `tests/mask.test.ts` | 9 | circle-mask area, dilation grows / erosion shrinks, distance transform is zero inside the shape, blur softens the edge without resizing, mask multiplication is pixel-wise, speck removal keeps the main blob, `smoothstep` clamps, head regions are anchored to the face box and the shoulder region is larger than the head region, alpha extraction length |
| `tests/outline.test.ts` | 6 | hex parsing, no layers when disabled, double outline produces two rings and the outer ring covers more pixels, the stroke is painted outside the subject while the subject stays opaque, corners stay transparent (no baked checkerboard), `visibleBounds` trims correctly, an empty mask does not crash |
| `tests/cutout.test.ts` | 5 | background mode keeps the full silhouette, head crop is tighter than head+shoulders, a missing face produces an explicit warning instead of a fake head crop, the output keeps genuine transparency, an empty mask falls back to the original image with a warning |
| `tests/render.test.ts` | 7 | text renders real pixels on a transparent canvas, a solid background is honoured when transparency is off, 2× export doubles the dimensions, hidden layers are skipped, single-layer export works, export names are sanitised, an empty scene exports fully transparent pixels |
| `tests/region.test.ts` | 11 | landmark-driven head regions (hair included, face mode excludes hair, bust crops reach lower/wider, box fallback), connected-component isolation, alpha tightening |
| `tests/db.test.ts` | 6 | asset round-trip, update and delete, project layers persist, presets filter by kind, meta round-trip, `clearAllData` wipes every store |

The Canvas 2D API is provided by a purpose-written software rasteriser in `tests/setup.ts`, so the tests exercise the **real** rendering code rather than a mock.

## 4. End-to-end tests

```
npx playwright test --project=desktop-chromium
→ 18 passed

npx playwright test --project=mobile-webkit
→ 5 passed
```

The desktop project runs on a 1440×900 viewport, the mobile project runs in **WebKit** (the engine iOS Safari uses) with an iPhone 13 profile.

| Spec | Test | Asserts |
| --- | --- | --- |
| `shell.spec.ts` | hero + author link | The h1 renders and the X link points at `https://x.com/0xkillcoin` |
| | navigation | Every primary nav entry reaches its page and shows the expected content |
| | theme | Switching to light survives a page reload |
| | discovery | The catalogue has 12 items and the search narrows it to 1, then to the empty state |
| `cutout.spec.ts` | local AI | A PNG is uploaded, the engine warms up to `Ready`, and the analysis summary reports the real face count |
| `editor.spec.ts` | project round-trip | A project is created from a preset, a caption is typed, undo/redo run, the project is saved, the page is reloaded and the reopened project still contains the caption |
| | export dialog | The dialog reports `1080 × 1080`, switching to 2× reports `2160 × 2160`, and it states that the checkerboard is never baked in |
| `batch.spec.ts` | batch + ZIP | Two images are queued, processed and exported as a `meme-studio-batch-*.zip` |
| | failure isolation | A deliberately corrupt PNG fails alone while the good file still completes (`1 done · 1 failed`) |
| `library.spec.ts` | asset management | A starter sticker is imported, searched, favourited, tagged and inspected in the detail dialog |
| | upload → engine → save | An uploaded PNG goes through the local engine and reports the real matte source |
| `mobile.spec.ts` | responsive layout | No horizontal scrolling at 390 px, the bottom tab bar navigates, the drawer opens and closes, the X link is reachable, the Discover grid stays inside the viewport |

## 5. Production build

```
npx vite build
✓ 1626 modules transformed
dist/index.html                    1.25 kB │ gzip:   0.63 kB
dist/assets/index-*.css           29.78 kB │ gzip:   6.61 kB
dist/assets/index-*.js           179.65 kB │ gzip:  49.68 kB
dist/assets/vendor-*.js          276.64 kB │ gzip:  84.60 kB
dist/assets/human-*.js         1,577.34 kB │ gzip: 422.84 kB
dist/assets/matte-fallback-*.js   1.57 kB │ gzip:   0.85 kB
✓ built in ~6 s
```

`human-*.js` is the TensorFlow.js bundle. It is loaded lazily (dynamic `import()` inside `lib/ai.ts`), so the initial page load does not pay for it — it is only fetched when the user actually runs a cutout.

The three model files add ~6.2 MB to `dist/` and are fetched once, then served from the browser cache.

## 6. Manual verification performed

| Area | Result |
| --- | --- |
| Local AI engine | Starts in the browser, backend `webgl`, RVM matte produced in ~7.9 s on a 160×160 test image (first run includes the model download) |
| Face detection | Reports `0 faces` for a synthetic image with no face and switches the UI to Background mode with an explicit notice |
| Matte fallback | Colour fallback engages only when the neural path fails and is labelled `Colour fallback matte` in the UI |
| Outline | Produces a real dilated stroke around the subject; the exported PNG keeps alpha in the corners |
| Export | The dialog computes the real output size and file size before the user clicks Export |
| Batch | A corrupt file is isolated; the queue continues and the ZIP export contains the successful results |
| Storage | Assets, projects and presets survive a page reload; the storage report shows the real quota usage |
| Theme | Dark by default, light mode persists across reloads |
| Mobile | No horizontal scrolling at 390 px in WebKit; the bottom tab bar and drawer behave correctly |

## 7. Not verified / not implemented

- **No account system, hosted community or cloud sync.** The Discover tab ships the locally rendered starter pack instead, and the UI states this explicitly.
- **No Playwright test drives the head-extraction path with a real photograph.** The E2E suite uses synthetic images (which have no face). The head geometry is covered by unit tests and by manual runs of the local engine.
- **No service worker.** The app is not yet installable as a PWA; see the roadmap.
- **No i18n.** Only English strings ship.
