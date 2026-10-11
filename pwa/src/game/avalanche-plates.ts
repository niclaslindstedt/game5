// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BROKEN SLAB AS DRAWN — the plates the slab cracks into
// (`avalanche-crack.ts`) and the crown's and the flanks' walls, for
// `avalanche-view.ts`.
//
//   * THE PLATES are one instanced draw of a prism with `CORNERS` corners
//     whose outline each instance carries (four vec4s, read by the vertex
//     shader), so every plate is its own irregular polygon at the price of
//     one mesh. Flat-shaded off the pixel's own slope (`flatShading`), the
//     top as white as the snow it was and the broken sides and the
//     underside the blue-grey of snow in its own shade.
//   * THE WALLS are a strip down the crown's line and both flanks', from
//     the old surface to the bed: square to the bed, banded by the slab's
//     layers (the harder ones whiter, the weak layer a darker line at the
//     foot), shaded as the steep face it is. The terrain's own step under
//     it (`avalanche-glsl.ts`) is only as sharp as the ground's mesh is
//     fine; the strip keeps the crown a clean step at any distance.

import * as THREE from "three";
import type { Level, SlabFrame } from "@engine";

import { CORNERS } from "./avalanche-crack.ts";
import { bedDepth, crownAt, SLIDE_LOOK } from "./avalanche-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** The top's shade, the sides' and the underside's. */
const TOP = [0.97, 0.98, 1.0] as const;
const SIDE = [0.66, 0.73, 0.84] as const;
const UNDER = [0.58, 0.65, 0.77] as const;

/** A prism of `CORNERS` corners round its middle (corner `CORNERS`), a
 * unit tall: `aCorner` names the corner a vertex stands on, `aTop` whether
 * it is on the top face. Its outline is the instance's. */
export function plateGeometry(): THREE.BufferGeometry {
  const corner: number[] = [];
  const top: number[] = [];
  const col: number[] = [];
  const put = (c: number, t: number, shade: readonly number[]) => {
    corner.push(c);
    top.push(t);
    col.push(shade[0], shade[1], shade[2]);
  };
  const mid = CORNERS;
  for (let i = 0; i < CORNERS; i++) {
    const j = (i + 1) % CORNERS;
    put(mid, 1, TOP);
    put(i, 1, TOP);
    put(j, 1, TOP);
    put(mid, 0, UNDER);
    put(j, 0, UNDER);
    put(i, 0, UNDER);
    put(i, 1, SIDE);
    put(i, 0, SIDE);
    put(j, 0, SIDE);
    put(i, 1, SIDE);
    put(j, 0, SIDE);
    put(j, 1, SIDE);
  }
  const g = new THREE.BufferGeometry();
  const n = corner.length;
  // Three wants a position and a normal; the shader builds both its own.
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const up = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) up[i * 3 + 1] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(up, 3));
  g.setAttribute("aCorner", new THREE.BufferAttribute(new Float32Array(corner), 1));
  g.setAttribute("aTop", new THREE.BufferAttribute(new Float32Array(top), 1));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  return g;
}

/** The plates' outlines, a vec4 a pair of corners, `most` instances. */
export function outlineAttributes(
  g: THREE.BufferGeometry,
  most: number,
): THREE.InstancedBufferAttribute[] {
  const out: THREE.InstancedBufferAttribute[] = [];
  for (let k = 0; k < CORNERS / 2; k++) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
    g.setAttribute(`aOutline${k}`, a);
    out.push(a);
  }
  return out;
}

/** The plates' material: the haze's Lambert, the prism built off the
 * instance's outline. */
export function plateMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  const corners = Array.from(
    { length: CORNERS / 2 },
    (_, k) => `slabC[${k * 2}] = aOutline${k}.xy;\n  slabC[${k * 2 + 1}] = aOutline${k}.zw;`,
  ).join("\n  ");
  return hazeMaterial(
    new THREE.MeshLambertMaterial({
      color: 0xf4f7fb,
      flatShading: true,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
    haze,
    "avalanche-plates",
    (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float aCorner;
attribute float aTop;
${Array.from({ length: CORNERS / 2 }, (_, k) => `attribute vec4 aOutline${k};`).join("\n")}`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec2 slabC[${CORNERS + 1}];
  ${corners}
  slabC[${CORNERS}] = vec2(0.0);
  vec2 slabAt = slabC[int(aCorner + 0.5)];
  vec3 transformed = vec3(slabAt.x, aTop - 0.5, slabAt.y);`,
        );
    },
  );
}

/** THE WALLS' MATERIAL: the strips' shades lit flat, each vertex drawn a
 * little nearer the lens than it stands — a couple of percent of its
 * distance, 2.5 m at the most — so the ground's mesh, which steps down to
 * the bed over a vertex's spacing rather than at once, does not bury the
 * wall's foot from a lens below the crown. A stretch of wall the crack
 * (`uSlabCrack`, as the bed reads it) has not reached yet is folded
 * up to its top and tucked under the snow. */
export function wallMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  return hazeMaterial(
    new THREE.MeshLambertMaterial({ color: 0xf4f7fb, flatShading: true, vertexColors: true }),
    haze,
    "avalanche-walls",
    (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float aDrop;
uniform vec4 uSlab0;
uniform vec4 uSlabCrack;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
  vec2 wallP = position.xz - uSlab0.xy;
  vec2 wallUv = vec2(wallP.x * uSlab0.w - wallP.y * uSlab0.z, wallP.x * uSlab0.z + wallP.y * uSlab0.w);
  float wallGone = clamp((uSlabCrack.w - length(wallUv - uSlabCrack.xy) / uSlabCrack.z) / 0.1, 0.0, 1.0);
  transformed.y += (aDrop - 0.3) * (1.0 - wallGone);`,
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
  float wallD = length(mvPosition.xyz);
  mvPosition.xyz *= max(0.0, wallD - min(2.5, 0.025 * wallD) * wallGone) / max(wallD, 1e-3);
  gl_Position = projectionMatrix * mvPosition;`,
        );
    },
  );
}

/** THE WALLS: the crown's strip and both flanks', in world space, banded
 * down their height. Both faces of each strip are laid, so it reads from
 * above the crown and from below it. */
export function wallGeometry(
  level: Level,
  slab: SlabFrame,
  phase: readonly number[],
): THREE.BufferGeometry {
  const F = SLIDE_LOOK.flank;
  const pos: number[] = [];
  const col: number[] = [];
  // How far below the old surface each vertex stands: the crack folds it up.
  const drop: number[] = [];
  // Down a wall's height: the old surface, the harder upper layers, the
  // softer, the weak layer — each a band of its own shade.
  const bands = [0, 0.32, 0.7, 0.86, 1] as const;
  const shades = [
    [0.74, 0.8, 0.92],
    [0.58, 0.66, 0.8],
    [0.52, 0.6, 0.76],
    [0.36, 0.42, 0.56],
  ] as const;
  const at = (u: number, v: number) => ({
    x: slab.x + slab.fz * u + slab.fx * v,
    z: slab.z - slab.fx * u + slab.fz * v,
  });
  /** A strip between two feet (u, v), the bed's depth read `inside` m in
   * along (iu, iv). */
  const strip = (u0: number, v0: number, u1: number, v1: number, iu: number, iv: number) => {
    const a = at(u0, v0);
    const b = at(u1, v1);
    const ga = level.groundAt(a.x, a.z);
    const gb = level.groundAt(b.x, b.z);
    const da = bedDepth(slab, phase, u0 + iu, v0 + iv);
    const db = bedDepth(slab, phase, u1 + iu, v1 + iv);
    if (da <= 0.02 && db <= 0.02) return;
    for (let k = 0; k < shades.length; k++) {
      const ya0 = ga - da * bands[k];
      const ya1 = ga - da * bands[k + 1];
      const yb0 = gb - db * bands[k];
      const yb1 = gb - db * bands[k + 1];
      const s = shades[k];
      const quad = [
        [a.x, ya0, a.z],
        [a.x, ya1, a.z],
        [b.x, yb1, b.z],
        [a.x, ya0, a.z],
        [b.x, yb1, b.z],
        [b.x, yb0, b.z],
      ];
      // Both windings: the strip is seen from either side.
      const tops = [ga, ga, gb, ga, gb, gb];
      for (let q = 0; q < quad.length; q++) {
        pos.push(quad[q][0], quad[q][1], quad[q][2]);
        drop.push(tops[q] - quad[q][1]);
      }
      for (let q = quad.length - 1; q >= 0; q--) {
        pos.push(quad[q][0], quad[q][1], quad[q][2]);
        drop.push(tops[q] - quad[q][1]);
      }
      for (let q = 0; q < 12; q++) col.push(s[0], s[1], s[2]);
    }
  };
  // THE CROWN: along its jogging line, across the slab.
  const n = Math.max(8, Math.ceil((slab.left + slab.right) / 1.5));
  for (let i = 0; i < n; i++) {
    const u0 = -slab.right + ((slab.left + slab.right) * i) / n;
    const u1 = -slab.right + ((slab.left + slab.right) * (i + 1)) / n;
    strip(u0, crownAt(phase, u0), u1, crownAt(phase, u1), 0, 0.4);
  }
  // THE FLANKS: down their ragged lines, lower than the crown.
  const m = Math.max(6, Math.ceil(slab.length / 3));
  for (let j = 0; j < m; j++) {
    const v0 = (slab.length * j) / m;
    const v1 = (slab.length * (j + 1)) / m;
    const l0 = slab.left + F.ragged * Math.sin(v0 * F.wave + phase[2]);
    const l1 = slab.left + F.ragged * Math.sin(v1 * F.wave + phase[2]);
    strip(l0, v0, l1, v1, -0.4, 0);
    const r0 = -slab.right - F.ragged * Math.sin(v0 * F.wave * 1.3 + phase[3]);
    const r1 = -slab.right - F.ragged * Math.sin(v1 * F.wave * 1.3 + phase[3]);
    strip(r0, v0, r1, v1, 0.4, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute("aDrop", new THREE.BufferAttribute(new Float32Array(drop), 1));
  g.computeVertexNormals();
  return g;
}
