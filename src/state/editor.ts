import { create } from 'zustand';
import type { CanvasSettings, Layer, LayerType, ProjectRecord } from '../types';
import { getProject, saveProject, type StoredProject } from '../lib/db';
import { makeThumbnail } from '../lib/image';
import { renderScene } from '../lib/render';

const HISTORY_LIMIT = 40;

export interface EditorSnapshot {
  layers: Layer[];
  settings: CanvasSettings;
}

export interface EditorState {
  projectId: string;
  projectName: string;
  layers: Layer[];
  selectedId: string | null;
  settings: CanvasSettings;
  history: EditorSnapshot[];
  future: EditorSnapshot[];
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;
  zoom: number;
  panX: number;
  panY: number;
  setProject: (project: { id: string; name: string; layers: Layer[]; settings: CanvasSettings }) => void;
  rename: (name: string) => void;
  addLayer: (layer: Layer, options?: { select?: boolean }) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  updateLayerData: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => string | null;
  reorder: (from: number, to: number) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  select: (id: string | null) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setSettings: (patch: Partial<CanvasSettings>) => void;
  undo: () => void;
  redo: () => void;
  setView: (zoom: number, panX: number, panY: number) => void;
  save: (thumbCanvas?: HTMLCanvasElement | null) => Promise<void>;
  markClean: () => void;
  createLayerId: () => string;
}

export function newLayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createImageLayer(args: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  assetId?: string;
}): Layer {
  return {
    id: newLayerId(),
    type: 'image',
    name: args.name ?? 'Image',
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    image: {
      src: args.src,
      naturalWidth: args.naturalWidth,
      naturalHeight: args.naturalHeight,
      assetId: args.assetId,
    },
  };
}

export function createTextLayer(args: { content: string; x: number; y: number; width: number; fontSize?: number }): Layer {
  return {
    id: newLayerId(),
    type: 'text',
    name: args.content.slice(0, 24) || 'Text',
    x: args.x,
    y: args.y,
    width: args.width,
    height: (args.fontSize ?? 64) * 1.3,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: {
      content: args.content,
      fontSize: args.fontSize ?? 64,
      fontFamily: 'Inter, sans-serif',
      bold: true,
      italic: false,
      align: 'center',
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 6,
      lineHeight: 1.15,
      letterSpacing: 0,
      uppercase: false,
    },
  };
}

export function createShapeLayer(args: {
  kind: 'rect' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  radius?: number;
}): Layer {
  const layer: Layer = {
    id: newLayerId(),
    type: 'shape',
    name: args.kind === 'ellipse' ? 'Ellipse' : 'Rectangle',
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    shape: { kind: args.kind, fill: args.fill ?? '#c6f24e', radius: args.radius ?? 18 },
  };
  return layer;
}

function snapshot(state: EditorState): EditorSnapshot {
  return { layers: state.layers.map((l) => ({ ...l })), settings: { ...state.settings } };
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: '',
  projectName: 'Untitled meme',
  layers: [],
  selectedId: null,
  settings: { width: 1200, height: 1200, background: null, grid: false, snap: true },
  history: [],
  future: [],
  dirty: false,
  saving: false,
  lastSavedAt: null,
  saveError: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  createLayerId: newLayerId,
  setProject: ({ id, name, layers, settings }) =>
    set({
      projectId: id,
      projectName: name,
      layers,
      settings,
      selectedId: layers.length ? layers[layers.length - 1].id : null,
      history: [],
      future: [],
      dirty: false,
      lastSavedAt: null,
      saveError: null,
      zoom: 1,
      panX: 0,
      panY: 0,
    }),
  rename: (projectName) => set({ projectName, dirty: true }),
  addLayer: (layer, options = {}) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({
      layers: [...state.layers, layer],
      history,
      future: [],
      selectedId: options.select === false ? state.selectedId : layer.id,
      dirty: true,
    });
  },
  updateLayer: (id, patch) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      history,
      future: [],
      dirty: true,
    });
  },
  updateLayerData: (id, patch) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({
      layers: state.layers.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l };
        if (patch.text && l.text) {
          next.text = { ...l.text, ...patch.text };
          // Keep the layer label in sync with the caption so the layer list stays
          // readable when several text layers are stacked.
          if (typeof patch.text.content === 'string') {
            const label = patch.text.content.replace(/\n/g, ' ').trim().slice(0, 24);
            if (label) next.name = label;
          }
        }
        if (patch.shape && l.shape) next.shape = { ...l.shape, ...patch.shape };
        if (patch.image && l.image) next.image = { ...l.image, ...patch.image };
        const { text: _t, shape: _s, image: _i, ...rest } = patch;
        void _t;
        void _s;
        void _i;
        return Object.assign(next, rest);
      }),
      history,
      future: [],
      dirty: true,
    });
  },
  removeLayer: (id) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({
      layers: state.layers.filter((l) => l.id !== id),
      history,
      future: [],
      selectedId: state.selectedId === id ? null : state.selectedId,
      dirty: true,
    });
  },
  duplicateLayer: (id) => {
    const state = get();
    const layer = state.layers.find((l) => l.id === id);
    if (!layer) return null;
    const copy: Layer = {
      ...layer,
      id: newLayerId(),
      name: `${layer.name} copy`,
      x: layer.x + 24,
      y: layer.y + 24,
      text: layer.text ? { ...layer.text } : undefined,
      shape: layer.shape ? { ...layer.shape } : undefined,
      image: layer.image ? { ...layer.image } : undefined,
    };
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ layers: [...state.layers, copy], history, future: [], selectedId: copy.id, dirty: true });
    return copy.id;
  },
  reorder: (from, to) => {
    const state = get();
    if (from === to || from < 0 || to < 0 || from >= state.layers.length || to >= state.layers.length) return;
    const layers = [...state.layers];
    const [moved] = layers.splice(from, 1);
    layers.splice(to, 0, moved);
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ layers, history, future: [], dirty: true });
  },
  moveUp: (id) => {
    const index = get().layers.findIndex((l) => l.id === id);
    if (index >= 0 && index < get().layers.length - 1) get().reorder(index, index + 1);
  },
  moveDown: (id) => {
    const index = get().layers.findIndex((l) => l.id === id);
    if (index > 0) get().reorder(index, index - 1);
  },
  select: (selectedId) => set({ selectedId }),
  toggleVisible: (id) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({
      layers: state.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      history,
      future: [],
      dirty: true,
    });
  },
  toggleLocked: (id) => {
    const state = get();
    set({ layers: state.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)), dirty: true });
  },
  renameLayer: (id, name) => {
    const state = get();
    set({ layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)), dirty: true });
  },
  setSettings: (patch) => {
    const state = get();
    const history = [...state.history, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ settings: { ...state.settings, ...patch }, history, future: [], dirty: true });
  },
  undo: () => {
    const state = get();
    if (!state.history.length) return;
    const previous = state.history[state.history.length - 1];
    set({
      layers: previous.layers,
      settings: previous.settings,
      history: state.history.slice(0, -1),
      future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
      dirty: true,
    });
  },
  redo: () => {
    const state = get();
    if (!state.future.length) return;
    const next = state.future[0];
    set({
      layers: next.layers,
      settings: next.settings,
      history: [...state.history, snapshot(state)].slice(-HISTORY_LIMIT),
      future: state.future.slice(1),
      dirty: true,
    });
  },
  setView: (zoom, panX, panY) => set({ zoom, panX, panY }),
  save: async (thumbCanvas) => {
    const state = get();
    if (!state.projectId) {
      // A project id is assigned by the caller before the first save.
      return;
    }
    // Snapshot identities: every mutation replaces these references, so a
    // reference check after the async write tells us whether the user kept
    // editing while the save was in flight.
    const savedLayers = state.layers;
    const savedSettings = state.settings;
    set({ saving: true, saveError: null });
    try {
      let thumb: Blob | null = null;
      const previewCanvas =
        thumbCanvas ??
        (await renderScene(state.layers, state.settings, {
          transparent: true,
          scale: Math.min(1, 480 / Math.max(state.settings.width, state.settings.height)),
        }));
      thumb = await makeThumbnail(previewCanvas, 480);
      const project: StoredProject = {
        id: state.projectId,
        name: state.projectName,
        thumb,
        width: state.settings.width,
        height: state.settings.height,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        layers: state.layers,
        background: state.settings.background,
        grid: state.settings.grid,
        snap: state.settings.snap,
      };
      const existing = await getProject(state.projectId);
      if (existing) project.createdAt = existing.createdAt;
      await saveProject(project);
      const current = get();
      const unchanged = current.layers === savedLayers && current.settings === savedSettings;
      set({ saving: false, dirty: unchanged ? false : current.dirty, lastSavedAt: Date.now() });
      const { useLibrary } = await import('./library');
      await useLibrary.getState().load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Saving failed.';
      set({ saving: false, saveError: message });
      throw error;
    }
  },
  markClean: () => set({ dirty: false }),
}));

export function projectToRecord(state: {
  projectId: string;
  projectName: string;
  layers: Layer[];
  settings: CanvasSettings;
}): ProjectRecord {
  return {
    id: state.projectId,
    name: state.projectName,
    thumb: null,
    width: state.settings.width,
    height: state.settings.height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    layers: state.layers,
    background: state.settings.background,
    grid: state.settings.grid,
    snap: state.settings.snap,
  };
}

export function nextLayerName(layers: Layer[], type: LayerType): string {
  const count = layers.filter((l) => l.type === type).length + 1;
  const base = type === 'image' ? 'Image' : type === 'text' ? 'Text' : 'Shape';
  return `${base} ${count}`;
}
