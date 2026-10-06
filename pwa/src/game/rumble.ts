// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE SKIER FEELS IN THEIR HANDS — which moments of a race are worth a
// pulse of vibration, and how big each one is.
//
// The same shape as the audio surface and for the same reason: the engine
// emits `GameEvent`s and has no idea any of them are felt, so the whole
// opinion lives out here in one table a reader can check. `audio/route.ts`
// is the sibling worth reading beside this one — an event that makes a big
// noise usually deserves a big pulse, and where the two disagree it is on
// purpose.
//
// THE TRACK IS THE CONTINUOUS ONE. A skier at speed on a rough piste does not
// glide, it CHATTERS: the skis hammer over every rut and mogul and the skier
// takes each one through the bars. That is not an event and never becomes
// one — it is the suspension's own travel, read off the skier every STEP
// (`SkierState.skiCompression`) and paid out as a short pulse no oftener than
// {@link RUMBLE.chatterGap}. The other thing read off the state is ROLLING
// OVER, the moment the skier goes over onto his side — the engine counts that
// (`overFor`) but has no event for it, and it is the hardest thing that
// happens in the hands. Everything else here is a BLOW: the skier arriving
// after air, a trunk.
//
// WHAT DOES NOT RUMBLE, and why. A phone has one motor and no mixer: two
// pulses at once are one pulse, so every buzz spent on news is a buzz taken
// off the next landing. A lap, a missed checkpoint, a reset, the finish:
// read on the HUD and heard in the bank, never felt. A CHECKPOINT is the one
// piece of news that is — a single light tick, the lightest thing in the
// table, because it is the moment the skier aimed for with his whole body
// and a flag going past the eye at eighty is easy to lose. Take-off (`air`)
// is left out for a sharper reason: the lip is the moment the skier STOPS
// touching anything, and a buzz on the way up would be the machine
// contradicting the snow.
//
// DOM-free, so the whole table is testable without a device: the pulse goes
// to a sink the caller hands in (`haptics.ts` is the one that touches a
// motor), and the clock is the frame's own `dt`.

import { TUNING, type GameEvent, type SkierState } from "@engine";

/** One pulse, as the two things a device might be able to express.
 *
 * `ms` is how long the buzz lasts and is the only axis the web's Vibration
 * API has. `strength` is 0..1 of the hardest thing the game ever asks for,
 * which a native haptic engine spends on its own vocabulary
 * (`native/src/rumble.ts` turns it into a style and a count). */
export type Rumble = { ms: number; strength: number };

/** The knobs behind the table below, in one place so "less of all of it" is
 * one edit rather than a sweep. */
export const RUMBLE = {
  /** The longest pulse in the game, ms — the skier going over. Past about a
   * quarter of a second a phone buzz stops reading as an impact and starts
   * reading as a notification. */
  longest: 260,
  /** A checkpoint's tick: short and light — news, not a blow. */
  checkpoint: { ms: 22, strength: 0.18 } as Rumble,
  /** THE TRACK UNDER THE SKIS. The chatter is read as the suspension's
   * travel rate, m/s of compression change across one step, averaged over
   * the two skis; below `chatterFrom` the springs are soaking up snow that
   * is simply not rough, and at `chatterFull` the skis are slamming. */
  chatterFrom: 0.9,
  chatterFull: 4,
  /** One chatter pulse per this many seconds. Past a handful a second the
   * hand stops feeling bumps and starts feeling a buzz — which is also the
   * fastest way to flatten a phone. */
  chatterGap: 0.12,
  chatterMs: 24,
  chatterStrength: [0.15, 0.5] as const,
  /** A landing is reported as an event and sized below; the suspension's
   * slam on it must not ALSO be paid out as chatter. This long after a
   * landing, s, the travel is the landing's own. */
  landingOwns: 0.3,
} as const;

/** The speed INTO the slope at which a landing is as big as it gets, m/s —
 * the same axis the engine charges a harsh landing on (`TUNING.air`). */
const LAND_FULL = 12;

/** Closing speed at which a trunk met is as big as it ever gets, m/s. */
const HIT_FULL = 20;

/** The closing speed on a gate pole felt at full strength, m/s. */
const POLE_FULL = 12;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** What one event is worth in the hands. Null means it is not felt. */
export function rumbleForEvent(event: GameEvent): Rumble | null {
  switch (event.kind) {
    // THE SKIER ARRIVING, sized by how fast he met the slope — a short hop
    // onto a flat lands harder than a long flight down the back of a
    // landing hill — and a HARSH one, where the suspension could not take
    // it all, is a step harder again: that one is felt in the wrists.
    case "land": {
      const big = ramp(event.impact, 1, LAND_FULL);
      return { ms: 60 + 130 * big, strength: (event.harsh ? 0.72 : 0.4) + 0.25 * big };
    }

    // A trunk. A glancing brush is a knock; a pine met at twenty is the
    // hardest single blow in the game short of going over.
    case "hit": {
      const hard = ramp(event.speed, 2, HIT_FULL);
      return { ms: 90 + 140 * hard, strength: 0.6 + 0.38 * hard };
    }

    // THE WIPEOUT: the skier off his skis — the longest blow in the
    // game, level with going over, whatever put him off. The trunk or the
    // landing that caused it is felt on the same step, and one motor plays
    // the bigger of the two.
    case "wipeout":
      return { ms: RUMBLE.longest, strength: 1 };

    // A SAVE: the body fighting to stay on its skis — a short shudder, as
    // big as the fall it nearly was. The landing or the trunk that started
    // it is felt on the same step, and the motor plays the bigger.
    case "save":
      return { ms: 70 + 110 * event.size, strength: 0.3 + 0.4 * event.size };

    // BOGGED: the skier sunk to the knees in powder — a low, short shudder
    // so the hands know the poles have stopped doing anything.
    case "stuck":
      return { ms: 120, strength: 0.3 };

    // ANOTHER SKIER — a shoulder rather than a tree: shorter and softer than
    // the same speed into wood, because the other machine gives.
    case "bump": {
      const hard = ramp(event.speed, 1, HIT_FULL);
      return { ms: 50 + 90 * hard, strength: 0.35 + 0.35 * hard };
    }

    // A GATE POLE driven over: a knock in the hands, sized by how hard he
    // closed on it — softer than a shoulder, because a flex pole gives.
    case "pole": {
      const hard = ramp(event.speed, 2, POLE_FULL);
      return { ms: 40 + 50 * hard, strength: 0.25 + 0.3 * hard };
    }

    // AN EDGE STAKE bent over or snapped: the same knock, a little more
    // where it broke.
    case "stake": {
      const hard = ramp(event.speed, 2, POLE_FULL);
      return { ms: 40 + 50 * hard, strength: 0.2 + 0.3 * hard + (event.broke ? 0.15 : 0) };
    }

    // INTO THE A-NETS (R32): a long soft heave, the mesh taking him — the
    // harder he drove into it, the longer and fuller.
    case "net": {
      const hard = ramp(event.speed, 1, HIT_FULL);
      return { ms: 160 + 200 * hard, strength: 0.4 + 0.4 * hard };
    }

    // THE WAND — one short tap, so a skier looking at the piste
    // rather than the count still knows the tuck is his.
    case "go":
      return { ms: 60, strength: 0.5 };

    case "checkpoint":
      return RUMBLE.checkpoint;

    default:
      return null;
  }
}

/** What a skier has to carry for his legs and his roll to be read.
 * Every field is written once per step by the engine. */
export type SkisRead = Pick<SkierState, "skiCompression" | "landing" | "overFor" | "airborne">;

/** ROLLED OVER — the whole of what the motor has. Stated as a pulse of its
 * own because it is not an event: it is the edge of `overFor` leaving 0. */
export const ROLL_OVER: Rumble = { ms: RUMBLE.longest, strength: 1 };

/**
 * THE TRACK UNDER THE SKIS, this step — or null while the springs are
 * merely riding rather than being hammered. `was` is the mean ski
 * compression one step earlier, m.
 */
export function rumbleForChatter(skis: SkisRead, was: number): Rumble | null {
  if (skis.airborne || skis.landing < RUMBLE.landingOwns) return null;
  const now = (skis.skiCompression[0] + skis.skiCompression[1]) / 2;
  const rate = Math.abs(now - was) / TUNING.dt;
  if (rate <= RUMBLE.chatterFrom) return null;
  const hard = ramp(rate, RUMBLE.chatterFrom, RUMBLE.chatterFull);
  const [soft, full] = RUMBLE.chatterStrength;
  return { ms: RUMBLE.chatterMs, strength: soft + (full - soft) * hard };
}

/** The race's rumble: events in, pulses out, plus the track underneath. */
export type RunRumble = {
  /** Translate one step's events into pulses. */
  events: (list: readonly GameEvent[]) => void;
  /**
   * The skis, read once per STEP — from inside the step loop, beside
   * `events`, and NOT once per drawn frame. A rut is a spike a couple of
   * steps wide at 120 Hz, so a per-frame reading would feel a RANDOM share
   * of the track on a slow phone. Every step is offered here and the hardest
   * since the last payout is the one that is felt; a roll-over is fired the
   * step it happens.
   */
  step: (skis: SkisRead) => void;
  /** Advance the chatter's pulse train and pay out what `step` collected;
   * call once per rendered frame, and only on the frames the player is
   * actually riding. */
  frame: (dt: number) => void;
  /** A new race, or a race put down: forget the ledger. */
  reset: () => void;
};

/**
 * ONE MOTOR, SO ONE PULSE AT A TIME.
 *
 * A device has a single vibrator and no mixer: asking for a second pulse
 * while the first is still running does not layer them, it CUTS the first
 * one off. So the ledger keeps what is currently running and refuses
 * anything weaker until it has finished — without that, a skier chattering
 * down a rough run-out would truncate the landing it came down into, and
 * the hardest moment in a race would be the shortest buzz in it.
 */
export function createRunRumble(shake: (pulse: Rumble) => void): RunRumble {
  let clock = 0;
  let busyUntil = 0;
  let busyStrength = 0;
  let nextChatter = 0;
  let pending: Rumble | null = null;
  /** The mean ski compression one step ago, and whether the skis was over
   * — the two memories the continuous readings are edges of. */
  let wasComp: number | null = null;
  let wasOver = false;

  const fire = (pulse: Rumble): void => {
    if (clock < busyUntil && pulse.strength <= busyStrength) return;
    busyUntil = clock + pulse.ms / 1000;
    busyStrength = pulse.strength;
    shake(pulse);
  };

  return {
    events(list) {
      let biggest: Rumble | null = null;
      for (const event of list) {
        const pulse = rumbleForEvent(event);
        if (pulse && (!biggest || pulse.strength > biggest.strength)) biggest = pulse;
      }
      if (biggest) fire(biggest);
    },

    step(skis) {
      const over = skis.overFor > 0;
      if (over && !wasOver) fire(ROLL_OVER);
      wasOver = over;
      const comp = (skis.skiCompression[0] + skis.skiCompression[1]) / 2;
      if (wasComp !== null) {
        const pulse = rumbleForChatter(skis, wasComp);
        if (pulse && (!pending || pulse.strength > pending.strength)) pending = pulse;
      }
      wasComp = comp;
    },

    frame(dt) {
      clock += dt;
      if (clock < nextChatter || !pending) return;
      const pulse = pending;
      pending = null;
      nextChatter = clock + RUMBLE.chatterGap;
      fire(pulse);
    },

    reset() {
      busyUntil = 0;
      busyStrength = 0;
      nextChatter = clock;
      pending = null;
      wasComp = null;
      wasOver = false;
    },
  };
}
