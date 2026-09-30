import { beforeEach, describe, expect, it } from "vitest";
import { buildPackageFiles } from "../lib/package";
import { serializeProject } from "../lib/projectIO";
import { buildUrdf } from "../lib/urdf";
import { usePreviewStore } from "./previewStore";
import { useRobotStore } from "./robotStore";

function fixture() {
  const store = useRobotStore.getState();
  const parent = store.addLink();
  const child = store.addLink();
  const id = store.addJoint(parent, child, "revolute")!;
  return { store, id, parent, child };
}

describe("transient joint preview state", () => {
  beforeEach(() => { useRobotStore.getState().newModel(); });

  it("clamps inputs, ignores missing joints/nonfinite input, and resets all positions", () => {
    const { store, id } = fixture();
    store.updateJointLimit(id, { lower: -0.5, upper: 0.5 });
    usePreviewStore.getState().setPosition(id, 10);
    expect(usePreviewStore.getState().positions[id]).toBe(0.5);
    usePreviewStore.getState().setPosition(id, NaN);
    usePreviewStore.getState().setPosition("missing", 1);
    expect(usePreviewStore.getState().positions).toEqual({ [id]: 0.5 });
    usePreviewStore.getState().reset();
    expect(usePreviewStore.getState().positions).toEqual({});
  });

  it("preserves posing during selection and unrelated model edits", () => {
    const { store, id, parent } = fixture();
    usePreviewStore.getState().setPosition(id, 0.4);
    store.select(null);
    store.setRobotName("renamed");
    store.updateLink(parent, { name: "new_name" });
    store.updateJoint(id, { name: "new_joint" });
    expect(usePreviewStore.getState().positions[id]).toBe(0.4);
  });

  it("resets when the same model object is reloaded, a different project is loaded, or a new project starts", () => {
    const { store, id } = fixture();
    const model = useRobotStore.getState().model;
    usePreviewStore.getState().setPosition(id, 0.4);
    store.loadModel(model);
    expect(usePreviewStore.getState().positions).toEqual({});
    usePreviewStore.getState().setPosition(id, 0.4);
    store.loadModel({ ...model, name: "different" });
    expect(usePreviewStore.getState().positions).toEqual({});
    usePreviewStore.getState().setPosition(id, 0.4);
    store.newModel();
    expect(usePreviewStore.getState().positions).toEqual({});
  });

  it("drops positions when a joint or its link is removed", () => {
    const { store, id, parent, child } = fixture();
    usePreviewStore.getState().setPosition(id, 0.4);
    store.removeJoint(id);
    expect(usePreviewStore.getState().positions).toEqual({});
    const next = store.addJoint(parent, child)!;
    usePreviewStore.getState().setPosition(next, 0.4);
    store.removeLink(child);
    expect(usePreviewStore.getState().positions).toEqual({});
  });

  it("resets changed joint types and clamps after limit edits", () => {
    const { store, id } = fixture();
    usePreviewStore.getState().setPosition(id, 1);
    store.updateJointLimit(id, { upper: 0.25 });
    expect(usePreviewStore.getState().positions[id]).toBe(0.25);
    store.updateJointLimit(id, { lower: 1 });
    expect(usePreviewStore.getState().positions[id]).toBe(0);
    store.updateJointLimit(id, { lower: -1, upper: 1 });
    usePreviewStore.getState().setPosition(id, 0.75);
    store.setJointType(id, "prismatic");
    expect(usePreviewStore.getState().positions[id]).toBeUndefined();
    usePreviewStore.getState().setPosition(id, 0.5);
    store.setJointType(id, "fixed");
    expect(usePreviewStore.getState().positions[id]).toBeUndefined();
  });

  it("clears motion when an axis becomes invalid", () => {
    const { store, id } = fixture();
    usePreviewStore.getState().setPosition(id, 0.8);
    store.updateJoint(id, { axis: [0, 0, 0] });
    expect(usePreviewStore.getState().positions[id]).toBe(0);
  });

  it("does not change model identity, saved JSON, URDF, or packaged export", () => {
    const { id } = fixture();
    const model = useRobotStore.getState().model;
    const json = serializeProject(model);
    const urdf = buildUrdf(model);
    const files = buildPackageFiles(model);
    usePreviewStore.getState().setPosition(id, 1.2);
    expect(useRobotStore.getState().model).toBe(model);
    expect(serializeProject(model)).toBe(json);
    expect(buildUrdf(model)).toBe(urdf);
    expect(buildPackageFiles(model)).toEqual(files);
  });
});
