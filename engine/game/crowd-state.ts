// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S STATE (`crowd.ts`, `crowd-lift.ts`, `crowd-down.ts`,
// `crowd-board.ts`): an amateur, his group and the crowd, kept beside
// `state.ts` (which re-exports them) so neither outgrows the cap.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { AmateurKnobs, CrowdBody, CrowdKind, GroupKind, GroupFollow } from "./defs/crowd.ts";
import type { StruckPerson } from "./person-hit.ts";
import type { Thrown } from "./thrown-state.ts";

/** What an amateur is doing: on his run (`ski`, `stop`, `down`, `air`);
 * in a lift's QUEUE at its foot, skating to his place and standing in it;
 * RIDING a carrier of it (`crowd-lift.ts`); SKATING off its top onto the
 * run he chose; or up a lift with no lift to show it (`lift`, a map with
 * none). */
export type AmateurMode = "ski" | "stop" | "down" | "air" | "lift" | "queue" | "ride" | "skate";

/** ONE OF THE CROWD (`crowd.ts`): an amateur on the ski area's runs, kept
 * as where he is along his run (`run`, `s`) and across it (`d`, m right of
 * its line), how fast he goes and how far his skis point off the line —
 * and, written every step for the player and the picture alike, where that
 * puts him on the mountain. The pose numbers (`lean` … `pole`) are what
 * the figure is drawn with and nothing in the step reads them back. */
export type Amateur = {
  id: number;
  /** His group (`CrowdState.groups`) and his place in it, 0 the leader. */
  group: number;
  rank: number;
  body: CrowdBody;
  kind: CrowdKind;
  knobs: AmateurKnobs;
  mode: AmateurMode;
  /** The run he is on, by index into the crowd's network (`crowdNet`). */
  run: number;
  /** Arc down the run, m, and offset right of its line, m. */
  s: number;
  d: number;
  /** Speed over the snow, m/s, and his skis' heading off the run's line,
   * rad (positive: to the right). */
  speed: number;
  yaw: number;
  /** The lateral his turns sweep about, m — the line he holds — and the
   * turn's phase, rad, as a function of how far down the run he is. */
  centre: number;
  phase: number;
  /** Off the piste (`offPiste`): how far past the edge his line goes, m
   * (signed by the side), and the arc he comes back by; 0 on the piste. */
  wander: number;
  wanderTo: number;
  /** A kicker he is going for: its lateral, and the arc of its lip; NaN
   * when none. */
  kickerAt: number;
  kickerD: number;
  /** The speed he means to ski at just now, m/s. */
  cap: number;
  /** Seconds left in a stop, a fall, a flight or a lift ride; until his
   * next decision. */
  timer: number;
  think: number;
  /** A flight's length and height, s and m, and how long he has been up. */
  airT: number;
  airH: number;
  airAt: number;
  /** Where that puts him: the world position (the snow under him, the air
   * over it), his heading, and his velocity in plan, m/s. */
  x: number;
  y: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  /** THE FIGURE: leaned into the turn, rad (positive right); how low, 0..1;
   * the wedge, 0..1; the skis turned across the way (a stop, a slip),
   * 0..1; down in the snow, 0..1, and the side he went down on (−1 left,
   * 1 right); his strides skated or poled, counted (a whole one a push),
   * and how hard he is working, 0..1. */
  lean: number;
  crouch: number;
  plough: number;
  across: number;
  fall: number;
  fallSide: number;
  pole: number;
  push: number;
  /** ON A LIFT (`crowd-lift.ts`): which (by its place among the map's
   * lifts, −1 none), the carrier he rides (`carrierAt`'s `k`) and his seat
   * on it; and where he skates to — his place in the queue, or off the
   * top the arc `ts` of his run `run` he joins it at. */
  lift: number;
  carrier: number;
  seat: number;
  tx: number;
  tz: number;
  ts: number;
  /** SHOULDERED ASIDE in a queue by the player skating past it
   * (`brushQueue`): his offset off his place, m, the stagger 0..1 and its
   * side (−1 left, 1 right). Absent while nobody has touched him. */
  shove?: { x: number; z: number; stagger: number; side: number };
  /** HIS TURNS, for the picture's pole plants: the side of the one he is
   * in (−1, 1, 0 none yet), s in it, and s the one before it held. */
  turnSide: number;
  turnT: number;
  turnHeld: number;
  /** DOWN (`crowd-down.ts`): his ragdoll (null on skis); s spent getting up. */
  thrown: Thrown | null;
  rise: number;
  /** TAKEN BY AN AVALANCHE (`avalanche-rescue.ts`): the burial that holds
   * him — carried in its flow, then under its debris until he is dug out —
   * and, dug out too late, lying DEAD where he was found. Absent on every
   * run without avalanches. */
  buried?: number;
  dead?: boolean;
  /** RUN INTO BY THE PLAYER at speed on a run with injuries
   * (`person-hit.ts`): hurt past getting up, alive (`dead` when killed),
   * and how crushed, 0..1. Absent while he is sound. */
  injured?: boolean;
  crush?: number;
  /** FALLEN BADLY on his own (`crowd-hurt.ts`): hurt past getting up, no
   * wound to show — the air ambulance's to fetch. Absent while he is sound. */
  hurt?: boolean;
  /** ON A SNOWBOARD (`CROWD.board`): the foot he rides with forward, or
   * null on skis. Stood, he SITS in the snow: how far down, 0..1, and
   * whether this stop is sat (`crowd-board.ts`). */
  board: "regular" | "goofy" | null;
  sit: number;
  sitDown: boolean;
};

/** A GROUP of the crowd: its kind, its members (leader first) by index
 * into `CrowdState.amateurs`, how they keep together, how far apart, and
 * the seconds left before it comes off the lift. */
export type CrowdGroup = {
  kind: GroupKind;
  members: number[];
  keep: GroupFollow;
  gap: number;
  lift: number;
  /** The lift the group is queueing for (−1 none), and the run it skis
   * off that lift's top (−1 not yet chosen) — every member takes it. */
  queue: number;
  next: number;
};

/** THE CROWD on a run that has one (`RunRules.crowd`): everyone, the
 * groups they came in, and the stream they were dealt and are decided off
 * — a stream of its own, so the crowd draws nothing from `state.rng`. */
export type CrowdState = {
  rng: Rng;
  amateurs: Amateur[];
  groups: CrowdGroup[];
  /** Every lift's queue at its foot, front first, by amateur id. */
  queues: number[][];
  /** Every amateur the player has run into at speed, in order
   * (`person-hit.ts`); absent until the first. */
  struck?: StruckPerson[];
};
