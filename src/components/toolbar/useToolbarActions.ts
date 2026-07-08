import type { RefObject } from "react";
import type { GeometryKind } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { buildPackage } from "../../lib/package";
import { downloadBlob, downloadText, readTextFile } from "../../lib/browserFiles";
import { serializeProject, parseProject } from "../../lib/projectIO";
import { validateModel } from "../../lib/validation";
import { readFileToMeshAsset, primitiveToBufferGeometry, geometryToMeshData } from "../../lib/meshIO";
import { confirmAction, notify } from "../../lib/userFeedback";

interface ToolbarActionRefs {
  meshInput: RefObject<HTMLInputElement>;
  projectInput: RefObject<HTMLInputElement>;
}

export function useToolbarActions({ meshInput, projectInput }: ToolbarActionRefs) {
  const store = useRobotStore;

  const addPrimitive = (kind: GeometryKind) => {
    store.getState().addPrimitiveLink(kind);
  };

  const addJointBetweenLastLinks = () => {
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
        notify(`Failed to import ${file.name}: ${(err as Error).message}`);
      }
    }
  };

  const visualToMesh = () => {
    const sel = store.getState().selection;
    if (sel?.kind !== "link") {
      notify("Select a link first.");
      return;
    }
    const link = store.getState().model.links.find((l) => l.id === sel.id);
    if (!link?.visual || link.visual.geometry.type === "mesh") {
      notify("Select a link whose visual is a primitive (box/cylinder/sphere).");
      return;
    }
    try {
      const geometry = primitiveToBufferGeometry(link.visual.geometry);
      const asset = geometryToMeshData(geometry, "stl", `${link.name}_visual`);
      const meshId = store.getState().addMesh(asset);
      store.getState().updateLinkVisual(sel.id, { geometry: { type: "mesh", meshId, scale: [1, 1, 1] } });
    } catch (err) {
      notify(`Mesh generation failed: ${(err as Error).message}`);
    }
  };

  const exportPackage = async () => {
    const model = store.getState().model;
    const result = validateModel(model);
    if (!result.exportReady) {
      const proceed = confirmAction(
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

  const loadProject = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const model = parseProject(await readTextFile(file));
      store.getState().loadModel(model);
    } catch (err) {
      notify(`Failed to load project: ${(err as Error).message}`);
    }
  };

  const newProject = () => {
    if (confirmAction("Discard current model?")) store.getState().newModel();
  };

  return {
    addLink: () => store.getState().addLink(),
    addPrimitive,
    addJointBetweenLastLinks,
    importMesh,
    visualToMesh,
    exportPackage,
    saveProject,
    loadProject,
    newProject,
    openMeshImport: () => meshInput.current?.click(),
    openProjectLoad: () => projectInput.current?.click(),
  };
}
