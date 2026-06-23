// Factory helpers that produce well-formed model objects with sensible defaults.

import { makeId } from "./ids";
import { boxInertia } from "./inertia";
import {
  type GeometryKind,
  type GeometrySpec,
  type JointSpec,
  type JointType,
  type LinkSpec,
  type Rgba,
  ZERO_POSE,
  clonePose,
} from "../types/robot";

export const DEFAULT_COLOR: Rgba = [0.6, 0.6, 0.65, 1];

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

export function makeLink(name: string): LinkSpec {
  const geom = defaultGeometry("box");
  return {
    id: makeId("link"),
    name,
    visual: { geometry: structuredClone(geom), origin: clonePose(ZERO_POSE), color: [...DEFAULT_COLOR] },
    collision: { geometry: structuredClone(geom), origin: clonePose(ZERO_POSE) },
    inertial: {
      origin: clonePose(ZERO_POSE),
      mass: 1,
      inertia: boxInertia(1, [0.2, 0.2, 0.2]),
    },
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
    joint.limit = { lower: -1.57, upper: 1.57, effort: 100, velocity: 1 };
  }
  if (type !== "fixed") {
    joint.dynamics = { damping: 0, friction: 0 };
  }
  return joint;
}
