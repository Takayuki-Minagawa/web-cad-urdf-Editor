import type { JointSpec, JointType } from "../../types/robot";
import { useRobotStore } from "../../store/robotStore";
import { Field, NumberInput, Section, TextInput, Vec3Input } from "../common/inputs";
import { PoseEditor } from "./PoseEditor";

const TYPES: JointType[] = ["fixed", "revolute", "continuous", "prismatic"];

export function JointProperties({ joint }: { joint: JointSpec }) {
  const replaceJoint = useRobotStore((s) => s.replaceJoint);
  const links = useRobotStore((s) => s.model.links);

  const patch = (changes: Partial<JointSpec>) => replaceJoint({ ...joint, ...changes });

  const changeType = (type: JointType) => {
    const next: JointSpec = { ...joint, type };
    if (type === "revolute" || type === "prismatic") {
      next.limit = joint.limit ?? { lower: -1.57, upper: 1.57, effort: 100, velocity: 1 };
    } else {
      next.limit = undefined;
    }
    if (type === "fixed") next.dynamics = undefined;
    else next.dynamics = joint.dynamics ?? { damping: 0, friction: 0 };
    replaceJoint(next);
  };

  const needsLimit = joint.type === "revolute" || joint.type === "prismatic";
  const movable = joint.type !== "fixed";

  return (
    <div>
      <Section title="Joint">
        <Field label="name">
          <TextInput value={joint.name} onChange={(name) => patch({ name })} />
        </Field>
        <Field label="type">
          <select className="select" value={joint.type} onChange={(e) => changeType(e.target.value as JointType)}>
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
            <NumberInput value={joint.limit?.lower ?? 0} onChange={(lower) => patch({ limit: { ...limit(joint), lower } })} />
          </Field>
          <Field label="upper (rad/m)">
            <NumberInput value={joint.limit?.upper ?? 0} onChange={(upper) => patch({ limit: { ...limit(joint), upper } })} />
          </Field>
          <Field label="effort (N·m / N)">
            <NumberInput value={joint.limit?.effort ?? 0} min={0} onChange={(effort) => patch({ limit: { ...limit(joint), effort } })} />
          </Field>
          <Field label="velocity">
            <NumberInput value={joint.limit?.velocity ?? 0} min={0} onChange={(velocity) => patch({ limit: { ...limit(joint), velocity } })} />
          </Field>
        </Section>
      )}

      {movable && (
        <Section title="Dynamics">
          <Field label="damping">
            <NumberInput value={joint.dynamics?.damping ?? 0} min={0} onChange={(damping) => patch({ dynamics: { ...dyn(joint), damping } })} />
          </Field>
          <Field label="friction">
            <NumberInput value={joint.dynamics?.friction ?? 0} min={0} onChange={(friction) => patch({ dynamics: { ...dyn(joint), friction } })} />
          </Field>
        </Section>
      )}
    </div>
  );
}

function limit(joint: JointSpec) {
  return joint.limit ?? { lower: 0, upper: 0, effort: 0, velocity: 0 };
}
function dyn(joint: JointSpec) {
  return joint.dynamics ?? { damping: 0, friction: 0 };
}
