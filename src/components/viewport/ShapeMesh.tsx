import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { GeometrySpec, MeshAsset, Rgba } from "../../types/robot";
import { getCachedMeshGeometry } from "../../lib/meshGeometryCache";

interface Props {
  geometry: GeometrySpec;
  meshes: MeshAsset[];
  color?: Rgba;
  wireframe?: boolean;
  opacity?: number;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}

/** Renders a single GeometrySpec. Cylinders are oriented along +Z (URDF convention). */
export function ShapeMesh({ geometry, meshes, color, wireframe, opacity = 1, onPointerDown }: Props) {
  const meshGeometry = useMemo(() => {
    if (geometry.type !== "mesh") return null;
    const asset = meshes.find((m) => m.id === geometry.meshId);
    if (!asset) return null;
    return getCachedMeshGeometry(asset);
  }, [geometry, meshes]);

  const [r, g, b, a] = color ?? [0.6, 0.6, 0.65, 1];
  const material = (
    <meshStandardMaterial
      color={new THREE.Color(r, g, b)}
      wireframe={wireframe}
      transparent={opacity * a < 1}
      opacity={opacity * a}
      metalness={0.1}
      roughness={0.7}
      side={THREE.DoubleSide}
    />
  );

  switch (geometry.type) {
    case "box":
      return (
        <mesh onPointerDown={onPointerDown} castShadow>
          <boxGeometry args={geometry.size} />
          {material}
        </mesh>
      );
    case "sphere":
      return (
        <mesh onPointerDown={onPointerDown} castShadow>
          <sphereGeometry args={[geometry.radius, 32, 16]} />
          {material}
        </mesh>
      );
    case "cylinder":
      // THREE cylinders run along Y; rotate so the axis is +Z.
      return (
        <mesh onPointerDown={onPointerDown} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[geometry.radius, geometry.radius, geometry.length, 32]} />
          {material}
        </mesh>
      );
    case "mesh":
      if (!meshGeometry) {
        // Missing/failed mesh: show a small placeholder marker.
        return (
          <mesh onPointerDown={onPointerDown}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshStandardMaterial color="magenta" wireframe />
          </mesh>
        );
      }
      return (
        <mesh
          onPointerDown={onPointerDown}
          geometry={meshGeometry}
          scale={geometry.scale}
          castShadow
        >
          {material}
        </mesh>
      );
  }
}
