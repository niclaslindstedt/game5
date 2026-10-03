// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25–R30 — A RESORT BUILT: the massif, the lifts, every run walked, graded
// and pressed into it in order, the lanes and the drag lifts that make every
// piste skiable again, the mountain's own features round them, the hub and
// its wind tunnels, the woods, and the courses down the network — once per
// seed, whichever course a map is then raced on.
//
// THE ORDER inside an attempt, all off the attempt's stream unless named:
//
//   1. the massif (R25), baked once onto the grid
//   2. the stations and the lifts (R26), and the run slots (R27)
//   3. every run WALKED, in slot order, onto the untouched mountain — each
//      walked again up to `network.tries` times before its slot is left
//      empty, and each merging into the runs walked before it; then the
//      link lanes and the drag lifts R29 asks for (`layAccess`), and the
//      branch lanes between the sectors (`layLinks`)
//   4. every run GRADED, its drops (R24, off a stream of its own) and its
//      kickers (R9) added to the line clear of every junction, its colour
//      measured, its drifts dealt (R17, off a stream of its own), and
//      PRESSED into the ground — in walk order, so a run that merges is
//      graded onto the surface of the one it merges into; and R29 read
//      again on the colours they measure, a drag lift laid where it asks
//   5. the natural kickers off the runs (R4) and the cliffs (R22, off a
//      stream of their own), clear of every run
//   6. the wind crust (R21, off a stream of its own), folded in clear of
//      every run; the HUB laid along the valley floor round every finish
//      and bottom station and groomed, and its two WIND TUNNELS (R29, R30)
//   7. the woods (R14, by height on a resort), clear of every run, every
//      lift and the hub
//   8. the latitude and the face's bearing (R15)
//   9. the courses (R28), each run's top station down to the village
//
// A course's DAY (R15, R19) is dealt when its map is stood up
// (`resortLevel`), off a stream of the course's own, so every map of one
// resort shares every metre of its snow and only its sky differs.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { debug } from "@niclaslindstedt/oss-game-framework/core/output";
import {
  createHeightfield,
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { layCliffs } from "./cliffs.ts";
import { composeCourse, courseArc, type CoursePlan } from "./courses.ts";
import { dealDrifts } from "./drift.ts";
import { layDrops, publishDrops } from "./drops.ts";
import { growForest } from "./forest.ts";
import {
  GRADES,
  PISTE_GRADES,
  pisteGradeOf,
  steepestSpan,
  type GradeRow,
  type PisteGrade,
} from "./grades.ts";
import { layOffKickers, layTrackKickers, publishTrackKickers } from "./kickers.ts";
import { routeLane } from "./lanes.ts";
import { planLifts, settleDrags, type DragGround } from "./drags.ts";
import { clearStations, nearLine, type StationGround } from "./station-clear.ts";
import { reckonAccess } from "./access-build.ts";
import { groomPads, padShape, pressPads, relevelPads } from "./station-pad.ts";
import { trimDrifts } from "./drift-trim.ts";
import { groomHub, hubClear, layTunnels, planHub, type FloorPoint } from "./hub.ts";
import { layAccess, layLinks, planRuns, type LinkBuilder } from "./links.ts";
import { bakeMassif, planMassif } from "./massif.ts";
import {
  BENCH,
  NetIndex,
  WIDEST,
  clearance,
  netHit,
  rankOf,
  runColour,
  traceRefused,
  walkRun,
  type RunSpec,
  type WalkedRun,
} from "./network.ts";
import { gradeRun, networkStamp, onCore, stampRun } from "./network-build.ts";
import { regionRow, type Region, type RegionId } from "./regions.ts";
import { ROAD_ROW, planResort } from "./resort.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { WOODS, tallAtDepth, woodsAtDepth } from "./resort-woods.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { gridOnTrack } from "./spawn.ts";
import { dealSun, faceTheSun, sunOffFace, sunWindow } from "./sun.ts";
import { foldSurface, layCrust } from "./surface.ts";
import type { TerrainPlan } from "./terrain.ts";
import { dealWeather } from "./weather.ts";
import { compileLevel } from "./compile.ts";
import { courseGates, hashPick } from "./course-gates.ts";
import { nearestTrackPoint, trackPointAt } from "./query.ts";
import type {
  Cliff,
  Course,
  Drift,
  GeneratedLevel,
  Hub,
  Kicker,
  Lift,
  Run,
  TrackPoint,
  TreeDef,
  Vec3,
  WindTunnel,
} from "./types.ts";
import { generatorTraits, type GeneratorVersion } from "./versions.ts";

/** A run as the resort keeps it: walked, built, and what it carries — its
 * kickers and drops by ITS OWN arc. */
export type BuiltRun = {
  walked: WalkedRun;
  run: Run;
  kickers: Kicker[];
  drops: Cliff[];
  drifts: Drift[];
};

/** A resort, built — everything a map of it shares. */
export type BuiltResort = {
  seed: number;
  attempt: number;
  sub: number;
  region: Region;
  plan: TerrainPlan;
  ground: Heightfield;
  packed: Heightfield;
  crust: Heightfield | null;
  runs: BuiltRun[];
  lifts: Lift[];
  village: Vec3;
  hub: Hub;
  tunnels: WindTunnel[];
  offKickers: Kicker[];
  cliffs: Cliff[];
  trees: TreeDef[];
  latitude: number;
  facing: number;
  courses: { plan: CoursePlan; course: Course }[];
  cures: AccessCures;
};

/** R29 — what the build did for access, piste by piste: walks turned away
 * from a harder run they would have merged into, link lanes and drag lifts
 * laid for a piste that could not be skied again, pistes left out for it,
 * and link lanes and drag lifts home off a piste that left its skier far
 * to ski below it. For the lab; nothing reads it to build. */
export type AccessCures = {
  turned: number;
  lanes: number;
  drags: number;
  dropped: number;
  homeLanes: number;
  homeDrags: number;
};

/** Kickers on a run, by its length, against the grade row's count for a
 * course: the row's band is a downhill course's, and a resort's runs are
 * shorter — a run of `KICKER_REACH` metres carries the row's whole band,
 * and any but a green at least one. */
const KICKER_REACH = 2000;

/** A row's kicker and drop counts scaled to a run's length. */
function scaledRow(row: GradeRow, length: number): GradeRow {
  const k = Math.min(1.4, length / KICKER_REACH);
  const least = row.id === "green" || row.id === null ? 0 : 1;
  const on = {
    min: Math.max(least, Math.floor(row.kickers.on.min * k)),
    max: Math.max(least, Math.round(row.kickers.on.max * k)),
  };
  const drops = { min: Math.floor(row.drops.min * k), max: Math.round(row.drops.max * k) };
  return { ...row, kickers: { ...row.kickers, on }, drops };
}

/** Salts for a run's own streams and a course's day. */
const RUN_SALT = 0x2b1d5e7;
const DAY_SALT = 0x0dae5a1;

/** The start heading a run can be raced off (R12): the fall of the first
 * stretch no steeper than its colour's start, and on a black at least its
 * floor — tried about the wanted heading, the first that holds; null where
 * none does. */
function fairHeading(
  ground: Heightfield,
  x: number,
  z: number,
  want: number,
  row: GradeRow,
): number | null {
  const run = R.grid.back + R.track.step + R.spawn.run;
  const { maxSlope, minSlope } = row.spawn;
  for (const d of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.05, -1.05, 1.3, -1.3, 1.55, -1.55]) {
    const h = want + d;
    if (Math.abs(h) > 1.3) continue;
    let steepest = 0;
    let climb = 0;
    for (let u = 0; u + R.track.gradeWindow <= run; u += 5) {
      const a = sampleField(ground, x + Math.sin(h) * u, z + Math.cos(h) * u);
      const b = sampleField(
        ground,
        x + Math.sin(h) * (u + R.track.gradeWindow),
        z + Math.cos(h) * (u + R.track.gradeWindow),
      );
      const fall = (a - b) / R.track.gradeWindow;
      steepest = Math.max(steepest, fall);
      climb = Math.max(climb, -fall);
    }
    const end = sampleField(ground, x + Math.sin(h) * run, z + Math.cos(h) * run);
    const mean = (sampleField(ground, x, z) - end) / run;
    if (steepest > maxSlope * 0.85 || climb > 0.06) continue;
    if (minSlope > 0 && mean < minSlope * 1.2) continue;
    return h;
  }
  return null;
}

/** How far along the contour from its top station a run's start is looked
 * for, m a step and steps: a red off a peak whose face falls too steeply
 * for one starts where the ridge has carried it to a pitch it can leave on,
 * as a ridge run does. */
const START_STEP = 30;
const START_STEPS = 12;

/** How far apart along the contour two runs off one top start, m. */
const SIBLING_APART = 80;

/** R12, R27 — where on the contour by its top station a run starts, and
 * the heading it leaves on: the first spot, out from the station on the
 * side the run leans to and then the other, a start of its colour can be
 * raced off. Null where there is none within reach. */
function placeStart(
  ground: Heightfield,
  spec: RunSpec,
  lean: number,
  siblings: readonly number[],
  clear: (x: number, z: number, heading: number) => boolean,
): RunSpec | null {
  const dir = lean >= 0 ? 1 : -1;
  for (let k = 0; k <= START_STEPS; k++) {
    for (const sgn of k === 0 ? [1] : [dir, -dir]) {
      const x = spec.x + sgn * k * START_STEP;
      if (Math.abs(x - R.world.size / 2) > RR.massif.flank.inner - 160) continue;
      if (siblings.some((sx) => Math.abs(sx - x) < SIBLING_APART)) continue;
      const heading = fairHeading(ground, x, spec.z, spec.heading, spec.row);
      if (heading !== null && clear(x, spec.z, heading)) return { ...spec, x, heading };
    }
  }
  return null;
}

/** How far down its heading a start must be clear of every run but its
 * top's (R12, R27), m, and by how much more than the clearance: a run that
 * began beside another would merge into it off the gate. */
const START_CLEAR = R.track.hold + 100;
/** How far a run's start and its first stretch keep off a station pad's
 * middle past its radius (R26), m: the margin a pad pressed again yields to
 * a run's line by (`PAD_LINE`) and a little. */
const PAD_KEEP = 10;
/** How far past its half-width a run's start and first stretch keep off a
 * station's wheel (R26), m: its footprint's reach and a margin. */
const STATION_KEEP = 14;
/** How far past its radius a lane's route keeps off a station pad's middle
 * (R26), m: a lane may cross the ground eased into a pad, never the pad. */
const LANE_KEEP = 12;
/** How near a run's line a pad pressed again yields to the run, m: its
 * line is the one it was graded to (R27). */
const PAD_LINE = 8;
/** How far off a drag lift's line a piste keeps its edge, m (R26). */
const DRAG_ROOM = 6;
const START_ROOM = 12;

function road(run: WalkedRun): boolean {
  return run.spec.kind === "road";
}

/** The colour ceiling a run's grading holds its colour windows under: its
 * row's, but for a black (no ceiling) and a lane (its own grade is lower). */
function colourCap(run: WalkedRun): number | undefined {
  const row = run.spec.row;
  if (run.spec.kind === "road" || row.id === "black" || row.id === null) return undefined;
  return row.steepest.max;
}

/** One attempt at a resort: built, or why not. */
export function attemptResort(
  seed: number,
  attempt: number,
  sub: number,
  region: Region,
  version: GeneratorVersion,
): BuiltResort | string {
  const rng = createRng(sub);
  const plan = planMassif(rng, region);
  const ground = bakeMassif(plan);
  const { lifts: liftPlans, specs, village: v } = planResort(rng, plan);
  // ── 2b. THE STATION PADS (R26), before a run is walked off one ───────
  const shape = padShape(generatorTraits(version).levelPads);
  const pads = pressPads(ground, liftPlans, shape);
  /** Every station standing as the runs are walked — a lift's two ends,
   * the valley floor's aside (the runs finish among them in the hub, and
   * they are stood clear of them once every run stands) (R26). */
  const stations = liftPlans.flatMap((l) =>
    l.bottom.z >= plan.baseZ - 1 ? [l.top] : [l.top, l.bottom],
  );
  /** Whether a piste `half` m wide either side of (x, z) would run over a
   * drag lift's line laid before the runs (the nursery's, R26). */
  const drags = liftPlans.filter((l) => l.kind === "drag");
  const overDrag = (x: number, z: number, half: number): boolean => {
    for (const l of drags) {
      const dx = l.top.x - l.bottom.x;
      const dz = l.top.z - l.bottom.z;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - l.bottom.x) * dx + (z - l.bottom.z) * dz) / len2));
      if (hypot(x - (l.bottom.x + dx * t), z - (l.bottom.z + dz * t)) < half + DRAG_ROOM)
        return true;
    }
    return false;
  };
  /** Whether a lane would cross a station's pad (R26). */
  const onPad = (x: number, z: number): boolean => {
    for (const p of pads) if (hypot(x - p.x, z - p.z) < p.r + LANE_KEEP) return true;
    return false;
  };

  // ── 3. THE RUNS, WALKED ──────────────────────────────────────────────
  const walking = new NetIndex();
  const walked: WalkedRun[] = [];
  const startHit = netHit();
  for (const spec of specs) {
    let fair: RunSpec | null;
    if (spec.kind === "road") {
      // The lane's route to the cheapest join on a piste off another top.
      const lane = routeLane(
        ground,
        walking,
        spec.x,
        spec.z,
        Math.sign(spec.target.x - spec.x) || 1,
        (r) => walked[r].spec.kind === "piste" && walked[r].spec.from !== spec.from,
        { keepOff: onPad },
      );
      const ahead = lane?.route[Math.min(5, lane.route.length - 1)];
      fair =
        lane && ahead
          ? {
              ...spec,
              target: { x: lane.x, z: lane.z },
              join: lane.run,
              route: lane.route,
              heading: Math.atan2(ahead.x - spec.x, Math.max(1, ahead.z - spec.z)),
            }
          : null;
    } else {
      const siblings = walked.filter((w) => w.spec.from === spec.from).map((w) => w.spec.x);
      const wide = spec.row.id ? RR.piste.width[spec.row.id].max : WIDEST;
      const clear = (x: number, z: number, h: number): boolean => {
        for (let u = 0; u <= START_CLEAR; u += 10) {
          const px = x + Math.sin(h) * u;
          const pz = z + Math.cos(h) * u;
          // Off every station's pad and the ground eased into it (R26): the
          // runs leave from its edges, never across it.
          if (u <= shape.r + PAD_KEEP) {
            for (const p of pads) if (hypot(px - p.x, pz - p.z) < p.r + PAD_KEEP) return false;
            // Its corridor off every station standing (R26): the runs leave
            // beside a top, and pass beside a bottom.
            for (const p of stations)
              if (hypot(px - p.x, pz - p.z) < STATION_KEEP + wide / 2) return false;
          }
          // The runs off its own top it leaves beside, off their width and
          // bench; every other by the clearance.
          const reach = WIDEST + 2 * BENCH + RR.network.gap + START_ROOM;
          walking.nearest(px, pz, reach, (r) => walked[r].spec.from === spec.from, startHit);
          if (startHit.distance < clearance(wide, startHit.width) + START_ROOM) return false;
          walking.nearest(px, pz, reach, (r) => walked[r].spec.from !== spec.from, startHit);
          if (startHit.distance < startHit.width / 2 + BENCH + START_ROOM) return false;
        }
        return true;
      };
      fair = placeStart(ground, spec, spec.lean, siblings, clear);
      // Never over a drag lift's line (R26): its track is ridden on the snow.
      // The runs off a drag's own top, which leave beside it and would
      // otherwise wander across it all the way down.
      if (fair && drags.some((l) => l.id === spec.from)) fair = { ...fair, avoid: overDrag };
    }
    if (!fair) {
      debug(
        `resort ${seed}#${attempt}: slot ${spec.id} (${spec.from} ${spec.kind} ${spec.row.id}) — no start`,
      );
      continue;
    }
    const shared = (r: number): boolean => walked[r].spec.from === spec.from;
    // A drag's own run that will not walk clear of its line walks as it
    // would; the drag is then laid again off it (`clearStations`).
    if (!lay(fair, shared) && fair.avoid) lay({ ...fair, avoid: undefined }, shared);
  }
  const pistes = walked.filter((w) => w.spec.kind === "piste").length;
  if (pistes < RR.network.runs.min) {
    return `only ${pistes} piste(s) could be walked down the mountain`;
  }
  // ── 3b. THE LANES BETWEEN THE RUNS ───────────────────────────────────
  let nextId = specs.reduce((m, sp) => Math.max(m, Number(sp.id)), 0);
  // A station on the valley floor stands in the hub (R29).
  const floor = (p: { z: number }): boolean => p.z >= plan.baseZ - 1;
  const links: LinkBuilder = {
    walked,
    lifts: liftPlans,
    floor,
    route: (x, z, side, may, ask) =>
      routeLane(ground, walking, x, z, side, may, { ...ask, keepOff: onPad }),
    lay,
    height: (x, z) => sampleField(ground, x, z),
    piste: (x, z) => {
      walking.nearest(x, z, WIDEST, (r) => walked[r].spec.kind === "road", startHit);
      return { distance: startHit.distance, width: startHit.width, heading: startHit.heading };
    },
    fall: (x, z) => {
      const w = R.track.gradeWindow * 2;
      return (
        hypot(
          sampleField(ground, x + w, z) - sampleField(ground, x - w, z),
          sampleField(ground, x, z + w) - sampleField(ground, x, z - w),
        ) /
        (2 * w)
      );
    },
  };
  // R29 first: every piste brought back to its top, every lift reached;
  // then the lanes between the sectors.
  const laid = layAccess(links, () => String(++nextId));
  const lost = laid.lost;
  layLinks(links, () => String(++nextId));

  /** Walk a run from its spec, again up to `network.tries` times, and keep
   * the first that grades; whether one stood. */
  function lay(fair: RunSpec, shared: (r: number) => boolean): boolean {
    const spec = fair;
    const why: string[] = [];
    const tries = fair.kind === "road" ? RR.road.tries : RR.network.tries;
    for (let t = 0; t < tries; t++) {
      const run = walkRun(rng, plan, ground, fair, walking, shared);
      if (typeof run === "string") {
        why.push(run);
        continue;
      }
      // Gradable at all on the untouched mountain and onto the run it
      // merges into, or walked again: the grading it gets later is onto
      // the runs pressed before it, which differs only by their benches.
      const row = run.spec.kind === "road" ? ROAD_ROW : run.spec.row;
      const onto = run.into ? walked[run.into.run] : null;
      let graded = gradeRun(run, ground, row.track.maxGrade, colourCap(run), onto);
      // A run the mountain made gentler than its colour starts as the
      // colour it measures (R12): graded again with that start.
      const measured = graded || road(run) ? null : runColour(run.points, onto?.points ?? null);
      if (
        measured &&
        PISTE_GRADES.indexOf(measured) < PISTE_GRADES.indexOf(run.spec.row.id ?? "black")
      ) {
        run.startSlope = GRADES[measured].spawn.maxSlope;
        graded = gradeRun(run, ground, row.track.maxGrade, colourCap(run), onto);
      }
      if (graded) {
        why.push(graded);
        traceRefused(run.spec, run.points, graded);
        continue;
      }
      // A run merging into the same run as this one is passed beside only
      // where it runs inside that run (R27): its funnel down onto it is
      // its own, pressed on its own height.
      walking.add(
        run.points,
        rankOf(run.spec),
        run.into?.run ?? -1,
        run.coreFrom,
        run.spec.kind === "road",
      );
      walked.push(run);
      return true;
    }
    debug(
      `resort ${seed}#${attempt}: slot ${spec.id} (${spec.from} ${spec.kind} ${spec.row.id}) — ${why.join(" | ")}`,
    );
    return false;
  }

  // ── 4. GRADED AND PRESSED, IN ORDER ──────────────────────────────────
  const cols = ground.cols;
  const packed = createHeightfield(0, 0, ground.cell, cols, ground.rows);
  const stamp = networkStamp(ground);
  const pressed = onCore(stamp, ground);
  const junctions: number[][] = walked.map(() => []);
  walked.forEach((r) => {
    if (r.into) junctions[r.into.run].push(r.into.s);
  });
  const built: BuiltRun[] = [];
  const dropped = new Set<number>();
  for (let i = 0; i < walked.length; i++) {
    const w = walked[i];
    const road = w.spec.kind === "road";
    const row = road ? ROAD_ROW : w.spec.row;
    // A run that will not grade onto the runs before it is left out, and
    // every run that merges into it with it.
    const onto = w.into ? walked[w.into.run] : null;
    let why = lost.has(i)
      ? "no lift or lane brings a skier back to its top without a harder run (R29)"
      : w.into && dropped.has(w.into.run)
        ? "the run it merges into was left out"
        : w.spec.branch && dropped.has(w.spec.branch.run)
          ? "the run it leaves was left out"
          : gradeRun(w, ground, row.track.maxGrade, colourCap(w), onto, pressed);
    // A run walked as gentler than its colour that grades out its colour
    // on the pressed mountain starts as its colour again (R12).
    if (!why && w.startSlope !== undefined) {
      const measured = runColour(w.points, onto?.points ?? null);
      if (PISTE_GRADES.indexOf(measured) >= PISTE_GRADES.indexOf(w.spec.row.id ?? "black")) {
        w.startSlope = undefined;
        why = gradeRun(w, ground, row.track.maxGrade, colourCap(w), onto, pressed);
      }
    }
    if (why) {
      debug(`resort ${seed}#${attempt}: run ${w.spec.id} left out — ${why}`);
      dropped.add(i);
      continue;
    }
    const J = RR.network.junction;
    const keepOff = junctions[i].map((s) => ({ from: s - J, to: s + J }));
    if (w.into) keepOff.push({ from: w.mergeFrom - J, to: w.length + J });
    const runSub = (sub ^ Math.imul(i + 1, RUN_SALT)) >>> 0;
    const scaled = scaledRow(row, w.length);
    // Drops only across a run that grades out black (R24): a black-built
    // run the mountain made gentler is no place for one.
    const black = runColour(w.points, w.into ? walked[w.into.run].points : null) === "black";
    const trackDrops = road || !black ? [] : layDrops(runSub, w, scaled, keepOff);
    const trackKickers = road ? [] : layTrackKickers(rng, w, scaled, trackDrops, keepOff);
    const drops = publishDrops(w, trackDrops);
    const kickers = publishTrackKickers(w, trackKickers);
    const drifts = road ? [] : dealDrifts(runSub, w.length, kickers, row.drift, drops, keepOff);
    stampRun(w, ground, packed, stamp, drifts, w.into ? walked[w.into.run] : null);
    built.push({
      walked: w,
      run: {
        id: w.spec.id,
        kind: w.spec.kind,
        grade: "green",
        points: w.points,
        length: w.length,
        from: w.spec.from,
        into: w.into ? { run: walked[w.into.run].spec.id, s: w.into.s, from: w.mergeStart } : null,
        ...(w.spec.branch
          ? { branch: { run: walked[w.spec.branch.run].spec.id, s: w.spec.branch.s } }
          : {}),
        ...(w.spec.to !== undefined ? { to: w.spec.to } : {}),
        drifts,
      },
      kickers,
      drops,
      drifts,
    });
  }
  // The station pads at their levels again, over the runs pressed off them
  // (R26).
  relevelPads(
    ground,
    pads,
    (x, z) => walking.nearest(x, z, PAD_LINE, () => false, startHit).distance < PAD_LINE,
  );
  // Every run's line as the ground carries it once every run is pressed,
  // and the colour it MEASURES there (R23, R27): a lane's is green.
  for (const b of built) {
    for (const p of b.walked.points) p.y = sampleField(ground, p.x, p.z);
    for (const k of b.kickers) k.y = sampleField(ground, k.x, k.z);
    for (const d of b.drops) d.y = sampleField(ground, d.x, d.z);
    if (b.run.kind === "piste") {
      const onto = b.walked.into ? walked[b.walked.into.run].points : null;
      b.run.grade = runColour(b.run.points, onto);
    }
  }
  const graded = built.filter((b) => b.run.kind === "piste").length;
  if (graded < RR.network.runs.min) {
    return `only ${graded} piste(s) could be graded into the mountain`;
  }
  // The runs that stand, renumbered: a merge names the run it joins by its
  // place among them, and the index the woods and the mountain's own
  // features keep clear of holds only them.
  const place = new Map<number, number>();
  walked.forEach((_, i) => {
    if (!dropped.has(i)) place.set(i, place.size);
  });
  const kept = built.map((b) => b.walked);
  for (const w of kept) if (w.into) w.into = { run: place.get(w.into.run) ?? -1, s: w.into.s };
  const net = new NetIndex();
  for (const w of kept)
    net.add(w.points, rankOf(w.spec), w.into?.run ?? -1, w.mergeStart, w.spec.kind === "road");
  const hit = netHit();

  // ── 4b. ACCESS, AS THE RUNS MEASURE ──────────────────────────────────
  // R29 again on the colours the pressed runs measure and the runs that
  // stand: a piste the mountain made gentler than it was built may now
  // merge into a harder run, and one left out may have carried a skier
  // home — a drag lift brings it back, or the attempt is refused; and a
  // piste whose skier would ski far on below it before a lift gets a drag
  // lift from its foot where one fits.
  const measured = planRuns(
    kept,
    (i) => (kept[i].spec.kind === "road" ? 0 : PISTE_GRADES.indexOf(built[i].run.grade)),
    (r) => place.get(r) ?? -1,
  );
  const pressedGround: DragGround = {
    floor,
    height: (x, z) => sampleField(ground, x, z),
    piste: (x, z) => {
      net.nearest(x, z, WIDEST, (r) => kept[r].spec.kind === "road", hit);
      return { distance: hit.distance, width: hit.width, heading: hit.heading };
    },
  };
  const settled = settleDrags(
    pressedGround,
    measured,
    liftPlans,
    (i) => kept[i].spec.id,
    (id) => kept.some((w) => w.spec.to === id),
  );
  if (settled.refused) return settled.refused;
  const cures: AccessCures = {
    turned: kept.reduce((n, w) => n + (w.spec.kind === "piste" && w.turned > 0 ? 1 : 0), 0),
    lanes: laid.lanes,
    drags: laid.drags + settled.drags,
    dropped: lost.size,
    homeLanes: laid.home,
    homeDrags: settled.home,
  };
  for (const b of built)
    if (b.run.to !== undefined) b.run.to = settled.renamed.get(b.run.to) ?? b.run.to;

  // ── 4c. THE STATIONS BESIDE THE RUNS (R26) ───────────────────────────
  {
    const beside: StationGround = {
      onRun: (x, z, pad) => net.covers(x, z, pad, hit),
      onPiste: (x, z, pad) => {
        net.nearest(x, z, WIDEST, (r) => kept[r].spec.kind === "road", hit);
        return hit.distance < hit.width / 2 + pad;
      },
      height: (x, z) => sampleField(ground, x, z),
      floor,
      linkEnds: (id) =>
        built
          .filter((b) => b.run.to === id)
          .map((b) => b.walked.points[b.walked.points.length - 1]),
    };
    const stuck = clearStations(beside, liftPlans, (ls) => {
      const v = reckonAccess(measured, planLifts(pressedGround, ls));
      return v.ok.every(Boolean) && v.orphans.length === 0;
    });
    if (stuck) return `R26: ${stuck} stands on a run wherever its station is moved`;
  }

  // ── 5–6. THE MOUNTAIN'S OWN, CLEAR OF THE RUNS ───────────────────────
  const never = (): boolean => false;
  // Read as a race piste's distance from its line (R4, R22 keep off one
  // by their clearance past its half-width) where a resort's run is wider,
  // and from its centreline where it is narrower.
  const distanceTo = (x: number, z: number): number => {
    const h = net.nearest(x, z, 400, never, hit);
    let d = h.distance - Math.max(0, h.width - R.track.width.max) / 2;
    // A station's pad, eased out, is kept off as a run is (R26).
    for (const p of pads) d = Math.min(d, hypot(x - p.x, z - p.z) - p.r - RR.lift.padBlend);
    return d;
  };
  const offKickers = layOffKickers(rng, plan, ground, null, distanceTo);
  const allDrops = built.flatMap((b) => b.drops);
  const noTrack = { track: { points: [] as TrackPoint[], length: 0 } };
  const cliffs = layCliffs(sub, plan, ground, noTrack, offKickers, allDrops, distanceTo);
  const crust = layCrust(sub, region, ground);
  if (crust) foldSurface(packed, stamp.dist, region, crust);

  // ── 6b. THE HUB AND ITS WIND TUNNELS (R29, R30) ──────────────────────
  const floorPoints: FloorPoint[] = [
    ...kept.flatMap((w) =>
      !w.into && w.spec.to === undefined ? [w.points[w.points.length - 1]] : [],
    ),
    ...liftPlans.flatMap((l) => (floor(l.bottom) ? [l.bottom] : [])),
  ];
  const hubPlan = planHub(plan, ground, floorPoints, sub);
  const unhubbed = packed.data.slice();
  groomHub(hubPlan.hub, packed);
  // A drift the hub's grooming reaches into is groomed over there, the run's
  // whole width, and the drift cut back to the fresh snow left of it (R17,
  // R29) — the hub laid round where the stations now stand.
  for (const b of built) trimDrifts(b, packed, unhubbed);
  groomPads(pads, packed, (x, z) => net.covers(x, z, 0, hit));
  const tunnels = layTunnels(hubPlan, ground);

  // ── 7. THE WOODS ─────────────────────────────────────────────────────
  const lifts: Lift[] = liftPlans.map((l) => ({
    id: l.id,
    kind: l.kind,
    bottom: { x: l.bottom.x, z: l.bottom.z, y: sampleField(ground, l.bottom.x, l.bottom.z) },
    top: { x: l.top.x, z: l.top.z, y: sampleField(ground, l.top.x, l.top.z) },
  }));
  const village: Vec3 = { x: v.x, z: v.z, y: sampleField(ground, v.x, v.z) };
  const baseY = village.y;
  const lineY = baseY + (plan.treeLine - plan.altitude);
  const woods = WOODS[region.id];
  const clear = (x: number, z: number): boolean => {
    if (hubClear(hubPlan.hub, sub, x, z)) return true;
    for (const l of lifts) if (nearLine(l, x, z) < RR.lift.clear) return true;
    for (const p of pads) if (hypot(x - p.x, z - p.z) < p.r + RR.lift.clear) return true;
    // Off every run's corridor, not only the nearest's (R14).
    return net.covers(x, z, R.forest.corridor, hit);
  };
  const allKickers = built.flatMap((b) => b.kickers).concat(offKickers);
  const trees = growForest(rng, plan, ground, noTrack, allKickers, allDrops.concat(cliffs), lineY, {
    clear,
    cover: (y) => woodsAtDepth(woods, lineY - y),
    tall: (y) => tallAtDepth(woods, lineY - y),
  });

  // ── 8. THE DAY'S BEARINGS ────────────────────────────────────────────
  const day = dealSun(rng, region.sun);
  const facing = faceTheSun(sub, { ...day, hour: 12.5 });

  // ── 9. THE COURSES ───────────────────────────────────────────────────
  const courses: { plan: CoursePlan; course: Course }[] = [];
  for (let i = 0; i < built.length; i++) {
    const w = built[i].walked;
    // A course starts at a top station on a piste: a lane is a way across
    // the mountain, not a run down it.
    if (w.spec.kind === "road") continue;
    const plan = composeCourse(kept, i);
    if (typeof plan === "string") continue;
    if (plan.length < RR.course.length.min || plan.length > RR.course.length.max) continue;
    for (const p of plan.points) p.y = sampleField(ground, p.x, p.z);
    const onIt = built.flatMap((b, r) =>
      b.kickers.filter((k) => courseArc(plan, r, k.s ?? 0) !== null),
    );
    const colour = pisteGradeOf(
      steepestSpan({ track: { points: plan.points, length: plan.length }, kickers: onIt }),
    );
    courses.push({
      plan,
      course: {
        id: built[i].run.id,
        grade: colour,
        runs: plan.pieces.map((p) => built[p.run].run.id),
        length: plan.length,
        drop: plan.points[0].y - plan.points[plan.points.length - 1].y,
      },
    });
  }
  if (courses.length === 0) return "no course runs down the network to the village";
  return {
    seed,
    attempt,
    sub,
    region,
    plan,
    ground,
    packed,
    crust,
    runs: built,
    lifts,
    village,
    hub: hubPlan.hub,
    tunnels,
    offKickers,
    cliffs,
    trees,
    latitude: day.latitude,
    facing,
    courses,
    cures,
  };
}

/** The resort a seed builds in a region: the first attempt that stands. */
export function buildResort(
  seed: number,
  regionId: RegionId | undefined,
  attempts: number,
  subSeed: (seed: number, attempt: number) => number,
  accept: (built: BuiltResort) => string | null,
  version: GeneratorVersion,
): BuiltResort {
  const region = regionRow(regionId);
  const key = `${seed}:${region.id}:${attempts}:${version}`;
  if (cache && cache.key === key) return cache.built;
  const reasons: string[] = [];
  for (let a = 0; a < attempts; a++) {
    const built = attemptResort(seed, a, subSeed(seed, a), region, version);
    if (typeof built === "string") {
      debug(`resort ${seed}#${a}: refused — ${built}`);
      reasons.push(`#${a}: ${built}`);
      continue;
    }
    const why = accept(built);
    if (why) {
      debug(`resort ${seed}#${a}: refused — ${why}`);
      reasons.push(`#${a}: ${why}`);
      continue;
    }
    cache = { key, built };
    return built;
  }
  throw new Error(
    `resort ${seed}: no clean resort in ${attempts} attempts — ${reasons.join("; ")}`,
  );
}

/** The last resort built, for a lab that reads what its build did. */
export function lastResort(): BuiltResort | null {
  return cache?.built ?? null;
}

/** The last resort built: every map of one resort is the same mountain, so
 * the campaign's six maps of it and a lab's sweep of its courses build it
 * once. */
let cache: { key: string; built: BuiltResort } | null = null;

/** R15, R19 — a course's day: its own stream's day of the year and hour,
 * turned to the face (the sun within `sun.facing` of the face's bearing at
 * the run's hour), and its sky. */
function courseDay(
  b: BuiltResort,
  id: string,
): { sun: GeneratedLevel["sun"]; weather: GeneratedLevel["weather"] } {
  const sub = (b.sub ^ Math.imul(Number(id), DAY_SALT)) >>> 0;
  const rng = createRng(sub);
  const bands = b.region.sun;
  for (let t = 0; t < 48; t++) {
    const dayOfYear = Math.round(
      bands.dayOfYear.min + rng.next() * (bands.dayOfYear.max - bands.dayOfYear.min),
    );
    const w = sunWindow(b.latitude, dayOfYear);
    if (!w) continue;
    const hour = w.min + rng.next() * (w.max - w.min);
    const { weather, hour: start } = dealWeather((sub + t) >>> 0, {
      hour,
      dayOfYear,
      latitude: b.latitude,
    });
    const sun = { hour: start, dayOfYear, latitude: b.latitude, facing: b.facing };
    if (sunOffFace(sun) <= R.sun.facing) return { sun, weather };
  }
  // A noon in the band always faces within the bearing it was dealt for.
  const dayOfYear = Math.round((bands.dayOfYear.min + bands.dayOfYear.max) / 2);
  const { weather } = dealWeather(sub, { hour: 12.5, dayOfYear, latitude: b.latitude });
  return {
    sun: { hour: 12.5, dayOfYear, latitude: b.latitude, facing: b.facing },
    weather: { ...weather, evening: false },
  };
}

/** R28 — the map of a resort raced on one of its courses. */
export function resortLevel(
  b: BuiltResort,
  index: number,
  laps: number,
  version: GeneratorVersion,
): GeneratedLevel {
  const { plan: cp, course } = b.courses[index];
  const points: TrackPoint[] = cp.points.map((p) => ({ ...p, y: sampleField(b.ground, p.x, p.z) }));
  const track = { track: { points, length: cp.length } };
  // The kickers and drops on the course by its arc; every other run's are
  // the mountain's, named by their run.
  const kickers: Kicker[] = [];
  const onCourse: Kicker[] = [];
  const cliffs: Cliff[] = [];
  const drops: Cliff[] = [];
  const drifts: Drift[] = [];
  b.runs.forEach((r, i) => {
    r.kickers.forEach((k, n) => {
      const s = courseArc(cp, i, k.s ?? 0) === null ? null : nearestTrackPoint(track, k.x, k.z).s;
      if (s !== null) onCourse.push({ ...k, s, onTrack: true });
      else
        kickers.push({
          ...k,
          id: `${r.run.id}K${n + 1}`,
          onTrack: false,
          s: undefined,
          run: r.run.id,
        });
    });
    r.drops.forEach((d, n) => {
      const s = courseArc(cp, i, d.s ?? 0) === null ? null : nearestTrackPoint(track, d.x, d.z).s;
      if (s !== null) drops.push({ ...d, s, onTrack: true });
      else
        cliffs.push({
          ...d,
          id: `${r.run.id}D${n + 1}`,
          onTrack: false,
          s: undefined,
          run: r.run.id,
        });
    });
    for (const d of r.drifts) {
      if (courseArc(cp, i, d.from) === null || courseArc(cp, i, d.to) === null) continue;
      const at = (s: number): number => {
        const p = trackPointAt({ track: { points: r.walked.points, length: r.walked.length } }, s);
        return nearestTrackPoint(track, p.x, p.z).s;
      };
      drifts.push({ from: at(d.from), to: at(d.to) });
    }
  });
  onCourse.sort((a, c) => (a.s ?? 0) - (c.s ?? 0)).forEach((k, n) => (k.id = `K${n + 1}`));
  drops.sort((a, c) => (a.s ?? 0) - (c.s ?? 0)).forEach((d, n) => (d.id = `D${n + 1}`));
  drifts.sort((a, c) => a.from - c.from);
  const last = points[points.length - 1];
  const base: Vec3 = { x: last.x, z: last.z, y: last.y };
  const { sun, weather } = courseDay(b, course.id);
  return {
    ...compileLevel({
      seed: b.seed,
      size: R.world.size,
      ground: b.ground,
      packed: b.packed,
      points,
      length: cp.length,
      checkpoints: courseGates(
        track,
        drops,
        onCourse,
        course.grade,
        b.sub ^ Math.imul(Number(course.id), 0x51a1e),
      ),
      ...gridOnTrack(track),
      trees: b.trees,
      kickers: onCourse.concat(kickers, b.offKickers),
      cliffs: drops.concat(cliffs, b.cliffs),
      sun,
      laps,
      mountain: {
        summit: { x: b.plan.massif?.peakX ?? 0, z: b.plan.summitZ, y: base.y + b.plan.vertical },
        base,
        vertical: b.plan.vertical,
        altitude: b.plan.altitude,
        treeLine: b.plan.treeLine,
      },
      attempt: b.attempt,
      drifts,
      weather,
      version,
      region: b.region.id,
      grade: course.grade,
      crust: b.crust,
    }),
    resort: {
      runs: b.runs.map((r) => r.run),
      lifts: b.lifts,
      courses: b.courses.map((c) => c.course),
      course: course.id,
      village: b.village,
      hub: b.hub,
      tunnels: b.tunnels,
    },
  };
}

/** R28 — which course a map asks for: by id, else of the colour asked (or
 * the nearest colour there is), else the seed's. */
export function chooseCourse(
  b: BuiltResort,
  ask: { course?: string; grade?: PisteGrade; dealt: PisteGrade },
): number {
  if (ask.course !== undefined) {
    const i = b.courses.findIndex((c) => c.course.id === ask.course);
    if (i >= 0) return i;
  }
  const want = ask.grade ?? ask.dealt;
  const order = ["green", "blue", "red", "black"] as const;
  const wi = order.indexOf(want);
  let best = 0;
  let bestScore = Infinity;
  b.courses.forEach((c, i) => {
    const d = Math.abs(order.indexOf(c.course.grade) - wi);
    // Nearest colour, the harder on a tie, then the seed's own pick.
    const score = d * 4 - (order.indexOf(c.course.grade) > wi ? 1 : 0) + hashPick(b.seed, i) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export { BENCH, GRADES };
