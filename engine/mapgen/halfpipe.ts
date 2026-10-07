// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R39 — A HALFPIPE BUILT OVER A BUILT MAP. A line of its own cut straight
// down the face, as R37's jump and R38's course are (`straight-venue.ts`): a
// start platform, a roll onto the pipe's pitch, the pitch held the pipe's
// whole length and a run-out at its foot — graded, groomed and cleared —
// and the PIPE cut into the pitch as an analytic surface (`pipe.ts`): the
// flat, the transitions, the verts, the decks, its walls growing over the
// mouth and shrinking over the tail.
//
// The pipe is the same on every map: only WHERE it stands is the map's.
// Everything is a pure function of the map, drawing nothing from any
// stream — no digest moves.

import { HALFPIPE_RULE } from "./trick-rules.ts";
import { createPen, gradeVenue, originalOf, type VenueProfile } from "./straight-venue.ts";
import { pipeSection, withPipe, type PipeFrame } from "./pipe.ts";
import type { Checkpoint, HalfpipeCourse, Level, Spawn } from "./types.ts";

const R = HALFPIPE_RULE;
const RAD = Math.PI / 180;

/** THE VENUE'S PROFILE: its height every `dx` m of plan from the
 * platform's back, where the start gate, the pipe's mouth, its full walls,
 * its tail's end and the finish line stand, m of plan. */
export type HalfpipeProfile = VenueProfile & {
  gate: number;
  mouth: number;
  from: number;
  to: number;
  tail: number;
};

let designed: HalfpipeProfile | null = null;

/** THE PROFILE (R39), the same on every map. */
export function halfpipeProfile(): HalfpipeProfile {
  if (designed) return designed;
  const pen = createPen(0.25);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  pen.bend(R.pitch * RAD, R.roll);
  pen.straight(R.lead, R.pitch * RAD);
  const mouth = pen.x;
  pen.straight(R.mouth + R.length + R.tail, R.pitch * RAD);
  const tail = pen.x;
  pen.bend(R.outrun.grade * RAD, R.round);
  const outrun = pen.x;
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  designed = {
    dx: pen.dx,
    y: Float64Array.from(pen.ys),
    gate,
    mouth,
    from: mouth + R.mouth,
    to: mouth + R.mouth + R.length,
    tail,
    finish: outrun + R.finish,
    end: pen.x,
  };
  return designed;
}

const built = new WeakMap<Level, Level>();

/** R39 — A HALFPIPE BUILT OVER `level`: the venue shaped down the face as
 * the map's own `track`, its checkpoints the start gate and the finish
 * line, its spawn the start platform, and the pipe's surface answered by
 * the map's ground. A map already carrying a pipe is that map; one
 * carrying any other course is built over the map under it. Kept per map;
 * the pipe keeps the day and the sky of the map it was built over. */
export function setHalfpipe(level: Level): Level {
  if (level.halfpipe) return level;
  const original = originalOf(level);
  let pipe = built.get(original);
  if (!pipe) {
    pipe = buildOver(original);
    built.set(original, pipe);
  }
  return pipe.sun === level.sun && pipe.weather === level.weather
    ? pipe
    : { ...pipe, sun: level.sun, weather: level.weather };
}

/** The pipe over `original`, a map with no course on it. */
function buildOver(original: Level): Level {
  const p = halfpipeProfile();
  const { fit, fx, fz, yAt, level } = gradeVenue(original, p, R, () => []);
  const frame: PipeFrame = {
    x: fit.x,
    z: fit.z,
    heading: fit.heading,
    mouth: p.mouth,
    from: p.from,
    to: p.to,
    end: p.tail,
    section: pipeSection(R),
    yAt,
  };
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
  const course: HalfpipeCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    pipe: frame,
  };
  // The pipe's snow is groomed hard from deck to deck — the grade already
  // packed the venue's width.
  return {
    ...withPipe(level, frame),
    checkpoints: [start, finish],
    spawn,
    grid: [spawn],
    halfpipe: course,
  };
}
