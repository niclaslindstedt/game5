// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LIFT, AS A PLAN — where its towers stand, how high, and where its rope
// hangs between them (R26), how fast it runs and where a skier boards it.
// In the engine because a skier RIDES it (`lift-ride.ts`): the rope he
// hangs from is the rope the app draws (`lifts.ts`), off the one plan, and
// the suite holds that plan to the ground (`tests/lifts_test.ts`).
//
// WHAT A LIFT LOOKS LIKE: a straight line up the mountain from a bottom
// station to a top one, a BULLWHEEL in each the haul rope turns round, and
// between them steel TOWERS carrying the rope on sheave trains at the ends
// of a crossarm — the rope going up on one side and coming back down on the
// other. A tower stands every hundred-odd metres and more often where the
// ground rolls over, since a rope is straight between two towers save for
// its sag and a crest under it would meet the cabins. The LAST tower
// before a top stands a couple of dozen metres short of it and tall, so the
// rope comes DOWN into the terminal over the cut under its way in: a chair
// or a cabin arrives from above and settles onto the unload, never
// dragged up the snow to it. A GONDOLA is the
// tallest and the widest-spaced, its cabins far apart; a CHAIR is lower,
// its chairs every couple of dozen metres; a DRAG is a short line of low
// poles and one rope, its T-bars hung on cords that reach down to a
// skier's hips.
//
// The numbers are a class's measured bands, not any one lift's: towers of
// 8–25 m on tubular columns most of a metre across, a span of 80–150 m, a sag of two or three hundredths of a span; a
// detachable chair's rope at 5 m/s and its chairs slowed to about 1 m/s
// through a terminal, a gondola's at 6 m/s and its cabins through a station
// at a walk, a T-bar's at 3 m/s (`docs/summit-stations.md`).
//
// HOW EACH KIND IS BOARDED (`entry`), at its bottom station:
//   * a CHAIR from the LOAD LINE a few metres up the line from the wheel,
//     under the up rope: a skier slides out onto it facing up the line and
//     the chair scoops him from behind;
//   * a GONDOLA through the DOOR at the back of its station house, down the
//     line from the wheel: he goes in, racks his skis on the cabin and gets
//     on as it creeps through;
//   * a DRAG from the head of its TRACK, under the rope just up from the
//     wheel: he stands in the track and the bar is put behind his thighs.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import type { Level, Lift } from "../mapgen/types.ts";

export type LiftKind = Lift["kind"];

/** A kind of lift's measure, m. */
export type LiftLook = {
  /** The span a tower is aimed for — the line split evenly near it. */
  spacing: number;
  /** The shortest span a tower may be put in to clear a crest. */
  minSpan: number;
  /** A tower's height to the rope, and the tallest one raised to clear a
   * crest a split could not. */
  tower: number;
  towerMax: number;
  /** THE WAY IN to the top station: the last tower stands `in.back` m short
   * of the top wheel — past the rim of the pad it stands on (R26), and slid
   * on back down the line off any groomed snow, a ramp's or a run's — tall
   * enough that the rope FALLS from it into the
   * terminal at `in.fall` m per m at the least — the carriers come down
   * onto the unload from above, never climb up the snow to it. 0 for a
   * drag, whose rope runs along its track. */
  in: { back: number; fall: number };
  /** THE TERMINAL'S RAIL at the top: the last `rail` m short of the top
   * wheel the carriers ride level at the wheel's height — a chair over its
   * unload ramp at seat height, a cabin through the station — and the rope
   * comes down from the last tower onto the rail's mouth. */
  rail: number;
  /** A tower's (and a bullwheel's post's) square steel column: half its
   * width across the flats at its foot, m — what a skier meets of it
   * (`standing.ts`), the column tapering to `COLUMN_TAPER` of it at its
   * head. */
  column: number;
  /** The rope's height over the snow at each station's bullwheel. */
  wheel: number;
  /** How far apart the up and the down rope run; one rope where 0. */
  gauge: number;
  /** The rope's sag mid-span as a share of the span. */
  sag: number;
  /** How far under the rope the lowest of a carrier is, and the snow it
   * must keep under that, so the rope's clearance over the snow is their
   * sum. */
  hang: number;
  under: number;
  /** A carrier every this many metres of rope. */
  every: number;
  /** The station's house: its length along the line, width across it
   * past the gauge, and height. */
  house: { length: number; width: number; height: number };
  /** The rope's speed out on the line, m/s, and a carrier's through a
   * terminal — where it is boarded and left. */
  speed: number;
  slow: number;
  /** THE LOAD ZONE at the bottom station: its middle `at` m up the line
   * from the wheel (negative: down it, behind), `along` m either way of
   * that and `across` m either side of `side` m right of the line; the
   * fastest a skier may come into it, m/s, and the most his skis may point
   * off the way up the line, rad; and the seconds he is taken from where
   * he came in to where he is carried off. */
  entry: {
    at: number;
    along: number;
    side: number;
    across: number;
    fastest: number;
    turned: number;
    board: number;
  };
  /** Where a rider leaves it: `off` m short of the top, down the line. */
  off: number;
};

export const LIFT_LOOK: Readonly<Record<LiftKind, LiftLook>> = {
  gondola: {
    spacing: 140,
    minSpan: 40,
    tower: 18,
    towerMax: 34,
    in: { back: 34, fall: 0.22 },
    rail: 8,
    column: 0.9,
    wheel: 6,
    gauge: 6,
    sag: 0.02,
    hang: 4.3,
    under: 3,
    every: 70,
    house: { length: 16, width: 6, height: 8 },
    speed: 6,
    slow: 0.4,
    entry: { at: -17.5, along: 4, side: 0, across: 6, fastest: 6, turned: 1.4, board: 2 },
    off: 0,
  },
  chair: {
    spacing: 110,
    minSpan: 35,
    tower: 13,
    towerMax: 28,
    in: { back: 30, fall: 0.22 },
    rail: RR.lift.unload.at + 3,
    column: 0.68,
    wheel: 3.8,
    gauge: 5,
    sag: 0.025,
    hang: 2.9,
    under: 2.5,
    every: 24,
    house: { length: 11, width: 5, height: 5.5 },
    speed: 5,
    slow: 1.2,
    entry: { at: 5, along: 5, side: 2.5, across: 2.4, fastest: 7, turned: 1.2, board: 1.2 },
    // The unload point over the ramp on its pad (R26).
    off: RR.lift.unload.at,
  },
  drag: {
    spacing: 85,
    minSpan: 30,
    tower: 7,
    towerMax: 12,
    in: { back: 0, fall: 0 },
    rail: 0,
    column: 0.28,
    wheel: 4,
    gauge: 0,
    sag: 0.02,
    hang: 1.5,
    under: 1.5,
    every: 18,
    house: { length: 4, width: 3, height: 2.6 },
    speed: 3,
    slow: 3,
    entry: { at: 4, along: 4, side: 1.2, across: 1.6, fastest: 6, turned: 0.9, board: 0.8 },
    // Let go short of the top wheel, where the ramps off its top leave
    // from (R26).
    off: RR.lift.drag.letGo,
  },
};

/** A tower's column at its head as a share of its foot. */
export const COLUMN_TAPER = 0.625;

/** One thing the rope is carried by: a station's bullwheel (at either end)
 * or a tower — how far up the line, m of plan, where, the snow's height
 * under it and the rope's height over that. */
export type Support = {
  u: number;
  x: number;
  z: number;
  ground: number;
  rope: number;
  station: boolean;
};

export type LiftPlan = {
  lift: Lift;
  look: LiftLook;
  /** The line's plan length, m, and its direction up the line, unit. */
  length: number;
  dx: number;
  dz: number;
  /** The heading up the line, rad — 0 is +z, clockwise from above. */
  heading: number;
  /** Bottom station, the towers in order, the top station. */
  supports: Support[];
};

/** How far a tower may be slid along the line off a piste, m. */
const SLIDE = 24;
/** The step a span is read at for clearance, m. */
const PROBE = 4;

/** The rope's height `u` m up the line — straight between two supports
 * save for its sag. */
export function ropeAt(plan: LiftPlan, u: number): number {
  const s = plan.supports;
  let i = 0;
  while (i + 2 < s.length && s[i + 1].u < u) i++;
  return spanRope(s, i, plan.look, u);
}

/** The rope `u` m up the line in the span from support `i` to the next:
 * straight save for its sag — and into the top, along the terminal's level
 * rail (`LiftLook.rail`), the span ending at the rail's mouth. */
function spanRope(s: readonly Support[], i: number, look: LiftLook, u: number): number {
  const b = s[i + 1];
  if (i + 2 < s.length || look.rail <= 0) return ropeBetween(s[i], b, look.sag, u);
  const wheel = b.ground + b.rope;
  const mouth = b.u - look.rail;
  if (u >= mouth || mouth <= s[i].u) return u >= mouth ? wheel : ropeBetween(s[i], b, look.sag, u);
  return ropeBetween(s[i], { ...b, u: mouth, ground: wheel, rope: 0 }, look.sag, u);
}

function ropeBetween(a: Support, b: Support, sag: number, u: number): number {
  const span = Math.max(1e-6, b.u - a.u);
  const t = Math.min(1, Math.max(0, (u - a.u) / span));
  return (
    a.ground + a.rope + (b.ground + b.rope - a.ground - a.rope) * t - 4 * sag * span * t * (1 - t)
  );
}

/** The clearance the rope owes the snow `u` m up a line `length` long: the
 * whole of it out on the line, and less near a station, where the rope
 * comes down to its bullwheel and the carriers to the snow. */
function owed(look: LiftLook, kind: LiftKind, length: number, u: number): number {
  const near = Math.min(u, length - u);
  // Over the load line and the unload ramp the carriers come down to a
  // skier's height on purpose — a chair's seat or a cabin's floor to the
  // snow, never through it; a drag's rope only ever over it.
  // Along the top's rail the unload ramp is raised to the chair's seat.
  if (length - u <= look.rail) return 0;
  // Coming down off the last tower onto the rail, a carrier's clearance.
  if (near < look.off + 6 || length - u < look.rail + 8) return kind === "drag" ? 0 : look.hang;
  return Math.min(look.hang + look.under, look.wheel * 0.8 + near * 0.15);
}

/** HOW FAR A CARRIER RUNS INTO THE SNOW anywhere along a planned lift, m,
 * and where (`u` up the line) — 0 where every carrier's lowest point
 * (`hang` under the rope; a drag's bar `DRAG_HOLD`) clears the snow, out of
 * the load and unload zones at either end (`off` + `ZONE` m of a wheel),
 * where it comes down to the skier on purpose (R26). */
export function ropeShortfall(level: Level, plan: LiftPlan): { lack: number; u: number } {
  const need = plan.lift.kind === "drag" ? DRAG_HOLD : plan.look.hang;
  const zone = plan.look.off + ZONE;
  let worst = { lack: 0, u: 0 };
  for (let u = zone; u < plan.length - zone; u += PROBE / 2) {
    const x = plan.lift.bottom.x + plan.dx * u;
    const z = plan.lift.bottom.z + plan.dz * u;
    const lack = need - (ropeAt(plan, u) - level.groundAt(x, z));
    if (lack > worst.lack) worst = { lack, u };
  }
  return worst;
}

/** How far past a station's load or unload point a carrier is held clear
 * of the snow, m, and the rope a drag's skier is pulled under, m. */
const ZONE = 4;
const DRAG_HOLD = 1;

/** THE PLAN of one lift: its towers spread evenly near `spacing`, each slid
 * off a groomed run where it can be, then a tower put in under the worst
 * crest of every span the rope would not clear — and a tower raised where
 * a span is too short to split. Pure: the same lift on the same map plans
 * the same. */
export function planLift(level: Level, lift: Lift): LiftPlan {
  const look = LIFT_LOOK[lift.kind];
  const ex = lift.top.x - lift.bottom.x;
  const ez = lift.top.z - lift.bottom.z;
  const length = Math.max(1, hypot(ex, ez));
  const dx = ex / length;
  const dz = ez / length;
  const at = (u: number, station = false, rope = look.tower): Support => {
    const x = lift.bottom.x + dx * u;
    const z = lift.bottom.z + dz * u;
    return { u, x, z, ground: level.groundAt(x, z), rope: station ? look.wheel : rope, station };
  };
  // A tower off the groomer: the nearest slide along the line onto snow no
  // run is packed on, or where it was.
  const offPiste = (u: number, lo: number, hi: number): number => {
    for (let d = 0; d <= SLIDE; d += 4) {
      for (const v of d === 0 ? [u] : [u + d, u - d]) {
        if (v <= lo || v >= hi) continue;
        if (level.packedAt(lift.bottom.x + dx * v, lift.bottom.z + dz * v) < 0.3) return v;
      }
    }
    return u;
  };
  const supports: Support[] = [at(0, true)];
  const n = Math.max(0, Math.round(length / look.spacing) - 1);
  for (let i = 1; i <= n; i++) {
    const u = (i * length) / (n + 1);
    supports.push(at(offPiste(u, look.minSpan, length - look.minSpan)));
  }
  supports.push(at(length, true));
  supports.sort((a, b) => a.u - b.u);
  // THE WAY IN: the towers short of the top give way to one standing
  // `in.back` m short of it, its rope over the top wheel's by the fall
  // into the terminal — tall where the mountain climbs to the top, and
  // raised further below if the span still meets a shoulder.
  const into = look.in.back;
  if (into > 0 && length - into - SLIDE > look.minSpan) {
    let u = length - into;
    for (let d = 0; d <= SLIDE; d += 2) {
      const v = length - into - d;
      if (level.packedAt(lift.bottom.x + dx * v, lift.bottom.z + dz * v) < 0.3) {
        u = v;
        break;
      }
    }
    for (let i = supports.length - 2; i > 0; i--) {
      if (supports[i].u > u - look.minSpan) supports.splice(i, 1);
    }
    const last = at(u);
    const wheel = supports[supports.length - 1];
    const want = wheel.ground + wheel.rope + (length - u) * look.in.fall - last.ground;
    last.rope = Math.min(look.towerMax, Math.max(look.tower, want));
    supports.splice(supports.length - 1, 0, last);
  }

  // Every span the rope would not clear gets a tower under its worst crest
  // (or, too short to split, its towers raised by what it lacks).
  const given = new Set<Support>();
  for (let guard = 0; guard < 400; guard++) {
    let worst = 0;
    let where = -1;
    let span = -1;
    for (let i = 0; i + 1 < supports.length; i++) {
      const a = supports[i];
      const b = supports[i + 1];
      if (given.has(a)) continue;
      for (let u = a.u + PROBE; u < b.u; u += PROBE) {
        const lack =
          owed(look, lift.kind, length, u) - (spanRope(supports, i, look, u) - at(u).ground);
        if (lack > worst) {
          worst = lack;
          where = u;
          span = i;
        }
      }
    }
    if (span < 0 || worst < 0.05) break;
    const a = supports[span];
    const b = supports[span + 1];
    if (b.u - a.u >= 2 * look.minSpan) {
      const u = Math.min(b.u - look.minSpan, Math.max(a.u + look.minSpan, where));
      supports.splice(span + 1, 0, at(offPiste(u, a.u + look.minSpan, b.u - look.minSpan)));
      continue;
    }
    // Too short to split: raise its towers (never a station) by the lack.
    let raised = false;
    for (const s of [a, b]) {
      if (s.station || s.rope >= look.towerMax) continue;
      s.rope = Math.min(look.towerMax, s.rope + worst + 0.1);
      raised = true;
    }
    if (!raised) given.add(a);
  }
  return { lift, look, length, dx, dz, heading: Math.atan2(dx, dz), supports };
}

/** THE WAY OFF A CHAIR'S TOP (`docs/summit-stations.md`): stood up at the
 * unload, a rider slides straight on down the ramp in a LANE `out` m
 * outside the up rope — clear of the chairs swinging round the wheel — to
 * the PARTING `exit` m past the wheel, where the paths go off either way
 * across the pad in front of the SIGNS `signs` m past it. The top's HOUSE
 * stands on the lane's outer side, `house` m clear of it, ending a step
 * short of the parting. */
export const CHAIR_EXIT = { out: 2.4, exit: 3, signs: 14, house: 2.2 } as const;

/** A chair top's way off, in the line's frame (`u` m up it from the
 * bottom, `v` m to the up rope's side): the lane's `v`, the parting's
 * `u`, the signs' `u`. */
export function chairLane(plan: LiftPlan): { v: number; exit: number; signs: number } {
  return {
    v: plan.look.gauge / 2 + CHAIR_EXIT.out,
    exit: plan.length + CHAIR_EXIT.exit,
    signs: plan.length + CHAIR_EXIT.signs,
  };
}

/** A STATION'S HOUSE as it stands: its middle on the snow, its foot and its
 * roof's underside, m, and its half-width across the line and half-length
 * along it. Behind the wheel, about the ropes, down the line from a
 * bottom station and up it from a gondola's or a drag's top; at a chair's
 * top beside the way off (`CHAIR_EXIT`), so a rider stood off the chair
 * slides on past it. On a slope it is footed on its lowest corner and
 * stands to its height over the snow at its middle. What `lifts.ts` draws
 * and the lens is kept out of. */
export type StationHouse = {
  x: number;
  z: number;
  base: number;
  top: number;
  halfWidth: number;
  halfLength: number;
  plan: LiftPlan;
  wheel: Support;
};

export function stationHouses(level: Level, plan: LiftPlan): StationHouse[] {
  const h = plan.look.house;
  const halfLength = h.length / 2;
  return [plan.supports[0], plan.supports[plan.supports.length - 1]].map((s) => {
    const top = s.u !== 0;
    const beside = top && plan.lift.kind === "chair";
    const halfWidth = beside ? h.width / 2 : (h.width + plan.look.gauge) / 2;
    // Along the line from the wheel, and across it.
    const along = beside ? CHAIR_EXIT.exit - 0.5 - halfLength : (top ? 1 : -1) * (halfLength + 1.5);
    const across = beside ? chairLane(plan).v + CHAIR_EXIT.house + halfWidth : 0;
    const x = s.x + plan.dx * along + plan.dz * across;
    const z = s.z + plan.dz * along - plan.dx * across;
    let lo = Infinity;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        lo = Math.min(
          lo,
          level.groundAt(
            x + plan.dx * a * halfLength + plan.dz * b * halfWidth,
            z + plan.dz * a * halfLength - plan.dx * b * halfWidth,
          ),
        );
      }
    }
    return {
      x,
      z,
      base: lo - 0.5,
      top: level.groundAt(x, z) + h.height,
      halfWidth,
      halfLength,
      plan,
      wheel: s,
    };
  });
}

/** What a thing stood beside a lift keeps clear of, m: past a station
 * house's walls, and either side of the line (its ropes, its towers, its
 * drag track). */
const LIFT_CLEAR = { house: 3, line: 3.5 };

/** Whether (x, z) stands clear of every lift of the area — its two station
 * houses (behind each wheel, along the line, as `LIFT_LOOK` measures them)
 * and the line from wheel to wheel. What a sign, a light mast and a lens
 * are stood by. */
export function clearOfLifts(level: Level, x: number, z: number): boolean {
  for (const lift of level.resort?.lifts ?? []) {
    const look = LIFT_LOOK[lift.kind];
    const ex = lift.top.x - lift.bottom.x;
    const ez = lift.top.z - lift.bottom.z;
    const len = Math.max(1, hypot(ex, ez));
    const dx = ex / len;
    const dz = ez / len;
    // Along the line from the bottom wheel, and across it.
    const u = (x - lift.bottom.x) * dx + (z - lift.bottom.z) * dz;
    const v = Math.abs((x - lift.bottom.x) * dz - (z - lift.bottom.z) * dx);
    if (u > -LIFT_CLEAR.line && u < len + LIFT_CLEAR.line && v < look.gauge / 2 + LIFT_CLEAR.line)
      return false;
    const reach = look.house.length + 1.5 + LIFT_CLEAR.house;
    const across = (look.house.width + look.gauge) / 2 + LIFT_CLEAR.house;
    if (v < across && ((u <= 0 && u > -reach) || (u >= len && u < len + reach))) return false;
  }
  return true;
}

/** Every lift of a map's resort planned, once per map: a skier riding one
 * reads its rope every step. */
const plans = new WeakMap<Level, LiftPlan[]>();
export function liftPlans(level: Level): readonly LiftPlan[] {
  let out = plans.get(level);
  if (!out) {
    out = (level.resort?.lifts ?? []).map((l) => planLift(level, l));
    plans.set(level, out);
  }
  return out;
}

/** The rope a carrier rides up, m right of the line: a drag's one rope on
 * its arm's reach, otherwise the up side of the gauge. */
export const DRAG_ARM = 1.2;
export function upRope(plan: LiftPlan): number {
  return plan.lift.kind === "drag" ? DRAG_ARM : plan.look.gauge / 2;
}

/** A lift's carriers round its loop: how many, evenly spaced every
 * `every` m or a little more, up one side and back down the other. */
export function carrierCount(plan: LiftPlan): number {
  return Math.max(1, Math.floor((2 * plan.length) / plan.look.every));
}

/** THE LIFTS ALWAYS RUN: where carrier `k` of a lift is at the engine's
 * clock `t` — `u` m of plan up the line, on the up rope (`side` 0) or the
 * down (1), and whether it is out on the line rather than turning in a
 * station. A pure function of the clock, never stepped: the app hangs
 * every chair, cabin and T-bar by it on every map in every mode, a replay
 * hangs them where the run did, and a skier seated on carrier `k` (a
 * rider of the field, one day) is wherever it is. */
export function carrierAt(
  plan: LiftPlan,
  k: number,
  t: number,
): { u: number; side: 0 | 1; out: boolean } {
  const loop = 2 * plan.length;
  const at = ((((k * loop) / carrierCount(plan) + plan.look.speed * t) % loop) + loop) % loop;
  const side = at < plan.length ? 0 : 1;
  const u = side === 0 ? at : loop - at;
  const clear = plan.lift.kind === "gondola" ? GONDOLA_IN_STATION : 2;
  return { u, side, out: u > clear && u < plan.length - clear };
}

/** How far into its stations a gondola's cabin goes out of sight, m. */
const GONDOLA_IN_STATION = 7;

/** How far apart a queue stands, m, and how far past the corral's mouth
 * the lane runs on for a long one, m. */
export const QUEUE_GAP = 1.5;

/** THE QUEUE'S LANE at a lift's foot, from where a skier boards back out
 * through the corral, as points (`u` m up the line from the bottom wheel,
 * `v` m right of it): a chair's and a drag's from the load line under the
 * up rope, a step back, then out on the diagonal past the station house;
 * a gondola's straight back from the door in the back of its house. The
 * drawn corral (`station-plan.ts`) is fenced along it and the crowd queues
 * on it (`crowd-lift.ts`). */
export function queueLane(plan: LiftPlan): { u: number; v: number }[] {
  const e = plan.look.entry;
  const h = plan.look.house;
  if (plan.lift.kind === "gondola")
    return [
      { u: e.at, v: 0 },
      { u: e.at - 40, v: 0 },
    ];
  const clear = h.width / 2 + plan.look.gauge / 2 + 3;
  const mouth = { u: e.at - 7, v: clear + 1 };
  const du = mouth.u - (e.at - 1);
  const dv = mouth.v - e.side;
  const k = 40 / (hypot(du, dv) || 1);
  return [
    { u: e.at, v: e.side },
    { u: e.at - 1, v: e.side },
    mouth,
    { u: mouth.u + du * k, v: mouth.v + dv * k },
  ];
}

/** Place `i` in a lift's queue (0 on the load line): where, and the way
 * he faces — up the lane toward the load line. */
export function queueSpot(plan: LiftPlan, i: number): { x: number; z: number; heading: number } {
  const lane = queueLane(plan);
  let left = i * QUEUE_GAP;
  for (let k = 0; k + 1 < lane.length; k++) {
    const a = lane[k];
    const b = lane[k + 1];
    const seg = hypot(b.u - a.u, b.v - a.v);
    if (left <= seg || k + 2 === lane.length) {
      const t = seg > 0 ? Math.min(1, left / seg) : 0;
      const u = a.u + (b.u - a.u) * t;
      const v = a.v + (b.v - a.v) * t;
      // Facing back along the lane toward the load line, in the world.
      const fu = a.u - b.u;
      const fv = a.v - b.v;
      const fx = plan.dx * fu + plan.dz * fv;
      const fz = plan.dz * fu - plan.dx * fv;
      return {
        x: plan.lift.bottom.x + plan.dx * u + plan.dz * v,
        z: plan.lift.bottom.z + plan.dz * u - plan.dx * v,
        heading: Math.atan2(fx, fz),
      };
    }
    left -= seg;
  }
  return { x: plan.lift.bottom.x, z: plan.lift.bottom.z, heading: plan.heading };
}

/** The carrier passing up-line `u` m between `t - dt` and `t`, or -1: the
 * one a skier waiting there is taken by. */
export function carrierPassing(plan: LiftPlan, u: number, t: number, dt: number): number {
  const n = carrierCount(plan);
  const loop = 2 * plan.length;
  const gap = loop / n;
  const v = plan.look.speed;
  // Carrier k is at (k·gap + v·t) mod loop; it crosses `u` when that comes
  // to `u` + m·loop.
  const p1 = (v * t - u) / gap;
  const p0 = (v * (t - dt) - u) / gap;
  if (Math.floor(p1) === Math.floor(p0)) return -1;
  const k = Math.round(-Math.floor(p1)) % n;
  return (k + n) % n;
}
