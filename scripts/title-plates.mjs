#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S PLATES, published: the last step of `make title-scene`
// (which renders the scene, `scripts/blender.mjs --kind=title`, the game's
// dressed skier written for it by `scripts/dressed-skier.mjs`). Copies the colour plate, the aux
// plate and the frame's JSON out of the gitignored `previews/blender/` into
// the committed `pwa/src/title/`, checks each against its budget
// (`TITLE_PLATES`), and writes `pwa/src/title/sources.json` — the hash of
// every source the scene is made from (`TITLE_SOURCES`), the stamp
// `tests/title_scene_test.ts` holds to the tree.
//
//   node scripts/title-plates.mjs            publish what the render made
//   node scripts/title-plates.mjs --check    only say whether the stamp is fresh

import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { sourcesHash } from "../pwa/models-plugin.ts";
import { TITLE_DIR, TITLE_PLATES, TITLE_SOURCES } from "../pwa/src/title/plates.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    check: {
      kind: "flag",
      help: "only report whether pwa/src/title/ is fresh against its sources",
    },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where the render left the plates",
    },
  },
  "usage: node scripts/title-plates.mjs [--check] [--from=previews/blender]",
);

const out = join(root, TITLE_DIR);
const stampAt = join(out, "sources.json");
const hash = sourcesHash(root, TITLE_SOURCES);

if (args.check) {
  const had = existsSync(stampAt) ? JSON.parse(readFileSync(stampAt, "utf8")).sources : undefined;
  const fresh = had === hash;
  console.log(fresh ? `${TITLE_DIR} is fresh` : `${TITLE_DIR} is STALE — run \`make title-scene\``);
  process.exit(fresh ? 0 : 1);
}

const files = [...Object.keys(TITLE_PLATES), "title-plate.json"];
const missing = files.filter((f) => !existsSync(join(root, args.from, f)));
if (missing.length) {
  console.error(`not made: ${missing.join(", ")} — run make blender KIND=title first`);
  process.exit(1);
}
let over = false;
for (const f of files) {
  const from = join(root, args.from, f);
  const bytes = statSync(from).size;
  const budget = TITLE_PLATES[f]?.budget;
  if (budget !== undefined && bytes > budget) {
    console.error(`${f} is ${(bytes / 1024).toFixed(0)} KiB, over its ${budget / 1024} KiB`);
    over = true;
    continue;
  }
  copyFileSync(from, join(out, f));
  console.log(`${TITLE_DIR}/${f}  ${(bytes / 1024).toFixed(0)} KiB`);
}
if (over) process.exit(1);
writeFileSync(stampAt, `${JSON.stringify({ sources: hash }, null, 2)}\n`);
console.log(`${TITLE_DIR}/sources.json  ${hash.slice(0, 12)}`);
