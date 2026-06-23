// Mesh import/export utilities: convert between MeshAsset (raw file data) and
// THREE.BufferGeometry, and generate geometry from primitive GeometrySpecs.

import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { GeometrySpec, MeshAsset } from "../types/robot";

/** Parse a MeshAsset's raw data into a single BufferGeometry. */
export function parseMeshAsset(asset: MeshAsset): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry | null = null;

  if (asset.format === "stl") {
    geometry = new STLLoader().parse(asset.data);
  } else if (asset.format === "obj") {
    const group = new OBJLoader().parse(asset.data);
    const geometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const g = (child as THREE.Mesh).geometry;
        if (g) geometries.push(g);
      }
    });
    if (geometries.length === 0) {
      throw new Error("OBJ contained no mesh geometry");
    }
    if (geometries.length === 1) {
      geometry = geometries[0];
    } else {
      // Try to merge; if attributes are incompatible, fall back to first.
      const merged = mergeGeometries(geometries, false);
      geometry = merged ?? geometries[0];
    }
  } else {
    throw new Error(`Unsupported mesh format: ${(asset as MeshAsset).format}`);
  }

  if (!geometry) {
    throw new Error("Failed to parse mesh: empty result");
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Read a File (.stl/.obj) into a MeshAsset (without id). */
export function readFileToMeshAsset(file: File): Promise<Omit<MeshAsset, "id">> {
  const format = formatFromName(file.name);
  if (!format) {
    throw new Error(`Unsupported file extension: ${file.name}`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({ name: file.name, format, data: String(reader.result) });
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read file: ${file.name}`));
    };
    reader.readAsText(file);
  });
}

/** Export a BufferGeometry to a MeshAsset (without id) in the requested format. */
export function geometryToMeshData(
  geometry: THREE.BufferGeometry,
  format: "stl" | "obj",
  name: string,
): Omit<MeshAsset, "id"> {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  let data: string;
  if (format === "stl") {
    data = new STLExporter().parse(mesh);
  } else if (format === "obj") {
    data = new OBJExporter().parse(mesh);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
  return { name: ensureExtension(name, format), format, data };
}

/** Build a BufferGeometry for a primitive geometry spec. */
export function primitiveToBufferGeometry(geom: GeometrySpec): THREE.BufferGeometry {
  switch (geom.type) {
    case "box":
      return new THREE.BoxGeometry(geom.size[0], geom.size[1], geom.size[2]);
    case "sphere":
      return new THREE.SphereGeometry(geom.radius, 32, 16);
    case "cylinder": {
      // URDF/PyBullet cylinders point along +Z; THREE's are along +Y.
      const g = new THREE.CylinderGeometry(geom.radius, geom.radius, geom.length, 32);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case "mesh":
      throw new Error("Cannot build primitive geometry from a mesh spec; use parseMeshAsset");
  }
}

// ---- helpers ---------------------------------------------------------------

function formatFromName(name: string): "stl" | "obj" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".stl")) return "stl";
  if (lower.endsWith(".obj")) return "obj";
  return null;
}

function ensureExtension(name: string, format: "stl" | "obj"): string {
  const ext = `.${format}`;
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}
