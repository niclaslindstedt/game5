// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRASS — blades and a few flowers standing in the summer ground near
// the lens, swaying in the wind. The ground's own shader draws the meadow
// at every distance (`summer-glsl.ts`); this is only what a flat colour
// cannot be close in: blades a hand to a shin tall that stand up against
// the light and move.
//
// HOW IT IS DRAWN. One instanced draw a patch, no buffer ever rewritten: a
// TUFT (a few tapered blades and a flower head) is laid on every cell of a
// square patch round the lens, and the vertex shader places each cell on
// the world's own grid — wrapped round the lens, so a tuft stands at the
// same spot whichever way the lens comes at it, and the patch never pops.
// Two patches: a fine one close in and a coarse one past it, its tufts
// larger and fewer, the inner one's ground left to the fine. A tuft reads
// the ground it stands on off the very textures the terrain does — the
// height, the engine's summer field (`summer-ground.ts`), the forest — so
// nothing grows on a snow patch, a scar, a cat track, rock, scree, a
// street or a lake, it grows short on a run and above the tree line, and
// it thins with distance to nothing at the patch's reach (the FOREST row's,
// `FOREST_LOOK`'s `grass`). The wind is the map's mean wind and its gusts,
// a pure function of the clock the renderer hands it.

import * as THREE from "three";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { GrassLook } from "./settings-video.ts";
import { LOOSE } from "./trail-stamp.ts";

/** What the FOREST row buys of the grass (`settings-video.ts`). */
export type { GrassLook };

/** The blades of a tuft, and the patches' cells. */
const BLADES = 6;
const NEAR = { cells: 72, cell: 0.38 };
const FAR_CELLS = 72;

export type Grass = {
  readonly group: THREE.Group;
  /** Stand the patches round the lens at (`x`, `z`), at run time `t` s. */
  follow(x: number, z: number, t: number): void;
  dispose(): void;
};

/** The uniforms the terrain shares with the grass: the ground's textures
 * and the summer palette, the same objects. */
export type GrassGround = Record<string, THREE.IUniform>;

/** One tuft: `BLADES` tapered blades (two triangles each) round its middle
 * and a flower head, a flat five-petalled star at the top. Each vertex carries its
 * place in the tuft: (x, z) off the middle, its height share, and which
 * blade (−1 the flower). */
function tuftGeometry(): THREE.InstancedBufferGeometry {
  const pos: number[] = [];
  const blade: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI * 2 + b * 1.7;
    const r = 0.06 + 0.1 * (((b * 7) % 5) / 5);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    // The blade faces a turn of its own; 3.4 cm wide at the root.
    const f = a * 1.9 + 0.6;
    const wx = Math.cos(f) * 0.017;
    const wz = Math.sin(f) * 0.017;
    const corners: [number, number, number][] = [
      [cx - wx, 0, cz - wz],
      [cx + wx, 0, cz + wz],
      [cx - wx * 0.35, 0.6, cz - wz * 0.35],
      [cx + wx * 0.35, 0.6, cz + wz * 0.35],
      [cx, 1, cz],
    ];
    for (const [x, h, z] of corners) {
      pos.push(x, h, z);
      blade.push(cx, cz, h, b);
    }
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4);
    v += 5;
  }
  // THE FLOWER: a five-petalled star 3 cm across laid flat on top of the
  // stem — seen across a meadow it foreshortens to a blossom, where a card
  // stood on edge reads as a flat chip of paint at a step's distance.
  const centre = v;
  pos.push(0, 1.01, 0);
  blade.push(0, 0, 1, -1);
  v += 1;
  const tips = 10;
  for (let k = 0; k < tips; k++) {
    const a = (k / tips) * Math.PI * 2;
    const r = k % 2 === 0 ? 0.016 : 0.006;
    pos.push(Math.cos(a) * r, 1, Math.sin(a) * r);
    blade.push(0, 0, 1, -1);
  }
  for (let k = 0; k < tips; k++) idx.push(centre, centre + 1 + k, centre + 1 + ((k + 1) % tips));
  v += tips;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aBlade", new THREE.Float32BufferAttribute(blade, 4));
  // The shader sets every normal off the ground under the tuft; the
  // attribute is there so three does not flat-shade a mesh with none.
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(idx);
  return g;
}

/** The cells of a patch, `n` a side: (i, j). */
function cellsOf(n: number): THREE.InstancedBufferAttribute {
  const a = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      a[(j * n + i) * 2] = i;
      a[(j * n + i) * 2 + 1] = j;
    }
  }
  return new THREE.InstancedBufferAttribute(a, 2);
}

const GRASS_VERTEX_PARS = /* glsl */ `
uniform sampler2D uHeight;
uniform sampler2D uGround;
uniform sampler2D uSummerA;
uniform sampler2D uSummerB;
uniform vec2 uSummerSize;
uniform vec3 uSummerBands;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec3 uSumLow;
uniform vec3 uSumHigh;
uniform vec3 uSumTop;
uniform vec3 uSumDry;
uniform vec2 uSumShares;
uniform vec2 uGrassEye;
uniform vec4 uGrassPatch;
uniform vec4 uGrassWind;
uniform vec2 uGrassBand;
uniform float uGrassTime;
attribute vec2 aCell;
attribute vec4 aBlade;
varying vec3 vGrassCol;
float grassHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float grassNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(grassHash(i), grassHash(i + vec2(1, 0)), u.x),
             mix(grassHash(i + vec2(0, 1)), grassHash(i + vec2(1, 1)), u.x), u.y);
}
float grassHeight(vec2 p) {
  vec2 f = clamp((p - uHeightOrigin) / uCell, vec2(0.0), uHeightCount - 1.001);
  ivec2 c = ivec2(floor(f));
  vec2 t = f - floor(f);
  float a = texelFetch(uHeight, c, 0).r;
  float b = texelFetch(uHeight, c + ivec2(1, 0), 0).r;
  float d = texelFetch(uHeight, c + ivec2(0, 1), 0).r;
  float e = texelFetch(uHeight, c + ivec2(1, 1), 0).r;
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y);
}
`;

/** Where the tuft stands, how tall, its colour, and the blade's vertex. */
const GRASS_VERTEX_BEGIN = /* glsl */ `
float gCellSize = uGrassPatch.x;
float gSpan = uGrassPatch.y * gCellSize;
vec2 gLow = uGrassEye - 0.5 * gSpan;
vec2 gLocal = (aCell + 0.5) * gCellSize;
vec2 gAt = gLow + mod(gLocal - gLow, gSpan);
vec2 gId = floor(gAt / gCellSize);
float h1 = grassHash(gId * 0.731 + 3.1);
float h2 = grassHash(gId * 1.37 + 7.7);
float h3 = grassHash(gId * 0.519 + 1.3);
gAt += (vec2(h1, h2) - 0.5) * gCellSize * 0.9;
float gDist = distance(gAt, uGrassEye);
vec2 guv = (gAt - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
vec4 gG = texture2D(uGround, guv);
vec2 suv = gAt / uSummerSize;
vec4 sA = texture2D(uSummerA, suv);
vec4 sB = texture2D(uSummerB, suv);
float gy = grassHeight(gAt) + ${LOOSE.toFixed(3)} * (1.0 - gG.b);
float slope = length(gG.rg);
float above = smoothstep(uSummerBands.y - 20.0, uSummerBands.y + 30.0, gy + (grassNoise(gAt * 0.02) - 0.5) * 60.0);
// What grows here, 0 nothing .. 1 a full tuft.
float grow = 1.0 - smoothstep(0.25, 0.45, max(max(sA.r, sA.g), max(sA.b, sA.a)));
grow *= 1.0 - smoothstep(0.3, 0.6, sB.a);
grow *= 1.0 - smoothstep(0.6, 0.85, slope);
grow *= 1.0 - 0.75 * smoothstep(0.3, 0.8, gG.a);
grow *= 1.0 - 0.7 * smoothstep(0.3, 0.6, sB.b);
// Thinned with distance to the whole grass's reach and by the row's share;
// the fine patch hands over to the coarse one across a ring three metres
// wide (its band's outer edge, the coarse one's inner).
float keep = uGrassPatch.w * (1.0 - smoothstep(uGrassPatch.z * 0.3, uGrassPatch.z, gDist));
keep *= smoothstep(uGrassBand.x, uGrassBand.x + 3.0, gDist) * (1.0 - smoothstep(uGrassBand.y - 3.0, uGrassBand.y, gDist));
float alive = step(h3, keep) * grow;
// How tall: a meadow's shin-high, a run's and the turf's a hand.
float clump = grassNoise(gAt * 0.35);
float tall = mix(0.18, 0.5, clump) * mix(1.0, 0.4, smoothstep(0.3, 0.7, sB.r)) * mix(1.0, 0.45, above);
tall *= mix(0.6, 1.25, h1) * alive;
tall = min(tall, 0.85) * (1.0 - smoothstep(uGrassPatch.z * 0.35, uGrassPatch.z, gDist));
// THE FLOWERS, more in a high meadow in July.
float band = clamp((gy - uSummerBands.x) / max(uSummerBands.y - uSummerBands.x, 1.0), 0.0, 1.0);
float bloom = 0.05 + uSumShares.y * (0.5 + band) * smoothstep(0.35, 0.75, grassNoise(gAt * 0.08 + 5.0));
float flower = aBlade.w < 0.0 ? step(h2, bloom * (1.0 - above * 0.6)) : 1.0;
// THE WIND: the map's mean wind and its gusts running down it, the tip
// moved the most.
vec2 wDir = uGrassWind.xy;
float gust = grassNoise(gAt * 0.08 - wDir * uGrassTime * 0.6);
float sway = (0.35 + 0.65 * gust) * uGrassWind.z;
float lean = aBlade.z * aBlade.z;
vec2 swing = wDir * sway * 0.6 + vec2(sin(uGrassTime * 2.3 + h1 * 6.28), cos(uGrassTime * 1.9 + h2 * 6.28)) * 0.08 * (0.3 + sway);
float turn = h3 * 6.2831;
mat2 rot = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
vec3 gPos;
// The coarse patch's blades are wider (never its flowers); every tuft
// shrinks into the ground over the last of the reach rather than ending.
vec2 off = rot * (position.xz * (aBlade.w < 0.0 ? 1.0 : mix(1.0, 1.6, step(0.5, uGrassPatch.x)))) * step(0.001, tall * flower);
gPos.xz = gAt + off + swing * lean * tall;
gPos.y = gy + position.y * tall * flower * (1.0 - 0.25 * dot(swing, swing) * lean);
// Lit as the ground it stands in.
vec3 objectNormal = normalize(vec3(-gG.r, 1.0, -gG.g));
// THE COLOUR: the ground's own grass at the tuft, darker at the root.
vec3 base = mix(uSumLow, uSumHigh, smoothstep(0.15, 0.95, band));
base = mix(base, uSumTop, above);
base = mix(base, uSumDry, uSumShares.x * smoothstep(0.45, 0.8, grassNoise(gAt * 0.0103 + 17.0)) * 0.7);
base *= mix(0.85, 1.2, h2) * mix(0.78, 1.18, aBlade.z);
// Mostly white and cream umbels and daisies, then yellow, a few purple and blue.
vec3 petal = h1 < 0.6 ? vec3(0.82, 0.82, 0.74) : h1 < 0.8 ? vec3(0.85, 0.65, 0.08) : h1 < 0.92 ? vec3(0.45, 0.25, 0.6) : vec3(0.25, 0.35, 0.8);
vGrassCol = aBlade.w < 0.0 ? petal : base;
`;

function grassMaterial(haze: HazeUniforms, own: GrassGround): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  hazeMaterial(material, haze, "summer-grass", (shader) => {
    Object.assign(shader.uniforms, own);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GRASS_VERTEX_PARS}`)
      // The tuft is placed where the normal is begun, so the normal can be
      // the ground's under it.
      .replace("#include <beginnormal_vertex>", GRASS_VERTEX_BEGIN)
      .replace("#include <begin_vertex>", "vec3 transformed = gPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrassCol;")
      // Both faces lit alike: a blade's back is the same grass.
      .replace(
        "#include <normal_fragment_begin>",
        "#include <normal_fragment_begin>\nnormal = normalize(vNormal);",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = vGrassCol;",
      );
  });
  return material;
}

/** THE GRASS round the lens on a summer map, on the ground's uniforms
 * `ground`, as the row's `look` buys it. */
export function createGrass(haze: HazeUniforms, ground: GrassGround, look: GrassLook): Grass {
  const group = new THREE.Group();
  group.name = "summer-grass";
  const geometry = tuftGeometry();
  const patches: { mesh: THREE.Mesh; eye: THREE.Vector2; time: { value: number } }[] = [];
  const farCell = Math.max(0.9, (2 * look.reach) / FAR_CELLS);
  const nearReach = (NEAR.cells * NEAR.cell) / 2;
  const plans = [
    {
      cells: NEAR.cells,
      cell: NEAR.cell,
      inner: -3,
      outer: look.reach > nearReach ? nearReach : look.reach + 3,
    },
    ...(look.reach > nearReach
      ? [{ cells: FAR_CELLS, cell: farCell, inner: nearReach - 3, outer: look.reach + 3 }]
      : []),
  ];
  for (const plan of plans) {
    const g = geometry.clone() as THREE.InstancedBufferGeometry;
    g.setAttribute("aCell", cellsOf(plan.cells));
    g.instanceCount = plan.cells * plan.cells;
    const eye = new THREE.Vector2();
    const time = { value: 0 };
    const own: GrassGround = {
      ...ground,
      uGrassEye: { value: eye },
      uGrassPatch: { value: new THREE.Vector4(plan.cell, plan.cells, look.reach, look.share) },
      uGrassBand: { value: new THREE.Vector2(plan.inner, plan.outer) },
      uGrassTime: time,
    };
    const mesh = new THREE.Mesh(g, grassMaterial(haze, own));
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    patches.push({ mesh, eye, time });
  }
  geometry.dispose();
  return {
    group,
    follow(x, z, t) {
      for (const p of patches) {
        p.eye.set(x, z);
        p.time.value = t;
      }
    },
    dispose() {
      for (const p of patches) {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
      }
    },
  };
}
