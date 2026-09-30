import { useEffect, useRef, useState } from "react";
import type { Vec3 } from "../../types/robot";

/** A text-backed number field that commits on blur/Enter and tolerates intermediate states like "-" or "1.". */
export function NumberInput({
  value,
  onChange,
  step = 0.01,
  min,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatNum(value));
  }, [value]);

  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && (min === undefined || n >= min)) onChange(n);
    else setText(formatNum(value));
  };

  return (
    <input
      className="num-input"
      type="text"
      inputMode="decimal"
      value={text}
      step={step}
      disabled={disabled}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  // Keep the stored precision: merely focusing and blurring a field must not
  // round small dimensions or inertia components down to zero.
  return String(n);
}

export function Vec3Input({
  value,
  onChange,
  step,
  min,
  labels = ["x", "y", "z"],
}: {
  value: Vec3;
  onChange: (v: Vec3) => void;
  step?: number;
  min?: number;
  labels?: [string, string, string];
}) {
  return (
    <div className="vec3">
      {[0, 1, 2].map((i) => (
        <label key={i} className="vec3-cell">
          <span className="vec3-label">{labels[i]}</span>
          <NumberInput
            value={value[i]}
            step={step}
            min={min}
            onChange={(n) => {
              const next = [...value] as Vec3;
              next[i] = n;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  return (
    <input
      className="text-input"
      type="text"
      value={text}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        onChange(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="prop-section">
      <h4 className="prop-section-title">{title}</h4>
      {children}
    </div>
  );
}
