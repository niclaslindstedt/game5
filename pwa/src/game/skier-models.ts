// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SKIS AND SKIERS the game draws: glTFs made in Blender off
// the game's own data (`make models`, committed in `pwa/models/` and held
// fresh against their sources by `tests/models_test.ts`) and packed by
// every build (`pwa/models-plugin.ts`) — unless a build is switched back to
// the code-built ones (`VITE_MODEL_SKIS=0`, `VITE_MODEL_SKIERS=0`;
// `model-switch.ts`). Nothing else changes: the code's pair is still
// built, still posed, still the one the bound, the thrown skier and every
// reader of a `SkisModel` know; its drawn parts are only collapsed out of
// the merged draw, and the model — skinned on the rig `make blender` gave
// it — is posed off the same readings beside it:
//
//   a pair      its rig (`ski-rig.ts`) posed off the engine's state and the
//               drawn furrow's sink; dressed in the pair's style (the
//               paint, the trim, the sidewalls, the boots, the poles) —
//               the topsheet's pattern is the code pair's only
//   a skier     his bones (`skier-rig.ts`) set to the pose the figure is
//               hung on — on his skis or thrown — in the slot's kit
//
// Loaded once, before the renderer's kit is handed out (`use-render-kit.ts`),
// so every builder finds them waiting; a model that fails to load leaves
// that pair or skier to the code.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SKI_CATALOG, type SkiId, type SkiSpec, type SkierState } from "@engine";

import { modelSwitch } from "./model-switch.ts";
import { lookFrame } from "./ski-looks.ts";
import { rigAsset } from "./ski-rig.ts";
import type { SkierStyle } from "./skier-figure.ts";
import type { SkierPose } from "./skier-pose.ts";
import { rigSkier } from "./skier-rig.ts";

/** The build's environment — Vite's, where this runs in the app; none
 * where the suite reads the module (the root program knows no Vite). */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Which models this build draws (build-time switches, ON unless turned
 * off — `model-switch.ts`). */
export const MODELS = {
  skis: modelSwitch(ENV.VITE_MODEL_SKIS),
  skiers: modelSwitch(ENV.VITE_MODEL_SKIERS),
};

const loaded: { skis: Map<SkiId, GLTF>; skier: GLTF | null } = {
  skis: new Map(),
  skier: null,
};
let loading: Promise<void> | null = null;

/** Fetch every model this build draws, once; resolves when all are in (or
 * given up on — a missing one leaves its pair to the code). */
export function loadModels(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const at = (file: string) => `${String(ENV.BASE_URL ?? "/")}models/${file}`;
  const jobs: Promise<unknown>[] = [];
  if (MODELS.skis) {
    for (const s of SKI_CATALOG) {
      jobs.push(
        loader.loadAsync(at(`${s.id}.glb`)).then(
          (g) => loaded.skis.set(s.id, g),
          () => undefined,
        ),
      );
    }
  }
  if (MODELS.skiers) {
    jobs.push(
      loader.loadAsync(at("skier.glb")).then(
        (g) => (loaded.skier = g),
        () => undefined,
      ),
    );
  }
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

/** What a model's material is dressed as, by the name `make blender` gave
 * it: a colour off the style, or the model's own. Pure, so the suite reads
 * it. The names are stated twice — here and in `scripts/blender/skis.py` /
 * `skier.py` — and `tests/models_test.ts` holds them together. */
export type Dress = { colour: number } | null;

export type SkisStyle = {
  body: number;
  accent: number;
  panel?: number;
  boot?: number;
  pole?: number;
};

export function dressOf(name: string, skis: SkisStyle | null, skier: SkierStyle | null): Dress {
  if (skis) {
    if (name === "paint") return { colour: skis.body };
    if (name === "white") return { colour: skis.accent };
    if (name === "panel") return { colour: skis.panel ?? 0x1c1f23 };
    if (name === "boot") return { colour: skis.boot ?? 0x121316 };
    if (name === "pole") return { colour: skis.pole ?? 0x9aa1a9 };
  }
  if (skier) {
    if (name === "jacket") return { colour: skier.jacket };
    if (name === "accent") return { colour: skier.accent ?? skier.jacket };
    if (name === "pants") return { colour: skier.pants };
    if (name === "helmet") return { colour: skier.helmet };
    if (name === "peak") return { colour: skier.peak ?? skier.helmet };
    if (name === "lens") return { colour: skier.visor };
  }
  return null;
}

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** A model's scene cloned (skeleton and all) and dressed; every material
 * through the world's wrap, as every drawn thing's is. */
function dressed(
  gltf: GLTF,
  skis: SkisStyle | null,
  skier: SkierStyle | null,
  wrap: Wrap,
  mats: THREE.Material[],
): { scene: THREE.Object3D; meshes: THREE.Mesh[] } {
  const scene = cloneSkinned(gltf.scene);
  const meshes: THREE.Mesh[] = [];
  const done = new Map<THREE.Material, THREE.Material>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes.push(o);
    o.castShadow = true;
    o.receiveShadow = true;
    // A skinned mesh's bound is its rest pose's; the pair is small and
    // always on screen when it matters, so it is never culled by it.
    o.frustumCulled = false;
    const one = (m: THREE.Material): THREE.Material => {
      const known = done.get(m);
      if (known) return known;
      const d = dressOf(m.name, skis, skier);
      const own = m.clone() as THREE.MeshStandardMaterial;
      if (d) own.color.setHex(d.colour);
      own.name = m.name;
      const out = wrap(own, `model-${m.name}`);
      mats.push(out);
      done.set(m, out);
      return out;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { scene, meshes };
}

export type ModelParts = {
  /** Every mesh the models draw — what casts. */
  meshes: THREE.Mesh[];
  /** Whether each is drawn in place of the code's. */
  skis: boolean;
  skier: boolean;
  pose(skier: SkierState, sink: number, dt: number): void;
  /** The skier at a pose, his holder where the figure's group stands. */
  poseSkier(p: SkierPose, figure: THREE.Object3D): void;
  setSkierVisible(v: boolean): void;
  dispose(): void;
};

/** THE MODELS FOR ONE PAIR, hung under its `root` in place of the code's
 * drawn parts (which the caller collapses when `skis` / `skier` say so).
 * Null when this build draws neither, or neither has loaded. */
export function attachModels(o: {
  spec: SkiSpec;
  root: THREE.Object3D;
  skis: SkisStyle;
  skier: SkierStyle;
  wrap: Wrap;
}): ModelParts | null {
  const skisGltf = MODELS.skis ? loaded.skis.get(o.spec.id) : undefined;
  const skierGltf = MODELS.skiers ? loaded.skier : null;
  if (!skisGltf && !skierGltf) return null;
  const mats: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];

  // THE PAIR: modelled in its trace's frame, forward on glTF's −z — so
  // turned a half turn, set on the spec as `lookFrame` sets a trace (the
  // snow at −cogHeight in the body frame).
  let skisRig: ReturnType<typeof rigAsset> | null = null;
  if (skisGltf) {
    const F = lookFrame(o.spec);
    const { scene, meshes: m } = dressed(skisGltf, o.skis, null, o.wrap, mats);
    scene.rotation.y = Math.PI;
    const holder = new THREE.Group();
    holder.name = "model-skis";
    holder.add(scene);
    holder.position.set(0, F.y(0), F.z(0));
    o.root.add(holder);
    skisRig = rigAsset(scene, skisGltf.animations);
    meshes.push(...m);
  }

  // THE SKIER: stated in the pose's frame, turned the same half turn; his
  // holder stands where the figure's group stands, on the skis or thrown.
  let skierHolder: THREE.Group | null = null;
  let skierRig: ReturnType<typeof rigSkier> | null = null;
  if (skierGltf) {
    const { scene, meshes: m } = dressed(skierGltf, null, o.skier, o.wrap, mats);
    scene.rotation.y = Math.PI;
    skierHolder = new THREE.Group();
    skierHolder.name = "model-skier";
    skierHolder.add(scene);
    o.root.add(skierHolder);
    skierRig = rigSkier(skierHolder, skierGltf.animations);
    meshes.push(...m);
  }

  return {
    meshes,
    skis: !!skisRig,
    skier: !!skierRig,
    pose(skier, sink) {
      o.root.updateWorldMatrix(true, false);
      skisRig?.pose(skier, 0, sink);
    },
    poseSkier(p, figure) {
      if (!skierHolder || !skierRig) return;
      o.root.updateWorldMatrix(true, false);
      skierHolder.position.copy(figure.position);
      skierHolder.quaternion.copy(figure.quaternion);
      skierHolder.updateMatrixWorld(true);
      skierRig.pose(p);
    },
    setSkierVisible(v) {
      if (skierHolder) skierHolder.visible = v;
    },
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}
