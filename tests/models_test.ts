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
import { GROOMER, HELI, PLANE, SKI_CATALOG } from "@engine";

import {
  ALL_MODELS,
  MODELS_DIR,
  MODEL_HALVES,
  modelFiles,
  sourcesHash,
} from "../pwa/models-plugin.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import {
  dressOf,
  GROOMER_NODES,
  groomerModelUrl,
  HELI_NODES,
  heliModelUrl,
  PLANE_NODES,
  planeModelUrl,
  rescueModelUrl,
  SLED_NODES,
  sledModelUrl,
} from "../pwa/src/game/skier-models.ts";
import { coloursOf, RIVAL_OUTFITS } from "../pwa/src/game/outfit.ts";
import { pairStyle } from "../pwa/src/game/skis-body.ts";
import { GROOMER_LOOK } from "../pwa/src/game/groomer-look.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the models the game ships", () => {
  const all = modelFiles(ALL_MODELS);

  it("are every pair under its id, the helicopter and its air ambulance, the snowmobile, the piste machine and the jump plane", () => {
    expect([...all].sort()).toEqual(
      [
        ...SKI_CATALOG.map((s) => `${s.id}.glb`),
        "heli.glb",
        "rescue.glb",
        "sled.glb",
        "groomer.glb",
        "plane.glb",
      ].sort(),
    );
    const none = { skis: false, heli: false, sled: false, groomer: false, plane: false };
    expect(modelFiles({ ...none, plane: true })).toEqual(["plane.glb"]);
    expect(modelFiles(ALL_MODELS, "plane")).toEqual(["plane.glb"]);
    expect(modelFiles({ ...none, heli: true })).toEqual(["heli.glb", "rescue.glb"]);
    expect(modelFiles({ ...none, sled: true })).toEqual(["sled.glb"]);
    expect(modelFiles({ ...none, groomer: true })).toEqual(["groomer.glb"]);
    expect(modelFiles({ ...none, skis: true })).toEqual(SKI_CATALOG.map((s) => `${s.id}.glb`));
    expect(modelFiles(none)).toEqual([]);
    expect(modelFiles(ALL_MODELS, "heli")).toEqual(["heli.glb"]);
    expect(modelFiles(ALL_MODELS, "rescue")).toEqual(["rescue.glb"]);
    expect(modelFiles(ALL_MODELS, "sled")).toEqual(["sled.glb"]);
    expect(modelFiles(ALL_MODELS, "groomer")).toEqual(["groomer.glb"]);
    expect(modelFiles(ALL_MODELS, "sources")).toHaveLength(SKI_CATALOG.length);
  });

  it("are nothing but the skis and the free ride's machines — the skier is dressed in code", () => {
    expect(existsSync(join(root, MODELS_DIR, "skier.glb"))).toBe(false);
    for (const dir of ["birds", "beasts", "gates"]) {
      expect(existsSync(join(root, MODELS_DIR, dir)), `${MODELS_DIR}/${dir}`).toBe(false);
    }
    const stamp = JSON.parse(
      readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8"),
    ) as object;
    expect(Object.keys(stamp).sort()).toEqual([
      "blender",
      "groomer",
      "heli",
      "plane",
      "rescue",
      "sled",
      "sources",
    ]);
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
      const kind = half === "sources" ? "skis" : half;
      expect(
        stamp[half],
        `a source of the ${kind} moved since it was made — run \`make models KIND=${kind}\` and commit pwa/models/`,
      ).toBe(sourcesHash(root, sources));
    }
    expect(sourcesHash(root)).toBe(sourcesHash(root, MODEL_HALVES.sources));
  });
});

// The heli-ski machine and its air ambulance: one airframe, one builder
// (`rescue.py` runs `heli.py` whole and dresses it), one drawer's nodes.
for (const m of [
  { file: "heli.glb", url: heliModelUrl, builders: ["heli.py"], what: "helicopter" },
  {
    file: "rescue.glb",
    url: rescueModelUrl,
    builders: ["heli.py", "rescue.py"],
    what: "air ambulance",
  },
]) {
  describe(`the ${m.what} model`, () => {
    const glb = readFileSync(join(root, MODELS_DIR, m.file));
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
      expect(m.url()).toBe(`/models/${m.file}`);
    });

    it("hangs each rotor at its hub, as HELI has it (glTF: y up, the nose on -z)", () => {
      const v = (n: number[] | undefined) =>
        (n ?? [0, 0, 0]).map((x) => Math.round(x * 1000) / 1000);
      expect(v(node(HELI_NODES.body)?.translation)).toEqual([0, 0, 0]);
      expect(v(node(HELI_NODES.rotor)?.translation)).toEqual(
        v([0, HELI.rotor.hub, -HELI.rotor.at]),
      );
      const t = HELI.tail.hub;
      expect(v(node(HELI_NODES.tail)?.translation)).toEqual(v([t.x, t.y, -t.z]));
    });

    it("names its materials as the builder does, the lamps among them", () => {
      const named = new Set(m.builders.flatMap(matNames));
      for (const n of ["paint", "trim", "glass", "metal", "dark", "rotor", "lamp", "lamp_green"]) {
        expect(named.has(n), `heli.py names "${n}"`).toBe(true);
      }
      expect(new Set(gltf.materials.map((x) => x.name))).toEqual(named);
    });

    it("stays inside the game's triangle budget", () => {
      const tris = gltf.meshes
        .flatMap((x) => x.primitives)
        .reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
      // 16k: the class's own silhouette — the nose rounded over two metres,
      // the boxy cowl, the conical boom, the round tubes of the skid gear at
      // eight sides — costs about 14k; a model past 16k lost its game cut.
      expect(tris).toBeLessThanOrEqual(16_000);
    });
  });
}

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

describe("the snowmobile model", () => {
  const glb = readFileSync(join(root, MODELS_DIR, "sled.glb"));
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
    nodes: { name: string; mesh?: number; children?: number[] }[];
    materials: { name: string }[];
    meshes: { primitives: { indices: number; targets?: unknown[] }[] }[];
    accessors: { count: number }[];
  };
  const node = (name: string) => gltf.nodes.find((n) => n.name === name);
  const builder = readFileSync(join(root, "scripts", "blender", "sled.py"), "utf8");

  it("carries every node its drawer is told of, each a rigid mesh", () => {
    for (const name of Object.values(SLED_NODES)) {
      expect(builder, `sled.py names ${name}`).toContain(`"${name}"`);
      expect(node(name)?.mesh, name).toBeTypeOf("number");
    }
    expect(sledModelUrl()).toBe("/models/sled.glb");
  });

  it("runs its paddles round the belt on one morph", () => {
    const lugs = gltf.meshes[node(SLED_NODES.lugs)!.mesh!];
    for (const p of lugs.primitives) expect(p.targets?.length).toBe(1);
  });

  it("names its materials as the builder does, the rack's among them", () => {
    const named = new Set(matNames("sled.py"));
    for (const n of ["paint", "rubber", "lamp", "rack_ski", "rack_trim", "rack_base"]) {
      expect(named.has(n), `sled.py names "${n}"`).toBe(true);
    }
    for (const m of gltf.materials) expect(named.has(m.name), m.name).toBe(true);
  });

  it("stays inside the game's triangle budget", () => {
    const tris = gltf.meshes
      .flatMap((m) => m.primitives)
      .reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
    // 20k: the cowl's creased loft, the belt and its paddles, the front
    // end's arms and springs, the rack and its pair.
    expect(tris).toBeLessThan(20_000);
  });
});

describe("the piste machine model", () => {
  const glb = readFileSync(join(root, MODELS_DIR, "groomer.glb"));
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
    nodes: {
      name: string;
      mesh?: number;
      translation?: number[];
      extras?: Record<string, unknown>;
    }[];
    materials: { name: string }[];
    meshes: {
      primitives: { indices: number; attributes: { POSITION: number }; targets?: unknown[] }[];
    }[];
    accessors: { count: number; min?: number[]; max?: number[] }[];
  };
  const node = (name: string) => gltf.nodes.find((n) => n.name === name);
  const builder = readFileSync(join(root, "scripts", "blender", "groomer.py"), "utf8");
  const v = (n: number[] | undefined) => (n ?? [0, 0, 0]).map((x) => Math.round(x * 1000) / 1000);

  it("carries every node its drawer is told of, each a rigid mesh", () => {
    for (const name of Object.values(GROOMER_NODES)) {
      expect(builder, `groomer.py names ${name}`).toContain(`"${name}"`);
      expect(node(name)?.mesh, name).toBeTypeOf("number");
    }
    expect(groomerModelUrl()).toBe("/models/groomer.glb");
  });

  it("is in the engine's own frame, the blade on its hinge and the tiller on its hitch", () => {
    const B = GROOMER_LOOK.blade.hinge;
    const T = GROOMER_LOOK.tiller.hitch;
    const C = GROOMER_LOOK.beacon;
    expect(v(node(GROOMER_NODES.body)?.translation)).toEqual([0, 0, 0]);
    expect(v(node(GROOMER_NODES.blade)?.translation)).toEqual(v([0, B.y, B.z]));
    expect(v(node(GROOMER_NODES.tiller)?.translation)).toEqual(v([0, T.y, T.z]));
    expect(v(node(GROOMER_NODES.beacon)?.translation)).toEqual(v([C.x, C.y, C.z]));
  });

  it("stands at the class's true size: its width over the belts, its height", () => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of gltf.meshes[node(GROOMER_NODES.body)!.mesh!].primitives) {
      const a = gltf.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], a.min![k]);
        max[k] = Math.max(max[k], a.max![k]);
      }
    }
    expect(max[0] - min[0]).toBeCloseTo(GROOMER.tracks.span, 1);
    expect(max[1]).toBeGreaterThan(GROOMER.roof - 0.1);
    expect(max[1]).toBeLessThan(GROOMER.roof + 0.3);
    expect(min[1]).toBeGreaterThan(-0.1);
  });

  it("runs its cleats round the belts on one morph, its pitch on the root", () => {
    const cleats = gltf.meshes[node(GROOMER_NODES.cleats)!.mesh!];
    for (const p of cleats.primitives) expect(p.targets?.length).toBe(1);
    const root = gltf.nodes.find((n) => typeof n.extras?.cleatPitch === "number");
    expect(root?.extras?.cleatPitch).toBeCloseTo(GROOMER_LOOK.belt.pitch, 1);
  });

  it("names its materials as the builder does, the lit ones among them", () => {
    const named = new Set(matNames("groomer.py"));
    for (const n of ["paint", "glass", "lamp", "amber", "tail", "rubber", "snow"]) {
      expect(named.has(n), `groomer.py names "${n}"`).toBe(true);
    }
    for (const m of gltf.materials) expect(named.has(m.name), m.name).toBe(true);
  });

  it("stays inside the game's triangle budget", () => {
    const tris = gltf.meshes
      .flatMap((m) => m.primitives)
      .reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
    // 26k: up to six are out at once — the belts' bands and wheels, the
    // cab's glass and pillars, the hood, the blade's guard and the
    // tiller's ribbed mat.
    expect(tris).toBeLessThan(26_000);
  });
});

describe("the jump plane model", () => {
  const glb = readFileSync(join(root, MODELS_DIR, "plane.glb"));
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
    nodes: {
      name: string;
      mesh?: number;
      translation?: number[];
      rotation?: number[];
      extras?: Record<string, unknown>;
    }[];
    materials: { name: string }[];
    meshes: { primitives: { indices: number; attributes: { POSITION: number } }[] }[];
    accessors: { count: number; min?: number[]; max?: number[] }[];
  };
  const node = (name: string) => gltf.nodes.find((n) => n.name === name);
  const builder = readFileSync(join(root, "scripts", "blender", "plane.py"), "utf8");
  const v = (n: number[] | undefined) => (n ?? [0, 0, 0]).map((x) => Math.round(x * 1000) / 1000);

  it("carries every node its drawer is told of, each a rigid mesh, the hinged ones marked", () => {
    for (const name of Object.values(PLANE_NODES)) {
      expect(builder, `plane.py names ${name}`).toContain(`"${name}"`);
      expect(node(name)?.mesh, name).toBeTypeOf("number");
    }
    for (const k of ["elevator", "rudder", "aileronL", "aileronR", "flapL", "flapR"] as const) {
      expect(node(PLANE_NODES[k])?.extras?.hinge, k).toBe("x");
    }
    expect(planeModelUrl()).toBe("/models/plane.glb");
  });

  it("turns its propeller about the engine's hub (glTF-turned: the nose on −z)", () => {
    expect(v(node(PLANE_NODES.prop)?.translation)).toEqual(
      v([0, PLANE.prop.hub.y, -PLANE.prop.hub.z]),
    );
    expect(v(node(PLANE_NODES.body)?.translation)).toEqual([0, 0, 0]);
  });

  it("spans the wing and stands on its skis where the engine has them", () => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of gltf.meshes[node(PLANE_NODES.body)!.mesh!].primitives) {
      const a = gltf.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], a.min![k]);
        max[k] = Math.max(max[k], a.max![k]);
      }
    }
    expect(max[0] - min[0]).toBeCloseTo(PLANE.wing.span, 0);
    expect(min[1]).toBeGreaterThan(-0.05);
    expect(min[1]).toBeLessThan(0.05);
    expect(max[1]).toBeCloseTo(PLANE.fin.tip.y, 0);
  });

  it("names its materials as the builder does, the lit ones among them", () => {
    const named = new Set(matNames("plane.py"));
    for (const n of ["paint", "glass", "cabin", "lamp", "lamp_green", "lamp_white"]) {
      expect(named.has(n), `plane.py names "${n}"`).toBe(true);
    }
    for (const m of gltf.materials) expect(named.has(m.name), m.name).toBe(true);
  });

  it("stays inside the game's triangle budget", () => {
    const tris = gltf.meshes
      .flatMap((m) => m.primitives)
      .reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
    // 20k: the traced skin with its windows and livery, the cabin behind
    // the open door, the wing and tail, the gear on its skis.
    expect(tris).toBeLessThan(20_000);
  });
});
