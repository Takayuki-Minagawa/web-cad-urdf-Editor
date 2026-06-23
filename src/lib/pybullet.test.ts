import { describe, expect, it } from "vitest";
import { buildPreviewScript } from "./pybullet";
import { makeJoint, makeLink } from "./factories";
import type { RobotModel } from "../types/robot";

function buildModel(): RobotModel {
  const base = makeLink("base_link");
  const arm = makeLink("arm_link");
  const j = makeJoint("shoulder", base.id, arm.id, "revolute");
  return {
    name: "test_arm",
    unit: "m",
    links: [base, arm],
    joints: [j],
    meshes: [],
  };
}

describe("buildPreviewScript", () => {
  const script = buildPreviewScript(buildModel());

  it("connects to the GUI", () => {
    expect(script).toContain("pybullet.GUI");
  });

  it("loads URDFs", () => {
    expect(script).toContain("loadURDF");
    expect(script).toContain("plane.urdf");
    expect(script).toContain("robot.urdf");
  });

  it("sets gravity", () => {
    expect(script).toContain("setGravity");
  });

  it("creates debug sliders", () => {
    expect(script).toContain("addUserDebugParameter");
  });

  it("wraps loads in a try/except", () => {
    expect(script).toContain("try:");
    expect(script).toContain("except");
  });

  it("injects the model name", () => {
    expect(script).toContain("test_arm");
  });

  it("drives joints with position control", () => {
    expect(script).toContain("setJointMotorControl2");
    expect(script).toContain("POSITION_CONTROL");
  });

  it("imports the needed modules and steps the sim", () => {
    expect(script).toContain("import pybullet");
    expect(script).toContain("import pybullet_data");
    expect(script).toContain("import time");
    expect(script).toContain("stepSimulation");
    expect(script).toContain("setAdditionalSearchPath");
  });

  it("escapes a robot name containing quotes and newlines", () => {
    const m = buildModel();
    m.name = 'evil"\nname';
    const out = buildPreviewScript(m);

    // The name is printed via a fully-escaped Python literal.
    expect(out).toContain(`print("Loaded robot", ${JSON.stringify('evil"\nname')},`);

    // No source line carries a raw newline injected from the name: the comment
    // is collapsed to one line, so the "Auto-generated" comment stays a comment.
    const lines = out.split("\n");
    const commentLine = lines.find((l) => l.startsWith("# Auto-generated PyBullet preview"));
    expect(commentLine).toContain('evil" name');
    // The stray "name" fragment must never appear as its own bare code line.
    expect(lines).not.toContain("name");
  });
});
