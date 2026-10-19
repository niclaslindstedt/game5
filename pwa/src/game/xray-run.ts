// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM AS THE APP RUNS IT: the run read ahead for the blow coming
// (`impact-forecast.ts`), the director told what each step did
// (`xray-shots.ts`), and every frame the rate the run is stepped at and the
// look the renderer draws. Only while the player rides a run with the
// INJURIES switch on (`GameState.gore`, dealt by `injuriesShown`, never
// SAFE FOR WORK) and the X-RAY CAM switch on (`Settings.xray`, off by
// default); with the injuries off nothing is read ahead, the run goes at
// its own pace and nothing is drawn.
// DOM-free but for one class on the page (`xrayHud`), under which the body
// plate and the g meter fade away while the X-ray has him, and the presses
// that SKIP it: a tap on the screen, or the skier's own keys pressed again
// and again (`SKIP`) — the cam lets go, the run goes on at its own pace and
// the plate comes back. A restart is a new run, and the cam is put down
// with the old one.
//
// With the X-RAY CAM switch OFF the same run reads ahead for one thing only,
// and only while he goes fast enough for it: a body about to be CRUSHED on
// a solid or SLICED by a rope (the IMPACT cam, `xray-shots.ts`) — and a
// RECORDING watched back plays that cam too, whatever the switch: the
// replay is the run again, so the strike is read ahead off it the same way.

import { CABLE, disablingOf, GORE, type GameState } from "@engine";

import type { KeyBindings } from "./settings-input.ts";

import { createForecaster, wrecked } from "./impact-forecast.ts";
import { createSkipCount, createXrayDirector, type XrayLook } from "./xray-shots.ts";

/** A skier this slow, on the snow and on his skis, is not read ahead:
 * nothing at a crawl breaks a bone. m/s. */
const STILL = 6;

/** With the X-ray switch off, nothing slower than this is read ahead: no
 * solid crushes him and no rope cuts him short of it. m/s. */
const STRIKING = Math.min(GORE.smash.speed, CABLE.cut.speed) * 0.9;

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

/** The HUD's half of a look: the page's `xray-on` class (`body.css`) —
 * the body plate and the g meter faded under the glass, and for the whole
 * of a shred. */
export function xrayHud(look: XrayLook | null): void {
  if (typeof document === "undefined") return;
  const on = !!look?.active && (look.xray > 0.05 || look.kind !== "xray");
  document.documentElement.classList.toggle("xray-on", on);
}

export type XrayRun = {
  /** One frame, `wall` seconds on, `on` whether the cam may run, `replay`
   * whether the run is a RECORDING being watched (the IMPACT cam alone,
   * whatever the X-ray switch, and nothing read ahead while it stands
   * still): the rate the run is to be stepped at this frame (1: its own
   * pace). */
  frame(state: GameState, wall: number, on: boolean, replay?: boolean): number;
  /** Whether a cam has the run this frame. */
  active(): boolean;
  /** THE RUN'S PACE THIS FRAME with the recording's under it: `replay`'s
   * own rate (its director's slow motion and the player's speed) times the
   * cam's, `live` the run ridden, `watched` a recording on screen — whose
   * IMPACT cam plays at the player's own speed, paused with him, its slow
   * motion taking the place of the director's. */
  paced(
    state: GameState,
    wall: number,
    live: boolean,
    watched: boolean,
    replay: { frame(): number; pace(): number },
  ): number;
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
  /** The keys a skip counts and the X-RAY CAM switch (`Settings.xray`); none (a lab) is on. */
  settings?: () => { keys: KeyBindings; xray: boolean },
): XrayRun {
  const ahead = createForecaster();
  const director = createXrayDirector();
  let running = false;
  let active = false;
  /** The X-RAY CAM switch, as last read: off, the impact cam alone. */
  let glass = true;
  let current: GameState | null = null;
  /** Watching a recording: its own bar is pressed, never a skip. */
  let watching = false;
  const skip = (): void => {
    if (active && current && !watching) director.skip(current);
  };
  const count = createSkipCount();
  const onTap = (): void => skip();
  const onKey = (e: KeyboardEvent): void => {
    if (!active || e.repeat || !settings) return;
    const bound = settings().keys;
    if (!MOVES.some((m) => bound[m].includes(e.code))) return;
    if (count.press(performance.now() / 1000)) skip();
  };
  const opts = { capture: true, passive: true } as const;
  if (settings && typeof document !== "undefined") {
    document.addEventListener("pointerdown", onTap, opts);
    document.addEventListener("keydown", onKey, opts);
  }
  return {
    frame(state, wall, on, replay = false) {
      watching = replay;
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
      glass = !replay && (settings ? settings().xray : true);
      const s = state.skier;
      const b = s.thrown;
      const moving = glass
        ? s.speed > STILL || s.airborne || s.thrown !== null || !!state.heli?.rider
        : (b ? Math.hypot(b.vx, b.vy, b.vz) : s.speed) > STRIKING;
      // A machine come down with him on it is the crash's own lens's
      // (`Forecast.wrecked`): nothing to read ahead for, and a copy of the
      // run stepped through a wreck every frame is a frame's budget.
      if (moving && state.gore.dead < 0 && !wrecked(state) && !(replay && wall === 0))
        director.seen(ahead.frame(state, state.input), state, glass);
      else if (!glass && !active) ahead.drop();
      const look = director.frame(state, wall);
      active = look.active;
      show(look);
      hud(look);
      return look.rate;
    },
    step(state) {
      if (running) director.step(state, glass);
    },
    skip,
    active: () => active,
    paced(state, wall, live, watched, replay) {
      const played = replay.frame();
      const moves = live || (watched && replay.pace() > 0);
      const cam = this.frame(state, moves ? wall : 0, live || watched, watched);
      return (watched && active ? replay.pace() : played) * cam;
    },
    dispose() {
      if (typeof document === "undefined") return;
      document.removeEventListener("pointerdown", onTap, opts);
      document.removeEventListener("keydown", onKey, opts);
    },
  };
}
