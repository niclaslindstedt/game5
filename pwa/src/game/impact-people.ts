// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON STRUCK, SEEN COMING — the read ahead's half of the IMPACT cam
// for a body run into (`engine/game/person-hit.ts`, `foot.ts`), beside the
// solids and the ropes `impact-forecast.ts` finds on its own. DOM-free and
// three-free.
//
// The copy of the run the read ahead steps (`forkRun`) keeps the PEOPLE ON
// FOOT — the civilians, the crews and the soldiers stand where closed-form
// plans put them, which a copy reads as cheaply as the run does — so a
// meeting with one of them comes out of the copy's own step as its
// `struck` event. THE CROWD is not copied: four hundred amateurs, each
// deciding and skiing, stepped five times over a frame is a frame's budget.
// What the read needs of them is only where each one near the player's
// path will be over the next second, and an amateur on his run holds his
// line and his speed over that long: each is DEAD-RECKONED from where he is
// and how he goes as the read begins (`ghostsOf`), and the copy's skier is
// met against those ghosts on the crowd's own geometry (`clipCrowd`: the
// player's two circles against the amateur's one, closing past
// `PERSON_HIT.strike`) with the engine's own exchange (`exchangeOf`) for
// what it will do to him. Nothing is written to the run or the copy: the
// copy's skier passes through a ghost untouched, and no digest moves.
//
// Only a HARD strike is the cam's (`hardStrike`): one that kills the
// person or hurts him past getting up, or closes faster than `PERSON_AHEAD.hard`
// — the cruise's knock under it is left to the game's own camera.

import {
  CROWD_SIZE,
  exchangeOf,
  PERSON_HIT,
  RACE,
  totalMass,
  type GameEvent,
  type GameState,
} from "@engine";

export const PERSON_AHEAD = {
  /** The closing speed past which a strike is the cam's whatever it does
   * to him, m/s: some 45 km/h, where the player himself goes down hurt
   * (`docs/body-hits.md`'s table). */
  hard: 12.5,
  /** The most an amateur is reckoned to close on the player at, m/s, for
   * which of them the read need carry. */
  pace: 20,
  /** Seconds the read goes on past a strike for the blow it does the
   * player's own body, which lands a step after the meeting
   * (`body-person.ts`), before it reports the strike alone. */
  wait: 0.1,
} as const;

/** An amateur as the read carries him: where he is as it begins, how he
 * goes then (m/s, in plan), his reach round his middle and his mass. */
export type Ghost = {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  mass: number;
  height: number;
};

/** A person met in the read: the spot the two meet (between them, at a
 * body's middle height), where the person stands, the closing speed and
 * what it does to him. */
export type PersonMet = {
  at: { x: number; y: number; z: number };
  person: { x: number; z: number };
  speed: number;
  killed: boolean;
  injured: boolean;
};

/** Whether a meeting is one the impact cam is shot for. */
export const hardStrike = (m: { speed: number; killed: boolean; injured: boolean }): boolean =>
  m.killed || m.injured || m.speed >= PERSON_AHEAD.hard;

const away = new Set(["queue", "ride", "skate", "lift", "down"]);

/** How far off a person may stand and still be met within `horizon` s. */
const reachOf = (state: GameState, horizon: number): number =>
  horizon * (state.skier.speed + PERSON_AHEAD.pace) + 3;

type AmateurOf = NonNullable<GameState["crowd"]>["amateurs"][number];

/** Whether amateur `a` may be met by a skier at (`x`, `z`) within `far` m:
 * none on a lift, down, under the snow, or hurt past getting up. */
const metable = (a: AmateurOf, x: number, z: number, far: number): boolean =>
  !away.has(a.mode) &&
  a.buried === undefined &&
  !a.dead &&
  !a.injured &&
  !a.hurt &&
  Math.abs(a.x - x) <= far &&
  Math.abs(a.z - z) <= far;

/** EVERY AMATEUR WHO MIGHT BE MET within `horizon` s, as he goes now. */
export function ghostsOf(state: GameState, horizon: number): Ghost[] {
  const crowd = state.crowd;
  if (!crowd) return [];
  const c = state.skier;
  const far = reachOf(state, horizon);
  const out: Ghost[] = [];
  for (const a of crowd.amateurs) {
    if (!metable(a, c.x, c.z, far)) continue;
    const size = CROWD_SIZE[a.body];
    out.push({
      id: a.id,
      x: a.x,
      z: a.z,
      vx: a.vx,
      vz: a.vz,
      radius: size.radius,
      mass: size.mass,
      height: PERSON_HIT.height[a.body],
    });
  }
  return out;
}

/** THE COPY'S SKIER AGAINST THE GHOSTS, `t` s into the read: the first
 * amateur he strikes, on `clipCrowd`'s geometry, or null. */
export function meetGhosts(run: GameState, ghosts: readonly Ghost[], t: number): PersonMet | null {
  const c = run.skier;
  if (!ghosts.length || c.thrown || c.lift || run.heli?.rider) return null;
  const B = RACE.bump;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const feet = c.y - c.spec.cogHeight;
  for (const g of ghosts) {
    const gx = g.x + g.vx * t;
    const gz = g.z + g.vz * t;
    if (Math.abs(gx - c.x) > 3 || Math.abs(gz - c.z) > 3) continue;
    if (Math.abs(run.level.groundAt(gx, gz) - feet) > 1.6) continue;
    for (const side of [-1, 1]) {
      const dx = gx - (c.x + fx * B.offset * side);
      const dz = gz - (c.z + fz * B.offset * side);
      const dist = Math.hypot(dx, dz);
      if (dist >= g.radius + B.radius) continue;
      const nx = dist > 1e-6 ? dx / dist : 1;
      const nz = dist > 1e-6 ? dz / dist : 0;
      const closing = (c.vx - g.vx) * nx + (c.vz - g.vz) * nz;
      if (closing < PERSON_HIT.strike) continue;
      const ex = exchangeOf(run, totalMass(c.spec), g.mass, closing);
      return {
        at: { x: (c.x + gx) / 2, y: feet + g.height * 0.55, z: (c.z + gz) / 2 },
        person: { x: gx, z: gz },
        speed: closing,
        killed: ex.killed,
        injured: ex.injured,
      };
    }
  }
  return null;
}

/** A person on foot struck in one of the copy's steps (its `struck`
 * event), or null. */
export function struckOnFoot(events: readonly GameEvent[]): PersonMet | null {
  for (const e of events) {
    if (e.kind !== "struck") continue;
    return {
      at: { x: e.x, y: e.y, z: e.z },
      // The spot is halfway between the two: the person stands as far on.
      person: { x: e.x, z: e.z },
      speed: e.speed,
      killed: e.killed,
      injured: e.injured,
    };
  }
  return null;
}

/** WHETHER ANYONE MIGHT BE MET within `horizon` s — the gate on reading
 * ahead at all for a person struck, with the X-ray switch off and the
 * skier under the speed any solid or rope would be the cam's at: an
 * amateur near, a person of the ski area's plan whose ground is near, or a
 * crew or a soldier out. */
export function peopleAhead(state: GameState, horizon: number): boolean {
  if (state.skier.speed < PERSON_HIT.strike) return false;
  if (state.rescue?.some((r) => r.crew?.length) || state.army) return true;
  const c = state.skier;
  const far = reachOf(state, horizon);
  for (const p of state.foot?.call?.people ?? [])
    if (Math.abs(p.rx - c.x) < far + p.rr && Math.abs(p.rz - c.z) < far + p.rr) return true;
  return state.crowd?.amateurs.some((a) => metable(a, c.x, c.z, far)) ?? false;
}
