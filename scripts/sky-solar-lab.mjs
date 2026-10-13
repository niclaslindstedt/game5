#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN AND MOON LAB (`make sky-solar`): how far the game's sky stands
// from the real one. Every row is a place and a date — the real faces'
// own latitudes and longitudes (north and south of the equator, the far
// north where the winter sun barely clears the ridge) and the generated
// maps' dealt bands — and the game's sun (`sunAtRun`: the framework's
// `core/solar` under the game's `declinationOf`, read at an APPARENT SOLAR
// hour) is held against a reference (`scripts/lib/solar-reference.mjs`:
// the NOAA arithmetic after Meeus, with refraction; the almanacs' low-
// precision moon). Pure Node, seconds, deterministic.
//
// The columns:
//
//   decl     the sun's declination, the game's less the reference's, °
//   eot      the equation of time that day, min — how far apparent solar
//            noon stands off mean (clock) noon at the zone's meridian
//   noon     the sun's height at solar noon, the reference's (refracted), °
//   dEl      the most the game's elevation is off over the daylight
//            hours, against the reference's REFRACTED elevation, °
//   dAz      the most its azimuth is off over the daylight hours, °
//   rise/set the reference's sunrise and sunset, apparent solar hours
//   dRise    the game's sunrise less the reference's, minutes (the game
//            has no refraction and reads the centre, not the upper limb)
//   day      the reference's day length, h
//   civil    the reference's evening civil twilight (sunset to −6°), min,
//            and the game's less it
//   naut     the same to −12°, min
//   moon     the most the game's moon is off in elevation over the night,
//            given the moon's TRUE age that day (°), and the share lit
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
import { moonAt } from "@niclaslindstedt/oss-game-framework/core/solar";

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
    year: { kind: "number", default: 2026, help: "the civil year the dates are read in" },
    json: { kind: "string", default: "", help: "write the table to this JSON file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/sky-solar-lab.mjs [--year=2026] [--json=file] [--compare=file]",
);

/** A face's place by its id, off the crops (the one place a real face's
 * latitude and longitude are written). */
const face = (id) => {
  const f = FACES.find((x) => x.id === id);
  return { id, lat: f.lat, lon: f.lon };
};
const southern = FACES.filter((f) => f.lat < 0).sort((a, b) => a.lat - b.lat)[0];
const northmost = FACES.reduce((a, b) => (b.lat > a.lat ? b : a));
const PLACES = [
  face("alpine-1"),
  face("continental-1"),
  face("maritime-1"),
  face("fell-1"),
  { id: northmost.id, lat: northmost.lat, lon: northmost.lon },
  { id: southern.id, lat: southern.lat, lon: southern.lon },
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

/** The game's sun on a day at a latitude at a solar hour: elevation and
 * compass azimuth, °. */
function gameSun(hour, doy, lat) {
  const at = E.sunAtRun({ sun: { hour, dayOfYear: doy, latitude: lat } });
  return { el: deg(at.elevation), az: ((deg(at.azimuth) % 360) + 360) % 360 };
}

function gameCrossing(doy, lat, depth, rising) {
  const step = 1 / 60;
  const from = rising ? 0 : 12;
  let was = gameSun(from, doy, lat).el - depth;
  for (let h = from + step; h <= from + 12 + 1e-9; h += step) {
    const now = gameSun(h, doy, lat).el - depth;
    if ((rising && was < 0 && now >= 0) || (!rising && was > 0 && now <= 0))
      return h - step + (was / (was - now)) * step;
    was = now;
  }
  return null;
}

const rows = [];
for (const p of PLACES) {
  const dates = p.lat < 0 ? SOUTH_DATES : NORTH_DATES;
  for (const [m, d] of dates) {
    const jd0 = julianDay(args.year, m, d);
    const doy = dayOfYear(args.year, m, d);
    const { decl, eot } = sunCoords(jd0 + 0.5);
    const gameDecl = E.declinationOf(doy);
    const noon = sunAtSolar(jd0, 12, p.lat, p.lon);
    let dEl = 0;
    let dAz = 0;
    for (let h = 0; h < 24; h += 0.25) {
      const ref = sunAtSolar(jd0, h, p.lat, p.lon);
      if (ref.seen < -18) continue;
      const g = gameSun(h, doy, p.lat);
      if (Math.abs(g.el - ref.seen) > Math.abs(dEl)) dEl = g.el - ref.seen;
      if (ref.seen > 0 && Math.abs(angDiff(g.az, ref.az)) > Math.abs(dAz))
        dAz = angDiff(g.az, ref.az);
    }
    const rise = crossing(jd0, p.lat, p.lon, -0.833, true);
    const set = crossing(jd0, p.lat, p.lon, -0.833, false);
    const gRise = gameCrossing(doy, p.lat, 0, true);
    const civil = crossing(jd0, p.lat, p.lon, -6, false);
    const naut = crossing(jd0, p.lat, p.lon, -12, false);
    const gSet = gameCrossing(doy, p.lat, 0, false);
    const gCivil = gameCrossing(doy, p.lat, -6, false);
    const gNaut = gameCrossing(doy, p.lat, -12, false);
    const span = (a, b) => (a === null || b === null ? null : (b - a) * 60);
    const refCivil = span(set, civil);
    const refNaut = span(set, naut);
    // The moon over the night: the game's model handed the TRUE age.
    let dMoon = 0;
    let lit = 0;
    for (let h = 0; h < 24; h += 0.5) {
      const utc = h - p.lon / 15 - eot / 60;
      const ref = moonAtUtc(jd0, utc, p.lat, p.lon);
      lit = ref.lit;
      if (ref.el < 0 && ref.el < -5) continue;
      const g = moonAt(h, p.lat, gameDecl, ref.age);
      const ge = deg(g.elevation);
      if (Math.abs(ge - ref.el) > Math.abs(dMoon)) dMoon = ge - ref.el;
    }
    rows.push({
      id: `${p.id} ${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      lat: r2(p.lat),
      decl: r2(gameDecl - decl),
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
    `moon ${worst("moon")}°; |equation of time| up to ${worst("eot")} min`,
);
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ year: args.year, rows }, null, 2));
  console.log(`wrote ${args.json}`);
}
