// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINTER SKY, as numbers. Where the sun and the moon stand at the hour
// the run has reached (`sunAtRun`, `moonAtRun` — one engine clock), what
// weather R19 dealt, and what colour everything the sky lights is at that
// hour under that weather: the dome's zenith and horizon, the sun's own
// colour through the air it has to cross, the key light (the sun by day,
// the moon by night), the two halves of the hemisphere light, the cloud,
// the stars, the haze the distance fades into — and what the snow's shader
// and the arena's floods are told about how flat and how dark it is.
//
// THREE-FREE ON PURPOSE, so the suite reads the whole colour model
// (`tests/world_render_test.ts`, `tests/sky_test.ts`). `environment.ts`
// turns a `SkyLook` into lights and uniforms every frame; nothing else
// decides what colour the air is.
//
// The CLEAR DAY is the model everything else is laid over, and it is a
// function of the sun's height alone:
//
//   * THE SUN'S COLOUR is the air it crossed. Transmittance per channel is
//     `exp(-k · airmass)` with the Rayleigh-leaning extinction below and the
//     Kasten–Young air mass, so a noon sun is a hair warm of white and a sun
//     ten degrees up is gold — without a table of hand-picked oranges.
//   * THE SKY OVER SNOW IS BRIGHT. Fresh snow sends most of the light back
//     up, and a winter sky's horizon is a pale, almost white blue because of
//     it; the zenith deepens as the sun climbs.
//   * THE SHADOWS ARE BLUE. What fills a snow shadow is the sky, so the
//     hemisphere's upper colour is a real blue and the ground bounce under
//     it is near-white — which is what makes shade on snow read as snow in
//     shade rather than grey paint.
//
// Over that, two things:
//
//   * THE NIGHT. As the sun goes under, the day's colours give way to a
//     night's — a warm band low toward where the sun set, a blue that
//     deepens toward black overhead, the stars coming out by nautical
//     twilight — and the key light passes to the MOON, as bright as its
//     phase and its height say. The night is lifted past honest so moonlit
//     snow reads at racing pace; the arena's floods are the rest.
//   * THE WEATHER (R19). Cloud dims and cools the key; a LID (overcast, a
//     steady fall, a storm, a fog) takes the key down to a glow, turns the
//     dome to its own deck — darker than the snow under it, slate in a
//     storm — and the hemisphere to a flat light, which is what `flat`
//     tells the snow's shader, so it keeps the bumps readable, but hard.
//     A flurry falls out of a sunny sky and keeps the sun. A fall closes
//     the haze to the visual range it leaves at this moment (`snowAt`,
//     `visibilityIn`) — a flurry's kilometres, a blizzard's forty metres —
//     and a fog thickens it until the far side of the mountain is gone.
//
// Every colour is LINEAR RGB (what the shaders mix in); `sRGB` hexes are
// never written here.

import {
  CLEAR_WEATHER,
  moonAtRun,
  snowAt,
  snows,
  sunAtRun,
  visibilityIn,
  weatherOf,
  type Level,
  type Weather,
} from "@engine";

import { DEFAULT_TURN, skyTurnOf, type SkyTurn } from "./starfield.ts";

export type Rgb = [number, number, number];

/** A unit vector in the world frame. */
export type Dir = { x: number; y: number; z: number };

/** The cloud over the dome: which genus, how much of the sky it covers,
 * and its two colours. */
export type CloudLook = {
  /** 0 none, 1 cumulus (heaps), 2 cirrus (high streaks), 3 a lid. */
  genus: 0 | 1 | 2 | 3;
  /** Share of the sky covered, 0..1. */
  cover: number;
  /** The sunward tops, and the shaded sides and bases. */
  lit: Rgb;
  shade: Rgb;
};

export type SkyLook = {
  /** Toward the sun, unit, world frame (y up; heading 0 along +z). */
  sun: Dir;
  /** The sun's elevation, rad over the horizon (negative under it). */
  elevation: number;
  /** Toward the moon, and how much of its disc is lit, 0..1. */
  moon: Dir;
  moonLit: number;
  /** The dome overhead and at the horizon away from the sun. */
  zenith: Rgb;
  horizon: Rgb;
  /** The horizon's glow around the sun (and after it has set). */
  glow: Rgb;
  /** The sun's own colour through the air it crossed — its disc. */
  sunColour: Rgb;
  /** THE KEY LIGHT: toward it (the sun by day, the moon by night), its
   * colour and its intensity (three's units). */
  key: Dir;
  keyColour: Rgb;
  keyIntensity: number;
  /** The hemisphere light: the sky half and the snow-bounce half, and how
   * strong the pair is. */
  skyLight: Rgb;
  groundLight: Rgb;
  ambient: number;
  /** The haze's density, 1/m — the distance the far rim is lost over. */
  haze: number;
  /** How low the haze lies: its thinning height, m (a valley fog's is low,
   * so the peaks stand out of it). */
  hazeLift: number;
  /** The cloud over the dome. */
  cloud: CloudLook;
  /** How dark it is, 0 (day) … 1 (full night). */
  night: number;
  /** How much of the Milky Way shows, 0..1 — only a dark sky's: past
   * astronomical twilight, the moon down or thin, no cloud in front. */
  galaxy: number;
  /** Where the sphere of stars has turned to (`starfield.ts`). */
  turn: SkyTurn;
  /** How many stars show, 0..1 — the night, less the moon's glare and the
   * cloud. */
  stars: number;
  /** How FLAT the light is, 0 (a hard sun) … 1 (a whiteout) — the snow
   * shader's cue to keep its relief readable without a shadow. */
  flat: number;
  /** How much the snow glitters in the key light, 0..1. */
  glitter: number;
  /** How far on the arena's floods are, 0 (off: broad day) … 1. */
  lamps: number;
  /** How hard it is snowing and how thick the fog is (R19), 0..1. */
  snowfall: number;
  fog: number;
};

/** Extinction per unit air mass, per channel — mostly Rayleigh (blue lost
 * first), with a little aerosol so a low sun goes gold rather than magenta. */
const EXTINCTION: Rgb = [0.06, 0.1, 0.19];

/** Kasten–Young relative optical air mass for a sun `elevation` rad up. */
export function airMass(elevation: number): number {
  const deg = Math.max(-2, (elevation * 180) / Math.PI);
  return 1 / (Math.sin(Math.max(elevation, -0.03)) + 0.50572 * Math.pow(deg + 6.07995, -1.6364));
}

/** The world direction toward a sun at `azimuth` (a world heading) and
 * `elevation`. */
export function sunDirection(azimuth: number, elevation: number): Dir {
  const c = Math.cos(elevation);
  return { x: Math.sin(azimuth) * c, y: Math.sin(elevation), z: Math.cos(azimuth) * c };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scale(a: Rgb, k: number): Rgb {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The colour of sunlight after `elevation`'s worth of air, normalised so
 * its brightest channel is 1. */
export function sunTint(elevation: number): Rgb {
  const m = Math.min(airMass(elevation), 38);
  const t: Rgb = [
    Math.exp(-EXTINCTION[0] * m),
    Math.exp(-EXTINCTION[1] * m),
    Math.exp(-EXTINCTION[2] * m),
  ];
  const top = Math.max(t[0], t[1], t[2]);
  return [t[0] / top, t[1] / top, t[2] / top];
}

/** Where the moon is, for `skyLookFor`: its place and its phase. */
export type MoonInput = { azimuth: number; elevation: number; lit: number };

/** No moon in the sky (under the horizon, new). */
const NO_MOON: MoonInput = { azimuth: 0, elevation: -1, lit: 0 };

/** Moonlight's colour: the sun's, bluer to the eye's night vision. */
const MOONLIGHT: Rgb = [0.6, 0.72, 1.0];
/** The key a full moon high in the sky gives, three's units — lifted far
 * past the honest four-hundred-thousandth of the sun so moonlit snow reads
 * at speed. */
const MOON_KEY = 0.75;

/**
 * WHAT A SKY OF EACH KIND DOES to the clear day under it: the cloud it
 * draws, how much of the key gets through, and what the snow is told. The
 * fall and the fog scale their own rows further by how heavy they are.
 */
const LID: Record<
  Weather["kind"],
  { genus: CloudLook["genus"]; cover: number; key: number; flat: number; glitter: number }
> = {
  clear: { genus: 0, cover: 0, key: 1, flat: 0, glitter: 1 },
  fair: { genus: 1, cover: 0.4, key: 0.95, flat: 0, glitter: 1 },
  // A few heaps and the sun between them: the flakes glint in it.
  flurries: { genus: 1, cover: 0.26, key: 0.9, flat: 0.04, glitter: 1 },
  high: { genus: 2, cover: 0.6, key: 0.78, flat: 0.2, glitter: 0.7 },
  // A lid with the sun a pale disc behind it: soft shadows, not none.
  overcast: { genus: 3, cover: 1, key: 0.22, flat: 0.68, glitter: 0.12 },
  snow: { genus: 3, cover: 1, key: 0.1, flat: 0.85, glitter: 0.05 },
  storm: { genus: 3, cover: 1, key: 0.03, flat: 0.92, glitter: 0 },
  fog: { genus: 3, cover: 1, key: 0.3, flat: 0.7, glitter: 0.25 },
};

/** A lid's own greys at full day, per kind: the deck overhead and the air
 * at the horizon under it. The deck is DARKER than the snow it hangs over —
 * what keeps a grey day from reading as one white sheet — and a storm's is
 * slate, the air under it the grey of the snow driving through it. */
const DECK: Record<"overcast" | "snow" | "storm" | "fog", { zenith: Rgb; horizon: Rgb }> = {
  overcast: { zenith: [0.3, 0.33, 0.39], horizon: [0.5, 0.53, 0.58] },
  snow: { zenith: [0.23, 0.25, 0.3], horizon: [0.44, 0.46, 0.5] },
  storm: { zenith: [0.06, 0.07, 0.09], horizon: [0.25, 0.27, 0.3] },
  fog: { zenith: [0.66, 0.68, 0.7], horizon: [0.64, 0.66, 0.68] },
};

/** How much of the clear day's skylight a lid lets down, per kind: an
 * overcast's is most of it again, a storm's half. */
const LID_LIGHT: Record<"overcast" | "snow" | "storm" | "fog", number> = {
  overcast: 1.15,
  snow: 1.05,
  storm: 0.55,
  fog: 1.35,
};

/** The haze's density on a clear day, 1/m. Cold dry winter air over a
 * mountain sees fifty kilometres and more; from the summit the valley
 * floor three kilometres off reads crisp with a blue cast (four parts in
 * ten of the way to the sky's own colour), and the far ridges fade
 * blue without going. The old 1/1500 lost the valley whole. */
const CLEAR_HAZE = 1 / 6000;
/** The haze under a lid, 1/m: the damp grey air of an overcast, a fall or
 * a fog is thicker before the fall's own visibility closes it further. */
const LID_HAZE = 1 / 1500;
/** Koschmieder: the extinction that closes the view at a visual range V is
 * 3.912 / V. */
const KOSCHMIEDER = 3.912;

/** THE WHOLE LOOK for a sun at `azimuth`, `elevation`, a moon, a weather —
 * and the fall at this moment (`snowAt`), the dealt mean when left out. */
export function skyLookFor(
  azimuth: number,
  elevation: number,
  moonAt: MoonInput = NO_MOON,
  weather: Weather = CLEAR_WEATHER,
  now?: number,
): SkyLook {
  // How "high" the day is, 0 at the horizon to 1 at 45° and over.
  const high = smooth(0.0, 0.8, elevation);
  // How much day there is: 1 with the sun up, 0 by twelve degrees under.
  const day = smooth(-0.21, 0.04, elevation);
  const night = 1 - day;
  // The band around sunset where the low sky burns.
  const dusk = smooth(-0.2, -0.01, elevation) * (1 - smooth(0.02, 0.22, elevation));
  const tint = sunTint(elevation);
  // Total transmittance (not normalised) is what dims a low sun.
  const m = Math.min(airMass(elevation), 38);
  const through = Math.exp(-0.16 * m);

  // THE CLEAR DAY.
  const zenithDay = mix([0.06, 0.19, 0.62], [0.022, 0.1, 0.46], high);
  const horizonCool: Rgb = [0.46, 0.64, 0.92];
  const horizonDay = mix(mix(horizonCool, [0.8, 0.78, 0.8], (1 - high) * 0.35), horizonCool, high);
  // THE NIGHT, and the twilight between.
  const lightUp = Math.pow(day, 1.6);
  let zenith = mix([0.004, 0.008, 0.024], zenithDay, lightUp);
  let horizon = mix([0.014, 0.022, 0.05], horizonDay, lightUp);
  horizon = mix(horizon, [0.55, 0.38, 0.42], dusk * 0.45 * (1 - high));
  let glow = mix([1.0, 0.72, 0.45], [1.0, 0.95, 0.88], high);
  glow = scale(mix(glow, [1.0, 0.42, 0.16], dusk), 0.15 + 0.85 * day);

  const moon = sunDirection(moonAt.azimuth, moonAt.elevation);
  const moonUp = smooth(-0.02, 0.18, moonAt.elevation);

  // THE KEY: whichever of the two lights is the stronger, through the cloud.
  const lid = LID[weather.kind];
  const fall = snows(weather.kind) ? (now ?? weather.snowfall) : 0;
  const fog = weather.kind === "fog" ? weather.fog : 0;
  const pass = lid.key * (1 - 0.6 * fall) * (1 - 0.6 * fog);
  const sunKey = 3.1 * (0.35 + 0.65 * through) * smooth(-0.04, 0.08, elevation);
  const moonKey = MOON_KEY * (0.2 + 0.8 * moonAt.lit) * moonUp * night;
  const byMoon = moonKey > sunKey;
  const keyIntensity = (byMoon ? moonKey : sunKey) * pass;
  const key = byMoon ? moon : sunDirection(azimuth, elevation);

  let skyLight = mix([0.3, 0.42, 0.95], mix([0.42, 0.58, 0.95], [0.36, 0.55, 1.0], high), day);
  let groundLight: Rgb = [0.86, 0.9, 0.96];
  // Snow reflects the night as well as the day: a floor of blue light off
  // the whole sky, raised by the moon.
  let ambient = (1.25 + 0.35 * high) * lightUp + (0.16 + 0.22 * moonUp * moonAt.lit) * night;

  // THE WEATHER.
  const lidded = lid.genus === 3;
  if (lidded) {
    const kind = weather.kind as keyof typeof DECK;
    const deck = DECK[kind];
    const light = (0.55 + 0.45 * high) * lightUp + 0.018 * night;
    // A fall darkens the deck it comes out of.
    const heavy = 1 - 0.3 * fall;
    zenith = scale(deck.zenith, light * heavy);
    horizon = scale(deck.horizon, light * heavy);
    glow = scale(glow, 0.12 + 0.3 * fog);
    skyLight = mix(skyLight, [0.8, 0.85, 0.93], day);
    groundLight = mix(groundLight, [0.9, 0.92, 0.95], day);
    // What the lid takes off the key it gives back as a flat, skylit glow —
    // all of it under a thin deck, half under a storm's.
    ambient *= 1 + (LID_LIGHT[kind] - 1) * day;
  } else if (lid.cover > 0) {
    zenith = mix(zenith, horizon, lid.cover * (lid.genus === 2 ? 0.35 : 0.12));
    ambient *= 1 + 0.08 * lid.cover * day;
  }

  // THE HAZE: the clear day's, thickened by the lid, and closed to the
  // visual range the fall leaves (`visibilityIn`) — a blizzard's forty
  // metres, a flurry's kilometres.
  let haze = CLEAR_HAZE;
  if (weather.kind === "high") haze *= 1.2;
  if (weather.kind === "overcast") haze = LID_HAZE * 1.8;
  if (weather.kind === "snow" || weather.kind === "storm") haze = LID_HAZE * 2.5;
  if (weather.kind === "fog") haze = LID_HAZE * (5 + 40 * fog);
  if (fall > 0) haze = Math.max(haze, KOSCHMIEDER / visibilityIn(fall));

  // A heap's sunward top is the sun's colour on white; its base the sky's
  // own under-light. Under a lid the two are the deck's own greys, far
  // enough apart that its underside reads as cloud and not as paint — and
  // furthest in a storm, whose deck boils.
  const rough = weather.kind === "storm" ? 1.9 : 1.5;
  const cloudLit: Rgb = lidded
    ? scale(zenith, rough)
    : mix(scale(zenith, 1.6), [1.05 * tint[0], 1.02 * tint[1], tint[2]], lightUp * 0.9);
  const cloudShade: Rgb = lidded
    ? scale(zenith, 0.62)
    : mix(scale(zenith, 1.2), mix(horizon, [0.6, 0.66, 0.76], 0.5), lightUp);

  // How much of the night sky the cloud leaves: a lid takes all of it, a
  // veil of cirrus some, and heaps only where they stand — which the dome
  // draws over the stars itself.
  const clearNight = 1 - lid.cover * (lidded ? 1 : lid.genus === 2 ? 0.6 : 0.25);

  // The lamps come on as the light goes: nothing under a clear noon, all of
  // it by the time the sun is a few degrees under or a blizzard shuts in.
  const lamps = 1 - smooth(1.0, 1.9, keyIntensity + ambient * 0.6);

  return {
    sun: sunDirection(azimuth, elevation),
    elevation,
    moon,
    moonLit: moonAt.lit,
    zenith,
    horizon,
    glow,
    sunColour: tint,
    key,
    keyColour: byMoon ? MOONLIGHT : tint,
    keyIntensity,
    skyLight,
    groundLight,
    ambient,
    haze,
    hazeLift: fog > 0 ? 90 + 120 * (1 - fog) : 700,
    cloud: { genus: lid.genus, cover: lid.cover, lit: cloudLit, shade: cloudShade },
    night,
    stars: smooth(0.1, 0.26, -elevation) * (1 - 0.5 * moonUp * moonAt.lit) * clearNight,
    galaxy:
      smooth(0.2, 0.34, -elevation) * (1 - 0.85 * moonUp * moonAt.lit) * clearNight * clearNight,
    turn: DEFAULT_TURN,
    flat: Math.min(1, lid.flat + 0.08 * fall),
    glitter: lid.glitter,
    lamps,
    snowfall: fall,
    fog,
  };
}

const fallNow = { fall: 0, visibility: 0 };

/** The look at run time `t` on `level`: the sun and the moon where the
 * map's hour puts them, and the fall as the squalls have it at `t`. */
export function skyLookAt(level: Pick<Level, "seed" | "sun" | "weather">, t = 0): SkyLook {
  const sun = sunAtRun(level);
  const moon = moonAtRun(level);
  const look = skyLookFor(
    sun.azimuth,
    sun.elevation,
    moon,
    weatherOf(level),
    snowAt(level, t, fallNow).fall,
  );
  look.turn = skyTurnOf(level);
  return look;
}
