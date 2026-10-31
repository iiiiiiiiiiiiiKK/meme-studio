# Meme Studio — Troubleshooting

## The local AI engine will not start

**Symptom:** the toast says *“Local AI engine failed to start”*.

1. Check **Settings → Local AI engine**. It shows the backend that was selected.
2. The app tries **WebGL** first, then **WASM**. If both fail, the engine cannot start at all.
3. Make sure hardware acceleration is enabled in your browser settings.
4. Private/incognito windows sometimes block WebGL — use a normal window.
5. If the model files 404, the deploy is missing `dist/models/`. See [DEPLOYMENT.md](DEPLOYMENT.md).

## The matte says “Colour fallback matte”

The neural matte could not run (or came back empty), so the app fell back to a colour-key matte. This is **approximate** and the
app says so on purpose. Common causes:

- a very busy background (the fallback refuses to guess and keeps the whole image),
- WebGL/WASM memory pressure on a large image,
- a corrupted or blocked model file.

Try a smaller image, or reload the page so the model cache is fresh.

## No face was detected

The image may contain no face, or the face may be too small (< ~40 px), blurred, heavily backlit or partly covered.
Try:

- a higher-resolution source,
- a clearer, front-facing subject,
- the **Background** or **Full person** mode, which do not need a face.

If a face *was* detected but the cut looks wrong, switch to the **Mask** tab and use the erase/restore brush.

## The outline looks blocky

The stroke follows the alpha mask, so a soft or noisy matte produces a soft or noisy stroke. Fix the matte first
(more feather, more edge smooth), then adjust the outline thickness.

## The exported PNG has a grey/checked background

It does not — the checkerboard is a preview device. If you exported with **JPEG** or with a solid background
selected, the transparency is gone by choice. For transparency use **PNG** (or WebP) and keep *Transparent background*
enabled.

## The app is blank after deploying

- The bundle uses `base: './'`; if you changed it, the asset paths break on sub-paths.
- Serve the `dist/` folder, not the repository root.
- Check the browser console for a 404 on `assets/index-*.js`.

## "Local storage is unavailable"

The browser blocked IndexedDB (private mode, strict privacy policy, or a disabled storage API). The app keeps
working, but nothing can be saved. The library, projects and presets are stored per browser profile.

## My project disappeared

Projects live in the IndexedDB of the browser profile that created them. Clearing site data, using a different
browser, or switching profiles makes them inaccessible. There is **no cloud backup** in this release.

## Batch processing is slow

Each item runs the full detection + matte pipeline. Reduce the number of parallel workers to 1 on low-memory
devices, and downscale very large source images before importing them.

## The X author link

The author link in the header, the sidebar and Settings points to <https://x.com/0xkillcoin>.
