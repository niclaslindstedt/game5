// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R42 — A MOGULS COURSE BUILT OVER A BUILT MAP. A line of its own cut
// straight down the face, as R37's jump and R41's pipe are
// (`straight-venue.ts`): a start platform, a roll onto the course's pitch,
// the pitch held down the course with its two AIR BUMPS drawn into it, and
// a finish area at its foot — graded, groomed and cleared — and the MOGUL
// TRACK laid down its middle as an analytic surface (`mogul-field.ts`).
//
// The field is built as LINES (`MogulLine`): one here, down the venue's
// line; a dual moguls course is the same profile with two lines on one
// rhythm, so `mogulsProfile` and `mogulsField` take the lines they are
// asked for.
//
// The course is the same on every map: only WHERE it stands is the map's.
// Everything is a pure function of the map, drawing nothing from any
// stream — no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { MOGULS_RULE } from "./trick-rules.ts";
import { createPen, gradeVenue, originalOf, type VenueProfile } from "./straight-venue.ts";
import { withMoguls, type MogulField, type MogulLine } from "./mogul-field.ts";
import type { Checkpoint, Kicker, Level, MogulsCourse, Spawn } from "./types.ts";

const RAD = Math.PI / 180;

/** A moguls course's rule (R42's numbers, or a dual course's). */
export type MogulsRule = typeof MOGULS_RULE;

/** ONE AIR BUMP drawn into the profile: its kicker's foot and lip and the
 * end of its landing, m of plan along the line. */
export type AirBump = { foot: number; lip: number; landed: number };

/** THE VENUE'S PROFILE: its height every `dx` m of plan from the
 * platform's back, where the start gate, the pitch's foot and the finish
 * line stand, the two air bumps, m of plan, and the course's length down
 * the slope from the gate to the finish line, m. */
export type MogulsProfile = VenueProfile & {
  gate: number;
  foot: number;
  airs: AirBump[];
  length: number;
};

const designed = new Map<MogulsRule, MogulsProfile>();

/** THE PROFILE (R42), the same on every map. */
export function mogulsProfile(R: MogulsRule = MOGULS_RULE): MogulsProfile {
  const hit = designed.get(R);
  if (hit) return hit;
  const pen = createPen(0.25);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  const from = pen.ys.length - 1;
  // The arc down the slope from the gate, m.
  let done = from;
  let down = 0;
  const walk = (): number => {
    for (; done + 1 < pen.ys.length; done++) {
      down += hypot(pen.dx, pen.ys[done + 1] - pen.ys[done]);
    }
    return down;
  };
  const pitch = R.pitch * RAD;
  pen.bend(pitch, R.roll);
  const airs: AirBump[] = [];
  const kick = R.air.kick * RAD;
  const radius = R.air.height / (1 - Math.cos(kick));
  const lead = radius * Math.sin(kick);
  for (const at of R.air.at) {
    // The pitch to the kicker's foot, then the kicker curved up off the
    // pitch to the take-off, then back down to the pitch behind the lip.
    while (walk() < at * R.course - lead) pen.step(pitch);
    const foot = pen.x;
    const x0 = pen.x;
    const y0 = pen.y;
    pen.bend(pitch - kick, radius);
    const lip = pen.x;
    while (pen.y > y0 - Math.tan(pitch) * (pen.x - x0)) pen.step(R.air.back * RAD);
    airs.push({ foot, lip, landed: lip + R.air.landing * Math.cos(pitch) });
  }
  while (walk() < R.course) pen.step(pitch);
  const foot = pen.x;
  pen.bend(R.outrun.grade * RAD, R.round);
  const finish = pen.x;
  const length = walk();
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  const p: MogulsProfile = {
    dx: pen.dx,
    y: Float64Array.from(pen.ys),
    gate,
    foot,
    airs,
    length,
    finish,
    end: pen.x,
  };
  designed.set(R, p);
  return p;
}

/** THE MOGUL FIELD on a venue of profile `p` stood on its line (`x`, `z`,
 * `heading`, the height `yAt`), down `lines` (one line down the middle when
 * left out): from the rule's first mogul below the gate to the pitch's
 * foot, clear of every air bump's run-in and landing. */
export function mogulsField(
  p: MogulsProfile,
  frame: { x: number; z: number; heading: number; yAt: (d: number) => number },
  R: MogulsRule = MOGULS_RULE,
  lines: readonly MogulLine[] = [{ offset: 0, width: R.track }],
): MogulField {
  const plan = Math.cos(R.pitch * RAD);
  return {
    ...frame,
    half: R.width / 2,
    end: p.end,
    lines,
    from: p.gate + R.bumps.first * plan,
    to: p.foot,
    gaps: p.airs.map((a) => [a.foot - R.air.runIn * plan, a.landed] as const),
    spacing: R.bumps.spacing * plan,
    height: R.bumps.height,
    wave: R.bumps.wave,
    ease: R.bumps.ease,
  };
}

const built = new WeakMap<Level, Level>();

/** R42 — A MOGULS COURSE BUILT OVER `level`: the venue shaped down the face
 * as the map's own `track`, its checkpoints the start gate, the control
 * gates and the finish line, its spawn the start platform, its air bumps
 * the map's kickers (`A1`, `A2`) and the moguls answered by the map's
 * ground. A map already carrying one is that map; one carrying any other
 * course is built over the map under it. Kept per map; the course keeps
 * the day and the sky of the map it was built over. */
export function setMoguls(level: Level): Level {
  if (level.moguls) return level;
  const original = originalOf(level);
  let course = built.get(original);
  if (!course) {
    course = buildOver(original);
    built.set(original, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** The course over `original`, a map with no course on it. */
function buildOver(original: Level): Level {
  const R = MOGULS_RULE;
  const p = mogulsProfile(R);
  const { fit, fx, fz, yAt, level } = gradeVenue(original, p, R, (v): Kicker[] =>
    p.airs.map((a, i) => ({
      id: `A${i + 1}`,
      x: v.fit.x + v.fx * a.lip,
      z: v.fit.z + v.fz * a.lip,
      y: v.yAt(a.lip),
      heading: v.fit.heading,
      height: R.air.height,
      ramp: a.lip - a.foot,
      landing: a.landed - a.lip,
      width: R.track,
      onTrack: true,
      s: a.lip,
      trick: true,
    })),
  );
  const field = mogulsField(p, { x: fit.x, z: fit.z, heading: fit.heading, yAt }, R);
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
  const gates: Checkpoint[] = [];
  for (let k = 1; k <= R.gates; k++) {
    const s = p.gate + ((p.finish - p.gate) * k) / (R.gates + 1);
    gates.push({ ...across(s, R.track), colour: k % 2 === 1 ? "blue" : "red" });
  }
  const spawn: Spawn = {
    x: fit.x + fx * (p.gate - 2),
    z: fit.z + fz * (p.gate - 2),
    heading: fit.heading,
  };
  const course: MogulsCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    gates: gates.map((g) => g.s),
    vertical: start.y - finish.y,
    length: p.length,
    airs: p.airs,
    airHeight: R.air.height,
    pitch: R.pitch * RAD,
    field,
  };
  return {
    ...withMoguls(level, field),
    checkpoints: [start, ...gates, finish],
    spawn,
    grid: [spawn],
    moguls: course,
  };
}
