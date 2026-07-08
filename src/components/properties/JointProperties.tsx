import type { JointSpec, JointType } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { Field, NumberInput, Section, TextInput, Vec3Input } from "../common/inputs";
import { PoseEditor } from "./PoseEditor";

const TYPES: JointType[] = ["fixed", "revolute", "continuous", "prismatic"];

export function JointProperties({ joint }: { joint: JointSpec }) {
  const updateJoint = useRobotStore((s) => s.updateJoint);
  const setJointType = useRobotStore((s) => s.setJointType);
  const updateJointLimit = useRobotStore((s) => s.updateJointLimit);
  const updateJointDynamics = useRobotStore((s) => s.updateJointDynamics);
  const links = useRobotStore((s) => s.model.links);

  const patch = (changes: Partial<JointSpec>) => updateJoint(joint.id, changes);

  const needsLimit = joint.type === "revolute" || joint.type === "prismatic";
  const movable = joint.type !== "fixed";

  return (
    <div>
      <Section title="Joint">
        <Field label="name">
          <TextInput value={joint.name} onChange={(name) => patch({ name })} />
        </Field>
        <Field label="type">
          <select className="select" value={joint.type} onChange={(e) => setJointType(joint.id, e.target.value as JointType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="parent">
          <select className="select" value={joint.parent} onChange={(e) => patch({ parent: e.target.value })}>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="child">
          <select className="select" value={joint.child} onChange={(e) => patch({ child: e.target.value })}>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Origin">
        <PoseEditor pose={joint.origin} onChange={(origin) => patch({ origin })} />
      </Section>

      {movable && (
        <Section title="Axis">
          <Field label="xyz">
            <Vec3Input value={joint.axis} step={1} onChange={(axis) => patch({ axis })} />
          </Field>
        </Section>
      )}

      {needsLimit && (
        <Section title="Limit">
          <Field label="lower (rad/m)">
            <NumberInput value={joint.limit?.lower ?? 0} onChange={(lower) => updateJointLimit(joint.id, { lower })} />
          </Field>
          <Field label="upper (rad/m)">
            <NumberInput value={joint.limit?.upper ?? 0} onChange={(upper) => updateJointLimit(joint.id, { upper })} />
          </Field>
          <Field label="effort (N·m / N)">
            <NumberInput value={joint.limit?.effort ?? 0} min={0} onChange={(effort) => updateJointLimit(joint.id, { effort })} />
          </Field>
          <Field label="velocity">
            <NumberInput value={joint.limit?.velocity ?? 0} min={0} onChange={(velocity) => updateJointLimit(joint.id, { velocity })} />
          </Field>
        </Section>
      )}

      {movable && (
        <Section title="Dynamics">
          <Field label="damping">
            <NumberInput value={joint.dynamics?.damping ?? 0} min={0} onChange={(damping) => updateJointDynamics(joint.id, { damping })} />
          </Field>
          <Field label="friction">
            <NumberInput value={joint.dynamics?.friction ?? 0} min={0} onChange={(friction) => updateJointDynamics(joint.id, { friction })} />
          </Field>
        </Section>
      )}
    </div>
  );
}
