// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS' SPEC SHEET — what the ski card tells a skier about the pair
// they are about to take out.
//
// Every number here is DERIVED from the catalog (`engine/game/defs/skis.ts`)
// and the engine's own models rather than authored beside them, so a pair
// retuned in the catalog reads correctly on the card without anyone
// remembering a second table exists. The figures are the catalog's own
// numbers — the length, the waist, the sidecut radius, the pair's weight,
// and `topSpeed`, the documented expectation `tests/skier_test.ts` holds
// the physics to — and the bars the catalog cannot put a number on are the
// engine's own answers: the carve the edge holds at race pace and again at
// a super-G's (`cornerGrip` against `carveCurvature` on the full edge), the
// footprint's
// float in powder (`footprintOf`), how fast the pair rolls onto its edge,
// and the hardest landing it takes whole (`harshSpeedOf`) — the same
// arithmetic the physics and the bot run at 120 Hz.
//
// SEVEN AXES, because the catalog is seven answers to a kind of snow and
// the snow has two kinds: what a pair does on the GROOMER (the top end, the
// edge's hold at race pace and at speed, how quickly it goes edge to edge)
// and what it does OFF it
// (the float, how forgiving it is, the landing). Every pair is best at
// something on this sheet and none is best at everything, which is the
// card's whole argument.
//
// The bars are RELATIVE TO THE ROSTER, not absolute: seven pairs within a
// few percent of each other on an axis scaled from zero are seven identical
// full bars, which is a picture of nothing. The roster's own spread is the
// scale, and `BAR_FLOOR` keeps the worst pair's bar a bar rather than an
// empty slot.
//
// DOM-free: `tests/ski_card_test.ts` reads it on plain Node.

import {
  SKI_CATALOG,
  carveCurvature,
  cornerGrip,
  edgeLockAt,
  footprintOf,
  harshSpeedOf,
  type SkiSpec,
} from "@engine";

import { STRINGS } from "./strings.ts";

/** How much of the bar the roster's WORST pair on an axis still fills. */
const BAR_FLOOR = 0.3;

/** The pace EDGE HOLD is read at, m/s (72 km/h): a groomed bend at race
 * speed, where the difference between the classes is the difference. */
const RACE_PACE = 20;

/** The pace SPEED CARVE is read at, m/s (108 km/h): a super-G's bend near
 * the top of its speed (a run's ~86 km/h mean, ~110 at its fastest —
 * `docs/disciplines.md`). */
const SPEED_PACE = 30;

/** HOW MUCH BEND IT HOLDS AT RACE PACE, m/s² of lateral acceleration: the
 * arc the sidecut carves on the full edge at that speed (`carveCurvature`
 * on `edgeLockAt`) asks `v² × κ` of the snow, and the edge holds up to
 * `cornerGrip` — the lesser is the turn it carves clean. A slalom ski's
 * tight arc asks more than its edge holds and lets go; a downhill ski's
 * long arc never asks enough to use its edge; the giant slalom ski's
 * sidecut and grip are matched at this pace, which is the whole class. */
export function carveOf(spec: SkiSpec, pace = RACE_PACE): number {
  const asked = pace * pace * carveCurvature(spec, edgeLockAt(spec, pace));
  return Math.min(asked, cornerGrip(spec, 1));
}

/** HOW MUCH BEND IT HOLDS AT SPEED, m/s²: `carveOf` at a super-G's pace.
 * There the giant slalom ski's arc asks more than its edge holds, as the
 * slalom ski's does at race pace, and the downhill ski's 50 m arc still
 * asks less than its edge could hold; the super-G ski's 45 m arc and its
 * grip are matched at this pace, which is that whole class. */
export function speedCarveOf(spec: SkiSpec): number {
  return carveOf(spec, SPEED_PACE);
}

/** HOW WELL IT FLOATS, dimensionless: the reciprocal of the footprint's
 * sink — how little of itself a pair buries standing on fresh snow. A wide
 * rockered ski floats where a slalom ski bogs; exactly 1 on the reference. */
export function floatOf(spec: SkiSpec): number {
  return 1 / footprintOf(spec).sink;
}

/** HOW QUICKLY IT GOES EDGE TO EDGE, dimensionless: how fast the pair rolls
 * onto its edge (`footprintOf`'s `edgeRate` — the waist and the length)
 * over the arc its sidecut bends into, so a short narrow ski on a tight
 * radius reads quickest and a long downhill ski slowest. 1 on the
 * reference. */
export function quicknessOf(spec: SkiSpec): number {
  const ref = SKI_CATALOG[0];
  return (footprintOf(spec).edgeRate * ref.sidecut) / spec.sidecut;
}

/** HOW FORGIVING IT IS, dimensionless: a soft, rockered ski lets a skier
 * off a late edge or a landing in the back seat where a stiff race ski
 * throws him — the catalog's `flex` (stiff is high) and `rocker` (full
 * rocker is high) read against each other, on the reference's scale. */
export function forgivenessOf(spec: SkiSpec): number {
  const ref = SKI_CATALOG[0];
  const soft = (s: SkiSpec): number => 1 - s.flex + 0.5 * s.rocker;
  return soft(spec) / soft(ref);
}

type AxisKey = keyof typeof STRINGS.skisBars;
type Axis = { key: AxisKey; of: (spec: SkiSpec) => number };

/** The axes a pair is billed on, in the order they are drawn: the groomer
 * first, then what is off it. */
const AXES: readonly Axis[] = [
  { key: "top", of: (spec) => spec.topSpeed },
  { key: "edge", of: (spec) => carveOf(spec) },
  { key: "speed", of: speedCarveOf },
  { key: "quick", of: quicknessOf },
  { key: "float", of: floatOf },
  { key: "flex", of: forgivenessOf },
  { key: "landing", of: harshSpeedOf },
];

export type SkisBar = {
  key: string;
  label: string;
  /** BAR_FLOOR..1 — where this pair sits between the roster's worst and
   * best on the axis. Never 0: an empty bar reads as a missing value. */
  value: number;
};

/** Where every axis of one pair sits against the rest of the roster. */
export function skisBars(spec: SkiSpec): SkisBar[] {
  return AXES.map((axis) => {
    const all = SKI_CATALOG.map(axis.of);
    const low = Math.min(...all);
    const high = Math.max(...all);
    // A roster of one, or an axis every pair shares, is a full bar rather
    // than a division by zero.
    const share = high > low ? (axis.of(spec) - low) / (high - low) : 1;
    return {
      key: axis.key,
      label: STRINGS.skisBars[axis.key],
      value: BAR_FLOOR + (1 - BAR_FLOOR) * share,
    };
  });
}

export type SkisFact = {
  key: string;
  label: string;
  /** The figure ITSELF, not a rendered string: the card counts to it when
   * the pair changes (the framework's `hud/count`), and a counter cannot
   * interpolate "178 CM". */
  value: number;
  /** How many decimals it is read to. */
  places: number;
  unit: string;
};

/** The hard numbers, as figures rather than bars — what a skier reads off a
 * pair in the shop: the length in cm, the waist in mm, the sidecut radius in
 * m, the pair's weight with its bindings, boots and poles, and the top speed
 * the physics is held to. */
export function skisFacts(spec: SkiSpec): SkisFact[] {
  const F = STRINGS.skisFacts;
  const U = STRINGS.skisUnits;
  return [
    { key: "length", label: F.length, value: spec.length * 100, places: 0, unit: U.cm },
    { key: "waist", label: F.waist, value: spec.waist * 1000, places: 0, unit: U.mm },
    { key: "sidecut", label: F.sidecut, value: spec.sidecut, places: 0, unit: U.metres },
    { key: "weight", label: F.weight, value: spec.gearMass, places: 1, unit: U.kg },
    { key: "top", label: F.top, value: spec.topSpeed, places: 0, unit: U.speed },
  ];
}
