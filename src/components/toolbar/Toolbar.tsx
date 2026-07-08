import { useRef } from "react";
import { useRobotStore } from "../../store/robotStore";
import { useToolbarActions } from "./useToolbarActions";

export function Toolbar() {
  const meshInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const view = useRobotStore((s) => s.view);
  const setView = useRobotStore((s) => s.setView);
  const selection = useRobotStore((s) => s.selection);
  const linkCount = useRobotStore((s) => s.model.links.length);
  const actions = useToolbarActions({ meshInput, projectInput });

  return (
    <div className="toolbar">
      <span className="toolbar-title">CAD / URDF Editor</span>

      <div className="toolbar-group">
        <button className="btn" onClick={actions.addLink}>+ Link</button>
        <button className="btn" onClick={() => actions.addPrimitive("box")}>+ Box</button>
        <button className="btn" onClick={() => actions.addPrimitive("cylinder")}>+ Cylinder</button>
        <button className="btn" onClick={() => actions.addPrimitive("sphere")}>+ Sphere</button>
        <button className="btn" disabled={linkCount < 2} onClick={actions.addJointBetweenLastLinks} title={linkCount < 2 ? "Need at least 2 links" : "Create joint between the last two links"}>
          + Joint
        </button>
      </div>

      <div className="toolbar-group">
        <button className="btn" onClick={actions.openMeshImport}>Import STL/OBJ</button>
        <button className="btn" disabled={selection?.kind !== "link"} onClick={actions.visualToMesh} title="Generate a display mesh from the selected link's visual primitive">
          Visual → Mesh
        </button>
        <input ref={meshInput} type="file" accept=".stl,.obj" multiple hidden onChange={(e) => { actions.importMesh(e.target.files); e.target.value = ""; }} />
      </div>

      <div className="toolbar-group">
        <button className="btn btn-primary" onClick={actions.exportPackage}>Export URDF zip</button>
        <button className="btn" onClick={actions.saveProject}>Save JSON</button>
        <button className="btn" onClick={actions.openProjectLoad}>Load JSON</button>
        <button className="btn" onClick={actions.newProject}>New</button>
        <input ref={projectInput} type="file" accept=".json" hidden onChange={(e) => { actions.loadProject(e.target.files); e.target.value = ""; }} />
      </div>

      <div className="toolbar-group toolbar-views">
        <Toggle label="visual" on={view.showVisual} onClick={() => setView({ showVisual: !view.showVisual })} />
        <Toggle label="collision" on={view.showCollision} onClick={() => setView({ showCollision: !view.showCollision })} />
        <Toggle label="axes" on={view.showJointAxes} onClick={() => setView({ showJointAxes: !view.showJointAxes })} />
        <Toggle label="CoM" on={view.showCenterOfMass} onClick={() => setView({ showCenterOfMass: !view.showCenterOfMass })} />
        <Toggle label="grid" on={view.showGrid} onClick={() => setView({ showGrid: !view.showGrid })} />
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`toggle${on ? " on" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}
