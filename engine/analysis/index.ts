// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL ANALYSIS — the generator's scoreboard, and its gate.
//
// The search builds to the rule book; this re-checks the FINISHED map
// against the same rule book, rule by rule, reading only what the level
// publishes — the baked grids, the piste, the gates, the trees, the start
// line, the mountain's three numbers. It knows nothing the search knew: not
// the terrain's plan, not which walks were refused, not where the kickers
// were scored. That is the point — a check that could read the plan would
// be checking the plan, and the plan is not what the skier skis.
//
// It is what `generateLevel` asks before it accepts an attempt, what
// `scripts/analyze-level.mjs` prints, and what the tests hold a
// hand-broken level to. A finding names its rule, so the fix is pointed at
// one paragraph of `mapgen/rules.ts`. `ok` is "no errors": a warn is a
// smell the loop reads and nobody has to fix.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { sunAt } from "@niclaslindstedt/oss-game-framework/core/solar";
import { nearestTrackPoint, nearestWithin, outsideHub, trackPointAt } from "../mapgen/query.ts";
import {
  GRADES,
  gradeRow,
  gradeRowOf,
  pisteGradeOf,
  steepestSpan as steepestSpanOf,
  verticalBand,
  type PisteGrade,
} from "../mapgen/grades.ts";
import { LEVEL_RULES as R, withinBand, type Band } from "../mapgen/rules.ts";
import { regionOf, scaleCount } from "../mapgen/regions.ts";
import { startGateArc } from "../mapgen/spawn.ts";
import { declinationOf, sunOffFace } from "../mapgen/sun.ts";
import { WEATHER_KINDS, snowfallBand, snows, sunsetOf, weatherOf } from "../mapgen/weather.ts";
import {
  bendRoom,
  finishFrom,
  minRadius,
  minSeparation,
  tightestBend,
  windowGrades,
} from "../mapgen/track.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { checkCliffs, checkDrops } from "./cliffs.ts";
import { selfCrossings } from "./crossings.ts";
import { checkTrickField } from "./trick-field.ts";
import { analyzeResort, nearestOtherRun, nearestRun } from "./resort.ts";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import { WIDEST, clearance } from "../mapgen/network.ts";

export type Severity = "error" | "warn";

export type Finding = {
  /** The rule the finding is against, `R1`…. */
  rule: string;
  severity: Severity;
  message: string;
};

export type LevelAnalysis = {
  seed: number;
  ok: boolean;
  findings: Finding[];
  /** Numbers worth reading even when nothing is wrong. */
  stats: {
    length: number;
    points: number;
    widthMin: number;
    widthMax: number;
    minRadius: number;
    minSeparation: number;
    /** The steepest fall over a window outside the kickers, m per m. */
    maxGrade: number;
    /** The steepest `colourWindow` of the piste, m per m, and the COLOUR
     * it makes the piste (R8) — the MEASURED grade. */
    steepestSpan: number;
    colour: PisteGrade;
    /** The grade the map was BUILT to (R23), null on one from before the
     * grades. */
    grade: PisteGrade | null;
    /** The piste's drop over its length, m per m. */
    meanGrade: number;
    /** Drops across the piste (R24). */
    drops: number;
    /** The gentlest fall outside the kickers and the finish, m per m. */
    minGrade: number;
    /** The most any window CLIMBS outside the kickers, m per m (0 where
     * the line never does). */
    climb: number;
    /** Steepest the ground falls across the piste's width. */
    maxCrossSlope: number;
    /** The finish straight's fall over its length, m per m. */
    finishGrade: number;
    /** The piste's drop from the start line to the finish, m. */
    drop: number;
    /** The mountain's vertical (R2), m. */
    vertical: number;
    /** The share of the piste's stations heading more than 45° off the
     * fall line: the traverses. */
    traverse: number;
    trackKickers: number;
    offKickers: number;
    /** Cliffs cut into the face (R22). */
    cliffs: number;
    checkpoints: number;
    spacingMin: number;
    spacingMax: number;
    /** The closest two trunks stand, m (R14). */
    treeGap: number;
    /** How many clumps the woods grew (R14). */
    clumps: number;
    trees: number;
    /** Trees standing within R14's corridor. */
    treesOnCorridor: number;
    /** Trees standing above the tree line (R14), and where that line is, m. */
    aboveTreeLine: number;
    treeLineY: number;
    sunElevation: number;
    attempt: number;
    /** Share of the piste lying under a drift's core (R17). */
    drifted: number;
    /** The lowest a windrow's crest stands over the piste's edge anywhere
     * down the line, and the steepest its faces get (R18). */
    bermLow: number;
    bermSteep: number;
  };
};

/** R9 — the least break in grade across a piste kicker's lip that still
 * throws a skier. A kicker's own ramp and landing break at least 2/11 + 2/20
 * at the lip itself; read over three metres either side, a little less. */
const KICK = 0.15;

/** R18 — the share of the lowest crest the two-metre grid is allowed to
 * lose: a bilinear sample between two cells either side of the crest reads
 * a half-sine six metres wide at about three quarters of its height on the
 * flat, and less on a piste falling half a metre a metre, where the cells
 * either side of the read stand a metre apart in height. */
const BERM_LOW = 0.4;

/** R18 — how much steeper than the rule a windrow's face may READ off the
 * grid, m per m, for the same reason: the grid's own kink on a steep
 * traverse, not the windrow's. */
const BERM_STEEP_SLACK = 0.25;

/** R10 — how packed the powder eight metres past the edge may read: the
 * shoulder's fade sampled bilinearly reaches a cell or two past itself. */
const POWDER_SLACK = 0.1;

/** R2 — how far the ground at the published summit may stand off the
 * summit's own height: the ridge's crests over it and the broad rolls
 * either way, at the region's multiples. */
const SUMMIT_SLACK = 2;

/** R5 — a heading this far off the fall line, rad, is a traverse. */
const TRAVERSE = Math.PI / 4;

const fmt = (v: number, digits = 1): string => v.toFixed(digits);
const bandText = (b: Band, unit = ""): string => `${b.min}–${b.max}${unit}`;

/** On a resort's map (R25–R28), how near another run may come to a station
 * of the course before the windrow, the cross-fall and the powder beside
 * it are the junction's and not the piste's, m past the rule's clearance. */
const JUNCTION_SLACK = 12;

/** The most the seam between two runs' surfaces may climb over a grade
 * window where a course runs off one onto the other (R27), m per m: the
 * two are pressed one after the other onto a two-metre grid. */
const JUNCTION_CLIMB = 0.04;

/** R6 — `bendRoom` over the stations a mask leaves in, m. */
function bendRoomOff(pts: readonly TrackPoint[], mask: Uint8Array): number {
  const n = pts.length;
  const k = Math.max(1, Math.round(R.track.turnWindow / 2 / R.track.step));
  const bench = R.track.shoulder.flat + R.berm.width;
  let least = Infinity;
  for (let i = k; i + k < n; i++) {
    if (mask[i - k] || mask[i] || mask[i + k]) continue;
    const a = pts[i - k];
    const b = pts[i];
    const c = pts[i + k];
    const ab = hypot(b.x - a.x, b.z - a.z);
    const bc = hypot(c.x - b.x, c.z - b.z);
    const ca = hypot(a.x - c.x, a.z - c.z);
    const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (area2 < 1e-9) continue;
    least = Math.min(least, (ab * bc * ca) / (2 * area2) - (b.width / 2 + bench));
  }
  return least;
}

/** Re-check a finished level against the rule book. On a resort's map the
 * piste held is the COURSE (R28), and the resort round it is held too
 * (`analyzeResort`) unless `network` is false — the generator reads the
 * network once a resort and every course on its own. */
export function analyzeLevel(level: Level, opts: { network?: boolean } = {}): LevelAnalysis {
  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string): void => {
    findings.push({ rule, severity, message });
  };
  const pts = level.track.points;
  const n = pts.length;
  const L = level.track.length;
  const step = n > 1 ? L / (n - 1) : R.track.step;
  const size = level.size;
  const region = regionOf(level);
  const G = gradeRowOf(level);
  const inside = (x: number, z: number): boolean => x >= 0 && z >= 0 && x <= size && z <= size;
  const resort = level.resort;
  /** Whether another run comes near enough each station of the course that
   * its windrow, its cross-fall and the snow beside it are a junction's. */
  const junction = new Uint8Array(n);
  if (resort) {
    const top = RR.network.shared + JUNCTION_SLACK;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const reach = clearance(p.width, WIDEST) + JUNCTION_SLACK;
      // Off a top station, the runs that left it with the course's first
      // are beside it, its own later ones among them.
      if (nearestOtherRun(level, p.x, p.z, reach, p.s < top) < reach) junction[i] = 1;
    }
  }
  if (resort) {
    // ...and the course's OWN junctions: where it runs off one of its runs
    // onto the next, from where their corridors first touch.
    const byId = new Map(resort.runs.map((r) => [r.id, r]));
    const course = resort.courses.find((c) => c.id === resort.course);
    let at = 0;
    let from = 0;
    for (const id of course?.runs ?? []) {
      const run = byId.get(id);
      if (!run?.into) break;
      // ...to past its end by its end cap: the bench and the windrow round
      // the last station of the run that joins.
      const end =
        run.points[run.points.length - 1].width / 2 + R.track.shoulder.flat + R.berm.width;
      const a = at + run.into.from - from - JUNCTION_SLACK * 2;
      const b = at + run.length - from + end + JUNCTION_SLACK * 2;
      for (let i = 0; i < n; i++) if (pts[i].s >= a && pts[i].s <= b) junction[i] = 1;
      at += run.length - from;
      from = run.into.s;
    }
    // ...and where a ramp off a top comes down onto it (R26): its foot and
    // the ground eased into it either side are the ramp's.
    const feet = resort.lifts.flatMap((l) => l.ramps ?? []);
    const ease = RR.lift.top.ramp.blend;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      for (const r of feet) {
        if (hypot(p.x - r.to.x, p.z - r.to.z) <= r.width / 2 + ease + p.width / 2) junction[i] = 1;
      }
    }
  }
  const atJunction = (i: number): boolean => junction[i] === 1;

  // R1 — everything on the map.
  if (!pts.every((p) => inside(p.x, p.z))) add("R1", "error", "the piste leaves the map");
  if (!level.grid.every((g) => inside(g.x, g.z))) add("R1", "error", "a start slot is off the map");
  if (!level.trees.every((t) => inside(t.x, t.z))) add("R1", "error", "a tree stands off the map");

  // R2 — the mountain: its three numbers published and consistent with the
  // ground, the summit ridge along the top edge and the base on the valley
  // floor.
  const M = level.mountain;
  const vertical = M?.vertical ?? 0;
  if (!M) add("R2", "error", "no mountain published");
  else {
    const band = verticalBand(region, G);
    // A resort's vertical is the massif's (R25), held by `analyzeResort`.
    if (!resort && !withinBand(M.vertical, band, 1e-6)) {
      add("R2", "error", `a vertical of ${fmt(M.vertical, 0)} m (band ${bandText(band, " m")})`);
    }
    if (Math.abs(M.summit.y - M.base.y - M.vertical) > 0.01) {
      add("R2", "error", "the summit does not stand the vertical over the base");
    }
    if (
      !withinBand(M.altitude, region.altitude.base) ||
      !withinBand(M.treeLine, region.altitude.treeLine)
    ) {
      add(
        "R21",
        "error",
        `a base at ${fmt(M.altitude, 0)} m with the tree line at ${fmt(M.treeLine, 0)} m`,
      );
    }
    if (Math.abs(M.base.y - level.groundAt(M.base.x, M.base.z)) > 0.05) {
      add("R2", "error", "the base is not on the ground");
    }
    const slack =
      SUMMIT_SLACK *
      (R.mountain.crests * region.relief.crests + R.face.hills.amplitude.max * region.relief.hills);
    const top = level.groundAt(M.summit.x, M.summit.z);
    if (Math.abs(top - M.summit.y) > slack) {
      add("R2", "error", `the ground at the summit stands ${fmt(top - M.summit.y, 0)} m off it`);
    }
    if (Math.abs(M.summit.z - R.mountain.summit * size) > 1) {
      add("R2", "error", "the summit is not on the summit ridge");
    }
    if (M.base.z < R.mountain.base * size - 1)
      add("R2", "error", "the base is not on the valley floor");
  }

  // R5 — one open descent, in its length band, every station lower down
  // the map than the one before, never crossing itself.
  const lengthBand = resort ? RR.course.length : G.track.length;
  if (!withinBand(L, lengthBand)) {
    add("R5", "error", `the piste is ${fmt(L, 0)} m (band ${bandText(lengthBand, " m")})`);
  }
  if (Math.abs(step - R.track.step) > 0.2) add("R5", "error", `stations every ${fmt(step, 2)} m`);
  let descends = true;
  let traverses = 0;
  for (let i = 0; i < n; i++) {
    // A course is laid again every two metres across its junctions (R28):
    // a hair of slack for the resampling's own rounding.
    if (i > 0 && pts[i].z <= pts[i - 1].z - (resort ? 0.05 : 0)) descends = false;
    if (Math.abs(pts[i].heading) > TRAVERSE) traverses++;
  }
  if (!descends) add("R5", "error", "the piste turns back up the map");
  if (!resort && n > 0 && Math.abs(pts[0].z - R.track.start.z * size) > 1) {
    add("R5", "error", `the start stands ${fmt(pts[0].z, 0)} m down the map`);
  }
  const crossings = selfCrossings(pts);
  if (crossings > 0) add("R5", "error", `the piste crosses itself ${crossings} time(s)`);
  const separation = minSeparation(level.track);
  if (separation < R.track.separation.plan - 0.5) {
    add(
      "R5",
      "error",
      `two stretches pass ${fmt(separation)} m apart (least ${R.track.separation.plan} m)`,
    );
  }
  if (n > 0 && pts[n - 1].z < R.track.finishZ * size - 1) {
    add("R5", "error", "the piste ends above the valley floor");
  }

  // R6 — the bends against the floor their pitch sets (the graded line's
  // own fall), and the room the inside bench has in them.
  const radius = minRadius(level.track);
  const tight = tightestBend(level.track, (i) => pts[i].y);
  if (tight.radius < tight.floor - 0.5) {
    add(
      "R6",
      "error",
      `a bend tightens to ${fmt(tight.radius)} m on a ${fmt(tight.grade * 100)} % pitch ` +
        `at ${fmt(tight.s)} m (least ${fmt(tight.floor)} m there)`,
    );
  }
  // Where a course runs off one run onto the next its bench is the two
  // runs' surfaces together, not a bend's inside.
  const room = resort ? bendRoomOff(pts, junction) : bendRoom(level.track);
  if (room < -0.5) add("R6", "error", `a bend folds the inside bench by ${fmt(-room)} m`);

  // R7 — the width, and the arena.
  let widthMin = Infinity;
  let widthMax = 0;
  for (const p of pts) {
    widthMin = Math.min(widthMin, p.width);
    widthMax = Math.max(widthMax, p.width);
  }
  // The grade's band (R23) on the run; the arena opens to R7's widest.
  const widths = {
    min: resort ? RR.road.width.min : G.track.width.min,
    max: resort ? WIDEST : R.track.width.max,
  };
  if (!withinBand(widthMin, widths) || !withinBand(widthMax, widths)) {
    add(
      "R7",
      "error",
      `width runs ${fmt(widthMin)}–${fmt(widthMax)} m (band ${bandText(widths, " m")})`,
    );
  }
  if (n > 0 && pts[n - 1].width < R.track.width.max - 0.5) {
    add("R7", "error", `the finish arena is only ${fmt(pts[n - 1].width)} m wide`);
  }

  // R8 — the grade along, outside the kickers, the finish's own flat, and
  // the ground across.
  const kickers = level.kickers ?? [];
  const trackKickers = kickers.filter((k) => k.onTrack);
  const drops = (level.cliffs ?? []).filter((c) => c.onTrack);
  // Where R8's bounds do not hold: over a kicker (R9), and over a drop's
  // face and landing (R24) — its shelf is held, since a shelf that climbed
  // would be a climb. `steep` adds the shelf for the ceiling: its top falls
  // into the face.
  const skip = new Uint8Array(n);
  const steep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = pts[i].s;
    for (const k of trackKickers) {
      const u = s - (k.s ?? 0);
      if (u > -k.ramp - 4 && u < k.landing + 4) skip[i] = steep[i] = 1;
    }
    for (const d of drops) {
      const u = s - (d.s ?? 0);
      if (u > -4 && u < d.face + d.landing + 4) skip[i] = 1;
      if (u > -d.shelf - 4 && u < d.face + d.landing + 4) steep[i] = 1;
    }
  }
  const ys = pts.map((p) => p.y);
  const whole = windowGrades(ys, step, skip);
  const maxGrade = windowGrades(ys, step, steep).steepest;
  // THE COLOUR: the steepest hundred metres — a piste is graded on its
  // steepest stretch (`steepestSpan`, a park's kickers aside).
  const steepestSpan = steepestSpanOf(level);
  const colour = pisteGradeOf(steepestSpan);
  // At a junction (R27) the course runs off one run's surface onto
  // another's, pressed apart; the seam is held to `JUNCTION_CLIMB` rather
  // than to the line's own never-climbing.
  const plain = Uint8Array.from(skip);
  for (let i = 0; i < n; i++) if (junction[i]) plain[i] = 1;
  const seams = resort ? windowGrades(ys, step, skip) : whole;
  if (resort && -seams.gentlest > JUNCTION_CLIMB) {
    add("R27", "error", `a junction on the course climbs at ${fmt(-seams.gentlest, 3)}`);
  }
  const climb = Math.max(0, -(resort ? windowGrades(ys, step, plain) : whole).gentlest);
  const ceiling = resort ? R.track.maxGrade : Math.min(R.track.maxGrade, G.track.maxGrade);
  if (maxGrade > ceiling + 0.01) {
    add("R8", "error", `the line falls at ${fmt(maxGrade, 3)} (most ${ceiling})`);
  }
  // R23 — the colour the map was built to is the colour it measures.
  if (level.grade && colour !== level.grade) {
    add(
      "R23",
      "error",
      `a ${level.grade} piste whose steepest ${R.track.colourWindow} m falls at ` +
        `${fmt(steepestSpan * 100, 0)} % — a ${colour}'s`,
    );
  }
  if (climb > 0.005) add("R8", "error", `the line climbs at ${fmt(climb, 3)} outside a kicker`);
  const finishAt = finishFrom(L);
  const held = Uint8Array.from(plain);
  for (let i = 0; i < n; i++) if (pts[i].s > finishAt - R.track.gradeWindow) held[i] = 1;
  const minGrade = windowGrades(ys, step, held).gentlest;
  if (minGrade < R.track.minGrade - 0.01) {
    add("R8", "error", `the line falls only ${fmt(minGrade, 3)} (least ${R.track.minGrade})`);
  }
  const flatFrom = trackPointAt(level, L - R.track.finish);
  const finishGrade = (flatFrom.y - pts[n - 1].y) / R.track.finish;
  if (Math.abs(finishGrade) > 0.03) {
    add("R8", "error", `the finish straight falls at ${fmt(finishGrade, 3)}`);
  }
  let maxCross = 0;
  let worstCross = 0;
  for (let i = 0; i < n; i += 3) {
    const p = pts[i];
    // Not across a drop's face (R24): a wall read across a bend reads its
    // skew, not the camber.
    if (drops.some((d) => Math.abs(p.s - (d.s ?? 0) - d.face / 2) < d.face / 2 + 4)) continue;
    if (atJunction(i)) continue;
    const hw = p.width / 2;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const c = level.groundAt(p.x, p.z);
    for (const side of [-1, 1]) {
      const e = level.groundAt(p.x + rx * hw * side, p.z + rz * hw * side);
      const sl = Math.abs(e - c) / hw;
      if (sl > maxCross) {
        maxCross = sl;
        worstCross = p.s;
      }
    }
  }
  if (maxCross > R.track.camber + 0.03) {
    add(
      "R8",
      "error",
      `the ground falls ${fmt(maxCross, 3)} across the piste at s ${fmt(worstCross, 0)} m`,
    );
  }

  // R9 — the kickers on the piste: how many, how far apart, that each is a
  // crest, and that each is taken off a moderate pitch. The park's are
  // R20's, and held below.
  const crests = trackKickers.filter((k) => !k.trick);
  // A resort's runs each carry their own share of kickers (R27).
  if (!resort && !withinBand(crests.length, G.kickers.on)) {
    add("R9", "error", `${crests.length} kicker(s) on the piste (band ${bandText(G.kickers.on)})`);
  }
  for (let a = 0; a < crests.length; a++) {
    const k = crests[a];
    const s0 = k.s ?? 0;
    const at = (u: number): number => {
      const p = trackPointAt(level, s0 + u);
      return level.groundAt(p.x, p.z);
    };
    const lip = at(0);
    const kick = (lip - at(-3)) / 3 - (at(3) - lip) / 3;
    if (kick < KICK)
      add("R9", "warn", `${k.id} at s ${fmt(s0, 0)} m breaks only ${fmt(kick, 2)} over its lip`);
    // The line under the ramp: from its foot to the lip less the lip's own
    // height, no steeper than the approach grade.
    const approach = (at(-k.ramp) - (lip - k.height)) / k.ramp;
    const approachMost = resort ? GRADES.black.kickers.approachGrade : G.kickers.approachGrade;
    if (approach > approachMost + 0.03) {
      add("R9", "error", `${k.id} is taken off a ${fmt(approach * 100, 0)} % pitch`);
    }
    for (let b = a + 1; b < crests.length; b++) {
      const ds = Math.abs((k.s ?? 0) - (crests[b].s ?? 0));
      if (ds < R.kickers.on.spacing - 1) {
        add("R9", "error", `${k.id} and ${crests[b].id} stand ${fmt(ds, 0)} m apart`);
      }
    }
  }
  const offKickers = kickers.filter((k) => !k.onTrack && k.run === undefined);
  for (const k of offKickers) {
    const distance = resort
      ? nearestRun(level, k.x, k.z, 400)
      : nearestTrackPoint(level, k.x, k.z).distance;
    const reach = Math.max(k.ramp, k.landing) + k.width / 2 + R.kickers.edge;
    if (distance - reach < R.track.width.max / 2 + R.kickers.off.clearance - 1) {
      add("R4", "error", `${k.id} stands ${fmt(distance, 0)} m from the piste`);
    }
  }
  if (offKickers.length < scaleCount(R.kickers.off.count, region.kickers * G.kickers.off).min) {
    add("R4", "warn", `only ${offKickers.length} kicker(s) off the piste`);
  }

  // R22 — the cliffs; R24 — the drops across the piste.
  checkCliffs(level, add);
  checkDrops(level, trackKickers, add);

  // R20 — the park, when the map carries one.
  checkTrickField(level, trackKickers, add);

  // R10 — packed on the line, powder off it — outside the drifts (R17),
  // each read with its ease either side, which is what they published.
  const drifts = level.drifts ?? [];
  const hub = level.resort?.hub;
  const F = R.drift.fade;
  const drifted = (s: number): boolean => drifts.some((d) => s > d.from - F && s < d.to + F);
  let packedLow = 1;
  let packedHigh = 0;
  for (let i = 0; i < n; i += 5) {
    const p = pts[i];
    if (atJunction(i)) continue;
    if (!drifted(p.s)) packedLow = Math.min(packedLow, level.packedAt(p.x, p.z));
    const off = p.width / 2 + R.track.shoulder.packed + 3;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    // Off a resort's course where it runs out into the hub (R29), the
    // snow beside it is the hub's, groomed.
    const bx = p.x + rx * off;
    const bz = p.z + rz * off;
    if (hub && outsideHub(hub, bx, bz) <= RR.hub.fade) continue;
    packedHigh = Math.max(packedHigh, level.packedAt(bx, bz));
  }
  if (packedLow < 0.98) add("R10", "error", `the centreline is only ${fmt(packedLow, 2)} packed`);
  if (packedHigh > POWDER_SLACK)
    add("R10", "error", `powder beside the piste is ${fmt(packedHigh, 2)} packed`);

  // R11 — the gates: the start gate first, the finish last, in order, on
  // the line, inside their spacing.
  const cps = level.checkpoints;
  let spacingMin = Infinity;
  let spacingMax = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i];
    if (i + 1 < cps.length) {
      const d = cps[i + 1].s - a.s;
      spacingMin = Math.min(spacingMin, d);
      spacingMax = Math.max(spacingMax, d);
      if (d <= 0) add("R11", "error", `gate ${i + 1} stands up the piste from gate ${i}`);
    }
    const hit = nearestTrackPoint(level, a.x, a.z);
    // A slalom gate (R28) stands its offset off the line, and inside the
    // piste with its margin to spare.
    const off = Math.abs(a.offset ?? 0);
    if (Math.abs(hit.distance - off) > 0.75)
      add("R11", "error", `gate ${i} stands ${fmt(hit.distance)} m off the line`);
    if (
      a.offset !== undefined &&
      off + a.width / 2 > (a.span ?? 0) / 2 - RR.course.gates.margin + 0.5
    ) {
      add("R28", "error", `gate ${i} hangs over the piste's edge`);
    }
  }
  const gap = resort ? RR.course.gates.spacing : R.checkpoint.spacing;
  if (cps.length < 2 || spacingMin < gap.min - 0.5 || spacingMax > gap.max + 0.5) {
    add("R11", "error", `gates ${fmt(spacingMin, 0)}–${fmt(spacingMax, 0)} m apart`);
  }
  if (cps.length > 0 && Math.abs(cps[0].s - startGateArc()) > 1e-6) {
    add("R11", "error", `the start gate stands at s ${fmt(cps[0].s)} m`);
  }
  if (cps.length > 0 && Math.abs(cps[cps.length - 1].s - L) > 1e-6) {
    add("R11", "error", "the finish is not at the piste's end");
  }

  // R12 — the start: the gate clear of every kicker, the run after it
  // straight and gentle.
  const gateArc = startGateArc();
  for (const k of trackKickers) {
    const ds = (k.s ?? 0) - gateArc;
    if (ds < R.spawn.kickerGap - 1) {
      add("R12", "error", `${k.id} stands ${fmt(ds, 0)} m from the start gate`);
    }
  }
  for (const d of drops) {
    const ds = (d.s ?? 0) - d.shelf - gateArc;
    if (ds < R.spawn.kickerGap - 1) {
      add("R12", "error", `${d.id} stands ${fmt(ds, 0)} m from the start gate`);
    }
  }
  const gate = trackPointAt(level, gateArc);
  let bend = 0;
  let steepest = 0;
  for (let u = 0; u + R.track.gradeWindow <= R.spawn.run; u += step) {
    const a = trackPointAt(level, gateArc + u);
    const b = trackPointAt(level, gateArc + u + R.track.gradeWindow);
    bend = Math.max(bend, Math.abs(angleDiff(b.heading, gate.heading)));
    steepest = Math.max(steepest, (a.y - b.y) / R.track.gradeWindow);
  }
  if (bend > R.spawn.straight + 0.02) {
    add("R12", "error", `the run out of the gate turns ${fmt(bend, 2)} rad`);
  }
  // On a resort the start is the first run's, held to the colour that run
  // measures — a red that runs into a black is still a red off its top.
  const firstRun = resort?.runs.find(
    (r) => r.id === resort.courses.find((c) => c.id === resort.course)?.runs[0],
  );
  const S = firstRun ? gradeRow(firstRun.grade) : G;
  if (steepest > S.spawn.maxSlope + 0.02) {
    add("R12", "error", `the run out of the gate is ${fmt(steepest * 100, 0)} % steep`);
  }
  // R12, R23 — a black drops off the hut onto a pitch.
  const runEnd = trackPointAt(level, gateArc + R.spawn.run);
  const startFall = (gate.y - runEnd.y) / R.spawn.run;
  if (S.spawn.minSlope > 0 && startFall < S.spawn.minSlope - 0.02) {
    add("R12", "error", `the run out of the gate falls only ${fmt(startFall * 100, 0)} %`);
  }

  // R13 — the start line: on the groomer at the piste's first station,
  // facing down it, nobody on top of anybody.
  if (level.grid.length !== R.grid.slots) add("R13", "error", `${level.grid.length} start slots`);
  const line = [level.spawn, ...level.grid];
  line.forEach((g, i) => {
    const hit = nearestTrackPoint(level, g.x, g.z);
    const p = pts[hit.index];
    const who = i === 0 ? "the spawn" : `start slot ${i - 1}`;
    if (hit.distance > p.width / 2 - 1) add("R13", "error", `${who} stands off the piste`);
    if (level.packedAt(g.x, g.z) < 0.98) add("R13", "error", `${who} is not on packed snow`);
    if (hit.s > R.track.step) add("R13", "error", `${who} stands ${fmt(hit.s)} m down the piste`);
    if (Math.abs(angleDiff(g.heading, p.heading)) > 0.05) {
      add("R13", "error", `${who} does not face down the piste`);
    }
  });
  if (nearestTrackPoint(level, level.spawn.x, level.spawn.z).distance > 0.1) {
    add("R13", "error", "the spawn is off the centreline");
  }
  for (let a = 0; a < level.grid.length; a++) {
    for (let b = a + 1; b < level.grid.length; b++) {
      const d = hypot(level.grid[a].x - level.grid[b].x, level.grid[a].z - level.grid[b].z);
      if (d < R.grid.spacing - 0.05)
        add("R13", "error", `start slots ${a} and ${b} stand ${fmt(d)} m apart`);
    }
  }

  // R14 — the forest: off the corridor, in its height band, under the tree
  // line.
  // The tree line stands its height over the valley floor: on a resort the
  // village's (R25), which the woods are grown to — a course's finish is
  // a few metres off it, and a different few on every course.
  const floorY = resort ? resort.village.y : M?.base.y;
  const treeLineY = M && floorY !== undefined ? floorY + (M.treeLine - M.altitude) : Infinity;
  let treesOnCorridor = 0;
  let aboveTreeLine = 0;
  const hit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  // On a resort the woods are the whole mountain's, read once a resort
  // (`analyzeResort` holds them off every run); a course read on its own
  // skips them.
  const woods = !resort || opts.network !== false;
  const trees = woods ? level.trees : [];
  for (const t of trees) {
    if (!resort) {
      nearestWithin(level, t.x, t.z, R.track.width.max / 2 + R.forest.corridor, hit);
      if (hit.distance < pts[hit.index].width / 2 + R.forest.corridor - 0.5) treesOnCorridor++;
    }
    if (!withinBand(t.height, R.forest.height))
      add("R14", "error", `a tree ${fmt(t.height)} m tall`);
    if (M && t.y > treeLineY + 0.01) aboveTreeLine++;
  }
  if (treesOnCorridor > 0)
    add("R14", "error", `${treesOnCorridor} tree(s) stand on the piste's corridor`);
  if (aboveTreeLine > 0) {
    add("R14", "error", `${aboveTreeLine} tree(s) stand above the tree line`);
  }
  // ...and room to ski between them: the closest two trunks of different
  // groups, read off a hash of gap-sized buckets — and inside a clump, the
  // closest two of its own, which may stand no further than a clump's
  // width apart.
  const buckets = new Map<number, { x: number; z: number; clump?: number }[]>();
  let treeGap = Infinity;
  let clumpGap = Infinity;
  let clumpSpread = 0;
  const clumps = new Set<number>();
  for (const t of trees) {
    const bx = Math.floor(t.x / R.forest.gap);
    const bz = Math.floor(t.z / R.forest.gap);
    if (t.clump !== undefined) clumps.add(t.clump);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const u of buckets.get((bx + dx) * 8192 + bz + dz) ?? []) {
          const d = hypot(u.x - t.x, u.z - t.z);
          if (t.clump !== undefined && u.clump === t.clump) {
            clumpGap = Math.min(clumpGap, d);
            clumpSpread = Math.max(clumpSpread, d);
          } else {
            treeGap = Math.min(treeGap, d);
          }
        }
      }
    }
    const key = bx * 8192 + bz;
    const list = buckets.get(key);
    if (list) list.push(t);
    else buckets.set(key, [t]);
    if (t.crown > R.forest.crownMax + 1e-9) add("R14", "error", `a crown ${fmt(t.crown)} m wide`);
  }
  if (treeGap < R.forest.gap - 0.01) {
    add("R14", "error", `two trunks stand ${fmt(treeGap)} m apart (least ${R.forest.gap} m)`);
  }
  if (clumpGap < R.forest.clumps.gap - 0.01) {
    add("R14", "error", `two trunks of a clump stand ${fmt(clumpGap)} m apart`);
  }
  if (clumpSpread > 2 * R.forest.clumps.radius + 0.01) {
    add("R14", "error", `a clump spreads ${fmt(clumpSpread)} m`);
  }
  if (woods && level.trees.length < 600 * region.forest.density) {
    add("R14", "warn", `only ${level.trees.length} trees`);
  }

  // R15 — the day, from the region's own bands (R21); an evening map (R19)
  // starts from sunset instead.
  const bands = region.sun;
  const sun = sunAt(level.sun.hour, level.sun.latitude, declinationOf(level.sun.dayOfYear));
  const elevation = (sun.elevation * 180) / Math.PI;
  const weather = weatherOf(level);
  const startOk = weather.evening
    ? withinBand(level.sun.hour - sunsetOf(level.sun), R.sun.evening, 1e-3)
    : withinBand(level.sun.hour, R.sun.hour) && elevation >= R.sun.minElevation - 0.05;
  if (
    !startOk ||
    !withinBand(level.sun.latitude, bands.latitude) ||
    !withinBand(level.sun.dayOfYear, bands.dayOfYear)
  ) {
    add(
      "R15",
      "error",
      `the sun: ${fmt(level.sun.hour)} h on day ${level.sun.dayOfYear} at ${fmt(level.sun.latitude)}°N, ${fmt(elevation)}° up`,
    );
  }

  // R15 — the face turned to the sun, on a map dealt a bearing.
  if (level.sun.facing !== undefined && sunOffFace(level.sun) > R.sun.facing + 1e-6) {
    add(
      "R15",
      "error",
      `the sun stands ${fmt((sunOffFace(level.sun) * 180) / Math.PI, 0)}° off the face's bearing`,
    );
  }

  // R19 — the weather: a sky the rule deals, at numbers inside its bands.
  if (level.weather) {
    const wind = R.weather.wind[weather.kind];
    const bad =
      !WEATHER_KINDS.includes(weather.kind) ||
      !withinBand(weather.wind, wind, 1e-6) ||
      (snows(weather.kind)
        ? !withinBand(weather.snowfall, snowfallBand(weather.kind))
        : weather.snowfall !== 0) ||
      (weather.kind === "fog" ? !withinBand(weather.fog, R.weather.fog) : weather.fog !== 0);
    if (bad) {
      add(
        "R19",
        "error",
        `a ${weather.kind} sky: wind ${fmt(weather.wind)} m/s, fall ${fmt(weather.snowfall)}, fog ${fmt(weather.fog)}`,
      );
    }
  }

  // R16 — one run.
  if (level.laps !== R.race.laps) add("R16", "error", `${level.laps} runs`);

  // R17 — the drifts: their length, their spacing, clear of the start and
  // the finish and of every kicker, and the groomer under their cores
  // actually drifted over.
  let driftLength = 0;
  for (let i = 0; i < drifts.length; i++) {
    const d = drifts[i];
    const len = d.to - d.from;
    driftLength += len;
    if (len < R.drift.length.min - 1 || len > R.drift.length.max + 1) {
      add("R17", "error", `a drift at s ${fmt(d.from, 0)} m is ${fmt(len, 0)} m long`);
    }
    if (d.from - F < R.drift.clear - 1 || d.to + F > L - R.drift.clear + 1) {
      add("R17", "error", `a drift at s ${fmt(d.from, 0)} m lies on the start or the finish`);
    }
    const next = drifts[i + 1];
    if (next && next.from - d.to < R.drift.gap + 2 * F - 1) {
      add("R17", "error", `two drifts stand ${fmt(next.from - d.to, 0)} m apart`);
    }
    for (const k of trackKickers) {
      const s0 = k.s ?? 0;
      if (d.from - F < s0 + k.landing && d.to + F > s0 - k.ramp) {
        add("R17", "error", `a drift at s ${fmt(d.from, 0)} m lies over ${k.id}`);
      }
    }
    let deepest = 0;
    for (let s = d.from; s <= d.to; s += 5) {
      // A lane groomed across a drift (R27) packs its own way over it.
      if (atJunction(Math.min(n - 1, Math.round(s / step)))) continue;
      const p = trackPointAt(level, s);
      deepest = Math.max(deepest, level.packedAt(p.x, p.z));
    }
    if (deepest > R.drift.packed + 0.05) {
      add("R17", "error", `the drift at s ${fmt(d.from, 0)} m is ${fmt(deepest, 2)} packed`);
    }
  }
  if (driftLength / L > G.drift.max + R.drift.length.min / L + 0.01) {
    add("R17", "warn", `${fmt((100 * driftLength) / L, 0)} % of the piste is drifted`);
  }

  // R18 — the windrows: a ridge on both sides the whole way down, read off
  // the ground across the bench it stands on. The crest is taken as the
  // highest of a few samples across it, because the grid is two metres a
  // cell and a bilinear sample off the crest's line reads it low; the face
  // as the steepest rise between neighbouring samples.
  const toe = R.track.shoulder.flat;
  const across = 10;
  let bermLow = Infinity;
  let bermSteep = 0;
  let worstBerm = 0;
  let steepBerm = 0;
  for (let i = 0; i < n; i += 3) {
    // Not across a kicker (R9, R20): the line breaks at a lip, and a read
    // across the break reads the landing's drop, not the windrow.
    if (skip[i]) continue;
    // Not where another run joins (R27): its windrow is opened there.
    if (atJunction(i)) continue;
    const p = pts[i];
    const hw = p.width / 2;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    for (const side of [-1, 1]) {
      const at = (d: number): number => level.groundAt(p.x + rx * d * side, p.z + rz * d * side);
      const edge = at(hw);
      let crest = -Infinity;
      let prev = at(hw + toe);
      for (let j = 1; j <= across; j++) {
        const u = (j / across) * R.berm.width;
        const y = at(hw + toe + u);
        crest = Math.max(crest, y - edge);
        const face = Math.abs(y - prev) / (R.berm.width / across);
        if (face > bermSteep) {
          bermSteep = face;
          steepBerm = p.s;
        }
        prev = y;
      }
      if (crest < bermLow) {
        bermLow = crest;
        worstBerm = p.s;
      }
    }
  }
  if (n > 0 && bermLow < BERM_LOW * R.berm.height.min) {
    add(
      "R18",
      "error",
      `the windrow stands only ${fmt(bermLow, 2)} m over the edge at s ${fmt(worstBerm, 0)} m`,
    );
  }
  if (bermSteep > R.berm.maxSlope + BERM_STEEP_SLACK) {
    add(
      "R18",
      "error",
      `a windrow's face climbs at ${fmt(bermSteep, 2)} (most ${R.berm.maxSlope}) at s ${fmt(steepBerm, 0)} m`,
    );
  }

  // R25–R28 — the resort round the course.
  if (resort && opts.network !== false) findings.push(...analyzeResort(level).findings);

  return {
    seed: level.seed,
    ok: findings.every((f) => f.severity !== "error"),
    findings,
    stats: {
      length: L,
      points: n,
      widthMin,
      widthMax,
      minRadius: radius,
      minSeparation: separation,
      maxGrade,
      colour,
      grade: level.grade ?? null,
      meanGrade: n > 1 ? (pts[0].y - pts[n - 1].y) / L : 0,
      drops: drops.length,
      steepestSpan,
      minGrade,
      climb,
      maxCrossSlope: maxCross,
      finishGrade,
      drop: n > 0 ? pts[0].y - pts[n - 1].y : 0,
      vertical,
      traverse: n > 0 ? traverses / n : 0,
      trackKickers: trackKickers.length,
      offKickers: offKickers.length,
      cliffs: level.cliffs?.length ?? 0,
      checkpoints: cps.length,
      spacingMin,
      spacingMax,
      treeGap,
      clumps: clumps.size,
      trees: level.trees.length,
      treesOnCorridor,
      aboveTreeLine,
      treeLineY,
      sunElevation: elevation,
      attempt: level.attempt ?? 0,
      drifted: driftLength / L,
      bermLow,
      bermSteep,
    },
  };
}
