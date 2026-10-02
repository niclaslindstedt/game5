// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SKIS, SKIERS, WILDLIFE AND MARKS the game ships
// (`pwa/models/`, made by `make models`, packed by `pwa/models-plugin.ts`,
// drawn by `skier-models.ts`, `bird-models.ts`,
// `beast-models.ts` and `gate-models.ts`): every one committed, none older
// than the sources it is made from, each within its budget; the switches
// on unless a build turns one back; and every material the Blender
// builders name dressed as the builder's own pair would be. The names are
// stated twice — in `scripts/blender/*.py`, which cannot import a module
// of the game, and in `dressOf` and the wildlife's — so the builders are
// read here as
// TEXT, the way `tauri_test.ts` reads the Rust.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { SKI_CATALOG } from "@engine";

import {
  ALL_MODELS,
  MODELS_DIR,
  MODEL_HALVES,
  modelFiles,
  sourcesHash,
} from "../pwa/models-plugin.ts";
import { BEAST_IDS } from "../pwa/src/game/beast-defs.ts";
import { BIRD_IDS } from "../pwa/src/game/bird-defs.ts";
import { GATE_IDS } from "../pwa/src/game/gate-ids.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import { dressOf } from "../pwa/src/game/skier-models.ts";
import { SKI_STYLES } from "../pwa/src/game/skis-body.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the models the game ships", () => {
  const all = modelFiles(ALL_MODELS);
  const none = {
    skis: false,
    skiers: false,
    birds: false,
    beasts: false,
    gates: false,
  };

  it("are every pair under its id, one skier, every bird, animal and mark", () => {
    expect([...all].sort()).toEqual(
      [
        ...SKI_CATALOG.map((s) => `${s.id}.glb`),
        "skier.glb",
        ...BIRD_IDS.map((k) => `birds/${k}.glb`),
        ...BEAST_IDS.map((k) => `beasts/${k}.glb`),
        ...GATE_IDS.map((k) => `gates/${k}.glb`),
      ].sort(),
    );
    expect(modelFiles({ ...none, skiers: true })).toEqual(["skier.glb"]);
    expect(modelFiles({ ...none, gates: true })).toEqual([
      "gates/checkpoint.glb",
      "gates/start-arch.glb",
    ]);
    expect(modelFiles(none)).toEqual([]);
  });

  it("are all committed, each within its budget", () => {
    for (const f of all) {
      const at = join(root, MODELS_DIR, f);
      expect(existsSync(at), `${MODELS_DIR}/${f} — run \`make models\``).toBe(true);
      // A pair's LOD0 is under 1 MB, the skier's ~1 MB (two dozen bones —
      // the half-angle helpers and the hands among them — and his baked
      // cloth), a bird or an animal (packed) a few KB, the arch ~40 KB: a
      // model grown past this is a builder that lost its game budget.
      const budget =
        f.startsWith("birds/") || f.startsWith("beasts/")
          ? 40_000
          : f.startsWith("gates/")
            ? 120_000
            : f === "skier.glb"
              ? 1_200_000
              : 1_600_000;
      expect(statSync(at).size, f).toBeLessThan(budget);
    }
  });

  it("are no older than the sources they are made from", () => {
    const stamp = JSON.parse(
      readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8"),
    ) as Record<string, string>;
    for (const [half, sources] of Object.entries(MODEL_HALVES)) {
      const set = half === "sources" ? "machines" : half;
      expect(
        stamp[half],
        `a source of the ${set} moved since they were made — run \`make models SET=${set}\` and commit pwa/models/`,
      ).toBe(sourcesHash(root, sources));
    }
    expect(sourcesHash(root)).toBe(sourcesHash(root, MODEL_HALVES.sources));
  });
});

describe("the model switches", () => {
  it("are on unless a build turns one back", () => {
    for (const on of [undefined, "", "1", "on", "true", "yes"]) expect(modelSwitch(on)).toBe(true);
    for (const off of ["0", "off", "OFF", "false", "no", " 0 "])
      expect(modelSwitch(off)).toBe(false);
  });
});

describe("a model's dress", () => {
  const style = SKI_STYLES[1];

  it("reads every name it dresses off the builders' own materials", () => {
    const skis = new Set(matNames("skis.py"));
    const skier = new Set(matNames("skier.py"));
    for (const n of ["paint", "white", "panel", "boot", "base"]) {
      expect(skis.has(n), `skis.py names "${n}"`).toBe(true);
    }
    for (const n of ["jacket", "accent", "pants", "helmet", "peak", "lens"]) {
      expect(skier.has(n), `skier.py names "${n}"`).toBe(true);
    }
  });

  it("paints a pair in its style", () => {
    expect(dressOf("paint", style, null)).toEqual({ colour: style.body });
    expect(dressOf("white", style, null)).toEqual({ colour: style.accent });
    expect(dressOf("panel", { ...style, panel: 0x123456 }, null)).toEqual({ colour: 0x123456 });
    expect(dressOf("pole", style, null)).toEqual({ colour: 0x9aa1a9 });
    expect(dressOf("base", style, null)).toBeNull();
  });

  it("dresses a skier in the slot's kit", () => {
    const kit = style.skier;
    expect(dressOf("jacket", null, kit)).toEqual({ colour: kit.jacket });
    expect(dressOf("pants", null, kit)).toEqual({ colour: kit.pants });
    expect(dressOf("helmet", null, kit)).toEqual({ colour: kit.helmet });
    expect(dressOf("lens", null, kit)).toEqual({ colour: kit.visor });
    expect(dressOf("paint", null, kit)).toBeNull();
  });
});
