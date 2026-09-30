# Web CAD / URDF Editor

A browser-based simple CAD / URDF editor for building **PyBullet-ready** robot
models in the browser. It is *not* a full CAD or FEM tool — it focuses on:

- Building analysis primitives (`box` / `cylinder` / `sphere`) for collision & dynamics
- Defining links and joints through a GUI
- Setting mass / center of mass / inertia (manual or auto-computed)
- Assigning display meshes (STL / OBJ) independently of collision geometry
- Exporting a complete URDF package + a PyBullet preview script

The **RobotModel JSON is the single source of truth**; the Three.js scene is
always rebuilt as a view of that model, never the other way round.

## Tech stack

| Area     | Choice |
|----------|--------|
| UI       | React + TypeScript + Vite |
| 3D       | Three.js + React Three Fiber + drei |
| State    | Zustand |
| Export   | JSZip, DOM `XMLSerializer` (no string-concatenated XML) |
| Meshes   | three STL/OBJ Loader & Exporter |
| Tests    | Vitest (jsdom) |

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite)
npm run build      # typecheck + production build
npm test           # run the unit test suite (Vitest)
npm run lint       # ESLint checks
```

Open the dev server URL (default http://localhost:5173). The app loads a
**sample two-link arm** so the canvas is never empty.

## Using the editor

Layout: **Toolbar** (top) · **Robot tree** (left) · **3D viewport / URDF XML**
(center) · **Property editor** (right) · **Validation panel** (bottom).

Toolbar actions:

- **+ Link / + Box / + Cylinder / + Sphere** — add a link (the primitive
  variants seed both visual & collision geometry and auto-fill box inertia).
- **+ Joint** — create a joint between the last two links (then edit
  parent/child/type/axis/limits in the property editor).
- **Import STL/OBJ** — import a display mesh asset.
- **Visual → Mesh** — generate a display mesh from the selected link's visual
  primitive (in-app primitive → mesh).
- **Export URDF zip** — download the full package (see below).
- **Save JSON / Load JSON** — persist/restore the project (`robot_model.json`).
- View toggles: visual, collision, joint axes, center of mass, grid.

Select a movable joint in the robot tree to open **Joint preview**. Use its
slider or numeric value to rotate revolute/continuous joints (radians) or move
prismatic joints (meters). Revolute and prismatic previews respect their limits;
continuous previews cover −π to π. **Reset all joint previews** selects zero, or
the nearest allowed position when zero is outside a joint's limits. Missing or
invalid position limits and zero/non-finite axes disable the preview controls.

Preview positions affect only the viewport. Joint origins, saved JSON, and
exported URDF remain unchanged. Loading or creating a project clears preview
positions; removing joints, changing their type, or editing their limits clears
or clamps the affected preview values. This is a kinematic preview, without
collision detection or dynamics simulation.

Project loading accepts schema version 1, legacy raw models, and legacy wrappers
without a version. Unsupported explicit versions and empty/duplicate entity IDs
are rejected with an error, preserving the current project. IDs are unique within
each of links, joints, and meshes. Missing legacy joint/mesh IDs are still generated,
but a generated ID must not collide with another entity of the same kind.

Conventions:

- Units are **meters / kilograms / radians** throughout.
- Coordinate frame is **Z-up** (URDF / PyBullet convention). The viewport camera
  up-axis is +Z and the floor grid lies on the XY plane. World axes at the
  origin: X red, Y green, Z blue.
- Cylinders are oriented along **+Z**, matching the URDF inertia conventions.
- `rpy` is the URDF fixed-axis convention `R = Rz(yaw)·Ry(pitch)·Rx(roll)`.

## Inertia

The auto-compute button fills the inertia tensor from the link's collision (or
visual) primitive and its mass:

```
box:      Ixx = 1/12 m (y² + z²),  Iyy = 1/12 m (x² + z²),  Izz = 1/12 m (x² + y²)
sphere:   Ixx = Iyy = Izz = 2/5 m r²
cylinder: Ixx = Iyy = 1/12 m (3r² + h²),  Izz = 1/2 m r²   (axis = z)
```

## Exported package

`Export URDF zip` produces `<robot_name>_package.zip`:

```
robot.urdf                 URDF (collision = primitives, visual = primitives/meshes)
meshes/
  visual/*.stl|*.obj       referenced visual meshes (relative paths)
  collision/*.stl|*.obj    referenced collision meshes (if any)
preview_pybullet.py        PyBullet GUI preview with per-joint sliders
robot_model.json           re-loadable editor project
validation_report.json     errors & warnings at export time
README.txt                 quick-start notes
```

Mesh paths in the URDF are **relative** (e.g. `meshes/visual/arm.stl`).

### Previewing in PyBullet

```bash
pip install pybullet
cd <unzipped package>
python preview_pybullet.py
```

The script connects to the GUI, loads `plane.urdf` and `robot.urdf`, sets
gravity, prints link/joint info, and creates a slider per non-fixed joint.

## Validation

The validation panel evaluates the model live. **Errors** block a clean export
(robot/link/joint names, single root, parent/child resolution, no self-loops,
no cycles, no multi-parent links, no disconnected links, unique nonempty entity
IDs, finite poses, finite non-zero axes, ordered finite limits on revolute/prismatic,
nonnegative finite effort/velocity/damping/friction, positive finite mass,
finite positive-definite inertia, positive & finite geometry
dimensions, collision present, mesh references resolve, unit = m).
**Warnings** flag risky-but-valid setups (mesh used for collision, identical
visual/collision mesh, far-off inertial origin, extreme joint limits). Click an
issue to jump to the offending link/joint.

The inertia check verifies positive definiteness, including off-diagonal terms
(tensors indistinguishable from singular within floating-point precision are rejected);
it does not establish that a tensor matches the chosen geometry or satisfies
every physical realizability constraint. Exporting with errors remains available
after the existing confirmation, with those errors recorded in the package.

## Sample

[`examples/sample_arm/`](examples/sample_arm/) contains the exported artifacts
for the built-in sample (`robot.urdf`, `preview_pybullet.py`, `robot_model.json`,
`validation_report.json`). Load `robot_model.json` via **Load JSON** to edit it.

## Scope

In scope (MVP): primitive shapes, links, joints (fixed / revolute / continuous /
prismatic), mass & inertia, STL/OBJ visual meshes, URDF + package export,
validation. Out of scope: STEP/IGES import, parametric/history CAD, boolean
modeling, sculpting, FEM/stress analysis, SDF/MJCF, ROS2 control, auto-VHACD.

## Project structure

```
src/
  types/robot.ts            core data model (source of truth)
  store/robotStore.ts       Zustand store
  store/previewStore.ts     transient joint preview positions
  lib/
    inertia.ts              primitive inertia formulas
    factories.ts            default link/joint/geometry builders
    kinematics.ts           forward kinematics for display
    urdf.ts                 DOM-based URDF generation
    validation.ts           model validation rules
    pybullet.ts             preview_pybullet.py generator
    projectIO.ts            project JSON save/load
    modelIdentity.ts        shared ID checks for import and validation
    meshIO.ts               STL/OBJ import/export, primitive → mesh
    meshPaths.ts            package mesh path resolution
    package.ts              JSZip package assembly
  three/coords.ts           pose ↔ Three.js conversions
  components/               toolbar, tree, viewport, properties, validation
  sample/sampleRobot.ts     built-in sample model
```

## Development and references

Run `npm test`, `npm run lint`, and `npm run build` locally before merging.
No GitHub Actions workflow is required for these checks.

Joint preview behavior was informed by the
[urdf-loaders joint value API](https://github.com/gkjohnson/urdf-loaders/blob/master/javascript/README.md)
and the [URDF reference parser](https://github.com/ros/urdfdom/blob/master/urdf_parser/src/joint.cpp).
The editor uses its existing Three.js implementation and adds no runtime dependencies.
