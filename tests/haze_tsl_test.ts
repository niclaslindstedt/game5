// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HAZE AND THE LIGHTS ON THE NODE RENDERER (`docs/webgpu.md`, part 2):
// the classes the world's two lights are made of (`world-lights.ts`), the
// marks `hazeMaterial` and `fadeGlow` leave for the node renderer's copy
// (`gpu-dress.ts`), the output transform the display-space haze undoes
// (`haze-tsl.ts`), and the rule that three's node half is reached only
// through the lazy WebGPU chunk (`gpu-device.ts`).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { fadeGlow } from "../pwa/src/game/glow-fade.ts";
import { createHazeUniforms, hazeMaterial, PAST_THE_WALL } from "../pwa/src/game/haze.ts";
import { KeyLight, SkyLight } from "../pwa/src/game/world-lights.ts";

const GAME = join(__dirname, "../pwa/src/game");

describe("the world's two lights", () => {
  it("are three's own lights to WebGL, with flags three does not read", () => {
    const haze = createHazeUniforms();
    const key = new KeyLight(haze, 0xffffff, 3);
    const sky = new SkyLight(haze, 0x88aaff, 0xffffff, 1);
    expect(key.isDirectionalLight).toBe(true);
    expect(sky.isHemisphereLight).toBe(true);
    expect(key.isKeyLight).toBe(true);
    expect(sky.isSkyLight).toBe(true);
    expect(key.intensity).toBe(3);
    expect(key.haze).toBe(haze);
    // Three reads `isSunLight` as its cascaded sun and draws a light so
    // flagged as one: the key must never carry it.
    expect((key as unknown as Record<string, unknown>).isSunLight).toBeUndefined();
    expect((sky as unknown as Record<string, unknown>).isSunLight).toBeUndefined();
  });
});

describe("the marks the node renderer's copy is finished by", () => {
  it("are left by hazeMaterial and fadeGlow", () => {
    const haze = createHazeUniforms();
    const plain = hazeMaterial(new THREE.MeshStandardMaterial(), haze, "plain");
    expect(plain.userData.haze).toBe(true);
    expect(plain.userData.hazeWall).toBeUndefined();
    const wall = hazeMaterial(new THREE.MeshStandardMaterial(), haze, "wall", PAST_THE_WALL);
    expect(wall.userData.hazeWall).toBe(true);
    expect(wall.userData.glsl).toBeUndefined(); // the wall only discards: drawn
    const grafted = hazeMaterial(new THREE.MeshStandardMaterial(), haze, "g", () => {});
    expect(grafted.userData.glsl).toBe("haze-graft");
    const glow = fadeGlow(new THREE.PointsMaterial(), haze, { reach: 300 });
    expect(glow.userData.glowFade).toEqual({ reach: 300 });
  });
});

describe("the output transform the display-space haze undoes", () => {
  it("is three's node ACES, and its inverse inverts it", async () => {
    const { ACES_IN, ACES_OUT, FIT } = await import("../pwa/src/game/haze-tsl.ts");
    // The fit as three's node tone mapping writes it.
    const src = readFileSync(
      join(__dirname, "../node_modules/three/src/nodes/display/ToneMappingFunctions.js"),
      "utf8",
    );
    expect(src).toContain("color.mul( color.add( 0.4329510 ).mul( 0.983729 ) ).add( 0.238081 )");
    expect(src).toContain("0.59719, 0.35458, 0.04823");
    expect(src).toContain("1.60475, - 0.53108, - 0.07367");
    expect(ACES_IN.elements[0]).toBeCloseTo(0.59719, 6);
    expect(ACES_IN.elements[3]).toBeCloseTo(0.35458, 6); // row 0, column 1
    expect(ACES_OUT.elements[3]).toBeCloseTo(-0.53108, 6);
    // The quadratic `fromDisplay` solves is the fit's inverse.
    const fit = (v: number): number =>
      (v * (v + FIT.a) - FIT.b) / (v * (FIT.c * v + FIT.d) + FIT.e);
    const unfit = (y: number): number => {
      const a = 1 - y * FIT.c;
      const b = FIT.a - y * FIT.d;
      const c = -(FIT.b + y * FIT.e);
      return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    };
    for (const v of [0.001, 0.05, 0.2, 0.7, 1.5, 4, 12]) expect(unfit(fit(v))).toBeCloseTo(v, 6);
    const round = new THREE.Vector3(0.3, 0.6, 0.9)
      .applyMatrix3(ACES_IN)
      .applyMatrix3(ACES_IN.clone().invert());
    expect(round.toArray().map((x) => +x.toFixed(9))).toEqual([0.3, 0.6, 0.9]);
  });

  it("builds the fog node and the lights' slots on plain Node", async () => {
    const { hazeFog, hazeSlots } = await import("../pwa/src/game/haze-tsl.ts");
    const { lightSlots } = await import("../pwa/src/game/lights-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    expect(hazeFog(haze, { display: float(1), exposure: float(1) })).toBeTruthy();
    expect(hazeSlots(haze)).toBe(hazeSlots(haze)); // one set a haze
    expect(lightSlots(haze)).toBe(lightSlots(haze));
  });
});

describe("where the haze is mixed (drawsStraight)", () => {
  it("is the canvas only for a neutral, calm frame at the canvas's own samples", async () => {
    const { drawsStraight } = await import("../pwa/src/game/region-picture.ts");
    const calm = { graded: false, buzz: 0, burning: false, samples: 4, canvas: 4 };
    expect(drawsStraight(calm)).toBe(true);
    expect(drawsStraight({ ...calm, graded: true })).toBe(false);
    expect(drawsStraight({ ...calm, buzz: 0.2 })).toBe(false);
    expect(drawsStraight({ ...calm, burning: true })).toBe(false);
    expect(drawsStraight({ ...calm, samples: 2 })).toBe(false); // LOW's two samples
    expect(drawsStraight({ ...calm, samples: 0, canvas: 0 })).toBe(true);
  });
});

describe("three's node half", () => {
  it("is reached only through the lazy WebGPU chunk", () => {
    const files = readdirSync(GAME).filter((f) => /\.tsx?$/.test(f));
    const text = new Map(files.map((f) => [f, readFileSync(join(GAME, f), "utf8")]));
    const node = new Set(files.filter((f) => /from "three\/(webgpu|tsl)"/.test(text.get(f) ?? "")));
    expect(node.has("gpu-device.ts")).toBe(true);
    for (const [f, src] of text) {
      for (const m of src.matchAll(/^import[^;]*?from "\.\/([\w-]+\.tsx?)";/gms)) {
        const to = m[1];
        if (node.has(to) && !/^import type/.test(m[0])) {
          // Only the node half imports the node half; `gpu-device.ts`, its
          // door, is fetched by a dynamic `import()` alone.
          expect(node.has(f), `${f} imports ${to}`).toBe(true);
          expect(to, `${f} imports the door statically`).not.toBe("gpu-device.ts");
        }
      }
    }
    expect(node.has("world-lights.ts")).toBe(false);
  });
});
