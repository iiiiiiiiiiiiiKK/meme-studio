import { getAsset } from './db';
import { assetUrl, peekAssetUrl } from './assetUrls';
import type { Layer } from '../types';

/**
 * Rebuilds the runtime image sources of a saved project.
 *
 * Layers are persisted with an `assetId`, but their `src` is an object URL that
 * only exists in the document that created it. After a reload (or on another
 * tab) that URL is dead, so every image layer must be re-created from the blob
 * stored in IndexedDB.
 *
 * Layers without an `assetId` keep whatever `src` they carry: that is either a
 * data URL (permanent) or a truly broken reference the UI already reports.
 */
export async function hydrateLayers(layers: Layer[]): Promise<Layer[]> {
  const out: Layer[] = [];
  const missing: string[] = [];
  for (const layer of layers) {
    const image = layer.image;
    if (layer.type !== 'image' || !image?.assetId) {
      out.push(layer);
      continue;
    }
    const existing = peekAssetUrl(image.assetId);
    if (existing) {
      out.push({ ...layer, image: { ...image, src: existing } });
      continue;
    }
    const asset = await getAsset(image.assetId);
    if (!asset) {
      missing.push(layer.name);
      out.push(layer);
      continue;
    }
    out.push({ ...layer, image: { ...image, src: assetUrl(asset) } });
  }
  return out;
}

export interface HydrationReport {
  layers: Layer[];
  /** Layers whose asset no longer exists in IndexedDB. */
  missing: string[];
}

/** Same as {@link hydrateLayers} but also reports which assets were missing. */
export async function hydrateProjectLayers(layers: Layer[]): Promise<HydrationReport> {
  const out: Layer[] = [];
  const missing: string[] = [];
  for (const layer of layers) {
    const image = layer.image;
    if (layer.type !== 'image' || !image?.assetId) {
      out.push(layer);
      continue;
    }
    const existing = peekAssetUrl(image.assetId);
    if (existing) {
      out.push({ ...layer, image: { ...image, src: existing } });
      continue;
    }
    const asset = await getAsset(image.assetId);
    if (!asset) {
      missing.push(layer.name);
      out.push(layer);
      continue;
    }
    out.push({ ...layer, image: { ...image, src: assetUrl(asset) } });
  }
  return { layers: out, missing };
}