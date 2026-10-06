// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S STATE (`para.ts`) — its controls, the wing on its lines,
// the engine, what it is doing and what its events say — beside `state.ts`,
// which re-exports every one of them, so a reader asks the one place it
// always has.

/** THE CONTROLS OF THE RIG, as the pilot works them, read off his own
 * input (`paraControls`): the hand throttle 0..1 (the tuck), both brakes
 * 0..1 (the back key — a flare), the toggles' difference and his weight
 * in the harness −1..1 (the edge, right positive), and the risers −1..1
 * (the lean: forward the accelerator, back the trimmers let out). */
export type ParaControls = { throttle: number; brake: number; steer: number; bar: number };

/** What a `para` event says (`para.ts`): the wing let fly off the summit
 * (`launch`), the skis off the snow (`takeoff`) and back on it under the
 * wing (`touch`), the gear released by the pilot (`drop`), the wing
 * collapsed onto the snow or a crown and cut away (`collapse`), the wing
 * FOLDED in the air by rough air (`fold`), or the ride begun again on the
 * summit (`restart`). */
export type ParaPhaseEvent =
  "launch" | "takeoff" | "touch" | "drop" | "collapse" | "fold" | "restart";

/** A `para` event (`GameEvent`): where, and the pilot's speed, m/s. */
export type ParaEvent = {
  kind: "para";
  t: number;
  phase: ParaPhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
};

/** WHAT THE RIG IS DOING: `ready` on the summit, the wing held inflated
 * overhead; `flown` — the wing flying on its lines, the pilot under it in
 * the air or skiing under it on the snow; `dropped` — released, the
 * canopy and the motor fallen free of him, lying where they came down. */
export type ParaMode = "ready" | "flown" | "dropped";

/** A body of the rig falling free once released: where, how fast, and
 * whether it lies on the snow. */
export type ParaPiece = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  down: boolean;
};

/** THE FREE RIDE'S PARAMOTOR (`para.ts`) — on a free ride begun on it
 * (`CreateGameOptions.para`), absent everywhere else. The pilot is the
 * skier himself (`GameState.skier`); this is the WING on its lines over
 * him and the engine on his back. Drawn off this, heard off this; nothing
 * in it draws from the stream. */
export type ParaState = {
  mode: ParaMode;
  /** The canopy's centre, world frame, m, and its velocity, m/s. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The canopy's heading (into the air it flies through), its bank (right
   * side down positive) and its pitch off the lines' plane, rad — what it
   * is drawn turned by. */
  heading: number;
  bank: number;
  pitch: number;
  /** The air through it, m/s, its angle of attack, rad, and whether it is
   * stalled. */
  airspeed: number;
  alpha: number;
  stalled: boolean;
  /** A FOLD in the air (`PARA.fold`): how much of the wing is collapsed,
   * 0..1, and which side — −1 the left tip, 1 the right, 0 a frontal. */
  fold: number;
  foldSide: number;
  /** The air it flies in (`para-air.ts`): the wind's horizontal speed, its
   * rise off the slopes, m/s (ridge lift up, the lee's sink down), and how
   * rough it is (the eddies' sigma, m/s). */
  wind: number;
  lift: number;
  rough: number;
  /** The pull on the lines, N — 0 slack. */
  tension: number;
  /** The controls as they stand after their lags. */
  controls: ParaControls;
  /** THE ENGINE: rpm, the thrust this step, N, and the propeller's turn,
   * rad (wrapped) — what the drawing spins it by. */
  rpm: number;
  thrust: number;
  prop: number;
  /** Whether the skis are off the snow under the wing. */
  flying: boolean;
  /** The pilot's height over the snow under him, m, and his climb, m/s. */
  agl: number;
  climb: number;
  /** Seconds in this mode; the flight's seconds. */
  t: number;
  airTime: number;
  /** Where the summit launch stands (the ride's restart). */
  start: { x: number; z: number; heading: number };
  /** THE GEAR RELEASED: the canopy and the motor, each falling free and
   * lying where it came down; null while it is on him. */
  canopy: ParaPiece | null;
  motor: ParaPiece | null;
};
