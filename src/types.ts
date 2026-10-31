export type CutMode =
  | 'background'
  | 'face'
  | 'head'
  | 'head-neck'
  | 'head-shoulders'
  | 'upper-body'
  | 'full';

export const CUT_MODES: { id: CutMode; label: string; hint: string }[] = [
  { id: 'background', label: 'Background', hint: 'Keep the person, drop everything else' },
  { id: 'face', label: 'Face only', hint: 'Exact face oval from the mesh' },
  { id: 'head', label: 'Head', hint: 'Hair to chin — the classic sticker' },
  { id: 'head-neck', label: 'Head + neck', hint: 'A little more neck for composites' },
  { id: 'head-shoulders', label: 'Head + shoulders', hint: 'Bust crop for reaction memes' },
  { id: 'upper-body', label: 'Upper body', hint: 'Chest-up cutout' },
  { id: 'full', label: 'Full person', hint: 'Whole silhouette, transparent' },
];

export interface OutlineSettings {
  enabled: boolean;
  /** Stroke thickness in source pixels at the cutout resolution. */
  thickness: number;
  color: string;
  /** Optional second stroke painted outside the first one. */
  layers: 1 | 2;
  secondColor: string;
  secondThickness: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  glow: boolean;
  glowColor: string;
  inner: number;
}

export const DEFAULT_OUTLINE: OutlineSettings = {
  enabled: true,
  thickness: 14,
  color: '#ffffff',
  layers: 1,
  secondColor: '#111111',
  secondThickness: 6,
  shadow: false,
  shadowColor: '#000000',
  shadowBlur: 18,
  shadowOpacity: 0.45,
  glow: false,
  glowColor: '#c6f24e',
  inner: 0,
};

export interface CutoutOptions {
  mode: CutMode;
  faceIndex: number;
  feather: number;
  expand: number;
  edgeSmooth: number;
  outline: OutlineSettings;
}

export type AssetKind = 'original' | 'cutout' | 'sticker' | 'meme' | 'starter';

export interface AssetRecord {
  id: string;
  name: string;
  kind: AssetKind;
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  favorite: boolean;
  deleted: boolean;
  source: string;
  projectId?: string;
  mode?: CutMode;
  hasAlpha?: boolean;
}

export type LayerType = 'image' | 'text' | 'shape';

export interface ImageLayerData {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  assetId?: string;
}

export interface TextLayerData {
  content: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  strokeColor: string;
  strokeWidth: number;
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
}

export interface ShapeLayerData {
  kind: 'rect' | 'ellipse';
  fill: string;
  radius: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  image?: ImageLayerData;
  text?: TextLayerData;
  shape?: ShapeLayerData;
}

export interface CanvasSettings {
  width: number;
  height: number;
  background: string | null;
  grid: boolean;
  snap: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  thumb: Blob | null;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  layers: Layer[];
  background: string | null;
  grid: boolean;
  snap: boolean;
}

export type PresetKind = 'outline' | 'extract' | 'canvas' | 'export' | 'batch';

export interface PresetRecord {
  id: string;
  name: string;
  kind: PresetKind;
  createdAt: number;
  payload: Record<string, unknown>;
  favorite: boolean;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  status: 'queued' | 'working' | 'done' | 'failed' | 'skipped';
  error?: string;
  result?: { blob: Blob; width: number; height: number; thumb: Blob };
  previewUrl?: string;
}

export const FACE_MODES: CutMode[] = ['face', 'head', 'head-neck', 'head-shoulders', 'upper-body'];

/** A detected face plus its full landmark mesh, in source-pixel coordinates. */
export interface FaceDetection {
  index: number;
  /** Face box [x, y, width, height] in source pixels. */
  box: [number, number, number, number];
  score: number;
  /** 468-point FaceMesh landmarks in source pixels. */
  mesh: Array<[number, number]>;
  /** Ordered face-oval contour in source pixels. */
  oval: Array<[number, number]>;
}

export const MODE_LABEL: Record<CutMode, string> = {
  background: 'Background removed',
  face: 'Face only',
  head: 'Head sticker',
  'head-neck': 'Head + neck',
  'head-shoulders': 'Head + shoulders',
  'upper-body': 'Upper body',
  full: 'Full person',
};
