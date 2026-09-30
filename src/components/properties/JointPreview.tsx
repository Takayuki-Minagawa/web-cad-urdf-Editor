import { useEffect, useId, useState } from "react";
import type { JointSpec } from "../../types/robot";
import { jointPreviewPosition, jointPreviewRange } from "../../lib/kinematics";
import { usePreviewStore } from "../../store/previewStore";
import { Section } from "../common/inputs";

export function JointPreview({ joint }: { joint: JointSpec }) {
  const storedPosition = usePreviewStore((state) => state.positions[joint.id]);
  const setPosition = usePreviewStore((state) => state.setPosition);
  const reset = usePreviewStore((state) => state.reset);
  const range = jointPreviewRange(joint);
  const position = jointPreviewPosition(joint, storedPosition);
  const disabled = !range || range.min === range.max;
  const unit = joint.type === "prismatic" ? "m" : "rad";
  const controlId = useId();
  const [text, setText] = useState(String(position));

  useEffect(() => { setText(String(position)); }, [position, joint.id]);

  const commit = () => {
    const parsed = text.trim() === "" ? NaN : Number(text);
    const next = Number.isFinite(parsed) ? jointPreviewPosition(joint, parsed) : position;
    setPosition(joint.id, next);
    setText(String(next));
  };

  return (
    <Section title="Joint preview">
      <p className="hint">Viewport only. Saved project and URDF origins stay unchanged.</p>
      <label className="field-label" htmlFor={`${controlId}-slider`}>Position ({unit})</label>
      <input
        id={`${controlId}-slider`}
        className="joint-preview-slider"
        type="range"
        min={range?.min ?? 0}
        max={range?.max ?? 0}
        step="any"
        value={position}
        disabled={disabled}
        onChange={(event) => setPosition(joint.id, Number(event.target.value))}
      />
      <label className="field" htmlFor={`${controlId}-value`}>
        <span className="field-label">Value ({unit})</span>
        <input
          id={`${controlId}-value`}
          className="num-input"
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
      </label>
      {range ? (
        <p className="hint">Range: {range.min.toFixed(3)} to {range.max.toFixed(3)} {unit}</p>
      ) : (
        <p className="hint">Set a nonzero finite axis and valid lower/upper limits to preview this joint.</p>
      )}
      <button type="button" className="btn" onClick={reset}>Reset all joint previews</button>
      <p className="hint">Reset uses zero, or the nearest allowed position.</p>
    </Section>
  );
}
