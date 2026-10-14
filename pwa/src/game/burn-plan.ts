// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER BURNING, DECIDED — for `burn-view.ts`, three-free: where on his
// body the flames stand, how far up him the fire has run, how hard each
// patch burns, how black his clothes are, the smoke and the light, all off
// the engine's `GameState.burn` (`engine/game/fire-burn.ts`) and the run's
// clock. Presentation only.
//
// What it is modelled on (`docs/fires.md`): a ski suit is synthetic — a
// nylon or polyester shell over a synthetic fill — and synthetics do not
// smoulder, they MELT AND KEEP BURNING, dripping as they go. A body alight
// burns UP: the flames run up the legs and the trunk toward the head in a
// few seconds, the trunk (the jacket's shell and fill, the most fuel) the
// fiercest, the helmet's shell last and least; the smoke off melting
// plastic is thick and black, not a wood fire's grey. Once the cloth is
// spent the flames die down over the last seconds of the burn
// (`FIRE_BURN.lasts`), and what is left smoulders: a few embers glowing in
// the charred cloth and thin wisps of smoke.

import type { GameState } from "@engine";

import { bindPose } from "./dress-loft.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";

/** How the burn is drawn, s and shares of his height (feet 0 … crown 1).
 *   * `climb`: how long the fire takes to run from his feet to his crown;
 *     `start` how far up it stands the moment he catches (his skis and
 *     boots met the hearth); `ramp` the band a patch takes to catch fully.
 *   * `fade`: the share of the burn (`BurnState.burnt`) the flames hold at
 *     full until, and what is left of them at its end.
 *   * `char`: how far behind the fire his cloth is black (`band`, a share
 *     of his height), how long it takes to char right through (`deep`, s),
 *     and the first char a flame leaves (`first`).
 *   * `smoulder`: how long the embers and wisps last once the flames are
 *     out, s.
 *   * `light`: the flames' light at full, lamp units (`haze.ts`; a camp
 *     fire's is 0.8), and how far over his middle it stands, m.
 *   * `lying`: his flames' height and width once he is down — a body
 *     burning flat on the snow burns lower than one stood up, and the
 *     figure shows through. */
export const BURN_LOOK = {
  climb: 4,
  start: 0.12,
  ramp: 0.1,
  fade: { from: 0.5, left: 0.12 },
  char: { band: 0.3, deep: 6, first: 0.3 },
  smoulder: 40,
  light: { power: 1.1, up: 0.5 },
  lying: { height: 0.6, width: 0.8 },
} as const;

/** What a patch of him is: the jacket (the most fuel, the tallest
 * flames), the pants, the helmet. */
export type BurnStuff = "jacket" | "pants" | "helmet";

/** A flame's size by what burns, m (width, height), and how hard it burns
 * as a share. */
export const BURN_FLAMES: Record<BurnStuff, { width: number; height: number; heat: number }> = {
  jacket: { width: 0.5, height: 0.95, heat: 1 },
  pants: { width: 0.4, height: 0.72, heat: 0.85 },
  helmet: { width: 0.32, height: 0.5, heat: 0.6 },
};

/** A PATCH OF HIM ALIGHT: on `bone`, `along` its length (a share), `around`
 * it (rad, in its x–z plane), `out` from its axis (m); `stuff` what burns
 * there, `h` how high on him it is in the bind pose (0 feet … 1 crown) —
 * the order the fire reaches it in — and `seed` its own 0…1. */
export type BurnSite = {
  bone: SkierBone;
  along: number;
  around: number;
  out: number;
  stuff: BurnStuff;
  h: number;
  seed: number;
};

type Lay = [SkierBone, BurnStuff, number, readonly number[], number];
/** Where the patches are: each bone, what burns on it, how far out, the
 * shares along it and how many round it. */
const LAYS: readonly (readonly [...Lay])[] = [
  ["shin_l", "pants", 0.07, [0.25, 0.7], 2],
  ["shin_r", "pants", 0.07, [0.25, 0.7], 2],
  ["thigh_l", "pants", 0.09, [0.2, 0.65], 2],
  ["thigh_r", "pants", 0.09, [0.2, 0.65], 2],
  ["pelvis", "jacket", 0.13, [0.3], 3],
  ["chest", "jacket", 0.15, [0.15, 0.6, 0.95], 3],
  ["upperarm_l", "jacket", 0.07, [0.4], 2],
  ["upperarm_r", "jacket", 0.07, [0.4], 2],
  ["forearm_l", "jacket", 0.06, [0.4], 1],
  ["forearm_r", "jacket", 0.06, [0.4], 1],
  ["head", "helmet", 0.12, [0.7], 2],
];

/** A hash of three numbers to 0…1. */
export function burnHash(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A point of a bone's frame: `along` its length, `around` and `out`. */
export function boneAt(
  f: BoneFrame,
  along: number,
  around: number,
  out: number,
  into: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const c = Math.cos(around) * out;
  const s = Math.sin(around) * out;
  const l = along * f.length;
  into.x = f.head.x + f.y.x * l + f.x.x * c + f.z.x * s;
  into.y = f.head.y + f.y.y * l + f.x.y * c + f.z.y * s;
  into.z = f.head.z + f.y.z * l + f.x.z * c + f.z.z * s;
  return into;
}

/** His height in the bind pose, m: his boots' soles and his crown. */
export const BODY_SPAN = (() => {
  const f = bindPose().frames;
  const head = f.head;
  return { foot: f.boot_l.head.y - 0.06, crown: head.head.y + head.y.y * head.length + 0.1 };
})();

/** How high on him (0 feet … 1 crown) a height in the bind pose is. */
export const heightShare = (y: number): number =>
  Math.min(1, Math.max(0, (y - BODY_SPAN.foot) / (BODY_SPAN.crown - BODY_SPAN.foot)));

/** EVERY PATCH OF HIM THAT BURNS, lowest first. */
export const BURN_SITES: readonly BurnSite[] = (() => {
  const frames = bindPose().frames;
  const out: BurnSite[] = [];
  const p = { x: 0, y: 0, z: 0 };
  LAYS.forEach(([bone, stuff, radius, alongs, round], b) => {
    alongs.forEach((along, i) => {
      for (let k = 0; k < round; k++) {
        const around = ((k + 0.5 * (i % 2)) / round) * Math.PI * 2 + b;
        boneAt(frames[bone], along, around, radius, p);
        out.push({
          bone,
          along,
          around,
          out: radius,
          stuff,
          h: heightShare(p.y),
          seed: burnHash(b, i, k),
        });
      }
    });
  });
  return out.sort((a, b) => a.h - b.h);
})();

/** Whether a run draws him burning: his clothes caught (`GameState.burn`),
 * never on a run kept safe for work. */
export const burnShown = (state: GameState): boolean => !!state.burn && !state.rules.sfw;

/** Seconds since his clothes caught. */
export const sinceCaught = (state: GameState): number =>
  state.burn ? Math.max(0, state.t - state.burn.t) : 0;

/** HOW FAR UP HIM THE FIRE HAS RUN, `since` s after he caught: a share of
 * his height, from his boots up past his crown. */
export function frontOf(since: number): number {
  const k = Math.min(1, Math.max(0, since / BURN_LOOK.climb));
  // Fast up the legs, slowing as it reaches the trunk and the head.
  return BURN_LOOK.start + (1 + BURN_LOOK.ramp - BURN_LOOK.start) * (1 - (1 - k) * (1 - k));
}

/** HOW HARD THE FLAMES ARE, 0…1, off the engine's burn: full while there
 * is cloth to burn, dying down over the burn's last share, none once out. */
export function fuelOf(burn: { burning: boolean; burnt: number } | undefined): number {
  if (!burn || !burn.burning) return 0;
  const F = BURN_LOOK.fade;
  if (burn.burnt <= F.from) return 1;
  const k = Math.min(1, (burn.burnt - F.from) / (1 - F.from));
  return 1 - (1 - F.left) * k;
}

/** HOW HARD ONE PATCH BURNS, 0…1: caught once the fire reaches it, at its
 * stuff's share of the fuel left. */
export function siteHeat(site: BurnSite, front: number, fuel: number): number {
  const caught = Math.min(1, Math.max(0, (front - site.h) / BURN_LOOK.ramp));
  return caught * fuel * BURN_FLAMES[site.stuff].heat;
}

/** THE SMOULDER, 0…1: once the flames are out, the embers and the wisps
 * dying away over `BURN_LOOK.smoulder` s. `out` is the run's clock when
 * the burn went out (the engine's `burn.t` plus `FIRE_BURN.lasts`). */
export function smoulderOf(burn: { burning: boolean } | undefined, sinceOut: number): number {
  if (!burn || burn.burning) return 0;
  return Math.max(0, 1 - sinceOut / BURN_LOOK.smoulder);
}

/** HOW BLACK HIS CLOTH IS at height `h` (a share), `since` s after he
 * caught with the fire at `front`, 0…1; `n` the cloth's own patchiness
 * there (0…1). */
export function charAt(h: number, front: number, since: number, n: number): number {
  const C = BURN_LOOK.char;
  const behind = (front - h + (n - 0.5) * 0.12) / C.band;
  if (behind <= 0) return 0;
  const deep = C.first + (1 - C.first) * Math.min(1, since / C.deep);
  return Math.min(1, behind) * deep * (0.8 + 0.2 * n);
}

/** CHARRED CLOTH's colour at `n` (0…1): black, browned in patches where
 * the melted shell has run. */
export function charColour(n: number, into: [number, number, number]): [number, number, number] {
  const b = Math.max(0, n - 0.55) / 0.45;
  into[0] = 0.018 + 0.07 * b;
  into[1] = 0.015 + 0.035 * b;
  into[2] = 0.013 + 0.018 * b;
  return into;
}

/** HIS LIGHT, in lamp units: the flames' summed heat as a share of all of
 * them at full, flickering on the clock — and nothing safe for work. */
export function burnLight(heat: number, t: number, seed = 0.3): number {
  const flick =
    0.82 +
    0.12 * Math.sin(t * 6.1 + seed * 11) +
    0.08 * Math.sin(t * 13.7 + seed * 23) +
    0.06 * Math.sin(t * 23.3 + seed * 5);
  return BURN_LOOK.light.power * heat * flick;
}

/** The summed heat of every patch at full, the share `burnLight` reads. */
export const FULL_HEAT = BURN_SITES.reduce((s, x) => s + BURN_FLAMES[x.stuff].heat, 0);
