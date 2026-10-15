// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIGHT ON THE CLOUD — three-free, reckoned once a frame in `sky.ts`
// for each layer of the field (`cloud-field.ts`) off the same physical sky
// the dome is drawn from:
//
//   * THE SUN ON A LAYER is the sun THROUGH THE AIR TO THAT LAYER
//     (`sunTransmittance` at its own altitude over the sea): white at noon,
//     gold, then orange and red as the path grows, and still lit after the
//     snow's sunset — a heap's 2 km keeps the sun a little longer, a
//     cirrus's 8 km near a degree longer, so the high ice goes pink over a
//     valley already in Earth's shadow. Every layer over it takes its share
//     off first (its MEAN pass, `layerPass`).
//   * PRESSED AS THE DOME IS (`DOME`), so a cloud in a low sun under a
//     twilight's open eye stays orange rather than clipping to cream.
//   * THE SHADED PARTS take the sky's light: the top the zenith's with a
//     little of the horizon, the base the horizon's grey-blue and the
//     snow's bounce. Under a lid both are the deck's own greys.
//   * BY NIGHT the moon lights them, as faintly as it lights the snow.
//
// Which way the light comes INTO a layer — down onto its tops by day, up
// into its bases once the sun stands under its horizon — is the shader's
// (`cloud-glsl.ts`), off the sun's direction alone.

import { layerPass, veilOf, type CloudLayer } from "./cloud-field.ts";
import { sunTransmittance } from "./sky-atmosphere.ts";
import type { Rgb } from "./sky.ts";

/** A layer's three lights, linear, exposed as the dome — and the sun at
 * its base (`lo`) and its top (`hi`), which HIGH's volume reads up through
 * a deep cloud (a towering heap's top keeps a red sun its base has lost). */
export type LayerLight = { sun: Rgb; top: Rgb; base: Rgb; lo: Rgb; hi: Rgb };

/** THE CLOUD'S HALF of a look. */
export type CloudSky = {
  /** One a layer of the field, in its order. */
  layers: LayerLight[];
  /** The 22° halo's strength (a veil of ice in front of the sun), 0..1. */
  halo: number;
  /** A valley fog's top seen from above: its lit colour, and the sun's
   * share of it (the rest the sky's — the lumps light them apart). */
  sea: Rgb;
  seaSun: Rgb;
  /** The moon's share of every layer's sun light (`sunOn` adds it): HIGH's
   * volume takes it back out and lays it on as a soft light of its own,
   * since it does not come from the sun's side. */
  moon: Rgb;
  /** THE HIGH ICE OF A CONTRAIL (`contrail-glsl.ts`), at `ICE_ALTITUDE`:
   * the sun on it (a degree and more longer than the snow keeps it) and
   * the sky's light from over it. */
  ice: { sun: Rgb; sky: Rgb };
};

/** The altitude over the sea the contrails are lit at, m — the airways'. */
export const ICE_ALTITUDE = 10500;

/** A white cloud's radiance per unit of the sun's light on it (a thick
 * cloud's sunward face, ~0.9 of it sent back over a hemisphere: 0.9/π). */
export const CLOUD_WHITE = 0.28;

/** What the light is reckoned with: the sun's height, the eye's exposure
 * and the dome's mean (`DOME`), the dome's own colours, and the key's when
 * it is the moon's. */
export type CloudLightInput = {
  elevation: number;
  exposure: number;
  skyMean: number;
  dome: { gain: number; span: number };
  zenith: Rgb;
  horizon: Rgb;
  lidded: boolean;
  /** The deck's roughness (a storm's boils). */
  rough: number;
  /** The moon's light on a cloud, exposed (0 by day). */
  moon: Rgb;
  /** The valley floor's altitude over the sea, m; the fog's top over it. */
  floorAltitude: number;
  seaTop: number;
};

const T: Rgb = [0, 0, 0];
const lum = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The sun's light on a cloud face at `altitude` m over the sea, `above`
 * of it let through by the layers over it — pressed as the dome is. */
function sunOn(i: CloudLightInput, altitude: number, above: number): Rgb {
  sunTransmittance(i.elevation, altitude, T);
  const Y = lum(T) * CLOUD_WHITE * above;
  const press = Y > 0 ? i.dome.gain * Math.pow(Y / i.skyMean, i.dome.span - 1) : 0;
  const k = i.exposure * press * CLOUD_WHITE * above;
  return [T[0] * k + i.moon[0], T[1] * k + i.moon[1], T[2] * k + i.moon[2]];
}

/** THE LIGHT ON EVERY LAYER of `layers`. */
export function lightClouds(layers: readonly CloudLayer[], i: CloudLightInput): CloudSky {
  const sinE = Math.sin(i.elevation);
  const { zenith: z, horizon: h } = i;
  const top: Rgb = i.lidded
    ? [z[0] * i.rough, z[1] * i.rough, z[2] * i.rough]
    : [z[0] * 0.8 + h[0] * 0.35, z[1] * 0.8 + h[1] * 0.35, z[2] * 0.8 + h[2] * 0.35];
  const base: Rgb = i.lidded
    ? [z[0] * 0.62, z[1] * 0.62, z[2] * 0.62]
    : [
        (z[0] + h[0]) * 0.36 + h[0] * 0.12,
        (z[1] + h[1]) * 0.36 + h[1] * 0.12,
        (z[2] + h[2]) * 0.36 + h[2] * 0.12,
      ];
  const out: LayerLight[] = layers.map((l) => {
    let above = 1;
    for (const o of layers) if (o.base > l.base + l.depth * 0.5) above *= layerPass(o, sinE);
    const at = (h: number): Rgb => sunOn(i, i.floorAltitude + l.base + l.depth * h, above);
    // A deck closed to the horizon keeps the low sun off most of its base:
    // only the far edge's gaps let it in under.
    const shut = l.cover > 0.8 ? 1 - (l.cover - 0.8) * 2.5 : 1;
    const by = (c: Rgb): Rgb => [c[0] * shut, c[1] * shut, c[2] * shut];
    return { sun: by(at(0.5)), top, base, lo: by(at(0)), hi: by(at(1)) };
  });
  // The halo's ice: a veil's whole cover, or the share of one a layer
  // still is while it thickens into another genus (`cloud-front.ts`).
  let veil = 0;
  for (const l of layers) veil = Math.max(veil, l.cover * veilOf(l));
  const up = Math.min(1, Math.max(0, (i.elevation + 0.02) / 0.1));
  const lit = sunOn(i, i.floorAltitude + i.seaTop, 1);
  // A sea's top under a low sun is lit at a graze: its lumps' sunward faces
  // only, the rest in their own shade under the sky's light.
  const graze = 0.35 + 0.65 * Math.min(1, Math.max(0, sinE / 0.2));
  const flat = (0.3 + 0.7 * Math.sqrt(Math.max(0, sinE))) * graze;
  // The sky's light on a level top is the whole dome's, the horizon's
  // ring as much as the zenith — the zenith's deep blue alone, added to a
  // red sun, made the sea magenta.
  const seaSun: Rgb = [lit[0] * flat, lit[1] * flat, lit[2] * flat];
  const seaSky = (c: number): number => z[c] * 0.4 + h[c] * 0.34;
  return {
    layers: out,
    halo: veil * up,
    sea: [seaSun[0] + seaSky(0), seaSun[1] + seaSky(1), seaSun[2] + seaSky(2)],
    seaSun,
    moon: [i.moon[0], i.moon[1], i.moon[2]],
    // Clear of every layer (the cirrus stands under the airways), lit from
    // the zenith's blue over it: a thin trail's shade is the sky's.
    ice: {
      sun: sunOn(i, ICE_ALTITUDE, 1),
      sky: [z[0] * 0.75 + h[0] * 0.3, z[1] * 0.75 + h[1] * 0.3, z[2] * 0.75 + h[2] * 0.3],
    },
  };
}
