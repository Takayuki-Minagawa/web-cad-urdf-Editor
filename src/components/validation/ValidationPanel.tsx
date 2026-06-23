import { useMemo } from "react";
import { useRobotStore } from "../../store/robotStore";
import { validateModel, type ValidationIssue } from "../../lib/validation";

export function ValidationPanel() {
  const model = useRobotStore((s) => s.model);
  const select = useRobotStore((s) => s.select);
  const result = useMemo(() => validateModel(model), [model]);

  const focus = (issue: ValidationIssue) => {
    if (issue.target) select({ kind: issue.target.kind, id: issue.target.id });
  };

  return (
    <div className="validation">
      <div className="validation-header">
        <span className={`badge ${result.exportReady ? "badge-ok" : "badge-err"}`}>
          {result.exportReady ? "✓ Export ready" : "✗ Not export ready"}
        </span>
        <span className="validation-counts">
          {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} ·{" "}
          {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="validation-list">
        {result.errors.length === 0 && result.warnings.length === 0 && (
          <div className="validation-clean">No issues. Model is valid.</div>
        )}
        {result.errors.map((issue, idx) => (
          <Row key={`e${idx}`} issue={issue} kind="error" onClick={() => focus(issue)} />
        ))}
        {result.warnings.map((issue, idx) => (
          <Row key={`w${idx}`} issue={issue} kind="warning" onClick={() => focus(issue)} />
        ))}
      </div>
    </div>
  );
}

function Row({ issue, kind, onClick }: { issue: ValidationIssue; kind: "error" | "warning"; onClick: () => void }) {
  return (
    <div className={`validation-row ${kind}${issue.target ? " clickable" : ""}`} onClick={issue.target ? onClick : undefined}>
      <span className="validation-icon">{kind === "error" ? "⛔" : "⚠️"}</span>
      <span className="validation-code">{issue.code}</span>
      <span className="validation-msg">{issue.message}</span>
    </div>
  );
}
