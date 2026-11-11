import { openDB, type IDBPDatabase } from 'idb';
import type { AssetKind, AssetRecord, Layer, PresetRecord, ProjectRecord } from '../types';

const DB_NAME = 'meme-studio';
const DB_VERSION = 1;

export interface StoredAsset extends Omit<AssetRecord, 'blob' | 'thumb'> {
  blob: Blob;
  thumb: Blob;
}

export interface StoredProject extends Omit<ProjectRecord, 'thumb' | 'layers'> {
  thumb: Blob | null;
  layers: Layer[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('assets')) {
          const assets = database.createObjectStore('assets', { keyPath: 'id' });
          assets.createIndex('createdAt', 'createdAt');
          assets.createIndex('kind', 'kind');
          assets.createIndex('deleted', 'deleted');
        }
        if (!database.objectStoreNames.contains('projects')) {
          const projects = database.createObjectStore('projects', { keyPath: 'id' });
          projects.createIndex('updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains('presets')) {
          const presets = database.createObjectStore('presets', { keyPath: 'id' });
          presets.createIndex('kind', 'kind');
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const database = await db();
  await database.put('assets', asset);
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  const database = await db();
  return database.get('assets', id) as Promise<StoredAsset | undefined>;
}

export async function listAssets(): Promise<StoredAsset[]> {
  const database = await db();
  const all = (await database.getAll('assets')) as StoredAsset[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAssetsByKind(kind: AssetKind): Promise<StoredAsset[]> {
  const database = await db();
  const all = (await database.getAllFromIndex('assets', 'kind', kind)) as StoredAsset[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateAsset(id: string, patch: Partial<StoredAsset>): Promise<void> {
  const database = await db();
  const existing = (await database.get('assets', id)) as StoredAsset | undefined;
  if (!existing) return;
  await database.put('assets', { ...existing, ...patch, updatedAt: Date.now() });
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await db();
  await database.delete('assets', id);
}

export async function countAssets(): Promise<number> {
  const database = await db();
  return database.count('assets');
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return { usage: 0, quota: 0 };
}

export async function saveProject(project: StoredProject): Promise<void> {
  const database = await db();
  await database.put('projects', project);
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  const database = await db();
  return database.get('projects', id) as Promise<StoredProject | undefined>;
}

export async function listProjects(): Promise<StoredProject[]> {
  const database = await db();
  const all = (await database.getAll('projects')) as StoredProject[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  await database.delete('projects', id);
}

export async function savePreset(preset: PresetRecord): Promise<void> {
  const database = await db();
  await database.put('presets', preset);
}

export async function listPresets(kind?: string): Promise<PresetRecord[]> {
  const database = await db();
  const all = kind
    ? ((await database.getAllFromIndex('presets', 'kind', kind)) as PresetRecord[])
    : ((await database.getAll('presets')) as PresetRecord[]);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deletePreset(id: string): Promise<void> {
  const database = await db();
  await database.delete('presets', id);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const database = await db();
  await database.put('meta', { key, value });
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const database = await db();
  const row = (await database.get('meta', key)) as { key: string; value: T } | undefined;
  return row ? row.value : fallback;
}

export async function clearAllData(): Promise<void> {
  const database = await db();
  await Promise.all([
    database.clear('assets'),
    database.clear('projects'),
    database.clear('presets'),
    database.clear('meta'),
  ]);
}

/** Counts what is stored locally. This reports; it does not export a backup file. */
export async function storageSummary(): Promise<{ assets: number; projects: number; presets: number }> {
  const [assets, projects, presets] = await Promise.all([listAssets(), listProjects(), listPresets()]);
  return { assets: assets.length, projects: projects.length, presets: presets.length };
}
