// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW ON A TREE, TREE BY TREE. A shape is built once a variant with its
// boughs as loaded as the region's snow makes them (`tree-shapes.ts`); in a
// real wood no two trees carry the same load — one has shed half of it in
// the last wind, the next is plastered. So every white face of a shape is
// TAGGED here with what lies under it (the kind's needles, lit or in shade,
// a face at a time as the builder paints them) and a RANK, one a clump of
// faces, and each tree carries a LOAD (`forest-batch.ts`'s table): a face
// ranked above the tree's load is drawn as the needles it covered. The
// ranks go by clumps — faces near each other on a bough share one — so a
// tree sheds snow as boughs do, a patch at a time, never as speckle.
//
// THE SHAPES ARE ALSO PACKED here: the colours as 16-bit shares and the
// normals as bytes, so tens of shapes in one batch cost a third less on
// the card. The position and the trunk's `stem` stay floats (the girth's
// shove reads them exactly).

import * as THREE from "three";

/** Whether a vertex colour is the snow (`SNOW` or `SNOW_SHADE`, or a blend
 * of the two): bright, and bluer than any needle or bark. */
function isSnow(r: number, g: number, b: number): boolean {
  return r > 0.45 && g > 0.5 && b > 0.6 && b >= r;
}

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Tag `g`'s snow (`snowy`: the colour under it in rgb, the rank in a — 0
 * for a face that is not snow) and pack its colours and normals. `lit` and
 * `shade` are the needles the snow lies on, face by face. */
export function packTree(
  g: THREE.BufferGeometry,
  lit: THREE.Color,
  shade: THREE.Color,
): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  const nrm = g.getAttribute("normal");
  const n = pos.count;
  const snowy = new Uint8Array(n * 4);
  for (let t = 0; t + 2 < n; t += 3) {
    let white = 0;
    for (let k = 0; k < 3; k++) {
      if (isSnow(col.getX(t + k), col.getY(t + k), col.getZ(t + k))) white++;
    }
    if (white === 0) continue;
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    // A clump: a third of a crown across and a tenth of the height up.
    const rank = hash3(Math.round(cx * 3), Math.round(cy * 10), Math.round(cz * 3));
    const under = hash3(cx * 41, cy * 17, cz * 29) < 0.5 ? lit : shade;
    for (let k = 0; k < 3; k++) {
      const v = t + k;
      if (!isSnow(col.getX(v), col.getY(v), col.getZ(v))) continue;
      snowy[v * 4] = Math.round(under.r * 255);
      snowy[v * 4 + 1] = Math.round(under.g * 255);
      snowy[v * 4 + 2] = Math.round(under.b * 255);
      // Never 0 (that says "no snow"), never quite 1 (a full load keeps it).
      snowy[v * 4 + 3] = 1 + Math.round(rank * 253);
    }
  }
  const colours = new Uint16Array(n * 3);
  const normals = new Int8Array(n * 3);
  for (let v = 0; v < n; v++) {
    colours[v * 3] = Math.round(Math.min(1, col.getX(v)) * 65535);
    colours[v * 3 + 1] = Math.round(Math.min(1, col.getY(v)) * 65535);
    colours[v * 3 + 2] = Math.round(Math.min(1, col.getZ(v)) * 65535);
    normals[v * 3] = Math.round(nrm.getX(v) * 127);
    normals[v * 3 + 1] = Math.round(nrm.getY(v) * 127);
    normals[v * 3 + 2] = Math.round(nrm.getZ(v) * 127);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colours, 3, true));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
  g.setAttribute("snowy", new THREE.BufferAttribute(snowy, 4, true));
  return g;
}

/** THE TREE'S SNOW AND TINT in the vertex shader, after the batch's own
 * lines (`tbData.w` the load, `tbMore.rgb` the tint): a face ranked over the
 * load is the needles under it; the rest of the tree's green and bark take
 * its tint. */
export const TREE_SNOW_PARS = /* glsl */ `
attribute vec4 snowy;
`;

export const TREE_SNOW_VERTEX = /* glsl */ `
  if (snowy.a > 0.0) {
    if (snowy.a > tbData.w) vColor.rgb = snowy.rgb * tbMore.rgb;
  } else {
    vColor.rgb *= tbMore.rgb;
  }
  vColor.rgb *= tbData.z;
`;

/** THE WIND IN THE CROWNS: a tree bent along the wind by the square of how
 * far up it a point stands, and swung about that bend at a pace and phase
 * of its own (`tbMore.w`, the tree's hash) — the tops move, the feet never.
 * A tree of height H in a wind of V m/s leans its top about 0.0004·V·H
 * and sways as much again either side; in a storm's 25 m/s a 20 m spruce's
 * top swings a few tenths of a metre. `uTreeWind` is the wind's x and z in
 * m/s and the run's clock; the shove is reckoned in the world and turned
 * back into the tree's own frame, so its matrix puts it where the wind
 * says. The picture's and the shadow's alike, so the shadows sway with the
 * trees. */
export const TREE_WIND_PARS = /* glsl */ `
uniform vec4 uTreeWind;
`;

export const TREE_WIND_VERTEX = /* glsl */ `
{
  float twSpeed = length(uTreeWind.xy);
  if (twSpeed > 0.05 && transformed.y > 0.0) {
    float twH = transformed.y * transformed.y;
    float twPhase = uTreeWind.w * (1.1 + 0.6 * tbMore.w) + tbMore.w * 6.2831853;
    float twSwing = 0.0004 + 0.0004 * sin(twPhase) + 0.00015 * sin(twPhase * 2.7 + 1.3);
    mat3 twM = mat3(batchingMatrix);
    float twHeight = length(twM[1]);
    vec3 twWorld = vec3(uTreeWind.x, 0.0, uTreeWind.y) * (twH * twSwing * twHeight);
    transformed += inverse(twM) * twWorld;
  }
}
`;
