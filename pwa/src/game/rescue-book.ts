// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCES CALLED TO A MOUNTAIN, KEPT FROM RUN TO RUN — a run
// that ends INJURED (`GoreState.injured`) calls one for where he lay, and
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

import type { GameState, Level, RescueCall } from "@engine";
import { RAGDOLL, withRescue } from "@engine";

import { canTake, planFlight, type Called, type RescueFlight } from "./rescue-flight.ts";

/** ONE CALL: the book's clock it was made at, its casualties (each's
 * `known` from the call), its flight. */
export type BookedRide = { start: number; casualties: Called[]; flight: RescueFlight };

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
  const now = book.clock + Math.max(0, ended.t);
  if (ended.gore && ended.gore.injured >= 0) {
    const at = spotOf(ended);
    const ride = book.rides.find((r) => canTake(r.flight, at.x, at.z, now - r.start));
    if (ride) {
      ride.casualties.push({ x: at.x, z: at.z, known: now - ride.start });
      ride.flight = planFlight(level, ride.casualties);
    } else {
      const casualties = [{ x: at.x, z: at.z, known: 0 }];
      book.rides.push({ start: now, casualties, flight: planFlight(level, casualties) });
    }
  }
  book.rides = book.rides.filter((r) => r.start + r.flight.gone > now);
  book.clock = now;
  return withRescue(next, callsOf(book));
}

/** The calls under way, in the clock of the run starting at `book.clock`. */
export function callsOf(book: RescueBook): RescueCall[] {
  return book.rides.map((r) => {
    const start = r.start - book.clock;
    const { x, y, z, heading, pitch, roll } = r.flight.site;
    return {
      start,
      site: { x, y, z, heading, pitch, roll },
      down: start + r.flight.down,
      up: start + r.flight.lift,
      casualties: r.casualties.map((c) => ({ ...c })),
    };
  });
}

/** THE APP'S BOOK: a run over and the next stood up (`App.tsx`'s restart). */
const shared = createRescueBook();
export const rescueAgain = (ended: GameState, next: GameState): GameState =>
  bookRun(shared, ended, next);
