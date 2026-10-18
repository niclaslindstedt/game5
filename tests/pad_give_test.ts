// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAD GIVES (`pwa/src/game/pad-give.ts`): a lift tower's foam dented
// where a body meets it, by the blow, and back once he is off it.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RAGDOLL, TOWER_PAD, type Thrown } from "@engine";

import { PAD_GIVE, createPadGive } from "../pwa/src/game/pad-give.ts";

const PAD = { x: 0, y: 0, z: 0, yaw: 0, r: 0.5, h: 2.6 };

/** A body whose every point is at (x, 1, 0), struck at `struck` m/s. */
function bodyAt(x: number, struck: number): Thrown {
  const points: number[] = [];
  for (let i = 0; i < RAGDOLL.count; i++) points.push(x, 1, 0);
  return { points, struck: new Array(RAGDOLL.count).fill(struck) } as unknown as Thrown;
}

/** The pad's width along x as drawn, and its middle. */
function across(mesh: THREE.InstancedMesh): { width: number; mid: number } {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  const e = m.elements;
  return { width: 2 * e[0], mid: e[12] };
}

describe("a tower's pad", () => {
  it("caves in on the face he hits, its far side held, and comes back once he is off it", () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), undefined, 1);
    const give = createPadGive(mesh, [PAD]);
    let t = 0;
    give.update(t, null);
    // Struck from -x at 30 m/s: the whole of the foam's give.
    const hit = bodyAt(-PAD.r - 0.12, 30);
    for (let i = 0; i < 30; i++) give.update((t += 1 / 60), hit);
    const dented = across(mesh);
    const most = PAD_GIVE.depth * TOWER_PAD.thick;
    expect(2 * PAD.r - dented.width).toBeCloseTo(most, 2);
    // The far side (+x) stays where it stood.
    expect(dented.mid + dented.width / 2).toBeCloseTo(PAD.r, 3);
    for (let i = 0; i < 60 * 5; i++) give.update((t += 1 / 60), null);
    expect(across(mesh).width).toBeCloseTo(2 * PAD.r, 2);
  });

  it("gives only a little under a slow touch", () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), undefined, 1);
    const give = createPadGive(mesh, [PAD]);
    let t = 0;
    for (let i = 0; i < 30; i++) give.update((t += 1 / 60), bodyAt(-PAD.r - 0.12, 2));
    const d = 2 * PAD.r - across(mesh).width;
    expect(d).toBeLessThan(0.5 * PAD_GIVE.depth * TOWER_PAD.thick);
    expect(d).toBeGreaterThan(0);
  });
});
