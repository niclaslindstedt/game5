// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE — the shared layer every shooter the army sends fires
// through: the door gunners, the soldiers on skis, the snowmobile gunners,
// the riflemen on paramotors, the rocketeers in a balloon's basket, the
// tanks. Its numbers are `defs/weapons.ts`'.
//
// A SHOOTER is a GUN its owner arms (`armGun`), puts at the muzzle and
// moves with the platform every step, and fires with `fireAt`: a BURST at
// a target — the hunted man (or the machine he rides) or a point. The burst
// is aimed once: the LEAD on the target's velocity over the round's time
// of flight and the DROP over it, then the shooter's own error, drawn once
// a burst (his hold, the share of the lead he misjudges). Its rounds then
// leave at the cyclic rate, each with the weapon's own dispersion and the
// muzzle's climb, and are FLOWN — a bullet slowed by the air (v' = −k·v²)
// and pulled down by gravity, a rocket thrown out of its tube and driven
// by its motor — and tested along every step's path against his body
// (`gunfire-body.ts`), the machine he rides (`gunfire-machine.ts`), the
// trunks and the posts, and the snow.
//
// WHAT A HIT DOES:
//   - ON HIS BODY: a penetrating wound on the part it struck, its dose the
//     round's energy there (`defs/wounds.ts`, judged by `body.ts`); the
//     injuries, the bleeding and the death are the body's and the gore's
//     like any other, so with the INJURIES switch on enough hits kill;
//   - ON A MACHINE: damage, smoke, the engine failing, the machine lost —
//     a helicopter shot down;
//   - A ROCKET OR A SHELL bursts where it strikes: inside its kill radius
//     a man is torn apart (with the INJURIES switch on), inside its wound
//     radius fragments strike him, inside its throw radius the blast
//     knocks him off his feet (the `blast` crash); a machine near it takes
//     a burst's damage.
//
// THE RULES OF FIRE come off the wanted level's roster (`hold`, `warn`,
// `aim`), and with SAFE FOR WORK on (`WantedState.lethal` false) the army
// never shoots to kill: every burst is warning fire, put down in the snow
// to a side of him or ahead and never tested against his body, and a
// rocket is aimed at the machine he rides or not at all — the army ARRESTS
// him instead (`wanted.ts`' `arrestSkier`).
//
// Every spread and every burst is drawn off the gunfire's OWN stream
// (`GunfireState.stream`, seeded off the map), never `state.rng`; and
// `GameState.gunfire` is absent until a gun is armed, so a run that never
// arms one moves no digest.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  GUNFIRE,
  WEAPONS,
  type BlastDef,
  type WeaponDef,
  type WeaponKind,
} from "./defs/weapons.ts";
import { TUNING } from "./defs/tuning.ts";
import { pierceBody } from "./body.ts";
import { blastAt, inCabin } from "./blast.ts";
import { armyStruck } from "./armour.ts";
import { ARMOUR } from "./defs/armour.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { rosterOf } from "./wanted.ts";
import { WANTED } from "./defs/wanted.ts";
import { bodyCentre, bodyHit, bodyPoints, passDistance } from "./gunfire-body.ts";
import { sayGunfire } from "./gunfire-log.ts";
import { MACHINES, damageMachine, machineAt, machineHit, seizeLost } from "./gunfire-machine.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { AimTarget, FireRules, Gun, GunfireState, Round } from "./gunfire-state.ts";

const dt = TUNING.dt;
const G = TUNING.g;
const SALT = 0x6a7f1e;
/** A round faster than sound cracks as it goes by. */
const SOUND = 340;

// ─── the stream ────────────────────────────────────────────────────────

/** A draw off the gunfire's own stream, 0..1 (mulberry32, its state kept
 * in `GunfireState.stream` so the run carries it). */
export function gunDraw(g: GunfireState): number {
  const a = (g.stream + 0x6d2b79f5) | 0;
  g.stream = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A standard normal draw (Box–Muller) off the stream. */
function gauss(g: GunfireState): number {
  const u = Math.max(1e-12, gunDraw(g));
  const v = gunDraw(g);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const range = (g: GunfireState, r: readonly [number, number]): number =>
  r[0] + (r[1] - r[0]) * gunDraw(g);

// ─── the state ─────────────────────────────────────────────────────────

/** THE GUNFIRE at nothing: no gun, nothing in flight, the stream seeded
 * off the map. */
export function freshGunfire(state: GameState): GunfireState {
  return {
    guns: [],
    rounds: [],
    stream: (state.seed ^ SALT) >>> 0,
    next: 0,
    damage: { heli: 0, plane: 0, sled: 0, balloon: 0, armour: 0 },
    lost: { heli: false, plane: false, sled: false, balloon: false, armour: false },
    fired: 0,
    hits: 0,
    log: [],
    said: 0,
  };
}

/** ARM A GUN: the gun `id` with `weapon`, made (and the gunfire with it)
 * on the first call, its muzzle at (x, y, z). Its owner moves it every
 * step after (`Gun.x` … `.vz`). */
export function armGun(
  state: GameState,
  id: number,
  weapon: WeaponKind,
  x: number,
  y: number,
  z: number,
): Gun {
  const g = (state.gunfire ??= freshGunfire(state));
  let gun = g.guns.find((k) => k.id === id);
  if (gun) {
    gun.weapon = weapon;
    return gun;
  }
  gun = {
    id,
    weapon,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    left: 0,
    wait: 0,
    shot: 0,
    fired: 0,
    rules: "hold",
    target: null,
    ex: 0,
    ey: 0,
    el: 0,
    spot: false,
    ox: 0,
    oz: 0,
  };
  g.guns.push(gun);
  return gun;
}

/** Put gun `id` away (its rounds in flight fly on). */
export function disarmGun(state: GameState, id: number): void {
  const g = state.gunfire;
  if (g) g.guns = g.guns.filter((k) => k.id !== id);
}

/** Whether the army shoots to kill: the wanted level's word, or — with no
 * hunt, a lab's stand-in shooter — the run's own SAFE FOR WORK switch. */
export function lethalOf(state: GameState): boolean {
  return state.wanted ? state.wanted.lethal : !state.rules.sfw;
}

/** THE RULES OF FIRE a burst is fired under: what was asked (or the
 * roster's for the stars he carries, `aim` with no hunt), and never `aim`
 * where the army does not shoot to kill. */
export function rulesOf(state: GameState, asked?: FireRules): FireRules {
  const w = state.wanted;
  const r = asked ?? (w ? rosterOf(w.stars).fire : "aim");
  return r === "aim" && !lethalOf(state) ? "warn" : r;
}

/** Whether the gun is ready for a burst: not firing one, not waiting. */
export function gunReady(gun: Gun): boolean {
  return gun.left === 0 && gun.wait <= 0;
}

// ─── the aim ───────────────────────────────────────────────────────────

/** Where the target is and how it moves: the man's body (or the machine
 * he rides), or a point. */
function targetOf(
  state: GameState,
  t: AimTarget,
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  if (t.kind === "point")
    return { x: t.x, y: t.y, z: t.z, vx: t.vx ?? 0, vy: t.vy ?? 0, vz: t.vz ?? 0 };
  for (const m of MACHINES) {
    const at = machineAt(state, m);
    const o = m === "balloon" ? state.balloon : state[m];
    if (at && o) return { ...at, vx: o.vx, vy: o.vy, vz: o.vz };
  }
  const c = state.skier;
  const b = c.thrown;
  return { ...bodyCentre(state), vx: b ? b.vx : c.vx, vy: b ? b.vy : c.vy, vz: b ? b.vz : c.vz };
}

/** THE TIME a weapon's round takes to fly `d` m: a bullet slowed as
 * v' = −k·v² (t = (e^(k·d) − 1) / (k·v₀)); a rocket off its tube, then
 * driven up to its top speed, then on at it. */
export function flightTime(def: WeaponDef, d: number): number {
  if (def.kind === "gun" || def.push <= 0) {
    const k = def.drag;
    return k > 0 ? Math.expm1(k * d) / (k * def.muzzle) : d / def.muzzle;
  }
  if (d <= def.light) return d / def.muzzle;
  const v0 = def.muzzle;
  const a = def.push;
  // Accelerating from v0 to top over (top² − v0²) / 2a metres.
  const run = (def.top * def.top - v0 * v0) / (2 * a);
  const rest = d - def.light;
  if (rest <= run) return def.light / v0 + (Math.sqrt(v0 * v0 + 2 * a * rest) - v0) / a;
  return def.light / v0 + (def.top - v0) / a + (rest - run) / def.top;
}

/** THE SPEED a weapon's round still has `d` m out, m/s. */
export function speedAt(def: WeaponDef, d: number): number {
  if (def.kind === "gun") return def.muzzle * Math.exp(-def.drag * d);
  if (def.push <= 0 || d <= def.light) return def.muzzle * Math.exp(-def.drag * d);
  return Math.min(def.top, Math.sqrt(def.muzzle ** 2 + 2 * def.push * (d - def.light)));
}

/** THE ENERGY a round carries `d` m out, J. */
export function energyAt(def: WeaponDef, d: number): number {
  const v = speedAt(def, d);
  return 0.5 * def.mass * v * v;
}

/** THE AIM POINT for a round from (mx, my, mz) at a target at (x, y, z)
 * going (vx, vy, vz): led by `lead` of its way over the time of flight
 * (three passes), and held over by the drop over it — a bullet's ½gt², a
 * rocket's read off its own flight (`rocketSight`). */
export function aimPoint(
  def: WeaponDef,
  mx: number,
  my: number,
  mz: number,
  tg: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  lead = 1,
): { x: number; y: number; z: number; t: number } {
  let t = flightTime(def, hypot3(tg.x - mx, tg.y - my, tg.z - mz));
  let x = tg.x;
  let y = tg.y;
  let z = tg.z;
  for (let i = 0; i < 3; i++) {
    x = tg.x + tg.vx * t * lead;
    y = tg.y + tg.vy * t * lead;
    z = tg.z + tg.vz * t * lead;
    t = flightTime(def, hypot3(x - mx, y - my, z - mz));
  }
  if (def.kind === "blast" && def.push > 0) {
    const h = hypot(x - mx, z - mz);
    return { x, y: my + h * Math.tan(rocketSight(def, h, y - my)), z, t };
  }
  return { x, y: y + 0.5 * G * t * t, z, t };
}

/** Where a rocket fired at `th` rad over the level is, `h` m out: its
 * height over the muzzle, m — flown in the plane of its flight as
 * `flyRound` flies it (thrown out, its motor along its way, its drag, and
 * gravity bending the way it pushes along). */
function rocketRise(def: BlastDef, th: number, h: number): number {
  let vx = def.muzzle * Math.cos(th);
  let vy = def.muzzle * Math.sin(th);
  let x = 0;
  let y = 0;
  let flown = 0;
  for (let i = 0; i < 2000 && x < h; i++) {
    const v = hypot(vx, vy);
    let a = -def.drag * v;
    if (flown >= def.light && v < def.top) a += def.push / Math.max(1, v);
    vx += vx * a * dt;
    vy += vy * a * dt - G * dt;
    const nx = x + vx * dt;
    if (nx >= h) return y + vy * dt * ((h - x) / Math.max(1e-6, nx - x));
    flown += hypot(vx, vy) * dt;
    x = nx;
    y += vy * dt;
  }
  return y;
}

/** THE ROCKET'S SIGHT: the elevation, rad, that puts a rocket `rise` m
 * over the muzzle `h` m out — the graduation a launcher's sight is marked
 * in, found by the secant on its own flight (`rocketRise`). */
function rocketSight(def: BlastDef, h: number, rise: number): number {
  let a = Math.atan2(rise, h);
  let b = a + 0.02;
  let fa = rocketRise(def, a, h) - rise;
  let fb = rocketRise(def, b, h) - rise;
  for (let i = 0; i < 6 && Math.abs(fb) > 0.02; i++) {
    const c = b - (fb * (b - a)) / (fb - fa || 1e-9);
    a = b;
    fa = fb;
    b = Math.max(-1.4, Math.min(1.4, c));
    fb = rocketRise(def, b, h) - rise;
  }
  return b;
}

/** PULL THE TRIGGER: a burst from `gun` at `target`, under the rules of
 * fire asked (or the wanted level's) — or, `own`, the player's own gun
 * (`armour.ts`), aimed where he lays it whatever the army's rules. False
 * when it is not fired: the gun busy or waiting, the rules `hold`, the
 * target past its reach — or a launcher under SAFE FOR WORK with no
 * machine to aim at. */
export function fireAt(
  state: GameState,
  gun: Gun,
  target: AimTarget,
  asked?: FireRules,
  own = false,
): boolean {
  const g = state.gunfire;
  if (!g || !gunReady(gun)) return false;
  const rules = own ? "aim" : rulesOf(state, asked);
  if (rules === "hold") return false;
  const def = WEAPONS[gun.weapon];
  const tg = targetOf(state, target);
  if (hypot3(tg.x - gun.x, tg.y - gun.y, tg.z - gun.z) > def.reach) return false;
  // A rocket under SAFE FOR WORK at a man on foot: not fired at all.
  const machine = MACHINES.some((m) => machineAt(state, m));
  if (
    def.kind === "blast" &&
    rules === "warn" &&
    target.kind === "quarry" &&
    !lethalOf(state) &&
    !machine
  )
    return false;
  gun.rules = rules;
  gun.target = target;
  gun.left =
    def.kind === "gun" ? Math.round(range(g, [def.burst[0], def.burst[1] + 0.999]) - 0.5) : 1;
  gun.left = Math.max(1, gun.left);
  gun.shot = 0;
  gun.wait = 0;
  // THE HOLD: his own aim, wider early in a hunt (`WANTED.hold`) — the
  // player's own gun is his.
  const hold = def.hold * (own ? 1 : (WANTED.hold[state.wanted?.stars ?? 0] ?? 1));
  gun.ex = gauss(g) * hold;
  gun.ey = gauss(g) * hold;
  gun.el = 1 + gauss(g) * def.lead;
  // WARNING FIRE: a spot in the snow to a side of him or ahead — but a
  // launcher's warning is its rocket at the machine he rides.
  gun.spot = rules === "warn" && !(def.kind === "blast" && machine && target.kind === "quarry");
  if (gun.spot) {
    const W = GUNFIRE.warn;
    const a = gunDraw(g) * Math.PI * 2;
    const r = W.near + (W.far - W.near) * gunDraw(g);
    gun.ox = Math.sin(a) * r + tg.vx * (W.ahead / Math.max(1, hypot3(tg.vx, 0, tg.vz)));
    gun.oz = Math.cos(a) * r + tg.vz * (W.ahead / Math.max(1, hypot3(tg.vx, 0, tg.vz)));
  } else {
    gun.ox = 0;
    gun.oz = 0;
  }
  return true;
}

// ─── the step ──────────────────────────────────────────────────────────

/** THE GUNFIRE'S STEP, on a run that armed a gun: every burst's rounds
 * fired at the cyclic rate, every round flown and struck, the machines'
 * damage kept. After the run's own step. */
export function stepGunfire(state: GameState, events: GameEvent[]): void {
  const g = state.gunfire;
  if (!g) return;
  for (const gun of g.guns) {
    const def = WEAPONS[gun.weapon];
    if (gun.left > 0) {
      gun.wait -= dt;
      while (gun.wait <= 0 && gun.left > 0) {
        fireRound(state, g, gun, events);
        gun.left -= 1;
        if (def.kind === "gun") gun.wait += 60 / def.rpm;
        // Between bursts the pause a gun's rows say, drawn out early in a
        // hunt (`WANTED.pace`); a launcher's reload is its own.
        if (gun.left === 0)
          gun.wait =
            Math.max(gun.wait, 0) +
            (def.kind === "gun"
              ? range(g, def.pause) * (WANTED.pace[state.wanted?.stars ?? 0] ?? 1)
              : range(g, def.reload));
      }
    } else if (gun.wait > 0) gun.wait -= dt;
  }
  for (let i = 0; i < g.rounds.length;) {
    if (flyRound(state, g, g.rounds[i], events)) i++;
    else g.rounds.splice(i, 1);
  }
  seizeLost(state, g);
  // A machine he no longer rides is a fresh one the next time.
  for (const m of MACHINES) {
    if (machineAt(state, m)) continue;
    if (m === "heli" && g.lost.heli && state.heli && state.heli.mode !== "wreck") continue;
    g.damage[m] = 0;
    g.lost[m] = false;
  }
}

/** ONE ROUND OUT OF `gun`'s muzzle: aimed, spread and sent. */
function fireRound(state: GameState, g: GunfireState, gun: Gun, events: GameEvent[]): void {
  const def = WEAPONS[gun.weapon];
  const tg = targetOf(state, gun.target ?? { kind: "quarry" });
  if (gun.spot) {
    tg.x += gun.ox;
    tg.z += gun.oz;
    tg.y = state.level.groundAt(tg.x, tg.z);
  } else if (
    def.kind === "blast" &&
    (gun.target ?? { kind: "quarry" }).kind === "quarry" &&
    !MACHINES.some((m) => machineAt(state, m)) &&
    !state.skier.thrown
  ) {
    // A launcher at a man on his skis is laid on the snow at his feet:
    // a burst there does its work, one a metre over him flies on.
    tg.y = state.level.groundAt(tg.x, tg.z);
  }
  // The round leaves with the platform's way (a door gun in a machine
  // circling at 30 m/s), so the lead is taken on the target's way RELATIVE
  // to the gun's — what an aerial gunner is taught to allow for his own
  // speed. A shooter standing still leads on the target's alone.
  tg.vx -= gun.vx;
  tg.vy -= gun.vy;
  tg.vz -= gun.vz;
  const aim = aimPoint(def, gun.x, gun.y, gun.z, tg, gun.el);
  let dx = aim.x - gun.x;
  let dy = aim.y - gun.y;
  let dz = aim.z - gun.z;
  const d = hypot3(dx, dy, dz) || 1;
  dx /= d;
  dy /= d;
  dz /= d;
  // The errors, mil: the burst's hold, the round's own spread, the climb.
  const climb = def.kind === "gun" ? def.climb * gun.shot : 0;
  const across = (gun.ex + gauss(g) * def.dispersion + climb * 0.35 * gauss(g)) / 1000;
  const up = (gun.ey + gauss(g) * def.dispersion + climb) / 1000;
  // Right = way × up, normalised; up' = right × way.
  let rx = -dz;
  let rz = dx;
  const rl = hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -rz * dy;
  const uy = rz * dx - rx * dz;
  const uz = rx * dy;
  let wx = dx + rx * across + ux * up;
  let wy = dy + uy * up;
  let wz = dz + rz * across + uz * up;
  const wl = hypot3(wx, wy, wz) || 1;
  wx /= wl;
  wy /= wl;
  wz /= wl;
  const tracer = def.kind === "gun" && def.tracer > 0 && gun.fired % def.tracer === def.tracer - 1;
  gun.shot += 1;
  gun.fired += 1;
  g.fired += 1;
  const round: Round = {
    id: g.next++,
    gun: gun.id,
    weapon: gun.weapon,
    x: gun.x,
    y: gun.y,
    z: gun.z,
    vx: gun.vx + wx * def.muzzle,
    vy: gun.vy + wy * def.muzzle,
    vz: gun.vz + wz * def.muzzle,
    age: 0,
    flown: 0,
    tracer,
    warn: gun.rules !== "aim",
    snapped: false,
  };
  if (g.rounds.length >= GUNFIRE.most) g.rounds.shift();
  g.rounds.push(round);
  sayGunfire(g, events, {
    kind: "gunfire",
    t: state.t,
    phase: "shot",
    weapon: gun.weapon,
    x: gun.x,
    y: gun.y,
    z: gun.z,
    dx: wx,
    dy: wy,
    dz: wz,
    tracer,
    gun: gun.id,
  });
}

const p0 = [0, 0, 0];
const p1 = [0, 0, 0];
const near: number[] = [];

/** ONE STEP OF ONE ROUND: flown and struck. False once it is spent. */
function flyRound(state: GameState, g: GunfireState, r: Round, events: GameEvent[]): boolean {
  const def = WEAPONS[r.weapon];
  r.age += dt;
  if (r.age > GUNFIRE.life || r.flown > def.reach) return false;
  const v = hypot3(r.vx, r.vy, r.vz);
  // The air's drag, k·v² against the way; a rocket's motor along it.
  let a = -def.drag * v;
  if (def.kind === "blast" && def.push > 0 && r.flown >= def.light && v < def.top)
    a += def.push / Math.max(1, v);
  r.vx += r.vx * a * dt;
  r.vy += r.vy * a * dt - G * dt;
  r.vz += r.vz * a * dt;
  p0[0] = r.x;
  p0[1] = r.y;
  p0[2] = r.z;
  p1[0] = r.x + r.vx * dt;
  p1[1] = r.y + r.vy * dt;
  p1[2] = r.z + r.vz * dt;
  const step = hypot3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  // What it strikes first along this step's path.
  let s = 2;
  let what: "snow" | "solid" | "body" | "machine" | null = null;
  let part: BodyPart | null = null;
  let stuff: "trunk" | "steel" | "rock" = "trunk";
  let cabin = false;
  let machine: (typeof MACHINES)[number] | null = null;
  const level = state.level;
  // THE SNOW: the first crossing under it, found by halving.
  if (p1[1] < level.groundAt(p1[0], p1[2])) {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 10; k++) {
      const m = (lo + hi) / 2;
      const y = p0[1] + (p1[1] - p0[1]) * m;
      if (y < level.groundAt(p0[0] + (p1[0] - p0[0]) * m, p0[2] + (p1[2] - p0[2]) * m)) hi = m;
      else lo = m;
    }
    s = hi;
    what = "snow";
  }
  // THE TRUNKS AND POSTS: upright cylinders.
  const mx = (p0[0] + p1[0]) / 2;
  const mz = (p0[2] + p1[2]) / 2;
  solidsNear(level, mx, mz, step / 2 + 1.5, near);
  if (near.length) {
    const all = solidsOf(level);
    for (const i of near) {
      const u = all[i];
      const sx = p1[0] - p0[0];
      const sz = p1[2] - p0[2];
      const L = sx * sx + sz * sz;
      const k = L > 0 ? Math.min(1, Math.max(0, ((u.x - p0[0]) * sx + (u.z - p0[2]) * sz) / L)) : 0;
      if (k >= s) continue;
      const cx = p0[0] + sx * k - u.x;
      const cz = p0[2] + sz * k - u.z;
      if (cx * cx + cz * cz > u.radius * u.radius) continue;
      const y = p0[1] + (p1[1] - p0[1]) * k;
      if (y < u.y || y > u.y + u.height) continue;
      s = k;
      what = "solid";
      stuff = u.stuff === "steel" || u.stuff === "rock" ? u.stuff : "trunk";
    }
  }
  // THE MACHINE HE RIDES — never his own gun's round through his own
  // vehicle; his shell bursts on the hunt's machines instead (`armour.ts`).
  const own = r.gun === ARMOUR.tank.gun;
  const ah = own ? armyStruck(state, p0, p1) : -1;
  if (ah >= 0 && ah < s) {
    s = ah;
    what = "solid";
    stuff = "steel";
  }
  const mh = own ? null : machineHit(state, p0, p1);
  if (mh && mh.s < s) {
    s = mh.s;
    what = "machine";
    machine = mh.machine;
    cabin = mh.cabin;
  }
  // HIS BODY — never warning fire's, never on a machine whose cabin
  // holds him, and only within reach of the step.
  const c = bodyCentre(state);
  const pass = passDistance(p0, p1, c);
  if (!r.warn && lethalOf(state) && pass < 2.5 && !inCabin(state)) {
    const hit = bodyHit(bodyPoints(state), p0, p1);
    if (hit && hit.s < s) {
      s = hit.s;
      what = "body";
      part = hit.part;
    }
  }
  // THE CRACK of a round going by close.
  if (!r.snapped && what !== "body" && pass < GUNFIRE.snap && v > SOUND && def.kind === "gun") {
    r.snapped = true;
    sayGunfire(g, events, {
      kind: "gunfire",
      t: state.t,
      phase: "snap",
      weapon: r.weapon,
      x: c.x,
      y: c.y,
      z: c.z,
    });
  }
  if (what === null) {
    r.x = p1[0];
    r.y = p1[1];
    r.z = p1[2];
    r.flown += step;
    return true;
  }
  const x = p0[0] + (p1[0] - p0[0]) * s;
  const y = p0[1] + (p1[1] - p0[1]) * s;
  const z = p0[2] + (p1[2] - p0[2]) * s;
  r.flown += step * s;
  const j = 0.5 * def.mass * v * v;
  if (def.kind === "blast") {
    blastAt(state, g, def, x, y, z, r.weapon, r.id, events);
    return false;
  }
  if (what !== "body") {
    const on = what === "solid" ? stuff : what;
    sayGunfire(g, events, {
      kind: "gunfire",
      t: state.t,
      phase: "impact",
      weapon: r.weapon,
      x,
      y,
      z,
      on,
      tracer: r.tracer,
    });
  }
  if (what === "machine" && machine) {
    damageMachine(state, g, machine, j, false, r.weapon, events);
    // Through the cabin, a share reach the man at the controls.
    if (cabin && !r.warn && lethalOf(state) && gunDraw(g) < GUNFIRE.cabin)
      wound(
        state,
        g,
        CABIN_PARTS[Math.floor(gunDraw(g) * CABIN_PARTS.length)],
        j * 0.6,
        r,
        x,
        y,
        z,
        events,
      );
  } else if (what === "body" && part) wound(state, g, part, j, r, x, y, z, events);
  return false;
}

/** What of a man at the controls a round through the cabin finds. */
const CABIN_PARTS: readonly BodyPart[] = [
  "chest",
  "abdomen",
  "thighL",
  "thighR",
  "armL",
  "armR",
  "head",
  "pelvis",
];

/** A ROUND IN HIM: a wound on `part` of `j` J. */
function wound(
  state: GameState,
  g: GunfireState,
  part: BodyPart,
  j: number,
  r: Round,
  x: number,
  y: number,
  z: number,
  events: GameEvent[],
): void {
  g.hits += 1;
  sayGunfire(g, events, {
    kind: "gunfire",
    t: state.t,
    phase: "hit",
    weapon: r.weapon,
    x,
    y,
    z,
    part,
    j,
    on: "body",
  });
  pierceBody(state, events, [{ part, j }]);
}
