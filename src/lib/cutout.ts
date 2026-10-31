import { createCanvas, ctx2d } from './image';
import {
  applyMaskToCanvas,
  buildRegionMask,
  dilateMask,
  erodeMask,
  extractAlpha,
  faceOvalMask,
  multiplyMasks,
  removeSpecks,
} from './mask';
import { renderOutlined, visibleBounds, featherAlpha, type Bounds } from './outline';
import type { CutMode, CutoutOptions, FaceDetection } from '../types';

export interface CutoutResult {
  /** Final sticker with outline + shadow, trimmed. */
  canvas: HTMLCanvasElement;
  /** Alpha channel of the trimmed sticker. */
  alpha: Uint8ClampedArray;
  /** Alpha of the subject only (no outline), trimmed. */
  subjectAlpha: Uint8ClampedArray;
  /** Mask at source resolution, before trimming. */
  mask: Uint8ClampedArray;
  /** Bounds in source pixels that were cropped out. */
  bounds: Bounds;
  width: number;
  height: number;
  faceBox: [number, number, number, number] | null;
  warnings: string[];
}

export interface CutoutInput {
  source: HTMLCanvasElement;
  /** Person alpha matte from the local model (source resolution). */
  personAlpha: Uint8ClampedArray;
  faces: FaceDetection[];
  options: CutoutOptions;
}

/**
 * Builds the alpha mask for the requested cut mode.
 *
 * The rule is always: a neural subject matte defines the silhouette, and the face
 * mesh / body proportions only decide *which part* of that silhouette survives.
 * Rectangles are never used as a mask.
 */
export function buildCutMask(
  width: number,
  height: number,
  personAlpha: Uint8ClampedArray,
  faces: FaceDetection[],
  options: CutoutOptions,
): { mask: Uint8ClampedArray; faceBox: [number, number, number, number] | null; warning: string | null } {
  const mode: CutMode = options.mode;
  const face = faces[options.faceIndex] ?? faces[0] ?? null;

  if (mode === 'background' || mode === 'full') {
    return { mask: personAlpha.slice(), faceBox: face?.box ?? null, warning: null };
  }
  if (!face) {
    return {
      mask: personAlpha.slice(),
      faceBox: null,
      warning: 'No face was detected, so the person silhouette was kept instead of a head crop.',
    };
  }

  let region: Uint8ClampedArray;
  if (mode === 'face' && face.oval.length > 4) {
    region = faceOvalMask(width, height, face.oval, Math.max(1, face.box[2] * 0.03));
    const expanded = dilateMask(region, width, height, 2, 1);
    region = expanded;
  } else {
    region = buildRegionMask(width, height, { x: face.box[0], y: face.box[1], width: face.box[2], height: face.box[3] }, mode, 0.05);
  }

  // Intersect the generous head region with the *real* person silhouette.
  const mask = multiplyMasks(personAlpha, region);
  return { mask, faceBox: face.box, warning: null };
}

export function runCutout(input: CutoutInput): CutoutResult {
  const { source, personAlpha, faces, options } = input;
  const { width, height } = source;
  const warnings: string[] = [];

  const { mask: rawMask, faceBox, warning } = buildCutMask(width, height, personAlpha, faces, options);
  if (warning) warnings.push(warning);

  let mask = removeSpecks(rawMask, width, height, 24);
  if (options.expand > 0) mask = dilateMask(mask, width, height, options.expand, 1);
  else if (options.expand < 0) mask = erodeMask(mask, width, height, -options.expand);
  mask = featherAlpha(mask, width, height, options.feather + options.edgeSmooth);

  const subjectCanvas = applyMaskToCanvas(source, mask);
  let subjectAlpha = extractAlpha(subjectCanvas);

  const hasSubject = subjectAlpha.some((a) => a > 8);
  if (!hasSubject) {
    warnings.push('The selected person produced an empty mask. Try another person or the Background mode.');
    const fallback = createCanvas(width, height);
    ctx2d(fallback).drawImage(source, 0, 0);
    const fallbackAlpha = extractAlpha(fallback);
    return {
      canvas: fallback,
      alpha: fallbackAlpha,
      subjectAlpha: fallbackAlpha,
      mask,
      bounds: { x: 0, y: 0, width, height },
      width,
      height,
      faceBox,
      warnings,
    };
  }

  const outlined = renderOutlined(subjectCanvas, subjectAlpha, options.outline, { padding: 2 });

  // Re-trim the outlined canvas and keep the alpha in sync with it.
  const outlinedAlpha = extractAlpha(outlined);
  const bounds = visibleBounds(outlinedAlpha, outlined.width, outlined.height, 0);
  const trimmed = createCanvas(bounds.width, bounds.height);
  const tctx = ctx2d(trimmed);
  tctx.drawImage(outlined, -bounds.x, -bounds.y);

  // The subject alpha must be trimmed by the same amount; recompute it for the
  // trimmed sticker so downstream layers have an exact match.
  const trimmedSubject = createCanvas(bounds.width, bounds.height);
  const tsctx = ctx2d(trimmedSubject);
  tsctx.drawImage(
    subjectCanvas,
    bounds.x - 2,
    bounds.y - 2,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  subjectAlpha = extractAlpha(trimmedSubject);

  return {
    canvas: trimmed,
    alpha: extractAlpha(trimmed),
    subjectAlpha,
    mask,
    bounds,
    width: trimmed.width,
    height: trimmed.height,
    faceBox,
    warnings,
  };
}

/** Snapshot of a mask for the UI (white on black). */
export function maskPreviewCanvas(mask: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = ctx2d(canvas);
  const image = ctx.createImageData(width, height);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    image.data[p] = image.data[p + 1] = image.data[p + 2] = mask[i];
    image.data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
