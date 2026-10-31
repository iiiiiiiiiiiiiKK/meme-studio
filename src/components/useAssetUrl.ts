import { useEffect, useState } from 'react';
import type { StoredAsset } from '../lib/db';

const cache = new Map<string, string>();

/** Creates and revokes an object URL for a stored asset blob. */
export function useAssetUrl(asset: StoredAsset | { id: string; blob: Blob } | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (asset ? cache.get(asset.id) ?? null : null));

  useEffect(() => {
    if (!asset) {
      setUrl(null);
      return;
    }
    const existing = cache.get(asset.id);
    if (existing) {
      setUrl(existing);
      return;
    }
    const objectUrl = URL.createObjectURL(asset.blob);
    cache.set(asset.id, objectUrl);
    setUrl(objectUrl);
  }, [asset]);

  return url;
}

export function assetUrl(asset: { id: string; blob: Blob }): string {
  const existing = cache.get(asset.id);
  if (existing) return existing;
  const url = URL.createObjectURL(asset.blob);
  cache.set(asset.id, url);
  return url;
}

export function releaseAssetUrl(id: string): void {
  const url = cache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(id);
  }
}
