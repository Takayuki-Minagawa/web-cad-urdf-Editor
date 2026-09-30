import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useRobotStore } from "../../store/robotStore";
import { usePreviewStore } from "../../store/previewStore";
import { JointPreview } from "./JointPreview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let jointId: string;

function SelectedJointPreview() {
  const joint = useRobotStore((state) => state.model.joints[0]);
  return <JointPreview joint={joint} />;
}

describe("joint preview controls", () => {
  beforeEach(() => {
    const store = useRobotStore.getState();
    store.newModel();
    jointId = store.addJoint(store.addLink(), store.addLink(), "prismatic")!;
    store.updateJointLimit(jointId, { lower: -0.5, upper: 0.5 });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<SelectedJointPreview />); });
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it("poses with the slider and clamps numeric edits before displaying the committed value", () => {
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    const numeric = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(container.textContent).toContain("Position (m)");
    expect(slider.min).toBe("-0.5");
    expect(slider.max).toBe("0.5");
    act(() => { slider.value = "0.25"; Simulate.change(slider); });
    expect(usePreviewStore.getState().positions[jointId]).toBe(0.25);
    expect(numeric.value).toBe("0.25");
    act(() => { numeric.value = "9"; Simulate.change(numeric); });
    act(() => { Simulate.blur(numeric); });
    expect(usePreviewStore.getState().positions[jointId]).toBe(0.5);
    expect(numeric.value).toBe("0.5");
    act(() => { numeric.value = "invalid"; Simulate.change(numeric); });
    act(() => { Simulate.blur(numeric); });
    expect(numeric.value).toBe("0.5");
    act(() => { Simulate.click(container.querySelector("button")!); });
    expect(usePreviewStore.getState().positions).toEqual({});
    expect(numeric.value).toBe("0");
  });

  it("disables invalid limits and updates units/range when switching joint types", () => {
    act(() => { useRobotStore.getState().updateJointLimit(jointId, { lower: 2 }); });
    expect([...container.querySelectorAll("input")].every((input) => input.disabled)).toBe(true);
    expect(container.textContent).toContain("valid lower/upper limits");
    act(() => { useRobotStore.getState().setJointType(jointId, "continuous"); });
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.disabled).toBe(false);
    expect(slider.min).toBe(String(-Math.PI));
    expect(slider.max).toBe(String(Math.PI));
    expect(container.textContent).toContain("Position (rad)");
  });
});
