import { useEffect, useLayoutEffect, useMemo } from "react";
import { ArrowHelper, Vector3 } from "three";
import type { JointSpec } from "../../types/robot";
import { normalizedJointAxis } from "../../lib/kinematics";

/** Keep the arrow's GPU materials stable while its world transform changes. */
export function useJointArrow(joint: JointSpec, selected: boolean): ArrowHelper {
  const arrow = useMemo(() => new ArrowHelper(new Vector3(0, 0, 1), new Vector3(), 0.25, 0xff5a4a, 0.06, 0.035), []);
  useLayoutEffect(() => {
    const direction = normalizedJointAxis(joint.axis);
    if (direction) arrow.setDirection(direction);
    arrow.setColor(selected ? 0xffff00 : joint.type === "prismatic" ? 0x4aa3ff : 0xff5a4a);
  }, [arrow, joint.axis, joint.type, selected]);

  useEffect(() => () => {
    // R3F does not dispose <primitive>. ArrowHelper shares its geometries with
    // other arrows, so release only the materials owned by this instance.
    for (const material of [arrow.line.material, arrow.cone.material].flat()) material.dispose();
  }, [arrow]);
  return arrow;
}
