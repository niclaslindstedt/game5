// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R39 — A SLOPESTYLE COURSE BUILT OVER A BUILT MAP. A line of its own cut
// straight down the face, as R37's jump is (`straight-venue.ts`): a start
// platform, then SIX SECTIONS in a row — three RAIL sections, each a deck
// at a gentle pitch with a rail and a box side by side on it, the two
// LINES a skier picks between, and three JUMPS sized up the ladder, each
// a kicker, a table and a landing shaped to the equivalent fall height —
// and a finish area at the foot.
//
// THE SPEED IS DESIGNED, section by section. Nothing between the features
// lets a skier skate, so each section is met down an APPROACH whose length
// is found (a bisection over one number: a drop that long, or — negative —
// a level run that long to bleed a landing's speed off) so the rule's
// skier arrives at its design speed: stood up at a rail section's jibs,
// tucked off a jump's lip. The skier is a point mass down the profile
// itself, as R37's drop-in is sized, with the compressions' cost measured
// off the engine's skier. Every section's approach is found with the ones
// before it already fixed, so the course is the same on every map: only
// WHERE it stands is the map's.
//
// THE JIBS are published beside the course (`Level.jibs`), each a polyline
// in the world a skier slides on (`jib.ts`); the jumps' kickers among the
// map's kickers (`S4`–`S6`), so a trick set up their ramps is thrown off
// their lips (`strokes.ts`). Everything is a pure function of the map,
// drawing nothing from any stream — no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { SLOPESTYLE_RULE, type JibRow } from "./trick-rules.ts";
import {
  createPen,
  gradeVenue,
  jumpHeightAt,
  originalOf,
  shapeLanding,
  type Pen,
} from "./straight-venue.ts";
import type {
  Checkpoint,
  Jib,
  Kicker,
  Level,
  SlopeSection,
  SlopestyleCourse,
  Spawn,
  Vec3,
} from "./types.ts";

const R = SLOPESTYLE_RULE;
const G = 9.81;
const RAD = Math.PI / 180;

/** THE COURSE'S PROFILE: its height every `dx` m of plan from the
 * platform's back, where the start gate and the finish line stand, and
 * its sections with every arc a section owns, m of plan. */
export type SlopeProfile = {
  dx: number;
  y: Float64Array;
  gate: number;
  finish: number;
  end: number;
  sections: SlopeSection[];
  /** Each rail section's deck: where it starts, m of plan. */
  decks: number[];
  /** Each jump's kicker foot, m of plan, and its lip's height over it, m. */
  feet: number[];
  heights: number[];
  /** Where a flight off each jump's lip at its design speed comes down, m
   * of plan. */
  touches: number[];
};

/** Where a flight off a lip at `lip` m of plan and `yLip` of height, at
 * `v` m/s and `a` rad up, meets the profile drawn so far, m of plan. */
function touchdown(pen: Pen, lip: number, yLip: number, v: number, a: number): number {
  const c = 2 * v * v * Math.cos(a) ** 2;
  for (let i = Math.ceil(lip / pen.dx) + 1; i < pen.ys.length; i++) {
    const lx = i * pen.dx - lip;
    if (yLip + Math.tan(a) * lx - (G * lx * lx) / c <= pen.ys[i]) return i * pen.dx;
  }
  return pen.x;
}

/** Where an approach's speed is read and how the skier stands on it. */
type Mark = { from: number; to: number; tucked: boolean };

/** The profile with each section's approach `ps[i]` m long (a drop; a
 * level run where negative). */
function draw(ps: readonly number[]): { pen: Pen; p: SlopeProfile; marks: Mark[] } {
  const pen = createPen(0.25);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  const sections: SlopeSection[] = [];
  const marks: Mark[] = [];
  const decks: number[] = [];
  const feet: number[] = [];
  const heights: number[] = [];
  const touches: number[] = [];
  const approach = (p: number, onto: number): void => {
    if (p >= 0) {
      pen.bend(R.dropIn * RAD, R.roll);
      pen.straight(p, R.dropIn * RAD);
    } else {
      pen.bend(0, R.roll);
      pen.straight(-p, 0);
    }
    pen.bend(onto, R.toFlat);
  };
  for (let i = 0; i < 6; i++) {
    const from = pen.x;
    const p = ps[i] ?? 0;
    if (i < 3) {
      approach(p, R.rails.grade * RAD);
      const deck = pen.x;
      decks.push(deck);
      marks.push({ from, to: deck + R.rails.lead, tucked: false });
      pen.straight(R.rails.deck, R.rails.grade * RAD);
      sections.push({ kind: "rail", from, to: pen.x, speed: R.rails.speed });
      continue;
    }
    const J = R.jumps[i - 3];
    approach(p, 0);
    pen.straight(R.flat, 0);
    const foot = pen.x;
    const yFoot = pen.y;
    pen.bend(-J.kick * RAD, J.kicker);
    const lip = pen.x;
    const yLip = pen.y;
    feet.push(foot);
    heights.push(yLip - yFoot);
    marks.push({ from, to: lip, tucked: true });
    pen.straight(J.table, 0);
    const knuckle = pen.x;
    shapeLanding(pen, { ...R, ...J }, lip, yLip);
    touches.push(touchdown(pen, lip, yLip, J.speed, J.kick * RAD * R.launch));
    const last = i === 5;
    const grade = last ? R.outrun.grade : R.between.grade;
    pen.bend(grade * RAD, R.round);
    if (!last) pen.straight(R.between.length, grade * RAD);
    sections.push({ kind: "jump", from, to: pen.x, lip, knuckle, speed: J.speed });
  }
  const outrun = pen.x;
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  const p: SlopeProfile = {
    dx: pen.dx,
    y: Float64Array.from(pen.ys),
    gate,
    finish: outrun + R.finish,
    end: pen.x,
    sections,
    decks,
    feet,
    heights,
    touches,
  };
  return { pen, p, marks };
}

/** THE SPEED the rule's skier carries from the start gate to `to` m of
 * plan down `p` — stood up, and tucked down every approach to a jump
 * (`marks`) — off the same point mass as R37's drop-in. */
export function courseSpeed(p: SlopeProfile, marks: readonly Mark[], to: number): number {
  const S = R.skier;
  const dx = p.dx;
  let v = 1.5;
  let was = 0;
  const lips = p.sections.filter((s) => s.kind === "jump").map((s) => s.lip ?? Infinity);
  for (let x = p.gate; x < to; x += dx) {
    const tucked = marks.some((m) => m.tucked && x >= m.from && x < m.to);
    const k = (0.5 * S.air * (tucked ? S.tuck : S.stand)) / S.mass;
    const dy = jumpHeightAt(p, x) - jumpHeightAt(p, x + dx);
    const ds = hypot(dx, dy);
    // Off a lip and down to its landing he FLIES: no snow under him, his
    // speed's square growing by the height he falls.
    const flying = p.touches.some((t, j) => x >= lips[j] && x < t);
    if (flying) {
      v = Math.sqrt(v * v + 2 * G * dy);
      was = Math.atan2(dy, dx);
      continue;
    }
    v = Math.sqrt(Math.max(0.01, v * v + 2 * ds * ((G * (dy - S.friction * dx)) / ds - k * v * v)));
    // A COMPRESSION: the snow turning him upward costs his speed's square
    // its share for every radian it turns him (`skier.compression`).
    const fall = Math.atan2(dy, dx);
    if (x > p.gate && fall < was) v *= Math.exp(-0.5 * S.compression * (was - fall));
    was = fall;
  }
  return v;
}

let designed: SlopeProfile | null = null;

/** THE COURSE (R39), as designed: each section's approach found in turn so
 * the skier meets it at its design speed. The same on every map. */
export function slopestyleProfile(): SlopeProfile {
  if (designed) return designed;
  const ps = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    let lo: number = -R.levelMost;
    let hi: number = R.approachMost;
    for (let it = 0; it < 36; it++) {
      ps[i] = (lo + hi) / 2;
      const { p, marks } = draw(ps);
      const m = marks[i];
      if (courseSpeed(p, marks, m.to) < p.sections[i].speed) lo = ps[i];
      else hi = ps[i];
    }
    ps[i] = hi;
  }
  designed = draw(ps).p;
  return designed;
}

const built = new WeakMap<Level, Level>();

/** R39 — A SLOPESTYLE COURSE BUILT OVER `level`: the course shaped down the
 * face as the map's own `track`, its checkpoints the start gate and the
 * finish line, its spawn the start platform, its jumps' kickers among the
 * map's and its rails and boxes the map's `jibs`. A map already carrying
 * the course is that map; one carrying any other course is built over the
 * map under it. Kept per map; the course keeps the day and the sky of the
 * map it was built over. */
export function setSlopestyle(level: Level): Level {
  if (level.slopestyle) return level;
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
  const p = slopestyleProfile();
  const v = gradeVenue(original, p, R, ({ fit, fx, fz, yAt }): Kicker[] =>
    p.sections
      .filter((s) => s.kind === "jump")
      .map((s, j) => {
        const lip = s.lip ?? 0;
        const J = R.jumps[j];
        return {
          id: `S${j + 4}`,
          x: fit.x + fx * lip,
          z: fit.z + fz * lip,
          y: yAt(lip),
          heading: fit.heading,
          height: p.heights[j],
          ramp: lip - p.feet[j],
          landing: s.to - lip,
          width: R.width,
          onTrack: true,
          s: lip,
          trick: true,
          shape: { deck: J.table, fall: s.to - (s.knuckle ?? lip), dig: 0 },
        };
      }),
  );
  const { fit, fx, fz, rx, rz, yAt, level } = v;
  // THE JIBS: each row's legs drawn from its near end, `entry` over the
  // deck, a level leg holding its height while the deck falls away.
  const jibs: Jib[] = [];
  for (let k = 0; k < 3; k++) {
    for (const row of R.jibs[k] as readonly JibRow[]) {
      const at = (d: number, y: number): Vec3 => {
        const across = row.line * R.rails.lines;
        return { x: fit.x + fx * d + rx * across, y, z: fit.z + fz * d + rz * across };
      };
      let d = p.decks[k] + R.rails.lead;
      let y = yAt(d) + R.rails.entry;
      const points: Vec3[] = [at(d, y)];
      row.legs.forEach((leg, i) => {
        const flat =
          (row.shape === "flatDown" && i === 0) || (row.shape === "downFlatDown" && i === 1);
        d += leg;
        y = flat ? y : y - leg * Math.tan(R.rails.grade * RAD);
        points.push(at(d, y));
      });
      jibs.push({
        id: `J${k + 1}${row.line < 0 ? "L" : "R"}`,
        section: k + 1,
        line: row.line,
        kind: row.kind,
        shape: row.shape,
        points,
        width: row.kind === "rail" ? R.railWidth : R.boxWidth,
      });
    }
  }
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
  const course: SlopestyleCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    sections: p.sections,
    lines: R.rails.lines,
    width: R.width,
  };
  return {
    ...level,
    checkpoints: [start, finish],
    spawn,
    grid: [spawn],
    jibs,
    slopestyle: course,
  };
}
