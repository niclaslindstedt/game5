// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWMOBILE RIDDEN INTO A FIRE (`RunRules.fires`, a free ride's) — a
// bonfire or a camp fire (`fires.ts`) met by the machine, ridden or left to
// run on without him. `defs/sled-fire.ts` says what it is modelled on.
//
//   * IT CATCHES: its belly in a fire's hearth and not clear over its
//     flames, it ploughs through the bed (the logs scattered under its skis
//     take a share of its way) and comes out ALIGHT (`SledState.burn`) —
//     and so does a rider stood on its boards, his boots and legs in the
//     flames with it (`fire-burn.ts`'s `catchFire`).
//   * IT GOES UP `SLED_FIRE.fuse` s later, wherever it has got to: the tank
//     splits and its petrol lights as a FIREBALL (`heli-wreck.ts`'s law, off
//     the fuel it burns), the machine is kicked up and over and lies a
//     burning wreck, the engine dead. Its rider is BLOWN OFF it (the
//     `blast` crash cause, `sled.ts` throws him), his clothes alight, and a
//     skier stood beside it is knocked down — and set alight inside the
//     ball. The ball's heat is summed into his dose while it burns
//     (`sledFireFlux`, read by `stepBurn`).
//   * THE WRECK burns for `SLED_FIRE.wreck.lasts` s; it is never taken
//     again, and once it is out a fresh machine stands on the spot at the
//     bottom (`sled.ts`).
//   * SAFE FOR WORK (`RunRules.sfw`): none of it — a hearth is a solid the
//     machine is held off at its edge, as a skier is.
//
// No draw from the stream: what burns is a function of where it is and
// the clock.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { throwRider } from "./crash.ts";
import { fireFlux, fireballAt, fireballOf } from "./defs/heli-wreck.ts";
import { SLED } from "./defs/sled.ts";
import { SLED_FIRE } from "./defs/sled-fire.ts";
import { catchFire } from "./fire-burn.ts";
import { firesNear, firesOf, type Fire } from "./fires.ts";
import type { GameEvent, GameState, SledState } from "./state.ts";

const F = SLED_FIRE;
const HALF = SLED.length / 2;
/** What burns in the ball, kg. */
const BALL_FUEL = SLED.fuel * F.ball;
const near: Fire[] = [];

const say = (run: GameState, s: SledState, events: GameEvent[], phase: "alight" | "boom"): void => {
  events.push({ kind: "sled", t: run.t, phase, x: s.x, y: s.y, z: s.z, speed: s.speed });
};

/** The fire one of its circles is in, and the circle's share along it. */
function metFire(run: GameState, s: SledState): { fire: Fire; share: number } | null {
  if (firesNear(run.level, s.x, s.z, HALF + F.radius, near).length === 0) return null;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const belly = s.y - SLED.cogHeight;
  for (const f of near) {
    if (belly - f.y > f.flames + F.over) continue;
    for (const share of F.circles) {
      const dx = s.x + fx * share * HALF - f.x;
      const dz = s.z + fz * share * HALF - f.z;
      if (hypot(dx, dz) < f.radius + F.radius) return { fire: f, share };
    }
  }
  return null;
}

/** HELD OFF A HEARTH (safe for work): every circle in one pushed out to its
 * edge, the way into it taken off and the rest kept, so it slides round. */
function holdOff(s: SledState): void {
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  for (const f of near) {
    for (const share of F.circles) {
      const dx = s.x + fx * share * HALF - f.x;
      const dz = s.z + fz * share * HALF - f.z;
      const d = hypot(dx, dz);
      const reach = f.radius + F.radius;
      if (d >= reach) continue;
      const nx = d > 1e-6 ? dx / d : -fx;
      const nz = d > 1e-6 ? dz / d : -fz;
      s.x += nx * (reach - d);
      s.z += nz * (reach - d);
      const vn = s.vx * nx + s.vz * nz;
      if (vn < 0) {
        s.vx -= vn * nx;
        s.vz -= vn * nz;
      }
    }
  }
}

/** ONE STEP OF THE FIRE on the machine, after its own: met and caught (or
 * held off), and the fuse burnt down. Returns the velocity its rider is
 * blown off with on the step the tank goes up while he is aboard — the
 * caller (`sled.ts`) throws him — and null on every other step. */
export function stepSledFire(
  run: GameState,
  s: SledState,
  events: GameEvent[],
): { x: number; y: number; z: number } | null {
  if (!run.rules.fires) return null;
  if (!s.burn) {
    const met = metFire(run, s);
    if (!met) return null;
    if (run.rules.sfw) {
      holdOff(s);
      return null;
    }
    s.burn = { fire: met.fire.id, t: run.t, boom: -1, x: 0, y: 0, z: 0, speed: 0 };
    // Through the bed: the logs and embers ploughed aside under its skis.
    s.vx *= F.bed;
    s.vz *= F.bed;
    s.treadSpeed *= F.bed;
    say(run, s, events, "alight");
    if (s.rider) catchFire(run, met.fire, s.x, s.z, events);
    return null;
  }
  const b = s.burn;
  if (b.boom >= 0 || run.t - b.t < F.fuse) return null;
  return blowUp(run, s, events);
}

/** THE TANK GOES UP: the ball lit where the machine is, the machine kicked
 * up and over and left a dead wreck, a skier on his skis beside it knocked
 * down — and its rider's way off it handed back. */
function blowUp(
  run: GameState,
  s: SledState,
  events: GameEvent[],
): { x: number; y: number; z: number } | null {
  const b = s.burn!;
  b.boom = run.t;
  b.x = s.x;
  b.y = s.y;
  b.z = s.z;
  b.speed = s.speed;
  say(run, s, events, "boom");
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const rider = s.rider
    ? {
        x: s.vx * F.rider.way - fx * F.rider.back,
        y: Math.max(0, s.vy) + F.rider.up,
        z: s.vz * F.rider.way - fz * F.rider.back,
      }
    : null;
  // The machine: kicked up off the snow and over onto its side, dead.
  s.vy = Math.max(s.vy, 0) + F.kick.up;
  s.wz += F.kick.roll;
  s.running = false;
  s.rpm = 0;
  s.treadSpeed = 0;
  const c = run.skier;
  const fire = firesOf(run.level).find((f) => f.id === b.fire);
  if (!rider && !c.thrown && !c.lift && !c.tunnel) {
    // A skier beside it.
    const dx = c.x - b.x;
    const dz = c.z - b.z;
    const d = hypot(dx, dz);
    if (d < F.near.reach) {
      const k = (1 - d / F.near.reach) * F.near.push;
      const nx = d > 1e-3 ? dx / d : -fx;
      const nz = d > 1e-3 ? dz / d : -fz;
      throwRider(run, "blast", { x: c.vx + nx * k, y: c.vy + k * 0.5, z: c.vz + nz * k }, events);
      if (fire && d < fireballOf(BALL_FUEL).diameter / 2) catchFire(run, fire, c.x, c.z, events);
    }
  }
  return rider;
}

/** THE BALL a machine's tank went up in, at the run's clock: its centre,
 * m, its radius, m, its glow 0..1 and its age and life, s — or null with
 * none burning. What the drawing sizes it by, and the heat is read off. */
export function sledBallAt(
  state: GameState,
): {
  x: number;
  y: number;
  z: number;
  radius: number;
  glow: number;
  age: number;
  life: number;
} | null {
  const b = state.sled?.burn;
  if (!b || b.boom < 0) return null;
  const age = state.t - b.boom;
  const ball = fireballAt(age, BALL_FUEL);
  if (age >= ball.life) return null;
  const ground = state.level.groundAt(b.x, b.z);
  return {
    x: b.x,
    y: ground + ball.height,
    z: b.z,
    radius: ball.radius,
    glow: ball.glow,
    age,
    life: ball.life,
  };
}

/** THE BALL'S HEAT at (x, y, z), kW/m² — 0 with none burning. */
export function sledFireFlux(state: GameState, x: number, y: number, z: number): number {
  const ball = sledBallAt(state);
  if (!ball) return 0;
  return fireFlux(hypot3(x - ball.x, y - ball.y, z - ball.z), ball.radius, ball.glow);
}
