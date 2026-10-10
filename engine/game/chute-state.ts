// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S STATE (`chute.ts`) — the jump from the plane's door, the
// freefall, the canopy opening and flying, cut away, landed or caught —
// beside `state.ts`, which carries it as `GameState.chute`.

import type { DeployStage } from "./defs/chute.ts";

/** THE CANOPY'S CONTROLS as the jumper works them, read off his own input
 * (`chuteControls`): both toggles down 0..1 (the back key — slow flight and
 * the flare), one toggle more than the other −1..1 (the edge, right
 * positive), and the risers −1..1 (the lean: forward the fronts, back the
 * rears). */
export type ChuteControls = { brake: number; steer: number; riser: number };

/** What a `chute` event says: out of the door (`exit`), the pilot chute
 * thrown (`open-start`), the lines stretched (`line-stretch`), the canopy
 * open and flying (`open`), cut away by the press (`release`), landed
 * under on his skis and let go (`land`), caught in a crown or on a lift
 * (`snag`), or the jump begun again in the plane's door (`restart`). */
export type ChutePhaseEvent =
  "exit" | "open-start" | "line-stretch" | "open" | "release" | "land" | "snag" | "restart";

/** A `chute` event (`GameEvent`): where, and the jumper's speed, m/s — at
 * `open` the opening's peak load, g, in `g`. */
export type ChuteEvent = {
  kind: "chute";
  t: number;
  phase: ChutePhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
  g?: number;
};

/** WHAT THE SKYDIVE IS DOING: `exit` — out of the door into the plane's
 * slipstream, the air turning from along his way to up at him; `freefall`
 * — falling on his body's own drag; `deploying` — the pilot chute thrown
 * and the canopy coming out of its bag and opening (`ChuteDeploy`); `open`
 * — flying the canopy; `released` — cut away, the canopy falling free and
 * he falling or skiing on; `landed` — down on his skis under it and let go
 * of it; `snagged` — the canopy caught in a crown or on a lift, he hanging
 * under it until a restart. */
export type ChuteMode =
  "exit" | "freefall" | "deploying" | "open" | "released" | "landed" | "snagged";

/** A point the drawing hangs a piece on, world frame, m. */
export type ChutePoint = { x: number; y: number; z: number };

/** THE DEPLOYMENT, frame by frame: which stage (`CHUTE.deploy.stages`) and
 * how far through it 0..1, seconds since the throw, the pilot chute's and
 * the bag's places (the canopy's own is the state's), how far the lines are
 * out 0..1, the SLIDER's place down the lines (1 up at the canopy, 0 down
 * at the risers) and how far the canopy is spread 0..1. */
export type ChuteDeploy = {
  stage: DeployStage;
  share: number;
  t: number;
  pilot: ChutePoint;
  bag: ChutePoint;
  lines: number;
  slider: number;
  spread: number;
};

/** The canopy let go of (cut away, or let go on landing): where, how fast,
 * which way it lies, and whether it lies on the snow. */
export type ChutePiece = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  down: boolean;
};

/** WHAT THE CANOPY IS CAUGHT ON (`snagged`): a tree (by index into
 * `level.trees`), a lift's rope, tower or carrier (by the lift's index in
 * `liftPlans`); the point it is held at, m; the lines he hangs on, m. */
export type ChuteSnag = {
  on: "tree" | "rope" | "tower" | "carrier";
  index: number;
  x: number;
  y: number;
  z: number;
  lines: number;
};

/** THE FREE RIDE'S SKYDIVE (`chute.ts`) — on a ride whose jumper has left
 * the plane's door (or a lab's, `skydiveAt`), absent everywhere else. The
 * jumper is the skier himself (`GameState.skier`); this is what is over him
 * and how he flies. Drawn off this, heard off this; nothing in it draws from
 * the stream. */
export type ChuteState = {
  mode: ChuteMode;
  /** Seconds in this mode; seconds since the exit. */
  t: number;
  since: number;
  /** THE BODY in freefall: how far over he is from upright in the door
   * toward belly to earth (π/2) and on to head down (π), rad; how much he
   * tracks 0..1 and slides back 0..1; his heading, rad; the turn he is
   * making, rad/s. */
  attitude: number;
  track: number;
  slide: number;
  heading: number;
  turn: number;
  /** The air through him (or the canopy, open), m/s; the air's density
   * where he is, kg/m³; his height over the snow, m, and his fall, m/s
   * (down positive). */
  airspeed: number;
  density: number;
  agl: number;
  fall: number;
  /** The harness's load on him this step and the most since the throw, g. */
  g: number;
  peak: number;
  /** THE DEPLOYMENT, while it lasts and after (the drawing's last frame). */
  deploy: ChuteDeploy | null;
  /** THE CANOPY's centre, world frame, m, and its velocity, m/s — over him
   * on its lines while open. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The canopy's heading, its bank over him (right side down positive)
   * and its pitch off the lines' plane, rad. */
  canopyHeading: number;
  bank: number;
  pitch: number;
  /** Its angle of attack, rad; whether it is stalled; the pull on the
   * lines, N. */
  alpha: number;
  stalled: boolean;
  tension: number;
  /** The toggles and risers after their lags. */
  controls: ChuteControls;
  /** The canopy let go of — cut away or landed under — once it is. */
  piece: ChutePiece | null;
  /** What the canopy is caught on, while it is. */
  snag: ChuteSnag | null;
  /** THROWN out of the skydive (a freefall or a canopy brought into the
   * snow too fast): the jump begins again in the plane's door once he has
   * lain (`chuteDown`). */
  fell: boolean;
  /** Seconds on the snow on his skis, unthrown, with no canopy over him (a
   * cut-away come down): past `CHUTE.settle` he skis on. */
  settle: number;
  /** Down on his skis and skiing on: the skydive is over — its canopy only
   * lies where it came down. */
  done: boolean;
};
