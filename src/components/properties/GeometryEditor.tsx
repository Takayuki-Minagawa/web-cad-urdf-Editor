import type { GeometryKind, GeometrySpec, MeshAsset } from "../../types/robot";
import { defaultGeometry } from "../../lib/factories";
import { Field, NumberInput, Vec3Input } from "../common/inputs";

const KINDS: GeometryKind[] = ["box", "cylinder", "sphere", "mesh"];

export function GeometryEditor({
  geometry,
  meshes,
  onChange,
  allowMesh = true,
}: {
  geometry: GeometrySpec;
  meshes: MeshAsset[];
  onChange: (g: GeometrySpec) => void;
  allowMesh?: boolean;
}) {
  const kinds = allowMesh ? KINDS : KINDS.filter((k) => k !== "mesh");
  return (
    <div>
      <Field label="shape">
        <select
          className="select"
          value={geometry.type}
          onChange={(e) => onChange(defaultGeometry(e.target.value as GeometryKind))}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>

      {geometry.type === "box" && (
        <Field label="size (m)">
          <Vec3Input value={geometry.size} onChange={(size) => onChange({ type: "box", size })} />
        </Field>
      )}

      {geometry.type === "sphere" && (
        <Field label="radius (m)">
          <NumberInput value={geometry.radius} min={0} onChange={(radius) => onChange({ type: "sphere", radius })} />
        </Field>
      )}

      {geometry.type === "cylinder" && (
        <>
          <Field label="radius (m)">
            <NumberInput
              value={geometry.radius}
              min={0}
              onChange={(radius) => onChange({ ...geometry, radius })}
            />
          </Field>
          <Field label="length (m)">
            <NumberInput
              value={geometry.length}
              min={0}
              onChange={(length) => onChange({ ...geometry, length })}
            />
          </Field>
        </>
      )}

      {geometry.type === "mesh" && (
        <>
          <Field label="mesh">
            <select
              className="select"
              value={geometry.meshId}
              onChange={(e) => onChange({ ...geometry, meshId: e.target.value })}
            >
              <option value="">— select —</option>
              {meshes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="scale">
            <Vec3Input value={geometry.scale} onChange={(scale) => onChange({ ...geometry, scale })} />
          </Field>
        </>
      )}
    </div>
  );
}
