import { useMemo } from 'react';
import type { StoredAsset } from '../lib/db';
import { assetUrl, peekAssetUrl, releaseAssetUrl } from '../lib/assetUrls';

/**
 * Returns a live object URL for a stored asset.
 *
 * The URL is memoised per asset id in `lib/assetUrls`, so the same blob is never
 * turned into two URLs and deletion can revoke it from one place.
 */
export function useAssetUrl(asset: StoredAsset | { id: string; blob: Blob } | null): string | null {
  return useMemo(() => {
    if (!asset) return null;
    return peekAssetUrl(asset.id) ?? assetUrl(asset);
  }, [asset]);
}

export { assetUrl, releaseAssetUrl };