import { useMemo } from "react";
import * as THREE from "three";
import type { JointSpec } from "../../types/robot";
import { normalizedJointAxis } from "../../lib/kinematics";

interface Props {
  joints: JointSpec[];
  /** world transform of each link, keyed by link id */
  world: Map<string, THREE.Matrix4>;
  selectedJointId?: string;
  onSelect: (id: string) => void;
}

const PRISMATIC_COLOR = 0x4aa3ff;
const REVOLUTE_COLOR = 0xff5a4a;

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
  const { position, quaternion, arrow } = useMemo(() => {
    const m = world.get(joint.child) ?? new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(p, q, s);
    const dir = normalizedJointAxis(joint.axis)!;
    const color = joint.type === "prismatic" ? PRISMATIC_COLOR : REVOLUTE_COLOR;
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 0.25, selected ? 0xffff00 : color, 0.06, 0.035);
    return { position: p, quaternion: q, arrow };
  }, [joint, world, selected]);

  return (
    <group position={position} quaternion={quaternion} onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}>
      <primitive object={arrow} />
    </group>
  );
}
