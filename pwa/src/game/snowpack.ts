// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT KIND OF SNOW IS HERE — the snowpack as the PICTURE reads it. Six
// kinds of snow lie on a map, and each throws a different cloud and keeps a
// different track:
//
//   * GROOMED — the loop's packed snow: dense, a few millimetres of loose
//     cut on top. A skier at speed lifts a thin, low mist of ice dust off it
//     and leaves the comb's scuff; an animal barely marks it.
//   * HARD — the wind's slab and crust (R21's alpine and fell, every
//     scoured crest): 300–400 kg/m³ over softer snow. It breaks into CHUNKS
//     rather than dust, a furrow through it is cut clean with square walls,
//     and a hare or a fox walks on it where a moose punches through.
//   * SOFT — settled powder, the alpine default: 150–250 kg/m³. The
//     rooster tail, a cloud that hangs a few seconds, a furrow a hand deep
//     with rounded walls.
//   * NEW — snow that fell in the last day, dry and cold, 50–100 kg/m³ —
//     what a snowing sky has laid and `GameState.fresh` adds to. The
//     biggest, finest cloud (it hangs and drifts on the wind and glitters
//     in the sun), the deepest furrow, its walls sloughing back in, and
//     next to no berm, because it is too light to stand in one.
//   * WET — spring snow under a high sun, 400–500 kg/m³: heavy, it comes
//     off the skis in CLUMPS that arc and fall, lifts almost no cloud, and
//     leaves crisp walls and a real berm beside a furrow.
//   * ICE — the frozen river (R21): nothing to throw, nothing pressed.
//
// A POINT IS A BLEND, weighted from what the map already says and nothing
// else: the groomer's share of the packed field (`packedAt`), the wind
// crust (`Level.crust`, the region's `crust.packed` hold), the river's ice
// (`iceAt`), a layer of new snow over all of it — the fall a snowing sky has
// been laying before the run and `GameState.fresh` since — and, under a high
// spring sun, the thaw that turns soft and new snow wet.
//
// PRESENTATION ONLY. The physics has its own snow (`engine/game/snow.ts`)
// and nothing here reaches back into it: a furrow is still drawn no
// shallower than the skier's own sink (`trail-stamp.ts`'s `drawnDepth`), and
// every number here is what a pixel does, not what a skier feels. Three-free
// and DOM-free, so the suite reads every kind (`tests/snowpack_test.ts`).

import { regionOf, sampleField, weatherOf, type Level, type Weather } from "@engine";

export type SnowKind = "groomed" | "hard" | "soft" | "new" | "wet" | "ice";

/** Every kind, hardest-packed first. */
export const SNOW_KINDS: readonly SnowKind[] = ["groomed", "hard", "soft", "new", "wet", "ice"];

export function isSnowKind(value: unknown): value is SnowKind {
  return typeof value === "string" && (SNOW_KINDS as readonly string[]).includes(value);
}

/** What one kind of snow does to what is thrown out of it and pressed into
 * it. Every figure is a multiple of settled powder's (`soft`) unless it
 * says otherwise, so the soft row is the picture the game had before the
 * snowpack was a thing. */
export type SnowProps = {
  /** The top layer's density, kg/m³ — for the reader; the rest follow it. */
  density: number;
  /** How much LOOSE snow lies on top to be thrown. */
  loose: number;
  /** The share of what is thrown that is fine enough to hang in the air as
   * a cloud, 0..1 — the rest is grains and clumps that fall at once. */
  fine: number;
  /** The share thrown as CLUMPS or slab chunks, 0..1: bigger, heavier,
   * shorter-lived pieces in `spray.ts`. */
  clumps: number;
  /** How far a footprint is pressed, as a multiple of settled powder's
   * furrow. */
  give: number;
  /** How the walls of a furrow stand, 0 (sloughed back in, a soft trough)
   * … 1 (cut clean, square). */
  wall: number;
  /** The berm pushed up beside a furrow, as a share of its depth. */
  berm: number;
  /** How much a LIGHT foot rides on top rather than going in, 0..1 — a
   * crust bears a hare; nothing bears a moose. */
  bears: number;
  /** How much the crystals glint in the air and in a fresh furrow, 0..1. */
  sparkle: number;
};

/** THE KINDS, each a row of what it does. The densities are the field
 * bands (new 50–100, settled 150–250, wind slab 300–400, wet 400–500,
 * groomed 400–550 kg/m³); every other figure is picture, set by LOOKING
 * (`make cloud`, `make world`). */
export const SNOW: Readonly<Record<SnowKind, Readonly<SnowProps>>> = {
  groomed: {
    density: 480,
    loose: 0.14,
    fine: 0.6,
    clumps: 0.2,
    give: 0.07,
    wall: 0.6,
    berm: 0.35,
    bears: 1,
    sparkle: 0.45,
  },
  hard: {
    density: 360,
    loose: 0.3,
    fine: 0.35,
    clumps: 0.75,
    give: 0.3,
    wall: 0.95,
    berm: 0.18,
    bears: 0.85,
    sparkle: 0.55,
  },
  soft: {
    density: 200,
    loose: 1,
    fine: 0.7,
    clumps: 0.25,
    give: 1,
    wall: 0.25,
    berm: 0.35,
    bears: 0,
    sparkle: 0.7,
  },
  new: {
    density: 75,
    loose: 1.3,
    fine: 1,
    clumps: 0.04,
    give: 1.4,
    wall: 0,
    berm: 0.12,
    bears: 0,
    sparkle: 1,
  },
  wet: {
    density: 450,
    loose: 0.75,
    fine: 0.12,
    clumps: 1,
    give: 0.75,
    wall: 0.85,
    berm: 0.75,
    bears: 0.2,
    sparkle: 0.12,
  },
  ice: {
    density: 900,
    loose: 0,
    fine: 0.2,
    clumps: 0,
    give: 0,
    wall: 1,
    berm: 0,
    bears: 1,
    sparkle: 0.3,
  },
};

/** How much new snow buries what is under it as the picture reads it, m:
 * past this the top IS new snow. */
export const NEW_COVER = 0.1;

/** The new snow a snowing sky has already laid when the run starts, m at a
 * full fall (`Weather.snowfall` 1): it has been snowing for hours. */
export const NEW_LAID = 0.15;

/** The sun's elevation (rad) over which spring snow starts to go wet, and
 * where it is wet through. */
export const THAW = { from: (20 * Math.PI) / 180, full: (32 * Math.PI) / 180 };

/** THE MAP'S SNOWPACK for one run: what its level says, the layer of new
 * snow over it, the thaw — and, for a lab, one kind forced everywhere. */
export type Snowpack = {
  level: Pick<Level, "packedAt" | "crust" | "iceAt" | "region">;
  /** The crust's hold as a share of the groomer (the region's). */
  crustHold: number;
  /** New snow the sky laid before the run, m. */
  laid: number;
  /** New snow fallen during the run, m (`GameState.fresh`) — the renderer
   * writes it every frame. */
  fresh: number;
  /** How wet the thaw has made the soft and new snow, 0..1. */
  wet: number;
  /** The run's snow dial (`GameState.snowDepth`): how much loose snow
   * there is, as a multiple of the ordinary. */
  depth: number;
  /** One kind everywhere (a lab), or null for the map's own. */
  force: SnowKind | null;
};

export type SnowpackOptions = {
  /** The sky over the run — the map's own when left out. */
  weather?: Weather;
  /** The sun's elevation over the run, rad; no thaw when left out. */
  elevation?: number;
  fresh?: number;
  depth?: number;
  force?: SnowKind | null;
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The snowpack of `level` under a sky. */
export function snowpackOf(
  level: Pick<Level, "packedAt" | "crust" | "iceAt" | "region" | "weather">,
  options: SnowpackOptions = {},
): Snowpack {
  const weather = options.weather ?? weatherOf(level);
  const snowing =
    weather.kind === "flurries" || weather.kind === "snow" || weather.kind === "storm";
  // A thaw wants the sun on the snow: a lid over it keeps the snow cold, and
  // a sky that is snowing is cold by definition.
  const lid = weather.kind === "overcast" || weather.kind === "fog" ? 0.35 : 1;
  const sun = options.elevation ?? -1;
  return {
    level,
    crustHold: regionOf(level).crust?.packed ?? 0,
    laid: snowing ? NEW_LAID * weather.snowfall : 0,
    fresh: options.fresh ?? 0,
    wet: snowing ? 0 : smooth(THAW.from, THAW.full, sun) * lid,
    depth: options.depth ?? 1,
    force: options.force ?? null,
  };
}

/** The weight of each kind at a point, summing to 1. */
export type SnowMix = Record<SnowKind, number>;

export function emptyMix(): SnowMix {
  return { groomed: 0, hard: 0, soft: 0, new: 0, wet: 0, ice: 0 };
}

/** WHAT LIES AT (x, z), as a mix of the kinds, written into `out`. */
export function snowMix(pack: Snowpack, x: number, z: number, out: SnowMix = emptyMix()): SnowMix {
  for (const k of SNOW_KINDS) out[k] = 0;
  if (pack.force) {
    out[pack.force] = 1;
    return out;
  }
  const lv = pack.level;
  const ice = lv.iceAt ? Math.min(1, Math.max(0, lv.iceAt(x, z))) : 0;
  const packed = Math.min(1, Math.max(0, lv.packedAt(x, z)));
  const crust = lv.crust ? Math.min(1, Math.max(0, sampleField(lv.crust, x, z))) : 0;
  // The crust is folded into the packed field at its hold (`surface.ts`):
  // what stands above that is the groomer's.
  const held = crust * pack.crustHold;
  const groomed = held > 0 ? Math.max(0, packed - held) / Math.max(1e-6, 1 - held) : packed;
  const land = 1 - ice;
  const hard = Math.min(1 - groomed, crust) * land;
  const g = groomed * land;
  const soft = Math.max(0, land - g - hard);
  // THE NEW LAYER over all of it but the ice — and over the GROOMER only
  // what has fallen during the run: the piste was groomed under the night's
  // fall, and the physics holds it groomed until the run's own fall buries
  // it (`packedUnder`), so a ski on it is drawn on it rather than sunk a
  // hand deep into snow the engine says is not there.
  const cover = Math.min(1, (pack.laid + pack.fresh) / NEW_COVER);
  const coverGroomed = Math.min(1, pack.fresh / NEW_COVER);
  const under = 1 - cover;
  const buried = g * coverGroomed + (hard + soft) * cover;
  // THE THAW takes the loose snow wet; the groomer and the slab stay what
  // they are (a sunlit groomer is slush only in April).
  const w = pack.wet;
  out.ice = ice;
  out.groomed = g * (1 - coverGroomed);
  out.hard = hard * under;
  out.soft = soft * under * (1 - w);
  out.new = buried * (1 - w);
  out.wet = (soft * under + buried) * w;
  return out;
}

const scratch = emptyMix();

/** THE SNOW AT (x, z): the mix's figures, blended, into `out`. The snow
 * dial scales how much loose snow there is to throw and to press. */
export function snowAt(pack: Snowpack, x: number, z: number, out?: SnowProps): SnowProps {
  const mix = snowMix(pack, x, z, scratch);
  return blend(mix, pack.depth, out);
}

/** The props of a mix, blended; `depth` scales the loose snow and the give
 * of everything but the groomer and the ice (which the dial leaves alone,
 * as it leaves the physics' groomer alone). */
export function blend(mix: SnowMix, depth = 1, out?: SnowProps): SnowProps {
  const o = out ?? { ...SNOW.soft };
  o.density = 0;
  o.loose = 0;
  o.fine = 0;
  o.clumps = 0;
  o.give = 0;
  o.wall = 0;
  o.berm = 0;
  o.bears = 0;
  o.sparkle = 0;
  for (const k of SNOW_KINDS) {
    const w = mix[k];
    if (w <= 0) continue;
    const s = SNOW[k];
    const dial = k === "groomed" || k === "ice" ? 1 : depth;
    o.density += s.density * w;
    o.loose += s.loose * w * dial;
    o.fine += s.fine * w;
    o.clumps += s.clumps * w;
    o.give += s.give * w * dial;
    o.wall += s.wall * w;
    o.berm += s.berm * w;
    o.bears += s.bears * w;
    o.sparkle += s.sparkle * w;
  }
  return o;
}

/** The kind that lies thickest at (x, z) — for a label, never a rule. */
export function kindAt(pack: Snowpack, x: number, z: number): SnowKind {
  const mix = snowMix(pack, x, z, scratch);
  let best: SnowKind = "soft";
  for (const k of SNOW_KINDS) if (mix[k] > mix[best]) best = k;
  return best;
}

/** How far a foot that sinks `sink` m into settled powder goes into this
 * snow, as a share of its powder print: a crust carries a light foot on
 * top (`bears`) and a heavy one punches through it. */
export function printGive(snow: SnowProps, sink: number): number {
  const heavy = smooth(0.12, 0.45, sink);
  const carried = snow.bears * (1 - heavy);
  return snow.give * (1 - carried) + 0.08 * carried;
}
