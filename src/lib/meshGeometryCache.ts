import type * as THREE from "three";
import type { MeshAsset } from "../types/robot";
import { parseMeshAsset } from "./meshIO";

interface CachedMeshGeometry {
  asset: MeshAsset;
  geometry: THREE.BufferGeometry | null;
}

const meshGeometryCache = new Map<string, CachedMeshGeometry>();

function sameGeometryPayload(a: MeshAsset, b: MeshAsset): boolean {
  return a.format === b.format && a.encoding === b.encoding && a.data === b.data;
}

function disposeGeometry(geometry: THREE.BufferGeometry | null): void {
  geometry?.dispose();
}

/** Parse mesh geometry by mesh id and dispose stale parsed geometry when the payload changes. */
export function getCachedMeshGeometry(asset: MeshAsset): THREE.BufferGeometry | null {
  const cached = meshGeometryCache.get(asset.id);
  if (cached) {
    if (cached.asset === asset || sameGeometryPayload(cached.asset, asset)) {
      cached.asset = asset;
      return cached.geometry;
    }
    disposeGeometry(cached.geometry);
  }

  try {
    const geometry = parseMeshAsset(asset);
    meshGeometryCache.set(asset.id, { asset, geometry });
    return geometry;
  } catch {
    meshGeometryCache.set(asset.id, { asset, geometry: null });
    return null;
  }
}

export function disposeCachedMeshGeometry(meshId: string): void {
  const cached = meshGeometryCache.get(meshId);
  if (!cached) return;
  disposeGeometry(cached.geometry);
  meshGeometryCache.delete(meshId);
}

export function disposeAllCachedMeshGeometries(): void {
  for (const cached of meshGeometryCache.values()) {
    disposeGeometry(cached.geometry);
  }
  meshGeometryCache.clear();
}
