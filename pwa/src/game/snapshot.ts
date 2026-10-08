// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS, taken off the state about twelve times a second. The
// canvas is the sixty-frame surface; the HUD is not, and a readout that
// re-rendered every frame would spend more on the DOM than on the snow. So
// the loop takes THIS every ~80 ms and the HUD draws from it. DOM-free — a
// snapshot is numbers, and the same numbers a lab could print.
//
// Nothing in here decides anything: the speed is the engine's `speed`, the
// edge is the engine's own edge against the pair's full edge, the gate
// count is the progress the engine keeps, the place is `racePlace` and the
// standings are `fieldOrder` — on a SLALOM or a DOWNHILL the board of the
// field skied before him (`slalom-board.ts`), never `state.rivals`, which
// an interval start leaves empty. A number that decided an outcome would be a rule in the
// shell (§23.2), and there are none.

import { afterskiOf, type HudAfterski } from "./afterski-hud.ts";
import {
  airflowAt,
  bearingToNext,
  fieldOrder,
  gradeOf,
  racePlace,
  regionOf,
  DOWNHILL,
  SLALOM,
  SUPER_G,
  GIANT_SLALOM,
  SPEED_SKI,
  SLED,
  PARA,
  helipadOf,
  heliWithin,
  mayGetUp,
  paraRigged,
  balloonAboard,
  sledWithin,
  groomerWithin,
  trenched,
  type GameState,
  type Level,
  type PisteGrade,
  type RegionId,
  type Airflow,
  type AirRider,
  type Progress,
  type RunOut,
  edgeMostOf,
  techniqueOf,
  holdsHim,
  type DeathCause,
} from "@engine";
import { diedOf } from "./hud-wreck.ts";

import { bodyTile, type BodyTile } from "./body-tile.ts";
import { SCREEN_TO_ENGINE } from "./input-model.ts";
import { buildMinimap, type HudMinimap } from "./minimap-view.ts";
import { splitGap, type RunLedger } from "./records.ts";
import { courseName } from "./run-names.ts";
import { trapOf, type TrapReading } from "./downhill-run.ts";
import { TIMING_HOLD, boardOf, timingSplit } from "./slalom-board.ts";
import { secondRunOf, type SecondRun } from "./slalom-heat.ts";
import { skyLookAt } from "./sky.ts";
import { crossOf, type CrossHud } from "./ski-cross-run.ts";
import { bigAirOf, type BigAirHud } from "./big-air-run.ts";
import { slopestyleOf, type SlopestyleHud } from "./slopestyle-run.ts";
import { halfpipeOf, type HalfpipeHud } from "./halfpipe-run.ts";
import { mogulsOf, type MogulsHud } from "./moguls-run.ts";
import { aerialsOf, type AerialsHud } from "./aerials-run.ts";
import { comboTile, type TrickTile } from "./trick-tile.ts";

/** The brake's share past which the edge bar says the skid is on. */
const BRAKE_SHOWN = 0.05;

/** How long GO stays on screen after the lights go out, s of race clock. */
const GO_HOLD = 1;

/** How long the SPLIT chip holds the clock at the last gate, s of run
 * clock — long enough to read it off the corner between two gates, gone
 * before the next so a stale split is never read as a fresh one. */
const SPLIT_HOLD = 6;

/** THE AIR CLOCK'S FLOOR, s: a flight is shown — on the clock, and as the
 * run's best — only once it has lasted longer than this. A hop off a roller
 * is air to the engine (`TUNING.air.counts`) but not a jump worth timing. */
export const AIR_SHOWN = 0.5;

/** One skier on the finish plate's table. */
export type Standing = {
  /** 1-based, in `fieldOrder`'s order — null on the slalom's board for a
   * racer with no time to rank (out of it, on the course, still to come). */
  place: number | null;
  /** Start-line slot, 1-based: the player is 1, the rivals 2… — what a
   * rival is called on the table (`strings.ts`); on the slalom's board the
   * start number. */
  slot: number;
  you: boolean;
  /** The run clock at the finish, or null while still out on the piste. */
  time: number | null;
  /** Gates taken, for a skier still out. */
  taken: number;
  /** THE SLALOM'S BOARD (`slalom-board.ts`) — absent on any other table:
   * the start number; the first run's time on the second run (null on the
   * first); the combined time; the gap to the leader, s; how the racer
   * went out; and whether he has still to come down. */
  bib?: number;
  before?: number | null;
  total?: number | null;
  gap?: number | null;
  out?: RunOut | null;
  waiting?: boolean;
};

/** AN INTERVAL START'S RACE as the HUD reads it — a slalom's, a giant
 * slalom's, a downhill's, a super-G's or a speed race's — null on any other
 * run. */
export type RaceHud = {
  /** Which discipline, and — on a downhill — whether this is its TRAINING
   * run (`downhill-run.ts`), which counts for nothing. */
  discipline: "slalom" | "giantSlalom" | "downhill" | "superG" | "speedSki" | "skiCross";
  training: boolean;
  /** Which run of how many (R31, R36; a downhill and a super-G are one). */
  run: 1 | 2;
  runs: number;
  /** THE STARTER'S WORD, small at the top while the start clock in the
   * house carries the count: READY through the countdown, GO from then
   * until a moment after the wand opens — null otherwise. */
  word: "ready" | "go" | null;
  /** THE INTERMEDIATE TIME while fresh: the timing point (1, 2 …), the run
   * clock there and the gap to the leader (negative ahead). */
  timing: { point: number; time: number; gap: number | null } | null;
  /** The player's first-run time on the second run, s; 0 on the first. */
  before: number;
  /** OUT OF IT (R31): disqualified or did not finish, why and where. */
  out: RunOut | null;
  /** WHAT THE PLATE OFFERS NEXT — a slalom's SECOND RUN, or why not; a
   * downhill's RACE after its training — null on any other plate. */
  second: SecondRun | null;
  /** A SPEED COURSE'S TRAP (R32, R33, `trapOf`): his speed through it and the
   * field's best, km/h, and his place among them — null off a course with
   * one. `trapFresh` while it has just been taken (`TIMING_HOLD`). */
  trap: TrapReading | null;
  trapFresh: boolean;
  /** A SPEED TRACK'S TIMING ZONE (R34): its length along the snow, m —
   * what every time the race keeps is read against as a speed
   * (`speed-ski-run.ts`) — null on every other race. */
  zone: number | null;
};

export type HudSnapshot = {
  speedKmh: number;
  /** HOW HIGH HE IS over the sea, m (`Mountain.sea`) — null on a map that
   * publishes no mountain. */
  altitude: number | null;
  /** THE EDGE the skis stand on, as a share of the pair's full edge at a
   * standstill, -1..1 — SCREEN-space, so positive is the skis tipped to
   * the player's right. */
  edge: number;
  /** THE TUCK the body is actually in, 0 standing tall … 1 folded — the
   * bar's speed line. */
  tuck: number;
  /** The skid is on (the body's own reading of the brake, after its lag). */
  braking: boolean;
  /** The edge is cut hard (`SkierState.carve`, the back key after the edge). */
  cutting: boolean;
  /** The run clock, s, and whether it has stopped. */
  time: number;
  finished: boolean;
  /** THE LIGHTS: the whole second showing (3, 2, 1) while they hold the
   * field, and 0 once they are out. `go` is the moment after, read off the
   * engine's clock so nothing here keeps time. */
  countdown: number;
  go: boolean;
  /** THE FIELD: where the skier stands, 1-based, and how many are in it. */
  place: number;
  skiers: number;
  /** Gates taken — the start gate the first — and how many the piste has,
   * the finish the last. */
  taken: number;
  gates: number;
  /** THE VERTICAL DROPPED since the start line, m of height. */
  dropped: number;
  /** The run clock at the last gate taken, while it is fresh; null
   * otherwise. */
  split: number | null;
  /** THE GAP to the record at that same crossing, s — negative is ahead —
   * while the split is up and there is a row to be measured against. */
  gap: number | null;
  /** The mode being ridden, and the record standing when the run began
   * (`records.ts`) — what the finish plate bills the result against. */
  mode: RunLedger["mode"];
  best: { time: number; skis: string; at: number } | null;
  /** THE AIR CLOCK, s — the flight so far, and 0 until it has lasted
   * `AIR_SHOWN`: a hop off a bump is not a jump, and a readout that timed
   * it would flicker through every roller. */
  airTime: number;
  /** The flight in progress is the race's longest so far. */
  airBest: boolean;
  /** THE MISSED GATE: where it is as a SCREEN angle, rad clockwise from
   * straight ahead, and how far, m — or null with nothing owed. */
  missed: { angle: number; distance: number } | null;
  seed: number;
  /** WHERE HE IS on the map, to the metre (the engine's x across and z down
   * the map): beside the seed, so a picture names the spot on its mountain
   * as well as the mountain — the same frame `make level` and the labs
   * read. */
  at: { x: number; z: number };
  /** The COURSE raced, by its runs' names (`courseName`) — null off a ski
   * area and on a free ride, which races none. */
  course?: string | null;
  /** A FREE RIDE: no field, no gates owed — the HUD shows the run's best
   * air and the distance skied in their place. */
  free: boolean;
  /** The run's longest flight so far, s — 0 until one has lasted
   * `AIR_SHOWN`. */
  bestAir: number;
  /** How far has been skied, m. */
  distance: number;
  /** THE FINISH: the player's own result once he is through the finish,
   * and the whole field's table under it — live, because the field is
   * still coming down behind him. `time` carries the slalom gates' charge
   * (`penalty`, s) already. Null until then — and on a run that went OUT
   * (`slalom.out`), which has no time and no place, while the table still
   * comes up under its plate. */
  result: { place: number; time: number; penalty: number } | null;
  standings: Standing[] | null;
  /** AN INTERVAL START'S RACE — a slalom's or a downhill's — its own
   * readouts (`RaceHud`), null on any other run. */
  race: RaceHud | null;
  /** A SKI CROSS's readouts (`ski-cross-run.ts`) — its round, the start
   * gate's commands, the heat's order and what comes next — null on any
   * other run. */
  cross: CrossHud | null;
  /** A BIG AIR jump's readouts (`big-air-run.ts`) — its phase and number,
   * the panel's score once judged, the board and what comes next — null on
   * any other run. */
  bigAir: BigAirHud | null;
  /** A SLOPESTYLE run (`slopestyle-run.ts`) — its phase and run, the
   * section he is in, and once judged the sheet, the board and what comes
   * next; null on any other run. */
  slopestyle: SlopestyleHud | null;
  /** A HALFPIPE run (`halfpipe-run.ts`) — its phase and run, the hits so
   * far, and once judged the sheet, the board and what comes next; null
   * on any other run. */
  halfpipe: HalfpipeHud | null;
  /** A MOGULS run (`moguls-run.ts`) — its phase, the pace time, the airs
   * so far, and once scored the sheet, the board and what comes next;
   * null on any other run. */
  moguls: MogulsHud | null;
  /** An AERIALS jump (`aerials-run.ts`) — its phase, the jump declared and
   * the flips thrown, and once it is over the formal score and the board. */
  aerials: AerialsHud | null;
  /** THE MINIMAP: the plate's pose and every mark on it
   * (`minimap-view.ts`). */
  minimap: HudMinimap;
  /** BOGGED: the skier is sunk to the knees in powder (`trench.ts`) and
   * must pole out — the standing hint, up while he is. */
  stuck: boolean;
  /** DOWN: the skier is off his skis (`crash.ts`'s `Thrown`). */
  down: boolean;
  /** ...and may GET UP: down past `crash.getUp`, when a press of his own
   * stands him up (`mayGetUp`) — the reset lit and the hint up from then,
   * the first seconds left to the fall and the body's plate. */
  getUp: boolean;
  /** THE DAMAGE INSTRUMENT: each part 0 sound … 1 wrecked, or null on a
   * run without damage (`GameState.damage`). */
  damage: { skiLeft: number; skiRight: number; legs: number } | null;
  /** THE BODY (`body-tile.ts`): every part's paint, the word for the whole
   * of him, the worst injuries, the run's hardest blow — and the blow on
   * the g meter while it holds. */
  body: BodyTile;
  /** HIS DEATH on an injuries run (`hud-wreck.ts`): how long ago, s, and
   * what of — null alive, or on a run without the wounds that kill. */
  died: { since: number; cause: DeathCause } | null;
  /** THE SCORE over the nose (`trick-tile.ts`), on a tricks run; null on
   * any other. */
  tricks: TrickTile | null;
  /** THE PISTE'S GRADE (R23): the colour on its signs, beside the gates. */
  grade: PisteGrade;
  /** THE COUNTRY the mountain is raised in (R21) — with the seed and the
   * grade, what the free ride's start card needs to raise it again. */
  region: RegionId;
  /** THE WIND METER beside the speed (`windOf`). */
  wind: HudWind;
  /** THE HELICOPTER (`heliOf`): its readouts while he rides it, the way to
   * it while it waits for him, or null. */
  heli: HudHeli | null;
  /** THE SNOWMOBILE (`sledOf`): its engine while he rides it, the way to it
   * while it waits for him, or null. */
  sled: HudSled | null;
  /** THE PISTE MACHINE (`groomerOf`): driven, or the nearest's way while
   * he is near one, or null. */
  groomer: HudGroomer | null;
  /** THE PARAMOTOR (`paraOf`): its instruments while the rig is on him, or
   * null. */
  para: HudPara | null;
  /** THE AFTERSKI (`afterski-hud.ts`): the way to a lodge, the room, the
   * skis to fetch after a buzzed fall — or null. */
  afterski: HudAfterski | null;
  /** THE BUZZ, 0 sober to 1 (`SkierState.buzz`): the meter shows over 0. */
  buzz: number;
  /** HOW FAR THE CHROME IS DIPPED, 0..1 — the HUD's NIGHT DRESSING, the
   * sibling games' own: nothing is DRAWN from it here. It goes on the HUD's
   * root as `--hud-dark`, where every colour of the chrome is a ramp along
   * it (styles.css), and the minimap darkens its ground by it.
   *
   * IT IS THE LAMP SWITCH (`SkyLook.lamps`): the dark that turns on the
   * floodlights, the arena's floods and every skier's headlamp, never a
   * threshold of the HUD's own — an instrument panel dips off the lamp
   * switch, not a light meter, and a second opinion about when it is dark
   * would drift from the light the skier is riding by. The lamps come up
   * smoothly through the dusk (and partway in a storm's gloom), so the
   * chrome comes down with them rather than on one frame. */
  dark: number;
};

/** A PISTE MACHINE as the HUD reads it: driven — its speed, km/h (negative
 * in reverse), and whether its tiller is down — or the nearest `away` m from
 * him, `near` when he stands where the machine press takes him into its
 * cab (`groomerWithin`). */
export type HudGroomer =
  | { kind: "driven"; kmh: number; tiller: boolean }
  | { kind: "waiting"; away: number; near: boolean };

/** How near a piste machine the HUD names it to him, m. */
const GROOMER_CALL = 45;

/** The piste machines' readout for the player at this step. */
export function groomerOf(state: GameState): HudGroomer | null {
  const gs = state.groomers;
  if (!gs || gs.length === 0) return null;
  const driven = gs.find((g) => g.rider);
  if (driven) return { kind: "driven", kmh: driven.speed * 3.6, tiller: driven.tiller };
  const c = state.skier;
  if (c.thrown || c.lift || state.heli?.rider || state.sled?.rider || paraRigged(state))
    return null;
  let away = Infinity;
  for (const g of gs) away = Math.min(away, Math.hypot(g.x - c.x, g.z - c.z));
  return away < GROOMER_CALL
    ? { kind: "waiting", away, near: groomerWithin(state) !== null }
    : null;
}

/** THE PARAMOTOR as the HUD reads it while the rig is on him: `ready` on
 * the summit, the wing held up; else flown — in the air or skiing under it
 * on the snow — with his height over the snow, m, his climb, m/s, the air
 * through the wing, m/s, the throttle and the rpm's share of full, whether
 * the wing is stalled, the wind at it, m/s, how rough the air is (the
 * eddies' sigma, m/s), and how much of it is folded and on which side (−1
 * left, 1 right, 0 its leading edge). */
export type HudPara = {
  kind: "ready" | "flying" | "riding";
  height: number;
  climb: number;
  air: number;
  throttle: number;
  rev: number;
  stalled: boolean;
  wind: number;
  rough: number;
  fold: number;
  foldSide: number;
};

/** The paramotor's readout for the player at this step. */
export function paraOf(state: GameState): HudPara | null {
  const p = state.para;
  if (!p || !paraRigged(state) || state.skier.thrown) return null;
  return {
    kind: p.mode === "ready" ? "ready" : p.flying ? "flying" : "riding",
    height: p.agl,
    climb: p.climb,
    air: p.airspeed,
    throttle: p.controls.throttle,
    rev: p.rpm / PARA.engine.full,
    stalled: p.stalled,
    wind: p.wind,
    rough: p.rough,
    fold: p.fold,
    foldSide: p.foldSide,
  };
}

/** THE SNOWMOBILE as the HUD reads it: ridden — the engine's rpm as a share
 * of its limiter, the thumb, and whether the belt is spinning in the snow —
 * or waiting `away` m from him, `near` when he stands where the machine
 * press takes him on (`sledWithin`). */
export type HudSled =
  | { kind: "ridden"; rpm: number; rev: number; throttle: number; spin: boolean }
  | { kind: "waiting"; away: number; near: boolean };

/** How near the waiting snowmobile the HUD points him at it, m. */
const SLED_CALL = 60;

/** The snowmobile's readout for the player at this step. */
export function sledOf(state: GameState): HudSled | null {
  const s = state.sled;
  if (!s) return null;
  if (s.rider) {
    return {
      kind: "ridden",
      rpm: s.rpm,
      rev: Math.min(1, s.rpm / SLED.maxRpm),
      throttle: s.controls.throttle,
      spin: s.slip > 4,
    };
  }
  const c = state.skier;
  const away = Math.hypot(s.x - c.x, s.z - c.z);
  return away < SLED_CALL && c.thrown === null && !state.heli?.rider && !c.lift
    ? { kind: "waiting", away, near: sledWithin(state) }
    : null;
}

/** THE HELICOPTER as the HUD reads it: flown — how high its skids are over
 * the snow (the fall a jump off them is), m, its ALTITUDE over the pad on
 * the valley floor it took off from, m, and its climb, m/s — or
 * waiting on its pad `pad` m from him, `near` when he stands where the
 * machine press sits him on its skid (`heliWithin`). */
export type HudHeli =
  | {
      kind: "flown";
      height: number;
      altitude: number;
      climb: number;
      landed: boolean;
      /** The collective lever, 0..1, and the disc's attitude as the
       * horizon shows it: nose-up pitch and the bank as SCREEN rad (right
       * side down positive as the player sees it), rad. */
      collective: number;
      pitch: number;
      bank: number;
    }
  | { kind: "waiting"; pad: number; near: boolean };

/** How near the waiting helicopter the HUD points him at it, m. */
const HELI_CALL = 120;

/** The snow on the helicopter's pad, m — what its altitude is read over. */
function padHeight(state: GameState): number {
  const pad = helipadOf(state.level);
  return state.level.groundAt(pad.x, pad.z);
}

/** The helicopter's readout for the player at this step. */
export function heliOf(state: GameState): HudHeli | null {
  const h = state.heli;
  if (!h) return null;
  if (h.rider) {
    return {
      kind: "flown",
      height: Math.max(0, h.y - state.level.groundAt(h.x, h.z)),
      altitude: h.y - padHeight(state),
      climb: h.vy,
      landed: h.grounded,
      collective: h.controls.collective,
      pitch: h.pitch,
      bank: h.roll * SCREEN_TO_ENGINE,
    };
  }
  const c = state.skier;
  const pad = Math.hypot(h.x - c.x, h.z - c.z);
  // Riding the snowmobile, the helicopter does not call him.
  return h.mode === "parked" && pad < HELI_CALL && c.thrown === null && !state.sled?.rider
    ? { kind: "waiting", pad, near: heliWithin(state) }
    : null;
}

/** THE WIND as the meter reads it: the air the skier FEELS — the air where
 * he is less his own velocity (`airflowAt`), what he hears and what drags
 * on him — and that air itself, the weather's wind down at his body and
 * sheltered by the woods round him, each as a speed and the way it MOVES as
 * a SCREEN angle (rad clockwise from straight ahead, so a wind in his face
 * points down, at the player). */
export type HudWind = {
  /** The apparent wind, km/h. */
  feltKmh: number;
  feltAngle: number;
  /** The air where he is, standing still in it, km/h. */
  airKmh: number;
  airAngle: number;
};

const FLOW: Airflow = { x: 0, y: 0, z: 0, speed: 0, head: 0, across: 0 };
const STILL: AirRider = { x: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0 };

/** The way a flow moves past the skier as a screen angle, through the one
 * flip the input model owns. */
function flowAngle(f: Airflow): number {
  return Math.atan2(f.across * SCREEN_TO_ENGINE, -f.head);
}

/** The wind meter's reading for the player at this step. */
export function windOf(state: GameState): HudWind {
  const c = state.skier;
  STILL.x = c.x;
  STILL.z = c.z;
  STILL.heading = c.heading;
  airflowAt(state.level, state.t, STILL, FLOW);
  const airKmh = FLOW.speed * 3.6;
  const airAngle = flowAngle(FLOW);
  airflowAt(state.level, state.t, c, FLOW);
  return { feltKmh: FLOW.speed * 3.6, feltAngle: flowAngle(FLOW), airKmh, airAngle };
}

/** Gates taken so far, the start gate counted as the first, and never
 * more than the piste has: before the start gate none; through the finish,
 * all of them; out of the race (R31), the gates he had taken. */
export function gatesTaken(p: Progress, gates: number): number {
  if (p.finished && !p.out) return gates;
  if (!p.started) return 0;
  // Out, he skis on down and past gates that no longer count.
  if (p.out) return Math.min(gates, p.passed, p.out.gate);
  return Math.min(gates, p.passed);
}

/** THE TABLE: every skier in `fieldOrder`'s order — on an interval start,
 * the board of the field skied before him (`boardOf`). */
export function standingsOf(state: GameState): Standing[] {
  if (state.field) return boardOf(state);
  const gates = state.level.checkpoints.length;
  return fieldOrder(state).map((id, i) => {
    const rival = id === null ? null : state.rivals.find((r) => r.id === id);
    const run = rival ? rival.run : state;
    const p = run.progress;
    return {
      place: i + 1,
      slot: id === null ? 1 : id + 2,
      you: id === null,
      time: p.finished ? p.time : null,
      taken: gatesTaken(p, gates),
    };
  });
}

/** The vertical dropped since the start line, m: the snow under the start
 * line less the snow under the skier — never negative, so a hike back up to
 * a missed gate reads as nothing dropped rather than a climb. */
export function droppedOf(state: GameState): number {
  const { level, skier } = state;
  const top = level.groundAt(level.spawn.x, level.spawn.z);
  return Math.max(0, top - level.groundAt(skier.x, skier.z));
}

/** The colour each map is signed with, read once a map: on a map from
 * before the grades `gradeOf` measures the piste, which is a walk down it
 * the snapshot need not take every frame. */
const GRADES = new WeakMap<Level, PisteGrade>();
function gradeOfLevel(level: Level): PisteGrade {
  let grade = GRADES.get(level);
  if (grade === undefined) {
    grade = gradeOf(level);
    GRADES.set(level, grade);
  }
  return grade;
}

/** A run with no book behind it: a slalom, measured against nothing. */
const NO_LEDGER: RunLedger = { mode: "slalom", standing: null };

/** The race's readouts at this step, or null off an interval start. */
export function raceOf(state: GameState): RaceHud | null {
  const f = state.field;
  if (!f) return null;
  const p = state.progress;
  const discipline: RaceHud["discipline"] = state.level.downhill
    ? "downhill"
    : state.level.superG
      ? "superG"
      : state.level.giantSlalom
        ? "giantSlalom"
        : state.level.speedSki
          ? "speedSki"
          : state.level.skiCross
            ? "skiCross"
            : "slalom";
  const word =
    state.phase === "countdown"
      ? "ready"
      : !p.finished && (!p.started || p.time < GO_HOLD)
        ? "go"
        : null;
  return {
    discipline,
    training: f.training,
    run: f.run,
    runs:
      discipline === "downhill"
        ? DOWNHILL.runs
        : discipline === "superG"
          ? SUPER_G.runs
          : discipline === "giantSlalom"
            ? GIANT_SLALOM.runs
            : discipline === "speedSki"
              ? SPEED_SKI.runs
              : discipline === "skiCross"
                ? 1
                : SLALOM.runs,
    word,
    timing: timingSplit(state),
    before: f.before,
    out: p.out,
    second: secondRunOf(state),
    trap: trapOf(state),
    trapFresh: p.trapAt !== null && p.time - p.trapAt < TIMING_HOLD && !p.finished,
    zone: state.level.speedSki?.zone.length ?? null,
  };
}

export function takeSnapshot(state: GameState, ledger: RunLedger = NO_LEDGER): HudSnapshot {
  const c = state.skier;
  const p = state.progress;
  const n = state.level.checkpoints.length;
  const last = p.lastCheckpoint;
  const lastAt = last >= 0 ? p.splits[last] : Number.NaN;
  // Hung under a paramotor's wing he is flying, not jumping.
  const airTime = c.airborne && c.airTime > AIR_SHOWN && !paraRigged(state) ? c.airTime : 0;
  // A slalom is timed at its intermediates (`slalom.timing`), never gate by
  // gate — its gates come a second apart.
  const split =
    Number.isFinite(lastAt) && p.time - lastAt < SPLIT_HOLD && !p.finished && !state.field
      ? lastAt
      : null;
  const standing = ledger.standing;
  const owed = p.missed !== null ? bearingToNext(state) : null;
  const race = raceOf(state);
  // THE BIG LIGHTS are the line start's: a race's count out of the house is
  // the start clock's, and its word the small one at the top — and a ski
  // cross's heat has the start gate's commands and no count at all.
  const cross = crossOf(state);
  const lights = state.rules.countdown > 0 && !race && !state.cross;
  const mountain = state.level.mountain;
  return {
    speedKmh: c.speed * 3.6,
    altitude: mountain ? c.y - mountain.sea : null,
    // Against the most edge he can use — a slalom racer's past the ski's own.
    edge: (c.edge / edgeMostOf(c.spec, techniqueOf(state.rules))) * SCREEN_TO_ENGINE,
    tuck: c.crouch,
    braking: c.brake > BRAKE_SHOWN,
    cutting: c.carve > BRAKE_SHOWN,
    time: p.time,
    finished: p.finished,
    countdown: lights && state.phase === "countdown" ? Math.ceil(state.countdown) : 0,
    go: lights && state.phase !== "countdown" && p.time < GO_HOLD,
    place: racePlace(state),
    skiers: (state.field?.runs.length ?? state.rivals.length) + 1,
    taken: gatesTaken(p, n),
    gates: n,
    dropped: droppedOf(state),
    split,
    gap: split !== null ? splitGap(standing, p.passed - 1, split) : null,
    mode: ledger.mode,
    best: standing ? { time: standing.value, skis: standing.skis, at: standing.at } : null,
    airTime,
    airBest: airTime > 0 && airTime > p.bestAir,
    missed: owed ? { angle: owed.error * SCREEN_TO_ENGINE, distance: owed.distance } : null,
    seed: state.seed,
    at: { x: Math.round(c.x), z: Math.round(c.z) },
    course:
      state.rules.course && state.level.resort
        ? courseName(state.level, state.level.resort.course)
        : null,
    free: !state.rules.course,
    bestAir: p.bestAir > AIR_SHOWN ? p.bestAir : 0,
    distance: p.distance,
    result:
      p.finished && !p.out ? { place: racePlace(state), time: p.time, penalty: p.penalty } : null,
    standings: p.finished ? standingsOf(state) : null,
    race,
    cross,
    bigAir: bigAirOf(state),
    slopestyle: slopestyleOf(state),
    halfpipe: halfpipeOf(state),
    moguls: mogulsOf(state),
    aerials: aerialsOf(state),
    minimap: buildMinimap(state),
    stuck: trenched(c.trench) && c.thrown === null,
    down: c.thrown !== null,
    // A mortal wound is never got up from (`gore.ts`'s `holdsHim`).
    getUp: c.thrown !== null && mayGetUp(c.thrown) && !holdsHim(state),
    damage: state.damage
      ? {
          skiLeft: c.damage.ski[0],
          skiRight: c.damage.ski[1],
          legs: c.damage.legs,
        }
      : null,
    body: bodyTile(c.body, state.t),
    died: diedLine(state),
    tricks: comboTile(state),
    grade: gradeOfLevel(state.level),
    region: regionOf(state.level).id,
    wind: windOf(state),
    // In a balloon's basket no machine on the snow calls him.
    heli: balloonAboard(state) ? null : heliOf(state),
    sled: balloonAboard(state) ? null : sledOf(state),
    groomer: balloonAboard(state) ? null : groomerOf(state),
    para: paraOf(state),
    afterski: balloonAboard(state) ? null : afterskiOf(state),
    buzz: c.buzz ?? 0,
    dark: Math.round(skyLookAt(state.level, state.t).lamps * 100) / 100,
  };
}

/** His death, as the HUD reads it. */
function diedLine(state: GameState): HudSnapshot["died"] {
  const since = diedOf(state);
  return since === null || !state.gore?.cause ? null : { since, cause: state.gore.cause };
}
