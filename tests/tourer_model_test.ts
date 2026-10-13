// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TOURER (`pwa/models/tourer.glb`, read by `tourer-model.ts`):
// bound on the dressed skier's own rig so it is posed by every animation
// the game has — an arm's halves below a break included — sized as the
// code's skier is and reshaped by the weight row, its loose parts marked
// for the flutter, and its spring bones swung by what he feels, never into
// him, and settled when he stands.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { dressOutfit } from "../pwa/src/game/dress.ts";
import { DEFAULT_OUTFIT, dealtOutfit, gearOf, jumpKit } from "../pwa/src/game/outfit.ts";
import {
  boneIndexOf,
  builtModel,
  createSprings,
  readTourerModel,
  SPRING_BONES,
  type ModelPart,
  type TourerModel,
} from "../pwa/src/game/tourer-model.ts";
import { SKIER_BONES } from "../pwa/src/game/skier-rig.ts";

const root = join(import.meta.dirname, "..");

async function load(): Promise<TourerModel> {
  const buf = readFileSync(join(root, "pwa", "models", "tourer.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const g = await new GLTFLoader().parseAsync(ab, "");
  return readTourerModel(g.scene);
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

describe("the modelled tourer", () => {
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
    // An arm's skin past the break is the break's own bone, so a broken
    // arm hangs from it rather than folding at the joint.
    for (const lo of ["upperarm_lo_l", "forearm_lo_r"] as const) {
      expect(boneIndexOf(lo)).toBe(SKIER_BONES.indexOf(lo));
      expect(used.has(boneIndexOf(lo)), lo).toBe(true);
    }
  });

  it("stands where the code's skier stands, in the body frame", async () => {
    const m = await model;
    const ours = bounds([...m.cloth.position, ...m.hard.position]);
    const code = dressOutfit(DEFAULT_OUTFIT);
    const theirs = bounds([...code.cloth.position, ...code.hard.position]);
    // The same height to a few centimetres, the pack behind (−z).
    expect(Math.abs(ours.hi[1] - theirs.hi[1])).toBeLessThan(0.06);
    expect(Math.abs(ours.lo[1] - theirs.lo[1])).toBeLessThan(0.08);
    expect(ours.lo[2]).toBeLessThan(theirs.lo[2] - 0.1);
    const pack = m.heads.fx_pack;
    expect(pack.z).toBeLessThan(bindPose().frames.chest.head.z);
  });

  it("marks the hem, the cords, the straps' tails and the hood loose, and the rest held", async () => {
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
    const tailAt = () => springs.step(frames, world, t).frames[1];
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

  it("never swings the pack or the hood into his back", async () => {
    const m = await model;
    const frames = bindPose().frames;
    const springs = createSprings(frames, m.heads);
    const world = new THREE.Matrix4();
    // Hard braking: the specific force throws everything on his back
    // toward his front.
    let t = 0;
    let z = 0;
    let v = 25;
    for (let i = 0; i < 240; i++, t += 1 / 60) {
      v = Math.max(0, v - 0.5);
      z += v / 60;
      world.makeTranslation(0, 0, z);
      const out = springs.step(frames, world, t).frames;
      for (const k of [0, 1]) {
        // A swing toward his body tips the swung frame's up back (−z):
        // it stops at the spring's `back`, a degree or two.
        const lean = out[k].y.z - frames.chest.y.z;
        expect(lean).toBeGreaterThan(-0.04);
      }
    }
  });

  it("lets its springs go when the clock runs back", async () => {
    const m = await model;
    const frames = bindPose().frames;
    const springs = createSprings(frames, m.heads);
    const world = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) springs.step(frames, world.makeTranslation(i * 0.5, 0, 0), i / 60);
    // A restart's clock: no motion read across it.
    const back = springs.step(frames, world.makeTranslation(500, 0, 0), 0.01).frames[1];
    expect(back.y.y).toBeCloseTo(frames.chest.y.y, 3);
  });

  it("is reshaped by the weight row as the loom's man is", async () => {
    const m = await model;
    const bind = bindPose().frames;
    const heavy = gearOf("weight", "heavy");
    const light = gearOf("weight", "light");
    const width = (p: number[]) => bounds(p).hi[0] - bounds(p).lo[0];
    // How far ahead his trunk reaches: the cloth carried by the hips and
    // the chest.
    const trunk = [SKIER_BONES.indexOf("pelvis"), SKIER_BONES.indexOf("chest")];
    const depth = (part: ModelPart) => {
      let most = -Infinity;
      for (let i = 0; i < part.position.length / 3; i++)
        if (trunk.includes(part.skinIndex[i * 4]) && part.skinWeight[i * 4] > 0.6)
          most = Math.max(most, part.position[i * 3 + 2]);
      return most;
    };
    const big = builtModel(m, heavy, bind);
    const small = builtModel(m, light, bind);
    expect(builtModel(m, gearOf("weight", "medium"), bind)).toBe(m);
    expect(width(big.cloth.position)).toBeGreaterThan(width(m.cloth.position));
    expect(width(small.cloth.position)).toBeLessThan(width(m.cloth.position));
    // A heavy skier's stomach out ahead; the pack set back with his back.
    expect(depth(big.cloth)).toBeGreaterThan(depth(m.cloth) + 0.01);
    expect(big.heads.fx_pack.z).toBeLessThan(m.heads.fx_pack.z);
    expect(big.heads.fx_pom).toEqual(m.heads.fx_pom);
  });

  it("is the rider card's to pick, never the field's or a jumper's", () => {
    expect(gearOf("body", "tourer").model).toBe(true);
    for (let look = 0; look < 200; look++)
      expect(dealtOutfit(look, "medium").body).not.toBe("tourer");
    expect(jumpKit({ ...DEFAULT_OUTFIT, body: "tourer" }).body).toBe("man");
  });
});
