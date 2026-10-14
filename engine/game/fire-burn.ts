// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING INTO A FIRE (`RunRules.fires`, a free ride's) — a camp fire or a
// bonfire (`fires.ts`) met by the skier on his skis or his board.
//
//   * He BURNS UP: any of his three footprint circles (the trees', so the
//     tips in the ring are in it as surely as the boots) inside a hearth,
//     his centre of gravity not clear over its flames, and he is thrown
//     onto his body (`fire`, a low stumble on into it) with his clothes
//     ALIGHT (`GameState.burn`). Thrown some other way, his body rolled or
//     slid into a hearth catches the same. While his clothes burn the heat
//     on him (`BurnState.flux`) is summed into his body's dose and judged
//     as it burns (`body.ts`): in a few seconds his airway, which
//     `gore.ts` reads as mortal — on a run that carries its wounds he
//     DIES of `fire`. Without them he lies burning until the reset stands
//     him up, put out.
//   * SAFE FOR WORK (`RunRules.sfw`): none of it. A hearth is a solid he is
//     held off at its edge, his way into it taken off, as a slow touch on a
//     piste machine is.
//
// No draw from the stream: what burns is a function of where he is.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { FIRE_BURN, FIRE_KINDS } from "./defs/fires.ts";
import { TUNING } from "./defs/tuning.ts";
import { envelopeOf } from "./defs/skis.ts";
import { firesNear, type Fire } from "./fires.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState } from "./state.ts";

/** HIS CLOTHES ALIGHT: which fire set them alight (`Fire.id`) and where he
 * caught (the point of the hearth he met, on its ground), the run's clock
 * when he did, whether they still BURN, how far the burn has gone (0 just
 * caught … 1 burnt out, `FIRE_BURN.lasts` s), and the heat on him this
 * step, kW/m² — 0 once out. The drawing reads all of it; `body.ts` the
 * flux. */
export type BurnState = {
  fire: string;
  x: number;
  y: number;
  z: number;
  t: number;
  burning: boolean;
  burnt: number;
  flux: number;
};

const K = TUNING.trees;
/** Where the three footprint circles stand along the skis, as shares of
 * their half-length (`collision.ts`'s own). */
const CIRCLES = [0.8, 0, -0.8];
const near: Fire[] = [];

/** The fire one of his circles is in, and the circle's place along the
 * skis (a share of their half-length), or null. */
function metFire(state: GameState): { fire: Fire; share: number } | null {
  const c = state.skier;
  const half = envelopeOf(c.spec).length / 2;
  if (firesNear(state.level, c.x, c.z, half + K.bodyRadius, near).length === 0) return null;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  for (const f of near) {
    // Over its flames, he clears it.
    if (c.y - f.y > f.flames + FIRE_BURN.over) continue;
    for (const share of CIRCLES) {
      const dx = c.x + fx * share * half - f.x;
      const dz = c.z + fz * share * half - f.z;
      if (hypot(dx, dz) < f.radius + K.bodyRadius) return { fire: f, share };
    }
  }
  return null;
}

/** SET ALIGHT by `f`, met at (x, z). */
function catchFire(state: GameState, f: Fire, x: number, z: number, events: GameEvent[]): void {
  if (state.burn?.burning) return;
  state.burn = {
    fire: f.id,
    x,
    y: f.y,
    z,
    t: state.t,
    burning: true,
    burnt: 0,
    flux: FIRE_BURN.flux,
  };
  events.push({ kind: "fire", t: state.t, what: "caught", fire: f.id, x, z });
}

/** RIDDEN INTO, on his skis, after the skier's own step: held off the
 * hearth (safe for work, and null), or — anywhere else — set alight there,
 * returning the velocity he is thrown with (the `fire` cause). */
export function fireStrike(
  state: GameState,
  events: GameEvent[],
): { x: number; y: number; z: number } | null {
  if (!state.rules.fires) return null;
  const met = metFire(state);
  if (!met) return null;
  const c = state.skier;
  if (state.rules.sfw) {
    holdOff(state, met.fire, met.share);
    return null;
  }
  const half = envelopeOf(c.spec).length / 2;
  const x = c.x + Math.sin(c.heading) * met.share * half;
  const z = c.z + Math.cos(c.heading) * met.share * half;
  catchFire(state, met.fire, x, z, events);
  return { x: c.vx, y: c.vy, z: c.vz };
}

/** HELD OFF A HEARTH: the circle in it pushed out to its edge along the
 * line from its middle, and his way into it taken off — the rest of his
 * speed kept, so he slides round it. Every fire near, twice, so a circle
 * pushed out of one hearth is not left in another. */
function holdOff(state: GameState, first: Fire, firstShare: number): void {
  const c = state.skier;
  const half = envelopeOf(c.spec).length / 2;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  for (let pass = 0; pass < 2; pass++) {
    for (const f of pass === 0 ? [first] : near) {
      for (const share of pass === 0 ? [firstShare] : CIRCLES) {
        const ox = fx * share * half;
        const oz = fz * share * half;
        const dx = c.x + ox - f.x;
        const dz = c.z + oz - f.z;
        const d = hypot(dx, dz);
        const reach = f.radius + K.bodyRadius;
        if (d >= reach) continue;
        const nx = d > 1e-6 ? dx / d : -fx;
        const nz = d > 1e-6 ? dz / d : -fz;
        c.x += nx * (reach - d);
        c.z += nz * (reach - d);
        const vn = c.vx * nx + c.vz * nz;
        if (vn < 0) {
          c.vx -= vn * nx;
          c.vz -= vn * nz;
        }
      }
    }
  }
  derive(c, state.level);
}

/** THE BURN, every step of a run that has fires: his body thrown or
 * lying caught in a hearth, his clothes burning down and the heat on them,
 * and — stood back up — put out. */
export function stepBurn(state: GameState, events: GameEvent[]): void {
  if (!state.rules.fires) return;
  const c = state.skier;
  const b = c.thrown;
  // Thrown, his body's middle rolled or slid into a hearth catches.
  let inFire: Fire | null = null;
  if (b) {
    for (const f of firesNear(state.level, b.x, b.z, K.bodyRadius, near)) {
      if (b.y - f.y < f.flames) inFire = f;
    }
    if (inFire && !state.rules.sfw) catchFire(state, inFire, b.x, b.z, events);
  }
  const burn = state.burn;
  if (!burn) return;
  // Stood back up, he is put out.
  if (!c.thrown) {
    if (burn.burning) {
      events.push({ kind: "fire", t: state.t, what: "out", fire: burn.fire, x: c.x, z: c.z });
    }
    delete state.burn;
    return;
  }
  const body = c.thrown;
  burn.burnt = Math.min(1, (state.t - burn.t) / FIRE_BURN.lasts);
  if (burn.burning && burn.burnt >= 1) {
    burn.burning = false;
    events.push({ kind: "fire", t: state.t, what: "out", fire: burn.fire, x: body.x, z: body.z });
  }
  // The heat on him: his clothes' while they burn, the fire's own while he
  // lies in it, whichever is the more.
  const lying = inFire ? FIRE_KINDS[inFire.kind].flux : 0;
  burn.flux = Math.max(burn.burning ? FIRE_BURN.flux : 0, lying);
}
