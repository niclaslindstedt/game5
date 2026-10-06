// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S ENGINE — the half that reads the free ride's rig
// (`GameState.para`) once a frame and steers its layers, heard from the
// skier it is strapped to. A paramotor is a SINGLE-CYLINDER TWO-STROKE
// swinging a propeller off a reduction drive: one firing a revolution, the
// note half a twin's at the same crank (a 37 Hz chug at idle, a 142 Hz
// buzz at full), so it is the snowmobile's eight-layer two-stroke
// (`sled-voice.ts`) fed half the firings — the block, the note and its
// octave, the expansion chamber's rasp, the intake — with no belt and no
// paddles in the snow. It works hardest on the ground and in a climb, and
// revs thinner as the air through the propeller unloads it. The rush of the
// air past him is the ride bed's wind (`wind-voice.ts`), as it is skiing.
// Dropped, the engine is cut and the bed falls silent.
//
// Built only on a run with a paramotor (`state.para`); anywhere else it
// builds nothing and costs nothing.

import { PARA, paraRigged, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import { SLED_GLIDE, SLED_LAYERS, revOf, sledTargets, type SledLayer } from "./sled-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";

/** A single cylinder fires once a revolution, a twin twice: the crank as the
 * twin's voice is handed it. */
const SINGLE = 0.5;
/** The motor on his back against the ear in his helmet: under the cage's
 * guard, the pipe behind him. */
const ON_HIS_BACK = { engine: 0.75, exhaust: 0.65, tone: 0.9 };

/** The paramotor's bed, for the whole life of one app. */
export type ParaBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
};

export function createParaBed(synth: Synth): ParaBed {
  const rack: Rack<SledLayer> = createRack(synth, SLED_LAYERS, SLED_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      const p = state.para;
      if (!p || !paraRigged(state) || state.skier.thrown) {
        if (built) hush();
        return;
      }
      if (synth.now() === null) return;
      const E = PARA.engine;
      const throttle = p.controls.throttle;
      const machine = listener.machine * duck;
      const targets = sledTargets(
        {
          rpm: p.rpm * SINGLE,
          rev: revOf(p.rpm, E.idle, E.full),
          throttle,
          // The propeller loads the crank hardest with the rig slow.
          load: throttle * Math.max(0.3, 1 - p.airspeed / E.pitchSpeed),
          treadSpeed: 0,
          slip: 0,
          loose: 0,
        },
        {
          engine: machine * ON_HIS_BACK.engine,
          exhaust: machine * ON_HIS_BACK.exhaust,
          tone: ON_HIS_BACK.tone,
        },
      );
      rack.apply(targets);
      built = true;
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset: hush,
  };
}
