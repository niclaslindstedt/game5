// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT, as numbers — the moon as it really is on the map's date and
// the light a dark-adapted eye makes of it, the sky's own brightness and
// the stars that brightness lets through. Three-free and DOM-free, so the
// suite holds every number (`tests/night_sky_test.ts`); `sky.ts` lays it
// into the `SkyLook`, `sky-dome.ts` and `starfield.ts` draw it.
//
//   THE MOON'S DISC. Its place is the engine's (`moonAtRun`, its real
//   orbit); here its DISTANCE that instant (the same orbit,
//   `lunarCoordinates`, less the Earth's radius toward a moon overhead) and
//   so its true angular size — 29.4′ across at apogee, 33.5′ at perigee,
//   drawn at that angle and no larger — and its PHASE ANGLE (the angle at
//   the moon between the sun and the lens), which gives the lit share and,
//   with the sun's direction on the sky, the bright limb.
//   THE MOON'S LIGHT. A full moon at its mean distance gives about a third
//   of a lux outside the air. The phase law is the moon's measured
//   magnitude curve (0.026 magnitudes a degree of phase angle and a fourth
//   power term): steep near full — the OPPOSITION SURGE, the shadows of the
//   regolith hidden from a lens behind the sun — so a half moon gives a
//   tenth of a full one's light, not a half. Nearer it is brighter by the
//   square of the distance (a disc's SURFACE is as bright at any distance:
//   it only grows). The air between takes its share and its blue as it
//   takes the sun's (the same table, `sunTransmittance`): an orange moon
//   rising.
//   EARTHSHINE. The dark part of a young or old moon is lit by the nearly
//   full Earth: some ten-thousandth of the sunlit surface's brightness,
//   by the Earth's own phase (`EARTHSHINE`).
//   THE EYE AT NIGHT. A night under a full moon high in the sky is about a
//   quarter of a lux on the snow, under a quarter moon a few hundredths,
//   and under no moon a couple of thousandths (the stars, the airglow).
//   The eye adapts to it, but only part of the way (`NIGHT.adapt`, decades
//   of gain a decade of light), so a full-moon night reads clearly brighter
//   than a quarter's and a new moon's is dark: starlit, and the lamps.
//   THE SKY'S BRIGHTNESS AND THE STARS. The zenith's luminance — the
//   physical table's twilight (its deep tail eased toward the measured
//   one), the moon's sky (the same table at the moon's height, lit by the
//   moon) and the dark sky's own glow — as a surface brightness in
//   magnitudes a square arc-second; and the faintest star an eye sees
//   against it (`limitingMagnitude`): a first-magnitude star at the end of
//   civil twilight, a sixth-and-a-half under a dark moonless sky, the fifth
//   under a full moon. The stars come out by that, not by a clock.

import { lunarCoordinates, universalHourOf } from "@niclaslindstedt/oss-game-framework/core/solar";

import { skyDateOf, type Level } from "@engine";

import { shIrradiance, type Rgb } from "./atmosphere-model.ts";
import { atmosphereRow, sunTransmittance, type AtmosphereRow } from "./sky-atmosphere.ts";
import { SKY_GRID, SKY_VIEW_AZ, SKY_VIEW_EL } from "./sky-table-format.ts";

const DEG = Math.PI / 180;
const EARTH_KM = 6371;

/** The moon's own numbers. */
export const MOON = {
  /** Its radius, km. */
  radiusKm: 1737.4,
  /** Its mean distance, km. */
  meanKm: 384_400,
  /** A full moon's illuminance at its mean distance outside the air, lx
   * (magnitude −12.74). */
  lux: 0.317,
} as const;

/** The sun's illuminance outside the air, lx — what the sky table's units
 * (a share of it) are multiplied by to read a luminance in cd/m². */
export const SOLAR_LUX = 128_000;

/** THE DARK SKY with no moon: its zenith's luminance (the stars too faint
 * to see one by one, the airglow, the zodiacal light), cd/m² — 21.8
 * magnitudes a square arc-second, a dark mountain site's — and the light
 * that sky gives level snow, lx. */
export const DARK_SKY = { zenith: 2.0e-4, lux: 0.0015 } as const;

/** EARTHSHINE: the dark limb's surface brightness against the sunlit
 * surface's under a FULL Earth (a new moon): Earth's disc seen from the
 * moon is thirteen times the moon's and three times as reflective, against
 * the sun's light — about a ten-thousandth. */
export const EARTHSHINE = 1.0e-4;

/** THE MOON'S PHASE LAW: its light at a phase angle `i` (rad, 0 full)
 * against a full moon's, off its measured magnitude curve. */
export function phaseLaw(i: number): number {
  const d = Math.min(180, Math.abs(i) / DEG);
  return Math.pow(10, -0.4 * (0.026 * d + 4e-9 * d ** 4));
}

/** The moon's apparent radius at `km` from the lens, rad. */
export function moonRadius(km: number): number {
  return Math.asin(MOON.radiusKm / km);
}

/** The moon from the lens on `level` (at the hour its sky stands at — hand
 * it `skyLevelAt`'s): its distance, km, the Earth's radius toward a moon
 * at `elevation` taken off (a moon overhead is that much nearer than one
 * on the horizon). */
export function moonDistance(level: Pick<Level, "sun">, elevation: number): number {
  const jd0 = skyDateOf(level);
  const lon = level.sun.longitude ?? 0;
  const jd = jd0 + universalHourOf(jd0, level.sun.hour, lon) / 24;
  const geo = lunarCoordinates(jd).distance * EARTH_KM;
  const s = Math.sin(Math.max(elevation, -0.3));
  return Math.sqrt(geo * geo - 2 * geo * EARTH_KM * s + EARTH_KM * EARTH_KM);
}

/** The phase angle of a moon whose disc is `lit` lit, rad (0 full, π new). */
export function phaseAngle(lit: number): number {
  return Math.acos(Math.min(1, Math.max(-1, 2 * lit - 1)));
}

/** The moon's illuminance outside the air, lx, at phase angle `i` and
 * `km` away. */
export function moonLux(i: number, km: number): number {
  return MOON.lux * phaseLaw(i) * (MOON.meanKm / km) ** 2;
}

/** How much brighter per square degree the lit surface is at phase angle
 * `i` than its own disc's mean under a lens behind the sun would make it —
 * the phase law shared out over the part of the disc that is lit, by
 * Lommel–Seeliger's law (the disc of a dusty body is nearly flat at full,
 * brightest at the bright limb in a crescent). The disc's brightness is
 * drawn as this times the shape (`MOON_GLSL`). */
const SURGE: number[] = [];
const SURGE_STEP = 2.5 * DEG;
export function surfaceSurge(i: number): number {
  if (!SURGE.length) {
    const lsTotal = (a: number): number => {
      // The disc's light under Lommel–Seeliger on a grid, the sun at `a`.
      const n = 40;
      let sum = 0;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const u = ((x + 0.5) / n) * 2 - 1;
          const v = ((y + 0.5) / n) * 2 - 1;
          const r2 = u * u + v * v;
          if (r2 >= 1) continue;
          const mu = Math.sqrt(1 - r2);
          const mu0 = u * Math.sin(a) + mu * Math.cos(a);
          if (mu0 > 0) sum += mu0 / (mu0 + mu);
        }
      return sum;
    };
    const full = lsTotal(0);
    for (let a = 0; a <= Math.PI + 1e-9; a += SURGE_STEP) {
      const t = lsTotal(Math.min(a, Math.PI - 1e-3));
      SURGE.push(t > 0 ? (phaseLaw(a) * full) / t : 1);
    }
  }
  const x = Math.min(Math.abs(i), Math.PI) / SURGE_STEP;
  const k = Math.min(SURGE.length - 2, Math.floor(x));
  return SURGE[k] + (SURGE[k + 1] - SURGE[k]) * (x - k);
}

/** A surface brightness, magnitudes a square arc-second, for a luminance
 * in cd/m². */
export function surfaceMagnitude(cdm2: number): number {
  return -2.5 * Math.log10(Math.max(cdm2, 1e-12) / 108_000);
}

/** THE FAINTEST STAR an eye sees against a sky of surface brightness `b`
 * (magnitudes a square arc-second): 6.5 under a dark sky's 21.8, 4.8
 * under a full moon's 19, the first magnitude at the end of civil
 * twilight — the standard fit of naked-eye threshold to sky brightness. */
export function limitingMagnitude(b: number): number {
  return 7.93 - 5 * Math.log10(Math.pow(10, 4.316 - b / 5) + 1);
}

/** THE TWILIGHT'S DEEP TAIL. The physical table's sky falls past a sun
 * nine degrees under faster than a measured twilight does (the light
 * scattered more than twice it leaves out): the measured zenith dims by
 * nearly a magnitude a degree from there to the end of astronomical
 * twilight. The zenith's luminance at a sun `elevation` rad up is held to
 * no less than that, cd/m² — for the stars' count only; the dome's
 * picture is the table's. */
export function twilightTail(elevation: number, at9: number): number {
  const under = -elevation / DEG - 9;
  if (under <= 0) return at9;
  return at9 * Math.pow(10, -0.4 * 0.95 * under);
}

/** THE EYE AT NIGHT. `ref`: the light it adapts to under a full moon high
 * in a clear sky, lx; `adapt`: the gain it makes up a decade darker,
 * decades; `key`, `ambient`, `sky`: three's units for the moon's beam, the
 * night sky's light on the snow and the sky's luminance at `ref` (the sky
 * per `skyRef` cd/m²). The ambient is laid as a hemisphere in the night's
 * blue (`sky.ts`), which the snow reads about `seen` as brightly as the
 * same units of the key (measured off `make sky ARGS=--sheet=moon`). The
 * gain is the eye's: under a quarter moon the snow reads about a third as
 * bright as under a full, under no moon about a tenth. */
export const NIGHT = {
  ref: 0.25,
  adapt: 0.4,
  key: 0.7,
  ambient: 10,
  seen: 0.15,
  sky: 0.018,
  skyRef: 6.0e-3,
} as const;

/** The eye's gain over `ref` at an adapting light `lux`. */
export function nightGain(lux: number): number {
  return Math.pow(Math.max(lux, 1e-6) / NIGHT.ref, -NIGHT.adapt);
}

/** THE AIRGLOW by the view's elevation `el` rad, as a share of the dark
 * zenith's: the glowing shell ninety kilometres up seen through more of
 * itself toward the horizon (van Rhijn's factor, up to six), and the air
 * near the horizon taking it back — so a faint band some fifteen degrees
 * up, half as bright again as the zenith. */
export function airglowShare(el: number): number {
  const R = EARTH_KM / (EARTH_KM + 90);
  const c = Math.cos(Math.max(el, 0));
  const vanRhijn = 1 / Math.sqrt(1 - R * R * c * c);
  const s =
    Math.max(Math.sin(Math.max(el, 0)), 0) + 0.5 * Math.pow(Math.max(el / DEG, 0) + 6, -1.6);
  // The air's extinction of it, 0.2 magnitudes an air mass, and the share
  // of the dark sky that is not the airglow (the starlight, the zodiacal
  // light); held to 1 at the zenith.
  const air = Math.exp(-0.184 * Math.min(1 / s, 10));
  return (0.35 + 0.65 * vanRhijn * air) / 0.891;
}

/** The colours of the dark sky's own light, linear: the zenith's cold
 * grey-blue (a dark-adapted eye's), and the airglow's band a shade green
 * with the oxygen line. */
export const DARK_ZENITH: Rgb = [0.55, 0.72, 1.0];
export const AIRGLOW: Rgb = [0.72, 1.0, 0.8];

/** A moonlit sky's colour as the eye sees it: the table's blue (it is the
 * day's sky, a few hundred thousandth as bright) pulled this far toward
 * grey, for the colour the rods do not see. */
export const MOON_SKY_GREY = 0.1;

/** The moonlit sky's span pressed to this power of itself about its zenith
 * (the day's dome's `DOME.span`). */
export const MOON_SKY_PRESS = 0.5;

/** The moon on the dome, as the look carries it to the shader. */
export type MoonDisc = {
  /** Its apparent radius, rad, and its distance, km. */
  radius: number;
  distance: number;
  /** The phase angle, rad (0 full, π new). */
  phase: number;
  /** Its light outside the air against a full moon at its mean distance. */
  brightness: number;
  /** The air's share of its light (luminance) and the tint it leaves. */
  pass: number;
  tint: Rgb;
  /** The lit surface's drawn colour at the disc's middle under a full
   * phase (linear, three's units; the shape and the surge laid on in the
   * shader), the earthshine's against it, and the share of either the
   * eye takes in under the day's sky (1 by night). */
  colour: Rgb;
  earthshine: number;
  /** The light round it in thin cloud and the clear air's aureole, drawn. */
  glow: Rgb;
};

/** THE MOON'S DISC AS DRAWN by night: the lit surface pressed to this power
 * of its own brightness (an eye spans the moon and the night sky at once;
 * a picture cannot), then this gain — a full disc's middle just under
 * white high up, so its seas still read, a dim orange at the horizon. */
export const DISC = { span: 0.4, gain: 1.5 } as const;

/** What `nightOf` is handed: the moon (its place, lit share and distance,
 * km), the sun's elevation, the lens's altitude, the physical zenith's
 * luminance (a share of the sun's illuminance), the dome's exposure, mean
 * and tone (for the moon in a day's sky), and how dark it is. */
export type NightInput = {
  moon: { elevation: number; lit: number; distance?: number };
  elevation: number;
  altitude: number;
  zenith: number;
  exposure: number;
  domeMean: number;
  domeGain: number;
  domeSpan: number;
  night: number;
};

/** THE NIGHT'S HALF OF A LOOK. */
export type NightLook = {
  /** The moon's beam, three's units, and its colour (brightest channel 1). */
  key: number;
  keyTint: Rgb;
  /** The night sky's light on the snow, three's units. */
  ambient: number;
  /** The night sky's own glow by the dome's elevation rows (`SKY_VIEW_EL`
   * of RGB, horizon first): the airglow and the moon's sky, drawn. */
  rows: Float32Array;
  /** The zenith's surface brightness, mag/arcsec², and the faintest star
   * seen there. */
  skyMagnitude: number;
  starLimit: number;
  /** The light the eye adapts to, lx: the moon's beam, the sky's on level
   * snow, the whole; and the gain it makes of it. */
  lux: { key: number; sky: number; adapt: number };
  gain: number;
  disc: MoonDisc;
};

const MOON_ROW: AtmosphereRow = {
  grid: new Float32Array(SKY_GRID),
  sun: [0, 0, 0],
  sh: new Array<number>(27).fill(0),
};
const MOON_ROW_AT = { elevation: NaN, altitude: NaN };
const AT9 = { altitude: NaN, zenith: 0 };
const T: Rgb = [0, 0, 0];
const UP = { x: 0, y: 1, z: 0 };
const UP_IRR: Rgb = [0, 0, 0];
const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The physical zenith's luminance with the sun nine degrees down, a share
 * of the sun's illuminance (the tail's start). */
function zenithAt9(altitude: number): number {
  if (AT9.altitude !== altitude) {
    const row = atmosphereRow(-9 * DEG, altitude);
    const k = (SKY_VIEW_EL - 1) * SKY_VIEW_AZ * 3;
    AT9.zenith = lum(row.grid[k], row.grid[k + 1], row.grid[k + 2]);
    AT9.altitude = altitude;
  }
  return AT9.zenith;
}

/** THE NIGHT for a look: the moon's light, the sky's own glow, the stars
 * that sky lets through, and the moon's disc as drawn. */
export function nightOf(i: NightInput): NightLook {
  const { moon } = i;
  const phase = phaseAngle(moon.lit);
  const distance = moon.distance ?? MOON.meanKm;
  const up = moon.elevation > -0.04;
  // The moon outside the air, lx, and through it.
  const top = up ? moonLux(phase, distance) : 0;
  sunTransmittance(moon.elevation, i.altitude, T);
  const pass = up ? lum(T[0], T[1], T[2]) : 0;
  const tMax = Math.max(T[0], T[1], T[2], 1e-9);
  const tint: Rgb = up && tMax > 1e-6 ? [T[0] / tMax, T[1] / tMax, T[2] / tMax] : [1, 1, 1];
  // The moon's sky: the table's at the moon's height, lit by the moon.
  if (
    up &&
    (Math.abs(moon.elevation - MOON_ROW_AT.elevation) > 1e-3 || MOON_ROW_AT.altitude !== i.altitude)
  ) {
    atmosphereRow(moon.elevation, i.altitude, MOON_ROW);
    MOON_ROW_AT.elevation = moon.elevation;
    MOON_ROW_AT.altitude = i.altitude;
  }
  shIrradiance(MOON_ROW.sh, UP, UP_IRR);
  const keyLux = top * pass;
  const skyLux = (up ? lum(UP_IRR[0], UP_IRR[1], UP_IRR[2]) * top : 0) + DARK_SKY.lux;
  const adapt = keyLux * (0.1 + 0.9 * Math.max(0, Math.sin(moon.elevation))) + skyLux;
  const gain = nightGain(adapt);
  const night = i.night;
  const key = NIGHT.key * (keyLux / NIGHT.ref) * gain * night;
  const ambient = NIGHT.ambient * (skyLux / NIGHT.ref) * gain * night;
  // The night sky's own glow by the dome's rows: the airglow's band and
  // the moon's sky (the azimuths' mean — the glare round the moon is the
  // dome's own), each drawn at the eye's gain.
  const rows = new Float32Array(SKY_VIEW_EL * 3);
  const skyDraw = (NIGHT.sky / NIGHT.skyRef) * gain * night;
  const m = up ? top / SKY_VIEW_AZ : 0;
  const c3: Rgb = [0, 0, 0];
  const rowLum = (j: number): number => {
    c3[0] = c3[1] = c3[2] = 0;
    for (let a = 0; a < SKY_VIEW_AZ; a++) {
      const k = (j * SKY_VIEW_AZ + a) * 3;
      for (let c = 0; c < 3; c++) c3[c] += MOON_ROW.grid[k + c] * m;
    }
    return lum(c3[0], c3[1], c3[2]);
  };
  const moonZenith = rowLum(SKY_VIEW_EL - 1);
  for (let j = 0; j < SKY_VIEW_EL; j++) {
    const v = j / (SKY_VIEW_EL - 1);
    const share = airglowShare(v * v * (Math.PI / 2));
    const Y = rowLum(j);
    // Pressed about the zenith as the day's dome is (`MOON_SKY_PRESS`): the
    // eye does not see a moonlit horizon five times its zenith.
    const press = Y > 0 && moonZenith > 0 ? Math.pow(Y / moonZenith, MOON_SKY_PRESS - 1) : 1;
    for (let c = 0; c < 3; c++) {
      const moonC = (c3[c] * (1 - MOON_SKY_GREY) + Y * MOON_SKY_GREY) * press;
      const darkC = DARK_SKY.zenith * (DARK_ZENITH[c] + Math.max(share - 1, 0) * AIRGLOW[c]);
      const under = Math.min(share, 1);
      rows[j * 3 + c] = (moonC + darkC * under) * skyDraw;
    }
  }
  // The zenith's brightness: the twilight (its tail held to the measured
  // one), the moon's sky and the dark sky's, and the faintest star in it.
  const twilight = Math.max(
    i.zenith * SOLAR_LUX,
    i.elevation < -9 * DEG ? twilightTail(i.elevation, zenithAt9(i.altitude) * SOLAR_LUX) : 0,
  );
  const skyMagnitude = surfaceMagnitude(twilight + moonZenith + DARK_SKY.zenith);
  // THE DISC: its surface as drawn at night (pressed), and in a day's sky
  // as the dome draws any luminance (its exposure, pressed about its mean).
  const radius = moonRadius(distance);
  const surface = up
    ? (MOON.lux * (MOON.meanKm / distance) ** 2 * pass) / (Math.PI * radius ** 2)
    : 0;
  const Yd = surface / SOLAR_LUX;
  const byDay =
    Yd > 0
      ? Yd * i.exposure * i.domeGain * Math.pow(Yd / Math.max(i.domeMean, 1e-30), i.domeSpan - 1)
      : 0;
  const byNight = DISC.gain * Math.pow(pass, DISC.span) * night;
  const draw = Math.max(byDay, byNight);
  const glow = 0.5 * Math.pow(keyLux / NIGHT.ref, DISC.span) * night;
  return {
    key,
    keyTint: tint,
    ambient,
    rows,
    skyMagnitude,
    starLimit: limitingMagnitude(skyMagnitude),
    lux: { key: keyLux, sky: skyLux, adapt },
    gain,
    disc: {
      radius,
      distance,
      phase,
      brightness: top / MOON.lux,
      pass,
      tint,
      colour: [tint[0] * draw, tint[1] * draw, tint[2] * draw],
      earthshine: Math.pow(EARTHSHINE * (1 - moon.lit) ** 1.5, DISC.span) * night,
      glow: [tint[0] * glow, tint[1] * glow, tint[2] * glow],
    },
  };
}
