// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY BAG, DRAWN — what the police carry him off in (`police-plan.ts`
// times it, `rescue-view.ts` hangs it on the trip's frame): a heavy
// dark grey-black bag with a sheen, laid on the frame's rails, its lid
// zipped round three sides (a U, the way such bags open) and hinged along
// the fourth. Carried in it lies shut and EMPTY, flat on the frame; laid
// beside him, its lid is swung open flat on the snow beyond the outer rail
// (`bagAt`); once he is rolled onto it the lid comes back over him and FILLS
// — a morph from the flat sheet to the shape of a body under it, the head,
// the shoulders, the chest, the hips, the legs and the feet — and stays so,
// handles down both sides, through the carry and into the cabin.
//
// And HIM, as he lies: the body the dead rider was left as (`gore-view.ts`'
// remains, his own pose) is the body rolled onto it — `statueDelta` is how
// the scoop's roll of the casualty (`rescue-scoop.ts`) moves that statue,
// turned as it goes onto the frame's line — so nothing is swapped in the
// open: the statue goes out of sight under the lid as it closes
// (`police-remains.ts`).

import * as THREE from "three";

import { RESCUE } from "./rescue-defs.ts";

const S = RESCUE.stretcher;
/** The bag: its half-width flat, m; its colours (sRGB): the cloth, its
 * inside, the zip's tape, the handles; the rails. */
const BAG = {
  half: 0.36,
  cloth: 0x202226,
  inside: 0x34373c,
  zip: 0x8d9197,
  handle: 0x2c2f34,
  rail: 0x9ea4ab,
} as const;
/** Where the tray lies over the rails, and the lid's hinge over it, m. */
const TRAY = 0.03;
const HINGE = 0.036;
/** The lid swung open lies a little past flat, onto the snow. */
export const OPEN_ANGLE = Math.PI + 0.07;

/** THE BODY UNDER THE LID, from his feet (−) to his head (+), m: how wide
 * the bulge is (half) and how high it stands over the tray. */
const SHAPE: readonly (readonly [z: number, half: number, high: number])[] = [
  [-1.0, 0.0, 0.0],
  [-0.95, 0.1, 0.12],
  [-0.86, 0.15, 0.2],
  [-0.74, 0.15, 0.13],
  [-0.55, 0.17, 0.12],
  [-0.3, 0.2, 0.15],
  [-0.08, 0.22, 0.19],
  [0.1, 0.21, 0.2],
  [0.3, 0.23, 0.24],
  [0.5, 0.25, 0.23],
  [0.6, 0.18, 0.17],
  [0.68, 0.1, 0.14],
  [0.78, 0.12, 0.2],
  [0.9, 0.1, 0.17],
  [0.98, 0.0, 0.0],
];

function shapeAt(z: number): { half: number; high: number } {
  const u = z / (S.length / 2);
  for (let i = 1; i < SHAPE.length; i++) {
    const [z1, h1, y1] = SHAPE[i];
    if (u > z1) continue;
    const [z0, h0, y0] = SHAPE[i - 1];
    const k = (u - z0) / (z1 - z0 || 1);
    return { half: h0 + (h1 - h0) * k, high: y0 + (y1 - y0) * k };
  }
  return { half: 0, high: 0 };
}

/** THE BAG'S OUTLINE, from his feet (−1) to his head (+1) as a share of
 * its half-length: its half-width there, m — narrow at the feet, widest
 * across the shoulders, narrowing to the head — so it reads as a body's
 * bag and not a box from any way off. */
const OUTLINE: readonly (readonly [u: number, half: number])[] = [
  [-1.0, 0.2],
  [-0.75, 0.25],
  [-0.4, 0.29],
  [-0.05, 0.33],
  [0.3, 0.36],
  [0.55, 0.36],
  [0.72, 0.31],
  [1.0, 0.25],
];
/** How far in from each end the outline rounds off, as a share. */
const ROUND = 0.16;

/** The bag's half-width at `z`: the outline, its ends rounded off as an
 * ellipse's. */
function halfAt(z: number): number {
  const u = Math.max(-1, Math.min(1, z / (S.length / 2)));
  let w = OUTLINE[OUTLINE.length - 1][1];
  for (let i = 1; i < OUTLINE.length; i++) {
    const [u1, w1] = OUTLINE[i];
    if (u > u1) continue;
    const [u0, w0] = OUTLINE[i - 1];
    w = w0 + (w1 - w0) * ((u - u0) / (u1 - u0));
    break;
  }
  const e = (Math.abs(u) - (1 - ROUND)) / ROUND;
  return e <= 0 ? w : w * Math.sqrt(Math.max(0, 1 - e * e));
}

const NX = 16;
const NZ = 56;

/** A grid over the bag's outline: `y(x, z)` high, painted by `paint(i, j)`
 * (column `i` from the hinge's far side, row `j` from his feet). */
function sheet(
  y: (x: number, z: number) => number,
  paint: (i: number, j: number) => number,
  shift: { x: number; y: number },
): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const L = S.length / 2 - 0.01;
  for (let j = 0; j <= NZ; j++) {
    const z = -L + (2 * L * j) / NZ;
    const w = halfAt(z);
    for (let i = 0; i <= NX; i++) {
      const x = -w + (2 * w * i) / NX;
      pos.push(x - shift.x, y(x, z) - shift.y, z);
      c.set(paint(i, j));
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** How high the lid stands over the tray at (x, z) with him under it: his
 * height there, rounded across the whole width of the bag as cloth drawn
 * over a body is, so the bag has no flat shelf along its sides. */
function bulge(x: number, z: number): number {
  const s = shapeAt(z);
  const w = halfAt(z);
  const r = w > 1e-3 ? Math.min(1, Math.abs(x) / w) : 1;
  const up = s.high * Math.sqrt(1 - r * r);
  // The cloth pulled into a soft crease along the zip's side.
  return up + 0.006 * Math.cos(z * 9 + x * 4) * (1 - r);
}

/** THE RIM: the bag's side wall round its outline, from the rails up to the
 * lid's hinge, bellied a little outward so its edge reads round. */
function rimGeometry(): THREE.BufferGeometry {
  const L = S.length / 2 - 0.01;
  const ring: [number, number][] = [];
  for (let j = 0; j <= NZ; j++) {
    const z = -L + (2 * L * j) / NZ;
    ring.push([halfAt(z), z]);
  }
  for (let j = NZ; j >= 0; j--) {
    const z = -L + (2 * L * j) / NZ;
    ring.push([-halfAt(z), z]);
  }
  const rows: [y: number, out: number][] = [
    [0, 0],
    [HINGE / 2, 0.012],
    [HINGE + 0.004, 0],
  ];
  const pos: number[] = [];
  for (const [y, out] of rows) for (const [x, z] of ring) pos.push(x + Math.sign(x) * out, y, z);
  const n = ring.length;
  const idx: number[] = [];
  for (let r = 0; r < rows.length - 1; r++)
    for (let i = 0; i < n - 1; i++) {
      const a = r * n + i;
      idx.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function coloured(g: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  const c = new THREE.Color(colour);
  const n = flat.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], 3 * i);
  flat.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  flat.deleteAttribute("uv");
  return flat;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color"]) {
    const arrays = parts.map((g) => g.getAttribute(name).array as Float32Array);
    const all = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of arrays) {
      all.set(a, at);
      at += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(all, 3));
  }
  for (const g of parts) g.dispose();
  return out;
}

/** THE BAG's two parts in the frame's own frame (x across, y up from its
 * rails, z his head's end): the TRAY (the rails, the bag's floor on them,
 * the handles down both sides) and the LID, hinged along the bag's right
 * (+x) edge — stated in the hinge's frame, flat, with the shape of him under
 * it as its one morph target. */
export function bagGeometries(): { tray: THREE.BufferGeometry; lid: THREE.BufferGeometry } {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-S.rail, S.rail]) {
    const g = new THREE.CylinderGeometry(0.018, 0.018, S.length + 0.1, 8);
    g.rotateX(Math.PI / 2);
    g.translate(x, 0, 0);
    parts.push(coloured(g, BAG.rail));
  }
  // The floor: open, it shows its lighter inside.
  const floor = sheet(
    () => TRAY,
    () => BAG.inside,
    { x: 0, y: 0 },
  );
  parts.push(coloured(floor, BAG.inside));
  // Its edge, a rim of cloth round the floor, and the handles: three loops
  // of webbing a side.
  parts.push(coloured(rimGeometry(), BAG.cloth));
  for (const s of [-1, 1])
    for (const z of [-0.6, 0, 0.6]) {
      const loop = new THREE.BoxGeometry(0.05, 0.018, 0.16).translate(
        s * (halfAt(z) + 0.025),
        0.02,
        z,
      );
      parts.push(coloured(loop, BAG.handle));
    }
  const tray = merged(parts);
  // The lid: the zip's tape round its free edges (the far side and both
  // ends), the cloth elsewhere.
  const zip = (i: number, j: number) =>
    i === 0 || ((j <= 1 || j >= NZ - 1) && i < NX - 1) ? BAG.zip : BAG.cloth;
  const hinge = { x: BAG.half, y: HINGE };
  const lid = sheet(() => HINGE + 0.004, zip, hinge);
  const full = sheet((x, z) => HINGE + 0.004 + bulge(x, z), zip, hinge);
  lid.morphAttributes.position = [full.getAttribute("position")];
  lid.morphAttributes.normal = [full.getAttribute("normal")];
  return { tray, lid };
}

/** ONE BAG on a trip's frame: the tray, and the lid on its hinge. */
export type Bag = { tray: THREE.Mesh; hinge: THREE.Group; lid: THREE.Mesh };

export function createBag(geos: ReturnType<typeof bagGeometries>, material: THREE.Material): Bag {
  const tray = new THREE.Mesh(geos.tray, material);
  tray.castShadow = true;
  const hinge = new THREE.Group();
  hinge.position.set(BAG.half, HINGE, 0);
  const lid = new THREE.Mesh(geos.lid, material);
  lid.morphTargetInfluences = [0];
  lid.castShadow = true;
  hinge.add(lid);
  return { tray, hinge, lid };
}

/** The bag at a moment: its lid's swing open (0 shut … 1 flat open on the
 * snow) and how full it is (0 flat … 1 his shape). */
export function poseBag(bag: Bag, open: number, fill: number): void {
  bag.hinge.rotation.z = -OPEN_ANGLE * open;
  bag.lid.morphTargetInfluences![0] = fill;
}

/** A pose of the casualty (`RescueFrame["casualty"]`) as a world matrix. */
type Placed = { x: number; y: number; z: number; heading: number; pitch: number; roll: number };
const e = new THREE.Euler(0, 0, 0, "YXZ");
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const ref = new THREE.Matrix4();

function placed(c: Placed, heading: number, out: THREE.Matrix4): THREE.Matrix4 {
  e.set(-c.pitch, heading, -c.roll, "YXZ");
  q.setFromEuler(e);
  return out.compose(p.set(c.x, c.y, c.z), q, ONE);
}

/** HIS BODY AS IT WAS LEFT, MOVED AS THE SCOOP MOVES HIM: the world
 * matrix that carries the statue from where it lies to where the casualty
 * now is (`now`, from where he was `found`), turned from its own line
 * (`line`, the heading his head points) onto the frame's by `turn` (0 … 1)
 * — whichever way round is the nearer. */
export function statueDelta(
  found: Placed,
  now: Placed,
  line: number,
  turn: number,
  out: THREE.Matrix4,
): THREE.Matrix4 {
  let d = line - found.heading;
  d -= Math.PI * Math.round(d / Math.PI);
  placed(found, found.heading + d * turn, ref).invert();
  return placed(now, now.heading, out).multiply(ref);
}
