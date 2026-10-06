// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DUAL MOGULS' NUMBERS — the contest (R43 builds its course; the format is
// `dual-bracket.ts`'s, the votes `dual-judge.ts`'s and a dual skied
// `duel.ts`'s), from `docs/freestyle.md` § *Dual moguls*. Stated beside
// `modes.ts`, which re-exports them, so the modes' file stays under its
// cap; it imports nothing from `modes.ts` but types.

import type { RunRules } from "./modes.ts";
import { MOGULS, mogulsRules } from "./moguls.ts";

/** THE DUAL MOGULS CONTEST'S NUMBERS. */
export const DUAL_MOGULS = {
  /** The qualification's start list beside the player (thirty in all,
   * each a single moguls run), and the LADDER its best go into. */
  field: MOGULS.field,
  ladder: 16,
  /** The seeds that keep their place in the ladder; the rest are drawn
   * within their group. */
  kept: 8,
  /** THE START: "blue course ready… red course ready" (`ready` s), then
   * both gates open together within `release` s of it — no count. */
  ready: 2,
  release: 3,
  /** A stop this long is a DID NOT FINISH, s. */
  stop: 10,
  /** THE PANEL: four turn judges, two air judges and a speed judge, five
   * votes each — 35 in all. */
  judges: { turns: 4, air: 2, speed: 1 },
  votes: 5,
  /** The speed judge's split off the gap at the line, s: under `close` a
   * 3–2, under `clear` a 4–1, past it a 5–0. */
  gap: { close: 0.75, clear: 1.5 },
  /** A repeated identical jump: the votes an air judge moves off it. */
  repeat: 2,
  /** The pair and the jury: the moguls'. */
  skis: MOGULS.skis,
  jury: MOGULS.jury,
} as const;

/** THE QUALIFICATION as a skier is dealt it: a moguls run, alone, in the
 * blue lane of the dual course (`mogulsRules`). */
export function dualMogulsRules(laps: number): RunRules {
  return mogulsRules(laps);
}

/** A DUAL as a skier is dealt it: the rival skied in the other lane, the
 * two gates opening together `countdown` s after the call (dealt per dual
 * by `duel.ts`), no contact — the lanes never meet — and the moguls'
 * strict gates, technique and air. */
export function duelRules(laps: number, countdown: number): RunRules {
  return {
    ...mogulsRules(laps),
    rivals: 1,
    countdown,
    contact: false,
    start: "gate",
    window: 0,
  };
}
