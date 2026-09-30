/// <reference types="vite/client" />
import { create } from "zustand";
import { jointPreviewPosition, type JointPositions } from "../lib/kinematics";
import { useRobotStore } from "./robotStore";

interface PreviewState {
  positions: JointPositions;
  setPosition: (jointId: string, value: number) => void;
  reset: () => void;
}

/** Transient viewport state, deliberately outside the serializable RobotModel. */
export const usePreviewStore = create<PreviewState>((set) => ({
  positions: {},
  setPosition: (jointId, value) => {
    if (!Number.isFinite(value)) return;
    const joint = useRobotStore.getState().model.joints.find((candidate) => candidate.id === jointId);
    if (!joint) return;
    const next = jointPreviewPosition(joint, value);
    set((state) => state.positions[jointId] === next ? state : { positions: { ...state.positions, [jointId]: next } });
  },
  reset: () => set({ positions: {} }),
}));

const unsubscribe = useRobotStore.subscribe((state, previous) => {
  if (state.modelRevision !== previous.modelRevision) {
    usePreviewStore.getState().reset();
    return;
  }
  if (state.model.joints === previous.model.joints) return;
  const positions = usePreviewStore.getState().positions;
  const previousJoints = new Map(previous.model.joints.map((joint) => [joint.id, joint]));
  const next: Record<string, number> = Object.create(null);
  for (const joint of state.model.joints) {
    if (!Object.prototype.hasOwnProperty.call(positions, joint.id)) continue;
    if (previousJoints.get(joint.id)?.type !== joint.type) continue;
    next[joint.id] = jointPreviewPosition(joint, positions[joint.id]);
  }
  const keys = Object.keys(positions);
  if (keys.length !== Object.keys(next).length || keys.some((id) => next[id] !== positions[id])) {
    usePreviewStore.setState({ positions: next });
  }
});

// Vite replaces this module in development; do not accumulate subscriptions.
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
