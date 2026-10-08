// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM AS THE APP RUNS IT: the run read ahead for the blow coming
// (`impact-forecast.ts`), the director told what each step did
// (`xray-shots.ts`), and every frame the rate the run is stepped at and the
// look the renderer draws. Only while the player rides a run with the
// INJURIES switch on (`GameState.gore`, dealt by `injuriesShown`): off,
// nothing is read ahead, the run goes at its own pace and nothing is drawn.
// DOM-free but for one class on the page (`xrayHud`), under which the body
// plate and the g meter fade away while the X-ray has him, and the presses
// that SKIP it: a tap on the screen, or the skier's own keys pressed again
// and again (`SKIP`) — the cam lets go, the run goes on at its own pace and
// the plate comes back. A restart is a new run, and the cam is put down
// with the old one.

import { disablingOf, type GameState } from "@engine";

import type { KeyBindings } from "./settings-input.ts";

import { createForecaster } from "./impact-forecast.ts";
import { createSkipCount, createXrayDirector, type XrayLook } from "./xray-shots.ts";

/** A skier this slow, on the snow and on his skis, is not read ahead:
 * nothing at a crawl breaks a bone. m/s. */
const STILL = 6;

/** The keys whose presses count toward a skip: the skier's own. */
const MOVES = ["tuck", "brake", "left", "right", "leanBack", "leanForward", "jump"] as const;

/** Whether a run's skier is dying — or down hurt too badly to ski on
 * (`rescue.ts`): the INJURY CAM, the same lens, from the blow that keeps
 * him down — only then may the death cam take him. */
export const dying = (state: GameState): boolean =>
  !!state.gore &&
  (state.gore.mortal >= 0 ||
    state.gore.dead >= 0 ||
    state.gore.injured >= 0 ||
    (state.skier.thrown !== null && disablingOf(state.skier.body) !== null));

/** The HUD's half of a look: the page's `xray-on` class (`body.css`). */
export function xrayHud(look: XrayLook | null): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("xray-on", !!look?.active && look.xray > 0.05);
}

export type XrayRun = {
  /** One frame, `wall` seconds on, `on` whether the cam may run: the rate
   * the run is to be stepped at this frame (1: its own pace). */
  frame(state: GameState, wall: number, on: boolean): number;
  /** After each step. */
  step(state: GameState): void;
  /** Let the cam go now (a skip). */
  skip(): void;
  /** The listeners gone. */
  dispose(): void;
};

export function createXrayRun(
  show: (look: XrayLook | null) => void,
  hud: (look: XrayLook | null) => void = () => {},
  keys?: () => KeyBindings,
): XrayRun {
  const ahead = createForecaster();
  const director = createXrayDirector();
  let running = false;
  let active = false;
  let current: GameState | null = null;
  const skip = (): void => {
    if (active && current) director.skip(current);
  };
  const count = createSkipCount();
  const onTap = (): void => skip();
  const onKey = (e: KeyboardEvent): void => {
    if (!active || e.repeat || !keys) return;
    const bound = keys();
    if (!MOVES.some((m) => bound[m].includes(e.code))) return;
    if (count.press(performance.now() / 1000)) skip();
  };
  const opts = { capture: true, passive: true } as const;
  if (keys && typeof document !== "undefined") {
    document.addEventListener("pointerdown", onTap, opts);
    document.addEventListener("keydown", onKey, opts);
  }
  return {
    frame(state, wall, on) {
      // A new run (a restart): whatever was read ahead was the old one's.
      if (state !== current) {
        ahead.drop();
        current = state;
      }
      if (!on || !state.gore) {
        active = false;
        if (running) {
          ahead.drop();
          director.drop();
          show(null);
          hud(null);
          running = false;
        }
        return 1;
      }
      running = true;
      const s = state.skier;
      const moving = s.speed > STILL || s.airborne || s.thrown !== null;
      if (moving && state.gore.dead < 0) director.seen(ahead.frame(state, state.input), state);
      const look = director.frame(state, wall);
      active = look.active;
      show(look);
      hud(look);
      return look.rate;
    },
    step(state) {
      if (running) director.step(state);
    },
    skip,
    dispose() {
      if (typeof document === "undefined") return;
      document.removeEventListener("pointerdown", onTap, opts);
      document.removeEventListener("keydown", onKey, opts);
    },
  };
}
