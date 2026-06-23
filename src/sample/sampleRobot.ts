// A small two-link arm used as the default project and shipped sample.

import type { RobotModel } from "../types/robot";
import { makeJoint, makeLink } from "../lib/factories";
import { boxInertia, cylinderInertia } from "../lib/inertia";

export function sampleRobot(): RobotModel {
  const base = makeLink("base_link");
  base.visual = {
    geometry: { type: "box", size: [0.2, 0.2, 0.1] },
    origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
    color: [0.3, 0.35, 0.4, 1],
  };
  base.collision = {
    geometry: { type: "box", size: [0.2, 0.2, 0.1] },
    origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
  };
  base.inertial = { origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] }, mass: 2, inertia: boxInertia(2, [0.2, 0.2, 0.1]) };

  const arm = makeLink("arm_link");
  arm.visual = {
    geometry: { type: "cylinder", radius: 0.04, length: 0.4 },
    origin: { xyz: [0, 0, 0.2], rpy: [0, 0, 0] },
    color: [0.8, 0.5, 0.2, 1],
  };
  arm.collision = {
    geometry: { type: "cylinder", radius: 0.04, length: 0.4 },
    origin: { xyz: [0, 0, 0.2], rpy: [0, 0, 0] },
  };
  arm.inertial = { origin: { xyz: [0, 0, 0.2], rpy: [0, 0, 0] }, mass: 1, inertia: cylinderInertia(1, 0.04, 0.4) };

  const joint = makeJoint("shoulder", base.id, arm.id, "revolute");
  joint.origin = { xyz: [0, 0, 0.1], rpy: [0, 0, 0] };
  joint.axis = [0, 1, 0];
  joint.limit = { lower: -1.57, upper: 1.57, effort: 50, velocity: 1.5 };
  joint.dynamics = { damping: 0.1, friction: 0 };

  return { name: "sample_arm", unit: "m", links: [base, arm], joints: [joint], meshes: [] };
}
