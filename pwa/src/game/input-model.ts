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

import type { HeliControls, SkierInput } from "@engine";

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
/** ...and both the edge and the lean keys' attack IN THE AIR, 1/s: there a
 * tap is a STROKE (`strokes.ts` — half a turn on the edge, a loop on the
 * lean, on a run that lets him trick) and only counts once the axis is
 * carried past its gate, so the quickest tap a finger makes — 50 ms — must
 * get there: at this rate the edge's gate is reached in 30 ms and the
 * lean's in 55. */
export const KEY_AIR_ATTACK = 30;

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
export type TouchFeel = {
  sensitivity: number;
  invertLean: boolean;
  /** The share of `BAR_REACH_PX` the EDGE's throw spans on this run, 1 when
   * absent — shorter on a slalom (`edgeFeel`). The lean keeps its own. */
  edgeReach?: number;
};
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

/** THE JUMP ON THE LEVER'S THUMB: a TAP, then the thumb put straight back
 * down and HELD, loads the jump — and lifting it springs him. A tap is a
 * touch lifted within `JUMP_TAP_MAX` s, and the hold has to land within
 * `JUMP_TAP_GAP` s of it: the lever is under that thumb nearly all race,
 * so a jump must be a gesture no tuck ever makes by accident, and one the
 * thumb can make without leaving its place. */
export const JUMP_TAP_MAX = 0.25;
export const JUMP_TAP_GAP = 0.35;

/** The tap-and-hold's memory: when the last touch came down and when it
 * lifted (s, any one clock), and whether the touch now down is loading. */
export type JumpTap = { downAt: number; upAt: number; tapped: boolean; loading: boolean };

export function createJumpTap(): JumpTap {
  return { downAt: -1e9, upAt: -1e9, tapped: false, loading: false };
}

/** A thumb down on the lever at `t` s: is it the hold after a tap? */
export function jumpTapDown(tap: JumpTap, t: number): boolean {
  tap.loading = tap.tapped && t - tap.upAt <= JUMP_TAP_GAP;
  tap.tapped = false;
  tap.downAt = t;
  return tap.loading;
}

/** ...and lifted at `t` s. A short touch that was not itself a load is a
 * tap the next touch may follow. */
export function jumpTapUp(tap: JumpTap, t: number): void {
  tap.tapped = !tap.loading && t - tap.downAt <= JUMP_TAP_MAX;
  tap.loading = false;
  tap.upAt = t;
}

/** THE BACK KEY'S TWO MEANINGS, told apart by ORDER. Pressed with no edge
 * asked, it is the BRAKE — and an edge put on while it is held swings the
 * skis across the way into a hockey stop. Pressed with an edge ALREADY on,
 * it is the edge CUT HARDER — the skis stood further over and pressed into
 * the groove, a tighter line that costs little speed. Whichever it was when
 * it went down, it stays until it is let go. On the edge thumb the back key
 * is the thumb dragged DOWN past `BACK_TOUCH` of its lean travel, on the
 * snow only — in the air the same drag is the lean back it always was. */
export type BackMode = "none" | "brake" | "carve";
/** How far down the edge thumb has to be dragged to be the back key, as a
 * share of the lean's travel, and how much edge — keys or thumb — counts as
 * one already on when it goes down. */
export const BACK_TOUCH = 0.35;
export const EDGE_FIRST = 0.25;

/** The back key's mode for this step, off whether it is `down` and the edge
 * asked at the moment it went down (`edge`, -1..1, the raw ask). */
export function backMode(model: InputModel, down: boolean, edge: number): BackMode {
  if (!down) model.back = "none";
  else if (model.back === "none") model.back = Math.abs(edge) >= EDGE_FIRST ? "carve" : "brake";
  return model.back;
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

/** THE EDGE THROW ON A SLALOM, as a share of `BAR_REACH_PX`. A slalom
 * gate comes round every second or so and each one asks the edge thrown
 * from full on one side to full on the other: at the whole reach that is a
 * thumb swept 180 px a second, which no thumb keeps up gate after gate. At
 * this share the swing is half that, and the lean — which a slalom barely
 * asks for — keeps its whole travel, so a quick swing that strays a little
 * up or down neither leans him nor throws the back key. */
export const SLALOM_EDGE_REACH = 0.55;

/** How the thumbs read on a run of `discipline` (a race's, or null): the
 * player's own feel, with the edge's throw shortened on a slalom. */
export function edgeFeel(feel: TouchFeel, discipline: string | null): TouchFeel {
  return discipline === "slalom" ? { ...feel, edgeReach: SLALOM_EDGE_REACH } : feel;
}

/** The thumb travel that IS full edge, px, for a feel: the reach ring's
 * width, and how far the anchor trails a thumb past it (`trailAnchor`). */
export function edgeReachPx(feel: TouchFeel = PLAIN_FEEL): number {
  return (BAR_REACH_PX * (feel.edgeReach ?? 1)) / feel.sensitivity;
}

/** Screen-space steer, -1..1, for a thumb `dxPx` right of its anchor. */
export function barSteer(dxPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const travel = clamp(dxPx / edgeReachPx(feel), -1, 1);
  return Math.sign(travel) * Math.abs(travel) ** BAR_THROW_CURVE;
}

/** THE ANCHOR TRAILS A THUMB PAST FULL EDGE, sideways only: a thumb swept
 * past the ring drags the anchor along behind it, so the way back is never
 * longer than the throw. Without it a thumb that overshot by an inch had
 * that inch to come back before the edge even began to come off, and the
 * swing to full edge the other way fell short by it — gate after gate, as
 * the overshoots added up. The anchor's x for a thumb at `thumbX`. */
export function trailAnchor(anchorX: number, thumbX: number, reachPx: number): number {
  return clamp(anchorX, thumbX - reachPx, thumbX + reachPx);
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

/** How far the lean's throw reaches for a feel, px: the reach ring's
 * height, so the ring a player sees is still the control's whole extent at
 * any sensitivity (its width is the edge's, `edgeReachPx`). */
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
  /** THE JUMP: loaded while held, sprung on the release. */
  jump: boolean;
};

export const NO_KEYS: KeysHeld = {
  left: false,
  right: false,
  tuck: false,
  brake: false,
  leanBack: false,
  leanForward: false,
  trick: false,
  jump: false,
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
  /** The lever's thumb loading the jump (`jumpTapDown`). */
  jump: boolean;
  /** A DOUBLE TAP on either thumb's zone, set on the second touch and kept
   * until a step has taken it — the MACHINE press on touch
   * (`SkierInput.machine`): on to the snowmobile or the helicopter beside
   * him, or off the one he rides. */
  tap2: boolean;
  /** THE CYCLIC STICK, the edge thumb's glass while he flies the
   * helicopter (`hud-heli-pad.tsx`'s `StickZone`, `role="cyclic"`): −1..1
   * right and −1..1 pushed up (forward), screen-space, and whether a thumb
   * is on it. */
  stickX: number;
  stickY: number;
  stick: boolean;
  /** THE POWER PAD, the lever's glass while he flies (`role="power"`):
   * pushed up −1..1 works the collective up and down, across −1..1 is the
   * pedals, screen-space, and whether a thumb is on it. */
  powerX: number;
  powerY: number;
  power: boolean;
};

export function neutralTouch(): TouchChannel {
  return {
    steer: 0,
    lean: 0,
    bar: false,
    tuck: 0,
    brake: 0,
    lever: false,
    jump: false,
    tap2: false,
    stickX: 0,
    stickY: 0,
    stick: false,
    powerX: 0,
    powerY: 0,
    power: false,
  };
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
  /** What the back key went down as (`backMode`). */
  back: BackMode;
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
    back: "none",
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
 * whichever hand the other input came from. The back key is the brake or
 * the edge cut harder by the order it met the edge in (`backMode`); the
 * jump is the key or the lever thumb's tap-and-hold (`jumpTapDown`).
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
  flying = false,
): SkierInput {
  const aloft = airborne && !flying;
  const keyAir = airLean(model, keys, aloft);
  const steerTarget = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const steerAttack = aloft ? KEY_AIR_ATTACK : KEY_STEER_ATTACK;
  model.steer = rampToward(model.steer, steerTarget, dt, steerAttack, KEY_STEER_RELEASE);
  model.tuck = rampToward(model.tuck, keys.tuck ? 1 : 0, dt, KEY_TUCK_ATTACK, KEY_TUCK_RELEASE);
  // THE BACK KEY, the key or the edge thumb dragged down on the snow, and
  // which of its two meanings it went down as.
  const thumbBack = touch.bar && !airborne && !flying && touch.lean >= BACK_TOUCH;
  const back = backMode(
    model,
    (keys.brake && !model.brakeLeans) || thumbBack,
    touch.bar ? touch.steer : steerTarget,
  );
  model.brake = rampToward(
    model.brake,
    back === "brake" ? 1 : 0,
    dt,
    KEY_BRAKE_ATTACK,
    KEY_BRAKE_RELEASE,
  );
  const leanTarget =
    keys.leanBack || keys.leanForward
      ? (keys.leanBack ? 1 : 0) - (keys.leanForward ? 1 : 0)
      : keyAir;
  const leanAttack = aloft ? KEY_AIR_ATTACK : KEY_LEAN_ATTACK;
  model.lean = rampToward(model.lean, leanTarget, dt, leanAttack, KEY_LEAN_RELEASE);

  const steer = touch.bar ? touch.steer : model.steer;
  // A thumb dragged down as the back key is not also leaning him back.
  const lean = touch.bar ? (thumbBack ? 0 : touch.lean) : model.lean;
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
    carve: back === "carve",
    jump: keys.jump || (touch.lever && touch.jump),
  });
}

// ── THE HELICOPTER, FLOWN BY HAND (`heli.ts`, `SkierInput.heli`) ────────

/** Which of the helicopter's keys are down (`settings-heli-keys.ts`). */
export type HeliKeysHeld = {
  collectiveUp: boolean;
  collectiveDown: boolean;
  cyclicForward: boolean;
  cyclicBack: boolean;
  cyclicLeft: boolean;
  cyclicRight: boolean;
  pedalLeft: boolean;
  pedalRight: boolean;
};

export const NO_HELI_KEYS: HeliKeysHeld = {
  collectiveUp: false,
  collectiveDown: false,
  cyclicForward: false,
  cyclicBack: false,
  cyclicLeft: false,
  cyclicRight: false,
  pedalLeft: false,
  pedalRight: false,
};

/** THE COLLECTIVE'S TRAVEL, shares of the lever a second: a key held moves
 * it at `COLLECTIVE_KEY_RATE` (from the stop to the hover's ~0.7 in a
 * second and a half), the power pad pushed all the way at
 * `COLLECTIVE_THUMB_RATE`. A lever moves while it is worked and stays where
 * it is left: the height held is the hand's, never the machine's. */
export const COLLECTIVE_KEY_RATE = 0.45;
export const COLLECTIVE_THUMB_RATE = 0.6;

/** THE POWER PAD'S DEAD BAND, a share of its reach either side of the
 * anchor: the collective is a RATE on the pad (held up it keeps rising), so
 * a thumb working the pedals across must not creep the lever up or down by
 * the little it strays — and a thumb working the collective must not kick
 * the tail. Past the band the axis is rescaled, so the full reach is still
 * the whole of it. */
export const POWER_PAD_DEAD = 0.15;

/** One of the power pad's axes past its dead band, −1..1. */
export function powerAxis(v: number): number {
  const past = Math.abs(v) - POWER_PAD_DEAD;
  if (past <= 0) return 0;
  return Math.sign(v) * clamp(past / (1 - POWER_PAD_DEAD), 0, 1);
}

/** The flying hand's memory: the collective lever where it was left, and
 * the cyclic's and the pedals' keyboard ramps, screen-space. */
export type HeliModel = { collective: number; pitch: number; roll: number; pedal: number };

export function createHeliModel(): HeliModel {
  return { collective: 0, pitch: 0, roll: 0, pedal: 0 };
}

/**
 * ONE STEP OF THE HELICOPTER'S CONTROLS off the keys and the thumbs — on
 * touch two pads, the CYCLIC on the edge thumb's side and the POWER PAD on
 * the lever's:
 *   * the COLLECTIVE lever worked up and down by its keys, or by the power
 *     pad's vertical travel (pushed up raises it, at a rate), and left where
 *     it is;
 *   * the CYCLIC off the stick keys (ramped like the edge) or the cyclic
 *     stick, which owns both its axes while it is down;
 *   * the PEDALS off their keys, or the power pad's sideways travel, which
 *     owns them while it is down and is sprung back to centre after.
 * The side-to-side axes go through the one screen-to-engine flip.
 */
export function sampleHeli(
  model: HeliModel,
  keys: HeliKeysHeld,
  touch: TouchChannel,
  dt: number,
): HeliControls {
  const lift = (keys.collectiveUp ? 1 : 0) - (keys.collectiveDown ? 1 : 0);
  const thumbLift = touch.power ? powerAxis(touch.powerY) : 0;
  model.collective = clamp(
    model.collective + (lift * COLLECTIVE_KEY_RATE + thumbLift * COLLECTIVE_THUMB_RATE) * dt,
    0,
    1,
  );
  const fore = (keys.cyclicForward ? 1 : 0) - (keys.cyclicBack ? 1 : 0);
  const side = (keys.cyclicRight ? 1 : 0) - (keys.cyclicLeft ? 1 : 0);
  const yaw = (keys.pedalRight ? 1 : 0) - (keys.pedalLeft ? 1 : 0);
  model.pitch = rampToward(model.pitch, fore, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  model.roll = rampToward(model.roll, side, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  model.pedal = rampToward(model.pedal, yaw, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  const pitch = touch.stick ? touch.stickY : model.pitch;
  const roll = touch.stick ? touch.stickX : model.roll;
  const pedal = touch.power ? powerAxis(touch.powerX) : model.pedal;
  const flip = (v: number): number => (v === 0 ? 0 : clamp(v, -1, 1) * SCREEN_TO_ENGINE);
  return {
    collective: model.collective,
    pitch: clamp(pitch, -1, 1),
    roll: flip(roll),
    pedal: flip(pedal),
  };
}
