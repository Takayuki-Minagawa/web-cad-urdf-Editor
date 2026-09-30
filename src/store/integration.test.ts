import { beforeEach, describe, expect, it } from "vitest";
import { useRobotStore } from "./robotStore";
import { validateModel } from "../lib/validation";
import { buildUrdf } from "../lib/urdf";
import { parseProject, serializeProject } from "../lib/projectIO";
import { buildPackageFiles } from "../lib/package";

describe("store + export integration", () => {
  beforeEach(() => {
    useRobotStore.getState().newModel();
  });

  it("builds a valid 2-link revolute robot end-to-end", () => {
    const s = useRobotStore.getState();
    s.setRobotName("arm_bot");
    const baseId = s.addLink();
    const armId = s.addLink();
    const jointId = s.addJoint(baseId, armId, "revolute");
    expect(jointId).not.toBeNull();

    const model = useRobotStore.getState().model;
    const result = validateModel(model);
    expect(result.exportReady).toBe(true);
    expect(result.errors).toHaveLength(0);

    const xml = buildUrdf(model);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("link").length).toBe(2);
    expect(doc.querySelector('joint[type="revolute"]')).not.toBeNull();
  });

  it("rejects a self-loop joint and a duplicate parent==child", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    expect(s.addJoint(a, a, "revolute")).toBeNull();
  });

  it("cascades joint removal when a link is deleted", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    const b = s.addLink();
    s.addJoint(a, b);
    expect(useRobotStore.getState().model.joints).toHaveLength(1);
    useRobotStore.getState().removeLink(b);
    expect(useRobotStore.getState().model.joints).toHaveLength(0);
    expect(useRobotStore.getState().model.links).toHaveLength(1);
    expect(useRobotStore.getState().selection).toBeNull();
  });

  it("preserves an unrelated selection when deleting a link", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    const b = s.addLink();
    const c = s.addLink();
    const jointId = s.addJoint(a, b)!;
    s.removeLink(c);
    expect(useRobotStore.getState().selection).toEqual({ kind: "joint", id: jointId });
  });

  it("clears mesh ids without deleting visual or collision settings when a mesh asset is deleted", () => {
    const s = useRobotStore.getState();
    const linkId = s.addLink();
    const meshId = s.addMesh({ name: "display.stl", format: "stl", data: "solid empty\nendsolid empty", encoding: "utf8" });
    s.updateLinkVisual(linkId, { geometry: { type: "mesh", meshId, scale: [1, 1, 1] } });
    s.updateLinkCollision(linkId, { geometry: { type: "mesh", meshId, scale: [1, 1, 1] } });
    s.updateLinkVisual(linkId, { origin: { xyz: [1, 2, 3], rpy: [0.1, 0.2, 0.3] }, color: [0.1, 0.2, 0.3, 0.4] });

    useRobotStore.getState().removeMesh(meshId);

    const link = useRobotStore.getState().model.links.find((l) => l.id === linkId)!;
    expect(link.visual?.origin.xyz).toEqual([1, 2, 3]);
    expect(link.visual?.color).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(link.visual?.geometry).toEqual({ type: "mesh", meshId: "", scale: [1, 1, 1] });
    expect(link.collision?.geometry).toEqual({ type: "mesh", meshId: "", scale: [1, 1, 1] });
  });

  it("keeps joint type dependent fields consistent", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    const b = s.addLink();
    const jointId = s.addJoint(a, b, "revolute")!;

    s.setJointType(jointId, "fixed");
    expect(useRobotStore.getState().model.joints[0].limit).toBeUndefined();
    expect(useRobotStore.getState().model.joints[0].dynamics).toBeUndefined();

    s.setJointType(jointId, "prismatic");
    expect(useRobotStore.getState().model.joints[0].limit).toBeDefined();
    expect(useRobotStore.getState().model.joints[0].dynamics).toBeDefined();
  });

  it("allows invalid joint endpoint edits so validation can report them", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    const b = s.addLink();
    const jointId = s.addJoint(a, b, "revolute")!;

    s.updateJoint(jointId, { child: a });
    expect(useRobotStore.getState().model.joints[0].child).toBe(a);
    expect(validateModel(useRobotStore.getState().model).errors.map((e) => e.code)).toContain("JOINT_SELF_LOOP");

    s.updateJoint(jointId, { parent: "missing_link" });
    expect(useRobotStore.getState().model.joints[0].parent).toBe("missing_link");
    expect(validateModel(useRobotStore.getState().model).errors.map((e) => e.code)).toContain("JOINT_BAD_PARENT");
  });

  it("round-trips the project through save/load", () => {
    const s = useRobotStore.getState();
    s.setRobotName("rt");
    s.addLink();
    s.addLink();
    const before = useRobotStore.getState().model;
    const text = serializeProject(before);
    const after = parseProject(text);
    expect(after).toEqual(before);
  });

  it("package contains all required entries for a built model", () => {
    const s = useRobotStore.getState();
    const a = s.addLink();
    const b = s.addLink();
    s.addJoint(a, b);
    const files = buildPackageFiles(useRobotStore.getState().model);
    for (const f of ["robot.urdf", "preview_pybullet.py", "robot_model.json", "validation_report.json"]) {
      expect(files[f]).toBeTruthy();
    }
  });
});
