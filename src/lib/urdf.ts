// URDF XML generation using the DOM API (XMLSerializer), never string concat.
// The DOM serializer escapes attribute values for us.

import type {
  GeometrySpec,
  JointSpec,
  LinkSpec,
  Pose,
  RobotModel,
  Vec3,
} from "../types/robot";
import { resolveMeshPlacements, type MeshPlacement } from "./meshPaths";

/** Format a number for URDF: trim float noise, avoid "-0". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Object.is(n, -0)) n = 0;
  // up to 6 significant decimals, strip trailing zeros
  let s = n.toFixed(6);
  s = s.replace(/\.?0+$/, "");
  return s === "" || s === "-" ? "0" : s;
}

function vec3(v: Vec3): string {
  return `${fmt(v[0])} ${fmt(v[1])} ${fmt(v[2])}`;
}

function createDoc(): XMLDocument {
  // Works in browser and in jsdom (vitest) environments.
  return document.implementation.createDocument(null, null, null);
}

function el(doc: XMLDocument, tag: string, attrs?: Record<string, string>): Element {
  const e = doc.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function originEl(doc: XMLDocument, pose: Pose): Element {
  return el(doc, "origin", { xyz: vec3(pose.xyz), rpy: vec3(pose.rpy) });
}

function geometryEl(
  doc: XMLDocument,
  geom: GeometrySpec,
  bucket: "visual" | "collision",
  placements: Map<string, MeshPlacement>,
): Element {
  const g = el(doc, "geometry");
  switch (geom.type) {
    case "box":
      g.appendChild(el(doc, "box", { size: vec3(geom.size) }));
      break;
    case "sphere":
      g.appendChild(el(doc, "sphere", { radius: fmt(geom.radius) }));
      break;
    case "cylinder":
      g.appendChild(el(doc, "cylinder", { radius: fmt(geom.radius), length: fmt(geom.length) }));
      break;
    case "mesh": {
      const placement = placements.get(geom.meshId);
      const path = bucket === "visual" ? placement?.visualPath : placement?.collisionPath;
      g.appendChild(
        el(doc, "mesh", {
          filename: path ?? `meshes/${bucket}/${geom.meshId}`,
          scale: vec3(geom.scale),
        }),
      );
      break;
    }
  }
  return g;
}

function linkEl(doc: XMLDocument, link: LinkSpec, placements: Map<string, MeshPlacement>): Element {
  const e = el(doc, "link", { name: link.name });

  if (link.visual) {
    const v = el(doc, "visual");
    v.appendChild(originEl(doc, link.visual.origin));
    v.appendChild(geometryEl(doc, link.visual.geometry, "visual", placements));
    const mat = el(doc, "material", { name: `${link.name}_material` });
    const [r, g, b, a] = link.visual.color;
    mat.appendChild(el(doc, "color", { rgba: `${fmt(r)} ${fmt(g)} ${fmt(b)} ${fmt(a)}` }));
    v.appendChild(mat);
    e.appendChild(v);
  }

  if (link.collision) {
    const c = el(doc, "collision");
    c.appendChild(originEl(doc, link.collision.origin));
    c.appendChild(geometryEl(doc, link.collision.geometry, "collision", placements));
    e.appendChild(c);
  }

  const inertial = el(doc, "inertial");
  inertial.appendChild(originEl(doc, link.inertial.origin));
  inertial.appendChild(el(doc, "mass", { value: fmt(link.inertial.mass) }));
  const i = link.inertial.inertia;
  inertial.appendChild(
    el(doc, "inertia", {
      ixx: fmt(i.ixx),
      ixy: fmt(i.ixy),
      ixz: fmt(i.ixz),
      iyy: fmt(i.iyy),
      iyz: fmt(i.iyz),
      izz: fmt(i.izz),
    }),
  );
  e.appendChild(inertial);

  return e;
}

function jointEl(doc: XMLDocument, joint: JointSpec, nameById: Map<string, string>): Element {
  const e = el(doc, "joint", { name: joint.name, type: joint.type });
  e.appendChild(el(doc, "parent", { link: nameById.get(joint.parent) ?? joint.parent }));
  e.appendChild(el(doc, "child", { link: nameById.get(joint.child) ?? joint.child }));
  e.appendChild(originEl(doc, joint.origin));

  if (joint.type !== "fixed") {
    e.appendChild(el(doc, "axis", { xyz: vec3(joint.axis) }));
  }
  if (joint.limit && (joint.type === "revolute" || joint.type === "prismatic")) {
    e.appendChild(
      el(doc, "limit", {
        lower: fmt(joint.limit.lower),
        upper: fmt(joint.limit.upper),
        effort: fmt(joint.limit.effort),
        velocity: fmt(joint.limit.velocity),
      }),
    );
  }
  if (joint.dynamics && joint.type !== "fixed") {
    e.appendChild(
      el(doc, "dynamics", {
        damping: fmt(joint.dynamics.damping),
        friction: fmt(joint.dynamics.friction),
      }),
    );
  }
  return e;
}

/** Build the URDF XML document for a model. */
export function buildUrdfDocument(model: RobotModel): XMLDocument {
  const doc = createDoc();
  const placements = resolveMeshPlacements(model);
  const nameById = new Map(model.links.map((l) => [l.id, l.name]));

  const robot = el(doc, "robot", { name: model.name });
  for (const link of model.links) robot.appendChild(linkEl(doc, link, placements));
  for (const joint of model.joints) robot.appendChild(jointEl(doc, joint, nameById));
  doc.appendChild(robot);
  return doc;
}

/** Serialize the URDF to a pretty-printed XML string. */
export function buildUrdf(model: RobotModel): string {
  const doc = buildUrdfDocument(model);
  const raw = new XMLSerializer().serializeToString(doc);
  return `<?xml version="1.0"?>\n${prettyXml(raw)}\n`;
}

/** Minimal, dependency-free pretty printer for the serialized XML. */
export function prettyXml(xml: string): string {
  const withBreaks = xml.replace(/>\s*</g, ">\n<");
  let indent = 0;
  const lines = withBreaks.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const isClosing = /^<\//.test(line);
    const isSelfClosing = /\/>\s*$/.test(line);
    const isOpening = /^<[^/!?]/.test(line) && !isSelfClosing;
    if (isClosing) indent = Math.max(0, indent - 1);
    out.push("  ".repeat(indent) + line.trim());
    if (isOpening) indent += 1;
  }
  return out.join("\n");
}
