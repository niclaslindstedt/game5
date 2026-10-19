// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TAKING A MACHINE THAT IS NOT HIS — a skier who walks up to somebody
// else's machine standing on the snow (the air ambulance landed for an
// earlier run's casualty, `rescue-call.ts`) and gives THE MACHINE PRESS
// (`SkierInput.machine`) takes it: the owners are left standing, and the
// machine is his to drive or fly as his own would be.
//
// The mechanic is one shape for every such machine, so a new one is a
// SOURCE (where its parked machines stand, and how it learns one was
// taken) and, for a new kind of machine, a TAKER (how the run's own
// machine of that kind becomes the taken one):
//   * A source lists what it has PARKED this step (`StealTarget`: the kind, the
//     livery it is drawn in, where it stands and where its door is) and is
//     told when one is TAKEN, so it stops standing it there — the rescue's
//     call keeps the run's clock it was stolen at (`RescueCall.stolen`).
//   * A taker turns the run's own machine of that kind (`run.heli` for a
//     helicopter) into the taken one at its stand, in its livery, the
//     skier aboard (`heli.ts`'s `takeHeli`). Once taken it is the run's
//     machine like any other: flown, landed, left and crashed by its own
//     rules; only what it is drawn in (its `livery`) is the owner's.
// What the HUD offers the press on is `stealWithin` — the same question.
//
// Pure over the state and the clock; nothing here draws from the stream,
// and a run with nothing parked never gets past the first line, so no
// digest moves.

import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { HELI } from "./defs/heli.ts";
import { onSkis } from "./groomer.ts";
import { heliWithin, takeHeli } from "./heli.ts";
import { SEAT } from "./heli-rotor.ts";
import { inGrace } from "./machine-grace.ts";
import type { HeliLivery } from "./heli-state.ts";
import type { GameEvent, GameState } from "./state.ts";

export type { HeliLivery } from "./heli-state.ts";

/** The kinds of machine a skier can take, each with its taker. */
export type StealKind = "heli";

/** ONE MACHINE PARKED where a skier may take it: its kind and the livery
 * it is drawn in, which source it is (`from`) and its index there, where
 * it stands (its datum, heading and attitude, the run's own machine's
 * conventions) and where its DOOR is on the snow — the point he must
 * stand within `reach` of, slower than `fastest`, m and m/s. */
export type StealTarget = {
  kind: StealKind;
  livery: HeliLivery;
  from: string;
  index: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  door: { x: number; z: number };
  reach: number;
  fastest: number;
  /** The rotor's share of its rpm as it stands (a machine left running). */
  spool: number;
};

/** A MACHINE TAKEN from its owners: which kind, the livery it is drawn in,
 * the source it stood in (`StealSource.id`) and its index there, and where
 * it stood. */
export type StealEvent = {
  kind: "steal";
  t: number;
  vehicle: StealKind;
  livery: HeliLivery;
  from: string;
  index: number;
  x: number;
  z: number;
};

/** A SOURCE of machines to take: what it has parked this step (appended to
 * `out`), and what it does once one of them is taken. */
export type StealSource = {
  id: string;
  parked(state: GameState, out: StealTarget[]): void;
  taken(state: GameState, index: number): void;
};

/** Where a helicopter's seat on the skid comes down on the snow, standing
 * at (x, y, z) with the attitude given — its door, for the press. */
export function heliDoor(at: {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
}): { x: number; z: number } {
  const w = rotate(fromEuler(at.heading, at.pitch, at.roll), SEAT);
  return { x: at.x + w.x, z: at.z + w.z };
}

/** THE AIR AMBULANCES on their skids (`GameState.rescue`), each between
 * touching down and lifting, and not already taken. Its crew keep the
 * rotor turning while they work (`rescue-flight.ts`), so it is taken with
 * the rotor at speed. */
const RESCUE_SOURCE: StealSource = {
  id: "rescue",
  parked(state, out) {
    const calls = state.rescue;
    if (!calls?.length || !state.heli) return;
    for (let i = 0; i < calls.length; i++) {
      const r = calls[i];
      if (r.stolen !== undefined || state.t < r.down || state.t >= r.up) continue;
      out.push({
        kind: "heli",
        livery: r.kind === "police" ? "police" : "rescue",
        from: "rescue",
        index: i,
        ...r.site,
        door: heliDoor(r.site),
        reach: HELI.board.reach,
        fastest: HELI.board.fastest,
        spool: 1,
      });
    }
  },
  taken(state, index) {
    const r = state.rescue?.[index];
    if (r) r.stolen = state.t;
  },
};

/** EVERY SOURCE, in the order the press looks at them. A machine added to
 * the mechanic is a row here. */
export const STEAL_SOURCES: StealSource[] = [RESCUE_SOURCE];

/** THE TAKERS: the run's own machine of each kind made the taken one, the
 * skier aboard — false when the run carries no such machine to become it. */
const TAKERS: Record<StealKind, (run: GameState, p: StealTarget, events: GameEvent[]) => boolean> =
  {
    heli: (run, p, events) => takeHeli(run, p, p.livery, p.spool, events),
  };

const found: StealTarget[] = [];

/** WHICH MACHINE THE PRESS TAKES: the nearest parked one whose door he
 * stands within reach of, on his skis and slow enough — or null. Never
 * while he can board his own (the press is his own machine's) or just
 * after stepping off one (`machine-grace.ts`). */
export function stealWithin(state: GameState): StealTarget | null {
  if (inGrace(state) || !onSkis(state) || heliWithin(state)) return null;
  const c = state.skier;
  found.length = 0;
  for (const s of STEAL_SOURCES) s.parked(state, found);
  let best: StealTarget | null = null;
  let near = Infinity;
  for (const p of found) {
    const d = hypot(c.x - p.door.x, c.z - p.door.z);
    if (d > p.reach || d >= near || c.speed > p.fastest) continue;
    best = p;
    near = d;
  }
  return best ? { ...best } : null;
}

/** THE PRESS ON A MACHINE THAT IS NOT HIS, before his own machines are
 * stepped: taken, its source told, and a `steal` said. True when it took
 * one — the press is spent, and the step is the machine's. */
export function stepSteal(
  run: GameState,
  input: { machine?: boolean },
  events: GameEvent[],
): boolean {
  if (!input.machine) return false;
  const p = stealWithin(run);
  if (!p || !TAKERS[p.kind](run, p, events)) return false;
  STEAL_SOURCES.find((s) => s.id === p.from)?.taken(run, p.index);
  events.push({
    kind: "steal",
    t: run.t,
    vehicle: p.kind,
    livery: p.livery,
    from: p.from,
    index: p.index,
    x: p.x,
    z: p.z,
  });
  return true;
}
