import { create } from "zustand";
import {
  type JointSpec,
  type JointType,
  type LinkSpec,
  type MeshAsset,
  type RobotModel,
} from "../types/robot";
import { makeId, uniqueName } from "../lib/ids";
import { makeJoint, makeLink } from "../lib/factories";

export type Selection =
  | { kind: "link"; id: string }
  | { kind: "joint"; id: string }
  | { kind: "mesh"; id: string }
  | null;

export interface ViewOptions {
  showVisual: boolean;
  showCollision: boolean;
  showJointAxes: boolean;
  showCenterOfMass: boolean;
  showGrid: boolean;
}

export interface RobotState {
  model: RobotModel;
  selection: Selection;
  view: ViewOptions;

  // selection
  select: (sel: Selection) => void;

  // model-level
  setRobotName: (name: string) => void;
  loadModel: (model: RobotModel) => void;
  newModel: () => void;

  // links
  addLink: () => string;
  updateLink: (id: string, patch: Partial<LinkSpec>) => void;
  replaceLink: (link: LinkSpec) => void;
  removeLink: (id: string) => void;

  // joints
  addJoint: (parent: string, child: string, type?: JointType) => string | null;
  updateJoint: (id: string, patch: Partial<JointSpec>) => void;
  replaceJoint: (joint: JointSpec) => void;
  removeJoint: (id: string) => void;

  // meshes
  addMesh: (mesh: Omit<MeshAsset, "id">) => string;
  removeMesh: (id: string) => void;

  // view
  setView: (patch: Partial<ViewOptions>) => void;
}

export function emptyModel(): RobotModel {
  return { name: "my_robot", unit: "m", links: [], joints: [], meshes: [] };
}

export const useRobotStore = create<RobotState>((set, get) => ({
  model: emptyModel(),
  selection: null,
  view: {
    showVisual: true,
    showCollision: false,
    showJointAxes: true,
    showCenterOfMass: false,
    showGrid: true,
  },

  select: (sel) => set({ selection: sel }),

  setRobotName: (name) => set((s) => ({ model: { ...s.model, name } })),

  loadModel: (model) => set({ model, selection: null }),

  newModel: () => set({ model: emptyModel(), selection: null }),

  addLink: () => {
    const s = get();
    const name = uniqueName("link", s.model.links.map((l) => l.name));
    const link = makeLink(name);
    set({
      model: { ...s.model, links: [...s.model.links, link] },
      selection: { kind: "link", id: link.id },
    });
    return link.id;
  },

  updateLink: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    })),

  replaceLink: (link) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === link.id ? link : l)),
      },
    })),

  removeLink: (id) =>
    set((s) => {
      const joints = s.model.joints.filter((j) => j.parent !== id && j.child !== id);
      const links = s.model.links.filter((l) => l.id !== id);
      const sel = s.selection?.kind === "link" && s.selection.id === id ? null : s.selection;
      return { model: { ...s.model, links, joints }, selection: sel };
    }),

  addJoint: (parent, child, type = "revolute") => {
    const s = get();
    if (parent === child) return null;
    if (!s.model.links.some((l) => l.id === parent)) return null;
    if (!s.model.links.some((l) => l.id === child)) return null;
    const name = uniqueName("joint", s.model.joints.map((j) => j.name));
    const joint = makeJoint(name, parent, child, type);
    set({
      model: { ...s.model, joints: [...s.model.joints, joint] },
      selection: { kind: "joint", id: joint.id },
    });
    return joint.id;
  },

  updateJoint: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        joints: s.model.joints.map((j) => (j.id === id ? { ...j, ...patch } : j)),
      },
    })),

  replaceJoint: (joint) =>
    set((s) => ({
      model: {
        ...s.model,
        joints: s.model.joints.map((j) => (j.id === joint.id ? joint : j)),
      },
    })),

  removeJoint: (id) =>
    set((s) => {
      const sel = s.selection?.kind === "joint" && s.selection.id === id ? null : s.selection;
      return {
        model: { ...s.model, joints: s.model.joints.filter((j) => j.id !== id) },
        selection: sel,
      };
    }),

  addMesh: (mesh) => {
    const id = makeId("mesh");
    set((s) => ({ model: { ...s.model, meshes: [...s.model.meshes, { ...mesh, id }] } }));
    return id;
  },

  removeMesh: (id) =>
    set((s) => ({
      model: { ...s.model, meshes: s.model.meshes.filter((m) => m.id !== id) },
    })),

  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
}));
