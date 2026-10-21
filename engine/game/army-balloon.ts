// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S BALLOONS — the game's own hot-air balloon (`BALLOON`), let go
// upwind of the hunted man and drifted in over the mountain to him, the
// soldiers in its basket firing shoulder-launched rockets down at him.
//
// THE FLIGHT is the free ride's balloon's (`flyBalloon`): the envelope's
// heat off the burner and the fabric's loss, the lift of the air it
// displaces, the drift on the up-valley wind (`balloon-air.ts`), the snow
// and the crowns — with its crew's weight in the basket
// (`BalloonState.crew`) and its events kept to itself. Its pilot's hands
// are the free ride's bot's (`balloonHands`): burns read against the trim
// to hold a height over the snow ahead.
//
// STEERING BY HEIGHT. A balloon has nothing to turn it; its pilot climbs or
// sinks into the layer whose wind carries it where he wants to go — the
// wind veers with height (`BALLOON_AIR.veer`). Every `height.pick` s the
// pilot reads the wind at `layers` heights and holds the one whose drift
// points nearest him. The army lets it go `upwind` m up the wind from him,
// already flying, so the day's wind brings it to him; and a balloon is not
// flown in a wind past `most` — none is called.
//
// THE ROCKETS. The men in the basket take it in turns: one fires every
// `fire.every` s while he is within `fire.range` and in sight from the
// basket — through the gunfire layer (`WEAPONS.rocket`: a visible rocket,
// its motor's smoke, a flight of a second or two, its burst through
// `blastAt`). Where the army shoots to kill a rocket is laid on the snow
// at his feet and its blast throws him; with SAFE FOR WORK on it is laid
// `fire.warn` m to a side of him, never at him. A burst near one of the
// army's own vehicles knocks it out (`army-burst.ts`).
//
// LEAVING. Drifted `leave.past` m beyond him downwind it is out of the
// fight: it climbs away and is taken off once well clear; another is
// called upwind if the roster still asks. A balloon crashed or burnt of
// its own accord is counted (`balloonsLost`) — a fault the labs hold at
// nought.
//
// BROUGHT DOWN (`tearBalloon`). A rocket's or a shell's burst near its
// envelope or its basket, or a stolen helicopter's blades through the
// cloth, tears it — holes the hot air pours out of, and with the INJURIES
// on the cloth alight (the free ride's own fire, `flyBalloon`). Its pilot
// shuts the burner and it sinks (`fallBalloon`); a basket that meets the
// snow no harder than a landing puts its rocketeers out on foot, after
// him with the rest. Brought down by him, it raises the heat as a
// soldier hit does.
//
// Nothing here draws from any stream: the layer, the turn and the warning
// side are pure functions of the state and the balloon's id.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_AIR } from "./defs/army-air.ts";
import { BALLOON, BALLOON_CENTRE } from "./defs/balloon.ts";
import { TUNING } from "./defs/tuning.ts";
import { balloonWindAt } from "./balloon-air.ts";
import { balloonTrim, flyBalloon } from "./balloon.ts";
import { balloonHands } from "./balloon-pilot.ts";
import { armGun, disarmGun, fireAt, gunReady } from "./gunfire.ts";
import { enlist } from "./army-troop.ts";
import { HELI } from "./defs/heli.ts";
import { treesNear } from "./upright-grid.ts";
import { quarryOf, raiseHeat, seesQuarry, underCover } from "./wanted.ts";
import type { Wind } from "./wind.ts";
import type { ArmyAirEvent, ArmyAirState, ArmyBalloon } from "./army-air-state.ts";
import type { BalloonState, GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const K = ARMY_AIR.balloon;
const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
const trunks: number[] = [];
/** The balloon's own events, kept from the run's (`flyBalloon` says them). */
const own: GameEvent[] = [];
/** A rocketeer's launcher, over the basket's floor, m. */
const SHOULDER = 1.55;

type V = { x: number; y: number; z: number };

function say(
  state: GameState,
  events: GameEvent[],
  change: ArmyAirEvent["change"],
  m: ArmyBalloon,
): void {
  const b = m.body;
  events.push({
    kind: "army-air",
    t: state.t,
    change,
    craft: "balloon",
    id: m.id,
    x: b.x,
    y: b.y,
    z: b.z,
  });
}

/** The rocketeer's gun in seat `seat` of balloon `m`. */
export const rocketGun = (m: ArmyBalloon, seat: number): number =>
  ARMY_AIR.ids.gun + 5000 + 4 * m.id + seat;

/** A BALLOON'S BODY flying at (x, y, z), its envelope at the trim. */
function bodyAt(state: GameState, x: number, y: number, z: number, crew: number): BalloonState {
  const b: BalloonState = {
    mode: "flown",
    aboard: false,
    crew,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    lean: 0,
    leanTo: 0,
    ambient: 0,
    temp: 0,
    density: 1,
    valve: false,
    flame: 0,
    pilot: true,
    fuel: BALLOON.mass.fuel,
    vent: 0,
    windX: 0,
    windZ: 0,
    wind: 0,
    shear: 0,
    rise: 0,
    lift: 0,
    climb: 0,
    agl: y - state.level.groundAt(x, z),
    grounded: false,
    dragging: false,
    scorch: 0,
    burning: false,
    burnt: 0,
    deflate: 0,
    walkX: 0,
    walkZ: 0,
    face: 0,
    t: 0,
    airTime: 0,
    wreck: false,
    start: { x, z, heading: 0 },
  };
  b.temp = balloonTrim(state, b);
  return b;
}

/** A balloon called, its `rocketeers` aboard, let go at run time `due`
 * (where is read then — it is let go upwind of where he is). */
export function freshArmyBalloon(
  state: GameState,
  id: number,
  due: number,
  rocketeers: number,
): ArmyBalloon {
  const n = Math.max(1, rocketeers);
  return {
    id,
    mode: "due",
    due,
    t: 0,
    body: bodyAt(state, 0, 0, 0, (n + 1) * K.man),
    crew: Array.from({ length: n }, () => ({ aimH: 0, aimP: -0.3, fired: -Infinity })),
    hold: (K.height.low + K.height.high) / 2,
    picked: -Infinity,
    next: due,
    seat: 0,
    saw: -Infinity,
    lost: false,
    downed: false,
  };
}

/** LET GO upwind of him at the height it will hold, drifting with the
 * wind there. */
export function launchBalloon(state: GameState, m: ArmyBalloon, events: GameEvent[]): void {
  const level = state.level;
  const q = quarryOf(state);
  const hold = m.hold;
  balloonWindAt(level, state.t, q.x, level.groundAt(q.x, q.z) + hold + BALLOON_CENTRE, q.z, wind);
  const s = Math.max(0.1, wind.speed);
  // Each one let go a little to the side of the last, by its id.
  const side = ((m.id % 3) - 1) * 120;
  const ux = wind.x / s;
  const uz = wind.z / s;
  const edge = 120;
  const x = clamp(q.x - ux * K.upwind + uz * side, edge, level.size - edge);
  const z = clamp(q.z - uz * K.upwind - ux * side, edge, level.size - edge);
  const y = Math.max(level.groundAt(x, z) + hold, clearOver(state, x, z));
  const crew = m.body.crew ?? 0;
  m.body = bodyAt(state, x, y, z, crew);
  balloonWindAt(level, state.t, x, y + BALLOON_CENTRE, z, wind);
  m.body.vx = wind.x;
  m.body.vz = wind.z;
  m.body.heading = Math.atan2(q.x - x, q.z - z);
  m.mode = "fly";
  m.t = 0;
  m.next = state.t + 6;
  say(state, events, "out", m);
}

/** The least height over the snow and the crowns at (x, z), m. */
function clearOver(state: GameState, x: number, z: number): number {
  const level = state.level;
  let top = level.groundAt(x, z) + K.height.floor;
  for (const i of treesNear(level, x, z, 12, trunks)) {
    const t = level.trees[i];
    top = Math.max(top, t.y + t.height + K.height.crowns);
  }
  return top;
}

/** THE LAYER: the height over the snow whose wind carries it nearest him. */
function pickLayer(state: GameState, m: ArmyBalloon, to: V): number {
  const level = state.level;
  const b = m.body;
  const H = K.height;
  const want = Math.atan2(to.x - b.x, to.z - b.z);
  const ground = level.groundAt(b.x, b.z);
  let best = m.hold;
  let off = Infinity;
  for (let i = 0; i < H.layers; i++) {
    const h = H.low + ((H.high - H.low) * i) / (H.layers - 1);
    balloonWindAt(level, state.t, b.x, ground + h + BALLOON_CENTRE, b.z, wind);
    if (wind.speed < 0.05) continue;
    // A little cost for climbing far from where it is: the burns take time.
    const d = Math.abs(angleDiff(want, Math.atan2(wind.x, wind.z))) + Math.abs(h - b.agl) * 0.0008;
    if (d < off) {
      off = d;
      best = h;
    }
  }
  return best;
}

/** ONE STEP OF THE BURNER AND THE DRIFT, holding `hold` m over the snow
 * ahead and the crowns under it. */
function drift(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  hold: number,
  events: GameEvent[],
): void {
  const b = m.body;
  const over = Math.max(hold, clearOver(state, b.x, b.z) - state.level.groundAt(b.x, b.z));
  const hands = balloonHands(state, b, over);
  own.length = 0;
  flyBalloon(state, b, hands.tuck >= BALLOON.burner.open, hands.brake, own);
  for (const e of own) {
    if (e.kind !== "balloon") continue;
    if (e.phase === "crash" || e.phase === "fire") {
      if (!m.lost && !m.downed) {
        m.lost = true;
        air.balloonsLost++;
        say(state, events, "crash", m);
      }
      m.mode = "down";
      m.t = 0;
    }
  }
}

/** FLY ONE BALLOON ON THE HUNT: the layer picked toward him, the drift,
 * the rockets — and turned for home once it has drifted past him. */
export function huntBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  w: WantedState,
  events: GameEvent[],
): void {
  const q = quarryOf(state);
  const to = w.seen ? q : w.lastSeen;
  if (state.t - m.picked >= K.height.pick) {
    m.picked = state.t;
    m.hold = pickLayer(state, m, to);
  }
  drift(state, air, m, m.hold, events);
  if (m.mode !== "fly") return;
  const b = m.body;
  b.heading += clamp(angleDiff(b.heading, Math.atan2(q.x - b.x, q.z - b.z)), -0.002, 0.002);
  fireRockets(state, air, m, w, q, events);
  // PAST HIM downwind: out of the fight.
  const s = Math.max(0.1, hypot(b.vx, b.vz));
  const ahead = ((to.x - b.x) * b.vx + (to.z - b.z) * b.vz) / s;
  if (ahead < -K.leave.past) {
    m.mode = "leave";
    m.t = 0;
  }
}

/** FLY ONE HOME: up and away on the wind, and gone once well clear of him
 * or at the map's edge. */
export function leaveBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  events: GameEvent[],
): void {
  for (let i = 0; i < m.crew.length; i++) disarmGun(state, rocketGun(m, i));
  drift(state, air, m, K.leave.height, events);
  const b = m.body;
  const q = quarryOf(state);
  const size = state.level.size;
  const edge = 40;
  if (
    hypot(b.x - q.x, b.z - q.z) > K.leave.gone ||
    b.x < edge ||
    b.z < edge ||
    b.x > size - edge ||
    b.z > size - edge
  ) {
    m.mode = "gone";
    say(state, events, "gone", m);
  }
}

/** ON THE SNOW: it lies there a while and is taken off. */
export function downBalloon(state: GameState, m: ArmyBalloon, events: GameEvent[]): void {
  for (let i = 0; i < m.crew.length; i++) disarmGun(state, rocketGun(m, i));
  const b = m.body;
  b.mode = "down";
  b.deflate = Math.min(1, b.deflate + TUNING.dt / BALLOON.land.deflate);
  b.flame = 0;
  b.valve = false;
  if (m.t > 60) {
    m.mode = "gone";
    say(state, events, "gone", m);
  }
}

/** THE ROCKETS: every man aimed at him, and the next in turn fires when he
 * is in reach and in sight and the last rocket is far enough behind. */
function fireRockets(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  w: WantedState,
  q: V,
  events: GameEvent[],
): void {
  const b = m.body;
  const lethal = w.lethal;
  // SAFE FOR WORK: a spot on the snow to a side of him, the side and the
  // distance off the balloon's id and its rockets fired.
  let tx = q.x;
  let tz = q.z;
  if (!lethal) {
    const n = air.rockets + m.id;
    const across = Math.atan2(q.x - b.x, q.z - b.z) + Math.PI / 2;
    const side = n % 2 === 0 ? 1 : -1;
    const r = K.fire.warn.near + (K.fire.warn.far - K.fire.warn.near) * ((n * 0.618) % 1);
    tx += Math.sin(across) * r * side;
    tz += Math.cos(across) * r * side;
  }
  const ty = state.level.groundAt(tx, tz);
  for (const c of m.crew) {
    c.aimH = Math.atan2(tx - b.x, tz - b.z);
    c.aimP = Math.atan2(ty - (b.y + SHOULDER), hypot(tx - b.x, tz - b.z));
  }
  if (w.ended !== null || state.t < m.next) return;
  if (hypot3(q.x - b.x, q.y - b.y, q.z - b.z) > K.fire.range) return;
  const eye = { kind: "balloon" as const, x: b.x, y: b.y + SHOULDER, z: b.z };
  if (!seesQuarry(state.level, eye, q, underCover(state))) return;
  m.saw = state.t;
  const seat = m.seat % m.crew.length;
  const c = m.crew[seat];
  // At the basket's rim on his side, the launcher over it.
  const rim = BALLOON.basket.width / 2;
  const sx = b.x + Math.sin(c.aimH) * rim;
  const sz = b.z + Math.cos(c.aimH) * rim;
  const gun = armGun(state, rocketGun(m, seat), "rocket", sx, b.y + SHOULDER, sz);
  gun.x = sx;
  gun.y = b.y + SHOULDER;
  gun.z = sz;
  gun.vx = b.vx;
  gun.vy = b.vy;
  gun.vz = b.vz;
  if (!gunReady(gun)) return;
  const target = lethal
    ? ({ kind: "quarry" } as const)
    : ({ kind: "point", x: tx, y: ty, z: tz } as const);
  if (fireAt(state, gun, target)) {
    c.fired = state.t;
    air.rockets++;
    m.seat++;
    m.next = state.t + K.fire.every;
    say(state, events, "rocket", m);
  }
}

/** A balloon's men on foot are a squad numbered past this (and past the
 * paramotors' `AIR_SQUAD` + n). */
export const BALLOON_SQUAD = 61_000;

/** THE ENVELOPE TORN: holes the hot air pours out of, alight with the
 * INJURIES on; the guns put down and the burner shut. `why`: a burst (the
 * army's own, no heat) or his helicopter's blades. */
export function tearBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  why: "burst" | "ram",
  events: GameEvent[],
): void {
  if (m.downed || (m.mode !== "fly" && m.mode !== "leave")) return;
  const D = K.downed;
  const b = m.body;
  m.downed = true;
  m.mode = "fall";
  m.t = 0;
  for (let i = 0; i < m.crew.length; i++) disarmGun(state, rocketGun(m, i));
  b.burnt = Math.max(b.burnt, D.torn);
  if (state.rules.sfw !== true && !b.burning) {
    b.scorch = 1;
    b.burning = true;
  }
  air.balloonsDowned++;
  say(state, events, "downed", m);
  if (why !== "burst") raiseHeat(state, "hit-soldier");
}

/** A BURST at (x, y, z): the balloons whose envelope or basket it is near. */
export function burstOnBalloons(
  state: GameState,
  air: ArmyAirState,
  x: number,
  y: number,
  z: number,
  events: GameEvent[],
): void {
  const D = K.downed;
  for (const m of air.balloons) {
    const b = m.body;
    const cloth = hypot3(b.x - x, b.y + BALLOON_CENTRE - y, b.z - z);
    if (cloth < D.burst || hypot3(b.x - x, b.y + 0.6 - y, b.z - z) < D.basket)
      tearBalloon(state, air, m, "burst", events);
  }
}

/** HIS STOLEN HELICOPTER'S BLADES through the cloth: its disc within
 * `downed.disc` m of the envelope's sphere. */
export function meetBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  events: GameEvent[],
): void {
  const h = state.heli;
  if (!h || !h.rider || h.mode === "wreck") return;
  const b = m.body;
  const r = BALLOON.envelope.diameter / 2;
  const hub = h.y + HELI.rotor.hub;
  const flat = hypot(b.x - h.x, b.z - h.z);
  const up = hub - (b.y + BALLOON_CENTRE);
  // The nearest of the disc (a flat circle at the hub) to the sphere.
  const edge = Math.max(0, flat - HELI.rotor.radius);
  if (hypot(edge, up) < r + K.downed.disc) tearBalloon(state, air, m, "ram", events);
}

/** FALLING, TORN: the burner shut, the hot air pouring out of the holes,
 * the drift on the wind — and on the snow, its crew out on foot if the
 * basket came down no harder than a landing. */
export function fallBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  events: GameEvent[],
): void {
  const b = m.body;
  own.length = 0;
  flyBalloon(state, b, false, 0, own);
  let crashed = false;
  for (const e of own) if (e.kind === "balloon" && e.phase === "crash") crashed = true;
  if (!b.grounded && !crashed) return;
  m.mode = "down";
  m.t = 0;
  say(state, events, "landed", m);
  const a = state.army;
  if (!a || crashed) return;
  const D = K.downed;
  for (let i = 0; i < m.crew.length; i++) {
    const at = m.id + (i * 2 * Math.PI) / m.crew.length;
    const x = b.x + Math.sin(at) * D.out;
    const z = b.z + Math.cos(at) * D.out;
    const s = enlist(state, a, "rocket", "air", BALLOON_SQUAD + m.id, "chase", x, z, at);
    s.next = state.t + 3 + i;
  }
}
