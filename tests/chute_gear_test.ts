// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HARNESS-CONTAINER AS BUILT (`chute-gear.ts`), held to the body it is
// worn on: in his chest bone's frame (the waist at 0, the neck's base 0.275 m
// up the spine, the shoulders' line 0.215, the hips 0.224 down — the
// skeleton's own, `skier-rig.ts`) the container sits on his upper back from
// the belt line to the base of the neck, nothing stands over his head, the
// risers leave the tops of his shoulders, and the pack is a sport rig's size.

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { GEAR, backAt, createGear } from "../pwa/src/game/chute-gear.ts";
import { STANDING, skierBones } from "../pwa/src/game/skier-rig.ts";
import { skierPose } from "../pwa/src/game/skier-pose.ts";

const std = (color: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color, roughness });

describe("the harness-container as built", () => {
  const gear = createGear(std(0x1d2128, 0.8), std(0x3a6fb4, 0.7), std(0x2a2d33, 0.8), std);
  gear.body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gear.body);

  it("is laid on the frame the skeleton has", () => {
    const p = skierPose(STANDING);
    const c = skierBones(p).chest;
    const up = (q: { x: number; y: number; z: number }) =>
      (q.x - c.head.x) * c.y.x + (q.y - c.head.y) * c.y.y + (q.z - c.head.z) * c.y.z;
    expect(up(p.neck)).toBeCloseTo(0.275, 2);
    expect(up(p.shoulders[0])).toBeCloseTo(0.215, 2);
  });

  it("stands nothing over his head or past his shoulders", () => {
    // The yoke and the riser covers ride the tops of the shoulders, never a
    // frame up beside the helmet.
    expect(box.max.y).toBeLessThan(0.33);
    expect(Math.max(-box.min.x, box.max.x)).toBeLessThan(0.23);
  });

  it("sits on the upper back, from the belt line to the base of the neck", () => {
    const P = GEAR.pack;
    expect(P.top).toBeLessThanOrEqual(0.275);
    expect(P.top).toBeGreaterThan(0.215);
    expect(P.bottom).toBeGreaterThan(-0.224);
    // A sport rig's container: some 0.42–0.5 m tall, 0.3–0.36 m wide,
    // 0.11–0.17 m thick off the backpad.
    expect(P.top - P.bottom).toBeGreaterThan(0.4);
    expect(P.top - P.bottom).toBeLessThan(0.5);
    expect(2 * P.halfBottom).toBeGreaterThan(0.3);
    expect(2 * P.halfBottom).toBeLessThan(0.36);
    for (const y of [P.bottom + 0.05, 0, P.seam, P.top - 0.05]) {
      const thick = P.padChest - backAt(0, y);
      expect(thick).toBeGreaterThan(0.08);
      expect(thick).toBeLessThan(0.18);
    }
  });

  it("lets the risers off the tops of the shoulders, in front of the pack", () => {
    const R = GEAR.riser;
    expect(R.y).toBeGreaterThan(0.215);
    expect(R.y).toBeLessThan(0.32);
    expect(R.z).toBeGreaterThan(GEAR.pack.padChest);
    expect(R.z).toBeLessThan(GEAR.front);
  });
});
