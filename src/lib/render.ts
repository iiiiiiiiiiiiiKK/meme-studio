import { createCanvas, ctx2d } from './image';
import type { CanvasSettings, Layer } from '../types';

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  scale: number;
  transparent: boolean;
  background: string;
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'png',
  scale: 1,
  transparent: true,
  background: '#0b0d12',
};

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load a layer image.'));
    img.src = src;
  });
}

export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: Layer): void {
  const text = layer.text;
  if (!text) return;
  const content = text.uppercase ? text.content.toUpperCase() : text.content;
  const lines = content.split('\n');
  const lineHeight = text.fontSize * text.lineHeight;
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = layer.opacity;
  ctx.textAlign = text.align;
  ctx.textBaseline = 'middle';
  ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? '700' : '400'} ${text.fontSize}px ${text.fontFamily}`;
  ctx.fillStyle = text.color;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (text.strokeWidth > 0) {
    ctx.strokeStyle = text.strokeColor;
    ctx.lineWidth = text.strokeWidth;
  }
  const anchorX = text.align === 'left' ? -layer.width / 2 : text.align === 'right' ? layer.width / 2 : 0;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (text.letterSpacing !== 0) {
      // letter-spacing is emulated by drawing character by character
      const chars = [...line];
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total = widths.reduce((a, b) => a + b, 0) + text.letterSpacing * Math.max(0, chars.length - 1);
      let cursor = anchorX - (text.align === 'center' ? total / 2 : text.align === 'right' ? total : 0);
      chars.forEach((char, i) => {
        if (text.strokeWidth > 0) ctx.strokeText(char, cursor, y);
        ctx.fillText(char, cursor, y);
        cursor += widths[i] + text.letterSpacing;
      });
    } else {
      if (text.strokeWidth > 0) ctx.strokeText(line, anchorX, y);
      ctx.fillText(line, anchorX, y);
    }
  });
  ctx.restore();
}

export function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: Layer): void {
  const shape = layer.shape;
  if (!shape) return;
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = shape.fill;
  if (shape.kind === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const r = Math.min(shape.radius, layer.width / 2, layer.height / 2);
    ctx.beginPath();
    ctx.roundRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height, r);
    ctx.fill();
  }
  ctx.restore();
}

export async function drawImageLayer(ctx: CanvasRenderingContext2D, layer: Layer): Promise<void> {
  if (!layer.image) return;
  const img = await loadImageElement(layer.image.src);
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = layer.opacity;
  ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  ctx.restore();
}

export async function renderScene(
  layers: Layer[],
  settings: CanvasSettings,
  options: { transparent?: boolean; scale?: number; background?: string } = {},
): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 1;
  const canvas = createCanvas(settings.width * scale, settings.height * scale);
  const ctx = ctx2d(canvas);
  ctx.scale(scale, scale);
  const bg = options.transparent ? null : options.background ?? settings.background;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, settings.width, settings.height);
  }
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === 'image') await drawImageLayer(ctx, layer);
    else if (layer.type === 'text') drawTextLayer(ctx, layer);
    else drawShapeLayer(ctx, layer);
  }
  return canvas;
}

export async function renderSingleLayer(layer: Layer, settings: CanvasSettings): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(settings.width, settings.height);
  const ctx = ctx2d(canvas);
  const clone: Layer = { ...layer, opacity: 1 };
  if (clone.type === 'image') await drawImageLayer(ctx, clone);
  else if (clone.type === 'text') drawTextLayer(ctx, clone);
  else drawShapeLayer(ctx, clone);
  return canvas;
}

export function suggestExportName(projectName: string): string {
  const base = projectName.trim() || 'meme';
  return base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase();
}
