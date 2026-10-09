// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARTS EVERY VILLAGE VEHICLE IS BUILT OF (`traffic-shapes.ts` builds
// the bodies over them): the marks a vertex carries and the surfaces they
// are pushed with, the faces, boxes, panes of glass and lenses, the
// bicycle, and the wheels the view turns as instances of their own. The
// frame is the vehicle's: x its right, y up off the road, z forward, the
// body's middle at 0.

import * as THREE from "three";

import { BIKE, lampLayout } from "./traffic-look.ts";
import { Shape, type V3 } from "./tree-mesh.ts";

/** The marks every vehicle vertex carries, and their sizes. */
export const MARKS = { aPaint: 1, aLamp: 4, aRough: 1, aFold: 1, aGlass: 1 } as const;

/** The three cuts: NEAR has the arches, the mirrors, the lenses and the
 * plates; FAR is the body, its glass and its lamps alone; DISTANT is FAR
 * lofted through fewer rings of fewer points, its corners squarer. */
export type TrafficCut = "near" | "far" | "distant";

export const col = (r: number, g = r, b = r): THREE.Color => new THREE.Color(r, g, b);
/** Linear colours of what is the same on every vehicle. */
export const C = {
  paint: col(1),
  glass: col(0.018, 0.024, 0.03),
  trim: col(0.035),
  under: col(0.012),
  rubber: col(0.02),
  plate: col(0.75, 0.76, 0.72),
  head: col(0.72, 0.74, 0.76),
  tail: col(0.32, 0.01, 0.01),
  amber: col(0.55, 0.22, 0.02),
  white: col(0.82, 0.83, 0.84),
  snow: col(0.86, 0.9, 0.95),
  rim: col(0.42, 0.44, 0.46),
  rimDark: col(0.12, 0.125, 0.13),
  steel: col(0.3, 0.31, 0.33),
} as const;

/** A surface: its colour and the marks it is pushed with. */
export type Surface = { c: THREE.Color; paint: number; rough: number; glass?: number };
export const S = {
  paint: { c: C.paint, paint: 1, rough: 0.32 },
  glass: { c: C.glass, paint: 0, rough: 0.06 },
  busGlass: { c: C.glass, paint: 0, rough: 0.06, glass: 1 },
  trim: { c: C.trim, paint: 0, rough: 0.7 },
  under: { c: C.under, paint: 0, rough: 0.9 },
  plate: { c: C.plate, paint: 0, rough: 0.5 },
  white: { c: C.white, paint: 0, rough: 0.35 },
  snow: { c: C.snow, paint: 0, rough: 0.9 },
  rubber: { c: C.rubber, paint: 0, rough: 0.92 },
  rim: { c: C.rim, paint: 0, rough: 0.3 },
  rimDark: { c: C.rimDark, paint: 0, rough: 0.5 },
  steel: { c: C.steel, paint: 0, rough: 0.4 },
} satisfies Record<string, Surface>;

export function shape(): Shape {
  const s = new Shape(0, { stems: false, wind: true, marks: MARKS });
  s.facet = 1;
  return s;
}

/** Push with `surface`'s marks from here on. */
export function surface(
  s: Shape,
  f: Surface,
  lamp: readonly number[] = [0, 0, 0, 0],
  fold = 0,
): void {
  s.mark("aPaint", f.paint);
  s.mark("aRough", f.rough);
  s.mark("aLamp", ...lamp);
  s.mark("aFold", fold);
  s.mark("aGlass", f.glass ?? 0);
}

/** A flat quad facing `n`. */
export function face(s: Shape, f: Surface, a: V3, b: V3, c: V3, d: V3, n: V3): void {
  surface(s, f);
  s.quad(a, b, c, d, f.c, n);
}

/** An axis-aligned box from `lo` to `hi`. */
export function box(s: Shape, f: Surface, lo: V3, hi: V3, lamp?: readonly number[]): void {
  surface(s, f, lamp);
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  const q = (a: V3, b: V3, c: V3, d: V3, n: V3) => s.quad(a, b, c, d, f.c, n);
  q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
  q([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, -1, 0]);
  q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
  q([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]);
  q([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1]);
  q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
}

/** Glass's two shades: the dark of the cabin seen through it, and the
 * sky it mirrors along its top edge. */
const GLASS_LOW = col(0.03, 0.038, 0.048);
const GLASS_HIGH = col(0.2, 0.235, 0.28);

/** A pane: a quad of glass shaded from the cabin's dark at its foot to the
 * sky's reflection at its top. */
export function pane(s: Shape, f: Surface, a: V3, b: V3, c: V3, d: V3, n: V3): void {
  surface(s, f);
  const lo = Math.min(a[1], b[1], c[1], d[1]);
  const hi = Math.max(a[1], b[1], c[1], d[1]);
  const shade = (p: V3) =>
    GLASS_LOW.clone().lerp(GLASS_HIGH, (p[1] - lo) / Math.max(1e-3, hi - lo));
  for (const [p0, p1, p2] of [
    [a, b, c],
    [a, c, d],
  ] as const) {
    s.push(p0, shade(p0), n);
    s.push(p1, shade(p1), n);
    s.push(p2, shade(p2), n);
  }
}
/** A lamp's lens: a flat quad `w` across and `h` tall at `at`, facing
 * forward (`nz` 1) or back (−1). */
export function lens(
  s: Shape,
  c: THREE.Color,
  at: V3,
  w: number,
  h: number,
  nz: number,
  lamp: readonly number[],
): void {
  s.mark("aPaint", 0);
  s.mark("aRough", 0.15);
  s.mark("aLamp", ...lamp);
  s.mark("aFold", 0);
  s.mark("aGlass", 0);
  const [x, y, z] = at;
  const a: V3 = [x - (w / 2) * nz, y - h / 2, z];
  const b: V3 = [x + (w / 2) * nz, y - h / 2, z];
  s.quad(b, a, [a[0], y + h / 2, z], [b[0], y + h / 2, z], c, [0, 0, nz]);
}

// ── THE BICYCLE ─────────────────────────────────────────────────────────

/** A tube of four sides between two points. */
export function tube(s: Shape, f: Surface, a: V3, b: V3, r: number): void {
  surface(s, f);
  s.tube(a, b, r, r, 4, f.c);
}

export function emitBike(s: Shape): void {
  const B = BIKE;
  const W = B.wheel;
  const frame: Surface = { c: C.paint, paint: 1, rough: 0.3 };
  const bb: V3 = [0, B.bb.y, B.bb.z];
  const seat: V3 = [0, 0.82, -0.2];
  const headTop: V3 = [0, 0.92, 0.38];
  const headLow: V3 = [0, 0.74, 0.42];
  for (const x of [0.05, -0.05]) {
    tube(s, frame, [x, W, B.rear], [x * 0.6, B.bb.y, B.bb.z - 0.04], 0.012);
    tube(s, frame, [x, W, B.rear], [x * 0.4, seat[1], seat[2]], 0.011);
    tube(s, frame, [x * 1.1, W, B.front], [x * 0.5, headLow[1], headLow[2]], 0.014);
  }
  tube(s, frame, bb, seat, 0.017);
  tube(s, frame, seat, headTop, 0.017);
  tube(s, frame, bb, headLow, 0.021);
  tube(s, frame, headLow, headTop, 0.022);
  tube(s, S.steel, headTop, [0, B.grips.y, B.grips.z + 0.02], 0.013);
  tube(s, S.steel, [B.grips.x, B.grips.y, B.grips.z], [-B.grips.x, B.grips.y, B.grips.z], 0.012);
  for (const x of [B.grips.x, -B.grips.x]) {
    tube(s, S.rubber, [x * 0.8, B.grips.y, B.grips.z], [x * 1.02, B.grips.y, B.grips.z], 0.018);
  }
  tube(s, S.steel, seat, [0, B.saddle.y - 0.04, B.saddle.z + 0.02], 0.013);
  box(
    s,
    S.trim,
    [-0.08, B.saddle.y - 0.05, B.saddle.z - 0.12],
    [0.08, B.saddle.y, B.saddle.z + 0.06],
  );
  box(
    s,
    S.trim,
    [-0.02, B.saddle.y - 0.04, B.saddle.z + 0.06],
    [0.02, B.saddle.y - 0.01, B.saddle.z + 0.16],
  );
  // The chainring and the mudguards over the wheels.
  surface(s, S.steel);
  s.tube([0.06, B.bb.y, B.bb.z], [0.075, B.bb.y, B.bb.z], 0.1, 0.1, 8, C.steel);
  for (const [z, from, to] of [
    [B.rear, 0.2, 2.6],
    [B.front, 0.9, 2.9],
  ] as const) {
    surface(s, S.trim);
    const r = W + 0.035;
    for (let i = 0; i < 6; i++) {
      const a0 = from + ((to - from) * i) / 6;
      const a1 = from + ((to - from) * (i + 1)) / 6;
      const p0: V3 = [0, W + Math.sin(a0) * r, z - Math.cos(a0) * r];
      const p1: V3 = [0, W + Math.sin(a1) * r, z - Math.cos(a1) * r];
      s.quad(
        [0.04, p0[1], p0[2]],
        [-0.04, p0[1], p0[2]],
        [-0.04, p1[1], p1[2]],
        [0.04, p1[1], p1[2]],
        C.trim,
        [0, Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2)],
      );
    }
  }
  // The lamps: a white one on the bars, a red one under the saddle.
  const lay = lampLayout("bike");
  box(
    s,
    S.trim,
    [-0.035, lay.head.y - 0.03, lay.head.z - 0.07],
    [0.035, lay.head.y + 0.03, lay.head.z - 0.005],
  );
  lens(s, C.head, [0, lay.head.y, lay.head.z], lay.head.w, lay.head.h, 1, [1, 0, 0, 0]);
  lens(s, C.tail, [0, lay.tail.y, lay.tail.z], lay.tail.w, lay.tail.h, -1, [0, 1, 0, 0]);
}

// ── THE WHEELS ──────────────────────────────────────────────────────────

/** A UNIT WHEEL — radius 1, 1 wide across x, its outer face at +x — the
 * tyre's tread and walls round an alloy rim whose spokes show it turning;
 * scaled to each vehicle's wheel by the view. */
export function buildWheel(): THREE.BufferGeometry {
  const s = shape();
  const N = 12;
  const at = (r: number, a: number, x: number): V3 => [x, Math.sin(a) * r, Math.cos(a) * r];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    surface(s, S.rubber);
    s.quad(
      at(1, a0, 0.5),
      at(1, a0, -0.5),
      at(1, a1, -0.5),
      at(1, a1, 0.5),
      C.rubber,
      at(1, am, 0),
    );
    // The outer wall, and the rim's spokes inside it.
    s.quad(
      at(1, a0, 0.5),
      at(1, a1, 0.5),
      at(0.68, a1, 0.5),
      at(0.68, a0, 0.5),
      C.rubber,
      [1, 0, 0],
    );
    s.quad(
      at(1, a1, -0.5),
      at(1, a0, -0.5),
      at(0.6, a0, -0.5),
      at(0.6, a1, -0.5),
      C.rubber,
      [-1, 0, 0],
    );
    s.tri(at(0.6, a0, -0.5), at(0, 0, -0.5), at(0.6, a1, -0.5), C.under, [-1, 0, 0]);
    const spoke = i % 2 === 0 ? S.rim : S.rimDark;
    surface(s, spoke);
    s.quad(
      at(0.68, a0, 0.5),
      at(0.68, a1, 0.5),
      at(0.2, a1, 0.42),
      at(0.2, a0, 0.42),
      spoke.c,
      [1, 0, 0],
    );
    surface(s, S.rim);
    s.tri(at(0.2, a0, 0.42), at(0.2, a1, 0.42), [0.42, 0, 0], C.rim, [1, 0, 0]);
  }
  return s.geometry();
}

/** A UNIT BICYCLE WHEEL — the tyre a ring round thin spokes and a hub,
 * radius 1, its width 1 across x. */
export function buildBikeWheel(): THREE.BufferGeometry {
  const s = shape();
  const N = 14;
  const at = (r: number, a: number, x: number): V3 => [x, Math.sin(a) * r, Math.cos(a) * r];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    surface(s, S.rubber);
    s.quad(
      at(1, a0, 0.5),
      at(1, a0, -0.5),
      at(1, a1, -0.5),
      at(1, a1, 0.5),
      C.rubber,
      at(1, am, 0),
    );
    s.quad(
      at(1, a0, 0.5),
      at(1, a1, 0.5),
      at(0.82, a1, 0.5),
      at(0.82, a0, 0.5),
      C.rubber,
      [1, 0, 0],
    );
    s.quad(
      at(1, a1, -0.5),
      at(1, a0, -0.5),
      at(0.82, a0, -0.5),
      at(0.82, a1, -0.5),
      C.rubber,
      [-1, 0, 0],
    );
    s.quad(
      at(0.82, a1, 0.5),
      at(0.82, a1, -0.5),
      at(0.82, a0, -0.5),
      at(0.82, a0, 0.5),
      C.steel,
      at(-1, am, 0),
    );
  }
  surface(s, S.steel);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s.tube([0, 0, 0], at(0.82, a, 0), 0.025, 0.02, 3, C.steel);
  }
  s.tube([-0.5, 0, 0], [0.5, 0, 0], 0.08, 0.08, 6, C.steel);
  return s.geometry();
}
