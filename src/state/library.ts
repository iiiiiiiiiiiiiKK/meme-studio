import { create } from 'zustand';
import type { AssetKind } from '../types';
import {
  clearAllData,
  deleteAsset as deleteAssetRow,
  listAssets,
  listPresets,
  listProjects,
  saveAsset,
  saveProject,
  storageEstimate,
  updateAsset,
  type StoredAsset,
  type StoredProject,
} from '../lib/db';
import { makeThumbnail, canvasToBlob } from '../lib/image';
import { assetUrl, releaseAllAssetUrls, releaseAssetUrl } from '../lib/assetUrls';

export type LibraryFilter = 'all' | AssetKind | 'favorites' | 'trash';
export type LibrarySort = 'newest' | 'oldest' | 'name' | 'size';

export interface LibraryState {
  assets: StoredAsset[];
  projects: StoredProject[];
  presetsLoaded: number;
  loading: boolean;
  filter: LibraryFilter;
  sort: LibrarySort;
  query: string;
  selection: string[];
  usage: { usage: number; quota: number };
  load: () => Promise<void>;
  setFilter: (filter: LibraryFilter) => void;
  setSort: (sort: LibrarySort) => void;
  setQuery: (query: string) => void;
  toggleSelect: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  addAsset: (input: {
    blob: Blob;
    name: string;
    kind: AssetKind;
    width: number;
    height: number;
    tags?: string[];
    source?: string;
    projectId?: string;
    mode?: StoredAsset['mode'];
    hasAlpha?: boolean;
  }) => Promise<StoredAsset>;
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  setTags: (id: string, tags: string[]) => Promise<void>;
  refreshProject: (project: StoredProject) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  clearEverything: () => Promise<void>;
  urlFor: (asset: StoredAsset) => string;
  visibleAssets: () => StoredAsset[];
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  assets: [],
  projects: [],
  presetsLoaded: 0,
  loading: true,
  filter: 'all',
  sort: 'newest',
  query: '',
  selection: [],
  usage: { usage: 0, quota: 0 },
  load: async () => {
    set({ loading: true });
    try {
      const [assets, projects, presets, usage] = await Promise.all([
        listAssets(),
        listProjects(),
        listPresets(),
        storageEstimate(),
      ]);
      set({ assets, projects, presetsLoaded: presets.length, usage, loading: false });
    } catch (error) {
      set({ loading: false });
      // The UI surfaces this through a toast in App; re-throw so callers can react.
      throw error;
    }
  },
  setFilter: (filter) => set({ filter, selection: [] }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  toggleSelect: (id, additive = true) => {
    const { selection } = get();
    if (!additive) {
      set({ selection: [id] });
      return;
    }
    set({ selection: selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id] });
  },
  clearSelection: () => set({ selection: [] }),
  addAsset: async (input) => {
    const thumb = await makeThumbnail(input.blob, 420);
    const now = Date.now();
    const asset: StoredAsset = {
      id: makeId(),
      name: input.name,
      kind: input.kind,
      blob: input.blob,
      thumb,
      width: input.width,
      height: input.height,
      size: input.blob.size,
      createdAt: now,
      updatedAt: now,
      tags: input.tags ?? [],
      favorite: false,
      deleted: false,
      source: input.source ?? 'upload',
      projectId: input.projectId,
      mode: input.mode,
      hasAlpha: input.hasAlpha,
    };
    await saveAsset(asset);
    set({ assets: [asset, ...get().assets] });
    void storageEstimate().then((usage) => set({ usage }));
    return asset;
  },
  remove: async (id) => {
    await updateAsset(id, { deleted: true });
    set({ assets: get().assets.map((a) => (a.id === id ? { ...a, deleted: true } : a)) });
  },
  restore: async (id) => {
    await updateAsset(id, { deleted: false });
    set({ assets: get().assets.map((a) => (a.id === id ? { ...a, deleted: false } : a)) });
  },
  purge: async (id) => {
    await deleteAssetRow(id);
    releaseAssetUrl(id);
    set({ assets: get().assets.filter((a) => a.id !== id), selection: get().selection.filter((s) => s !== id) });
  },
  toggleFavorite: async (id) => {
    const asset = get().assets.find((a) => a.id === id);
    if (!asset) return;
    await updateAsset(id, { favorite: !asset.favorite });
    set({ assets: get().assets.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)) });
  },
  rename: async (id, name) => {
    await updateAsset(id, { name });
    set({ assets: get().assets.map((a) => (a.id === id ? { ...a, name } : a)) });
  },
  setTags: async (id, tags) => {
    await updateAsset(id, { tags });
    set({ assets: get().assets.map((a) => (a.id === id ? { ...a, tags } : a)) });
  },
  refreshProject: async (project) => {
    await saveProject(project);
    const existing = get().projects;
    const next = existing.some((p) => p.id === project.id)
      ? existing.map((p) => (p.id === project.id ? project : p))
      : [project, ...existing];
    set({ projects: next.sort((a, b) => b.updatedAt - a.updatedAt) });
  },
  removeProject: async (id) => {
    const { deleteProject } = await import('../lib/db');
    await deleteProject(id);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  },
  clearEverything: async () => {
    await clearAllData();
    releaseAllAssetUrls();
    set({ assets: [], projects: [], presetsLoaded: 0, selection: [], usage: { usage: 0, quota: 0 } });
  },
  urlFor: (asset) => assetUrl(asset),
  visibleAssets: () => {
    const { assets, filter, sort, query } = get();
    const q = query.trim().toLowerCase();
    let list = assets.filter((asset) => {
      if (filter === 'trash') return asset.deleted;
      if (asset.deleted) return false;
      if (filter === 'favorites') return asset.favorite;
      if (filter === 'all') return true;
      return asset.kind === filter;
    });
    if (q) {
      list = list.filter(
        (asset) =>
          asset.name.toLowerCase().includes(q) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          asset.kind.includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return list;
  },
}));

/** Converts a canvas to a PNG blob and stores it as an asset. */
export async function storeCanvasAsAsset(
  canvas: HTMLCanvasElement,
  name: string,
  kind: AssetKind,
  extra: Partial<Parameters<LibraryState['addAsset']>[0]> = {},
): Promise<StoredAsset> {
  const blob = await canvasToBlob(canvas, 'image/png');
  return useLibrary.getState().addAsset({
    blob,
    name,
    kind,
    width: canvas.width,
    height: canvas.height,
    hasAlpha: true,
    ...extra,
  });
}
