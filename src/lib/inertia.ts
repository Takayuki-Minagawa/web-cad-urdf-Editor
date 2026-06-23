// Simple inertia tensors for primitive solids (uniform density), about the
// geometric center, aligned with the body axes. Units: kg, m -> kg*m^2.
//
// Conventions follow the AI request:
//   box:      Ixx = 1/12 m (y^2 + z^2), etc.
//   sphere:   Ixx = Iyy = Izz = 2/5 m r^2
//   cylinder: axis = z;  Ixx = Iyy = 1/12 m (3 r^2 + h^2), Izz = 1/2 m r^2

import type { GeometrySpec, Inertia } from "../types/robot";

export function boxInertia(mass: number, size: [number, number, number]): Inertia {
  const [x, y, z] = size;
  return {
    ixx: (mass / 12) * (y * y + z * z),
    iyy: (mass / 12) * (x * x + z * z),
    izz: (mass / 12) * (x * x + y * y),
    ixy: 0,
    ixz: 0,
    iyz: 0,
  };
}

export function sphereInertia(mass: number, radius: number): Inertia {
  const i = (2 / 5) * mass * radius * radius;
  return { ixx: i, iyy: i, izz: i, ixy: 0, ixz: 0, iyz: 0 };
}

export function cylinderInertia(mass: number, radius: number, length: number): Inertia {
  const ix = (1 / 12) * mass * (3 * radius * radius + length * length);
  return {
    ixx: ix,
    iyy: ix,
    izz: (1 / 2) * mass * radius * radius,
    ixy: 0,
    ixz: 0,
    iyz: 0,
  };
}

/**
 * Compute an inertia tensor from a primitive geometry and mass.
 * Returns null for mesh geometry (no simple closed form).
 */
export function inertiaFromGeometry(mass: number, geom: GeometrySpec): Inertia | null {
  switch (geom.type) {
    case "box":
      return boxInertia(mass, geom.size);
    case "sphere":
      return sphereInertia(mass, geom.radius);
    case "cylinder":
      return cylinderInertia(mass, geom.radius, geom.length);
    case "mesh":
      return null;
  }
}
