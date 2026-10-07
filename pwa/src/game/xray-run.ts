// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM AS THE APP RUNS IT: the run read ahead for the blow coming
// (`impact-forecast.ts`), the director told what each step did
// (`xray-shots.ts`), and every frame the rate the run is stepped at and the
// look the renderer draws. Only while the player rides a run with the
// INJURIES switch on (`GameState.gore`, dealt by `injuriesShown`): off,
// nothing is read ahead, the run goes at its own pace and nothing is drawn.
// DOM-free.

import type { GameState } from "@engine";

import { createForecaster } from "./impact-forecast.ts";
import { createXrayDirector, type XrayLook } from "./xray-shots.ts";

/** A skier this slow, on the snow and on his skis, is not read ahead:
 * nothing at a crawl breaks a bone. m/s. */
const STILL = 6;

export type XrayRun = {
  /** One frame, `wall` seconds on, `on` whether the cam may run: the rate
   * the run is to be stepped at this frame (1: its own pace). */
  frame(state: GameState, wall: number, on: boolean): number;
  /** After each step. */
  step(state: GameState): void;
};

export function createXrayRun(show: (look: XrayLook | null) => void): XrayRun {
  const ahead = createForecaster();
  const director = createXrayDirector();
  let running = false;
  return {
    frame(state, wall, on) {
      if (!on || !state.gore) {
        if (running) {
          ahead.drop();
          director.drop();
          show(null);
          running = false;
        }
        return 1;
      }
      running = true;
      const s = state.skier;
      const moving = s.speed > STILL || s.airborne || s.thrown !== null;
      if (moving && state.gore.dead < 0) director.seen(ahead.frame(state, state.input), state);
      const look = director.frame(state, wall);
      show(look);
      return look.rate;
    },
    step(state) {
      if (running) director.step(state);
    },
  };
}
