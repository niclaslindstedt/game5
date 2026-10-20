// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A CALL'S CREW WALK, FOR THE ENGINE — every man of an air
// ambulance's or a police machine's crew sampled off its plan over the
// call, so the skier meets them as BODIES (`engine/game/foot.ts`): the
// engine reads a `CrewTrack` a man, carried on the `RescueCall` it is
// handed (`rescue-book.ts`), and a replay handed the same call meets them
// at the same places. The plan is the view's own (`rescue-view.ts` plans
// the same call the same way off the same map), so the man the engine
// meets is the man drawn. The ski patrol on its snowmobiles is sampled
// the same way off its own plan of the scene (`rescue-sleds-crew.ts`), each
// man only while he is on foot — sat on a machine he is the machine's. A
// machine the skier takes changes the way back to it, and nothing sampled
// can know when, so each patrolman's track names his machine and the
// moment from which his way depends on it (`CrewTrack.sled`). DOM-free and
// three-free.

import { sledCallGone, type CrewTrack, type Level, type RescueCall } from "@engine";

import { BEARERS } from "./rescue-defs.ts";
import { OFFICERS } from "./police-defs.ts";
import { freshPoliceFrame, planPolice, policeAt } from "./police-plan.ts";
import { flightAt, freshFlightFrame, planFlight, type FlightFrame } from "./rescue-flight.ts";
import { SLED_SEATS, crewPlanOf, freshSledCrewFrame, sledCrewAt } from "./rescue-sleds-crew.ts";

/** The step between two samples of a man's way, s: a man walks some 0.4 m
 * in it, and a straight walk read between two is exact. */
export const CREW_STEP = 0.25;

/** The seconds into call `c` its people are at, at the run's clock `t`:
 * held at the moment its machine was stolen from under them (the view's
 * clock, `rescue-view.ts`). */
const callClock = (c: RescueCall, t: number): number => Math.min(t, c.stolen ?? Infinity) - c.start;

/** To the centimetre. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/** THE CREW OF CALL `call` on `level`, each man's way from the run's 0 (or
 * the touch-down, later) to the lift, as the view plans and draws them. */
export function crewTracks(level: Level, call: RescueCall): CrewTrack[] {
  if (call.kind === "sled") return patrolTracks(level, call);
  const police = call.kind === "police";
  const at = call.casualties[0];
  const plan = police
    ? planPolice(level, { x: at.x, z: at.z, evidence: call.evidence ?? [] })
    : null;
  const flight = plan ? plan.flight : planFlight(level, call.casualties);
  const frame: FlightFrame = plan ? freshPoliceFrame() : freshFlightFrame();
  const bodies = [...BEARERS.map((b) => b.body), ...(police ? [OFFICERS[2].body] : [])];
  const t0 = Math.max(0, call.down);
  const n = Math.max(0, Math.ceil((call.up - t0) / CREW_STEP) + 1);
  const tracks = bodies.map((body) => ({ body, t0, dt: CREW_STEP, xz: new Array<number>(2 * n) }));
  for (let k = 0; k < n; k++) {
    const u = callClock(call, t0 + k * CREW_STEP);
    if (plan) policeAt(level, plan, u, frame as ReturnType<typeof freshPoliceFrame>);
    else flightAt(level, flight, u, frame);
    for (let j = 0; j < tracks.length; j++) {
      const c = frame.crew[j];
      const shown = !!c && c.shown;
      tracks[j].xz[2 * k] = shown ? cm(c.x) : NaN;
      tracks[j].xz[2 * k + 1] = shown ? cm(c.z) : NaN;
    }
  }
  return n > 0 ? tracks : [];
}

/** THE SKI PATROL OF CALL `call` (`kind: "sled"`), each man's way on foot
 * from the run's 0 (or the call's start, later) until the convoy is gone,
 * as the view plans and draws them. */
export function patrolTracks(level: Level, call: RescueCall): CrewTrack[] {
  const plan = call.sleds;
  if (!plan) return [];
  const at = call.casualties[0];
  const taken = call.sledsTaken;
  const t0 = Math.max(0, call.start);
  const end = call.start + sledCallGone(plan, taken);
  const n = Math.max(0, Math.ceil((end - t0) / CREW_STEP) + 1);
  if (n === 0) return [];
  const sure = call.start + crewPlanOf(level, plan, at).at.up;
  const frame = freshSledCrewFrame();
  const tracks = BEARERS.map((b, j) => {
    const k = SLED_SEATS[j].sled;
    const sled = { k, taken: taken?.[k] ?? null, sure };
    return { body: b.body, t0, dt: CREW_STEP, xz: new Array<number>(2 * n), sled };
  });
  for (let i = 0; i < n; i++) {
    sledCrewAt(level, plan, at, taken, t0 + i * CREW_STEP - call.start, frame);
    for (let j = 0; j < tracks.length; j++) {
      const c = frame.crew[j];
      const afoot = c.shown && !frame.seats[j];
      tracks[j].xz[2 * i] = afoot ? cm(c.x) : NaN;
      tracks[j].xz[2 * i + 1] = afoot ? cm(c.z) : NaN;
    }
  }
  return tracks;
}

/** Every call of `calls` with its crew's tracks on it. */
export function withCrewTracks(level: Level, calls: RescueCall[]): RescueCall[] {
  for (const c of calls) c.crew = crewTracks(level, c);
  return calls;
}
