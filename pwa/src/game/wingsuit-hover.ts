// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOVER EXIT AS DRAWN — where a map has no wall sheer enough to jump a
// wingsuit off, the engine holds the flyer `WingsuitExit.hover` m over the
// best edge (`wingsuit-start.ts`); here that height is a HELICOPTER holding
// a hover there, the flyer stood on its right skid by the front door, his
// left hand on the frame. Presentation only: the machine is the heli-ski
// machine's own drawing (`heli-view.ts`) handed a state of its own, as the
// air ambulance is (`rescue-view.ts`). Once he is off the skid it holds a
// moment, then noses over and climbs away to its left, and is gone.

import * as THREE from "three";

import {
  freshHeli,
  HELI,
  wingsuitExitOf,
  type GameState,
  type HeliState,
  type Level,
} from "@engine";

import { heliHull, type SolidBox } from "./camera-clear.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";

/** HOW IT LEAVES: held over the edge `hold` s after he steps off, then
 * climbing at `climb` m/s, gathering way at `accel` m/s² to `cruise` m/s,
 * turning left at `turn` rad/s, nosed over `pitch` and banked `bank` rad;
 * gone from the picture `gone` s after the jump. Where he stands on its
 * skid: `fore` m ahead of the skid datum, by the front door. */
export const HOVER = {
  hold: 1.6,
  climb: 3,
  accel: 2.2,
  cruise: 22,
  turn: 0.12,
  pitch: 0.14,
  bank: 0.28,
  gone: 50,
  fore: 0.9,
} as const;

export type HoverScene = {
  group: THREE.Group;
  frame(
    state: GameState,
    dt: number,
    blow?: WashPuff,
    loose?: (x: number, z: number) => number,
  ): void;
  /** The whole machine as a box the lens keeps out of while it is shown
   * (`camera-clear.ts`'s `heliHull`): the chase boom behind him on the
   * skid would otherwise stand in the cabin or the tail boom. */
  hull(): SolidBox | null;
  /** Where the machine is in plan while it is shown, else null. */
  at(): { x: number; z: number } | null;
  ready: Promise<void>;
  setPace(pace: number): void;
  dispose(): void;
};

/** The machine's place at `t` s after the jump (before it, `t` ≤ 0, the
 * hover), written into `h`, off the exit `ex` on `level`. */
export function hoverAt(
  level: Level,
  ex: { x: number; z: number; heading: number; hover: number },
  t: number,
  h: HeliState,
): void {
  const fwd = { x: Math.sin(ex.heading), z: Math.cos(ex.heading) };
  const right = { x: Math.cos(ex.heading), z: -Math.sin(ex.heading) };
  // The datum put so the right skid's top is under his boots.
  const x0 = ex.x - right.x * HELI.seat.x - fwd.x * HOVER.fore;
  const z0 = ex.z - right.z * HELI.seat.x - fwd.z * HOVER.fore;
  const y0 = level.groundAt(ex.x, ex.z) + ex.hover - HELI.seat.y;
  let x = x0;
  let z = z0;
  let heading = ex.heading;
  const away = Math.max(0, t - HOVER.hold);
  // Off the hover: a climbing, accelerating turn to the left, integrated
  // in closed steps (the path a pure function of the time).
  const step = 0.1;
  let v = 0;
  for (let s = 0; s < away; s += step) {
    const d = Math.min(step, away - s);
    v = Math.min(HOVER.cruise, v + HOVER.accel * d);
    heading -= HOVER.turn * d * Math.min(1, v / 8);
    x += Math.sin(heading) * v * d;
    z += Math.cos(heading) * v * d;
  }
  const lean = Math.min(1, away / 2.5);
  h.x = x;
  h.z = z;
  h.y = y0 + HOVER.climb * away;
  h.vx = Math.sin(heading) * v;
  h.vz = Math.cos(heading) * v;
  h.vy = away > 0 ? HOVER.climb : 0;
  h.heading = heading;
  h.pitch = -HOVER.pitch * lean;
  h.roll = -HOVER.bank * lean * Math.min(1, v / 8);
}

/** THE HELICOPTER OF A HOVER EXIT on a wingsuit run's map. */
export function createHoverScene(level: Level, haze: HazeUniforms): HoverScene {
  const group = new THREE.Group();
  group.name = "wingsuit-hover";
  group.visible = false;
  const view: HeliView = createHeliView(level, haze, { pad: false, cockpit: false });
  group.add(view.group);
  const ex = wingsuitExitOf(level);
  let run: { heli: HeliState; level: Level; tick: number; t: number } | null = null;
  const dummy = { x: 0, z: 0 };
  const box: SolidBox = { x: 0, z: 0, dx: 0, dz: 1, halfLength: 0, halfWidth: 0, base: 0, top: 0 };
  return {
    group,
    ready: view.ready,
    frame(state, dt, blow, loose) {
      const hover = state.wingsuit?.hover ?? 0;
      const ch = state.chute;
      const after = !ch ? -1 : ch.mode === "ready" ? 0 : ch.since;
      const shown = hover > 0 && !!ch && after < HOVER.gone;
      group.visible = shown;
      if (!shown) return;
      run ??= { heli: freshHeli(state), level, tick: 0, t: 0 };
      const h = run.heli;
      hoverAt(level, { ...ex, hover }, after, h);
      h.mode = "flown";
      h.rider = false;
      h.grounded = false;
      h.spool = 1;
      h.thrust = HELI.mass * 9.81;
      h.agl = h.y + HELI.rotor.hub - level.groundAt(h.x, h.z);
      run.tick += 1;
      run.t = state.t;
      view.update(run as unknown as GameState, 1, dt, dummy, NO_HOOKS);
      if (blow && loose) view.blow(run as unknown as GameState, dt, blow, loose);
    },
    hull() {
      return group.visible && run ? heliHull(run.heli, box) : null;
    },
    at: () => (group.visible && run ? { x: run.heli.x, z: run.heli.z } : null),
    setPace(p) {
      view.setPace(p);
    },
    dispose() {
      view.dispose();
    },
  };
}

const NO_HOOKS = { flame: () => {}, strike: () => {} };
