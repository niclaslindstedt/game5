// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY ON THE NODE RENDERER (`docs/webgpu.md`, part 3): the dome, the far
// ranges and the GPU sky's passes are drawn there by NODE TWINS of their
// ShaderMaterials (`sky-twins-tsl.ts`) — so what the suite holds is that
// each carries its twin's flag, that the quarantine lets the flagged ones
// through while every other ShaderMaterial stays hidden, that the register
// says so, and that every twin is made on plain Node over the material's
// own uniforms, once a material.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createClouds } from "../pwa/src/game/clouds.ts";
import { createContrails } from "../pwa/src/game/contrails.ts";
import { GPU_PORTS, quarantinedOn, runsPass } from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { createSkyDome } from "../pwa/src/game/sky-dome.ts";

const stage = () => {
  const haze = createHazeUniforms();
  const clouds = createClouds(null, haze);
  const dome = createSkyDome(haze, 1000, clouds, createContrails());
  return { haze, clouds, dome };
};

describe("the sky in the register", () => {
  it("runs the GPU sky's passes and draws the sky's twins on the webgpu paths", () => {
    expect(runsPass("webgpu", "sky-gpu")).toBe(true);
    expect(runsPass("webgpu-gl", "sky-gpu")).toBe(true);
    expect(quarantinedOn("webgpu", "sky")).toBe(false);
    expect(GPU_PORTS.find((p) => p.id === "sky")?.part).toBe(3);
    // Every other ShaderMaterial waits for its own part.
    expect(quarantinedOn("webgpu", "shader")).toBe(true);
  });
});

describe("the sky's node twins", () => {
  it("are flagged on the dome's material, the family the quarantine lets through", () => {
    const { dome } = stage();
    const m = dome.mesh.material as THREE.ShaderMaterial;
    expect(m.isShaderMaterial).toBe(true);
    expect(m.userData.twin).toBe("dome");
    expect(m.userData.glsl).toBe("sky");
    const scene = new THREE.Scene();
    const spray = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial());
    scene.add(dome.mesh, spray);
    const q = createQuarantine("webgpu");
    q.hide(scene);
    expect(dome.mesh.visible).toBe(true);
    expect(spray.visible).toBe(false);
    q.restore();
  });

  it("are made on plain Node, once a material, over its own uniforms", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const { haze, dome } = stage();
    const twins = createTwins(haze, { display: float(1), exposure: float(1) });
    const m = dome.mesh.material as THREE.ShaderMaterial;
    const twin = twins.of(m);
    expect(twin?.isNodeMaterial).toBe(true);
    expect(twins.of(m)).toBe(twin);
    expect(twin?.side).toBe(THREE.BackSide);
    expect(twin?.fog).toBe(false); // the dome is the haze's own colour
    // A material with no twin is three's to copy.
    expect(twins.of(new THREE.MeshStandardMaterial())).toBeNull();
    // The GPU sky's passes, each over the uniforms `sky-gpu.ts` hands it.
    const tex = new THREE.DataTexture(
      new Uint16Array(4),
      1,
      1,
      THREE.RGBAFormat,
      THREE.HalfFloatType,
    );
    const pass = (kind: string, uniforms: Record<string, THREE.IUniform>, steps = 0) => {
      const p = new THREE.ShaderMaterial({ uniforms, defines: { STEPS: steps } });
      p.userData.twin = kind;
      return twins.of(p);
    };
    const tables = { uTrans: { value: tex }, uMs: { value: tex } };
    expect(pass("trans", {})).toBeTruthy();
    expect(pass("ms", tables)).toBeTruthy();
    const view = {
      ...tables,
      uSize: { value: new THREE.Vector2(96, 50) },
      uElevation: { value: 0.3 },
      uRadius: { value: 6360 },
      uExpose: { value: new THREE.Vector4() },
      uNightRows: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    };
    expect(pass("view", view, 8)).toBeTruthy();
    const froxel = {
      ...tables,
      uInvViewProj: { value: new THREE.Matrix4() },
      uEye: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3() },
      uRadius: { value: 6360 },
      uHazeLaw: { value: new THREE.Vector3() },
      uGround: { value: null },
      uGroundBox: { value: new THREE.Vector4() },
      uGroundOn: { value: new THREE.Vector4() },
    };
    expect(pass("froxel", froxel)).toBeTruthy();
    expect(pass("not-a-twin", {})).toBeNull();
  });

  it("are made for the far ranges' rings and disc over their own uniforms", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    const twins = createTwins(haze, { display: float(0), exposure: float(1) });
    // `far-ranges.ts`'s materials stand only over a map: the same uniforms,
    // flagged the same way.
    const far = (backdrop: boolean): THREE.ShaderMaterial => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          ...haze,
          uBandY: { value: new THREE.Vector4(0, 1000, 2000, 3000) },
          uBand: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
          uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
          uSkyLight: { value: new THREE.Vector3(1, 1, 1) },
          uGroundLight: { value: new THREE.Vector3(1, 1, 1) },
          uAmbient: { value: 1 },
          uBackdrop: { value: backdrop ? 1 : 0 },
          uNear: { value: 0 },
        },
        depthWrite: !backdrop,
      });
      m.userData.twin = "far";
      return m;
    };
    for (const backdrop of [true, false]) {
      const twin = twins.of(far(backdrop));
      expect(twin?.isNodeMaterial).toBe(true);
      expect(twin?.depthWrite).toBe(!backdrop);
      expect(twin?.fog).toBe(false); // hazed in its own fragment
    }
  });
});

describe("the cloud noise on the node renderer", () => {
  it("is the 3D field laid out on a 2D sheet, each slice's border wrapped", async () => {
    const { noiseAtlas } = await import("../pwa/src/game/cloud-shell-tsl.ts");
    const n = 8;
    const data = new Uint8Array(n * n * n).map((_, i) => (i * 37) % 251);
    const src = new THREE.Data3DTexture(data, n, n, n);
    const atlas = noiseAtlas(src);
    expect(noiseAtlas(src)).toBe(atlas); // once a noise
    const { grid, size } = atlas;
    expect(grid * grid).toBeGreaterThanOrEqual(n);
    const sheet = atlas.tex.image.data as Uint8Array;
    const tile = n + 2;
    const at = (x: number, y: number, z: number): number =>
      sheet[(Math.floor(z / grid) * tile + 1 + y) * size + (z % grid) * tile + 1 + x];
    const field = (x: number, y: number, z: number): number =>
      data[((x + n) % n) + ((y + n) % n) * n + z * n * n];
    for (let z = 0; z < n; z++)
      for (let y = -1; y <= n; y++)
        for (let x = -1; x <= n; x++) expect(at(x, y, z)).toBe(field(x, y, z));
  });
});
