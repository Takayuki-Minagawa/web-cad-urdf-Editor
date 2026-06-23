// Core data model for the robot. This JSON model is the single source of truth;
// the Three.js scene is rebuilt as a *view* of this model, never the reverse.

export type Vec3 = [number, number, number];

export interface Pose {
  /** translation in meters */
  xyz: Vec3;
  /** fixed-axis roll/pitch/yaw in radians (URDF convention) */
  rpy: Vec3;
}

export type GeometrySpec =
  | { type: "box"; size: Vec3 }
  | { type: "sphere"; radius: number }
  | { type: "cylinder"; radius: number; length: number }
  | { type: "mesh"; meshId: string; scale: Vec3 };

export type GeometryKind = GeometrySpec["type"];

export interface Inertia {
  ixx: number;
  ixy: number;
  ixz: number;
  iyy: number;
  iyz: number;
  izz: number;
}

export interface InertialSpec {
  origin: Pose;
  mass: number;
  inertia: Inertia;
}

/** RGBA, each channel 0..1 */
export type Rgba = [number, number, number, number];

export interface VisualSpec {
  geometry: GeometrySpec;
  origin: Pose;
  color: Rgba;
}

export interface CollisionSpec {
  geometry: GeometrySpec;
  origin: Pose;
}

export interface LinkSpec {
  id: string;
  name: string;
  visual?: VisualSpec;
  collision?: CollisionSpec;
  inertial: InertialSpec;
}

export type JointType = "fixed" | "revolute" | "continuous" | "prismatic";

export interface JointLimit {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

export interface JointDynamics {
  damping: number;
  friction: number;
}

export interface JointSpec {
  id: string;
  name: string;
  type: JointType;
  parent: string; // link id
  child: string; // link id
  origin: Pose;
  axis: Vec3;
  limit?: JointLimit;
  dynamics?: JointDynamics;
}

/** An imported or generated display mesh, kept independent of collision geometry. */
export interface MeshAsset {
  id: string;
  /** original file name, e.g. "arm.stl" */
  name: string;
  format: "stl" | "obj";
  /** raw file contents, used when exporting the package */
  data: string;
}

export interface RobotModel {
  name: string;
  unit: "m";
  links: LinkSpec[];
  joints: JointSpec[];
  meshes: MeshAsset[];
}

// ---- helpers ---------------------------------------------------------------

export const ZERO_POSE: Pose = { xyz: [0, 0, 0], rpy: [0, 0, 0] };

export const ZERO_INERTIA: Inertia = {
  ixx: 0,
  ixy: 0,
  ixz: 0,
  iyy: 0,
  iyz: 0,
  izz: 0,
};

export function clonePose(p: Pose): Pose {
  return { xyz: [...p.xyz], rpy: [...p.rpy] };
}
