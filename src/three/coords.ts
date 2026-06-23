// Conversions between the URDF/PyBullet convention (Z-up, fixed-axis rpy) and
// Three.js objects. The viewport renders directly in URDF coordinates with the
// camera "up" set to +Z, so no axis swapping is needed.

import * as THREE from "three";
import type { Pose, Vec3 } from "../types/robot";

/**
 * URDF rpy is a fixed-axis rotation R = Rz(yaw)·Ry(pitch)·Rx(roll).
 * Three.js reproduces this with Euler order "ZYX" using the same component values.
 */
export function eulerFromRpy(rpy: Vec3): THREE.Euler {
  return new THREE.Euler(rpy[0], rpy[1], rpy[2], "ZYX");
}

export function quaternionFromRpy(rpy: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(eulerFromRpy(rpy));
}

export function poseToMatrix(pose: Pose): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(pose.xyz[0], pose.xyz[1], pose.xyz[2]),
    quaternionFromRpy(pose.rpy),
    new THREE.Vector3(1, 1, 1),
  );
  return m;
}

/** Decompose a matrix back into a Pose (xyz + ZYX rpy). */
export function matrixToPose(m: THREE.Matrix4): Pose {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(pos, quat, scale);
  const e = new THREE.Euler().setFromQuaternion(quat, "ZYX");
  return { xyz: [pos.x, pos.y, pos.z], rpy: [e.x, e.y, e.z] };
}
