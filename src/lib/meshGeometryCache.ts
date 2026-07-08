import type * as THREE from "three";
import type { MeshAsset } from "../types/robot";
import { parseMeshAsset } from "./meshIO";

const meshGeometryCache = new WeakMap<MeshAsset, THREE.BufferGeometry | null>();

/** Parse each MeshAsset object at most once; replaced assets naturally miss the WeakMap cache. */
export function getCachedMeshGeometry(asset: MeshAsset): THREE.BufferGeometry | null {
  if (meshGeometryCache.has(asset)) return meshGeometryCache.get(asset) ?? null;
  try {
    const geometry = parseMeshAsset(asset);
    meshGeometryCache.set(asset, geometry);
    return geometry;
  } catch {
    meshGeometryCache.set(asset, null);
    return null;
  }
}
