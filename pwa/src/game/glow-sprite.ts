// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GLOW every lamp's halo is drawn with — the finish arena's floods
// (`gates.ts`) and the skiers' headlamps (`headlamp.ts`): one small texture,
// made once and shared.

import * as THREE from "three";

/** A soft round glow, white at the middle — every lamp's sprite. */
let glowTexture: THREE.DataTexture | null = null;
export function glow(): THREE.DataTexture {
  if (glowTexture) return glowTexture;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const v = Math.max(0, 1 - r);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * v * v * v);
    }
  }
  glowTexture = new THREE.DataTexture(data, n, n);
  glowTexture.magFilter = glowTexture.minFilter = THREE.LinearFilter;
  glowTexture.needsUpdate = true;
  return glowTexture;
}
