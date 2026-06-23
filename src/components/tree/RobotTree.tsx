import { useRobotStore } from "../../store/robotStore";

export function RobotTree() {
  const model = useRobotStore((s) => s.model);
  const selection = useRobotStore((s) => s.selection);
  const select = useRobotStore((s) => s.select);
  const addLink = useRobotStore((s) => s.addLink);
  const removeLink = useRobotStore((s) => s.removeLink);
  const removeJoint = useRobotStore((s) => s.removeJoint);
  const removeMesh = useRobotStore((s) => s.removeMesh);
  const setRobotName = useRobotStore((s) => s.setRobotName);

  const linkName = (id: string) => model.links.find((l) => l.id === id)?.name ?? "?";

  return (
    <div className="tree">
      <div className="tree-robot-name">
        <span className="tree-robot-icon">🤖</span>
        <input
          className="robot-name-input"
          value={model.name}
          onChange={(e) => setRobotName(e.target.value)}
          spellCheck={false}
        />
      </div>

      <TreeGroup title={`Links (${model.links.length})`} onAdd={() => addLink()} addTitle="Add link">
        {model.links.length === 0 && <div className="tree-empty">No links yet</div>}
        {model.links.map((l) => (
          <TreeRow
            key={l.id}
            icon="◼"
            label={l.name}
            active={selection?.kind === "link" && selection.id === l.id}
            onClick={() => select({ kind: "link", id: l.id })}
            onDelete={() => removeLink(l.id)}
          />
        ))}
      </TreeGroup>

      <TreeGroup title={`Joints (${model.joints.length})`}>
        {model.joints.length === 0 && <div className="tree-empty">No joints yet</div>}
        {model.joints.map((j) => (
          <TreeRow
            key={j.id}
            icon="⟜"
            label={j.name}
            sub={`${j.type} · ${linkName(j.parent)} → ${linkName(j.child)}`}
            active={selection?.kind === "joint" && selection.id === j.id}
            onClick={() => select({ kind: "joint", id: j.id })}
            onDelete={() => removeJoint(j.id)}
          />
        ))}
      </TreeGroup>

      <TreeGroup title={`Meshes (${model.meshes.length})`}>
        {model.meshes.length === 0 && <div className="tree-empty">No meshes imported</div>}
        {model.meshes.map((m) => (
          <TreeRow
            key={m.id}
            icon="△"
            label={m.name}
            sub={m.format.toUpperCase()}
            active={selection?.kind === "mesh" && selection.id === m.id}
            onClick={() => select({ kind: "mesh", id: m.id })}
            onDelete={() => removeMesh(m.id)}
          />
        ))}
      </TreeGroup>
    </div>
  );
}

function TreeGroup({
  title,
  onAdd,
  addTitle,
  children,
}: {
  title: string;
  onAdd?: () => void;
  addTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tree-group">
      <div className="tree-group-header">
        <span>{title}</span>
        {onAdd && (
          <button className="tree-add-btn" title={addTitle} onClick={onAdd}>
            +
          </button>
        )}
      </div>
      <div className="tree-group-body">{children}</div>
    </div>
  );
}

function TreeRow({
  icon,
  label,
  sub,
  active,
  onClick,
  onDelete,
}: {
  icon: string;
  label: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`tree-row${active ? " active" : ""}`} onClick={onClick}>
      <span className="tree-row-icon">{icon}</span>
      <span className="tree-row-text">
        <span className="tree-row-label">{label}</span>
        {sub && <span className="tree-row-sub">{sub}</span>}
      </span>
      <button
        className="tree-row-del"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
