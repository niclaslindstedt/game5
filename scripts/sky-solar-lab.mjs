#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN AND MOON LAB (`make sky-solar`): how far the game's sky stands
// from the real one. Every row is a place and a date — the real faces'
// own latitudes and longitudes (north and south of the equator, the far
// north where the winter sun barely clears the ridge) and the generated
// maps' dealt bands — and the game's sky (`sunAtRun`, `moonAtRun`,
// `sunWindowOf`: the framework's `core/solar` ephemeris on the map's date
// in the sky's year, `SKY_YEAR`, read at an APPARENT SOLAR hour) is held
// against a reference (`scripts/lib/solar-reference.mjs`: the NOAA
// arithmetic after Meeus, with refraction; the almanacs' low-precision
// moon). A real face's rows go through the game's own path: a map dealt
// in its region's band, then stood at the face's place (`withPlace`, off
// the generated index's latitude, longitude and bearing — and half a year
// on south of the equator). Pure Node, seconds, deterministic.
//
// The columns:
//
//   decl     the sun's declination at the place's solar noon, the game's
//            less the reference's, °
//   eot      the equation of time that day, min — how far apparent solar
//            noon stands off mean (clock) noon at the zone's meridian
//   noon     the sun's height at solar noon, the reference's (refracted), °
//   dEl      the most the game's elevation is off over the daylight
//            hours, against the reference's REFRACTED elevation, °
//   dAz      the most its azimuth is off over the daylight hours, °
//   rise/set the reference's sunrise and sunset, apparent solar hours
//   dRise    the game's sunrise less the reference's, minutes (both the
//            upper limb on the horizon, the refraction counted)
//   day      the reference's day length, h
//   civil    the reference's evening civil twilight (sunset to −6°), min,
//            and the game's less it
//   naut     the same to −12°, min
//   moon     the most the game's moon is off in elevation over the day
//            while it is up (°), the reference's share lit at the end of
//            the day, and dLit the most the game's share lit is off
//
//   node scripts/sky-solar-lab.mjs
//   node scripts/sky-solar-lab.mjs --json=previews/sky-solar-before.json
//   node scripts/sky-solar-lab.mjs --compare=previews/sky-solar-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import {
  crossing,
  dayOfYear,
  julianDay,
  moonAtUtc,
  sunAtSolar,
  sunCoords,
} from "./lib/solar-reference.mjs";
import { FACES } from "./lib/real-face-crops.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    year: {
      kind: "number",
      default: 0,
      help: "the civil year the dates are read in (the game's SKY_YEAR)",
    },
    json: { kind: "string", default: "", help: "write the table to this JSON file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/sky-solar-lab.mjs [--year=2026] [--json=file] [--compare=file]",
);

const year = args.year || E.SKY_YEAR;
if (year !== E.SKY_YEAR) console.log(`(the game's sky is dated in ${E.SKY_YEAR}, not ${year})`);

/** A face's place by its id, off the crops (the one place a real face's
 * latitude and longitude are written); the game reads it off the index. */
const face = (id) => {
  const f = FACES.find((x) => x.id === id);
  return { id, lat: f.lat, lon: f.lon, face: id };
};
const southern = FACES.filter((f) => f.lat < 0).sort((a, b) => a.lat - b.lat)[0];
const northmost = FACES.reduce((a, b) => (b.lat > a.lat ? b : a));
const PLACES = [
  face("alpine-1"),
  face("continental-1"),
  face("maritime-1"),
  face("fell-1"),
  face(northmost.id),
  face(southern.id),
  face("maritime-23"),
  // The generated maps: a band's edge each (R15, R21) on the zone meridian.
  { id: "gen-alpine-44", lat: 44, lon: 15 },
  { id: "gen-fell-69", lat: 69, lon: 15 },
  { id: "gen-maritime-36", lat: 36, lon: 135 },
];
/** Dates through the year: the solstice's lowest sun, deep winter, the
 * late winter most maps are dealt in, the equinox, spring skiing and high
 * summer (the sky must be right on any day — the midnight sun in the far
 * north); and for the south the same months of its own year. */
const NORTH_DATES = [
  [12, 21],
  [1, 20],
  [2, 15],
  [3, 20],
  [4, 10],
  [6, 21],
  [7, 15],
];
const SOUTH_DATES = [
  [6, 21],
  [7, 20],
  [8, 15],
  [9, 22],
  [12, 21],
  [1, 15],
];

const r1 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const deg = (r) => (r * 180) / Math.PI;
const angDiff = (a, b) => {
  let d = (((a - b) % 360) + 540) % 360;
  return d - 180;
};

/** THE GAME'S MAP OF A PLACE ON A DAY: a generated one's sun at the
 * place's latitude and longitude; a real face's dealt in the north and
 * stood at its place by the game (`withPlace`, which moves a southern
 * face's day half a year on — so it is dealt half a year back). */
function gameLevel(p, doy) {
  if (!p.face) return { sun: { hour: 12, dayOfYear: doy, latitude: p.lat, longitude: p.lon } };
  const dealt = p.lat < 0 ? E.dayOfYearOf(doy - 182) : doy;
  const level = { sun: { hour: 12, dayOfYear: dealt, latitude: 45 } };
  const placed = E.withPlace(level, E.realFacePlace(p.face));
  if (placed.sun.dayOfYear !== doy)
    throw new Error(`${p.id}: placed on day ${placed.sun.dayOfYear}`);
  return placed;
}

/** The game's sun over `level` at a solar hour: apparent elevation and
 * compass azimuth (the face's true north put back), °. */
function gameSun(level, hour) {
  const at = E.sunAtRun({ sun: { ...level.sun, hour } });
  const az = deg(at.azimuth + (level.sun.facing ?? 0));
  return { el: deg(at.elevation), az: ((az % 360) + 360) % 360 };
}

/** The game's crossing of a depth (° true; sunrise its upper limb), solar
 * hours, off its own windows. */
function gameCrossing(level, depth, rising) {
  const w = depth === "rise" ? E.sunWindowOf(level) : E.sunWindowOf(level, (depth * Math.PI) / 180);
  if (!w || w.min <= 0 || w.max >= 24) return null;
  return rising ? w.min : w.max;
}

const rows = [];
for (const p of PLACES) {
  const dates = p.lat < 0 ? SOUTH_DATES : NORTH_DATES;
  for (const [m, d] of dates) {
    const jd0 = julianDay(year, m, d);
    const doy = dayOfYear(year, m, d);
    const { eot } = sunCoords(jd0 + 0.5);
    const level = gameLevel(p, doy);
    const gameDecl = E.sunAtRun(level).declination;
    const noon = sunAtSolar(jd0, 12, p.lat, p.lon);
    let dEl = 0;
    let dAz = 0;
    for (let h = 0; h < 24; h += 0.25) {
      const ref = sunAtSolar(jd0, h, p.lat, p.lon);
      if (ref.seen < -18) continue;
      const g = gameSun(level, h);
      if (Math.abs(g.el - ref.seen) > Math.abs(dEl)) dEl = g.el - ref.seen;
      if (ref.seen > 0 && Math.abs(angDiff(g.az, ref.az)) > Math.abs(dAz))
        dAz = angDiff(g.az, ref.az);
    }
    const rise = crossing(jd0, p.lat, p.lon, -0.833, true);
    const set = crossing(jd0, p.lat, p.lon, -0.833, false);
    const gRise = gameCrossing(level, "rise", true);
    const civil = crossing(jd0, p.lat, p.lon, -6, false);
    const naut = crossing(jd0, p.lat, p.lon, -12, false);
    const gSet = gameCrossing(level, "rise", false);
    const gCivil = gameCrossing(level, -6, false);
    const gNaut = gameCrossing(level, -12, false);
    const span = (a, b) => (a === null || b === null ? null : (b - a) * 60);
    const refCivil = span(set, civil);
    const refNaut = span(set, naut);
    // The moon through the day, while it is up: the game's own moon on its
    // own date.
    let dMoon = 0;
    let lit = 0;
    let dLit = 0;
    for (let h = 0; h < 24; h += 0.5) {
      const utc = h - p.lon / 15 - eot / 60;
      const ref = moonAtUtc(jd0, utc, p.lat, p.lon);
      lit = ref.lit;
      const g = E.moonAtRun({ sun: { ...level.sun, hour: h } });
      if (Math.abs(g.lit - ref.lit) > Math.abs(dLit)) dLit = g.lit - ref.lit;
      if (ref.el < -5) continue;
      const ge = deg(g.elevation);
      if (Math.abs(ge - ref.el) > Math.abs(dMoon)) dMoon = ge - ref.el;
    }
    rows.push({
      id: `${p.id} ${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      lat: r2(p.lat),
      // At the same instant: the place's solar noon.
      decl: r2(gameDecl - noon.decl),
      eot: r1(eot),
      noon: r1(noon.seen),
      dEl: r2(dEl),
      dAz: r2(dAz),
      rise: r2(rise),
      set: r2(set),
      dRise: rise === null || gRise === null ? null : r1((gRise - rise) * 60),
      day: rise === null || set === null ? null : r2(set - rise),
      civil: r1(refCivil),
      dCivil:
        refCivil === null || span(gSet, gCivil) === null ? null : r1(span(gSet, gCivil) - refCivil),
      naut: r1(refNaut),
      dNaut:
        refNaut === null || span(gSet, gNaut) === null ? null : r1(span(gSet, gNaut) - refNaut),
      moon: r1(dMoon),
      lit: r2(lit),
      dLit: r2(dLit),
    });
  }
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const cols = Object.keys(rows[0]);
const show = (v) => (v === null ? "—" : String(v));
const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => show(r[c]).length + 7)));
console.log(cols.map((c, i) => c.padEnd(widths[i])).join(" "));
for (const r of rows) {
  const old = before?.rows?.find((b) => b.id === r.id);
  console.log(
    cols
      .map((c, i) => {
        let s = show(r[c]);
        if (old && typeof r[c] === "number" && typeof old[c] === "number" && old[c] !== r[c])
          s += ` (${r2(r[c] - old[c]) > 0 ? "+" : ""}${r2(r[c] - old[c])})`;
        return s.padEnd(widths[i]);
      })
      .join(" "),
  );
}
const worst = (k) => rows.reduce((a, r) => Math.max(a, Math.abs(r[k] ?? 0)), 0);
console.log(
  `\nworst: decl ${worst("decl")}°, elevation ${worst("dEl")}°, azimuth ${worst("dAz")}°, ` +
    `sunrise ${worst("dRise")} min, civil twilight ${worst("dCivil")} min, ` +
    `naut ${worst("dNaut")} min, moon ${worst("moon")}° (lit ${worst("dLit")}); ` +
    `|equation of time| up to ${worst("eot")} min`,
);
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ year, rows }, null, 2));
  console.log(`wrote ${args.json}`);
}
