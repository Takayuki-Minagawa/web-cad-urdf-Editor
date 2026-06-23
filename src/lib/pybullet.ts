// Generates a standalone `preview_pybullet.py` script that loads the exported
// `robot.urdf` in PyBullet's GUI, with one debug slider per movable joint.

import type { RobotModel } from "../types/robot";

/**
 * Encode an arbitrary string as a Python string literal. JSON string syntax is
 * a subset of Python's, so `JSON.stringify` yields a valid, fully-escaped
 * Python literal (quotes, backslashes, newlines, control chars). This prevents
 * a robot name containing `"` or a newline from breaking `py_compile`.
 */
function pyStr(s: string): string {
  return JSON.stringify(s);
}

/** Strip newlines/CRs so a value can be embedded safely in a `#` comment. */
function commentSafe(s: string): string {
  return s.replace(/[\r\n]+/g, " ");
}

/**
 * Build the text of a `preview_pybullet.py` script for the given model.
 * The robot name and joint count are injected from the model; everything else
 * is a static Python template. PyBullet reads limits at runtime from the URDF,
 * so the script is robust to model edits made after generation.
 */
export function buildPreviewScript(model: RobotModel): string {
  const nameComment = commentSafe(model.name);
  const nameLiteral = pyStr(model.name);
  const jointCount = model.joints.length;

  return `#!/usr/bin/env python3
# Auto-generated PyBullet preview for robot: ${nameComment}
# Model joints at generation time: ${jointCount}
#
# Usage:
#   pip install pybullet
#   python preview_pybullet.py
#
# Place this file next to robot.urdf (and its meshes) and run it.

import sys
import time

try:
    import pybullet
    import pybullet_data
except ImportError:
    print("ERROR: pybullet is not installed. Run: pip install pybullet")
    sys.exit(1)


def main():
    # --- connect to the GUI -------------------------------------------------
    try:
        client = pybullet.connect(pybullet.GUI)
        if client < 0:
            raise RuntimeError("pybullet.connect returned an invalid client id")
    except Exception as exc:
        print("ERROR: failed to connect to the PyBullet GUI:", exc)
        sys.exit(1)

    pybullet.setAdditionalSearchPath(pybullet_data.getDataPath())
    pybullet.setGravity(0, 0, -9.81)

    # --- ground plane -------------------------------------------------------
    try:
        pybullet.loadURDF("plane.urdf")
    except Exception as exc:
        print("WARNING: could not load plane.urdf:", exc)

    # --- robot --------------------------------------------------------------
    try:
        robot_id = pybullet.loadURDF(
            "robot.urdf",
            basePosition=[0, 0, 0],
            useFixedBase=True,
        )
    except Exception as exc:
        print("ERROR: failed to load robot.urdf:", exc)
        print("Make sure robot.urdf and its meshes are next to this script.")
        pybullet.disconnect()
        sys.exit(1)

    num_joints = pybullet.getNumJoints(robot_id)
    print("Loaded robot", ${nameLiteral}, "with", num_joints, "joints")

    joint_type_names = {
        pybullet.JOINT_REVOLUTE: "revolute",
        pybullet.JOINT_PRISMATIC: "prismatic",
        pybullet.JOINT_SPHERICAL: "spherical",
        pybullet.JOINT_PLANAR: "planar",
        pybullet.JOINT_FIXED: "fixed",
    }

    # --- decode joint info and build sliders --------------------------------
    sliders = []  # list of (joint_index, slider_id)
    print("---- joints ----")
    for i in range(num_joints):
        info = pybullet.getJointInfo(robot_id, i)
        joint_index = info[0]
        joint_name = info[1].decode("utf-8")
        joint_type = info[2]
        lower = info[8]
        upper = info[9]
        type_name = joint_type_names.get(joint_type, str(joint_type))

        # If the URDF gives no usable range, fall back to a sane span.
        if upper <= lower:
            lower, upper = -3.14159, 3.14159

        print(
            "  [", joint_index, "]",
            "name=", joint_name,
            "type=", type_name,
            "lower=", lower,
            "upper=", upper,
        )

        if joint_type != pybullet.JOINT_FIXED:
            start = max(lower, min(upper, 0.0))
            slider = pybullet.addUserDebugParameter(joint_name, lower, upper, start)
            sliders.append((joint_index, slider))

    # --- link info ----------------------------------------------------------
    print("---- links ----")
    for i in range(num_joints):
        info = pybullet.getJointInfo(robot_id, i)
        link_name = info[12].decode("utf-8")
        print("  link", i, ":", link_name)

    print("Drag the sliders in the GUI to move the joints. Close the window to quit.")

    # --- main loop ----------------------------------------------------------
    try:
        while True:
            for joint_index, slider in sliders:
                target = pybullet.readUserDebugParameter(slider)
                pybullet.setJointMotorControl2(
                    robot_id,
                    joint_index,
                    pybullet.POSITION_CONTROL,
                    targetPosition=target,
                )
            pybullet.stepSimulation()
            time.sleep(1.0 / 240.0)
    except KeyboardInterrupt:
        pass
    finally:
        pybullet.disconnect()


if __name__ == "__main__":
    main()
`;
}
