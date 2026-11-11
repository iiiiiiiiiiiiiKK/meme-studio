import { createCanvas, ctx2d, canvasToBlob, makeThumbnail } from './image';
import { roundedRectPath } from './render';

/**
 * The starter pack is generated locally with Canvas so the community tab has
 * genuine, usable images on first launch. Every entry is produced by the same
 * code that ships in the app — nothing here is a placeholder or a stock photo,
 * and the UI labels these items as the bundled starter pack.
 */

export interface StarterItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: 'Sticker' | 'Reaction' | 'Crypto' | 'Animal' | 'Object' | 'Template';
  author: string;
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
}

const PALETTES = [
  ['#ffdd57', '#ff8f3f', '#2b1a06'],
  ['#c6f24e', '#2b3a09', '#101408'],
  ['#8ad4ff', '#1b3a55', '#07131d'],
  ['#ff9ec4', '#5c1233', '#1a0710'],
  ['#b79cff', '#2a1a5c', '#0d0720'],
  ['#ff7a7a', '#4a1010', '#180505'],
];

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function faceSticker(palette: string[], mood: 'happy' | 'smug' | 'shock' | 'deadpan') {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.32;
    circle(ctx, cx, cy + size * 0.05, r * 1.12, palette[1]);
    circle(ctx, cx, cy, r, palette[0]);
    // eyes
    const eyeY = cy - r * 0.18;
    const eyeDx = r * 0.38;
    ctx.fillStyle = palette[2];
    if (mood === 'shock') {
      circle(ctx, cx - eyeDx, eyeY, r * 0.13, palette[2]);
      circle(ctx, cx + eyeDx, eyeY, r * 0.13, palette[2]);
    } else if (mood === 'deadpan') {
      ctx.fillRect(cx - eyeDx - r * 0.13, eyeY - r * 0.05, r * 0.26, r * 0.1);
      ctx.fillRect(cx + eyeDx - r * 0.13, eyeY - r * 0.05, r * 0.26, r * 0.1);
    } else {
      ctx.fillRect(cx - eyeDx - r * 0.09, eyeY - r * 0.16, r * 0.18, r * 0.32);
      ctx.fillRect(cx + eyeDx - r * 0.09, eyeY - r * 0.16, r * 0.18, r * 0.32);
    }
    // mouth
    ctx.strokeStyle = palette[2];
    ctx.lineWidth = Math.max(4, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const mouthY = cy + r * 0.28;
    if (mood === 'happy') {
      ctx.arc(cx, mouthY - r * 0.14, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (mood === 'smug') {
      ctx.moveTo(cx - r * 0.3, mouthY);
      ctx.quadraticCurveTo(cx + r * 0.05, mouthY + r * 0.22, cx + r * 0.34, mouthY - r * 0.12);
    } else if (mood === 'shock') {
      ctx.ellipse(cx, mouthY, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(cx - r * 0.26, mouthY);
      ctx.lineTo(cx + r * 0.26, mouthY);
    }
    ctx.stroke();
  };
}

function textSticker(text: string, palette: string[], sizeRatio = 0.16) {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    const pad = size * 0.1;
    ctx.fillStyle = palette[0];
    ctx.beginPath();
    roundedRectPath(ctx, pad, size * 0.3, size - pad * 2, size * 0.4, size * 0.08);    ctx.fill();
    ctx.fillStyle = palette[2];
    ctx.font = `800 ${size * sizeRatio}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  };
}

function arrowSticker(palette: string[]) {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = size * 0.075;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.16, size * 0.78);
    ctx.quadraticCurveTo(size * 0.5, size * 0.82, size * 0.7, size * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.7, size * 0.42);
    ctx.lineTo(size * 0.55, size * 0.4);
    ctx.moveTo(size * 0.7, size * 0.42);
    ctx.lineTo(size * 0.72, size * 0.6);
    ctx.stroke();
  };
}

function coinSticker(palette: string[]) {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    const cx = size / 2;
    const cy = size / 2;
    circle(ctx, cx, cy, size * 0.3, palette[1]);
    circle(ctx, cx, cy, size * 0.26, palette[0]);
    ctx.fillStyle = palette[2];
    ctx.font = `800 ${size * 0.28}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ξ', cx, cy + size * 0.01);
  };
}

function ringSticker(palette: string[]) {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.save();
    ctx.shadowColor = palette[0];
    ctx.shadowBlur = size * 0.08;
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = palette[2];
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.24, 0, Math.PI * 2);
    ctx.stroke();
  };
}

export const STARTER_ITEMS: StarterItem[] = [
  {
    id: 'starter-happy',
    title: 'Happy Sticker',
    description: 'A cheerful round face sticker with a thick transparent outline. Drag it straight into the canvas.',
    tags: ['sticker', 'face', 'happy', 'starter'],
    category: 'Sticker',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: faceSticker(PALETTES[0], 'happy'),
  },
  {
    id: 'starter-smug',
    title: 'Smug Reaction',
    description: 'The classic “I told you so” smirk. Built for caption replies.',
    tags: ['reaction', 'smug', 'starter'],
    category: 'Reaction',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: faceSticker(PALETTES[1], 'smug'),
  },
  {
    id: 'starter-shock',
    title: 'Shock Sticker',
    description: 'Wide-eyed sticker for unexpected news, wicks and rug pulls.',
    tags: ['reaction', 'shock', 'starter'],
    category: 'Reaction',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: faceSticker(PALETTES[2], 'shock'),
  },
  {
    id: 'starter-deadpan',
    title: 'Deadpan Sticker',
    description: 'Zero expression. Maximum judgement.',
    tags: ['reaction', 'deadpan', 'starter'],
    category: 'Reaction',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: faceSticker(PALETTES[5], 'deadpan'),
  },
  {
    id: 'starter-wagmi',
    title: 'WAGMI Plate',
    description: 'A ready-made text plate you can recolor or restyle in the editor.',
    tags: ['crypto', 'text', 'wagmi', 'starter'],
    category: 'Crypto',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: textSticker('WAGMI', PALETTES[1], 0.15),
  },
  {
    id: 'starter-gm',
    title: 'GM Plate',
    description: 'Say gm with a transparent sticker instead of typing it.',
    tags: ['crypto', 'text', 'gm', 'starter'],
    category: 'Crypto',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: textSticker('gm', PALETTES[0], 0.22),
  },
  {
    id: 'starter-arrow',
    title: 'Curved Arrow',
    description: 'Point at the thing. Works on top of any photo.',
    tags: ['object', 'arrow', 'annotation', 'starter'],
    category: 'Object',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: arrowSticker(PALETTES[3]),
  },
  {
    id: 'starter-coin',
    title: 'Coin Badge',
    description: 'A neutral coin badge for crypto memes. Recolor it in seconds.',
    tags: ['crypto', 'badge', 'coin', 'starter'],
    category: 'Crypto',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: coinSticker(PALETTES[0]),
  },
  {
    id: 'starter-neon',
    title: 'Neon Ring',
    description: 'A glow ring you can drop behind a head sticker for a highlight.',
    tags: ['object', 'neon', 'glow', 'starter'],
    category: 'Object',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: ringSticker(PALETTES[4]),
  },
  {
    id: 'starter-nope',
    title: 'NOPE Plate',
    description: 'For when the chart does the thing again.',
    tags: ['reaction', 'text', 'nope', 'starter'],
    category: 'Template',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: textSticker('NOPE', PALETTES[5], 0.17),
  },
  {
    id: 'starter-lfg',
    title: 'LFG Plate',
    description: 'Ship-it energy in a 720px sticker.',
    tags: ['crypto', 'text', 'lfg', 'starter'],
    category: 'Crypto',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: textSticker('LFG', PALETTES[2], 0.2),
  },
  {
    id: 'starter-pack',
    title: 'Sticker Pack Template',
    description: 'A blank 1:1 transparent canvas preset you can reuse for any sticker set.',
    tags: ['template', 'canvas', 'starter'],
    category: 'Template',
    author: 'Starter Pack',
    width: 720,
    height: 720,
    draw: ringSticker(PALETTES[1]),
  },
];

export interface GeneratedStarter {
  item: StarterItem;
  blob: Blob;
  thumb: Blob;
}

export async function generateStarter(item: StarterItem): Promise<GeneratedStarter> {
  const canvas = createCanvas(item.width, item.height);
  const ctx = ctx2d(canvas);
  item.draw(ctx, item.width);
  const blob = await canvasToBlob(canvas, 'image/png');
  const thumb = await makeThumbnail(canvas, 420);
  return { item, blob, thumb };
}

export async function generateAllStarters(
  onProgress?: (done: number, total: number) => void,
): Promise<GeneratedStarter[]> {
  const out: GeneratedStarter[] = [];
  for (let i = 0; i < STARTER_ITEMS.length; i++) {
    out.push(await generateStarter(STARTER_ITEMS[i]));
    onProgress?.(i + 1, STARTER_ITEMS.length);
  }
  return out;
}
