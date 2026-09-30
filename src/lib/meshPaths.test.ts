import { describe, expect, it } from "vitest";
import { makeLink } from "./factories";
import { buildPackageFiles } from "./package";
import { resolveMeshPlacements } from "./meshPaths";
import type { MeshAsset, RobotModel } from "../types/robot";

function modelWithMeshes(meshes: MeshAsset[]): RobotModel {
  return {
    name: "mesh_robot",
    unit: "m",
    meshes,
    joints: [],
    links: meshes.map((mesh) => {
      const link = makeLink(mesh.id);
      link.visual!.geometry = { type: "mesh", meshId: mesh.id, scale: [1, 1, 1] };
      link.collision!.geometry = { type: "mesh", meshId: mesh.id, scale: [1, 1, 1] };
      return link;
    }),
  };
}

describe("mesh package paths", () => {
  it.each([
    ["arm", "arm.stl"],
    ["arm.OBJ", "arm.stl"],
    ["arm.STL", "arm.stl"],
    ["", "mesh.stl"],
    ["..", "mesh.stl"],
    ["parts/arm", "parts_arm.stl"],
  ])("exports edited name %s using the actual mesh format", (name, expected) => {
    const model = modelWithMeshes([{ id: "mesh", name, format: "stl", data: "solid mesh\nendsolid mesh" }]);
    const files = buildPackageFiles(model);
    for (const bucket of ["visual", "collision"]) {
      const path = `meshes/${bucket}/${expected}`;
      expect(files[path]).toBe(model.meshes[0].data);
      expect(files["robot.urdf"]).toContain(`filename="${path}"`);
    }
  });

  it("deduplicates names after extension normalization on case-insensitive filesystems", () => {
    const model = modelWithMeshes([
      { id: "a", name: "Arm", format: "obj", data: "first" },
      { id: "b", name: "arm.stl", format: "obj", data: "second" },
      { id: "c", name: "arm_1.obj", format: "obj", data: "third" },
    ]);
    const placements = resolveMeshPlacements(model);
    expect([...placements.values()].map((p) => p.visualPath)).toEqual([
      "meshes/visual/Arm.obj",
      "meshes/visual/arm_1.obj",
      "meshes/visual/arm_1_1.obj",
    ]);
    const files = buildPackageFiles(model);
    for (const placement of placements.values()) {
      const mesh = model.meshes.find((m) => m.id === placement.meshId)!;
      expect(files[placement.visualPath!]).toBe(mesh.data);
      expect(files[placement.collisionPath!]).toBe(mesh.data);
    }
  });
});
