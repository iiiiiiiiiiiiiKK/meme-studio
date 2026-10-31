import { describe, expect, it } from 'vitest';
import {
  buildHeadRegionMask,
  ovalBounds,
  selectComponent,
  tightenAlpha,
} from '../src/lib/mask';

/**
 * A synthetic face oval: 36 points on an ellipse centred at (150, 150) with a
 * radius of 50 px. The real FaceMesh contour has the same shape and roughly the
 * same point count.
 */
function faceOval(cx = 150, cy = 150, rx = 50, ry = 60): Array<[number, number]> {
  return Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as [number, number];
  });
}

function at(mask: Uint8ClampedArray, width: number, x: number, y: number): number {
  return mask[Math.round(y) * width + Math.round(x)];
}

describe('landmark-driven head region', () => {
  const W = 300;
  const H = 320;
  const oval = faceOval();
  const box = { x: 100, y: 90, width: 100, height: 120 };

  it('derives the oval bounding box', () => {
    const b = ovalBounds(oval);
    expect(b.centerX).toBeCloseTo(150, 0);
    expect(b.width).toBeGreaterThan(90);
    expect(b.height).toBeGreaterThan(110);
  });

  it('head mode includes hair above the forehead and stops at the chin', () => {
    const region = buildHeadRegionMask(W, H, oval, box, 'head');
    // 35 px above the top of the oval = hair, must be inside the region
    expect(at(region, W, 150, 90 - 35)).toBeGreaterThan(100);
    // 90 px below the chin = neck/shoulder, must be outside a head crop
    expect(at(region, W, 150, 210 + 90)).toBe(0);
    // the face itself must always be inside
    expect(at(region, W, 150, 150)).toBe(255);
  });

  it('face mode follows the oval and excludes hair', () => {
    const region = buildHeadRegionMask(W, H, oval, box, 'face');
    expect(at(region, W, 150, 150)).toBeGreaterThan(200);
    // hair area above the oval is excluded
    expect(at(region, W, 150, 70)).toBe(0);
  });

  it('head+shoulders reaches lower and wider than head only', () => {
    const head = buildHeadRegionMask(W, H, oval, box, 'head');
    const shoulders = buildHeadRegionMask(W, H, oval, box, 'head-shoulders');
    const area = (m: Uint8ClampedArray) => m.reduce((sum, v) => sum + (v > 127 ? 1 : 0), 0);
    expect(area(shoulders)).toBeGreaterThan(area(head));
    // below the chin but inside the bust crop
    expect(at(shoulders, W, 150, 210 + 80)).toBeGreaterThan(100);
    // the head crop stops at the chin, the bust crop does not
    expect(at(head, W, 150, 210 + 80)).toBe(0);
    // the bust crop is wider than the head at the same height
    const rowWidth = (m: Uint8ClampedArray, y: number) => {
      let count = 0;
      for (let x = 0; x < W; x++) if (at(m, W, x, y) > 127) count++;
      return count;
    };
    expect(rowWidth(shoulders, 300)).toBeGreaterThan(rowWidth(head, 300));
  });

  it('background mode selects everything', () => {
    const region = buildHeadRegionMask(W, H, oval, box, 'background');
    const area = region.reduce((sum, v) => sum + (v > 127 ? 1 : 0), 0);
    expect(area).toBe(W * H);
  });

  it('falls back to the face box when no mesh is available', () => {
    const region = buildHeadRegionMask(W, H, [], box, 'head');
    expect(at(region, W, 150, 150)).toBeGreaterThan(100);
    const area = region.reduce((sum, v) => sum + (v > 127 ? 1 : 0), 0);
    expect(area).toBeGreaterThan(0);
  });
});

describe('connected component selection', () => {
  it('keeps only the blob that contains the seed', () => {
    const W = 100;
    const H = 60;
    const mask = new Uint8ClampedArray(W * H);
    // blob A around (20, 20)
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) mask[y * W + x] = 255;
    // blob B around (80, 40)
    for (let y = 30; y < 50; y++) for (let x = 70; x < 90; x++) mask[y * W + x] = 255;

    const result = selectComponent(mask, W, H, 20, 20, 40);
    expect(result.found).toBe(true);
    expect(at(result.mask, W, 20, 20)).toBe(255);
    expect(at(result.mask, W, 80, 40)).toBe(0);
  });

  it('snaps a seed that lands in a soft hole to the nearest foreground', () => {
    const W = 40;
    const H = 40;
    const mask = new Uint8ClampedArray(W * H);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) mask[y * W + x] = 255;
    const result = selectComponent(mask, W, H, 5, 5, 40);
    expect(result.found).toBe(true);
    expect(at(result.mask, W, 20, 20)).toBe(255);
  });

  it('reports "not found" when there is nothing to select', () => {
    const mask = new Uint8ClampedArray(40 * 40);
    expect(selectComponent(mask, 40, 40, 20, 20, 40).found).toBe(false);
  });
});

describe('tightenAlpha', () => {
  it('pushes soft edges towards fully in or fully out', () => {
    const source = new Uint8ClampedArray([0, 64, 128, 192, 255]);
    const tight = tightenAlpha(source, 0.6);
    expect(tight[0]).toBe(0);
    expect(tight[4]).toBe(255);
    expect(tight[1]).toBeLessThan(64);
    expect(tight[3]).toBeGreaterThan(192);
  });

  it('is a no-op at crispness 0', () => {
    const source = new Uint8ClampedArray([0, 64, 128]);
    expect([...tightenAlpha(source, 0)]).toEqual([...source]);
  });
});
