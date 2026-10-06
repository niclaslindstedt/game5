// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINES as the run holds them (`groomer.ts`) — types of their
// own so `state.ts` can carry them without importing the step that moves
// them.

/** What a machine is doing: working its lanes down and up its run
 * (`groom`), pivoting round at a lane's end onto the next (`turn`), driven
 * by the player (`ridden`), or standing where he left it, engine running
 * and lamps lit (`parked`). */
export type GroomerMode = "groom" | "turn" | "ridden" | "parked";

/** ONE PISTE MACHINE on a night's free ride. Its place is on the snow under
 * the middle of its tracks (world, m), its heading the way the blade faces
 * (rad, 0 = +z, clockwise), pitched and rolled to the snow under it; `speed`
 * along the heading (m/s, negative in reverse). Working: `run` is the
 * resort's run it grooms (an index in `crowdNet`), `lane` the lane it is on
 * of `lanes`, `dir` +1 down the run and −1 up it, `s` the arc it is at.
 * `turn` is a pivot's start and end while it turns between lanes. */
export type GroomerState = {
  id: number;
  mode: GroomerMode;
  run: number;
  lanes: number;
  lane: number;
  /** The way through the lanes: +1 to the right of the run, −1 back. */
  step: number;
  dir: number;
  s: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  /** Whether the tiller is down and the swath laid behind it. */
  tiller: boolean;
  /** THE SWATH it has laid this run, as segments: [ax, az, bx, bz] each,
   * flat — the renderer stamps the corduroy along them, the physics packs
   * the snow under them (`groomed.ts`). */
  swath: number[];
  /** Where the last swath point was laid, m. */
  lastX: number;
  lastZ: number;
  /** A pivot between lanes: from where and which way, to where and which
   * way, and how far through it (0..1). */
  turn: { x0: number; z0: number; h0: number; x1: number; z1: number; h1: number; k: number };
  /** Whether the player is in its cab. */
  rider: boolean;
  /** The controls as they stand, driven: forward −1..1 and the pivot −1..1. */
  drive: number;
  steer: number;
  /** Seconds in this mode. */
  t: number;
};

/** THE SNOW THE MACHINES HAVE GROOMED (`groomed.ts`): every 2 m cell the
 * tiller has passed over, and the new snow (`GameState.fresh`) there was
 * when it did — what has fallen since is all that lies on it. */
export type GroomedSnow = { cells: Map<number, number> };

/** A `groomer` event: a machine taken (`board`), left (`hop`), or a skier
 * knocked down by one (`strike`) — which, where, and the closing speed. */
export type GroomerEvent = {
  kind: "groomer";
  t: number;
  phase: "board" | "hop" | "strike";
  id: number;
  x: number;
  z: number;
  speed: number;
};
