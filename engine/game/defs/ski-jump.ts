// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP'S NUMBERS — the contest (R43 builds its hill), from
// `docs/freestyle.md` § *Ski jumping* and `docs/specs/SKI_JUMPING.md`.
// Stated beside `modes.ts`, which re-exports them, so the modes' file stays
// under its cap; it imports nothing from `modes.ts` but types, so the two
// load in either order.

import type { SkiJumpHillId } from "../../mapgen/trick-rules.ts";
import type { Jury, RunRules } from "./run-rules.ts";
import type { SkiId } from "./skis.ts";

/** THE SKI JUMPING CONTEST'S NUMBERS. */
export const SKI_JUMP = {
  /** The FIRST ROUND's start list beside the player — fifty jumpers — the
   * best `final` to the FINAL ROUND in reverse order, and whether a TRIAL
   * round (counting nothing) is jumped first. */
  field: 49,
  final: 30,
  trial: true,
  /** The hill a contest is jumped on unless another is asked for. */
  hill: "large" as SkiJumpHillId,
  /** The start official's count, s, and the time after the green light to
   * leave the bar, s (the rules' 10 s). Past it the jumper has not
   * started. */
  countdown: 3,
  window: 10,
  /** THE PAIR: the jumping ski. */
  skis: "albatross" as SkiId,
  /** THE JURY'S WEATHER (est., `docs/specs/SKI_JUMPING.md`): a jumper is
   * held on the bar while the wind is outside its window — a gust past
   * 40 km/h — and the contest is held in no more than a steady fall. The
   * tail wind's own window (past 3 m/s) is the jury's on the bar, a later
   * phase's. */
  jury: { wind: 40 / 3.6, fall: 0.75 } as Jury,
} as const;

/** A SKI JUMP as a jumper is dealt it (R43): one jumper on the hill, the
 * start official's count and the window to leave the bar, the strict
 * gates (a fall a fall — nobody is stood back up mid-jump), the real g in
 * flight, no strokes, no grabs and no arcade score, the in-run ridden in
 * the crouch to the edge (`in-run.ts`) and the hill's own jump (`skiJump`).
 * The field is the contest's, dealt, never jumped. */
export function skiJumpRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: SKI_JUMP.countdown,
    contact: false,
    course: true,
    tricks: false,
    stunts: false,
    limit: 0,
    airGravity: 1,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "strict",
    window: SKI_JUMP.window,
    jury: SKI_JUMP.jury,
    inRun: true,
    skiJump: true,
    hockeyStop: true,
  };
}
