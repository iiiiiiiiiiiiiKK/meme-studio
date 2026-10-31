# Meme Studio — Architecture

This document describes how Meme Studio is put together and, more importantly, **why** each piece exists.

## 1. Design goals

1. **Local first.** A user without an API key, without an account and without a network connection must be able to import an image, cut a head, add an outline, compose a meme, batch-process a folder and save the result.
2. **Honest state.** Every stage of the pipeline reports what actually happened. When a neural model fails, the fallback says so; when no face is found, the app says so instead of cropping a rectangle.
3. **Non-destructive.** Originals, masks, cutouts and exports are separate artefacts with independent lifecycles.
4. **No backend.** A static host is a complete deployment target.

## 2. Runtime topology

```
┌──────────────────────── browser tab ─────────────────────────┐
│                                                                │
│  React 18 + Zustand  ─────────────►  pages/                   │
│        │                                                       │
│        ├──────────────► lib/ai.ts  ──► @vladmandic/human      │
│        │                     │            (TensorFlow.js)     │
│        │                     └──► public/models/*.json|bin    │
│        │                          (BlazeFace · FaceMesh · RVM)│
│        │                                                       │
│        ├──────────────► lib/mask.ts    (alpha maths)           │
│        ├──────────────► lib/outline.ts (stroke generation)     │
│        ├──────────────► lib/cutout.ts  (pipeline)              │
│        ├──────────────► lib/render.ts  (scene → PNG/JPEG/WebP) │
│        │                                                       │
│        └──────────────► lib/db.ts ──► IndexedDB (assets,      │
│                                         projects, presets)     │
└────────────────────────────────────────────────────────────────┘
```

Nothing in this diagram talks to a third-party service.

## 3. The cutout pipeline

`src/lib/cutout.ts` is the heart of the product.

```
source canvas ──┐
                 ├─► RVM ──► person alpha (source resolution)
face mesh ───────┘                  │
                                    ▼
                            ┌───────────────────────┐
                            │ head region mask      │  built from face geometry
                            │ (super-ellipse, wide  │  (never used as the final
                            │  for shoulder crops)  │   mask on its own)
                            └───────────┬───────────┘
                                        ▼
                     intersection  ──►  person alpha  ∧  region
                                        │
                                        ▼
                        feather / expand / edge-smooth
                        (blur, dilate, erode, distance transform)
                                        │
                                        ▼
                            subject alpha + trimmed canvas
                                        │
                                        ▼
              outline layers (dilated alpha, painted under the subject)
                                        │
                                        ▼
                              final PNG with real alpha
```

### Module contracts

| Module | Responsibility | Must not |
| --- | --- | --- |
| `lib/ai.ts` | Load the engine, detect faces, produce the person matte | Know anything about masks or outlines |
| `lib/mask.ts` | Pure alpha maths (blur, dilate, erode, distance transform, regions) | Touch the DOM beyond `ImageData` |
| `lib/outline.ts` | Turn an alpha mask into painted stroke layers and a trimmed canvas | Modify the subject pixels |
| `lib/cutout.ts` | Orchestrate the above into a `CutoutResult` | Perform I/O |
| `lib/render.ts` | Draw a layer stack onto a canvas at a given scale | Decide what the layers mean |

### Why the region mask is intersected with the matte

A face box is a *bounding box*. Using it as a mask produces the classic "rectangular sticker" result. Here the region only selects **which portion of the real silhouette** survives, so:

- hair above the eye line stays because the matte says it is foreground,
- the shoulder boundary follows the actual body edge,
- ears and stray hair are shaped by the segmentation, not by a rectangle.

`Face only` uses the FaceMesh oval directly (still intersected with the matte).

## 4. Outline generation

`lib/outline.ts`:

1. `distanceTransform(mask)` → per-pixel distance to the nearest foreground pixel.
2. `dilateMask(mask, r)` → a silhouette grown by `r` pixels with a soft edge.
3. Stroke layers are painted **from the outside in**: optional outer ring, main stroke, optional inner stroke, then shadow and glow, and finally the untouched subject on top.

Because the subject is drawn last, an outline never eats into the person, and because the growth is a true dilation, the stroke follows hair and ears.

## 5. State management

Three Zustand stores:

| Store | Responsibility |
| --- | --- |
| `state/ui.ts` | Route, theme, toasts, engine status, author identity |
| `state/library.ts` | Assets, projects, presets, filters, selection, storage usage |
| `state/editor.ts` | Layers, canvas settings, selection, undo/redo history, view transform |

The editor keeps a bounded undo history (40 snapshots) and an autosave timer (15 s) that writes the project into IndexedDB.

## 6. Storage

IndexedDB (`lib/db.ts`, via `idb`) with four stores:

| Store | Key | Contents |
| --- | --- | --- |
| `assets` | `id` | Blob + thumbnail + metadata + tags + soft-delete flag |
| `projects` | `id` | Layer stack, canvas settings, thumbnail |
| `presets` | `id` | Parameter snapshots |
| `meta` | `key` | Small key/value settings (theme, onboarding flags) |

Large binary data is stored as `Blob`s, never base64 strings.

## 7. Rendering and export

`lib/render.ts` renders the layer stack with the Canvas 2D API:

- image layers draw their bitmap, text layers support alignment, stroke, letter spacing, line height and uppercase, shape layers support rounded rectangles and ellipses,
- the export honours `transparent`, `scale` (1×/2×/3×) and the target format,
- **the transparency checkerboard is a preview-only device** — it is never painted into the exported bitmap.

## 8. Failure modes and how they are surfaced

| Failure | Behaviour |
| --- | --- |
| WebGL unavailable | Falls back to the WASM backend; the backend name is shown in the UI |
| Both backends unavailable | The colour matte is used and the result is labelled `Colour fallback matte` |
| RVM returns nothing | The colour matte is used and a warning toast explains why |
| No face detected | Head modes are disabled, the app says so, and the person silhouette is kept for the background mode |
| Empty mask after intersection | The original image is returned with an explicit warning |
| Batch item fails | The item is marked `failed` with its real error; the batch continues |
| IndexedDB unavailable | A toast explains that the browser blocked storage and nothing can be saved |

## 9. Testing strategy

- **Unit tests (`tests/`)** cover the pure logic: mask primitives, outline composition, cutout geometry, scene rendering, storage round-trips. A lightweight Canvas 2D shim (`tests/setup.ts`) lets the real rendering code run under jsdom.
- **End-to-end tests (`e2e/`)** drive the production build in Chromium (desktop) and WebKit (iPhone 13 profile) and assert on real user-visible outcomes — including that a deliberately broken batch file does not stop the rest of the batch.

## 10. Roadmap (not implemented in this release)

- Account system, hosted community, publications and follows.
- Cloud sync with conflict resolution.
- Additional local models (SAM-style segmentation for non-person subjects, pose estimation for body crops).
- Web Worker / OffscreenCanvas pipeline so large batches do not block the UI thread.
