// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S WINGS AS CUT — three-free, so the suite reads the very
// surfaces the game draws (`wingsuit-figure.ts` hangs them on the figure).
//
// THE APPROACH, and why it is not the skin's: the body of the suit is the
// dressed skier's own skin (`skier-dress.ts`, skinned on the rig in its
// STANDING bind pose), but the WINGS cannot be. In that bind pose the arms
// hang at his sides, so the arm wing between the arm and the body has no
// area at all to bind — and no blend of bone matrices can stretch a strip
// of cloth into the metre-wide membrane a flying arm pulls out of it.
// Morph targets would need one shape for every pose the arms take. So the
// wings are LOFTED afresh each frame off the posed joints — the very
// `SkierPose` the skin is posed by, so they move as one with it:
//
//   * each wing is a COONS PATCH spanned by its four edges — an arm wing's
//     leading edge along the arm (the arm inside its nose), its root down
//     the side of the body from the armpit past the hip to the outside of
//     the knee, its tip the chord at the wrist and its trailing edge
//     straight from the wrist to the knee; the leg wing's sides along the
//     legs (each leg in a sleeve of it) from the crotch to past the heels,
//     its tail a shallow V;
//   * each a closed AIRFOIL of two skins offset either side of the patch —
//     the arm's round nose a sleeve round the arm, then a profile thickest
//     a quarter back and sharp at the trailing edge, cambered, the skin
//     pillowed between the ribs — all of it scaled by the suit's PRESSURE
//     (`WingsuitFlight.pressure`), so a suit stood on the exit hangs slack
//     and rippled and fills over the exit as the air rams in;
//   * UNZIPPED under the canopy, an arm wing lets go of the body and hangs
//     off the arm.
//
// The cloth is a grid of a fixed topology (`suitLayout`), so the drawing
// writes new positions into one buffer a frame.

import type { SkierPose } from "./skier-joints.ts";
import { BODY } from "./skier-mounts.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";
import { SUIT_CUT } from "./wingsuit-look.ts";

/** The grid each wing is cut in: across the span (`nu` steps) and along
 * the chord (`nv`). */
export const GRID = {
  arm: { nu: 16, nv: 12 },
  leg: { nu: 14, nv: 12 },
} as const;

/** The wings in the buffer's order: the left arm, the right arm, the leg. */
export const WINGS = ["armL", "armR", "leg"] as const;
export type WingId = (typeof WINGS)[number];

/** What the cloth is cut as: how many vertices, the triangles, and each
 * vertex's `aWing` — where it lies on its wing (u across the span, v along
 * the chord, 0..1), which wing (0 the left arm, 1 the right, 2 the leg)
 * and which skin (1 the top, his back; −1 the bottom). */
export type SuitLayout = {
  vertices: number;
  index: Uint16Array;
  paint: Float32Array;
  /** Where each wing's two skins start in the buffer (in vertices). */
  start: Record<WingId, { top: number; bottom: number }>;
};

/** What fills and lets go of the wings this frame: how full of air 0..1;
 * how far the arm wings are unzipped 0..1; the clock, s (the slack cloth's
 * flutter). */
export type SuitDrive = { pressure: number; unzip: number; t: number };

const gridOf = (w: WingId) => (w === "leg" ? GRID.leg : GRID.arm);

/** THE CLOTH'S TOPOLOGY: every wing two skins on its grid, and caps closing
 * the gap between them where the profile is open (an arm wing's root and
 * tip, the leg wing's front). */
export function suitLayout(): SuitLayout {
  let n = 0;
  const start = {} as SuitLayout["start"];
  for (const w of WINGS) {
    const g = gridOf(w);
    const k = (g.nu + 1) * (g.nv + 1);
    start[w] = { top: n, bottom: n + k };
    n += 2 * k;
  }
  const paint = new Float32Array(n * 4);
  const index: number[] = [];
  WINGS.forEach((w, wi) => {
    const g = gridOf(w);
    const s = start[w];
    const at = (skin: number, i: number, j: number) => skin + j * (g.nu + 1) + i;
    for (const [skin, side] of [
      [s.top, 1],
      [s.bottom, -1],
    ] as const) {
      for (let j = 0; j <= g.nv; j++) {
        for (let i = 0; i <= g.nu; i++) {
          const o = at(skin, i, j) * 4;
          paint[o] = i / g.nu;
          paint[o + 1] = j / g.nv;
          paint[o + 2] = wi;
          paint[o + 3] = side;
        }
      }
      for (let j = 0; j < g.nv; j++) {
        for (let i = 0; i < g.nu; i++) {
          const a = at(skin, i, j);
          const b = at(skin, i + 1, j);
          const c = at(skin, i + 1, j + 1);
          const d = at(skin, i, j + 1);
          if (side > 0) index.push(a, b, c, a, c, d);
          else index.push(a, c, b, a, d, c);
        }
      }
    }
    // The caps: a strip between the skins along an open edge.
    const strip = (pts: [number, number][]) => {
      for (let k = 0; k + 1 < pts.length; k++) {
        const [i0, j0] = pts[k];
        const [i1, j1] = pts[k + 1];
        const a = at(s.top, i0, j0);
        const b = at(s.top, i1, j1);
        index.push(a, at(s.bottom, i0, j0), b, b, at(s.bottom, i0, j0), at(s.bottom, i1, j1));
      }
    };
    const run = (fixed: "i" | "j", at0: number, count: number): [number, number][] =>
      Array.from({ length: count + 1 }, (_, k) => (fixed === "i" ? [at0, k] : [k, at0]));
    if (w === "leg") strip(run("j", 0, g.nu));
    else {
      strip(run("i", 0, g.nv));
      strip(run("i", g.nu, g.nv));
    }
  });
  return { vertices: n, index: Uint16Array.from(index), paint, start };
}

/** A polyline's point at `t` 0..1 of its length. */
function along(pts: readonly V3[], t: number): V3 {
  const lens: number[] = [];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const l = len(sub(pts[k], pts[k - 1]));
    lens.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let k = 0; k < lens.length; k++) {
    if (d <= lens[k] || k === lens.length - 1) {
      return mix(pts[k], pts[k + 1], lens[k] > 1e-9 ? Math.min(1, d / lens[k]) : 0);
    }
    d -= lens[k];
  }
  return pts[pts.length - 1];
}

/** A rounded polyline: each inner corner cut by Chaikin's rule twice, so a
 * root down the body bends rather than kinks. */
function rounded(pts: readonly V3[]): V3[] {
  let out = [...pts];
  for (let pass = 0; pass < 2; pass++) {
    const next: V3[] = [out[0]];
    for (let k = 0; k + 1 < out.length; k++) {
      next.push(mix(out[k], out[k + 1], 0.25), mix(out[k], out[k + 1], 0.75));
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** The airfoil's half thickness at `x` of the chord, as a share of its
 * greatest (the four-digit section's, its thickest at 0.3). */
function section(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  const f = 0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1036 * c ** 4;
  return Math.max(0, f / 0.1);
}

/** A round sleeve's half thickness `s` m along a chord from its front, the
 * sleeve `r` m in radius with its front at the chord's. */
const sleeveAt = (s: number, r: number): number =>
  Math.sqrt(Math.max(0, r * r - (s - r) * (s - r)));

/** Between the ribs the skin bulges: a share of the full thickness at `u`
 * across `cells` cells. */
const pillow = (u: number, cells: number): number =>
  0.72 + 0.28 * Math.sqrt(Math.abs(Math.sin(Math.PI * u * cells)));

/** A Coons patch spanned by its four edges (`l` the leading edge at v = 0,
 * `t` the trailing at v = 1, `r` the root at u = 0, `p` the tip at u = 1),
 * each a function of its own parameter, sharing their corners. */
function coons(
  l: (u: number) => V3,
  t: (u: number) => V3,
  r: (v: number) => V3,
  p: (v: number) => V3,
  u: number,
  v: number,
): V3 {
  const [l0, l1, t0, t1] = [l(0), l(1), t(0), t(1)];
  const ruled = add(
    add(scale(l(u), 1 - v), scale(t(u), v)),
    add(scale(r(v), 1 - u), scale(p(v), u)),
  );
  const corners = add(
    add(scale(l0, (1 - u) * (1 - v)), scale(l1, u * (1 - v))),
    add(scale(t0, (1 - u) * v), scale(t1, u * v)),
  );
  return sub(ruled, corners);
}

/** One wing's base surface, its sleeve radius and its section, as the loft
 * reads it. */
type Wing = {
  base: (u: number, v: number) => V3;
  /** The chord at `u`, m. */
  chord: (u: number) => number;
  /** The half thickness at (u, v), m, inflated and at rest. */
  half: (u: number, v: number, pressure: number) => number;
  /** The camber's lift of the middle surface at (u, v), m. */
  camber: (u: number, v: number, pressure: number) => number;
  /** Which way the top skin faces: the sign the patch's own normal takes. */
  sign: number;
  cells: number;
};

/** THE ARM WING on side `i` (0 left, 1 right), off the pose. */
export function armWing(p: SkierPose, i: number, unzip = 0): Wing {
  const side = i === 0 ? -1 : 1;
  const A = SUIT_CUT.arm;
  const across = norm(sub(p.shoulders[1], p.shoulders[0]));
  const down = norm(sub(p.hips, p.neck));
  const sh = p.shoulders[i];
  const el = p.elbows[i];
  const hd = p.hands[i];
  const hip = p.hipJoints[i];
  const knee = p.knees[i];
  // The root, down the side of the body: the armpit, the ribs, the hip,
  // the outside of the thigh, the knee's.
  const thigh = norm(sub(knee, hip));
  const outThigh = norm(sub(scale(across, side), scale(thigh, dot(scale(across, side), thigh))));
  const ribs = add(mix(p.neck, p.hips, 0.42), scale(across, side * 0.17));
  const waist = add(mix(p.neck, p.hips, 0.75), scale(across, side * 0.16));
  const rootEnd = add(add(hip, scale(sub(knee, hip), A.root)), scale(outThigh, 0.075));
  const thighMid = add(mix(hip, knee, 0.45), scale(outThigh, 0.095));
  const hipSide = add(hip, scale(outThigh, 0.11));
  const armpit = add(add(sh, scale(down, 0.07)), scale(across, -side * 0.02));
  const rootLine = rounded([armpit, ribs, waist, hipSide, thighMid, rootEnd]);
  // The arm, from the shoulder to the grip.
  const arm = (u: number): V3 => along([sh, el, hd], u);
  const tangent = (u: number): V3 =>
    norm(sub(arm(Math.min(1, u + 0.02)), arm(Math.max(0, u - 0.02))));
  const radius = (u: number): number => A.sleeve * (1 - 0.3 * u);
  // The trailing edge, straight from the knee's end of the root to the
  // wrist's chord, whose direction is square to the forearm toward it.
  const fore = norm(sub(hd, el));
  const toKnee = sub(rootEnd, hd);
  const tipDir = norm(sub(toKnee, scale(fore, dot(toKnee, fore))));
  const tipFront = sub(hd, scale(tipDir, radius(1)));
  const tipBack = add(tipFront, scale(tipDir, A.tip));
  const trailing = (u: number): V3 => mix(rootEnd, tipBack, u);
  const chordDir = (u: number): V3 => {
    const d = sub(trailing(u), arm(u));
    const t = tangent(u);
    return norm(sub(d, scale(t, dot(d, t))));
  };
  const leading = (u: number): V3 => sub(arm(u), scale(chordDir(u), radius(u)));
  const l0 = leading(0);
  const root = (v: number): V3 => (v <= 0 ? l0 : along([l0, ...rootLine], v));
  const tip = (v: number): V3 => mix(tipFront, tipBack, v);
  const flat = (u: number, v: number) => coons(leading, trailing, root, tip, u, v);
  // UNZIPPED: the wing let go of the body, hanging off the arm.
  const base =
    unzip <= 0
      ? flat
      : (u: number, v: number): V3 => {
          const hang = add(
            arm(u),
            add(scale(down, v * 0.42 * (1 - 0.45 * u)), scale(across, side * v * 0.04)),
          );
          return mix(flat(u, v), hang, unzip * Math.min(1, 0.25 + 0.75 * v));
        };
  const chord = (u: number) => len(sub(trailing(u), leading(u)));
  return {
    base,
    chord,
    half: (u, v, pressure) => {
      const c = chord(u);
      const s = v * c;
      const sleeve = sleeveAt(s, radius(u));
      const air =
        A.half * (1 - 0.55 * u) * section(v) * pillow(u, A.cells) * pressure * (1 - unzip);
      return Math.max(sleeve, air);
    },
    camber: (u, v, pressure) =>
      A.camber * chord(u) * Math.sin(Math.PI * v) * Math.min(1, v * 4) * pressure * (1 - unzip),
    sign: side,
    cells: A.cells,
  };
}

/** THE LEG WING between the legs, off the pose. */
export function legWing(p: SkierPose): Wing {
  const L = SUIT_CUT.leg;
  // Each leg from the crotch's height down the shin to the ankle, then
  // along the BOOTIE to past the toes — the foot as the pose points it (a
  // flyer's toes pointed nearly in line with the shin, a stood one's down
  // the shin), so the leg wing's trailing corners are two feet.
  const lines = [0, 1].map((i) => {
    const hip = p.hipJoints[i];
    const knee = p.knees[i];
    const cuff = p.feet[i];
    const shin = norm(sub(cuff, knee));
    const ankle = add(cuff, scale(shin, BODY.cuffOverAnkle));
    const f = p.boots[i].f;
    const foot = norm(mix(shin, f, Math.max(0, dot(f, shin))));
    const start = add(hip, scale(norm(sub(knee, hip)), L.crotch));
    return [start, knee, cuff, ankle, add(ankle, scale(foot, 0.06 + L.past))];
  });
  // The sleeve round each leg: tapering down the thigh and the shin, its
  // knee and its heel standing out of it, so from the side the legs read
  // as legs in a sleeve rather than one cone.
  const bump = (v: number, at: number, w: number) => Math.exp(-(((v - at) / w) ** 2));
  const r = (v: number) =>
    0.092 - 0.035 * v + 0.014 * bump(v, 0.34, 0.06) + 0.012 * bump(v, 0.8, 0.05);
  const legAt = (i: number, v: number): V3 => along(lines[i], v);
  const sideOf =
    (i: number) =>
    (v: number): V3 => {
      const a = norm(sub(legAt(1, v), legAt(0, v)));
      return add(legAt(i, v), scale(a, (i === 0 ? -1 : 1) * r(v)));
    };
  const left = sideOf(0);
  const right = sideOf(1);
  const endDir = norm(
    sub(mix(legAt(0, 1), legAt(1, 1), 0.5), mix(legAt(0, 0.8), legAt(1, 0.8), 0.5)),
  );
  const front = (u: number): V3 => mix(left(0), right(0), u);
  const back = (u: number): V3 =>
    add(mix(left(1), right(1), u), scale(endDir, L.tail * (1 - (2 * u - 1) ** 2)));
  const base = (u: number, v: number) => coons(front, back, left, right, u, v);
  const width = (v: number) => len(sub(right(v), left(v)));
  return {
    base,
    chord: () => len(sub(back(0.5), front(0.5))),
    half: (u, v, pressure) => {
      const w = width(v);
      const s = u * w;
      const rad = r(v);
      const sleeve = Math.max(sleeveAt(s, rad), sleeveAt(w - s, rad));
      const air =
        L.half * section(v) * Math.sin(Math.PI * u) ** 0.6 * pillow(u, L.cells) * pressure;
      return Math.max(sleeve * (1 - (0.6 * Math.max(0, v - 0.85)) / 0.15), air);
    },
    camber: (u, v, pressure) => L.camber * Math.sin(Math.PI * v) * Math.sin(Math.PI * u) * pressure,
    sign: 1,
    cells: L.cells,
  };
}

/** The flutter of slack cloth at (u, v) on wing `k`, m along its normal:
 * nothing taut, a few centimetres of rippled fold at rest. */
function flutter(k: number, u: number, v: number, slack: number, t: number): number {
  if (slack <= 0) return 0;
  const edge = Math.sin(Math.PI * Math.min(1, v * 1.2)) * Math.min(1, u * 3);
  return (
    slack *
    0.018 *
    edge *
    Math.sin(u * 19 + v * 7 + k * 1.7 + t * 2.1) *
    Math.sin(v * 11 - u * 5 + k)
  );
}

/** THE WINGS LOFTED off pose `p`, written into `out` (xyz a vertex, in the
 * pose's frame) in `layout`'s order. */
export function shapeSuit(
  out: Float32Array,
  layout: SuitLayout,
  p: SkierPose,
  drive: SuitDrive,
): void {
  const pressure = Math.max(0, Math.min(1, drive.pressure));
  const slack = 1 - Math.min(1, pressure * 1.6);
  WINGS.forEach((w, k) => {
    const g = gridOf(w);
    const wing = w === "leg" ? legWing(p) : armWing(p, w === "armL" ? 0 : 1, drive.unzip);
    const s = layout.start[w];
    const e = 1 / (4 * g.nu);
    for (let j = 0; j <= g.nv; j++) {
      const v = j / g.nv;
      for (let i = 0; i <= g.nu; i++) {
        const u = i / g.nu;
        const P = wing.base(u, v);
        // The patch's normal off its own tangents, turned to face his back.
        const du = sub(wing.base(Math.min(1, u + e), v), wing.base(Math.max(0, u - e), v));
        const dv = sub(wing.base(u, Math.min(1, v + e)), wing.base(u, Math.max(0, v - e)));
        const n = scale(
          norm({
            x: du.y * dv.z - du.z * dv.y,
            y: du.z * dv.x - du.x * dv.z,
            z: du.x * dv.y - du.y * dv.x,
          }),
          wing.sign,
        );
        const mid = wing.camber(u, v, pressure) + flutter(k, u, v, slack, drive.t);
        const h = wing.half(u, v, pressure);
        const top = add(P, scale(n, mid + h));
        const bottom = add(P, scale(n, mid - h));
        const ot = (s.top + j * (g.nu + 1) + i) * 3;
        const ob = (s.bottom + j * (g.nu + 1) + i) * 3;
        out[ot] = top.x;
        out[ot + 1] = top.y;
        out[ot + 2] = top.z;
        out[ob] = bottom.x;
        out[ob + 1] = bottom.y;
        out[ob + 2] = bottom.z;
      }
    }
  });
}

/** THE SUIT'S MEASURES at pose `p`, m, for the suite and the lab: the span
 * from glove to glove, an arm wing's chord at its root (the armpit to the
 * knee's end of the root) and at the wrist, the leg wing's length and its
 * width across the heels. */
export function suitMeasures(p: SkierPose): {
  span: number;
  rootChord: number;
  tipChord: number;
  legLength: number;
  legWidth: number;
} {
  const arm = armWing(p, 1);
  const leg = legWing(p);
  const width = len(sub(leg.base(1, 0.82), leg.base(0, 0.82)));
  return {
    span: len(sub(p.hands[1], p.hands[0])) + 2 * 0.05,
    rootChord: len(sub(arm.base(0, 1), arm.base(0, 0))),
    tipChord: arm.chord(1),
    legLength: leg.chord(0.5),
    legWidth: width,
  };
}
