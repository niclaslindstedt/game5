// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEATHER OVER A RUN — a FRONT. R19 deals a map ONE sky and every race
// is run under it (eased by its jury, `jury.ts`). A FREE RIDE may be ridden
// for hours of the sky's clock (`SKY_CLOCK`: five minutes on the snow an
// hour of sun), and over hours a mountain's sky does not hold still: high
// cloud streams in ahead of a warm front, thickens to a grey lid and the
// snow starts out of it; a storm passes, the fall eases to showers and the
// sky breaks; a valley fog burns off by midday; a clear morning grows its
// afternoon heaps.
//
// So a free ride's map carries a FRONT (`Level.front`): the dealt sky first,
// then up to three more, each coming in over a while and held a while. It
// is DEALT ONCE off the map's own seed on a salt of its own (never
// `state.rng`) and laid on by `createGame` only when the run's rules ask for
// it (`RunRules.front` — the free ride's, and only when the app asks), so no
// race, trick run or lab that does not ask sees a different sky and no
// digest moves.
//
// THE TIMES. In nature a warm front's cirrus runs twelve hours or more
// ahead of its snow, a cold front clears in two or three, a valley fog
// burns off over a couple of hours of a winter's morning and a fair day's
// heaps build over the late morning. The game's clock already runs at
// twelve times real time, and a session is minutes; the front is squeezed
// a little further still, so a whole change plays out in a ride: each new
// sky COMES IN over 0.75–2 game hours and HOLDS 1–2.5 before the next, the
// first change starting 0.5–1.5 game hours in. Run seconds are game hours
// at the default sky clock (`FRONT_RATE`), whatever rate the app draws the
// sun at, so the snow it lays is the same at any picture rate.
//
// ASKED FOR AT A MOMENT through `frontAt` (the two skies either side and how
// far between, eased so nothing steps) or `weatherAt` (the numbers mixed —
// the fall, the fog, the wind). With no front both are the dealt sky
// itself, the very object `weatherOf` returns, so every reader that moved to
// them reads exactly what it did before on every map without one.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { snowfallBand, snows, weatherFor, weatherOf } from "./weather.ts";
import type { Level, Weather, WeatherKind } from "./types.ts";

/** One sky of a front: what it is, and when it comes in — starting at run
 * time `from`, wholly in by `full` (s). The first leg is the dealt sky,
 * in from the start. */
export interface FrontLeg {
  weather: Weather;
  from: number;
  full: number;
}

/** A map's weather over a run: its legs in order, the dealt sky first. */
export interface WeatherFront {
  legs: readonly FrontLeg[];
}

/** What sets the front's stream apart from the weather's own. */
const FRONT_SALT = 0x6f72e5c1;

/** Run seconds a game hour, at the default sky clock (`SKY_CLOCK.rate`, 12):
 * stated here because the generator may not import the game's clock. */
export const FRONT_RATE = 3600 / 12;

/** THE NUMBERS, in game hours. */
export const FRONT = {
  /** When the first change starts coming in. */
  first: [0.5, 1.5] as [number, number],
  /** How long a new sky takes to come in. */
  come: [0.75, 2] as [number, number],
  /** How long a sky holds once it is in, before the next starts. */
  hold: [1, 2.5] as [number, number],
  /** The most changes a front makes. */
  most: 3,
} as const;

/** WHAT A SKY MAY TURN INTO, and how likely each is. `stay` ends the front:
 * the sky holds for the rest of the ride. The chains are the ones a
 * mountain sees: clear → high → overcast → snow (a warm front coming in);
 * storm → snow → flurries → fair (a storm passing and clearing in the cold
 * air behind it); fog → clear or fair (burnt off); a clear morning's heaps
 * (fair) and their afternoon showers (flurries). Nothing turns INTO a valley
 * fog: one forms overnight, never under the run's own sun. */
export const FRONT_TURNS: Record<WeatherKind, Partial<Record<WeatherKind | "stay", number>>> = {
  clear: { high: 0.4, fair: 0.3, stay: 0.3 },
  fair: { flurries: 0.3, overcast: 0.25, clear: 0.2, stay: 0.25 },
  flurries: { fair: 0.4, snow: 0.25, clear: 0.15, stay: 0.2 },
  high: { overcast: 0.6, clear: 0.2, stay: 0.2 },
  overcast: { snow: 0.5, high: 0.2, stay: 0.3 },
  snow: { storm: 0.25, flurries: 0.35, overcast: 0.2, stay: 0.2 },
  storm: { snow: 0.5, flurries: 0.3, stay: 0.2 },
  fog: { clear: 0.5, fair: 0.3, stay: 0.2 },
};

const hours = (rng: { range(a: number, b: number): number }, band: [number, number]): number =>
  rng.range(band[0], band[1]) * FRONT_RATE;

/** DEAL the front over `level`: a pure function of its seed and its sky. */
export function dealFront(level: Pick<Level, "seed" | "weather">): WeatherFront {
  const first = weatherOf(level);
  const rng = createRng((level.seed ^ FRONT_SALT) >>> 0);
  const legs: FrontLeg[] = [{ weather: first, from: 0, full: 0 }];
  let at = hours(rng, FRONT.first);
  for (let i = 0; i < FRONT.most; i++) {
    const was = legs[legs.length - 1].weather;
    const turns = FRONT_TURNS[was.kind];
    let roll = rng.next();
    let next: WeatherKind | "stay" = "stay";
    for (const [k, p] of Object.entries(turns) as [WeatherKind | "stay", number][]) {
      roll -= p;
      if (roll < 0) {
        next = k;
        break;
      }
    }
    // Every draw is taken whether it is used or not, so one leg's numbers
    // never shift another's.
    const u = rng.next();
    const come = hours(rng, FRONT.come);
    const hold = hours(rng, FRONT.hold);
    if (next === "stay") break;
    const snowfall = snows(next)
      ? snowfallBand(next).min + (snowfallBand(next).max - snowfallBand(next).min) * u
      : 0;
    // Nothing turns into a fog (`FRONT_TURNS`), so a new sky has none.
    const weather = weatherFor(next, {
      snowfall,
      fog: 0,
      windFrom: first.windFrom,
      evening: first.evening,
      // The air's knob is the ride's, whichever sky it turns into.
      ...(first.temp === undefined ? {} : { temp: first.temp }),
    });
    legs.push({ weather, from: at, full: at + come });
    at += come + hold;
  }
  return { legs };
}

const fronted = new WeakMap<object, Level>();

/** The same map with its FRONT laid on: a shallow copy sharing every grid,
 * made once a map (the renderer draws the map it is handed, so a second
 * copy would be a map it never built). A map that has one already is
 * handed back as it is. */
export function withFront<L extends Level>(level: L): L {
  if (level.front) return level;
  const had = fronted.get(level);
  if (had) return had as L;
  const made: L = { ...level, front: dealFront(level) };
  fronted.set(level, made);
  return made;
}

/** The sky at a moment: the two either side and how far from `a` to `b`
 * (0..1, eased). Off a front — or before its first change — `a` and `b`
 * are the same sky and `share` 0. */
export interface FrontNow {
  a: Weather;
  b: Weather;
  share: number;
  /** Which leg `b` is (`WeatherFront.legs`); `a` the one before it while
   * `share` is over 0. 0 off a front. */
  leg: number;
}

/** HOW A CHANGE COMES IN, x (0..1 of its time) to how far it has come: a
 * smooth start and stop — it creeps in, runs, and settles. */
export function frontEase(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** The area under `frontEase` from 0 to `x` — what a quantity eased in
 * over a change has added up to (a cloud's drift, `cloud-front.ts`). */
export function frontEaseArea(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t - (t * t * t * t) / 2 + Math.max(0, x - 1);
}

const ease = frontEase;

/** THE FRONT AT run time `t` on `level`. */
export function frontAt(level: Pick<Level, "weather" | "front">, t: number): FrontNow {
  const w = weatherOf(level);
  const legs = level.front?.legs;
  if (!legs || legs.length < 2 || t <= legs[1].from) return { a: w, b: w, share: 0, leg: 0 };
  let i = 1;
  while (i + 1 < legs.length && t > legs[i + 1].from) i++;
  const leg = legs[i];
  const share = ease((t - leg.from) / Math.max(1e-6, leg.full - leg.from));
  return share >= 1
    ? { a: leg.weather, b: leg.weather, share: 0, leg: i }
    : { a: legs[i - 1].weather, b: leg.weather, share, leg: i };
}

/** THE WEATHER AT run time `t` on `level`: the dealt sky off a front (the
 * very object `weatherOf` hands back); on one, the two skies either side
 * mixed — the fall, the fog and the wind by the share, the KIND the nearer
 * one's. A reader that needs the change smooth (a picture) asks `frontAt`
 * and mixes the two skies' own looks. */
export function weatherAt(level: Pick<Level, "weather" | "front">, t: number): Weather {
  if (!level.front) return weatherOf(level);
  const { a, b, share } = frontAt(level, t);
  if (share <= 0) return a;
  const mix = (x: number, y: number): number => x + (y - x) * share;
  return {
    kind: share < 0.5 ? a.kind : b.kind,
    snowfall: mix(a.snowfall, b.snowfall),
    fog: mix(a.fog, b.fog),
    wind: mix(a.wind, b.wind),
    windFrom: a.windFrom,
    evening: a.evening,
    ...(a.temp === undefined ? {} : { temp: a.temp }),
  };
}
