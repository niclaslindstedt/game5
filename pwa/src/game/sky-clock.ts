// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP'S SKY CLOCK: how fast the sun moves over a run, and the one place
// the picture asks where it stands NOW. The engine states the clock
// (`SKY_CLOCK`, `skyHourAt` in `engine/game/clock.ts` — five real minutes an
// hour of sun) and keeps nothing of it in its state; the rate is the app's,
// set once a visit (`App.tsx`, off `url-params.ts`'s `skyClock` — `?skyclock=0`
// holds the sun still) and read by every reader of the hour: the sky
// (`sky.ts`), the stars, the snow's thaw, the birds, the sound, the people
// on foot and the cockpits' clocks.
//
// THE CLOCK STANDS until something starts it: a lab's harness page that
// never asks photographs its map at the hour it names, whatever second of
// the run it stands at — a picture a lab compares must not move with how
// long the bot took to get there. The game starts it at `SKY_CLOCK.rate`.
//
// DOM-free and three-free: a module the suite reads.

import { moonAtRun, skyHourAt, skyLevelAt, sunAtRun, type Level } from "@engine";

let rate = 0;

/** Run the sky's clock at `next` sky seconds a run second (0 holds it). */
export function setSkyClock(next: number): void {
  rate = Number.isFinite(next) && next > 0 ? next : 0;
}

/** The sky clock's rate this visit. */
export function skyClock(): number {
  return rate;
}

/** The sky's hour at run time `t` on `level` (apparent solar hours). */
export function skyHourNow(level: Pick<Level, "sun">, t: number): number {
  return skyHourAt(level, t, rate);
}

/** `level` as the sky stands over it at run time `t`. */
export function skyLevelNow<L extends Pick<Level, "sun">>(level: L, t: number): L {
  return skyLevelAt(level, t, rate);
}

/** Where the sun stands at run time `t`. */
export function sunNow(level: Pick<Level, "sun">, t: number): ReturnType<typeof sunAtRun> {
  return sunAtRun(level, t, rate);
}

/** Where the moon stands at run time `t`. */
export function moonNow(level: Pick<Level, "sun">, t: number): ReturnType<typeof moonAtRun> {
  return moonAtRun(level, t, rate);
}
