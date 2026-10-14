// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE HE IS RUN THROUGH, RED AT ITS TIP — a skier come down onto a
// tree's top (`GoreState.impaled`) sinks down its stem, and the stem he
// was dragged down takes his blood: red from the tip to a little under
// where he hangs, and green below.
//
// The woods are not touched. The tree is drawn a second time over itself —
// the same variant, place, lean, size and girth (`tree-place.ts`), a hair
// larger and pulled toward the lens — in a material that paints its own
// colours as blood (the snow on the boughs a bright red, the needles a
// dark one, the bark near black) above a ragged edge
// and draws nothing below it, so under it the wood is its own.
// Only a run with the mortal wounds has it (`gore-view.ts`), so a run
// with the INJURIES switch off never sees one.

import * as THREE from "three";
import { regionOf, type GameState, type Level, type TreeDef } from "@engine";

import { regionLookOf } from "./region-look.ts";
import { summerShown } from "./season-look.ts";
import { graftGirth } from "./tree-mesh.ts";
import { createTreePlace, placeTree } from "./tree-place.ts";
import { buildTree, summerPaint, treePaint } from "./tree-shapes.ts";
import { treeVariant, VARIANTS } from "./tree-variants.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** How the blood takes the tree: `under` m red below where he hangs, how
 * ragged the edge is (`ragged`, of the height either way), and how much
 * larger than the tree it is drawn (`grow`). */
export const BLOOD_TREE = { under: 0.35, ragged: 0.03, grow: 1.02 } as const;

/** The share of the tree red, from its tip down, while he hangs `sunk` m
 * under its tip. */
export function bloodFront(height: number, sunk: number): number {
  return Math.min(1, (sunk + BLOOD_TREE.under) / height);
}

export type BloodTrees = {
  group: THREE.Group;
  update(state: GameState): void;
  /** Every red tree gone (the map's bodies cleared). */
  clear(): void;
  dispose(): void;
};

type Stain = {
  tree: number;
  /** The run clock he was run through at, to tell his run from the next. */
  t: number;
  front: number;
  mesh: THREE.Mesh;
  uniform: { value: number };
};

/** The tree `at` names: the one standing on that spot. */
function treeAt(level: Level, x: number, z: number): number {
  let best = -1;
  let d = 0.05;
  level.trees.forEach((t, i) => {
    const e = Math.hypot(t.x - x, t.z - z);
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}

const BLOOD_GLSL = `
  float bloodDrip = fract(sin(dot(floor(vBloodAt.xz * 7.0), vec2(12.9898, 78.233))) * 43758.5453);
  float bloodWave = sin(vBloodAt.x * 23.0 + vBloodAt.z * 17.0) * 0.5 + 0.5;
  float bloodLeft = uBloodFront + ${BLOOD_TREE.ragged.toFixed(3)} * (bloodDrip + 0.6 * bloodWave - 0.8) - (1.0 - vBloodAt.y);
  if (bloodLeft < 0.0) discard;
  float bloodLight = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 bloodRed = mix(vec3(0.05, 0.003, 0.004), vec3(0.4, 0.012, 0.018), smoothstep(0.04, 0.8, bloodLight));
  // Streaked where it ran thick and thin, never one flat paint.
  float bloodStreak = fract(sin(dot(floor(vBloodAt.xz * 31.0 + vBloodAt.y * 3.0), vec2(39.3468, 11.135))) * 24634.6345);
  bloodRed *= mix(0.55, 1.15, bloodStreak * 0.6 + bloodWave * 0.4);
  // Darker along its edge, where it runs thin.
  bloodRed *= mix(0.62, 1.0, smoothstep(0.0, 0.05, bloodLeft));
  diffuseColor.rgb = bloodRed;`;

export function createBloodTrees(
  level: Level,
  wrap: Wrap,
  variants: () => number = () => VARIANTS,
): BloodTrees {
  const group = new THREE.Group();
  group.name = "gore-trees";
  const region = treePaint(regionLookOf(regionOf(level).id));
  const paint = summerShown() ? summerPaint(region) : region;
  const place = createTreePlace();
  const stains: Stain[] = [];

  const stain = (tree: number, t: number): Stain => {
    const def: TreeDef = level.trees[tree];
    const geo = buildTree(treeVariant(def.kind, def.x, def.z, variants()), paint, 0);
    placeTree(level, def, place);
    const girth = new Float32Array(geo.getAttribute("position").count * 2);
    for (let k = 0; k < girth.length; k += 2) {
      girth[k] = place.girth[0];
      girth[k + 1] = place.girth[1];
    }
    geo.setAttribute("girth", new THREE.BufferAttribute(girth, 2));
    const uniform = { value: 0 };
    const material = wrap(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      }),
      "gore-tree",
    );
    const haze = material.onBeforeCompile.bind(material);
    material.customProgramCacheKey = (): string => "haze:gore-tree";
    material.onBeforeCompile = (shader, renderer) => {
      haze(shader, renderer);
      graftGirth(shader);
      shader.uniforms.uBloodFront = uniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vBloodAt;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vBloodAt = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vBloodAt;\nuniform float uBloodFront;",
        )
        .replace("#include <color_fragment>", `#include <color_fragment>\n${BLOOD_GLSL}`);
    };
    const mesh = new THREE.Mesh(geo, material);
    const B = BLOOD_TREE;
    mesh.position.copy(place.p);
    mesh.quaternion.copy(place.q);
    mesh.scale.set(place.s.x * B.grow, place.s.y * (1 + (B.grow - 1) / 4), place.s.z * B.grow);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    const s: Stain = { tree, t, front: 0, mesh, uniform };
    stains.push(s);
    return s;
  };

  const forget = (s: Stain) => {
    group.remove(s.mesh);
    s.mesh.geometry.dispose();
    (s.mesh.material as THREE.Material).dispose();
  };

  return {
    group,
    update(state) {
      const at = state.gore?.impaled;
      const live = at?.stuff === "tree" ? at : null;
      let mine: Stain | null = null;
      if (live) {
        mine = stains.find((s) => s.t === live.t && level.trees[s.tree]?.x === live.x) ?? null;
        if (!mine) {
          const tree = treeAt(level, live.x, live.z);
          if (tree >= 0) mine = stain(tree, live.t);
        }
        if (mine) {
          const h = level.trees[mine.tree].height;
          mine.front = Math.max(mine.front, bloodFront(h, live.sunk));
        }
      }
      for (const s of stains) s.uniform.value = s.front;
    },
    clear() {
      for (const s of stains) forget(s);
      stains.length = 0;
    },
    dispose() {
      this.clear();
    },
  };
}
