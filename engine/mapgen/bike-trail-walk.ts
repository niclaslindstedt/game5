// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — A TRAIL WALKED DOWN THE FACE. A trail crew lays a bike trail by
// walking it: across the fall line at the grade the trail is to hold, back
// across at the end of a leg in a turn through the fall line, and so down
// the mountain in switchbacks — straighter where the hillside is gentle,
// and straight home at the bottom. This is that walk, a metre at a time
// over the map's own ground:
//
//   - ON A LEG the heading is the fall line's turned `θ` either side, where
//     the ground falls at the leg's grade (`cos θ = grade / hillside`) —
//     its grade the trail's `target`, never more than its `half` share of
//     the hillside's — eased toward it at `walk.steer` rad a metre, with a
//     slow wander off it so a leg is never ruled straight;
//   - A LEG ENDS at its dealt length, at its corridor's edge (a band either
//     side of a line from the head toward the end, narrowing as it nears
//     the end), or where the ground ahead turns it back (`blocked`);
//   - A TURN is an arc of the dealt radius from one side of the fall line
//     to the other, through it;
//   - HOME: near enough the end (in height or in plan) and with ground on
//     the way no steeper than `finish.grade`, the walk is drawn straight to
//     it.
//
// Pure: a function of the map, what it must keep off and the slot's own
// dealt numbers (its `Rng`, the park's stream).

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { BIKE_PARK_RULES as B } from "./bike-park-rules.ts";
import type { Level } from "./types.ts";

const W = B.walk;
/** The bends tried round a post ahead, rad. */
const BENDS = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9] as const;

/** What a walk is asked to do. */
export type WalkSlot = {
  /** Where it starts and which way it leaves. */
  head: { x: number; z: number; heading: number };
  /** Where it ends. */
  end: { x: number; z: number; y: number };
  /** The grade its legs are walked at, and their share of the hillside's. */
  target: number;
  half: number;
  /** A leg's length, a turn's radius and the corridor's half-width, m. */
  leg: readonly [number, number];
  radius: readonly [number, number];
  corridor: number;
  /** The corridor's axis offset off the line head → end, m (positive to
   * the right looking down it). */
  offset: number;
  /** Which way across the fall line the first leg goes. */
  side: 1 | -1;
  /** How far a leg's heading wanders off its ideal, rad. */
  wander: number;
  /** A technical trail's turns follow the ground more than a flow trail's:
   * how hard a leg steers to its ideal, rad/m. */
  steer: number;
  /** The straight home falls no steeper than this, m/m. */
  home: number;
  /** A turn is made only where the hillside falls no steeper than this
   * over its whole arc, m/m. */
  turnHill: number;
};

/** Why the last walk that failed did (for the lab's trace). */
export let walkFailure = "";
let turnWhy = "";

/** One station of a walked line. */
export type WalkPoint = { x: number; z: number; heading: number; turning: boolean };

/** What the ground ahead of a walker turns it back from. */
export type Keep = {
  /** True where a trail may not run. */
  blocked(x: number, z: number): boolean;
  /** True where another trail runs within `walk.apart` going the same way
   * (`dx`, `dz` the walker's way). */
  crowded(x: number, z: number, dx: number, dz: number): boolean;
};

/** The angle `b − a` folded into (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** The fall line at (x, z): its heading and the hillside's grade, m/m. */
export function fallAt(level: Level, x: number, z: number): { heading: number; grade: number } {
  const e = 5;
  const gx = (level.groundAt(x + e, z) - level.groundAt(x - e, z)) / (2 * e);
  const gz = (level.groundAt(x, z + e) - level.groundAt(x, z - e)) / (2 * e);
  return { heading: Math.atan2(-gx, -gz), grade: hypot(gx, gz) };
}

const dealt = (rng: Rng, [lo, hi]: readonly [number, number]): number =>
  lo + rng.next() * (hi - lo);

/** WALK a trail for `slot` over `level`'s ground, keeping off `keep` — its
 * stations a metre apart, or null where it never reaches its end. */
export function walkTrail(
  level: Level,
  slot: WalkSlot,
  keep: Keep,
  rng: Rng,
  longest: number = B.park.longest,
): WalkPoint[] | null {
  const F = B.finish;
  const ds = W.step;
  const out: WalkPoint[] = [];
  let x = slot.head.x;
  let z = slot.head.z;
  let h = slot.head.heading;
  let side = slot.side;
  let mode: "lead" | "leg" | "turn" | "home" = "lead";
  let legLen = dealt(rng, slot.leg);
  let legDone = 0;
  let radius = dealt(rng, slot.radius);
  let bounces = 0;
  let skirt = 0;
  // The corridor's axis: from the head toward the end.
  const ax = slot.end.x - slot.head.x;
  const az = slot.end.z - slot.head.z;
  const axLen = Math.max(1, hypot(ax, az));
  const ux = ax / axLen;
  const uz = az / axLen;
  // The wander: a slow sine off the seed of the slot.
  const phase = rng.next() * Math.PI * 2;
  const phase2 = rng.next() * Math.PI * 2;
  const lead = 10;
  const top = level.groundAt(x, z);
  for (let s = 0; s <= longest; s += ds) {
    out.push({ x, z, heading: h, turning: mode === "turn" });
    const ex = slot.end.x - x;
    const ez = slot.end.z - z;
    const dEnd = hypot(ex, ez);
    if (dEnd < F.within) {
      out.push({ x: slot.end.x, z: slot.end.z, heading: h, turning: false });
      return out;
    }
    const here = level.groundAt(x, z);
    const fall = fallAt(level, x, z);
    // THE GRADE HELD: the trail's target, eased down where the turns so
    // far have taken it lower than its target says it should be and up
    // where it lags, so its mean comes out at its target.
    const owed = slot.target * s - (top - here);
    const want = slot.target + (W.hold.gain * owed) / W.hold.over;
    const gt = Math.min(
      clamp(want, slot.target * W.hold.least, slot.target * W.hold.most),
      slot.half * fall.grade,
    );
    const theta = fall.grade > gt + 1e-6 ? Math.acos(gt / fall.grade) : 0;
    if (mode !== "home" && mode !== "lead") {
      const dy = here - slot.end.y;
      if (dy < F.reach.height || dEnd < F.reach.plan) {
        if (
          dy >= -1 &&
          dy / Math.max(1, dEnd) <= slot.home &&
          clearHome(level, keep, x, z, slot.end, slot.home)
        ) {
          mode = "home";
        }
      }
    }
    if (mode === "home") {
      const want = Math.atan2(ex, ez);
      h += clamp(angleDiff(h, want), -ds / radius, ds / radius);
    } else if (mode === "lead") {
      if (s >= lead) mode = "leg";
    } else if (mode === "leg") {
      const wobble =
        slot.wander *
        (Math.sin((s / W.wander.length) * Math.PI * 2 + phase) +
          0.5 * Math.sin((s / (W.wander.length * 0.37)) * Math.PI * 2 + phase2));
      // Skirting what it could not turn in, it holds the contour.
      const ideal =
        skirt > 0 ? fall.heading + (side * Math.PI) / 2 : fall.heading + side * theta + wobble;
      const rate = skirt > 0 ? W.skirt.steer : slot.steer;
      h += clamp(angleDiff(h, ideal), -rate * ds, rate * ds);
      legDone += ds;
      // The corridor: its centre eases onto the end's line, its width with it.
      const px = x - slot.head.x;
      const pz = z - slot.head.z;
      const t = clamp((px * ux + pz * uz) / axLen, 0, 1);
      const lateral = px * uz - pz * ux; // + to the right looking down the axis
      const centre = slot.offset * (1 - t);
      const band = Math.max(20, slot.corridor * Math.min(1, (1 - t) * 3));
      const across = Math.sin(h) * uz - Math.cos(h) * ux; // the way it moves across
      const out_ = lateral - centre;
      const leaving = Math.abs(out_) > band && Math.sign(out_) === Math.sign(across);
      // What is ahead: a post, a cabin or a station's corner is passed by
      // bending round it; anything else, or nothing to bend round it by,
      // turns the leg.
      const rayClear = (hh: number, hard: boolean): boolean => {
        const dx = Math.sin(hh);
        const dz = Math.cos(hh);
        for (let d = 2; d <= W.look; d += 2) {
          const qx = x + dx * d;
          const qz = z + dz * d;
          if (keep.blocked(qx, qz)) return false;
          if (!hard && (keep.crowded(qx, qz, dx, dz) || tooSteep(level, qx, qz))) return false;
        }
        return true;
      };
      let ahead = !rayClear(h, false);
      if (ahead && rayClear(h, true) === false) {
        let bent = false;
        for (const bend of BENDS) {
          if (rayClear(h + bend, false)) {
            h += bend;
            ahead = false;
            bent = true;
            break;
          }
        }
        // Hemmed in, it bends round the post over what is steep.
        for (const bend of bent ? [] : BENDS) {
          if (rayClear(h + bend, true)) {
            h += bend;
            break;
          }
        }
      }
      const due = legDone >= legLen || leaving;
      if (theta > 0.05 && (due || ahead)) {
        const r = dealt(rng, slot.radius);
        // Turned back and forth in place too often (hemmed in between two
        // trails), it skirts on a few metres before it may turn again.
        const settled = legDone >= 8 || bounces < 8;
        if (settled && turnClear(level, keep, x, z, h, side, r, slot.turnHill)) {
          if (legDone < 8) bounces++;
          if (bounces > 40) return fail("bounces");
          mode = "turn";
          radius = r;
          skirt = 0;
        } else if (ahead && skirt < W.skirt.most) {
          // THE SKIRT: along the edge of what it cannot turn in, the
          // contour, until the ground lets it turn.
          skirt += ds;
        } else if (ahead || Math.abs(out_) > band + W.skirt.most) {
          // Nowhere to go on: the turn must be made where it is not clear.
          return fail(
            `${ahead ? "blocked turn" : "corridor"} at ${x.toFixed(0)},${z.toFixed(0)} s ${s} hill ${fall.grade.toFixed(2)} ${turnWhy}`,
          );
        }
      } else if (theta <= 0.05 && ahead && legDone > 6) {
        // Straight down a gentle slope into something: swing away from it.
        side = -side as 1 | -1;
        h += side * 0.6;
        legDone = 0;
      }
    } else {
      // THE TURN: from this side of the fall line to the other, through it.
      h -= (side * ds) / radius;
      const rel = angleDiff(fall.heading, h);
      if (side * rel <= -theta || theta <= 0.05) {
        side = -side as 1 | -1;
        mode = "leg";
        legDone = 0;
        legLen = dealt(rng, slot.leg);
      }
    }
    // The next metres kept clear of a post, whatever the mode.
    if (mode !== "home" && !stepClear(keep, x, z, h)) {
      for (const bend of BENDS) {
        if (stepClear(keep, x, z, h + bend)) {
          h += bend;
          break;
        }
      }
    }
    x += Math.sin(h) * ds;
    z += Math.cos(h) * ds;
    if (keep.blocked(x, z) && mode !== "home") {
      // Walked into what it may not cross (a turn carried it there): give up.
      if (!nearEnd(x, z, slot.end))
        return fail(
          `${mode === "turn" ? "turned into" : mode + " walked into"} ${x.toFixed(0)},${z.toFixed(0)} skirt ${skirt}`,
        );
    }
  }
  return fail("too long");
}

/** Nothing kept off within the next few metres along heading `h`. */
function stepClear(keep: Keep, x: number, z: number, h: number): boolean {
  for (let d = 1; d <= 4; d++)
    if (keep.blocked(x + Math.sin(h) * d, z + Math.cos(h) * d)) return false;
  return true;
}

function fail(why: string): null {
  walkFailure = why;
  return null;
}

/** Whether a turn of radius `r` from (x, z) heading `h` off side `side` of
 * the fall line, through it, crosses nothing kept off and no hillside
 * steeper than `most`. */
function turnClear(
  level: Level,
  keep: Keep,
  x: number,
  z: number,
  h: number,
  side: 1 | -1,
  r: number,
  most: number,
): boolean {
  let px = x;
  let pz = z;
  let ph = h;
  for (let d = 0; d < Math.PI * r * 1.3; d += 1.5) {
    ph -= (side * 1.5) / r;
    px += Math.sin(ph) * 1.5;
    pz += Math.cos(ph) * 1.5;
    if (keep.blocked(px, pz)) return ((turnWhy = `blocked ${d.toFixed(0)}`), false);
    const f = fallAt(level, px, pz);
    if (f.grade > most)
      return ((turnWhy = `steep ${f.grade.toFixed(2)} at ${d.toFixed(0)}`), false);
    const rel = angleDiff(f.heading, ph);
    const theta = f.grade > 1e-6 ? Math.acos(Math.min(1, 0.1 / f.grade)) : 0;
    if (side * rel <= -theta) break;
  }
  return true;
}

function nearEnd(x: number, z: number, end: { x: number; z: number }): boolean {
  return hypot(end.x - x, end.z - z) < B.finish.ring;
}

function tooSteep(level: Level, x: number, z: number): boolean {
  const g = fallAt(level, x, z).grade;
  return g > Math.tan((W.steep * Math.PI) / 180);
}

/** Nothing the walk keeps off between (x, z) and the end. */
function clearHome(
  level: Level,
  keep: Keep,
  x: number,
  z: number,
  end: { x: number; z: number; y: number },
  grade: number,
): boolean {
  const d = hypot(end.x - x, end.z - z);
  const n = Math.ceil(d / 4);
  let prev = level.groundAt(x, z);
  for (let i = 1; i < n; i++) {
    const qx = x + ((end.x - x) * i) / n;
    const qz = z + ((end.z - z) * i) / n;
    if (nearEnd(qx, qz, end)) break;
    if (keep.blocked(qx, qz)) return false;
    const y = level.groundAt(qx, qz);
    if (y > prev + 1 || prev - y > grade * 1.6 * (d / n)) return false;
    prev = y;
  }
  return true;
}
