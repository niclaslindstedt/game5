// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE'S AUDIO FRONT DOOR: engine events in, sound out, plus the beds
// that run underneath all of it.
//
// The engine emits `GameEvent`s from `step()` and has no idea any of them
// make a noise; this is the one place that opinion lives. A moment the
// simulation never reports — the hiss of the skis, the edge's tear, the
// wind, a pole planted — is not an event and never becomes one: it is read
// off the state by the bed (`ride-bed.ts`).
//
// WHICH sound an event makes is `route.ts`; this module owns WHEN, WHERE
// FROM (the camera's ear, `listener.ts`), and the rules that only a funnel
// every sound passes through can enforce.
//
// EVERYTHING IS SYNTHESIZED FROM AUTHORED PARAMETERS. The game ships no
// audio file, no sample, no MIDI: a sound is a list of numbers in `bank.ts`
// or a layer steered by a pure function of the state, and the only module
// that touches WebAudio is the framework's `audio/synth`.

import type { GameEvent, GameState, Level } from "@engine";

import { RUN_BANK } from "./bank.ts";
import { createBirdBed, type BirdBed } from "./bird-bed.ts";
import { engineSfx, sfx } from "./bus.ts";
import { createHeliBed, type HeliBed } from "./heli-bed.ts";
import { createSledBed, type SledBed } from "./sled-bed.ts";
import { createParaBed, type ParaBed } from "./para-bed.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";
import { createRideBed, type RideBed } from "./ride-bed.ts";
import { heardFrom, soundsForStep, trunkAt, type Contact } from "./route.ts";

export { setAudioVolumes, unlockAudio } from "./bus.ts";
export { RUN_BANK } from "./bank.ts";
export { soundForEvent, soundsForStep, trunkAt } from "./route.ts";

export type RunAudio = {
  /** Translate one step's events into sound. `state` is the run they came
   * out of — which trunk a hit met is read off its map; without it every
   * trunk is a middling one. */
  events: (list: readonly GameEvent[], state?: GameState) => void;
  /** Advance the continuous beds; call once per rendered frame. `duck`
   * scales the whole bed — 1 with the player on his skis, less
   * under a card the race is scenery behind. */
  frame: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the race is watched from. The whole mix moves with it. */
  setView: (view: string) => void;
  /** NOTHING IS BEING HEARD THIS FRAME — the pause card, or the tab away.
   * The beds go quiet and nothing else is forgotten, so resuming picks the
   * note back up. Cheap enough to call on every frame that does not feed
   * the beds, and that is how it is meant to be called. */
  silence: () => void;
  /** A race ended or the player left it. */
  reset: () => void;
};

export function createRunAudio(): RunAudio {
  const bed: RideBed = createRideBed(sfx, engineSfx);
  // The wood's own voices (`bird-bed.ts`): cues off the birds' plan, never
  // an engine event.
  const birds: BirdBed = createBirdBed(sfx);
  // THE FREE RIDE'S HELICOPTER (`heli-bed.ts`), heard from the skier: built
  // only on a run that has one.
  const heli: HeliBed = createHeliBed(sfx);
  // THE FREE RIDE'S SNOWMOBILE (`sled-bed.ts`), heard from the skier,
  // through the effects' fader as the helicopter is.
  const sled: SledBed = createSledBed(sfx);
  // THE FREE RIDE'S PARAMOTOR (`para-bed.ts`), on the skier's back.
  const para: ParaBed = createParaBed(sfx);
  let ear: Listener = listenerFor("chase");

  return {
    events(list, state) {
      // WHAT WAS MET, AND WHAT IT CAME DOWN INTO (`route.ts`'s `Contact`):
      // the snow the bed last read under the skis, and a hit's own trunk.
      const level: Level | undefined = state?.level;
      const contactOf = (event: GameEvent): Contact => {
        const ground = bed.ground();
        // The helicopter is somewhere else on the mountain: heard from the
        // skier's head.
        if ((event.kind === "heli" || event.kind === "sled" || event.kind === "para") && state) {
          const c = state.skier;
          return { ground, ear: { x: c.x, y: c.y + 1.6, z: c.z } };
        }
        // The starter's sounds hear how the run starts.
        if ((event.kind === "count" || event.kind === "go") && state) {
          const gate = state.rules.start === "gate";
          return { ground, start: { gate, heat: gate && state.rules.dealt !== true } };
        }
        if (event.kind !== "hit" || !level) return { ground };
        return { ground, trunk: trunkAt(level, event.x, event.z) ?? undefined };
      };
      for (const hit of soundsForStep(list, contactOf)) {
        playSound(sfx, RUN_BANK, hit.id, heardFrom(hit.shape, ear));
      }
    },

    frame(state, dt, duck = 1) {
      bed.update(state, dt, duck);
      birds.update(state, dt, duck);
      heli.update(state, dt, duck);
      sled.update(state, dt, duck);
      para.update(state, dt, duck);
    },

    setView(view) {
      ear = listenerFor(view);
      bed.setView(view);
      birds.setView(view);
      heli.setView(view);
      sled.setView(view);
      para.setView(view);
    },

    silence() {
      bed.silence();
      birds.silence();
      heli.silence();
      sled.silence();
      para.silence();
    },

    reset() {
      bed.reset();
      birds.reset();
      heli.reset();
      sled.reset();
      para.reset();
    },
  };
}
