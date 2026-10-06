// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOM INSIDE THE LODGE — the bed heard while the player is in an
// afterski lodge (`GameState.afterski.inside`): a crowd of voices as two
// bands of pink noise that swell and ebb on slow overlapping waves (the
// murmur and the shouts over it), a glass clinked somewhere now and then,
// and a muffled THUMP through the floor on the dance's beat — a low sine
// felt more than heard, the room's effect and not a tune: the game has no
// music. Outside, the bed is silent and the ride's beds come back.

import { type GameState } from "@engine";

import type { LayerSpec, Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import { BEAT } from "../party-pose.ts";

type RoomLayer = "murmur" | "shouts" | "thump" | "clink";

const LAYERS: Record<RoomLayer, LayerSpec> = {
  murmur: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  shouts: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.8 } },
  thump: { kind: "tone", type: "sine", drive: 0.6 },
  clink: { kind: "tone", type: "sine" },
};
/** How fast each layer follows its target, s: the thump and the clink
 * short enough to land on their moment. */
const GLIDE: Record<RoomLayer, number> = { murmur: 0.25, shouts: 0.12, thump: 0.02, clink: 0.01 };

/** The levels, on a one-shot's scale. */
const LEVEL = { murmur: 0.05, shouts: 0.022, thump: 0.05, clink: 0.012 };

export type AfterskiBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  silence: () => void;
  reset: () => void;
};

/** A glass in the room clinks at most once a `CLINK` s window, on a hash
 * of the window — the room's own, never the run's stream. */
const CLINK = 1.7;
function clinkIn(window: number): number {
  let h = Math.imul(window ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

export function createAfterskiBed(synth: Synth): AfterskiBed {
  const rack: Rack<RoomLayer> = createRack(synth, LAYERS, GLIDE);
  let built = false;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      const a = state.afterski;
      if (!a?.inside) {
        if (built) hush();
        return;
      }
      if (synth.now() === null) return;
      const t = a.t;
      // The crowd's swell: three slow waves, never in step.
      const swell =
        0.7 + 0.15 * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 0.91 + 1) + 0.05 * Math.sin(t * 2.3);
      const shout = Math.max(0, Math.sin(t * 0.53) * Math.sin(t * 1.7 + 0.4));
      // The thump: a quick rise on each beat and a decay over it.
      const beat = (t * BEAT) % 1;
      const thump = Math.exp(-beat * 9);
      // A clink: a short ring somewhere in its window.
      const w = Math.floor(t / CLINK);
      const at = clinkIn(w);
      const since = t - w * CLINK - at * CLINK * 0.8;
      const clink = since >= 0 && since < 0.12 && clinkIn(w + 7) < 0.6 ? 1 - since / 0.12 : 0;
      rack.apply({
        murmur: { level: LEVEL.murmur * swell * duck, cutoff: 520 + 80 * Math.sin(t * 0.3) },
        shouts: { level: LEVEL.shouts * shout * duck, cutoff: 1350 + 200 * Math.sin(t * 0.8) },
        thump: { level: LEVEL.thump * thump * duck, hz: 55, grit: 0.4 },
        clink: {
          level: LEVEL.clink * clink * duck,
          hz: 2400 + 900 * clinkIn(w + 3),
          pan: clinkIn(w + 5) * 1.6 - 0.8,
        },
      });
      built = true;
    },
    silence: hush,
    reset: hush,
  };
}
