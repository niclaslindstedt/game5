// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S STATE (`chute.ts`) — the jump from the plane's door, the
// freefall, the canopy opening and flying, cut away, landed or caught —
// beside `state.ts`, which carries it as `GameState.chute`.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { CHUTE, type DeployStage } from "./defs/chute.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState } from "./state.ts";

/** THE CANOPY'S CONTROLS as the jumper works them, read off his own input
 * (`chuteControls`): both toggles down 0..1 (the back key — slow flight and
 * the flare), one toggle more than the other −1..1 (the edge, right
 * positive), and the risers −1..1 (the lean: forward the fronts, back the
 * rears). */
export type ChuteControls = { brake: number; steer: number; riser: number };

/** What a `chute` event says: out of the door (`exit`), the pilot chute
 * thrown (`open-start`), the reserve's handle pulled after a cut-away
 * (`reserve`), the lines stretched (`line-stretch`), the canopy — the main
 * or the reserve — open and flying (`open`), cut away by the press
 * (`release`), landed
 * under on his skis and let go (`land`), caught in a crown or on a lift
 * (`snag`), or the jump begun again in the craft he left (`restart`). */
export type ChutePhaseEvent =
  | "exit"
  | "open-start"
  | "reserve"
  | "line-stretch"
  | "open"
  | "release"
  | "land"
  | "snag"
  | "restart";

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

/** WHAT THE SKYDIVE IS DOING: `ready` — in a wingsuit, stood on a cliff's
 * edge, the press the jump; `exit` — out of the door into the plane's
 * slipstream, the air turning from along his way to up at him; `freefall`
 * — falling on his body's own drag; `deploying` — the pilot chute thrown
 * and the canopy coming out of its bag and opening (`ChuteDeploy`); `open`
 * — flying the canopy; `released` — cut away, the canopy falling free and
 * he falling or skiing on; `landed` — down on his skis under it and let go
 * of it; `snagged` — the canopy caught in a crown or on a lift, he hanging
 * under it until a restart. */
export type ChuteMode =
  "ready" | "exit" | "freefall" | "deploying" | "open" | "released" | "landed" | "snagged";

/** WHAT HE JUMPS IN: a sport skydiver's rig over his ski clothes and his
 * skis on (`box` — belly to earth, a main and a reserve), or a WINGSUIT over
 * a one-canopy BASE rig and no skis (`wingsuit`, `wingsuit.ts`). */
export type ChuteSuit = "box" | "wingsuit";

/** THE WINGSUIT IN FLIGHT (`wingsuit.ts`), read by the drawing, the HUD
 * and the lab: the suit's angle of attack and its pitch rate, rad and
 * rad/s; the body's pitch to the horizon (nose up positive), the path's
 * angle (up positive) and the bank (right side down positive), rad; the
 * hands after their lag — the lean −1 (dive) … 1 (flare), the arms swept
 * back 0..1 (the tuck), the wings spread full 0..1 (the back key); how
 * full of air the suit is 0..1; the lift and the drag on it, N; the glide
 * it is flying (across over down, through the air); and whether it is
 * stalled. */
export type WingsuitFlight = {
  alpha: number;
  q: number;
  pitch: number;
  path: number;
  bank: number;
  lean: number;
  sweep: number;
  spread: number;
  pressure: number;
  lift: number;
  drag: number;
  glide: number;
  stalled: boolean;
};

/** WHAT HE JUMPED FROM — the craft a restart puts him back in: the jump
 * plane's door, the helicopter's skid, the balloon's basket or the
 * paramotor's harness (`craftFreefall`). */
export type ChuteCraft = "plane" | "heli" | "balloon" | "para";

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

/** A canopy let go of (cut away, or let go on landing): where, how fast,
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
 * the plane's door, the helicopter's skid, the balloon's basket or the
 * paramotor's harness high enough to open (or a lab's, `skydiveAt`),
 * absent everywhere else. The
 * jumper is the skier himself (`GameState.skier`); this is what is over him
 * and how he flies. Drawn off this, heard off this; nothing in it draws from
 * the stream. */
export type ChuteState = {
  mode: ChuteMode;
  /** The craft he jumped from, and is begun again in. */
  from: ChuteCraft;
  /** What he jumps in. In a WINGSUIT `ready` is stood on a cliff's edge
   * before the jump, `exit` the start arc off it (or off the door), and
   * `freefall` the suit FLYING (`wing`); his canopy is the BASE rig's one
   * (`CHUTE.base`, no reserve and nothing to cut away), he lands on his
   * boots and `landed` is him ON FOOT; he wears NO SKIS throughout. */
  suit: ChuteSuit;
  /** THE WINGSUIT'S FLIGHT, in a wingsuit (absent in the box). */
  wing?: WingsuitFlight;
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
  /** THE RESERVE PULLED: the deployment and the canopy over him are the
   * reserve's (`CHUTE.reserve`) from the pull on — the main long cut away. */
  reserve: boolean;
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
  /** The MAIN let go of — cut away or landed under — once it is. */
  piece: ChutePiece | null;
  /** The RESERVE let go of — landed under, or brought down onto the snow —
   * once it is (it is never cut away). */
  sparePiece: ChutePiece | null;
  /** What the canopy is caught on, while it is. */
  snag: ChuteSnag | null;
  /** THROWN out of the skydive (a freefall or a canopy brought into the
   * snow too fast): the ride begins again in the craft he left once he
   * has lain (`chuteDown`). */
  fell: boolean;
  /** Seconds on the snow on his skis, unthrown, with no canopy over him (a
   * cut-away come down): past `CHUTE.settle` he skis on. */
  settle: number;
  /** Down on his skis and skiing on: the skydive is over — its canopy only
   * lies where it came down. */
  done: boolean;
};

/** A skydive begun where the skier is, in `mode`, out of `from`, in `suit`. */
export function freshChute(
  state: GameState,
  mode: ChuteMode,
  from: ChuteCraft = "plane",
  suit: ChuteSuit = "box",
): ChuteState {
  const c = state.skier;
  const flat = hypot(c.vx, c.vz);
  return {
    mode,
    from,
    suit,
    t: 0,
    since: 0,
    attitude: mode === "exit" ? CHUTE.exit.poise : Math.PI / 2,
    track: 0,
    slide: 0,
    heading: flat > 2 ? Math.atan2(c.vx, c.vz) : c.heading,
    turn: 0,
    airspeed: c.speed,
    density: TUNING.airDensity,
    agl: 0,
    fall: -c.vy,
    g: 0,
    peak: 0,
    deploy: null,
    reserve: false,
    x: c.x,
    y: c.y,
    z: c.z,
    vx: c.vx,
    vy: c.vy,
    vz: c.vz,
    canopyHeading: c.heading,
    bank: 0,
    pitch: 0,
    alpha: 0,
    stalled: false,
    tension: 0,
    controls: { brake: 0, steer: 0, riser: 0 },
    piece: null,
    sparePiece: null,
    snag: null,
    fell: false,
    settle: 0,
    done: false,
  };
}
