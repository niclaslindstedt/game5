// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COCKPIT'S MOULDINGS (`heli-cockpit.ts` hangs them) — the parts that
// make the cabin read as a made thing rather than a board in a shell:
//
// - THE SHROUD round the instrument panel: one moulding in matte charcoal,
//   its hood standing proud of the face and overhanging it (deepest over
//   the middle, where the sun comes in over the nose), its lip rounded,
//   and its sides sweeping down round the face's ends to the pedestal —
//   the cowl a light single's panel sits in.
// - THE COAMING: the hood's top run forward and down to the windscreen's
//   foot right across the cabin, so the nose's skin under the glass is
//   covered, as it is in the machine, by the dark anti-glare deck.
// - THE SEALS: a black rubber strip round every pane of glass, off the
//   glass's own edges.
// - THE LINER: the model's own cabin copied in and turned inward
//   (`cabinOf`, the bulkhead behind the bench `bulkheadOf`), coloured by
//   zone — the floor's rubber, the charcoal kick panels and nose, the light
//   pillars and frames, the pale headliner.
//
// Laid out in the cockpit's frame (`cockpit-plan.ts`) like the rest of the
// cockpit, but for the seals and the liner, which are the model's own and
// stay in the machine's frame.

import * as THREE from "three";
import { HELI } from "@engine";

import { COCKPIT } from "./cockpit-plan.ts";

type V3 = { x: number; y: number; z: number };

/** THE SHROUD'S SHAPE, m: how far the hood stands toward the pilot over
 * the middle and at its ends, how far down the sides it reaches toward
 * the pilot at the foot, the bezel between the face and the moulding,
 * the corners' radius, the lip's thickness, how far out the shoulder
 * stands and how far behind the face the moulding runs. */
export const SHROUD = {
  over: 0.15,
  overEnd: 0.1,
  overFoot: 0.03,
  bezel: 0.02,
  corner: 0.09,
  lip: 0.03,
  shoulder: 0.07,
  back: 0.16,
  /** The coaming's gap under the glass, m, and how many rows it is laid in. */
  under: 0.012,
  rows: 8,
} as const;

/** WHERE THE WINDSCREEN MEETS THE NOSE: for |x| across the cabin, the
 * glass's lowest edge and how far forward it is there (the machine's
 * frame, symmetric) — read off the model's glass (`glass`, the cabin's
 * panes in the machine's frame): the forward panes over the chin windows'
 * tops. Null when the model has no windscreen. */
export function glassFoot(glass: THREE.BufferGeometry | null): ((x: number) => V3) | null {
  if (!glass) return null;
  const pos = glass.getAttribute("position");
  const BINS = 12;
  const half = HELI.body.width / 2;
  const low: (V3 | null)[] = Array.from({ length: BINS }, () => null);
  const chinTop = HELI.body.floor + 0.38 * (HELI.body.roof - HELI.body.floor);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i));
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z < COCKPIT.panel.z || y < chinTop + 0.03 || y > COCKPIT.panel.top + 0.2) continue;
    const k = Math.min(BINS - 1, Math.floor((x / half) * BINS));
    const b = low[k];
    if (!b || y < b.y) low[k] = { x, y, z };
  }
  const got = low.filter((b): b is V3 => b !== null);
  if (got.length < 3) return null;
  got.sort((a, b) => a.x - b.x);
  return (x: number) => {
    const ax = Math.abs(x);
    let i = 0;
    while (i < got.length - 2 && got[i + 1].x < ax) i++;
    const a = got[i];
    const b = got[i + 1];
    const t = Math.max(0, Math.min(1, (ax - a.x) / Math.max(1e-6, b.x - a.x)));
    return { x, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  };
}

/** A grid of points (rows × cols) as a mesh's geometry, its uv the grid's. */
function loft(rows: V3[][]): THREE.BufferGeometry {
  const n = rows.length;
  const m = rows[0].length;
  const p: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const q = rows[i][j];
      p.push(q.x, q.y, q.z);
      uv.push(j / (m - 1), i / (n - 1));
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      index.push(a, a + m, a + 1, a + 1, a + m, a + m + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** THE PANEL'S FRAME: the face's plane — its foot's middle, the way up it
 * (leant back) and the way out of it toward the pilot. */
function panelFrame() {
  const P = COCKPIT.panel;
  const up = { x: 0, y: Math.cos(P.lean), z: Math.sin(P.lean) };
  const out = { x: 0, y: Math.sin(P.lean), z: -Math.cos(P.lean) };
  const tall = (P.top - P.bottom) / Math.cos(P.lean);
  const at = (x: number, s: number, n: number): V3 => ({
    x,
    y: P.bottom + up.y * s + out.y * n,
    z: P.z + up.z * s + out.z * n,
  });
  return { up, out, tall, at };
}

/** THE OUTLINE the shroud is lofted round: the face's edge offset by the
 * bezel, from the left foot up, over the top and down to the right foot,
 * corners rounded — each point with its way outward in the face's plane
 * (x across, s up it) and its share along the top (0 at the ends' feet,
 * 1 over the middle). */
function outline(): { x: number; s: number; ox: number; os: number; top: number }[] {
  const P = COCKPIT.panel;
  const { tall } = panelFrame();
  const S = SHROUD;
  const w = P.half + S.bezel;
  const h = tall + S.bezel;
  const r = S.corner;
  const pts: { x: number; s: number; ox: number; os: number; top: number }[] = [];
  const SIDE = 5;
  const ARC = 7;
  const ACROSS = 14;
  for (let i = 0; i <= SIDE; i++) {
    const s = ((h - r) * i) / SIDE;
    pts.push({ x: -w, s, ox: -1, os: 0, top: 0.4 * (s / h) });
  }
  for (let i = 1; i <= ARC; i++) {
    const a = Math.PI - (Math.PI / 2) * (i / ARC);
    pts.push({
      x: -w + r + Math.cos(a) * r,
      s: h - r + Math.sin(a) * r,
      ox: Math.cos(a),
      os: Math.sin(a),
      top: 0.4 + 0.2 * (i / ARC),
    });
  }
  for (let i = 1; i < ACROSS; i++) {
    const x = -w + r + (2 * (w - r) * i) / ACROSS;
    pts.push({ x, s: h, ox: 0, os: 1, top: 0.6 + 0.4 * (1 - (x / w) ** 2) });
  }
  const left = pts.length;
  for (let i = left - 1; i >= 0; i--) {
    const q = pts[i];
    pts.push({ ...q, x: -q.x, ox: -q.ox });
  }
  return pts;
}

/** THE SHROUD: the moulding round the panel's face — the lip standing
 * proud toward the pilot, rounded over to its shoulder and back behind
 * the face; and the top of it the coaming starts from. */
export function shroudGeometry(): { shroud: THREE.BufferGeometry; back: V3[] } {
  const { at } = panelFrame();
  const S = SHROUD;
  const rows: V3[][] = [[], [], [], [], [], [], []];
  const back: V3[] = [];
  for (const q of outline()) {
    // How far the lip stands toward the pilot: least at the sides' feet,
    // most over the middle of the top.
    const d =
      q.top < 0.6
        ? S.overFoot + (S.overEnd - S.overFoot) * (q.top / 0.6)
        : S.overEnd + (S.over - S.overEnd) * ((q.top - 0.6) / 0.4);
    const o = (k: number, n: number): V3 => at(q.x + q.ox * k, q.s + q.os * k, n);
    rows[0].push(o(0, -0.01));
    rows[1].push(o(0, d * 0.98));
    rows[2].push(o(S.lip * 0.45, d + S.lip * 0.1));
    rows[3].push(o(S.lip, d * 0.97));
    rows[4].push(o(S.shoulder * 0.8, d * 0.65));
    rows[5].push(o(S.shoulder, d * 0.2));
    const b = o(S.shoulder * 1.05, -S.back);
    rows[6].push(b);
    if (q.os > 0.99) back.push(b);
  }
  return { shroud: loft(rows), back };
}

/** THE COAMING: from the shroud's back edge across the top (`back`),
 * widened to the cabin's sides, forward and down to the windscreen's foot
 * (`foot`) a hair under the glass. */
export function coamingGeometry(back: V3[], foot: (x: number) => V3): THREE.BufferGeometry {
  const S = SHROUD;
  const half = HELI.body.width / 2 - 0.02;
  // The start row: the shroud's back edge, carried level out to the sides.
  const first = back[0];
  const last = back[back.length - 1];
  const COLS = 24;
  const start: V3[] = [];
  const end: V3[] = [];
  for (let j = 0; j <= COLS; j++) {
    const x = -half + (2 * half * j) / COLS;
    let p: V3;
    if (x <= first.x) p = { x, y: first.y - 0.04 * ((first.x - x) / (half + first.x)), z: first.z };
    else if (x >= last.x) p = { x, y: last.y - 0.04 * ((x - last.x) / (half - last.x)), z: last.z };
    else {
      let k = 0;
      while (k < back.length - 2 && back[k + 1].x < x) k++;
      const a = back[k];
      const b = back[k + 1];
      const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
      p = { x, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    start.push(p);
    const f = foot(x);
    end.push({ x, y: f.y - S.under, z: f.z - 0.01 });
  }
  const rows: V3[][] = [];
  for (let i = 0; i <= S.rows; i++) {
    const t = i / S.rows;
    // Rising a little off the shroud, then falling to the glass: a deck
    // that crowns over the middle rather than a flat plank.
    const crown = Math.sin(Math.PI * t) * 0.025;
    rows.push(
      start.map((a, j) => {
        const b = end[j];
        const mid = 1 - (a.x / half) ** 2;
        return {
          x: a.x,
          y: a.y + (b.y - a.y) * t + crown * mid,
          z: a.z + (b.z - a.z) * (1 - (1 - t) ** 1.6),
        };
      }),
    );
  }
  return loft(rows);
}

/** THE SEALS: a black rubber strip round every pane of the glass
 * (`glass`, its triangles in the machine's frame) — every edge that only
 * one triangle has, its strip lying on the frame beside the pane and a
 * little over it, a hair inside the cabin. */
export function sealGeometry(glass: THREE.BufferGeometry | null): THREE.BufferGeometry | null {
  if (!glass) return null;
  const pos = glass.getAttribute("position");
  const key = (i: number) =>
    `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  const edges = new Map<string, { a: number; b: number; c: number; n: number }>();
  for (let t = 0; t < pos.count; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = t + e;
      const b = t + ((e + 1) % 3);
      const c = t + ((e + 2) % 3);
      const ka = key(a);
      const kb = key(b);
      if (ka === kb) continue;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const had = edges.get(k);
      if (had) had.n++;
      else edges.set(k, { a, b, c, n: 1 });
    }
  }
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const Cc = new THREE.Vector3();
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  const v: number[] = [];
  const WIDE = 0.014;
  const OVER = 0.004;
  const IN = 0.012;
  const push = (p: THREE.Vector3) => v.push(p.x, p.y, p.z);
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    A.fromBufferAttribute(pos, e.a);
    B.fromBufferAttribute(pos, e.b);
    Cc.fromBufferAttribute(pos, e.c);
    n.subVectors(B, A).cross(d.subVectors(Cc, A)).normalize();
    // Away from the pane, in its plane.
    d.subVectors(B, A).cross(n).normalize();
    if (d.dot(Cc.clone().sub(A)) > 0) d.negate();
    // The inside of the cabin is toward its middle line.
    const inward =
      new THREE.Vector3(-A.x, 1.6 - A.y, 1.6 - A.z).dot(n) > 0 ? n : n.clone().negate();
    const a0 = A.clone().addScaledVector(d, -OVER).addScaledVector(inward, IN);
    const b0 = B.clone().addScaledVector(d, -OVER).addScaledVector(inward, IN);
    const a1 = A.clone()
      .addScaledVector(d, WIDE)
      .addScaledVector(inward, IN * 0.6);
    const b1 = B.clone()
      .addScaledVector(d, WIDE)
      .addScaledVector(inward, IN * 0.6);
    push(a0);
    push(b0);
    push(b1);
    push(a0);
    push(b1);
    push(a1);
  }
  if (!v.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** THE LINER'S COLOUR at a point of the cabin's skin (machine frame) with
 * its outward normal: the floor's rubber; the nose under the windscreen and
 * the kick panels under the sills in charcoal; the pillars and the frames
 * between the windows a light grey; the headliner pale. */
function linerColour(p: V3, n: V3, out: THREE.Color): THREE.Color {
  const B = HELI.body;
  const f = (p.y - B.floor) / (B.roof - B.floor);
  if (n.y < -0.55) return out.setRGB(0.05, 0.052, 0.056);
  if (p.z > COCKPIT.panel.z - 0.1 && f < 0.5) return out.setRGB(0.07, 0.072, 0.078);
  if (f < 0.2) return out.setRGB(0.1, 0.104, 0.11);
  if (n.y > 0.6 || f > 0.84) return out.setRGB(0.62, 0.62, 0.6);
  // The walls: darker low down where boots and bags scuff them.
  const k = Math.min(1, (f - 0.2) / 0.3);
  return out.setRGB(0.18 + 0.24 * k, 0.185 + 0.24 * k, 0.19 + 0.23 * k);
}

/** How far the skin's copy stands in from it, m. */
const LINER_IN = 0.022;

/** Each vertex colour of the cabin's inside, by which way the skin faces
 * there: the floor's mat, the walls' trim, the headliner. */
const tint = new THREE.Color();

/** THE SKIN'S OPAQUE PANELS INSIDE THE CABIN, copied in from it, as one
 * geometry in the machine's frame (`toMachine` each mesh's own matrix into
 * it), and the glass's copy. */
export function cabinOf(
  body: THREE.Object3D,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
): { liner: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null } {
  const liner: number[] = [];
  const linerN: number[] = [];
  const linerC: number[] = [];
  const glass: number[] = [];
  const glassN: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const nor: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const name = (o.material as THREE.Material).name;
    const isGlass = /^glass/i.test(name);
    if (!isGlass && !/^(trim|paint|stripe|dark)/i.test(name)) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    if (!pos || !norm) return;
    const m = toMachine(o);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const index = geo.getIndex();
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      let cz = 0;
      let cy = 0;
      let cx = 0;
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(i + k) : i + k;
        tri[k].fromBufferAttribute(pos, v).applyMatrix4(m);
        nor[k].fromBufferAttribute(norm, v).applyMatrix3(nm).normalize();
        cx += tri[k].x / 3;
        cy += tri[k].y / 3;
        cz += tri[k].z / 3;
      }
      if (cz < COCKPIT.bulkhead - 0.02 || cy > HELI.body.roof + 0.05 || Math.abs(cx) > 1.0) {
        continue;
      }
      for (let k = 0; k < 3; k++) {
        p.copy(tri[k]);
        n.copy(nor[k]);
        if (isGlass) {
          p.addScaledVector(n, -0.005);
          glass.push(p.x, p.y, p.z);
          glassN.push(n.x, n.y, n.z);
          continue;
        }
        p.addScaledVector(n, -LINER_IN);
        liner.push(p.x, p.y, p.z);
        linerN.push(n.x, n.y, n.z);
        const c = linerColour(p, n, tint);
        linerC.push(c.r, c.g, c.b);
      }
    }
  });
  const make = (v: number[], nv: number[], c?: number[]): THREE.BufferGeometry | null => {
    if (!v.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nv, 3));
    if (c) g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    return g;
  };
  return { liner: make(liner, linerN, linerC), glass: make(glass, glassN) };
}

/** THE WALL AT THE BACK OF THE CABIN: the skin's section at the bulkhead
 * (its hull, drawn in a little), facing forward. */
export function bulkheadOf(
  body: THREE.Object3D,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
): THREE.BufferGeometry | null {
  const z0 = COCKPIT.bulkhead;
  const pts: [number, number][] = [];
  const p = new THREE.Vector3();
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = (o.material as THREE.Material).name ?? "";
    if (!/^(trim|paint|stripe|dark)/i.test(name)) return;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
    const m = toMachine(o);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (Math.abs(p.z - z0) < 0.12 && p.y < HELI.body.roof + 0.02 && Math.abs(p.x) < 1.0)
        pts.push([p.x, p.y]);
    }
  });
  if (pts.length < 3) return null;
  // The convex hull (monotone chain).
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let cx = 0;
  let cy = 0;
  for (const [x, y] of hull) {
    cx += x / hull.length;
    cy += y / hull.length;
  }
  const v: number[] = [];
  const shrink = (x: number, y: number): [number, number] => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    const k = Math.max(0, d - LINER_IN * 1.5) / d;
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  };
  for (let i = 0; i < hull.length; i++) {
    const a = shrink(...hull[i]);
    const b = shrink(...hull[(i + 1) % hull.length]);
    v.push(cx, cy, z0, b[0], b[1], z0, a[0], a[1], z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  // Facing forward, whichever way round the hull ran.
  const nz = g.getAttribute("normal").getZ(0);
  if (nz < 0) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1);
      const y = pos.getY(i + 1);
      pos.setXY(i + 1, pos.getX(i + 2), pos.getY(i + 2));
      pos.setXY(i + 2, x, y);
    }
    g.computeVertexNormals();
  }
  return g;
}
