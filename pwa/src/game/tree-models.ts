// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TREES the forest draws: every kind's ten variants MODELLED in
// Blender off the very rows the code's builder reads (`make blender
// KIND=tree`, `scripts/blender/tree.py`), committed as one glTF a kind in
// `pwa/models/trees/` by `make models` and packed by every build — unless a
// build is switched back to the code-built trees (`VITE_MODEL_TREES=0`;
// `model-switch.ts`). A kind whose file did not load is drawn by
// `tree-shapes.ts`, as every tree is under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name) and
// every vertex a SHADE, a BLEND from the role's first colour to its second,
// and — for the snow — the LOAD it needs (`tree.py`'s header). `treeModel`
// dresses it here, per map, in the region's paint as the code's builder
// paints its own (`kindPaint`), drops the snow the region's load does not
// reach, and divides the reference tree (`TREE_REFERENCE`) back out into
// the unit frame — x and z a crown radius, y the height — the forest
// instances every tree in.

import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TREE_KINDS, type TreeKind } from "@engine";

import { modelSwitch } from "./model-switch.ts";
import {
  fetchStaticModels,
  readStaticModel,
  type ModelPart,
  type StaticModel,
} from "./model-parts.ts";
import { SNOW, SNOW_SHADE, kindPaint, type KindPaint, type TreePaint } from "./tree-shapes.ts";
import { TREE_REFERENCE, type TreeVariant } from "./tree-variants.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled trees (ON unless turned off). */
export const TREE_MODELS = modelSwitch(ENV.VITE_MODEL_TREES);

/** What a face of a model is, by its material's name. */
export type TreeRole = "needle" | "snow" | "bark" | "twig" | "accent" | "mark";

/** A role's two colours in a kind's paint: the first, and the one a
 * vertex's blend goes to. Pure, so the suite reads it. */
export function roleColours(role: string, p: KindPaint): [THREE.Color, THREE.Color] | null {
  switch (role) {
    case "needle":
      return [p.needle, p.dark];
    case "snow":
      return [SNOW, SNOW_SHADE];
    case "bark":
      return [p.bark, p.upper];
    case "twig":
      return [p.twigs, p.bark];
    case "accent":
      return [p.accent, p.accent];
    case "mark":
      return [p.marks, p.marks];
    default:
      return null;
  }
}

/** One primitive of a variant's mesh, in the reference tree's metres
 * (`model-parts.ts` reads it). */
export type TreePart = ModelPart;

/** Every kind's variants, by mesh name (`v3`, `v3_far`). */
const loaded = new Map<TreeKind, Map<string, TreePart[]>>();
let loading: Promise<void> | null = null;

const VARIANT_MESH = /^v\d+(_far)?$/;

/** The parts of a loaded glTF scene, by variant mesh. */
export function partsOf(gltf: Pick<GLTF, "scene">): Map<string, TreePart[]> {
  return readStaticModel(gltf, (name) => VARIANT_MESH.test(name)).parts;
}

/** Fetch every kind's model, once (`base` where the site's `models/` is —
 * the build's base URL unless a lab page says otherwise); resolves when all
 * are in or given up on. */
export function loadTreeModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!TREE_MODELS) return (loading = Promise.resolve());
  const models = new Map<TreeKind, StaticModel>();
  loading = fetchStaticModels(
    TREE_KINDS,
    (kind) => `${base}models/trees/${kind}.glb`,
    (name) => VARIANT_MESH.test(name),
    models,
  ).then(() => {
    for (const [kind, m] of models) loaded.set(kind, m.parts);
  });
  return loading;
}

/** Hand a kind's parsed model in directly (the tree lab, the suite). */
export function setTreeModel(kind: TreeKind, parts: Map<string, TreePart[]>): void {
  loaded.set(kind, parts);
}

/**
 * ONE VARIANT'S MODEL, dressed for a map: in the unit frame, vertex-
 * coloured in `paint` as the kind shades it, with the snow its load does
 * not reach left off — or null when the kind has no model loaded (the
 * code's builder draws it).
 */
export function treeModel(
  v: TreeVariant,
  paint: TreePaint,
  sketch = false,
): THREE.BufferGeometry | null {
  const parts = loaded.get(v.kind)?.get(`v${v.index}${sketch ? "_far" : ""}`);
  if (!parts || parts.length === 0) return null;
  const p = kindPaint(paint, v.kind);
  const { height: H, crown: C } = TREE_REFERENCE;
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const colours = roleColours(part.role, p);
    if (!colours) continue;
    const snow = part.role === "snow";
    const first = pos.length / 3;
    const { position: at, normal: nr, tone } = part;
    const n = at.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(at[i * 3] / C, at[i * 3 + 1] / H, at[i * 3 + 2] / C);
      // The normal through the same squeeze's inverse transpose, so the
      // instance's stretch back to a tree turns it back.
      const nx = nr[i * 3] * C;
      const ny = nr[i * 3 + 1] * H;
      const nz = nr[i * 3 + 2] * C;
      const l = Math.hypot(nx, ny, nz) || 1;
      nrm.push(nx / l, ny / l, nz / l);
      c.copy(colours[0])
        .lerp(colours[1], tone[i * 3 + 1])
        .multiplyScalar(tone[i * 3]);
      col.push(c.r, c.g, c.b);
    }
    const ix = part.index;
    // A snow piece stands only where the region's load reaches it (a
    // quantized load a hair over the region's own still reaches).
    const reach = p.load + 1 / 255;
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t];
      const b = ix[t + 1];
      const d = ix[t + 2];
      if (snow && Math.max(tone[a * 3 + 2], tone[b * 3 + 2], tone[d * 3 + 2]) > reach) continue;
      idx.push(first + a, first + b, first + d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
