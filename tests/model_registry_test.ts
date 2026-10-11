// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODEL REGISTRY (`pwa/src/game/model-registry.ts`) against the tree:
// its Blender rows are EXACTLY the files the build packs, every path it
// names exists, every Blender row's switch is one the game reads, and
// `docs/models.md` carries its table as `make model-registry` writes it.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_MODELS, MODELS_DIR, modelFiles } from "../pwa/models-plugin.ts";
import {
  MODEL_REGISTRY,
  registryTableIn,
  renderModelRegistry,
  sameTable,
} from "../pwa/src/game/model-registry.ts";

const root = join(import.meta.dirname, "..");
const read = (f: string): string => readFileSync(join(root, f), "utf8");

describe("the model registry", () => {
  it("names every asset once, each with ids", () => {
    const assets = MODEL_REGISTRY.map((r) => r.asset);
    expect(new Set(assets).size).toBe(assets.length);
    for (const r of MODEL_REGISTRY) {
      expect(r.ids.length, r.asset).toBeGreaterThan(0);
      expect(new Set(r.ids).size, r.asset).toBe(r.ids.length);
      expect(r.source === "blender", r.asset).toBe(!!r.blender);
    }
  });

  it("lists as Blender models exactly the files the build ships", () => {
    const listed = MODEL_REGISTRY.flatMap((r) => r.blender?.files ?? []);
    const shipped = modelFiles(ALL_MODELS);
    expect([...listed].sort()).toEqual([...shipped].sort());
    for (const f of listed) {
      expect(existsSync(join(root, MODELS_DIR, f)), `${MODELS_DIR}/${f}`).toBe(true);
    }
  });

  it("points at code, builders and drawers that exist", () => {
    for (const r of MODEL_REGISTRY) {
      for (const f of [...r.code, r.drawnBy, ...(r.blender ? [r.blender.builder] : [])]) {
        expect(existsSync(join(root, f)), `${r.asset}: ${f}`).toBe(true);
      }
    }
  });

  it("names only switches the game reads", () => {
    const readers = read("pwa/src/game/skier-models.ts");
    for (const r of MODEL_REGISTRY) {
      if (r.blender) expect(readers, r.asset).toContain(`ENV.${r.blender.switch}`);
    }
  });

  it("keeps only the skis and the machines as models — the skier is dressed in code, the rest built in it", () => {
    const modelled = MODEL_REGISTRY.filter((r) => r.source === "blender").map((r) => r.asset);
    expect(modelled).toEqual([
      "Skis",
      "Helicopter",
      "Air ambulance",
      "Snowmobile",
      "Piste machine",
      "Jump plane",
    ]);
  });

  it("is the table docs/models.md carries — `make model-registry` rewrites it", () => {
    const table = registryTableIn(read("docs/models.md"));
    expect(sameTable(table, renderModelRegistry()), "run `make model-registry`").toBe(true);
  });
});
