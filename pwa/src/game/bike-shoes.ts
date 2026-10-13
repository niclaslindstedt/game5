// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOWNHILL RIDER'S FLAT SHOES, worn in place of the ski boots on the
// bike's ride (`skis-body.ts`' `setBiking`): a low skate-cut upper of
// suede, a padded collar round the ankle and a tongue, laces, a flat
// gum-black sole made to grip a flat pedal's pins, a pale flash down the
// side. Hung in the walking boots' own groups (`town-boots.ts`), so the
// same frame puts them on the feet — the origin the boot cuff's top,
// `height` over the sole — and shown instead of the boots.

import * as THREE from "three";

import { loft, plate } from "./bike-kit.ts";

/** Put a pair of shoes into `boots` (the walking boots' two groups), hidden;
 * `show(true)` swaps them in for the boots. */
export function addBikeShoes(
  boots: THREE.Group[],
  height: number,
  mat: (p: THREE.MeshStandardMaterialParameters) => THREE.Material,
  keep: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
): { show(on: boolean): void } {
  const suede = mat({ color: 0x35373b, roughness: 0.95 });
  const sole = mat({ color: 0x18181a, roughness: 0.9 });
  const flash = mat({ color: 0xd8d6cf, roughness: 0.7 });
  // The sole's underside, from the cuff's top.
  const b = -height;
  const parts: THREE.Mesh[] = [];
  for (const group of boots) {
    const kids = [...group.children];
    const add = (g: THREE.BufferGeometry, m: THREE.Material): void => {
      const mesh = new THREE.Mesh(keep(g), m);
      mesh.visible = false;
      mesh.castShadow = true;
      group.add(mesh);
      parts.push(mesh);
    };
    // The sole, flat, its toe turned up a little.
    add(
      plate(
        [
          [-0.088, b + 0.004],
          [-0.08, b],
          [0.17, b],
          [0.198, b + 0.008],
          [0.204, b + 0.022],
          [-0.092, b + 0.024],
        ],
        0.104,
        { bevel: 0.008 },
      ),
      sole,
    );
    // The upper, heel to toe.
    add(
      loft(
        [
          { x: 0, y: b + 0.052, z: -0.082 },
          { x: 0, y: b + 0.058, z: -0.03 },
          { x: 0, y: b + 0.05, z: 0.06 },
          { x: 0, y: b + 0.04, z: 0.135 },
          { x: 0, y: b + 0.032, z: 0.19 },
        ],
        (u) => ({
          w: u < 0.3 ? 0.043 + u * 0.03 : 0.052 - (u - 0.3) * 0.03,
          h: u < 0.4 ? 0.034 : 0.034 - (u - 0.4) * 0.03,
        }),
        { sides: 18, square: 2.6 },
      ),
      suede,
    );
    // The collar and the tongue.
    add(
      loft(
        [
          { x: 0, y: b + 0.06, z: -0.04 },
          { x: 0, y: b + 0.112, z: -0.035 },
        ],
        { w: 0.043, h: 0.05 },
        { sides: 16, rings: 2, straight: true, square: 2.4 },
      ),
      suede,
    );
    add(
      loft(
        [
          { x: 0, y: b + 0.115, z: 0.01 },
          { x: 0, y: b + 0.085, z: 0.07 },
          { x: 0, y: b + 0.07, z: 0.11 },
        ],
        { w: 0.026, h: 0.008 },
        { sides: 10, square: 2.6 },
      ),
      suede,
    );
    // The laces across the tongue, and the flash down each side.
    for (let k = 0; k < 4; k++) {
      const z = 0.03 + k * 0.022;
      add(
        loft(
          [
            { x: -0.026, y: b + 0.098 - k * 0.008, z },
            { x: 0.026, y: b + 0.098 - k * 0.008, z },
          ],
          { w: 0.0025, h: 0.0035 },
          { sides: 6, rings: 1, straight: true, side: { x: 0, y: 0, z: 1 } },
        ),
        flash,
      );
    }
    for (const s of [-1, 1]) {
      add(
        plate(
          [
            [-0.06, b + 0.035],
            [0.08, b + 0.03],
            [0.11, b + 0.045],
            [-0.03, b + 0.06],
          ],
          0.004,
          { x: s * 0.051, bevel: 0.001 },
        ),
        flash,
      );
    }
    // The boot's own meshes, to be swapped out.
    for (const k of kids) parts.push(k as THREE.Mesh);
  }
  const shoes = new Set(parts.filter((m) => !m.visible));
  return {
    show(on) {
      for (const m of parts) m.visible = shoes.has(m) ? on : !on;
    },
  };
}
