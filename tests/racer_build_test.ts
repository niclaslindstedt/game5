// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED RACER CUT TO HIS BUILD AND HIS DISCIPLINE: the WEIGHT row
// reshapes the model as it reshapes the code's dress (`racer-build.ts`), and
// a pair raced in a discipline that wears less leaves its guards off
// (`racer-model.ts`' `KIT_PARTS`, dealt by `skis-body.ts`' `pairStyle`).

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SKI_CATALOG } from "@engine";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { WEIGHTS } from "../pwa/src/game/outfit.ts";
import { builtRacer } from "../pwa/src/game/racer-build.ts";
import { KIT_PARTS } from "../pwa/src/game/racer-model.ts";
import { pairStyle, SLOT_DRESS } from "../pwa/src/game/skis-body.ts";

const weight = (id: string) => WEIGHTS.find((w) => w.id === id)!;

/** Points on him in the bind pose: the side of his waist, his thigh's
 * outside, the crown of his head. */
function points(): { geo: THREE.BufferGeometry; at: THREE.Vector3[] } {
  const f = bindPose().frames;
  const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
  const waist = v(f.pelvis.head)
    .addScaledVector(v(f.pelvis.y), 0.15)
    .addScaledVector(v(f.pelvis.x), 0.15);
  const thigh = v(f.thigh_l.head)
    .addScaledVector(v(f.thigh_l.y), f.thigh_l.length * 0.5)
    .addScaledVector(v(f.thigh_l.x), 0.08);
  const crown = v(f.head.head).addScaledVector(v(f.head.y), 0.2);
  const at = [waist, thigh, crown];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      at.flatMap((p) => p.toArray()),
      3,
    ),
  );
  return { geo, at };
}

describe("the racer cut to his build", () => {
  it("hands the medium build's geometry back as it is", () => {
    const { geo } = points();
    expect(builtRacer(geo, weight("medium"))).toBe(geo);
  });

  it("broadens a heavier skier's trunk and limbs, slims a lighter one, keeps his head", () => {
    const { geo, at } = points();
    const heavy = builtRacer(geo, weight("heavy")).getAttribute("position");
    const light = builtRacer(geo, weight("light")).getAttribute("position");
    const moved = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) =>
      new THREE.Vector3().fromBufferAttribute(a, i).distanceTo(at[i]);
    for (const i of [0, 1]) {
      expect(moved(heavy, i), `point ${i}`).toBeGreaterThan(0.004);
      expect(moved(light, i), `point ${i}`).toBeGreaterThan(0.001);
    }
    // The waist goes out on the heavy build and in on the light one.
    const hips = bindPose().frames.pelvis.head;
    const out = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) =>
      Math.hypot(a.getX(0) - hips.x, a.getZ(0) - hips.z);
    const was = Math.hypot(at[0].x - hips.x, at[0].z - hips.z);
    expect(out(heavy)).toBeGreaterThan(was);
    expect(out(light)).toBeLessThan(was);
    expect(moved(heavy, 2)).toBeLessThan(1e-4);
  });
});

describe("the racer's kit by discipline", () => {
  it("leaves more off a speed racer than a giant slalom racer, nothing off a slalom one", () => {
    expect(KIT_PARTS.slalom.size).toBe(0);
    for (const p of KIT_PARTS.gs) expect(KIT_PARTS.speed.has(p), p).toBe(true);
    expect(KIT_PARTS.gs.has("shin_guard")).toBe(true);
    expect(KIT_PARTS.gs.has("arm_guard")).toBe(false);
    expect(KIT_PARTS.speed.has("arm_guard")).toBe(true);
  });

  it("is dealt off the pair he is on", () => {
    const kit = (id: string) =>
      pairStyle(
        SKI_CATALOG.find((s) => s.id === id)!,
        SLOT_DRESS[0],
      ).skier.kit ?? "slalom";
    expect(kit("swift")).toBe("slalom");
    expect(kit("chough")).toBe("gs");
    expect(kit("eagle")).toBe("speed");
    expect(kit("falcon")).toBe("speed");
  });
});
