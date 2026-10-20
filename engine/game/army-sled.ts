// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S SNOWMOBILES — the military over-snow sleds the wanted level's
// roster sends after a man on the snow (`rosterOf(stars).snowmobiles`):
// two up, a driver and a gunner on the pillion behind him, on the free
// ride's own machine (`SledState`, stepped by `sled-body.ts`' `rideSled` on
// the same snow, with the same trunks and the same edge — `sledSolids`,
// `sledBounds`) and driven by the same hands the bot rides the player's
// with (`sledPilot`).
//
// THE CALL. When the roster asks for more machines than are out, each is
// called: after its crew mount up (`ARMY_SLED.respond`, the next `stagger`
// s after) it leaves the village from the snowmobile's spot beside it
// (`sledSpotOf`), side by side with the ones before. A machine whose crew
// is knocked off is called again.
//
// READING THE SNOW. Ten times a second each machine weighs a fan of
// headings either side of the way to him (`army-drive.ts`): how far each runs
// before a rise too steep to climb, a drop too steep to ride off, open
// water or the map's edge stops it, how many trunks stand near its line,
// and how far it is off the way to him — and steers the cheapest, slowing
// among the trees. A machine that barely moves in a window swings off to a
// side; one that still does not is dug out and stood on open snow facing
// him (`stuck`).
//
// THE CHASE. At him where its crew sees him — their eyes low on the snow,
// so the woods hide him from them (`seesQuarry`) — and where they do not,
// at where he was last seen. Shooting to kill it keeps off him
// (`stand.lethal`) and lets the gun work: with him in sight and in range
// it makes a SHORT HALT — the nose turned at him, braked to a stop — and
// the gunner fires a few bursts of his light machine gun through the
// gunfire layer (`armGun`, `fireAt`, the `lmg`) under the wanted level's
// rules of fire, then they drive on before stopping again.
//
// SAFE FOR WORK (the INJURIES switch off): the fire is the gunfire's
// warning fire, never at him; the machine runs him down and, once he is
// slow or down and it is close, the crew get off and take him in on foot
// as the soldiers do (`army-ground.ts`' arrest).
//
// HIS ANSWER. The player skiing (or riding) into a machine's crew knocks
// them off — each man met as a person on foot (`foot.ts`' `meetPerson`),
// thrown, and up again as a soldier on the ground; hitting one is an
// offence (`hit-soldier`). The machine is left standing, and a machine of
// the army's left standing can be STOLEN (`ARMY_SLED_SOURCE`, through
// `steal.ts`), which is an offence too (`stole-snowmobile`). The skier is
// held out of every machine's hull.
//
// THE PURSUERS: every crew on the snow is written into
// `WantedState.pursuers` (ids from `ARMY_SLED.ids.pursuer`).
//
// Nothing here draws from any stream: a machine's side and its pauses are
// the parity of its id and the clock. `ArmyState.sleds` is empty on every
// run whose hunt never reached a star that sends them.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { waterWithin } from "../mapgen/real-water.ts";
import { meetBoxes, type StripBox } from "./airstrip-solids.ts";
import { chooseWay } from "./army-drive.ts";
import { enlist } from "./army-troop.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { ARMY_SLED } from "./defs/army-sled.ts";
import { SLED, sledMass } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { WANTED } from "./defs/wanted.ts";
import { meetPerson } from "./foot.ts";
import { armGun, disarmGun, fireAt } from "./gunfire.ts";
import { rideSled } from "./sled-body.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { sledPilot } from "./sled-pilot.ts";
import { parkedAt, sledBounds, sledControls, sledSolids, standSled } from "./sled.ts";
import { treesNear } from "./upright-grid.ts";
import { quarryOf, raiseHeat, rosterOf, seesQuarry } from "./wanted.ts";
import { windAt, type Wind } from "./wind.ts";
import type { ArmySled, ArmySledEvent, ArmyState } from "./army-state.ts";
import type { StealSource } from "./steal.ts";
import type { GameEvent, GameState, SledControls, SledState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const K = ARMY_SLED;
/** The crew's eyes over the machine's centre of gravity, m. */
const EYES = 1.0;
/** A soldier stepping off is put down this far out to the side, m. */
const STEP_OFF = 1.3;
/** A snowmobile's crew, once off it, are a squad numbered past this. */
export const SLED_SQUAD = 20_000;
/** The machine, its two men with their kit, and the gun and the packs. */
const MASS = sledMass(K.crew * ARMY_GROUND.mass + K.load);
const STOP: SledControls = { throttle: 0, brake: 1, steer: 0, lean: 0 };
const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
const trunks: number[] = [];

type V = { x: number; y: number; z: number };

function say(
  state: GameState,
  events: GameEvent[],
  change: ArmySledEvent["change"],
  m: ArmySled,
): void {
  const b = m.body;
  events.push({ kind: "army-sled", t: state.t, change, id: m.id, x: b.x, y: b.y, z: b.z });
}

/** A point of the machine's body frame (`ARMY_SLED`'s seats, its muzzle)
 * in the world. */
export function sledPoint(b: Pick<SledState, "x" | "y" | "z" | "q">, p: V): V {
  const w = rotate(b.q, p);
  return { x: b.x + w.x, y: b.y + w.y, z: b.z + w.z };
}

/** Whether a machine carries its crew: on its way, after him or halted. */
export const crewed = (m: ArmySled): boolean =>
  m.mode === "due" || m.mode === "drive" || m.mode === "halt" || m.mode === "leave";

const gunOf = (m: ArmySled): number => K.ids.gun + m.id;

/** How the hunted man moves, m/s: his body's way, or the machine's he
 * rides. */
function quarryWay(state: GameState): { x: number; z: number } {
  const m =
    (state.heli?.rider && state.heli) ||
    (state.plane?.rider && state.plane) ||
    (state.sled?.rider && state.sled) ||
    null;
  const c = m ?? state.skier.thrown ?? state.skier;
  return { x: c.vx, z: c.vz };
}

// ─── the call ──────────────────────────────────────────────────────────

/** WHERE THE `k`TH MACHINE CALLED STANDS in the village: beside the
 * snowmobile's spot (`sledSpotOf`), out to alternate sides of it `apart`
 * m a place, on the first open, dry snow — facing the way the free ride's
 * is parked, up the mountain. */
export function sledPad(
  level: GameState["level"],
  k: number,
): { x: number; z: number; heading: number } {
  const spot = sledSpotOf(level);
  const rx = Math.cos(spot.heading);
  const rz = -Math.sin(spot.heading);
  const side = k % 2 === 0 ? 1 : -1;
  const rank = 1 + Math.floor((k % 6) / 2);
  for (let tries = 0; tries < 8; tries++) {
    const r = side * (K.apart * (rank + tries) + 2);
    const x = spot.x + rx * r;
    const z = spot.z + rz * r;
    const room = treesNear(level, x, z, 3, trunks).length === 0;
    if (room && !waterWithin(level.water, x, z, 3)) return { x, z, heading: spot.heading };
  }
  return { x: spot.x, z: spot.z, heading: spot.heading };
}

/** CALL IN what the roster asks for; send home what it no longer does. */
function call(state: GameState, a: ArmyState, want: number, events: GameEvent[]): void {
  let live = 0;
  for (const m of a.sleds) {
    if (m.mode !== "due" && m.mode !== "drive" && m.mode !== "halt") continue;
    if (live >= want) {
      if (m.mode === "due") m.mode = "gone";
      else goHome(state, m);
      continue;
    }
    live++;
  }
  let waiting = a.sleds.filter((m) => m.mode === "due").length;
  while (live < want) {
    const id = a.nextSled++;
    const pad = sledPad(state.level, a.sledsCalled);
    const body = parkedAt(state, pad.x, pad.z, pad.heading);
    const m: ArmySled = {
      id,
      mode: "due",
      due: state.t + K.respond + K.stagger * waiting,
      t: 0,
      body,
      home: { x: pad.x, z: pad.z },
      way: pad.heading,
      pace: 0,
      aimYaw: 0,
      aimPitch: 0,
      bursts: 0,
      next: 0,
      saw: -Infinity,
      driver: true,
      gunner: true,
      wx: pad.x,
      wz: pad.z,
      wt: 0,
      slow: 0,
      side: id % 2 === 0 ? 1 : -1,
      until: 0,
      dug: 0,
    };
    a.sleds.push(m);
    a.sledsCalled++;
    waiting++;
    live++;
    say(state, events, "called", m);
  }
}

/** OUT OF THE VILLAGE: the engine started, the nose turned at him. */
function setOff(state: GameState, m: ArmySled, events: GameEvent[]): void {
  const b = m.body;
  const q = quarryOf(state);
  m.way = Math.atan2(q.x - b.x, q.z - b.z);
  standSled(state, b, b.x, b.z, m.way);
  b.running = true;
  b.rider = true;
  b.mode = "ridden";
  b.rpm = SLED.idleRpm;
  m.mode = "drive";
  m.t = 0;
  m.wx = b.x;
  m.wz = b.z;
  m.wt = state.t;
  m.next = state.t + 4;
  say(state, events, "out", m);
}

function goHome(state: GameState, m: ArmySled): void {
  m.mode = "leave";
  m.t = 0;
  disarmGun(state, gunOf(m));
}

// ─── reading the snow ──────────────────────────────────────────────────

/** THE WAY TO STEER: the cheapest of the fan either side of the way to him
 * (and the way it holds), read off the snow as every army machine reads
 * it (`army-drive.ts`), and whether it is among trees. */
function steerWay(state: GameState, m: ArmySled, want: number): boolean {
  const c = chooseWay(state, m.body.x, m.body.z, m.way, want, K.terrain, K.drive, K.terrain.trunk);
  m.way = c.way;
  return c.woods;
}

// ─── the crew's eyes ───────────────────────────────────────────────────

/** Whether the crew see him now: looked every quarter second, each machine
 * in its own turn, and remembered half a second. */
function looks(state: GameState, m: ArmySled, q: V): boolean {
  const L = WANTED.lookEvery;
  const turn = (state.t + (m.id % 8) * (L / 8)) % L;
  if (turn < dt) {
    const b = m.body;
    const p = { kind: "snowmobile" as const, x: b.x, y: b.y + EYES, z: b.z };
    if (seesQuarry(state.level, p, q)) m.saw = state.t;
  }
  return state.t - m.saw < 0.5;
}

// ─── the drive ─────────────────────────────────────────────────────────

/** ONE STEP OF THE BODY under `ctl`: the snow, the trunks, the edge — and
 * righted by its crew once it has lain on its side. */
function drive(state: GameState, m: ArmySled, ctl: SledControls): void {
  const b = m.body;
  windAt(state.level, state.t, wind);
  rideSled(b, ctl, MASS, state, wind);
  sledSolids(state, b);
  sledBounds(state, b);
  const up = rotate(b.q, { x: 0, y: 1, z: 0 });
  b.overFor = up.y < Math.cos(SLED.crash.over) ? b.overFor + dt : 0;
  if (b.overFor > K.over.right) {
    standSled(state, b, b.x, b.z, b.heading);
    m.next = Math.max(m.next, state.t + K.over.rest);
  }
}

/** The hands toward (x, z) at `pace` m/s, the way chosen by the snow. */
function handsTo(state: GameState, m: ArmySled, pace: number): SledControls {
  const b = m.body;
  if (pace < 0.5) return { ...STOP, steer: 0 };
  // Aimed well out along the way, so the hands hold the pace asked.
  const aim = { x: b.x + Math.sin(m.way) * 90, z: b.z + Math.cos(m.way) * 90, cruise: pace };
  return sledControls(sledPilot(state, aim, b));
}

/** Braked to a stop, the bars turned to bring the nose round to `face`. */
function haltOn(m: ArmySled, face: number): SledControls {
  const off = angleDiff(m.body.heading, face);
  return {
    throttle: m.body.speed < 0.6 && Math.abs(off) > 0.5 ? 0.25 : 0,
    brake: 1,
    steer: clamp(off * 2, -1, 1),
    lean: 0,
  };
}

/** NOT GETTING STUCK: progress checked a window at a time; a swing off to
 * a side, then dug out and stood on open snow facing him. */
function watch(state: GameState, m: ArmySled, want: number, events: GameEvent[]): void {
  const S = K.stuck;
  if (state.t - m.wt < S.window) return;
  const b = m.body;
  const moved = hypot(b.x - m.wx, b.z - m.wz);
  m.wx = b.x;
  m.wz = b.z;
  m.wt = state.t;
  if (moved >= S.least) {
    m.slow = 0;
    return;
  }
  m.slow++;
  if (m.slow === 1) {
    m.side = -m.side;
    m.until = state.t + S.detour;
    return;
  }
  // DUG OUT: back along the way it came, on the first open snow found.
  const back = b.heading + Math.PI;
  let at = { x: b.x, z: b.z };
  for (let k = 1; k <= 4; k++) {
    const r = S.dig * k;
    const x = b.x + Math.sin(back) * r;
    const z = b.z + Math.cos(back) * r;
    if (treesNear(state.level, x, z, 3, trunks).length === 0) {
      at = { x, z };
      break;
    }
  }
  standSled(state, b, at.x, at.z, want);
  b.running = true;
  b.rider = true;
  m.way = want;
  m.dug++;
  m.until = state.t + S.detour;
  say(state, events, "dug", m);
}

/** Stood off him on purpose, or halted: not stuck — the watch starts its
 * window again from here. */
function rest(state: GameState, m: ArmySled): void {
  m.wt = state.t;
  m.wx = m.body.x;
  m.wz = m.body.z;
  m.slow = 0;
}

/** THE CHASE: the way to him read off the snow, the pace by the woods and
 * by how near he is, a short halt to fire when he is in sight and range —
 * or, with SAFE FOR WORK on and him slow or down, the crew off to take him
 * in. */
function chase(
  state: GameState,
  a: ArmyState,
  m: ArmySled,
  w: WantedState,
  q: V,
  fire: "hold" | "warn" | "aim",
  events: GameEvent[],
): void {
  const b = m.body;
  const sees = looks(state, m, q);
  const v = quarryWay(state);
  const D = K.drive;
  const to = sees || w.seen ? { x: q.x + v.x * D.lead, z: q.z + v.z * D.lead } : w.lastSeen;
  const d = hypot(q.x - b.x, q.z - b.z);
  const toward = Math.atan2(to.x - b.x, to.z - b.z);
  // SAFE FOR WORK: run down, and taken in on foot.
  if (!w.lethal) {
    const c = state.skier;
    const slow = !!c.thrown || hypot(c.vx, c.vz) < ARMY_GROUND.arrest.speed;
    if (sees && slow && d < K.stand.dismount && b.speed < 3 && !state.sled?.rider) {
      dismount(state, a, m, events);
      return;
    }
  }
  // THE SHORT HALT — never at a man already down.
  const H = K.halt;
  const down = !!state.skier.thrown;
  if (sees && !down && fire !== "hold" && d < H.range && d > H.least && state.t >= m.next) {
    if (w.lethal || d > K.stand.sfw * 3) {
      m.mode = "halt";
      m.t = 0;
      m.bursts = 0;
      say(state, events, "halt", m);
      drive(state, m, haltOn(m, toward - H.side));
      return;
    }
  }
  if (Math.floor(state.t / D.decide) !== Math.floor((state.t - dt) / D.decide)) {
    const woods = steerWay(state, m, toward);
    m.pace = woods ? D.woods : D.cruise;
  }
  // Swung off to a side, it holds that side a while.
  if (state.t < m.until) m.way = toward + m.side * 1.3;
  const stand = w.lethal ? K.stand.lethal : K.stand.sfw;
  // Eased from its pace to a crawl over the last `slow` m to where it
  // stands off him — and stopped there while its crew have him in sight.
  const pace =
    sees && d < stand
      ? 0
      : Math.min(m.pace, D.close + (m.pace - D.close) * clamp((d - stand) / D.slow, 0, 1));
  drive(state, m, handsTo(state, m, pace));
  if (pace > 2) watch(state, m, toward, events);
  else rest(state, m);
}

/** THE HALT: stopped broadside to him, the gun laid on him and fired a few
 * bursts — then on again. */
function halt(state: GameState, m: ArmySled, w: WantedState, q: V): void {
  const b = m.body;
  const H = K.halt;
  const sees = looks(state, m, q);
  const face = Math.atan2(q.x - b.x, q.z - b.z) - H.side;
  drive(state, m, haltOn(m, face));
  const muzzle = sledPoint(b, K.gun.muzzle);
  const flat = hypot(q.x - muzzle.x, q.z - muzzle.z);
  const yaw = clamp(
    angleDiff(b.heading, Math.atan2(q.x - muzzle.x, q.z - muzzle.z)),
    -K.gun.arc,
    K.gun.arc,
  );
  const pitch = clamp(
    Math.atan2(q.y + WANTED.line.chest - muzzle.y, flat) - b.pitch,
    K.gun.low,
    K.gun.high,
  );
  const turn = K.gun.turn * dt;
  m.aimYaw += clamp(yaw - m.aimYaw, -turn, turn);
  m.aimPitch += clamp(pitch - m.aimPitch, -turn, turn);
  const over =
    m.t > H.hold || m.bursts >= H.bursts || (!sees && state.t - m.saw > H.lost) || !m.gunner;
  if (over || w.ended !== null) {
    m.mode = "drive";
    m.t = 0;
    m.next = state.t + H.move + H.spread * ((m.id * 0.618) % 1);
    rest(state, m);
    return;
  }
  if (m.t < H.settle || b.speed > H.still || !sees) return;
  if (Math.abs(m.aimYaw - yaw) > 0.05) return;
  const gun = armGun(state, gunOf(m), "lmg", muzzle.x, muzzle.y, muzzle.z);
  carry(gun, b, muzzle);
  if (fireAt(state, gun, { kind: "quarry" })) m.bursts++;
}

/** The gun at the muzzle as the machine moves (a burst may still be going). */
function carry(
  gun: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  b: SledState,
  at: V,
): void {
  gun.x = at.x;
  gun.y = at.y;
  gun.z = at.z;
  gun.vx = b.vx;
  gun.vy = b.vy;
  gun.vz = b.vz;
}

/** HOME: back to the village it came from, and gone there. */
function home(state: GameState, m: ArmySled, events: GameEvent[]): void {
  const b = m.body;
  const d = hypot(m.home.x - b.x, m.home.z - b.z);
  if (d < K.gone || m.t > K.home) {
    m.mode = "gone";
    say(state, events, "gone", m);
    return;
  }
  const toward = Math.atan2(m.home.x - b.x, m.home.z - b.z);
  if (Math.floor(state.t / K.drive.decide) !== Math.floor((state.t - dt) / K.drive.decide)) {
    const woods = steerWay(state, m, toward);
    m.pace = woods ? K.drive.woods : K.drive.cruise;
  }
  if (state.t < m.until) m.way = toward + m.side * 1.3;
  drive(state, m, handsTo(state, m, d < 60 ? K.drive.close : m.pace));
  watch(state, m, toward, events);
}

// ─── the crew off it ───────────────────────────────────────────────────

/** Where a seat is, world frame, m. */
function seatOf(m: ArmySled, seat: "driver" | "gunner"): V {
  return sledPoint(m.body, K.seats[seat]);
}

/** A man off the machine onto the snow beside it, a soldier on the ground
 * from now on (`army-ground.ts`). */
function stepOff(
  state: GameState,
  a: ArmyState,
  m: ArmySled,
  seat: "driver" | "gunner",
  mode: "chase" | "down",
): void {
  const b = m.body;
  const p = seatOf(m, seat);
  const out = seat === "driver" ? -1 : 1;
  const rx = Math.cos(b.heading) * out;
  const rz = -Math.sin(b.heading) * out;
  const x = mode === "down" ? p.x : p.x + rx * STEP_OFF;
  const z = mode === "down" ? p.z : p.z + rz * STEP_OFF;
  const s = enlist(state, a, "rifle", "sled", SLED_SQUAD + m.id, mode, x, z, b.heading);
  s.next = state.t + 1 + (s.id % 4) * 0.5;
  m[seat] = false;
}

/** THE CREW OFF TO TAKE HIM IN (SAFE FOR WORK on): both men on the snow,
 * after him on foot, the machine left standing. */
function dismount(state: GameState, a: ArmyState, m: ArmySled, events: GameEvent[]): void {
  if (m.driver) stepOff(state, a, m, "driver", "chase");
  if (m.gunner) stepOff(state, a, m, "gunner", "chase");
  leaveEmpty(state, m);
  say(state, events, "dismount", m);
}

/** The machine left standing, its engine idling and its gun put away. */
function leaveEmpty(state: GameState, m: ArmySled): void {
  m.mode = "empty";
  m.t = 0;
  m.body.rider = false;
  disarmGun(state, gunOf(m));
}

/** THE PLAYER INTO A MACHINE'S CREW: each man on it met as a person on foot
 * (`meetPerson`) — struck past the strike, he is thrown off and comes down
 * a soldier on the ground; the other gets off after him, and the machine
 * is left standing. Hitting one is an offence. */
function knock(state: GameState, a: ArmyState, m: ArmySled, events: GameEvent[]): void {
  const b = m.body;
  const c = state.skier;
  if (Math.abs(c.x - b.x) > 5 || Math.abs(c.z - b.z) > 5) return;
  let struck = false;
  for (const seat of ["driver", "gunner"] as const) {
    if (!m[seat]) continue;
    // Struck where he is reached: his leg down the machine's side nearer
    // the skier (the hull holds the skier off its middle).
    const s0 = seatOf(m, seat);
    const rx = Math.cos(b.heading);
    const rz = -Math.sin(b.heading);
    const side = (c.x - b.x) * rx + (c.z - b.z) * rz >= 0 ? 1 : -1;
    const p = {
      x: s0.x + rx * side * K.hull.halfWidth,
      y: s0.y,
      z: s0.z + rz * side * K.hull.halfWidth,
    };
    // The person on foot he is struck as is keyed by the soldier he will
    // be: the army's next.
    const key = ARMY_GROUND.ids.key + a.nextSoldier;
    const feet = state.level.groundAt(p.x, p.z);
    if (
      !meetPerson(state, events, key, "soldier", "man", p.x, feet, p.z, b.heading, ARMY_GROUND.mass)
    )
      continue;
    stepOff(state, a, m, seat, "down");
    struck = true;
    a.crewsDown++;
    raiseHeat(state, "hit-soldier");
  }
  if (!struck) return;
  if (m.driver) stepOff(state, a, m, "driver", "chase");
  if (m.gunner) stepOff(state, a, m, "gunner", "chase");
  leaveEmpty(state, m);
  say(state, events, "knocked", m);
}

const hulls: StripBox[] = [];

/** THE SKIER HELD OUT OF EVERY MACHINE'S HULL. */
function holdOff(state: GameState, a: ArmyState, events: GameEvent[]): void {
  const c = state.skier;
  if (c.thrown || state.sled?.rider || state.heli?.rider || state.plane?.rider) return;
  hulls.length = 0;
  const H = K.hull;
  for (const m of a.sleds) {
    if (m.mode === "due" || m.mode === "gone") continue;
    const b = m.body;
    if (Math.abs(c.x - b.x) > 6 || Math.abs(c.z - b.z) > 6) continue;
    const g = state.level.groundAt(b.x, b.z);
    hulls.push({
      x: b.x,
      z: b.z,
      dx: Math.sin(b.heading),
      dz: Math.cos(b.heading),
      halfLength: H.halfLength,
      halfWidth: H.halfWidth,
      base: g - 0.3,
      top: g + H.height,
      stuff: "steel",
    });
  }
  if (hulls.length) meetBoxes(state, hulls, events);
}

// ─── the step ──────────────────────────────────────────────────────────

/** THE ARMY'S SNOWMOBILES' STEP, on a hunted run: the call, every machine
 * driven, halted, fired, knocked or sent home, the skier held out of
 * them, and the pursuers written. After the soldiers, before the gunfire. */
export function stepArmySleds(state: GameState, events: GameEvent[]): void {
  const a = state.army;
  const w = state.wanted;
  if (!a || a.home || !w) return;
  const on = w.ended === null && w.stars > 0;
  const roster = rosterOf(on ? w.stars : 0);
  // The roster's, and the ground waves' on top (`army-wave.ts`).
  const want = roster.snowmobiles + (on ? a.waveSleds : 0);
  if (a.sleds.length === 0 && want === 0) return;
  call(state, a, want, events);
  const q = quarryOf(state);
  for (const m of a.sleds) {
    m.t += dt;
    switch (m.mode) {
      case "due":
        if (state.t >= m.due) setOff(state, m, events);
        break;
      case "drive":
        if (!on) goHome(state, m);
        else chase(state, a, m, w, q, roster.fire, events);
        break;
      case "halt":
        halt(state, m, w, q);
        break;
      case "leave":
        home(state, m, events);
        break;
      case "empty":
        // Left standing on its parking brake, settling into the snow.
        drive(state, m, STOP);
        if (!on && hypot(q.x - m.body.x, q.z - m.body.z) > 300) m.mode = "gone";
        break;
      default:
        break;
    }
    if (m.mode === "drive" || m.mode === "halt") knock(state, a, m, events);
    if (m.mode !== "halt") {
      const gun = state.gunfire?.guns.find((g) => g.id === gunOf(m));
      if (gun && m.gunner && crewed(m)) carry(gun, m.body, sledPoint(m.body, K.gun.muzzle));
      // At rest off the halt, the gun eased back off the nose.
      m.aimYaw *= 1 - Math.min(1, dt * 2);
      m.aimPitch *= 1 - Math.min(1, dt * 2);
    }
  }
  // Machines left standing past the most kept: the oldest let go.
  const empty = a.sleds.filter((m) => m.mode === "empty");
  for (let i = 0; i < empty.length - K.empty; i++) empty[i].mode = "gone";
  holdOff(state, a, events);
  for (const m of a.sleds) if (m.mode === "gone") disarmGun(state, gunOf(m));
  a.sleds = a.sleds.filter((m) => m.mode !== "gone");
  writeCrews(a, w);
}

/** WRITE THE CREWS into the wanted level's pursuers: every machine on the
 * snow with its crew on it. */
function writeCrews(a: ArmyState, w: WantedState): void {
  const lo = K.ids.pursuer;
  const kept = w.pursuers.filter((p) => p.id < lo || p.id >= lo + 1000);
  for (const m of a.sleds) {
    if (m.mode !== "drive" && m.mode !== "halt") continue;
    const b = m.body;
    kept.push({ id: lo + (m.id % 1000), kind: "snowmobile", x: b.x, y: b.y + EYES, z: b.z });
  }
  w.pursuers = kept;
}

/** The army's snowmobiles out of the village, for the drawing, the ear and
 * the labs. */
export function armySleds(state: GameState): readonly ArmySled[] {
  return state.army?.sleds.filter((m) => m.mode !== "due") ?? [];
}

/** THE ARMY'S SNOWMOBILES as a source of machines to take (`steal.ts`):
 * each one left standing empty, its door its middle; taken, it is gone
 * from the army's (and a theft is an offence: `stole-snowmobile`). Index
 * its id. */
export const ARMY_SLED_SOURCE: StealSource = {
  id: "army",
  parked(state, out) {
    const a = state.army;
    if (!a?.sleds.length || !state.sled) return;
    for (const m of a.sleds) {
      const b = m.body;
      if (m.mode !== "empty" || b.speed > 1) continue;
      out.push({
        kind: "sled",
        livery: "army",
        from: "army",
        index: m.id,
        x: b.x,
        y: state.level.groundAt(b.x, b.z),
        z: b.z,
        heading: b.heading,
        pitch: 0,
        roll: 0,
        door: { x: b.x, z: b.z },
        reach: SLED.board.reach,
        fastest: SLED.board.fastest,
        spool: 0,
      });
    }
  },
  taken(state, index) {
    const a = state.army;
    const m = a?.sleds.find((k) => k.id === index);
    if (!a || !m) return;
    m.mode = "gone";
    a.sledsTaken++;
    state.events.push({
      kind: "army-sled",
      t: state.t,
      change: "stolen",
      id: m.id,
      x: m.body.x,
      y: m.body.y,
      z: m.body.z,
    });
  },
};
