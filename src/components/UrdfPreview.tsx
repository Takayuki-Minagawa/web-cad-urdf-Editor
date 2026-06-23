import { useMemo } from "react";
import { useRobotStore } from "../store/robotStore";
import { buildUrdf } from "../lib/urdf";

export function UrdfPreview() {
  const model = useRobotStore((s) => s.model);
  const xml = useMemo(() => {
    try {
      return buildUrdf(model);
    } catch (err) {
      return `<!-- failed to build URDF: ${(err as Error).message} -->`;
    }
  }, [model]);

  return (
    <div className="urdf-preview">
      <div className="urdf-preview-toolbar">
        <button className="btn btn-small" onClick={() => navigator.clipboard?.writeText(xml)}>
          Copy XML
        </button>
      </div>
      <pre className="urdf-preview-code">{xml}</pre>
    </div>
  );
}
