// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BAR, THE TRACKS AND THE TAKE-OFF of a ski jump (R43).
//
// ON THE BAR. The jumper sits on the starting bar of his gate, facing down
// the tracks, while the start official counts him down; after the green
// light he has `RunRules.window` s to leave it (`strict.ts` disqualifies
// him past it), and he leaves on the press — the tuck, or the jump key —
// with a shove off the bar. Leaving the bar is his START (`startStrict`),
// wherever his gate stands on the in-run.
//
// DOWN THE TRACKS AS A WIRE. A jumper's skis run in two grooves cut in ice
// from the gate to the edge; he cannot steer, edge or brake in them, and he
// holds the crouch (`in-run.ts`). The springs and the hull the piste is
// skied on (`suspension.ts`, `chassis.ts`) would scrub and bounce him round
// the transition's 0.7 g as they did up an aerials kicker
// (`aerial-kicker.ts`), so he is carried down the in-run's profile as a
// bead on a wire: the drop, the tracks' friction on his weight and on the
// curve's load, and his crouch's drag in the air where he is (`airAt`) at
// the hill's own density — the hill's rule's numbers
// (`SKI_JUMP_RULE.skier`), so the generator's design gate and the engine's
// in-run are one sum.
//
// THE TAKE-OFF is the jump key, TIMED: the press starts a push of
// `JUMP.takeOff.push` s whose share the edge keeps (`pushShare`) is the
// speed he gains at right angles to the table, and the edge is crossed at
// the fraction of the step it falls in (`course.ts`'s `crossingShare` is
// the precedent). From there the air is the flight's (`jump-flight.ts`).
// Nothing here is random and nothing reads a clock but the run's.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { fieldCoords } from "../mapgen/mogul-field.ts";
import { SKI_JUMP_RULE } from "../mapgen/trick-rules.ts";
import type { MogulField } from "../mapgen/mogul-field.ts";
import type { SkiJumpHill } from "../mapgen/types.ts";
import { airDensity, airKelvin, airPressure, seaAltitude } from "./balloon-air.ts";
import { JUMP } from "./defs/ski-jump-flight.ts";
import { riderOf } from "./defs/riders.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import { startStrict } from "./strict.ts";
import { hillAirAt, hillAirOf, type HillAir } from "./jump-wind.ts";
import type { GameEvent, GameState, SkierInput, SkierState } from "./state.ts";
import type { SkiJumpState } from "./ski-jump-state.ts";

const S = SKI_JUMP_RULE.skier;

/** The step the profile's slope is read over, m of plan. */
const LOOK = 0.05;
/** The span the in-run's curvature is read over, m of plan. */
const BEND = 0.5;

/** The hill's slope at `d` m of plan, rad (down positive) — read BEHIND
 * `d`, so at the edge it is the table's and never the wall's under it. */
export function slopeAt(hill: SkiJumpHill, d: number): number {
  return Math.atan2(hill.yAt(d - LOOK) - hill.yAt(d), LOOK);
}

/** The in-run's curvature at `d`, 1/m — positive where it turns him up. */
function bendAt(hill: SkiJumpHill, d: number): number {
  const a = Math.max(hill.from, d - BEND);
  const b = Math.min(hill.edge - LOOK, d + BEND);
  if (b <= a) return 0;
  const run = (b - a) / Math.cos(slopeAt(hill, d));
  return Math.max(0, (slopeAt(hill, a) - slopeAt(hill, b)) / run);
}

/** The jumper's whole mass, kg. */
export function massOf(c: SkierState): number {
  return c.spec.skierMass + c.spec.gearMass;
}

/** His crouch's drag area, m²: the rule's jumper's, as the body to the ⅔. */
function crouchOf(mass: number): number {
  return S.crouch * Math.pow(mass / S.mass, 2 / 3);
}

/** ONE STEP DOWN THE TRACKS: from `along` (m of plan) at `v` m/s for `dt`
 * s, against a head wind of `head` m/s, at `density` — where he gets to
 * and how fast, and the arc he ran, m. Pure: the engine's step and the
 * jury's gate both ride it. */
export function trackStep(
  hill: SkiJumpHill,
  along: number,
  v: number,
  dt: number,
  density: number,
  mass: number,
  head = 0,
): { along: number; v: number; arc: number } {
  const a = slopeAt(hill, along);
  const kappa = bendAt(hill, along);
  const g = TUNING.g;
  const air = v + head;
  const k = (0.5 * density * crouchOf(mass)) / mass;
  const acc =
    g * Math.sin(a) - S.friction * (g * Math.cos(a) + v * v * kappa) - k * air * Math.abs(air);
  const v1 = Math.max(0, v + acc * dt);
  const arc = 0.5 * (v + v1) * dt;
  return { along: along + arc * Math.cos(a), v: v1, arc };
}

/** THE SPEED OVER THE EDGE off gate `gate` (an index, 0 the lowest) in calm
 * air at `density`, m/s, ridden on the engine's own step. */
export function gateSpeed(
  hill: SkiJumpHill,
  gate: number,
  density: number,
  mass: number = S.mass,
): number {
  const dt = TUNING.dt;
  let along = hill.gates[clamp(gate, 0, hill.gates.length - 1)].x;
  let v: number = JUMP.bar.shove;
  for (let i = 0; i < 100000 && along < hill.edge; i++) {
    const s = trackStep(hill, along, v, dt, density, mass);
    along = s.along;
    v = s.v;
  }
  return v;
}

/** THE JURY'S GATE: the lowest whose jumper reaches the edge at the hill's
 * design speed in calm air (an index), ridden on the engine's own in-run. */
export function juryGate(hill: SkiJumpHill, density: number, mass: number = S.mass): number {
  for (let i = 0; i < hill.gates.length; i++) {
    if (gateSpeed(hill, i, density, mass) >= hill.speed) return i;
  }
  return hill.gates.length - 1;
}

/** The air's density at the hill's edge, kg/m³. */
export function hillDensity(state: Pick<GameState, "level">): number {
  const hill = state.level.skiJump!;
  const alt = seaAltitude(state.level, hill.yAt(hill.edge));
  return airDensity(airPressure(alt), airKelvin(alt));
}

/** The salt a hill's own air is dealt off when no contest deals it. */
const AIR_SALT = 0x51a1e;

/** A JUMP AS IT STANDS BEFORE IT IS JUMPED: on the bar of `gate` (an index;
 * the jury's when left out), in the hill's `air` (the map's own hill's,
 * dealt off its seed, when left out), the record empty. */
export function freshJump(state: GameState, gate?: number, air?: HillAir): SkiJumpState {
  const hill = state.level.skiJump!;
  const density = hillDensity(state);
  const at = clamp(gate ?? juryGate(hill, density, massOf(state.skier)), 0, hill.gates.length - 1);
  const j: SkiJumpState = {
    stage: "bar",
    gate: at,
    density,
    along: hill.gates[at].x,
    across: 0,
    y: 0,
    speed: 0,
    left: hill.gates[at].e,
    va: 0,
    vw: 0,
    vy: 0,
    leftAt: -1,
    pressAt: -1,
    edgeAt: -1,
    jumpHeld: false,
    aoa: 0,
    lay: 0,
    vee: 0,
    roll: 0,
    error: 0,
    prepAt: -1,
    cellAt: -1,
    errSum: 0,
    windSum: 0,
    timeSum: 0,
    air: air ?? hillAirOf(state.level, (state.level.seed ^ AIR_SALT) >>> 0),
    record: {
      gate: hill.gates[at].number,
      inRunSpeed: 0,
      edgeSpeed: 0,
      timing: null,
      share: 0,
      push: 0,
      flightTime: 0,
      peak: 0,
      peakAt: 0,
      wind: 0,
      stations: [],
      measured: 0,
      attitude: 0,
      roll: 0,
      veeAt: -1,
      lost: false,
      distance: 0,
      reach: 0,
      landingSpeed: 0,
      into: 0,
      load: 0,
      landing: null,
      outcome: "pending",
    },
  };
  return j;
}

/** Sit him on the bar of his gate (`freshJump`'s), facing down the tracks. */
export function seatOnBar(state: GameState): void {
  const j = state.jump!;
  placeOnTracks(state, j, 0, JUMP.bar.seat);
}

/** The hill's frame: where `along`/`across` are in the world. */
export function hillFrame(state: GameState): MogulField {
  return state.level.bumps!;
}

/** Stand the skier where the jump has him on the tracks: his centre `h` m
 * over the profile along its normal, his skis down its line, moving at
 * `v` along it. */
function placeOnTracks(state: GameState, j: SkiJumpState, v: number, h: number): void {
  const hill = state.level.skiJump!;
  const f = hillFrame(state);
  const c = state.skier;
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  const a = slopeAt(hill, j.along);
  const sx = f.x + fx * j.along + fz * j.across;
  const sz = f.z + fz * j.along - fx * j.across;
  c.x = sx + fx * Math.sin(a) * h;
  c.z = sz + fz * Math.sin(a) * h;
  c.y = hill.yAt(j.along) + Math.cos(a) * h;
  c.vx = fx * v * Math.cos(a);
  c.vz = fz * v * Math.cos(a);
  c.vy = -v * Math.sin(a);
  c.q = fromEuler(f.heading, -a, 0);
  c.wx = c.wy = c.wz = 0;
  c.edge = 0;
  c.skid = 0;
  c.sideSlip = 0;
  c.carve = 0;
  c.airborne = false;
  for (const contact of c.contacts) contact.touching = false;
  derive(c, state.level);
}

/** The head wind along the hill, m/s (a tail wind negative), and the wind
 * across it to his right, `d` m of distance down the landing hill (0 at
 * the edge and on the in-run) — the staged one, if any, else the hill's
 * air (`jump-wind.ts`) at this moment of its day. */
export function windAlong(
  state: GameState,
  j: SkiJumpState,
  d: number,
): {
  head: number;
  across: number;
} {
  if (j.staged) return j.staged;
  return hillAirAt(j.air, j.air.clock + state.t, Math.max(0, d));
}

/** The wind along and across the hill at the jumper (`windAlong` where he
 * is). The hill's air is reported at the stations' height, the flight's,
 * so it is read the same at any height over the snow. */
export function hillWind(state: GameState, j: SkiJumpState): { head: number; across: number } {
  const hill = state.level.skiJump!;
  return windAlong(state, j, j.along > hill.edge ? hill.distanceAt(j.along) : 0);
}

/** THE SHARE OF THE PUSH the edge keeps, pressed `timing` s off perfect
 * (either way): the half sine's part done in the last `push` s. */
export function pushShare(timing: number | null): number {
  if (timing === null) return 0;
  const P = JUMP.takeOff.push;
  return (1 + Math.cos((Math.PI * Math.min(Math.abs(timing), P)) / P)) / 2;
}

/** The speed the push gives at right angles to the table at a whole share,
 * m/s: the build's strength over the light build's, as its √. */
function perpendicularOf(c: SkierState): number {
  const T = JUMP.takeOff;
  return T.perpendicular * Math.sqrt(riderOf(c.spec).strength / T.strength);
}

/** ONE STEP ON THE BAR OR DOWN THE TRACKS: true while he is on them (the
 * snow's step is not his). At the edge he is let go into the air with the
 * push the edge kept, and the rest of the step is the flight's: `fly` is
 * handed the seconds of it left. */
export function stepTracks(
  state: GameState,
  input: SkierInput,
  events: GameEvent[],
  fly: (dt: number) => void,
): boolean {
  const j = state.jump!;
  const hill = state.level.skiJump!;
  const c = state.skier;
  const dt = TUNING.dt;
  const t0 = state.t - dt;
  const pressed = input.jump === true && !j.jumpHeld;
  j.jumpHeld = input.jump === true;
  if (j.stage === "bar") {
    // Held on the bar until the light is green and he goes.
    const go =
      state.phase === "racing" && !state.progress.out && (input.tuck >= JUMP.bar.press || pressed);
    if (!go) {
      placeOnTracks(state, j, 0, JUMP.bar.seat);
      return true;
    }
    j.stage = "tracks";
    j.speed = JUMP.bar.shove;
    j.leftAt = t0;
    startStrict(state, events);
    events.push({ kind: "skiJump", t: state.t, stage: "go", speed: j.speed });
  } else if (pressed && j.pressAt < 0) {
    // THE PRESS: the push started (once) — never the one that left the bar.
    j.pressAt = t0;
  }
  const head = hillWind(state, j).head;
  const from = j.along;
  const step = trackStep(hill, j.along, j.speed, dt, j.density, massOf(c), head);
  // THE PHOTOCELLS: 8 m of the arc, the second 10 m before the edge.
  const left = j.left - step.arc;
  const cells = JUMP.cells;
  if (j.left > cells.from && left <= cells.from) {
    j.cellAt = t0 + ((j.left - cells.from) / Math.max(1e-6, step.arc)) * dt;
  }
  if (j.left > cells.to && left <= cells.to && j.cellAt >= 0) {
    const at = t0 + ((j.left - cells.to) / Math.max(1e-6, step.arc)) * dt;
    j.record.inRunSpeed = (cells.from - cells.to) / Math.max(1e-6, at - j.cellAt);
  }
  if (step.along < hill.edge) {
    j.along = step.along;
    j.speed = step.v;
    j.left = left;
    placeOnTracks(state, j, j.speed, JUMP.bar.seat);
    return true;
  }
  // OVER THE EDGE, at the fraction of the step it fell in.
  const share = clamp((hill.edge - from) / Math.max(1e-9, step.along - from), 0, 1);
  const v = j.speed + (step.v - j.speed) * share;
  j.edgeAt = t0 + share * dt;
  takeOff(state, j, v, events);
  fly((1 - share) * dt);
  return true;
}

/** LET GO AT THE EDGE at `v` m/s along the table, with the push the edge
 * kept at right angles to it. */
function takeOff(state: GameState, j: SkiJumpState, v: number, events: GameEvent[]): void {
  const hill = state.level.skiJump!;
  const c = state.skier;
  const T = JUMP.takeOff;
  const R = JUMP.rotation;
  const a = hill.takeOff;
  // The timing: when the push began against the moment that ends it at the
  // edge — negative early, positive late.
  const timing = j.pressAt >= 0 ? j.pressAt + T.push - j.edgeAt : null;
  // A press never made before the edge, or one so early it is all spent.
  const share = pushShare(timing);
  const push = perpendicularOf(c) * share;
  const r = j.record;
  r.edgeSpeed = v;
  r.timing = timing;
  r.share = share;
  r.push = push;
  if (r.inRunSpeed === 0) r.inRunSpeed = v;
  // In the air: along the table's tangent, the push along its normal.
  j.stage = "air";
  j.along = hill.edge + Math.sin(a) * T.release;
  j.y = hill.yAt(hill.edge) + Math.cos(a) * T.release;
  j.va = v * Math.cos(a) + push * Math.sin(a);
  j.vy = -v * Math.sin(a) + push * Math.cos(a);
  j.vw = 0;
  // The skis along the table; the air past them from a little above.
  j.aoa = -Math.atan2(push, v);
  j.lay = 0;
  j.vee = 0;
  j.roll = 0;
  // The rotation the push left him: too little early (sat up), too much
  // late (the tips dropping); never pressed, sat up.
  const lost = timing === null ? 1 : 1 - share;
  j.error = timing === null ? R.none : Math.sign(-timing) * R.per * lost;
  c.airborne = true;
  c.airTime = 0;
  c.launchVy = j.vy;
  events.push({ kind: "air", t: state.t, vy: j.vy, speed: hypot(j.va, j.vy) });
  events.push({ kind: "skiJump", t: state.t, stage: "takeOff", speed: v, timing });
}

/** How far the jumper has to the edge in time at his speed, s — what the
 * bot (and a lab's hand) times the press by; Infinity off the tracks. */
export function timeToEdge(state: GameState): number {
  const j = state.jump;
  if (!j || j.stage !== "tracks") return Infinity;
  const hill = state.level.skiJump!;
  return (hill.edge - j.along) / Math.max(0.5, j.speed * Math.cos(slopeAt(hill, j.along)));
}

/** Where on the hill a point of the world is: m of plan along its line and
 * across it. */
export function onHill(state: GameState, x: number, z: number): { along: number; across: number } {
  return fieldCoords(hillFrame(state), x, z);
}
