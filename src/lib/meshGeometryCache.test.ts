import { describe, expect, it } from "vitest";
import type { MeshAsset } from "../types/robot";
import { disposeAllCachedMeshGeometries, disposeCachedMeshGeometry, getCachedMeshGeometry } from "./meshGeometryCache";

const STL_A =
  "solid a\n facet normal 0 0 1\n outer loop\n vertex 0 0 0\n vertex 1 0 0\n vertex 0 1 0\n endloop\n endfacet\n endsolid a\n";
const STL_B =
  "solid b\n facet normal 0 0 1\n outer loop\n vertex 0 0 0\n vertex 2 0 0\n vertex 0 2 0\n endloop\n endfacet\n endsolid b\n";

function asset(patch: Partial<MeshAsset> = {}): MeshAsset {
  return {
    id: "mesh_1",
    name: "mesh.stl",
    format: "stl",
    data: STL_A,
    encoding: "utf8",
    ...patch,
  };
}

describe("meshGeometryCache", () => {
  it("reuses geometry for metadata-only updates and disposes changed payloads", () => {
    disposeAllCachedMeshGeometries();

    const first = getCachedMeshGeometry(asset())!;
    let firstDisposed = false;
    first.addEventListener("dispose", () => {
      firstDisposed = true;
    });

    const renamed = getCachedMeshGeometry(asset({ name: "renamed.stl" }));
    expect(renamed).toBe(first);
    expect(firstDisposed).toBe(false);

    const changed = getCachedMeshGeometry(asset({ data: STL_B }))!;
    expect(changed).not.toBe(first);
    expect(firstDisposed).toBe(true);

    let changedDisposed = false;
    changed.addEventListener("dispose", () => {
      changedDisposed = true;
    });
    disposeCachedMeshGeometry("mesh_1");
    expect(changedDisposed).toBe(true);
  });
});
