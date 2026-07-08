import type { LinkSpec } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { inertiaFromGeometry } from "../../lib/inertia";
import { makeCollision, makeVisual } from "../../lib/factories";
import { notify } from "../../lib/userFeedback";
import { Field, NumberInput, Section, TextInput } from "../common/inputs";
import { GeometryEditor } from "./GeometryEditor";
import { ColorEditor, PoseEditor } from "./PoseEditor";

export function LinkProperties({ link }: { link: LinkSpec }) {
  const updateLink = useRobotStore((s) => s.updateLink);
  const setLinkVisual = useRobotStore((s) => s.setLinkVisual);
  const updateLinkVisual = useRobotStore((s) => s.updateLinkVisual);
  const setLinkCollision = useRobotStore((s) => s.setLinkCollision);
  const updateLinkCollision = useRobotStore((s) => s.updateLinkCollision);
  const updateLinkInertial = useRobotStore((s) => s.updateLinkInertial);
  const updateLinkInertia = useRobotStore((s) => s.updateLinkInertia);
  const meshes = useRobotStore((s) => s.model.meshes);

  const patch = (changes: Partial<LinkSpec>) => updateLink(link.id, changes);

  const toggleVisual = (on: boolean) => {
    setLinkVisual(link.id, on ? makeVisual() : undefined);
  };

  const toggleCollision = (on: boolean) => {
    setLinkCollision(link.id, on ? makeCollision() : undefined);
  };

  const autoInertia = () => {
    const geom = link.collision?.geometry ?? link.visual?.geometry;
    if (!geom) return;
    const inertia = inertiaFromGeometry(link.inertial.mass, geom);
    if (!inertia) {
      notify("Auto inertia is only available for box/cylinder/sphere geometry.");
      return;
    }
    updateLinkInertial(link.id, { inertia });
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
              onChange={(geometry) => updateLinkVisual(link.id, { geometry })}
            />
            <PoseEditor pose={link.visual.origin} onChange={(origin) => updateLinkVisual(link.id, { origin })} />
            <ColorEditor color={link.visual.color} onChange={(color) => updateLinkVisual(link.id, { color })} />
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
              onChange={(geometry) => updateLinkCollision(link.id, { geometry })}
            />
            <PoseEditor
              pose={link.collision.origin}
              onChange={(origin) => updateLinkCollision(link.id, { origin })}
            />
          </>
        )}
      </Section>

      <Section title="Inertial">
        <Field label="mass (kg)">
          <NumberInput value={link.inertial.mass} min={0} onChange={(mass) => updateLinkInertial(link.id, { mass })} />
        </Field>
        <div className="field-label" style={{ marginTop: 6 }}>center of mass</div>
        <PoseEditor
          pose={link.inertial.origin}
          onChange={(origin) => updateLinkInertial(link.id, { origin })}
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
                onChange={(v) => updateLinkInertia(link.id, { [key]: v })}
              />
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
