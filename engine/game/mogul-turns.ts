// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TURNS AS A JUDGE WATCHES THEM (R42) — what the five turn judges of a
// moguls run see, read off the skier step by step while he is on the mogul
// line (`moguls-judge.ts` scores it). A judge watches three things
// (`docs/freestyle.md` § *Moguls*):
//
// - CARVING, half the score: a turn on every mogul (`turns`, the edge
//   thrown from one side to the other) and the skis cutting rather than
//   sliding (`skid`).
// - ABSORPTION AND EXTENSION, a quarter: the legs taking every mogul and
//   the skis kept on the snow — the steps he spends in the air off a mogul
//   rather than an air bump (`air`).
// - THE UPPER BODY, a quarter: quiet, facing down the fall line, the line
//   held — how far his way swings off the fall line (`swing`) and how far
//   off the track's middle he wanders (`line`).
//
// And the DEDUCTIONS: a complete stop (`stops`), a speed check — the skis
// thrown across to scrub speed (`checks`).
//
// Pure arithmetic on the skier's state, drawing nothing from any stream.

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import { fieldCoords, mogulShare } from "../mapgen/mogul-field.ts";
import type { GameState } from "./state.ts";

/** THE TURNS SO FAR: the steps read on the mogul line, the turns made (and
 * the side the edge is on), the sums of the skid, the swing off the fall
 * line and the wander off the line's middle, the steps in the air off a
 * mogul, the steps checking, the stops (and how long the one now under way
 * has lasted, s). */
export type MogulTurns = {
  steps: number;
  turns: number;
  side: number;
  skid: number;
  swing: number;
  line: number;
  air: number;
  checks: number;
  stops: number;
  still: number;
};

/** THE READER'S THRESHOLDS: the edge a turn is on, rad; the share of a
 * mogul a step must be on to be read; the speed under which he is
 * stopped, m/s, and for how long, s; the skid that is a speed check. */
export const TURN_READ = {
  edge: 0.12,
  on: 0.5,
  stopSpeed: 1,
  stopFor: 0.5,
  check: 0.8,
} as const;

/** A run's turns before its first step. */
export function freshTurns(): MogulTurns {
  return {
    steps: 0,
    turns: 0,
    side: 0,
    skid: 0,
    swing: 0,
    line: 0,
    air: 0,
    checks: 0,
    stops: 0,
    still: 0,
  };
}

/** ONE STEP READ: what the skier did on the mogul line, filed into
 * `state.mogulTurns`. */
export function stepMogulTurns(state: GameState, dt: number): void {
  const read = state.mogulTurns;
  const f = state.level.bumps;
  const p = state.progress;
  if (!read || !f || !p.started || p.finished || p.out) return;
  const c = state.skier;
  const at = fieldCoords(f, c.x, c.z);
  if (mogulShare(f, at.along) < TURN_READ.on) return;
  read.steps += 1;
  if (c.airborne) {
    read.air += 1;
    return;
  }
  const R = TURN_READ;
  const side = c.edge > R.edge ? 1 : c.edge < -R.edge ? -1 : read.side;
  if (side !== 0 && read.side !== 0 && side !== read.side) read.turns += 1;
  read.side = side;
  read.skid += c.skid;
  if (c.skid > R.check) read.checks += 1;
  if (c.speed > 1) read.swing += Math.abs(angleDiff(Math.atan2(c.vx, c.vz), f.heading));
  const line = f.lines.reduce(
    (m, l) => Math.min(m, Math.abs(at.across - l.offset) / (l.width / 2)),
    Infinity,
  );
  read.line += Math.min(2, line);
  if (c.speed < R.stopSpeed) {
    read.still += dt;
    if (read.still >= R.stopFor && read.still - dt < R.stopFor) read.stops += 1;
  } else read.still = 0;
}
