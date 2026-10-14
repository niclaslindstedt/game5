// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW IN THE AIR AS DRAWN — every grain and clump of the spray
// (`spray.ts`) and every puff of the cloud (`snow-cloud.ts`) the last frame
// drew, read back off their instanced draws as `spray-film.ts`'s bits, so
// the snow eval lab's film score measures exactly what the picture shows.
// An instrument (`DevRenderer.plumes`), never read by the game.

import type * as THREE from "three";

import type { PlumeBit } from "./spray-film.ts";

/** The bits one instanced draw holds: `spot` its xyz and size per instance
 * (`across` true when the size is a diameter), `alpha` the attribute and
 * the component its opacity is in; each bit's age off the draw's
 * `userData.age` when it keeps one. */
function readDraw(
  object: THREE.Object3D | null,
  spot: string,
  across: boolean,
  alpha: string,
  slot: number,
  out: PlumeBit[],
): void {
  const geometry = (object as THREE.Mesh | null)?.geometry as
    THREE.InstancedBufferGeometry | undefined;
  if (!geometry) return;
  const p = geometry.getAttribute(spot)?.array as Float32Array | undefined;
  const a = geometry.getAttribute(alpha)?.array as Float32Array | undefined;
  if (!p || !a) return;
  const age = geometry.userData.age as Float32Array | undefined;
  for (let n = 0; n < geometry.instanceCount; n++) {
    out.push({
      x: p[n * 4],
      y: p[n * 4 + 1],
      z: p[n * 4 + 2],
      r: across ? p[n * 4 + 3] / 2 : p[n * 4 + 3],
      a: a[n * 4 + slot],
      age: age ? age[n] : undefined,
    });
  }
}

/** The spray's and the cloud's bits, the spray's first. */
export function plumeBits(spray: THREE.Object3D | null, cloud: THREE.Object3D | null): PlumeBit[] {
  const out: PlumeBit[] = [];
  readDraw(spray, "aSpot", true, "aMove", 3, out);
  readDraw(cloud, "iPos", false, "iLook", 0, out);
  return out;
}
