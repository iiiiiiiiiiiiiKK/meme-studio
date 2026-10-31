import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  clearAllData,
  countAssets,
  deleteAsset,
  getAsset,
  getProject,
  listAssets,
  listPresets,
  listProjects,
  saveAsset,
  savePreset,
  saveProject,
  setMeta,
  getMeta,
  updateAsset,
} from '../src/lib/db';
import type { StoredAsset } from '../src/lib/db';
import type { PresetRecord, ProjectRecord } from '../src/types';

function makeAsset(id: string, name = 'test'): StoredAsset {
  const now = Date.now();
  return {
    id,
    name,
    kind: 'original',
    blob: new Blob(['hello'], { type: 'image/png' }),
    thumb: new Blob(['thumb'], { type: 'image/webp' }),
    width: 100,
    height: 80,
    size: 5,
    createdAt: now,
    updatedAt: now,
    tags: ['demo'],
    favorite: false,
    deleted: false,
    source: 'test',
  };
}

describe('storage layer', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('stores and reads assets', async () => {
    await saveAsset(makeAsset('a1'));
    await saveAsset(makeAsset('a2', 'second'));
    expect(await countAssets()).toBe(2);
    const all = await listAssets();
    expect(all.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    const one = await getAsset('a1');
    expect(one?.name).toBe('test');
  });

  it('updates and deletes assets', async () => {
    await saveAsset(makeAsset('a1'));
    await updateAsset('a1', { favorite: true, tags: ['x'] });
    const updated = await getAsset('a1');
    expect(updated?.favorite).toBe(true);
    expect(updated?.tags).toEqual(['x']);
    await deleteAsset('a1');
    expect(await getAsset('a1')).toBeUndefined();
  });

  it('persists projects with their layers', async () => {
    const project: ProjectRecord = {
      id: 'p1',
      name: 'My meme',
      thumb: null,
      width: 800,
      height: 800,
      createdAt: 1,
      updatedAt: 2,
      layers: [
        {
          id: 'l1',
          type: 'text',
          name: 'Caption',
          x: 10,
          y: 10,
          width: 200,
          height: 60,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          text: {
            content: 'hi',
            fontSize: 40,
            fontFamily: 'Inter',
            bold: true,
            italic: false,
            align: 'center',
            color: '#fff',
            strokeColor: '#000',
            strokeWidth: 2,
            lineHeight: 1.1,
            letterSpacing: 0,
            uppercase: false,
          },
        },
      ],
      background: null,
      grid: false,
      snap: true,
    };
    await saveProject(project);
    const loaded = await getProject('p1');
    expect(loaded?.layers).toHaveLength(1);
    expect(loaded?.layers[0].text?.content).toBe('hi');
    const list = await listProjects();
    expect(list).toHaveLength(1);
  });

  it('stores presets and filters by kind', async () => {
    const preset: PresetRecord = {
      id: 'preset1',
      name: 'Thick outline',
      kind: 'outline',
      createdAt: 1,
      payload: { thickness: 20 },
      favorite: false,
    };
    await savePreset(preset);
    await savePreset({ ...preset, id: 'preset2', kind: 'canvas', name: 'Square' });
    const outlines = await listPresets('outline');
    expect(outlines).toHaveLength(1);
    expect(outlines[0].payload).toEqual({ thickness: 20 });
    expect(await listPresets()).toHaveLength(2);
  });

  it('round-trips meta values', async () => {
    await setMeta('onboarded', true);
    expect(await getMeta('onboarded', false)).toBe(true);
    expect(await getMeta('missing', 'fallback')).toBe('fallback');
  });

  it('clearAllData wipes every store', async () => {
    await saveAsset(makeAsset('a1'));
    await setMeta('k', 1);
    await clearAllData();
    expect(await countAssets()).toBe(0);
    expect(await getMeta('k', null)).toBeNull();
  });
});
