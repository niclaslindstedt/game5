// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE — a free ride's way up the mountain on the snow itself
// (`RunRules.sled`, `docs/snowmobile.md`). A deep-snow MOUNTAIN sled waits
// parked at the bottom (`sled-pad.ts`); a skier stood beside it, slowly
// enough, who gives THE MACHINE PRESS (`SkierInput.machine`: ENTER, a double
// tap on touch) racks his skis and poles on it and stands on its running
// boards, and the player RIDES IT — the thumb throttle, the brake, the bars
// and his weight — anywhere on the mountain, up the faces the lifts never
// reach. The same press hops him off: his skis are on his feet again and
// the machine stays where he left it, to be taken again. It rides out
// bumps, jumps and drops onto snow; rolled over, looped, set down on its
// side or its nose, dropped off a height, ridden into a wall or thrown into
// a trunk, the RIDER IS THROWN (the `sled` crash cause) and the machine
// lies where it came to rest; stood back up, he is back on it, the machine
// on its belt.
//
// The body is `sled-body.ts`'s, the drive `sled-drive.ts`'s; this module
// owns what the machine is doing, the rider on it, and the trees and the
// map's edge against it. Pure over the level, the state and the clock:
// nothing here draws from the stream, and a run whose rules carry no
// snowmobile never comes in here.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standing } from "./building-walls.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { standSkier } from "./course.ts";
import { liftOutOfSnow, throwRider } from "./crash.ts";
import { SLED, SLED_PROBES, sledMass } from "./defs/sled.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { mendBody } from "./body.ts";
import { deriveSled, freshContacts, rideSled } from "./sled-body.ts";
import { depthUnder } from "./snow.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { derive } from "./skier.ts";
import { windAt, type Wind } from "./wind.ts";
import type {
  GameEvent,
  GameState,
  SkierInput,
  SledControls,
  SledPhaseEvent,
  SledState,
} from "./state.ts";

const dt = TUNING.dt;
const K = SLED.crash;
/** The controls let go, and a machine left with nobody on it: the parking
 * brake on, so it sits on a slope rather than freewheeling down it. */
const IDLE: SledControls = { throttle: 0, brake: 0, steer: 0, lean: 0 };
const PARKED: SledControls = { ...IDLE, brake: 1 };
/** How long a flight must last to be called one, s, and reported. */
const AIR_COUNTS = 0.25;
/** A trunk met slower than this is a nudge, not a hit worth saying, m/s. */
const HIT_SAY = 2.5;
/** The half length and half width of the machine's plan, m — what a trunk
 * is held out of. */
const HALF_L = SLED.length / 2;
const HALF_W = 0.5;

/** The machine at rest on a spot, nobody on it. */
function parkedAt(state: GameState, x: number, z: number, heading: number): SledState {
  const s: SledState = {
    mode: "parked",
    x,
    y: state.level.groundAt(x, z) + SLED.cogHeight,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    q: fromEuler(heading, 0, 0),
    wx: 0,
    wy: 0,
    wz: 0,
    heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    way: 0,
    controls: { ...IDLE },
    skiAngle: 0,
    riderRight: 0,
    riderAft: 0,
    rollAim: 0,
    rpm: 0,
    treadSpeed: 0,
    running: false,
    slip: 0,
    packed: 0,
    contacts: freshContacts(),
    sinks: SLED_PROBES.map(() => 0),
    comps: SLED_PROBES.map(() => 0),
    skiComp: [0, 0],
    treadComp: 0,
    airborne: false,
    airTime: 0,
    rider: false,
    t: 0,
    thrown: false,
    overFor: 0,
    hitCooldown: 0,
  };
  standSled(state, s, x, z, heading);
  return s;
}

/** A snowmobile parked on `level`'s spot at the bottom. */
export function freshSled(state: GameState): SledState {
  const spot = sledSpotOf(state.level);
  return parkedAt(state, spot.x, spot.z, spot.heading);
}

/** Stand the machine on its belt at a plan point and heading, pitched and
 * rolled to the snow, at rest, sat at its rest sag. */
export function standSled(
  state: GameState,
  s: SledState,
  x: number,
  z: number,
  heading: number,
): void {
  const level = state.level;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const L = 1.2;
  const W = 0.45;
  const pitch = Math.atan2(
    level.groundAt(x + fx * L, z + fz * L) - level.groundAt(x - fx * L, z - fz * L),
    2 * L,
  );
  const roll = Math.atan2(
    level.groundAt(x - fz * W, z + fx * W) - level.groundAt(x + fz * W, z - fx * W),
    2 * W,
  );
  s.x = x;
  s.z = z;
  s.y = level.groundAt(x, z) + SLED.cogHeight / Math.cos(pitch);
  s.q = fromEuler(heading, pitch, roll);
  s.vx = s.vy = s.vz = 0;
  s.wx = s.wy = s.wz = 0;
  s.treadSpeed = 0;
  s.skiAngle = 0;
  s.rollAim = 0;
  s.airborne = false;
  s.airTime = 0;
  s.overFor = 0;
  for (let i = 0; i < s.sinks.length; i++) {
    s.sinks[i] = 0;
    s.comps[i] = 0;
  }
  deriveSled(s);
}

const say = (run: GameState, events: GameEvent[], phase: SledPhaseEvent, speed = 0): void => {
  const s = run.sled!;
  events.push({ kind: "sled", t: run.t, phase, x: s.x, y: s.y, z: s.z, speed });
};

/** WHAT THE RIDER'S HANDS DO, read off the skier's own input while he
 * stands on the boards: the tuck is the thumb throttle, the skid the brake,
 * the edge the bars and the lean his weight fore and aft. */
export function sledControls(input: SkierInput): SledControls {
  return {
    throttle: clamp(input.tuck, 0, 1),
    brake: clamp(input.brake, 0, 1),
    steer: clamp(input.steer, -1, 1),
    lean: clamp(input.lean, -1, 1),
  };
}

const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** ONE STEP OF THE SNOWMOBILE, before the skier is stepped: ridden, or
 * parked where it was left, or lying where the rider was thrown — and the
 * skier on it held on its boards, taken on, or let go. True while he rides
 * it — the step is the sled's, and the snow, the trees and his clock wait.
 * `events` is the run's own list. */
export function stepSled(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const s = run.sled;
  if (!s) return false;
  s.t += dt;
  if (s.hitCooldown > 0) s.hitCooldown -= dt;
  const c = run.skier;
  // THROWN OFF IT and stood back up: back on the machine, which he stands
  // on its belt again where it lies.
  if (s.thrown && !c.thrown) {
    remount(run, s, events);
    return true;
  }
  // THROWN OFF IT BY SOMETHING ELSE — an amateur shouldered too hard
  // (`crowd.ts`'s `clipCrowd`) after the machine's own step: it goes on
  // without him, and he is the ragdoll's until he is stood up.
  if (s.rider && c.thrown) {
    leave(run, s, events, s.speed);
    return false;
  }
  if (!s.rider) {
    // Taken on: the press that does it is spent on it, never read again as
    // the hop off on the same step.
    if (input.machine && sledWithin(run)) {
      board(run, s, events);
      return true;
    }
    // Left to itself: it settles where it stands on its parking brake, the
    // engine idling down — stepped like any body, so a machine left in
    // powder sits down into it.
    drive(run, s, PARKED, events, false);
    if (s.running && (s.mode === "down" || s.t > SLED.idleFor)) s.running = false;
    return false;
  }
  // RIGHTED AND DUG OUT: the reset press stands the machine back on its
  // belt where it is, stopped — a rider rocking a stuck sled out.
  if (input.reset) {
    standSled(run, s, s.x, s.z, s.heading);
    say(run, events, "right");
  }
  // THE HOP OFF: the machine press again.
  if (input.machine) {
    hop(run, s, events);
    return false;
  }
  drive(run, s, sledControls(input), events, true);
  if (s.rider) hold(run, s);
  return s.rider;
}

/** The body stepped under `ctl`, then the trees, the map's edge, the
 * flight's events and what throws the rider. */
function drive(
  run: GameState,
  s: SledState,
  ctl: SledControls,
  events: GameEvent[],
  ridden: boolean,
): void {
  const rider = s.rider ? totalMass(run.skier.spec) : 0;
  windAt(run.level, run.t, wind);
  const air = s.airTime;
  const v0 = { x: s.vx, y: s.vy, z: s.vz };
  const way0 = v0.x * Math.sin(s.heading) + v0.z * Math.cos(s.heading);
  const r = rideSled(s, ctl, sledMass(rider), run, wind);
  const landing = r.landed > 0 ? judgeLanding(run, s, v0) : null;
  // A flight is reported once it has lasted.
  if (s.airborne && s.airTime >= AIR_COUNTS && air < AIR_COUNTS && ridden) {
    events.push({ kind: "air", t: run.t, vy: v0.y, speed: hypot3(v0.x, v0.y, v0.z) });
  }
  if (r.landed >= AIR_COUNTS && ridden) {
    events.push({
      kind: "land",
      t: run.t,
      airTime: r.landed,
      impact: landing!.into,
      speed: s.speed,
      harsh: landing!.off > 0.6,
      lost: 0,
      g: 1 + landing!.into / 3,
      off: landing!.off,
    });
  }
  const hit = trees(run, s);
  if (hit > HIT_SAY && s.hitCooldown <= 0 && ridden) {
    s.hitCooldown = 0.5;
    events.push({ kind: "hit", t: run.t, speed: hit, x: s.x, z: s.z });
  }
  bounds(run, s);
  // PAST SAVING: on its side or its back on the snow, or looped.
  const up = rotate(s.q, { x: 0, y: 1, z: 0 });
  s.overFor = up.y < Math.cos(K.over) ? s.overFor + dt : 0;
  if (!s.rider) {
    if (s.mode === "down" && s.speed < 0.3 && s.overFor === 0) s.mode = "parked";
    return;
  }
  // INTO A WALL: the way it was going stopped dead in a step — a cliff
  // band, a rock step, a bank met square. Nothing on snow stops it so.
  const stopped = way0 - (s.vx * Math.sin(s.heading) + s.vz * Math.cos(s.heading));
  if (hit > K.tree) throwOff(run, s, events, v0, hit);
  else if (landing && landing.off > 1) throwOff(run, s, events, v0, landing.into);
  else if (stopped > K.wall) throwOff(run, s, events, v0, stopped);
  else if (s.overFor > K.overFor) throwOff(run, s, events, v0, s.speed, true);
}

const ground = { x: 0, y: 1, z: 0 };

/** THE LANDING JUDGED, the step a flight ends: `into` the speed the machine
 * came down into the snow along its normal, m/s, and `off` how far past
 * what the rider rides out it is (1 throws him) — the larger of what the
 * drop asks of the suspension and the snow under it (the groomer gives
 * little, deep powder a deal: `landing` to `landingPowder` as the snow
 * deepens) and how far off its belt it came down (`tilt`: square to the
 * snow is nothing, on its side or its nose all of it — given a landing
 * worth the name, `tiltFrom` m/s into the snow). */
function judgeLanding(
  run: GameState,
  s: SledState,
  v0: { x: number; y: number; z: number },
): { into: number; off: number } {
  run.level.normalAt(s.x, s.z, ground);
  const into = Math.max(0, -(v0.x * ground.x + v0.y * ground.y + v0.z * ground.z));
  const soft = (1 - s.packed) * clamp(depthUnder(run.snowDepth, run.fresh), 0, 1);
  const most = K.landing + (K.landingPowder - K.landing) * soft;
  const up = rotate(s.q, { x: 0, y: 1, z: 0 });
  const square = up.x * ground.x + up.y * ground.y + up.z * ground.z;
  const tilt = into > K.tiltFrom ? Math.acos(clamp(square, -1, 1)) / K.tilt : 0;
  return { into, off: Math.max(into / most, tilt) };
}

const near: number[] = [];

/** THE TRUNKS AND THE POSTS (`posts.ts`) against the machine's plan — a
 * capsule down its length — pushed out of, the closing speed taken off and
 * a little back. Returns the hardest closing speed met, m/s. */
function trees(run: GameState, s: SledState): number {
  const level = run.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return 0;
  solidsNear(level, s.x, s.z, HALF_L + 1, near);
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  let worst = 0;
  for (const i of near) {
    const t = solids[i];
    if (s.y < t.y - 1 || s.y > t.y + t.height || !standing(run, t)) continue;
    // The nearest point on the machine's spine to the trunk.
    const rx = t.x - s.x;
    const rz = t.z - s.z;
    const u = clamp(rx * fx + rz * fz, -HALF_L, HALF_L);
    const dx = s.x + fx * u - t.x;
    const dz = s.z + fz * u - t.z;
    const d = hypot(dx, dz);
    const reach = HALF_W + t.radius;
    if (d >= reach) continue;
    const nx = d > 1e-6 ? dx / d : -fx;
    const nz = d > 1e-6 ? dz / d : -fz;
    s.x += nx * (reach - d);
    s.z += nz * (reach - d);
    const vn = s.vx * nx + s.vz * nz;
    if (vn >= 0) continue;
    s.vx -= 1.25 * vn * nx;
    s.vz -= 1.25 * vn * nz;
    // The blow off the spine turns the machine about its CoG.
    s.wy += u * (nx * fz - nz * fx) * -vn * 0.25;
    worst = Math.max(worst, -vn);
  }
  return worst;
}

/** The map's edge: held inside it. */
function bounds(run: GameState, s: SledState): void {
  const lo = TUNING.bounds.margin;
  const hi = run.level.size - lo;
  if (s.x < lo) {
    s.x = lo;
    s.vx = Math.max(0, s.vx);
  } else if (s.x > hi) {
    s.x = hi;
    s.vx = Math.min(0, s.vx);
  }
  if (s.z < lo) {
    s.z = lo;
    s.vz = Math.max(0, s.vz);
  } else if (s.z > hi) {
    s.z = hi;
    s.vz = Math.min(0, s.vz);
  }
}

/** WHERE THE RIDER STANDS: on the boards' middle, his weight carried as
 * far across and back as he has moved it, his feet on the boards — the
 * skier's body origin is his CoG over his boot soles. */
export function riderFrame(run: GameState, s: SledState): { x: number; y: number; z: number } {
  const b = SLED.boards;
  const p = rotate(s.q, {
    x: s.riderRight * 0.5,
    y: b.y + run.skier.spec.cogHeight,
    z: b.z - s.riderAft * 0.5,
  });
  return { x: s.x + p.x, y: s.y + p.y, z: s.z + p.z };
}

/** THE SKIER ON THE BOARDS: where the machine has him, facing its way,
 * moving with it — and off the snow, which is not under his skis (they are
 * on the rack). */
function hold(run: GameState, s: SledState): void {
  const c = run.skier;
  const at = riderFrame(run, s);
  const first = s.t <= dt;
  c.vx = first ? s.vx : (at.x - c.x) / dt;
  c.vy = first ? s.vy : (at.y - c.y) / dt;
  c.vz = first ? s.vz : (at.z - c.z) / dt;
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  c.q = s.q;
  c.wx = s.wx;
  c.wy = s.wy;
  c.wz = s.wz;
  c.airborne = false;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
  // His skis are on the rack: nothing of theirs is edged, pivoted or
  // tucked while he stands on the boards.
  c.incline = 0;
  c.edge = 0;
  c.skid = 0;
  c.skiAngle = 0;
  c.tuck = 0;
  c.overFor = 0;
  c.stuckFor = 0;
}

/** Off the boards beside the machine, his skis back on his feet: out to its
 * left — the rack's side — with its way and `out` and `up` m/s more. The
 * body frame's +x is the side the screen draws on the rider's left (the
 * renderer's frame mirrors the map, `heli-rotor.ts`'s `SEAT`). */
function letGo(run: GameState, s: SledState, out: number, up: number): void {
  const c = run.skier;
  const left = rotate(s.q, { x: 1, y: 0, z: 0 });
  const flat = hypot(s.vx, s.vz);
  const heading = flat > 3 ? Math.atan2(s.vx, s.vz) : s.heading;
  const x = s.x + left.x * 1.1;
  const z = s.z + left.z * 1.1;
  standSkier(run, x, z, heading);
  c.vx = s.vx + left.x * out;
  c.vz = s.vz + left.z * out;
  c.vy = Math.max(0, s.vy) + up;
  c.airborne = up > 0;
  derive(c, run.level);
  s.rider = false;
}

/** THE HOP OFF: the rider steps off to its left onto his skis, the machine
 * left where it is with its engine idling — to coast to a stop if it was
 * moving. */
function hop(run: GameState, s: SledState, events: GameEvent[]): void {
  letGo(run, s, SLED.hop.out, s.speed > 3 ? SLED.hop.up : 0);
  s.mode = "parked";
  s.t = 0;
  s.controls = { ...IDLE };
  say(run, events, "hop", s.speed);
}

/** THE RIDER THROWN: over the bars when the machine is stopped under him,
 * off its low side when it has `rolled` over (`crash.rolled`), with what
 * it was carrying — his skis staying on its rack; it goes on without him
 * and lies where it comes to rest. */
function throwOff(
  run: GameState,
  s: SledState,
  events: GameEvent[],
  v0: { x: number; y: number; z: number },
  speed: number,
  rolled = false,
): void {
  const c = run.skier;
  const at = riderFrame(run, s);
  standSkier(run, at.x, at.z, s.heading);
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  c.q = s.q;
  // Going over with it, he takes its turn with him.
  if (rolled) {
    c.wx = s.wx;
    c.wy = s.wy;
    c.wz = s.wz;
  }
  leave(run, s, events, speed);
  const b = throwRider(run, "sled", v0, events, {
    how: rolled ? K.rolled : undefined,
    keepSkis: true,
  });
  // Stood on a machine lying in the powder he is partly under its snow.
  liftOutOfSnow(run, b);
}

/** The machine left to itself with its rider thrown: down, the controls
 * let go, waiting for him to be stood up. */
function leave(run: GameState, s: SledState, events: GameEvent[], speed: number): void {
  s.rider = false;
  s.mode = "down";
  s.thrown = true;
  s.t = 0;
  s.controls = { ...IDLE };
  say(run, events, "crash", speed);
}

/** Back on the machine where it lies, stood on its belt again. */
function remount(run: GameState, s: SledState, events: GameEvent[]): void {
  const flat = hypot(Math.sin(s.heading), Math.cos(s.heading));
  standSled(run, s, s.x, s.z, flat > 0 ? s.heading : 0);
  s.thrown = false;
  mount(run, s);
  say(run, events, "right");
}

/** On the boards, the skis racked: the machine his. */
function mount(run: GameState, s: SledState): void {
  const c = run.skier;
  s.rider = true;
  s.mode = "ridden";
  s.t = 0;
  s.running = true;
  s.rpm = Math.max(s.rpm, SLED.idleRpm);
  c.lift = null;
  c.tunnel = null;
  hold(run, s);
}

/** WHETHER THE MACHINE PRESS TAKES HIM ON: a skier on his skis, off any
 * lift, tunnel or helicopter, within `SLED.board.reach` of a machine that
 * is standing still, slower than `SLED.board.fastest` — a machine he was
 * thrown off waits for him to be stood up. What the HUD offers the press
 * on (`snapshot.ts`) is this same question. */
export function sledWithin(run: GameState): boolean {
  const s = run.sled;
  const c = run.skier;
  if (!s || s.rider || s.thrown) return false;
  if (c.thrown || c.lift || c.tunnel || run.heli?.rider) return false;
  // Under a paramotor's wing the press releases the rig (`para.ts`).
  if (run.para && run.para.mode !== "dropped") return false;
  return (
    hypot(c.x - s.x, c.z - s.z) <= SLED.board.reach &&
    hypot3(c.vx, c.vy, c.vz) <= SLED.board.fastest &&
    s.speed <= 1
  );
}

/** Taken on: the skis racked, on the boards — a machine lying on its side
 * stood back on its belt first. */
function board(run: GameState, s: SledState, events: GameEvent[]): void {
  if (s.overFor > 0 || s.mode === "down") standSled(run, s, s.x, s.z, s.heading);
  mount(run, s);
  say(run, events, "board");
}

/** THE RIDE BEGUN AT THE BOTTOM: a machine on its spot, the engine
 * running, the skier on its boards and mended. */
export function startSled(run: GameState, events: GameEvent[]): void {
  const s = run.sled!;
  Object.assign(s, freshSled(run));
  const c = run.skier;
  standSkier(run, s.x, s.z, s.heading);
  mendBody(c.body);
  c.thrown = null;
  mount(run, s);
  say(run, events, "restart");
}
