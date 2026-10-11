// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SKIS the game draws: glTFs made in Blender off the game's
// own data (`make models`, committed in `pwa/models/` and held fresh
// against their sources by `tests/models_test.ts`) and packed by every
// build (`pwa/models-plugin.ts`) — unless a build is switched back to the
// code-built ones (`VITE_MODEL_SKIS=0`; `model-switch.ts`). Nothing else
// changes: the code's pair is still built, still posed, still the one the
// bound, the thrown skier and every reader of a `SkisModel` know; its
// drawn parts are only collapsed out of the merged draw, and the model —
// skinned on the rig `make blender` gave it — is posed off the same
// readings beside it: its rig (`ski-rig.ts`) posed off the engine's state
// and the drawn furrow's sink, dressed in the pair's style (the paint, the
// trim, the sidewalls, the boots, the poles) — the topsheet's pattern is
// the code pair's only.
//
// THE SKIER IS NOT A MODEL: he is dressed in code, his outfit cut onto the
// rig (`skier-dress.ts`), since a modelled skier is one suit and the gear
// is a catalog to be mixed. A Blender skier (`make blender KIND=skier`) is
// still the labs' comparison, dressed by `dressOf` in an outfit's colours.
//
// Loaded once, before the renderer's kit is handed out (`use-render-kit.ts`),
// so every builder finds them waiting; a model that fails to load leaves
// that pair to the code.
//
// THE HELICOPTER is a model too (`models/heli.glb`, `make models KIND=heli`,
// three rigid nodes: `HELI_NODES`), switched by `VITE_MODEL_HELI`; it is
// not fetched with the skis — only a free ride with the helicopter wants
// it — so `heliModelUrl()` is where its drawer (`heli-view.ts`) fetches it
// from, `null` when the build packs none. Its AIR AMBULANCE
// (`models/rescue.glb`, `make models KIND=rescue`: the same airframe in a
// mountain rescue service's yellow, with a hoist, a searchlight and the
// wire cutters) carries the same `HELI_NODES` and is packed under the same
// switch, fetched from `rescueModelUrl()`. So are the snowmobile
// (`sledModelUrl`, `VITE_MODEL_SLED`) and the night's piste machine
// (`groomerModelUrl`, `VITE_MODEL_GROOMER`) and the jump plane
// (`planeModelUrl`, `VITE_MODEL_PLANE`), each fetched by its drawer.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SKI_CATALOG, type SkiId, type SkiSpec, type SkierState } from "@engine";

import { modelSwitch } from "./model-switch.ts";
import { mergeModel } from "./model-merge.ts";
import { lookFrame } from "./ski-looks.ts";
import { rigAsset } from "./ski-rig.ts";
import type { Stand } from "./ski-stand.ts";

/** The build's environment — Vite's, where this runs in the app; none
 * where the suite reads the module (the root program knows no Vite). */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Which models this build draws (a build-time switch, ON unless turned
 * off — `model-switch.ts`). */
export const MODELS = {
  skis: modelSwitch(ENV.VITE_MODEL_SKIS),
  heli: modelSwitch(ENV.VITE_MODEL_HELI),
  sled: modelSwitch(ENV.VITE_MODEL_SLED),
  groomer: modelSwitch(ENV.VITE_MODEL_GROOMER),
  plane: modelSwitch(ENV.VITE_MODEL_PLANE),
};

/** The helicopter model's nodes, as `scripts/blender/heli.py` names them:
 * the airframe (its origin the skid datum), the main rotor (its origin the
 * hub; it turns clockwise seen from above, about its local +y — a NEGATIVE
 * angle in three.js) and the tail rotor (its origin the tail rotor's hub;
 * it turns about its local +x, the top blade going aft). */
export const HELI_NODES = {
  body: "heli_body",
  rotor: "heli_rotor",
  tail: "heli_tail_rotor",
} as const;

/** The snowmobile model's nodes, as `scripts/blender/sled.py` names them
 * (each in the TRACE's frame, glTF-turned): the chassis, the bars (turned
 * about the post), each ski (its origin the spindle's foot), the rear
 * suspension (its origin the drive), the paddles (the track's child, with
 * the `run` morph) and the ski rack. */
export const SLED_NODES = {
  body: "sled_body",
  bars: "sled_bars",
  skiL: "sled_ski_l",
  skiR: "sled_ski_r",
  track: "sled_track",
  lugs: "sled_lugs",
  rack: "sled_rack",
} as const;

/** Where this build serves the snowmobile's glTF, or `null` when it is
 * switched off (`VITE_MODEL_SLED=0`). */
export function sledModelUrl(): string | null {
  return MODELS.sled ? `${String(ENV.BASE_URL ?? "/")}models/sled.glb` : null;
}

/** The piste machine model's nodes, as `scripts/blender/groomer.py` names
 * them (in the ENGINE's frame — no turn): the hull, belts, cab and hood;
 * the cleats with the `run` morph; the blade (its origin the push frame's
 * hinge); the snow heap ahead of it; the tiller (its origin the hitch);
 * the beacon's reflector (its origin the beacon's middle). */
export const GROOMER_NODES = {
  body: "groomer_body",
  cleats: "groomer_cleats",
  blade: "groomer_blade",
  heap: "groomer_heap",
  tiller: "groomer_tiller",
  beacon: "groomer_beacon",
} as const;

/** The jump plane model's nodes, as `scripts/blender/plane.py` names them
 * (glTF-turned: the nose on −z): the airframe with its cabin (its origin
 * the ground datum); the propeller (its origin the hub, turning about its
 * local z); and the hinged surfaces and the jump door, each with its
 * origin on its hinge and its local x along it, a positive turn about it
 * lowering the trailing edge (the rudder's: swinging it to the door's
 * side). */
export const PLANE_NODES = {
  body: "plane_body",
  prop: "plane_prop",
  elevator: "plane_elevator",
  rudder: "plane_rudder",
  aileronL: "plane_aileron_l",
  aileronR: "plane_aileron_r",
  flapL: "plane_flap_l",
  flapR: "plane_flap_r",
  door: "plane_door",
} as const;

/** Where this build serves the jump plane's glTF, or `null` when it is
 * switched off (`VITE_MODEL_PLANE=0`) and the build packs none. */
export function planeModelUrl(): string | null {
  return MODELS.plane ? `${String(ENV.BASE_URL ?? "/")}models/plane.glb` : null;
}

/** Where this build serves the piste machine's glTF, or `null` when it is
 * switched off (`VITE_MODEL_GROOMER=0`) and the build packs none. */
export function groomerModelUrl(): string | null {
  return MODELS.groomer ? `${String(ENV.BASE_URL ?? "/")}models/groomer.glb` : null;
}

/** Where this build serves the helicopter's glTF, or `null` when it is
 * switched off (`VITE_MODEL_HELI=0`) and the build packs none. */
export function heliModelUrl(): string | null {
  return MODELS.heli ? `${String(ENV.BASE_URL ?? "/")}models/heli.glb` : null;
}

/** Where this build serves the air ambulance's glTF (the heli's airframe
 * dressed for mountain rescue, the same `HELI_NODES`), or `null` when the
 * helicopter is switched off (`VITE_MODEL_HELI=0`) and the build packs
 * neither. */
export function rescueModelUrl(): string | null {
  return MODELS.heli ? `${String(ENV.BASE_URL ?? "/")}models/rescue.glb` : null;
}

const loaded: { skis: Map<SkiId, GLTF> } = { skis: new Map() };
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
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

/** What a model's material is dressed as, by the name `make blender` gave
 * it: a colour off the style, or the model's own. Pure, so the suite reads
 * it. The names are stated twice — here and in `scripts/blender/skis.py` /
 * `skier.py` — and `tests/models_test.ts` holds them together. */
export type Dress = { colour: number } | null;

/** A modelled skier's colours, by the names `skier.py` gives its
 * materials (`outfit.ts`' `coloursOf` makes one off an outfit). */
export type SkierStyle = {
  jacket: number;
  accent?: number;
  pants: number;
  helmet: number;
  peak?: number;
  visor: number;
  skin?: number;
};

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
    if (name === "skin" && skier.skin !== undefined) return { colour: skier.skin };
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
  /** Whether the pair is drawn in place of the code's. */
  skis: boolean;
  /** The pair posed; `angle` the skid's pivot as drawn (the engine's when
   * left out), `stand` where each ski stands on the snow
   * (`ski-stand.ts`). */
  pose(skier: SkierState, sink: number, dt: number, angle?: number, stand?: Stand): void;
  /** Ski `i` (0 the left) let go of (`lone-skis.ts`), after `pose`:
   * `pair` takes the pair's root frame — where the ski stands in it at
   * rest — to the world where it lies. */
  lay(i: number, pair: THREE.Matrix4): void;
  dispose(): void;
};

/** THE MODEL FOR ONE PAIR, hung under its `root` in place of the code's
 * drawn parts (which the caller collapses when `skis` says so). Null when
 * this build draws none, or it has not loaded. */
export function attachModels(o: {
  spec: SkiSpec;
  root: THREE.Object3D;
  skis: SkisStyle;
  wrap: Wrap;
}): ModelParts | null {
  const skisGltf = MODELS.skis ? loaded.skis.get(o.spec.id) : undefined;
  if (!skisGltf) return null;
  const mats: THREE.Material[] = [];

  // THE PAIR: modelled in its trace's frame, forward on glTF's −z — so
  // turned a half turn, set on the spec as `lookFrame` sets a trace (the
  // snow at −cogHeight in the body frame).
  const F = lookFrame(o.spec);
  const parts = dressed(skisGltf, o.skis, null, o.wrap, mats);
  const { scene } = parts;
  // One draw for the pair, its boots apart (`model-merge.ts`).
  const merged = mergeModel(parts.meshes, (m) => m.name === "boot", o.wrap);
  const { meshes } = merged;
  scene.rotation.y = Math.PI;
  const holder = new THREE.Group();
  holder.name = "model-skis";
  holder.add(scene);
  holder.position.set(0, F.y(0), F.z(0));
  o.root.add(holder);
  const skisRig = rigAsset(scene, skisGltf.animations);
  const to = new THREE.Matrix4();

  return {
    meshes,
    skis: true,
    pose(skier, sink, _dt, angle, stand) {
      o.root.updateWorldMatrix(true, false);
      skisRig.pose(skier, 0, sink, angle, stand);
    },
    lay(i, pair) {
      holder.updateMatrix();
      skisRig.lay(i, to.multiplyMatrices(pair, holder.matrix));
    },
    dispose() {
      for (const m of mats) m.dispose();
      merged.dispose();
    },
  };
}
