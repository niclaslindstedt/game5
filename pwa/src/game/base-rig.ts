// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BASE RIG'S OWN PIECES (`chute-gear.ts` and `chute-scene.ts` wear them
// on a wingsuit's run) — the two that look nothing like a sport rig's:
//
//   * THE CONTAINER: a slim single tray (`CHUTE.base.container`), soft and
//     rounded at every edge — a cloth bag over a packed canopy, never a
//     box — its CLOSING FLAP over the back in the suit's accent with a
//     bound seam across its top where the pin cover folds over; the BRIDLE
//     routed out from under the pin cover down the right edge of the flap
//     in its channel to the POUCH across the bottom of the container, the
//     pilot chute's handle out of it to the right; two RISER COVERS up over
//     the shoulders. Its colours are the suit's (`SuitColourway`): flyers
//     order the rig to match.
//   * THE MESH SLIDER: a wingsuit BASE canopy flies with the slider up and
//     a slider of open MESH, a dark tape border round a net that is mostly
//     air — never a solid square from above.

import * as THREE from "three";

import type { SuitColourway } from "./wingsuit-look.ts";

/** A rounded rectangle's outline, `w` by `h` m, corners of radius `r`,
 * centred on the origin. */
function rounded(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A soft slab `w` × `h` × `d` m, every edge rounded by `r`, centred on
 * the origin with its depth along z. */
function pillow(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const bevel = Math.min(r, d / 2 - 0.002);
  const g = new THREE.ExtrudeGeometry(rounded(w - 2 * bevel, h - 2 * bevel, r * 0.8), {
    depth: Math.max(0.002, d - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  g.computeVertexNormals();
  return g;
}

/** The BASE container's materials, painted the suit's colours by `paint`. */
export type BaseColours = {
  cloth: THREE.MeshStandardMaterial;
  flap: THREE.MeshStandardMaterial;
  binding: THREE.MeshStandardMaterial;
  bridle: THREE.MeshStandardMaterial;
};

/** Paint the container in a suit's colourway: the bag in its body's dark
 * (or its base when that is dark), the flap in its accent, the seams in
 * its leading edge's band. */
export function paintBase(m: BaseColours, c: SuitColourway): void {
  const luma = (hex: number): number =>
    0.3 * ((hex >> 16) & 255) + 0.59 * ((hex >> 8) & 255) + 0.11 * (hex & 255);
  m.cloth.color.setHex(luma(c.base) < 90 ? c.base : c.dark);
  m.flap.color.setHex(c.accent);
  m.binding.color.setHex(c.edge === c.accent ? 0xf2f2ee : c.edge);
}

/** BUILD THE CONTAINER into `body` (the harness's group, laid in his chest's
 * frame: x across to his right, y up the spine, z out of his chest), its
 * middle at `mid` and its size `K`, the pouch's top at `pouchY`. Returns
 * the geometries made, for disposal. */
export function buildBaseContainer(
  body: THREE.Group,
  m: BaseColours,
  K: { width: number; height: number; depth: number },
  mid: { y: number; z: number },
): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, y, z);
    body.add(mesh);
    return mesh;
  };
  // THE BAG: soft, its back face swelling a little over the packed canopy.
  add(pillow(K.width, K.height, K.depth, 0.035), m.cloth, 0, mid.y, mid.z);
  const back = mid.z - K.depth / 2;
  // THE CLOSING FLAP over the back, in the accent, its corners rounded.
  add(pillow(K.width * 0.84, K.height * 0.8, 0.012, 0.006), m.flap, 0, mid.y - 0.01, back - 0.002);
  // The pin cover's bound seam across its top...
  const seamY = mid.y + K.height * 0.27;
  add(new THREE.BoxGeometry(K.width * 0.86, 0.018, 0.008), m.binding, 0, seamY, back - 0.008);
  // ...and the binding down both sides of the flap.
  for (const side of [-1, 1]) {
    add(
      new THREE.BoxGeometry(0.012, K.height * 0.78, 0.008),
      m.binding,
      side * K.width * 0.42,
      mid.y - 0.01,
      back - 0.008,
    );
  }
  // THE BRIDLE out from under the pin cover, down the right edge of the
  // flap in its channel to the pouch.
  const bridleTop = seamY - 0.01;
  const bridleFoot = mid.y - K.height / 2 - 0.01;
  add(
    new THREE.BoxGeometry(0.016, bridleTop - bridleFoot, 0.006),
    m.bridle,
    K.width * 0.33,
    (bridleTop + bridleFoot) / 2,
    back - 0.012,
  );
  // THE POUCH across the bottom of the container, rounded, for the big
  // hand-thrown pilot chute.
  add(
    pillow(K.width * 0.82, 0.085, 0.1, 0.03),
    m.cloth,
    0,
    mid.y - K.height / 2 - 0.03,
    mid.z - 0.01,
  );
  add(
    new THREE.BoxGeometry(K.width * 0.7, 0.014, 0.006),
    m.binding,
    0,
    mid.y - K.height / 2 - 0.004,
    mid.z - 0.062,
  );
  // THE RISER COVERS up over the shoulders, the flap's colour.
  for (const side of [-1, 1]) {
    const cover = add(
      pillow(0.075, 0.13, 0.03, 0.012),
      m.flap,
      side * 0.105,
      mid.y + K.height / 2 + 0.02,
      mid.z + 0.03,
    );
    cover.rotation.x = -0.35;
  }
  return geos;
}

/** THE MESH SLIDER's paint: a dark tape border round a net of threads, the
 * holes clear — painted in code, a texture a side `n` px. */
function meshTexture(n = 64): THREE.DataTexture {
  const data = new Uint8Array(n * n * 4);
  const tape = 3;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const edge = x < tape || y < tape || x >= n - tape || y >= n - tape;
      const thread = x % 4 === 0 || y % 4 === 0;
      const v = edge ? 120 : 230;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = edge ? 255 : thread ? 200 : 0;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** The mesh slider's material: light, mostly see-through, both sides. */
export function meshSliderMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: meshTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });
}

/** The slider's corners' place on its texture, in the order its four
 * grommets are written (`chute-scene.ts`). */
export const SLIDER_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
