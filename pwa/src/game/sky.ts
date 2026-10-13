// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINTER SKY, as numbers. Where the sun and the moon stand at the hour
// the run has reached (`sunAtRun`, `moonAtRun` on the sky's clock — the
// start hour run on with `state.t`, `sky-clock.ts`), what
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
// The CLEAR DAY is the model everything else is laid over, and it is
// PHYSICAL: Hillaire's atmosphere (`atmosphere-model.ts` — Rayleigh's air,
// the aerosol's Mie haze, the ozone, multiple scattering, the planet's
// shadow, a ground of fresh snow under it) baked offline into a table
// (`make sky-table`) that `sky-atmosphere.ts` reads for the sun's height
// and the lens's altitude:
//
//   * THE SKY by direction (`view`, the dome's texture): a blue zenith over
//     a white horizon at noon, the glow round a low sun, the Belt of Venus
//     and Earth's shadow under it after sunset, a blue twilight zenith —
//     none of it painted, all of it in the table.
//   * THE SUN'S COLOUR is its transmittance through the air it crossed:
//     near white at noon, gold at ten degrees, orange-red on the horizon.
//   * THE SHADOWS ARE BLUE: the sky's irradiance on a surface (`irradiance`,
//     L2 harmonics turned to the sun's bearing) is the hemisphere light —
//     blue from above, the snow's near-white bounce from below.
//   * THE EYE ADAPTS: the physics spans ten decades from noon to night, so
//     the look is EXPOSED by the light on the snow (`exposureOf`) — a little
//     by day, much more through the twilights, and the dome alone pressed
//     about its own mean (`DOME`), as an eye looking at the sky sees it.
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
  skyLevelAt,
  snowAt,
  snows,
  sunAtRun,
  visibilityIn,
  weatherOf,
  type Level,
  type Weather,
} from "@engine";

import { shIrradiance, shRotateY } from "./atmosphere-model.ts";
import {
  adaptingLight,
  AMBIENT_LIFT,
  atmosphereRow,
  EXPOSURE,
  exposureOf,
  sunTransmittance,
} from "./sky-atmosphere.ts";
import { skyClock } from "./sky-clock.ts";
import { SKY_GRID, SKY_VIEW_AZ, SKY_VIEW_EL } from "./sky-table-format.ts";
import { DEFAULT_TURN, skyTurnOf, type SkyTurn } from "./starfield.ts";
import { TERRAIN_SHADOW } from "./terrain-shadow.ts";

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
  /** The low air in Earth's shadow, and the share of the haze over the
   * ground it takes (`haze.ts`'s `hazeColour`): rgb, share. */
  hazeShadow: [number, number, number, number];
  /** THE FAR GROUND under the true horizon (`horizon.ts`, `haze.ts`'s
   * `farColour`): country of `FAR_ALBEDO` under this sky's light, and the
   * key's light on a face of it turned square to the key — linear,
   * exposed as the snow is. The shader turns the faces toward the lens. */
  farGround: Rgb;
  farKey: Rgb;
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
  /** THE DOME as the physical sky gives it (LOW reads it as it is): the
   * radiance by the azimuth from the sun and the view's elevation on
   * `sky-table-format.ts`'s grid, linear RGB, exposed — the weather's lid
   * or veil laid over it. `haze.ts` uploads it as the texture
   * `skyColour(dir)` reads. */
  view: Float32Array;
  /** THE SKY'S LIGHT ON A SURFACE: L2 irradiance harmonics in the world
   * frame (27: nine coefficients, RGB each), exposed — `skyIrradiance(n)`
   * on the GPU, `shIrradiance` here. */
  irradiance: number[];
  /** The eye's adaptation the look is exposed at (`exposureOf`). */
  exposure: number;
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

/** The lens's altitude over the sea a look is reckoned at when none is
 * named, m: a generated mountain's middle. */
const DEFAULT_ALTITUDE = 800;

/** The night sky's own floor (starlight, airglow) at the zenith and the
 * horizon, linear — what is left when the twilight has gone. */
const NIGHT_ZENITH: Rgb = [0.004, 0.008, 0.024];
const NIGHT_HORIZON: Rgb = [0.014, 0.022, 0.05];

/** THE DOME'S OWN TONE: the sky's span pressed to this power of itself
 * about its mean, and lifted by `gain` (the sky is looked at, and the eye
 * opens to it). The lights are never pressed: only what the dome shows.
 * `horizon` pulls the grazing row (the sky through hundreds of kilometres
 * of air, the haze's colour too) that share of the way, in the logarithm,
 * toward the row a degree and a half over it: in the mountains the far
 * ground stands in front of that path, and what the haze shows is the air
 * of the valleys, not of the whole curve of the Earth. */
/** The cloud layers' heights over the sea, m: a fair day's heaps and a
 * high veil's ice. */
const CLOUD_HEIGHT = { heap: 2500, streak: 8000 } as const;
/** A white cloud's radiance per unit of the sun's light on it (a thick
 * cloud's sunward face, ~0.9 of it sent back over a hemisphere: 0.9/π). */
const CLOUD_WHITE = 0.28;
const CLOUD_SUN: Rgb = [0, 0, 0];

/** THE FAR GROUND'S REFLECTANCE, linear RGB: winter country seen from
 * tens of kilometres — snowfields (0.8 and more) mixed with conifer woods
 * (under 0.1), rock and the faces turned from the light — comes to a
 * third or so, a shade bluer than grey for the snow's share of the sky. */
export const FAR_ALBEDO: Rgb = [0.27, 0.29, 0.33];

export const DOME = { span: 0.5, gain: 2.3, horizon: 0.5 } as const;

const UP = { x: 0, y: 1, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };
const lum = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const lumAt = (g: Float32Array, k: number): number =>
  0.2126 * g[k] + 0.7152 * g[k + 1] + 0.0722 * g[k + 2];
const ROW = atmosphereRow(0, 0);
const UP_IRR: Rgb = [0, 0, 0];
const DOWN_IRR: Rgb = [0, 0, 0];
/** The last physical row read, kept while the sun has moved less than
 * `PHYS_STEP` rad (a hundredth of a degree — at the sky's clock a tenth of
 * a second of run), so a frame reads the table only when the sky changed. */
const PHYS = { elevation: NaN, altitude: NaN, mean: 1 };
const PHYS_STEP = 2e-4;

/** THE PHYSICAL SKY for this sun and lens (`atmosphereRow`), with the
 * grazing row pulled toward the one over it (`DOME.horizon`), the sky's
 * mean luminance and the irradiance up and down — in `ROW`, `PHYS`,
 * `UP_IRR` and `DOWN_IRR`. */
function physicalSky(elevation: number, altitude: number): typeof ROW {
  if (Math.abs(elevation - PHYS.elevation) < PHYS_STEP && altitude === PHYS.altitude) return ROW;
  const phys = atmosphereRow(elevation, altitude, ROW);
  for (let k = 0; k < SKY_VIEW_AZ * 3; k++) {
    const up = k + SKY_VIEW_AZ * 3;
    if (phys.grid[k] > 0 && phys.grid[up] > 0)
      phys.grid[k] *= Math.pow(phys.grid[up] / phys.grid[k], DOME.horizon);
  }
  let mean = 0;
  for (let k = 0; k < SKY_GRID; k += 3) mean += Math.log(Math.max(1e-30, lumAt(phys.grid, k)));
  PHYS.mean = Math.exp(mean / (SKY_GRID / 3));
  shIrradiance(phys.sh, UP, UP_IRR);
  shIrradiance(phys.sh, DOWN, DOWN_IRR);
  PHYS.elevation = elevation;
  PHYS.altitude = altitude;
  return phys;
}

/** THE WHOLE LOOK for a sun at `azimuth`, `elevation`, a moon, a weather —
 * and the fall at this moment (`snowAt`), the dealt mean when left out —
 * seen from `altitude` m over the sea. */
export function skyLookFor(
  azimuth: number,
  elevation: number,
  moonAt: MoonInput = NO_MOON,
  weather: Weather = CLEAR_WEATHER,
  now?: number,
  altitude: number = DEFAULT_ALTITUDE,
): SkyLook {
  // How "high" the day is, 0 at the horizon to 1 at 45° and over.
  const high = smooth(0.0, 0.8, elevation);
  // How much day there is: 1 with the sun up, 0 by twelve degrees under.
  const day = smooth(-0.21, 0.04, elevation);
  const night = 1 - day;
  const lightUp = Math.pow(day, 1.6);

  // THE CLEAR DAY, out of the physics (`sky-atmosphere.ts`): the sky's
  // radiance by direction, the sun through the air, the sky's light on a
  // surface — exposed by the eye's adaptation to the light on the snow.
  const phys = physicalSky(elevation, altitude);
  const exposure = exposureOf(adaptingLight(lum(phys.sun), elevation, lum(UP_IRR)));
  const view = new Float32Array(SKY_GRID);
  // The dome as the eye LOOKING AT IT sees it: adapted to the sky's own
  // mean rather than the snow's light, and pressing the sky's own span (a
  // physical clear sky is near ten times as bright at the horizon as the
  // zenith; a photograph of one, or an eye on it, shows nearer three) —
  // every texel's colour kept, its luminance pulled toward the mean.
  const skyMean = PHYS.mean;
  for (let j = 0; j < SKY_VIEW_EL; j++) {
    const v = j / (SKY_VIEW_EL - 1);
    for (let i = 0; i < SKY_VIEW_AZ; i++) {
      const k = (j * SKY_VIEW_AZ + i) * 3;
      const Y = lumAt(phys.grid, k);
      const press = Y > 0 ? DOME.gain * Math.pow(Y / skyMean, DOME.span - 1) : 0;
      for (let c = 0; c < 3; c++) {
        const floor = NIGHT_HORIZON[c] + (NIGHT_ZENITH[c] - NIGHT_HORIZON[c]) * v;
        view[k + c] = phys.grid[k + c] * exposure * press + floor * night;
      }
    }
  }
  const cell = (i: number, j: number): Rgb => {
    const k = (j * SKY_VIEW_AZ + i) * 3;
    return [view[k], view[k + 1], view[k + 2]];
  };
  let zenith = cell(0, SKY_VIEW_EL - 1);
  // The horizon away from the sun, a little over it (under the Belt).
  let horizon = cell(SKY_VIEW_AZ - 1, 1);
  let glow = cell(0, 1);
  // The air of the valleys falls into Earth's shadow as the sun goes
  // under: its colour the anti-solar horizon's, under the Belt.
  let shadowAir = cell(SKY_VIEW_AZ - 1, 0);
  const shadowShare = smooth(0.01, -0.05, elevation);
  const sunMax = Math.max(phys.sun[0], phys.sun[1], phys.sun[2]);
  const tint: Rgb =
    sunMax > 1e-6
      ? [phys.sun[0] / sunMax, phys.sun[1] / sunMax, phys.sun[2] / sunMax]
      : sunTint(elevation);

  const moon = sunDirection(moonAt.azimuth, moonAt.elevation);
  const moonUp = smooth(-0.02, 0.18, moonAt.elevation);

  // THE KEY: whichever of the two lights is the stronger, through the cloud.
  const lid = LID[weather.kind];
  const fall = snows(weather.kind) ? (now ?? weather.snowfall) : 0;
  const fog = weather.kind === "fog" ? weather.fog : 0;
  const pass = lid.key * (1 - 0.6 * fall) * (1 - 0.6 * fog);
  const sunKey = exposure * sunMax;
  const moonKey = MOON_KEY * (0.2 + 0.8 * moonAt.lit) * moonUp * night;
  const byMoon = moonKey > sunKey;
  const keyIntensity = (byMoon ? moonKey : sunKey) * pass;
  const key = byMoon ? moon : sunDirection(azimuth, elevation);

  // THE SKY'S LIGHT, off the harmonics: blue over a low warm sun because
  // the sky is, and the snow's bounce under it near-white.
  const upMax = Math.max(UP_IRR[0], UP_IRR[1], UP_IRR[2], 1e-12);
  const physAmbient = exposure * AMBIENT_LIFT * upMax;
  const nightAmbient = (0.16 + 0.22 * moonUp * moonAt.lit) * night;
  const nightShare = nightAmbient / Math.max(1e-6, physAmbient + nightAmbient);
  let skyLight = mix(
    [UP_IRR[0] / upMax, UP_IRR[1] / upMax, UP_IRR[2] / upMax],
    [0.3, 0.42, 0.95],
    nightShare,
  );
  let groundLight = mix(
    [DOWN_IRR[0] / upMax, DOWN_IRR[1] / upMax, DOWN_IRR[2] / upMax],
    [0.86, 0.9, 0.96],
    nightShare,
  );
  let ambient = physAmbient + nightAmbient;
  const irradiance = shRotateY(phys.sh, azimuth);
  for (let k = 0; k < 27; k++) irradiance[k] *= exposure * AMBIENT_LIFT;

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
    // Under a deck there is no Earth's shadow to see: the low air is the
    // deck's grey, dimming with the light.
    shadowAir = horizon;
    // The deck over the whole dome: its grey from the horizon up, a pale
    // patch where the sun is behind it.
    for (let j = 0; j < SKY_VIEW_EL; j++) {
      const v = j / (SKY_VIEW_EL - 1);
      const up = Math.pow(Math.sin(v * v * (Math.PI / 2)), 0.5);
      for (let i = 0; i < SKY_VIEW_AZ; i++) {
        const u = i / (SKY_VIEW_AZ - 1);
        const mu = Math.max(0, Math.cos(u * u * Math.PI) * Math.cos(v * v * (Math.PI / 2)));
        const halo = 0.06 * Math.pow(mu, 6) * pass * lightUp;
        const k = (j * SKY_VIEW_AZ + i) * 3;
        for (let c = 0; c < 3; c++)
          view[k + c] = horizon[c] + (zenith[c] - horizon[c]) * up + halo * tint[c];
      }
    }
    skyLight = mix(skyLight, [0.8, 0.85, 0.93], day);
    groundLight = mix(groundLight, [0.9, 0.92, 0.95], day);
    // What the lid takes off the key it gives back as a flat, skylit glow —
    // all of it under a thin deck, half under a storm's.
    ambient *= 1 + (LID_LIGHT[kind] - 1) * day;
    for (let k = 0; k < 27; k++) irradiance[k] *= 1 + (LID_LIGHT[kind] - 1) * day;
  } else if (lid.cover > 0) {
    // A veil or heaps between: the blue thinned toward the horizon's white.
    const share = lid.cover * (lid.genus === 2 ? 0.35 : 0.12);
    for (let j = 0; j < SKY_VIEW_EL; j++)
      for (let i = 0; i < SKY_VIEW_AZ; i++)
        for (let c = 0; c < 3; c++) {
          const k = (j * SKY_VIEW_AZ + i) * 3 + c;
          view[k] += (view[i * 3 + c] - view[k]) * share;
        }
    zenith = mix(zenith, horizon, share);
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

  // A cloud is lit by the sun THROUGH THE AIR TO IT (`sunTransmittance` at
  // the layer's height — a heap's 2.5 km, a streak's 8 km, which keeps the
  // sun after the snow has lost it): white at noon, gold, then orange and
  // red as the sun goes down, a high veil pink a while after sunset. Its
  // sunward top takes that light on white over the sky's own; its base the
  // sky's light, and a low sun's from below. Under a lid the two are the
  // deck's own greys, far enough apart that its underside reads as cloud
  // and not as paint — and furthest in a storm, whose deck boils.
  const rough = weather.kind === "storm" ? 1.9 : 1.5;
  sunTransmittance(elevation, lid.genus === 2 ? CLOUD_HEIGHT.streak : CLOUD_HEIGHT.heap, CLOUD_SUN);
  // Pressed as the dome is (`DOME`), so a cloud in a low sun under a
  // twilight's open eye stays orange rather than clipping to cream.
  const cloudY = lum(CLOUD_SUN) * CLOUD_WHITE * pass;
  const cloudPress = cloudY > 0 ? DOME.gain * Math.pow(cloudY / skyMean, DOME.span - 1) : 0;
  const cloudSun: Rgb = scale(CLOUD_SUN, exposure * cloudPress * CLOUD_WHITE * pass);
  const under = smooth(0.2, 0.01, elevation);
  const cloudLit: Rgb = lidded
    ? scale(zenith, rough)
    : [cloudSun[0] + zenith[0] * 0.7, cloudSun[1] + zenith[1] * 0.7, cloudSun[2] + zenith[2] * 0.7];
  const skyUnder = mix(scale(zenith, 1.1), horizon, 0.5);
  const cloudShade: Rgb = lidded
    ? scale(zenith, 0.62)
    : [
        skyUnder[0] + cloudSun[0] * (0.12 + 0.5 * under),
        skyUnder[1] + cloudSun[1] * (0.12 + 0.5 * under),
        skyUnder[2] + cloudSun[2] * (0.12 + 0.5 * under),
      ];

  // How much of the night sky the cloud leaves: a lid takes all of it, a
  // veil of cirrus some, and heaps only where they stand — which the dome
  // draws over the stars itself.
  const clearNight = 1 - lid.cover * (lidded ? 1 : lid.genus === 2 ? 0.6 : 0.25);

  // The lamps come on as the light goes — reckoned on the light ITSELF
  // (the unexposed sun and sky, at the day's exposure), never on the
  // eye's adaptation: nothing under a clear noon, all of it by the time the
  // sun is a degree or two up or a blizzard shuts in.
  const lidLight = lidded ? LID_LIGHT[weather.kind as keyof typeof LID_LIGHT] : 1;
  const real = EXPOSURE.key * (lum(phys.sun) * pass + 0.6 * AMBIENT_LIFT * upMax * lidLight);
  const lamps = 1 - smooth(0.4, 1.0, real);

  // THE FAR GROUND under the horizon: albedo over π of the sky's light on
  // it, as three lights a level face, and of the key's on a face square to
  // it — gone as the key sinks under the far country's own horizon.
  const farGround: Rgb = [0, 0, 0];
  const farKey: Rgb = [0, 0, 0];
  const keyCol = byMoon ? MOONLIGHT : tint;
  const farLight = keyIntensity * smooth(-0.01, 0.01, key.y);
  for (let c = 0; c < 3; c++) {
    farGround[c] = (FAR_ALBEDO[c] / Math.PI) * skyLight[c] * ambient;
    farKey[c] = (FAR_ALBEDO[c] / Math.PI) * keyCol[c] * farLight;
  }

  return {
    sun: sunDirection(azimuth, elevation),
    elevation,
    moon,
    moonLit: moonAt.lit,
    zenith,
    horizon,
    glow,
    hazeShadow: [shadowAir[0], shadowAir[1], shadowAir[2], shadowShare],
    farGround,
    farKey,
    sunColour: tint,
    key,
    keyColour: byMoon ? MOONLIGHT : tint,
    keyIntensity,
    skyLight,
    groundLight,
    ambient,
    view,
    irradiance,
    exposure,
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

/** The altitude over the sea the sky of `level` is reckoned at, m: its
 * mountain's middle (a valley lens sees a little more air, a summit's a
 * little less — the table has both). */
export function lensAltitude(level: Pick<Level, "mountain">): number {
  const m = level.mountain;
  return m ? m.altitude + m.vertical / 2 : DEFAULT_ALTITUDE;
}

/** The look at run time `t` on `level`: the sun, the moon and the stars
 * where the SKY'S CLOCK has them at `t` (the map's start hour run on at
 * `rate` — the app's, `sky-clock.ts`; 0 holds them at the start hour), and
 * the fall as the squalls have it at `t`. */
export function skyLookAt(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain">,
  t = 0,
  rate: number = skyClock(),
): SkyLook {
  const sky = skyLevelAt(level, t, rate);
  const sun = sunAtRun(sky);
  const moon = moonAtRun(sky);
  const look = skyLookFor(
    sun.azimuth,
    sun.elevation,
    moon,
    weatherOf(level),
    snowAt(level, t, fallNow).fall,
    lensAltitude(level),
  );
  look.turn = skyTurnOf(sky);
  return look;
}

/** WHERE THE KEY WILL STAND `lead` s of run on (the sun's or the moon's
 * direction, as `skyLookAt` deals it), or null while the sky's clock stands
 * — what the mountain's shadow is baked ahead to (`terrain-shadow.ts`'s
 * `HorizonBlend`). */
export function keyAheadAt(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain">,
  t: number,
  lead: number = TERRAIN_SHADOW.lead,
  rate: number = skyClock(),
): Dir | null {
  return rate > 0 ? skyLookAt(level, t + lead, rate).key : null;
}
