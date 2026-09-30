// Forward kinematics for display. Preview joint positions are separate from the
// robot model so posing a robot never changes its saved origins or URDF.

import * as THREE from "three";
import type { JointSpec, RobotModel, Vec3 } from "../types/robot";
import { poseToMatrix } from "../three/coords";

export type JointPositions = Readonly<Record<string, number>>;

/** Normalize without overflowing/underflowing the squared length. */
export function normalizedJointAxis(axis: Vec3): THREE.Vector3 | null {
  if (!axis.every(Number.isFinite)) return null;
  const scale = Math.max(...axis.map(Math.abs));
  if (scale === 0) return null;
  return new THREE.Vector3(axis[0] / scale, axis[1] / scale, axis[2] / scale).normalize();
}

/** A continuous joint uses one full turn for the preview controls. */
export function jointPreviewRange(joint: JointSpec): { min: number; max: number } | null {
  if (joint.type === "fixed" || !normalizedJointAxis(joint.axis)) return null;
  if (joint.type === "continuous") return { min: -Math.PI, max: Math.PI };
  const limit = joint.limit;
  if (!limit || !Number.isFinite(limit.lower) || !Number.isFinite(limit.upper) || limit.lower > limit.upper) return null;
  return { min: limit.lower, max: limit.upper };
}

/** Invalid controls stay at the zero pose; reset selects the valid value nearest zero. */
export function jointPreviewPosition(joint: JointSpec, value = 0): number {
  const range = jointPreviewRange(joint);
  if (!range) return 0;
  return Math.max(range.min, Math.min(range.max, Number.isFinite(value) ? value : 0));
}

/** Link ids that are never any joint's child. */
export function findRootLinkIds(model: RobotModel): string[] {
  const children = new Set(model.joints.map((j) => j.child));
  return model.links.filter((l) => !children.has(l.id)).map((l) => l.id);
}

function jointTransform(joint: JointSpec, position: number): THREE.Matrix4 {
  const transform = poseToMatrix(joint.origin);
  const axis = normalizedJointAxis(joint.axis);
  if (!axis || position === 0 || joint.type === "fixed") return transform;
  const motion = joint.type === "prismatic"
    ? new THREE.Matrix4().makeTranslation(axis.multiplyScalar(position))
    : new THREE.Matrix4().makeRotationAxis(axis, position);
  // URDF: the axis lives in the joint frame, after the origin's rotation.
  return transform.multiply(motion);
}

/**
 * T_child = T_parent * T_origin * T_motion. Iterative depth-first traversal
 * avoids call-stack limits. Invalid endpoints are skipped, and visited links
 * make cycles and multiple parents safe to display while validation reports them.
 */
export function computeLinkWorldTransforms(model: RobotModel, positions: JointPositions = {}): Map<string, THREE.Matrix4> {
  const linkIds = new Set(model.links.map((link) => link.id));
  const childJoints = new Map<string, { child: string; transform: THREE.Matrix4 }[]>();
  for (const joint of model.joints) {
    if (!linkIds.has(joint.parent) || !linkIds.has(joint.child)) continue;
    const list = childJoints.get(joint.parent) ?? [];
    list.push({ child: joint.child, transform: jointTransform(joint, jointPreviewPosition(joint, positions[joint.id])) });
    childJoints.set(joint.parent, list);
  }

  const world = new Map<string, THREE.Matrix4>();
  // Start with true roots, then visit any disconnected cycles as well.
  for (const root of [...findRootLinkIds(model), ...linkIds]) {
    if (world.has(root)) continue;
    const stack = [{ id: root, transform: new THREE.Matrix4() }];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (world.has(current.id)) continue;
      world.set(current.id, current.transform);
      const children = childJoints.get(current.id) ?? [];
      // Reverse insertion preserves the original joint order for malformed graphs.
      for (let i = children.length - 1; i >= 0; i -= 1) {
        const edge = children[i];
        if (!world.has(edge.child)) {
          stack.push({ id: edge.child, transform: current.transform.clone().multiply(edge.transform) });
        }
      }
    }
  }
  return world;
}
