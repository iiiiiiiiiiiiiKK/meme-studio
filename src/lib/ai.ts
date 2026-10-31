import type { CutMode, FaceDetection } from '../types';

export type { FaceDetection };

/**
 * Local AI engine.
 *
 * Everything here runs inside the browser: the face detector (BlazeFace),
 * the face landmark mesh (FaceMesh) and the person matte (RVM) are TensorFlow.js
 * graphs that are served from `public/models`, so no API key and no network
 * upload is involved. Nothing in this file talks to a third-party service.
 */

export type EngineStage = 'idle' | 'loading' | 'detecting' | 'matting' | 'ready' | 'error';

export interface ProgressEvent {
  stage: EngineStage;
  message: string;
  progress?: number;
}


/** Internal shape that is compatible with @vladmandic/human but kept structural. */
interface HumanFaceLike {
  box: number[];
  boxRaw?: number[];
  score?: number;
  mesh: number[][];
  annotations?: Record<string, number[][]>;
}

interface HumanResultLike {
  face: HumanFaceLike[];
}

interface HumanInstance {
  load(config?: unknown): Promise<void>;
  detect(input: HTMLCanvasElement | HTMLImageElement, config?: unknown): Promise<HumanResultLike>;
  segmentation(input: HTMLCanvasElement | HTMLImageElement, config?: unknown): Promise<{ shape: number[]; data(): Promise<Float32Array | Int32Array | Uint8Array> } | null>;
  image(input: HTMLCanvasElement | HTMLImageElement, config?: unknown): Promise<unknown>;
  tf: {
    backend(): string;
    setBackend(name: string): Promise<boolean>;
    ready(): Promise<void>;
    getBackend(): string;
  };
  env: { initial: boolean };
  models: { reset(): void };
  config: Record<string, unknown>;
  result?: unknown;
  dispose?(): void;
}

const MODEL_BASE = new URL('models/', window.location.href).href;

let instancePromise: Promise<HumanInstance> | null = null;
let engineInfo: { backend: string; segModel: string } | null = null;

const HUMAN_CONFIG = {
  modelBasePath: MODEL_BASE,
  cacheModels: true,
  debug: false,
  backend: 'webgl',
  filter: { enabled: true, flip: false, equalization: false },
  face: {
    enabled: true,
    detector: {
      modelPath: 'blazeface.json',
      maxDetected: 20,
      minConfidence: 0.25,
      iouThreshold: 0.4,
      rotation: false,
      return: false,
    },
    mesh: { enabled: true, modelPath: 'facemesh.json' },
    iris: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    attention: { enabled: false },
    gear: { enabled: false },
    mobilefacenet: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: {
    enabled: true,
    modelPath: 'rvm.json',
    ratio: 0.6,
    mode: 'alpha',
  },
};

function emit(onProgress: ((e: ProgressEvent) => void) | undefined, e: ProgressEvent): void {
  onProgress?.(e);
}

export async function getEngine(onProgress?: (e: ProgressEvent) => void): Promise<HumanInstance> {
  if (instancePromise) {
    const existing = await instancePromise;
    return existing;
  }
  instancePromise = (async () => {
    emit(onProgress, { stage: 'loading', message: 'Loading local models (FaceMesh + RVM)…' });
    const mod = await import('@vladmandic/human');
    const HumanCtor = (mod as any).default ?? (mod as any).Human;
    if (!HumanCtor) throw new Error('Could not find Human constructor in @vladmandic/human.');
    const human = new HumanCtor(HUMAN_CONFIG);
    // Prefer WebGL for speed; the WASM backend is the fallback when WebGL fails.
    try {
      await human.tf.setBackend('webgl');
      await human.tf.ready();
    } catch {
      await human.tf.setBackend('wasm');
      await human.tf.ready();
    }
    await human.load(HUMAN_CONFIG);
    engineInfo = {
      backend: human.tf.getBackend?.() ?? human.tf.backend(),
      segModel: 'RVM (Robust Video Matting) · 3.7 MB · MIT',
    };
    emit(onProgress, { stage: 'ready', message: `Engine ready · ${engineInfo.backend}` });
    return human;
  })().catch((error: unknown) => {
    instancePromise = null;
    const message = error instanceof Error ? error.message : String(error);
    emit(onProgress, { stage: 'error', message });
    throw new Error(`Local AI engine failed to start: ${message}`);
  });
  return instancePromise;
}

export function getEngineInfo(): { backend: string; segModel: string } | null {
  return engineInfo;
}

export function resetEngine(): void {
  instancePromise = null;
  engineInfo = null;
}

function scalePoint(p: number[], width: number, height: number): [number, number] {
  return [p[0] * width, p[1] * height];
}

export function detectFaces(human: HumanInstance, canvas: HTMLCanvasElement): FaceDetection[] {
  const { width, height } = canvas;
  return (human.result as HumanResultLike | undefined)?.face
    ? ((human.result as HumanResultLike).face || []).map((face, index) => toDetection(face, index, width, height))
    : [];
}

function toDetection(face: HumanFaceLike, index: number, width: number, height: number): FaceDetection {
  const clamped = (n: number, max: number) => Math.max(0, Math.min(max, n));
  const boxW = Math.max(1, clamped(face.box[2], width));
  const boxH = Math.max(1, clamped(face.box[3], height));
  const mesh = (face.mesh || []).map((p): [number, number] => [p[0], p[1]]);
  const ovalRaw = face.annotations?.faceOval ?? [];
  const oval = ovalRaw.map((p): [number, number] => scalePoint(p, width, height));
  return {
    index,
    box: [clamped(face.box[0], width), clamped(face.box[1], height), boxW, boxH],
    score: face.score ?? 0,
    mesh,
    oval,
  };
}

export interface DetectOutcome {
  faces: FaceDetection[];
  elapsedMs: number;
  backend: string;
}

export async function detectAll(
  canvas: HTMLCanvasElement,
  onProgress?: (e: ProgressEvent) => void,
): Promise<DetectOutcome> {
  const human = await getEngine(onProgress);
  emit(onProgress, { stage: 'detecting', message: 'Detecting faces locally…' });
  const started = performance.now();
  const result = (await human.detect(canvas, {
    face: { enabled: true, detector: { maxDetected: 20 }, mesh: { enabled: true } },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
  })) as HumanResultLike;
  const { width, height } = canvas;
  const faces = (result.face || []).map((face, index) => toDetection(face, index, width, height));
  return {
    faces,
    elapsedMs: Math.round(performance.now() - started),
    backend: (human.tf.getBackend?.() ?? human.tf.backend()) || 'webgl',
  };
}

export interface MatteOutcome {
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
  source: 'rvm' | 'fallback';
  elapsedMs: number;
  note?: string;
}

/**
 * Person alpha matte. Returns alpha at the exact canvas resolution so it can be
 * intersected with a head region without resampling artefacts.
 */
export async function personAlpha(
  canvas: HTMLCanvasElement,
  onProgress?: (e: ProgressEvent) => void,
): Promise<MatteOutcome> {
  const human = await getEngine(onProgress);
  emit(onProgress, { stage: 'matting', message: 'Segmenting foreground (RVM)…' });
  const started = performance.now();
  try {
    const tensor = await human.segmentation(canvas, { segmentation: { enabled: true, modelPath: 'rvm.json', ratio: 0.6, mode: 'alpha' } });
    if (!tensor) throw new Error('The segmentation model returned no result.');
    const [h, w] = tensor.shape.length === 4 ? [tensor.shape[1], tensor.shape[2]] : [canvas.height, canvas.width];
    const raw = await tensor.data();
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
    if (raw.length === w * h) {
      // nearest-neighbour resample to canvas resolution
      for (let y = 0; y < canvas.height; y++) {
        const sy = Math.min(h - 1, Math.floor((y * h) / canvas.height));
        for (let x = 0; x < canvas.width; x++) {
          const sx = Math.min(w - 1, Math.floor((x * w) / canvas.width));
          alpha[y * canvas.width + x] = raw[sy * w + sx];
        }
      }
    } else if (raw.length >= w * h * 4) {
      for (let i = 0; i < alpha.length; i++) alpha[i] = raw[i * 4 + 3];
    } else {
      throw new Error('Unexpected matte tensor size.');
    }
    return {
      alpha,
      width: canvas.width,
      height: canvas.height,
      source: 'rvm',
      elapsedMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    emit(onProgress, { stage: 'matting', message: `RVM unavailable — using local color matte (${note})` });
    const fallback = await import('./matte-fallback');
    return {
      ...fallback.colorMatte(canvas),
      source: 'fallback',
      note,
      elapsedMs: Math.round(performance.now() - started),
    } as MatteOutcome;
  }
}

export function modeUsesFace(mode: CutMode): boolean {
  return mode !== 'background' && mode !== 'full';
}
