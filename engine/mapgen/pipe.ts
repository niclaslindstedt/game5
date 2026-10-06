// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE'S SURFACE (R41) — a U cut down a pitch, as a function of
// the plan rather than a grid. A 6.7 m wall on a transition of ~7 m radius
// rising to 83° is far finer than the 2 m grid a map is baked on: on the
// grid the vert would be a step and the transition three facets. So the
// pipe is ANALYTIC — its CROSS-SECTION (a flat bottom, each wall a
// circular transition and a straight vert to the coping, a deck outside)
// extruded down the venue's line under the venue's own profile — and a
// map carrying one answers `groundAt` and `normalAt` off it inside its
// footprint, the grid everywhere else.
//
// AND `normalNear`: the snow's normal at the point of the surface NEAREST a
// point in space. On a slope a skier can stand on, the snow under his
// centre of mass is the snow under his feet; on a wall standing at 80° it
// is not — straight down from a body stood off the vert is the transition
// metres below him. The physics reads the ground under a skier through
// `normalNear` where a map has it (`snow-normal.ts`), so a skier on the
// wall stands on the wall.
//
// Pure, drawing nothing from any stream.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { HALFPIPE_RULE } from "./trick-rules.ts";
import type { Level, Vec3 } from "./types.ts";

const RAD = Math.PI / 180;

/** THE CROSS-SECTION, m and rad: the coping's distance from the centre
 * line (`half`), the flat's half-width, the transition's radius, where it
 * ends across (`arcEnd`) and how high it has risen there (`arcTop`), the
 * vert's angle and the wall's height. */
export type PipeSection = {
  half: number;
  flat: number;
  radius: number;
  arcEnd: number;
  arcTop: number;
  vert: number;
  height: number;
  deck: number;
};

/** The section R41's numbers give. */
export function pipeSection(R: typeof HALFPIPE_RULE = HALFPIPE_RULE): PipeSection {
  const vert = R.vert * RAD;
  const radius = (R.height - R.vertHeight) / (1 - Math.cos(vert));
  const half = R.span / 2;
  const flat = half - radius * Math.sin(vert) - R.vertHeight / Math.tan(vert);
  return {
    half,
    flat,
    radius,
    arcEnd: flat + radius * Math.sin(vert),
    arcTop: R.height - R.vertHeight,
    vert,
    height: R.height,
    deck: R.deck,
  };
}

/** The wall's height over the flat `u` m across from the centre line (its
 * absolute value is read), m, and its slope there, m/m — the coping's
 * height and a level deck past it. */
export function wallAt(s: PipeSection, across: number): { h: number; dh: number } {
  const u = Math.abs(across);
  if (u <= s.flat) return { h: 0, dh: 0 };
  if (u < s.arcEnd) {
    const a = u - s.flat;
    const r = Math.sqrt(Math.max(1e-9, s.radius * s.radius - a * a));
    return { h: s.radius - r, dh: a / r };
  }
  if (u < s.half) {
    const t = Math.tan(s.vert);
    return { h: s.arcTop + (u - s.arcEnd) * t, dh: t };
  }
  return { h: s.height, dh: 0 };
}

/** THE PIPE ON A MAP: its line (the frame's origin is the venue's start, at
 * `heading`), the profile's height and slope along it, and where the mouth
 * starts, the full walls run and the tail ends, m along the line. */
export type PipeFrame = {
  x: number;
  z: number;
  heading: number;
  /** Where the walls begin to grow, stand full, start shrinking and end. */
  mouth: number;
  from: number;
  to: number;
  end: number;
  section: PipeSection;
  /** The venue's height `d` m along its line (the deck's), m. */
  yAt: (d: number) => number;
};

/** How deep a share of the walls stands `d` m along the pipe: nothing
 * outside it, growing over the mouth and shrinking over the tail. */
export function wallShare(p: PipeFrame, d: number): number {
  return smoothstep(p.mouth, p.from, d) * (1 - smoothstep(p.to, p.end, d));
}

/** A point of the plan in the pipe's frame: `along` the line and `across`
 * it (right of the line positive), m. */
export function pipeCoords(p: PipeFrame, x: number, z: number): { along: number; across: number } {
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const dx = x - p.x;
  const dz = z - p.z;
  return { along: dx * fx + dz * fz, across: dx * fz - dz * fx };
}

/** Whether `(x, z)` is on the pipe's own surface (the walls and the decks). */
function inside(p: PipeFrame, along: number, across: number): boolean {
  return along > p.mouth && along < p.end && Math.abs(across) < p.section.half + p.section.deck;
}

/** The pipe's surface height at a point of its frame, m. */
function heightIn(p: PipeFrame, along: number, across: number): number {
  const s = p.section;
  const k = wallShare(p, along);
  return p.yAt(along) - (s.height - wallAt(s, across).h) * k;
}

/** The surface's normal at a point of its frame, into `out`. */
function normalIn(p: PipeFrame, along: number, across: number, out: Vec3): void {
  const s = p.section;
  const e = 0.05;
  const k = wallShare(p, along);
  const dk = (wallShare(p, along + e) - wallShare(p, along - e)) / (2 * e);
  const w = wallAt(s, across);
  const depth = s.height - w.h;
  // ∂y/∂along and ∂y/∂across.
  const ga = (p.yAt(along + e) - p.yAt(along - e)) / (2 * e) - depth * dk;
  const gc = w.dh * Math.sign(across) * k;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  // across = dx·fz − dz·fx: its gradient in the plan is (fz, −fx).
  const gx = ga * fx + gc * fz;
  const gz = ga * fz - gc * fx;
  const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
  out.x = -gx * inv;
  out.y = inv;
  out.z = -gz * inv;
}

/** WHERE ON THE SECTION a point stands nearest: the `across` of the
 * surface point nearest `(across, w)` — `w` its height over the flat —
 * on the flat, the transition, the vert or the deck. */
export function nearestAcross(s: PipeSection, across: number, w: number): number {
  const sign = across < 0 ? -1 : 1;
  const u = Math.abs(across);
  let best = u;
  let bestD = Math.abs(w - wallAt(s, u).h);
  const consider = (cu: number): void => {
    const ch = wallAt(s, cu).h;
    const d = hypot(cu - u, ch - w);
    if (d < bestD) {
      bestD = d;
      best = cu;
    }
  };
  // The transition: the circle about (flat, radius), its arc from straight
  // below its centre to the vert.
  const cx = s.flat;
  const cy = s.radius;
  const ang = Math.atan2(u - cx, cy - w);
  consider(cx + s.radius * Math.sin(clamp(ang, 0, s.vert)));
  // The vert: the segment from the arc's end to the coping.
  const tx = Math.cos(s.vert);
  const ty = Math.sin(s.vert);
  const len = (s.height - s.arcTop) / ty;
  const t = clamp((u - s.arcEnd) * tx + (w - s.arcTop) * ty, 0, len);
  consider(s.arcEnd + t * tx);
  // The flat and the deck.
  consider(Math.min(u, s.flat));
  consider(Math.max(u, s.half));
  return sign * best;
}

/** THE MAP WITH ITS PIPE: `groundAt` and `normalAt` answered off the
 * pipe's surface inside its footprint, `normalNear` beside them, and the
 * grid under it cut to the same surface (each node at the lowest the
 * surface stands within a cell of it — never above the snow the physics
 * rides, so the drawn ground is under the pipe's own mesh). */
export function withPipe(level: Level, p: PipeFrame): Level {
  const base = level;
  const field = level.ground;
  const ground = { ...field, data: new Float32Array(field.data) };
  const s = p.section;
  const reach = s.half + s.deck;
  for (let r = 0; r < field.rows; r++) {
    for (let c = 0; c < field.cols; c++) {
      const x = field.originX + c * field.cell;
      const z = field.originZ + r * field.cell;
      const { along, across } = pipeCoords(p, x, z);
      if (along < p.mouth - field.cell || along > p.end + field.cell) continue;
      if (Math.abs(across) > reach + field.cell) continue;
      let low = Infinity;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const a = along + i * field.cell * 0.5;
          const b = across + j * field.cell * 0.5;
          if (!inside(p, a, b)) continue;
          low = Math.min(low, heightIn(p, a, b));
        }
      }
      const i = r * field.cols + c;
      if (low < Infinity) ground.data[i] = Math.min(field.data[i], low - 0.15);
    }
  }
  const groundAt = (x: number, z: number): number => {
    const { along, across } = pipeCoords(p, x, z);
    return inside(p, along, across) ? heightIn(p, along, across) : base.groundAt(x, z);
  };
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const { along, across } = pipeCoords(p, x, z);
    if (inside(p, along, across)) normalIn(p, along, across, out);
    else base.normalAt(x, z, out);
  };
  const normalNear = (x: number, y: number, z: number, out: Vec3): void => {
    const { along, across } = pipeCoords(p, x, z);
    const k = wallShare(p, along);
    if (!inside(p, along, across) || k < 0.999) {
      normalAt(x, z, out);
      return;
    }
    const floor = p.yAt(along) - s.height;
    const near = nearestAcross(s, across, y - floor);
    normalIn(p, along, near, out);
  };
  return { ...level, ground, groundAt, normalAt, normalNear, pipe: p };
}
