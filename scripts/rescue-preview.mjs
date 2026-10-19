#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE LAB — the air ambulance on the run after an INJURED one
// (`pwa/src/game/rescue-plan.ts` plans it, `rescue-crew.ts` poses its crew,
// `rescue-view.ts` draws it) staged at every moment it has and
// photographed through the game's own renderer, so each can be judged by
// eye and iterated on:
//
//   site     overview (the whole scene from above at every stage: waiting,
//            walking up, scooping, lifting, carrying, at the door, loading,
//            lifting off, away)
//   scoop    scoop (him got onto the board frame by frame — the walk up
//            with it, the board laid beside him, him straightened, the
//            log-roll, the board slid under, laid back, strapped, the four
//            at the corners, the lift and the first steps — from his feet's
//            end, from overhead and from a chase lens's height)
//   carry    carry (one stride frame by frame, side on — the feet, the
//            hands on the rails), carry-front (the same from ahead)
//   load     load (raised, inched over the sill, the two stepping up, the
//            slide in, the patrollers walking clear)
//   lift     lift (spooled up, the hover and its wash, turned down the
//            valley, away)
//   pass     pass (ridden: the player skiing down past it on the chase
//            lens, every two seconds)
//   night    night (the overview and the carry at hour 21)
//
// and the SKI PATROL ON SNOWMOBILES, sent where no machine can land
// (`rescue-sleds-view.ts`; `pwa/src/tools/rescue-sleds-views.ts` finds a
// spot near `--at` where only the patrol can come):
//
//   sleds-arrive  the convoy driven up, parked, stepping off
//   sleds-scene   the work from above, board to lashings to back on
//   sleds-load    close on the toboggan: lowered in, lashed, all sat
//   sleds-tow     towed down: the bar on the hitch, from beside and behind
//   sleds-night   the arrival, the work and the tow at hour 21
//   sleds-stolen  a machine taken while it stands, the other towing him,
//                 the player's own left standing
//
// Each GROUP is one contact sheet, previews/rescue-<group>.png, and every
// frame is also written alone, previews/rescue-<view>-<label>.png. The page
// (`pwa/src/tools/rescue-harness.ts`) ends a run INJURED at a spot down the
// piste, starts the next and draws it, posing the rescue's clock where a
// frame wants it — never on a wall clock, so a seed's sheet is the same
// sheet twice. This script builds it into a one-off bundle (never part of
// the app's build), serves it and drives it in a headless Chromium
// (`scripts/lib/sheet-driver.mjs`) — `CHROMIUM_PATH` overrides where one is
// looked for.
//
//   node scripts/rescue-preview.mjs                    # every sheet
//   node scripts/rescue-preview.mjs --sheet=carry,load
//   node scripts/rescue-preview.mjs --seed=12 --at=0.55 --hour=16

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
      help: "which sheets, comma-separated (site, scoop, carry, load, lift, pass, night, plane, arrive, second, knock, steal, sleds-arrive, sleds-scene, sleds-load, sleds-tow, sleds-night, sleds-stolen); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (overview, scoop, carry, carry-front, load, lift, pass, night, arrive, arrive-chase, second, knock, solid, steal, and each sleds-* sheet's own)",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    at: {
      kind: "number",
      default: 0.45,
      help: "where down the piste he fell, a share of its length",
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
    out: { kind: "string", default: "rescue", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/rescue-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--at=share] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

await shootSheets({
  root,
  page: "rescue-preview",
  api: "rescue",
  args,
  title: `rescue — seed ${args.seed}${args.region ? ` ${args.region}` : ""}`,
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
