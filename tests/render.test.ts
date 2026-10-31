import { describe, expect, it } from 'vitest';
import { renderScene, renderSingleLayer, suggestExportName } from '../src/lib/render';
import { createCanvas, ctx2d } from '../src/lib/image';
import type { CanvasSettings, Layer } from '../src/types';

const SETTINGS: CanvasSettings = { width: 200, height: 120, background: null, grid: false, snap: true };

function textLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'l1',
    type: 'text',
    name: 'Caption',
    x: 20,
    y: 30,
    width: 160,
    height: 60,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: {
      content: 'HELLO',
      fontSize: 32,
      fontFamily: 'Inter, sans-serif',
      bold: true,
      italic: false,
      align: 'center',
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 4,
      lineHeight: 1.2,
      letterSpacing: 0,
      uppercase: false,
    },
    ...overrides,
  };
}

function shapeLayer(): Layer {
  return {
    id: 's1',
    type: 'shape',
    name: 'Box',
    x: 10,
    y: 10,
    width: 80,
    height: 50,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    shape: { kind: 'rect', fill: '#c6f24e', radius: 8 },
  };
}

function nonEmptyPixels(canvas: HTMLCanvasElement): number {
  const data = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let p = 3; p < data.length; p += 4) if (data[p] > 0) n++;
  return n;
}

describe('scene rendering', () => {
  it('renders text with real pixels and keeps the canvas transparent', async () => {
    const canvas = await renderScene([textLayer()], SETTINGS, { transparent: true });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(120);
    expect(nonEmptyPixels(canvas)).toBeGreaterThan(50);
    const data = ctx2d(canvas).getImageData(0, 0, 200, 120).data;
    expect(data[3]).toBe(0);
  });

  it('honours a solid background when transparency is off', async () => {
    const canvas = await renderScene([shapeLayer()], SETTINGS, { transparent: false, background: '#112233' });
    const data = ctx2d(canvas).getImageData(0, 0, 200, 120).data;
    expect([data[0], data[1], data[2]]).toEqual([0x11, 0x22, 0x33]);
    expect(data[3]).toBe(255);
  });

  it('scales the output for 2x export', async () => {
    const canvas = await renderScene([shapeLayer()], SETTINGS, { transparent: true, scale: 2 });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(240);
  });

  it('skips hidden layers', async () => {
    const visible = await renderScene([shapeLayer()], SETTINGS, { transparent: true });
    const hidden = await renderScene([{ ...shapeLayer(), visible: false }], SETTINGS, { transparent: true });
    expect(nonEmptyPixels(visible)).toBeGreaterThan(0);
    expect(nonEmptyPixels(hidden)).toBe(0);
  });

  it('exports a single layer without the rest of the scene', async () => {
    const canvas = await renderSingleLayer(shapeLayer(), SETTINGS);
    expect(canvas.width).toBe(200);
    expect(nonEmptyPixels(canvas)).toBeGreaterThan(0);
  });

  it('sanitises export names', () => {
    expect(suggestExportName('My Meme / v2')).toBe('my-meme---v2');
    expect(suggestExportName('   ')).toBe('meme');
  });

  it('never draws a checkerboard into the export', async () => {
    const canvas = createCanvas(50, 50);
    ctx2d(canvas).clearRect(0, 0, 50, 50);
    const rendered = await renderScene([], SETTINGS, { transparent: true });
    const data = ctx2d(rendered).getImageData(0, 0, rendered.width, rendered.height).data;
    for (let p = 3; p < data.length; p += 4) expect(data[p]).toBe(0);
  });
});
