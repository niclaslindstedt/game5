// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A REFERENCE SUN AND MOON for the labs to hold the game's own sky against —
// never imported by the game. The sun is the NOAA solar calculator's
// arithmetic (after Meeus's "Astronomical Algorithms": the sun's mean and
// true longitude, the equation of centre, the nutation in longitude, the
// obliquity, the equation of time), good to about a hundredth of a degree
// for this century; with the atmosphere's refraction near the horizon
// (Bennett's formula as NOAA states it). The moon is the low-precision
// series of the astronomical almanacs (six terms in longitude, four in
// latitude), good to a few tenths of a degree, with the parallax of an
// observer on the surface taken out of its elevation.
//
// Angles in degrees unless the name says otherwise; times in UTC hours on a
// civil date. The azimuth is clockwise from north (0 north, 90 east).

const D = Math.PI / 180;
const sin = (x) => Math.sin(x * D);
const cos = (x) => Math.cos(x * D);
const tan = (x) => Math.tan(x * D);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / D;
const atan2 = (y, x) => Math.atan2(y, x) / D;
const wrap360 = (x) => ((x % 360) + 360) % 360;

/** Julian day at 0h UTC of a civil date (Gregorian). */
export function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** The day of the year of a civil date, 1..366. */
export function dayOfYear(year, month, day) {
  return julianDay(year, month, day) - julianDay(year, 1, 1) + 1;
}

/** The sun's apparent declination (°) and the equation of time (minutes,
 * apparent less mean) at Julian day `jd`. */
export function sunCoords(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = wrap360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    sin(2 * M) * (0.019993 - 0.000101 * T) +
    sin(3 * M) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const decl = asin(sin(eps) * sin(lambda));
  const ra = wrap360(atan2(cos(eps) * sin(lambda), cos(lambda)));
  const y = tan(eps / 2) ** 2;
  const eot =
    (4 / D) *
    (y * Math.sin(2 * L0 * D) -
      2 * e * Math.sin(M * D) +
      4 * e * y * Math.sin(M * D) * Math.cos(2 * L0 * D) -
      0.5 * y * y * Math.sin(4 * L0 * D) -
      1.25 * e * e * Math.sin(2 * M * D));
  return { decl, eot, ra, lambda, eps };
}

/** The atmosphere's refraction at a true elevation `el` (°), degrees — what
 * lifts the sun's image over the horizon (about 0.57° at it). */
export function refraction(el) {
  if (el > 85) return 0;
  const te = tan(el);
  let r;
  if (el > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (el > -0.575) r = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)));
  else r = -20.774 / te;
  return r / 3600;
}

/** Elevation and azimuth from a declination, an hour angle and a latitude. */
function horizontal(decl, ha, lat) {
  const el = asin(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(ha));
  const az = wrap360(
    atan2(-sin(ha) * cos(decl), cos(lat) * sin(decl) - sin(lat) * cos(decl) * cos(ha)),
  );
  return { el, az };
}

/** The local APPARENT SOLAR hour (0..24, noon when the sun is due south) at
 * a UTC instant and an east longitude. */
export function apparentSolarHour(jd0, utcHour, lon) {
  const { eot } = sunCoords(jd0 + utcHour / 24);
  return (((utcHour + lon / 15 + eot / 60) % 24) + 24) % 24;
}

/** The sun at a civil date (its 0h UTC Julian day `jd0`), a UTC hour, a
 * latitude and an east longitude: the true elevation, the refracted one,
 * the azimuth, the declination and the equation of time. */
export function sunAtUtc(jd0, utcHour, lat, lon) {
  const jd = jd0 + utcHour / 24;
  const { decl, eot } = sunCoords(jd);
  const ast = utcHour + lon / 15 + eot / 60;
  const ha = (ast - 12) * 15;
  const { el, az } = horizontal(decl, ha, lat);
  return { el, seen: el + refraction(el), az, decl, eot, solarHour: ((ast % 24) + 24) % 24 };
}

/** The sun at an APPARENT SOLAR hour on a date at a place (the game's own
 * kind of hour): found by inverting the hour through the equation of time
 * of that day. */
export function sunAtSolar(jd0, solarHour, lat, lon) {
  let utc = solarHour - lon / 15;
  for (let i = 0; i < 3; i++) {
    const { eot } = sunCoords(jd0 + utc / 24);
    utc = solarHour - lon / 15 - eot / 60;
  }
  return sunAtUtc(jd0, utc, lat, lon);
}

/** Greenwich mean sidereal time at `jd`, degrees. */
function gmst(jd) {
  const T = (jd - 2451545) / 36525;
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2451545) + T * T * 0.000387933);
}

/** The moon (low precision) at a UTC instant at a place: its topocentric
 * elevation (refraction left out), azimuth, declination, its age in days
 * past new (off its elongation from the sun) and the share of its disc lit. */
export function moonAtUtc(jd0, utcHour, lat, lon) {
  const jd = jd0 + utcHour / 24;
  const T = (jd - 2451545) / 36525;
  const L =
    218.32 +
    481267.881 * T +
    6.29 * sin(134.9 + 477198.85 * T) -
    1.27 * sin(259.2 - 413335.38 * T) +
    0.66 * sin(235.7 + 890534.23 * T) +
    0.21 * sin(269.9 + 954397.7 * T) -
    0.19 * sin(357.5 + 35999.05 * T) -
    0.11 * sin(186.6 + 966404.05 * T);
  const B =
    5.13 * sin(93.3 + 483202.03 * T) +
    0.28 * sin(228.2 + 960400.87 * T) -
    0.28 * sin(318.3 + 6003.18 * T) -
    0.17 * sin(217.6 - 407332.2 * T);
  const HP =
    0.9508 +
    0.0518 * cos(134.9 + 477198.85 * T) +
    0.0095 * cos(259.2 - 413335.38 * T) +
    0.0078 * cos(235.7 + 890534.23 * T) +
    0.0028 * cos(269.9 + 954397.7 * T);
  const { eps, lambda: sunLambda } = sunCoords(jd);
  const decl = asin(sin(B) * cos(eps) + cos(B) * sin(eps) * sin(L));
  const ra = wrap360(atan2(sin(L) * cos(eps) - tan(B) * sin(eps), cos(L)));
  const ha = gmst(jd) + lon - ra;
  const geo = horizontal(decl, ha, lat);
  // The observer stands an Earth's radius off the centre: the moon sits
  // lower by about its horizontal parallax times the cosine of its height.
  const el = geo.el - HP * cos(geo.el);
  const elong = wrap360(L - sunLambda);
  const age = (elong / 360) * 29.530589;
  return { el, az: geo.az, decl, age, lit: (1 - cos(elong)) / 2 };
}

/** When the sun's refracted upper limb crosses the horizon (−0.833° true
 * centre) or a twilight's depth, solar hours on a date at a place: found by
 * scanning the apparent solar day. `rising` picks the morning crossing.
 * Null when it never crosses. */
export function crossing(jd0, lat, lon, depth, rising) {
  const step = 1 / 60;
  const from = rising ? 0 : 12;
  let was = sunAtSolar(jd0, from, lat, lon).el - depth;
  for (let h = from + step; h <= from + 12 + 1e-9; h += step) {
    const now = sunAtSolar(jd0, h, lat, lon).el - depth;
    if ((rising && was < 0 && now >= 0) || (!rising && was > 0 && now <= 0)) {
      return h - step + (was / (was - now)) * step;
    }
    was = now;
  }
  return null;
}
