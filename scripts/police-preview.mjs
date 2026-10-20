#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE LAB — the police on the run after a DEATH
// (`pwa/src/game/police-plan.ts` plans it, `police-scene.ts` lays it out,
// `rescue-view.ts` and `police-view.ts` draw it) staged at every moment it
// has and photographed through the game's own renderer, so each can be
// judged by eye and iterated on:
//
//   arrive   arrive (the machine flown in in its police livery, set down,
//            the three officers out of its door, the livery close)
//   survey   survey (the lead and the marker officer walking the scene from
//            the impact down to him)
//   cordon   cordon (the stakes driven and the tape run out round the scene,
//            wide; a stake and its tape close)
//   markers  markers (the marker officer knelt at the first, a middle and
//            the last tent; two tents close with their numbers; every one)
//   flash    flash (the photographer's exposures, each at its flash and a
//            moment before: an overall corner, a mid-range, a close-up)
//   recover  recover (the patrollers in, him rolled onto the bag, bagged,
//            carried, loaded, the lift-off; the bag close)
//   above    above (the whole scene from overhead and obliquely, as it is
//            taped and when it is all laid out)
//   night    night (the flashes and the overview at hour 21)
//   tape     tape (the skier sent through the tape at 12 m/s, frame by frame
//            as it bows, snaps, whips back and falls, then the halves lying
//            close and from mid range), tape-slow (pushed through at a
//            walk, torn off the nearer stake)
//
// Each GROUP is one contact sheet, previews/police-<group>.png, and every
// frame is also written alone, previews/police-<view>-<label>.png. The
// page (`pwa/src/tools/police-harness.ts`) ends a run DEAD down the piste
// with its evidence, books it as the app does and draws the next run, its
// clock posed where a frame wants the scene — never on a wall clock, so a
// seed's sheet is the same sheet twice. Built, served and driven in a
// headless Chromium by `scripts/lib/sheet-driver.mjs` — `CHROMIUM_PATH`
// overrides where one is looked for.
//
//   node scripts/police-preview.mjs                    # every sheet
//   node scripts/police-preview.mjs --sheet=markers,flash
//   node scripts/police-preview.mjs --seed=12 --at=0.55 --hour=16

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { shootSheets } from "./lib/sheet-driver.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (arrive, survey, cordon, markers, flash, recover, above, night, tape); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (the sheets' names: each sheet is one view)",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    at: {
      kind: "number",
      default: 0.45,
      help: "where down the piste he struck, a share of its length (he lies 22 m on)",
    },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour every sheet is drawn under (the map's own unless named; the night sheet is 21)",
    },
    weather: {
      kind: "string",
      default: "",
      help: "the sky every sheet is drawn under (clear, fair, flurries, high, overcast, snow, storm, fog); the map's own when left out",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "police", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/police-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--at=share] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

await shootSheets({
  root,
  page: "police-preview",
  api: "police",
  args,
  title: `police — seed ${args.seed}${args.region ? ` ${args.region}` : ""}`,
  query: {
    seed: String(args.seed),
    at: String(args.at),
    quality: args.quality,
    w: String(args.width),
    h: String(args.height),
    cols: String(args.cols),
    scale: String(args.scale),
    ...(args.region ? { region: args.region } : {}),
    ...(Number.isFinite(args.hour) ? { hour: String(args.hour) } : {}),
    ...(args.weather ? { weather: args.weather } : {}),
  },
});
