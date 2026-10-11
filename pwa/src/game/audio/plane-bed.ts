// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S SCHEDULER — the half that reads the free ride's plane
// (`GameState.plane`) once a frame and steers its sixteen layers
// (`plane-voice.ts`), heard from where the player's skier is: stood in its
// open door the turboprop and the slipstream are all round him; out of the
// door the plane flies home without him, a buzz going away down the
// valley, Doppler-lowered and losing its top to the air.
//
// The ear is the SKIER, as it is for every bed in the game. The camera's
// rung only leans on it: the listener's `machine` scales the whole plane,
// and its `cabin` says whether a lens aboard is in the cabin (the cockpit,
// the door) or outside it (the booms) — read only with him aboard.
//
// THREE MEMORIES, the bed's own and none a state the engine keeps:
//   * THE PROPELLER'S WIND-DOWN. The engine stops it dead in a crash; the
//     ear hears the blades and the turbine choke over a third of a second.
//   * THE RUN-UP and THE FLAPS' RUN: the spool's climb and the flaps'
//     travel over the frame — the start's whine, the motor's whir.
//   * THE CRACKLE of a burning wreck: the helicopter's slots off the
//     engine's clock (`crackleAt`, a hash — never a stream), on a salt of
//     the plane's own.
//
// Built only on a run with a plane (`state.plane`, the free ride's);
// anywhere else it builds nothing and costs nothing.

import { PLANE, planePoint, type GameState, type PlaneState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

import { RUN_BANK } from "./bank.ts";
import { CRACKLE_SLOTS, HEARD_FAR, crackleAt, dopplerOf, heliHeard } from "./heli-voice.ts";
import {
  PLANE_GLIDE,
  PLANE_LAYERS,
  planeTargets,
  propOf,
  stallWarnOf,
  type PlaneLayer,
  type PlaneVoice,
} from "./plane-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** The engine's own propeller, as the bed hears it. */
const PROP = propOf(PLANE);
/** The propeller's hub, body frame, m. */
const HUB = { x: 0, y: PLANE.prop.hub.y, z: PLANE.prop.hub.z };

/** The ear over the skier's boots, m. */
const EAR = 1.6;
/** How fast a propeller that has hit the snow stops, s (a time constant). */
const CHOKE = 0.3;
/** The fire: how long it takes to catch, s, and how long it dies over at
 * the end of the wreck's burn (`PLANE.crash.wreck`), s. */
const CATCH = 0.3;
const DIE = 1.2;
/** The most pops one frame raises. */
const MOST_POPS = 4;
/** How far across the machine is panned at the most, 0..1 of the ear. */
const PAN = 0.6;
/** The engine's spin-up, a share a second (`plane.ts`'s spool of the
 * propeller on the start) — the run-up is the climb as a share of it. */
const SPIN_RATE = 0.5;
/** The propeller's rpm on the ground at idle, a share of the governed —
 * the governor takes it up to its hold by this much power. */
const IDLE_RPM = 0.62;
const GOVERN_AT = 0.35;
/** The legs' working, m/s of compression, at which the snow is as rough
 * as it is heard. */
const ROUGH_FULL = 0.35;
/** The crackle's salt: the plane's fire pops on slots of its own. */
const CRACKLE_SALT = 5;

/** One step of a one-pole filter on a time constant. */
function follow(previous: number, target: number, dt: number, tau: number): number {
  return previous + (target - previous) * (1 - Math.exp(-dt / tau));
}

/** How far the wreck is alight, 0..1, `t` s into its burn. */
export function planeBurnOf(p: Pick<PlaneState, "mode" | "t">): number {
  if (p.mode !== "wreck") return 0;
  const lit = Math.min(1, Math.max(0, p.t / CATCH));
  const left = PLANE.crash.wreck - p.t;
  return lit * Math.min(1, Math.max(0, left / DIE));
}

/** THE PROPELLER'S RPM as heard, a share of the governed: the spool (the
 * start), and on the snow the slower idle the governor lets it turn at
 * low power. In the air it holds. */
export function propRpmOf(p: Pick<PlaneState, "spin" | "power" | "grounded">): number {
  const govern = p.grounded
    ? Math.min(1, Math.max(0, (p.power - PLANE.engine.idle) / (GOVERN_AT - PLANE.engine.idle)))
    : 1;
  return p.spin * (IDLE_RPM + (1 - IDLE_RPM) * govern);
}

/** THE PLANE AGAINST THE EAR — a `PlaneVoice` read off the state, with the
 * propeller as the bed heard it (`spin`, its own wind-down), the run-up
 * (`rise`), the snow's roughness (`rough`) and the flaps' run (`flapRun`),
 * and the seat's `cabin` (applied only with him aboard). */
export function planeVoiceOf(
  state: GameState,
  heard: { spin: number; rise: number; rough: number; flapRun: number },
  cabin: number,
): PlaneVoice {
  const p = state.plane!;
  const c = state.skier;
  const hub = planePoint(p, HUB);
  const dx = hub.x - c.x;
  const dy = hub.y - (c.y + EAR);
  const dz = hub.z - c.z;
  const distance = Math.hypot(dx, dy, dz);
  // CLOSING: the plane's velocity less the ear's, along the line to it —
  // positive coming on. Nothing while he rides it.
  let closing = 0;
  if (!p.rider && distance > 5) {
    closing = -((p.vx - c.vx) * dx + (p.vy - c.vy) * dy + (p.vz - c.vz) * dz) / distance;
  }
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const flat = Math.hypot(dx, dz);
  const across = flat > 1 && !p.rider ? (dx * fz - dz * fx) / flat : 0;
  const spin = heard.spin;
  return {
    rpm: propRpmOf({ spin, power: p.power, grounded: p.grounded }),
    // The gas generator leads the propeller on the start, and climbs with
    // the power.
    ng: Math.sqrt(Math.max(0, spin)) * (0.62 + 0.38 * p.power),
    rise: heard.rise,
    power: p.mode === "wreck" ? 0 : p.power,
    load: Math.min(1, Math.abs(p.thrust) / PLANE.engine.staticThrust),
    airspeed: p.airspeed,
    door: p.door,
    cabin: p.rider ? cabin : 0,
    roll: p.grounded && p.mode !== "wreck" ? Math.hypot(p.vx, p.vz) : 0,
    rough: heard.rough,
    warn:
      p.rider && p.mode === "flown"
        ? stallWarnOf({
            aoa: p.aoa + PLANE.wing.incidence - PLANE.aero.zeroLift,
            stall: PLANE.aero.stall.wing,
            stalled: p.stalled,
            grounded: p.grounded,
          })
        : 0,
    flapRun: heard.flapRun,
    distance,
    doppler: dopplerOf(closing),
    pan: across * SCREEN_TO_ENGINE * PAN,
    fire: planeBurnOf(p),
    t: state.t,
  };
}

/** The plane's bed, for the whole life of one app. */
export type PlaneBed = {
  /** Steer every layer and raise the fire's pops. Call once per rendered
   * frame; builds nothing on a run with no plane. */
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createPlaneBed(synth: Synth): PlaneBed {
  const rack: Rack<PlaneLayer> = createRack(synth, PLANE_LAYERS, PLANE_GLIDE);
  let listener: Listener = listenerFor("chase");
  let spin = 0;
  let last = Number.NaN;
  let rise = 0;
  let legs = Number.NaN;
  let rough = 0;
  let flaps = Number.NaN;
  let flapRun = 0;
  let slot = Number.NaN;
  let built = false;

  const forget = (): void => {
    spin = 0;
    last = Number.NaN;
    rise = 0;
    legs = Number.NaN;
    rough = 0;
    flaps = Number.NaN;
    flapRun = 0;
    slot = Number.NaN;
  };
  const hush = (): void => {
    rack.stop();
    built = false;
  };

  return {
    update(state, dt, duck = 1) {
      const p = state.plane;
      if (!p) {
        if (built) hush();
        forget();
        return;
      }
      if (synth.now() === null) return;
      const frame = Math.max(1 / 240, Math.min(0.1, dt));

      // THE PROPELLER AS HEARD: the engine's, until it hits the snow.
      spin = p.mode === "wreck" ? follow(spin, 0, frame, CHOKE) : p.spin;
      const climb = Number.isNaN(last) ? 0 : (p.spin - last) / frame / SPIN_RATE;
      rise = follow(rise, Math.min(1, Math.max(0, climb)), frame, 0.25);
      last = p.spin;
      // THE SNOW'S ROUGHNESS: how fast the legs work.
      const sum = p.legs[0] + p.legs[1] + p.legs[2];
      const work = Number.isNaN(legs) ? 0 : Math.abs(sum - legs) / frame;
      rough = follow(rough, Math.min(1, work / ROUGH_FULL), frame, 0.1);
      legs = sum;
      // THE FLAPS' RUN: their travel over the frame against a full run.
      const move = Number.isNaN(flaps)
        ? 0
        : (Math.abs(p.surfaces.flaps - flaps) / frame) * PLANE.controls.flapRun;
      flapRun = follow(flapRun, Math.min(1, move * 1.5), frame, 0.06);
      flaps = p.surfaces.flaps;

      const voice = planeVoiceOf(state, { spin, rise, rough, flapRun }, listener.cabin);
      voice.pan *= listener.side;
      if (spin <= 0.002 && voice.fire <= 0 && !built) return;
      rack.apply(planeTargets(voice, PROP, { machine: listener.machine * duck }));
      built = true;

      // ── The crackle ──────────────────────────────────────────────────
      if (voice.fire > 0 && voice.distance < HEARD_FAR) {
        const now = Math.floor(state.t * CRACKLE_SLOTS);
        const from = Number.isNaN(slot) || now < slot ? now - 1 : slot;
        const air = heliHeard(voice.distance);
        let pops = 0;
        for (let s = Math.max(from + 1, now - CRACKLE_SLOTS); s <= now; s++) {
          const pop = crackleAt(s * 3 + CRACKLE_SALT, voice.fire);
          if (!pop) continue;
          if (++pops > MOST_POPS) break;
          playSound(synth, RUN_BANK, "heli_crackle", {
            gain: pop.size * air.gain * listener.machine * listener.events * duck,
            pitch: pop.pitch * (0.6 + 0.4 * air.bright) * listener.muffle,
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
