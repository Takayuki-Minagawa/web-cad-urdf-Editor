import { describe, expect, it } from "vitest";
import { buildPackageFiles } from "./package";
import { makeJoint, makeLink } from "./factories";
import { emptyModel } from "../store/robotStore";

function model() {
  const m = emptyModel();
  const a = makeLink("base");
  const b = makeLink("arm");
  m.links.push(a, b);
  m.joints.push(makeJoint("j", a.id, b.id, "revolute"));
  m.meshes.push({ id: "m1", name: "arm.stl", format: "stl", data: "solid x\nendsolid x\n" });
  m.links[1].visual = {
    geometry: { type: "mesh", meshId: "m1", scale: [1, 1, 1] },
    origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
    color: [1, 1, 1, 1],
  };
  return m;
}

describe("buildPackageFiles", () => {
  it("includes all required package entries", () => {
    const files = buildPackageFiles(model());
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "robot.urdf",
        "preview_pybullet.py",
        "robot_model.json",
        "validation_report.json",
        "README.txt",
      ]),
    );
  });

  it("writes referenced mesh files under meshes/visual", () => {
    const files = buildPackageFiles(model());
    expect(files["meshes/visual/arm.stl"]).toContain("solid x");
  });

  it("validation_report.json is valid JSON with exportReady flag", () => {
    const files = buildPackageFiles(model());
    const report = JSON.parse(files["validation_report.json"]);
    expect(report).toHaveProperty("exportReady");
    expect(report).toHaveProperty("errors");
  });

  it("does not emit mesh files for unreferenced meshes", () => {
    const m = model();
    m.meshes.push({ id: "unused", name: "ghost.obj", format: "obj", data: "o x\n" });
    const files = buildPackageFiles(m);
    expect(files["meshes/visual/ghost.obj"]).toBeUndefined();
  });
});
