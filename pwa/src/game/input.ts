// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INPUT: one manager merges the keyboard and the HUD's thumb zones into the
// engine's `SkierInput`. The maths — the ramps, the lever, the handlebar, the
// sign flip — is next door in input-model.ts, DOM-free so the tests can
// read it; this file is the listeners. Sampled once per STEP (§37.1): the
// ramps advance by the step's own dt, and the reset edge is banked between
// steps and handed to the step it arrives in, so a tap inside one step is
// still seen by that step.
//
// WHICH KEY DOES WHAT is `settings-input.ts`'s table (as shipped; OPTIONS ▸
// KEYS rebinds it and `setBindings` hands the manager the answer), and
// nothing in this file knows any particular key:
//   W            tuck             S / Space       brake
//   A / ←  D / → steer                ↓ / E / Shift   lean back (nose up)
//   ↑ / Q / Z    lean forward         R               back to the checkpoint
//   (and in the air, W and S pressed there lean too — `airLean`)
//   (and DOWN off the skis, W pressed or a tap anywhere stands him up —
//   the engine lets it go inside `crash.getUp`)
//   B            restart the race     C               next camera
//   Escape       hold the race under the pause card (menu-pause.tsx);
//                pressing it again over the card resumes, because the card's
//                RESUME row is its `data-nav-back` and menu-nav.ts takes
//                Escape upstream of this manager.
//
// AN ACTION MAY BE HELD OR TAKEN ON THE PRESS, and `settings-input.ts` says
// which: the skis's six are held and ramped, the four around a race happen
// once however long the key is down.

import {
  TUNING,
  createStopHand,
  stopHand,
  type GameState,
  type LiftRide,
  type SkierInput,
} from "@engine";

import {
  DEFAULT_KEYS,
  isHeldAction,
  type InputAction,
  type KeyAction,
  type KeyBindings,
} from "./settings-input.ts";
import {
  NO_HELI_KEYS,
  NO_KEYS,
  createHeliModel,
  createInputModel,
  neutralTouch,
  sampleHeli,
  sampleInput,
  walkPad,
  type HeliKeysHeld,
  type KeysHeld,
  type TouchChannel,
} from "./input-model.ts";
import { DEFAULT_HELI_KEYS, type HeliAction, type HeliBindings } from "./settings-heli-keys.ts";
import { watchGazeDrags } from "./lift-gaze-watch.ts";
import { gazeAllowed } from "./lift-gaze.ts";

export type { InputAction };

export type InputManager = {
  /** Produce this step's input; advances the ramps by `dt`. `airborne` is
   * whether the player's skis is off the snow, where the tuck and brake
   * keys lean (`input-model.ts`'s `airLean`); `flying` whether he is sat on
   * the helicopter's skid, flying it (`heliControls`); `down` whether he is
   * thrown off his skis, where the tuck key pressed or a tap anywhere is
   * the reset (`crash.getUp` says when the engine takes it); `lift` the lift
   * he is on, where a drag looks round rather than holds the tuck while it
   * carries him (`lift-gaze.ts`); `basket` whether he stands in the
   * balloon's basket, where the walking pad (`hud-balloon.tsx`) walks him
   * across and along it. */
  sample: (
    dt: number,
    airborne?: boolean,
    flying?: boolean,
    down?: boolean,
    lift?: LiftRide | null,
    basket?: boolean,
  ) => SkierInput;
  /** The player's input for a step of `state`: `sample` read off the run,
   * then THE ONE-KEY BRAKE AND THE CLIMB (`stop-hand.ts`) made of its back
   * key (down in its brake meaning) and its tuck — before a tape records
   * it. */
  ride: (state: GameState) => SkierInput;
  /** A new run: the one-key brake let go of the last one's. */
  freshHand: () => void;
  /** The thumb zones write here at pointer rate (screen-space). */
  touch: TouchChannel;
  /** Queue a reset — the HUD button, the R key and the shell's menu row all
   * land here. */
  requestReset: () => void;
  /** Queue the MACHINE press — the HUD's call to the snowmobile or the
   * helicopter tapped while he stands beside it (`hud-sled.tsx`,
   * `hud-heli.tsx`) lands here, as ENTER does. */
  requestMachine: () => void;
  /** Queue one JUMP press, as a tap of the jump key — the afterski room's
   * tap on the picture, which orders another round, lands here. */
  requestJump: () => void;
  /** Hear the drags that look round from the lift, CSS px. */
  onLook: (handler: (dx: number, dy: number) => void) => void;
  /** Hear the app-level presses. */
  onAction: (handler: (action: InputAction) => void) => void;
  /** Ride on a new keyboard (OPTIONS ▸ KEYS) — the skier's table and the
   * helicopter's (`settings-heli-keys.ts`). Every held key is let go: a key
   * down under the old layout has no keyup under the new one. */
  setBindings: (bindings: { keys: KeyBindings; heliKeys?: HeliBindings }) => void;
  dispose: () => void;
};

/**
 * `claiming` says whether a RACE is being ridden right now. The listeners
 * live for the app's whole life but the held keys are only the skis's while
 * the player is riding it, and the difference matters for exactly one key:
 * every control on every card is a real `<button>`, and SPACE on a focused
 * button is how the browser presses it. Claiming space on a menu —
 * `preventDefault` on the keydown — would swallow that. `App.tsx` passes
 * `playerRides` from `shell.ts`.
 */
export function createInputManager(
  target: Window = window,
  claiming: () => boolean = () => true,
  bindings: KeyBindings = DEFAULT_KEYS,
): InputManager {
  const model = createInputModel();
  const keys: KeysHeld = { ...NO_KEYS };
  // THE HELICOPTER'S HAND: its own table and its own held keys, read only
  // while he sits on the skid — and the collective lever, put back down
  // whenever he is off it.
  const heli = createHeliModel();
  const heliKeys: HeliKeysHeld = { ...NO_HELI_KEYS };
  const heliByCode = new Map<string, HeliAction[]>();
  const indexHeli = (next: HeliBindings): void => {
    heliByCode.clear();
    for (const [action, codes] of Object.entries(next) as [HeliAction, string[]][]) {
      for (const code of codes) heliByCode.set(code, [...(heliByCode.get(code) ?? []), action]);
    }
  };
  indexHeli(DEFAULT_HELI_KEYS);
  const touch = neutralTouch();
  let reset = false;
  /** THE MACHINE PRESS (ENTER), kept until a step has seen it. */
  let machine = false;
  let onAction: (action: InputAction) => void = () => {};

  /** The index every keystroke is answered from: one code, the actions on
   * it. A list, because one key may serve two rows. */
  const byCode = new Map<string, KeyAction[]>();
  const index = (next: KeyBindings): void => {
    byCode.clear();
    for (const [action, codes] of Object.entries(next) as [KeyAction, string[]][]) {
      for (const code of codes) {
        const on = byCode.get(code);
        if (on) on.push(action);
        else byCode.set(code, [action]);
      }
    }
  };
  index(bindings);

  /** A focused thing a key presses itself — a card's row, a field. */
  const onControl = (target: EventTarget | null): boolean =>
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest("button, input, select, textarea, a[href]") !== null;

  /** THE JUMP'S PRESS, kept until a step has seen it: a tap shorter than
   * the gap between two steps (a slow frame, a quick finger) is still a pop
   * off the snow. */
  let jumped = false;
  /** THE GET-UP PRESS: the tuck key gone down, or a tap anywhere on the
   * picture, kept until a step has seen it — a reset only while he is
   * down. A key held down from before is no press: it has to go down. */
  let rise = false;

  const onKeyDown = (e: KeyboardEvent): void => {
    // A browser shortcut on its way past is not a press on the skis.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let took = false;
    for (const action of heliByCode.get(e.code) ?? []) {
      if (!claiming()) continue;
      heliKeys[action] = true;
      took = true;
    }
    const actions = byCode.get(e.code);
    if (!actions) {
      if (took) e.preventDefault();
      return;
    }
    for (const action of actions) {
      if (isHeldAction(action)) {
        if (!claiming()) continue;
        keys[action] = true;
        if (action === "jump" && !e.repeat) jumped = true;
        if (action === "tuck" && !e.repeat) rise = true;
        took = true;
      } else if (!e.repeat) {
        // A key pressed ON A CONTROL off the race is that control's: ENTER is
        // the machine key and also the browser's confirm, and a press taken
        // here (and its default prevented) is the focused button never
        // pressed.
        if (action !== "pause" && !claiming() && onControl(e.target)) continue;
        if (action === "reset" || action === "machine") {
          if (!claiming()) continue;
          if (action === "reset") reset = true;
          else machine = true;
        } else onAction(action);
        took = true;
      }
    }
    // The arrows and space scroll the page; on a keyboard-driven game that
    // means the whole shell jumps. Only for a press this manager took.
    if (took) e.preventDefault();
  };
  // A key let go is always let go, claimed or not: a race left mid-tuck
  // must not come back to a tuck that is still down.
  const onKeyUp = (e: KeyboardEvent): void => {
    for (const action of byCode.get(e.code) ?? []) {
      if (isHeldAction(action)) keys[action] = false;
    }
    for (const action of heliByCode.get(e.code) ?? []) heliKeys[action] = false;
  };
  // A TAP ANYWHERE — on the glass, the thumb zones included, taken on the
  // way down before a zone keeps it — but never on one of the HUD's own
  // buttons, which answer for themselves.
  const onPointerDown = (e: PointerEvent): void => {
    if (claiming() && !onControl(e.target)) rise = true;
  };
  // A key held while the window loses focus never sends its keyup: the skis
  // would ride off at full tuck behind a dialog.
  const onBlur = (): void => {
    for (const k of Object.keys(keys) as (keyof KeysHeld)[]) keys[k] = false;
    for (const k of Object.keys(heliKeys) as HeliAction[]) heliKeys[k] = false;
  };

  // LOOKING ROUND FROM THE LIFT (`lift-gaze.ts`): every drag on a run, which
  // the renderer takes only while a lift carries him.
  let carriedNow = false;
  let onLook: (dx: number, dy: number) => void = () => {};
  const gaze = watchGazeDrags(target, {
    riding: claiming,
    drag: (dx, dy) => onLook(dx, dy),
  });

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  target.addEventListener("pointerdown", onPointerDown, true);
  target.document.addEventListener("visibilitychange", onBlur);

  const hand = createStopHand();
  const manager: InputManager = {
    sample: (dt, airborne = false, flying = false, down = false, lift = null, basket = false) => {
      // A jump pressed and let go between two steps still reaches one.
      const held = jumped && !keys.jump ? { ...keys, jump: true } : keys;
      const input = sampleInput(model, held, touch, dt, reset, airborne, flying);
      // A thumb dragged to look round from the lift is no tuck held to skip it.
      carriedNow = gazeAllowed(lift);
      if (carriedNow && gaze.dragging()) input.tuck = 0;
      // Sat on the skid the helicopter's table is the hand: its four
      // controls.
      if (flying) input.heli = sampleHeli(heli, heliKeys, touch, dt);
      else heli.collective = 0;
      // In the balloon's basket the walking pad owns both ways he walks.
      if (basket && touch.stick) walkPad(input, touch);
      // On or off a machine: ENTER, or the double tap on touch.
      if (machine || touch.tap2) input.machine = true;
      // Down off his skis, the get-up press is the reset.
      if (down && rise) input.reset = true;
      reset = false;
      rise = false;
      machine = false;
      jumped = false;
      touch.tap2 = false;
      return input;
    },
    ride: (state) => {
      const c = state.skier;
      const input = manager.sample(
        TUNING.dt,
        c.airborne,
        !!state.heli?.rider,
        c.thrown !== null,
        c.lift,
        !!state.balloon?.aboard,
      );
      const go = keys.tuck || (touch.lever && touch.tuck > 0.5);
      return stopHand(hand, state, { back: model.back === "brake", go }, input);
    },
    freshHand: () => {
      Object.assign(hand, createStopHand());
    },
    touch,
    requestReset: () => {
      reset = true;
    },
    requestMachine: () => {
      machine = true;
    },
    requestJump: () => {
      jumped = true;
    },
    onLook: (handler) => {
      onLook = handler;
    },
    onAction: (handler) => {
      onAction = handler;
    },
    setBindings: (next) => {
      onBlur();
      index(next.keys);
      indexHeli(next.heliKeys ?? DEFAULT_HELI_KEYS);
    },
    dispose: () => {
      gaze.stop();
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      target.removeEventListener("pointerdown", onPointerDown, true);
      target.document.removeEventListener("visibilitychange", onBlur);
    },
  };
  return manager;
}
