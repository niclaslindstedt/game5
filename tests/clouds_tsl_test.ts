// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUDS ON THE NODE RENDERER (`docs/webgpu.md`, part 10): the cloud
// shadow map, MEDIUM's slab and HIGH's volume (its marches and its carry)
// are drawn there by NODE TWINS of `clouds.ts`'s and `cloud-volume.ts`'s
// ShaderMaterials into three's own targets, and the key's light and the
// light in the air read the shadow map. What the suite holds: the register
// says so; each pass is drawn, flagged with its twin, into the kind of
// target its renderer takes (the fresh march into two at once); WebGL's are
// what they were; every twin is made on plain Node over its material's own
// uniforms; the volume's noise is laid on 2D sheets every channel; and the
// shadow read follows the map the clouds draw.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { withSky } from "@engine";

import { CLOUD_SHADOW, createClouds, forceCloudTier } from "../pwa/src/game/clouds.ts";
import { GPU_PORTS, quarantinedOn, runsPass } from "../pwa/src/game/gpu-backend.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { skyLookAt } from "../pwa/src/game/sky.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** What a stand-in renderer was asked to draw: the material and the target. */
type Drawn = { material: THREE.ShaderMaterial; target: THREE.RenderTarget | null };

/** A renderer that records its draws: the node renderer's (`node`) or
 * WebGL's, typed as the one `clouds.ts` takes. */
function stubRenderer(node: boolean) {
  const drawn: Drawn[] = [];
  let target: THREE.RenderTarget | null = null;
  const gl = {
    initialized: true,
    capabilities: { isWebGL2: true },
    extensions: { has: () => true },
    getRenderTarget: () => target,
    setRenderTarget(t: THREE.RenderTarget | null) {
      target = t;
    },
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(64, 36),
    render(scene: THREE.Scene) {
      const quad = scene.children[0] as THREE.Mesh;
      drawn.push({ material: quad.material as THREE.ShaderMaterial, target });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, drawn, node };
}

const level = withSky(syntheticLevel(), { weather: "overcast", hour: 12 });
const look = skyLookAt(level, 0);
const lens = (): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 60000);
  camera.position.set(0, 40, 0);
  camera.lookAt(0, 40, 100);
  return camera;
};

describe("the clouds in the register", () => {
  it("run their passes on the webgpu paths since part 10", () => {
    const row = GPU_PORTS.find((p) => p.id === "clouds");
    expect(row?.part).toBe(10);
    expect(row?.ported).toBe(true);
    expect(runsPass("webgpu", "clouds")).toBe(true);
    expect(runsPass("webgpu-gl", "clouds")).toBe(true);
    expect(quarantinedOn("webgpu", "clouds")).toBe(false);
    // The other ShaderMaterials (the gear stage's backdrop) wait for theirs.
    expect(GPU_PORTS.find((p) => p.id === "shader")?.part).toBe(16);
    expect(quarantinedOn("webgpu", "shader")).toBe(true);
  });
});

describe("the clouds' passes", () => {
  it("draw the shadow map and the slab by their twins into the node renderer's targets", () => {
    const r = stubRenderer(true);
    const haze = createHazeUniforms();
    const clouds = createClouds(r.gl, haze, true);
    expect(look.clouds.layers.length).toBeGreaterThan(0);
    clouds.setTier("slab4");
    clouds.update(look, level, 0, lens());
    const kinds = r.drawn.map((d) => d.material.userData.twin);
    expect(kinds).toEqual(["cloud-map", "cloud-slab"]);
    for (const d of r.drawn) {
      expect(d.material.userData.glsl).toBe("clouds");
      expect(d.target?.isRenderTarget).toBe(true);
      expect((d.target as THREE.WebGLRenderTarget).isWebGLRenderTarget).toBeUndefined();
    }
    expect(r.drawn[0].target?.width).toBe(CLOUD_SHADOW.size);
    expect(haze.uCloudShadow.value).toBe(r.drawn[0].target?.texture);
    expect(clouds.uniforms.uCloudTex.value).toBe(r.drawn[1].target?.texture);
    expect(r.drawn[1].material.defines).toMatchObject({ STEPS: 4, LIGHT: 1 });
    clouds.dispose();
  });

  it("draw the shadow map once on the node renderer with no layer standing", () => {
    const clear = withSky(syntheticLevel(), { weather: "clear", hour: 12 });
    // Even a clear sky carries a high veil; with no map there is none.
    const sky = skyLookAt(clear, 0);
    for (const node of [true, false]) {
      const r = stubRenderer(node);
      const clouds = createClouds(r.gl, createHazeUniforms(), node);
      clouds.setTier("shell");
      clouds.update(sky, null, 0, lens());
      clouds.update(sky, null, 1, lens());
      // A target bound before its pass first drew is made twice there, so
      // the node renderer clears it once; WebGL never draws an empty sky.
      expect(r.drawn.map((d) => d.material.userData.twin)).toEqual(node ? ["cloud-map"] : []);
      clouds.dispose();
    }
  });

  it("march HIGH's volume whole, then a share fresh into two targets and the rest carried", async () => {
    const r = stubRenderer(true);
    const clouds = createClouds(r.gl, createHazeUniforms(), true);
    clouds.setTier("volume");
    await clouds.prepare();
    clouds.update(look, level, 0, lens());
    clouds.update(look, level, 1 / 60, lens());
    const kinds = r.drawn.map((d) => [d.material.userData.twin, d.material.defines.WHOLE ?? 0]);
    expect(kinds).toEqual([
      ["cloud-map", 0],
      ["cloud-march", 1],
      ["cloud-map", 0],
      ["cloud-march", 0],
      ["cloud-carry", 0],
    ]);
    const fresh = r.drawn[3].target!;
    expect(fresh.textures.length).toBe(2);
    expect(fresh.textures[1].magFilter).toBe(THREE.NearestFilter);
    expect(r.drawn[1].target?.textures.length).toBe(1);
    expect(clouds.volume()).toBe(true);
    expect(clouds.uniforms.uCloudTex.value).toBe(r.drawn[4].target?.texture);
    clouds.dispose();
  });

  it("are WebGL's own targets on WebGL, as before", () => {
    const r = stubRenderer(false);
    const clouds = createClouds(r.gl, createHazeUniforms(), false);
    clouds.setTier("slab8");
    clouds.update(look, level, 0, lens());
    expect(r.drawn.length).toBe(2);
    for (const d of r.drawn) {
      expect((d.target as THREE.WebGLRenderTarget).isWebGLRenderTarget).toBe(true);
    }
    expect(r.drawn[1].material.defines).toMatchObject({ STEPS: 8, LIGHT: 2 });
    clouds.dispose();
  });
});

describe("the clouds' twins", () => {
  it("are made on plain Node, once a material, over its own uniforms", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    const twins = createTwins(haze, { display: float(0), exposure: float(1) });
    const r = stubRenderer(true);
    const clouds = createClouds(r.gl, haze, true);
    for (const tier of ["slab4", "volume"] as const) {
      clouds.setTier(tier);
      await clouds.prepare();
      clouds.update(look, level, 0, lens());
      clouds.update(look, level, 1 / 60, lens());
    }
    const seen = new Set<string>();
    for (const { material } of r.drawn) {
      const twin = twins.of(material);
      expect(twin?.isNodeMaterial, String(material.userData.twin)).toBe(true);
      expect(twins.of(material)).toBe(twin);
      expect(twin?.fragmentNode).not.toBe(null);
      expect(twin?.depthTest).toBe(false);
      expect(twin?.blending).toBe(THREE.NoBlending);
      expect(twin?.fog).toBe(false);
      // A node on the ShaderMaterial drawn: its bindings refreshed every draw.
      const kept = (material as unknown as { passNode?: { isNode?: boolean } }).passNode;
      expect(kept?.isNode).toBe(true);
      seen.add(`${material.userData.twin}${material.defines.WHOLE ? ":whole" : ""}`);
    }
    expect([...seen].sort()).toEqual([
      "cloud-carry",
      "cloud-map",
      "cloud-march",
      "cloud-march:whole",
      "cloud-slab",
    ]);
    clouds.dispose();
    forceCloudTier(null);
  });

  it("lay the volume's noise on 2D sheets, every channel", async () => {
    const { noiseAtlas } = await import("../pwa/src/game/cloud-shell-tsl.ts");
    const n = 4;
    const data = new Uint8Array(n * n * n * 4).map((_, i) => (i * 29) % 253);
    const src = new THREE.Data3DTexture(data, n, n, n);
    src.format = THREE.RGBAFormat;
    const atlas = noiseAtlas(src);
    expect(atlas.tex.format).toBe(THREE.RGBAFormat);
    const sheet = atlas.tex.image.data as Uint8Array;
    const { grid, size } = atlas;
    const tile = n + 2;
    for (let z = 0; z < n; z++)
      for (let y = -1; y <= n; y++)
        for (let x = -1; x <= n; x++)
          for (let c = 0; c < 4; c++) {
            const at =
              ((Math.floor(z / grid) * tile + 1 + y) * size + (z % grid) * tile + 1 + x) * 4;
            const from = (((x + n) % n) + ((y + n) % n) * n + z * n * n) * 4;
            expect(sheet[at + c]).toBe(data[from + c]);
          }
  });

  it("read the shadow map in the key's light, re-pointed at what the clouds draw", async () => {
    const { lightSlots, syncLights } = await import("../pwa/src/game/lights-tsl.ts");
    const { cloudShadow } = await import("../pwa/src/game/cloud-pass-tsl.ts");
    const { vec3 } = await import("three/tsl");
    const haze = createHazeUniforms();
    const s = lightSlots(haze);
    expect(s.clouds.value).toBe(s.blank); // no clouds yet
    const r = stubRenderer(true);
    const clouds = createClouds(r.gl, haze, true);
    syncLights(s);
    expect(s.clouds.value).toBe(haze.uCloudShadow.value);
    expect(cloudShadow(s.cloud, vec3(0, 0, 0)).isNode).toBe(true);
    clouds.dispose();
    syncLights(s);
    expect(s.clouds.value).toBe(s.blank);
  });

  it("let the dome read the pass's picture by its tier", async () => {
    const { domeTwin } = await import("../pwa/src/game/sky-dome-tsl.ts");
    const { createSkyDome } = await import("../pwa/src/game/sky-dome.ts");
    const haze = createHazeUniforms();
    const r = stubRenderer(true);
    const clouds = createClouds(r.gl, haze, true);
    const dome = createSkyDome(haze, 1000, clouds, null);
    clouds.setTier("slab4");
    clouds.update(look, level, 0, lens());
    dome.syncClouds();
    const m = dome.mesh.material as THREE.ShaderMaterial;
    expect(m.defines.CLOUD_SLAB).toBe(1);
    const twin = domeTwin(m, haze);
    expect(twin.fragmentNode).not.toBe(null);
    expect((m as unknown as { twinNode?: { isNode?: boolean } }).twinNode?.isNode).toBe(true);
    clouds.dispose();
  });
});
