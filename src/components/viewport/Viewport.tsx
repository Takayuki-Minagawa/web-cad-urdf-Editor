import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useRobotStore } from "../../store/robotStore";
import { usePreviewStore } from "../../store/previewStore";
import { computeLinkWorldTransforms } from "../../lib/kinematics";
import { LinkObject } from "./LinkObject";
import { JointAxes } from "./JointAxes";

export function Viewport() {
  const model = useRobotStore((s) => s.model);
  const view = useRobotStore((s) => s.view);
  const selection = useRobotStore((s) => s.selection);
  const select = useRobotStore((s) => s.select);

  const positions = usePreviewStore((s) => s.positions);
  const world = useMemo(() => computeLinkWorldTransforms(model, positions), [model, positions]);
  const selectedLinkId = selection?.kind === "link" ? selection.id : undefined;
  const selectedJointId = selection?.kind === "joint" ? selection.id : undefined;

  return (
    <Canvas
      shadows
      camera={{ up: [0, 0, 1], position: [1.2, -1.4, 1.0], fov: 50, near: 0.01, far: 100 }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={["#1a1d23"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, -4, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-3, 3, 2]} intensity={0.4} />

      {/* World axes at origin: X red, Y green, Z blue */}
      <axesHelper args={[0.3]} />

      {view.showGrid && (
        // drei Grid lies in the XZ plane; rotate onto XY so it is the Z=0 floor.
        <group rotation={[Math.PI / 2, 0, 0]}>
          <Grid
            args={[10, 10]}
            cellSize={0.1}
            cellThickness={0.6}
            sectionSize={1}
            sectionThickness={1}
            cellColor="#3a3f4b"
            sectionColor="#586070"
            fadeDistance={12}
            infiniteGrid
          />
        </group>
      )}

      {model.links.map((link) => (
        <LinkObject
          key={link.id}
          link={link}
          world={world.get(link.id)!}
          meshes={model.meshes}
          view={view}
          selected={link.id === selectedLinkId}
          onSelect={() => select({ kind: "link", id: link.id })}
        />
      ))}

      {view.showJointAxes && (
        <JointAxes
          joints={model.joints}
          world={world}
          selectedJointId={selectedJointId}
          onSelect={(id) => select({ kind: "joint", id })}
        />
      )}

      <OrbitControls makeDefault enableDamping dampingFactor={0.15} />
    </Canvas>
  );
}
