import type { CollisionSpec, LinkSpec, VisualSpec } from "../../types/robot";
import { ZERO_POSE, clonePose } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { inertiaFromGeometry } from "../../lib/inertia";
import { DEFAULT_COLOR, defaultGeometry } from "../../lib/factories";
import { Field, NumberInput, Section, TextInput } from "../common/inputs";
import { GeometryEditor } from "./GeometryEditor";
import { ColorEditor, PoseEditor } from "./PoseEditor";

export function LinkProperties({ link }: { link: LinkSpec }) {
  const replaceLink = useRobotStore((s) => s.replaceLink);
  const meshes = useRobotStore((s) => s.model.meshes);

  const patch = (changes: Partial<LinkSpec>) => replaceLink({ ...link, ...changes });

  const toggleVisual = (on: boolean) => {
    if (on) {
      const v: VisualSpec = { geometry: defaultGeometry("box"), origin: clonePose(ZERO_POSE), color: [...DEFAULT_COLOR] };
      patch({ visual: v });
    } else patch({ visual: undefined });
  };

  const toggleCollision = (on: boolean) => {
    if (on) {
      const c: CollisionSpec = { geometry: defaultGeometry("box"), origin: clonePose(ZERO_POSE) };
      patch({ collision: c });
    } else patch({ collision: undefined });
  };

  const autoInertia = () => {
    const geom = link.collision?.geometry ?? link.visual?.geometry;
    if (!geom) return;
    const inertia = inertiaFromGeometry(link.inertial.mass, geom);
    if (!inertia) {
      alert("Auto inertia is only available for box/cylinder/sphere geometry.");
      return;
    }
    patch({ inertial: { ...link.inertial, inertia } });
  };

  const i = link.inertial.inertia;

  return (
    <div>
      <Section title="Link">
        <Field label="name">
          <TextInput value={link.name} onChange={(name) => patch({ name })} />
        </Field>
      </Section>

      <Section title="Visual">
        <label className="checkbox-row">
          <input type="checkbox" checked={!!link.visual} onChange={(e) => toggleVisual(e.target.checked)} />
          <span>enable visual geometry</span>
        </label>
        {link.visual && (
          <>
            <GeometryEditor
              geometry={link.visual.geometry}
              meshes={meshes}
              onChange={(geometry) => patch({ visual: { ...link.visual!, geometry } })}
            />
            <PoseEditor pose={link.visual.origin} onChange={(origin) => patch({ visual: { ...link.visual!, origin } })} />
            <ColorEditor color={link.visual.color} onChange={(color) => patch({ visual: { ...link.visual!, color } })} />
          </>
        )}
      </Section>

      <Section title="Collision">
        <label className="checkbox-row">
          <input type="checkbox" checked={!!link.collision} onChange={(e) => toggleCollision(e.target.checked)} />
          <span>enable collision geometry</span>
        </label>
        {link.collision && (
          <>
            <GeometryEditor
              geometry={link.collision.geometry}
              meshes={meshes}
              allowMesh
              onChange={(geometry) => patch({ collision: { ...link.collision!, geometry } })}
            />
            <PoseEditor
              pose={link.collision.origin}
              onChange={(origin) => patch({ collision: { ...link.collision!, origin } })}
            />
          </>
        )}
      </Section>

      <Section title="Inertial">
        <Field label="mass (kg)">
          <NumberInput value={link.inertial.mass} min={0} onChange={(mass) => patch({ inertial: { ...link.inertial, mass } })} />
        </Field>
        <div className="field-label" style={{ marginTop: 6 }}>center of mass</div>
        <PoseEditor
          pose={link.inertial.origin}
          onChange={(origin) => patch({ inertial: { ...link.inertial, origin } })}
        />
        <button className="btn btn-small" style={{ margin: "6px 0" }} onClick={autoInertia}>
          Auto-compute inertia from geometry
        </button>
        <div className="inertia-grid">
          {(["ixx", "ixy", "ixz", "iyy", "iyz", "izz"] as const).map((key) => (
            <label key={key} className="inertia-cell">
              <span>{key}</span>
              <NumberInput
                value={i[key]}
                step={0.0001}
                onChange={(v) => patch({ inertial: { ...link.inertial, inertia: { ...i, [key]: v } } })}
              />
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
