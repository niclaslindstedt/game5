// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS EVERY BUILD PACKS: every pair of skis' game-quality glTF as
// `models/<id>.glb`, emitted into the
// bundle (so the service worker precaches them with everything else) and
// served the same way by the dev server. They are COMMITTED, in
// `pwa/models/`, made there by `make models` (Blender, off the game's own
// data — the `blender-assets` skill), with a stamp of the sources they were
// made from (`sources.json`), which `tests/models_test.ts` holds to the
// sources as they stand: a model older than its sources fails the suite.
// Nothing else the game draws is a model: the skier is dressed in code
// (`src/game/skier-dress.ts`, his outfit cut on the rig), and the trees,
// the birds, the animals and the course's marks are built in code,
// procedurally (`src/game/tree-shapes.ts`, `bird-shapes.ts`,
// `beast-shapes.ts`, `mark-shapes.ts`).
//
// A build switched back to the code-built skis (`VITE_MODEL_SKIS=0` —
// `src/game/model-switch.ts`) packs none of them.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { SKI_CATALOG } from "../engine/game/defs/skis.ts";

export type ModelSwitches = { skis: boolean };

/** Every switch on — what a build draws unless told otherwise. */
export const ALL_MODELS: ModelSwitches = { skis: true };

/** Where the committed models are, from the repository's root. */
export const MODELS_DIR = "pwa/models";

/** Every file a build with these switches packs, by its published name. */
export function modelFiles(on: ModelSwitches): string[] {
  return on.skis ? SKI_CATALOG.map((s) => `${s.id}.glb`) : [];
}

/** WHAT A MODEL IS MADE FROM: the Blender builder and its driver, and the
 * game's own data it reads — the spec, the traced looks, the drawn travel,
 * each pair's topsheet graphic.
 * A change to any of these can move a model; the stamp is their hash. */
export const MODEL_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/skis.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/skis.py",
  "engine/game/defs/skis.ts",
  "pwa/src/game/ski-looks.ts",
  "pwa/src/game/ski-gear.ts",
  "pwa/src/game/ski-topsheets.ts",
];

/** Every half's stamp in `sources.json`, and the sources it hashes — one
 * half today, the skis. */
export const MODEL_HALVES = { sources: MODEL_SOURCES } as const;
export type ModelHalf = keyof typeof MODEL_HALVES;

/** The sources' hash, from the repository's `root` (line endings as
 * committed: `\r` dropped, so a checkout's conversion moves nothing). */
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
            "(VITE_MODEL_SKIS=0)",
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
        const name = /\/models\/([\w-]+\.glb)$/.exec(req.url ?? "")?.[1];
        if (!name || !files.includes(name) || !existsSync(join(dir, name))) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(join(dir, name)));
      });
    },
  };
}
