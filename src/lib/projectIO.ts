// Save/load the project as JSON. The on-disk file (`robot_model.json`) wraps the
// RobotModel together with a schema version so older files can be migrated.

import type { GeometrySpec, JointType, MeshAsset, Pose, RobotModel, Vec3 } from "../types/robot";

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

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function isPose(value: unknown): value is Pose {
  if (!isObject(value)) return false;
  return isVec3(value.xyz) && isVec3(value.rpy);
}

function isGeometry(value: unknown): value is GeometrySpec {
  if (!isObject(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "box":
      return isVec3(value.size);
    case "sphere":
      return isFiniteNumber(value.radius);
    case "cylinder":
      return isFiniteNumber(value.radius) && isFiniteNumber(value.length);
    case "mesh":
      return typeof value.meshId === "string" && isVec3(value.scale);
    default:
      return false;
  }
}

function isRgba(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);
}

function isVisual(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isGeometry(value.geometry) && isPose(value.origin) && isRgba(value.color);
}

function isCollision(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isGeometry(value.geometry) && isPose(value.origin);
}

function isInertia(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isFiniteNumber(value.ixx) &&
    isFiniteNumber(value.ixy) &&
    isFiniteNumber(value.ixz) &&
    isFiniteNumber(value.iyy) &&
    isFiniteNumber(value.iyz) &&
    isFiniteNumber(value.izz)
  );
}

function isInertial(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isPose(value.origin) && isFiniteNumber(value.mass) && isInertia(value.inertia);
}

function isLink(value: unknown): boolean {
  if (!isObject(value)) return false;
  const visualOk = value.visual === undefined || isVisual(value.visual);
  const collisionOk = value.collision === undefined || isCollision(value.collision);
  return typeof value.id === "string" && typeof value.name === "string" && visualOk && collisionOk && isInertial(value.inertial);
}

function isJointType(value: unknown): value is JointType {
  return value === "fixed" || value === "revolute" || value === "continuous" || value === "prismatic";
}

function isJointLimit(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isFiniteNumber(value.lower) && isFiniteNumber(value.upper) && isFiniteNumber(value.effort) && isFiniteNumber(value.velocity);
}

function isJointDynamics(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isFiniteNumber(value.damping) && isFiniteNumber(value.friction);
}

function isJoint(value: unknown): boolean {
  if (!isObject(value)) return false;
  const limitOk = value.limit === undefined || isJointLimit(value.limit);
  const dynamicsOk = value.dynamics === undefined || isJointDynamics(value.dynamics);
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isJointType(value.type) &&
    typeof value.parent === "string" &&
    typeof value.child === "string" &&
    isPose(value.origin) &&
    isVec3(value.axis) &&
    limitOk &&
    dynamicsOk
  );
}

function isMesh(value: unknown): value is MeshAsset {
  if (!isObject(value)) return false;
  const encodingOk = value.encoding === undefined || value.encoding === "utf8" || value.encoding === "base64";
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.format === "stl" || value.format === "obj") &&
    typeof value.data === "string" &&
    encodingOk
  );
}

function looksLikeModel(value: unknown): value is RobotModel {
  if (!isObject(value)) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.name === "string" &&
    Array.isArray(m.links) &&
    Array.isArray(m.joints) &&
    Array.isArray(m.meshes) &&
    m.unit === "m" &&
    m.links.every(isLink) &&
    m.joints.every(isJoint) &&
    m.meshes.every(isMesh)
  );
}

export function normalizeProjectModel(model: RobotModel): RobotModel {
  return {
    name: model.name,
    unit: "m",
    links: model.links.map((link) => ({ ...link })),
    joints: model.joints.map((joint) => ({ ...joint })),
    meshes: model.meshes.map((mesh) => ({ ...mesh })),
  };
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

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid project file: expected a JSON object");
  }

  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== undefined && record.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`Invalid project file: unsupported schemaVersion "${String(record.schemaVersion)}"`);
  }

  // Wrapped project file: { schemaVersion, model }
  const candidate = record.model ?? parsed;

  if (!looksLikeModel(candidate)) {
    throw new Error(
      'Invalid project file: missing a valid "model" with robot name, unit "m", and well-formed links/joints/meshes',
    );
  }

  return normalizeProjectModel(candidate);
}
