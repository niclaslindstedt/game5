#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLENDER LAB — a game asset MODELLED in Blender off the game's own
// data, for the day the game ships authored assets (a desktop build, say):
// `previews/blender/<id>-*.png` (studio renders), `<id>-lod{0,1,2}.glb` (the
// game budget) and the `.blend` files to open by hand.
//
// It never restates the game: it hands Blender the SAME numbers the game's
// builder reads, as one JSON file, and a builder under `scripts/blender/`
// models the asset from them in the data's own frame. A modelled pair, so,
// stands on the physics' ski line and belt run to the centimetre, and
// `make skis ARGS=--asset=…` sets it beside the builder's. Nothing it
// writes is committed: the game ships no asset files, and every output
// lands in the gitignored `previews/`. The `blender-assets` skill owns the
// loop, and says how a new KIND is added: a data module under
// `scripts/blender/kinds/` and a builder beside `skis.py`. The kinds today:
// the skis and the skier (rigged, with clips), every kind of tree, every
// bird and every animal of the wildlife, and the course's marks (the
// checkpoint and the start arch) — the last four static, dressed by the
// game off their materials' names.
//
//   node scripts/blender.mjs                                the Chamois, both qualities
//   node scripts/blender.mjs --id=eagle --quality=game
//   node scripts/blender.mjs --id=all --quality=game   every pair, one after another
//   node scripts/blender.mjs --quality=render --views=three,side --samples=32
//   node scripts/blender.mjs --kind=bird --id=raven
//   node scripts/blender.mjs --kind=beast --id=all --quality=game --views=none
//
// Blender is looked for at `BLENDER`, then the macOS app, then `blender` on
// the PATH — and failing all of those, the `bpy` module through
// `scripts/bpy-blender.sh`, which runs a builder the same way; `blender` on
// the PATH. It is run with `--python-use-system-env` and
// `PYTHONDONTWRITEBYTECODE=1`: an app copied without its files' times has
// stale bytecode, and on macOS the rewrite inside the signed bundle blocks
// Python's start for ever.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITIES = ["render", "game"];

/** THE KINDS OF ASSET, each a module under `scripts/blender/kinds/`: what
 * the game's data for one is (`data`), every id (`ids`), its builder and
 * its default. A kind added there is a kind here; the driver names none. */
const KINDS = Object.fromEntries(
  await Promise.all(
    readdirSync(join(root, "scripts", "blender", "kinds"))
      .filter((f) => f.endsWith(".mjs"))
      .sort()
      .map(async (f) => [f.slice(0, -4), (await import(`./blender/kinds/${f}`)).kind]),
  ),
);

const args = parseArgs(
  process.argv.slice(2),
  {
    kind: {
      kind: "string",
      default: "skis",
      help: `the kind of asset (${Object.keys(KINDS).join(", ")})`,
    },
    id: {
      kind: "string",
      default: "",
      help: "which one (a pair's id, a kind of tree, a bird…), or all; the kind's default when left out",
    },
    quality: {
      kind: "string",
      default: "both",
      help: "render (studio stills, subdivided), game (the triangle budget and its LODs), or both",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these cameras (side,three,rear3,chase,detail), or none; every one when left out",
    },
    samples: { kind: "number", default: 64, help: "Cycles samples a still" },
    out: { kind: "string", default: "previews/blender", help: "where everything is written" },
  },
  "usage: node scripts/blender.mjs [--kind=skis] [--id=chamois] [--quality=render|game|both] [--views=a,b] [--samples=n]",
);

const kind = KINDS[args.kind];
if (!kind) {
  console.error(`unknown kind "${args.kind}" (${Object.keys(KINDS).join(", ")})`);
  process.exit(2);
}
const qualities = args.quality === "both" ? QUALITIES : [args.quality];
if (!qualities.every((q) => QUALITIES.includes(q))) {
  console.error(`unknown quality "${args.quality}" (render, game, both)`);
  process.exit(2);
}

aliasEngine(root);
const ids = await kind.ids();
const wanted = args.id === "all" ? ids : [args.id || kind.fallback];
const unknown = wanted.find((id) => !ids.includes(id));
if (unknown) {
  console.error(`unknown ${args.kind} "${unknown}" (${ids.join(", ")}, all)`);
  process.exit(2);
}

const outDir = join(root, args.out);
mkdirSync(outDir, { recursive: true });

const onPath = (process.env.PATH ?? "")
  .split(":")
  .some((dir) => dir && existsSync(join(dir, "blender")));
const blender =
  [process.env.BLENDER, "/Applications/Blender.app/Contents/MacOS/Blender"].find(
    (c) => c && existsSync(c),
  ) ?? (onPath ? "blender" : join(root, "scripts", "bpy-blender.sh"));

for (const id of wanted) {
  const data = join(outDir, `${id}.json`);
  writeFileSync(data, JSON.stringify(await kind.data(id), null, 2));
  for (const quality of qualities) await model(id, data, quality);
}

/** One builder pass over one asset at one quality; a Python error ends the run. */
async function model(id, data, quality) {
  const t0 = Date.now();
  const code = await new Promise((done) => {
    const child = spawn(
      blender,
      [
        "-b",
        "--factory-startup",
        "--python-use-system-env",
        "--python-exit-code",
        "1",
        "-P",
        join(root, "scripts", "blender", kind.builder),
        "--",
        data,
        outDir,
        String(args.samples),
      ],
      {
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", QUALITY: quality, VIEWS: args.views },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.on("error", (err) => {
      console.error(`no Blender (${err.message}): install it, or point BLENDER at its executable`);
      done(1);
    });
    // Blender is loud; what is worth a line is what the builder prints,
    // what was saved, and anything that went wrong.
    // A line can straddle two chunks, so each stream keeps its unfinished
    // tail until the rest arrives.
    const tails = new Map();
    const echo = (buf, from) => {
      const lines = ((tails.get(from) ?? "") + buf.toString()).split("\n");
      tails.set(from, lines.pop());
      for (const line of lines) {
        if (/^(BONES|CLIPS|TRIANGLES)|Saved: '|Error|Traceback|File "/.test(line)) {
          console.log(line.replace(/^.*Saved: '(.*)'.*$/, "saved $1").replace(`${root}/`, ""));
        }
      }
    };
    child.stdout.on("data", (b) => echo(b, "out"));
    child.stderr.on("data", (b) => echo(b, "err"));
    child.on("close", (code) => {
      for (const from of ["out", "err"]) echo("\n", from);
      done(code);
    });
  });
  if (code !== 0) {
    console.error(`blender exited ${code} on the ${quality} pass`);
    process.exit(1);
  }
  console.log(`${args.kind} ${id} · ${quality}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
