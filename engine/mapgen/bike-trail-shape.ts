// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — A TRAIL'S SHAPE: the BENCH cut into the hillside down a walked line
// and the FEATURES shaped into it, as functions of where on the trail a
// point is — its arc `s` and its offset `a` across the tread — so the
// surface the bike rides (`bike-surface.ts`), the lab and the analyzer all
// read one shape.
//
//   - THE BENCH: the ground under the line eased over `bench.window`
//     metres, then held to fall between nothing and the grade's steepest
//     over every metre — once walking down (filling where the ground falls
//     too fast) and once walking up (cutting) and the two met halfway, so
//     the cut and the fill are shared and the bench never climbs;
//   - ACROSS: the tread tipped `bench.outslope` toward the downhill side so
//     water leaves it, and through a bermed turn banked toward the turn's
//     outside instead;
//   - THE FEATURES, each a height over the bench along its own arc: a
//     roller's or a dip's half cosine, a table's take-off (its slope rising
//     evenly to the lip's angle), deck and landing (a half cosine at the
//     landing's angle), a gap the same with its middle open, a drop's
//     approach built up gentler than the bench falls to a face, a
//     step-down's the same with a kicked lip, rocks as domes and roots as
//     ridges set in the tread.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE_PARK_RULES as B } from "./bike-park-rules.ts";
import type { BikeFeature, BikeTrailPoint } from "./bike-park-types.ts";
import type { WalkPoint } from "./bike-trail-walk.ts";
import { angleDiff } from "./bike-trail-walk.ts";
import type { Level } from "./types.ts";

const RAD = Math.PI / 180;

/** THE BENCH down a walked line: its stations, a metre apart, with the
 * bench's height, the tread's width (`width`, widened through each bermed
 * turn by `widen(i)`) and the hillside's downhill side. `steepest` m/m. */
export function benchOf(
  level: Level,
  walk: readonly WalkPoint[],
  width: number,
  steepest: number,
): BikeTrailPoint[] {
  const n = walk.length;
  const ground = new Float64Array(n);
  for (let i = 0; i < n; i++) ground[i] = level.groundAt(walk[i].x, walk[i].z);
  // Eased over the window: a running mean.
  const half = Math.max(1, Math.round(B.bench.window / 2));
  const eased = new Float64Array(n);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n - 1, i + half);
    while (hi < b) sum += ground[++hi];
    while (lo < a) sum -= ground[lo++];
    eased[i] = sum / (hi - lo + 1);
  }
  // The ends stay on the ground they start and finish on.
  eased[0] = ground[0];
  eased[n - 1] = ground[n - 1];
  const s = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    s[i] = s[i - 1] + hypot(walk[i].x - walk[i - 1].x, walk[i].z - walk[i - 1].z);
  }
  const fwd = new Float64Array(n);
  const back = new Float64Array(n);
  fwd[0] = eased[0];
  for (let i = 1; i < n; i++) {
    const ds = s[i] - s[i - 1];
    fwd[i] = clamp(eased[i], fwd[i - 1] - steepest * ds, fwd[i - 1]);
  }
  back[n - 1] = eased[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    const ds = s[i + 1] - s[i];
    back[i] = clamp(eased[i], back[i + 1], back[i + 1] + steepest * ds);
  }
  const out: BikeTrailPoint[] = [];
  const nrm = { x: 0, y: 1, z: 0 };
  for (let i = 0; i < n; i++) {
    const w = walk[i];
    const prev = walk[Math.max(0, i - 1)];
    const next = walk[Math.min(n - 1, i + 1)];
    const heading = Math.atan2(next.x - prev.x, next.z - prev.z) || w.heading;
    level.normalAt(w.x, w.z, nrm);
    // The right of the way: (cos h, −sin h); downhill where the normal leans.
    const right = nrm.x * Math.cos(heading) - nrm.z * Math.sin(heading);
    out.push({
      x: w.x,
      z: w.z,
      y: (fwd[i] + back[i]) / 2,
      s: s[i],
      heading,
      width,
      downhill: right >= 0 ? 1 : -1,
      ground: ground[i],
    });
  }
  return out;
}

/** A turn on a walked line: from station `from` to station `to`, how far
 * it turns (rad, signed: + to the right) and its radius, m. */
export type Turn = { from: number; to: number; angle: number; radius: number };

/** The TURNS of a walked line: each run of stations the walk marked
 * turning, merged across a gap of a few metres. */
export function turnsOf(walk: readonly WalkPoint[], points: readonly BikeTrailPoint[]): Turn[] {
  const out: Turn[] = [];
  let i = 0;
  const n = walk.length;
  while (i < n) {
    if (!walk[i].turning) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && (walk[j + 1].turning || (j + 4 < n && walk[j + 4].turning))) j++;
    let angle = 0;
    for (let k = i + 1; k <= j; k++) angle += angleDiff(points[k - 1].heading, points[k].heading);
    const len = Math.max(1, points[j].s - points[i].s);
    out.push({ from: i, to: j, angle, radius: len / Math.max(0.1, Math.abs(angle)) });
    i = j + 1;
  }
  return out;
}

/** A table's (or a gap's) pieces along its arc, m: the take-off's length,
 * the deck's (the gap's open length), the landing's. */
export function tableParts(f: Pick<BikeFeature, "height" | "angle" | "land" | "length">): {
  ramp: number;
  deck: number;
  landing: number;
} {
  const H = f.height;
  const ramp = (2 * H) / Math.tan((f.angle ?? 25) * RAD);
  const landing = (Math.PI * H) / (2 * Math.tan((f.land ?? 25) * RAD));
  return { ramp, deck: f.length ?? 0, landing };
}

/** How long a drop's built approach is for a bench falling `grade` m/m:
 * the approach rises at no more than `rise` of the bench's fall. */
export function dropApproach(height: number, grade: number): number {
  return Math.max(4, height / (DROP.rise * Math.max(0.03, grade)));
}

/** A drop's approach rises at this share of the bench's fall; its face
 * is `face` m across; a step-down's lip is kicked `kick` m higher. */
export const DROP = { rise: 0.6, face: 0.35, kick: 0.35 } as const;

/** How much higher a step-down's lip is kicked than its approach, m. */
export function kickOf(f: Pick<BikeFeature, "kind" | "height">): number {
  return f.kind === "stepdown" ? Math.min(DROP.kick, 0.4 * f.height) : 0;
}

/** The height a FEATURE adds to the bench at arc `s` and offset `a` across
 * a tread `half` m wide at that point, m (negative: dug in). */
export function featureHeight(f: BikeFeature, s: number, a: number, half: number): number {
  if (s < f.from - 4 || s > f.to + 4) return 0;
  const u = s - f.from;
  const L = f.to - f.from;
  switch (f.kind) {
    case "roller":
      return u <= 0 || u >= L ? 0 : f.height * 0.5 * (1 - Math.cos((2 * Math.PI * u) / L));
    case "dip":
      return u <= 0 || u >= L ? 0 : -f.height * 0.5 * (1 - Math.cos((2 * Math.PI * u) / L));
    case "table":
    case "gap":
      return tableHeight(f, u);
    case "drop":
    case "stepdown":
      return dropHeight(f, u);
    case "rocks":
    case "roots":
      return pieceHeight(f, u, a);
    case "berm":
      return bermHeight(f, s, a, half);
  }
}

function tableHeight(f: BikeFeature, u: number): number {
  const H = f.height;
  const { ramp, deck, landing } = tableParts(f);
  if (u <= 0) return 0;
  if (u < ramp) return (H * u * u) / (ramp * ramp);
  const v = u - ramp;
  if (f.kind === "table") {
    if (v <= deck) return H;
  } else {
    // THE GAP: the lip's back falls away, the ground open between, the
    // landing's face stood up to its knuckle.
    const back = 0.8;
    const floor = -0.2;
    if (v <= back) return H + (floor - H) * smoothstep(0, back, v);
    if (v <= deck - back) return floor;
    if (v <= deck) return floor + (H - floor) * smoothstep(deck - back, deck, v);
  }
  const w = v - deck;
  if (w >= landing) return 0;
  return H * 0.5 * (1 + Math.cos((Math.PI * w) / landing));
}

function dropHeight(f: BikeFeature, u: number): number {
  const lip = (f.lip ?? f.to) - f.from;
  const kick = kickOf(f);
  const H = f.height - kick;
  if (u <= 0) return 0;
  if (u < lip) {
    // The approach built up evenly, the kick's parabola in its last metres.
    const k = kick > 0 ? (2 * kick) / Math.tan((f.angle ?? 25) * RAD) : 0;
    const base = H * smoothstep(0, lip, u);
    const lift = kick > 0 && u > lip - k ? (kick * (u - (lip - k)) ** 2) / (k * k) : 0;
    return base + lift;
  }
  const v = u - lip;
  if (v < DROP.face) return (H + kick) * (1 - smoothstep(0, DROP.face, v));
  return 0;
}

function pieceHeight(f: BikeFeature, u: number, a: number): number {
  let best = 0;
  for (const p of f.pieces ?? []) {
    if (f.kind === "rocks") {
      const d2 = (u - p.u) ** 2 + (a - p.a) ** 2;
      if (d2 >= p.r * p.r) continue;
      best = Math.max(best, p.h * Math.pow(1 - d2 / (p.r * p.r), 0.6));
    } else {
      // A root: a ridge along its line, `ang` off square across the tread.
      const ca = Math.cos(p.ang ?? 0);
      const sa = Math.sin(p.ang ?? 0);
      const du = u - p.u;
      const da = a - p.a;
      const along = da * ca + du * sa;
      if (Math.abs(along) > (p.len ?? 2) / 2) continue;
      const d = Math.abs(du * ca - da * sa);
      if (d >= p.r) continue;
      best = Math.max(best, p.h * Math.sqrt(1 - (d * d) / (p.r * p.r)));
    }
  }
  return best;
}

/** How far into its berm a point at arc `s` is: 0 outside, 1 in it. */
export function bermWeight(f: BikeFeature, s: number): number {
  const ease = 3;
  return (
    smoothstep(f.from - ease, f.from + ease, s) * (1 - smoothstep(f.to - ease, f.to + ease, s))
  );
}

function bermHeight(f: BikeFeature, s: number, a: number, half: number): number {
  const w = bermWeight(f, s);
  if (w <= 0) return 0;
  const H = f.height;
  const tb = Math.tan((f.angle ?? 35) * RAD);
  // Metres from the inside edge toward the outside one: a turn to the
  // right (`side` +1) banks up on the left.
  const out = (f.side ?? 1) === 1 ? half - a : half + a;
  const c = 2 * half - H / tb;
  const x = out - c;
  const e = 0.35;
  const face = (tb * (x + Math.sqrt(x * x + e * e))) / 2;
  // The outside of the tread at the berm's height and no higher.
  const top = (tb * (2 * half - c + Math.sqrt((2 * half - c) ** 2 + e * e))) / 2;
  return w * Math.min(face, top) * (H / Math.max(1e-6, top));
}
