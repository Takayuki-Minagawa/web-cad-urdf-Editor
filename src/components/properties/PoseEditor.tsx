import type { Pose, Rgba } from "../../types/robot";
import { Field, NumberInput, Vec3Input } from "../common/inputs";

export function PoseEditor({ pose, onChange }: { pose: Pose; onChange: (p: Pose) => void }) {
  return (
    <>
      <Field label="xyz (m)">
        <Vec3Input value={pose.xyz} onChange={(xyz) => onChange({ ...pose, xyz })} />
      </Field>
      <Field label="rpy (rad)">
        <Vec3Input value={pose.rpy} step={0.01} labels={["r", "p", "y"]} onChange={(rpy) => onChange({ ...pose, rpy })} />
      </Field>
    </>
  );
}

function toHex(c: number): string {
  return Math.max(0, Math.min(255, Math.round(c * 255)))
    .toString(16)
    .padStart(2, "0");
}

export function ColorEditor({ color, onChange }: { color: Rgba; onChange: (c: Rgba) => void }) {
  const hex = `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
  return (
    <>
      <Field label="color">
        <input
          className="color-input"
          type="color"
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            const r = parseInt(v.slice(1, 3), 16) / 255;
            const g = parseInt(v.slice(3, 5), 16) / 255;
            const b = parseInt(v.slice(5, 7), 16) / 255;
            onChange([r, g, b, color[3]]);
          }}
        />
      </Field>
      <Field label="alpha">
        <NumberInput value={color[3]} min={0} step={0.05} onChange={(a) => onChange([color[0], color[1], color[2], Math.min(1, a)])} />
      </Field>
    </>
  );
}
