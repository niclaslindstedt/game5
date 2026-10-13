// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIMO RACER'S MODELLED KIT (`pwa/models/skimo.glb`, read by
// `skimo-model.ts`): bound on the dressed skier's own rig so it is posed
// by every animation the game has — the arms' lower halves too, so a broken
// arm hangs from its break — sized as the code's skier is, its loose parts
// marked for the flutter, and its spring bones swung by what he feels and
// settled when he stands.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { dressOutfit } from "../pwa/src/game/dress.ts";
import { DEFAULT_OUTFIT } from "../pwa/src/game/outfit.ts";
import {
  boneIndexOf,
  createSprings,
  readSkimoModel,
  SPRING_BONES,
  type ModelPart,
  type SkimoModel,
} from "../pwa/src/game/skimo-model.ts";
import { SKIER_BONES } from "../pwa/src/game/skier-rig.ts";

const root = join(import.meta.dirname, "..");

async function load(): Promise<SkimoModel> {
  const buf = readFileSync(join(root, "pwa", "models", "skimo.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const g = await new GLTFLoader().parseAsync(ab, "");
  return readSkimoModel(g.scene);
}

const bounds = (p: number[]) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[i + k]);
      hi[k] = Math.max(hi[k], p[i + k]);
    }
  return { lo, hi };
};

describe("the skimo racer's modelled kit", () => {
  const model = load();

  it("is skinned on the dressed skier's bones and its own spring bones", async () => {
    const m = await model;
    const most = SKIER_BONES.length + SPRING_BONES.length;
    for (const part of [m.cloth, m.hard] as ModelPart[]) {
      expect(part.position.length / 3).toBeGreaterThan(100);
      for (let i = 0; i < part.skinIndex.length; i += 4) {
        const w = part.skinWeight.slice(i, i + 4).reduce((a, b) => a + b, 0);
        expect(w).toBeCloseTo(1, 4);
        for (let k = 0; k < 4; k++) expect(part.skinIndex[i + k]).toBeLessThan(most);
      }
    }
    const used = new Set(m.cloth.skinIndex);
    for (const s of SPRING_BONES) expect(used.has(boneIndexOf(s.name)), s.name).toBe(true);
  });

  it("weights the skin past each arm's break onto the arm's lower half", async () => {
    const m = await model;
    const used = new Set([...m.cloth.skinIndex, ...m.hard.skinIndex]);
    const weighted = new Set<number>();
    for (const part of [m.cloth, m.hard] as ModelPart[])
      for (let i = 0; i < part.skinIndex.length; i++)
        if (part.skinWeight[i] > 0.5) weighted.add(part.skinIndex[i]);
    for (const b of ["upperarm_lo_l", "upperarm_lo_r", "forearm_lo_l", "forearm_lo_r"] as const) {
      expect(boneIndexOf(b)).toBe(SKIER_BONES.indexOf(b));
      expect(used.has(boneIndexOf(b)), b).toBe(true);
      expect(weighted.has(boneIndexOf(b)), b).toBe(true);
    }
  });

  it("stands where the code's skier stands, in the body frame", async () => {
    const m = await model;
    const ours = bounds([...m.cloth.position, ...m.hard.position]);
    const code = dressOutfit(DEFAULT_OUTFIT);
    const theirs = bounds([...code.cloth.position, ...code.hard.position]);
    // The same height to a few centimetres, the pack behind (−z) — a race
    // pack, slim, but proud of the code's jacket.
    expect(Math.abs(ours.hi[1] - theirs.hi[1])).toBeLessThan(0.06);
    expect(Math.abs(ours.lo[1] - theirs.lo[1])).toBeLessThan(0.08);
    expect(ours.lo[2]).toBeLessThan(theirs.lo[2] - 0.02);
    const pack = m.heads.fx_pack;
    expect(pack.z).toBeLessThan(bindPose().frames.chest.head.z);
  });

  it("marks the hood's rim, the ski strap's loop and the bib's corners loose, and the rest held", async () => {
    const m = await model;
    const loose = m.cloth.flutter.filter((f) => f > 0.05).length;
    expect(loose).toBeGreaterThan(50);
    expect(loose / m.cloth.flutter.length).toBeLessThan(0.25);
    expect(m.hard.flutter.every((f) => f === 0)).toBe(true);
  });

  it("swings its springs under a jolt and settles stood still", async () => {
    const m = await model;
    const frames = bindPose().frames;
    const springs = createSprings(frames, m.heads);
    const world = new THREE.Matrix4();
    let t = 0;
    const tailAt = () => springs.step(frames, world, t).frames[2];
    for (let i = 0; i < 30; i++, t += 1 / 60) tailAt();
    const still = tailAt().y;
    // Up to 10 m/s ahead, then a hard stop over a sixth of a second (six
    // g): the tail swings and comes back.
    let most = 0;
    let z = 0;
    let v = 0;
    for (let i = 0; i < 120; i++, t += 1 / 60) {
      v = i < 30 ? v + 20 / 60 : Math.max(0, v - 60 / 60);
      z += v / 60;
      world.makeTranslation(0, 0, z);
      const y = tailAt().y;
      most = Math.max(most, 1 - y.x * still.x - y.y * still.y - y.z * still.z);
    }
    expect(most).toBeGreaterThan(0.01);
    for (let i = 0; i < 400; i++, t += 1 / 60) tailAt();
    const after = tailAt().y;
    expect(after.x * still.x + after.y * still.y + after.z * still.z).toBeGreaterThan(0.999);
  });
});
