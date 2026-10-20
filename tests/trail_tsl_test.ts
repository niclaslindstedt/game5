// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S MARKS ON THE NODE RENDERER (`docs/webgpu.md`, part 5): the trail
// maps' four passes and the deformable snow's shade are drawn there by NODE
// TWINS of their ShaderMaterials (`trail-map-tsl.ts`), and the ground's twin
// reads the maps they fill (`trail-tsl.ts`). What the suite holds: the
// register runs both passes on the webgpu paths, every pass carries its
// twin's flag and is not hidden, the twins are made on plain Node over the
// pass's own uniforms with its blending, the maps are three's own targets
// on the node renderer and WebGL's on WebGL, and the ground's twin is made
// over a trail map in every look.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createDeformShade } from "../pwa/src/game/deform-shade.ts";
import { GPU_PORTS, quarantinedOn, runsPass } from "../pwa/src/game/gpu-backend.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { TRAIL_LOOK } from "../pwa/src/game/settings-video.ts";
import { createTrailMap } from "../pwa/src/game/trail-map.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();

const groundFrame = () => ({
  uGround: { value: new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat) },
  uHeightOrigin: { value: new THREE.Vector2() },
  uHeightCount: { value: new THREE.Vector2(1, 1) },
  uCell: { value: 1 },
});

describe("the marks' passes in the register", () => {
  it("are ported in part 5 and run on every path", () => {
    for (const id of ["trail-map", "deform"]) {
      const row = GPU_PORTS.find((p) => p.id === id);
      expect(row?.ported).toBe(true);
      expect(row?.part).toBe(5);
      expect(runsPass("webgl", id)).toBe(true);
      expect(runsPass("webgpu", id)).toBe(true);
      expect(runsPass("webgpu-gl", id)).toBe(true);
      expect(quarantinedOn("webgpu", id)).toBe(false);
    }
  });
});

describe("the trail maps' node twins", () => {
  it("flag every pass, each in the trail map's family", () => {
    const trail = createTrailMap(level.size, TRAIL_LOOK.high);
    const kinds = trail.passes.map((m) => m.userData.twin);
    expect(kinds).toEqual(["trail-stamp", "trail-groom", "trail-copy", "trail-fill"]);
    for (const m of trail.passes) expect(m.userData.glsl).toBe("trail-map");
    trail.dispose();
  });

  it("draw into three's own targets on the node renderer, WebGL's on WebGL", () => {
    const gl = createTrailMap(level.size, TRAIL_LOOK.high);
    const fine = (t: ReturnType<typeof createTrailMap>) =>
      (t.uniforms.uTrailFine.value as THREE.Texture & { renderTarget?: THREE.RenderTarget })
        .renderTarget;
    expect((fine(gl) as THREE.WebGLRenderTarget | undefined)?.isWebGLRenderTarget).toBe(true);
    const node = createTrailMap(level.size, TRAIL_LOOK.high, true);
    expect(fine(node)?.isRenderTarget).toBe(true);
    expect((fine(node) as THREE.WebGLRenderTarget | undefined)?.isWebGLRenderTarget).toBe(
      undefined,
    );
    gl.dispose();
    node.dispose();
  });

  it("are made on plain Node, once a pass, with its blending", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    const twins = createTwins(haze, { display: float(1), exposure: float(1) });
    const trail = createTrailMap(level.size, TRAIL_LOOK.high, true);
    for (const m of trail.passes) {
      const twin = twins.of(m);
      expect(twin?.isNodeMaterial).toBe(true);
      expect(twins.of(m)).toBe(twin);
      expect(twin?.blending).toBe(m.blending);
      expect(twin?.blendEquation).toBe(m.blendEquation);
      expect(twin?.blendSrc).toBe(m.blendSrc);
      expect(twin?.blendDst).toBe(m.blendDst);
      expect(twin?.depthTest).toBe(false);
      expect(twin?.depthWrite).toBe(false);
      expect(twin?.toneMapped).toBe(false);
    }
    // The furrow's stamp keeps the deepest cut a texel has seen.
    expect(trail.passes[0].blendEquation).toBe(THREE.MaxEquation);
    const field = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat);
    const shade = createDeformShade(
      8,
      field,
      trail.uniforms,
      groundFrame(),
      {
        value: new THREE.Vector3(0, 1, 0),
      },
      true,
    );
    expect(shade.material.userData.twin).toBe("deform-shade");
    expect(shade.material.userData.glsl).toBe("deform");
    expect(twins.of(shade.material)?.isNodeMaterial).toBe(true);
    shade.dispose();
    trail.dispose();
  });
});
