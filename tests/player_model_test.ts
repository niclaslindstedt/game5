// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S MODELLED KITS (`pwa/models/hiker.glb` and
// `hiker-woman.glb`, read by `player-model.ts`): bound on the dressed
// skier's own rig so they are posed by every animation the game has, each
// sized as the code's skier of that body is, reshaped by the WEIGHT row,
// their loose parts marked for the flutter, and their spring bones swung
// by what the skier feels and settled when he stands.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { dressOutfit } from "../pwa/src/game/dress.ts";
import { BODIES, DEFAULT_OUTFIT, WEIGHTS, dealtOutfit, gearOf } from "../pwa/src/game/outfit.ts";
import {
  boneIndexOf,
  builtModel,
  createSprings,
  PLAYER_MODELS,
  readPlayerModel,
  SPRING_BONES,
  type ModelKey,
  type ModelPart,
  type PlayerModel,
} from "../pwa/src/game/player-model.ts";
import { SKIER_BONES } from "../pwa/src/game/skier-rig.ts";

const root = join(import.meta.dirname, "..");

async function load(key: ModelKey): Promise<PlayerModel> {
  const buf = readFileSync(join(root, "pwa", "models", `${key}.glb`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const g = await new GLTFLoader().parseAsync(ab, "");
  return readPlayerModel(g.scene);
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

describe.each(PLAYER_MODELS)("the player's modelled kit %s", (key) => {
  const model = load(key);
  const female = key.endsWith("-woman");

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
    expect(boneIndexOf("upperarm_lo_l")).toBe(SKIER_BONES.indexOf("upperarm_l"));
  });

  it("stands where the code's skier stands, in the body frame", async () => {
    const m = await model;
    const ours = bounds([...m.cloth.position, ...m.hard.position]);
    const code = dressOutfit({ ...DEFAULT_OUTFIT, body: female ? "woman" : "man" });
    const theirs = bounds([...code.cloth.position, ...code.hard.position]);
    // The same height to a few centimetres, the pack behind (−z).
    expect(Math.abs(ours.hi[1] - theirs.hi[1])).toBeLessThan(0.06);
    expect(Math.abs(ours.lo[1] - theirs.lo[1])).toBeLessThan(0.08);
    expect(ours.lo[2]).toBeLessThan(theirs.lo[2] - 0.1);
    const pack = m.heads.fx_pack;
    expect(pack.z).toBeLessThan(bindPose().frames.chest.head.z);
  });

  it("marks the hem, the straps' tails and the rope's tail loose, and the rest held", async () => {
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

  it("hangs a broken arm from its break: the sleeve past it rides the lower bones", async () => {
    const m = await model;
    for (const side of ["l", "r"] as const)
      for (const bone of ["upperarm", "forearm"] as const) {
        const lo = SKIER_BONES.indexOf(`${bone}_lo_${side}`);
        let past = 0;
        for (let i = 0; i < m.cloth.skinIndex.length; i++)
          if (m.cloth.skinIndex[i] === lo && m.cloth.skinWeight[i] > 0.5) past++;
        expect(past, `${bone}_lo_${side}`).toBeGreaterThan(10);
      }
  });

  it("is broader through the trunk at a heavier build, and the medium build is itself", async () => {
    const m = await model;
    const bind = bindPose().frames;
    const width = (p: PlayerModel) => {
      const b = bounds(p.cloth.position);
      return b.hi[0] - b.lo[0];
    };
    const depth = (p: PlayerModel) => {
      const b = bounds(p.cloth.position);
      return b.hi[2] - b.lo[2];
    };
    expect(builtModel(m, gearOf("weight", "medium"), bind)).toBe(m);
    const light = builtModel(m, gearOf("weight", "light"), bind);
    const heavy = builtModel(m, gearOf("weight", "heavy"), bind);
    expect(width(heavy)).toBeGreaterThan(width(m));
    expect(depth(heavy)).toBeGreaterThan(depth(m));
    expect(width(light)).toBeLessThan(width(m));
    expect(WEIGHTS.length).toBe(4);
  });

  it("is a body picked on the rider card, never one dealt to a rival", () => {
    const hikers = BODIES.filter((b) => b.model);
    expect(hikers.map((b) => b.id).sort()).toEqual(["hiker", "hikerWoman"]);
    expect(hikers.find((b) => b.female)?.id).toBe("hikerWoman");
    expect(hikers.some((b) => b.id === DEFAULT_OUTFIT.body)).toBe(false);
    for (let i = 0; i < 64; i++)
      expect(hikers.some((b) => b.id === dealtOutfit(i * 7919 + 13, "medium").body)).toBe(false);
  });
});
