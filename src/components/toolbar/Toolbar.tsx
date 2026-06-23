import { useRef } from "react";
import type { GeometryKind } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { buildPackage, downloadBlob, downloadText } from "../../lib/package";
import { serializeProject, parseProject } from "../../lib/projectIO";
import { validateModel } from "../../lib/validation";
import { readFileToMeshAsset, primitiveToBufferGeometry, geometryToMeshData } from "../../lib/meshIO";
import { defaultGeometry } from "../../lib/factories";
import { boxInertia } from "../../lib/inertia";

export function Toolbar() {
  const meshInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const store = useRobotStore;
  const view = useRobotStore((s) => s.view);
  const setView = useRobotStore((s) => s.setView);
  const selection = useRobotStore((s) => s.selection);
  const linkCount = useRobotStore((s) => s.model.links.length);

  const addPrimitive = (kind: GeometryKind) => {
    const id = store.getState().addLink();
    const geom = defaultGeometry(kind);
    const link = store.getState().model.links.find((l) => l.id === id);
    if (!link) return;
    const inertia = kind === "box" ? boxInertia(link.inertial.mass, (geom as { size: [number, number, number] }).size) : link.inertial.inertia;
    store.getState().replaceLink({
      ...link,
      visual: { geometry: structuredClone(geom), origin: link.visual?.origin ?? { xyz: [0, 0, 0], rpy: [0, 0, 0] }, color: link.visual?.color ?? [0.6, 0.6, 0.65, 1] },
      collision: { geometry: structuredClone(geom), origin: link.collision?.origin ?? { xyz: [0, 0, 0], rpy: [0, 0, 0] } },
      inertial: { ...link.inertial, inertia },
    });
  };

  const addJoint = () => {
    const links = store.getState().model.links;
    if (links.length < 2) return;
    store.getState().addJoint(links[links.length - 2].id, links[links.length - 1].id, "revolute");
  };

  const importMesh = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const asset = await readFileToMeshAsset(file);
        store.getState().addMesh(asset);
      } catch (err) {
        alert(`Failed to import ${file.name}: ${(err as Error).message}`);
      }
    }
  };

  const visualToMesh = () => {
    const sel = store.getState().selection;
    if (sel?.kind !== "link") {
      alert("Select a link first.");
      return;
    }
    const link = store.getState().model.links.find((l) => l.id === sel.id);
    if (!link?.visual || link.visual.geometry.type === "mesh") {
      alert("Select a link whose visual is a primitive (box/cylinder/sphere).");
      return;
    }
    try {
      const geometry = primitiveToBufferGeometry(link.visual.geometry);
      const asset = geometryToMeshData(geometry, "stl", `${link.name}_visual`);
      const meshId = store.getState().addMesh(asset);
      const fresh = store.getState().model.links.find((l) => l.id === sel.id)!;
      store.getState().replaceLink({
        ...fresh,
        visual: { ...fresh.visual!, geometry: { type: "mesh", meshId, scale: [1, 1, 1] } },
      });
    } catch (err) {
      alert(`Mesh generation failed: ${(err as Error).message}`);
    }
  };

  const exportPackage = async () => {
    const model = store.getState().model;
    const result = validateModel(model);
    if (!result.exportReady) {
      const proceed = confirm(
        `Model has ${result.errors.length} validation error(s) and may not load in PyBullet.\nExport anyway?`,
      );
      if (!proceed) return;
    }
    const pkg = await buildPackage(model);
    downloadBlob(pkg.blob, pkg.fileName);
  };

  const saveProject = () => {
    const model = store.getState().model;
    downloadText(serializeProject(model), `${model.name || "robot"}.json`);
  };

  const loadProject = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const model = parseProject(String(reader.result));
        store.getState().loadModel(model);
      } catch (err) {
        alert(`Failed to load project: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="toolbar">
      <span className="toolbar-title">CAD / URDF Editor</span>

      <div className="toolbar-group">
        <button className="btn" onClick={() => store.getState().addLink()}>+ Link</button>
        <button className="btn" onClick={() => addPrimitive("box")}>+ Box</button>
        <button className="btn" onClick={() => addPrimitive("cylinder")}>+ Cylinder</button>
        <button className="btn" onClick={() => addPrimitive("sphere")}>+ Sphere</button>
        <button className="btn" disabled={linkCount < 2} onClick={addJoint} title={linkCount < 2 ? "Need at least 2 links" : "Create joint between the last two links"}>
          + Joint
        </button>
      </div>

      <div className="toolbar-group">
        <button className="btn" onClick={() => meshInput.current?.click()}>Import STL/OBJ</button>
        <button className="btn" disabled={selection?.kind !== "link"} onClick={visualToMesh} title="Generate a display mesh from the selected link's visual primitive">
          Visual → Mesh
        </button>
        <input ref={meshInput} type="file" accept=".stl,.obj" multiple hidden onChange={(e) => { importMesh(e.target.files); e.target.value = ""; }} />
      </div>

      <div className="toolbar-group">
        <button className="btn btn-primary" onClick={exportPackage}>Export URDF zip</button>
        <button className="btn" onClick={saveProject}>Save JSON</button>
        <button className="btn" onClick={() => projectInput.current?.click()}>Load JSON</button>
        <button className="btn" onClick={() => { if (confirm("Discard current model?")) store.getState().newModel(); }}>New</button>
        <input ref={projectInput} type="file" accept=".json" hidden onChange={(e) => { loadProject(e.target.files); e.target.value = ""; }} />
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
