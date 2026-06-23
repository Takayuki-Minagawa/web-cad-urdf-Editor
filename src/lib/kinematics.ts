// Forward kinematics for display: compute each link's world transform by
// walking the joint tree from the root(s) at the zero joint configuration.

import * as THREE from "three";
import type { RobotModel } from "../types/robot";
import { poseToMatrix } from "../three/coords";

/** Link ids that are never any joint's child. */
export function findRootLinkIds(model: RobotModel): string[] {
  const children = new Set(model.joints.map((j) => j.child));
  return model.links.filter((l) => !children.has(l.id)).map((l) => l.id);
}

/**
 * World transform per link id, joints at angle 0. Disconnected links and extra
 * roots are placed at the origin. Robust against cycles (visited guard).
 */
export function computeLinkWorldTransforms(model: RobotModel): Map<string, THREE.Matrix4> {
  const childJoints = new Map<string, { child: string; origin: THREE.Matrix4 }[]>();
  for (const j of model.joints) {
    const list = childJoints.get(j.parent) ?? [];
    list.push({ child: j.child, origin: poseToMatrix(j.origin) });
    childJoints.set(j.parent, list);
  }

  const world = new Map<string, THREE.Matrix4>();
  const roots = findRootLinkIds(model);
  // Any link with no computed transform (disconnected / cycle) also starts at origin.
  const starts = roots.length > 0 ? roots : model.links.map((l) => l.id);

  const visit = (linkId: string, parentWorld: THREE.Matrix4) => {
    if (world.has(linkId)) return; // cycle / multi-parent guard
    world.set(linkId, parentWorld);
    for (const edge of childJoints.get(linkId) ?? []) {
      const childWorld = parentWorld.clone().multiply(edge.origin);
      visit(edge.child, childWorld);
    }
  };

  for (const root of starts) visit(root, new THREE.Matrix4());
  // Ensure every link has a transform.
  for (const l of model.links) {
    if (!world.has(l.id)) world.set(l.id, new THREE.Matrix4());
  }
  return world;
}
