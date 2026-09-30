import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "./inputs";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("NumberInput precision", () => {
  it.each([1e-8, -1e-9, 0.123456789012345, 1.23456789012345e20])(
    "preserves %s when the field is focused and blurred without editing",
    (value) => {
      const onChange = vi.fn();
      act(() => root.render(<NumberInput value={value} onChange={onChange} />));
      const input = container.querySelector("input")!;
      expect(Number(input.value)).toBe(value);
      act(() => input.focus());
      act(() => input.blur());
      expect(onChange).toHaveBeenCalledWith(value);
    },
  );

  it("preserves small values received when the selected link changes", () => {
    const onChange = vi.fn();
    act(() => root.render(<NumberInput value={1} onChange={onChange} />));
    act(() => root.render(<NumberInput value={2e-10} onChange={onChange} />));
    const input = container.querySelector("input")!;
    act(() => input.focus());
    act(() => input.blur());
    expect(onChange).toHaveBeenLastCalledWith(2e-10);
  });
});
