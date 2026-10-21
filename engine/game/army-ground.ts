// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON THE GROUND — the soldiers the wanted level's roster sends
// after a man on the snow (`rosterOf(stars).soldiers`, put down by the
// helicopters, and `.lifted`, up the ski area's lifts: `army-lift.ts`).
//
// THE LANDING. While he is on the ground — skiing, on foot, out of a
// machine he set down — a helicopter on station with men aboard and the
// roster short of them is asked for a landing (`LandTask`): a place in
// the ring round him that is flat and clear enough to set down on, ahead
// of him where he is going (`army-land.ts`), or where nothing will do, a
// place clear of trunks under a hover a fast rope reaches. The flight
// (`army.ts`) flies it; here the men are put OUT — one from each door in
// turn, run out to their side and knelt facing out until the machine has
// lifted (the drill every air assault lands by), or slid down the rope —
// and go after him. With more than one machine out the first stays up as
// the OVERWATCH and never lands; a drop he has skied far from before a man
// is out is given up and a nearer place asked for (`land.stale`).
//
// THE CHASE (`army-troop.ts` moves them): downhill on their skis at a
// disciplined pace, skating the flats, climbing the rises; at him where he
// is seen, and where he is not, at where he was last seen. A rifleman with
// him in sight within `fire.range` STOPS — a hockey stop, then off one
// knee on ground flat enough to kneel on, else stood on his skis — and
// fires a few bursts through the gunfire layer (`armGun` / `fireAt`)
// under the wanted level's rules of fire, then moves on again. The
// anti-armour man, from `rocketFrom` stars, walks and fires his launcher.
//
// THE LEAPFROG. A squad left far behind (every man of it further than
// `recall` m from where he was last seen, for `after` s) is picked up:
// its machine lands by them, they ski to its doors and get in, and it puts
// them down again ahead of him.
//
// BODY ON BODY. The player running into a soldier is the collision of two
// bodies every person on foot meets him with (`foot.ts`' `meetPerson`):
// the soldier thrown onto a ragdoll and up again after a while, or — on a
// run that carries its injuries — hurt or killed; and the player slowed,
// or thrown with his body struck. Hitting one is an offence (`hit-soldier`).
//
// SAFE FOR WORK (the INJURIES switch off: `WantedState.lethal` false)
// their fire is the gunfire's warning fire, never at him, and inside
// `fire.rush` m they stop firing and run him down. A soldier who reaches
// him (`WANTED.arrest.reach`) while he is slow or down ARRESTS him
// (`arrestSkier`): he is put face down in the snow, the soldier's knee on
// his back and his hands behind it, and held there while the rest close
// round him; the run ends under the ARRESTED card.
//
// THE PURSUERS: every soldier on the map is written into
// `WantedState.pursuers` (ids from `ARMY_GROUND.ids.pursuer`), so the
// wanted level's sight test sees through their eyes — and the woods hide
// him from a man on the snow (`seesQuarry`).
//
// Nothing here draws from any stream, and nothing runs until a hunt asks
// for soldiers: `ArmyState.troops` is empty on every other run.

import { hypot, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_HELI } from "./defs/army-heli.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { ARMY_WAVE } from "./defs/army-wave.ts";
import { TUNING } from "./defs/tuning.ts";
import { WANTED } from "./defs/wanted.ts";
import { armyPoint, landing } from "./army.ts";
import { landingSpot } from "./army-land.ts";
import { fit, inGondola, sendLiftSquads, stepLiftTroops } from "./army-lift.ts";
import { enlist, goToward, onSnow, slopeAlong, stopHere, watchProgress } from "./army-troop.ts";
import { climbWithWave, retireWaves, sendWaves } from "./army-wave.ts";
import { throwRider } from "./crash.ts";
import { footDown, meetPerson } from "./foot.ts";
import { armGun, disarmGun, fireAt } from "./gunfire.ts";
import { arrestSkier, quarryOf, raiseHeat, rosterOf, seesQuarry } from "./wanted.ts";
import { RAGDOLL } from "./ragdoll-points.ts";
import type { ArmyHeli, ArmyState, Soldier, SoldierEvent } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const K = ARMY_GROUND;
const EYES = 1.6;

function say(
  state: GameState,
  events: GameEvent[],
  change: SoldierEvent["change"],
  s: Soldier,
): void {
  events.push({ kind: "soldier", t: state.t, change, id: s.id, x: s.x, y: s.y, z: s.z });
}

/** Whether the hunted man is on the ground — on his skis, on foot, on a
 * snowmobile — rather than up in a machine: what a landing waits for. */
export function onTheGround(state: GameState): boolean {
  if (state.heli?.rider || state.plane?.rider) return false;
  const q = quarryOf(state);
  return q.y - state.level.groundAt(q.x, q.z) < 4;
}

/** The soldier's key as a person on foot (`foot.ts`). */
export const soldierKey = (s: Soldier): number => K.ids.key + s.id;
const gunOf = (s: Soldier): number => K.ids.gun + s.id;

// ─── the landings ──────────────────────────────────────────────────────

/** The men of machine `h`'s squad still out and fit. */
function squadOf(a: ArmyState, h: ArmyHeli): Soldier[] {
  return a.troops.filter((s) => s.from === "heli" && s.squad === h.id && fit(s));
}

/** ASK FOR LANDINGS, once a second: a pick-up for a squad left behind,
 * else a drop near him for a machine with men aboard while the roster is
 * short of them. With more than one machine out, the first stays up as
 * the OVERWATCH — its door guns over the men on the ground — and never
 * lands. */
function askLandings(state: GameState, a: ArmyState, w: WantedState, want: number): void {
  if (Math.floor(state.t) === Math.floor(state.t - dt)) return;
  const q = quarryOf(state);
  let live = 0;
  for (const s of a.troops) if (s.from === "heli" && fit(s)) live++;
  const avoid: { x: number; z: number; r: number }[] = [];
  for (const h of a.helis) if (h.task) avoid.push({ x: h.task.x, z: h.task.z, r: 40 });
  if (state.heli) avoid.push({ x: state.heli.x, z: state.heli.z, r: 30 });
  // A drop he has skied far from before a man is out: given up, and a
  // nearer place asked for when the machine is back on the hunt.
  for (const h of a.helis) {
    const task = h.task;
    if (h.phase !== "land" || !task || task.kind !== "drop" || task.put > 0) continue;
    if (hypot(q.x - task.x, q.z - task.z) > K.land.stale) task.done = true;
  }
  let up = 0;
  let watch: ArmyHeli | null = null;
  for (const h of a.helis) {
    if (!h.on || (h.phase !== "hunt" && !landing(h))) continue;
    up++;
    // The first not already set on a landing of its own.
    if (!h.task && (!watch || watch.task)) watch = h;
    else watch ??= h;
  }
  if (up < 2) watch = null;
  for (const h of a.helis) {
    if (h.phase !== "hunt" || h.task || !h.on || h === watch) continue;
    const squad = squadOf(a, h);
    // THE LEAPFROG: every man of it far from where he was last seen, long.
    const behind =
      squad.length > 0 &&
      squad.every(
        (s) =>
          (s.mode === "chase" || s.mode === "aim") &&
          hypot(s.x - w.lastSeen.x, s.z - w.lastSeen.z) > K.recall &&
          Math.min(state.t - s.saw, s.t) > K.after,
      ) &&
      h.aboard + squad.length <= K.section;
    if (behind) {
      let cx = 0;
      let cz = 0;
      let cy = 0;
      for (const s of squad) {
        cx += s.x / squad.length;
        cz += s.z / squad.length;
        cy += s.y / squad.length;
      }
      const spot = landingSpot(state, cx, cy, cz, 0, 0, avoid, { near: 10, far: 160, prefer: 30 });
      if (spot && !spot.rope) {
        h.task = { kind: "pick", ...spot, count: squad.length, put: 0, clear: NaN, done: false };
        avoid.push({ x: spot.x, z: spot.z, r: 40 });
        for (const s of squad) {
          s.mode = "board";
          s.t = 0;
          s.kneel = false;
        }
      }
      continue;
    }
    if (h.aboard <= 0 || live >= want || !w.seen) continue;
    if (hypot(h.x - q.x, h.z - q.z) > 1500) continue;
    const v = state.skier.thrown ?? state.sled ?? state.skier;
    const spot = landingSpot(state, q.x, q.y, q.z, v.vx, v.vz, avoid);
    if (!spot) continue;
    const count = Math.min(h.aboard, want - live);
    h.task = { kind: "drop", ...spot, count, put: 0, clear: NaN, done: false };
    avoid.push({ x: spot.x, z: spot.z, r: 40 });
    live += count;
  }
}

/** Where a man comes out of `side`'s door of `h` (1 the right), world. */
function doorOf(h: ArmyHeli, side: 1 | -1): { x: number; y: number; z: number } {
  const D = ARMY_HELI.door;
  return armyPoint(h, {
    x: side * (ARMY_HELI.body.width / 2 + 0.3),
    y: 0,
    z: (D.front + D.back) / 2,
  });
}

/** A MACHINE ON THE SNOW OR AT THE HOVER: its men put out (a drop) or
 * taken in (a pick-up), and the task said done once they are. */
function workLanding(
  state: GameState,
  a: ArmyState,
  h: ArmyHeli,
  w: WantedState,
  events: GameEvent[],
): void {
  const task = h.task;
  if (!task || task.done) return;
  const D = K.dismount;
  if (task.kind === "pick") {
    const coming = a.troops.some((s) => s.squad === h.id && s.mode === "board");
    if (!coming || h.t > D.wait) task.done = true;
    return;
  }
  // One man out each `every` s — from each door in turn, or down the rope.
  const every = task.rope ? K.rope.gap : D.every;
  if (task.put < task.count && h.aboard > 0 && h.t >= task.put * every) {
    const n = task.put;
    const side: 1 | -1 = n % 2 === 0 ? 1 : -1;
    const rocket =
      w.stars >= K.rocketFrom &&
      n === 1 &&
      !a.troops.some((s) => s.squad === h.id && s.role === "rocket" && fit(s));
    const door = task.rope
      ? armyPoint(h, { x: side * ARMY_HELI.rope.x, y: ARMY_HELI.rope.y, z: ARMY_HELI.rope.z })
      : doorOf(h, side);
    // Out to his side of the machine, square to it, spread fore and aft.
    const rx = Math.cos(h.heading) * side;
    const rz = -Math.sin(h.heading) * side;
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    const along = (Math.floor(n / 2) - (Math.ceil(task.count / 2) - 1) / 2) * 3;
    const run = task.rope ? 3 : D.run;
    const s = enlist(
      state,
      a,
      rocket ? "rocket" : "rifle",
      "heli",
      h.id,
      task.rope ? "rope" : "out",
      door.x,
      door.z,
      Math.atan2(rx, rz),
    );
    if (task.rope) s.y = door.y;
    s.tx = door.x + rx * run + fx * along;
    s.tz = door.z + rz * run + fz * along;
    task.put++;
    h.aboard--;
    a.dropped++;
    if (!task.rope) say(state, events, "out", s);
  }
  // Done once every man is out and clear — on the snow and knelt — and
  // `linger` s on.
  const clear = !a.troops.some(
    (s) => s.squad === h.id && (s.mode === "rope" || (s.mode === "out" && !s.kneel)),
  );
  if ((task.put >= task.count || h.aboard <= 0) && clear) {
    if (Number.isNaN(task.clear)) task.clear = state.t;
    if (state.t - task.clear >= D.linger) task.done = true;
  }
  if (h.t > D.wait + 20) task.done = true;
}

// ─── the soldiers ──────────────────────────────────────────────────────

/** Whether soldier `s` sees him now: looked every quarter second (each
 * man in his own turn), and remembered. */
function looks(state: GameState, s: Soldier, q: { x: number; y: number; z: number }): boolean {
  const L = WANTED.lookEvery;
  const turn = (state.t + (s.id % 8) * (L / 8)) % L;
  if (turn < dt) {
    const p = { kind: "soldier" as const, x: s.x, y: s.y + EYES, z: s.z };
    if (seesQuarry(state.level, p, q)) s.saw = state.t;
  }
  return state.t - s.saw < 0.5;
}

/** THE AIM: stopped where he is and his weapon laid on him; once settled,
 * a burst whenever his gun is ready, up to `fire.bursts` or `fire.hold`
 * s — then on again. */
function aim(
  state: GameState,
  a: ArmyState,
  s: Soldier,
  q: { x: number; y: number; z: number },
  sees: boolean,
  events: GameEvent[],
): void {
  const F = K.fire;
  stopHere(state, s);
  const dx = q.x - s.x;
  const dz = q.z - s.z;
  const d = hypot(dx, dz);
  const h = s.kneel ? K.muzzle.kneel : K.muzzle.stand;
  s.aimH = Math.atan2(dx, dz);
  s.aimP = Math.atan2(q.y + 1 - (s.y + h), d);
  // Turned to face him (a man on skis steps round; one on foot turns).
  s.heading += clamp(
    Math.atan2(Math.sin(s.aimH - s.heading), Math.cos(s.aimH - s.heading)),
    -2 * dt,
    2 * dt,
  );
  const settle = s.kneel ? F.kneel : F.settle;
  const rocket = s.role === "rocket";
  const most = rocket ? 1 : F.bursts;
  const over = s.t > F.hold || s.bursts >= most || (!sees && s.t > settle);
  if (over) {
    s.mode = "chase";
    s.t = 0;
    s.next = state.t + F.move + F.spread * ((s.id * 0.618) % 1);
    s.kneel = false;
    return;
  }
  if (s.t < settle || s.speed > 0.5 || !sees) return;
  const fx = Math.sin(s.aimH);
  const fz = Math.cos(s.aimH);
  const gun = armGun(state, gunOf(s), rocket ? "rocket" : "rifle", s.x, s.y + h, s.z);
  gun.x = s.x + fx * 0.6;
  gun.y = s.y + h;
  gun.z = s.z + fz * 0.6;
  gun.vx = gun.vy = gun.vz = 0;
  if (fireAt(state, gun, { kind: "quarry" })) s.bursts++;
  void a;
  void events;
}

/** THE CHASE: after him (or where he was last seen), stopping to fire when
 * he is in reach and sight, shouting at him close; in SAFE FOR WORK, run
 * down and arrested. */
function chase(
  state: GameState,
  a: ArmyState,
  s: Soldier,
  w: WantedState,
  q: { x: number; y: number; z: number },
  fire: "hold" | "warn" | "aim",
  events: GameEvent[],
): void {
  const sees = looks(state, s, q);
  const to = sees || w.seen ? q : w.lastSeen;
  const d = hypot(to.x - s.x, to.z - s.z);
  const F = K.fire;
  const rush = !w.lethal && d < F.rush;
  if (sees && d < 60 && state.t - s.shout > 8) {
    s.shout = state.t;
    say(state, events, "shout", s);
  }
  const range = s.role === "rocket" ? F.rocket : F.range;
  if (sees && fire !== "hold" && !rush && d < range && state.t >= s.next) {
    s.mode = "aim";
    s.t = 0;
    s.bursts = 0;
    s.kneel = Math.abs(slopeAlong(state, s.x, s.z, s.heading)) < F.flat && slopeFlat(state, s);
    say(state, events, "aim", s);
    return;
  }
  // Close on a man who is down or slow: pulled up beside him.
  const slow = !!state.skier.thrown || hypot(state.skier.vx, state.skier.vz) < K.arrest.speed;
  goToward(state, s, a.troops, to.x, to.z, K.ski.pace, slow && sees ? 0.8 : -1);
}

/** Whether the ground under him is flat enough to kneel on. */
function slopeFlat(state: GameState, s: Soldier): boolean {
  const n = { x: 0, y: 1, z: 0 };
  state.level.normalAt(s.x, s.z, n);
  return hypot(n.x, n.z) / Math.max(0.2, n.y) < K.fire.flat;
}

/** THE ARREST, SAFE FOR WORK on: a soldier within reach of him while he is
 * slow or down takes him — put face down and held. */
function tryArrest(state: GameState, a: ArmyState, s: Soldier, events: GameEvent[]): boolean {
  const c = state.skier;
  if (state.sled?.rider || state.armour?.rider || !onTheGround(state)) return false;
  const b = c.thrown ?? c;
  if (hypot(b.x - s.x, b.z - s.z) > WANTED.arrest.reach) return false;
  if (!c.thrown && hypot(c.vx, c.vz) > K.arrest.speed) return false;
  if (!arrestSkier(state)) return false;
  a.arrest = { by: s.id, t: state.t, x: b.x, z: b.z, heading: c.heading };
  s.mode = "arrest";
  s.t = 0;
  say(state, events, "arrest", s);
  if (!c.thrown) throwRider(state, "arrest", { x: c.vx * 0.3, y: 0, z: c.vz * 0.3 }, events);
  return true;
}

/** HELD: the man taken laid face down along the way he was going, his
 * hands behind his back, and kept there; the soldier who took him knelt
 * over him; the rest closed round him, their rifles on him. */
function hold(state: GameState, a: ArmyState): void {
  const arr = a.arrest;
  const b = state.skier.thrown;
  if (!arr || !b) return;
  const level = state.level;
  const k = Math.min(1, (state.t - arr.t) / K.arrest.settle);
  const ease = Math.min(1, dt * 6) * (k > 0 ? 1 : 0);
  const fx = Math.sin(arr.heading);
  const fz = Math.cos(arr.heading);
  const rx = fz;
  const rz = -fx;
  // Every point as he lies: (along his body, across it, over the snow).
  const LAID: readonly (readonly [number, number, number])[] = [
    [0, -0.12, 0.16], // hipL
    [0, 0.12, 0.16], // hipR
    [0.5, -0.2, 0.17], // shoulderL
    [0.5, 0.2, 0.17], // shoulderR
    [0.78, 0, 0.14], // head
    [-0.45, -0.14, 0.1], // kneeL
    [-0.45, 0.14, 0.1], // kneeR
    [-0.9, -0.17, 0.12], // footL
    [-0.9, 0.17, 0.12], // footR
    [0.3, -0.32, 0.26], // elbowL
    [0.3, 0.32, 0.26], // elbowR
    [0.08, -0.05, 0.3], // handL
    [0.08, 0.05, 0.3], // handR
  ];
  for (let i = 0; i < RAGDOLL.count; i++) {
    const [u, v, up] = LAID[i];
    const x = arr.x + fx * u + rx * v;
    const z = arr.z + fz * u + rz * v;
    const y = level.groundAt(x, z) + up;
    const p = b.points;
    p[3 * i] += (x - p[3 * i]) * ease;
    p[3 * i + 1] += (y - p[3 * i + 1]) * ease;
    p[3 * i + 2] += (z - p[3 * i + 2]) * ease;
    b.last[3 * i] = p[3 * i];
    b.last[3 * i + 1] = p[3 * i + 1];
    b.last[3 * i + 2] = p[3 * i + 2];
  }
  b.x = arr.x;
  b.z = arr.z;
  b.y = level.groundAt(arr.x, arr.z) + 0.16;
  b.vx = b.vy = b.vz = 0;
  const c = state.skier;
  c.vx = c.vy = c.vz = 0;
}

/** Where the men close round a man arrested: a ring of `arrest.ring` m
 * round him, a place each by their order. */
function ringSpot(a: ArmyState, i: number, n: number): { x: number; z: number } {
  const arr = a.arrest!;
  const th = arr.heading + Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
  return { x: arr.x + Math.sin(th) * K.arrest.ring, z: arr.z + Math.cos(th) * K.arrest.ring };
}

/** A MAN OF A WAVE, HIM TAKEN: up to a ring round the arrest, each at his
 * own distance (`ARMY_WAVE.ring`, by his id), and stood there facing him,
 * his rifle on him — the mass come up the mountain closed round. */
function converge(state: GameState, a: ArmyState, s: Soldier): void {
  const arr = a.arrest!;
  const R = ARMY_WAVE.ring;
  const ring = R.near + ((s.id * 0.618) % 1) * (R.far - R.near);
  const d = hypot(arr.x - s.x, arr.z - s.z);
  if (d > ring + 1) goToward(state, s, a.troops, arr.x, arr.z, R.pace, ring);
  else {
    stopHere(state, s);
    s.heading = Math.atan2(arr.x - s.x, arr.z - s.z);
  }
}

/** THE PLAYER INTO A SOLDIER: the collision of two bodies (`meetPerson`),
 * the soldier down and the offence raised. */
function meet(state: GameState, s: Soldier, events: GameEvent[]): void {
  const c = state.skier;
  if (Math.abs(c.x - s.x) > 4 || Math.abs(c.z - s.z) > 4) return;
  const struck = meetPerson(
    state,
    events,
    soldierKey(s),
    "soldier",
    "man",
    s.x,
    s.y,
    s.z,
    s.heading,
    K.mass,
  );
  if (!struck) return;
  s.mode = "down";
  s.t = 0;
  disarmGun(state, gunOf(s));
  say(state, events, "down", s);
  raiseHeat(state, "hit-soldier");
}

/** A SOLDIER DOWN: where his body lies; up again where it came to rest once
 * the person on foot lets him go — or hurt, or dead. */
function lie(state: GameState, s: Soldier, events: GameEvent[]): void {
  const d = footDown(state, soldierKey(s));
  if (!d) {
    s.mode = "chase";
    s.t = 0;
    s.speed = 0;
    s.y = state.level.groundAt(s.x, s.z);
    say(state, events, "up", s);
    return;
  }
  s.x = d.thrown.x;
  s.z = d.thrown.z;
  s.y = state.level.groundAt(s.x, s.z);
  if (d.dead || d.injured) {
    s.mode = d.dead ? "dead" : "hurt";
    s.t = 0;
    if (d.dead) say(state, events, "dead", s);
  }
}

// ─── the step ──────────────────────────────────────────────────────────

/** THE ARMY ON THE GROUND'S STEP, on a hunted run: the landings asked
 * for and worked, the lifts' squads sent and carried, every soldier moved,
 * firing, met or holding him, and the pursuers written. After the army's
 * machines, before the gunfire. */
export function stepGround(state: GameState, events: GameEvent[]): void {
  const a = state.army;
  const w = state.wanted;
  if (!a || a.home || !w) return;
  const on = w.ended === null && w.stars > 0;
  const roster = rosterOf(on ? w.stars : 0);
  if (on && WANTED.waves[w.stars]) sendWaves(state, a, w, events);
  if (a.troops.length === 0 && roster.soldiers === 0 && roster.lifted === 0) {
    clearTasks(a);
    return;
  }
  retireWaves(state, a, w, on);
  const q = quarryOf(state);
  const ground = onTheGround(state);
  if (on && ground && roster.soldiers > 0) askLandings(state, a, w, roster.soldiers);
  if (!on || !ground) clearTasks(a);
  for (const h of a.helis)
    if (h.phase === "set" || h.phase === "rope") workLanding(state, a, h, w, events);
  if (on && roster.lifted > 0) sendLiftSquads(state, a, roster.lifted, q, events);
  else a.liftDue = NaN;
  stepLiftTroops(state, a, events);
  const arrested = w.ended === "arrested";
  let covering = 0;
  if (arrested) for (const s of a.troops) if (s.mode === "cover" && s.from === "wave") covering++;
  for (const s of a.troops) {
    s.t += dt;
    switch (s.mode) {
      case "climb":
        // WITH HIS WAVE up the way from the valley, until the fight.
        if (arrested && a.arrest) converge(state, a, s);
        else if (!on) stopHere(state, s);
        else if (climbWithWave(state, a, s, w, looks(state, s, q))) {
          s.mode = "chase";
          s.t = 0;
          s.next = state.t + 0.5 + (s.id % 4) * 0.5;
        }
        break;
      case "rope": {
        const h = a.helis.find((m) => m.id === s.squad);
        // Down the rope under its hook, as long as the machine holds over it.
        s.y -= K.rope.slide * (h && h.phase === "rope" ? 1 : 3) * dt;
        const g = state.level.groundAt(s.x, s.z);
        if (s.y <= g) {
          s.y = g;
          s.mode = "out";
          s.t = 0;
          say(state, events, "out", s);
        }
        break;
      }
      case "out": {
        const h = a.helis.find((m) => m.id === s.squad);
        const lifted = !h || !landing(h) || h.phase === "rise";
        if (!s.kneel) {
          goToward(state, s, a.troops, s.tx, s.tz, K.ski.skate, 0.2);
          if (hypot(s.tx - s.x, s.tz - s.z) < 0.6 || s.t > 10) {
            s.kneel = true;
            s.speed = 0;
            // Knelt facing out, away from the machine.
            if (h) s.heading = Math.atan2(s.x - h.x, s.z - h.z);
          }
        } else stopHere(state, s);
        if (lifted && (s.kneel || !h)) {
          s.mode = "chase";
          s.t = 0;
          s.kneel = false;
          s.next = state.t + 1 + (s.id % 4) * 0.5;
        }
        break;
      }
      case "board": {
        const h = a.helis.find((m) => m.id === s.squad);
        if (!h || !h.task || h.task.kind !== "pick" || h.task.done) {
          s.mode = "chase";
          s.t = 0;
          break;
        }
        // To the pick-up's spot, held clear of the disc while it comes
        // down; then to its nearer door.
        const side: 1 | -1 = s.id % 2 === 0 ? 1 : -1;
        let door: { x: number; z: number } = doorOf(h, side);
        if (h.phase !== "set") {
          const dx = s.x - h.task.x;
          const dz = s.z - h.task.z;
          const d = Math.max(0.1, hypot(dx, dz));
          const out = ARMY_HELI.rotor.radius + 5;
          door = { x: h.task.x + (dx / d) * out, z: h.task.z + (dz / d) * out };
        }
        s.tx = door.x;
        s.tz = door.z;
        if (hypot(door.x - s.x, door.z - s.z) > 1) {
          goToward(state, s, a.troops, door.x, door.z, K.ski.pace, 0.5);
        } else stopHere(state, s);
        if (h.phase === "set" && hypot(door.x - s.x, door.z - s.z) < 2) {
          s.mode = "gone";
          h.aboard++;
          a.picked++;
          say(state, events, "aboard", s);
        }
        break;
      }
      case "chase":
        if (arrested && a.arrest && s.from === "wave") {
          converge(state, a, s);
          break;
        }
        if (!on || !ground) {
          stopHere(state, s);
          break;
        }
        if (!w.lethal && tryArrest(state, a, s, events)) break;
        chase(state, a, s, w, q, roster.fire, events);
        break;
      case "aim":
        if (!on) {
          s.mode = "chase";
          break;
        }
        aim(state, a, s, q, looks(state, s, q), events);
        break;
      case "down":
        lie(state, s, events);
        break;
      case "arrest": {
        const b = state.skier.thrown;
        if (b) {
          // Knelt over him, beside his shoulders, facing along him.
          const arr = a.arrest!;
          const rx = Math.cos(arr.heading);
          const rz = -Math.sin(arr.heading);
          s.x = arr.x + rx * 0.45 + Math.sin(arr.heading) * 0.25;
          s.z = arr.z + rz * 0.45 + Math.cos(arr.heading) * 0.25;
          s.y = state.level.groundAt(s.x, s.z);
          s.heading = arr.heading - Math.PI / 2;
          s.speed = 0;
        }
        break;
      }
      case "cover": {
        // Closed round him: to his place on the ring, or near enough to it
        // (a trunk may stand there), then stood, his rifle on him.
        const arr = a.arrest!;
        const others = a.troops.filter((o) => o.mode === "cover");
        const spot = ringSpot(a, others.indexOf(s), others.length);
        s.tx = spot.x;
        s.tz = spot.z;
        const off = hypot(spot.x - s.x, spot.z - s.z);
        const from = hypot(arr.x - s.x, arr.z - s.z);
        const there = from > 1.8 && (off < 1.5 || (s.t > 10 && from < 2 * K.arrest.ring));
        if (!there) goToward(state, s, a.troops, spot.x, spot.z, 6, 0.3);
        else {
          stopHere(state, s);
          s.aimH = Math.atan2(arr.x - s.x, arr.z - s.z);
          s.heading = s.aimH;
          s.aimP = -0.45;
        }
        break;
      }
      default:
        break;
    }
    // Taken in: everyone within reach closes round him — of a wave's men
    // only the nearest few; the rest stand where they are.
    if (arrested && a.arrest && (s.mode === "chase" || s.mode === "aim" || s.mode === "climb")) {
      const d = hypot(s.x - a.arrest.x, s.z - a.arrest.z);
      const wave = s.from === "wave";
      if (wave ? d < ARMY_WAVE.coverNear && covering < ARMY_WAVE.cover : d < 300) {
        if (wave) covering++;
        s.mode = "cover";
        s.t = 0;
        s.kneel = false;
      }
    }
    if (onSnow(s) && s.mode !== "arrest" && s.mode !== "cover" && s.lift < 0)
      meet(state, s, events);
    // Moving where he means to: after him, or to a door or a load line
    // still metres off (stood waiting there is not being stuck).
    const going = (s.mode === "board" || s.mode === "walk") && hypot(s.tx - s.x, s.tz - s.z) > 2;
    const moving = s.mode === "chase" || going;
    watchProgress(state, s, (moving && on && ground) || (s.mode === "climb" && on));
    if (s.mode !== "aim") carryGun(state, s);
  }
  if (arrested) hold(state, a);
  a.troops = a.troops.filter((s) => s.mode !== "gone");
  writeTroops(a, w, state);
}

/** HIS GUN CARRIED WITH HIM out of a stop (a burst may still be going):
 * at his muzzle as he moves; put away once he is down or gone. */
function carryGun(state: GameState, s: Soldier): void {
  const g = state.gunfire?.guns.find((k) => k.id === gunOf(s));
  if (!g) return;
  if (!fit(s) || s.mode === "down" || s.mode === "board") {
    disarmGun(state, gunOf(s));
    return;
  }
  g.x = s.x + Math.sin(s.heading) * 0.6;
  g.y = s.y + K.muzzle.stand;
  g.z = s.z + Math.cos(s.heading) * 0.6;
  g.vx = s.vx;
  g.vy = 0;
  g.vz = s.vz;
}

/** A hunt over or him off the ground: no landing asked for any more. */
function clearTasks(a: ArmyState): void {
  for (const h of a.helis) if (h.task && h.phase === "hunt") h.task = null;
}

/** WRITE THE SOLDIERS into the wanted level's pursuers: every man on the
 * map who can look — not in a cabin, not down. */
function writeTroops(a: ArmyState, w: WantedState, state: GameState): void {
  const lo = K.ids.pursuer;
  const kept = w.pursuers.filter((p) => p.id < lo || p.id >= lo + 1000);
  for (const s of a.troops) {
    if (!fit(s) || s.mode === "down" || inGondola(state, s)) continue;
    kept.push({ id: lo + (s.id % 1000), kind: "soldier", x: s.x, y: s.y + EYES, z: s.z });
  }
  w.pursuers = kept;
}

/** The soldiers on the map, for the drawing, the ear and the labs. */
export function armyTroops(state: GameState): readonly Soldier[] {
  return state.army?.troops ?? [];
}

/** Whether a lift's squad: numbered past every machine's. */
export const liftSquad = (s: Soldier): boolean => s.from === "lift";
