// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHOWCASE — the run under the menu's cards: the daring bot
// (`daring.ts`) let loose on the mountain the player was last on, under the
// showcase's rules (`showcaseRules`: no course, no field, every trick his).
// Stated here once, for the app's backdrop and the daring lab alike: which
// runs are handed to it the moment the player leaves for the menu
// (`showcaseNow`), what one is stood up with (`showcaseOptions`), and THE
// RESTART RULE (`showcaseOver`) — a run that owes no course never finishes,
// so it is stood up again at the top once he is down on the valley floor,
// has gone nowhere downhill for a while (bogged, lying, or carried up a
// lift), or has been out long enough. The backdrop never sits still.
//
// And the lab's ride (`rideShowcase`): a showcase skied for a span of
// seconds, every restart taken, tallied the way `make daring` prints it.

import { nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { SKI_CATALOG, type SkiSpec } from "../game/defs/skis.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { createGame, step, type CreateGameOptions } from "../game/step.ts";
import type { GameState } from "../game/state.ts";
import { botInput, DARING_BOT, type BotProfile } from "./bot.ts";

export const SHOWCASE = {
  /** The pair he rides it on: the soft twin-tip, whose turned-up tail
   * rides a switch landing away (`switch.ts`). */
  skis: "hare",
  /** DOWN: within this far of the piste's end, m, or this far over its
   * end's height, m — and how long he is let run on there, s. */
  end: 25,
  floor: 4,
  settle: 3,
  /** GONE NOWHERE: no new low by `gain` m in `stall` s — counted afresh
   * once he stands `rise` m over the last low. */
  gain: 2,
  stall: 12,
  rise: 8,
  /** OUT LONG ENOUGH, s. */
  most: 300,
} as const;

/** The pair the showcase is ridden on. */
export function showcaseSkis(): SkiSpec {
  return SKI_CATALOG.find((s) => s.id === SHOWCASE.skis) ?? SKI_CATALOG[0];
}

/** Whether the map carries a course or a venue of a discipline set over it
 * (R31–R43): its run, left to the bot, is skied to its end as it is. */
export function venueOf(level: Level): boolean {
  return Boolean(
    level.slalom ??
    level.downhill ??
    level.superG ??
    level.giantSlalom ??
    level.speedSki ??
    level.skiCross ??
    level.slopestyle ??
    level.halfpipe ??
    level.moguls ??
    level.aerials ??
    level.skiJump,
  );
}

/** Whether the run the player leaves for the menu is handed to a showcase
 * at once: a run down a plain mountain's course. A discipline's course or
 * venue is skied on to its end first, and a run that owes no course (a free
 * ride, a tricks run) is the daring bot's as it stands. */
export function showcaseNow(state: GameState): boolean {
  return state.rules.course && !venueOf(state.level) && !state.summer;
}

/** A showcase on the run's own map: its seed, the mountain under any course
 * set over it (`createGame` skis the map's base), the showcase's pair, and
 * the next TAKE — one more than the run's own, so no two in a row are
 * skied the same way. */
export function showcaseOptions(state: GameState): CreateGameOptions {
  const take = state.showcase === undefined ? 0 : state.showcase + 1;
  return { level: state.level, seed: state.seed, showcase: take, spec: showcaseSkis() };
}

/** What the restart rule keeps of a run: the lowest he has been, s and m,
 * and when he first stood down at the bottom. */
type Watch = { low: number; lowAt: number; downAt: number };
const watches = new WeakMap<GameState, Watch>();
const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
const pt: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

export type ShowcaseEnd = "finished" | "bottom" | "stalled" | "long";

/** THE RESTART RULE: why a backdrop's run is over, or null while it goes
 * on — read once a frame or once a step, it keeps its own count beside the
 * state. A run that owes a course is over only at its flag. */
export function showcaseOver(state: GameState): ShowcaseEnd | null {
  if (state.progress.finished) return "finished";
  if (state.rules.course) return null;
  const c = state.skier;
  let w = watches.get(state);
  if (!w) watches.set(state, (w = { low: c.y, lowAt: state.t, downAt: -1 }));
  // A new low — or stood back up (a reset puts him on the piste up the
  // hill) or well above the old one, counted from there.
  const reset = state.events.some((e) => e.kind === "reset");
  if (reset || c.y < w.low - SHOWCASE.gain || c.y > w.low + SHOWCASE.rise) {
    w.low = c.y;
    w.lowAt = state.t;
  }
  const level = state.level;
  const L = level.track.length;
  const foot = trackPointAt(level, L, pt).y;
  const at = nearestTrackPoint(level, c.x, c.z, hit).s;
  const down = at >= L - SHOWCASE.end || c.y <= foot + SHOWCASE.floor;
  if (down && w.downAt < 0) w.downAt = state.t;
  if (w.downAt >= 0 && state.t - w.downAt >= SHOWCASE.settle) return "bottom";
  if (state.t - w.lowAt >= SHOWCASE.stall) return "stalled";
  if (state.t >= SHOWCASE.most) return "long";
  return null;
}

/** What a showcase ridden for a while came to — the lab's row. */
export type ShowcaseReport = {
  seconds: number;
  /** Flights that counted (`air.counts`), their air all told, s, the
   * longest, s, and the highest any went over the snow under it, m. */
  flights: number;
  airtime: number;
  longest: number;
  highest: number;
  /** Tricks turned in the air (loops, spins and grabs — each credited as
   * it comes round), and the combos they made banked on a landing and lost
   * to a fall. */
  tricks: number;
  flips: number;
  spins: number;
  grabs: number;
  banked: number;
  bailed: number;
  wipeouts: number;
  /** The share of his time on the snow spent off the piste, 0..1. */
  offPiste: number;
  /** The fastest he went, m/s. */
  top: number;
  /** The runs that ended, by why. */
  ends: Record<ShowcaseEnd, number>;
};

/** A SHOWCASE RIDDEN for `seconds` s on `level` by `profile` (the daring
 * bot when left out), stood up again at the top every time the restart
 * rule says — pure Node, deterministic. */
export function rideShowcase(
  level: Level,
  seconds: number,
  profile: BotProfile = DARING_BOT,
  spec: SkiSpec = showcaseSkis(),
): ShowcaseReport {
  const r: ShowcaseReport = {
    seconds,
    flights: 0,
    airtime: 0,
    longest: 0,
    highest: 0,
    tricks: 0,
    flips: 0,
    spins: 0,
    grabs: 0,
    banked: 0,
    bailed: 0,
    wipeouts: 0,
    offPiste: 0,
    top: 0,
    ends: { finished: 0, bottom: 0, stalled: 0, long: 0 },
  };
  let take = 0;
  const make = (): GameState =>
    createGame({ level, seed: level.seed, showcase: take++, spec, quiet: true });
  let state = make();
  let snow = 0;
  let off = 0;
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, botInput(state, profile));
    const c = state.skier;
    r.top = Math.max(r.top, c.speed);
    if (c.airborne && !c.thrown) {
      r.highest = Math.max(r.highest, c.y - level.groundAt(c.x, c.z));
    } else if (!c.thrown) {
      snow++;
      const at = nearestTrackPoint(level, c.x, c.z, hit);
      if (at.distance > trackPointAt(level, at.s, pt).width / 2 + 2) off++;
    }
    for (const e of state.events) {
      if (e.kind === "land" && e.airTime >= TUNING.air.counts) {
        r.flights++;
        r.airtime += e.airTime;
        r.longest = Math.max(r.longest, e.airTime);
      } else if (e.kind === "trick") {
        if (e.trick === "backflip" || e.trick === "frontflip") r.flips++;
        else if (e.trick === "spin" || e.trick === "half") r.spins++;
        else if (e.trick !== "air" && e.trick !== "landing") r.grabs++;
        else continue;
        r.tricks++;
      } else if (e.kind === "combo") r.banked++;
      else if (e.kind === "bail") r.bailed++;
      else if (e.kind === "wipeout") r.wipeouts++;
    }
    const end = showcaseOver(state);
    if (end) {
      r.ends[end]++;
      state = make();
    }
  }
  r.offPiste = snow > 0 ? off / snow : 0;
  return r;
}
