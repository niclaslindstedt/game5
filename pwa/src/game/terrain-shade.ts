// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOUNTAIN'S SHADOW ON THE GPU: the horizon map `terrain-shadow.ts`
// bakes, asked of a worker once a map and again only when the key light's
// bearing moves, uploaded as one half-float texture over the whole map and
// read by every world material through the shared haze uniforms
// (`haze.ts`'s `terrainLit`, taken with the key's shadow map, the darker of
// the two). Off while the SHADOWS row is: the map is the key light's shadow
// like any other, and a picture with no shadows has none of it either.
//
// AND WHAT STANDS IN IT CASTS NOTHING. A skier on a face turned from a low
// sun is in the mountain's shade — but the key light's own map only knows
// what is drawn into it, and the ground is not, so without this his body
// would still take the sun and throw its shadow down-sun past the face,
// onto the first crest that faces the sun: a long, thin shadow tens of
// metres from his feet, closing in on him as he skis toward it. So every
// caster draws its depth through `shadeDepth`, which throws away whatever
// part of it the mountain already shades.

import * as THREE from "three";
import type { Heightfield } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import {
  bakeHorizon,
  bakedFor,
  keyBearing,
  sameBearing,
  TERRAIN_SHADOW_GLSL,
  type HorizonMap,
  type KeyDir,
} from "./terrain-shadow.ts";
import type { ShadeReply, ShadeRequest } from "./terrain-shadow-worker.ts";

export type TerrainShade = {
  /** The map's ground (null: none), the key to bake for and whether the key
   * casts at all; resolves when the first map is on the GPU (at once when
   * there is nothing to bake). */
  setGround(ground: Heightfield | null, key: KeyDir | null, casting: boolean): Promise<void>;
  /** The key this frame, and whether the key casts at all (the SHADOWS
   * row): a new bearing asks for a new bake, and until it lands the old
   * one — cast along another bearing — is not drawn. */
  update(key: KeyDir, on: boolean): void;
  /** Resolves once the last bake asked for is drawn (a lab's cell waits on
   * it after moving the sky). */
  settled(): Promise<void>;
  dispose(): void;
};

let worker: Worker | null = null;
/** A page whose worker would not start bakes on its own thread instead. */
let workerless = typeof Worker === "undefined";
let asked = 0;
const waiting = new Map<number, { ask: ShadeRequest; done: (map: HorizonMap) => void }>();

/** A bake on a later task of this thread. */
const inline = (ask: ShadeRequest, done: (map: HorizonMap) => void): void => {
  setTimeout(() => done(bakeHorizon(ask.ground, ask.bearing)), 0);
};

/** A bake, in the worker where there is one, on a later task where not —
 * and on a later task too for every one in flight if the worker fails, so
 * a run waiting on its first shade is never left behind the loading card. */
function bake(ground: Heightfield, bearing: number): Promise<HorizonMap> {
  const ask: ShadeRequest = { id: ++asked, ground, bearing };
  return new Promise((done) => {
    if (workerless) return inline(ask, done);
    if (worker === null) {
      worker = new Worker(new URL("./terrain-shadow-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent<ShadeReply>) => {
        const job = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        job?.done(e.data.map);
      };
      worker.onerror = () => {
        workerless = true;
        worker?.terminate();
        worker = null;
        for (const job of waiting.values()) inline(job.ask, job.done);
        waiting.clear();
      };
    }
    waiting.set(ask.id, { ask, done });
    worker.postMessage(ask);
  });
}

export function createTerrainShade(haze: HazeUniforms): TerrainShade {
  let ground: Heightfield | null = null;
  let texture: THREE.DataTexture | null = null;
  /** The map on the GPU, and the bearing a bake in flight is for. */
  let map: HorizonMap | null = null;
  let pending: number | null = null;
  let on = false;
  /** The key last asked about, and the last bake asked for. */
  let key: KeyDir | null = null;
  let latest: Promise<void> = Promise.resolve();

  const show = (): void => {
    const fresh = map !== null && key !== null && bakedFor(map, key);
    haze.uTerrainShadeOn.value.x = on && fresh ? 1 : 0;
  };
  const upload = (next: HorizonMap): void => {
    map = next;
    const halves = new Uint16Array(next.data.length);
    for (let i = 0; i < halves.length; i++) halves[i] = THREE.DataUtils.toHalfFloat(next.data[i]);
    texture?.dispose();
    texture = new THREE.DataTexture(
      halves,
      next.cols,
      next.rows,
      THREE.RedFormat,
      THREE.HalfFloatType,
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    haze.uTerrainShade.value = texture;
    haze.uTerrainShadeBox.value.set(
      next.originX - next.cell / 2,
      next.originZ - next.cell / 2,
      1 / (next.cols * next.cell),
      1 / (next.rows * next.cell),
    );
    show();
  };
  const ask = (toward: KeyDir): Promise<void> => {
    const land = ground;
    if (!land) return Promise.resolve();
    const bearing = keyBearing(toward);
    pending = bearing;
    latest = bake(land, bearing).then((next) => {
      // A map that changed, or a newer ask, while this one baked.
      if (ground !== land || pending !== bearing) return;
      pending = null;
      upload(next);
    });
    return latest;
  };
  const clear = (): void => {
    map = null;
    pending = null;
    texture?.dispose();
    texture = null;
    haze.uTerrainShade.value = null;
    show();
  };

  return {
    setGround(next, toward, casting) {
      clear();
      ground = next;
      on = casting;
      key = toward;
      return next && toward && on ? ask(toward) : Promise.resolve();
    },
    update(toward, casting) {
      on = casting;
      key = toward;
      show();
      if (!on || !ground || bakedFor(map, toward)) return;
      if (pending !== null && sameBearing(pending, keyBearing(toward))) return;
      void ask(toward);
    },
    settled: () => latest,
    dispose() {
      ground = null;
      clear();
    },
  };
}

/** A depth material a shadow pass draws a caster with — the key light's
 * map and the skiers' own — that throws away every fragment the mountain
 * already shades. Packed as three's own shadow maps are. */
export function createShadeDepth(
  haze: HazeUniforms,
  params: THREE.MeshDepthMaterialParameters = {},
): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    ...params,
  });
  material.customProgramCacheKey = (): string => "terrain-shade-depth";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uSunDir: haze.uSunDir,
      uTerrainShade: haze.uTerrainShade,
      uTerrainShadeBox: haze.uTerrainShadeBox,
      uTerrainShadeOn: haze.uTerrainShadeOn,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vShadeWorld;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
{
  vec4 sw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    sw = instanceMatrix * sw;
  #endif
  vShadeWorld = (modelMatrix * sw).xyz;
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vShadeWorld;\nuniform vec3 uSunDir;\n${TERRAIN_SHADOW_GLSL}`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (terrainLit(vShadeWorld) < 0.5) discard;",
      );
  };
  return material;
}

/** The key light's map's: one per haze object, shared by every caster —
 * three builds a program a kind of mesh (skinned, instanced, plain) off it,
 * and sets its side off each caster's own material as it draws. */
const depths = new WeakMap<HazeUniforms, THREE.MeshDepthMaterial>();
export function shadeDepth(haze: HazeUniforms): THREE.MeshDepthMaterial {
  let material = depths.get(haze);
  if (!material) {
    material = createShadeDepth(haze);
    depths.set(haze, material);
  }
  return material;
}

/** Every caster under `root` draws its depth through `shadeDepth`. */
export function castInLight(root: THREE.Object3D, haze: HazeUniforms): void {
  const depth = shadeDepth(haze);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.castShadow && !o.customDepthMaterial) {
      o.customDepthMaterial = depth;
    }
  });
}
