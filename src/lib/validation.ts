// Pure validation of a RobotModel. Produces a list of errors and warnings and
// whether the model is ready to export (no errors). No external dependencies:
// only the data-model types are imported.

import {
  type GeometrySpec,
  type RobotModel,
  type Vec3,
} from "../types/robot";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  severity: Severity;
  code: string; // short stable code e.g. "DUP_LINK_NAME"
  message: string; // human readable
  target?: { kind: "link" | "joint"; id: string };
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  exportReady: boolean; // true iff errors.length === 0
}

function magnitude(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function meshIdOf(geom: GeometrySpec | undefined): string | undefined {
  return geom && geom.type === "mesh" ? geom.meshId : undefined;
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * Return a human-readable reason if any dimension of `geom` is non-positive or
 * non-finite, else undefined. PyBullet rejects zero/negative primitive sizes,
 * so these must block export.
 */
function badGeometryReason(geom: GeometrySpec): string | undefined {
  switch (geom.type) {
    case "box":
      return geom.size.every(isPositive) ? undefined : "box size must be positive in every axis";
    case "sphere":
      return isPositive(geom.radius) ? undefined : "sphere radius must be positive";
    case "cylinder":
      return isPositive(geom.radius) && isPositive(geom.length)
        ? undefined
        : "cylinder radius and length must be positive";
    case "mesh":
      return geom.scale.every(isPositive) ? undefined : "mesh scale must be positive in every axis";
  }
}

interface ValidationContext {
  model: RobotModel;
  links: RobotModel["links"];
  joints: RobotModel["joints"];
  linkIds: Set<string>;
  meshIds: Set<string>;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  err: (code: string, message: string, target?: ValidationIssue["target"]) => void;
  warn: (code: string, message: string, target?: ValidationIssue["target"]) => void;
}

function createContext(model: RobotModel): ValidationContext {
  const links = model.links ?? [];
  const joints = model.joints ?? [];
  const meshes = model.meshes ?? [];
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  return {
    model,
    links,
    joints,
    linkIds: new Set(links.map((l) => l.id)),
    meshIds: new Set(meshes.map((m) => m.id)),
    errors,
    warnings,
    err: (code, message, target) => errors.push({ severity: "error", code, message, target }),
    warn: (code, message, target) => warnings.push({ severity: "warning", code, message, target }),
  };
}

function validateModelLevel(ctx: ValidationContext): void {
  if (!ctx.model.name || ctx.model.name.trim() === "") {
    ctx.err("ROBOT_NAME_MISSING", "Robot name is missing or empty.");
  }
  if (ctx.model.unit !== "m") {
    ctx.err("BAD_UNIT", `Model unit must be "m" (got "${ctx.model.unit}").`);
  }
}

function validateNames(ctx: ValidationContext): void {
  const linkNameCounts = new Map<string, number>();
  for (const l of ctx.links) {
    if (!l.name || l.name.trim() === "") {
      ctx.err("LINK_NAME_EMPTY", "Link name is empty.", { kind: "link", id: l.id });
    } else {
      linkNameCounts.set(l.name, (linkNameCounts.get(l.name) ?? 0) + 1);
    }
  }
  for (const l of ctx.links) {
    if (l.name && (linkNameCounts.get(l.name) ?? 0) > 1) {
      ctx.err("DUP_LINK_NAME", `Duplicate link name "${l.name}".`, { kind: "link", id: l.id });
    }
  }

  const jointNameCounts = new Map<string, number>();
  for (const j of ctx.joints) {
    if (!j.name || j.name.trim() === "") {
      ctx.err("JOINT_NAME_EMPTY", "Joint name is empty.", { kind: "joint", id: j.id });
    } else {
      jointNameCounts.set(j.name, (jointNameCounts.get(j.name) ?? 0) + 1);
    }
  }
  for (const j of ctx.joints) {
    if (j.name && (jointNameCounts.get(j.name) ?? 0) > 1) {
      ctx.err("DUP_JOINT_NAME", `Duplicate joint name "${j.name}".`, { kind: "joint", id: j.id });
    }
  }
}

function validateJointReferences(ctx: ValidationContext): void {
  for (const j of ctx.joints) {
    if (!ctx.linkIds.has(j.parent)) {
      ctx.err("JOINT_BAD_PARENT", `Joint "${j.name}" references a non-existent parent link.`, {
        kind: "joint",
        id: j.id,
      });
    }
    if (!ctx.linkIds.has(j.child)) {
      ctx.err("JOINT_BAD_CHILD", `Joint "${j.name}" references a non-existent child link.`, {
        kind: "joint",
        id: j.id,
      });
    }
    if (j.parent === j.child) {
      ctx.err("JOINT_SELF_LOOP", `Joint "${j.name}" connects a link to itself.`, {
        kind: "joint",
        id: j.id,
      });
    }
  }
}

function validateGraph(ctx: ValidationContext): void {
  validateSingleParent(ctx);
  const roots = validateRoots(ctx);
  const adjacency = buildAdjacency(ctx);
  const hasCycle = validateAcyclic(ctx, adjacency);
  validateConnected(ctx, roots, adjacency, hasCycle);
}

function validateSingleParent(ctx: ValidationContext): void {
  const childRefCounts = new Map<string, number>();
  for (const j of ctx.joints) {
    if (ctx.linkIds.has(j.child)) {
      childRefCounts.set(j.child, (childRefCounts.get(j.child) ?? 0) + 1);
    }
  }
  for (const l of ctx.links) {
    if ((childRefCounts.get(l.id) ?? 0) > 1) {
      ctx.err("MULTI_PARENT", `Link "${l.name}" is the child of more than one joint (a URDF link may have only one parent).`, {
        kind: "link",
        id: l.id,
      });
    }
  }
}

function validateRoots(ctx: ValidationContext): RobotModel["links"] {
  const childLinkIds = new Set<string>();
  for (const j of ctx.joints) {
    if (ctx.linkIds.has(j.child)) childLinkIds.add(j.child);
  }
  const roots = ctx.links.filter((l) => !childLinkIds.has(l.id));

  if (ctx.links.length === 0) {
    ctx.err("NO_LINKS", "Model has no links.");
  } else if (roots.length === 0) {
    ctx.err("NO_ROOT", "No root link found (every link is the child of some joint).");
  } else if (roots.length > 1 && ctx.links.length > 1) {
    ctx.err("MULTIPLE_ROOTS", `Expected exactly one root link, found ${roots.length}.`);
  }
  return roots;
}

function buildAdjacency(ctx: ValidationContext): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const l of ctx.links) adjacency.set(l.id, []);
  for (const j of ctx.joints) {
    if (ctx.linkIds.has(j.parent) && ctx.linkIds.has(j.child) && j.parent !== j.child) {
      adjacency.get(j.parent)!.push(j.child);
    }
  }
  return adjacency;
}

function validateAcyclic(ctx: ValidationContext, adjacency: Map<string, string[]>): boolean {
  const color = new Map<string, number>();
  for (const l of ctx.links) color.set(l.id, 0);
  let hasCycle = false;
  const stack: { id: string; enter: boolean }[] = [];
  for (const l of ctx.links) {
    if (color.get(l.id) !== 0) continue;
    stack.push({ id: l.id, enter: true });
    while (stack.length > 0) {
      const frame = stack.pop()!;
      if (frame.enter) {
        if (color.get(frame.id) === 1) continue;
        color.set(frame.id, 1);
        stack.push({ id: frame.id, enter: false });
        for (const next of adjacency.get(frame.id) ?? []) {
          const c = color.get(next);
          if (c === 1) {
            hasCycle = true;
          } else if (c === 0) {
            stack.push({ id: next, enter: true });
          }
        }
      } else {
        color.set(frame.id, 2);
      }
    }
  }
  if (hasCycle) {
    ctx.err("GRAPH_CYCLE", "The link/joint graph contains a cycle.");
  }
  return hasCycle;
}

function validateConnected(
  ctx: ValidationContext,
  roots: RobotModel["links"],
  adjacency: Map<string, string[]>,
  hasCycle: boolean,
): void {
  if (roots.length !== 1 || ctx.links.length <= 1 || hasCycle) return;

  const reachable = new Set<string>();
  const queue = [roots[0].id];
  reachable.add(roots[0].id);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  for (const l of ctx.links) {
    if (!reachable.has(l.id)) {
      ctx.err("DISCONNECTED_LINK", `Link "${l.name}" is not reachable from the root link.`, {
        kind: "link",
        id: l.id,
      });
    }
  }
}

function validateJointPhysics(ctx: ValidationContext): void {
  for (const j of ctx.joints) {
    if (j.type !== "fixed" && magnitude(j.axis) === 0) {
      ctx.err("ZERO_AXIS", `Joint "${j.name}" is non-fixed but has a zero axis vector.`, {
        kind: "joint",
        id: j.id,
      });
    }
    if ((j.type === "revolute" || j.type === "prismatic") && !j.limit) {
      ctx.err("MISSING_LIMIT", `Joint "${j.name}" of type "${j.type}" must define a limit.`, {
        kind: "joint",
        id: j.id,
      });
    }
    if (j.limit && (Math.abs(j.limit.lower) > 1e3 || Math.abs(j.limit.upper) > 1e3)) {
      ctx.warn("EXTREME_LIMIT", `Joint "${j.name}" has an extremely large limit value.`, {
        kind: "joint",
        id: j.id,
      });
    }
  }
}

function validateLinkPhysics(ctx: ValidationContext): void {
  for (const l of ctx.links) {
    const inertial = l.inertial;
    if (!inertial || !(inertial.mass > 0)) {
      ctx.err("NON_POSITIVE_MASS", `Link "${l.name}" must have a positive mass.`, { kind: "link", id: l.id });
    }
    if (!inertial || !(inertial.inertia.ixx > 0) || !(inertial.inertia.iyy > 0) || !(inertial.inertia.izz > 0)) {
      ctx.err("NON_POSITIVE_INERTIA", `Link "${l.name}" must have positive diagonal inertia (ixx, iyy, izz).`, {
        kind: "link",
        id: l.id,
      });
    }

    if (!l.collision) {
      ctx.err("MISSING_COLLISION", `Link "${l.name}" has no collision geometry.`, { kind: "link", id: l.id });
    }

    for (const [bucket, geom] of [
      ["visual", l.visual?.geometry],
      ["collision", l.collision?.geometry],
    ] as const) {
      if (!geom) continue;
      const reason = badGeometryReason(geom);
      if (reason) {
        ctx.err("BAD_GEOMETRY_DIM", `Link "${l.name}" ${bucket} geometry is invalid: ${reason}.`, {
          kind: "link",
          id: l.id,
        });
      }
    }

    validateLinkMeshReferences(ctx, l);

    if (inertial && magnitude(inertial.origin.xyz) > 0.5) {
      ctx.warn("INERTIAL_ORIGIN_FAR", `Link "${l.name}" inertial origin is far (> 0.5 m) from the link origin.`, {
        kind: "link",
        id: l.id,
      });
    }
  }
}

function validateLinkMeshReferences(ctx: ValidationContext, l: RobotModel["links"][number]): void {
  const visualMeshId = meshIdOf(l.visual?.geometry);
  const collisionMeshId = meshIdOf(l.collision?.geometry);
  if (visualMeshId !== undefined && !ctx.meshIds.has(visualMeshId)) {
    ctx.err("MISSING_MESH", `Link "${l.name}" visual references a missing mesh.`, { kind: "link", id: l.id });
  }
  if (collisionMeshId !== undefined && !ctx.meshIds.has(collisionMeshId)) {
    ctx.err("MISSING_MESH", `Link "${l.name}" collision references a missing mesh.`, { kind: "link", id: l.id });
  }
  if (visualMeshId !== undefined && collisionMeshId !== undefined && visualMeshId === collisionMeshId) {
    ctx.warn("SAME_VISUAL_COLLISION_MESH", `Link "${l.name}" uses the same mesh for visual and collision.`, {
      kind: "link",
      id: l.id,
    });
  }
  if (l.collision && l.collision.geometry.type === "mesh") {
    ctx.warn("MESH_COLLISION", `Link "${l.name}" uses a mesh as collision geometry (high density).`, {
      kind: "link",
      id: l.id,
    });
  }
}

export function validateModel(model: RobotModel): ValidationResult {
  const ctx = createContext(model);
  validateModelLevel(ctx);
  validateNames(ctx);
  validateJointReferences(ctx);
  validateGraph(ctx);
  validateJointPhysics(ctx);
  validateLinkPhysics(ctx);
  return {
    errors: ctx.errors,
    warnings: ctx.warnings,
    exportReady: ctx.errors.length === 0,
  };
}
