/**
 * Development-only diagnostics page.
 *
 * It runs the *real* production pipeline (detection → matte → region → cutout)
 * on a user-supplied photo and prints hard numbers, so the quality of the
 * algorithm can be measured instead of guessed. This file is not part of the
 * production bundle: `vite build` only emits `index.html`.
 */
import { decodeToCanvas, ctx2d } from '../src/lib/image';
import { detectAll, personAlpha } from '../src/lib/ai';
import { runCutout } from '../src/lib/cutout';
import { extractAlpha } from '../src/lib/mask';
import { DEFAULT_OUTLINE } from '../src/types';
import type { CutMode } from '../src/types';
const fileInput = document.getElementById('file') as HTMLInputElement;
const log = document.getElementById('log') as HTMLPreElement;
const outCanvas = document.getElementById('out') as HTMLCanvasElement;
const alphaCanvas = document.getElementById('alpha') as HTMLCanvasElement;
const maskCanvas = document.getElementById('mask') as HTMLCanvasElement;

const lines: string[] = [];
function say(text: string): void {
  lines.push(text);
  log.textContent = lines.join('\n');
}

function stats(alpha: Uint8ClampedArray): { coverage: number; mean: number; partial: number } {
  let on = 0;
  let partial = 0;
  let sum = 0;
  for (const v of alpha) {
    sum += v;
    if (v > 200) on++;
    else if (v > 20) partial++;
  }
  return { coverage: on / alpha.length, mean: sum / alpha.length / 255, partial: partial / alpha.length };
}

/** Fraction of the face-oval pixels that survive the mask. */
function faceRetention(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  oval: Array<[number, number]>,
): number {
  if (oval.length < 4) return -1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(oval[0][0], oval[0][1]);
  for (const [x, y] of oval.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  const inside = extractAlpha(canvas);
  let total = 0;
  let kept = 0;
  for (let i = 0; i < inside.length; i++) {
    if (inside[i] > 200) {
      total++;
      if (alpha[i] > 128) kept++;
    }
  }
  return total ? kept / total : -1;
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  lines.length = 0;
  say(`file: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);

  try {
    const source = await decodeToCanvas(file, 2048);
    say(`source: ${source.width}×${source.height}`);

    const detect = await detectAll(source, (e) => say(`  · ${e.message}`));
    say(`faces: ${detect.faces.length} · backend ${detect.backend} · ${detect.elapsedMs}ms`);
    detect.faces.forEach((f, i) => {
      say(`  face[${i}] box=[${f.box.map((v) => Math.round(v)).join(',')}] score=${f.score.toFixed(3)} oval=${f.oval.length} mesh=${f.mesh.length}`);
    });

    const matte = await personAlpha(source, (e) => say(`  · ${e.message}`));
    say(`matte: ${matte.source} · ${matte.elapsedMs}ms`);
    say(`  raw: ${JSON.stringify(matte.raw)}`);
    say(`  note: ${matte.note ?? '-'}`);
    const s = stats(matte.alpha);
    say(`  coverage=${(s.coverage * 100).toFixed(1)}% mean=${(s.mean * 100).toFixed(1)}% partial=${(s.partial * 100).toFixed(1)}%`);

    // Draw the matte for a visual sanity check.
    const ac = ctx2d(alphaCanvas);
    const img = ac.createImageData(source.width, source.height);
    for (let i = 0, p = 0; i < matte.alpha.length; i++, p += 4) {
      img.data[p] = img.data[p + 1] = img.data[p + 2] = matte.alpha[i];
      img.data[p + 3] = 255;
    }
    ac.putImageData(img, 0, 0);

    const modes: CutMode[] = ['face', 'head', 'head-neck', 'head-shoulders', 'upper-body', 'full', 'background'];
    for (const mode of modes) {
      const t0 = performance.now();
      const result = runCutout({
        source,
        personAlpha: matte.alpha,
        faces: detect.faces,
        options: { mode, faceIndex: 0, feather: 0.6, expand: 0, edgeSmooth: 0.4, outline: DEFAULT_OUTLINE },
      });
      const ms = Math.round(performance.now() - t0);
      const rs = stats(result.alpha);
      // Retention is measured on the *source-resolution* mask, because the
      // trimmed sticker has its own coordinate system.
      const retention = detect.faces[0] ? faceRetention(result.mask, source.width, source.height, detect.faces[0].oval) : -1;
      say(
        `${mode.padEnd(15)} ${String(result.width).padStart(4)}×${String(result.height).padStart(4)}` +
          `  coverage=${(rs.coverage * 100).toFixed(1).padStart(5)}%` +
          `  faceKept=${(retention * 100).toFixed(1).padStart(5)}%` +
          `  ${ms}ms` +
          (result.warnings.length ? `  ⚠ ${result.warnings.join(' | ')}` : ''),
      );
      if (mode === 'head') {
        const mc = ctx2d(maskCanvas);
        mc.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        mc.drawImage(result.canvas, 0, 0, maskCanvas.width, maskCanvas.height);
        const oc = ctx2d(outCanvas);
        oc.clearRect(0, 0, outCanvas.width, outCanvas.height);
        oc.drawImage(source, 0, 0, outCanvas.width, outCanvas.height);
      }
    }
    say('done');
  } catch (error) {
    say(`ERROR: ${error instanceof Error ? error.stack : String(error)}`);
  }
});
