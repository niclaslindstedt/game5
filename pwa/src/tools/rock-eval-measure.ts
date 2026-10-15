// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB's READINGS (`rock-eval-harness.ts` wires them): the
// rock built from scratch at a scene's lens, the physics gap, the frame
// read back, the shimmer and the approach.
//
// EVERY READING STARTS FROM NOTHING (`reset`): the rock's tiles keep the cut
// they were last built at until they are well past a band's edge
// (`rocks.ts`'s hysteresis), so a scene read after a lens that stood nearer
// or farther found tiles at a different cut — round 1's face-400 shimmer
// read 1.16 in one pass and 0.40 in the next on the same build. So before
// any scene, shimmer or approach the rock is let go whole (a candidate's
// `rocks` group may expose `userData.rockReset`; without it the lens is
// stood far off the map for a frame, past every tile's keep, which lets
// every tile and every tree's hand-over go) and then built whole at the
// scene's own lens (`userData.rockSettle`), so what a scene reads is a pure
// function of its lens.
//
// Two hooks a candidate may hang on the `terrain` group, for rock drawn
// inside the ground's own shader (not separable by hiding `rocks`):
//   - `userData.rockGround(on: boolean)`: turn that rock off and on, so the
//     lab prices it (the frame with it, the frame without);
//   - `userData.rockDrawnAt(x, z): number | null`: the height the ground
//     draws its rock at (null where it draws none), so the lab holds it to
//     the ridden surface like a skin's triangles.

import { onAnyCliff, rockShare, type Level } from "@engine";
import * as THREE from "three";

import type { LensPose } from "../game/camera-rigs.ts";
import type { WorldRendererExt } from "../game/renderer-api.ts";

/** The drawn rock against the rock a body meets, m: every visible point
 * read (a triangle's corners and middle), off the cliffs — within
 * `GAP_REACH` m of the lens, and `near` within `NEAR_REACH` m of it (null
 * where nothing is drawn that close). */
export type Gap = {
  triangles: number;
  mean: number;
  p95: number;
  worst: number;
  over25: number;
  near: { points: number; mean: number; p95: number; worst: number } | null;
  /** Where the points came from: the skin's triangles, the ground's own
   * rock (`rockDrawnAt`), or both. */
  from: "skin" | "ground" | "both";
};

/** What the rock is holding, off `rocks.ts`'s `userData.rockStats`. */
export type RockStats = {
  /** Every ms spent building rock since the map was stood up. */
  buildMs: number;
  /** Tiles in reach not yet at the cut they are owed. */
  owed: number;
  /** Triangles built and held, on screen or not. */
  triangles: number;
  /** Bytes of geometry (and anything else) the rock holds on the card. */
  bytes: number;
};

/** Within this of the lens the drawn rock is held to the ridden, m. */
export const GAP_REACH = 250;
/** And this is NEAR — what a skier is close enough to touch soon, m. */
export const NEAR_REACH = 50;

export type Measures = ReturnType<typeof createMeasures>;

export function createMeasures(
  renderer: WorldRendererExt,
  draw: () => void,
  bed: Level,
  ridden: Level,
) {
  const rocks = () => renderer.group("rocks");
  const terrain = () => renderer.group("terrain");

  /** What the rock holds, off `rocks.ts`'s stats (zero where none). */
  function stats(): RockStats {
    const s = rocks()?.userData.rockStats as RockStats | undefined;
    return s ? { ...s } : { buildMs: 0, owed: 0, triangles: 0, bytes: 0 };
  }

  /** Let every tile of rock (and every tree's hand-over) go, so the next
   * lens builds from nothing. True when the rock held nothing after. */
  function reset(): boolean {
    const hook = rocks()?.userData.rockReset as (() => void) | undefined;
    if (hook) hook();
    else {
      // Far past every tile's keep (the view plus two tiles), low over
      // the snow so the view is not grown by height.
      const y = bed.groundAt(0, 0);
      renderer.setOverride({
        eye: { x: -60000, y: y + 2, z: -60000 },
        target: { x: -60000, y: y + 2, z: -59000 },
        fov: 60,
        roll: 0,
      });
      draw();
    }
    return stats().triangles === 0;
  }

  /** Draw a frame at the lens, build every tile it owes whole
   * (`rockSettle`) and draw twice more: the ms the rock spent building,
   * off its own clock. */
  function settle(): number {
    const before = stats().buildMs;
    draw();
    (rocks()?.userData.rockSettle as (() => void) | undefined)?.();
    for (let i = 0; i < 2; i++) draw();
    return stats().buildMs - before;
  }

  /** The lens stood from nothing: reset, then settled. */
  function standAt(pose: LensPose): { settleMs: number; clean: boolean } {
    const clean = reset();
    renderer.setOverride(pose);
    return { settleMs: settle(), clean };
  }

  /** THE PHYSICS GAP at a lens: every drawn rock triangle within
   * `GAP_REACH` m, read at its corners and middle against the surface a
   * body meets there; and the ground's own rock where it says where it
   * draws it. Null where neither draws rock in reach. */
  function gap(eye: { x: number; y: number; z: number }): Gap | null {
    const errs: number[] = [];
    const near: number[] = [];
    let skin = 0;
    let ground = 0;
    const read = (q: THREE.Vector3 | { x: number; y: number; z: number }, d: number): void => {
      const e = Math.abs(q.y - ridden.groundAt(q.x, q.z));
      errs.push(e);
      if (d <= NEAR_REACH) near.push(e);
    };
    const root = rocks();
    if (root) {
      const p = new THREE.Vector3();
      const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
        const pos = mesh.geometry.getAttribute("position");
        if (!pos) return;
        const index = mesh.geometry.index;
        const count = index ? index.count : pos.count;
        for (let t = 0; t + 2 < count; t += 3) {
          for (let k = 0; k < 3; k++) {
            const v = index ? index.getX(t + k) : t + k;
            pts[k].fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
          }
          p.copy(pts[0])
            .add(pts[1])
            .add(pts[2])
            .multiplyScalar(1 / 3);
          const d = Math.hypot(p.x - eye.x, p.z - eye.z);
          if (d > GAP_REACH) continue;
          // The skin a body meets, never a cliff's face (met as columns,
          // `wallSolids`) nor rock tucked under the snow (drawn hidden).
          if (onAnyCliff(bed, p.x, p.z, 2)) continue;
          for (const q of [p, ...pts]) {
            if (q.y < bed.groundAt(q.x, q.z) - 0.02) continue;
            read(q, d);
            skin++;
          }
        }
      });
    }
    const drawnAt = terrain()?.userData.rockDrawnAt as
      ((x: number, z: number) => number | null) | undefined;
    if (drawnAt) {
      // Every 4 m in reach, every metre near.
      for (let dz = -GAP_REACH; dz <= GAP_REACH; dz += 1)
        for (let dx = -GAP_REACH; dx <= GAP_REACH; dx += 1) {
          const d = Math.hypot(dx, dz);
          if (d > GAP_REACH) continue;
          if (d > NEAR_REACH && (dx % 4 !== 0 || dz % 4 !== 0)) continue;
          const x = eye.x + dx;
          const z = eye.z + dz;
          if (rockShare(bed, x, z) <= 0 || onAnyCliff(bed, x, z, 2)) continue;
          const y = drawnAt(x, z);
          if (y === null) continue;
          read({ x, y, z }, d);
          ground++;
        }
    }
    if (!errs.length) return null;
    const stat = (a: number[]) => {
      a.sort((x, y) => x - y);
      return {
        mean: a.reduce((s, v) => s + v, 0) / a.length,
        p95: a[Math.floor(a.length * 0.95)],
        worst: a[a.length - 1],
      };
    };
    const all = stat(errs);
    return {
      triangles: Math.round(skin / 4),
      ...all,
      over25: errs.filter((e) => e > 0.25).length / errs.length,
      near: near.length ? { points: near.length, ...stat(near) } : null,
      from: skin && ground ? "both" : ground ? "ground" : "skin",
    };
  }

  /** The canvas read back at a quarter size, as luminance 0..1. */
  function sample(): Float32Array {
    const gl = renderer.gl.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const sw = Math.floor(w / 4);
    const sh = Math.floor(h / 4);
    const o = new Float32Array(sw * sh);
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const k = (j * 4 * w + i * 4) * 4;
        o[j * sw + i] = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
      }
    return o;
  }

  /** The mean change between two reads, in 0..255 steps. */
  function change(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return (255 * sum) / (a.length || 1);
  }

  /** THE SHIMMER at `pose`: the lens slid `slide` m a frame across the
   * look for `frames` frames, every pixel's mean second difference of
   * brightness, ×1000 (the shimmer lab's FLICKER). Stood from nothing and
   * settled first (`fresh`, the default); without, it reads whatever the
   * tiles held — round 1's way, kept to show the difference. */
  function shimmer(pose: LensPose, frames: number, slide: number, fresh = true): number {
    if (fresh) standAt(pose);
    const dx = pose.target.x - pose.eye.x;
    const dz = pose.target.z - pose.eye.z;
    const l = Math.hypot(dx, dz) || 1;
    const sx = dz / l;
    const sz = -dx / l;
    const reads: Float32Array[] = [];
    for (let k = 0; k < frames; k++) {
      const eye = { ...pose.eye, x: pose.eye.x + sx * slide * k, z: pose.eye.z + sz * slide * k };
      renderer.setOverride({ ...pose, eye });
      draw();
      reads.push(sample());
    }
    let sum = 0;
    let n = 0;
    for (let k = 1; k + 1 < reads.length; k++)
      for (let i = 0; i < reads[k].length; i++) {
        sum += Math.abs(reads[k + 1][i] - 2 * reads[k][i] + reads[k - 1][i]);
        n++;
      }
    return n ? (1000 * sum) / n : 0;
  }

  /** The lens walked in along `lens(d)` from `from` m to `to` m in `step` m
   * steps from nothing, each frame's mean change off the last (a POP is a
   * spike) — the rock built whole at every step, so only a cut swapping
   * shows. */
  function approach(lens: (d: number) => LensPose, from: number, to: number, step: number) {
    reset();
    const o: number[] = [];
    let last: Float32Array | null = null;
    for (let d = from; d >= to; d -= step) {
      renderer.setOverride(lens(d));
      settle();
      const now = sample();
      if (last) o.push(change(now, last));
      last = now;
    }
    return o;
  }

  return { stats, reset, settle, standAt, gap, sample, change, shimmer, approach };
}
