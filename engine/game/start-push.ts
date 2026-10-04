// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START PUSH — how a racer leaves a slalom's start house (R31), on a
// run whose field starts at intervals (`RunRules.start`). Under the
// starter's word and after GO he is HELD in the doorway on his poles,
// planted on the snow beyond the wand outside its posts; when he goes —
// the tuck held past `start.press` — he throws himself out in ONE push:
// both poles driving both skis forward together, his weight over the
// wand, and a hop off it that has him clear and moving at `start.speed`
// before his boots are down. His legs open the wand on the way through,
// which starts his clock (`strict.ts`).
//
// AND NO MORE WORKING: on such a run the drive at a crawl — the skate and
// the double pole (`poles.ts`) — is off from the start; he is on a slalom's
// pitch at speed by the first gate and skis it, nothing else.

import { TUNING } from "./defs/tuning.ts";
import type { GameState, SkierInput } from "./state.ts";

const K = TUNING.start;

/** Whether a run starts out of a start house: an interval start. */
export function pushStart(state: GameState): boolean {
  return state.rules.start === "interval" && state.rules.course;
}

/** Whether the racer is still held in the doorway: after GO, not yet gone. */
export function heldInHouse(state: GameState): boolean {
  return (
    pushStart(state) &&
    state.phase === "racing" &&
    !state.progress.started &&
    state.skier.launch < 0
  );
}

/** One step of the start push: thrown out when the tuck asks, and then the
 * push itself, its share of the speed each step and the hop at its end. */
export function stepStartPush(state: GameState, input: SkierInput): void {
  if (!pushStart(state)) return;
  const c = state.skier;
  const dt = TUNING.dt;
  if (c.launch < 0) {
    if (heldInHouse(state) && c.thrown === null && input.tuck >= K.press) c.launch = 0;
    else return;
  }
  const before = c.launch;
  c.launch += dt;
  if (before >= K.push) return;
  // Down the way he faces, the speed the push gives spread over it.
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const gain = (K.speed / K.push) * dt;
  const way = c.vx * fx + c.vz * fz;
  if (way < K.speed) {
    const add = Math.min(gain, K.speed - way);
    c.vx += fx * add;
    c.vz += fz * add;
  }
  // The hop off it, at its end.
  if (c.launch >= K.push) c.vy += K.hop;
}
