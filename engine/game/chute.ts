// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE — a free ride's jump out of the plane's door (`plane.ts`'s
// `jump`, read here off its `jump` event) and everything after it, flown by
// the skier's own keys:
//
//   * THE EXIT: out of the door into the plane's slipstream with its way and
//     a push. He presents his chest to the air he moves through — at first
//     along his way, then, as gravity takes him, up at him from below — and
//     is in freefall once it comes from under him (`CHUTE.exit`).
//   * THE FREEFALL: his body's own drag face to the air (`CHUTE.freefall`:
//     belly to earth, a track on the lean forward that glides him along his
//     heading, a back slide on the lean back, head down on the tuck), the
//     edge turning him flat, in the air of the map (`para-air.ts`) at its
//     real density for the height (the standard atmosphere, `balloon-air.ts`)
//     — about 55 m/s near the snow, faster high up.
//   * THE OPENING (the machine press): the pilot chute thrown, the bridle
//     and the pin, the bag off the container, LINE STRETCH, the SNIVEL with
//     the slider held at the top, the slider down and FULL INFLATION
//     (`CHUTE.deploy`) — each stage the drag area the air meets growing, so
//     the deceleration it puts on him is the opening shock, three to six g,
//     and its stages are what the drawing shows frame by frame.
//   * THE CANOPY: two bodies on lines as the paramotor's wing (`canopy.ts`
//     holds the maths they share) with no motor — the toggles on the edge,
//     both on the back key (the flare), the risers on the lean.
//   * AND AFTER: the press cuts it away (`released`: the canopy falls as
//     cloth and lies where it comes down; he falls on), his skis on the snow
//     under it let it go (`landed`: he skis on), and the cloth or a line met
//     by a crown or a lift's rope, tower or carrier holds it there
//     (`snagged`: he hangs under it, swinging, until he starts again).
//
// A freefall that meets the snow is handed back to the skier's own step a
// couple of metres over it, and the landing is judged there as any fall's
// is. A restart — or the end of a fall the skydive threw him in — begins the
// ride again in the plane's door on its strip. Near the map's edge the
// airborne bounds (`AIR_BOUNDS.chute` under the canopy, `.skydive` on his
// body) blow him back in and turn him to its middle. Pure over the level, the state and the clock: nothing here draws
// from the stream, and a ride with no jump never comes in here.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { airDensity, airKelvin, airPressure, seaAltitude } from "./balloon-air.ts";
import { stepBody } from "./body.ts";
import {
  crownAt,
  fallPiece,
  hangUnder,
  liftDrag,
  lineDir,
  pullLines,
  swingDamp,
  wayOf,
} from "./canopy.ts";
import { airBoundsAt, type AirBounds } from "./collision.ts";
import { standSkier } from "./course.ts";
import { crashOver, mayGetUp } from "./crash.ts";
import { CHUTE, jumperMass } from "./defs/chute.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { holdsHim } from "./gore.ts";
import { carrierAt, carrierPlace, liftPlans, ropeAt, upRope } from "./lift-line.ts";
import { paraAirAt, type ParaAir } from "./para-air.ts";
import { freshPlane, startPlane } from "./plane.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";
import type {
  ChuteControls,
  ChuteDeploy,
  ChuteMode,
  ChutePhaseEvent,
  ChuteSnag,
  ChuteState,
} from "./chute-state.ts";

const dt = TUNING.dt;
const g = TUNING.g;
const F = CHUTE.freefall;
const K = CHUTE.canopy;
const P = CHUTE.polar;
const STAGES = CHUTE.deploy.stages;
const IDLE: ChuteControls = { brake: 0, steer: 0, riser: 0 };
const HANGING: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const air: ParaAir = { x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 };
const edge: AirBounds = { depth: 0, wx: 0, wz: 0, heading: 0 };
const U = { x: 0, y: 1, z: 0 };
const FW = { x: 0, y: 0, z: 1 };
const AF = { x: 0, y: 0, z: 0 };

/** The canopy's controls the skier's own input asks for. */
export function chuteControls(input: SkierInput): ChuteControls {
  return {
    brake: clamp(input.brake, 0, 1),
    steer: clamp(input.steer, -1, 1),
    riser: clamp(-input.lean, -1, 1),
  };
}

/** A skydive begun where the skier is, in `mode`. */
function freshChute(state: GameState, mode: ChuteMode): ChuteState {
  const c = state.skier;
  const flat = hypot(c.vx, c.vz);
  return {
    mode,
    t: 0,
    since: 0,
    attitude: mode === "exit" ? 0 : Math.PI / 2,
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
    controls: { ...IDLE },
    piece: null,
    snag: null,
    fell: false,
    settle: 0,
    done: false,
  };
}

const say = (state: GameState, events: GameEvent[], phase: ChutePhaseEvent, gs?: number): void => {
  const c = state.skier;
  const e: GameEvent = { kind: "chute", t: state.t, phase, x: c.x, y: c.y, z: c.z, speed: c.speed };
  if (gs !== undefined) e.g = gs;
  events.push(e);
};

/** THE SKIER PUT IN FREEFALL (a lab's, a test's, a link's moment): `agl` m
 * over the snow at (x, z), facing `heading`, moving `speed` m/s along it and
 * falling `fall` m/s — in `exit` (out of a door, the air along his way), in
 * `freefall`, belly to earth, or `open` under the canopy already flying
 * (at the polar's own speeds unless told). A plane waits parked on its
 * strip for the restart. */
export function skydiveAt(
  state: GameState,
  at: {
    x: number;
    z: number;
    agl: number;
    heading?: number;
    speed?: number;
    fall?: number;
    mode?: "exit" | "freefall" | "open";
  },
): void {
  if (!state.plane) state.plane = freshPlane(state);
  else if (state.plane.rider) Object.assign(state.plane, freshPlane(state));
  const heading = at.heading ?? 0;
  const c = state.skier;
  standSkier(state, at.x, at.z, heading);
  c.y = state.level.groundAt(at.x, at.z) + c.spec.cogHeight + at.agl;
  const speed = at.speed ?? 0;
  c.vx = Math.sin(heading) * speed;
  c.vz = Math.cos(heading) * speed;
  c.vy = -(at.fall ?? 0);
  c.airborne = true;
  derive(c, state.level);
  const mode = at.mode ?? "freefall";
  const ch = freshChute(state, mode === "open" ? "freefall" : mode);
  ch.heading = heading;
  ch.agl = at.agl;
  state.chute = ch;
  pose(state, ch);
  if (mode !== "open") return;
  // ...or already flying the canopy, hands off, at what its polar flies.
  const f = CHUTE.flies;
  c.vx = Math.sin(heading) * (at.speed ?? f.forward);
  c.vz = Math.cos(heading) * (at.speed ?? f.forward);
  c.vy = -(at.fall ?? f.sink);
  c.q = fromEuler(heading, 0, 0);
  derive(c, state.level);
  enter(ch, "open");
  ch.t = CHUTE.fill.time;
  ch.attitude = 0;
  ch.x = c.x;
  ch.y = c.y + K.lines;
  ch.z = c.z;
  ch.vx = c.vx;
  ch.vy = c.vy;
  ch.vz = c.vz;
  ch.canopyHeading = heading;
}

/** Whether a canopy is open over him (the skier's own step hangs him). */
export function chuteRigged(state: GameState): boolean {
  return state.chute?.mode === "open";
}

/** Whether the skydive has him — the air or the canopy, not yet down and
 * skiing on. */
export function chuteActive(state: GameState): boolean {
  const ch = state.chute;
  return !!ch && !ch.done;
}

/** WHAT THE SKIER IS STEPPED ON under an open canopy: in the air he hangs
 * in the harness and his skis do nothing; on the snow he skis as ever. */
export function chuteHeld(state: GameState, input: SkierInput): SkierInput {
  return chuteRigged(state) && state.skier.airborne ? HANGING : input;
}

/** WHETHER HE LIES WHERE THE SKYDIVE THREW HIM: the ride begins again in
 * the plane's door once he has lain (`stepChute`), never on the piste. */
export function chuteDown(state: GameState): boolean {
  return !!state.chute?.fell && !!state.skier.thrown;
}

/** BEGIN AGAIN in the plane's door on its strip. */
function restart(state: GameState, events: GameEvent[]): void {
  delete state.chute;
  startPlane(state, events);
  say(state, events, "restart");
}

/** His feet's height over the snow, m. */
function feetUp(state: GameState): number {
  const c = state.skier;
  return c.y - c.spec.cogHeight - state.level.groundAt(c.x, c.z);
}

/** ONE STEP OF THE SKYDIVE, before the skier's own: begun off the plane's
 * jump, the canopy let go of lying where it came down, the jump begun again
 * — and while he is in the air on his body, opening, or caught, the step
 * is the skydive's (true). Under an open canopy the skier's own step runs
 * and `flyChute` flies the canopy after it. */
export function stepChute(state: GameState, input: SkierInput, events: GameEvent[]): boolean {
  if (events.some((e) => e.kind === "plane" && e.phase === "jump")) {
    state.chute = freshChute(state, "exit");
    say(state, events, "exit");
    return true;
  }
  const ch = state.chute;
  if (!ch) return false;
  ch.t += dt;
  ch.since += dt;
  if (ch.piece) {
    paraAirAt(state.level, state.t, ch.piece.x, ch.piece.y, ch.piece.z, air);
    const d = CHUTE.dropped;
    fallPiece(state.level, ch.piece, d.mass, d.area, air.x * d.drift, air.z * d.drift);
  }
  if (ch.done) return false;
  const c = state.skier;
  if (c.thrown) {
    // Thrown out of it: the canopy cut away, and the jump begun again once
    // he has lain.
    if (ch.mode === "open" || ch.mode === "deploying" || ch.mode === "snagged") cutAway(ch);
    if (ch.mode !== "landed") {
      ch.mode = "released";
      ch.fell = true;
    }
    const up = crashOver(c.thrown, true) || (input.reset && mayGetUp(c.thrown));
    if (up && !holdsHim(state)) restart(state, events);
    return false;
  }
  if (input.reset) {
    restart(state, events);
    return true;
  }
  if (ch.mode === "snagged") {
    hang(state, ch, events);
    return true;
  }
  if (ch.mode === "open") {
    if (input.machine) {
      cutAway(ch);
      enter(ch, "released");
      say(state, events, "release");
    }
    return false;
  }
  // In the air on his body (out of the door, falling, opening, or cut
  // away): his to the snow's last couple of metres, where the skier's own
  // step and its landing take him.
  const lead = Math.max(CHUTE.handover, -state.skier.vy * dt * CHUTE.lead);
  if (feetUp(state) < lead) {
    if (ch.mode === "deploying") {
      cutAway(ch);
      enter(ch, "released");
    }
    c.airTime = 0;
    return false;
  }
  if (ch.mode === "deploying") {
    deploying(state, ch, events);
    return true;
  }
  const clear = ch.mode === "freefall" || (ch.mode === "exit" && ch.t >= CHUTE.exit.clear);
  if (input.machine && clear) {
    throwOut(state, ch, events);
    deploying(state, ch, events);
    return true;
  }
  freefall(state, ch, input);
  return true;
}

/** Into `mode`, its clock from naught. */
function enter(ch: ChuteState, mode: ChuteMode): void {
  ch.mode = mode;
  ch.t = 0;
}

/** The air at (x, y, z) into `air`, the bounds' wind blowing him back in
 * near the map's edge into it, and its density there. */
function readAir(state: GameState, ch: ChuteState, x: number, y: number, z: number): number {
  paraAirAt(state.level, state.t, x, y, z, air);
  ch.agl = Math.max(0, feetUp(state));
  const B = TUNING.bounds.air;
  airBoundsAt(state.level, x, z, ch.agl, ch.mode === "open" ? B.chute : B.skydive, edge);
  air.x += edge.wx;
  air.z += edge.wz;
  const alt = seaAltitude(state.level, y);
  ch.density = airDensity(airPressure(alt), airKelvin(alt));
  return ch.density;
}

/** The turn asked, the edge's — and near the map's edge turned toward its
 * middle by how deep into the band he is. */
function steerOf(ch: ChuteState, steer: number, heading: number): number {
  const w = clamp(edge.depth * 1.5, 0, 1);
  const back = clamp(1.5 * angleDiff(heading, edge.heading), -1, 1);
  return steer + (back - steer) * w;
}

/** ONE STEP ON HIS BODY: out of the door or in freefall — the drag face to
 * the air, the track's glide, the turn, gravity. */
function freefall(state: GameState, ch: ChuteState, input: SkierInput): void {
  const c = state.skier;
  const M = jumperMass(totalMass(c.spec));
  const rho = readAir(state, ch, c.x, c.y, c.z);
  const ax = c.vx - air.x;
  const ay = c.vy - air.y;
  const az = c.vz - air.z;
  const V = hypot3(ax, ay, az);
  // THE BODY: how he flies it, eased.
  const k = 1 - Math.exp(-dt / F.body);
  const flying = ch.mode !== "exit";
  const head = flying ? clamp(input.tuck, 0, 1) : 0;
  const track = flying ? clamp(-input.lean, 0, 1) * (1 - head) : 0;
  const slide = flying ? clamp(input.lean, 0, 1) * (1 - head) : 0;
  ch.track += (track - ch.track) * k;
  ch.slide += (slide - ch.slide) * k;
  // Chest to the air: the path's angle under the level out of the door;
  // belly to earth in freefall, on over to head down on the tuck.
  const path = V > 1 ? Math.asin(clamp(-ay / V, -1, 1)) : Math.PI / 2;
  const want = flying ? Math.PI / 2 + head * Math.PI * 0.45 : clamp(path, 0, Math.PI / 2);
  ch.attitude += (want - ch.attitude) * k;
  const steer = steerOf(ch, flying ? clamp(input.steer, -1, 1) : 0, ch.heading);
  ch.turn += (steer * F.turn - ch.turn) * k;
  ch.heading += ch.turn * dt;
  // THE DRAG: the area his body shows the air.
  const headShare = clamp((ch.attitude - Math.PI / 2) / (Math.PI * 0.45), 0, 1);
  const area =
    F.belly + (F.track - F.belly) * ch.track + (F.head - F.belly) * headShare * (1 - ch.track);
  const half = 0.5 * rho * V;
  let fx = -half * area * ax;
  let fy = -half * area * ay;
  let fz = -half * area * az;
  // THE TRACK'S GLIDE (and the back slide's): along his heading, square to
  // the air through him.
  const glide = F.glide * ch.track - F.back * ch.slide;
  if (V > 1 && glide !== 0) {
    const hx = Math.sin(ch.heading);
    const hz = Math.cos(ch.heading);
    const along = (hx * ax + hz * az) / V;
    let gx = hx - along * (ax / V);
    let gy = -along * (ay / V);
    let gz = hz - along * (az / V);
    const gl = hypot3(gx, gy, gz);
    if (gl > 1e-6) {
      const L = (half * V * area * glide) / gl;
      gx *= L;
      gy *= L;
      gz *= L;
      fx += gx;
      fy += gy;
      fz += gz;
    }
  }
  ch.g = hypot3(fx, fy, fz) / (M * g);
  c.vx += (fx / M) * dt;
  c.vy += (fy / M - g) * dt;
  c.vz += (fz / M) * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  ch.airspeed = V;
  ch.fall = -c.vy;
  // Out of the hill: the air from under him — or, clear of the tail, his
  // own hands flying the body sooner.
  const hands =
    ch.t >= CHUTE.exit.clear && (input.tuck > 0 || input.lean !== 0 || input.steer !== 0);
  const under = path > Math.PI / 2 - CHUTE.exit.vertical;
  if (ch.mode === "exit" && (under || hands || ch.t >= CHUTE.exit.most)) {
    enter(ch, "freefall");
  }
  pose(state, ch);
}

/** THE SKIER'S OWN AXES while the skydive has him: facing his heading,
 * pitched over toward the snow as far as his skier's frame can say
 * (`freefall.pitchMost`) — the drawing reads the whole attitude off the
 * state — and off the snow. */
function pose(state: GameState, ch: ChuteState): void {
  const c = state.skier;
  c.q = fromEuler(ch.heading, -Math.min(ch.attitude, F.pitchMost), 0);
  c.wx = c.wy = c.wz = 0;
  c.airborne = true;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, state.level);
  c.overFor = 0;
  c.stuckFor = 0;
}

/** THE THROW: the pilot chute out of its pouch, the deployment begun. */
function throwOut(state: GameState, ch: ChuteState, events: GameEvent[]): void {
  const c = state.skier;
  const at = { x: c.x, y: c.y, z: c.z };
  enter(ch, "deploying");
  ch.peak = 0;
  ch.deploy = {
    stage: "pilot",
    share: 0,
    t: 0,
    pilot: { ...at },
    bag: { ...at },
    lines: 0,
    slider: 1,
    spread: 0,
  };
  say(state, events, "open-start");
}

/** ONE STEP OF THE OPENING: the stage and its drag area, the deceleration
 * it puts on him (the shock), the pieces placed up the relative wind for
 * the drawing — and, inflated, the canopy flying. */
function deploying(state: GameState, ch: ChuteState, events: GameEvent[]): void {
  const c = state.skier;
  const d = ch.deploy as ChuteDeploy;
  const M = jumperMass(totalMass(c.spec));
  const t0 = d.t;
  d.t += dt;
  let i = 0;
  while (i < STAGES.length - 1 && d.t > STAGES[i].end) i++;
  const from = i === 0 ? 0 : STAGES[i - 1].end;
  const share = clamp((d.t - from) / (STAGES[i].end - from), 0, 1);
  d.stage = STAGES[i].id;
  d.share = share;
  const lowArea = i === 0 ? F.belly : STAGES[i - 1].area;
  const area = lowArea + (STAGES[i].area - lowArea) * share;
  const lines = STAGES[2].end;
  if (t0 < lines && d.t >= lines) say(state, events, "line-stretch");
  const rho = readAir(state, ch, c.x, c.y, c.z);
  const ax = c.vx - air.x;
  const ay = c.vy - air.y;
  const az = c.vz - air.z;
  const V = hypot3(ax, ay, az);
  const half = 0.5 * rho * V * area;
  const fx = -half * ax;
  const fy = -half * ay;
  const fz = -half * az;
  ch.g = hypot3(fx, fy, fz) / (M * g);
  ch.peak = Math.max(ch.peak, ch.g);
  c.vx += (fx / M) * dt;
  c.vy += (fy / M - g) * dt;
  c.vz += (fz / M) * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  ch.airspeed = V;
  ch.fall = -c.vy;
  // Pulled feet first under the lines from line stretch on.
  const k = 1 - Math.exp(-dt / F.body);
  if (i >= 2) ch.attitude += (0 - ch.attitude) * k;
  pose(state, ch);
  // THE PIECES, up the relative wind from him (what the drawing hangs them
  // by): the pilot chute thrown out to his right and trailing up; the bag
  // lifted off his back to the lines' length; the canopy out of it.
  const ux = V > 1 ? -ax / V : 0;
  const uy = V > 1 ? -ay / V : 1;
  const uz = V > 1 ? -az / V : 0;
  const up = (r: number, p: { x: number; y: number; z: number }): void => {
    p.x = c.x + ux * r;
    p.y = c.y + uy * r;
    p.z = c.z + uz * r;
  };
  const out = (end: number): number => clamp(d.t / end, 0, 1);
  d.lines = clamp((d.t - STAGES[0].end) / (lines - STAGES[0].end), 0, 1);
  const bagAt = 0.3 + (K.lines - 0.3) * d.lines;
  up(bagAt, d.bag);
  up(bagAt + CHUTE.pilot.bridle * out(STAGES[1].end) + 1.2 * out(STAGES[0].end), d.pilot);
  if (i === 0) {
    const right = rotate(c.q, { x: 1, y: 0, z: 0 });
    const reach = 0.8 * (1 - share);
    d.pilot.x += right.x * reach;
    d.pilot.z += right.z * reach;
  }
  const snivel = STAGES[3];
  d.slider = 1 - clamp((d.t - STAGES[2].end) / (snivel.end - STAGES[2].end), 0, 1) * 0.35;
  if (i === 4) d.slider = 0.65 * (1 - share);
  d.spread = i < 3 ? 0 : i === 3 ? 0.4 * share : 0.4 + 0.6 * share;
  up(bagAt, ch);
  ch.vx = c.vx;
  ch.vy = c.vy;
  ch.vz = c.vz;
  ch.canopyHeading = ch.heading;
  if (d.t >= STAGES[STAGES.length - 1].end) {
    // FULL: the canopy flies on its lines over him from here.
    d.slider = 0;
    d.spread = 1;
    up(K.lines, ch);
    // Trimmed nose down, it starts to fly the moment it is full.
    ch.vx += Math.sin(ch.heading) * CHUTE.surge;
    ch.vz += Math.cos(ch.heading) * CHUTE.surge;
    enter(ch, "open");
    ch.controls = { ...IDLE };
    say(state, events, "open", ch.peak);
  }
}

/** AFTER THE SKIER'S STEP under an open canopy: the canopy flown on its
 * lines over him, his body hung under it — and let go of as his skis touch
 * the snow, cut away as it comes down onto it, or caught. A skier down on
 * his skis after a cut-away has done with the skydive. */
export function flyChute(state: GameState, input: SkierInput, events: GameEvent[]): void {
  const ch = state.chute;
  const c = state.skier;
  if (!ch || ch.done || c.thrown) return;
  if (ch.mode !== "open") {
    // A landing is judged over a step or two before it throws him: he skis
    // on only once he has stood on the snow a moment.
    if (ch.mode !== "snagged" && !c.airborne) ch.settle += dt;
    else ch.settle = 0;
    if (ch.settle >= CHUTE.settle) ch.done = true;
    return;
  }
  const M = jumperMass(totalMass(c.spec));
  fly(state, ch, input, M);
  ch.agl = Math.max(0, feetUp(state));
  ch.fall = -c.vy;
  // The load on the harness through the lines' stretch: the inextensible
  // lines' pull eased over `CHUTE.stretch` s.
  ch.g += (ch.tension / (M * g) - ch.g) * (1 - Math.exp(-dt / CHUTE.stretch));
  if (ch.t < 1.5) ch.peak = Math.max(ch.peak, ch.g);
  if (c.airborne) {
    const lean = -ch.controls.riser * 0.2;
    const Fl = CHUTE.flare;
    hangUnder(state, ch.canopyHeading, ch.bank, ch.agl, lean, Fl.stand, Fl.square);
  } else {
    // DOWN ON HIS SKIS under it: let go of, and he skis on.
    cutAway(ch);
    enter(ch, "landed");
    ch.done = true;
    say(state, events, "land");
    return;
  }
  if (ch.y - 0.5 <= state.level.groundAt(ch.x, ch.z) + CHUTE.ground) {
    cutAway(ch);
    enter(ch, "released");
    say(state, events, "release");
    return;
  }
  const caught = snagOf(state, ch);
  if (caught) {
    ch.snag = caught;
    enter(ch, "snagged");
    ch.tension = 0;
    ch.vx = ch.vy = ch.vz = 0;
    say(state, events, "snag");
  }
}

/** THE CANOPY ON ITS LINES for one step (as `para.ts`'s wing, without the
 * motor, the folds or the eddies across the span). */
function fly(state: GameState, ch: ChuteState, input: SkierInput, M: number): void {
  const c = state.skier;
  const ctl = ch.controls;
  const want = chuteControls(input);
  readAir(state, ch, ch.x, ch.y, ch.z);
  if (c.airborne) want.steer = steerOf(ch, want.steer, ch.canopyHeading);
  const k = 1 - Math.exp(-dt / CHUTE.hands);
  ctl.brake += (want.brake - ctl.brake) * k;
  ctl.steer += (want.steer - ctl.steer) * k;
  ctl.riser += (want.riser - ctl.riser) * k;
  lineDir(ch, c, U);
  const ax = ch.vx - air.x;
  const ay = ch.vy - air.y;
  const az = ch.vz - air.z;
  const V = hypot3(ax, ay, az);
  const down = ax * U.x + ay * U.y + az * U.z;
  wayOf(ax, ay, az, down, U, ch.canopyHeading, FW);
  const B = CHUTE.brakes;
  const R = CHUTE.risers;
  const riser = ctl.riser >= 0 ? ctl.riser * R.front : -ctl.riser * R.rear;
  const rig = CHUTE.rig + B.rig * ctl.brake + riser;
  const alpha = rig + Math.atan2(-down, Math.max(1e-3, ax * FW.x + ay * FW.y + az * FW.z));
  ch.stalled = alpha > P.stall - B.stall * ctl.brake;
  const lift = ch.stalled
    ? P.stalled
    : Math.max(0, P.slope * (alpha - P.zero) + B.lift * ctl.brake);
  const T = CHUTE.turn;
  const drag =
    P.drag0 +
    P.induced * lift * lift +
    B.drag * ctl.brake * ctl.brake +
    T.drag * Math.abs(ctl.steer) +
    (ch.stalled ? P.stallDrag : 0);
  // The last of the inflation: the cells still filling as the canopy flies.
  const Fi = CHUTE.fill;
  const fill = Math.min(1, Fi.from + ((1 - Fi.from) * ch.t) / Fi.time);
  const qS = 0.5 * ch.density * V * V * K.area * fill;
  liftDrag(ax, ay, az, V, U, qS, lift, drag, AF);
  let fx = AF.x;
  let fy = AF.y;
  let fz = AF.z;
  // THE TURN: toward the toggle pulled, along the canopy's right (u × f),
  // the canopy righting itself as it banks.
  const rx = U.y * FW.z - U.z * FW.y;
  const ry = U.z * FW.x - U.x * FW.z;
  const rz = U.x * FW.y - U.y * FW.x;
  const banked = U.x * Math.cos(ch.canopyHeading) - U.z * Math.sin(ch.canopyHeading);
  const side = qS * (T.side * ctl.steer - T.righting * banked);
  fx += side * rx;
  fy += side * ry;
  fz += side * rz;
  // THE SURGE: stalled and the toggles let up, it refills and shoots
  // forward over him.
  if (ch.stalled) {
    const surge = qS * P.surge * (1 - ctl.brake);
    fx += surge * FW.x;
    fy += surge * FW.y;
    fz += surge * FW.z;
  }
  swingDamp(ch, c, U, CHUTE.damping, M, AF);
  fx += AF.x;
  fy += AF.y;
  fz += AF.z;
  ch.vx += (fx / K.mass) * dt;
  ch.vy += (fy / K.mass - g) * dt;
  ch.vz += (fz / K.mass) * dt;
  ch.x += ch.vx * dt;
  ch.y += ch.vy * dt;
  ch.z += ch.vz * dt;
  ch.tension = pullLines(ch, c, K.lines, K.mass, M);
  ch.canopyHeading = Math.atan2(FW.x, FW.z);
  ch.heading = ch.canopyHeading;
  const hx = Math.cos(ch.canopyHeading);
  const hz = -Math.sin(ch.canopyHeading);
  ch.bank = Math.atan2(U.x * hx + U.z * hz, U.y);
  ch.pitch = alpha - CHUTE.rig;
  ch.alpha = alpha;
  ch.airspeed = V;
  derive(c, state.level);
}

/** THE CANOPY LET GO OF: it falls free as cloth from where it flew. */
function cutAway(ch: ChuteState): void {
  ch.piece = {
    x: ch.x,
    y: ch.y,
    z: ch.z,
    vx: ch.vx,
    vy: ch.vy,
    vz: ch.vz,
    heading: ch.canopyHeading,
    down: false,
  };
  ch.tension = 0;
  ch.snag = null;
  ch.controls = { ...IDLE };
}

/** WHAT THE CANOPY HAS CAUGHT ON this step, if anything: the cloth (its
 * middle and either tip) or the lines in a crown, or on a lift's rope, a
 * tower's column or a chair or cabin hanging from it. */
function snagOf(state: GameState, ch: ChuteState): ChuteSnag | null {
  const c = state.skier;
  const level = state.level;
  const half = K.span / 2;
  const rx = Math.cos(ch.canopyHeading);
  const rz = -Math.sin(ch.canopyHeading);
  const pts = [
    { x: ch.x, y: ch.y, z: ch.z },
    { x: ch.x + rx * half, y: ch.y, z: ch.z + rz * half },
    { x: ch.x - rx * half, y: ch.y, z: ch.z - rz * half },
    { x: ch.x + rx * half * 0.5, y: ch.y, z: ch.z + rz * half * 0.5 },
    { x: ch.x - rx * half * 0.5, y: ch.y, z: ch.z - rz * half * 0.5 },
    ...[0.33, 0.66].map((s) => ({
      x: c.x + (ch.x - c.x) * s,
      y: c.y + (ch.y - c.y) * s,
      z: c.z + (ch.z - c.z) * s,
    })),
  ];
  const held = (on: ChuteSnag["on"], index: number, p: { x: number; y: number; z: number }) => ({
    on,
    index,
    x: p.x,
    y: p.y,
    z: p.z,
    lines: Math.max(1.5, hypot3(p.x - c.x, p.y - c.y, p.z - c.z)),
  });
  const S = CHUTE.snag;
  for (let i = 0; i < 5; i++) {
    const p = pts[i];
    const tree = crownAt(level, p.x, p.y, p.z, S.crown);
    if (tree >= 0) return held("tree", tree, p);
  }
  const plans = liftPlans(level);
  for (let k = 0; k < plans.length; k++) {
    const plan = plans[k];
    const bx = plan.lift.bottom.x;
    const bz = plan.lift.bottom.z;
    const r = upRope(plan);
    for (const p of pts) {
      const u = (p.x - bx) * plan.dx + (p.z - bz) * plan.dz;
      const v = (p.x - bx) * plan.dz - (p.z - bz) * plan.dx;
      if (u < -4 || u > plan.length + 4 || Math.abs(v) > r + 6) continue;
      // The towers' columns.
      for (const s of plan.supports) {
        if (s.station || p.y < s.ground || p.y > s.ground + s.rope + 1) continue;
        if (hypot(p.x - s.x, p.z - s.z) < plan.look.column + S.tower) return held("tower", k, p);
      }
      if (u < 0 || u > plan.length) continue;
      const rope = ropeAt(plan, u);
      // The ropes, up and down: a point of the cloth or the lines near one,
      // or the lines from him to the canopy laid across it.
      for (const side of [r, -r]) {
        if (hypot(v - side, p.y - rope) < S.rope) return held("rope", k, p);
        if (p !== pts[0]) continue;
        // In the line's cross-section: the lines, him to the canopy, passing
        // within reach of the rope.
        const hv = (c.x - bx) * plan.dz - (c.z - bz) * plan.dx;
        const dv = v - hv;
        const dy = p.y - c.y;
        const sh = clamp(((side - hv) * dv + (rope - c.y) * dy) / (dv * dv + dy * dy + 1e-9), 0, 1);
        if (hypot(hv + dv * sh - side, c.y + dy * sh - rope) < S.rope) {
          const at = { x: c.x + (p.x - c.x) * sh, y: rope, z: c.z + (p.z - c.z) * sh };
          return held("rope", k, at);
        }
      }
      // A chair or a cabin hung under it.
      if (plan.lift.kind === "drag" || p.y > rope + 0.5 || p.y < rope - plan.look.hang - 1.5) {
        continue;
      }
      const n = Math.max(1, Math.floor((2 * plan.length) / plan.look.every));
      for (let j = 0; j < n; j++) {
        const spot = carrierAt(plan, j, state.t);
        if (!spot.out || Math.abs(spot.u - u) > 4) continue;
        const at = carrierPlace(plan, spot);
        const cy = ropeAt(plan, spot.u) - plan.look.hang * 0.6;
        if (hypot3(p.x - at.x, p.y - cy, p.z - at.z) < S.carrier) return held("carrier", k, p);
      }
    }
  }
  return null;
}

/** HUNG UNDER A CAUGHT CANOPY: a pendulum on the lines from the point it is
 * held at, damped by the air — and, under a tree, swung into its trunk,
 * the blow on his body (`body.ts`). He hangs there until a restart. */
function hang(state: GameState, ch: ChuteState, events: GameEvent[]): void {
  const c = state.skier;
  const s = ch.snag as ChuteSnag;
  const level = state.level;
  const S = CHUTE.snag;
  const damp = Math.exp(-S.damping * dt);
  c.vx *= damp;
  c.vz *= damp;
  c.vy = c.vy * damp - g * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  // THE LINES: they only pull.
  let nx = c.x - s.x;
  let ny = c.y - s.y;
  let nz = c.z - s.z;
  const d = hypot3(nx, ny, nz);
  if (d > s.lines) {
    nx /= d;
    ny /= d;
    nz /= d;
    c.x = s.x + nx * s.lines;
    c.y = s.y + ny * s.lines;
    c.z = s.z + nz * s.lines;
    const out = c.vx * nx + c.vy * ny + c.vz * nz;
    if (out > 0) {
      c.vx -= nx * out;
      c.vy -= ny * out;
      c.vz -= nz * out;
    }
  }
  // His feet on the snow, should it come up to them.
  const floor = level.groundAt(c.x, c.z) + c.spec.cogHeight;
  if (c.y < floor) {
    c.y = floor;
    c.vy = Math.max(0, c.vy);
  }
  // THE TRUNK of the tree it is caught in, met swinging.
  if (s.on === "tree") {
    const t = level.trees[s.index];
    const tx = c.x - t.x;
    const tz = c.z - t.z;
    const r = hypot(tx, tz);
    const reach = t.radius + 0.35;
    if (r < reach && c.y < t.y + t.height) {
      const ox = r > 1e-6 ? tx / r : 1;
      const oz = r > 1e-6 ? tz / r : 0;
      const into = -(c.vx * ox + c.vz * oz);
      c.x = t.x + ox * reach;
      c.z = t.z + oz * reach;
      if (into > 0) {
        c.vx += ox * into * 1.3;
        c.vz += oz * into * 1.3;
        if (into > S.hurt) {
          events.push({ kind: "hit", t: state.t, speed: into, x: t.x, z: t.z, radius: t.radius });
          stepBody(state, events, null);
        }
      }
    }
  }
  // Hung along his lines, facing where he faced.
  const ux = (s.x - c.x) / Math.max(1e-6, s.lines);
  const uy = Math.max(0.2, (s.y - c.y) / Math.max(1e-6, s.lines));
  const uz = (s.z - c.z) / Math.max(1e-6, s.lines);
  const fx = Math.sin(ch.heading);
  const fz = Math.cos(ch.heading);
  const pitch = -Math.atan2(ux * fx + uz * fz, uy);
  const roll = Math.atan2(ux * fz - uz * fx, uy);
  c.q = fromEuler(ch.heading, pitch, roll);
  c.wx = c.wy = c.wz = 0;
  c.airborne = true;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, level);
  c.overFor = 0;
  c.stuckFor = 0;
  ch.agl = Math.max(0, feetUp(state));
  ch.fall = -c.vy;
}
