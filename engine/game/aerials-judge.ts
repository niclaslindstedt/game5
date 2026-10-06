// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS' FORMAL SCORE (R44) — not an impression but a judged score
// times the jump's DEGREE OF DIFFICULTY, as the freestyle rules write it
// (`docs/freestyle.md` § *Aerials*):
//
// - Five judges each score three parts: the AIR 0–2 (the take-off 0–1, the
//   height and distance 0–1), the FORM 0–5 (the body through every flip)
//   and the LANDING 0–3.
// - The high and the low of EACH part are dropped and the middle three of
//   each summed (at most 6 + 15 + 9 = 30), the sum times the DECLARED
//   jump's DD (`defs/aerial-jumps.ts`, the men's), CUT to two decimals.
// - The wrong number of flips or of twists against the plan is a DID NOT
//   FINISH; so is a jump in the final the jumper already jumped in a final
//   before. A fall is no DNF: it is a low landing, and the form stands.
//
// FORM is split per flip — each an equal share of the five — and each
// fault in a flip costs it a deduction off the band the rules give for a
// single, a double or a triple (`AERIAL_PANEL.bands`, the middle of each
// band): the twists split between the flips other than declared (a major
// fault), a layout bent toward a tuck (a minor one), the wrong position
// (the flip held to half its share), the flips thrown faster than a clean
// rotation (rushed), the last flip not kicked out before the snow, a twist
// still turning at it. LANDING is read off the landing's grade
// (`landingGrade`) and how it ended, a hand down capping it at 2.0 and the
// body at 1.5, and off where it came down against the knoll.
//
// Each judge's EYE — how he sees each part a few tenths either way — is
// dealt off a stream of the contest's own (its seed and the jump's number),
// never `state.rng`, so no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { aerialJump, flipsOf } from "./defs/aerial-jumps.ts";
import type { AerialRead } from "./aerial-flight.ts";
import type { FlightRecord } from "./flight-record.ts";
import type { GameState } from "./state.ts";

/** THE PANEL'S KNOBS (est. where the rules give no number): the judges;
 * each part's eye, points; the form's deduction a fault of each kind costs
 * a flip of a single, a double and a triple (the middle of the rules'
 * minor, medium and major bands); the share of the form a clean flip is
 * seen to earn; the somersault rate past which a flip is rushed and past
 * which it is badly rushed, rad/s; the tuck in a layout that is a bent
 * body; how late the first flip may come off the kicker and be clean, s,
 * and the latest that still earns the take-off anything; where past the
 * knoll a landing is ideal, m; the landing marks. */
export const AERIAL_PANEL = {
  judges: 5,
  eye: { air: 0.08, form: 0.2, landing: 0.15 },
  bands: {
    1: { minor: 0.6, medium: 1.9, major: 3.8 },
    2: { minor: 0.35, medium: 0.95, major: 1.9 },
    3: { minor: 0.25, medium: 0.65, major: 1.3 },
  } as Readonly<Record<1 | 2 | 3, { minor: number; medium: number; major: number }>>,
  clean: 0.86,
  rushed: 9.5,
  badlyRushed: 12,
  bent: 0.15,
  early: 0.2,
  late: 0.6,
  ideal: { from: 2, to: 4 },
  landing: { soft: 2.9, harsh: 2.1, hard: 1.5, hand: 2.0, body: 0.4, offHill: 0.4 },
} as const;

/** Why a jump scored nothing: the flips or the twists other than declared,
 * a jump repeated in the finals, or never off the start. */
export type AerialDnf = "flips" | "twists" | "repeat" | "start";

/** A JUMP'S SHEET: the jump declared and the jump flown, its DD, the five
 * judges' marks for each part, the middle three of each summed, their sum
 * (the score before the DD), the score, whether he fell, and why it is a
 * DID NOT FINISH (null when it is not). */
export type AerialSheet = {
  plan: string;
  flown: string;
  dd: number;
  marks: { air: number[]; form: number[]; landing: number[] };
  air: number;
  form: number;
  landing: number;
  raw: number;
  score: number;
  fell: boolean;
  dnf: AerialDnf | null;
};

const cut = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;
const tenth = (x: number): number => Math.round(x * 10) / 10;

/** THE MIDDLE THREE of five marks, summed (all of them for fewer). */
export function middleThree(marks: readonly number[]): number {
  const s = marks.slice().sort((a, b) => a - b);
  const kept = s.length >= 5 ? s.slice(1, s.length - 1) : s;
  return kept.reduce((a, b) => a + b, 0);
}

/** THE SCORE off the judges' marks for each part and the jump's DD: the
 * middle three of each part summed, the three summed, times the DD, cut to
 * two decimals — 5.7 + 12.3 + 8.0 = 26.0, × 5.100 = 132.60. */
export function aerialTotal(
  air: readonly number[],
  form: readonly number[],
  landing: readonly number[],
  dd: number,
): { air: number; form: number; landing: number; raw: number; score: number } {
  const a = tenth(middleThree(air));
  const f = tenth(middleThree(form));
  const l = tenth(middleThree(landing));
  const raw = tenth(a + f + l);
  return { air: a, form: f, landing: l, raw, score: cut(raw * dd) };
}

/** THE AIR one unbiased judge sees, 0–2: the take-off (the rotation begun
 * off the kicker, not after it) and the height and distance (the flight
 * down onto the hill 2–4 m past the knoll). */
export function airOf(read: AerialRead, knoll: number): number {
  const P = AERIAL_PANEL;
  const late = (read.firstTap - P.early) / (P.late - P.early);
  const takeoff = 1 - 0.6 * Math.min(1, Math.max(0, late));
  const d = read.landedAt - knoll;
  const off = d < P.ideal.from ? P.ideal.from - d : d > P.ideal.to ? d - P.ideal.to : 0;
  const distance = Math.max(0.3, 1 - 0.12 * off);
  return Math.min(2, takeoff + distance);
}

/** THE FORM one unbiased judge sees, 0–5, of `read` flown against the
 * flips `plan` declares. */
export function formOf(read: AerialRead, plan: string): number {
  const P = AERIAL_PANEL;
  const want = flipsOf(plan) ?? [];
  const n = Math.max(1, want.length);
  const band = P.bands[Math.min(3, n) as 1 | 2 | 3];
  const share = 5 / n;
  let form = 0;
  for (let k = 0; k < n; k++) {
    const flown = read.flips[k];
    const w = want[k];
    if (!flown || !w) continue;
    let mark = share * P.clean;
    if (flown.twists !== w.twists) mark -= band.major;
    if (w.twists === 0 && !w.tuck && flown.tuck > P.bent && flown.tuck <= 0.5) mark -= band.minor;
    if (w.twists > 0 && flown.tuck > P.bent) mark -= band.medium;
    if (read.peak > P.badlyRushed) mark -= band.medium;
    else if (read.peak > P.rushed) mark -= band.minor;
    const last = k === n - 1;
    if (last && read.tucked) mark -= band.medium;
    if (last && read.owing > 0.3) mark -= band.medium;
    // THE WRONG POSITION holds the flip to half its share.
    const tucked = flown.tuck > 0.5;
    if (w.twists === 0 && tucked !== w.tuck) mark = Math.min(mark, share / 2);
    form += Math.max(0, mark);
  }
  return Math.min(5, form);
}

/** THE LANDING one unbiased judge sees, 0–3, off how the flight ended:
 * landed whole (the softer the better, and less again past what the legs
 * take whole), a hand down (still tucked), or the body
 * on the snow; and less for one down on the knoll or out on the flat. */
export function landingOf(
  f: FlightRecord | null,
  read: AerialRead,
  knoll: number,
  hill: number,
): number {
  const L = AERIAL_PANEL.landing;
  if (!f || f.outcome === "fell") return L.body;
  // Still tucked at the snow is a hand down; a landing past what the legs
  // take whole (a triple's, often) is a hard one, marked down by how hard.
  const grade = f.landing ?? 1;
  let mark =
    f.outcome === "sketchy" && read.tucked
      ? L.hand - 0.3
      : L.soft - (L.soft - L.harsh) * Math.min(1, grade) - L.hard * Math.max(0, grade - 1);
  const d = read.landedAt - knoll;
  if (d < 0 || read.landedAt > hill) mark -= L.offHill;
  return Math.max(0, Math.min(3, mark));
}

/** Why the flight flown is no finish against `plan`, or null. */
export function dnfOf(read: AerialRead, plan: string): AerialDnf | null {
  const want = flipsOf(plan) ?? [];
  if (read.flips.length !== want.length) return "flips";
  const twists = (xs: readonly { twists: number }[]): number =>
    xs.reduce((s, x) => s + x.twists, 0);
  return twists(read.flips) !== twists(want) ? "twists" : null;
}

/** THE JUMP SCORED off what was flown — `read`, its flight record, the
 * site's knoll and landing hill's foot, m along — against `plan`, by the
 * panel whose eyes are jump `n` of the contest dealt off `seed`. `repeat`:
 * the plan was jumped in a final before (a DNF). */
export function scoreAerial(
  plan: string,
  read: AerialRead,
  flight: FlightRecord | null,
  site: { knoll: number; landing: number },
  seed: number,
  n: number,
  repeat = false,
): AerialSheet {
  const P = AERIAL_PANEL;
  const dd = aerialJump(plan)?.men ?? 0;
  const dnf: AerialDnf | null = repeat ? "repeat" : dnfOf(read, plan);
  const rng = createRng((seed ^ 0xae71a1) + n * 131 + 11);
  const air = airOf(read, site.knoll);
  const form = formOf(read, plan);
  const landing = landingOf(flight, read, site.knoll, site.landing);
  const marks = { air: [] as number[], form: [] as number[], landing: [] as number[] };
  for (let j = 0; j < P.judges; j++) {
    marks.air.push(tenth(Math.max(0, Math.min(2, air + rng.range(-P.eye.air, P.eye.air)))));
    marks.form.push(tenth(Math.max(0, Math.min(5, form + rng.range(-P.eye.form, P.eye.form)))));
    marks.landing.push(
      tenth(Math.max(0, Math.min(3, landing + rng.range(-P.eye.landing, P.eye.landing)))),
    );
  }
  const t = aerialTotal(marks.air, marks.form, marks.landing, dd);
  const fell = !flight || flight.outcome === "fell";
  return {
    plan,
    flown: read.code,
    dd,
    marks,
    ...t,
    score: dnf ? 0 : t.score,
    fell,
    dnf,
  };
}

/** THE JUMP ON THE SNOW SCORED — once the run is over (through the finish,
 * or out) — or null while it is on or on a map with no aerials site.
 * `repeat` as `scoreAerial`'s. */
export function judgeAerial(
  state: GameState,
  seed: number,
  n: number,
  repeat = false,
): AerialSheet | null {
  const site = state.level.aerials;
  const f = state.aerial;
  const p = state.progress;
  if (!site || !f || (!p.finished && !p.out)) return null;
  const read = f.read ?? {
    flips: [],
    code: "",
    peak: 0,
    firstTap: 0,
    owing: 0,
    tucked: false,
    landedAt: 0,
  };
  const flights = state.tricks.flights;
  const flight = flights.length > 0 ? flights[flights.length - 1] : null;
  if (p.out?.why === "start") {
    return {
      plan: f.plan,
      flown: "",
      dd: aerialJump(f.plan)?.men ?? 0,
      marks: { air: [], form: [], landing: [] },
      air: 0,
      form: 0,
      landing: 0,
      raw: 0,
      score: 0,
      fell: false,
      dnf: "start",
    };
  }
  // Thrown in the air or on the hill, the run is out: the body met the snow.
  const thrown = p.out?.why === "fall" && flight ? { ...flight, outcome: "fell" as const } : flight;
  return scoreAerial(f.plan, read, thrown, site, seed, n, repeat);
}
