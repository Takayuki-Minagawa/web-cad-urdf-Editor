import { useRobotStore } from "../../store/robotStore";
import { Field, Section, TextInput } from "../common/inputs";
import { LinkProperties } from "./LinkProperties";
import { JointProperties } from "./JointProperties";

export function PropertyEditor() {
  const selection = useRobotStore((s) => s.selection);
  const model = useRobotStore((s) => s.model);

  if (!selection) {
    return <div className="prop-empty">Select a link, joint, or mesh to edit its properties.</div>;
  }

  if (selection.kind === "link") {
    const link = model.links.find((l) => l.id === selection.id);
    return link ? <LinkProperties link={link} /> : <Missing />;
  }
  if (selection.kind === "joint") {
    const joint = model.joints.find((j) => j.id === selection.id);
    return joint ? <JointProperties joint={joint} /> : <Missing />;
  }
  const mesh = model.meshes.find((m) => m.id === selection.id);
  return mesh ? <MeshProperties mesh={mesh} /> : <Missing />;
}

function Missing() {
  return <div className="prop-empty">This item no longer exists.</div>;
}

function MeshProperties({ mesh }: { mesh: { id: string; name: string; format: string; data: string } }) {
  const replaceMeshName = (name: string) => {
    useRobotStore.setState((s) => ({
      model: { ...s.model, meshes: s.model.meshes.map((m) => (m.id === mesh.id ? { ...m, name } : m)) },
    }));
  };
  const usedBy = useRobotStore
    .getState()
    .model.links.filter(
      (l) =>
        (l.visual?.geometry.type === "mesh" && l.visual.geometry.meshId === mesh.id) ||
        (l.collision?.geometry.type === "mesh" && l.collision.geometry.meshId === mesh.id),
    )
    .map((l) => l.name);

  return (
    <div>
      <Section title="Mesh asset">
        <Field label="name">
          <TextInput value={mesh.name} onChange={replaceMeshName} />
        </Field>
        <Field label="format">
          <span className="readonly-value">{mesh.format.toUpperCase()}</span>
        </Field>
        <Field label="size">
          <span className="readonly-value">{(mesh.data.length / 1024).toFixed(1)} KB</span>
        </Field>
        <Field label="used by">
          <span className="readonly-value">{usedBy.length ? usedBy.join(", ") : "— (unreferenced)"}</span>
        </Field>
      </Section>
      <p className="hint">
        Assign this mesh to a link by selecting the link and choosing <b>mesh</b> as its visual or collision shape.
      </p>
    </div>
  );
}
