// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TREES (`pwa/src/game/tree-models.ts`, made by `make blender
// KIND=tree` off `tree-variants.ts`, published packed in
// `pwa/models/trees/`): every role the builder paints a face with is one the
// game can dress; a model is dressed in the region's paint, stood in the
// unit frame the forest scales it in, and carries only the snow the
// region's load reaches; and every committed kind decodes, through three's
// own loader and meshopt decoder, to all ten variants in both bands, in the
// frame and within the budget.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";
import { TREE_KINDS, type TreeKind } from "@engine";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import {
  partsOf,
  roleColours,
  setTreeModel,
  treeModel,
  type TreePart,
} from "../pwa/src/game/tree-models.ts";
import { kindPaint, treePaint, SNOW } from "../pwa/src/game/tree-shapes.ts";
import { TREE_REFERENCE, TREE_VARIANTS, VARIANTS } from "../pwa/src/game/tree-variants.ts";

const root = join(import.meta.dirname, "..");
const boreal = treePaint(regionLookOf("alpine"));
const tundra = treePaint(regionLookOf("fell"));

/** The roles `tree.py` paints with, read off its text. */
function builderRoles(): string[] {
  const src = readFileSync(join(root, "scripts", "blender", "tree.py"), "utf8");
  const m = /^ROLES = \(([^)]*)\)/m.exec(src);
  if (!m) throw new Error("tree.py states no ROLES");
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

/** A one-triangle part at `y` metres up, in one role, with one tone. */
function part(role: string, tone: [number, number, number], y = 6): TreePart {
  const { crown: C } = TREE_REFERENCE;
  return {
    role,
    position: Float32Array.from([0, y, 0, C, y, 0, 0, y, C]),
    normal: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    tone: Float32Array.from([...tone, ...tone, ...tone]),
    index: Uint32Array.from([0, 1, 2]),
  };
}

describe("a tree model's dress", () => {
  it("has two colours for every role the builder paints with", () => {
    const roles = builderRoles();
    expect(roles.length).toBeGreaterThan(3);
    const p = kindPaint(boreal, "rowan");
    for (const r of roles) expect(roleColours(r, p), r).not.toBeNull();
    expect(roleColours("paint", p)).toBeNull();
  });

  it("paints a vertex its role's colours, blended and shaded", () => {
    setTreeModel("fir", new Map([["v0", [part("needle", [0.5, 1, 0])]]]));
    const g = treeModel(TREE_VARIANTS.fir[0], boreal)!;
    const dark = kindPaint(boreal, "fir").dark.clone().multiplyScalar(0.5);
    const col = g.getAttribute("color");
    expect(col.getX(0)).toBeCloseTo(dark.r, 5);
    expect(col.getY(0)).toBeCloseTo(dark.g, 5);
    expect(col.getZ(0)).toBeCloseTo(dark.b, 5);
  });

  it("stands a model in the unit frame: a crown radius across, the height up", () => {
    const g = treeModel(TREE_VARIANTS.fir[0], boreal)!;
    const pos = g.getAttribute("position");
    expect(pos.getX(1)).toBeCloseTo(1, 5);
    expect(pos.getY(1)).toBeCloseTo(6 / TREE_REFERENCE.height, 5);
    expect(pos.getZ(2)).toBeCloseTo(1, 5);
  });

  it("carries only the snow the region's load reaches", () => {
    setTreeModel(
      "fir",
      new Map([
        [
          "v1",
          [
            part("snow", [1, 0, 0]),
            part("snow", [1, 0, 0.3]),
            part("snow", [1, 0, 0.9]),
            part("needle", [1, 0, 0]),
          ],
        ],
      ]),
    );
    const tris = (paint: typeof boreal) => treeModel(TREE_VARIANTS.fir[1], paint)!.index!.count / 3;
    expect(boreal.load).toBe(1);
    expect(tundra.load).toBeLessThan(0.9);
    expect(tris(boreal)).toBe(4);
    expect(tris(tundra)).toBe(3);
    // The snow is the snow's colour, whatever the kind.
    const g = treeModel(TREE_VARIANTS.fir[1], boreal)!;
    expect(g.getAttribute("color").getX(0)).toBeCloseTo(SNOW.r, 5);
  });

  it("leaves a kind with no model to the code's builder", () => {
    setTreeModel("ash", new Map());
    expect(treeModel(TREE_VARIANTS.ash[0], boreal)).toBeNull();
  });
});

describe("the committed tree models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (kind: TreeKind) => {
    const b = readFileSync(join(root, "pwa", "models", "trees", `${kind}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g);
  };

  it("decode to every variant of every kind, in both bands, in the frame and the budget", async () => {
    for (const kind of TREE_KINDS) {
      setTreeModel(kind, await parse(kind));
      for (let i = 0; i < VARIANTS; i++) {
        const v = TREE_VARIANTS[kind][i];
        for (const far of [false, true]) {
          const g = treeModel(v, boreal, far);
          expect(g, `${kind} ${i}${far ? " far" : ""}`).not.toBeNull();
          const tris = g!.index!.count / 3;
          // The full band's budget and the sketch's (`tree.py`'s header).
          expect(tris, `${kind} ${i}`).toBeLessThan(far ? 260 : 1800);
          expect(tris, `${kind} ${i}`).toBeGreaterThan(far ? 20 : 100);
          g!.computeBoundingBox();
          const box = g!.boundingBox as THREE.Box3;
          // Its foot in the snow, its top at the variant's own (a broken
          // top's dead spire and a nodding leader's reach aside).
          expect(box.min.y, `${kind} ${i}`).toBeLessThan(0.01);
          expect(box.max.y, `${kind} ${i}`).toBeGreaterThan(v.top * 0.85);
          expect(box.max.y, `${kind} ${i}`).toBeLessThan(v.top + 0.2);
        }
      }
    }
  });
});
