// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHADOWS AND THE WARM-UP ON THE NODE RENDERER (`docs/webgpu.md`, part
// 6). What the suite holds: the register runs the skiers' pass and the
// warm-up on every path and keeps WebGL's depth economy to WebGL; the
// skiers' matrices are WebGL's to the bit on WebGL and laid out top down,
// in the device's own depth, on the node renderer; the atlas is a comparing
// depth texture on three's own target there; the shade's depth is flagged
// for its twin; the twins and the taps are made on plain Node; the key's
// pass cuts what `castInLight` dressed and nothing else; and the warm-up
// draws the whole scene and the shadow pass once through one pixel and
// leaves the scene as it found it.

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { GPU_PORTS, runsPass, skippedPasses } from "../pwa/src/game/gpu-backend.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { createHeroShadow, heroBias } from "../pwa/src/game/hero-shadow.ts";
import { castInLight, createShadeDepth } from "../pwa/src/game/terrain-shade.ts";
import { KeyLight } from "../pwa/src/game/world-lights.ts";

describe("the shadows' rows in the register", () => {
  it("run the skiers' pass and the warm-up on every path from part 6", () => {
    for (const id of ["hero-shadow", "env-warm"]) {
      const row = GPU_PORTS.find((p) => p.id === id);
      expect(row?.ported).toBe(true);
      expect(row?.part).toBe(6);
      for (const b of ["webgl", "webgpu", "webgpu-gl"] as const) expect(runsPass(b, id)).toBe(true);
    }
  });

  it("keep WebGL's depth by kind to WebGL, until the GLSL goes", () => {
    const row = GPU_PORTS.find((p) => p.id === "shadow-depth");
    expect(row?.ported).toBe(false);
    expect(row?.part).toBe(16);
    expect(runsPass("webgl", "shadow-depth")).toBe(true);
    expect(skippedPasses("webgpu")).toContain("shadow-depth");
  });
});

/** Where `m` takes clip point (x, y, z). */
const at = (m: THREE.Matrix4, x: number, y: number, z: number): number[] =>
  new THREE.Vector3(x, y, z)
    .applyMatrix4(m)
    .toArray()
    .map((v) => +v.toFixed(6));

describe("the skiers' matrices (heroBias)", () => {
  it("are WebGL's own on WebGL", () => {
    const m = heroBias(new THREE.Matrix4());
    const webgl = new THREE.Matrix4().set(
      0.5,
      0,
      0,
      0.5,
      0,
      0.5,
      0,
      0.5,
      0,
      0,
      0.5,
      0.5,
      0,
      0,
      0,
      1,
    );
    expect(m.equals(webgl)).toBe(true);
  });

  it("run v down on the node renderer, in its device's own depth", () => {
    const gl = heroBias(new THREE.Matrix4(), true, THREE.WebGLCoordinateSystem);
    expect(at(gl, -1, 1, -1)).toEqual([0, 0, 0]); // the top left, nearest
    expect(at(gl, 1, -1, 1)).toEqual([1, 1, 1]);
    const gpu = heroBias(new THREE.Matrix4(), true, THREE.WebGPUCoordinateSystem);
    expect(at(gpu, -1, 1, 0)).toEqual([0, 0, 0]); // WebGPU's depth is 0..1 already
    expect(at(gpu, 1, -1, 1)).toEqual([1, 1, 1]);
  });
});

describe("the skiers' atlas", () => {
  it("is a comparing depth texture, on three's own target on the node renderer", () => {
    for (const node of [false, true]) {
      const haze = createHazeUniforms();
      const hero = createHeroShadow(haze, 256, node);
      const map = haze.uHeroMap.value as THREE.DepthTexture & { renderTarget?: unknown };
      expect(map.isDepthTexture).toBe(true);
      expect(map.compareFunction).toBe(THREE.LessEqualCompare);
      expect(map.image.width).toBe(512);
      hero.dispose();
    }
  });

  it("is drawn through a depth flagged for its node twin", () => {
    const haze = createHazeUniforms();
    expect(createShadeDepth(haze).userData.shadeCast).toBe(true);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    mesh.castShadow = true;
    castInLight(mesh, haze);
    expect((mesh.customDepthMaterial as THREE.Material).userData.shadeCast).toBe(true);
  });
});

describe("the node half of the shadows", () => {
  it("builds the taps, the mask and the depth's twin on plain Node", async () => {
    const { castMask, heroShadowed, heroSlots, shadeDepthTwin, syncHero } =
      await import("../pwa/src/game/shadows-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    createHeroShadow(haze, 128, true);
    expect(heroShadowed(haze, float(1))).toBeTruthy();
    expect(castMask(haze)).toBe(castMask(haze)); // one a haze
    const s = heroSlots(haze);
    expect(s.matrix).toHaveLength(4);
    // A SHADOWS row moved makes a new atlas, and the slot follows it.
    createHeroShadow(haze, 64, true);
    syncHero(s);
    expect(s.map.value).toBe(haze.uHeroMap.value);
    const twin = shadeDepthTwin(createShadeDepth(haze, { side: THREE.DoubleSide }), haze);
    expect(twin.side).toBe(THREE.DoubleSide);
    expect(twin.maskNode).toBe(castMask(haze));
  });

  it("cuts the key's pass where castInLight dressed a caster, and nowhere else", async () => {
    const { KeyShadowNode, castMask, keyShadowOf } = await import("../pwa/src/game/shadows-tsl.ts");
    const haze = createHazeUniforms();
    const key = new KeyLight(haze);
    const node = new KeyShadowNode(key);
    expect(keyShadowOf(key)).toBe(node);
    const drawn = vi.fn();
    const renderer = {
      shadowMap: { type: THREE.PCFShadowMap },
      getMRT: () => null,
      renderObject: drawn,
    };
    const fn = node.getShadowRenderObjectFunction(renderer as never) as (...a: unknown[]) => void;
    expect(node.getShadowRenderObjectFunction(renderer as never)).toBe(fn);
    const dressed = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    dressed.castShadow = plain.castShadow = true;
    castInLight(dressed, haze);
    const scene = new THREE.Scene();
    for (const m of [dressed, plain]) fn(m, scene, null, m.geometry, m.material, null, null, null);
    expect(drawn).toHaveBeenCalledTimes(2);
    const mask = (m: THREE.Mesh): unknown =>
      (m.material as THREE.Material & { maskShadowNode?: unknown }).maskShadowNode;
    expect(mask(dressed)).toBe(castMask(haze));
    expect(mask(plain)).toBeUndefined();
  });
});

describe("the node renderer's warm-up (warmNode)", () => {
  it("draws the scene whole and the shadow once through a pixel, and puts it back", async () => {
    const { warmNode } = await import("../pwa/src/game/environment.ts");
    const scene = new THREE.Scene();
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    hidden.visible = false;
    const culled = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    culled.frustumCulled = true;
    const apart = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    apart.visible = false;
    apart.userData.warmApart = true; // the deformable snow's mesh
    scene.add(hidden, culled, apart);
    const sun = new KeyLight(createHazeUniforms());
    sun.castShadow = true;
    sun.shadow.camera.left = -5;
    const camera = new THREE.PerspectiveCamera();
    const seen: string[] = [];
    let scissor = false;
    const box = new THREE.Vector4(0, 0, 640, 360);
    const gl = {
      shadowMap: { enabled: true },
      render: vi.fn(() => {
        seen.push(
          `render shown=${hidden.visible} apart=${apart.visible} culled=${culled.frustumCulled} box=${sun.shadow.camera.left} due=${sun.shadow.needsUpdate} scissor=${scissor} ${box.z}x${box.w}`,
        );
      }),
      setRenderTarget: vi.fn(),
      getScissorTest: () => scissor,
      setScissorTest: (on: boolean) => void (scissor = on),
      getScissor: (v: THREE.Vector4) => v.copy(box),
      setScissor: (x: number | THREE.Vector4, y?: number, w?: number, h?: number) =>
        void (typeof x === "number" ? box.set(x, y!, w!, h!) : box.copy(x)),
    };
    const frame = { beginFrame: vi.fn(), endFrame: vi.fn() };
    const quarantine = { hide: vi.fn(), restore: vi.fn() };
    warmNode(gl as never, scene, camera, sun, 400, frame, quarantine);
    expect(seen).toEqual([
      "render shown=true apart=false culled=false box=-400 due=true scissor=true 1x1",
    ]);
    expect(quarantine.hide).toHaveBeenCalledTimes(1);
    expect(quarantine.restore).toHaveBeenCalledTimes(1);
    expect(frame.beginFrame).toHaveBeenCalledTimes(1);
    expect(hidden.visible).toBe(false);
    expect(culled.frustumCulled).toBe(true);
    expect(sun.shadow.camera.left).toBe(-5);
    expect(scissor).toBe(false);
    expect(box.toArray()).toEqual([0, 0, 640, 360]);
  });
});
