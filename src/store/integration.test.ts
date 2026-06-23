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
