// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R37 — A BIG AIR JUMP BUILT OVER A BUILT MAP. Not a kicker on the piste: a
// jump of its own, shaped STRAIGHT down the face as a real one is pushed up
// out of a mountain's side — a start platform, a drop-in, a flat, the
// kicker, the table, the knuckle, the landing and a run-out, graded smooth
// and groomed hard, the woods cleared round it.
//
// THE PROFILE IS DESIGNED, then FITTED. It is built against the horizontal
// (a table must be level in absolute terms — the ski cross's lesson), its
// drop-in as long as brings a tucked skier to the lip at the design speed
// (a point mass with the rule's skier, down the profile itself), and its
// LANDING SHAPED by the equivalent fall height: at every point past the
// knuckle the flight that reaches it is worked out back to the take-off
// speed it needs, and the slope there is laid just steeper than that
// flight by what a fall of `bigAir.fall` metres meets the snow at. Whoever
// lands on it — a little slow, a little fast — lands on a slope matched to
// his own flight, until the slope reaches its steepest. The profile is the
// same on every map: only WHERE it stands is the map's.
//
// THE LINE IS SEARCHED, as a speed track's is (R34): every column of the
// face and a few bearings either side of the fall line, every start down
// each, the profile dropped onto the ground there at the height that cuts
// and fills least; the line that cuts and fills least of all and keeps
// clear of the ski area's stations and village is the jump's. Everything
// is a pure function of the map, drawing nothing from any stream — so no
// digest moves and a restart stands on the very jump it left.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { TRICK_RULES, type JumpRule } from "./trick-rules.ts";
import { createPen, gradeVenue, jumpHeightAt, originalOf, shapeLanding } from "./straight-venue.ts";
import type { BigAirCourse, Checkpoint, Kicker, Level, Spawn } from "./types.ts";

export { jumpHeightAt } from "./straight-venue.ts";

const B: JumpRule = TRICK_RULES.bigAir;
const G = 9.81;
const RAD = Math.PI / 180;

/** THE JUMP'S PROFILE: its height every `dx` m of plan from the platform's
 * back (`y`, the lip at 0), and where its parts begin, m of plan. */
export type JumpProfile = {
  dx: number;
  y: Float64Array;
  gate: number;
  foot: number;
  lip: number;
  knuckle: number;
  landing: number;
  outrun: number;
  finish: number;
  end: number;
  /** The lip's height over the flat, m. */
  height: number;
};

/** The profile with a drop-in `run` m long at its full angle, to rule `R`
 * (R37's). */
function shape(run: number, R: JumpRule): JumpProfile {
  const pen = createPen(0.25);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  pen.bend(R.dropIn * RAD, R.roll);
  pen.straight(run, R.dropIn * RAD);
  pen.bend(0, R.toFlat);
  pen.straight(R.flat, 0);
  const foot = pen.x;
  const yFoot = pen.y;
  const kick = R.kick * RAD;
  pen.bend(-kick, R.kicker);
  const lip = pen.x;
  const yLip = pen.y;
  pen.straight(R.table, 0);
  const knuckle = pen.x;
  // THE LANDING, shaped by the equivalent fall height until a skier
  // `bigAir.fast` times the design speed has come down on it.
  shapeLanding(pen, R, lip, yLip);
  const landing = pen.x;
  pen.bend(R.outrun.grade * RAD, R.round);
  const outrun = pen.x;
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  const y0 = Float64Array.from(pen.ys, (v) => v - yLip);
  return {
    dx: pen.dx,
    y: y0,
    gate,
    foot,
    lip,
    knuckle,
    landing,
    outrun,
    finish: outrun + R.finish,
    end: pen.x,
    height: yLip - yFoot,
  };
}

/** The speed, m/s, the rule's skier carries tucked from the start gate to
 * the lip of `p`. */
export function lipSpeed(
  p: Pick<JumpProfile, "dx" | "y" | "gate" | "lip" | "finish" | "end">,
  R: Pick<JumpRule, "skier"> = B,
): number {
  const S = R.skier;
  const k = (0.5 * S.air * S.tuck) / S.mass;
  const dx = p.dx;
  let v = 1.5;
  let was = 0;
  for (let x = p.gate; x < p.lip; x += dx) {
    const dy = jumpHeightAt(p, x) - jumpHeightAt(p, x + dx);
    const ds = hypot(dx, dy);
    v = Math.sqrt(Math.max(0.01, v * v + 2 * ds * ((G * (dy - S.friction * dx)) / ds - k * v * v)));
    // A COMPRESSION: the snow turning him upward costs his speed's square
    // its share for every radian it turns him (`skier.compression`).
    const fall = Math.atan2(dy, dx);
    if (x > p.gate && fall < was) v *= Math.exp(-0.5 * S.compression * (was - fall));
    was = fall;
  }
  return v;
}

const designed = new Map<JumpRule, JumpProfile>();

/** THE JUMP (R37), as designed: the drop-in's length
 * found so the rule's skier reaches the lip at its design speed. The same
 * on every map. */
export function jumpProfile(R: JumpRule = B): JumpProfile {
  const had = designed.get(R);
  if (had) return had;
  let lo = 2;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lipSpeed(shape(mid, R), R) < R.speed) lo = mid;
    else hi = mid;
  }
  const p = shape(hi, R);
  designed.set(R, p);
  return p;
}

const built = new WeakMap<Level, Level>();

/** A jump to rule `R` over `level`, kept per map. */
function setJump(level: Level, R: JumpRule): Level {
  if (level.bigAir) return level;
  const original = originalOf(level);
  let jump = built.get(original);
  if (!jump) {
    jump = buildOver(original, R);
    built.set(original, jump);
  }
  return jump.sun === level.sun && jump.weather === level.weather
    ? jump
    : { ...jump, sun: level.sun, weather: level.weather };
}

/** R37 — A BIG AIR JUMP BUILT OVER `level`: the jump shaped down the face
 * as the map's own `track`, its checkpoints the start gate and the finish
 * line, its spawn the start platform, its kicker the map's one kicker. A
 * map already carrying a jump is that map; one carrying any other course
 * is built over the map under it. Kept per map, so a restart or a replay
 * stands on the jump the renderer already built. The jump keeps the day
 * and the sky of the map it was built over. */
export function setBigAir(level: Level): Level {
  return setJump(level, B);
}

/** The jump over `original`, a map with no course on it. */
function buildOver(original: Level, R: JumpRule): Level {
  const p = jumpProfile(R);
  // THE KICKER, as every reader of a kicker knows one: its lip, its ramp
  // and its built landing — what arms a trick thrown up its ramp
  // (`strokes.ts`).
  const v = gradeVenue(original, p, R, ({ fit, fx, fz, yAt }): Kicker[] => [
    {
      id: "BA",
      x: fit.x + fx * p.lip,
      z: fit.z + fz * p.lip,
      y: yAt(p.lip),
      heading: fit.heading,
      height: p.height,
      ramp: p.lip - p.foot,
      landing: p.outrun - p.lip,
      width: R.width,
      onTrack: true,
      s: p.lip,
      trick: true,
      shape: { deck: p.knuckle - p.lip, fall: p.landing - p.knuckle, dig: 0 },
    },
  ]);
  const { fit, fx, fz, yAt, level } = v;
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
  const course: BigAirCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    foot: p.foot,
    lip: p.lip,
    knuckle: p.knuckle,
    landing: p.landing,
    outrun: p.outrun,
    height: p.height,
    kick: R.kick * RAD,
    speed: R.speed,
    width: R.width,
  };
  return { ...level, checkpoints: [start, finish], spawn, grid: [spawn], bigAir: course };
}
