import { create } from "zustand";
import {
  type CollisionSpec,
  type GeometrySpec,
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
import { disposeAllCachedMeshGeometries, disposeCachedMeshGeometry } from "../lib/meshGeometryCache";

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
  /** Changes on project replacement, even when loading the same model object. */
  modelRevision: number;
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

function unlinkMeshGeometry(geometry: GeometrySpec): GeometrySpec {
  if (geometry.type !== "mesh") return geometry;
  return { ...geometry, meshId: "" };
}

function withoutMeshReference(link: LinkSpec, meshId: string): LinkSpec {
  const visualUsesMesh = link.visual?.geometry.type === "mesh" && link.visual.geometry.meshId === meshId;
  const collisionUsesMesh = link.collision?.geometry.type === "mesh" && link.collision.geometry.meshId === meshId;
  if (!visualUsesMesh && !collisionUsesMesh) return link;
  return {
    ...link,
    visual: visualUsesMesh && link.visual ? { ...link.visual, geometry: unlinkMeshGeometry(link.visual.geometry) } : link.visual,
    collision: collisionUsesMesh && link.collision ? { ...link.collision, geometry: unlinkMeshGeometry(link.collision.geometry) } : link.collision,
  };
}

function mapLinkById(model: RobotModel, id: string, update: (link: LinkSpec) => LinkSpec): RobotModel {
  return {
    ...model,
    links: model.links.map((link) => (link.id === id ? update(link) : link)),
  };
}

function mapJointById(model: RobotModel, id: string, update: (joint: JointSpec) => JointSpec): RobotModel {
  return {
    ...model,
    joints: model.joints.map((joint) => (joint.id === id ? update(joint) : joint)),
  };
}

function appendLink(model: RobotModel, baseName: string, geometry = defaultGeometry("box")) {
  const name = uniqueName(baseName, model.links.map((l) => l.name));
  const link = makeLink(name, geometry);
  return { link, model: { ...model, links: [...model.links, link] } };
}

export const useRobotStore = create<RobotState>((set, get) => ({
  model: emptyModel(),
  modelRevision: 0,
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

  loadModel: (model) => {
    disposeAllCachedMeshGeometries();
    set((s) => ({ model, modelRevision: s.modelRevision + 1, selection: null }));
  },

  newModel: () => {
    disposeAllCachedMeshGeometries();
    set((s) => ({ model: emptyModel(), modelRevision: s.modelRevision + 1, selection: null }));
  },

  addLink: () => {
    const s = get();
    const { link, model } = appendLink(s.model, "link");
    set({
      model,
      selection: { kind: "link", id: link.id },
    });
    return link.id;
  },

  addPrimitiveLink: (kind) => {
    const s = get();
    const { link, model } = appendLink(s.model, kind, defaultGeometry(kind));
    set({
      model,
      selection: { kind: "link", id: link.id },
    });
    return link.id;
  },

  updateLink: (id, patch) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => ({ ...link, ...patch })),
    })),

  setLinkVisual: (id, visual) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => ({ ...link, visual })),
    })),

  updateLinkVisual: (id, patch) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => (link.visual ? { ...link, visual: { ...link.visual, ...patch } } : link)),
    })),

  setLinkCollision: (id, collision) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => ({ ...link, collision })),
    })),

  updateLinkCollision: (id, patch) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) =>
        link.collision ? { ...link, collision: { ...link.collision, ...patch } } : link,
      ),
    })),

  updateLinkInertial: (id, patch) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => ({ ...link, inertial: { ...link.inertial, ...patch } })),
    })),

  updateLinkInertia: (id, patch) =>
    set((s) => ({
      model: mapLinkById(s.model, id, (link) => ({
        ...link,
        inertial: { ...link.inertial, inertia: { ...link.inertial.inertia, ...patch } },
      })),
    })),

  removeLink: (id) =>
    set((s) => {
      const joints = s.model.joints.filter((j) => j.parent !== id && j.child !== id);
      const links = s.model.links.filter((l) => l.id !== id);
      const selectedItemRemoved =
        (s.selection?.kind === "link" && s.selection.id === id) ||
        (s.selection?.kind === "joint" && !joints.some((joint) => joint.id === s.selection?.id));
      const sel = selectedItemRemoved ? null : s.selection;
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
      model: mapJointById(s.model, id, (joint) => ({ ...joint, ...patch })),
    })),

  setJointType: (id, type) =>
    set((s) => ({
      model: mapJointById(s.model, id, (joint) => ({
        ...joint,
        type,
        limit: type === "revolute" || type === "prismatic" ? (joint.limit ?? { ...DEFAULT_JOINT_LIMIT }) : undefined,
        dynamics: type === "fixed" ? undefined : (joint.dynamics ?? { ...DEFAULT_JOINT_DYNAMICS }),
      })),
    })),

  updateJointLimit: (id, patch) =>
    set((s) => ({
      model: mapJointById(s.model, id, (joint) => ({ ...joint, limit: { ...(joint.limit ?? DEFAULT_JOINT_LIMIT), ...patch } })),
    })),

  updateJointDynamics: (id, patch) =>
    set((s) => ({
      model: mapJointById(s.model, id, (joint) => ({
        ...joint,
        dynamics: { ...(joint.dynamics ?? DEFAULT_JOINT_DYNAMICS), ...patch },
      })),
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
      disposeCachedMeshGeometry(id);
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
