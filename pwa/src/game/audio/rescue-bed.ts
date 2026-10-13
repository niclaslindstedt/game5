// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AS HEARD, A FRAME AT A TIME (`avalanche-rescue.ts`): the
// player's transceiver beeping while it searches — once a second and a
// little with nothing heard, faster and faster as the number falls, pitched
// up in the fine search (`beacon-read.ts` says how often) — his own shovel
// biting while he digs. Every cue a one-shot of the rescue bank
// (`rescue-bank.ts`); and `under`, how much of the world outside a buried
// skier still hears while his BURIED card runs — the snow over him takes
// nearly all.

import type { GameState } from "@engine";

import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";
import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { beaconRead } from "../beacon-read.ts";
import { goneUnder } from "../camera-buried.ts";
import { RUN_BANK } from "./bank.ts";

/** A shovel's bite, s apart — a load a second and a half or so. */
const BITE = 1.3;
/** What of the outside a buried skier hears — a metre of debris passes
 * little but the lowest of the rumble. */
const MUFFLED = 0.06;

export type RescueBed = {
  update(state: GameState, dt: number, duck: number): void;
  /** How much of the beds outside reach him (1 on the snow), this frame. */
  under(state: GameState): number;
  reset(): void;
};

export function createRescueBed(sfx: Synth): RescueBed {
  let beep = 0;
  let bite = 0;
  return {
    update(state, dt, duck) {
      const a = state.avalanche;
      if (!a || duck <= 0) return;
      const read = beaconRead(state, state.t);
      if (read && read.mode !== "send" && read.beep > 0) {
        beep -= dt;
        if (beep <= 0) {
          beep = read.beep;
          const fine = read.mode === "fine";
          playSound(sfx, RUN_BANK, "beacon_beep", {
            gain: duck * (read.mode === "signal" ? 0.6 : 1),
            pitch: fine ? 1.12 : 1,
          });
        }
      } else beep = 0;
      // His own shovel while he digs.
      if (a.beacon.digging) {
        bite -= dt;
        if (bite <= 0) {
          bite = BITE;
          playSound(sfx, RUN_BANK, "shovel_bite", { gain: duck });
        }
      } else bite = BITE * 0.3;
    },
    under(state) {
      return goneUnder(state) ? MUFFLED : 1;
    },
    reset() {
      beep = 0;
      bite = 0;
    },
  };
}
