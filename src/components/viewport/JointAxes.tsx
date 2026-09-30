import { useMemo } from "react";
import * as THREE from "three";
import type { JointSpec } from "../../types/robot";
import { normalizedJointAxis } from "../../lib/kinematics";
import { useJointArrow } from "./useJointArrow";

interface Props {
  joints: JointSpec[];
  /** world transform of each link, keyed by link id */
  world: Map<string, THREE.Matrix4>;
  selectedJointId?: string;
  onSelect: (id: string) => void;
}

/** Draws an arrow along each non-fixed joint's axis at the child link origin. */
export function JointAxes({ joints, world, selectedJointId, onSelect }: Props) {
  return (
    <>
      {joints.map((j) => {
        if (j.type === "fixed" || !normalizedJointAxis(j.axis)) return null;
        return <SingleAxis key={j.id} joint={j} world={world} selected={j.id === selectedJointId} onSelect={() => onSelect(j.id)} />;
      })}
    </>
  );
}

function SingleAxis({
  joint,
  world,
  selected,
  onSelect,
}: {
  joint: JointSpec;
  world: Map<string, THREE.Matrix4>;
  selected: boolean;
  onSelect: () => void;
}) {
  const arrow = useJointArrow(joint, selected);
  const { position, quaternion } = useMemo(() => {
    const m = world.get(joint.child) ?? new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(p, q, s);
    return { position: p, quaternion: q };
  }, [joint.child, world]);

  return (
    <group position={position} quaternion={quaternion} onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}>
      <primitive object={arrow} />
    </group>
  );
}
