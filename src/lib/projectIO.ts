// Save/load the project as JSON. The on-disk file (`robot_model.json`) wraps the
// RobotModel together with a schema version so older files can be migrated.

import {
  type CollisionSpec,
  type GeometrySpec,
  type Inertia,
  type InertialSpec,
  type JointDynamics,
  type JointLimit,
  type JointSpec,
  type JointType,
  type LinkSpec,
  type MeshAsset,
  type Pose,
  type Rgba,
  type RobotModel,
  type Vec3,
  type VisualSpec,
} from "../types/robot";
import { DEFAULT_COLOR, defaultGeometry, makeInertial } from "./factories";
import { findIdentityIssues } from "./modelIdentity";

export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectFile {
  schemaVersion: number;
  model: RobotModel;
}

/** Serialize a model into a pretty-printed project JSON string. */
export function serializeProject(model: RobotModel): string {
  const file: ProjectFile = { schemaVersion: PROJECT_SCHEMA_VERSION, model };
  return JSON.stringify(file, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  return !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isJointType(value: unknown): value is JointType {
  return value === "fixed" || value === "revolute" || value === "continuous" || value === "prismatic";
}

function parseVec3(value: unknown, fallback: Vec3): Vec3 {
  if (Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)) {
    return [value[0], value[1], value[2]];
  }
  return [...fallback];
}

function parsePose(value: unknown): Pose {
  if (!isObject(value)) return { xyz: [0, 0, 0], rpy: [0, 0, 0] };
  return {
    xyz: parseVec3(value.xyz, [0, 0, 0]),
    rpy: parseVec3(value.rpy, [0, 0, 0]),
  };
}

function parseGeometry(value: unknown): GeometrySpec {
  if (!isObject(value) || typeof value.type !== "string") return defaultGeometry("box");
  switch (value.type) {
    case "box":
      return { type: "box", size: parseVec3(value.size, [0.2, 0.2, 0.2]) };
    case "sphere":
      return { type: "sphere", radius: isFiniteNumber(value.radius) ? value.radius : 0.1 };
    case "cylinder": {
      return {
        type: "cylinder",
        radius: isFiniteNumber(value.radius) ? value.radius : 0.05,
        length: isFiniteNumber(value.length) ? value.length : 0.2,
      };
    }
    case "mesh":
      return {
        type: "mesh",
        meshId: typeof value.meshId === "string" ? value.meshId : "",
        scale: parseVec3(value.scale, [1, 1, 1]),
      };
    default:
      return defaultGeometry("box");
  }
}

function parseRgba(value: unknown): Rgba {
  if (Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber)) {
    return [value[0], value[1], value[2], value[3]];
  }
  return [...DEFAULT_COLOR];
}

function parseVisual(value: unknown): VisualSpec | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) return undefined;
  return {
    geometry: parseGeometry(value.geometry),
    origin: parsePose(value.origin),
    color: parseRgba(value.color),
  };
}

function parseCollision(value: unknown): CollisionSpec | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) return undefined;
  return {
    geometry: parseGeometry(value.geometry),
    origin: parsePose(value.origin),
  };
}

function parseInertia(value: unknown, fallback: Inertia): Inertia {
  if (!isObject(value)) return { ...fallback };
  return {
    ixx: isFiniteNumber(value.ixx) ? value.ixx : fallback.ixx,
    ixy: isFiniteNumber(value.ixy) ? value.ixy : 0,
    ixz: isFiniteNumber(value.ixz) ? value.ixz : 0,
    iyy: isFiniteNumber(value.iyy) ? value.iyy : fallback.iyy,
    iyz: isFiniteNumber(value.iyz) ? value.iyz : 0,
    izz: isFiniteNumber(value.izz) ? value.izz : fallback.izz,
  };
}

function parseInertial(value: unknown): InertialSpec {
  const fallback = makeInertial();
  if (!isObject(value)) return fallback;
  return {
    origin: parsePose(value.origin),
    mass: isFiniteNumber(value.mass) ? value.mass : fallback.mass,
    inertia: parseInertia(value.inertia, fallback.inertia),
  };
}

function parseJointLimit(value: unknown): JointLimit | undefined {
  if (!isObject(value)) return undefined;
  return {
    lower: isFiniteNumber(value.lower) ? value.lower : 0,
    upper: isFiniteNumber(value.upper) ? value.upper : 0,
    effort: isFiniteNumber(value.effort) ? value.effort : 0,
    velocity: isFiniteNumber(value.velocity) ? value.velocity : 0,
  };
}

function parseJointDynamics(value: unknown): JointDynamics | undefined {
  if (!isObject(value)) return undefined;
  return {
    damping: isFiniteNumber(value.damping) ? value.damping : 0,
    friction: isFiniteNumber(value.friction) ? value.friction : 0,
  };
}

function normalizeLink(value: unknown, index: number): LinkSpec {
  if (!isObject(value)) throw new Error(`Invalid project file: link[${index}] must be an object`);
  if (typeof value.id !== "string") throw new Error(`Invalid project file: link[${index}].id must be a string`);
  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : value.id,
    visual: parseVisual(value.visual),
    collision: parseCollision(value.collision),
    inertial: parseInertial(value.inertial),
  };
}

function normalizeJoint(value: unknown, index: number): JointSpec {
  if (!isObject(value)) throw new Error(`Invalid project file: joint[${index}] must be an object`);
  const id = typeof value.id === "string" ? value.id : `joint_${index}`;
  return {
    id,
    name: typeof value.name === "string" ? value.name : id,
    type: isJointType(value.type) ? value.type : "fixed",
    parent: typeof value.parent === "string" ? value.parent : "",
    child: typeof value.child === "string" ? value.child : "",
    origin: parsePose(value.origin),
    axis: parseVec3(value.axis, [0, 0, 1]),
    limit: parseJointLimit(value.limit),
    dynamics: parseJointDynamics(value.dynamics),
  };
}

function normalizeMesh(value: unknown, index: number): MeshAsset {
  if (!isObject(value)) throw new Error(`Invalid project file: mesh[${index}] must be an object`);
  const id = typeof value.id === "string" ? value.id : `mesh_${index}`;
  return {
    id,
    name: typeof value.name === "string" ? value.name : id,
    format: value.format === "obj" ? "obj" : "stl",
    data: typeof value.data === "string" ? value.data : "",
    encoding: value.encoding === "base64" ? "base64" : value.encoding === "utf8" ? "utf8" : undefined,
  };
}

export function normalizeProjectModel(value: unknown): RobotModel {
  if (!isObject(value)) throw new Error("Invalid project file: expected a model object");
  if (!Array.isArray(value.links)) throw new Error('Invalid project file: model.links must be an array');
  if (!Array.isArray(value.joints)) throw new Error('Invalid project file: model.joints must be an array');
  if (!Array.isArray(value.meshes)) throw new Error('Invalid project file: model.meshes must be an array');
  if (value.unit !== undefined && value.unit !== "m") throw new Error('Invalid project file: model.unit must be "m"');

  const model: RobotModel = {
    name: typeof value.name === "string" ? value.name : "my_robot",
    unit: "m",
    links: value.links.map(normalizeLink),
    joints: value.joints.map(normalizeJoint),
    meshes: value.meshes.map(normalizeMesh),
  };
  const identityIssues = findIdentityIssues(model);
  if (identityIssues.length > 0) {
    throw new Error(`Invalid project file: ${identityIssues[0].message}`);
  }
  return model;
}

/**
 * Parse project JSON into a RobotModel. Accepts either a wrapped
 * `{ schemaVersion, model }` file or a raw model object. Throws a descriptive
 * Error if the text is not valid JSON or does not contain a usable model.
 */
export function parseProject(text: string): RobotModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid project file: not valid JSON (${detail})`);
  }

  if (!isObject(parsed)) {
    throw new Error("Invalid project file: expected a JSON object");
  }

  // Legacy raw models and unversioned wrappers remain supported. Explicit
  // versions must be understood before normalization can safely interpret them.
  if ("schemaVersion" in parsed && parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version: ${String(parsed.schemaVersion)} (expected ${PROJECT_SCHEMA_VERSION})`);
  }
  const candidate = "model" in parsed || "schemaVersion" in parsed ? parsed.model : parsed;

  return normalizeProjectModel(candidate);
}
