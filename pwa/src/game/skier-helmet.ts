// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S HEAD AND HIS HELMET — a model of its own, laid in the head's
// frame (z forward, y up, the origin at the middle of the head) and hung by
// `skier-figure.ts` where the pose puts the head.
//
// A helmet is a HOLLOW thing worn over a head, and it reads as one only
// when it is built so: a SHELL with the eye port cut out of it — an outer
// skin, an inner liner seen through the port, and a rim joining them so the
// opening has a thickness — over a HEAD whose face shows in the port; the
// GOGGLES on that face, over his eyes, inside the hollow and behind the
// port's rim, their strap run round the OUTSIDE of the shell's back the way
// a racer wears it; the CHIN BAR the shell's own long jaw under the port,
// a vent in its front face; the PEAK riding the crown over the port.
// Worn, the whole helmet is tipped nose-down (`HELMET_TILT`) so the port
// looks level at the snow ahead.
//
// MEASURED, not guessed: every number below is read off a side photograph
// of a real motocross helmet, gridded and scaled so it is 35 cm from the
// back to the tip of the chin bar, the head's middle taken 12.5 cm behind
// the front of the goggles' lens. Its shape is what makes it read as a helmet and not a gas
// mask: the shell at the eyes is FLAT — the brow only 11.5 cm ahead of the
// head's middle, the goggles filling the port nearly flush — while the chin
// bar reaches 21 cm forward as a long jaw whose bottom runs on in one line
// with the rim, and the peak rides the crown level out to 18.5 cm. The
// shell is one surface whose reach from the head's middle is read off
// three measured profiles (ahead, behind, to the side); the PORT and the
// CAP are outlines traced on the same photograph, and the shell is cut
// exactly along them — every grid triangle that crosses an outline is
// clipped at it — so their edges are the outlines and not a staircase. `make skis ARGS=--sheet=head` is the lab: every kit, every side, and
// a profile on a centimetre grid, centred on the head's middle, to lay
// against a photograph at the same scale (tipped as worn, so allow for
// `HELMET_TILT` against a helmet resting on its rim).

import * as THREE from "three";

import { shaped } from "./skier-cloth.ts";

/** How far the shell reaches from the head's middle, m, by elevation (deg,
 * −90 straight down … 90 the crown) — straight ahead, straight behind and
 * to the side. Read off the photograph; see the header. Straight ahead it
 * is the chin bar below the port (its flat underside, the tip at −23°, the
 * front face with the vent, the top corner at −7.5°) and the brow above. */
const AHEAD: [number, number][] = [
  [-90, 0.1325],
  [-67.5, 0.137],
  [-52, 0.16],
  [-40, 0.196],
  [-33.5, 0.217],
  [-29, 0.231],
  [-23, 0.226],
  [-15, 0.2],
  [-7.5, 0.175],
  [0, 0.16],
  [32, 0.135],
  [42, 0.145],
  [60, 0.138],
  [75, 0.13],
  [90, 0.125],
];
const BEHIND: [number, number][] = [
  [-90, 0.1325],
  [-67.5, 0.14],
  [-40, 0.158],
  [-20, 0.143],
  [0, 0.136],
  [20, 0.14],
  [37, 0.152],
  [50, 0.148],
  [70, 0.133],
  [90, 0.125],
];
/** How far the helmet is tipped nose-down when WORN, rad, against the
 * photograph (a helmet resting on its rim, which leans its goggles back
 * about 10°): worn, the port looks level at the snow ahead. And how far
 * it sits up on the head, m. */
export const HELMET_TILT = 0.17;
const SIT = 0.012;
const SIDE: [number, number][] = [
  [-90, 0.1325],
  [-60, 0.135],
  [-30, 0.13],
  [0, 0.128],
  [30, 0.126],
  [60, 0.125],
  [90, 0.125],
];
/** The shell's thickness, m. */
const THICK = 0.014;
/** The grid the shell is laid on: around (from dead ahead, clockwise from
 * above) and up. */
const AROUND = 28;
const UP = 20;
/** The shell is open below this elevation, deg: the neck. */
const NECK = -67.5;
/** How far round from dead ahead the liner is laid, rad: it is only ever
 * seen through the port. */
const LINER_REACH = 1.9;
/** How far the cap stands proud of the shell, m. */
const CAP_LIFT = 0.004;
/** THE EYE PORT and THE CAP, as they were outlined on the photograph: the
 * helmet seen from the side, (cm ahead of the head's middle, cm up). A cell
 * of the shell whose middle, seen from the side, falls inside the PORT is
 * open — so the port wraps round to the temples and its sill rises forward
 * from under the goggles to the chin bar's top corner. One inside the CAP
 * is the plastic cap over the crown and the front, its flange coming down
 * the side to the bolt at the temple, the peak its lip (`buildHelmet`). */
const PORT_OUTLINE: [number, number][] = [
  [1, 1.8],
  [4.3, 3.8],
  [8.2, 5.5],
  [11.5, 7.1],
  [30, 7.1],
  [30, -2.1],
  [17.4, -2.1],
  [12.2, -6.1],
  [4.9, -6.4],
  [2.6, -5.4],
  [1.6, -2.1],
];
const CAP_OUTLINE: [number, number][] = [
  [-9.5, 11.1],
  [-9.5, 30],
  [30, 30],
  [30, 9.7],
  [10.9, 9.7],
  [8.9, 8.4],
  [6.3, 6.1],
  [3, 4.1],
  [0.3, 2.8],
  [-1.5, 0.4],
  [-3.6, 1.5],
  [-5.6, 3.8],
  [-7.6, 7.1],
  [-8.9, 9.4],
];
/** The goggle strap round the back, rad up: flat back from the goggles,
 * as it runs on the photograph (y 0 to −4 cm). */
const STRAP = { low: -0.3, high: -0.02 };

function inside(poly: [number, number][], x: number, y: number): boolean {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
  }
  return inn;
}

export type HelmetMaterials = {
  shell: THREE.Material;
  liner: THREE.Material;
  trim: THREE.Material;
  lens: THREE.Material;
  strap: THREE.Material;
  skin: THREE.Material;
};

const DEG = Math.PI / 180;

function profile(table: [number, number][], e: number): number {
  const d = e / DEG;
  if (d <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [e1, r1] = table[i];
    if (d <= e1) {
      const [e0, r0] = table[i - 1];
      return r0 + ((r1 - r0) * (d - e0)) / (e1 - e0);
    }
  }
  return table[table.length - 1][1];
}

/** The shell's reach at `a` round (0 ahead) and `e` up, rad, `lift` m
 * proud of it (negative: inside it). */
export function helmetReach(a: number, e: number, lift = 0): number {
  const c = Math.cos(a);
  const ahead = Math.max(0, c) ** 2;
  const behind = Math.max(0, -c) ** 2;
  const side = 1 - ahead - behind;
  return ahead * profile(AHEAD, e) + behind * profile(BEHIND, e) + side * profile(SIDE, e) + lift;
}

/** The point on the shell (or `lift` off it) at `a` round and `e` up. */
function at(a: number, e: number, lift = 0): [number, number, number] {
  const r = helmetReach(a, e, lift);
  const c = Math.cos(e);
  return [Math.sin(a) * c * r, Math.sin(e) * r, Math.cos(a) * c * r];
}

/** A patch of the surface `lift` proud of it, over `a0..a1` round and
 * `e0..e1` up, `na` × `ne` cells — the goggle strap round the back. */
function patch(
  a0: number,
  a1: number,
  e0: number,
  e1: number,
  na: number,
  ne: number,
  lift: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ne; j++) {
    for (let i = 0; i <= na; i++) {
      pos.push(...at(a0 + ((a1 - a0) * i) / na, e0 + ((e1 - e0) * j) / ne, lift));
    }
  }
  for (let j = 0; j < ne; j++) {
    for (let i = 0; i < na; i++) {
      const p = j * (na + 1) + i;
      idx.push(p, p + 1, p + na + 1, p + 1, p + na + 2, p + na + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Where the shell at `a` round and `e` up is, seen from the side: cm
 * ahead, cm up. */
function sideOf(a: number, e: number): [number, number] {
  const [, y, z] = at(a, e);
  return [z * 100, y * 100];
}

/** A field over the shell, by `a` round and `e` up: the surface is KEPT
 * where it is negative and cut away where it is positive. */
type Field = (a: number, e: number) => number;

/** How far a side-view point is from an outline, cm: positive inside it. */
function signedTo(poly: [number, number][], x: number, y: number): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const ex = bx - ax;
    const ey = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(x - ax - t * ex, y - ay - t * ey));
  }
  return inside(poly, x, y) ? d : -d;
}

/** The port: cut away inside its outline, ahead of the ears. */
const portField: Field = (a, e) => {
  const [z, y] = sideOf(a, e);
  return z > 0 ? signedTo(PORT_OUTLINE, z, y) : -1;
};
/** The neck: cut away below the rim. */
const neckField: Field = (_a, e) => NECK * DEG - e;
/** The cap: kept only inside its outline. */
const capField: Field = (a, e) => -signedTo(CAP_OUTLINE, ...sideOf(a, e));
/** The liner: kept only where the port can show it. */
const linerField: Field = (a) => Math.abs(a) - LINER_REACH;

/** What the shell IS at `a` round and `e` up — cut away for the neck or
 * the port, the cap laid over it, or the shell — so a model of the helmet
 * laid on the same measured surface (`make blender KIND=skier`) is cut and
 * coloured along the same outlines. */
export function helmetPart(a: number, e: number): "neck" | "port" | "cap" | "shell" {
  if (neckField(a, e) > 0) return "neck";
  if (portField(a, e) > 0) return "port";
  return capField(a, e) < 0 ? "cap" : "shell";
}

/** How far the helmet sits up on the head, m. */
export const HELMET_SIT = SIT;

/** The shell's outward normal at `a`, `e`, off the surface itself. */
function normalAt(a: number, e: number, lift: number): [number, number, number] {
  const h = 1e-4;
  const p = at(a, e, lift);
  const pa = at(a + h, e, lift);
  const pe = at(a, Math.min(Math.PI / 2, e + h), lift);
  const u = [pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]];
  const v = [pe[0] - p[0], pe[1] - p[1], pe[2] - p[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  let l = Math.hypot(n[0], n[1], n[2]);
  if (l < 1e-12) {
    n = [p[0], p[1], p[2]];
    l = Math.hypot(n[0], n[1], n[2]) || 1;
  }
  return [n[0] / l, n[1] / l, n[2] / l];
}

type Param = [number, number];

/** Where along an edge a field crosses zero, by bisection. */
function crossing(f: Field, p: Param, q: Param): Param {
  let lo = 0;
  let hi = 1;
  const fp = f(p[0], p[1]);
  for (let k = 0; k < 18; k++) {
    const m = (lo + hi) / 2;
    const v = f(p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m);
    if (v > 0 === fp > 0) lo = m;
    else hi = m;
  }
  const t = (lo + hi) / 2;
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

/** A polygon (in parameters) cut down to where `f` is negative; the cut's
 * two ends when it made one. */
function clip(poly: Param[], f: Field): { kept: Param[]; cut: [Param, Param] | null } {
  const v = poly.map((p) => f(p[0], p[1]));
  const kept: Param[] = [];
  const ends: Param[] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    if (v[i] <= 0) kept.push(poly[i]);
    if (v[i] <= 0 !== v[j] <= 0) {
      const x = crossing(f, poly[i], poly[j]);
      kept.push(x);
      ends.push(x);
    }
  }
  return { kept, cut: ends.length === 2 ? [ends[0], ends[1]] : null };
}

/**
 * THE SURFACE `lift` off the shell, laid on the grid and cut EXACTLY along
 * every field's zero (each grid triangle clipped where it crosses one), so
 * the port's edge and the cap's edge are the outlines themselves and not a
 * staircase of cells. Normals come off the surface. `rims` collects the
 * cuts the fields named in `rimOf` made, for the rim.
 */
function surface(
  lift: number,
  fields: Field[],
  inward = false,
  rims?: { of: Field[]; cuts: [Param, Param][] },
): THREE.BufferGeometry {
  const da = (Math.PI * 2) / AROUND;
  const de = Math.PI / UP;
  const pos: number[] = [];
  const nrm: number[] = [];
  const emit = (p: Param) => {
    pos.push(...at(p[0], p[1], lift));
    const n = normalAt(p[0], p[1], lift);
    nrm.push(...(inward ? n.map((c) => -c) : n));
  };
  for (let j = 0; j < UP; j++) {
    for (let i = 0; i < AROUND; i++) {
      const a0 = -Math.PI + i * da;
      const e0 = -Math.PI / 2 + j * de;
      const A: Param = [a0, e0];
      const B: Param = [a0 + da, e0];
      const C: Param = [a0, e0 + de];
      const D: Param = [a0 + da, e0 + de];
      for (const tri of [
        [A, B, C],
        [B, D, C],
      ] as Param[][]) {
        let poly = tri;
        for (const f of fields) {
          const { kept, cut } = clip(poly, f);
          if (cut && rims?.of.includes(f)) rims.cuts.push(cut);
          poly = kept;
          if (poly.length < 3) break;
        }
        if (poly.length < 3) continue;
        for (let k = 1; k + 1 < poly.length; k++) {
          const t = inward ? [poly[0], poly[k + 1], poly[k]] : [poly[0], poly[k], poly[k + 1]];
          for (const p of t) emit(p);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/** THE SHELL: the outer skin with its rim round every opening (the port
 * and the neck), the liner, and the cap laid over the shell — three
 * geometries, so each takes its colour. */
export function helmetShell(): {
  outer: THREE.BufferGeometry;
  liner: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
} {
  const rims = { of: [portField, neckField], cuts: [] as [Param, Param][] };
  const outer = surface(0, [neckField, portField], false, rims);
  // The rim: every cut joined from the outer skin to the liner, turned to
  // face into the opening (away from the kept shell).
  const pos: number[] = [];
  for (const [p, q] of rims.cuts) {
    const p0 = at(p[0], p[1]);
    const p1 = at(q[0], q[1]);
    const q0 = at(p[0], p[1], -THICK);
    const q1 = at(q[0], q[1], -THICK);
    // Which way is open: a step off the cut's middle toward where a field
    // is positive.
    const m: Param = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const f = neckField(m[0], m[1]) > -0.02 ? neckField : portField;
    const h = 0.01;
    const ga = f(m[0] + h, m[1]) - f(m[0] - h, m[1]);
    const ge = f(m[0], m[1] + h) - f(m[0], m[1] - h);
    const open = at(m[0] + ga * h, m[1] + ge * h);
    const mid = at(m[0], m[1]);
    const toOpen = [open[0] - mid[0], open[1] - mid[1], open[2] - mid[2]];
    const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const w = [q0[0] - p0[0], q0[1] - p0[1], q0[2] - p0[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (n[0] * toOpen[0] + n[1] * toOpen[1] + n[2] * toOpen[2] > 0) {
      pos.push(...p0, ...p1, ...q0, ...p1, ...q1, ...q0);
    } else {
      pos.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
    }
  }
  const edge = new THREE.BufferGeometry();
  edge.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  edge.computeVertexNormals();
  return {
    outer: mergeTwo(outer, edge),
    liner: surface(-THICK, [neckField, portField, linerField], true),
    cap: surface(CAP_LIFT, [neckField, portField, capField]),
  };
}

/** One geometry of two, both laid flat (no index), normals kept. */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = [a.index ? a.toNonIndexed() : a, b.index ? b.toNonIndexed() : b];
  const pos: number[] = [];
  const nrm: number[] = [];
  for (const g of flat) {
    pos.push(...(g.getAttribute("position").array as Float32Array));
    nrm.push(...(g.getAttribute("normal").array as Float32Array));
  }
  for (const g of [a, b, ...flat]) g.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/**
 * THE HEAD IN HIS HELMET, built into `into` (the head's frame). `keep`
 * takes every geometry made, for the caller to dispose.
 */
export function buildHelmet(
  into: THREE.Object3D,
  m: HelmetMaterials,
  keep: <G extends THREE.BufferGeometry>(g: G) => G,
): void {
  // The helmet's parts go on `worn`, tipped as it is worn; the head and
  // his nose stay in the head's own frame.
  const worn = new THREE.Group();
  worn.rotation.x = HELMET_TILT;
  worn.position.y = SIT;
  into.add(worn);
  const part = (g: THREE.BufferGeometry, mat: THREE.Material, on: THREE.Object3D = worn) => {
    const mesh = new THREE.Mesh(keep(g), mat);
    mesh.castShadow = true;
    on.add(mesh);
    return mesh;
  };

  // THE HEAD: a skull a little long, the face forward toward the port, a
  // nose under the goggles.
  const head = part(new THREE.SphereGeometry(0.1, 12, 10), m.skin, into);
  head.scale.set(0.82, 1.02, 1);
  head.position.set(0, -0.012, -0.004);
  const nose = part(
    shaped(
      [
        { y: 0, w: 0.016, d: 0.012 },
        { y: 0.03, w: 0.014, d: 0.01, z: 0.004 },
        { y: 0.042, w: 0.008, d: 0.006, z: 0.006 },
      ],
      { segments: 6, boxy: 2 },
    ).rotateX(Math.PI / 2),
    m.skin,
    into,
  );
  nose.position.set(0, -0.04, 0.078);
  nose.rotation.x = -0.35;

  // THE SHELL, hollow, its port open onto his face.
  const shell = helmetShell();
  part(shell.outer, m.shell);
  part(shell.liner, m.liner);
  part(shell.cap, m.trim);

  // THE GOGGLES on his face, filling the port nearly flush — the lens's
  // front 12.5 cm ahead of the head's middle, as measured: the thick frame
  // wrapped round, the lens in it, both running on inside the shell's
  // cheeks. The strap round the OUTSIDE of the shell's back.
  const frame = part(
    new THREE.CylinderGeometry(0.113, 0.113, 0.09, 16, 1, true, -1.3, 2.6),
    m.trim,
  );
  frame.scale.set(0.95, 1, 1);
  frame.position.set(0, 0.002, 0.004);
  const lens = part(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16, 1, true, -1.05, 2.1), m.lens);
  lens.scale.set(0.95, 1, 1);
  lens.position.set(0, 0.002, 0.004);
  part(patch(1.3, Math.PI * 2 - 1.3, STRAP.low, STRAP.high, 24, 2, 0.007), m.strap);

  // THE VENT in the chin bar's front face, which looks forward and up.
  const vent = part(new THREE.BoxGeometry(0.05, 0.036, 0.02), m.strap);
  vent.position.set(0, -0.056, 0.184);
  vent.rotation.x = -0.61;

  // THE PEAK riding the crown level from over the middle of the head to
  // 18.5 cm ahead of it, thick where its underside curves down to the brow,
  // thin at its lip — laid along +z, each ring its width, its thickness and
  // how far its middle drops.
  const peak = part(
    shaped(
      [
        { y: 0, w: 0.08, d: 0.008 },
        { y: 0.05, w: 0.09, d: 0.009 },
        { y: 0.12, w: 0.105, d: 0.0145, z: 0.0065 },
        { y: 0.16, w: 0.1, d: 0.0095, z: 0.0035 },
        { y: 0.2, w: 0.07, d: 0.0025, z: -0.0005 },
        { y: 0.208, w: 0.05, d: 0.002, z: -0.001 },
      ],
      { segments: 10, boxy: 4 },
    ).rotateX(Math.PI / 2),
    m.trim,
  );
  peak.position.set(0, 0.119, -0.03);
}
