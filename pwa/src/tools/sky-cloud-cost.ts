// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD PASSES TIMED ALONE — the sky lab's `cloudmotion` sheet's price
// line. A whole frame of the world renderer in the lab's software GL is
// most of a second of everything else, so the cloud's own share is timed
// here on a `createClouds` of its own: each tier's `update` (the shadow
// map, then LOW nothing more, MEDIUM's slab, HIGH's and MAX's volume
// carried a frame on and marched whole) over a few frames, waited on, at
// the cell's size and at 1280 × 720. Software GL: comparable only with
// itself — the real machine's price is the benchmark's (`make bench`).

import * as THREE from "three";
import { withSky, type Level } from "@engine";
import { createClouds, forceCloudTier, refreshCloudVolume } from "../game/clouds.ts";
import { createHazeUniforms } from "../game/haze.ts";
import type { CloudTier } from "../game/settings-video.ts";
import { skyLookAt } from "../game/sky.ts";

type Row = { label: string; tier: CloudTier; whole?: boolean };
const ROWS: Row[] = [
  { label: "LOW", tier: "shell" },
  { label: "MEDIUM", tier: "slab4" },
  { label: "slab8", tier: "slab8" },
  { label: "HIGH", tier: "volume" },
  { label: "HIGH whole", tier: "volume", whole: true },
  { label: "MAX", tier: "volumeFine" },
  { label: "MAX whole", tier: "volumeFine", whole: true },
];

/** The passes timed, ms a frame, as one line. */
export function timeClouds(
  gl: THREE.WebGLRenderer,
  level: Level,
  top: { x: number; y: number; z: number },
  sizes: [number, number][],
): string {
  const ctx = gl.getContext();
  // `finish` returns at once in the lab's GL; a pixel read back waits.
  const px = new Uint8Array(4);
  const sync = (): void => {
    gl.setRenderTarget(null);
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  };
  const haze = createHazeUniforms();
  const clouds = createClouds(gl, haze);
  // The field is the map's own weather's: the map under FAIR at noon.
  const fair = withSky(level, { weather: "fair", hour: 12 });
  const look = skyLookAt(fair, 0);
  haze.uSunPos.value.set(look.sun.x, look.sun.y, look.sun.z);
  clouds.setTier("shell");
  const saved = gl.getSize(new THREE.Vector2());
  const lens = new THREE.PerspectiveCamera(68, 16 / 9, 0.5, 60000);
  const out: string[] = [];
  for (const [w, h] of sizes) {
    gl.setSize(w, h, false);
    lens.aspect = w / h;
    lens.updateProjectionMatrix();
    const parts: string[] = [];
    for (const row of ROWS) {
      forceCloudTier(row.tier);
      // A skier's frame on: the lens a step down the face and turned a
      // little, so HIGH carries rather than cutting.
      const at = (i: number): void => {
        lens.position.set(top.x + i * 0.5, top.y + 8, top.z + i * 0.5);
        lens.lookAt(top.x + 400 + i * 0.5, top.y + 60, top.z + i * 3);
        lens.updateMatrixWorld();
        if (row.whole) refreshCloudVolume();
        clouds.update(look, fair, i / 60, lens);
      };
      for (let i = 0; i < 3; i++) at(i);
      sync();
      const n = row.whole ? 3 : 8;
      const t0 = performance.now();
      for (let i = 3; i < 3 + n; i++) at(i);
      sync();
      parts.push(`${row.label} ${((performance.now() - t0) / n).toFixed(1)}`);
    }
    out.push(`${w}×${h}: ${parts.join(" · ")} ms`);
  }
  forceCloudTier(null);
  gl.setSize(saved.x, saved.y, false);
  clouds.dispose();
  return out.join(" | ");
}
