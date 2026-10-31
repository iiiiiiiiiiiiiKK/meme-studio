import { describe, expect, it } from 'vitest';
import {
  blurMask,
  dilateMask,
  distanceTransform,
  erodeMask,
  extractAlpha,
  multiplyMasks,
  removeSpecks,
  smoothstep,
  buildRegionMask,
} from '../src/lib/mask';
import { createCanvas, ctx2d } from '../src/lib/image';

function circleMask(size: number, radius: number): { mask: Uint8ClampedArray; width: number; height: number } {
  const width = size;
  const height = size;
  const mask = new Uint8ClampedArray(width * height);
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      mask[y * width + x] = d <= radius ? 255 : 0;
    }
  }
  return { mask, width, height };
}

function countAbove(mask: Uint8ClampedArray, threshold = 127): number {
  let n = 0;
  for (const v of mask) if (v > threshold) n++;
  return n;
}

describe('mask primitives', () => {
  it('builds a circular mask with the expected area', () => {
    const { mask } = circleMask(64, 20);
    const on = countAbove(mask);
    // πr² ≈ 1257, allow a wide tolerance for rasterisation
    expect(on).toBeGreaterThan(1150);
    expect(on).toBeLessThan(1400);
  });

  it('dilate grows the mask and erode shrinks it', () => {
    const { mask, width, height } = circleMask(64, 16);
    const grown = dilateMask(mask, width, height, 4);
    const shrunk = erodeMask(mask, width, height, 4);
    expect(countAbove(grown)).toBeGreaterThan(countAbove(mask));
    expect(countAbove(shrunk)).toBeLessThan(countAbove(mask));
  });

  it('distance transform is zero inside the shape', () => {
    const { mask, width, height } = circleMask(32, 10);
    const dist = distanceTransform(mask, width, height);
    expect(dist[16 * width + 16]).toBe(0);
    expect(dist[0]).toBeGreaterThan(0);
  });

  it('blur softens the hard edge without changing the mask size', () => {
    const { mask, width, height } = circleMask(48, 12);
    const blurred = blurMask(mask, width, height, 3);
    expect(blurred.length).toBe(mask.length);
    const partial = [...blurred].filter((v) => v > 5 && v < 250).length;
    expect(partial).toBeGreaterThan(0);
  });

  it('multiplies two masks pixel-wise', () => {
    const a = new Uint8ClampedArray([255, 255, 0, 128]);
    const b = new Uint8ClampedArray([255, 0, 255, 128]);
    const out = multiplyMasks(a, b);
    expect([...out]).toEqual([255, 0, 0, 64]);
  });

  it('removes isolated specks but keeps the main blob', () => {
    const size = 40;
    const mask = new Uint8ClampedArray(size * size);
    // main blob 10×10
    for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) mask[y * size + x] = 255;
    // single speck
    mask[30 * size + 30] = 255;
    const cleaned = removeSpecks(mask, size, size, 12);
    expect(cleaned[30 * size + 30]).toBe(0);
    expect(cleaned[10 * size + 10]).toBe(255);
  });

  it('smoothstep clamps to 0..1', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 5);
    expect(smoothstep(2)).toBe(1);
  });

  it('keeps head regions anchored to the face box', () => {
    const width = 200;
    const height = 300;
    const head = buildRegionMask(width, height, { x: 60, y: 60, width: 80, height: 80 }, 'head');
    const shoulders = buildRegionMask(width, height, { x: 60, y: 60, width: 80, height: 80 }, 'head-shoulders');
    const headArea = countAbove(head);
    const shoulderArea = countAbove(shoulders);
    expect(headArea).toBeGreaterThan(0);
    expect(shoulderArea).toBeGreaterThan(headArea);
    // background mode keeps everything
    const full = buildRegionMask(width, height, { x: 60, y: 60, width: 80, height: 80 }, 'background');
    expect(countAbove(full)).toBe(width * height);
  });
});

describe('canvas alpha helpers', () => {
  it('extracts an alpha channel of the right length', () => {
    const canvas = createCanvas(10, 6);
    const ctx = ctx2d(canvas);
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillRect(0, 0, 10, 3);
    const alpha = extractAlpha(canvas);
    expect(alpha.length).toBe(60);
    expect(alpha[0]).toBeGreaterThan(100);
    expect(alpha[59]).toBe(0);
  });
});
