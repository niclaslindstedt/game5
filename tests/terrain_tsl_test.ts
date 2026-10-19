// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND ON THE NODE RENDERER (`docs/webgpu.md`, part 4): the clipmap's
// snow is drawn there by a NODE TWIN of its grafted standard material
// (`terrain-tsl.ts`), so what the suite holds is that every ground material
// carries its twin's flag and its spec, that the quarantine lets it through,
// that the register says so, and that the twin is made on plain Node over
// the material's own uniforms — plain, cut, deformed and in summer — once a
// material.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { deformLook } from "../pwa/src/game/deform-snow.ts";
import { GPU_PORTS, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { TRAIL_LOOK, terrainLook } from "../pwa/src/game/settings-video.ts";
import { summerTerrain } from "../pwa/src/game/summer-terrain.ts";
import { createTerrain, groundSpecs, type TerrainOptions } from "../pwa/src/game/terrain.ts";
import { createTrailMap } from "../pwa/src/game/trail-map.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();

const stage = (extra: Partial<TerrainOptions> = {}) => {
  const haze = createHazeUniforms();
  const trail = createTrailMap(level.size, TRAIL_LOOK.high);
  const terrain = createTerrain(level, haze, trail.uniforms, { ...terrainLook("low"), ...extra });
  const grounds = new Set<THREE.Material>();
  terrain.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && m.userData.twin === "ground") grounds.add(m);
  });
  return { haze, terrain, grounds: [...grounds] };
};

describe("the ground in the register", () => {
  it("is ported in part 4 and drawn on the webgpu paths", () => {
    const row = GPU_PORTS.find((p) => p.id === "terrain");
    expect(row?.ported).toBe(true);
    expect(row?.part).toBe(4);
    expect(quarantinedOn("webgpu", "terrain")).toBe(false);
    expect(quarantinedOn("webgpu-gl", "terrain")).toBe(false);
  });
});

describe("the ground's node twin", () => {
  it("is flagged on every ground material, with its spec, and is not hidden", () => {
    const { terrain, grounds } = stage();
    // A level's plain material and the warm-up mesh's cutting one.
    expect(grounds.length).toBeGreaterThanOrEqual(2);
    for (const m of grounds) {
      expect(m.userData.glsl).toBe("terrain");
      const spec = groundSpecs.get(m);
      expect(spec).toBeTruthy();
      // Its level's own uniforms ride on the material the renderer draws,
      // the very objects `follow` writes (`snow-sample-tsl.ts`'s `ownSlot`).
      const own = m.userData.groundOwn as Record<string, unknown>;
      expect(own.uSpacing).toBe(spec?.own.uSpacing);
      expect(own.uLevelCentre).toBe(spec?.own.uLevelCentre);
      expect(own.uHole).toBe(spec?.own.uHole);
      expect(own.uGridHalf).toBe(spec?.own.uGridHalf ?? spec?.shared.uGridHalf);
    }
    // No two levels share them.
    const plains = grounds.filter((m) => !groundSpecs.get(m)?.cut);
    const spacings = new Set(plains.map((m) => m.userData.groundOwn.uSpacing));
    expect(spacings.size).toBe(plains.length);
    expect(grounds.some((m) => groundSpecs.get(m)?.cut)).toBe(true);
    const q = createQuarantine("webgpu");
    q.hide(terrain.group);
    expect(q.counts()).toEqual({});
    q.restore();
    terrain.dispose();
  });

  it("is made on plain Node, once a material: plain, cut, deformed and in summer", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const spacing = terrainLook("low").spacing;
    const cases: Partial<TerrainOptions>[] = [
      {},
      { deform: deformLook("high", spacing) ?? undefined },
      { summer: summerTerrain(level) },
    ];
    for (const extra of cases) {
      const { haze, terrain, grounds } = stage(extra);
      const twins = createTwins(haze, { display: float(1), exposure: float(1) });
      for (const m of grounds) {
        const twin = twins.of(m);
        expect(twin?.isNodeMaterial).toBe(true);
        expect(twins.of(m)).toBe(twin);
        expect(twin?.fog).toBe(false); // hazed in its own output
        expect(twin?.userData.haze).toBe(true);
        // The snow lights its own lamps; summer's ground leaves them to
        // the scene's.
        expect(twin?.userData.ownLamps).toBe(!extra.summer);
        // ...and the lights' nodes, set up over the material drawn, say so.
        expect(m.userData.ownLamps).toBe(!extra.summer);
        expect(!!(twin as unknown as { maskNode: unknown }).maskNode).toBe(
          !!groundSpecs.get(m)?.cut,
        );
        // A node on the material drawn, so the renderer refreshes its
        // uniforms every frame rather than when its own fields move.
        expect((m as unknown as { groundNode?: { isNode?: boolean } }).groundNode?.isNode).toBe(
          true,
        );
      }
      terrain.dispose();
    }
  });
});
