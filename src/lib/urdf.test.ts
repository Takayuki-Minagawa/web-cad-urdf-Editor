import { describe, expect, it } from "vitest";
import { buildUrdf, fmt, prettyXml } from "./urdf";
import { makeJoint, makeLink } from "./factories";
import { emptyModel } from "../store/robotStore";
import type { RobotModel } from "../types/robot";

function twoLinkModel(): RobotModel {
  const model = emptyModel();
  model.name = "test_bot";
  const base = makeLink("base");
  const arm = makeLink("arm");
  model.links.push(base, arm);
  model.joints.push(makeJoint("shoulder", base.id, arm.id, "revolute"));
  return model;
}

describe("fmt", () => {
  it("strips trailing zeros and avoids -0", () => {
    expect(fmt(0.2)).toBe("0.2");
    expect(fmt(-0)).toBe("0");
    expect(fmt(1)).toBe("1");
    expect(fmt(1.5)).toBe("1.5");
  });

  it("keeps tiny non-zero magnitudes from flushing to 0", () => {
    expect(fmt(1e-7)).toBe("1e-7");
    expect(Number(fmt(1e-7))).toBeCloseTo(1e-7, 12);
    expect(fmt(0)).toBe("0");
  });
});

describe("buildUrdf", () => {
  it("produces parseable XML with robot name", () => {
    const xml = buildUrdf(twoLinkModel());
    expect(xml).toContain('<?xml version="1.0"?>');
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    const robot = doc.querySelector("robot");
    expect(robot?.getAttribute("name")).toBe("test_bot");
  });

  it("emits two links and a joint with parent/child by name", () => {
    const xml = buildUrdf(twoLinkModel());
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelectorAll("link").length).toBe(2);
    const joint = doc.querySelector("joint");
    expect(joint?.getAttribute("type")).toBe("revolute");
    expect(joint?.querySelector("parent")?.getAttribute("link")).toBe("base");
    expect(joint?.querySelector("child")?.getAttribute("link")).toBe("arm");
    expect(joint?.querySelector("axis")).not.toBeNull();
    expect(joint?.querySelector("limit")).not.toBeNull();
  });

  it("writes inertial mass and inertia for each link", () => {
    const xml = buildUrdf(twoLinkModel());
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const inertials = doc.querySelectorAll("inertial");
    expect(inertials.length).toBe(2);
    expect(inertials[0].querySelector("mass")?.getAttribute("value")).toBe("1");
    const inertia = inertials[0].querySelector("inertia");
    expect(Number(inertia?.getAttribute("ixx"))).toBeGreaterThan(0);
  });

  it("emits collision and visual geometry", () => {
    const xml = buildUrdf(twoLinkModel());
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("visual geometry box")).not.toBeNull();
    expect(doc.querySelector("collision geometry box")).not.toBeNull();
  });

  it("uses relative mesh paths when a mesh is referenced", () => {
    const model = twoLinkModel();
    model.meshes.push({ id: "m1", name: "arm.stl", format: "stl", data: "solid x\nendsolid x\n" });
    model.links[1].visual = {
      geometry: { type: "mesh", meshId: "m1", scale: [1, 1, 1] },
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      color: [1, 1, 1, 1],
    };
    const xml = buildUrdf(model);
    expect(xml).toContain('filename="meshes/visual/arm.stl"');
  });

  it("omits axis for fixed joints", () => {
    const model = twoLinkModel();
    model.joints[0] = makeJoint("fix", model.links[0].id, model.links[1].id, "fixed");
    const xml = buildUrdf(model);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("joint")?.querySelector("axis")).toBeNull();
  });
});

describe("prettyXml", () => {
  it("indents nested elements", () => {
    const out = prettyXml("<a><b/></a>");
    expect(out.split("\n").length).toBeGreaterThan(1);
  });
});
