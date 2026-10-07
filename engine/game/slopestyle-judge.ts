// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SLOPESTYLE'S JUDGES (R38): a run SECTION-JUDGED, as the top level judges
// it (`docs/freestyle.md` § *Slopestyle*).
//
// THE TRICK JUDGES score each of the six sections 0–100 on what was done
// there: a rail section on the jib ridden — the degrees onto it and off
// it, the swaps, a press held, a rail over a box, a slide over a 50-50 —
// and a jump section on its flight, read and marked as big air marks one
// (`judge.ts`'s `impressionOf`, against the table's length). They sit as
// three panels of two, each panel scoring two consecutive sections; with
// fewer than six judges every mark counts, averaged and CUT to two
// decimals. A section nothing was done on scores little; every section
// after a FALL scores nothing.
//
// THE COMPOSITION JUDGES, a panel of three, score the whole run 0–100 for
// its FLOW (every section used, nothing stopped), its VARIETY (both kinds
// of jib, both stances on them, more than one way of turning in the air,
// the grabs) and its level overall; after a fall they give a SET score for
// each section completed (the rules have it fixed on the morning of the
// contest).
//
// THE SCORE is the trick judges' mean weighted 60 % and the composition
// 40 % — the rules' recommended split — cut to two decimals. Each judge's
// eye is dealt off a hash of the contest's seed, the run and the judge,
// never the run's stream (`judge.ts`'s `panelScore`).

import { nearestTrackPoint } from "../mapgen/query.ts";
import type { SlopeSection } from "../mapgen/types.ts";
import { impressionOf, panelScore, readTrick, trickKind } from "./judge.ts";
import type { FlightRecord, GameState, JibRecord } from "./state.ts";

/** The panels and how they mark. */
export const SLOPE_JUDGING = {
  /** The trick judges' share and the composition's (the rules' 60/40). */
  trickShare: 0.6,
  compositionShare: 0.4,
  /** Judges a section's trick panel marks it with, and the composition
   * panel's — at the top level nine in all: three panels of two and three
   * on the run. */
  trickJudges: 2,
  compositionJudges: 3,
  /** THE JIB'S DIFFICULTY, in steps: one for every quarter turn on and off,
   * `swap` a swap, `press` a press held `pressHeld` s, `rail` for a rail
   * over a box, `slide` for a slide ridden. A jib ridden whole scores
   * `floor` plus `span` of the `top` steps it reaches; one left before its
   * end is marked down by `short` and scores `shortMost` at the most. */
  swap: 1.5,
  press: 1,
  pressHeld: 0.5,
  rail: 1,
  slide: 1,
  floor: 30,
  span: 62,
  top: 8,
  short: 20,
  shortMost: 40,
  /** A section ridden past with nothing done on it. */
  nothing: 8,
  /** THE COMPOSITION: its floor, the most FLOW pays (every section used),
   * the most VARIETY pays (`kinds` different things done), and the share
   * of the trick judges' mean it carries — and the SET score a section
   * completed earns after a fall. */
  compFloor: 20,
  flow: 25,
  variety: 20,
  kinds: 6,
  level: 0.3,
  set: 10,
} as const;

/** A RUN SECTION-JUDGED: each section's trick score, the trick judges'
 * mean, the composition's, the score, and whether the run was a fall. */
export type SlopeScore = {
  sections: number[];
  trick: number;
  composition: number;
  total: number;
  fell: boolean;
};

const cut = (v: number): number => Math.floor(v * 100 + 1e-6) / 100;

/** How hard a jib ridden was, in steps (`SLOPE_JUDGING`). */
export function jibDifficulty(r: JibRecord): number {
  const J = SLOPE_JUDGING;
  return (
    r.on / 90 +
    r.off / 90 +
    r.swaps * J.swap +
    (r.press && r.pressed >= J.pressHeld ? J.press : 0) +
    (r.kind === "rail" ? J.rail : 0) +
    (r.stances.includes("slide") ? J.slide : 0)
  );
}

/** A JIB RIDDEN'S IMPRESSION, 0–100, before the panel's eyes. */
export function jibImpression(r: JibRecord): number {
  const J = SLOPE_JUDGING;
  const score = J.floor + J.span * Math.min(1, jibDifficulty(r) / J.top);
  return Math.max(1, Math.min(99, r.whole ? score : Math.min(J.shortMost, score - J.short)));
}

/** The arc down the course a point stands at, m. */
function arcOf(state: GameState, x: number, z: number): number {
  return nearestTrackPoint(state.level, x, z).s;
}

/** The flight thrown off a jump section's kicker: its longest. */
function flightOff(state: GameState, s: SlopeSection): FlightRecord | null {
  let best: FlightRecord | null = null;
  for (const f of state.tricks.flights) {
    if (f.x === undefined || f.z === undefined) continue;
    const at = arcOf(state, f.x, f.z);
    if (at < (s.lip ?? s.from) - 6 || at > (s.knuckle ?? s.to)) continue;
    if (!best || f.air > best.air) best = f;
  }
  return best;
}

/** The jib ridden in a rail section (`index` from 0): the best of them. */
function jibIn(state: GameState, index: number): JibRecord | null {
  let best: JibRecord | null = null;
  for (const r of state.tricks.jibs) {
    if (r.section !== index + 1) continue;
    if (!best || jibImpression(r) > jibImpression(best)) best = r;
  }
  return best;
}

/** THE RUN ON THE SNOW JUDGED, section by section, or null while it is on
 * or on a run with no slopestyle course. `seed` and `run` name the run the
 * judges' eyes are dealt for. */
export function judgeSlopestyle(state: GameState, seed: number, run: number): SlopeScore | null {
  const course = state.level.slopestyle;
  if (!course) return null;
  const p = state.progress;
  if (!p.finished && !p.out) return null;
  const J = SLOPE_JUDGING;
  const out = p.out !== null;
  // Where he went down: every section from it on scores nothing.
  const fellAt = out ? arcOf(state, state.skier.x, state.skier.z) : Infinity;
  const impressions: number[] = [];
  const kinds = new Set<string>();
  let used = 0;
  let completed = 0;
  course.sections.forEach((s, i) => {
    if (s.from >= fellAt) {
      impressions.push(0);
      return;
    }
    if (s.to <= fellAt) completed += 1;
    if (s.kind === "rail") {
      const r = jibIn(state, i);
      if (!r) {
        impressions.push(J.nothing);
        return;
      }
      if (r.whole) used += 1;
      kinds.add(r.kind);
      for (const st of r.stances) kinds.add(st);
      if (r.swaps > 0 || r.on > 0 || r.off > 0) kinds.add("turned-on-a-jib");
      impressions.push(jibImpression(r));
      return;
    }
    const f = flightOff(state, s);
    if (!f) {
      impressions.push(J.nothing);
      return;
    }
    const wentDown = f.outcome === "fell" || (out && s.to > fellAt);
    if (!wentDown) used += 1;
    const read = readTrick(f);
    kinds.add(trickKind(read));
    if (read.flips > 0) kinds.add(`flip-${read.flipDir}`);
    if (read.grabs.length > 0) kinds.add("grab");
    impressions.push(impressionOf(f, (s.knuckle ?? 0) - (s.lip ?? 0), wentDown));
  });
  // THE TRICK PANELS: two judges a section, every mark counted.
  const sections = impressions.map((m, i) =>
    m <= 0 ? 0 : panelScore(m, seed, run * 64 + i, J.trickJudges),
  );
  const trick = cut(sections.reduce((t, v) => t + v, 0) / sections.length);
  // THE COMPOSITION PANEL: flow, variety and level — or, after a fall, the
  // set score a section completed.
  const impression = out
    ? J.set * completed
    : J.compFloor +
      (J.flow * used) / course.sections.length +
      J.variety * Math.min(1, kinds.size / J.kinds) +
      J.level * trick;
  const composition =
    impression > 0
      ? panelScore(Math.min(99, impression), seed, run * 64 + 40, J.compositionJudges)
      : 0;
  const total = cut(J.trickShare * trick + J.compositionShare * composition);
  return { sections, trick, composition, total, fell: out };
}
