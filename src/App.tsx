import { useEffect, useRef, useState } from "react";
import { useRobotStore } from "./store/robotStore";
import { sampleRobot } from "./sample/sampleRobot";
import { Toolbar } from "./components/toolbar/Toolbar";
import { RobotTree } from "./components/tree/RobotTree";
import { PropertyEditor } from "./components/properties/PropertyEditor";
import { ValidationPanel } from "./components/validation/ValidationPanel";
import { Viewport } from "./components/viewport/Viewport";
import { UrdfPreview } from "./components/UrdfPreview";

type CenterTab = "3d" | "urdf";

export function App() {
  const loadModel = useRobotStore((s) => s.loadModel);
  const hasLinks = useRobotStore((s) => s.model.links.length > 0);
  const [tab, setTab] = useState<CenterTab>("3d");
  const seeded = useRef(false);

  // Seed with the sample arm on first load so the app is never empty.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (!hasLinks) loadModel(sampleRobot());
  }, [hasLinks, loadModel]);

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <aside className="panel panel-left">
          <RobotTree />
        </aside>

        <main className="panel panel-center">
          <div className="center-tabs">
            <button className={`tab${tab === "3d" ? " active" : ""}`} onClick={() => setTab("3d")}>
              3D View
            </button>
            <button className={`tab${tab === "urdf" ? " active" : ""}`} onClick={() => setTab("urdf")}>
              URDF XML
            </button>
          </div>
          <div className="center-content">
            <div style={{ display: tab === "3d" ? "block" : "none", width: "100%", height: "100%" }}>
              <Viewport />
            </div>
            {tab === "urdf" && <UrdfPreview />}
          </div>
        </main>

        <aside className="panel panel-right">
          <PropertyEditor />
        </aside>
      </div>
      <footer className="panel panel-bottom">
        <ValidationPanel />
      </footer>
    </div>
  );
}
