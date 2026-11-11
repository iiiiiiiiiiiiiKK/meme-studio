import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createCanvas, ctx2d, decodeToCanvas, ImageTooLargeError } from '../src/lib/image';
import { computeStrokeLayers, paddedBounds, renderOutlined, visibleBounds } from '../src/lib/outline';
import { renderSingleLayer, formatSupportsAlpha } from '../src/lib/render';
import { assetUrl, assetUrlCacheSize, peekAssetUrl, releaseAllAssetUrls, releaseAssetUrl } from '../src/lib/assetUrls';
import { hydrateProjectLayers } from '../src/lib/hydrate';
import { clearAllData, saveAsset, type StoredAsset } from '../src/lib/db';
import { DEFAULT_OUTLINE, type CanvasSettings, type Layer } from '../src/types';

function disc(size = 64, radius = 20): { canvas: HTMLCanvasElement; alpha: Uint8ClampedArray } {
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

function pixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const d = ctx2d(canvas).getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

afterEach(() => {
  releaseAllAssetUrls();
});

describe('paddedBounds', () => {
  it('may grow past the source canvas so edge strokes are not clipped', () => {
    const alpha = new Uint8ClampedArray(40 * 40);
    // A subject that touches the top-left corner.
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) alpha[y * 40 + x] = 255;
    const plain = visibleBounds(alpha, 40, 40, 8);
    const padded = paddedBounds(alpha, 40, 40, 8);
    expect(plain.x).toBe(0);
    expect(padded.x).toBe(-8);
    expect(padded.y).toBe(-8);
    expect(padded.width).toBeGreaterThan(plain.width);
  });

  it('keeps clamps for the empty-mask case', () => {
    const alpha = new Uint8ClampedArray(20 * 20);
    expect(paddedBounds(alpha, 20, 20, 6)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
});

describe('outline compositing', () => {
  it('paints the inner stroke on top of the subject instead of hiding it', () => {
    const { canvas, alpha } = disc(64, 22);
    const plain = renderOutlined(canvas, alpha, {
      ...DEFAULT_OUTLINE,
      enabled: true,
      thickness: 0,
      inner: 0,
      shadow: false,
      glow: false,
    });
    const inner = renderOutlined(canvas, alpha, {
      ...DEFAULT_OUTLINE,
      enabled: true,
      thickness: 0,
      inner: 6,
      color: '#00ff00',
      shadow: false,
      glow: false,
    });
    // Count pixels that are the stroke colour rather than the red subject.
    const greenPixels = (target: HTMLCanvasElement): number => {
      const data = ctx2d(target).getImageData(0, 0, target.width, target.height).data;
      let n = 0;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p + 1] > 180 && data[p] < 80 && data[p + 3] > 180) n++;
      }
      return n;
    };
    // With no inner stroke there is no green at all; with one, the ring must be
    // visible on top of the opaque subject (the old code drew it underneath).
    expect(greenPixels(plain.canvas)).toBe(0);
    expect(greenPixels(inner.canvas)).toBeGreaterThan(0);
    // The subject centre must still be opaque and unchanged.
    const centre = pixel(inner.canvas, 32 - inner.offsetX, 32 - inner.offsetY);
    expect(centre[3]).toBe(255);
  });

  it('keeps the subject opaque when only an inner stroke is enabled', () => {
    const { canvas, alpha } = disc(64, 20);
    const inner = renderOutlined(canvas, alpha, {
      ...DEFAULT_OUTLINE,
      enabled: true,
      thickness: 0,
      inner: 5,
      shadow: false,
      glow: false,
    });
    expect(pixel(inner.canvas, 32, 32)[3]).toBe(255);
  });

  it('allocates margin for the glow radius', () => {
    const { canvas, alpha } = disc(48, 10);
    const plain = renderOutlined(canvas, alpha, { ...DEFAULT_OUTLINE, enabled: true, thickness: 2, glow: false, shadow: false });
    const glow = renderOutlined(canvas, alpha, {
      ...DEFAULT_OUTLINE,
      enabled: true,
      thickness: 2,
      glow: true,
      glowColor: '#c6f24e',
      shadow: false,
    });
    expect(glow.width).toBeGreaterThanOrEqual(plain.width);
    expect(glow.height).toBeGreaterThanOrEqual(plain.height);
  });

  it('separates outer and inner stroke layers', () => {
    const { canvas, alpha } = disc(48, 16);
    const layers = computeStrokeLayers(alpha, 48, 48, { ...DEFAULT_OUTLINE, enabled: true, thickness: 4, inner: 4 });
    expect(layers.some((l) => l.inner)).toBe(true);
    expect(layers.some((l) => !l.inner)).toBe(true);
    void canvas;
  });
});

describe('single-layer export', () => {
  const settings: CanvasSettings = { width: 60, height: 60, background: null, grid: false, snap: true };

  function shapeLayer(opacity: number): Layer {
    return {
      id: 's1',
      type: 'shape',
      name: 'Box',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      rotation: 0,
      opacity,
      visible: true,
      locked: false,
      shape: { kind: 'rect', fill: '#ffffff', radius: 0 },
    };
  }

  it('keeps the layer opacity in the exported pixels', async () => {
    const opaque = await renderSingleLayer(shapeLayer(1), settings);
    const half = await renderSingleLayer(shapeLayer(0.5), settings);
    const opaqueAlpha = pixel(opaque, 30, 30)[3];
    const halfAlpha = pixel(half, 30, 30)[3];
    expect(opaqueAlpha).toBe(255);
    expect(halfAlpha).toBeGreaterThan(0);
    expect(halfAlpha).toBeLessThan(opaqueAlpha);
  });

  it('reports alpha support per format', () => {
    expect(formatSupportsAlpha('png')).toBe(true);
    expect(formatSupportsAlpha('webp')).toBe(true);
    expect(formatSupportsAlpha('jpeg')).toBe(false);
  });
});

describe('asset URL ownership', () => {
  it('returns one URL per asset id and rebuilds after release', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const a = assetUrl({ id: 'a1', blob });
    const b = assetUrl({ id: 'a1', blob });
    expect(a).toBe(b);
    expect(peekAssetUrl('a1')).toBe(a);
    releaseAssetUrl('a1');
    expect(peekAssetUrl('a1')).toBeNull();
    expect(assetUrlCacheSize()).toBe(0);
  });
});

describe('project hydration', () => {
  it('rebuilds an image layer source from the stored blob', async () => {
    await clearAllData();
    const now = Date.now();
    const asset: StoredAsset = {
      id: 'asset-1',
      name: 'sticker',
      kind: 'sticker',
      blob: new Blob(['png'], { type: 'image/png' }),
      thumb: new Blob(['thumb'], { type: 'image/webp' }),
      width: 64,
      height: 64,
      size: 3,
      createdAt: now,
      updatedAt: now,
      tags: [],
      favorite: false,
      deleted: false,
      source: 'test',
    };
    await saveAsset(asset);
    const layer: Layer = {
      id: 'l1',
      type: 'image',
      name: 'sticker',
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      image: { src: 'blob:dead-url-from-a-previous-document', naturalWidth: 64, naturalHeight: 64, assetId: 'asset-1' },
    };
    const report = await hydrateProjectLayers([layer]);
    expect(report.missing).toHaveLength(0);
    expect(report.layers[0].image?.src).not.toBe('blob:dead-url-from-a-previous-document');
    expect(report.layers[0].image?.src).toBe(peekAssetUrl('asset-1'));
  });

  it('reports layers whose asset was deleted', async () => {
    await clearAllData();
    const layer: Layer = {
      id: 'l2',
      type: 'image',
      name: 'gone',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      image: { src: 'blob:dead', naturalWidth: 10, naturalHeight: 10, assetId: 'missing-asset' },
    };
    const report = await hydrateProjectLayers([layer]);
    expect(report.missing).toEqual(['gone']);
  });

  it('leaves text layers untouched', async () => {
    const layer: Layer = {
      id: 'l3',
      type: 'text',
      name: 'caption',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: {
        content: 'hi',
        fontSize: 20,
        fontFamily: 'Inter',
        bold: true,
        italic: false,
        align: 'center',
        color: '#fff',
        strokeColor: '#000',
        strokeWidth: 0,
        lineHeight: 1.2,
        letterSpacing: 0,
        uppercase: false,
      },
    };
    const report = await hydrateProjectLayers([layer]);
    expect(report.layers[0]).toBe(layer);
  });
});

describe('decode guard', () => {
  it('rejects oversized files before decoding', async () => {
    const big = new Blob([new Uint8Array(41 * 1024 * 1024)], { type: 'image/png' });
    await expect(decodeToCanvas(big)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
