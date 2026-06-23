// Save/load the project as JSON. The on-disk file (`robot_model.json`) wraps the
// RobotModel together with a schema version so older files can be migrated.

import type { RobotModel } from "../types/robot";

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

function looksLikeModel(value: unknown): value is RobotModel {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    Array.isArray(m.links) &&
    Array.isArray(m.joints) &&
    Array.isArray(m.meshes) &&
    m.unit === "m"
  );
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

  // Wrapped project file: { schemaVersion, model }
  const candidate = (parsed as Record<string, unknown>).model ?? parsed;

  if (!looksLikeModel(candidate)) {
    throw new Error(
      'Invalid project file: missing a "model" with links/joints/meshes arrays and unit "m"',
    );
  }

  return candidate;
}
