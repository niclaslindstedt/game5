#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR COUNTRY ROUND THE REAL FACES — the real ranges a real face's
// skyline is made of, baked offline beside the face itself.
//
// A real face is 4×4 km laid 1:1 (`real-faces.mjs`); the far ranges
// (`pwa/src/game/far-ranges.ts`) draw the country round it out to the
// horizon. On a dealt map that country is dealt; on a real face it is the
// REAL one: this script reads the global 90 m elevation model (Copernicus
// DEM GLO-90, one 1°×1° tile at a time, kept in `previews/.dem90/` once
// fetched — a tile over open sea is the sea) round each face to 60 km, on
// the polar layout the game keeps the far country on (`far-face-codec.ts`'s
// `FAR_FACE`: 256 spokes by 40 rings, 2.5 to 60 km from the map's middle,
// turned with the face's own bearing so its +z is the map's), and writes it
// into `pwa/src/game/far-faces/far-<id>.ts` — a GENERATED file a face,
// some 15 kB, fetched with the face when a map is raised on it.
//
// A sample stands for a cell kilometres across, so each is read off nine
// points across its cell, half their mean and half their highest: a peak
// between two samples still stands on the skyline, a little lower.
//
//   make far-faces ARGS=--fetch                  # fetch the tiles (once), then bake
//   make far-faces ARGS="--only alpine-1"        # bake one, print the table
//   make far-faces ARGS=--write                  # …and write the files
//
// The elevation data: Copernicus DEM GLO-90, © DLR e.V. 2010–2014 and ©
// Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the
// European Union and ESA; free to use and redistribute with this notice
// (`docs/real-faces.md`).

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { createDem } from "./lib/dem-tiles.mjs";
import { FACES, SIZE } from "./lib/real-face-crops.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".dem90");
const OUT = join(root, "pwa", "src", "game", "far-faces");

const { FAR_FACE, encodeFarFace } = await import(join(root, "pwa/src/game/far-face-codec.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    fetch: { kind: "flag", help: "download the 90 m tiles not yet kept in previews/.dem90/" },
    write: { kind: "flag", help: "write the files baked (pwa/src/game/far-faces/)" },
    only: { kind: "string", help: "comma-separated face ids to bake (the rest are kept)" },
  },
  "usage: npm run far-faces -- [--fetch] [--write] [--only id,id]",
);

const { tileName, fetchTile, heightAt } = createDem({ cache: CACHE, arcsec: 3 });

/** Where the map point (`x`, `z`) of a face is on the globe, (lat, lon) —
 * `real-face-crops.mjs`'s `globeAt` carried tens of kilometres out, so the
 * degree of longitude is measured at the point's own latitude. */
function farGlobeAt(face, x, z) {
  const th = (face.bearing * Math.PI) / 180;
  const dx = (x - SIZE / 2) * face.scale;
  const dz = (z - SIZE / 2) * face.scale;
  const e = face.east + dx * Math.cos(th) + dz * Math.sin(th);
  const n = face.north - dx * Math.sin(th) + dz * Math.cos(th);
  const lat = face.lat + n / 111320;
  const mid = (((face.lat + lat) / 2) * Math.PI) / 180;
  return [lat, face.lon + e / (111320 * Math.cos(mid))];
}

const radius = (j) =>
  FAR_FACE.inner * Math.pow(FAR_FACE.outer / FAR_FACE.inner, j / (FAR_FACE.rows - 1));

/** Every tile within the far country of a face. */
function tilesOf(face) {
  const names = new Set();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    for (const r of [0, FAR_FACE.outer / 3, (2 * FAR_FACE.outer) / 3, FAR_FACE.outer * 1.05]) {
      const x = SIZE / 2 + r * Math.sin(a);
      const z = SIZE / 2 + r * Math.cos(a);
      names.add(tileName(...farGlobeAt(face, x, z)).name);
    }
  }
  return [...names];
}

/** A face's far country, heights over the sea, row-major by ring. */
function bake(face) {
  const { bearings: B, rows: R } = FAR_FACE;
  const out = new Float64Array(B * R);
  const ratio = Math.pow(FAR_FACE.outer / FAR_FACE.inner, 1 / (R - 1));
  for (let j = 0; j < R; j++) {
    const r = radius(j);
    for (let i = 0; i < B; i++) {
      let sum = 0;
      let top = -Infinity;
      for (const di of [-1 / 3, 0, 1 / 3]) {
        for (const dj of [-1 / 3, 0, 1 / 3]) {
          const a = ((i + di) / B) * Math.PI * 2;
          const rr = r * Math.pow(ratio, dj);
          const h = Math.max(
            0,
            heightAt(...farGlobeAt(face, SIZE / 2 + rr * Math.sin(a), SIZE / 2 + rr * Math.cos(a))),
          );
          sum += h;
          top = Math.max(top, h);
        }
      }
      out[j * B + i] = 0.5 * (sum / 9) + 0.5 * top;
    }
  }
  return out;
}

function writeFile(id, base, data) {
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, `far-${id}.ts`);
  const lines = [
    "// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0",
    "// GENERATED by `make far-faces ARGS=--write` (scripts/far-faces.mjs) —",
    "// never edit by hand. The country round a real face to 60 km, off the",
    "// Copernicus DEM GLO-90, © DLR e.V. 2010–2014 and © Airbus Defence and",
    "// Space GmbH 2014–2018, provided under COPERNICUS by the European Union",
    "// and ESA (docs/real-faces.md); `far-faces.ts` reads it.",
    "",
    'import type { FarFaceData } from "../far-face-codec.ts";',
    "",
    "export const FAR: FarFaceData = {",
    `  id: "${id}",`,
    `  bearings: ${FAR_FACE.bearings},`,
    `  rows: ${FAR_FACE.rows},`,
    `  inner: ${FAR_FACE.inner},`,
    `  outer: ${FAR_FACE.outer},`,
    `  step: ${FAR_FACE.step},`,
    `  base: ${base},`,
    `  data: "${data}",`,
    "};",
    "",
  ];
  writeFileSync(path, lines.join("\n"));
  return path.replace(`${root}/`, "");
}

/** The index of every face baked (the files present), loaders by id. */
function writeIndex() {
  const ids = readdirSync(OUT)
    .filter((f) => /^far-.*\.ts$/.test(f))
    .map((f) => f.slice(4, -3))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const lines = [
    "// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0",
    "// GENERATED by `make far-faces ARGS=--write` (scripts/far-faces.mjs) —",
    "// never edit by hand. Every real face whose far country is baked",
    "// (`far-faces/far-<id>.ts`, fetched only when a map is raised on it);",
    "// `far-faces.ts` reads it.",
    "",
    'import type { FarFaceData } from "./far-face-codec.ts";',
    "",
    "/** Each face's far country, fetched when a map is raised on it. */",
    "export const FAR_LOADERS: Readonly<Record<string, () => Promise<{ FAR: FarFaceData }>>> = {",
    ...ids.map((id) => `  "${id}": () => import("./far-faces/far-${id}.ts"),`),
    "};",
    "",
  ];
  const path = join(OUT, "..", "far-faces-index.ts");
  writeFileSync(path, lines.join("\n"));
  return path.replace(`${root}/`, "");
}

const only = args.only ? new Set(args.only.split(",")) : null;
const faces = FACES.filter((f) => !only || only.has(f.id));
if (args.fetch) {
  for (const name of new Set(faces.flatMap(tilesOf))) await fetchTile(name);
}
console.log("face            region        low m  high m  relief  bytes");
let total = 0;
for (const face of faces) {
  const heights = bake(face);
  const { base, data } = encodeFarFace(heights, FAR_FACE.step);
  let hi = -Infinity;
  for (const h of heights) hi = Math.max(hi, h);
  const bytes = Math.round((data.length * 3) / 4);
  total += data.length;
  console.log(
    `${face.id.padEnd(16)}${face.region.padEnd(14)}${String(base).padStart(5)}  ${hi.toFixed(0).padStart(6)}  ${(hi - base).toFixed(0).padStart(6)}  ${String(bytes).padStart(5)}`,
  );
  if (args.write) console.log(`  wrote ${writeFile(face.id, base, data)}`);
}
console.log(`${faces.length} faces, ${(total / 1024).toFixed(0)} KB of base64`);
if (args.write) console.log(`wrote ${writeIndex()}`);
