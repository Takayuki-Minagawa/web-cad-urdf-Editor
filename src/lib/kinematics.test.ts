import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { makeJoint, makeLink } from "./factories";
import { computeLinkWorldTransforms, jointPreviewPosition, jointPreviewRange, normalizedJointAxis } from "./kinematics";
import type { JointSpec, RobotModel, Vec3 } from "../types/robot";

function fixture(type: JointSpec["type"] = "continuous") {
  const base = makeLink("base");
  const child = makeLink("child");
  const joint = makeJoint("joint", base.id, child.id, type);
  const model: RobotModel = { name: "test", unit: "m", links: [base, child], joints: [joint], meshes: [] };
  return { model, base, child, joint };
}

function expectPoint(matrix: Matrix4, point: Vec3, expected: Vec3) {
  const actual = new Vector3(...point).applyMatrix4(matrix);
  actual.toArray().forEach((value, i) => expect(value).toBeCloseTo(expected[i], 10));
}

describe("preview forward kinematics", () => {
  it("rotates around the normalized joint axis after the joint origin", () => {
    const { model, child, joint } = fixture();
    joint.axis = [0, 0, 4];
    joint.origin = { xyz: [2, 3, 4], rpy: [Math.PI / 2, 0, 0] };
    const matrix = computeLinkWorldTransforms(model, { [joint.id]: Math.PI / 2 }).get(child.id)!;
    expectPoint(matrix, [0, 0, 0], [2, 3, 4]);
    expectPoint(matrix, [1, 0, 0], [2, 3, 5]);
  });

  it("translates along the axis in the rotated joint frame", () => {
    const { model, child, joint } = fixture("prismatic");
    joint.axis = [2, 0, 0];
    joint.origin = { xyz: [1, 2, 3], rpy: [0, 0, Math.PI / 2] };
    const matrix = computeLinkWorldTransforms(model, { [joint.id]: 0.5 }).get(child.id)!;
    expectPoint(matrix, [0, 0, 0], [1, 2.5, 3]);
  });

  it("propagates rotation and translation through a mixed joint chain", () => {
    const { model, child, joint } = fixture();
    const tip = makeLink("tip");
    const slider = makeJoint("slider", child.id, tip.id, "prismatic");
    slider.axis = [1, 0, 0];
    slider.origin.xyz = [1, 0, 0];
    model.links.push(tip);
    model.joints.push(slider);
    const matrix = computeLinkWorldTransforms(model, { [joint.id]: Math.PI / 2, [slider.id]: 0.5 }).get(tip.id)!;
    expectPoint(matrix, [0, 0, 0], [0, 1.5, 0]);
  });

  it("respects fixed joints, clamps bounded joints, and ignores nonfinite preview values", () => {
    const { model, child, joint } = fixture("revolute");
    joint.limit = { lower: -0.5, upper: 0.75, effort: 1, velocity: 1 };
    expect(jointPreviewPosition(joint, -100)).toBe(-0.5);
    expect(jointPreviewPosition(joint, 100)).toBe(0.75);
    expect(jointPreviewPosition(joint, NaN)).toBe(0);
    expect(jointPreviewPosition(joint, Infinity)).toBe(0);
    joint.type = "fixed";
    expectPoint(computeLinkWorldTransforms(model, { [joint.id]: 1 }).get(child.id)!, [1, 0, 0], [1, 0, 0]);
  });

  it("uses one full turn for continuous controls and the valid position nearest zero on reset", () => {
    const { joint } = fixture();
    expect(jointPreviewRange(joint)).toEqual({ min: -Math.PI, max: Math.PI });
    expect(jointPreviewPosition(joint, 50)).toBe(Math.PI);
    joint.type = "prismatic";
    joint.limit = { lower: 1, upper: 2, effort: 1, velocity: 1 };
    expect(jointPreviewPosition(joint)).toBe(1);
    joint.limit = { ...joint.limit, lower: -2, upper: -1 };
    expect(jointPreviewPosition(joint)).toBe(-1);
    joint.limit = { ...joint.limit, lower: 0.25, upper: 0.25 };
    expect(jointPreviewPosition(joint, 1)).toBe(0.25);
  });

  it("disables missing, reversed and nonfinite limits", () => {
    const { joint } = fixture("revolute");
    joint.limit = undefined;
    expect(jointPreviewRange(joint)).toBeNull();
    joint.limit = { lower: 2, upper: -2, effort: 1, velocity: 1 };
    expect(jointPreviewRange(joint)).toBeNull();
    joint.limit.upper = Infinity;
    expect(jointPreviewRange(joint)).toBeNull();
  });

  it.each<Vec3>([[0, 0, 0], [NaN, 0, 1], [0, Infinity, 1]])("keeps invalid axes stationary (%j)", (...axis) => {
    const { model, child, joint } = fixture();
    joint.axis = axis;
    expect(jointPreviewRange(joint)).toBeNull();
    const matrix = computeLinkWorldTransforms(model, { [joint.id]: 1 }).get(child.id)!;
    expect(matrix.elements.every(Number.isFinite)).toBe(true);
    expectPoint(matrix, [1, 2, 3], [1, 2, 3]);
  });

  it("normalizes very large and very small finite axes without overflow", () => {
    expect(normalizedJointAxis([Number.MAX_VALUE, Number.MAX_VALUE, 0])!.length()).toBeCloseTo(1);
    expect(normalizedJointAxis([Number.MIN_VALUE, 0, 0])!.toArray()).toEqual([1, 0, 0]);
  });

  it("handles disconnected cycles, multiple parents and missing endpoints deterministically", () => {
    const { model, base, child, joint } = fixture("fixed");
    joint.origin.xyz = [1, 0, 0];
    const disconnected = makeLink("disconnected");
    model.links.push(disconnected);
    model.joints.push(makeJoint("cycle", child.id, base.id, "fixed"));
    model.joints.push(makeJoint("another_parent", disconnected.id, child.id, "fixed"));
    model.joints.push(makeJoint("missing", "missing", "also_missing", "fixed"));
    const world = computeLinkWorldTransforms(model);
    expect(world.size).toBe(3);
    expect([...world.values()].every((matrix) => matrix.elements.every(Number.isFinite))).toBe(true);
    expect(computeLinkWorldTransforms(model)).toEqual(world);
  });

  it("walks a deep chain without recursive stack overflow", () => {
    const { model, base, joint } = fixture("fixed");
    const depth = 12000;
    model.links = Array.from({ length: depth }, (_, i) => ({ ...base, id: `link_${i}` }));
    model.joints = Array.from({ length: depth - 1 }, (_, i) => ({
      ...joint, id: `joint_${i}`, parent: `link_${i}`, child: `link_${i + 1}`,
      origin: { xyz: [1, 0, 0] as Vec3, rpy: [0, 0, 0] as Vec3 },
    }));
    const world = computeLinkWorldTransforms(model);
    expect(world.size).toBe(depth);
    expectPoint(world.get(`link_${depth - 1}`)!, [0, 0, 0], [depth - 1, 0, 0]);
  });
});
