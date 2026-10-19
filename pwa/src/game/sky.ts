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
  frontAt,
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
} from "./sky-atmosphere.ts";
import { cloudFieldOf, cloudLayersFor, meanPass, type CloudField } from "./cloud-field.ts";
import { frontFieldAt } from "./cloud-front.ts";
import { lightClouds, type CloudSky } from "./cloud-light.ts";
import { deckZone } from "./low-deck.ts";
import { skyClock } from "./sky-clock.ts";
import {
  KEY_BANDS,
  addHemisphere,
  brightestBand,
  keyBandsFor,
  keyRatios,
  type Relief,
} from "./sky-light.ts";
import { moonDistance, nightOf, type MoonDisc } from "./night-sky.ts";
import { SKY_GRID, SKY_VIEW_AZ, SKY_VIEW_EL } from "./sky-table-format.ts";
import { DEFAULT_TURN, skyTurnOf, type SkyTurn } from "./starfield.ts";
import { TERRAIN_SHADOW } from "./terrain-shadow.ts";

export type Rgb = [number, number, number];

/** A unit vector in the world frame. */
export type Dir = { x: number; y: number; z: number };

/** The cloud over the dome, in a word: which genus leads, and how much of
 * the sky it covers. What each layer is and how it is lit is `clouds`'. */
export type CloudLook = {
  /** 0 none, 1 cumulus (heaps), 2 cirrus (high streaks), 3 a lid. */
  genus: 0 | 1 | 2 | 3;
  /** Share of the sky covered, 0..1. */
  cover: number;
  /** How much of a LID is over the dome, 0..1: 1 under one, 0 under none,
   * and between while a moving sky (`front.ts`) brings one in or takes it
   * away — what the GPU sky hands its dome to the grid by. */
  lid: number;
};

export type SkyLook = {
  /** Toward the sun, unit, world frame (y up; heading 0 along +z). */
  sun: Dir;
  /** The sun's elevation, rad over the horizon (negative under it). */
  elevation: number;
  /** Toward the moon, and how much of its disc is lit, 0..1. */
  moon: Dir;
  moonLit: number;
  /** THE MOON AS DRAWN (`night-sky.ts`): its true angular radius, its
   * phase angle, its colour through the air, its earthshine and glow. */
  moonDisc: MoonDisc;
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
  /** The share of the key the weather lets through (the lid, the fall,
   * the fog) — what a face lit by the sun at another height than the
   * lens's (`far-ranges.ts`) is dimmed by. */
  keyPass: number;
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
  /** THE KEY BY HEIGHT (`sky-light.ts`): the world heights of its bands and
   * the share of `keyColour` × `keyIntensity` each takes, colour by colour
   * (12) — the peaks keeping a red sun after the valley has lost it. */
  keyBandY: number[];
  keyBand: number[];
  /** The eye's adaptation the look is exposed at (`exposureOf`). */
  exposure: number;
  /** The exposure the WORLD'S light is drawn at — the sun, the sky's light
   * and the lamps on the snow: `exposure` lifted through the twilight
   * (`TWILIGHT`), the dome left as it is. */
  light: number;
  /** WHAT THE GPU SKY (MEDIUM, HIGH — `sky-gpu.ts`) needs to expose its own
   * sky-view table exactly as `view` is: the lens's altitude over the sea
   * the sky is reckoned at, m; the clear sky's mean luminance the dome is
   * pressed about (`DOME`); and the share a veil or heaps thin the blue
   * toward the horizon's white (0 for a clear sky and under a lid, whose
   * dome is the deck's and drawn off `view` at every tier). */
  altitude: number;
  domeMean: number;
  veil: number;
  /** The haze's density, 1/m — the distance the far rim is lost over. */
  haze: number;
  /** How low the haze lies: its thinning height, m (a valley fog's is low,
   * so the peaks stand out of it). */
  hazeLift: number;
  /** The sky's light in the mountain's own shadow drawn this share over the
   * rest of the snow's (0 but for the first degrees of a low sun). */
  shadeLift: number;
  /** The cloud over the dome. */
  cloud: CloudLook;
  /** THE CLOUD FIELD'S LIGHT (`cloud-light.ts`): every layer's sun, top and
   * base, the halo, a fog's top from above; and how much of the field is
   * drawn at all (0 inside a valley fog, which hides it); and how much
   * each layer shades the snow (`shade`, one a layer of the field: 0 for a
   * LOW DECK the eye stands over, whose shadow falls under it); and the
   * air under a lid the cloud is seen through (`murk`, 1/m past the clear
   * day's — `cloud-glsl.ts`'s `uCloudVeil`). */
  clouds: CloudSky & { show: number; shade: number[]; murk: number };
  /** THE LOW DECK OR VALLEY FOG round the mountain (`low-deck.ts`, read by
   * `skyLookAt` against the eye's height): its colour, its top's and its
   * base's world heights, m, and its density, 1/m (0: none — or the eye
   * inside it, where the look's own haze is the cloud). The haze lays it
   * over whatever of a view passes through it; the dome fills the view
   * under its top from over it. */
  sea: { colour: Rgb; sun: Rgb; top: number; base: number; k: number };
  /** How dark it is, 0 (day) … 1 (full night). */
  night: number;
  /** How much of the Milky Way shows, 0..1 — only a dark sky's: past
   * astronomical twilight, the moon down or thin, no cloud in front. */
  galaxy: number;
  /** Where the sphere of stars has turned to (`starfield.ts`). */
  turn: SkyTurn;
  /** Whether any star shows, 0..1 — the sky dark enough for the brightest,
   * less the cloud. */
  stars: number;
  /** THE FAINTEST STAR SEEN at the zenith, magnitudes, and the zenith's
   * surface brightness it is reckoned off, mag/arcsec² (`night-sky.ts`) —
   * the twilight's, the moon's sky's and the dark sky's own. */
  starLimit: number;
  skyMagnitude: number;
  /** The night sky's own glow by the dome's elevation rows, drawn (RGB, the
   * horizon's row first): the airglow's band and the moon's sky — laid into
   * `view` and handed to the GPU sky as it is. */
  nightRows: Float32Array;
  /** How FLAT the light is, 0 (a hard sun) … 1 (a whiteout) — the snow
   * shader's cue to keep its relief readable without a shadow. */
  flat: number;
  /** How much the snow glitters in the key light, 0..1. */
  glitter: number;
  /** How far on the arena's floods are, 0 (off: broad day) … 1. */
  lamps: number;
  /** How much of the lamps' light on the world the eye sees against the
   * sky's, 0..1: a floodlight's tens of lux are lost under a twilight sky
   * of hundreds and a storm's day of thousands, and are the whole light of
   * the night — the eye's adaptation over the lamps' fixed power. */
  lampLight: number;
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

/** Where the moon is, for `skyLookFor`: its place, its phase and its
 * distance from the lens, km (its mean when left out). */
export type MoonInput = { azimuth: number; elevation: number; lit: number; distance?: number };

/** No moon in the sky (under the horizon, new). */
const NO_MOON: MoonInput = { azimuth: 0, elevation: -1, lit: 0 };

/** Moonlight's colour: the sun's, bluer to the eye's night vision — and
 * reddened as the air the moon shines through says (`night-sky.ts`). */
const MOONLIGHT: Rgb = [0.6, 0.72, 1.0];

/**
 * WHICH GENUS A SKY OF EACH KIND LEADS WITH, and how much of the dome it
 * covers, in a word. How much of the key gets through and how flat the
 * light is are the CLOUD FIELD's (`cloud-field.ts`'s `meanPass`: the
 * stack's own columns against the sun) — save inside a valley fog, which is
 * no layer of the field and keeps its own numbers (`FOG`).
 */
const LID: Record<Weather["kind"], { genus: CloudLook["genus"]; cover: number }> = {
  clear: { genus: 0, cover: 0 },
  fair: { genus: 1, cover: 0.4 },
  flurries: { genus: 1, cover: 0.26 },
  high: { genus: 2, cover: 0.6 },
  overcast: { genus: 3, cover: 1 },
  snow: { genus: 3, cover: 1 },
  storm: { genus: 3, cover: 1 },
  fog: { genus: 3, cover: 1 },
};
/** Inside a valley fog: the key it lets through, the light's flatness and
 * the glitter left. */
const FOG = { key: 0.3, flat: 0.7, glitter: 0.25 };
/** The sun's sine the field's FLATNESS is read at (its pass at a winter
 * noon's 20°): a property of the cloud, not of the hour. */
const FLAT_SIN = 0.34;
/** How flat a light the field's thickness (1 − its pass at `FLAT_SIN`)
 * leaves: none under broken heaps, most of the way to a whiteout under a
 * deck — the old rows' 0.2 under a high veil, 0.68 under an overcast. */
const flatOf = (thick: number): number =>
  0.95 * Math.pow(Math.min(1, Math.max(0, (thick - 0.42) / 0.55)), 0.75);

/** The stack a weather deals when no map names one (a card's, a test's). */
const STOCK = new Map<string, Pick<CloudField, "layers" | "floorAltitude" | "seaTop">>();
function fieldFor(weather: Weather, altitude: number) {
  const key = `${weather.kind}:${altitude}`;
  let f = STOCK.get(key);
  if (!f) {
    f = { layers: cloudLayersFor(weather.kind), floorAltitude: altitude - 700, seaTop: 0 };
    STOCK.set(key, f);
  }
  return f;
}

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

/** THE TWILIGHT'S LIFT: from the sun a few degrees up to some nine under,
 * the eye looking at the snow adapts to the snow — to the sky's light on
 * it, now the whole light — further than `exposureOf`'s law, read off the
 * sky it looks up at, carries it; so the world's light is drawn this much
 * over the dome's at the bottom of the dusk, eased in and out. */
const TWILIGHT = { most: 1.2, from: 0.05, full: -0.02, gone: -0.16, under: -0.08 } as const;
function twilightLift(elevation: number): number {
  return (
    1 +
    TWILIGHT.most *
      smooth(TWILIGHT.from, TWILIGHT.full, elevation) *
      smooth(TWILIGHT.gone, TWILIGHT.under, elevation)
  );
}

/** THE LOW SUN'S SHADE: for the first few degrees of a sun up, the slopes
 * in the mountain's shadow are lit by the sky alone, and an eye standing in
 * them has adapted to them — never to the thin red key on the peaks that
 * `exposureOf` reads. Their sky light is drawn this share over the day's
 * law (`SkyLook.shadeLift`, most at a sun two to eight degrees up, gone by
 * fourteen and under the horizon, where the twilight's lift takes over) —
 * in the mountain's own shadow only (`haze.ts`), so a run started in a
 * valley's dawn shade reads blue and shaded, never near black, while the
 * sunlit snow keeps its golden key and the air its warmth. */
const SHADE = { most: 0.8, from: 0.14, full: 0.04, dawn: -0.02, up: 0.015 } as const;
function shadeLift(elevation: number): number {
  return (
    SHADE.most * smooth(SHADE.from, SHADE.full, elevation) * smooth(SHADE.dawn, SHADE.up, elevation)
  );
}

/** The eye's exposure the lamps' light is reckoned at as it is drawn: by
 * nine degrees under the horizon the night has taken the sky's light and
 * the lamps are the light (`SkyLook.lampLight`). */
const LAMP_FULL = 1400;

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
/** How high over the eye a lid's base hangs, m, for the snow that hides
 * it; and the share of a lid's grey air a view up to the deck is through,
 * the air thinning with height. */
const DECK_OVER = 600;
const MURK_LIFT = 0.25;

/** The lens's altitude over the sea a look is reckoned at when none is
 * named, m: a generated mountain's middle. */
const DEFAULT_ALTITUDE = 800;

/** THE DOME'S OWN TONE: the sky's span pressed to this power of itself
 * about its mean, and lifted by `gain` (the sky is looked at, and the eye
 * opens to it). The lights are never pressed: only what the dome shows.
 * `horizon` pulls the grazing row (the sky through hundreds of kilometres
 * of air, the haze's colour too) that share of the way, in the logarithm,
 * toward the row a degree and a half over it: in the mountains the far
 * ground stands in front of that path, and what the haze shows is the air
 * of the valleys, not of the whole curve of the Earth. */

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
  field: Pick<CloudField, "layers" | "floorAltitude" | "seaTop"> = fieldFor(weather, altitude),
  relief: Relief | null = null,
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
  const light = exposure * twilightLift(elevation);
  // THE NIGHT (`night-sky.ts`): the moon's light and disc, the sky's own
  // glow by the dome's rows, the stars that sky lets through.
  const dark = nightOf({
    moon: moonAt,
    elevation,
    altitude,
    zenith: lumAt(phys.grid, (SKY_VIEW_EL - 1) * SKY_VIEW_AZ * 3),
    exposure,
    domeMean: PHYS.mean,
    domeGain: DOME.gain,
    domeSpan: DOME.span,
    night,
  });
  const view = new Float32Array(SKY_GRID);
  // The dome as the eye LOOKING AT IT sees it: adapted to the sky's own
  // mean rather than the snow's light, and pressing the sky's own span (a
  // physical clear sky is near ten times as bright at the horizon as the
  // zenith; a photograph of one, or an eye on it, shows nearer three) —
  // every texel's colour kept, its luminance pulled toward the mean.
  const skyMean = PHYS.mean;
  for (let j = 0; j < SKY_VIEW_EL; j++) {
    for (let i = 0; i < SKY_VIEW_AZ; i++) {
      const k = (j * SKY_VIEW_AZ + i) * 3;
      const Y = lumAt(phys.grid, k);
      const press = Y > 0 ? DOME.gain * Math.pow(Y / skyMean, DOME.span - 1) : 0;
      for (let c = 0; c < 3; c++)
        view[k + c] = phys.grid[k + c] * exposure * press + dark.rows[j * 3 + c];
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
  // THE SUN BY HEIGHT: with the map's relief, the key three is handed is
  // the sun where it is brightest — on the peaks, at a low sun — and every
  // height takes its own share of it (`keyBand`); without, the lens's.
  const bands = relief ? keyBandsFor(elevation, relief, altitude) : null;
  let keySun: Rgb = phys.sun;
  if (bands) {
    const b = brightestBand(bands);
    keySun = [bands.sun[b * 3], bands.sun[b * 3 + 1], bands.sun[b * 3 + 2]];
  }
  const keyMax = Math.max(keySun[0], keySun[1], keySun[2]);
  const keyTint: Rgb =
    keyMax > 1e-6 ? [keySun[0] / keyMax, keySun[1] / keyMax, keySun[2] / keyMax] : tint;

  const moon = sunDirection(moonAt.azimuth, moonAt.elevation);
  // The moon's light: the eye's blue night vision over the colour the air
  // it crossed leaves it — an orange moon rising lights the snow warm.
  const mc = [0, 1, 2].map((c) => MOONLIGHT[c] * dark.keyTint[c]);
  const mcMax = Math.max(mc[0], mc[1], mc[2], 1e-9);
  const moonColour: Rgb = [mc[0] / mcMax, mc[1] / mcMax, mc[2] / mcMax];

  // THE KEY: whichever of the two lights is the stronger, through the cloud.
  const lid = LID[weather.kind];
  const fall = snows(weather.kind) ? (now ?? weather.snowfall) : 0;
  const fog = weather.kind === "fog" ? weather.fog : 0;
  // THE CLOUD BETWEEN: the field's mean over the map (each place takes its
  // own share of it, `cloud-glsl.ts`'s `cloudShadow`), and the flatness and
  // the glitter its thickness leaves.
  const inFog = weather.kind === "fog";
  const cloudPass = inFog ? FOG.key : meanPass(field.layers, Math.sin(elevation));
  const thick = inFog ? 0 : 1 - meanPass(field.layers, FLAT_SIN);
  const pass = cloudPass * (1 - 0.6 * fall) * (1 - 0.6 * fog);
  const sunKey = light * keyMax;
  const moonKey = dark.key;
  const byMoon = moonKey > sunKey;
  const keyIntensity = (byMoon ? moonKey : sunKey) * pass;
  const key = byMoon ? moon : sunDirection(azimuth, elevation);

  // THE SKY'S LIGHT, off the harmonics: blue over a low warm sun because
  // the sky is, and the snow's bounce under it near-white.
  const upMax = Math.max(UP_IRR[0], UP_IRR[1], UP_IRR[2], 1e-12);
  const physAmbient = light * AMBIENT_LIFT * upMax;
  const nightAmbient = dark.ambient;
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
  // The whole sky's light by direction: the physical sky's, the night's
  // glow (moon and stars, airglow) laid under it as a hemisphere.
  let irradiance = shRotateY(phys.sh, azimuth);
  for (let k = 0; k < 27; k++) irradiance[k] *= light * AMBIENT_LIFT;
  addHemisphere(irradiance, [0.3, 0.42, 0.95], [0.86, 0.9, 0.96], nightAmbient);

  // THE WEATHER.
  const lidded = lid.genus === 3;
  if (lidded) {
    const kind = weather.kind as keyof typeof DECK;
    const deck = DECK[kind];
    const light = (0.55 + 0.45 * high) * lightUp + 0.018 * night;
    // A fall darkens the deck it comes out of — and hides it: looking up
    // through the snow driving between the eye and a deck some hundreds of
    // metres over it, the eye sees the snow's own grey, the horizon's, all
    // the way up (a blizzard's sky is one flat grey with the ground, not a
    // dark lid over a pale horizon).
    const heavy = 1 - 0.3 * fall;
    const hidden = fall > 0 ? 1 - Math.exp((-DECK_OVER * KOSCHMIEDER) / visibilityIn(fall)) : 0;
    zenith = scale(mix(deck.zenith, deck.horizon, 0.85 * hidden), light * heavy);
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
    // Under a deck the sky has no direction but up: its grey, the snow's
    // bounce under it.
    irradiance = addHemisphere(new Array<number>(27).fill(0), skyLight, groundLight, ambient);
  }
  const veil = !lidded && lid.cover > 0 ? lid.cover * (lid.genus === 2 ? 0.35 : 0.12) : 0;
  if (veil > 0) {
    // A veil or heaps between: the blue thinned toward the horizon's white.
    const share = veil;
    for (let j = 0; j < SKY_VIEW_EL; j++)
      for (let i = 0; i < SKY_VIEW_AZ; i++)
        for (let c = 0; c < 3; c++) {
          const k = (j * SKY_VIEW_AZ + i) * 3 + c;
          view[k] += (view[i * 3 + c] - view[k]) * share;
        }
    zenith = mix(zenith, horizon, share);
    ambient *= 1 + 0.08 * lid.cover * day;
    for (let k = 0; k < 27; k++) irradiance[k] *= 1 + 0.08 * lid.cover * day;
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
  // What of that the deck is seen through: the lid's grey air past the
  // clear day's, thinned with height (`MURK_LIFT`), so a deck goes into the
  // sky's own grey toward the horizon while its texture holds overhead —
  // and the falling snow whole, so a storm's deck is lost in its snow.
  const lidHaze = weather.kind === "overcast" ? LID_HAZE * 1.8 : LID_HAZE * 2.5;
  const murk =
    lidded && !inFog
      ? Math.max(0, lidHaze - CLEAR_HAZE) * MURK_LIFT +
        (fall > 0 ? KOSCHMIEDER / visibilityIn(fall) : 0)
      : 0;

  // THE LIGHT ON EACH LAYER (`cloud-light.ts`): the sun through the air to
  // its own height, pressed as the dome is; the sky's on its shaded parts —
  // under a lid the deck's own greys, furthest apart in a storm, whose deck
  // boils; the moon's by night.
  const clouds = lightClouds(field.layers, {
    elevation,
    exposure,
    skyMean,
    dome: DOME,
    zenith,
    horizon,
    lidded,
    rough: weather.kind === "storm" ? 1.9 : 1.5,
    moon: scale(moonColour, moonKey * 0.05),
    floorAltitude: field.floorAltitude,
    seaTop: field.seaTop,
  });

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
  const realClear = EXPOSURE.key * (lum(phys.sun) + 0.6 * AMBIENT_LIFT * upMax);
  const lampLight = Math.min(1, (light * (realClear / Math.max(real, 1e-12))) / LAMP_FULL);

  // THE FAR GROUND under the horizon: albedo over π of the sky's light on
  // it, as three lights a level face, and of the key's on a face square to
  // it — gone as the key sinks under the far country's own horizon.
  const farGround: Rgb = [0, 0, 0];
  const farKey: Rgb = [0, 0, 0];
  const keyCol = byMoon ? moonColour : keyTint;
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
    moonDisc: dark.disc,
    zenith,
    horizon,
    glow,
    hazeShadow: [shadowAir[0], shadowAir[1], shadowAir[2], shadowShare],
    farGround,
    farKey,
    sunColour: tint,
    key,
    keyColour: keyCol,
    keyIntensity,
    keyPass: pass,
    skyLight,
    groundLight,
    ambient,
    view,
    irradiance,
    keyBandY: bands ? bands.y : [0, 1, 2, 3],
    keyBand: bands
      ? keyRatios(bands, light * pass, keyCol, keyIntensity, !byMoon)
      : new Array<number>(KEY_BANDS * 3).fill(1),
    exposure,
    light,
    altitude,
    domeMean: skyMean,
    veil,
    haze,
    hazeLift: fog > 0 ? 90 + 120 * (1 - fog) : 700,
    shadeLift: shadeLift(elevation),
    cloud: { genus: lid.genus, cover: lid.cover, lid: lidded ? 1 : 0 },
    clouds: { ...clouds, show: inFog ? 0 : 1, shade: field.layers.map(() => 1), murk },
    sea: { colour: clouds.sea, sun: clouds.seaSun, top: 0, base: NO_BASE, k: 0 },
    night,
    stars: smooth(-1.6, 0, dark.starLimit) * clearNight,
    starLimit: dark.starLimit,
    skyMagnitude: dark.skyMagnitude,
    nightRows: dark.rows,
    galaxy: smooth(19.4, 21.2, dark.skyMagnitude) * clearNight * clearNight,
    turn: DEFAULT_TURN,
    flat: Math.min(1, (inFog ? FOG.flat : flatOf(thick)) + 0.08 * fall),
    glitter: inFog ? FOG.glitter : Math.pow(Math.min(1, (1 - thick) / 0.65), 1.4),
    lamps,
    lampLight,
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

/** The heights the key is reckoned between on `level` (`sky-light.ts`), or
 * null for a map with no mountain. */
export function reliefOf(level: Pick<Level, "mountain">): Relief | null {
  const m = level.mountain;
  return m ? { sea: m.sea, low: m.base.y, high: m.summit.y } : null;
}

/** The look at run time `t` on `level`: the sun, the moon and the stars
 * where the SKY'S CLOCK has them at `t` (the map's start hour run on at
 * `rate` — the app's, `sky-clock.ts`; 0 holds them at the start hour), and
 * the fall as the squalls have it at `t`. */
export function skyLookAt(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain" | "front">,
  t = 0,
  rate: number = skyClock(),
  eyeY?: number,
): SkyLook {
  const sky = skyLevelAt(level, t, rate);
  const sun = sunAtRun(sky);
  const at0 = moonAtRun(sky);
  // The moon's distance that instant: its size and its light.
  const moon = { ...at0, distance: moonDistance(sky, at0.elevation) };
  const field = fieldAt(level, t);
  const fall = snowAt(level, t, fallNow).fall;
  const under = (weather: Weather): SkyLook =>
    lookUnder(level, sky, sun, moon, weather, field, fall, eyeY);
  // UNDER A MOVING SKY (`front.ts`): the look under each of the two skies
  // either side, over the one morphing field and the one fall, mixed by how
  // far the change has come — never a sky swapped for another.
  const front = level.front ? frontAt(level, t) : null;
  if (!front) return under(weatherOf(level));
  if (front.share <= 0) return under(front.a);
  return blendLook(under(front.a), under(front.b), front.share);
}

/** The look under the sky `weather` with the field `field` and the fall
 * `fall` — over a valley fog's or a low deck's sea, as the eye `eyeY` has it. */
function lookUnder(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain">,
  sky: Pick<Level, "sun">,
  sun: { azimuth: number; elevation: number },
  moon: MoonInput,
  weather: Weather,
  field: CloudField,
  fall: number,
  eyeY: number | undefined,
): SkyLook {
  const at = (w: Weather, f: typeof field = field): SkyLook => {
    const look = skyLookFor(
      sun.azimuth,
      sun.elevation,
      moon,
      w,
      fall,
      lensAltitude(level),
      f,
      reliefOf(level),
    );
    look.turn = skyTurnOf(sky);
    return look;
  };
  const deck = field.deck;
  if (!deck || deck.top <= 0 || eyeY === undefined) return at(weather);
  // THE LOW DECK IS AN INVERSION (`low-deck.ts`): over its top the air is
  // clear and the sun out, and the deck lies below as a sea of cloud, its
  // top lit; inside it the view closes in a fog; under its base a grey
  // ceiling — each eased across its few metres of the eye's height.
  const top = field.floorY + deck.top;
  const base = deck.base > 0 ? field.floorY + deck.base : NO_BASE;
  const zone = deckZone(deck, eyeY - field.floorY);
  const fogDay = weather.kind === "fog";
  const looks: [SkyLook, number][] = [];
  if (zone.inside < 1) {
    // Under the base: the day's own sky with the deck for a lid — a fair
    // day's heaps hidden over it.
    const under = at(weather.kind === "fair" ? { ...weather, kind: "overcast" } : weather);
    under.sea = { colour: under.zenith, sun: [0, 0, 0], top, base, k: SEA_DENSITY };
    looks.push([under, 1]);
  }
  if (zone.inside > 0 && zone.over < 1) {
    const inside = at(fogDay ? weather : { ...weather, kind: "fog", fog: deck.fog });
    inside.sea = { colour: inside.clouds.sea, sun: [0, 0, 0], top, base, k: 0 };
    looks.push([inside, zone.inside]);
  }
  if (zone.over > 0) {
    // Over the top the deck is under the eye: it no longer dims the sun.
    const d = field.deckLayer;
    const f =
      d < 0
        ? field
        : { ...field, layers: field.layers.map((l, i) => (i === d ? { ...l, tau: 0 } : l)) };
    const over = at({ ...weather, kind: weather.kind === "fair" ? "fair" : "clear", fog: 0 }, f);
    if (d >= 0) over.clouds.shade[d] = 0;
    over.sea = { colour: over.clouds.sea, sun: over.clouds.seaSun, top, base, k: SEA_DENSITY };
    looks.push([over, zone.over]);
  }
  let look = looks[0][0];
  for (let i = 1; i < looks.length; i++) look = blendLook(look, looks[i][0], looks[i][1]);
  return look;
}

/** A deck's density seen from outside it, 1/m: a few tens of metres of it
 * hide the ground. */
const SEA_DENSITY = 0.03;
/** The base of a deck lying on the floor: under anything. */
const NO_BASE = -1e6;

const FIELDS = new WeakMap<object, CloudField>();
/** THE CLOUD FIELD over a map, dealt once a map — the dealt sky's. */
export function fieldOf(level: Pick<Level, "seed" | "sun" | "weather" | "mountain">): CloudField {
  let f = FIELDS.get(level);
  if (!f) {
    f = cloudFieldOf(level);
    FIELDS.set(level, f);
  }
  return f;
}

// isolation:stateless: a memo of the last cloud field asked, keyed by the map and the moment (tests/support/isolation.ts).
/** The last field a moving sky was asked for: the look and the cloud's
 * drawing ask for the same moment each frame. */
let lastFront: { level: object; t: number; field: CloudField } | null = null;

/** THE CLOUD FIELD over a map at run time `t`: the dealt one (`fieldOf`) on
 * a map without a FRONT; on one, the field morphing between the skies
 * either side (`cloud-front.ts`). */
export function fieldAt(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain" | "front">,
  t: number,
): CloudField {
  if (!level.front) return fieldOf(level);
  if (lastFront && lastFront.level === level && lastFront.t === t) return lastFront.field;
  const field = frontFieldAt(level, t);
  lastFront = { level, t, field };
  return field;
}

/** Two looks mixed `s` of the way from `a` to `b`, field by field: every
 * number and every list of numbers mixed, anything else `b`'s past half. */
function blendLook<T>(a: T, b: T, s: number): T {
  if (typeof a === "number" && typeof b === "number") return (a + (b - a) * s) as T;
  if (a instanceof Float32Array && b instanceof Float32Array) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * s;
    return out as T;
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.map((v: unknown, i) => blendLook(v, b[i] as unknown, s)) as T;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(b))
      out[k] = blendLook((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], s);
    return out as T;
  }
  return s < 0.5 ? a : b;
}

/** WHERE THE KEY WILL STAND `lead` s of run on (the sun's or the moon's
 * direction, as `skyLookAt` deals it), or null while the sky's clock stands
 * — what the mountain's shadow is baked ahead to (`terrain-shadow.ts`'s
 * `HorizonBlend`). */
export function keyAheadAt(
  level: Pick<Level, "seed" | "sun" | "weather" | "mountain" | "front">,
  t: number,
  lead: number = TERRAIN_SHADOW.lead,
  rate: number = skyClock(),
): Dir | null {
  return rate > 0 ? skyLookAt(level, t + lead, rate).key : null;
}
