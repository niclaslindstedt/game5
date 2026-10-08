// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS EVERY BUILD PACKS: every pair of skis' game-quality glTF as
// `models/<id>.glb`, the heli-ski helicopter's as `models/heli.glb` (and
// its air ambulance's as `models/rescue.glb`, under the same switch), the
// mountain snowmobile's as `models/sled.glb` and the night's piste machine's
// as `models/groomer.glb`,
// emitted into the
// bundle (so the service worker precaches them with everything else) and
// served the same way by the dev server. They are COMMITTED, in
// `pwa/models/`, made there by `make models` (Blender, off the game's own
// data — the `blender-assets` skill), with a stamp of the sources they were
// made from (`sources.json`), which `tests/models_test.ts` holds to the
// sources as they stand: a model older than its sources fails the suite.
// Each KIND is stamped apart (`MODEL_HALVES`), so a change to the
// helicopter's sources asks for the helicopter alone to be made again.
// Nothing else the game draws is a model: the skier is dressed in code
// (`src/game/skier-dress.ts`, his outfit cut on the rig), and the trees,
// the birds, the animals and the course's marks are built in code,
// procedurally (`src/game/tree-shapes.ts`, `bird-shapes.ts`,
// `beast-shapes.ts`, `mark-shapes.ts`).
//
// A build switched back to the code-built skis (`VITE_MODEL_SKIS=0` —
// `src/game/model-switch.ts`) packs none of them; `VITE_MODEL_HELI=0` packs
// no helicopter and no air ambulance (`src/game/heli-view.ts` draws its code-built stand-in) and
// `VITE_MODEL_SLED=0` no snowmobile (`src/game/sled-view.ts`'s stand-in)
// and `VITE_MODEL_GROOMER=0` no piste machine (`src/game/groomer-build.ts`).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { SKI_CATALOG } from "../engine/game/defs/skis.ts";

export type ModelSwitches = { skis: boolean; heli: boolean; sled: boolean; groomer: boolean };

/** Every switch on — what a build draws unless told otherwise. */
export const ALL_MODELS: ModelSwitches = { skis: true, heli: true, sled: true, groomer: true };

/** Where the committed models are, from the repository's root. */
export const MODELS_DIR = "pwa/models";

/** The helicopter's one file (`make blender KIND=heli`'s LOD0). */
export const HELI_FILE = "heli.glb";

/** The air ambulance's one file (`make blender KIND=rescue`'s LOD0): the
 * heli's airframe in a mountain rescue service's dress, packed under the
 * heli's switch. */
export const RESCUE_FILE = "rescue.glb";

/** The snowmobile's one file (`make blender KIND=sled`'s LOD0). */
export const SLED_FILE = "sled.glb";

/** The piste machine's one file (`make blender KIND=groomer`'s LOD0). */
export const GROOMER_FILE = "groomer.glb";

/** Every file a build with these switches packs, by its published name —
 * or only one half's (`MODEL_HALVES`). */
export function modelFiles(on: ModelSwitches, half?: ModelHalf): string[] {
  const skis =
    on.skis && (!half || half === "sources") ? SKI_CATALOG.map((s) => `${s.id}.glb`) : [];
  return [
    ...skis,
    ...(on.heli && (!half || half === "heli") ? [HELI_FILE] : []),
    ...(on.heli && (!half || half === "rescue") ? [RESCUE_FILE] : []),
    ...(on.sled && (!half || half === "sled") ? [SLED_FILE] : []),
    ...(on.groomer && (!half || half === "groomer") ? [GROOMER_FILE] : []),
  ];
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

/** WHAT THE HELICOPTER IS MADE FROM: its builder, its data module, the
 * shelf and the driver, and `HELI` — the table the engine flies and the
 * builder reads every dimension off. */
export const HELI_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/heli.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/heli.py",
  "engine/game/defs/heli.ts",
];

/** WHAT THE AIR AMBULANCE IS MADE FROM: the heli's sources (its builder is
 * run whole) and the rescue builder and data module that dress it. */
export const RESCUE_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/rescue.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/heli.py",
  "scripts/blender/rescue.py",
  "engine/game/defs/heli.ts",
];

/** WHAT THE SNOWMOBILE IS MADE FROM: its builder, its data module, the
 * shelf and the driver, `SLED` and the class's traced look. */
export const SLED_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/sled.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/sled.py",
  "engine/game/defs/sled.ts",
  "pwa/src/game/sled-look.ts",
];

/** WHAT THE PISTE MACHINE IS MADE FROM: its builder, its data module, the
 * shelf and the driver, `GROOMER` and the class's layout it is drawn to. */
export const GROOMER_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/kinds/groomer.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/groomer.py",
  "engine/game/defs/groomer.ts",
  "pwa/src/game/groomer-look.ts",
];

/** Every half's stamp in `sources.json`, and the sources it hashes: the
 * skis (`sources`, its name from when they were the only models), the
 * helicopter (`heli`), the air ambulance (`rescue`), the snowmobile (`sled`) and the piste machine
 * (`groomer`). */
export const MODEL_HALVES = {
  sources: MODEL_SOURCES,
  heli: HELI_SOURCES,
  rescue: RESCUE_SOURCES,
  sled: SLED_SOURCES,
  groomer: GROOMER_SOURCES,
} as const;
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

export function gameModels(on: ModelSwitches, root: string): Plugin {
  const dir = join(root, MODELS_DIR);
  const files = modelFiles(on);
  return {
    name: "game-models",
    buildStart() {
      const gone = files.filter((f) => !existsSync(join(dir, f)));
      if (gone.length) {
        this.error(
          `${gone.map((f) => `${MODELS_DIR}/${f}`).join(", ")} is missing — run \`make models\` ` +
            "(it needs Blender), or switch the build back to the code-built ones " +
            "(VITE_MODEL_SKIS=0, VITE_MODEL_HELI=0, VITE_MODEL_SLED=0, VITE_MODEL_GROOMER=0)",
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
