// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCES CALLED TO A MOUNTAIN, KEPT FROM RUN TO RUN — a run
// that ends INJURED (`GoreState.injured`) calls one for where he lay — or,
// where no machine can set down near him, the SKI PATROL on two
// snowmobiles (`rescue-dispatch.ts` chooses), which take nobody else and keep the
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
//
// A run that ends DEAD (`GoreState.dead`) calls the POLICE instead
// (`police-plan.ts`): a machine of its own, never sharing a casualty, its
// call carrying the scene's evidence (`police-scene.ts`' `evidenceOf`) —
// numbered from the point of impact, the run's last wipeout, which the app
// notes as the run goes (`noteImpact`), down to the body.

import type {
  Evidence,
  GameState,
  Level,
  RescueCall,
  RescueCasualty,
  RescueSledPlan,
} from "@engine";
import { sledCallGone, withRescue } from "@engine";

import { planPolice } from "./police-plan.ts";
import { evidenceOf, lyingAt } from "./police-scene.ts";
import { canTake, planFlight, type Called, type RescueFlight } from "./rescue-flight.ts";
import { withCrewTracks } from "./rescue-tracks.ts";
import { dispatchRescue, sledCall } from "./rescue-dispatch.ts";

export { stepRun } from "./crowd-calls.ts";

/** ONE CALL: the book's clock it was made at, its casualties (each's
 * `known` from the call), and its flight — or the snowmobiles' plan and
 * when each of the two was stolen, the call's clock — and, a police call,
 * its kind and the scene's evidence. */
export type BookedRide = {
  start: number;
  casualties: (Called & Pick<RescueCasualty, "look">)[];
  flight: RescueFlight | null;
  sleds?: { plan: RescueSledPlan; taken: (number | null)[] };
  kind?: "police";
  evidence?: Evidence[];
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
export const spotOf = lyingAt;

/** THE POINT OF IMPACT of every run under way: its last wipeout, where it
 * was seen (`noteImpact`, after every step), read when it ends. */
const impacts = new WeakMap<GameState, { x: number; z: number }>();

/** Note this step's wipeout, if it had one, as the run's point of impact. */
export function noteImpact(state: GameState): void {
  for (const e of state.events) if (e.kind === "wipeout") impacts.set(state, { x: e.x, z: e.z });
}

/** The point of impact noted for a run, or null. */
export const impactOf = (state: GameState): { x: number; z: number } | null =>
  impacts.get(state) ?? null;

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
  // THE CALLS MADE WHILE IT RAN, for the crowd (`crowd-calls.ts`): kept,
  // so the runs after see them through — who they came for out of the
  // crowd that run had, but still dressed as he was.
  for (const r of ended.rescue ?? []) {
    if (r.start < 0 || !r.casualties.some((c) => c.amateur !== undefined)) continue;
    const casualties = r.casualties.map(({ amateur: _, ...c }) => ({ ...c }));
    const start = book.clock + r.start;
    if (r.kind === "sled" && r.sleds) {
      const taken = [...(r.sledsTaken ?? [null, null])];
      book.rides.push({ start, casualties, flight: null, sleds: { plan: r.sleds, taken } });
    } else {
      book.rides.push({ start, casualties, flight: planFlight(level, casualties) });
    }
  }
  // A MACHINE STOLEN off the snow (`steal.ts`) is gone with its thief: its
  // crew call another, sent from the moment it was taken, for every
  // casualty it came for (the police to the same scene).
  for (const r of ended.rescue ?? []) {
    if (r.stolen === undefined) continue;
    const ride = book.rides.find((b) => Math.abs(b.start - book.clock - r.start) < 1e-6);
    if (!ride) continue;
    const casualties = ride.casualties.map((c) => ({ ...c, known: 0 }));
    ride.start = book.clock + r.stolen;
    ride.casualties = casualties;
    ride.flight =
      ride.kind === "police"
        ? planPolice(level, {
            x: casualties[0].x,
            z: casualties[0].z,
            evidence: ride.evidence ?? [],
          }).flight
        : planFlight(level, casualties);
  }
  if (ended.gore && ended.gore.dead >= 0) {
    // DEAD: the police, to a scene of their own.
    const at = spotOf(ended);
    const evidence = evidenceOf(ended, at, impactOf(ended));
    const casualties = [{ x: at.x, z: at.z, known: 0 }];
    const flight = planPolice(level, { ...at, evidence }).flight;
    book.rides.push({ start: now, casualties, flight, kind: "police", evidence });
  } else if (ended.gore && ended.gore.injured >= 0) {
    const at = spotOf(ended);
    const ride = book.rides.find(
      (r) => !r.kind && r.flight && canTake(r.flight, at.x, at.z, now - r.start),
    );
    const casualties = [{ x: at.x, z: at.z, known: 0 }];
    if (ride) {
      ride.casualties.push({ x: at.x, z: at.z, known: now - ride.start });
      ride.flight = planFlight(level, ride.casualties);
    } else {
      const sent = dispatchRescue(level, casualties);
      book.rides.push(
        sent.sleds
          ? {
              start: now,
              casualties,
              flight: null,
              sleds: { plan: sent.sleds, taken: [null, null] },
            }
          : { start: now, casualties, flight: sent.flight },
      );
    }
  }
  book.rides = book.rides.filter((r) => r.start + goneOf(r) > now);
  book.clock = now;
  // Each call's crew sampled for the engine, who meets them as bodies.
  return withRescue(next, withCrewTracks(level, callsOf(book)));
}

/** The calls under way, in the clock of the run starting at `book.clock`. */
export function callsOf(book: RescueBook): RescueCall[] {
  return book.rides.map((r) => {
    const start = r.start - book.clock;
    if (r.sleds) {
      const casualties = r.casualties.map((c) => ({ ...c }));
      return sledCall(r.sleds.plan, start, start + goneOf(r), casualties, r.sleds.taken);
    }
    const { x, y, z, heading, pitch, roll } = r.flight!.site;
    return {
      start,
      site: { x, y, z, heading, pitch, roll },
      down: start + r.flight!.down,
      up: start + r.flight!.lift,
      casualties: r.casualties.map((c) => ({ ...c })),
      ...(r.kind ? { kind: r.kind, evidence: (r.evidence ?? []).map((e) => ({ ...e })) } : {}),
    };
  });
}

/** THE APP'S BOOK: a run over and the next stood up (`App.tsx`'s restart). */
const shared = createRescueBook();
export const rescueAgain = (ended: GameState, next: GameState): GameState =>
  bookRun(shared, ended, next);
