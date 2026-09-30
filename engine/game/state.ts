// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The engine's state and event types. The renderer, the HUD and the bot all
// read this shape; only skier.ts, collision.ts, course.ts and step.ts write
// it during a run, and place.ts stands one at a moment before it starts.
//
// Sign conventions (the framework's `core/quat` owns the flips): heading 0 points along +z
// and grows clockwise seen from above (positive steer edges the skis into a
// clockwise turn in map view); pitch is tips-up positive; roll is
// right-side-down positive; body-frame angular velocities are right-handed
// about the skier's right (x), up (y) and forward (z) axes, so a tips-up
// pitch rate is a NEGATIVE `wx` and a right-side-down roll rate a negative
// `wz`.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Quat } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Level } from "../mapgen/types.ts";
import type { SkiSpec } from "./defs/skis.ts";
import type { Assist, RunRules } from "./defs/modes.ts";

export type SkierInput = {
  /** -1..1; positive edges the skis into a clockwise turn (right in map
   * view) — THE EDGE: the skis tipped over and the skier angulated inside
   * the arc with them. There is no separate side-lean control. */
  steer: number;
  /** 0..1, analogue — THE TUCK: the body folded down out of the wind, and
   * at a crawl the poles pushing. */
  tuck: number;
  /** 0..1, analogue — THE SKID: the skis pivoted across the way, a
   * snowplough at a crawl and a hockey stop at speed. */
  brake: number;
  /** -1..1; +1 is the skier leaning BACK (tips up), -1 forward. On the snow
   * it moves his weight fore and aft; in the air it is the pitch control. */
  lean: number;
  /** Edge-triggered: stand the skier back on the piste at the last gate he
   * took — on a free ride, at the nearest point of the piste (`course.ts`). */
  reset: boolean;
  /** HELD: the skier's body is off the controls and into a GRAB
   * (`strokes.ts`) — which one the lean and the edge say. Read only on a
   * run whose rules count tricks, and only in the air; left out, it is
   * off. */
  trick?: boolean;
};

export const NEUTRAL_INPUT: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** ONE PROBE WHERE A SKI MEETS THE SNOW — one station of one ski: its tip,
 * its middle under the boot, or its tail — as the renderer needs it to
 * stamp a trail: where the footprint is, how deep into the snow it is
 * pressed, and whether it is touching at all. Rewritten every step;
 * `touching` false leaves the rest at the last place it touched. */
export type SnowContact = {
  kind: "ski";
  /** Which station of the ski. */
  station: "tip" | "mid" | "tail";
  /** -1 the left ski, +1 the right. */
  side: number;
  /** The footprint, world frame, m: on the SNOW SURFACE (`level.groundAt`)
   * under the probe — the top of the trough it cuts, not its floor. */
  x: number;
  y: number;
  z: number;
  /** How far the footprint is pressed below the untouched surface, m —
   * the trail's depth. */
  sink: number;
  /** Width of snow this station presses, m. */
  width: number;
  /** The leg's compression, m (0 standing tall), and the load, N. */
  compression: number;
  load: number;
  touching: boolean;
};

export type SkierState = {
  spec: SkiSpec;
  /** Centre of gravity, m, world frame. */
  x: number;
  y: number;
  z: number;
  /** Velocity, m/s, world frame. */
  vx: number;
  vy: number;
  vz: number;
  /** Orientation, body → world. Full 3D so a rollover is representable. */
  q: Quat;
  /** Angular velocity, BODY frame, rad/s (see the header for the signs). */
  wx: number;
  wy: number;
  wz: number;
  /** Derived from `q` each step for the HUD, the camera and the bot; nobody
   * integrates these. */
  heading: number;
  pitch: number;
  roll: number;
  /** |v|, m/s, vertical included — what the speedo reads. Written once at
   * the end of the step. */
  speed: number;
  /** The way made good along the skis' own line, flattened, m/s — signed. */
  way: number;
  /** The inputs as the body has them, after their lags: the tuck 0..1, the
   * brake 0..1, the edge -1..1 and the lean -1..1. */
  tuck: number;
  brake: number;
  steer: number;
  lean: number;
  /** THE EDGE the skis stand on, rad, signed like `steer` — the angle the
   * ski is tipped off flat, reached at `steer.edgeRate`. */
  edge: number;
  /** THE SKID: how far across the way the skis are pivoted by the brake,
   * 0..1 of the skid angle the speed allows. */
  skid: number;
  /** The skis' actual angle under the body, rad, positive clockwise — the
   * skid's pivot plus the edge's toe-in. */
  skiAngle: number;
  /** THE CROUCH the body is actually in, 0 standing tall … 1 a full tuck —
   * the tuck after its lag. What the drag area and the CoG height read. */
  crouch: number;
  /** Where the skier's hips currently sit, m: to his right, and aft of
   * nominal. Lags the edge and the lean. */
  hipRight: number;
  hipAft: number;
  /** Share of the skis' load on packed snow, 0..1, this step. */
  packed: number;
  /** THE SIDEWAYS SLIP: the fastest any touching station slid across its
   * own line this step, m/s — what a caught edge is read off (`crash.ts`). */
  sideSlip: number;
  /** Every probe (`SnowContact`): the left ski's tip, mid and tail, then
   * the right ski's. */
  contacts: SnowContact[];
  /** The legs' compression per ski, m (left, right) — the renderer's knee
   * bend. */
  skiCompression: [number, number];
  /** True while nothing is touching the snow; `airTime` is the seconds
   * since it left, 0 when grounded. */
  airborne: boolean;
  airTime: number;
  /** The vertical speed it left with, m/s, for the `air` event, and
   * whether that event has been reported for this flight. */
  launchVy: number;
  airReported: boolean;
  /** Seconds since the last landing; starts large. */
  landing: number;
  /** Seconds on his side or back, and seconds held poling going nowhere —
   * the automatic reset's two clocks. */
  overFor: number;
  stuckFor: number;
  /** BOGGED (`trench.ts`): how far the skier has sunk into the powder under
   * him, m, on top of the sink — and seconds he has been bogged past the
   * mark, the automatic reset's third clock; and seconds he has been
   * poling in powder going nowhere, which is when he sinks. */
  trench: number;
  trenchFor: number;
  boggedFor: number;
  /** Seconds lying over on the snow (`crash.ts`) — the fall's clock;
   * turning over in the air does not run it. */
  rolledFor: number;
  /** THE SKIER THROWN OFF HIS SKIS, or null while he is on them
   * (`crash.ts`). */
  thrown: Thrown | null;
  /** What the skis and the legs have taken (`damage.ts`). */
  damage: SkierDamage;
  /** Seconds before another tree hit (or a bump) is reported. */
  hitCooldown: number;
  bumpCooldown: number;
  /** The support depth each probe has settled to, m — the snow's own lag
   * (`snow.ts`), one per `contacts` entry. */
  sinks: number[];
  /** Each probe's compression at the last step, m (0 when it was not
   * touching) — what the damper's rate is read off (`skier.ts`). */
  comps: number[];
};

/** WHAT THREW THE SKIER (`crash.ts`): a trunk met hard, a landing taken
 * over the tips, a fall at speed (an edge lost), or a high-side (an edge
 * caught). */
export type CrashCause = "tree" | "nose" | "roll" | "catch";

/** THE SKIER THROWN — a body of his own from the moment he leaves his skis
 * until the reset stands him back on the piste (`crash.ts`): a RAGDOLL
 * (`ragdoll.ts`), thirteen points held together at the joints and each
 * meeting the snow and the trunks on its own, so he flops, slides and
 * comes to rest the way a body does. Written by `stepThrown` only; the
 * renderer hangs the figure on `points` and stamps the snow where he is
 * `touching`. */
export type Thrown = {
  cause: CrashCause;
  /** Seconds since he left the skis. */
  t: number;
  /** His centre of mass, world frame, m, and its velocity, m/s — what the
   * camera follows and the reset waits on. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The bearing he was thrown along, rad (0 = +z, clockwise), and how far
   * his spine has turned in all since, rad — the tumble, counted. */
  heading: number;
  tumble: number;
  /** The body's points (`RAGDOLL` order), x y z each, world frame, m, and
   * where they were a step ago — the velocity is the difference. */
  points: number[];
  last: number[];
  /** Some part of him on the snow this step. */
  touching: boolean;
  /** Seconds he has lain STILL on the snow — every point under
   * `crash.restSpeed`, touching — without a break: what the reset waits on. */
  still: number;
};

/** A part `damage.ts` keeps a figure for. */
export type DamagePart = "skiLeft" | "skiRight" | "legs";

/** WHAT THE SKIS AND THE LEGS HAVE TAKEN (`damage.ts`), each 0 sound … 1
 * wrecked: the two skis' edges (left, right) and the legs. Kept only on a
 * run that asked for damage (`GameState.damage`); all zero, and read as
 * nothing, otherwise. A reset does not mend it. */
export type SkierDamage = {
  ski: [number, number];
  legs: number;
};

/** WHAT A SKIER CAN BE PAID FOR (`tricks.ts`) — the engine names the
 * thing and never the word (`pwa/src/game/strings.ts` owns those):
 * - `air` — the flight itself as an element, credited only beside a trick;
 * - `backflip` / `frontflip` — a revolution tips over tails, either way;
 * - `spin` — a revolution about the skier's own up axis (the 360);
 * - `twist` — a flip and a spin both come round in ONE flight;
 * - the three GRABS (`TrickPose`), the skier's body held off the controls. */
export type TrickKind = "air" | "backflip" | "frontflip" | "spin" | "twist" | "landing" | TrickPose;

/** THE SKIER'S GRABS, picked with the trick button held in the air by what
 * the lean and the edge say (`strokes.ts`'s `poseOf`): the DAFFY, one ski
 * kicked forward and one back (the edge over), the SPREAD, both skis flung
 * wide (the lean back), or the GRAB, the body folded to a hand on the ski
 * (the lean forward, or nothing). */
export type TrickPose = "daffy" | "spread" | "grab";

/** One element of a combo: what it was, which revolution of its flight
 * (1 for everything that is not a revolution), and which flight of the
 * combo won it (1-based). */
export type TrickPart = { kind: TrickKind; spins: number; flight: number };

/** THE SCORE AND ITS COMBO, and the strokes' per-flight bookkeeping
 * (`tricks.ts`, `strokes.ts` — every rule is theirs). Written only there. */
export type TrickState = {
  /** Points banked this run. */
  score: number;
  /** The combo in hand: its base, points, and its multiplier. */
  base: number;
  mult: number;
  /** Seconds left on the snow before the combo banks. */
  link: number;
  /** This flight's rotation, rad, nose-up positive, and about the up axis
   * (either way), and the whole revolutions of each already paid. */
  rotation: number;
  spins: number;
  yaw: number;
  turns: number;
  /** Where this flight left the snow, and the metres of it already paid. */
  fromX: number;
  fromZ: number;
  paidLength: number;
  /** This flight has lasted `airElement`; its rung has been sold; a flip
   * and a spin have both come round in it. */
  aired: boolean;
  airPaid: boolean;
  twisted: boolean;
  /** THE GRAB held now, or null, how long it has been held, and the grabs
   * already bought this flight. */
  pose: TrickPose | null;
  poseTime: number;
  posed: TrickPose[];
  /** THE STROKES: rad/s already spent this flight on each axis, which way
   * each input is still across its gate from the last stroke (0 back at
   * trim, ±1 the side it crossed to), and whether this flight is a trick
   * (a first stroke thrown going up latches it). */
  pumped: number;
  twirled: number;
  flipCrossed: number;
  spinCrossed: number;
  tricking: boolean;
  /** THE THROW BEING PAID OUT (`strokes.ts`): on each axis the rate a
   * stroke has bought and the skier has not been given yet, rad/s, signed
   * the way the stroke went, and how fast it is being paid now, rad/s²;
   * and the side the edge was last thrown to while it is still held
   * there (0 once let go) — a 360 held is a 360 still carried. */
  flipWind: number;
  spinWind: number;
  flipPay: number;
  spinPay: number;
  spinSide: number;
  /** The skier was in the air at the last step this module saw. */
  inAir: boolean;
  /** The combo's elements, and which flight of it this is. */
  parts: TrickPart[];
  flight: number;
  /** The last combo closed: its points, when, whether it was lost, and its
   * elements — what a readout holds up after the fact. */
  last: number;
  lastAt: number;
  lastBailed: boolean;
  lastParts: TrickPart[];
};

/** Why a combo was lost (`tricks.ts`): the skier thrown, put back on the
 * piste, or a landing taken still in a grab. */
export type BailCause = "wipeout" | "reset" | "pose";

/** The engine's name for the thing ridden, kept for the vocabulary the
 * sibling games share. */
export type CraftState = SkierState;

export type Progress = {
  /** The gate the run OWES next — 0 until the start gate is crossed, then
   * 1, 2 … up to the finish. */
  nextCheckpoint: number;
  /** Whether the start gate has been crossed (the run is on). */
  started: boolean;
  /** Runs completed — 0 until the finish line, 1 past it. */
  lap: number;
  /** Gates credited in total, the start gate included — the standings'
   * first measure. */
  passed: number;
  /** The last gate credited, -1 before the start gate. */
  lastCheckpoint: number;
  /** Run clock at each gate's crossing, s (NaN until). */
  splits: number[];
  /** The clock at the run's end, s (one entry, at the finish), and when the
   * run began. */
  lapTimes: number[];
  lapStart: number;
  /** The run clock, s — from GO; stops at the flag. */
  time: number;
  finished: boolean;
  /** A gate the skier went past without taking — the HUD's arrow points
   * back at it until it is taken. Null when none. */
  missed: number | null;
  /** The clock when a gate was last taken and when the skier was last
   * reset, s — "no progress for a while" is measured from the later. */
  lastPassedAt: number;
  lastResetAt: number;
  /** The run's longest flight, s. */
  bestAir: number;
  /** How far the skier has skied, m of plan distance — a reset's jump not
   * counted. The free ride's odometer; a race keeps it too. */
  distance: number;
};

/** ANOTHER SKIER ON THE SAME SNOW (`rivals.ts`): a whole run of its own
 * over the player's very level, rules and stream. `pace` is the tuck its
 * bot is allowed, dealt once at the start line; `lane` the line it holds
 * down the piste, m right of the centreline — its own slot's; `id` its
 * slot less one. */
export type Rival = {
  id: number;
  run: GameState;
  pace: number;
  lane: number;
};

export type GameEvent =
  /** ONE LIGHT: `left` whole seconds still to run (3, 2, 1). */
  | { kind: "count"; t: number; left: number }
  /** The lights are out and the clock runs. */
  | { kind: "go"; t: number }
  /** The skier has been off the snow long enough to count as air
   * (`air.counts`); `vy` is the climb he left with, m/s. */
  | { kind: "air"; t: number; vy: number; speed: number }
  /** Back on the snow after `airTime` s. `impact` is the speed INTO the
   * slope he met, m/s; `harsh` whether the legs could not take it all, and
   * `lost` the share of his way that cost. */
  | {
      kind: "land";
      t: number;
      airTime: number;
      impact: number;
      speed: number;
      harsh: boolean;
      lost: number;
    }
  /** A trunk met at `speed` m/s closing. */
  | { kind: "hit"; t: number; speed: number; x: number; z: number }
  /** THE SKIER THROWN: why, how fast he was going, and where. */
  | { kind: "wipeout"; t: number; cause: CrashCause; speed: number; x: number; z: number }
  /** The skier is bogged in deep powder (`trench.ts`): work out or reset. */
  | { kind: "stuck"; t: number }
  /** A ski or the legs have taken a blow worth saying (`damage.ts`):
   * which, and how bad it now is, 0..1. */
  | { kind: "damage"; t: number; part: DamagePart; level: number }
  /** Another skier — the player's own contact with rival `rival`. */
  | { kind: "bump"; t: number; rival: number; speed: number }
  /** A gate taken: its index, the run it was taken on (always 0), and the
   * clock. */
  | { kind: "checkpoint"; t: number; index: number; lap: number; split: number }
  /** A gate skied past without being taken. */
  | { kind: "missed"; t: number; index: number }
  /** The run finished: `lap` is how many are done (1), `time` the run's
   * own. Fired beside `finish` at the finish line. */
  | { kind: "lap"; t: number; lap: number; time: number }
  /** The finish: the whole run's `time`, and the `place` it earned. */
  | { kind: "finish"; t: number; time: number; place: number }
  /** Stood back on the piste at `checkpoint` (-1: at the start line);
   * `auto` when the engine did it rather than the skier. */
  | { kind: "reset"; t: number; checkpoint: number; auto: boolean }
  /** AN ELEMENT WON (`tricks.ts`): which, which revolution of its flight,
   * what it added to the base, and the multiplier now. */
  | { kind: "trick"; t: number; trick: TrickKind; spins: number; points: number; mult: number }
  /** THE COMBO BANKED: `points` (= `base × mult`) went into the score; a
   * `sketchy` landing banked it at its base alone. */
  | { kind: "combo"; t: number; points: number; base: number; mult: number; sketchy: boolean }
  /** THE COMBO LOST, and what it would have been worth. */
  | { kind: "bail"; t: number; lost: number; cause: BailCause };

/** `countdown` is the lights: the field stands in the start gate, nothing
 * is steered and the clock reads 0. `racing` runs the clock; `finished`
 * coasts. */
export type GamePhase = "countdown" | "racing" | "finished";

export type GameState = {
  seed: number;
  rng: Rng;
  /** Sim time since creation, s, and the number of steps taken. */
  t: number;
  tick: number;
  level: Level;
  skier: SkierState;
  /** The input the last step was given — what the HUD reads back. */
  input: SkierInput;
  progress: Progress;
  rules: RunRules;
  /** The arcade's help (`Assist`), 0..1 per hand; the field always rides
   * with every hand on. */
  assist: Assist;
  /** Whether blows dull an edge or hurt the legs (`damage.ts`) — the
   * player's option, off unless asked for; a rival never takes damage. */
  damage?: boolean;
  /** THE SNOW DIAL (`SNOW_DIAL`): the powder's sink as a multiple of the
   * ordinary snow's, 1 unless the run asked otherwise. Read, never written,
   * during a run, and shared with the field. */
  snowDepth: number;
  /** THE NEW SNOW, m: what the fall (`snowfall.ts`) has laid since the run
   * was stood up — 0 under a sky that does not snow, centimetres an hour
   * under one that does. Written once a step by `step`, shared with the
   * field, and read through `packedUnder` / `depthUnder` wherever the
   * surface is. */
  fresh: number;
  /** THE FIELD: every other skier, in start-line order; empty on a solo
   * run. */
  rivals: Rival[];
  /** THE SCORE (`tricks.ts`): kept on every run — the sim reads it — and
   * worked for (`strokes.ts`) only on one whose rules count tricks. */
  tricks: TrickState;
  /** Seconds of the lights still to run; 0 once they are out. */
  countdown: number;
  phase: GamePhase;
  /** This step's events, cleared at the top of each step. */
  events: GameEvent[];
};
