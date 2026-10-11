// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S SCHEDULER — the half that reads the free ride's jump
// (`GameState.chute`) once a frame and steers its layers (`chute-voice.ts`):
// the exit's buffet, the freefall's roar by his speed and how his body
// lies (in a wingsuit, its flutter too), the canopy flogging open, the quiet under it, the cut-away canopy
// flapping away — and, caught in a crown or on a lift, the CREAK of what
// holds him, a cue drawn off the engine's clock (a hash of the slot, never
// a stream), the tree's wood or the rope's steel.
//
// WHO OWNS THE AIR (`rideShares`): in the plane's door the cabin is the
// plane's bed and the skier's own wind and skis stand down (he is not on
// the snow, and the slipstream through the door is the plane's); out of it,
// until the canopy is over him, the freefall's roar is this bed's and the
// ride bed's wind stands down. Under the canopy, cut away, landed or
// caught, the ride bed's wind is his air again.
//
// Built only on a ride with a jump (`state.chute`); anywhere else it
// builds nothing and costs nothing.

import { CHUTE, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

import { RUN_BANK } from "./bank.ts";
import {
  CHUTE_GLIDE,
  CHUTE_LAYERS,
  chuteTargets,
  type ChuteLayer,
  type ChuteVoice,
} from "./chute-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";

/** The ear over the skier's boots, m. */
const EAR = 1.6;
/** The exit's buffet, s: full out of the door, gone by this. */
const BUFFET_FOR = 3;
/** The deployment's stages that are still the body in the air (the pilot
 * chute and the bag), and the flog each stage makes. */
const FLOG: Record<string, number> = { pilot: 0.15, bag: 0.35, lines: 0.6, snivel: 1, inflate: 1 };
/** A caught canopy's creaks: slots a second, and the share that creak. */
const CREAK_SLOTS = 2;
const CREAK_SHARE = 0.4;

/** A slot's own draw, 0..1 — a hash of its index, never a stream. */
function slotDraw(slot: number, salt: number): number {
  let h = Math.imul(slot ^ 0x7f4a7c15, 0x85ebca6b) ^ Math.imul(salt + 3, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** WHETHER WHAT HOLDS HIM CREAKS in slot `slot`, and how: its size and
 * pitch. */
export function creakAt(slot: number): { size: number; pitch: number } | null {
  if (slotDraw(slot, 0) >= CREAK_SHARE) return null;
  return { size: 0.5 + 0.5 * slotDraw(slot, 1), pitch: 0.8 + 0.4 * slotDraw(slot, 2) };
}

/** HOW MUCH OF THE RIDE BED IS HIS: the skier's own wind and his skis on
 * the snow, 0..1 each. */
export function rideShares(state: GameState): { air: number; snow: number } {
  if (state.plane?.rider) return { air: 0, snow: 0 };
  const m = state.chute?.mode;
  if (m === "exit" || m === "freefall" || m === "deploying") return { air: 0, snow: 1 };
  return { air: 1, snow: 1 };
}

/** How fast the hands work the controls that reads as a whole pull, 1/s
 * of a control's travel (a full throw in a quarter of a second). */
const PULL_FULL = 4;

/** HOW FAST HIS HANDS ARE WORKING the toggles and the risers, 0..1: the
 * controls' travel between `was` and `now` over `dt` s. */
export function pullOf(
  was: { brake: number; steer: number; riser: number },
  now: { brake: number; steer: number; riser: number },
  dt: number,
): number {
  if (dt <= 0) return 0;
  const moved =
    Math.abs(now.brake - was.brake) +
    Math.abs(now.steer - was.steer) +
    Math.abs(now.riser - was.riser);
  return Math.min(1, moved / dt / PULL_FULL);
}

/** THE JUMP AGAINST THE EAR — a `ChuteVoice` read off the state (his hands'
 * `pull` this frame, 0..1, the bed's), or null when nothing of it is to be
 * heard. */
export function chuteVoiceOf(state: GameState, pull = 0): ChuteVoice | null {
  const ch = state.chute;
  if (!ch) return null;
  const c = state.skier;
  const d = ch.deploy;
  const deploying = ch.mode === "deploying" && d;
  // Through the deployment the body gives the air over to the canopy, from
  // line stretch to full inflation.
  const suited = ch.suit === "wingsuit";
  const stages = (suited ? CHUTE.base.deploy : CHUTE.deploy).stages;
  const lines = stages[2].end;
  const full = stages[4].end;
  const body =
    ch.mode === "exit" || ch.mode === "freefall"
      ? 1
      : deploying
        ? 1 - Math.min(1, Math.max(0, (d.t - lines) / (full - lines)))
        : 0;
  const flog = deploying
    ? (FLOG[d.stage] ?? 0) * (d.stage === "inflate" ? 1 - 0.7 * d.share : 1)
    : 0;
  const open = ch.mode === "open" ? 1 : deploying && d.stage === "inflate" ? d.share * d.share : 0;
  const p = ch.piece;
  let piece = 0;
  let pieceDistance = 0;
  if (p && !p.down) {
    piece = Math.hypot(p.vx, p.vy, p.vz);
    pieceDistance = Math.hypot(p.x - c.x, p.y - (c.y + EAR), p.z - c.z);
  }
  if (body <= 0 && flog <= 0 && open <= 0 && piece <= 0) return null;
  return {
    body,
    exit: ch.mode === "exit" ? Math.max(0, 1 - ch.t / BUFFET_FOR) : 0,
    airspeed: ch.airspeed,
    attitude: ch.attitude,
    track: ch.track,
    flog,
    open,
    brake: ch.controls.brake,
    turn: Math.abs(ch.controls.steer),
    pull,
    riser: Math.abs(ch.controls.riser),
    stalled: ch.stalled,
    piece,
    pieceDistance,
    t: state.t,
    ...(suited ? { suit: ch.wing?.pressure ?? 0 } : {}),
  };
}

/** The skydive's bed, for the whole life of one app. */
export type ChuteBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createChuteBed(synth: Synth): ChuteBed {
  const rack: Rack<ChuteLayer> = createRack(synth, CHUTE_LAYERS, CHUTE_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  let slot = Number.NaN;
  // His hands on the controls last frame, and the pull eased between frames.
  const hands = { brake: 0, steer: 0, riser: 0 };
  let pull = 0;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, dt, duck = 1) {
      const ch = state.chute;
      if (!ch) {
        if (built) hush();
        slot = Number.NaN;
        return;
      }
      if (synth.now() === null) return;
      const k = ch.controls;
      const now = pullOf(hands, k, dt);
      pull = Math.max(now, pull * Math.exp(-dt / 0.12));
      hands.brake = k.brake;
      hands.steer = k.steer;
      hands.riser = k.riser;
      const voice = chuteVoiceOf(state, ch.mode === "open" ? pull : 0);
      if (voice) {
        rack.apply(
          chuteTargets(voice, { wind: listener.wind * duck, machine: listener.machine * duck }),
        );
        built = true;
      } else if (built) {
        hush();
      }
      // ── Caught: what holds him creaks ───────────────────────────────
      if (ch.mode === "snagged" && ch.snag) {
        const now = Math.floor(state.t * CREAK_SLOTS);
        const from = Number.isNaN(slot) || now < slot ? now - 1 : slot;
        for (let s = Math.max(from + 1, now - 2); s <= now; s++) {
          const creak = creakAt(s);
          if (!creak) continue;
          const wood = ch.snag.on === "tree";
          playSound(synth, RUN_BANK, wood ? "chute_creak" : "chute_creak_steel", {
            gain: creak.size * listener.events * duck,
            pitch: creak.pitch * listener.muffle,
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
      slot = Number.NaN;
    },
    live: () => rack.live(),
  };
}
