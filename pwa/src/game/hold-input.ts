// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RIDE HELD AT A SPEED — the controls a lab (and a link's `?hold=`) skis
// the player on to photograph what a speed and a manoeuvre look like: the
// tuck and the brake on the gap to the speed, the edge on the heading's
// error, and on top the MOVE's own — a carve's turns either way, a check's
// brake every 1.2 s, a hockey stop's brake and edge, a skate's tuck held
// from a standstill. DOM-free and three-free, so the cloud lab
// (`tools/cloud-harness.ts`) and the app ride the same hands.

import { placeRun, step, TUNING, type GameState, type SkierInput } from "@engine";

import { snapInput } from "./ghost.ts";

export const HOLD_MOVES = ["straight", "carve", "check", "stop", "skate"] as const;
export type HoldMove = (typeof HOLD_MOVES)[number];

export function isHoldMove(value: unknown): value is HoldMove {
  return (HOLD_MOVES as readonly unknown[]).includes(value);
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * THE CONTROLS FOR ONE STEP of a ride held at `kmh` along `heading` (rad)
 * in a `move`, `t` s into it. `on` false lets him coast out of the tuck.
 */
export function holdInput(
  state: GameState,
  kmh: number,
  heading: number,
  move: HoldMove = "straight",
  t = 0,
  on = true,
): SkierInput {
  const s = state.skier;
  const gap = kmh / 3.6 - s.speed;
  const keep = clamp(wrap(heading - s.heading) * 2.5, -1, 1);
  const base: SkierInput = {
    steer: keep,
    tuck: on ? clamp(0.55 + gap * 0.35, 0, 1) : 0,
    brake: on ? clamp(-gap * 0.15 - 0.2, 0, 1) : 0,
    lean: 0,
    reset: false,
  };
  if (!on) return base;
  switch (move) {
    case "carve":
      return { ...base, steer: clamp(Math.sin((2 * Math.PI * t) / 2.4) + keep * 0.4, -1, 1) };
    case "check":
      return { ...base, tuck: 0, brake: t % 1.2 < 0.45 ? 0.8 : 0 };
    case "stop":
      return { ...base, tuck: 0, brake: t >= 0.2 ? 1 : 0, steer: t >= 0.35 ? 1 : keep };
    case "skate":
      return { ...base, tuck: 1, brake: 0 };
    default:
      return base;
  }
}

/**
 * A LINK'S HELD RIDE (`?hold=`): the skier set going at the speed — down
 * the fall line where the snow under him has one (a held speed is a slope
 * that can hold it), along the way he faces where it is flat — and the run
 * ridden on `hold.seconds` in the move, `draw` called after every frame's
 * steps so the renderer, drawing unpresented, raises the cloud and cuts the
 * tracks the ride makes (the cloud is emitted as it draws). Every input on
 * the tape's grid, as everything the engine is handed is. A skate starts
 * from a standstill.
 */
export function rideHold(
  state: GameState,
  hold: { kmh: number; move: HoldMove; seconds: number },
  draw: () => void,
): void {
  const s = state.skier;
  const n = { x: 0, y: 1, z: 0 };
  state.level.normalAt(s.x, s.z, n);
  const slope = Math.hypot(n.x, n.z);
  const heading = slope > 0.05 ? Math.atan2(n.x, n.z) : s.heading;
  placeRun(state, {
    x: s.x,
    z: s.z,
    heading,
    speed: hold.move === "skate" ? 0 : hold.kmh / 3.6,
  });
  const t0 = state.t;
  const perFrame = Math.round(TUNING.physicsHz / 60);
  const frames = Math.round(hold.seconds * 60);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < perFrame; i++) {
      step(state, snapInput(holdInput(state, hold.kmh, heading, hold.move, state.t - t0)));
    }
    draw();
  }
}

/**
 * A link's held ride as the frame loop's one-shot: ridden (`rideHold`) the
 * first frame it is called with the map stood up, and nothing after — or
 * nothing at all when the link asked for none.
 */
export function heldRide(
  hold: { kmh: number; move: HoldMove; seconds: number } | null,
): (state: GameState, draw: () => void) => void {
  let left = hold;
  return (state, draw) => {
    if (left) rideHold(state, left, draw);
    left = null;
  };
}
