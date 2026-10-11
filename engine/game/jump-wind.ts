// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AT A SKI JUMPING HILL (R43) — the wind a jump is flown in and
// the one the hill's STATIONS measure for the compensation, as a pure
// function of a contest's day.
//
// WHY A WIND OF ITS OWN. The map's wind (`wind.ts`) is folded so it never
// blows UP the mountain — a gale in a skier's face is no fun on a piste —
// and a jumping hill's landing slope faces down the mountain, so that wind
// is a TAIL wind on every jump of every seed. A hill's real air is its own:
// it stands in a sheltered hollow, the valley's breeze comes up its landing
// slope as often as the day's wind comes down it, and what matters is the
// part ALONG ITS AXIS — head (up the landing hill, positive) or tail. So the
// hill's air is dealt here, off a seed of its own, sized by the map's day
// (a windy map's hill is a gustier, wider one) and never drawn from
// `state.rng`: the field jumps in the same air the player does, at its own
// moments of the same day.
//
// ITS SHAPE (`HILL_AIR`): the day's MEAN along the hill dealt about a small
// head wind, SWINGING over the day on periods of a quarter to two hours —
// so one round is a head-wind round and the next may be a tail-wind one —
// and GUSTS of a few seconds riding it, blown along the hill, so the
// stations down the slope read them one after another; across the hill a
// slow swing about nothing. A moment is the CONTEST'S CLOCK, s: a jump's
// own run clock is laid on it from `HillAir.clock`.
//
// THE STATIONS stand along the landing hill at the edge and at a quarter,
// a half, three quarters and the whole of K's distance (`HILL_AIR.stations`)
// and each is read as the jumper passes it; their mean is the wind the
// jump is compensated for.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { weatherOf, type Level } from "../mapgen/index.ts";
import { HILL_AIR } from "./defs/ski-jump.ts";

/** THE AIR AT A HILL ON A DAY: the seed its gusts and swings are hashed
 * from, the spread of its mean, m/s, the day's mean about which it swings,
 * m/s along the hill (head positive), and the moment of the contest's day
 * a run's clock starts at, s. */
export type HillAir = { seed: number; spread: number; base: number; clock: number };

/** The wind along and across the hill at a moment and a place: m/s, head
 * (up the landing hill) positive, across to the jumper's right. */
export type HillWind = { head: number; across: number };

/** A number in [0, 1) hashed from a seed and a salt. */
function hash01(seed: number, salt: number): number {
  let h = Math.imul((seed ^ Math.imul(salt, 0x2c1b3c6d)) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** THE HILL'S AIR on `level`'s day, dealt off `seed`, with a run's clock
 * starting at `clock` s of the day. */
export function hillAirOf(level: Pick<Level, "weather">, seed: number, clock = 0): HillAir {
  const A = HILL_AIR;
  const spread = A.spread + A.perWind * Math.min(12, Math.max(0, weatherOf(level).wind));
  // Three uniforms summed: a bell about the bias, a spread either way.
  const bell = hash01(seed, 1) + hash01(seed, 2) + hash01(seed, 3) - 1.5;
  return { seed, spread, base: A.bias + spread * bell * 2, clock };
}

/** The hill's MEAN wind along it at `t` s of the day, m/s (head positive):
 * the day's mean and its slow swing, no gust. */
export function hillMeanAt(air: HillAir, t: number): number {
  const A = HILL_AIR;
  let swing = 0;
  for (let i = 0; i < A.swing.length; i++) {
    const s = A.swing[i];
    swing += s.share * Math.sin((TAU * t) / s.period + TAU * hash01(air.seed, 10 + i));
  }
  return clamp(air.base + air.spread * swing, A.least, A.most);
}

/** THE WIND at `t` s of the day `d` m of distance down the landing hill
 * from the edge: the mean and a gust blown along the hill to there. */
export function hillAirAt(air: HillAir, t: number, d: number): HillWind {
  const A = HILL_AIR;
  const mean = hillMeanAt(air, t);
  const at = t - d / A.travel;
  let g = 0;
  for (let i = 0; i < A.gusts.length; i++) {
    const k = A.gusts[i];
    g += k.share * Math.sin((TAU * at) / k.period + TAU * hash01(air.seed, 20 + i));
  }
  const across =
    A.across * air.spread * Math.sin((TAU * t) / 3100 + TAU * hash01(air.seed, 30)) +
    0.5 * (A.gust + A.gustPer * Math.abs(mean)) * Math.sin((TAU * at) / 5.3 + hash01(air.seed, 31));
  return { head: mean + (A.gust + A.gustPer * Math.abs(mean)) * g, across };
}

/** The STATIONS' distances down the hill from the edge, m: the edge and
 * the shares of K's distance (`HILL_AIR.stations`). */
export function stationsOf(hill: { w: number }): readonly number[] {
  let at = STATIONS.get(hill.w);
  if (!at) {
    at = HILL_AIR.stations.map((f) => f * hill.w);
    STATIONS.set(hill.w, at);
  }
  return at;
}

/** The stations a hill's K reads, kept — the flight asks every step. */
const STATIONS = new Map<number, number[]>();

/** The time after the edge a jump of the field's passes each station, s —
 * a large hill's flight to K in ~4.3 s, a normal hill's in ~3.6 s, near
 * even down the slope (`make skijump-flight`'s design rows). */
export function stationTimes(hill: { w: number }): number[] {
  const toK = hill.w > 110 ? 4.3 : 3.6;
  return HILL_AIR.stations.map((f) => f * toK);
}

/** What the stations read for a jump that left the edge at `t` s of the
 * day and passed them on `times`: their mean along the hill, m/s, rounded
 * to the hundredth the scoreboard shows. */
export function measuredAt(
  air: HillAir,
  hill: { w: number },
  t: number,
  times = stationTimes(hill),
): number {
  const at = stationsOf(hill);
  let sum = 0;
  for (let i = 0; i < at.length; i++) sum += hillAirAt(air, t + times[i], at[i]).head;
  return Math.round((sum / at.length) * 100) / 100;
}
