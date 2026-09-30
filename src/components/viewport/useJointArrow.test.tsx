import { act } from "react";
import { createRoot } from "react-dom/client";
import { ArrowHelper, type LineBasicMaterial, type MeshBasicMaterial, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { makeJoint } from "../../lib/factories";
import type { JointSpec } from "../../types/robot";
import { useJointArrow } from "./useJointArrow";

describe("joint axis resources", () => {
  it("reuses the arrow across preview renders and releases only owned materials on unmount", () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    const root = createRoot(container);
    let current!: ArrowHelper;
    function Probe({ joint, selected }: { joint: JointSpec; selected: boolean }) {
      current = useJointArrow(joint, selected);
      return null;
    }
    const joint = makeJoint("axis", "a", "b", "revolute");
    act(() => root.render(<Probe joint={joint} selected={false} />));
    const initial = current;
    const lineMaterial = initial.line.material as LineBasicMaterial;
    const coneMaterial = initial.cone.material as MeshBasicMaterial;
    const lineDisposed = vi.spyOn(lineMaterial, "dispose");
    const coneDisposed = vi.spyOn(coneMaterial, "dispose");
    const geometryDisposed = vi.spyOn(initial.line.geometry, "dispose");
    try {
      for (let i = 0; i < 100; i += 1) {
        act(() => root.render(<Probe joint={joint} selected={false} />));
        expect(current).toBe(initial);
      }
      const moved: JointSpec = { ...joint, type: "prismatic", axis: [1, 0, 0] };
      act(() => root.render(<Probe joint={moved} selected={true} />));
      expect(current).toBe(initial);
      expect(lineMaterial.color.getHex()).toBe(0xffff00);
      const direction = new Vector3(0, 1, 0).applyQuaternion(current.quaternion);
      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
      act(() => root.render(<Probe joint={moved} selected={false} />));
      expect(coneMaterial.color.getHex()).toBe(0x4aa3ff);
      expect(lineDisposed).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
    }
    expect(lineDisposed).toHaveBeenCalledOnce();
    expect(coneDisposed).toHaveBeenCalledOnce();
    expect(geometryDisposed).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
