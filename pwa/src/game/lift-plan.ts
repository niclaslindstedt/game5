// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LIFT, AS A PLAN — where its towers stand, how high, and where its rope
// hangs between them (R26). Three-free, so the suite holds the plan to the
// ground (`tests/lifts_test.ts`) and `lifts.ts` only draws it.
//
// WHAT A LIFT LOOKS LIKE: a straight line up the mountain from a bottom
// station to a top one, a BULLWHEEL in each the haul rope turns round, and
// between them steel TOWERS carrying the rope on sheave trains at the ends
// of a crossarm — the rope going up on one side and coming back down on the
// other. A tower stands every hundred-odd metres and more often where the
// ground rolls over, since a rope is straight between two towers save for
// its sag and a crest under it would meet the cabins. A GONDOLA is the
// tallest and the widest-spaced, its cabins far apart; a CHAIR is lower,
// its chairs every couple of dozen metres; a DRAG is a short line of low
// poles and one rope, its T-bars hung on cords that reach down to a
// skier's hips.
//
// The numbers are a class's measured bands, not any one lift's: towers of
// 7–16 m, a span of 80–150 m, a sag of two or three hundredths of a span.

import type { Level, Lift } from "@engine";

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
};

export const LIFT_LOOK: Readonly<Record<LiftKind, LiftLook>> = {
  gondola: {
    spacing: 140,
    minSpan: 40,
    tower: 16,
    towerMax: 30,
    wheel: 6,
    gauge: 6,
    sag: 0.02,
    hang: 4.3,
    under: 3,
    every: 70,
    house: { length: 16, width: 6, height: 8 },
  },
  chair: {
    spacing: 110,
    minSpan: 35,
    tower: 11,
    towerMax: 22,
    wheel: 5,
    gauge: 5,
    sag: 0.025,
    hang: 2.9,
    under: 2.5,
    every: 24,
    house: { length: 11, width: 5, height: 5.5 },
  },
  drag: {
    spacing: 85,
    minSpan: 30,
    tower: 7,
    towerMax: 12,
    wheel: 4,
    gauge: 0,
    sag: 0.02,
    hang: 1.5,
    under: 1.5,
    every: 18,
    house: { length: 4, width: 3, height: 2.6 },
  },
};

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
  return ropeBetween(s[i], s[i + 1], plan.look.sag, u);
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
function owed(look: LiftLook, length: number, u: number): number {
  const near = Math.min(u, length - u);
  return Math.min(look.hang + look.under, look.wheel * 0.8 + near * 0.15);
}

/** THE PLAN of one lift: its towers spread evenly near `spacing`, each slid
 * off a groomed run where it can be, then a tower put in under the worst
 * crest of every span the rope would not clear — and a tower raised where
 * a span is too short to split. Pure: the same lift on the same map plans
 * the same. */
export function planLift(level: Level, lift: Lift): LiftPlan {
  const look = LIFT_LOOK[lift.kind];
  const ex = lift.top.x - lift.bottom.x;
  const ez = lift.top.z - lift.bottom.z;
  const length = Math.max(1, Math.hypot(ex, ez));
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
        const lack = owed(look, length, u) - (ropeBetween(a, b, look.sag, u) - at(u).ground);
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
