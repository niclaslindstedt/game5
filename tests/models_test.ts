// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SKIS AND HELICOPTER the game ships (`pwa/models/`, made by
// `make models`, packed by `pwa/models-plugin.ts`, the skis drawn by
// `skier-models.ts`, the helicopter by `heli-view.ts`): every one
// committed, none older than the sources it is made from, each within its
// budget; the switch on unless a build turns it back; and every material
// the Blender builders name dressed as the builder's own pair would be —
// and a modelled skier (the labs' comparison, `make blender KIND=skier`)
// in an outfit's colours. The names are stated twice — in
// `scripts/blender/*.py`, which cannot import a module of the game, and in
// `dressOf` — so the builders are read here as TEXT, the way
// `tauri_test.ts` reads the Rust. The helicopter's nodes and materials are
// read the same way off `heli.py` and held to the names its drawer is told
// (`HELI_NODES`) and to what its glTF carries. Nothing else is a model: the
// skier is dressed in code, the wildlife and the course's marks are built
// in code, and `pwa/models/` holds nothing of theirs.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { HELI, SKI_CATALOG } from "@engine";

import {
  ALL_MODELS,
  MODELS_DIR,
  MODEL_HALVES,
  modelFiles,
  sourcesHash,
} from "../pwa/models-plugin.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import { dressOf, HELI_NODES, heliModelUrl } from "../pwa/src/game/skier-models.ts";
import { coloursOf, RIVAL_OUTFITS } from "../pwa/src/game/outfit.ts";
import { pairStyle } from "../pwa/src/game/skis-body.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the models the game ships", () => {
  const all = modelFiles(ALL_MODELS);

  it("are every pair under its id, and the helicopter", () => {
    expect([...all].sort()).toEqual([...SKI_CATALOG.map((s) => `${s.id}.glb`), "heli.glb"].sort());
    expect(modelFiles({ skis: false, heli: true })).toEqual(["heli.glb"]);
    expect(modelFiles({ skis: true, heli: false })).toEqual(SKI_CATALOG.map((s) => `${s.id}.glb`));
    expect(modelFiles({ skis: false, heli: false })).toEqual([]);
    expect(modelFiles(ALL_MODELS, "heli")).toEqual(["heli.glb"]);
    expect(modelFiles(ALL_MODELS, "sources")).toHaveLength(SKI_CATALOG.length);
  });

  it("are nothing but the skis and the helicopter — the skier is dressed in code", () => {
    expect(existsSync(join(root, MODELS_DIR, "skier.glb"))).toBe(false);
    for (const dir of ["birds", "beasts", "gates"]) {
      expect(existsSync(join(root, MODELS_DIR, dir)), `${MODELS_DIR}/${dir}`).toBe(false);
    }
    const stamp = JSON.parse(
      readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8"),
    ) as object;
    expect(Object.keys(stamp).sort()).toEqual(["blender", "heli", "sources"]);
  });

  it("are all committed, each within its budget", () => {
    for (const f of all) {
      const at = join(root, MODELS_DIR, f);
      expect(existsSync(at), `${MODELS_DIR}/${f} — run \`make models\``).toBe(true);
      // A pair's LOD0, and the helicopter's, is well under 1.6 MB: a model
      // grown past this is a builder that lost its game budget.
      expect(statSync(at).size, f).toBeLessThan(1_600_000);
    }
  });

  it("are no older than the sources they are made from", () => {
    const stamp = JSON.parse(
      readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8"),
    ) as Record<string, string>;
    for (const [half, sources] of Object.entries(MODEL_HALVES)) {
      expect(
        stamp[half],
        `a source of the ${half === "heli" ? "helicopter" : "skis"} moved since it was made — run \`make models${half === "heli" ? " KIND=heli" : ""}\` and commit pwa/models/`,
      ).toBe(sourcesHash(root, sources));
    }
    expect(sourcesHash(root)).toBe(sourcesHash(root, MODEL_HALVES.sources));
  });
});

describe("the helicopter model", () => {
  const glb = readFileSync(join(root, MODELS_DIR, "heli.glb"));
  // A GLB's first chunk is its JSON: the nodes, the meshes, the materials.
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
    nodes: { name: string; translation?: number[]; mesh?: number; children?: number[] }[];
    materials: { name: string }[];
    meshes: { primitives: { indices: number }[] }[];
    accessors: { count: number }[];
  };
  const node = (name: string) => gltf.nodes.find((n) => n.name === name);
  const builder = readFileSync(join(root, "scripts", "blender", "heli.py"), "utf8");

  it("carries the three nodes its drawer is told of, each a rigid mesh", () => {
    for (const name of Object.values(HELI_NODES)) {
      expect(builder, `heli.py names ${name}`).toContain(`"${name}"`);
      expect(node(name)?.mesh, name).toBeTypeOf("number");
    }
    expect(heliModelUrl()).toBe("/models/heli.glb");
  });

  it("hangs each rotor at its hub, as HELI has it (glTF: y up, the nose on -z)", () => {
    const v = (n: number[] | undefined) => (n ?? [0, 0, 0]).map((x) => Math.round(x * 1000) / 1000);
    expect(v(node(HELI_NODES.body)?.translation)).toEqual([0, 0, 0]);
    expect(v(node(HELI_NODES.rotor)?.translation)).toEqual(v([0, HELI.rotor.hub, -HELI.rotor.at]));
    const t = HELI.tail.hub;
    expect(v(node(HELI_NODES.tail)?.translation)).toEqual(v([t.x, t.y, -t.z]));
  });

  it("names its materials as the builder does, the lamps among them", () => {
    const named = new Set(matNames("heli.py"));
    for (const n of ["paint", "trim", "glass", "metal", "dark", "rotor", "lamp", "lamp_green"]) {
      expect(named.has(n), `heli.py names "${n}"`).toBe(true);
    }
    expect(new Set(gltf.materials.map((m) => m.name))).toEqual(named);
  });

  it("stays inside the game's triangle budget", () => {
    const tris = gltf.meshes
      .flatMap((m) => m.primitives)
      .reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
    expect(tris).toBeLessThanOrEqual(12_000);
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
  const style = pairStyle(SKI_CATALOG[1], { outfit: RIVAL_OUTFITS[0] });

  it("reads every name it dresses off the builders' own materials", () => {
    const skis = new Set(matNames("skis.py"));
    const skier = new Set(matNames("skier.py"));
    for (const n of ["paint", "white", "panel", "boot", "base"]) {
      expect(skis.has(n), `skis.py names "${n}"`).toBe(true);
    }
    for (const n of ["jacket", "accent", "pants", "helmet", "peak", "lens", "skin"]) {
      expect(skier.has(n), `skier.py names "${n}"`).toBe(true);
    }
  });

  it("paints a pair in its style", () => {
    expect(dressOf("paint", style, null)).toEqual({ colour: style.body });
    expect(dressOf("white", style, null)).toEqual({ colour: style.accent });
    expect(dressOf("panel", { ...style, panel: 0x123456 }, null)).toEqual({ colour: 0x123456 });
    expect(dressOf("pole", style, null)).toEqual({ colour: style.pole });
    expect(dressOf("pole", { body: 1, accent: 2 }, null)).toEqual({ colour: 0x9aa1a9 });
    expect(dressOf("base", style, null)).toBeNull();
  });

  it("dresses a modelled skier in an outfit's colours", () => {
    const kit = coloursOf(RIVAL_OUTFITS[0], RIVAL_OUTFITS[0].tone);
    expect(dressOf("jacket", null, kit)).toEqual({ colour: kit.jacket });
    expect(dressOf("pants", null, kit)).toEqual({ colour: kit.pants });
    expect(dressOf("helmet", null, kit)).toEqual({ colour: kit.helmet });
    expect(dressOf("lens", null, kit)).toEqual({ colour: kit.visor });
    expect(dressOf("skin", null, kit)).toEqual({ colour: kit.skin });
    expect(dressOf("paint", null, kit)).toBeNull();
  });
});
