// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RUN INTO AN ANIMAL — the wildlife (`beast-plan.ts`) as BODIES on a free
// ride. Every step the groups near the player are put up by him as the
// fright rule says (`spookAt`, its memory kept here in `GameState.wild`),
// and every animal of them is met as a body: a capsule along its spine,
// its girth a share of its height, against his — a vertical capsule off
// his boots. Where the two touch at speed the two bodies exchange momentum
// by their masses, flesh against flesh (next to no bounce):
//   - THE ANIMAL is KILLED past `kill` and CRUSHED by `crush` (`crushOf`,
//     scaled for its mass) on a run that carries its injuries — never on a
//     safe one, where it is only KNOCKED DOWN and up again after
//     `downFor` — and flung along the snow at what the blow gave it
//     (`struckAt`: a slide slowed exponentially by the powder piling up
//     ahead of it, a closed form of the clock, never stepped);
//   - THE RIDER loses what the exchange takes off him: past `throws` he is
//     THROWN (the `beast` crash cause) over it with what he kept, and the
//     blow is read by `body.ts` off this step's `beast` event — the parts
//     the animal's body stood at the height of, stopped by its hide, muscle
//     and ribs (`BEAST_HIT.give`) — so a moose met at speed opens him up
//     through the same ladders and wounds (`gore.ts`) as a padded tower
//     would; short of it he skis on with the stagger. A hare is run
//     through; a moose stops him dead.
// A free ride only, and the player only: no other run carries `wild`, so
// no sim digest can see an animal. Nothing here draws from `state.rng`.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { beastPlace, beastPlanFor, CALM, spookAt, type Spook } from "./beast-plan.ts";
import { BEAST_HIT as K, beastById, type BeastId } from "./defs/beasts.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { onSkis } from "./groomer.ts";
import { derive } from "./skier.ts";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { GameEvent, GameState } from "./state.ts";
import { wildGround } from "./wild-ground.ts";

const dt = TUNING.dt;

/** ONE ANIMAL MET: which (its group's index in the plan, its member), the
 * run time and the spot, the velocity the blow flung it with, its heading,
 * whether it was killed and how crushed, 0..1, and whether it was knocked
 * off its feet (a brush that did neither is filed only for `brush` s, so
 * one touch is one blow). */
export type StruckBeast = {
  group: number;
  member: number;
  species: BeastId;
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  killed: boolean;
  crush: number;
  knocked: boolean;
};

/** THE WILDLIFE ON A FREE RIDE: every group's fright (by its index in the
 * plan, filled on the first step), and every animal met. */
export type WildState = { spooks: Spook[]; struck: StruckBeast[] };

/** An animal met, as the app hears it: the species, where, how hard the
 * two closed, m/s, its shoulder height, m, what the blow took off the
 * rider's speed, m/s, whether it threw him, killed it and how crushed. */
export type BeastEvent = {
  kind: "beast";
  t: number;
  species: BeastId;
  group: number;
  member: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  height: number;
  taken: number;
  thrown: boolean;
  killed: boolean;
  crush: number;
};

export function freshWild(): WildState {
  return { spooks: [], struck: [] };
}

/** The speed scale for an animal of `mass`: the fifth root of its mass
 * over the reference's. */
function sturdy(mass: number): number {
  return (mass / K.refMass) ** 0.2;
}

/** How crushed an animal met at `speed` m/s is, 0..1: nothing short of
 * `kill`, the body burst by `crush`. */
export function crushOf(mass: number, speed: number): number {
  const f = sturdy(mass);
  const u = (speed - K.kill * f) / ((K.crush - K.kill) * f);
  return u <= 0 ? 0 : u >= 1 ? 1 : u;
}

/** Where a struck animal is at run time `t` (into `out`): slid on from
 * the spot along its flight, slowed by the snow; lifted off it a moment
 * and down again; and whether it is still DOWN (always, if killed). */
export function struckAt(
  s: StruckBeast,
  t: number,
  out: { x: number; z: number; lift: number; down: boolean },
): { x: number; z: number; lift: number; down: boolean } {
  const u = Math.max(0, t - s.t);
  const k = K.slide;
  const along = (1 - Math.exp(-k * u)) / k;
  out.x = s.x + s.vx * along;
  out.z = s.z + s.vz * along;
  // Up off the snow and down again under gravity.
  const up = s.vy * u - 0.5 * TUNING.g * u * u;
  out.lift = up > 0 ? up : 0;
  out.down = s.killed || (s.knocked && u < K.downFor);
  return out;
}

/** The animal `member` of group `group` met and not yet back with it. */
export function struckOf(wild: WildState, group: number, member: number): StruckBeast | undefined {
  for (const s of wild.struck) if (s.group === group && s.member === member) return s;
  return undefined;
}

/** THE FRIGHTS of every group near the player (and the field), kept in
 * `state.wild`; and the knocked-down that have run back to their groups
 * let go. Every step of a free ride. */
export function stepWild(state: GameState): void {
  const wild = state.wild;
  if (!wild) return;
  const plan = beastPlanFor(state.level);
  if (wild.spooks.length !== plan.groups.length) {
    wild.spooks = plan.groups.map(() => CALM);
  }
  const ground = wildGround(state.level);
  const c = state.skier;
  for (let g = 0; g < plan.groups.length; g++) {
    const group = plan.groups[g];
    const spec = beastById(group.species);
    const spook = wild.spooks[g];
    // Too far from the round (where its flights have carried it) for any
    // skier to put it up.
    const cx = group.round.x + spook.ox + spook.dx;
    const cz = group.round.z + spook.oz + spook.dz;
    const reach = group.round.radius + spec.wary + K.reach;
    if (state.rivals.length === 0 && hypot(cx - c.x, cz - c.z) > reach) continue;
    wild.spooks[g] = spookAt(group, state, spook, ground);
  }
  for (let k = wild.struck.length - 1; k >= 0; k--) {
    const s = wild.struck[k];
    if (!s.killed && state.t - s.t >= (s.knocked ? K.downFor + K.rejoin : K.brush)) {
      wild.struck.splice(k, 1);
    }
  }
}

/**
 * THE ANIMALS MET by the rider on his skis, his board or the bike this
 * step: the first one he touches at speed exchanges momentum with him, is
 * filed as struck and reported (`BeastEvent`). Returns the velocity he is
 * thrown with when the blow takes `throws` off him, else null (his speed
 * already changed by what it took).
 */
export function beastStrike(state: GameState, events: GameEvent[]): Vec3 | null {
  const wild = state.wild;
  if (!wild || wild.spooks.length === 0 || !onSkis(state)) return null;
  const plan = beastPlanFor(state.level);
  const c = state.skier;
  const feet = c.y - c.spec.cogHeight;
  const t = state.t;
  for (let g = 0; g < plan.groups.length; g++) {
    const group = plan.groups[g];
    const spec = beastById(group.species);
    const spook = wild.spooks[g];
    const cx = group.round.x + spook.ox + spook.dx;
    const cz = group.round.z + spook.oz + spook.dz;
    if (hypot(cx - c.x, cz - c.z) > group.round.radius + spec.spread * group.count + K.reach) {
      continue;
    }
    const girth = Math.max(K.girthLeast, spec.height * K.girth);
    for (let i = 0; i < group.count; i++) {
      if (struckOf(wild, g, i)) continue;
      const p = beastPlace(group, spec, i, t, spook);
      if (Math.abs(p.x - c.x) > spec.length + 2 || Math.abs(p.z - c.z) > spec.length + 2) continue;
      const gy = state.level.groundAt(p.x, p.z);
      if (feet > gy + spec.height || feet + K.riderHeight < gy) continue;
      // The nearest point of its spine to him.
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const half = spec.length / 2;
      const along = Math.max(-half, Math.min(half, (c.x - p.x) * fx + (c.z - p.z) * fz));
      const sx = p.x + fx * along;
      const sz = p.z + fz * along;
      const dx = sx - c.x;
      const dz = sz - c.z;
      const d = hypot(dx, dz);
      if (d > girth + K.riderRadius) continue;
      const nx = d > 1e-6 ? dx / d : Math.sin(c.heading);
      const nz = d > 1e-6 ? dz / d : Math.cos(c.heading);
      // Its own way over the step, off the plan.
      const was = beastPlace(group, spec, i, t - dt, spook);
      const avx = (p.x - was.x) / dt;
      const avz = (p.z - was.z) / dt;
      const closing = (c.vx - avx) * nx + (c.vz - avz) * nz;
      if (closing < K.touch) continue;
      return meet(state, events, g, i, p, gy, avx, avz, nx, nz, closing);
    }
  }
  return null;
}

/** The blow itself: the exchange, the animal filed, the event, and the
 * rider's velocity when it throws him. */
function meet(
  state: GameState,
  events: GameEvent[],
  g: number,
  i: number,
  p: { x: number; z: number; heading: number },
  gy: number,
  avx: number,
  avz: number,
  nx: number,
  nz: number,
  closing: number,
): Vec3 | null {
  const wild = state.wild!;
  const c = state.skier;
  const group = beastPlanFor(state.level).groups[g];
  const spec = beastById(group.species);
  const mp = totalMass(c.spec);
  const ma = spec.mass;
  const j = ((1 + K.restitution) * closing) / (1 / mp + 1 / ma);
  const taken = j / mp;
  const flung = j / ma;
  const injuries = state.gore !== undefined;
  const crush = injuries ? crushOf(ma, closing) : 0;
  const killed = injuries && closing >= K.kill * sturdy(ma);
  const knocked = killed || closing >= K.knock;
  wild.struck.push({
    group: g,
    member: i,
    species: spec.id,
    t: state.t,
    x: p.x,
    y: gy,
    z: p.z,
    vx: knocked ? avx + flung * nx : 0,
    vy: knocked ? flung * K.lift : 0,
    vz: knocked ? avz + flung * nz : 0,
    heading: p.heading,
    killed,
    crush,
    knocked,
  });
  const v = { x: c.vx - taken * nx, y: c.vy, z: c.vz - taken * nz };
  const thrown = taken >= K.throws;
  events.push({
    kind: "beast",
    t: state.t,
    species: spec.id,
    group: g,
    member: i,
    x: p.x,
    y: gy,
    z: p.z,
    speed: closing,
    height: spec.height,
    taken,
    thrown,
    killed,
    crush,
  });
  if (thrown) return v;
  c.vx = v.x;
  c.vz = v.z;
  derive(c, state.level);
  return null;
}
