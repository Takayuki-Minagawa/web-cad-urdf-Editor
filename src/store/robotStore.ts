import { create } from "zustand";
import {
  type CollisionSpec,
  type GeometryKind,
  type Inertia,
  type InertialSpec,
  type JointDynamics,
  type JointLimit,
  type JointSpec,
  type JointType,
  type LinkSpec,
  type MeshAsset,
  type RobotModel,
  type VisualSpec,
} from "../types/robot";
import { makeId, uniqueName } from "../lib/ids";
import { DEFAULT_JOINT_DYNAMICS, DEFAULT_JOINT_LIMIT, defaultGeometry, makeJoint, makeLink } from "../lib/factories";

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
  addPrimitiveLink: (kind: GeometryKind) => string;
  updateLink: (id: string, patch: Partial<Omit<LinkSpec, "id">>) => void;
  setLinkVisual: (id: string, visual: VisualSpec | undefined) => void;
  updateLinkVisual: (id: string, patch: Partial<VisualSpec>) => void;
  setLinkCollision: (id: string, collision: CollisionSpec | undefined) => void;
  updateLinkCollision: (id: string, patch: Partial<CollisionSpec>) => void;
  updateLinkInertial: (id: string, patch: Partial<InertialSpec>) => void;
  updateLinkInertia: (id: string, patch: Partial<Inertia>) => void;
  removeLink: (id: string) => void;

  // joints
  addJoint: (parent: string, child: string, type?: JointType) => string | null;
  updateJoint: (id: string, patch: Partial<Omit<JointSpec, "id">>) => void;
  setJointType: (id: string, type: JointType) => void;
  updateJointLimit: (id: string, patch: Partial<JointLimit>) => void;
  updateJointDynamics: (id: string, patch: Partial<JointDynamics>) => void;
  removeJoint: (id: string) => void;

  // meshes
  addMesh: (mesh: Omit<MeshAsset, "id">) => string;
  updateMesh: (id: string, patch: Partial<Omit<MeshAsset, "id">>) => void;
  removeMesh: (id: string) => void;

  // view
  setView: (patch: Partial<ViewOptions>) => void;
}

export function emptyModel(): RobotModel {
  return { name: "my_robot", unit: "m", links: [], joints: [], meshes: [] };
}

function withoutMeshReference(link: LinkSpec, meshId: string): LinkSpec {
  const visualUsesMesh = link.visual?.geometry.type === "mesh" && link.visual.geometry.meshId === meshId;
  const collisionUsesMesh = link.collision?.geometry.type === "mesh" && link.collision.geometry.meshId === meshId;
  if (!visualUsesMesh && !collisionUsesMesh) return link;
  return {
    ...link,
    visual: visualUsesMesh ? undefined : link.visual,
    collision: collisionUsesMesh ? undefined : link.collision,
  };
}

function blocksSelfLoop(joint: JointSpec): boolean {
  return joint.parent === joint.child;
}

function hasLink(model: RobotModel, id: string): boolean {
  return model.links.some((l) => l.id === id);
}

function hasValidJointEndpoints(model: RobotModel, joint: JointSpec): boolean {
  return !blocksSelfLoop(joint) && hasLink(model, joint.parent) && hasLink(model, joint.child);
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

  addPrimitiveLink: (kind) => {
    const s = get();
    const name = uniqueName(kind, s.model.links.map((l) => l.name));
    const link = makeLink(name, defaultGeometry(kind));
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

  setLinkVisual: (id, visual) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id ? { ...l, visual } : l)),
      },
    })),

  updateLinkVisual: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id && l.visual ? { ...l, visual: { ...l.visual, ...patch } } : l)),
      },
    })),

  setLinkCollision: (id, collision) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id ? { ...l, collision } : l)),
      },
    })),

  updateLinkCollision: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id && l.collision ? { ...l, collision: { ...l.collision, ...patch } } : l)),
      },
    })),

  updateLinkInertial: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) => (l.id === id ? { ...l, inertial: { ...l.inertial, ...patch } } : l)),
      },
    })),

  updateLinkInertia: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        links: s.model.links.map((l) =>
          l.id === id ? { ...l, inertial: { ...l.inertial, inertia: { ...l.inertial.inertia, ...patch } } } : l,
        ),
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
        joints: s.model.joints.map((j) => {
          if (j.id !== id) return j;
          const next = { ...j, ...patch };
          return hasValidJointEndpoints(s.model, next) ? next : j;
        }),
      },
    })),

  setJointType: (id, type) =>
    set((s) => ({
      model: {
        ...s.model,
        joints: s.model.joints.map((j) => {
          if (j.id !== id) return j;
          return {
            ...j,
            type,
            limit: type === "revolute" || type === "prismatic" ? (j.limit ?? { ...DEFAULT_JOINT_LIMIT }) : undefined,
            dynamics: type === "fixed" ? undefined : (j.dynamics ?? { ...DEFAULT_JOINT_DYNAMICS }),
          };
        }),
      },
    })),

  updateJointLimit: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        joints: s.model.joints.map((j) =>
          j.id === id ? { ...j, limit: { ...(j.limit ?? DEFAULT_JOINT_LIMIT), ...patch } } : j,
        ),
      },
    })),

  updateJointDynamics: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        joints: s.model.joints.map((j) =>
          j.id === id ? { ...j, dynamics: { ...(j.dynamics ?? DEFAULT_JOINT_DYNAMICS), ...patch } } : j,
        ),
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

  updateMesh: (id, patch) =>
    set((s) => ({
      model: {
        ...s.model,
        meshes: s.model.meshes.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      },
    })),

  removeMesh: (id) =>
    set((s) => {
      const selection = s.selection?.kind === "mesh" && s.selection.id === id ? null : s.selection;
      return {
        model: {
          ...s.model,
          meshes: s.model.meshes.filter((m) => m.id !== id),
          links: s.model.links.map((l) => withoutMeshReference(l, id)),
        },
        selection,
      };
    }),

  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
}));
