// Factory helpers that produce well-formed model objects with sensible defaults.

import { makeId } from "./ids";
import {
  type CollisionSpec,
  type GeometryKind,
  type GeometrySpec,
  type InertialSpec,
  type JointDynamics,
  type JointLimit,
  type JointSpec,
  type JointType,
  type LinkSpec,
  type Rgba,
  type VisualSpec,
  ZERO_INERTIA,
  ZERO_POSE,
  clonePose,
} from "../types/robot";
import { inertiaFromGeometry } from "./inertia";

export const DEFAULT_COLOR: Rgba = [0.6, 0.6, 0.65, 1];
export const DEFAULT_MASS = 1;
export const DEFAULT_JOINT_LIMIT: JointLimit = { lower: -1.57, upper: 1.57, effort: 100, velocity: 1 };
export const DEFAULT_JOINT_DYNAMICS: JointDynamics = { damping: 0, friction: 0 };

export function defaultGeometry(kind: GeometryKind): GeometrySpec {
  switch (kind) {
    case "box":
      return { type: "box", size: [0.2, 0.2, 0.2] };
    case "sphere":
      return { type: "sphere", radius: 0.1 };
    case "cylinder":
      return { type: "cylinder", radius: 0.05, length: 0.2 };
    case "mesh":
      return { type: "mesh", meshId: "", scale: [1, 1, 1] };
  }
}

export function cloneGeometry(geometry: GeometrySpec): GeometrySpec {
  switch (geometry.type) {
    case "box":
      return { type: "box", size: [...geometry.size] };
    case "sphere":
      return { type: "sphere", radius: geometry.radius };
    case "cylinder":
      return { type: "cylinder", radius: geometry.radius, length: geometry.length };
    case "mesh":
      return { type: "mesh", meshId: geometry.meshId, scale: [...geometry.scale] };
  }
}

export function makeVisual(geometry: GeometrySpec = defaultGeometry("box")): VisualSpec {
  return { geometry: cloneGeometry(geometry), origin: clonePose(ZERO_POSE), color: [...DEFAULT_COLOR] };
}

export function makeCollision(geometry: GeometrySpec = defaultGeometry("box")): CollisionSpec {
  return { geometry: cloneGeometry(geometry), origin: clonePose(ZERO_POSE) };
}

export function makeInertial(mass = DEFAULT_MASS, geometry: GeometrySpec = defaultGeometry("box")): InertialSpec {
  return {
    origin: clonePose(ZERO_POSE),
    mass,
    inertia: inertiaFromGeometry(mass, geometry) ?? { ...ZERO_INERTIA },
  };
}

export function makeLink(name: string, geometry: GeometrySpec = defaultGeometry("box")): LinkSpec {
  return {
    id: makeId("link"),
    name,
    visual: makeVisual(geometry),
    collision: makeCollision(geometry),
    inertial: makeInertial(DEFAULT_MASS, geometry),
  };
}

export function makeJoint(name: string, parent: string, child: string, type: JointType = "revolute"): JointSpec {
  const joint: JointSpec = {
    id: makeId("joint"),
    name,
    type,
    parent,
    child,
    origin: clonePose(ZERO_POSE),
    axis: [0, 0, 1],
  };
  if (type === "revolute" || type === "prismatic") {
    joint.limit = { ...DEFAULT_JOINT_LIMIT };
  }
  if (type !== "fixed") {
    joint.dynamics = { ...DEFAULT_JOINT_DYNAMICS };
  }
  return joint;
}
