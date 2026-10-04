// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BED'S SCHEDULER — the half that reads the live `GameState` once a frame
// and steers every continuous voice the race has. What a voice IS lives in
// `wind-voice.ts` (the skier's own wind), `snow-voice.ts` (the skis on the
// snow) and `tunnel-voice.ts` (a wind tunnel's gale); this is the one place
// that turns a state into their targets — and the one place the POLES are
// heard: a plant is not an engine event, so the bed watches the engine's
// own pulse (`plantPulse`) while the skier is poling and plays the bank's
// click on each one.
//
// NOTHING HERE IS BOOKED AHEAD. The layers run on the audio thread and
// every frame merely tells them where to go next, over a glide; a frame
// that arrives late — a garbage-collection pause, a phone throttling itself,
// a stall while a map is built — leaves every layer holding its last value.
// A bed that had to be fed on a cadence breathed with the frame rate and
// stuttered when it was starved, and a stutter is what a player reports as
// crackle.

import {
  TUNING,
  airflowAt,
  plantPulse,
  sunAtRun,
  topSpeedOf,
  type Airflow,
  type GameState,
  type Level,
} from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { RUN_BANK } from "./bank.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";
import { emptyMix, snowMix, snowpackOf, type Snowpack } from "../snowpack.ts";
import {
  SNOW_GLIDE,
  SNOW_LAYERS,
  skiVoiceOf,
  snowTargets,
  type SnowLayer,
  type SnowUnder,
} from "./snow-voice.ts";
import { WIND_GLIDE, WIND_LAYERS, windTargets, type WindLayer } from "./wind-voice.ts";
import {
  TUNNEL_GLIDE,
  TUNNEL_HEARD,
  TUNNEL_LAYERS,
  tunnelTargets,
  tunnelVoiceAt,
  type TunnelLayer,
} from "./tunnel-voice.ts";
import { tunnelNear, tunnelsOf } from "../wind-tunnel-plan.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** How quickly the wind follows the air, s — a time constant rather than a
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
  /** WHAT LAY UNDER THE PLAYER'S SKIS at the last frame — the snow a
   * landing, a fall or a trunk's load comes down into (`route.ts`). */
  ground: () => SnowUnder;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

/** `voice` is what the wind's layers play through — its own fader's view of
 * the one synth (`bus.ts`); the snow and the poles play through `synth`. */
export function createRideBed(synth: Synth, voice: Synth = synth): RideBed {
  let wind = 0;
  let side = 0;
  const flow: Airflow = { x: 0, y: 0, z: 0, speed: 0, head: 0, across: 0 };
  let planted = 0;
  let listener: Listener = listenerFor("chase");
  // THE RUN'S SNOWPACK (`snowpack.ts`), the one the picture reads: built
  // once per map under its own sky and sun, its new snow moved every frame.
  let pack: Snowpack | null = null;
  let packLevel: Level | null = null;
  const under = emptyMix();
  const air: Rack<WindLayer> = createRack(voice, WIND_LAYERS, WIND_GLIDE);
  const snow: Rack<SnowLayer> = createRack(synth, SNOW_LAYERS, SNOW_GLIDE);
  // THE WIND TUNNELS' GALE, through the wind's fader — built only on a map
  // with a tunnel on it.
  const gale: Rack<TunnelLayer> = createRack(voice, TUNNEL_LAYERS, TUNNEL_GLIDE);

  const hush = (): void => {
    air.stop();
    snow.stop();
    gale.stop();
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
      // THE APPARENT WIND (`airflowAt`): the air where he is — the
      // weather's, down at his body, sheltered by the woods — less his own
      // velocity — a headwind adds to his speed, a tailwind takes from it,
      // and a storm is heard standing still. Across him it is heard on the
      // side it comes from: a wind toward the engine's right comes from his
      // left, which the screen's one flip turns into the ear it lands on.
      airflowAt(state.level, state.t, c, flow);
      wind = follow(wind, flow.speed, frame, WIND_TAU);
      const across = flow.speed > 1 ? -flow.across / flow.speed : 0;
      side = follow(side, across * SCREEN_TO_ENGINE * listener.side, frame, WIND_TAU);
      air.apply(
        windTargets(
          { wind, crouch: c.crouch, airborne: c.airborne, side },
          { wind: listener.wind * duck, tone: listener.tone },
        ),
      );

      // ── The skis on the snow ─────────────────────────────────────────
      // WHAT LIES UNDER THEM: the six kinds as the picture mixes them at
      // his boots — the map's groomer, crust and ice, the new snow the sky
      // has laid and is laying, the thaw under a high sun.
      if (pack === null || packLevel !== state.level) {
        pack = snowpackOf(state.level, {
          elevation: sunAtRun(state.level).elevation,
          depth: state.snowDepth,
        });
        packLevel = state.level;
      }
      pack.fresh = state.fresh;
      pack.depth = state.snowDepth;
      snowMix(pack, c.x, c.z, under);
      snow.apply(
        snowTargets(
          {
            speed: c.speed,
            pace,
            under,
            ski: skiVoiceOf(spec),
            grounded,
            edge: Math.abs(c.edge) / Math.max(0.3, spec.edgeMax),
            skid: c.skid,
            airborne: c.airborne,
          },
          { snow: listener.snow * duck },
        ),
      );

      // ── The wind tunnels ─────────────────────────────────────────────
      // The gale of the lane he is carried down (`SkierState.tunnel`), or a
      // murmur of one he is beside. The whoosh at the mouth is the engine's
      // `tunnel` event (`route.ts`). A map with no tunnel builds none of it.
      if (tunnelsOf(state.level).length > 0) {
        const near = tunnelNear(state.level, c.x, c.z, TUNNEL_HEARD);
        const hit = c.tunnel ? { out: 0, s: c.tunnel.s } : near;
        gale.apply(tunnelTargets(tunnelVoiceAt(hit, state.t), { wind: listener.wind * duck }));
      }

      // ── The poles ────────────────────────────────────────────────────
      // A plant on each rise of the engine's own stride while he is working
      // for his speed (`poles.ts`): the skate's and the double pole's — and
      // none from a skier who has none (`SkierState.poles`).
      const poling =
        c.poles && !c.airborne && c.drive > 0.3 && Math.abs(c.way) < POLING_UNDER && grounded > 0;
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
      side = 0;
      planted = 0;
      pack = null;
      packLevel = null;
    },

    ground: () => under,

    live: () => air.live() + snow.live() + gale.live(),
  };
}
