#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every pair and the
// skier). Copies each pair's and the skier's LOD0 glTF out of the
// gitignored `previews/blender/` into the committed `pwa/models/` under the
// name the build packs it by (`<id>.glb`, `skier.glb`), and writes
// `pwa/models/sources.json` — the hash of every source they are made from
// (`MODEL_HALVES` in `pwa/models-plugin.ts`), which `tests/models_test.ts`
// holds to the tree. (Nothing else is a model: the trees, the wildlife and
// the course's marks are built in code — `pwa/src/game/tree-shapes.ts`,
// `bird-shapes.ts`, `beast-shapes.ts`, `mark-shapes.ts`.)
//
//   node scripts/models.mjs                  publish what `make blender` made
//   node scripts/models.mjs --check          only say whether the stamp is fresh

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import {
  ALL_MODELS,
  MODELS_DIR,
  MODEL_HALVES,
  modelFiles,
  sourcesHash,
} from "../pwa/models-plugin.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    check: { kind: "flag", help: "only report whether pwa/models/ is fresh against its sources" },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  "usage: node scripts/models.mjs [--check] [--from=previews/blender]",
);

const out = join(root, MODELS_DIR);
const stampAt = join(out, "sources.json");
const hashes = Object.fromEntries(
  Object.entries(MODEL_HALVES).map(([half, sources]) => [half, sourcesHash(root, sources)]),
);
const had = existsSync(stampAt) ? JSON.parse(readFileSync(stampAt, "utf8")) : {};

if (args.check) {
  const stale = Object.keys(hashes).filter((k) => had[k] !== hashes[k]);
  console.log(
    stale.length === 0 ? "pwa/models/ is fresh" : "pwa/models/ is STALE — run `make models`",
  );
  process.exit(stale.length === 0 ? 0 : 1);
}

/** Each published name and the file `make blender` wrote it as: a pair's
 * or the skier's LOD0. */
const made = (name) =>
  join(
    root,
    args.from,
    name === "skier.glb" ? "skier0-lod0.glb" : name.replace(".glb", "-lod0.glb"),
  );
const names = modelFiles(ALL_MODELS);
const missing = names.filter((n) => !existsSync(made(n)));
if (missing.length) {
  console.error(
    `not made: ${missing.map(made).join(", ")} — run make blender's game quality first`,
  );
  process.exit(1);
}
for (const n of names) {
  copyFileSync(made(n), join(out, n));
  console.log(
    `${MODELS_DIR}/${n}  ${(readFileSync(join(out, n)).byteLength / 1024).toFixed(0)} KiB`,
  );
}
const stamp = { ...hashes, blender: "4.2.0" };
writeFileSync(stampAt, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`${MODELS_DIR}/sources.json  ${stamp.sources.slice(0, 12)}`);
