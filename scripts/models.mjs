#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every pair, the
// skier, every kind of tree, every bird and animal, and the course's
// marks). Copies each pair's and the skier's LOD0 glTF out of the
// gitignored `previews/blender/` into the committed `pwa/models/` under the
// name the build packs it by (`<id>.glb`, `skier.glb`), PACKS every static
// model's (`scripts/lib/glb-pack.mjs`: quantized and meshopt-compressed)
// into `pwa/models/trees/<kind>.glb`, `birds/<id>.glb`, `beasts/<id>.glb`
// and `gates/<id>.glb`, and writes `pwa/models/sources.json` — the hash of
// every source each half is made from (`MODEL_HALVES` in
// `pwa/models-plugin.ts`), which `tests/models_test.ts` holds to the tree.
// A half not published keeps its stamp: it was not remade.
//
//   node scripts/models.mjs                  publish what `make blender` made
//   node scripts/models.mjs --set=trees      one half only (machines: the skis and the skier; trees, birds, beasts, gates)
//   node scripts/models.mjs --check          only say whether the stamps are fresh

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { packGlb } from "./lib/glb-pack.mjs";
import { MODELS_DIR, MODEL_HALVES, modelFiles, sourcesHash } from "../pwa/models-plugin.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    check: { kind: "flag", help: "only report whether pwa/models/ is fresh against its sources" },
    set: {
      kind: "string",
      default: "all",
      help: "which half to publish: machines (the skis and the skier), trees, birds, beasts, gates, or all",
    },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  "usage: node scripts/models.mjs [--check] [--set=all|machines|trees|birds|beasts|gates] [--from=previews/blender]",
);
/** The halves, by the name `--set` calls each and its stamp. */
const HALVES = {
  machines: "sources",
  trees: "trees",
  birds: "birds",
  beasts: "beasts",
  gates: "gates",
};
if (args.set !== "all" && !(args.set in HALVES)) {
  console.error(`unknown set "${args.set}" (all, ${Object.keys(HALVES).join(", ")})`);
  process.exit(2);
}

const out = join(root, MODELS_DIR);
const stampAt = join(out, "sources.json");
const hashes = Object.fromEntries(
  Object.entries(MODEL_HALVES).map(([half, sources]) => [half, sourcesHash(root, sources)]),
);
const had = existsSync(stampAt) ? JSON.parse(readFileSync(stampAt, "utf8")) : {};

if (args.check) {
  const stale = Object.keys(hashes).filter((k) => had[k] !== hashes[k]);
  console.log(
    stale.length === 0
      ? "pwa/models/ is fresh"
      : `pwa/models/ is STALE (${stale.join(", ")}) — run \`make models\``,
  );
  process.exit(stale.length === 0 ? 0 : 1);
}

const on = (half) => args.set === "all" || args.set === half;
const machines = on("machines");
/** Each published name and the file `make blender` wrote it as: a pair's
 * or the skier's LOD0, a static model under its own name. */
const made = (name) =>
  join(
    root,
    args.from,
    name === "skier.glb"
      ? "skier0-lod0.glb"
      : name.includes("/")
        ? name.slice(name.indexOf("/") + 1)
        : name.replace(".glb", "-lod0.glb"),
  );
const names = modelFiles({
  skis: machines,
  skiers: machines,
  trees: on("trees"),
  birds: on("birds"),
  beasts: on("beasts"),
  gates: on("gates"),
});
const missing = names.filter((n) => !existsSync(made(n)));
if (missing.length) {
  console.error(
    `not made: ${missing.map(made).join(", ")} — run make blender's game quality first`,
  );
  process.exit(1);
}
for (const dir of ["trees", "birds", "beasts", "gates"])
  mkdirSync(join(out, dir), { recursive: true });
for (const n of names) {
  if (n.includes("/")) {
    writeFileSync(join(out, n), await packGlb(readFileSync(made(n))));
  } else {
    copyFileSync(made(n), join(out, n));
  }
  console.log(
    `${MODELS_DIR}/${n}  ${(readFileSync(join(out, n)).byteLength / 1024).toFixed(0)} KiB`,
  );
}
const stamp = Object.fromEntries(
  Object.entries(HALVES).map(([half, key]) => [key, on(half) ? hashes[key] : had[key]]),
);
stamp.blender = "4.2.0";
writeFileSync(stampAt, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(
  `${MODELS_DIR}/sources.json  ${Object.entries(HALVES)
    .map(([half, key]) => `${half} ${stamp[key]?.slice(0, 12)}`)
    .join(" · ")}`,
);
