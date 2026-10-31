import { describe, expect, it } from 'vitest';
import { runCutout } from '../src/lib/cutout';
import { createCanvas, ctx2d } from '../src/lib/image';
import { DEFAULT_OUTLINE, type FaceDetection } from '../src/types';

/** Builds a photo-like canvas: subject disc on a light background. */
function scene(size = 120): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#e9eef5';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.42, size * 0.16, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.85, size * 0.32, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function alphaFromCanvas(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const data = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data[p];
  return alpha;
}

function fakeFace(size: number): FaceDetection {
  const boxW = size * 0.32;
  const boxH = size * 0.4;
  const x = size / 2 - boxW / 2;
  const y = size * 0.22;
  return {
    index: 0,
    box: [x, y, boxW, boxH],
    score: 0.98,
    mesh: [],
    oval: [],
  };
}

describe('cutout pipeline', () => {
  const canvas = scene();
  const personAlpha = new Uint8ClampedArray(canvas.width * canvas.height).fill(255);

  it('background mode keeps the full silhouette', () => {
    const result = runCutout({
      source: canvas,
      personAlpha,
      faces: [],
      options: { mode: 'background', faceIndex: 0, feather: 0, expand: 0, edgeSmooth: 0, outline: { ...DEFAULT_OUTLINE, enabled: false } },
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.width).toBeGreaterThan(80);
  });

  it('head mode crops tighter than head+shoulders', () => {
    const face = fakeFace(canvas.width);
    const base = { faceIndex: 0, feather: 0, expand: 0, edgeSmooth: 0, outline: { ...DEFAULT_OUTLINE, enabled: false } };
    const head = runCutout({ source: canvas, personAlpha, faces: [face], options: { ...base, mode: 'head' } });
    const shoulders = runCutout({
      source: canvas,
      personAlpha,
      faces: [face],
      options: { ...base, mode: 'head-shoulders' },
    });
    expect(head.height).toBeLessThan(shoulders.height);
  });

  it('warns instead of silently producing a head crop when no face exists', () => {
    const result = runCutout({
      source: canvas,
      personAlpha,
      faces: [],
      options: { mode: 'head', faceIndex: 0, feather: 0, expand: 0, edgeSmooth: 0, outline: { ...DEFAULT_OUTLINE, enabled: false } },
    });
    expect(result.warnings.join(' ')).toMatch(/No face/i);
  });

  it('keeps genuine transparency in the output', () => {
    const face = fakeFace(canvas.width);
    const result = runCutout({
      source: canvas,
      personAlpha,
      faces: [face],
      options: { mode: 'head', faceIndex: 0, feather: 0.5, expand: 0, edgeSmooth: 0, outline: { ...DEFAULT_OUTLINE, enabled: false } },
    });
    const ctx = ctx2d(result.canvas);
    const data = ctx.getImageData(0, 0, result.canvas.width, result.canvas.height).data;
    let transparent = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] === 0) transparent++;
    expect(transparent).toBeGreaterThan(0);
    expect(transparent).toBeLessThan(data.length / 4);
  });

  it('a mask that selects nothing falls back to the original image with a warning', () => {
    const empty = new Uint8ClampedArray(canvas.width * canvas.height);
    const result = runCutout({
      source: canvas,
      personAlpha: empty,
      faces: [],
      options: { mode: 'background', faceIndex: 0, feather: 0, expand: 0, edgeSmooth: 0, outline: { ...DEFAULT_OUTLINE, enabled: false } },
    });
    expect(result.warnings.join(' ')).toMatch(/empty mask/i);
    expect(alphaFromCanvas(result.canvas).some((a) => a > 0)).toBe(true);
  });
});
