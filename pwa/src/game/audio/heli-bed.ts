// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S SCHEDULER — the half that reads the free ride's machine
// (`GameState.heli`) once a frame and steers its eleven layers
// (`heli-voice.ts`), heard from where the player's skier is: on the skid it
// is three metres off and deafening, flying home after the drop it is a
// thudding going away down the valley, Doppler-lowered and losing its top
// to the air.
//
// The ear is the SKIER — as it is for every bed in the game — his head a
// metre and a half over his boots; the camera's rung only scales the whole
// machine (the listener's `machine` column). Riding, the two move together
// and the Doppler shift is nothing.
//
// TWO MEMORIES, both the bed's own and neither a state the engine keeps:
//   * THE ROTOR'S WIND-DOWN. The engine stops the rotor dead in a crash
//     (`HeliState.spool` to 0 in the step it burns); the ear hears the
//     blades choke over a third of a second instead — the whop's rate and
//     the turbine's pitch falling away under the blast.
//   * THE CRACKLE. While the wreck burns, every fortieth of a second of the
//     ENGINE's clock since the last frame is a slot a pop may land in
//     (`crackleAt`, a hash of the slot — never a stream), so the fire
//     crackles the same on a replay and holds with the race under a pause.
//
// Built only on a run with a helicopter (`state.heli`, the free ride's);
// anywhere else it builds nothing and costs nothing.

import { HELI, type GameState, type HeliState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

import { RUN_BANK } from "./bank.ts";
import {
  CRACKLE_SLOTS,
  HEARD_FAR,
  HELI_GLIDE,
  HELI_LAYERS,
  crackleAt,
  dopplerOf,
  heliHeard,
  heliTargets,
  rotorsOf,
  slapOf,
  washOf,
  type HeliLayer,
  type HeliVoice,
} from "./heli-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** The engine's own rotors, as the bed hears them. */
const ROTORS = rotorsOf(HELI);

/** The ear over the skier's boots, m. */
const EAR = 1.6;

/** How fast a rotor that has hit the snow stops, s (a time constant). */
const CHOKE = 0.3;

/** The fire: how long it takes to catch, s, and how long it dies over at the
 * end of the wreck's burn (`HELI.crash.wreck`), s. */
const CATCH = 0.3;
const DIE = 1.2;

/** The most pops one frame raises — a tab that was away does not come back
 * to a second's crackle at once. */
const MOST_POPS = 4;

/** How far across the machine is panned at the most, 0..1 of the ear. */
const PAN = 0.6;

/** The standard gravity, m/s² — the thrust's share of the weight. */
const G = 9.81;

/** One step of a one-pole filter on a time constant. */
function follow(previous: number, target: number, dt: number, tau: number): number {
  return previous + (target - previous) * (1 - Math.exp(-dt / tau));
}

/** How far the wreck is alight, 0..1, `t` s into its burn. */
export function fireOf(h: Pick<HeliState, "mode" | "t">): number {
  if (h.mode !== "wreck") return 0;
  const lit = Math.min(1, Math.max(0, h.t / CATCH));
  const left = HELI.crash.wreck - h.t;
  return lit * Math.min(1, Math.max(0, left / DIE));
}

/** THE HELICOPTER AGAINST THE EAR — a `HeliVoice` read off the state, with
 * the rotor's spool the bed heard (`spool`, its own wind-down) and how hard
 * the turbine is running up (`rise`). */
export function heliVoiceOf(state: GameState, spool: number, rise: number): HeliVoice {
  const h = state.heli!;
  const c = state.skier;
  const dx = h.x - c.x;
  const dy = h.y + HELI.rotor.hub - (c.y + EAR);
  const dz = h.z - c.z;
  const distance = Math.hypot(dx, dy, dz);
  // CLOSING: the machine's velocity less the ear's, along the line to it —
  // positive coming on. Nothing while he rides it, or so near the line has
  // no direction.
  let closing = 0;
  if (!h.rider && distance > 5) {
    closing = -((h.vx - c.vx) * dx + (h.vy - c.vy) * dy + (h.vz - c.vz) * dz) / distance;
  }
  // WHICH EAR: across the skier's heading, through the screen's one flip
  // and the seat's `side` (none from a lens that circles him) — applied by
  // the caller, which holds the seat.
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const flat = Math.hypot(dx, dz);
  const across = flat > 1 ? (dx * fz - dz * fx) / flat : 0;
  const speed = Math.hypot(h.vx, h.vz);
  return {
    spool,
    rise,
    collective: h.collective,
    slap: slapOf({ sink: -h.vy, speed, yawRate: h.yawRate, collective: h.collective }),
    wash: washOf({
      agl: h.agl,
      radius: HELI.rotor.radius,
      reach: HELI.wash.reach,
      push: h.thrust / (HELI.mass * G),
      spool,
    }),
    distance,
    doppler: dopplerOf(closing),
    pan: across * SCREEN_TO_ENGINE * PAN,
    fire: fireOf(h),
    t: state.t,
  };
}

/** The helicopter's bed, for the whole life of one app. */
export type HeliBed = {
  /** Steer every layer and raise the fire's pops. Call once per rendered
   * frame with the live state; builds nothing on a run with no helicopter.
   * `duck` scales it all, as it scales the ride bed. */
  update: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the race is watched from. */
  setView: (view: string) => void;
  /** Nobody is hearing the run: every layer comes down. */
  silence: () => void;
  /** The run is over or the player left it. */
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createHeliBed(synth: Synth): HeliBed {
  const rack: Rack<HeliLayer> = createRack(synth, HELI_LAYERS, HELI_GLIDE);
  let listener: Listener = listenerFor("chase");
  // The rotor as heard, and the engine's spool at the last frame (the
  // turbine's run-up is how fast it climbs).
  let rotor = 0;
  let last = Number.NaN;
  let rise = 0;
  // The last crackle slot heard (NaN before the fire).
  let slot = Number.NaN;
  let built = false;

  const forget = (): void => {
    rotor = 0;
    last = Number.NaN;
    rise = 0;
    slot = Number.NaN;
  };
  const hush = (): void => {
    rack.stop();
    built = false;
  };

  return {
    update(state, dt, duck = 1) {
      const h = state.heli;
      if (!h) {
        if (built) hush();
        forget();
        return;
      }
      if (synth.now() === null) return;
      const frame = Math.max(1 / 240, Math.min(0.1, dt));

      // THE ROTOR AS HEARD: the engine's, until it hits the snow — then
      // the bed's own choke from where it was.
      if (h.mode === "wreck") rotor = follow(rotor, 0, frame, CHOKE);
      else rotor = h.spool;
      // THE RUN-UP: the spool's climb over the frame, as a share of the
      // engine's own rate — 1 starting from the pad.
      const climb = Number.isNaN(last) ? 0 : (h.spool - last) / frame / HELI.spool;
      rise = follow(rise, Math.min(1, Math.max(0, climb)), frame, 0.2);
      last = h.spool;

      const voice = heliVoiceOf(state, rotor, rise);
      voice.pan *= listener.side;
      if (rotor <= 0.002 && voice.fire <= 0 && !built) return;
      rack.apply(heliTargets(voice, ROTORS, { machine: listener.machine * duck }));
      built = true;

      // ── The crackle ──────────────────────────────────────────────────
      if (voice.fire > 0 && voice.distance < HEARD_FAR) {
        const now = Math.floor(state.t * CRACKLE_SLOTS);
        const from = Number.isNaN(slot) || now < slot ? now - 1 : slot;
        const heard = heliHeard(voice.distance);
        let pops = 0;
        for (let s = Math.max(from + 1, now - CRACKLE_SLOTS); s <= now; s++) {
          const pop = crackleAt(s, voice.fire);
          if (!pop) continue;
          if (++pops > MOST_POPS) break;
          playSound(synth, RUN_BANK, "heli_crackle", {
            gain: pop.size * heard.gain * listener.machine * listener.events * duck,
            pitch: pop.pitch * (0.6 + 0.4 * heard.bright) * listener.muffle,
            pan: voice.pan,
          });
        }
        slot = now;
      } else {
        slot = Number.NaN;
      }
    },

    setView(view) {
      listener = listenerFor(view);
    },

    silence: hush,

    reset() {
      hush();
      forget();
    },

    live: () => rack.live(),
  };
}
