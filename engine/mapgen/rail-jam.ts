// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R40 — A RAIL JAM'S SET BUILT OVER A BUILT MAP. A line of its own cut
// straight down the face, as R37's jump and R39's course are
// (`straight-venue.ts`): a start platform, a short DROP-IN, a DECK at a
// gentle pitch with a ROW OF FEATURES side by side on it — boxes and rails
// of every shape a park's set is built from — and a run-out at the foot.
// A rider picks one feature a hit; the jam (`jam.ts`) stands him back on
// the platform for the next.
//
// THE SPEED IS DESIGNED: the drop-in's length is found (a bisection over
// one number) so the rule's skier, stood up from the start gate, meets the
// features at their design speed — the same point mass down the profile
// as R39's approaches, the compressions' cost measured off the engine's
// skier. The set is the same on every map: only WHERE it stands is the
// map's.
//
// THE FEATURES are published as the map's `jibs` (`jib.ts` rides them).
// Everything is a pure function of the map, drawing nothing from any
// stream — no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { RAIL_JAM_RULE } from "./trick-rules.ts";
import { createPen, gradeVenue, jumpHeightAt, originalOf } from "./straight-venue.ts";
import type { Checkpoint, Jib, Level, RailJamCourse, Spawn, Vec3 } from "./types.ts";

const R = RAIL_JAM_RULE;
const G = 9.81;
const RAD = Math.PI / 180;

/** THE SET'S PROFILE: its height every `dx` m of plan from the platform's
 * back, where the start gate, the deck, the features and the finish line
 * stand, and where it ends, m of plan. */
export type RailJamProfile = {
  dx: number;
  y: Float64Array;
  gate: number;
  deck: number;
  features: number;
  finish: number;
  end: number;
};

/** The profile with a drop-in `drop` m long. */
function draw(drop: number): RailJamProfile {
  const pen = createPen(0.25);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  pen.bend(R.dropIn * RAD, R.roll);
  pen.straight(Math.max(0, drop), R.dropIn * RAD);
  pen.bend(R.deck.grade * RAD, R.toFlat);
  const deck = pen.x;
  pen.straight(R.deck.length, R.deck.grade * RAD);
  pen.bend(R.outrun.grade * RAD, R.round);
  const outrun = pen.x;
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  return {
    dx: pen.dx,
    y: Float64Array.from(pen.ys),
    gate,
    deck,
    features: deck + R.deck.lead,
    finish: outrun + R.finish,
    end: pen.x,
  };
}

/** THE SPEED the rule's skier carries from the start gate to `to` m of
 * plan down `p`, stood up — the point mass of R39's approaches. */
export function railJamSpeed(p: RailJamProfile, to: number): number {
  const S = R.skier;
  const dx = p.dx;
  const k = (0.5 * S.air * S.stand) / S.mass;
  let v = 1.5;
  let was = 0;
  for (let x = p.gate; x < to; x += dx) {
    const dy = jumpHeightAt(p, x) - jumpHeightAt(p, x + dx);
    const ds = hypot(dx, dy);
    v = Math.sqrt(Math.max(0.01, v * v + 2 * ds * ((G * (dy - S.friction * dx)) / ds - k * v * v)));
    const fall = Math.atan2(dy, dx);
    if (x > p.gate && fall < was) v *= Math.exp(-0.5 * S.compression * (was - fall));
    was = fall;
  }
  return v;
}

let designed: RailJamProfile | null = null;

/** THE SET (R40), as designed: the drop-in found so the skier meets the
 * features at their design speed. The same on every map. */
export function railJamProfile(): RailJamProfile {
  if (designed) return designed;
  let lo = 0;
  let hi: number = R.approachMost;
  for (let it = 0; it < 36; it++) {
    const mid = (lo + hi) / 2;
    const p = draw(mid);
    if (railJamSpeed(p, p.features) < R.speed) lo = mid;
    else hi = mid;
  }
  designed = draw(hi);
  return designed;
}

const built = new WeakMap<Level, Level>();

/** R40 — A RAIL JAM'S SET BUILT OVER `level`: the set shaped down the face
 * as the map's own `track`, its checkpoints the start gate and the finish
 * line, its spawn the start platform and its features the map's `jibs`. A
 * map already carrying the set is that map; one carrying any other course
 * is built over the map under it. Kept per map; the set keeps the day and
 * the sky of the map it was built over. */
export function setRailJam(level: Level): Level {
  if (level.railJam) return level;
  const original = originalOf(level);
  let set = built.get(original);
  if (!set) {
    set = buildOver(original);
    built.set(original, set);
  }
  return set.sun === level.sun && set.weather === level.weather
    ? set
    : { ...set, sun: level.sun, weather: level.weather };
}

/** The set over `original`, a map with no course on it. */
function buildOver(original: Level): Level {
  const p = railJamProfile();
  const { fit, fx, fz, rx, rz, yAt, level } = gradeVenue(original, p, R, () => []);
  // THE FEATURES: each row's legs drawn from its near end, `entry` over
  // the deck, each leg falling (or rising) at its own grade.
  const jibs: Jib[] = R.jibs.map((row, i) => {
    const across = row.line * R.lines;
    const at = (d: number, y: number): Vec3 => ({
      x: fit.x + fx * d + rx * across,
      y,
      z: fit.z + fz * d + rz * across,
    });
    let d = p.features;
    let y = yAt(d) + R.entry;
    const points: Vec3[] = [at(d, y)];
    for (const leg of row.legs) {
      d += leg.plan;
      y -= leg.plan * Math.tan(leg.fall * RAD);
      points.push(at(d, y));
    }
    return {
      id: `F${i + 1}`,
      section: i + 1,
      line: row.line,
      kind: row.kind,
      shape: row.shape,
      points,
      width: row.kind === "rail" ? R.railWidth : R.boxWidth,
    };
  });
  const across = (s: number, width: number): Checkpoint => ({
    x: fit.x + fx * s,
    z: fit.z + fz * s,
    y: yAt(s),
    heading: fit.heading,
    width,
    s,
    colour: "red",
  });
  const start = across(p.gate, 6);
  const finish = across(p.finish, R.width);
  const spawn: Spawn = {
    x: fit.x + fx * (p.gate - 2),
    z: fit.z + fz * (p.gate - 2),
    heading: fit.heading,
  };
  const course: RailJamCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    deck: p.deck,
    features: p.features,
    lines: R.lines,
    width: R.width,
    speed: R.speed,
  };
  return {
    ...level,
    checkpoints: [start, finish],
    spawn,
    grid: [spawn],
    jibs,
    railJam: course,
  };
}
