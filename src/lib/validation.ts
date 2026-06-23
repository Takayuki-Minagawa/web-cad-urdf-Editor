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

export function validateModel(model: RobotModel): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const err = (
    code: string,
    message: string,
    target?: ValidationIssue["target"],
  ) => errors.push({ severity: "error", code, message, target });
  const warn = (
    code: string,
    message: string,
    target?: ValidationIssue["target"],
  ) => warnings.push({ severity: "warning", code, message, target });

  const links = model.links ?? [];
  const joints = model.joints ?? [];
  const meshes = model.meshes ?? [];

  // ---- model-level ---------------------------------------------------------
  if (!model.name || model.name.trim() === "") {
    err("ROBOT_NAME_MISSING", "Robot name is missing or empty.");
  }

  if (model.unit !== "m") {
    err("BAD_UNIT", `Model unit must be "m" (got "${model.unit}").`);
  }

  const meshIds = new Set(meshes.map((m) => m.id));
  const linkIds = new Set(links.map((l) => l.id));

  // ---- link names ----------------------------------------------------------
  const linkNameCounts = new Map<string, number>();
  for (const l of links) {
    if (!l.name || l.name.trim() === "") {
      err("LINK_NAME_EMPTY", "Link name is empty.", { kind: "link", id: l.id });
    } else {
      linkNameCounts.set(l.name, (linkNameCounts.get(l.name) ?? 0) + 1);
    }
  }
  for (const l of links) {
    if (l.name && (linkNameCounts.get(l.name) ?? 0) > 1) {
      err("DUP_LINK_NAME", `Duplicate link name "${l.name}".`, {
        kind: "link",
        id: l.id,
      });
    }
  }

  // ---- joint names ---------------------------------------------------------
  const jointNameCounts = new Map<string, number>();
  for (const j of joints) {
    if (!j.name || j.name.trim() === "") {
      err("JOINT_NAME_EMPTY", "Joint name is empty.", {
        kind: "joint",
        id: j.id,
      });
    } else {
      jointNameCounts.set(j.name, (jointNameCounts.get(j.name) ?? 0) + 1);
    }
  }
  for (const j of joints) {
    if (j.name && (jointNameCounts.get(j.name) ?? 0) > 1) {
      err("DUP_JOINT_NAME", `Duplicate joint name "${j.name}".`, {
        kind: "joint",
        id: j.id,
      });
    }
  }

  // ---- joint references ----------------------------------------------------
  for (const j of joints) {
    if (!linkIds.has(j.parent)) {
      err(
        "JOINT_BAD_PARENT",
        `Joint "${j.name}" references a non-existent parent link.`,
        { kind: "joint", id: j.id },
      );
    }
    if (!linkIds.has(j.child)) {
      err(
        "JOINT_BAD_CHILD",
        `Joint "${j.name}" references a non-existent child link.`,
        { kind: "joint", id: j.id },
      );
    }
    if (j.parent === j.child) {
      err(
        "JOINT_SELF_LOOP",
        `Joint "${j.name}" connects a link to itself.`,
        { kind: "joint", id: j.id },
      );
    }
  }

  // ---- root analysis -------------------------------------------------------
  // A root is a link that is never a joint's child.
  const childLinkIds = new Set<string>();
  for (const j of joints) {
    if (linkIds.has(j.child)) childLinkIds.add(j.child);
  }
  const roots = links.filter((l) => !childLinkIds.has(l.id));

  if (links.length === 0) {
    err("NO_LINKS", "Model has no links.");
  } else if (roots.length === 0) {
    err(
      "NO_ROOT",
      "No root link found (every link is the child of some joint).",
    );
  } else if (roots.length > 1 && links.length > 1) {
    err(
      "MULTIPLE_ROOTS",
      `Expected exactly one root link, found ${roots.length}.`,
    );
  }

  // ---- cycle detection -----------------------------------------------------
  // Build adjacency from parent -> child over valid joints.
  const adjacency = new Map<string, string[]>();
  for (const l of links) adjacency.set(l.id, []);
  for (const j of joints) {
    if (linkIds.has(j.parent) && linkIds.has(j.child) && j.parent !== j.child) {
      adjacency.get(j.parent)!.push(j.child);
    }
  }

  // DFS cycle detection over the directed graph (colors: 0=white,1=gray,2=black).
  const color = new Map<string, number>();
  for (const l of links) color.set(l.id, 0);
  let hasCycle = false;
  const stack: { id: string; enter: boolean }[] = [];
  for (const l of links) {
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
    err("GRAPH_CYCLE", "The link/joint graph contains a cycle.");
  }

  // ---- disconnected links --------------------------------------------------
  // Only meaningful with exactly one root and more than one link.
  if (roots.length === 1 && links.length > 1 && !hasCycle) {
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
    for (const l of links) {
      if (!reachable.has(l.id)) {
        err(
          "DISCONNECTED_LINK",
          `Link "${l.name}" is not reachable from the root link.`,
          { kind: "link", id: l.id },
        );
      }
    }
  }

  // ---- per-joint physical checks -------------------------------------------
  for (const j of joints) {
    if (j.type !== "fixed" && magnitude(j.axis) === 0) {
      err(
        "ZERO_AXIS",
        `Joint "${j.name}" is non-fixed but has a zero axis vector.`,
        { kind: "joint", id: j.id },
      );
    }
    if ((j.type === "revolute" || j.type === "prismatic") && !j.limit) {
      err(
        "MISSING_LIMIT",
        `Joint "${j.name}" of type "${j.type}" must define a limit.`,
        { kind: "joint", id: j.id },
      );
    }
    if (j.limit) {
      if (Math.abs(j.limit.lower) > 1e3 || Math.abs(j.limit.upper) > 1e3) {
        warn(
          "EXTREME_LIMIT",
          `Joint "${j.name}" has an extremely large limit value.`,
          { kind: "joint", id: j.id },
        );
      }
    }
  }

  // ---- per-link physical checks --------------------------------------------
  for (const l of links) {
    const inertial = l.inertial;
    if (!inertial || !(inertial.mass > 0)) {
      err("NON_POSITIVE_MASS", `Link "${l.name}" must have a positive mass.`, {
        kind: "link",
        id: l.id,
      });
    }
    if (
      !inertial ||
      !(inertial.inertia.ixx > 0) ||
      !(inertial.inertia.iyy > 0) ||
      !(inertial.inertia.izz > 0)
    ) {
      err(
        "NON_POSITIVE_INERTIA",
        `Link "${l.name}" must have positive diagonal inertia (ixx, iyy, izz).`,
        { kind: "link", id: l.id },
      );
    }

    if (!l.collision) {
      err(
        "MISSING_COLLISION",
        `Link "${l.name}" has no collision geometry.`,
        { kind: "link", id: l.id },
      );
    }

    // mesh references must exist
    const visualMeshId = meshIdOf(l.visual?.geometry);
    const collisionMeshId = meshIdOf(l.collision?.geometry);
    if (visualMeshId !== undefined && !meshIds.has(visualMeshId)) {
      err(
        "MISSING_MESH",
        `Link "${l.name}" visual references a missing mesh.`,
        { kind: "link", id: l.id },
      );
    }
    if (collisionMeshId !== undefined && !meshIds.has(collisionMeshId)) {
      err(
        "MISSING_MESH",
        `Link "${l.name}" collision references a missing mesh.`,
        { kind: "link", id: l.id },
      );
    }

    // ---- warnings --------------------------------------------------------
    if (
      visualMeshId !== undefined &&
      collisionMeshId !== undefined &&
      visualMeshId === collisionMeshId
    ) {
      warn(
        "SAME_VISUAL_COLLISION_MESH",
        `Link "${l.name}" uses the same mesh for visual and collision.`,
        { kind: "link", id: l.id },
      );
    }
    if (l.collision && l.collision.geometry.type === "mesh") {
      warn(
        "MESH_COLLISION",
        `Link "${l.name}" uses a mesh as collision geometry (high density).`,
        { kind: "link", id: l.id },
      );
    }
    if (inertial && magnitude(inertial.origin.xyz) > 0.5) {
      warn(
        "INERTIAL_ORIGIN_FAR",
        `Link "${l.name}" inertial origin is far (> 0.5 m) from the link origin.`,
        { kind: "link", id: l.id },
      );
    }
  }

  return {
    errors,
    warnings,
    exportReady: errors.length === 0,
  };
}
