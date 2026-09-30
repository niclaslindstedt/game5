// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INPUT MATHS, with no DOM in it: what a held key ramps to, what a thumb
// on the glass is asking for, and the one sign flip between the screen and
// the engine. `input.ts` owns the listeners and hands this module pixels
// and key states; `hud-touch.tsx` hands it drags. Everything here is a pure
// function of its arguments so the root suite can hold the feel numbers to
// their shape without a browser (tests/input_model_test.ts).
//
// SIGN BOUNDARY, stated ONCE. Everything on the screen side is SCREEN-space:
// positive steer means "the tips go right as seen through the chase
// camera". The engine's positive steer is CLOCKWISE IN MAP VIEW (heading
// grows from +z toward +x), and the renderer maps engine axes straight onto
// three.js's right-handed y-up frame, whose view from behind the skier
// MIRRORS the map — so from behind him the engine's positive steer is a
// LEFT turn. `SCREEN_TO_ENGINE` is that flip; `sampleInput` applies it to
// the steer, the HUD's missed-gate arrow applies it to a bearing, and
// nothing else may.

import type { SkierInput } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { snapInput } from "./ghost.ts";

export const SCREEN_TO_ENGINE = -1;

/** Keyboard edge ramp, 1/s: a held key eases toward full edge at this
 * rate (about a sixth of a second to full)... */
export const KEY_STEER_ATTACK = 6;
/** ...and a released one snaps back to centre at this one — faster, so
 * letting go is letting go, not a slow unwind. */
export const KEY_STEER_RELEASE = 9;
/** Below this the centred keyboard axis snaps to exactly zero. */
export const KEY_AXIS_SNAP = 0.02;
/** The tuck key's ramp, 1/s: a quarter-second time constant, so a tap is
 * a dip of the shoulders and a hold is the whole crouch; and a release
 * that stands up at once, because a skier standing up out of a tuck does
 * it in one movement. */
export const KEY_TUCK_ATTACK = 4;
export const KEY_TUCK_RELEASE = 12;
/** The brake key's ramp, 1/s — quick both ways: a skid is THROWN, not
 * eased into, and the engine's own lag on it (`SkierState.brake`) is what
 * is meant to soften it, not a second made-up lag here. */
export const KEY_BRAKE_ATTACK = 20;
export const KEY_BRAKE_RELEASE = 30;
/** The lean keys' ramp, 1/s. Quick, because in the air the lean IS the
 * pitch control and a skier fixing a landing has a fraction of a second to
 * do it in; coming back to centre is quicker still. */
export const KEY_LEAN_ATTACK = 10;
export const KEY_LEAN_RELEASE = 14;

/** Walk `value` toward `target` at `attack` per second when the target is
 * away from centre and `release` when it is centre, over `dt` seconds. A
 * first-order ease rather than a linear ramp: the first bit of lock arrives
 * quickly and the last bit settles, which is what a hand does. */
export function rampToward(
  value: number,
  target: number,
  dt: number,
  attack: number,
  release: number,
): number {
  const rate = target === 0 ? release : attack;
  const next = value + (target - value) * Math.min(1, rate * dt);
  return target === 0 && Math.abs(next) < KEY_AXIS_SNAP ? 0 : next;
}

/** THE TUCK LEVER. A touch anchors the lever in a FULL TUCK under the
 * thumb: a thumb on the glass is a skier folded out of the wind, which is
 * what a race asks of him nearly all the time, and a lever that tucked only
 * as it was dragged made every start and every exit a hand-over. Anywhere
 * at or below the anchor is the full tuck; sliding UP stands the skier up
 * over `LEVER_EASE_PX`, and he is standing tall at the top of that throw.
 * Anchoring at the touch point rather than at a fixed zero means the lever
 * works wherever the thumb lands. */
export const LEVER_EASE_PX = 60;
/** ...and further UP again is the SKID: past a small dead band over the
 * standing point, so a thumb standing up never throws it by accident, this
 * much more travel is the skis pivoted all the way across. */
export const LEVER_BRAKE_DEAD_PX = 12;
export const LEVER_BRAKE_PX = 60;

/** HOW A SKIER HAS ASKED THE THUMBS TO FEEL (OPTIONS ▸ CONTROLS):
 * `sensitivity` multiplies every thumb's travel before it is read, so above
 * one the whole throw is shorter; `invertLean` reads the edge control
 * pushed AWAY as the lean back, the way a flight stick does. The keys never
 * pass through it — a key is a whole press either way, and the binding page
 * is how a key is turned round. */
export type TouchFeel = { sensitivity: number; invertLean: boolean };
export const PLAIN_FEEL: TouchFeel = { sensitivity: 1, invertLean: false };

/** How deep the tuck is for a thumb `dyPx` below its anchor (screen y
 * grows downward): the full tuck at the anchor and below it, standing up
 * analogue over `LEVER_EASE_PX` of travel up, standing tall past that. */
export function leverTuck(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  return clamp(1 + (dyPx * feel.sensitivity) / LEVER_EASE_PX, 0, 1);
}

/** ...and how far the skid is thrown for the same thumb: the travel above
 * the standing point past the dead band, 0..1. One throw carries both, so
 * a skier can never be asking for the tuck and the skid with the same
 * thumb. */
export function leverBrake(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const past = -dyPx * feel.sensitivity - LEVER_EASE_PX - LEVER_BRAKE_DEAD_PX;
  if (past <= 0) return 0;
  return clamp(past / LEVER_BRAKE_PX, 0, 1);
}

/** THE EDGE CONTROL, AND HOW BIG IT IS. Thumb travel from the anchor to
 * the end of its throw — full edge across, full lean up and down, and the
 * radius the reach ring is drawn at (`hud-touch.tsx`), so the circle a
 * player can see IS the control's whole extent on both axes. */
export const BAR_REACH_PX = 90;
/** The throw is shaped `travel ** this`, so the first centimetre of thumb
 * buys less edge than the last: a slight edge is a target a thumb can hit
 * instead of the twitch either side of flat. */
export const BAR_THROW_CURVE = 1.15;
/** The dead band around the anchor a sideways drag may wander in without
 * shifting the skier's weight: an edge alone must never lean the body. */
export const LEAN_DEAD_PX = 14;
/** ...and the travel past it for full lean, px: the lean maxes exactly where
 * the reach ring is drawn, as the steer does. */
export const LEAN_REACH_PX = BAR_REACH_PX - LEAN_DEAD_PX;

/** Screen-space steer, -1..1, for a thumb `dxPx` right of its anchor. */
export function barSteer(dxPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const travel = clamp((dxPx * feel.sensitivity) / BAR_REACH_PX, -1, 1);
  return Math.sign(travel) * Math.abs(travel) ** BAR_THROW_CURVE;
}

/** Lean, -1..1, for a thumb `dyPx` below its anchor: pulling the control
 * TOWARD the player (down the glass) is leaning BACK (+1, tips up — the
 * engine's sign), pushing it away is leaning forward. The dead band is
 * spent before the travel counts. */
export function barLean(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const dy = dyPx * feel.sensitivity * (feel.invertLean ? -1 : 1);
  const beyond = Math.max(0, Math.abs(dy) - LEAN_DEAD_PX);
  if (beyond === 0) return 0;
  return clamp((Math.sign(dy) * beyond) / LEAN_REACH_PX, -1, 1);
}

/** Where the edge control's reach ring is drawn for a feel, px: the thumb
 * travel that IS full edge, so the circle a player sees is still the
 * control's whole extent at any sensitivity. */
export function barReachPx(feel: TouchFeel = PLAIN_FEEL): number {
  return BAR_REACH_PX / feel.sensitivity;
}

/** Which keys are down, as the actions they are bound to. */
export type KeysHeld = {
  left: boolean;
  right: boolean;
  tuck: boolean;
  brake: boolean;
  leanBack: boolean;
  leanForward: boolean;
  /** The grab button (`strokes.ts`'s poses) — a switch, not a ramp. */
  trick: boolean;
};

export const NO_KEYS: KeysHeld = {
  left: false,
  right: false,
  tuck: false,
  brake: false,
  leanBack: false,
  leanForward: false,
  trick: false,
};

/** What the thumb zones have written, screen-space, at pointer rate. A zone
 * that is not being touched writes zeros and `false`; the one that IS being
 * touched overrides the keyboard on the axes it owns. */
export type TouchChannel = {
  /** The edge control: steer and lean, and whether a thumb is on it. */
  steer: number;
  lean: number;
  bar: boolean;
  /** The lever, 0..1 each way from its anchor, and whether a thumb is on
   * it. Only one of the two can be on: the thumb is either below the
   * anchor (the tuck) or above it (the skid). */
  tuck: number;
  brake: number;
  lever: boolean;
};

export function neutralTouch(): TouchChannel {
  return { steer: 0, lean: 0, bar: false, tuck: 0, brake: 0, lever: false };
}

/** The keyboard's ramped axes, screen-space. Advanced once per STEP (§37.1)
 * so a ramp is the same ramp on every display. */
export type InputModel = {
  steer: number;
  tuck: number;
  brake: number;
  lean: number;
  /** The tuck and brake keys as the last step saw them — what a press
   * IN THE AIR is told apart from a hold carried off the snow by. */
  wasTuck: boolean;
  wasBrake: boolean;
  /** Whether each of them is leaning the skier this flight (`airLean`). */
  tuckLeans: boolean;
  brakeLeans: boolean;
};

export function createInputModel(): InputModel {
  return {
    steer: 0,
    tuck: 0,
    brake: 0,
    lean: 0,
    wasTuck: false,
    wasBrake: false,
    tuckLeans: false,
    brakeLeans: false,
  };
}

/**
 * THE TUCK AND THE BRAKE KEYS LEAN IN THE AIR. W is the tuck and S the
 * skid on the snow; off it they are also the skier's weight — W forward
 * (tips down), S back (tips up) — so the hand already on them can set the
 * skis' pitch for the landing. The lean keys proper (the arrows, Q / E)
 * OVERRIDE them: while either is down the tuck and the brake keys lean
 * nothing.
 *
 * ONLY A PRESS MADE IN THE AIR LEANS. Every skier holds the tuck over every
 * crest, and a hold carried off the lip that pitched the tips down would be
 * a landing over the tips on every jump of a race (and, on a tricks run, a
 * front flip thrown by accident at the lip). So the key has to go down
 * while the skier is flying — let go and pressed again, or pressed fresh —
 * and a landing hands it back to the engine alone.
 *
 * S leaning is S NOT BRAKING: a skid thrown in the air would land the skis
 * across the way. W leaning keeps the tuck — the tuck moves nothing in the
 * air — so the skier is still folded when the snow comes back.
 *
 * Returns the lean the two keys ask for, -1..1, screen-space as the lean
 * keys are (+1 back).
 */
export function airLean(model: InputModel, keys: KeysHeld, airborne: boolean): number {
  const pressedTuck = keys.tuck && !model.wasTuck;
  const pressedBrake = keys.brake && !model.wasBrake;
  model.wasTuck = keys.tuck;
  model.wasBrake = keys.brake;
  model.tuckLeans = airborne && keys.tuck && (model.tuckLeans || pressedTuck);
  model.brakeLeans = airborne && keys.brake && (model.brakeLeans || pressedBrake);
  return (model.brakeLeans ? 1 : 0) - (model.tuckLeans ? 1 : 0);
}

/** One step's input: advance the keyboard ramps by `dt`, merge the thumbs
 * in, apply the sign flip and hand the engine its structure. `reset` is the
 * edge the caller has banked since the last step (§37.1: a press is never
 * lost between steps).
 *
 * Merging: a thumb on the edge control owns steer and lean outright — a key
 * held under it would fight the hand. The tuck takes the DEEPER of key and
 * lever, and so does the brake; and then the brake WINS over the tuck,
 * because a skier throwing a skid is not also asking to go faster,
 * whichever hand the other input came from.
 *
 * `airborne` is whether the skier being ridden is off the snow this step —
 * the one thing about the run the keyboard's maths reads (`airLean`). */
export function sampleInput(
  model: InputModel,
  keys: KeysHeld,
  touch: TouchChannel,
  dt: number,
  reset: boolean,
  airborne = false,
): SkierInput {
  const keyAir = airLean(model, keys, airborne);
  const steerTarget = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  model.steer = rampToward(model.steer, steerTarget, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  model.tuck = rampToward(model.tuck, keys.tuck ? 1 : 0, dt, KEY_TUCK_ATTACK, KEY_TUCK_RELEASE);
  model.brake = rampToward(
    model.brake,
    keys.brake && !model.brakeLeans ? 1 : 0,
    dt,
    KEY_BRAKE_ATTACK,
    KEY_BRAKE_RELEASE,
  );
  const leanTarget =
    keys.leanBack || keys.leanForward
      ? (keys.leanBack ? 1 : 0) - (keys.leanForward ? 1 : 0)
      : keyAir;
  model.lean = rampToward(model.lean, leanTarget, dt, KEY_LEAN_ATTACK, KEY_LEAN_RELEASE);

  const steer = touch.bar ? touch.steer : model.steer;
  const lean = touch.bar ? touch.lean : model.lean;
  const brake = clamp(Math.max(model.brake, touch.lever ? touch.brake : 0), 0, 1);
  const tuck = clamp(Math.max(model.tuck, touch.lever ? touch.tuck : 0), 0, 1);
  // ON THE TAPE'S GRID (`ghost.ts`'s `snapInput`), here where the input is
  // made: the figure the engine is ridden on IS the figure a ghost records.
  return snapInput({
    // `0 * -1` is -0, and a -0 is a wart every equality downstream trips on.
    steer: steer === 0 ? 0 : clamp(steer, -1, 1) * SCREEN_TO_ENGINE,
    tuck: brake > 0 ? 0 : tuck,
    brake,
    lean: clamp(lean, -1, 1),
    reset,
    trick: keys.trick,
  });
}
