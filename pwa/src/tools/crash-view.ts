// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S CRASH VIEWS (`make world ARGS=--views=crash-0.4,crash-1,
// crash-3.5`, and `crash-net-<s>` with `--downhill`): a crash from the
// player's OWN lens — the chase boom as the game frames it, no lens planted
// — `t` s on from where he left his skis. Every frame on the way is drawn so
// the boom's springs run as they do in the game, and the lens should be on
// HIM, not on the skis his state slides on as (`camera-subject.ts`).

import { NEUTRAL_INPUT, step, type GameState } from "@engine";

import type { WorldRendererExt } from "../game/renderer.ts";

const FRAME = 1 / 60;

/** Stage the crash with `stage` (into a trunk, into the nets; ridden into
 * it tucked or not) unless he is already thrown, ride it on to `t` s off
 * his skis and draw it. */
export function crashShot(
  state: GameState,
  renderer: WorldRendererExt,
  t: number,
  stage: (state: GameState) => boolean | void,
  tuck: boolean,
): string {
  if (!state.skier.thrown) {
    renderer.setCamera("chase", true);
    if (stage(state) === false) return "no downhill on this run (--downhill)";
    // Tucked into a trunk; let go into the nets, as `net-view.ts` rides it.
    const ride = tuck ? { ...NEUTRAL_INPUT, tuck: 1 } : NEUTRAL_INPUT;
    const until = state.t + 6;
    while (!state.skier.thrown && state.t < until) {
      for (let i = 0; i < 2; i++) step(state, ride);
      renderer.draw(state, 0, FRAME, false);
    }
    if (!state.skier.thrown) return "no wipeout";
  }
  while (state.skier.thrown && state.skier.thrown.t < t - 1e-9) {
    step(state, NEUTRAL_INPUT);
    if (state.tick % 2 === 0) renderer.draw(state, 0, FRAME, false);
  }
  const off = state.skier.thrown;
  if (!off) return "already stood back up";
  renderer.draw(state, 0, FRAME, true);
  const skis = Math.hypot(state.skier.x - off.x, state.skier.z - off.z);
  return `thrown (${off.cause}) ${off.t.toFixed(1)} s, the skis' state ${skis.toFixed(1)} m off him`;
}
