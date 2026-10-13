// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK AS DRAWN, DECIDED (R44, R45) — three-free and DOM-free, so
// the suite reads it; `bike-trails-view.ts` makes it meshes.
//
// WHY A RIBBON: the engine's surface inside a trail's footprint is an
// analytic one (`withBikeSurface`: the bench, its outslope, the berms, the
// tables, the drops), far finer than the 2 m grid, and the grid under it is
// cut to just below it — the halfpipe's answer (`pipe-view.ts`). So the
// terrain draws the mountain with a shallow trench along every trail, and
// this lays the TRUE SURFACE over it: a strip a station a metre down every
// trail (half a metre through a jump or a drop), across from shoulder to
// shoulder, each vertex at `level.groundAt` — the very height a tyre
// stands on — and coloured as a lift-served park looks in the photographs:
// the pale crushed-stone gravel of a machine-built flow trail, the dark
// loam of a technical trail and the race line with its two tyre lines worn
// darker, the raw brown earth of a fresh cut or fill on the shoulders,
// faded out into the grass where the shoulder meets the mountain.
//
// What stands proud of the tread is drawn as its own pieces: every ROCK of
// a rock garden a faceted boulder sunk to the surface's bump, every ROOT a
// dark limb across the tread, and the race line's TAPE — stakes down both
// edges every `race.tape` metres with the red and white tape strung between
// them at hip height.

import { BIKE_PARK_RULES, type BikeTrail, type Level } from "@engine";

const B = BIKE_PARK_RULES;

/** The paint, sRGB 0..1 (the view takes it to linear light). */
export const BIKE_LOOK = {
  /** A flow trail's crushed stone, and a technical trail's loam. */
  gravel: [0.6, 0.58, 0.54],
  loam: [0.5, 0.41, 0.31],
  /** The tyre lines worn into each: how much darker, and how far either
   * side of the centre they run, as a share of the half-width. */
  worn: { gravel: 0.86, loam: 0.8, at: 0.35, spread: 0.22 },
  /** The fresh-cut earth of a shoulder. */
  soil: [0.52, 0.45, 0.35],
  /** How much the tone wanders, ±. */
  tone: 0.06,
  /** The ribbon is lifted this far over the surface, m. */
  lift: 0.015,
  /** A shoulder vertex whose surface weight is under `from` is wholly
   * transparent, over `to` wholly opaque. */
  fade: { from: 0.05, to: 0.45 },
  rock: [0.47, 0.46, 0.43],
  root: [0.27, 0.19, 0.12],
  tape: {
    red: [0.78, 0.1, 0.06],
    white: [0.92, 0.92, 0.9],
    low: 0.82,
    high: 0.9,
    post: 1.0,
    out: 0.5,
  },
} as const;

export type BikeRibbon = { pos: number[]; col: number[]; uv: number[]; idx: number[] };
export type BikeRock = { x: number; y: number; z: number; r: number; h: number; spin: number };
export type BikeRoot = { x: number; y: number; z: number; r: number; len: number; heading: number };
export type BikePost = { x: number; y: number; z: number };

export type BikeTrailPlan = {
  ribbon: BikeRibbon;
  rocks: BikeRock[];
  roots: BikeRoot[];
  posts: BikePost[];
  tape: BikeRibbon;
};

/** A hash of a point to 0..1. */
function hash(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** The station of `trail` at arc `s`, interpolated: where it is and which
 * way it goes. */
function stationAt(
  trail: BikeTrail,
  s: number,
): { x: number; z: number; heading: number; width: number } {
  const p = trail.points;
  let i = Math.max(0, Math.min(p.length - 2, Math.floor(s)));
  while (i > 0 && p[i].s > s) i--;
  while (i < p.length - 2 && p[i + 1].s < s) i++;
  const a = p[i];
  const b = p[i + 1];
  const t = Math.max(0, Math.min(1, (s - a.s) / Math.max(1e-6, b.s - a.s)));
  let dh = b.heading - a.heading;
  dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    heading: a.heading + dh * t,
    width: a.width + (b.width - a.width) * t,
  };
}

/** The arcs the ribbon is cut at down `trail`: every metre, every half
 * metre through a feature with an edge in it. */
function arcsOf(trail: BikeTrail): number[] {
  const fine = trail.features.filter(
    (f) =>
      f.kind === "table" ||
      f.kind === "gap" ||
      f.kind === "drop" ||
      f.kind === "stepdown" ||
      f.kind === "rocks",
  );
  const out: number[] = [];
  for (let s = 0; s < trail.length; s += 1) {
    out.push(s);
    if (fine.some((f) => s + 0.5 >= f.from - 1 && s + 0.5 <= f.to + 1)) out.push(s + 0.5);
  }
  out.push(trail.length);
  return out;
}

/** THE BIKE PARK of `level` as drawn, or null off one. */
export function planBikeTrails(level: Level): BikeTrailPlan | null {
  const park = level.bikePark;
  if (!park) return null;
  const L = BIKE_LOOK;
  const ribbon: BikeRibbon = { pos: [], col: [], uv: [], idx: [] };
  const tape: BikeRibbon = { pos: [], col: [], uv: [], idx: [] };
  const rocks: BikeRock[] = [];
  const roots: BikeRoot[] = [];
  const posts: BikePost[] = [];
  for (const trail of park.trails) {
    const tread = trail.tread === "gravel" ? L.gravel : L.loam;
    const worn = trail.tread === "gravel" ? L.worn.gravel : L.worn.loam;
    const arcs = arcsOf(trail);
    // Across, left to right: the shoulder's outer edge and two stops in
    // it, the tread's edge, its inside and the same on the right — each a
    // share of the tread's half-width and of the shoulder's reach.
    const across: readonly (readonly [number, number])[] = [
      [-1, -1],
      [-1, -0.66],
      [-1, -0.33],
      [-1, 0],
      [-0.5, 0],
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.33],
      [1, 0.66],
      [1, 1],
    ];
    const cols = across.length;
    let rows = 0;
    const first = ribbon.pos.length / 3;
    for (const s of arcs) {
      const st = stationAt(trail, s);
      const half = st.width / 2;
      const p = trail.points[Math.max(0, Math.min(trail.points.length - 1, Math.round(s)))];
      // The shoulder reaches as far as the engine eases it into the ground.
      const cut = Math.abs(p.y - p.ground);
      const reach = Math.min(B.bench.widest, B.bench.shoulder + B.bench.bank * cut) + 0.3;
      const rx = Math.cos(st.heading);
      const rz = -Math.sin(st.heading);
      for (const [h, o] of across) {
        const a = h * half + Math.sign(h) * o * reach;
        const x = st.x + rx * a;
        const z = st.z + rz * a;
        ribbon.pos.push(x, level.groundAt(x, z) + L.lift, z);
        ribbon.uv.push(a, s);
        const n = 1 + (hash(x, z) * 2 - 1) * L.tone;
        let rgb: readonly number[];
        let alpha = 1;
        if (o === 0) {
          const k = Math.abs(Math.abs(h) - L.worn.at) / L.worn.spread;
          const m = k < 1 ? worn + (1 - worn) * k * k : 1;
          rgb = tread.map((v) => v * m);
        } else {
          // How much of the trail's surface this vertex stands on, as the
          // engine eases the shoulder (`bikeHit`'s weight).
          const w = 1 - o * o * (3 - 2 * o);
          alpha = Math.max(0, Math.min(1, (w - L.fade.from) / (L.fade.to - L.fade.from)));
          // The cut's raw earth, the more of it the deeper the cut.
          const g = Math.min(1, cut / 1.5);
          rgb = L.soil.map((v, i) => v * (0.85 + 0.15 * g) + tread[i] * 0.15 * (1 - g));
        }
        ribbon.col.push(rgb[0] * n, rgb[1] * n, rgb[2] * n, alpha);
      }
      rows++;
    }
    for (let r = 0; r + 1 < rows; r++) {
      for (let c = 0; c + 1 < cols; c++) {
        const i0 = first + r * cols + c;
        const i1 = i0 + 1;
        const i2 = i0 + cols;
        const i3 = i2 + 1;
        ribbon.idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
    for (const f of trail.features) {
      for (const piece of f.pieces ?? []) {
        const st = stationAt(trail, f.from + piece.u);
        const rx = Math.cos(st.heading);
        const rz = -Math.sin(st.heading);
        const x = st.x + rx * piece.a;
        const z = st.z + rz * piece.a;
        const y = level.groundAt(x, z);
        if (f.kind === "rocks") {
          rocks.push({
            x,
            y: y - piece.h * 0.92,
            z,
            r: piece.r,
            h: piece.h,
            spin: hash(z, x) * Math.PI * 2,
          });
        } else if (f.kind === "roots") {
          // The root's axis in the trail's (along, across) frame is
          // (sin ang, cos ang); in the world, along · fwd + across · right.
          const ang = piece.ang ?? 0;
          const fx = Math.sin(st.heading);
          const fz = Math.cos(st.heading);
          const wx = fx * Math.sin(ang) + rx * Math.cos(ang);
          const wz = fz * Math.sin(ang) + rz * Math.cos(ang);
          roots.push({
            x,
            y: y - piece.r * 0.4,
            z,
            r: piece.r,
            len: piece.len ?? 2,
            heading: Math.atan2(wx, wz),
          });
        }
      }
    }
    if (trail.kind === "race") taped(level, trail, posts, tape);
  }
  return { ribbon, rocks, roots, posts, tape };
}

/** The race line's stakes and tape, both edges from its start to its end. */
function taped(level: Level, trail: BikeTrail, posts: BikePost[], tape: BikeRibbon): void {
  const T = BIKE_LOOK.tape;
  for (const side of [-1, 1]) {
    let prev: { x: number; y: number; z: number } | null = null;
    let n = 0;
    for (let s = trail.start; s <= trail.length - B.tail / 2; s += B.race.tape) {
      const st = stationAt(trail, s);
      const a = side * (st.width / 2 + T.out);
      const x = st.x + Math.cos(st.heading) * a;
      const z = st.z - Math.sin(st.heading) * a;
      const y = level.groundAt(x, z);
      posts.push({ x, y, z });
      if (prev) {
        const base = tape.pos.length / 3;
        tape.pos.push(prev.x, prev.y + T.low, prev.z, prev.x, prev.y + T.high, prev.z);
        tape.pos.push(x, y + T.low, z, x, y + T.high, z);
        const c = n % 2 === 0 ? T.red : T.white;
        for (let k = 0; k < 4; k++) tape.col.push(c[0], c[1], c[2], 1);
        tape.uv.push(0, 0, 0, 1, 1, 0, 1, 1);
        tape.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        n++;
      }
      prev = { x, y, z };
    }
  }
}
