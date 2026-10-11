// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE FLOWN BY HAND (`plane.ts`, `SkierInput.plane`) — the maths
// of its controls off the keys and the thumbs, DOM-free so the suite reads
// it (`tests/input_plane_test.ts`); `input.ts` is the listeners.
//
// THE STICK IS EASED AND SCALED WITH THE AIRSPEED. The plane is flown on its
// physics alone (`plane-aero.ts`), and a keyboard is a stick that only knows
// the middle and the stop: full elevator snapped on at cruise drives the
// wing past its stall angle before the nose has come up, and the plane
// snaps over. A pilot's hand never does that — the stick is pulled, and how
// far it goes is felt through the load on it, which grows with the square
// of the speed. So a held key EASES the stick over (`PITCH_ATTACK`), and the
// travel it is allowed is scaled with the dynamic pressure (`pitchReach`):
// all of it near the stall, where the flare and the take-off need it, and a
// third of it at a dive's speed — still enough to pull a whole loop from
// level flight at cruise on a held key (`tests/input_plane_test.ts`), never
// enough to snap the wing. The ailerons are scaled the same way, by the
// speed alone (a roll rate grows with it). The thumbs' stick is scaled too;
// it is not eased, the thumb being its own ramp.
//
// THE HAND PULLS TO THE BUFFET, NOT THROUGH IT. The reach grows as the
// plane slows, so a stick held back over a loop's top would reach all its
// travel just where the air is thinnest and stall the wing inverted. A
// pilot feels the buffet when the inner wing starts to let go and eases
// the pull there; so does this hand (`BUFFET`, `model.pull`): the share of
// the stick's travel it gives eases off while more of the wing than that is
// stalled (pulled or pushed) and comes back once it flies again. Held back
// with full rudder is a deliberate spin entry, and then the hand pulls all
// the way.

import type { PlaneControls } from "@engine";

import { powerAxis, rampToward, SCREEN_TO_ENGINE, type TouchChannel } from "./input-model.ts";

/** Which of the plane's keys are down (`settings-plane-keys.ts`). */
export type PlaneKeysHeld = {
  throttleUp: boolean;
  throttleDown: boolean;
  stickForward: boolean;
  stickBack: boolean;
  stickLeft: boolean;
  stickRight: boolean;
  rudderLeft: boolean;
  rudderRight: boolean;
  flapsDown: boolean;
  flapsUp: boolean;
  brake: boolean;
};

export const NO_PLANE_KEYS: PlaneKeysHeld = {
  throttleUp: false,
  throttleDown: false,
  stickForward: false,
  stickBack: false,
  stickLeft: false,
  stickRight: false,
  rudderLeft: false,
  rudderRight: false,
  flapsDown: false,
  flapsUp: false,
  brake: false,
};

/** THE POWER LEVER'S TRAVEL, shares a second: a key held moves it at
 * `THROTTLE_KEY_RATE` (idle to full in two seconds), the right pad pushed
 * all the way at `THROTTLE_THUMB_RATE`. A lever: it stays where it is left. */
export const THROTTLE_KEY_RATE = 0.5;
export const THROTTLE_THUMB_RATE = 0.7;

/** THE FLAP LEVER'S NOTCHES, shares of full flap (40°): up, 10°, 20°, 30°,
 * 40° — a press moves it one notch. */
export const FLAP_NOTCH = 0.25;

/** THE STICK'S EASE on a held key, 1/s: the elevator about 0.4 s to its
 * reach, the ailerons a quarter of a second; and back to the middle on
 * release — quicker, a stick let go is let go. The pedals' as the
 * helicopter's. */
export const PITCH_ATTACK = 2.5;
export const PITCH_RELEASE = 5;
export const ROLL_ATTACK = 4;
export const ROLL_RELEASE = 8;
export const YAW_ATTACK = 6;
export const YAW_RELEASE = 9;

/** THE ELEVATOR'S REACH: all the stick's travel up to `PITCH_FULL` m/s
 * (about 1.15 × the clean stall — the flare and the rotation fly there),
 * then falling with the dynamic pressure to no less than `PITCH_LEAST` of
 * it. At a held key that pulls about 0.3 rad of attack — the inner wing at
 * its buffet, four g at cruise — a tight loop, never a snap. */
export const PITCH_FULL = 28;
export const PITCH_LEAST = 0.35;
/** The forward stick's least reach: a push needs more of the travel than a
 * pull (inverted the wing must be flown at a negative angle, and a dive at
 * full power is pushed against the trim), and its stall is the buffet's
 * to guard, as the pull's is. */
export const PUSH_LEAST = 0.7;
/** THE AILERONS' REACH: all of it up to `ROLL_FULL` m/s (the cruise),
 * falling with the speed to no less than `ROLL_LEAST`. */
export const ROLL_FULL = 60;
export const ROLL_LEAST = 0.6;

/** THE BUFFET the hand pulls to: the share of the wing stalled past which
 * it eases the back stick off, at `BUFFET_EASE` a second a share over it
 * (and back on at the same rate under it), never under `BUFFET_LEAST` of
 * the reach; and the rudder past which a held pull goes through it (the
 * spin's entry). */
export const BUFFET = 0.08;
export const BUFFET_EASE = 10;
export const BUFFET_LEAST = 0.2;
export const SPIN_RUDDER = 0.9;

/** The share of the elevator's travel the stick may use at `airspeed` m/s,
 * pulled back or (`push`) pushed forward. */
export function pitchReach(airspeed: number, push = false): number {
  const v = Math.max(1, airspeed);
  return Math.min(1, Math.max(push ? PUSH_LEAST : PITCH_LEAST, (PITCH_FULL / v) ** 2));
}

/** The share of the ailerons' travel the stick may use at `airspeed` m/s. */
export function rollReach(airspeed: number): number {
  const v = Math.max(1, airspeed);
  return Math.min(1, Math.max(ROLL_LEAST, ROLL_FULL / v));
}

/** The flying hand's memory: the power lever and the flap lever where they
 * were left, the stick's and the pedals' keyboard ramps (screen-space, in
 * shares of their reach), the flap keys as last seen (a press is a notch)
 * and the notches asked for off the HUD's flap press (`nudgeFlaps`). */
export type PlaneModel = {
  throttle: number;
  flaps: number;
  pitch: number;
  roll: number;
  yaw: number;
  /** The share of the back stick's reach the hand gives at the buffet. */
  pull: number;
  flapKeys: { down: boolean; up: boolean };
  nudge: number;
};

export function createPlaneModel(): PlaneModel {
  return {
    throttle: 0,
    flaps: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    pull: 1,
    flapKeys: { down: false, up: false },
    nudge: 0,
  };
}

/** The flap lever moved `dir` notches at the next step (the HUD's press on
 * touch: down +1, up −1). */
export function nudgeFlaps(model: PlaneModel, dir: number): void {
  model.nudge += Math.sign(dir);
}

/** The levers set to the plane's own as it is boarded (the strip's
 * take-off flap, the power wherever the engine stands), so the first
 * step flown does not slam either. */
export function seatPlaneModel(model: PlaneModel, at: { throttle: number; flaps: number }): void {
  model.throttle = Math.min(1, Math.max(0, at.throttle));
  model.flaps = Math.round(Math.min(1, Math.max(0, at.flaps)) / FLAP_NOTCH) * FLAP_NOTCH;
  model.pitch = model.roll = model.yaw = 0;
  model.pull = 1;
  model.nudge = 0;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * ONE STEP OF THE PLANE'S CONTROLS off the keys and the thumbs, at the
 * plane's own `airspeed` (m/s) and the share of its wing `stalled` — on touch the helicopter's two pads, the
 * STICK on the edge thumb's side and the POWER PAD on the lever's:
 *   * the POWER LEVER worked by its keys, or the power pad's vertical
 *     travel (pushed up opens it, at a rate), and left where it is;
 *   * the STICK off its keys (eased) or the thumb's stick, which owns both
 *     its axes while it is down — either scaled to the speed's reach, and
 *     its back travel eased off at the buffet;
 *   * the RUDDER off its keys, or the power pad's sideways travel;
 *   * the FLAPS a notch a press, off the keys or the HUD's flap press;
 *   * the BRAKES while their key is down.
 * The side-to-side axes go through the one screen-to-engine flip.
 */
export function samplePlane(
  model: PlaneModel,
  keys: PlaneKeysHeld,
  touch: TouchChannel,
  dt: number,
  airspeed: number,
  stalled = 0,
): PlaneControls {
  const lift = (keys.throttleUp ? 1 : 0) - (keys.throttleDown ? 1 : 0);
  const thumbLift = touch.power ? powerAxis(touch.powerY) : 0;
  model.throttle = clamp(
    model.throttle + (lift * THROTTLE_KEY_RATE + thumbLift * THROTTLE_THUMB_RATE) * dt,
    0,
    1,
  );
  // A flap key is a press: one notch for each time it goes down.
  let notch = model.nudge;
  if (keys.flapsDown && !model.flapKeys.down) notch += 1;
  if (keys.flapsUp && !model.flapKeys.up) notch -= 1;
  model.flapKeys.down = keys.flapsDown;
  model.flapKeys.up = keys.flapsUp;
  model.nudge = 0;
  model.flaps = clamp(model.flaps + notch * FLAP_NOTCH, 0, 1);

  const fore = (keys.stickForward ? 1 : 0) - (keys.stickBack ? 1 : 0);
  const side = (keys.stickRight ? 1 : 0) - (keys.stickLeft ? 1 : 0);
  const yaw = (keys.rudderRight ? 1 : 0) - (keys.rudderLeft ? 1 : 0);
  model.pitch = rampToward(model.pitch, fore, dt, PITCH_ATTACK, PITCH_RELEASE);
  model.roll = rampToward(model.roll, side, dt, ROLL_ATTACK, ROLL_RELEASE);
  model.yaw = rampToward(model.yaw, yaw, dt, YAW_ATTACK, YAW_RELEASE);
  const rudder = touch.power ? powerAxis(touch.powerX) : model.yaw;
  const hand = touch.stick ? clamp(touch.stickY, -1, 1) : model.pitch;
  // Eased off at the buffet; pulled through it with the rudder full over.
  const spin = hand < 0 && Math.abs(rudder) >= SPIN_RUDDER;
  model.pull = spin
    ? 1
    : clamp(model.pull + (BUFFET - stalled) * BUFFET_EASE * dt, BUFFET_LEAST, 1);
  const pitch = spin ? hand : hand * pitchReach(airspeed, hand > 0) * model.pull;
  const roll = (touch.stick ? clamp(touch.stickX, -1, 1) : model.roll) * rollReach(airspeed);
  const flip = (v: number): number => (v === 0 ? 0 : clamp(v, -1, 1) * SCREEN_TO_ENGINE);
  return {
    throttle: model.throttle,
    pitch: pitch === 0 ? 0 : pitch,
    roll: flip(roll),
    yaw: flip(rudder),
    flaps: model.flaps,
    brake: keys.brake ? 1 : 0,
  };
}
