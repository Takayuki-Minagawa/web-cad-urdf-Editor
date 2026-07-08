import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  parseProject,
  serializeProject,
} from "./projectIO";
import { makeJoint, makeLink } from "./factories";
import type { RobotModel } from "../types/robot";

function buildModel(): RobotModel {
  const base = makeLink("base_link");
  const arm = makeLink("arm_link");
  const j = makeJoint("shoulder", base.id, arm.id, "revolute");
  return {
    name: "round_trip_robot",
    unit: "m",
    links: [base, arm],
    joints: [j],
    meshes: [],
  };
}

describe("projectIO", () => {
  it("round-trips a model through serialize -> parse", () => {
    const model = buildModel();
    const text = serializeProject(model);
    const back = parseProject(text);
    expect(back).toEqual(model);
  });

  it("writes the current schema version", () => {
    const text = serializeProject(buildModel());
    const obj = JSON.parse(text);
    expect(obj.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });

  it("accepts a raw model object", () => {
    const model = buildModel();
    const raw = JSON.stringify(model);
    const back = parseProject(raw);
    expect(back).toEqual(model);
  });

  it("throws on an empty object", () => {
    expect(() => parseProject("{}")).toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseProject("not json {")).toThrow();
  });

  it("throws when model fields are missing", () => {
    expect(() => parseProject(JSON.stringify({ model: { links: [] } }))).toThrow();
  });

  it("normalizes a mildly malformed nested link shape", () => {
    const model = buildModel();
    const broken = {
      ...model,
      name: undefined,
      links: [{ ...model.links[0], inertial: { origin: model.links[0].inertial.origin, inertia: { ixx: 1, iyy: 2, izz: 3 }, mass: "heavy" } }],
    };
    const parsed = parseProject(JSON.stringify(broken));
    expect(parsed.name).toBe("my_robot");
    expect(parsed.links[0].inertial.mass).toBe(1);
    expect(parsed.links[0].inertial.inertia).toEqual({ ixx: 1, ixy: 0, ixz: 0, iyy: 2, iyz: 0, izz: 3 });
  });

  it("accepts unknown schemaVersion values when the model can be normalized", () => {
    const parsed = parseProject(JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION + 1, model: buildModel() }));
    expect(parsed.name).toBe("round_trip_robot");
  });
});
