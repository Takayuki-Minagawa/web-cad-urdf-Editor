import type { RobotModel } from "../types/robot";

export interface IdentityIssue {
  code: string;
  message: string;
  kind: "link" | "joint" | "mesh";
  id: string;
}

/** IDs identify editable entities and references; never silently rewrite them. */
export function findIdentityIssues(model: RobotModel): IdentityIssue[] {
  const issues: IdentityIssue[] = [];
  for (const [kind, entities] of [
    ["link", model.links ?? []],
    ["joint", model.joints ?? []],
    ["mesh", model.meshes ?? []],
  ] as const) {
    const counts = new Map<string, number>();
    for (const { id } of entities) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const { id } of entities) {
      if (typeof id !== "string" || id.trim() === "") {
        issues.push({ kind, id, code: `EMPTY_${kind.toUpperCase()}_ID`, message: `A ${kind} has an empty ID.` });
      } else if (counts.get(id)! > 1) {
        issues.push({ kind, id, code: `DUP_${kind.toUpperCase()}_ID`, message: `Duplicate ${kind} ID "${id}".` });
      }
    }
  }
  return issues;
}
