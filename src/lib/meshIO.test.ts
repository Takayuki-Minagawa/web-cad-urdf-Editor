import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  primitiveToBufferGeometry,
  parseMeshAsset,
  geometryToMeshData,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./meshIO";
import type { MeshAsset } from "../types/robot";

describe("primitiveToBufferGeometry", () => {
  it("builds a box geometry with a position attribute", () => {
    const g = primitiveToBufferGeometry({ type: "box", size: [1, 2, 3] });
    expect(g).toBeInstanceOf(THREE.BufferGeometry);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("builds a sphere geometry with a position attribute", () => {
    const g = primitiveToBufferGeometry({ type: "sphere", radius: 0.5 });
    expect(g).toBeInstanceOf(THREE.BufferGeometry);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("builds a cylinder geometry with a position attribute", () => {
    const g = primitiveToBufferGeometry({ type: "cylinder", radius: 0.2, length: 1 });
    expect(g).toBeInstanceOf(THREE.BufferGeometry);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("throws for a mesh spec", () => {
    expect(() =>
      primitiveToBufferGeometry({ type: "mesh", meshId: "x", scale: [1, 1, 1] }),
    ).toThrow();
  });
});

describe("parseMeshAsset", () => {
  const STL_TRI =
    "solid t\n facet normal 0 0 1\n outer loop\n vertex 0 0 0\n vertex 1 0 0\n vertex 0 1 0\n endloop\n endfacet\n endsolid t\n";

  it("parses a tiny ASCII STL into geometry with vertices", () => {
    const asset: MeshAsset = { id: "1", name: "t.stl", format: "stl", data: STL_TRI };
    const g = parseMeshAsset(asset);
    expect(g).toBeInstanceOf(THREE.BufferGeometry);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
    expect(g.boundingBox).not.toBeNull();
  });

  it("parses a base64-encoded STL the same as its raw text", () => {
    const bytes = new TextEncoder().encode(STL_TRI);
    const asset: MeshAsset = {
      id: "2",
      name: "t.stl",
      format: "stl",
      data: arrayBufferToBase64(bytes.buffer),
      encoding: "base64",
    };
    const g = parseMeshAsset(asset);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });

  it.each([false, true])("retains all OBJ objects with mixed optional attributes (reverse: %s)", (reverse) => {
    const vertices = "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 2 0 0\nv 3 0 0\nv 2 1 0\nvt 0 0\nvt 1 0\nvt 0 1\n";
    const parts = ["o textured\nf 1/1 2/2 3/3\n", "o plain\nf 4 5 6\n"];
    const data = vertices + (reverse ? parts.reverse() : parts).join("");
    const geometry = parseMeshAsset({ id: "mixed", name: "mixed.obj", format: "obj", data });
    expect(geometry.getAttribute("position").count).toBe(6);
    expect(geometry.boundingBox!.min.toArray()).toEqual([0, 0, 0]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([3, 1, 0]);
    expect(geometry.getAttribute("normal").count).toBe(6);
    geometry.dispose();
  });

  it("keeps shared UV attributes when combining OBJ objects", () => {
    const data = "v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\no first\nf 1/1 2/2 3/3\no second\nf 1/1 2/2 3/3\n";
    const geometry = parseMeshAsset({ id: "uv", name: "uv.obj", format: "obj", data });
    expect(geometry.getAttribute("position").count).toBe(6);
    expect(geometry.getAttribute("uv").count).toBe(6);
    geometry.dispose();
  });
});

describe("base64 round-trip", () => {
  it("preserves arbitrary binary bytes exactly", () => {
    // Bytes that are NOT valid UTF-8 (a text round-trip would corrupt these).
    const original = new Uint8Array([0x00, 0xff, 0x80, 0x01, 0x7f, 0xfe, 0x42]);
    const restored = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(original.buffer)));
    expect(Array.from(restored)).toEqual(Array.from(original));
  });
});

describe("geometryToMeshData", () => {
  const box = primitiveToBufferGeometry({ type: "box", size: [1, 1, 1] });

  it("exports STL with 'solid' and a .stl name", () => {
    const out = geometryToMeshData(box, "stl", "cube");
    expect(out.format).toBe("stl");
    expect(out.name).toBe("cube.stl");
    expect(out.data).toContain("solid");
  });

  it("exports OBJ with vertex lines and a .obj name", () => {
    const out = geometryToMeshData(box, "obj", "cube");
    expect(out.format).toBe("obj");
    expect(out.name).toBe("cube.obj");
    expect(out.data).toContain("v ");
  });

  it("does not double-append an existing extension", () => {
    const out = geometryToMeshData(box, "stl", "cube.stl");
    expect(out.name).toBe("cube.stl");
  });
});
