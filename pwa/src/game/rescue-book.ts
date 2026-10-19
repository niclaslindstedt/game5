// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCES CALLED TO A MOUNTAIN, KEPT FROM RUN TO RUN — a run
// that ends INJURED (`GoreState.injured`) calls one for where he lay — or,
// where no machine can set down near him (`fitToLand`), the SKI PATROL on
// two snowmobiles (`planSledRescue`), which take nobody else and keep the
// machines the player stole from them stolen (`RescueCall.sledsTaken`,
// read back off the run that ended) — and
// the runs after it see it come: the first sees it FLOWN IN and set down
// (`rescue-flight.ts`), a later one finds it landed, its crew at work, or
// gone. A second casualty while a machine is still on the snow, near
// enough and with a stretcher's room aboard (`canTake`), is taken by THAT
// machine — its crew walk over for him once the first is loaded; any other
// calls a machine of its own.
//
// The book's clock runs on through every run on the map (each run's own
// clock starts at 0): a call keeps the book's time it was made at, and each
// new run is handed its calls in its own clock (`RescueCall`, which the
// engine reads to hold the skier out of a landed machine and the view
// draws). DOM-free and three-free; the app keeps one book (`rescueAgain`).

import type { GameState, Level, RescueCall, RescueSledPlan } from "@engine";
import { RAGDOLL, planSledRescue, sledCallGone, withRescue } from "@engine";

import { canTake, planFlight, type Called, type RescueFlight } from "./rescue-flight.ts";
import { fitToLand } from "./rescue-plan.ts";

/** ONE CALL: the book's clock it was made at, its casualties (each's
 * `known` from the call), and its flight — or the snowmobiles' plan and
 * when each of the two was stolen, the call's clock. */
export type BookedRide = {
  start: number;
  casualties: Called[];
  flight: RescueFlight | null;
  sleds?: { plan: RescueSledPlan; taken: (number | null)[] };
};

/** When a ride is over, s from its call. */
function goneOf(r: BookedRide): number {
  if (r.sleds) return sledCallGone(r.sleds.plan, r.sleds.taken);
  return r.flight!.gone;
}

export type RescueBook = {
  /** The map the calls are on (a new map clears them). */
  level: Level | null;
  /** The book's clock at the start of the run under way, s. */
  clock: number;
  rides: BookedRide[];
};

export function createRescueBook(): RescueBook {
  return { level: null, clock: 0, rides: [] };
}

/** Where he lay as a run ended: his hips off his thrown body, else where
 * he was. */
export function spotOf(s: GameState): { x: number; z: number } {
  const P = s.skier.thrown?.points;
  if (!P) return { x: s.skier.x, z: s.skier.z };
  const a = 3 * RAGDOLL.hipL;
  const b = 3 * RAGDOLL.hipR;
  return { x: (P[a] + P[b]) / 2, z: (P[a + 2] + P[b + 2]) / 2 };
}

/** Whether two maps are the same mountain (a restart may stand a map up
 * afresh off the same seed). */
function sameMap(a: Level, b: Level): boolean {
  return a === b || (a.seed === b.seed && a.version === b.version && a.size === b.size);
}

/**
 * RUN `ended` IS OVER AND `next` STARTS: an injured end calls a rescue (or
 * joins one), the calls long over are dropped, and `next` is handed the
 * ones still under way in its own clock (`withRescue`). Returns `next`.
 */
export function bookRun(book: RescueBook, ended: GameState, next: GameState): GameState {
  const level = next.level;
  if (!book.level || !sameMap(book.level, ended.level) || !sameMap(ended.level, level)) {
    book.rides = [];
    book.clock = 0;
  }
  book.level = level;
  // The patrol's machines the run that ended stole, kept stolen.
  for (const call of ended.rescue ?? []) {
    const ride = book.rides.find((r) => Math.abs(r.start - book.clock - call.start) < 1e-6);
    if (ride?.sleds && call.sledsTaken) ride.sleds.taken = [...call.sledsTaken];
  }
  const now = book.clock + Math.max(0, ended.t);
  if (ended.gore && ended.gore.injured >= 0) {
    const at = spotOf(ended);
    const ride = book.rides.find((r) => r.flight && canTake(r.flight, at.x, at.z, now - r.start));
    const casualties = [{ x: at.x, z: at.z, known: 0 }];
    const sleds = ride || fitToLand(level, at) ? null : planSledRescue(level, at);
    if (ride) {
      ride.casualties.push({ x: at.x, z: at.z, known: now - ride.start });
      ride.flight = planFlight(level, ride.casualties);
    } else if (sleds) {
      book.rides.push({
        start: now,
        casualties,
        flight: null,
        sleds: { plan: sleds, taken: [null, null] },
      });
    } else {
      book.rides.push({ start: now, casualties, flight: planFlight(level, casualties) });
    }
  }
  book.rides = book.rides.filter((r) => r.start + goneOf(r) > now);
  book.clock = now;
  return withRescue(next, callsOf(book));
}

/** The calls under way, in the clock of the run starting at `book.clock`. */
export function callsOf(book: RescueBook): RescueCall[] {
  return book.rides.map((r) => {
    const start = r.start - book.clock;
    if (r.sleds) {
      const p = r.sleds.plan.park[0];
      const end = start + goneOf(r);
      return {
        start,
        site: { x: p.x, y: 0, z: p.z, heading: p.heading, pitch: 0, roll: 0 },
        down: end,
        up: end,
        casualties: r.casualties.map((c) => ({ ...c })),
        kind: "sled" as const,
        sleds: r.sleds.plan,
        sledsTaken: [...r.sleds.taken],
      };
    }
    const { x, y, z, heading, pitch, roll } = r.flight!.site;
    return {
      start,
      site: { x, y, z, heading, pitch, roll },
      down: start + r.flight!.down,
      up: start + r.flight!.lift,
      casualties: r.casualties.map((c) => ({ ...c })),
    };
  });
}

/** THE APP'S BOOK: a run over and the next stood up (`App.tsx`'s restart). */
const shared = createRescueBook();
export const rescueAgain = (ended: GameState, next: GameState): GameState =>
  bookRun(shared, ended, next);
