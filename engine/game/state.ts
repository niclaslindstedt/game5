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
import type { SkiId, SkiSpec } from "./defs/skis.ts";
import type { Assist, RunRules } from "./defs/modes.ts";
import type { AmateurKnobs, CrowdBody, CrowdKind, GroupKind, GroupFollow } from "./defs/crowd.ts";
import type { BodyPart, InjuryKind } from "./defs/anatomy.ts";
import type { CRASH } from "./defs/crash.ts";
import type { HeliControls, HeliPhaseEvent, HeliState } from "./heli-state.ts";
import type { Thrown } from "./thrown-state.ts";
import type { SledEvent, SledState } from "./sled-state.ts";
import type { StakeState } from "./edge-stakes.ts";
import type { Bracket, CrossHeat } from "./cross-bracket.ts";
import type { BigAirContest } from "./big-air-contest.ts";
import type { SlopeContest } from "./slopestyle-contest.ts";
import type { JamState } from "./jam.ts";
import type { PressState } from "./butter-state.ts";

export type { HeliControls, HeliMode, HeliPhaseEvent, HeliState } from "./heli-state.ts";
export type { LoneSki, Thrown } from "./thrown-state.ts";
export type { ButterRecord, PressEnd, PressState } from "./butter-state.ts";
import type { JibRecord, JibRide } from "./jib-state.ts";
export type { JibRecord, JibRide, JibStance } from "./jib-state.ts";
import type { FlightRecord } from "./flight-record.ts";
export type { FlightRecord } from "./flight-record.ts";
export type * from "./sled-state.ts";
export type * from "./para-state.ts";

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
  /** HELD: CUT HARDER — the back key thrown with an edge already on
   * (`input-model.ts` tells the two orders apart): the skis stood further
   * over and pressed into the groove, a tighter line that costs little.
   * Left out, it is off. */
  carve?: boolean;
  /** HELD: THE JUMP LOADED — the skier sinks onto his legs while it is
   * held on the snow, and springs off them the step it is let go, the
   * higher the longer it was held (`TUNING.jump`). Left out, it is off. */
  jump?: boolean;
  /** THE HELICOPTER'S CONTROLS (`heli.ts`), while he sits on its skid and
   * flies it — the skier's own axes mean nothing there. Left out, the
   * controls are where they were let go: the collective down, the cyclic
   * and the pedals centred. */
  heli?: HeliControls;
  /** EDGE-TRIGGERED: THE MACHINE PRESS — on to the machine he stands beside, off the one
   * he rides, or the paramotor's rig released. ENTER, a double tap on touch. */
  machine?: boolean;
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
  /** The body's roll against the SNOW under him, rad, right side down
   * positive — his inclination into a turn, measured from the snow's own
   * normal rather than the vertical (on a side hill `roll` is not). The
   * legs are cast down that normal (`skier.ts`), so this is the one angle
   * between the body and the line his two skis stand along on the snow;
   * the drawn skis read it to stay there (`ski-stand.ts`). A readout, as
   * `roll` is: nothing integrates it. */
  incline: number;
  /** THE TURN'S BALANCE, rad, right side down positive: the inclination at
   * which the snow's reaction under his skis — its grip across them over
   * its push along its normal — passes through his centre of mass, eased
   * over `skier.balanceLag`. What his inclination is held toward on the
   * groomer (`skier.ts`); kept through a flight. */
  balance: number;
  /** |v|, m/s, vertical included — what the speedo reads. Written once at
   * the end of the step. */
  speed: number;
  /** The way made good along the skis' own line, flattened, m/s — signed. */
  way: number;
  /** RIDING SWITCH: the skis going down the hill backward, tails first
   * (`RunRules.stunts` only — never on a race). Decided on the snow, with a
   * margin either way of a standstill (`TUNING.switch.from`), and held
   * through a flight: a skier spinning a 360 is not switch half way round.
   * The steer is read the way he is GOING while he is (`skier.ts`), and the
   * lens stands behind the way he is going (`camera-rigs.ts`). */
  switched: boolean;
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
  /** CUTTING HARDER, 0..1 — the carve key after the edge's own lag. */
  carve: number;
  /** THE JUMP BEING LOADED: seconds held on the snow, to `jump.full` — and
   * seconds since the last pop, starting large (the pose's spring off the
   * legs reads it). */
  jumpLoad: number;
  popped: number;
  /** THE DRIVE HE IS MAKING (`poles.ts`), 0..1 of the whole push, after
   * its lag — and the strides taken while making it, counted: the phase
   * the push and the pose are both on. */
  drive: number;
  stride: number;
  /** THE LINE HE GLIDES ON, rad off his heading, clockwise positive: 0
   * but skating, when it is the gliding ski's — the V's other arm each
   * stride, carried across by the push (`poles.ts`'s `glideYaw`). The
   * skis grip and the drive pushes along it, so a skater goes the way
   * the ski he stands on points. */
  glide: number;
  /** THE STEP TURN, −1..1, right positive: how far he is stepping his
   * skis round a turn at a crawl (`poles.ts`'s `stepWork`) — the steer
   * key over the share of him on his legs, taken up and let go at
   * `poles.turn.rate`. It turns his heading a step a stride and leads the
   * V into the turn (`glideYaw`); 0 at speed, on his poles, or straight. */
  step: number;
  /** STEPPING ROUND ON THE SPOT (`poles.ts`'s `stepRound`): ±1 the way he
   * steps, right positive, while he is stood still with only a steer held
   * — the stride's phase is where in a pair of steps he is — and 0 when he
   * is not. What the pose reads to draw his skis stepped one at a time. */
  pivot: number;
  /** ON HIS PLATFORMS (`sidestep.ts`): ±1 the side of him the hill rises
   * on, right positive, while he stands across a steep slope on the ledges
   * his edges have cut — stepping up it a pair at a time while the steer
   * asks toward the hill, the stride's phase where in the pair he is — and
   * 0 when he does not. What the pose reads to draw the sidestep. */
  sidestep: number;
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
  /** THE CHATTER: how hard the skis are vibrating on the firm snow under
   * them this step, 0 (still, slow or in powder) … 1 (shaking on a
   * hard-loaded edge flat out) — the speed's share (`chatterOf`) on the
   * packed share of the load, most on an edge carrying a bend. Read by
   * the view (the skis' flutter, the knees taking it) and nothing in the
   * physics: the grip it costs is `chatterOf`'s own. */
  chatter: number;
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
  /** THE BODY ON THE SNOW this step (`chassis.ts`): the fastest any of the
   * hips, the shoulders or the helmet went into it, m/s (0 with none of
   * them touching), and the side of the one that did (−1 left, 1 right, 0
   * the helmet) — a skier down on his side, his back or his head. */
  bodyHit: number;
  bodySide: number;
  /** The last thing he nearly fell to, or null (`crash.ts`). */
  save: Save | null;
  /** HOW MUCH HE CAN TAKE before he goes down, 0..1 (`crash.ts`'s
   * `crashLimit`): 1 is a professional (`TUNING.crash`'s own thresholds),
   * 0 a club skier (`TUNING.crash.club`). The player's is 1 unless
   * `createGame` is asked otherwise; each rival is dealt his own
   * (`RACE.resilienceBand`). Read only by the crash. */
  resilience: number;
  /** WHETHER HE HAS HIS POLES: true for every skier but a player who asked
   * to go without (`createGame`'s `poles`, the hard mode) — then the push
   * is his legs' alone and never a double pole, a rise holds less of it,
   * he keeps less of his balance and rocks out of a bog worse
   * (`TUNING.poles.bare`). Read, never written, during a run. */
  poles: boolean;
  /** THE START PUSH out of a slalom's start house (`start-push.ts`): the
   * seconds since he threw himself out over the wand, or −1 before he has
   * — what the figure times the push and the hop by. */
  launch: number;
  /** THE SKIER THROWN OFF HIS SKIS, or null while he is on them
   * (`crash.ts`). */
  thrown: Thrown | null;
  /** What the skis and the legs have taken (`damage.ts`). */
  damage: SkierDamage;
  /** WHAT THE SKIER'S BODY HAS TAKEN (`body.ts`): every part's injuries,
   * the last blow worth billing and the run's hardest. Read by nothing in
   * the physics. */
  body: BodyState;
  /** THE WIND TUNNEL he is being carried along (R30, `wind-tunnel.ts`),
   * or null. */
  tunnel: TunnelRide | null;
  /** THE LIFT he is riding (`lift-ride.ts`), or null — on a free ride. */
  lift: LiftRide | null;
  /** THE JIB he is sliding (`jib.ts`), or null — on a map with rails and
   * boxes (R39). Left out, he is on none. */
  jib?: JibRide | null;
  /** THE CHAIR HE STOOD UP OFF, running on empty over the unload ramp to
   * the wheel at the terminal's speed (`lift-ride.ts`'s `emptyChairAt`):
   * the lift, how far up its line it let him go, m, and when, s — null
   * once it is round the wheel, or he never rode one. A skier stopped in
   * its way is knocked down by it. */
  chairLeft: { index: number; u: number; t: number } | null;
  /** Seconds before another tree hit (or a bump) is reported. */
  hitCooldown: number;
  bumpCooldown: number;
  /** THE DRAFT (`stepDrafts`): the share of his frontal drag a rival close
   * ahead takes off in a ski-cross heat, 0..1; absent everywhere else. */
  draft?: number;
  /** The support depth each probe has settled to, m — the snow's own lag
   * (`snow.ts`), one per `contacts` entry. */
  sinks: number[];
  /** Each probe's compression at the last step, m (0 when it was not
   * touching) — what the damper's rate is read off (`skier.ts`). */
  comps: number[];
};

/** WHAT THREW THE SKIER (`crash.ts`): a trunk met hard, a landing taken
 * over the tips, a fall at speed (an edge lost, or the body slammed down on
 * the snow), a high-side (an edge caught), a landing he could not stand
 * up out of — come down on his side, his back or his head, or too hard for
 * his legs — another skier taken out at speed (`crowd.ts`), or flung off the
 * skid of a helicopter that crashed (`heli.ts`), or thrown off a snowmobile
 * rolled, looped, landed too hard or run into a trunk (`sled.ts`), swept
 * off his feet by the empty chair he stood up off (`lift-ride.ts`), or
 * driven into a downhill's A-nets (`nets.ts`) — one name a row of
 * `crash.over`, which says how each throws him. */
export type CrashCause = keyof typeof CRASH.over;

/** WHAT HE NEARLY FELL TO (`crash.ts`): a hard landing ridden out, a trunk
 * taken on the shoulder, a hand or a hip down on the snow and pushed back
 * up off, an edge that bit and was held, a stake run into. */
export type SaveKind = "landing" | "tree" | "body" | "edge" | "stake";

/** THE SAVE — the moment a skier rode out something that came near to
 * throwing him, kept for the figure to play (`skier-save.ts`): which, how
 * long ago (s), how near it came (0 nothing … 1 the edge of a fall), the
 * side it came from (−1 left, 1 right — the trunk, the snow, the edge)
 * and, for a landing, which way it threw him (1 over the tips, −1 onto
 * the tails). Written by `crash.ts` only, read by nothing in the physics. */
export type Save = { kind: SaveKind; t: number; size: number; side: number; fore: number };

/** WHAT THE SKIER'S BODY HAS TAKEN (`body.ts`): the worst injury on each
 * part (its AIS rank, 0 sound … 5 critical, in `BODY_PARTS` order), every
 * injury in the order it was taken, the last blow worth billing on the g
 * meter, the run's hardest blow, g, and the hardest he FELL on — the one
 * the HUD bills. A reset mends it (`mendBody`), keeping the two peaks. */
export type BodyState = {
  worst: number[];
  injuries: Injury[];
  impact: Impact | null;
  peak: number;
  fallPeak: number;
  /** How many blows have been billed — what the HUD keys the meter on. */
  blows: number;
  /** THE FIRE'S THERMAL DOSE taken from a burning wreck's fireball,
   * (kW/m²)^4/3 · s on bare skin — summed while it burns and judged once,
   * as it burns out (`body.ts`). */
  heat: number;
};

/** ONE INJURY: the part, which, its AIS rank, and the run clock it came at
 * (the engine's own, `GameState.t`) — and the ENERGY that did it, over the
 * energy of the injury's even chance (`body.ts`' `energyOver`; 1 when left
 * out), raised by every harder blow on the part after it: what grades a
 * break simple, wedge or shattered (`fracturesOf`). */
export type Injury = { part: BodyPart; kind: InjuryKind; ais: number; t: number; energy?: number };

/** WHAT A BLOW CAME FROM: a landing on the skis, the body on the snow, a
 * trunk, another skier, a crashed helicopter's seat. */
export type ImpactSource = "landing" | "snow" | "tree" | "skier" | "heli";

/** ONE BLOW on the g meter: its peak, g, the part that took it, what it
 * came from, how long ago, s, and its number (`BodyState.blows`); whether
 * it came with a FALL — he went down, or the skier he hit did — which is
 * the only blow the HUD shows; and, for a shoulder into another skier,
 * which (`rival` −1 for an amateur of the crowd, `amateur` −1 for a
 * rival). */
export type Impact = {
  g: number;
  part: BodyPart;
  source: ImpactSource;
  t: number;
  id: number;
  fall: boolean;
  rival: number;
  amateur: number;
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
export type TrickKind =
  "air" | "backflip" | "frontflip" | "spin" | "half" | "twist" | "landing" | TrickPose;

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
export type TrickState = PressState & {
  /** Points banked this run. */
  score: number;
  /** EVERY JIB RIDDEN this run (`jib.ts`), in the order he left them. */
  jibs: JibRecord[];
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
  /** THE STROKES (`strokes.ts`): which way each input is still across its
   * gate from the last stroke (0 back at trim, ±1 the side it crossed
   * to); on each axis the angle the strokes of this flight have asked for
   * and not yet seen turned, rad, signed the way they went (tips up and
   * clockwise from above positive) — 0 when nothing is owed — and how far
   * the body has turned toward it since. */
  flipCrossed: number;
  spinCrossed: number;
  flipGoal: number;
  spinGoal: number;
  flipDone: number;
  spinDone: number;
  /** Whether the lean and the edge are still held across their gates from
   * a stroke they bought — the throw's, not the air control's, until let
   * go (`strokes.ts`'s `poseInput`). */
  flipHeld: boolean;
  spinHeld: boolean;
  /** Whether this flight was LAUNCHED ON PURPOSE — off a kicker's ramp, or
   * the jump popped just before the snow was left. On a free ride only
   * such a flight takes a stroke — the edge steered across a knee the
   * skier never meant to leave the snow over is his steering, never a 180;
   * on a tricks run every flight does. */
  meant: boolean;
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
  /** EVERY FLIGHT OF THE RUN, as it ended (`tricks.ts`): what a judge reads
   * (`judge.ts`) — the turns, the grabs, the air, how it came down. The
   * flight under way is kept in `fromY`, `peak` and `switchIn`: the height
   * it left the snow at and the highest it has been since, m, and whether
   * it left the snow riding switch. */
  flights: FlightRecord[];
  fromY: number;
  peak: number;
  switchIn: boolean;
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
  /** The seconds a run has been charged for slalom gates skied past
   * (R28, `course.missPenalty` each) — already on its clock. */
  penalty: number;
  /** How far the skier has skied, m of plan distance — a reset's jump not
   * counted. The free ride's odometer; a race keeps it too. */
  distance: number;
  /** THE RUNS A FREE RIDE HAS SKIED (`skied.ts`), by id — the ski area's
   * runs (R27), or the map's own piste off one — the one skied last LAST.
   * Where its reset and its restart stand the skier; a race keeps it empty. */
  skied: string[];
  /** WHERE A FREE RIDE LAST HAD ITS SKIS ON A RUN (`skied.ts`): the run and
   * the plan point, noted with `skied` — so once he leaves the runs it is
   * where he left them, and a reset off every run stands him back there.
   * Forgotten whenever something other than his skis moves him (a lift, the
   * helicopter, the snowmobile, a staged moment); null until noted, and on a
   * race. */
  lastOnRun: RunMark | null;
  /** OUT OF THE RACE under the strict gates (R31): disqualified or did not
   * finish, why, and at which gate — the run over (`finished` with it) and
   * no time to rank. Null on every run that is still in it or home. */
  out: RunOut | null;
  /** THE SPEED TRAP (R32, `speed-trap.ts`): his speed through it, m/s —
   * null until he has been through, and on a course with none. */
  trap: number | null;
  /** ...and the run clock there, s — null until. */
  trapAt: number | null;
};

/** How a racer goes out under the strict gates (R31): DISQUALIFIED for a
 * gate MISSED, a pole STRADDLED or a START outside the window — or DID NOT
 * FINISH, stopped by a FALL or caught in the A-NETS beside a downhill
 * (R32). `gate` is the checkpoint it happened at. */
/** A point on a run of the ski area (R27) — the map's own piste off one —
 * by the run's id and the plan point (`Progress.lastOnRun`). */
export type RunMark = { id: string; x: number; z: number };

export type RunOut = {
  status: "dsq" | "dnf";
  why: "missed" | "straddle" | "start" | "fall" | "net" | "contact";
  gate: number;
};

/** ANOTHER SKIER ON THE SAME SNOW (`rivals.ts`): a whole run of its own
 * over the player's very level, rules and stream. `pace` is the tuck its
 * bot is allowed, dealt once at the start line; `react` how long after GO
 * he stays in the gate, s (`RACE.reactBand`); `lane` the line it holds
 * down the piste, m right of the centreline — its own slot's; `id` its
 * slot less one. */
export type Rival = {
  id: number;
  run: GameState;
  pace: number;
  /** How much this rival can take before he goes down, 0..1 — his skier's
   * `resilience`, dealt at the start line. */
  resilience: number;
  react: number;
  lane: number;
};

/** A skier carried along a WIND TUNNEL (`wind-tunnel.ts`): which (its
 * place among the resort's tunnels, and its id), where along it he is —
 * the arc, m; how far right of its line, m; the way it blows there, rad —
 * and the station his line was last read from. */
export type TunnelRide = {
  index: number;
  id: string;
  s: number;
  lateral: number;
  heading: number;
  seg: number;
};

/** A skier on a LIFT (`lift-ride.ts`). `board`: being taken from where he
 * rode into its load zone (`from`) to where it carries him off; `ride`:
 * carried, his grip `u` m of plan up the line at `speed` m/s, his chair or
 * cabin swung `swing` rad about the rope (its foot toward the top
 * positive) at `swingRate` rad/s — and stood off at the top, he is the
 * lift's no more. `t` is seconds in the phase; `tower` the next of its
 * supports he has still to pass over. */
export type LiftRide = {
  index: number;
  id: string;
  kind: "gondola" | "chair" | "drag";
  phase: "board" | "ride";
  u: number;
  speed: number;
  swing: number;
  swingRate: number;
  t: number;
  tower: number;
  /** Where he came into the zone from (`board`), or where the carrier
   * took him from the snow (`ride`; `y` NaN for a ride not boarded). */
  from: { x: number; y: number; z: number; heading: number };
  /** Taken from the BOARDING RING (`boardingRing`): the length of the way
   * up the queue's lane to the carrier, m — he is glided along it. */
  walk?: number;
};

export type GameEvent =
  /** ONE LIGHT: `left` whole seconds still to run (3, 2, 1). */
  | { kind: "count"; t: number; left: number }
  /** The lights are out and the clock runs. */
  | { kind: "go"; t: number }
  /** The skier has been off the snow long enough to count as air
   * (`air.counts`); `vy` is the climb he left with, m/s. */
  | { kind: "air"; t: number; vy: number; speed: number }
  /** The skier sprang off his legs (`TUNING.jump`): the pop, m/s off the
   * snow, and how long it was loaded, s. */
  | { kind: "jump"; t: number; pop: number; held: number }
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
      /** The load it put on him, g (`landingLoad`), and how far off true the
       * skis came down, as a share of what that load forgives — past 1 he
       * does not ride it away (`crash.ts`). */
      g: number;
      off: number;
    }
  /** A trunk met at `speed` m/s closing. */
  | { kind: "hit"; t: number; speed: number; x: number; z: number; post?: true }
  /** A SAVE (`crash.ts`): something that nearly threw him, ridden out —
   * which, and how near it came, 0..1. */
  | { kind: "save"; t: number; save: SaveKind; size: number }
  /** THE SKIER THROWN: why, how fast he was going, and where. */
  | { kind: "wipeout"; t: number; cause: CrashCause; speed: number; x: number; z: number }
  /** The skier is bogged in deep powder (`trench.ts`): work out or reset. */
  | { kind: "stuck"; t: number }
  /** A ski or the legs have taken a blow worth saying (`damage.ts`):
   * which, and how bad it now is, 0..1. */
  | { kind: "damage"; t: number; part: DamagePart; level: number }
  /** AN INJURY TAKEN (`body.ts`): the part, which, its AIS rank. */
  | { kind: "injury"; t: number; part: BodyPart; injury: InjuryKind; ais: number }
  /** Another skier — the player's own contact with rival `rival`, or (with
   * `rival` −1) with amateur `amateur` of the crowd (`crowd.ts`). */
  | { kind: "bump"; t: number; rival: number; speed: number; amateur?: number }
  /** A gate taken: its index, the run it was taken on (always 0), and the
   * clock. */
  | { kind: "checkpoint"; t: number; index: number; lap: number; split: number }
  /** A gate skied past without being taken. */
  | { kind: "missed"; t: number; index: number; penalty?: number }
  /** The run finished: `lap` is how many are done (1), `time` the run's
   * own. Fired beside `finish` at the finish line. */
  | { kind: "lap"; t: number; lap: number; time: number }
  /** The finish: the whole run's `time`, and the `place` it earned. */
  | { kind: "finish"; t: number; time: number; place: number }
  /** OUT OF THE RACE (R31): disqualified or did not finish — the run over. */
  | { kind: "out"; t: number; out: RunOut }
  /** THROUGH THE SPEED TRAP (R32): his speed there, m/s. */
  | { kind: "trap"; t: number; speed: number }
  /** INTO THE A-NETS beside a downhill (R32, `nets.ts`): how hard he drove
   * into them, m/s, and where. */
  | { kind: "net"; t: number; speed: number; x: number; z: number }
  /** A FLEX POLE KNOCKED (`gate-poles.ts`): the gate it belongs to, and
   * how hard he drove into it, m/s. */
  | { kind: "pole"; t: number; gate: number; speed: number }
  | { kind: "stake"; t: number; speed: number; broke: boolean; x: number; z: number }
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
  | { kind: "bail"; t: number; lost: number; cause: BailCause }
  /** Taken into a WIND TUNNEL (R30, `wind-tunnel.ts`) by its id, or let go
   * of it. */
  | { kind: "tunnel"; t: number; id: string; phase: "in" | "out" }
  /** A JAM's hit over (`jam.ts`): its number from 1, and the skier stood
   * back on the start platform for the next. */
  | { kind: "jam"; t: number; hit: number; fell: boolean }
  /** ON A JIB (`jib.ts`): onto a rail or a box by its id, or off it —
   * `whole` when he rode it to its end. */
  | {
      kind: "jib";
      t: number;
      id: string;
      jib: "rail" | "box";
      phase: "on" | "off";
      whole: boolean;
    }
  /** ON A LIFT (`lift-ride.ts`) by its id: taken into its load zone, his
   * carrier run over a tower's sheaves, or stood off it at the top. */
  | {
      kind: "lift";
      t: number;
      id: string;
      lift: "gondola" | "chair" | "drag";
      phase: "board" | "tower" | "off";
    }
  /** THE HELICOPTER (`heli.ts`): the skier taken onto its skid, lifted off,
   * set down, dropped off it, the pilot home on the pad, the machine
   * crashed (where it burns), or the ride started again from the pad. */
  | {
      kind: "heli";
      t: number;
      phase: HeliPhaseEvent;
      x: number;
      y: number;
      z: number;
      /** How hard: the closing speed into the snow or a crown, m/s (a
       * crash), the helicopter's speed (a drop), 0 otherwise. */
      speed: number;
    }
  | SledEvent
  | import("./para-state.ts").ParaEvent;

/** WHAT AN AMATEUR IS DOING (`crowd.ts`): skiing his line, stopped on the
 * piste, down in the snow after a fall, in the air off a kicker, or up a
 * lift between runs — off the snow and not drawn. */
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
   * 1 right); the arms' stroke at a crawl, rad of its cycle, and how hard
   * he is working them, 0..1. */
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
  /** HIS TURNS as his body reads them, for the picture to time his pole
   * plants on: the side of the one he is in (−1 left, 1 right, 0 none
   * yet), how long he has been in it, s, and how long the one before it
   * held, s. */
  turnSide: number;
  turnT: number;
  turnHeld: number;
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
};

/** A RUN'S FLEX POLES (`gate-poles.ts`), one entry a pole, in the order
 * `polePlan` lists them: how far over it lies, rad (negative past upright,
 * swinging back), how fast it is turning, rad/s, and the plan direction its
 * top lies toward. */
export type GamePoles = {
  tilt: Float32Array;
  spin: Float32Array;
  dirX: Float32Array;
  dirZ: Float32Array;
};

/** One racer of an interval start's field (`field.ts`): his slot (as a
 * rival's id), the skis he was on, this run's time — null when he went
 * out — and how, the clock at every gate, the time he carried in from the
 * first run (0 on the first), and his speed through a downhill's trap. */
export type FieldRun = {
  id: number;
  skis: SkiId;
  time: number | null;
  out: RunOut | null;
  splits: number[];
  before: number;
  /** His speed through the speed trap (R32), m/s — null where the course
   * has none or he went out above it. */
  trap: number | null;
};

/** AN INTERVAL START'S FIELD: which run of the race this is, every racer
 * of it in start order, the time the PLAYER carries in from the first run
 * (0 on the first), and where he starts in that order — the racers before
 * `slot` are down when he goes, the rest come down once he is home. */
export type Field = {
  run: 1 | 2;
  runs: FieldRun[];
  before: number;
  slot: number;
  /** A downhill's TRAINING run (R32): the field's training times, counted
   * for nothing. */
  training: boolean;
};

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
   * run — and on an interval start, whose field has already skied. */
  rivals: Rival[];
  /** THE FIELD OF AN INTERVAL START (`field.ts`): the start list skied
   * before the player, one at a time, and what each one did — on a run
   * whose rules start that way (the slalom); absent everywhere else. */
  field?: Field;
  /** A SKI-CROSS HEAT (R35): its round and four racers, the player `null`. */
  cross?: CrossHeat;
  /** The ski cross so far, carried for the app; never read by a step. */
  bracket?: Bracket;
  /** A BIG AIR CONTEST so far (R37, `big-air-contest.ts`), before this
   * run's jump — carried for the judges and the app; never read by a
   * step. */
  bigAir?: BigAirContest;
  /** A SLOPESTYLE CONTEST so far (R39, `slopestyle-contest.ts`), carried
   * between its runs as big air's is. */
  slopestyle?: SlopeContest;
  /** A KNUCKLE HUCK'S JAM so far (R38, `jam.ts`): the hits ridden, and
   * where the one under way began — the run's own, stepped with it. */
  jam?: JamState;
  /** THE FLEX POLES of a slalom's gates (`gate-poles.ts`), as this run has
   * knocked them — on a map with pole gates; absent everywhere else. */
  gatePoles?: GamePoles;
  /** THE EDGE STAKES (`edge-stakes.ts`) as this run has knocked them —
   * from the first one touched; absent until then. */
  stakes?: StakeState;
  /** THE CROWD (`crowd.ts`): the amateurs out on the ski area — on a run
   * whose rules ask for one (the free ride); absent everywhere else. */
  crowd?: CrowdState;
  /** THE HELICOPTER (`heli.ts`): on a run whose rules carry one (the free
   * ride); absent everywhere else. */
  heli?: HeliState;
  /** THE SNOWMOBILE (`sled.ts`): on a run whose rules carry one (the free
   * ride); absent everywhere else. */
  sled?: SledState;
  /** THE PARAMOTOR (`para.ts`): on a free ride begun on it, else absent. */
  para?: import("./para-state.ts").ParaState;
  /** THE SCORE (`tricks.ts`): kept on every run — the sim reads it — and
   * worked for (`strokes.ts`) only on one whose rules count tricks. */
  tricks: TrickState;
  /** Seconds of the lights still to run; 0 once they are out. */
  countdown: number;
  phase: GamePhase;
  /** This step's events, cleared at the top of each step. */
  events: GameEvent[];
};
