// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS EVERY BUILD PACKS: every pair of skis' game-quality glTF as
// `models/<id>.glb`, the skier's as `models/skier.glb`, every kind of
// tree's as `models/trees/<kind>.glb`, every bird's and animal's as
// `models/birds/<id>.glb` and `models/beasts/<id>.glb`, and the course's
// marks as `models/gates/<id>.glb`, emitted into the bundle (so the
// service worker precaches them with everything else) and served the same
// way by the dev server. They are COMMITTED, in
// `pwa/models/`, made there by `make models` (Blender, off the game's own
// data — the `blender-assets` skill), with a stamp of the sources they were
// made from (`sources.json`), which `tests/models_test.ts` holds to the
// sources as they stand: a model older than its sources fails the suite.
// Each half is stamped apart (`TREE_SOURCES`, `BIRD_SOURCES`,
// `BEAST_SOURCES`, `GATE_SOURCES`), so a tree remade never asks for the
// skis to be, nor the other way round.
//
// A build switched back to a code-built half (`VITE_MODEL_SKIS=0`,
// `VITE_MODEL_SKIERS=0`, `VITE_MODEL_TREES=0`, `VITE_MODEL_BIRDS=0`,
// `VITE_MODEL_BEASTS=0`, `VITE_MODEL_GATES=0` — `src/game/model-switch.ts`)
// packs none of that side's files.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { SKI_CATALOG } from "../engine/game/defs/skis.ts";
import { TREE_KINDS } from "../engine/mapgen/regions.ts";
import { BEAST_IDS } from "./src/game/beast-defs.ts";
import { BIRD_IDS } from "./src/game/bird-defs.ts";
import { GATE_IDS } from "./src/game/gate-ids.ts";

export type ModelSwitches = {
  skis: boolean;
  skiers: boolean;
  trees: boolean;
  birds: boolean;
  beasts: boolean;
  gates: boolean;
};

/** Every switch on — what a build draws unless told otherwise. */
export const ALL_MODELS: ModelSwitches = {
  skis: true,
  skiers: true,
  trees: true,
  birds: true,
  beasts: true,
  gates: true,
};

/** Where the committed models are, from the repository's root. */
export const MODELS_DIR = "pwa/models";

/** Every file a build with these switches packs, by its published name. */
export function modelFiles(on: ModelSwitches): string[] {
  return [
    ...(on.skis ? SKI_CATALOG.map((s) => `${s.id}.glb`) : []),
    ...(on.skiers ? ["skier.glb"] : []),
    ...(on.trees ? TREE_KINDS.map((k) => `trees/${k}.glb`) : []),
    ...(on.birds ? BIRD_IDS.map((k) => `birds/${k}.glb`) : []),
    ...(on.beasts ? BEAST_IDS.map((k) => `beasts/${k}.glb`) : []),
    ...(on.gates ? GATE_IDS.map((k) => `gates/${k}.glb`) : []),
  ];
}

/** WHAT A MODEL IS MADE FROM: the Blender builders and their driver, and
 * the game's own data they read — the spec, the traced looks, the drawn
 * travel, the skier's pose, bones and clips, the helmet's measured shell.
 * A change to any of these can move a model; the stamp is their hash. */
export const MODEL_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/skis.mjs",
  "scripts/blender/kinds/skier.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/skis.py",
  "scripts/blender/skier.py",
  "engine/game/defs/skis.ts",
  "pwa/src/game/ski-looks.ts",
  "pwa/src/game/ski-gear.ts",
  "pwa/src/game/skier-pose.ts",
  "pwa/src/game/skier-gait.ts",
  "pwa/src/game/skier-spring.ts",
  "pwa/src/game/skier-helmet.ts",
  "pwa/src/game/skier-rig.ts",
];

/** WHAT A TREE IS MADE FROM: the builder, the shelf and the driver, the
 * variant rows it models, and the packer the published files go through. */
export const TREE_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/tree.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/static.py",
  "scripts/blender/tree.py",
  "scripts/lib/glb-pack.mjs",
  "pwa/src/game/tree-variants.ts",
];

/** The static shelf every wildlife and gate model stands on, and the
 * packer it ships through. */
const STATIC_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/static.py",
  "scripts/lib/glb-pack.mjs",
];

/** WHAT A BIRD IS MADE FROM: its builder and the roster's rows. */
export const BIRD_SOURCES = [
  ...STATIC_SOURCES,
  "scripts/blender/kinds/bird.mjs",
  "scripts/blender/bird.py",
  "pwa/src/game/bird-defs.ts",
];

/** WHAT AN ANIMAL IS MADE FROM: its builder, the roster's rows and the
 * styles that proportion it. */
export const BEAST_SOURCES = [
  ...STATIC_SOURCES,
  "scripts/blender/kinds/beast.mjs",
  "scripts/blender/beast.py",
  "pwa/src/game/beast-defs.ts",
  "pwa/src/game/beast-shapes.ts",
];

/** WHAT THE COURSE'S MARKS ARE MADE FROM: the builder and the plan. */
export const GATE_SOURCES = [
  ...STATIC_SOURCES,
  "scripts/blender/kinds/gate.mjs",
  "scripts/blender/gate.py",
  "pwa/src/game/start-arch.ts",
];

/** Every half's stamp in `sources.json`, and the sources it hashes. */
export const MODEL_HALVES = {
  sources: MODEL_SOURCES,
  trees: TREE_SOURCES,
  birds: BIRD_SOURCES,
  beasts: BEAST_SOURCES,
  gates: GATE_SOURCES,
} as const;
export type ModelHalf = keyof typeof MODEL_HALVES;

/** The sources' hash, from the repository's `root` (line endings as
 * committed: `\r` dropped, so a checkout's conversion moves nothing) — the
 * skis' and the skier's, or the trees' (`TREE_SOURCES`). */
export function sourcesHash(root: string, sources: readonly string[] = MODEL_SOURCES): string {
  const h = createHash("sha256");
  for (const f of sources) {
    h.update(`${f}\n`);
    h.update(readFileSync(join(root, f), "utf8").replaceAll("\r", ""));
  }
  return h.digest("hex");
}

export function skiModels(on: ModelSwitches, root: string): Plugin {
  const dir = join(root, MODELS_DIR);
  const files = modelFiles(on);
  return {
    name: "ski-models",
    buildStart() {
      const gone = files.filter((f) => !existsSync(join(dir, f)));
      if (gone.length) {
        this.error(
          `${gone.map((f) => `${MODELS_DIR}/${f}`).join(", ")} is missing — run \`make models\` ` +
            "(it needs Blender), or switch the build back to the code-built ones " +
            "(VITE_MODEL_SKIS=0 / VITE_MODEL_SKIERS=0 / VITE_MODEL_TREES=0)",
        );
      }
    },
    generateBundle() {
      for (const f of files) {
        this.emitFile({
          type: "asset",
          fileName: `models/${f}`,
          source: readFileSync(join(dir, f)),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = /\/models\/((?:trees\/|birds\/|beasts\/|gates\/)?[\w-]+\.glb)$/.exec(
          req.url ?? "",
        )?.[1];
        if (!name || !files.includes(name) || !existsSync(join(dir, name))) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(join(dir, name)));
      });
    },
  };
}
