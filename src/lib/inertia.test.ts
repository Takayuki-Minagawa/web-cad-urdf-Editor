import { describe, expect, it } from "vitest";
import { boxInertia, cylinderInertia, sphereInertia, inertiaFromGeometry } from "./inertia";

describe("inertia formulas", () => {
  it("box uses 1/12 m (a^2+b^2)", () => {
    const i = boxInertia(2, [0.4, 0.08, 0.08]);
    expect(i.ixx).toBeCloseTo((2 / 12) * (0.08 ** 2 + 0.08 ** 2), 12);
    expect(i.iyy).toBeCloseTo((2 / 12) * (0.4 ** 2 + 0.08 ** 2), 12);
    expect(i.izz).toBeCloseTo((2 / 12) * (0.4 ** 2 + 0.08 ** 2), 12);
    expect(i.ixy).toBe(0);
  });

  it("sphere is isotropic 2/5 m r^2", () => {
    const i = sphereInertia(3, 0.5);
    const expected = (2 / 5) * 3 * 0.25;
    expect(i.ixx).toBeCloseTo(expected, 12);
    expect(i.ixx).toBe(i.iyy);
    expect(i.iyy).toBe(i.izz);
  });

  it("cylinder uses z as the symmetry axis", () => {
    const m = 4;
    const r = 0.1;
    const h = 0.5;
    const i = cylinderInertia(m, r, h);
    expect(i.ixx).toBeCloseTo((1 / 12) * m * (3 * r * r + h * h), 12);
    expect(i.ixx).toBe(i.iyy);
    expect(i.izz).toBeCloseTo(0.5 * m * r * r, 12);
  });

  it("inertiaFromGeometry dispatches per type and returns null for mesh", () => {
    expect(inertiaFromGeometry(1, { type: "box", size: [1, 1, 1] })).not.toBeNull();
    expect(inertiaFromGeometry(1, { type: "sphere", radius: 1 })).not.toBeNull();
    expect(inertiaFromGeometry(1, { type: "cylinder", radius: 1, length: 1 })).not.toBeNull();
    expect(inertiaFromGeometry(1, { type: "mesh", meshId: "x", scale: [1, 1, 1] })).toBeNull();
  });
});
