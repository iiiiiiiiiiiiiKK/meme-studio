/**
 * Single owner of object URLs created for stored assets.
 *
 * Every camera-ready <img> in the app points at one of these URLs. Keeping the
 * cache in one module means:
 *  - a blob is only turned into an object URL once,
 *  - deleting or wiping an asset actually revokes its URL,
 *  - reopening a saved project can rebuild URLs from the IndexedDB blob instead
 *    of reusing a dead URL from a previous page load.
 */
const cache = new Map<string, string>();

export function assetUrl(asset: { id: string; blob: Blob }): string {
  const existing = cache.get(asset.id);
  if (existing) return existing;
  const url = URL.createObjectURL(asset.blob);
  cache.set(asset.id, url);
  return url;
}

/** Registers an already-created URL so later revokes find it. */
export function adoptAssetUrl(id: string, url: string): string {
  const existing = cache.get(id);
  if (existing) {
    if (existing !== url) URL.revokeObjectURL(url);
    return existing;
  }
  cache.set(id, url);
  return url;
}

export function peekAssetUrl(id: string): string | null {
  return cache.get(id) ?? null;
}

export function releaseAssetUrl(id: string): void {
  const url = cache.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  cache.delete(id);
}

export function releaseAllAssetUrls(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}

/** Test-only introspection. */
export function assetUrlCacheSize(): number {
  return cache.size;
}