import { vi } from 'vitest';

/**
 * jsdom has no canvas backend, so the unit tests install a small software
 * rasteriser. It supports the subset the app actually uses: transformed paths,
 * arcs, rectangles, images and (approximately) text. It is deliberately simple
 * — it exists so the real rendering code can be exercised, not to be a browser.
 */

interface Px {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Tf {
  tx: number;
  ty: number;
  rot: number;
  sx: number;
  sy: number;
}

const IDENTITY: Tf = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };

class FakeContext2D {
  canvas: HTMLCanvasElement;
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  miterLimit = 10;
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;
  imageSmoothingEnabled = true;
  imageSmoothingQuality: ImageSmoothingQuality = 'low';
  filter = 'none';
  shadowColor = '#000000';
  shadowBlur = 0;

  private pixels: Px[];
  private path: Array<[number, number]> = [];
  private arcs: Array<{ x: number; y: number; rx: number; ry: number }> = [];
  private tf: Tf = { ...IDENTITY };
  private stack: Tf[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.pixels = blank(canvas.width * canvas.height);
  }

  private sync(): void {
    const total = this.canvas.width * this.canvas.height;
    if (this.pixels.length !== total) this.pixels = blank(total);
  }

  private map(x: number, y: number): [number, number] {
    return [x * this.tf.sx + this.tf.tx, y * this.tf.sy + this.tf.ty];
  }

  save(): void {
    this.stack.push({ ...this.tf });
  }
  restore(): void {
    const previous = this.stack.pop();
    if (previous) this.tf = previous;
  }
  translate(x: number, y: number): void {
    this.tf = { ...this.tf, tx: this.tf.tx + x * this.tf.sx, ty: this.tf.ty + y * this.tf.sy };
  }
  rotate(): void {
    /* rotation is ignored: tests do not depend on rotated pixels */
  }
  scale(x: number, y: number): void {
    this.tf = { ...this.tf, sx: this.tf.sx * x, sy: this.tf.sy * y };
  }
  setTransform(): void {
    this.tf = { ...IDENTITY };
  }
  resetTransform(): void {
    this.tf = { ...IDENTITY };
  }

  beginPath(): void {
    this.path = [];
    this.arcs = [];
  }
  moveTo(x: number, y: number): void {
    this.path.push(this.map(x, y));
  }
  lineTo(x: number, y: number): void {
    this.path.push(this.map(x, y));
  }
  quadraticCurveTo(x1: number, y1: number, x: number, y: number): void {
    const [mx, my] = this.map((x1 + x) / 2, (y1 + y) / 2);
    this.path.push([mx, my], this.map(x, y));
  }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.path.push(this.map(x1, y1), this.map(x2, y2), this.map(x, y));
  }
  closePath(): void {}
  rect(x: number, y: number, w: number, h: number): void {
    this.path.push(this.map(x, y), this.map(x + w, y), this.map(x + w, y + h), this.map(x, y + h));
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h);
  }
  arc(x: number, y: number, r: number): void {
    const [cx, cy] = this.map(x, y);
    this.arcs.push({ x: cx, y: cy, rx: r * this.tf.sx, ry: r * this.tf.sy });
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    const [cx, cy] = this.map(x, y);
    this.arcs.push({ x: cx, y: cy, rx: rx * this.tf.sx, ry: ry * this.tf.sy });
  }
  fill(): void {
    this.paint(false);
  }
  stroke(): void {
    this.paint(true);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.beginPath();
    this.rect(x, y, w, h);
    this.stroke();
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.sync();
    const [x0, y0] = this.map(x, y);
    const [x1, y1] = this.map(x + w, y + h);
    for (let py = Math.max(0, Math.floor(y0)); py < Math.min(this.canvas.height, Math.ceil(y1)); py++) {
      for (let px = Math.max(0, Math.floor(x0)); px < Math.min(this.canvas.width, Math.ceil(x1)); px++) {
        this.pixels[py * this.canvas.width + px] = { r: 0, g: 0, b: 0, a: 0 };
      }
    }
  }
  clip(): void {}
  fillText(text: string, x: number, y: number): void {
    // Approximate glyph coverage with a block so text layers produce pixels.
    const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '16');
    const width = this.measureText(text).width;
    const align = this.textAlign;
    const baseline = this.textBaseline === 'middle';
    const left = align === 'center' ? x - width / 2 : align === 'right' || align === 'end' ? x - width : x;
    const top = baseline ? y - size / 2 : y - size;
    const color = parseColor(this.strokeStyle);
    void color;
    const [x0, y0] = this.map(left, top);
    const [x1, y1] = this.map(left + width, top + size);
    const fill = parseColor(this.fillStyle);
    this.paintBox(x0, y0, x1, y1, fill);
  }
  strokeText(text: string, x: number, y: number): void {
    const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '16');
    const width = this.measureText(text).width;
    const left = this.textAlign === 'center' ? x - width / 2 : x;
    const top = this.textBaseline === 'middle' ? y - size / 2 : y - size;
    const [x0, y0] = this.map(left, top);
    const [x1, y1] = this.map(left + width, top + size);
    const pad = Math.max(0, this.lineWidth);
    this.paintBox(x0 - pad, y0 - pad, x1 + pad, y1 + pad, parseColor(this.strokeStyle));
  }
  measureText(text: string): TextMetrics {
    const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '16');
    return { width: [...text].length * size * 0.55 } as TextMetrics;
  }
  drawImage(source: HTMLCanvasElement, ...rest: number[]): void {
    this.sync();
    const sw = source.width;
    const sh = source.height;
    const hasDest = rest.length >= 4;
    const dx = rest.length === 2 ? rest[0] : rest.length >= 4 ? rest[0] : 0;
    const dy = rest.length === 2 ? rest[1] : rest.length >= 4 ? rest[1] : 0;
    const dw = rest.length === 2 ? sw : hasDest ? rest[2] : sw;
    const dh = rest.length === 2 ? sh : hasDest ? rest[3] : sh;
    const srcData = readPixels(source);
    const copy = this.pixels.slice();
    for (let y = 0; y < Math.max(1, Math.round(dh)); y++) {
      for (let x = 0; x < Math.max(1, Math.round(dw)); x++) {
        const [px, py] = this.map(dx + x, dy + y);
        const ix = Math.round(px);
        const iy = Math.round(py);
        if (ix < 0 || iy < 0 || ix >= this.canvas.width || iy >= this.canvas.height) continue;
        const sx = Math.min(sw - 1, Math.floor((x / Math.max(1, dw)) * sw));
        const sy = Math.min(sh - 1, Math.floor((y / Math.max(1, dh)) * sh));
        const index = iy * this.canvas.width + ix;
        copy[index] = blend(copy[index], srcData[sy * sw + sx], this.globalAlpha);
      }
    }
    this.pixels = copy;
  }
  putImageData(image: ImageData, dx = 0, dy = 0): void {
    this.sync();
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const px = dx + x;
        const py = dy + y;
        if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) continue;
        const p = (y * image.width + x) * 4;
        this.pixels[py * this.canvas.width + px] = {
          r: image.data[p],
          g: image.data[p + 1],
          b: image.data[p + 2],
          a: image.data[p + 3],
        };
      }
    }
  }
  createImageData(width: number, height: number): ImageData {
    return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' } as ImageData;
  }
  getImageData(x = 0, y = 0, w = this.canvas.width, h = this.canvas.height): ImageData {
    this.sync();
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const sx = x + col;
        const sy = y + row;
        if (sx < 0 || sy < 0 || sx >= this.canvas.width || sy >= this.canvas.height) continue;
        const px = this.pixels[sy * this.canvas.width + sx];
        const p = (row * w + col) * 4;
        data[p] = px.r;
        data[p + 1] = px.g;
        data[p + 2] = px.b;
        data[p + 3] = px.a;
      }
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  }

  private paintBox(x0: number, y0: number, x1: number, y1: number, color: Px): void {
    const alpha = (color.a / 255) * this.globalAlpha;
    for (let py = Math.max(0, Math.floor(y0)); py <= Math.min(this.canvas.height - 1, Math.ceil(y1)); py++) {
      for (let px = Math.max(0, Math.floor(x0)); px <= Math.min(this.canvas.width - 1, Math.ceil(x1)); px++) {
        const index = py * this.canvas.width + px;
        this.pixels[index] = blend(this.pixels[index], color, alpha / Math.max(0.0001, color.a / 255));
      }
    }
  }

  private paint(stroke: boolean): void {
    this.sync();
    const color = parseColor(stroke ? this.strokeStyle : this.fillStyle);
    if (this.arcs.length) {
      for (const arc of this.arcs) {
        const minX = Math.max(0, Math.floor(arc.x - arc.rx - this.lineWidth));
        const maxX = Math.min(this.canvas.width - 1, Math.ceil(arc.x + arc.rx + this.lineWidth));
        const minY = Math.max(0, Math.floor(arc.y - arc.ry - this.lineWidth));
        const maxY = Math.min(this.canvas.height - 1, Math.ceil(arc.y + arc.ry + this.lineWidth));
        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const nx = (px - arc.x) / Math.max(0.001, arc.rx);
            const ny = (py - arc.y) / Math.max(0.001, arc.ry);
            const d = Math.sqrt(nx * nx + ny * ny);
            if (stroke) {
              const edge = this.lineWidth / Math.max(arc.rx, arc.ry, 1);
              if (Math.abs(d - 1) <= Math.max(0.05, edge)) this.put(px, py, color);
            } else if (d <= 1) this.put(px, py, color);
          }
        }
      }
      return;
    }
    if (this.path.length < 3) return;
    const xs = this.path.map((p) => p[0]);
    const ys = this.path.map((p) => p[1]);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(this.canvas.width - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.canvas.height - 1, Math.ceil(Math.max(...ys)));
    const polygon = this.path;
    const inside = (px: number, py: number): boolean => {
      let result = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) result = !result;
      }
      return result;
    };
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        if (!inside(px, py)) continue;
        if (stroke) {
          const nearEdge =
            !inside(px - this.lineWidth, py) ||
            !inside(px + this.lineWidth, py) ||
            !inside(px, py - this.lineWidth) ||
            !inside(px, py + this.lineWidth);
          if (nearEdge) this.put(px, py, color);
        } else {
          this.put(px, py, color);
        }
      }
    }
  }

  private put(px: number, py: number, color: Px): void {
    const index = py * this.canvas.width + px;
    this.pixels[index] = blend(this.pixels[index], color, this.globalAlpha);
  }
}

function blank(count: number): Px[] {
  return Array.from({ length: count }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
}

function blend(dst: Px, src: Px, alpha: number): Px {
  const sa = (src.a / 255) * alpha;
  if (sa <= 0) return dst;
  const da = dst.a / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((src.r * sa + dst.r * da * (1 - sa)) / outA),
    g: Math.round((src.g * sa + dst.g * da * (1 - sa)) / outA),
    b: Math.round((src.b * sa + dst.b * da * (1 - sa)) / outA),
    a: Math.round(outA * 255),
  };
}

function parseColor(value: string): Px {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0');
    const n = Number.parseInt(full.slice(0, 6), 16);
    return Number.isNaN(n) ? { r: 0, g: 0, b: 0, a: 255 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
  }
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (match) {
    const parts = match[1].split(',').map((p) => Number(p.trim()));
    return {
      r: parts[0] ?? 0,
      g: parts[1] ?? 0,
      b: parts[2] ?? 0,
      a: Math.round((parts[3] ?? 1) * 255),
    };
  }
  const named: Record<string, Px> = {
    white: { r: 255, g: 255, b: 255, a: 255 },
    black: { r: 0, g: 0, b: 0, a: 255 },
    red: { r: 255, g: 0, b: 0, a: 255 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
  };
  return named[value] ?? { r: 0, g: 0, b: 0, a: 255 };
}

function readPixels(canvas: HTMLCanvasElement): Px[] {
  const ctx = canvas.getContext('2d') as unknown as FakeContext2D | null;
  if (!ctx) return blank(canvas.width * canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out: Px[] = [];
  for (let p = 0; p < data.data.length; p += 4) {
    out.push({ r: data.data[p], g: data.data[p + 1], b: data.data[p + 2], a: data.data[p + 3] });
  }
  return out;
}

const ctxStore = new WeakMap<HTMLCanvasElement, FakeContext2D>();

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string) {
  if (type !== '2d') return null;
  let ctx = ctxStore.get(this);
  if (!ctx) {
    ctx = new FakeContext2D(this);
    ctxStore.set(this, ctx);
  }
  return ctx as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
  return 'data:image/png;base64,';
};

HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
  callback(new Blob(['fake'], { type: 'image/png' }));
};

void vi;
