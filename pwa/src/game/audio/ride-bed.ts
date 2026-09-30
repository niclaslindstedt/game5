// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BED'S SCHEDULER — the half that reads the live `GameState` once a frame
// and steers every continuous voice the race has. What a voice IS lives in
// `wind-voice.ts` (the skier's own wind) and `snow-voice.ts` (the skis on
// the snow); this is the one place that turns a state into their targets —
// and the one place the POLES are heard: a plant is not an engine event, so
// the bed watches the engine's own pulse (`plantPulse`) while the skier is
// poling and plays the bank's click on each one.
//
// NOTHING HERE IS BOOKED AHEAD. The layers run on the audio thread and
// every frame merely tells them where to go next, over a glide; a frame
// that arrives late — a garbage-collection pause, a phone throttling itself,
// a stall while a map is built — leaves every layer holding its last value.
// A bed that had to be fed on a cadence breathed with the frame rate and
// stuttered when it was starved, and a stutter is what a player reports as
// crackle.

import { TUNING, plantPulse, topSpeedOf, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { RUN_BANK } from "./bank.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";
import { SNOW_GLIDE, SNOW_LAYERS, snowTargets, type SnowLayer } from "./snow-voice.ts";
import { WIND_GLIDE, WIND_LAYERS, windTargets, type WindLayer } from "./wind-voice.ts";

/** How quickly the wind follows the speed, s — a time constant rather than a
 * per-frame fraction, because a fraction is only true at the frame rate it
 * was tuned at. */
const WIND_TAU = 0.25;

/** The way under which a skier working for his speed is heard planting
 * his poles, m/s — the engine's own `poles.fade`, where the push is gone. */
const POLING_UNDER = TUNING.poles.fade;

/** One step of a one-pole filter on a time constant. */
function follow(previous: number, target: number, dt: number, tau: number): number {
  return previous + (target - previous) * (1 - Math.exp(-dt / tau));
}

/** The ride bed, for the whole life of one app. */
export type RideBed = {
  /** Steer every layer. Call once per rendered frame with the live state and
   * the frame's own elapsed time; cheap when nothing changed and silent when
   * the context is locked. `duck` scales the whole bed, 0..1: 1 with the
   * player on his skis, less under a card. */
  update: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the race is being watched from — the mix follows it. */
  setView: (view: string) => void;
  /**
   * THE RACE IS STILL THERE BUT NOBODY IS HEARING IT — the pause card, a
   * hidden tab. Tear the layers down; the next `update` builds them again.
   * Silencing has to be SAID: a bed that is merely not fed holds its last
   * note, which is a wind blowing on behind a card that froze the race.
   */
  silence: () => void;
  /** The race is over or the player left it. */
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

/** `voice` is what the wind's layers play through — its own fader's view of
 * the one synth (`bus.ts`); the snow and the poles play through `synth`. */
export function createRideBed(synth: Synth, voice: Synth = synth): RideBed {
  let wind = 0;
  let planted = 0;
  let listener: Listener = listenerFor("chase");
  const air: Rack<WindLayer> = createRack(voice, WIND_LAYERS, WIND_GLIDE);
  const snow: Rack<SnowLayer> = createRack(synth, SNOW_LAYERS, SNOW_GLIDE);

  const hush = (): void => {
    air.stop();
    snow.stop();
  };

  return {
    update(state, dt, duck = 1) {
      if (synth.now() === null) {
        // Locked, suspended or muted to nothing. Nudge the context; the
        // racks rebuild whatever they need the moment it is back.
        synth.resume();
        return;
      }
      const c = state.skier;
      const spec = c.spec;
      const frame = Math.max(1 / 240, Math.min(0.1, dt));
      let touching = 0;
      for (const p of c.contacts) if (p.touching) touching += 1;
      const grounded = c.contacts.length > 0 ? touching / c.contacts.length : 0;
      const pace = c.speed / topSpeedOf(spec);

      // ── The wind ─────────────────────────────────────────────────────
      wind = follow(wind, c.speed, frame, WIND_TAU);
      air.apply(
        windTargets(
          { wind, crouch: c.crouch, airborne: c.airborne },
          { wind: listener.wind * duck, tone: listener.tone },
        ),
      );

      // ── The skis on the snow ─────────────────────────────────────────
      // How hard the packed snow is, by ear: a groomer firms up with the
      // speed the edge is driven into it at, and the ice a map lays
      // (`level.iceAt`) is boilerplate.
      const ice = state.level.iceAt ? state.level.iceAt(c.x, c.z) : 0;
      const hard = Math.max(ice, 0.3 + 0.7 * Math.min(1, pace));
      snow.apply(
        snowTargets(
          {
            speed: c.speed,
            pace,
            packed: c.packed,
            hard,
            grounded,
            edge: Math.abs(c.edge) / Math.max(0.3, spec.edgeMax),
            skid: c.skid,
            airborne: c.airborne,
          },
          { snow: listener.snow * duck },
        ),
      );

      // ── The poles ────────────────────────────────────────────────────
      // A plant on each rise of the engine's own stride while he is working
      // for his speed (`poles.ts`): the skate's and the double pole's.
      const poling = !c.airborne && c.drive > 0.3 && Math.abs(c.way) < POLING_UNDER && grounded > 0;
      const pulse = poling ? plantPulse(c.stride) : 0;
      if (pulse > 0.5 && planted <= 0.5) {
        playSound(synth, RUN_BANK, "plant", {
          gain: listener.events * duck * (0.6 + 0.4 * (1 - c.packed)),
          pitch: (0.95 + 0.1 * c.packed) * listener.muffle,
        });
      }
      planted = pulse;
    },

    setView(view) {
      listener = listenerFor(view);
    },

    silence: hush,

    reset() {
      hush();
      wind = 0;
      planted = 0;
    },

    live: () => air.live() + snow.live(),
  };
}
