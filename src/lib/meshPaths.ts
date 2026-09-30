// Resolves the relative package paths used for mesh files, shared by the URDF
// exporter and the zip packager so they always agree.
//
// A mesh asset can be referenced from a visual and/or a collision geometry.
// We emit it under meshes/visual/<file> and/or meshes/collision/<file> as used.

import type { MeshAsset, RobotModel } from "../types/robot";

export interface MeshPlacement {
  meshId: string;
  /** file name within the bucket, e.g. "arm.stl" (made unique across the bucket) */
  fileName: string;
  /** relative path from robot.urdf, e.g. "meshes/visual/arm.stl" */
  visualPath?: string;
  collisionPath?: string;
}

function meshFileName(mesh: MeshAsset): string {
  // Asset names are editable labels; the payload format determines the file
  // extension so renaming a mesh cannot make an exported URDF unloadable.
  const stem = mesh.name
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.(stl|obj)$/i, "")
    .replace(/^\.+|\.+$/g, "") || "mesh";
  return `${stem}.${mesh.format}`;
}

/**
 * Build a map from meshId -> placement for every mesh actually referenced by a
 * link's visual or collision geometry. Unreferenced meshes are omitted.
 */
export function resolveMeshPlacements(model: RobotModel): Map<string, MeshPlacement> {
  const visualUsers = new Set<string>();
  const collisionUsers = new Set<string>();
  for (const link of model.links) {
    if (link.visual?.geometry.type === "mesh") visualUsers.add(link.visual.geometry.meshId);
    if (link.collision?.geometry.type === "mesh") collisionUsers.add(link.collision.geometry.meshId);
  }

  const placements = new Map<string, MeshPlacement>();
  const visualNames = new Set<string>();
  const collisionNames = new Set<string>();

  const uniqueIn = (taken: Set<string>, base: string): string => {
    let candidate = base;
    let i = 1;
    while (taken.has(candidate.toLowerCase())) {
      const dot = base.lastIndexOf(".");
      candidate = dot > 0 ? `${base.slice(0, dot)}_${i}${base.slice(dot)}` : `${base}_${i}`;
      i += 1;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  };

  for (const mesh of model.meshes) {
    const used = visualUsers.has(mesh.id) || collisionUsers.has(mesh.id);
    if (!used) continue;
    const baseName = meshFileName(mesh);
    const placement: MeshPlacement = { meshId: mesh.id, fileName: baseName };
    if (visualUsers.has(mesh.id)) {
      const fn = uniqueIn(visualNames, baseName);
      placement.fileName = fn;
      placement.visualPath = `meshes/visual/${fn}`;
    }
    if (collisionUsers.has(mesh.id)) {
      const fn = uniqueIn(collisionNames, baseName);
      placement.collisionPath = `meshes/collision/${fn}`;
      if (!placement.visualPath) placement.fileName = fn;
    }
    placements.set(mesh.id, placement);
  }
  return placements;
}
