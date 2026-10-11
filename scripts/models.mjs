#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every pair, the
// helicopter and its air ambulance, the snowmobile and the piste machine). Copies each LOD0 glTF out of the gitignored
// `previews/blender/` into the committed `pwa/models/` under the name the
// build packs it by (`<id>.glb`, `heli.glb`, `rescue.glb`), and writes
// `pwa/models/sources.json` — the hash of every source they are made from,
// a stamp a kind (`MODEL_HALVES` in `pwa/models-plugin.ts`), which
// `tests/models_test.ts` holds to the tree. `--kind` publishes one kind and
// leaves the other's files and stamp as they were. (Nothing else is a model: the skier is dressed in code
// — `pwa/src/game/skier-dress.ts` — and the trees, the wildlife and the
// course's marks are built in code — `tree-shapes.ts`, `bird-shapes.ts`,
// `beast-shapes.ts`, `mark-shapes.ts`.)
//
//   node scripts/models.mjs                  publish what `make blender` made
//   node scripts/models.mjs --kind=heli      publish the helicopter alone
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
    kind: {
      kind: "string",
      default: "all",
      help: "publish only this kind (skis, heli, rescue, sled, groomer, plane) — the others' files and stamps are kept",
    },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  "usage: node scripts/models.mjs [--check] [--kind=all|skis|heli|rescue|sled|groomer|plane] [--from=previews/blender]",
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

/** Which stamp a kind is (`MODEL_HALVES`): the skis' predates the split. */
const HALF_OF = {
  skis: "sources",
  heli: "heli",
  rescue: "rescue",
  sled: "sled",
  groomer: "groomer",
  plane: "plane",
};
if (args.kind !== "all" && !HALF_OF[args.kind]) {
  console.error(`unknown kind "${args.kind}" (all, ${Object.keys(HALF_OF).join(", ")})`);
  process.exit(2);
}
const half = args.kind === "all" ? undefined : HALF_OF[args.kind];

/** Each published name and the file `make blender` wrote it as: its LOD0. */
const made = (name) => join(root, args.from, name.replace(".glb", "-lod0.glb"));
const names = modelFiles(ALL_MODELS, half);
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
const fresh = half ? { [half]: hashes[half] } : hashes;
const stamp = { ...had, ...fresh, blender: "4.2.0" };
writeFileSync(stampAt, `${JSON.stringify(stamp, null, 2)}\n`);
for (const k of Object.keys(fresh))
  console.log(`${MODELS_DIR}/sources.json  ${k} ${fresh[k].slice(0, 12)}`);
