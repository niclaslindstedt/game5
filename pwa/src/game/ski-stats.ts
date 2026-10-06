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
// engine's own answers: the carve the edge holds at race pace, round a
// ski cross's berm, and again at a super-G's and a downhill's (`cornerGrip`
// against `carveCurvature` on the full edge), the footprint's
// float in powder (`footprintOf`), how fast the pair rolls onto its edge,
// the hardest landing it takes whole (`harshSpeedOf`), how its legs take
// a mogul line (`bumpsOf`) and how little the pair weighs on a turn in the
// air (`spinOf`) — the same arithmetic the physics and the bot run at
// 120 Hz.
//
// ELEVEN AXES, because the catalog is twelve answers to a kind of snow and
// the snow has two kinds: what a pair does on the GROOMER (the top end, the
// edge's hold at race pace, round a berm, at a super-G's and at a
// downhill's, how quickly it goes edge to edge)
// and what it does OFF it
// (the float, how forgiving it is, the landing, the bumps, the spin). Every pair is best at
// something on this sheet and none is best at everything, which is the
// card's whole argument.
//
// The bars are RELATIVE TO THE ROSTER, not absolute: twelve pairs within
// a few percent of each other on an axis scaled from zero are twelve identical
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

/** The pace BERM is read at, m/s (65 km/h): a ski cross's banked turn,
 * taken at the low end of the 60–80 km/h a heat runs at (`docs/
 * disciplines.md` § Ski cross). */
const BERM_PACE = 18;

/** The pace SPEED CARVE is read at, m/s (108 km/h): a super-G's bend near
 * the top of its speed (a run's ~86 km/h mean, ~110 at its fastest —
 * `docs/disciplines.md`). */
const SPEED_PACE = 30;

/** The pace FAST BEND is read at, m/s (130 km/h): a downhill's fastest
 * bends (its peak 120–150 km/h, turns taken at 26 ± 4 m/s and faster). */
const DOWNHILL_PACE = 36;

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

/** HOW MUCH BEND IT HOLDS ROUND A BERM, m/s²: `carveOf` at a ski cross's
 * pace. There the slalom ski's tight arc has long since asked more than
 * its edge holds and the giant slalom ski's 30 m arc does not yet ask all
 * of its own; the ski-cross ski's 24 m arc asks all its grip there, and
 * that grip is more than the slalom ski's — which is that whole class. */
export function bermCarveOf(spec: SkiSpec): number {
  return carveOf(spec, BERM_PACE);
}

/** HOW MUCH BEND IT HOLDS AT SPEED, m/s²: `carveOf` at a super-G's pace.
 * There the giant slalom ski's arc asks more than its edge holds, as the
 * slalom ski's does at race pace, and the downhill ski's 50 m arc still
 * asks less than its edge could hold; the super-G ski's 45 m arc and its
 * grip are matched at this pace, which is that whole class. */
export function speedCarveOf(spec: SkiSpec): number {
  return carveOf(spec, SPEED_PACE);
}

/** HOW MUCH BEND IT HOLDS FLAT OUT, m/s²: `carveOf` at a downhill's pace,
 * where every pair's arc asks more than its edge holds but the speed ski's,
 * whose straight edge carves no bend at all — so the grip of a stiff,
 * flat, long race ski decides it, which is the downhill class. */
export function fastCarveOf(spec: SkiSpec): number {
  return carveOf(spec, DOWNHILL_PACE);
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

/** HOW WELL IT TAKES A MOGUL LINE, m/s per m: how fast the legs FOLD — their
 * stroke over the time the knee's give takes to let it go (the spring over
 * the folding damper, `legs.rate / legs.bump`) — over the length of ski
 * that has to fit between two bumps. A short ski on legs that give
 * quickly swallows a mogul every third of a second; a long ski on a speed
 * skier's legs, held stiff for the tuck, rides over the tops. */
export function bumpsOf(spec: SkiSpec): number {
  return (spec.legs.travel * spec.legs.rate) / spec.legs.bump / spec.length;
}

/** HOW EASILY THE PAIR TURNS IN THE AIR, 1/(kg·m²): the inverse of its
 * SWING WEIGHT — the pair's mass over its length squared, the inertia two
 * skis add about the body to every flip and every twist. A short, light
 * aerials ski is turned three times over and twisted inside each turn; a
 * speed ski's 27 kg over 2.4 m is not turned at all. */
export function spinOf(spec: SkiSpec): number {
  return 1 / (spec.gearMass * spec.length * spec.length);
}

type AxisKey = keyof typeof STRINGS.skisBars;
type Axis = { key: AxisKey; of: (spec: SkiSpec) => number };

/** The axes a pair is billed on, in the order they are drawn: the groomer
 * first, then what is off it. */
const AXES: readonly Axis[] = [
  { key: "top", of: (spec) => spec.topSpeed },
  { key: "edge", of: (spec) => carveOf(spec) },
  { key: "berm", of: bermCarveOf },
  { key: "speed", of: speedCarveOf },
  { key: "fast", of: fastCarveOf },
  { key: "quick", of: quicknessOf },
  { key: "float", of: floatOf },
  { key: "flex", of: forgivenessOf },
  { key: "landing", of: harshSpeedOf },
  { key: "bumps", of: bumpsOf },
  { key: "spin", of: spinOf },
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
