import { useMemo } from "react";
import * as THREE from "three";
import type { LinkSpec, MeshAsset } from "../../types/robot";
import type { ViewOptions } from "../../store/robotStore";
import { poseToMatrix } from "../../three/coords";
import { ShapeMesh } from "./ShapeMesh";

interface Props {
  link: LinkSpec;
  world: THREE.Matrix4;
  meshes: MeshAsset[];
  view: ViewOptions;
  selected: boolean;
  onSelect: () => void;
}

function GroupAt({ matrix, children }: { matrix: THREE.Matrix4; children: React.ReactNode }) {
  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    matrix.decompose(p, q, s);
    return { position: p, quaternion: q };
  }, [matrix]);
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  );
}

/** Renders one link's visual, collision, and center-of-mass at its world transform. */
export function LinkObject({ link, world, meshes, view, selected, onSelect }: Props) {
  return (
    <GroupAt matrix={world}>
      {view.showVisual && link.visual && (
        <GroupAt matrix={poseToMatrix(link.visual.origin)}>
          <ShapeMesh
            geometry={link.visual.geometry}
            meshes={meshes}
            color={selected ? [1, 0.7, 0.2, link.visual.color[3]] : link.visual.color}
            onPointerDown={(e) => {
              (e as unknown as { stopPropagation: () => void }).stopPropagation();
              onSelect();
            }}
          />
        </GroupAt>
      )}

      {view.showCollision && link.collision && (
        <GroupAt matrix={poseToMatrix(link.collision.origin)}>
          <ShapeMesh
            geometry={link.collision.geometry}
            meshes={meshes}
            color={[0.2, 0.9, 0.4, 1]}
            wireframe
            opacity={0.6}
            onPointerDown={(e) => {
              (e as unknown as { stopPropagation: () => void }).stopPropagation();
              onSelect();
            }}
          />
        </GroupAt>
      )}

      {view.showCenterOfMass && (
        <group
          position={[
            link.inertial.origin.xyz[0],
            link.inertial.origin.xyz[1],
            link.inertial.origin.xyz[2],
          ]}
        >
          <mesh>
            <sphereGeometry args={[0.02, 12, 12]} />
            <meshBasicMaterial color="yellow" />
          </mesh>
        </group>
      )}
    </GroupAt>
  );
}
