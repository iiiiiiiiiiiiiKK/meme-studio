import { describe, expect, it } from 'vitest';
import { computeStrokeLayers, renderOutlined, visibleBounds, hexToRgba } from '../src/lib/outline';
import { DEFAULT_OUTLINE } from '../src/types';
import { createCanvas, ctx2d } from '../src/lib/image';

function discCanvas(size = 64, radius = 20): { canvas: HTMLCanvasElement; alpha: Uint8ClampedArray } {
  const canvas = createCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  const data = ctx.getImageData(0, 0, size, size).data;
  const alpha = new Uint8ClampedArray(size * size);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data[p];
  return { canvas, alpha };
}

describe('outline rendering', () => {
  it('hexToRgba parses short and long hex', () => {
    expect(hexToRgba('#fff')).toEqual([255, 255, 255, 255]);
    expect(hexToRgba('#000000')).toEqual([0, 0, 0, 255]);
    expect(hexToRgba('nope')).toEqual([255, 255, 255, 255]);
  });

  it('returns no layers when the outline is disabled', () => {
    const { alpha } = discCanvas();
    expect(computeStrokeLayers(alpha, 64, 64, { ...DEFAULT_OUTLINE, enabled: false })).toHaveLength(0);
  });

  it('creates two layers for a double outline', () => {
    const { alpha } = discCanvas();
    const layers = computeStrokeLayers(alpha, 64, 64, {
      ...DEFAULT_OUTLINE,
      enabled: true,
      layers: 2,
      thickness: 6,
      secondThickness: 4,
    });
    expect(layers).toHaveLength(2);
    // the outer ring must cover more pixels than the inner ring
    const area = (m: Uint8ClampedArray) => m.reduce((sum, v) => sum + (v > 127 ? 1 : 0), 0);
    expect(area(layers[0].alpha)).toBeGreaterThan(area(layers[1].alpha));
  });

  it('paints an outline outside the subject and keeps the subject opaque', () => {
    const { canvas, alpha } = discCanvas(64, 18);
    const result = renderOutlined(canvas, alpha, { ...DEFAULT_OUTLINE, enabled: true, thickness: 6, shadow: false, glow: false });
    const ctx = ctx2d(result);
    const data = ctx.getImageData(0, 0, result.width, result.height).data;
    const centre = ((result.height / 2) | 0) * result.width + ((result.width / 2) | 0);
    expect(data[centre * 4 + 3]).toBe(255);
    // The trimmed result must be larger than the subject because of the outline.
    expect(result.width).toBeGreaterThan(36);
    // Corner pixels stay transparent: no baked checkerboard, no opaque box.
    expect(data[3]).toBe(0);
  });

  it('visibleBounds trims to the drawn area', () => {
    const { alpha } = discCanvas(64, 10);
    const bounds = visibleBounds(alpha, 64, 64, 0);
    expect(bounds.width).toBeLessThan(64);
    expect(bounds.height).toBeLessThan(64);
    expect(bounds.x).toBeGreaterThan(20);
  });

  it('a fully transparent mask keeps the canvas size instead of crashing', () => {
    const canvas = createCanvas(16, 16);
    ctx2d(canvas).clearRect(0, 0, 16, 16);
    const alpha = new Uint8ClampedArray(16 * 16);
    const bounds = visibleBounds(alpha, 16, 16, 0);
    expect(bounds).toEqual({ x: 0, y: 0, width: 16, height: 16 });
  });
});
