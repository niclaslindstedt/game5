// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the instanced views leave out of sight (`pwa/src/game/view-cull.ts`)
// and the meshes cut into tiles so three can cull them
// (`pwa/src/game/tile-split.ts`).

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { aimShadow, type ShadowBox } from "../pwa/src/game/shadow-box.ts";
import { splitByTile } from "../pwa/src/game/tile-split.ts";
import { createViewCull, FIGURE } from "../pwa/src/game/view-cull.ts";

/** A lens 2 m over the origin looking down +z, and the sun's circle ahead
 * of it, the sun low in the −z quarter (so shadows fall toward +z). */
function aimed(sun = true) {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000);
  camera.position.set(0, 2, 0);
  camera.lookAt(0, 2, 10);
  camera.updateMatrixWorld();
  const box: ShadowBox = { x: 0, y: 0, z: 0, reach: 75, sx: 0, sy: 0.4, sz: -0.92 };
  aimShadow(box, 0, 0, 0, 1, 75);
  const cull = createViewCull();
  cull.aim(camera, sun ? box : null);
  return cull;
}

describe("the view cull", () => {
  it("keeps a figure in front of the lens and drops one behind it", () => {
    const cull = aimed();
    expect(cull.seen(0, 0, 30, FIGURE.radius, FIGURE.height, false)).toBe(true);
    expect(cull.seen(0, 0, -30, FIGURE.radius, FIGURE.height, false)).toBe(false);
    // Out to the side, past the frustum's edge.
    expect(cull.seen(80, 0, 10, FIGURE.radius, FIGURE.height, false)).toBe(false);
  });

  it("keeps a figure just behind the lens whose shadow falls into the circle", () => {
    const cull = aimed();
    // 20 m behind: its shadow, thrown toward +z, lies across the snow ahead.
    expect(cull.seen(0, 0, -20, FIGURE.radius, FIGURE.height, true)).toBe(true);
    // ...but a cut that casts nothing is not kept for it.
    expect(cull.seen(0, 0, -20, FIGURE.radius, FIGURE.height, false)).toBe(false);
    // Far behind, past the circle and the shadow's length: dropped.
    expect(cull.seen(0, 0, -400, FIGURE.radius, FIGURE.height, true)).toBe(false);
  });

  it("keeps nothing for its shadow with no sun's map", () => {
    const cull = aimed(false);
    expect(cull.seen(0, 0, -20, FIGURE.radius, FIGURE.height, true)).toBe(false);
    expect(cull.seen(0, 0, 30, FIGURE.radius, FIGURE.height, true)).toBe(true);
  });

  it("follows the lens it was last aimed at", () => {
    const cull = aimed();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000);
    camera.position.set(0, 2, 0);
    camera.lookAt(0, 2, -10);
    cull.aim(camera, null);
    expect(cull.seen(0, 0, -30, FIGURE.radius, FIGURE.height, false)).toBe(true);
    expect(cull.seen(0, 0, 30, FIGURE.radius, FIGURE.height, false)).toBe(false);
  });
});

/** Every triangle of `g` as its corners' positions, sorted, as text. */
function triangles(g: THREE.BufferGeometry): string[] {
  const pos = g.getAttribute("position");
  const index = g.getIndex();
  const n = index ? index.count : pos.count;
  const out: string[] = [];
  for (let i = 0; i < n; i += 3) {
    const corners: string[] = [];
    for (let k = 0; k < 3; k++) {
      const v = index ? index.getX(i + k) : i + k;
      corners.push(`${pos.getX(v)},${pos.getY(v)},${pos.getZ(v)}`);
    }
    out.push(corners.join("|"));
  }
  return out.sort();
}

/** A strip of quads along x, `n` of them 10 m long. */
function strip(n: number, indexed: boolean): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(n * 10, 4, n, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((n * 10) / 2, 1, 10);
  return indexed ? g : g.toNonIndexed();
}

describe("splitByTile", () => {
  for (const indexed of [false, true]) {
    it(`cuts a mesh into tiles, every triangle in exactly one (${indexed ? "indexed" : "unindexed"})`, () => {
      const g = strip(40, indexed);
      const tiles = splitByTile(g, 96);
      expect(tiles.length).toBe(Math.ceil(400 / 96));
      expect(tiles.flatMap(triangles).sort()).toEqual(triangles(g));
      for (const t of tiles) {
        // Each tile's bound holds every vertex it draws and is a tile wide.
        const s = t.boundingSphere!;
        expect(s.radius).toBeLessThan(96);
        const pos = t.getAttribute("position");
        const index = t.getIndex();
        const v = new THREE.Vector3();
        const n = index ? index.count : pos.count;
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, index ? index.getX(i) : i);
          expect(s.distanceToPoint(v)).toBeLessThanOrEqual(1e-4);
        }
        // Every attribute comes along.
        expect(Object.keys(t.attributes).sort()).toEqual(Object.keys(g.attributes).sort());
        if (indexed) expect(t.getAttribute("position")).toBe(g.getAttribute("position"));
      }
    });
  }

  it("hands back a mesh that fits in one tile as it is", () => {
    const g = strip(3, false);
    expect(splitByTile(g, 96)).toEqual([g]);
  });
});
