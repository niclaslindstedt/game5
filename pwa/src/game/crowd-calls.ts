// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE CALLED MID-RUN FOR THE CROWD — an amateur down hurt on
// his own (`engine/game/crowd-hurt.ts`), or run into and left injured, is
// called for once his body has come to rest: the machine flies in from
// down the valley to him as it does to the player on the run after his
// (`rescue-flight.ts`) — or, where none can set down near him, the ski
// patrol drives up on its snowmobiles (`rescue-dispatch.ts`) — with
// injuries on or off. A second one down near a
// machine still on the snow, with a stretcher's room aboard (`canTake`),
// is taken by that machine; any other calls one of its own, while fewer
// than `MOST` are out for the crowd — the rest wait their turn where they
// lie. The call is pushed into the run's own `GameState.rescue` (its
// clock the run's), so the engine holds a skier out of the landed machine
// and lets him take it (`steal.ts`) as any other; the book carries it into
// the runs after (`rescue-book.ts`). Its crew is sampled for the engine
// as it is made or joined (`crewTracks`), so the men a call brings are
// bodies the skier meets from the moment they step out.
//
// A pure function of the state, run after EVERY step the app takes of a
// run — live, a replay's playback and a replay's seek alike (`stepRun`) —
// so a replay makes the same calls on the same steps, and its run is the
// run again. DOM-free and three-free.

import {
  sledCallGone,
  step,
  waitsForRescue,
  type GameState,
  type RescueCall,
  type SkierInput,
} from "@engine";

import { CROWD_PALETTE, outfitOf } from "./crowd-dress.ts";
import { dispatchRescue, sledCall } from "./rescue-dispatch.ts";
import { canTake, planFlight, type RescueFlight } from "./rescue-flight.ts";
import { crewTracks } from "./rescue-tracks.ts";
import { walkersAhead } from "./dog-foot.ts";

/** How long his body lies still before the call is made, s (thrown). */
export const SETTLE = 3;
/** The most machines out for the crowd at once. */
export const MOST = 2;

// isolation:stateless: each call's flight, planned once (tests/support/isolation.ts).
/** Each call's flight, planned once a shape of it (a call joined is a new
 * shape). A memo of a pure planner: what it hands back is the same plan. */
const flights = new WeakMap<RescueCall, { n: number; flight: RescueFlight }>();
function flightOf(state: GameState, r: RescueCall): RescueFlight {
  const seen = flights.get(r);
  if (seen && seen.n === r.casualties.length) return seen.flight;
  const flight = planFlight(state.level, r.casualties);
  flights.set(r, { n: r.casualties.length, flight });
  return flight;
}

/** Whether call `r` is one made mid-run for the crowd. */
const forCrowd = (r: RescueCall): boolean => r.casualties.some((c) => c.amateur !== undefined);

/** EVERY AMATEUR WAITING, CALLED FOR: joined to a machine still on the
 * snow that can take him, else sent one of its own while there is one to
 * send. Returns the calls made or joined this step (for the lab). */
export function callCrowd(state: GameState): number {
  const crowd = state.crowd;
  if (!crowd || !state.rules.heli) return 0;
  let made = 0;
  for (const a of crowd.amateurs) {
    if (!waitsForRescue(a) || !a.thrown || a.thrown.t < SETTLE) continue;
    const calls = (state.rescue ??= []);
    if (calls.some((r) => r.casualties.some((c) => c.amateur === a.id))) continue;
    const o = outfitOf(a, crowd.groups[a.group], state.level.seed);
    const casualty = {
      x: a.x,
      z: a.z,
      known: 0,
      amateur: a.id,
      look: {
        body: a.body,
        dress: [o[0], o[1], o[2], o[4], o[5], o[6]].map((k) => CROWD_PALETTE[k]),
      },
    };
    // A machine still on the snow near him, with the room to take him.
    const join = calls.find(
      (r) =>
        (!r.kind || r.kind === "heli") &&
        r.stolen === undefined &&
        r.start >= 0 &&
        forCrowd(r) &&
        canTake(flightOf(state, r), a.x, a.z, state.t - r.start),
    );
    if (join) {
      join.casualties.push({ ...casualty, known: state.t - join.start });
      join.up = join.start + flightOf(state, join).lift;
      join.crew = crewTracks(state.level, join);
      made++;
      continue;
    }
    const out = calls.filter((r) => r.start >= 0 && forCrowd(r) && state.t < r.up).length;
    if (out >= MOST) continue;
    const sent = dispatchRescue(state.level, [casualty]);
    if (sent.sleds) {
      // Nowhere near him to set down: the patrol drives up (it takes him alone).
      const end = state.t + sledCallGone(sent.sleds);
      const call = sledCall(sent.sleds, state.t, end, [casualty], [null, null]);
      call.crew = crewTracks(state.level, call);
      calls.push(call);
      made++;
      continue;
    }
    const flight = sent.flight;
    const { x, y, z, heading, pitch, roll } = flight.site;
    const call: RescueCall = {
      start: state.t,
      site: { x, y, z, heading, pitch, roll },
      down: state.t + flight.down,
      up: state.t + flight.lift,
      casualties: [casualty],
    };
    flights.set(call, { n: 1, flight });
    call.crew = crewTracks(state.level, call);
    calls.push(call);
    made++;
  }
  return made;
}

/** ONE STEP OF A RUN as the app takes it: the engine's, then the crowd's
 * calls made — the one door every host of a run steps it through. */
export function stepRun(state: GameState, input: SkierInput): void {
  // The dog walkers' ways knotted on ahead of the clock (`dog-foot.ts`).
  walkersAhead(state.foot?.call, state.t);
  step(state, input);
  callCrowd(state);
}
