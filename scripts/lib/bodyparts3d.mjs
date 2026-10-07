// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY THE HUD'S FIGURE IS MADE FROM: BodyParts3D, a whole human body
// segmented out of one man's CT — every bone and the skin a mesh of its own,
// in millimetres, standing in the anatomical position — fetched on first
// use into the gitignored `previews/.bodyparts3d/` and never committed.
//
// Its licence: "BodyParts3D, (c) The Database Center for Life Science
// licensed under CC Attribution-Share Alike 2.1 Japan". `make hud-body`
// TRACES it (a silhouette and its tones, a few hundred corners a bone);
// `references/anatomy/README.md` carries the attribution. The organs come
// from the same body (`ORGAN_SOURCES`).
//
// The model's frame: x toward his LEFT (so a front view puts his right on
// the viewer's left with no flip), y toward his BACK (the front is −y), z up,
// the soles at about z = −70.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const BP3D = {
  base: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/",
  zip: "partof_BP3D_4.0_obj_99.zip",
  table: "partof_element_parts.txt",
  // The is-a tree's set: the same body, the same frame, a few concepts the
  // part-of tree leaves out (the spleen).
  isaZip: "isa_BP3D_4.0_obj_99.zip",
  isaTable: "isa_element_parts.txt",
  credit:
    "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
};

/** The meshes on disk, fetched and unpacked the first time: `{ objDir,
 * table, isaDir, isaTable }`. curl, so the machine's proxy and certificates are the ones
 * every other download here uses. */
export function ensureBodyParts3D(cache) {
  mkdirSync(cache, { recursive: true });
  const table = join(cache, BP3D.table);
  const zip = join(cache, BP3D.zip);
  const objDir = join(cache, "obj");
  const get = (name, path) => {
    if (existsSync(path)) return;
    console.log(`fetching ${BP3D.base}${name} …`);
    execFileSync("curl", ["-sSfL", "--retry", "3", "-o", `${path}.part`, `${BP3D.base}${name}`], {
      stdio: "inherit",
    });
    execFileSync("mv", [`${path}.part`, path]);
  };
  get(BP3D.table, table);
  if (!existsSync(objDir) || readdirSync(objDir).length === 0) {
    get(BP3D.zip, zip);
    mkdirSync(objDir, { recursive: true });
    execFileSync("unzip", ["-q", "-o", "-j", zip, "-d", objDir]);
  }
  const isaTable = join(cache, BP3D.isaTable);
  const isaZip = join(cache, BP3D.isaZip);
  const isaDir = join(cache, "isa");
  get(BP3D.isaTable, isaTable);
  if (!existsSync(isaDir) || readdirSync(isaDir).length === 0) {
    get(BP3D.isaZip, isaZip);
    mkdirSync(isaDir, { recursive: true });
    execFileSync("unzip", ["-q", "-o", "-j", isaZip, "-d", isaDir]);
  }
  return { objDir, table, isaDir, isaTable };
}

/** Every concept's name → the element meshes that make it. */
export function elementsByName(tablePath) {
  const out = new Map();
  for (const line of readFileSync(tablePath, "utf8").split("\n").slice(1)) {
    const [, name, fj] = line.split("\t");
    if (!fj) continue;
    const list = out.get(name) ?? [];
    list.push(fj.trim());
    out.set(name, list);
  }
  return out;
}

/** One OBJ: its corners (x, y, z, flat) and its triangles. */
export function loadObj(path) {
  const v = [];
  const f = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim().split(/\s+/);
    if (s[0] === "v") v.push(+s[1], +s[2], +s[3]);
    else if (s[0] === "f") {
      const idx = s.slice(1).map((q) => parseInt(q, 10) - 1);
      for (let k = 1; k + 1 < idx.length; k++) f.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  return { v: Float64Array.from(v), f: Uint32Array.from(f) };
}

const ORD = "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth";
const SKULL = [
  "frontal bone",
  "occipital bone",
  "sphenoid bone",
  "ethmoid",
  "vomer",
  "right temporal bone",
  "left temporal bone",
  "right parietal bone",
  "left parietal bone",
  "right zygomatic bone",
  "left zygomatic bone",
  "right lacrimal bone",
  "left lacrimal bone",
  "right nasal bone",
  "left nasal bone",
  "right palatine bone",
  "left palatine bone",
  "right maxilla",
  "left maxilla",
  "right inferior nasal concha",
  "left inferior nasal concha",
];
const CARPALS = "scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate";

/** WHICH OF THE MODEL'S CONCEPTS MAKE EACH OF OUR ORGANS (`ORGANS`): their
 * names, from the part-of tree or (`isa`) the is-a one. The lungs are only
 * their airways and vessels in this body — no surface of their own — so
 * their silhouette is that tree CLOSED (`close`, mm: grown and shrunk
 * back), which fills the space the tree branches through. "right"/"left"
 * are HIS. */
export const ORGAN_SOURCES = {
  brain: { names: ["brain"] },
  heart: { names: ["heart"] },
  lungL: { names: ["left lung"], close: 16 },
  lungR: { names: ["right lung"], close: 16 },
  liver: { names: ["liver"] },
  spleen: { names: ["spleen"], isa: true },
  stomach: { names: ["stomach"] },
  bowel: { names: ["small intestine", "large intestine"] },
  kidneyL: { names: ["left kidney"] },
  kidneyR: { names: ["right kidney"] },
  bladder: { names: ["urinary bladder"] },
};

/** WHICH OF THE MODEL'S BONES MAKE EACH OF OURS (`BONES`): a test on the
 * concept's name. "right"/"left" are HIS. */
export function selectBone(bone) {
  const side = bone.endsWith("R") ? "right" : bone.endsWith("L") ? "left" : "";
  const kind = side ? bone.slice(0, -1) : bone;
  const re = (s) => {
    const r = new RegExp(`^(?:${s})$`);
    return (n) => r.test(n);
  };
  switch (kind) {
    case "skull":
      return (n) => SKULL.includes(n);
    case "mandible":
      return re("mandible");
    case "cervical":
      return re(`atlas|axis|(?:${ORD}) cervical vertebra`);
    case "thoracic":
      return re(`(?:${ORD}) thoracic vertebra`);
    case "lumbar":
      return re(`(?:${ORD}) lumbar vertebra`);
    case "sternum":
      return re("manubrium|body of sternum|xiphoid process");
    case "ribs":
      return re(`(?:left|right) (?:${ORD}) (?:rib|costal cartilage)`);
    case "pelvis":
      return re("right hip bone|left hip bone|sacrum|coccyx");
    case "hand":
      return re(
        `${side} (?:${CARPALS})|${side} (?:${ORD}) metacarpal bone|(?:proximal|middle|distal) phalanx of ${side} (?:thumb|index finger|middle finger|ring finger|little finger)`,
      );
    case "foot":
      return re(
        `${side} (?:talus|calcaneus|cuboid bone|(?:medial|intermediate|lateral) cuneiform bone|(?:${ORD}) metatarsal bone)|navicular bone of ${side} foot|(?:proximal|middle|distal) phalanx of ${side} (?:big|second|third|fourth|little) toe`,
      );
    default:
      return re(`${side} ${kind}`);
  }
}
