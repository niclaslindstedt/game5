// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS FLIGHT (`RunRules.aerials`, R44): the air off an aerials
// kicker flown as a TWISTING SOMERSAULT — what the strokes (`strokes.ts`)
// cannot turn, because they throw the two axes apart and a body rate held
// about a fixed body axis is a tilted spin, not a twist inside a flip.
//
// THE INPUT. Each tap of the lean BACK across its gate (`TUNING.tricks.
// flipGate`) is a FLIP owed; each tap of the edge across its gate is a FULL
// TWIST owed, the way the edge went, turned inside the flip under way; the
// trick button held is the TUCK. A tap held up the kicker counts at the
// lip, as a stroke set up on a ramp does. The lean forward and the grabs
// mean nothing here (the chart's jumps are all back jumps).
//
// THE MOTION. A somersault turns about the side axis the skier left the
// snow on — a fixed axis in the world, his angular momentum's — and the
// twist about his own long axis; the attitude is
//
//   q(φ, ψ) = R(a, −φ) ⊗ q₀ ⊗ R(ŷ, ψ)
//
// for a somersault φ (tips up) about the world axis `a` (the body's right
// at the first tap) and a twist ψ about the body's up. A whole number of
// twists brings him back square, so the jump lands where a plain flip
// would. Each step the controller asks the body for the rates that carry
// it from where it IS to the attitude planned for the next step
// (`q⁻¹ ⊗ q_next`, the step `integrate` takes), so the air's own hands
// drift nothing.
//
// THE PACE. The somersault owed is the flips less what the take-off and
// the landing hill already give: he leaves the kicker tipped up and lands
// tipped down the 37° hill, so n flips turn 2πn less (pitch₀ − pitch at the
// snow). It is paced to finish `TUNING.tricks.finish` s before the snow,
// gathered and eased as a stroke is. Each twist is paced to finish by the
// end of the flip it was asked in — the flips are equal shares of the
// somersault — at no more than `AERIAL_FLIGHT.twistMost`.
//
// THE READING. Every step's twist and every step tucked are filed against
// the somersault turned so far (`bins`), so at the snow the twists and the
// tuck are split into the flips the judges count however late the flips
// were asked for (`readAerial`).
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same rotation.

import { approach, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  rotate,
  toEuler,
  type Quat,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { fieldCoords } from "../mapgen/mogul-field.ts";
import { landingAhead } from "./flight.ts";
import { flightGravity } from "./limits.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState, SkierInput } from "./state.ts";

/** THE FLIGHT'S KNOBS: the somersault's cruise and gather, rad/s and
 * rad/s²; the most a twist turns at, rad/s (a triple full inside one flip
 * of ~0.9 s is ~20 rad/s); its gather; and the width of a reading bin of
 * the somersault, rad. */
export const AERIAL_FLIGHT = {
  flipRate: 3,
  flipAccel: 60,
  flipMost: 14,
  twistMost: 22,
  twistAccel: 160,
  bin: 0.1,
} as const;

/** A FLIGHT UNDER WAY or as it ended: the declared plan's code, the flips
 * and twists asked for (twists signed, right positive), the somersault and
 * twist turned, rad, the somersault the flips come to, the take-off
 * attitude and the world axis the somersault turns about, the gates'
 * memory, the twist and the tuck filed by somersault bin, the hardest
 * somersault rate, rad/s, how long after take-off the first flip was
 * asked, s, the air so far, s, and whether the flight is over (`read`). */
export type AerialFlight = {
  plan: string;
  flips: number;
  twists: number;
  phi: number;
  psi: number;
  total: number;
  phiRate: number;
  psiRate: number;
  q0: Quat | null;
  axis: { x: number; y: number; z: number };
  pitch0: number;
  leanWas: number;
  edgeWas: number;
  twistBins: number[];
  tuckBins: number[];
  peak: number;
  firstTap: number;
  air: number;
  tucked: boolean;
  read: AerialRead | null;
  /** Where up the kicker he is carried, m along the site (`aerial-kicker.ts`),
   * −1 off it. */
  wire: number;
};

/** ONE FLIP AS FLOWN: the twists turned in it (whole, rounded), the twist
 * itself, rad, and the share of it tucked. */
export type FlownFlip = { twists: number; twist: number; tuck: number };

/** A FLIGHT AS IT ENDED, for the judges: its flips as flown, the code they
 * spell, the hardest somersault rate, how late the first flip was asked,
 * the twist left owing at the snow, whether he came down still tucked,
 * and where on the site he met the snow (m along its line). */
export type AerialRead = {
  flips: FlownFlip[];
  code: string;
  peak: number;
  firstTap: number;
  owing: number;
  tucked: boolean;
  landedAt: number;
};

/** A flight before the kicker, declared `plan`. */
export function freshAerial(plan: string): AerialFlight {
  return {
    plan,
    flips: 0,
    twists: 0,
    phi: 0,
    psi: 0,
    total: 0,
    phiRate: 0,
    psiRate: 0,
    q0: null,
    axis: { x: 1, y: 0, z: 0 },
    pitch0: 0,
    leanWas: 0,
    edgeWas: 0,
    twistBins: [],
    tuckBins: [],
    peak: 0,
    firstTap: 0,
    air: 0,
    tucked: false,
    read: null,
    wire: -1,
  };
}

/** Which way an axis is across its gate: +1, −1, or 0 at trim. */
function across(value: number, gate: number): number {
  return value >= gate ? 1 : value <= -gate ? -1 : 0;
}

/** Whether the flight's controller has the skier's body this step. */
export function aerialFlying(state: GameState): boolean {
  const f = state.aerial;
  const c = state.skier;
  return !!f && f.q0 !== null && c.airborne && c.thrown === null && f.read === null;
}

const still: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** THE INPUT THE SKIER FLIES ON: once a flip is owed the body is the
 * flight's, and the lean and the edge are taps read here, never the air's
 * torque. */
export function aerialInput(state: GameState, input: SkierInput): SkierInput {
  if (!aerialFlying(state)) return input;
  still.tuck = input.tuck;
  still.reset = input.reset;
  return still;
}

/** The attitude at somersault `phi` and twist `psi`. */
function attitude(f: AerialFlight, phi: number, psi: number): Quat {
  const a = f.axis;
  const s = fromAxisAngle(a.x, a.y, a.z, -phi);
  return multiply(multiply(s, f.q0 as Quat), fromAxisAngle(0, 1, 0, psi));
}

/** The body rates that turn `q` into `next` over `dt`, into the skier. */
function ratesTo(q: Quat, next: Quat, dt: number, out: { x: number; y: number; z: number }): void {
  const inv = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  let d = multiply(inv, next);
  if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w };
  const s = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  if (s < 1e-9) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return;
  }
  const angle = 2 * Math.atan2(s, d.w);
  out.x = (d.x / s) * (angle / dt);
  out.y = (d.y / s) * (angle / dt);
  out.z = (d.z / s) * (angle / dt);
}

/** The landing hill's pitch where the flight comes down, rad (tips down
 * negative), and the time left, s. */
function snowAhead(state: GameState): { pitch: number; left: number; along: number } {
  const c = state.skier;
  const course = state.level.aerials;
  const down = landingAhead(c, state.level, flightGravity(state.rules));
  if (!down || !course || !state.level.bumps) return { pitch: 0, left: Infinity, along: 0 };
  const x = c.x + c.vx * down.t;
  const z = c.z + c.vz * down.t;
  const along = fieldCoords(state.level.bumps, x, z).along;
  const fall = course.yAt(along - 0.5) - course.yAt(along + 0.5);
  return { pitch: -Math.atan(fall), left: down.t, along };
}

const rate = { x: 0, y: 0, z: 0 };

/** ONE STEP OF THE AERIALS FLIGHT, after the skier has been stepped (his
 * flight is current), on a run whose rules fly one. `input` is what the
 * skier asked for. */
export function stepAerial(state: GameState, input: SkierInput): void {
  const f = state.aerial;
  if (!f || !state.rules.aerials) return;
  const c = state.skier;
  const T = TUNING.tricks;
  const A = AERIAL_FLIGHT;
  const dt = TUNING.dt;
  const lean = across(clamp(input.lean, -1, 1), T.flipGate);
  const edge = across(clamp(input.steer, -1, 1), T.spinGate);
  const course = state.level.aerials;
  if (!c.airborne || c.thrown !== null) {
    if (f.q0 !== null && f.read === null) land(state, f);
    // ARMED on the kicker: a tap held up it counts at the lip.
    const s = course && state.level.bumps ? fieldCoords(state.level.bumps, c.x, c.z).along : 0;
    const ramp = !!course && s > course.foot - 2 && s < course.lip + 1;
    f.leanWas = ramp ? 0 : lean;
    f.edgeWas = ramp ? 0 : edge;
    return;
  }
  if (f.read !== null) return;
  f.air += dt;
  // THE TAPS: a flip the lean back, a twist the edge, each on its crossing.
  const most = (state.rules.flipMost ?? 6 * Math.PI) / (2 * Math.PI);
  if (lean === 1 && f.leanWas !== 1 && f.flips < most) {
    if (f.q0 === null) {
      f.q0 = { ...c.q };
      f.axis = rotate(c.q, { x: 1, y: 0, z: 0 });
      f.pitch0 = toEuler(c.q).pitch;
      f.firstTap = f.air;
    }
    f.flips += 1;
  }
  f.leanWas = lean;
  const twistMost = (state.rules.spinMost ?? 12 * Math.PI) / (2 * Math.PI);
  if (edge !== 0 && edge !== f.edgeWas && f.q0 !== null && Math.abs(f.twists) < twistMost) {
    f.twists += edge;
  }
  f.edgeWas = edge;
  f.tucked = input.trick === true;
  if (f.q0 === null) return;

  // THE PACE: the somersault the flips come to, and the air left for it.
  const snow = snowAhead(state);
  f.total = Math.max(0, 2 * Math.PI * f.flips - (f.pitch0 - snow.pitch));
  const left = Math.max(0.05, snow.left - T.finish);
  const owed = f.total - f.phi;
  const want = owed <= 0 ? 0 : clamp(Math.max(A.flipRate, owed / left), 0, A.flipMost);
  f.phiRate = approach(
    f.phiRate,
    Math.min(want, Math.sqrt(2 * A.flipAccel * Math.max(0, owed))),
    A.flipAccel * dt,
  );
  const dPhi = Math.min(Math.max(0, owed), f.phiRate * dt);
  // THE TWIST: done by the end of the flip it is in.
  const share = f.flips > 0 ? f.total / f.flips : f.total;
  const end = share > 0 ? (Math.floor(f.phi / share) + 1) * share : f.total;
  const toEnd = f.phiRate > 0.5 ? Math.max(0.05, (end - f.phi) / f.phiRate - T.finish) : left;
  const twistOwed = 2 * Math.PI * f.twists - f.psi;
  const twistWant =
    Math.abs(twistOwed) < 1e-4
      ? 0
      : Math.sign(twistOwed) *
        Math.min(
          A.twistMost,
          Math.abs(twistOwed) / Math.min(toEnd, left),
          Math.sqrt(2 * A.twistAccel * Math.abs(twistOwed)),
        );
  f.psiRate = approach(f.psiRate, twistWant, A.twistAccel * dt);
  const dPsi =
    Math.sign(twistOwed) *
    Math.min(Math.abs(twistOwed), Math.abs(f.psiRate) * dt) *
    (Math.sign(f.psiRate) === Math.sign(twistOwed) ? 1 : 0);
  // FILED by where in the somersault it was turned.
  const bin = Math.floor(f.phi / A.bin);
  while (f.twistBins.length <= bin) {
    f.twistBins.push(0);
    f.tuckBins.push(0);
  }
  f.twistBins[bin] += dPsi;
  if (f.tucked) f.tuckBins[bin] += dPhi;
  f.phi += dPhi;
  f.psi += dPsi;
  f.peak = Math.max(f.peak, f.phiRate);
  // THE BODY carried to the attitude planned for the next step.
  ratesTo(c.q, attitude(f, f.phi, f.psi), dt, rate);
  c.wx = rate.x;
  c.wy = rate.y;
  c.wz = rate.z;
  // The figure folds while he tucks.
  state.tricks.pose = f.tucked ? "grab" : null;
}

/** THE FLIGHT READ at the snow: the twists and the tuck split into the
 * flips as the judges count them (equal shares of the somersault). */
function land(state: GameState, f: AerialFlight): void {
  const n = Math.max(1, f.flips);
  const share = f.total > 0 ? f.total / n : 1;
  const flips: FlipAcc[] = Array.from({ length: n }, () => ({ twist: 0, tuck: 0 }));
  for (let i = 0; i < f.twistBins.length; i++) {
    const k = clamp(Math.floor(((i + 0.5) * AERIAL_FLIGHT.bin) / share), 0, n - 1);
    flips[k].twist += f.twistBins[i];
    flips[k].tuck += f.tuckBins[i];
  }
  const flown: FlownFlip[] = flips.map((x) => ({
    twists: Math.round(Math.abs(x.twist) / (2 * Math.PI)),
    twist: x.twist,
    tuck: clamp(x.tuck / share, 0, 1),
  }));
  const c = state.skier;
  const along = state.level.bumps ? fieldCoords(state.level.bumps, c.x, c.z).along : 0;
  f.read = {
    flips: f.flips > 0 ? flown : [],
    code: f.flips > 0 ? spell(flown) : "",
    peak: f.peak,
    firstTap: f.firstTap,
    owing: Math.abs(2 * Math.PI * f.twists - f.psi) + Math.max(0, f.total - f.phi),
    tucked: f.tucked,
    landedAt: along,
  };
  state.tricks.pose = null;
}

type FlipAcc = { twist: number; tuck: number };

/** The chart's code for flips as flown: a tucked flip with no twist a T. */
function spell(flips: readonly FlownFlip[]): string {
  const letter = (x: FlownFlip): string =>
    x.twists === 0
      ? x.tuck > 0.5
        ? "T"
        : "L"
      : (["", "F", "dF", "tF"][x.twists] ?? `${x.twists}F`);
  return "b" + flips.map(letter).join("");
}
