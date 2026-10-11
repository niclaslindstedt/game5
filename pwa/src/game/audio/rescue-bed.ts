// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AS HEARD, A FRAME AT A TIME (`avalanche-rescue.ts`): the
// player's transceiver beeping while it searches — once a second and a
// little with nothing heard, faster and faster as the number falls, pitched
// up in the fine search (`beacon-read.ts` says how often) — his own shovel
// biting while he digs, and, buried himself, the patrol's shovels over him
// growing louder as they come down to him. Every cue a one-shot of the
// rescue bank (`rescue-bank.ts`); and `under`, how much of the world
// outside a buried skier still hears — the snow over him takes nearly all.

import type { GameState } from "@engine";

import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";
import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { beaconRead, buriedRead } from "../beacon-read.ts";
import { RUN_BANK } from "./bank.ts";

/** A shovel's bite, s apart — a load a second and a half or so. */
const BITE = 1.3;
/** What of the outside a buried skier hears, at the most and the least —
 * a metre of debris passes little but the lowest of the rumble. */
const MUFFLED = { most: 0.35, least: 0.06 } as const;

export type RescueBed = {
  update(state: GameState, dt: number, duck: number): void;
  /** How much of the beds outside reach him (1 on the snow), this frame. */
  under(state: GameState): number;
  reset(): void;
};

export function createRescueBed(sfx: Synth): RescueBed {
  let beep = 0;
  let bite = 0;
  let patrolBite = 0;
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
      // Buried, the patrol's shovels coming down to him.
      const under = buriedRead(state);
      if (under && under.stage === "dig") {
        patrolBite -= dt;
        if (patrolBite <= 0) {
          patrolBite = BITE * 0.55;
          playSound(sfx, RUN_BANK, "shovel_bite", {
            gain: duck * (0.15 + 0.85 * under.light),
            pitch: 0.7 + 0.3 * under.light,
          });
        }
      }
    },
    under(state) {
      const b = buriedRead(state);
      if (!b) return 1;
      return (
        MUFFLED.least + (MUFFLED.most - MUFFLED.least) * b.light + (1 - MUFFLED.most) * b.light
      );
    },
    reset() {
      beep = 0;
      bite = 0;
      patrolBite = 0;
    },
  };
}
