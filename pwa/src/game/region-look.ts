// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REGION'S COUNTRY LOOKS LIKE (R21) — the ground's tones and the
// trees', one row per kind of snow country. Three-free, so the suite reads
// every row (`tests/region_test.ts` holds this table, the grade's and the
// engine's to one list of ids).
//
// The engine says what a region IS — how it stands, what grows, where the
// wind has crusted the snow and where a tarn froze (`mapgen/regions.ts`,
// `Level.crust`, `Level.ice`); nothing in the engine has an opinion about
// colour. This is the other half: what the snow shader (`snow-glsl.ts`)
// paints the crust and the ice with, whether rock shows through on the
// steep faces, how hard the wind has carved the crust into sastrugi, what
// colour a wood is from far off, and what the trees (`forest.ts`) are
// painted. The whole-frame cast over all of it is `colour-grade.ts`'s.
//
// THE ALPINE ROW IS THE PICTURE AS IT WAS AUTHORED: the woods' far tint
// and the needles the palette's own, the crust a shade blue-grey on the
// crests, and dark rock through the snow on every face too steep to hold
// it — the shader and the forest read it and draw what they always drew.

import type { RegionId } from "@engine";

import { PALETTE } from "../identity.ts";

/** Linear-ish 0..1 RGB, the way `snow-glsl.ts` authors its albedos. */
export type Tone = readonly [number, number, number];

export type RegionLook = {
  /** A wood seen from afar: the ground colour the trees past the draw
   * distance are carried in. */
  readonly forestTint: Tone;
  /** What the wind crust multiplies the snow's albedo by: a wind slab is a
   * touch greyer and bluer than fresh snow, and glossier. */
  readonly crust: Tone;
  /** A frozen tarn's ice: its colour where it is bare (the snow shader mixes it
   * in by `Level.ice`). */
  readonly ice: Tone;
  /** How hard the wind has carved the crust into SASTRUGI — ridges a hand
   * high running along the prevailing wind — 0 none … 1 all of it. */
  readonly sastrugi: number;
  /** ROCK THROUGH THE SNOW on the steep faces: its tone and the slopes
   * (m per m) it starts showing at and is whole at; null — the snow holds
   * on every face this country has. */
  readonly rock: { readonly tone: Tone; readonly from: number; readonly to: number } | null;
  /** The conifers' needles, lit and in shade. */
  readonly needle: string;
  readonly needleDark: string;
  /** How much snow the boughs carry, 0..1 of the drawn shapes' own. */
  readonly load: number;
  /** A birch's bark and the colour of its bare crown of twigs. */
  readonly bark: string;
  readonly twigs: string;
};

const ALPINE_WOOD: Tone = [0.32, 0.4, 0.38];

export const REGION_LOOKS: Readonly<Record<RegionId, RegionLook>> = {
  // THE ALPINE: a hard blue sky over spruce and larch, the crust scoured
  // bright and blue-grey on the crests, and dark rock breaking through on
  // the steepest faces — the cirque walls, the bowls' rims.
  alpine: {
    forestTint: ALPINE_WOOD,
    crust: [0.92, 0.95, 1.0],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 0.2,
    rock: { tone: [0.2, 0.2, 0.22], from: 0.75, to: 1.2 },
    needle: PALETTE.pine,
    needleDark: PALETTE.pineDark,
    load: 1,
    bark: "#e8e4dc",
    twigs: "#6e5a4c",
  },
  // THE FELL: low rounded country under a low sun, nearly all wind crust
  // carved into sastrugi along the wind, the birch a purple-brown haze
  // from afar and the odd stunted spruce carrying little snow; rock only
  // on the steepest crags.
  fell: {
    forestTint: [0.44, 0.42, 0.44],
    crust: [0.88, 0.92, 0.98],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 0.85,
    rock: { tone: [0.3, 0.3, 0.32], from: 0.8, to: 1.3 },
    needle: "#2a4034",
    needleDark: "#16261e",
    load: 0.5,
    bark: "#ebe7df",
    twigs: "#5a4440",
  },
  // THE CONTINENTAL RANGE: cold and dry, the snow a hard dry sparkle under
  // a deep blue sky, tall lodgepole and spire firs loaded with it, the
  // aspens' white trunks; rock on the cliff bands.
  continental: {
    forestTint: [0.28, 0.36, 0.34],
    crust: [0.94, 0.96, 1.0],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 0.1,
    rock: { tone: [0.34, 0.3, 0.28], from: 0.8, to: 1.25 },
    needle: "#1f3d2c",
    needleDark: "#112418",
    load: 1.1,
    bark: "#efece6",
    twigs: "#6a5648",
  },
  // THE MARITIME RANGE: deep heavy snow under a grey-white sky, the firs
  // plastered into rime monsters and bent under their load, the birch
  // among them; no rock — the snow holds on everything.
  maritime: {
    forestTint: [0.4, 0.44, 0.44],
    crust: [0.96, 0.97, 1.0],
    ice: [0.6, 0.76, 0.86],
    sastrugi: 0,
    rock: null,
    needle: "#25403a",
    needleDark: "#142822",
    load: 1.4,
    bark: "#ebe7df",
    twigs: "#5a4a48",
  },
};

export function regionLookOf(region: RegionId): RegionLook {
  return REGION_LOOKS[region] ?? REGION_LOOKS.alpine;
}
