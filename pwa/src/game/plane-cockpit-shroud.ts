// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE COCKPIT'S MOULDINGS (`plane-cockpit.ts` hangs them) — the
// parts that make the cockpit read as a made thing rather than a board in
// a shell:
//
// - THE GLARESHIELD round the panel: one moulding in matte black, its hood
//   standing proud of the face and overhanging it (deepest in the middle),
//   its lip rounded, its sides sweeping down round the face's ends;
// - THE COAMING: the hood's top run forward to the windscreen's foot right
//   across the cockpit, so the skin under the glass is covered by the dark
//   anti-glare deck and nothing outside shows under it;
// - THE SEALS: a black rubber strip round every pane of the model's glass,
//   off the glass's own edges;
// - THE FOOTWELL: the floor carried on from the model's cabin floor and up
//   its ramp to the firewall, and the side walls of the footwell under the
//   panel, so the nose's skin is never seen from the seat.
//
// The shroud, the coaming and the footwell are laid out in the cockpit's
// frame (`plane-cockpit-plan.ts`: x to the right as seen); the seals and
// the glass they are read off are the model's own and stay in the
// machine's frame.

import * as THREE from "three";
import { PLANE } from "@engine";

import { PLANE_COCKPIT } from "./plane-cockpit-plan.ts";

type V3 = { x: number; y: number; z: number };

/** THE SHROUD'S SHAPE, m: how far the hood stands toward the pilot over
 * the middle and at its ends, how far down the sides it reaches toward
 * the pilot at the foot, the bezel between the face and the moulding,
 * the corners' radius, the lip's thickness, how far out the shoulder
 * stands and how far behind the face the moulding runs; the coaming's gap
 * under the glass and the rows it is laid in. */
export const PLANE_SHROUD = {
  over: 0.11,
  overEnd: 0.07,
  overFoot: 0.025,
  bezel: 0.015,
  corner: 0.06,
  lip: 0.025,
  shoulder: 0.05,
  back: 0.12,
  under: 0.01,
  rows: 8,
} as const;

/** The cockpit's half width inside the skin at a station `z`, m — the
 * fuselage's half width there less the lining. */
export function halfWidthAt(z: number): number {
  const S = PLANE.fuselage.stations;
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i];
    const b = S[i + 1];
    if (z <= a.z && z >= b.z) {
      const t = (a.z - z) / (a.z - b.z);
      return a.half + (b.half - a.half) * t - 0.05;
    }
  }
  return S[S.length - 1].half - 0.05;
}

/** WHERE THE WINDSCREEN MEETS THE COWLING: for |x| across the cockpit,
 * the glass's lowest point forward of the panel and how far forward it is
 * (the machine's frame, symmetric) — read off the model's glass. Null when
 * the model has no windscreen. */
export function screenFoot(glass: THREE.BufferGeometry | null): ((x: number) => V3) | null {
  if (!glass) return null;
  const pos = glass.getAttribute("position");
  const BINS = 10;
  const half = 0.6;
  const low: (V3 | null)[] = Array.from({ length: BINS }, () => null);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i));
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z < PLANE_COCKPIT.panel.z - 0.05 || z > PLANE.cowling.back + 0.1 || x > half) continue;
    if (y < PLANE_COCKPIT.panel.top - 0.05) continue;
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
export function loft(rows: V3[][]): THREE.BufferGeometry {
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

/** The panel's face as a frame: a point `s` m up the face from the foot,
 * `n` m out of it toward the pilot, at `x` across. */
function faceAt(x: number, s: number, n: number): V3 {
  const P = PLANE_COCKPIT.panel;
  return {
    x,
    y: P.bottom + Math.cos(P.lean) * s + Math.sin(P.lean) * n,
    z: P.z + Math.sin(P.lean) * s - Math.cos(P.lean) * n,
  };
}

/** THE GLARESHIELD: the moulding round the panel's face — the lip
 * standing proud toward the pilot, rounded over to its shoulder and back
 * behind the face; and its top edge the coaming starts from. */
export function shroudGeometry(): { shroud: THREE.BufferGeometry; back: V3[] } {
  const P = PLANE_COCKPIT.panel;
  const S = PLANE_SHROUD;
  const tall = (P.top - P.bottom) / Math.cos(P.lean);
  const w = P.half + S.bezel;
  const h = tall + S.bezel;
  const r = S.corner;
  type Q = { x: number; s: number; ox: number; os: number; top: number };
  const pts: Q[] = [];
  const SIDE = 4;
  const ARC = 6;
  const ACROSS = 16;
  for (let i = 0; i <= SIDE; i++) {
    const s = h * 0.55 + ((h * 0.45 - r) * i) / SIDE;
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
  const rows: V3[][] = [[], [], [], [], [], [], []];
  const back: V3[] = [];
  for (const q of pts) {
    const d =
      q.top < 0.6
        ? S.overFoot + (S.overEnd - S.overFoot) * (q.top / 0.6)
        : S.overEnd + (S.over - S.overEnd) * ((q.top - 0.6) / 0.4);
    const o = (k: number, n: number): V3 => faceAt(q.x + q.ox * k, q.s + q.os * k, n);
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

/** THE COAMING: from the shroud's back edge across the top, widened to the
 * cockpit's sides, forward to the windscreen's foot (`foot`) a hair under
 * the glass. */
export function coamingGeometry(back: V3[], foot: (x: number) => V3): THREE.BufferGeometry {
  const S = PLANE_SHROUD;
  const first = back[0];
  const last = back[back.length - 1];
  const COLS = 24;
  const start: V3[] = [];
  const end: V3[] = [];
  const zEnd = foot(0).z;
  const half = halfWidthAt(zEnd) + 0.02;
  for (let j = 0; j <= COLS; j++) {
    const x = -half + (2 * half * j) / COLS;
    let p: V3;
    if (x <= first.x) p = { x, y: first.y - 0.03 * ((first.x - x) / (half + first.x)), z: first.z };
    else if (x >= last.x) p = { x, y: last.y - 0.03 * ((x - last.x) / (half - last.x)), z: last.z };
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
    end.push({ x, y: f.y - S.under, z: f.z + 0.01 });
  }
  const rows: V3[][] = [];
  for (let i = 0; i <= S.rows; i++) {
    const t = i / S.rows;
    const crown = Math.sin(Math.PI * t) * 0.02;
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

/** THE FOOTWELL: the floor from the model's cabin floor's end up its ramp
 * to the firewall, and the walls either side from it up to the panel's
 * foot. */
export function footwellGeometry(): { floor: THREE.BufferGeometry; walls: THREE.BufferGeometry } {
  const C = PLANE_COCKPIT;
  const W = C.footwell;
  const floorY = PLANE.cabin.floor;
  const rows: V3[][] = [];
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const z = 0.7 + (C.firewall - 0.7) * t;
    const rise = z < W.from ? 0 : W.rise * Math.min(1, (z - W.from) / (W.to - W.from));
    const half = halfWidthAt(z);
    rows.push([
      { x: -half, y: floorY + rise, z },
      { x: half, y: floorY + rise, z },
    ]);
  }
  // Wound to face up.
  const floor = loft(rows);
  floor.setIndex(Array.from(floor.getIndex()!.array).reverse());
  floor.computeVertexNormals();
  const wall: V3[][] = [];
  for (let i = 0; i <= N; i++) {
    const z = W.from - 0.05 + (C.firewall - W.from + 0.05) * (i / N);
    const half = halfWidthAt(z) - 0.005;
    wall.push([
      { x: half, y: floorY, z },
      { x: half, y: C.panel.bottom + 0.05, z },
    ]);
  }
  const right = loft(wall);
  const left = loft(wall.map((r) => r.map((p) => ({ ...p, x: -p.x }))));
  const walls = new THREE.BufferGeometry();
  const merge = (gs: THREE.BufferGeometry[]): void => {
    const pos: number[] = [];
    for (const g of gs) {
      const ng = g.toNonIndexed();
      pos.push(...(ng.getAttribute("position").array as Float32Array));
    }
    walls.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    walls.computeVertexNormals();
  };
  merge([right, left]);
  return { floor, walls };
}

/** THE SEALS: a black rubber strip round every pane of the glass (`glass`,
 * its triangles in the machine's frame) — every edge only one triangle
 * has, its strip lying on the frame beside the pane and a little over it,
 * a hair inside the cabin (toward `inside`, a point on its middle line). */
export function sealGeometry(
  glass: THREE.BufferGeometry | null,
  inside: V3,
): THREE.BufferGeometry | null {
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
  const to = new THREE.Vector3();
  const v: number[] = [];
  const WIDE = 0.016;
  const OVER = 0.004;
  const IN = 0.01;
  const push = (p: THREE.Vector3) => v.push(p.x, p.y, p.z);
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    A.fromBufferAttribute(pos, e.a);
    B.fromBufferAttribute(pos, e.b);
    Cc.fromBufferAttribute(pos, e.c);
    n.subVectors(B, A).cross(d.subVectors(Cc, A)).normalize();
    d.subVectors(B, A).cross(n).normalize();
    if (d.dot(to.copy(Cc).sub(A)) > 0) d.negate();
    const inward =
      to.set(inside.x - A.x, inside.y - A.y, inside.z - A.z).dot(n) > 0
        ? n.clone()
        : n.clone().negate();
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

/** THE MODEL'S GLASS in the machine's frame (`toMachine` each mesh's own
 * matrix into it), off its body only — the cockpit's and the cabin's
 * windows, not the sliding door's. */
export function glassOf(
  body: THREE.Object3D,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
): THREE.BufferGeometry | null {
  const out: number[] = [];
  const p = new THREE.Vector3();
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    if (!/^glass/i.test((o.material as THREE.Material).name ?? "")) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position");
    const index = geo.getIndex();
    const m = toMachine(o);
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i++) {
      p.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
      out.push(p.x, p.y, p.z);
    }
  });
  if (!out.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}
