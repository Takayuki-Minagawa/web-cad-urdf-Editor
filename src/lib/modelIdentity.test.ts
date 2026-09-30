import { describe, expect, it } from "vitest";
import { findIdentityIssues } from "./modelIdentity";
import { makeJoint, makeLink } from "./factories";
import { validateModel } from "./validation";
import type { RobotModel } from "../types/robot";

function model(): RobotModel {
  const link = makeLink("base");
  return { name: "robot", unit: "m", links: [link], joints: [], meshes: [] };
}

describe("model identity", () => {
  it("flags all ambiguous entities instead of arbitrarily resolving a duplicate", () => {
    const m = model();
    m.links.push({ ...m.links[0], name: "second" });
    const issues = findIdentityIssues(m);
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.code === "DUP_LINK_ID")).toBe(true);
    expect(validateModel(m).exportReady).toBe(false);
  });

  it("reports duplicate mesh IDs even when an asset is unused", () => {
    const m = model();
    const mesh = { id: "mesh", name: "a.obj", format: "obj" as const, data: "" };
    m.meshes = [mesh, { ...mesh, name: "b.obj" }];
    expect(validateModel(m).errors.map((issue) => issue.code)).toContain("DUP_MESH_ID");
  });

  it("does not conflate IDs from separate kinds", () => {
    const m = model();
    m.joints = [{ ...makeJoint("joint", m.links[0].id, "missing"), id: m.links[0].id }];
    expect(findIdentityIssues(m)).toEqual([]);
  });
});
