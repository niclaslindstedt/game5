// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER, THE MODELS AND THE EFFECTS ON THE NODE RENDERER
// (`docs/webgpu.md`, part 12). What the suite holds: the register draws the
// skier's, the models', the cloths' and the effects' families on every path
// and leaves what is left to the harnesses' part; each classic material with a
// GLSL graft carries its node graft's flag and the very uniforms WebGL's
// graft is handed; every ShaderMaterial of the effects is flagged with its
// twin, and the twin is made on plain Node reading the material DRAWN (a
// hundred bones share one program); a graft's nodes go on the copy alone,
// so the shadows stay WebGL's; and the X-ray's veil clears the depth by a
// draw on the node renderer, never by a clear inside its pass.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createBurnerFlame } from "../pwa/src/game/balloon-flame.ts";
import { createBurnView } from "../pwa/src/game/burn-view.ts";
import { GPU_PORTS, nodeDissolve, nodeGraft, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { withFlutter } from "../pwa/src/game/player-model.ts";
import { rotorDisc, type DiscSpec } from "../pwa/src/game/rotor-disc.ts";
import { createXrayBlood } from "../pwa/src/game/xray-blood.ts";
import { createXrayView } from "../pwa/src/game/xray-view.ts";

const DISC: DiscSpec = {
  radius: 5,
  root: 0.4,
  chord: 0.3,
  taper: 0.3,
  tipFrom: 0.8,
  band: 0.95,
  blades: 4,
  first: 0,
  trail: 1,
};

/** Every ShaderMaterial under `root`. */
function shaders(root: THREE.Object3D): THREE.ShaderMaterial[] {
  const out: THREE.ShaderMaterial[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : [])
      if ((x as THREE.ShaderMaterial).isShaderMaterial) out.push(x as THREE.ShaderMaterial);
  });
  return out;
}

/** The effects as their views make them, each with its flag's kind. */
function effects() {
  const xray = createXrayView();
  const blood = createXrayBlood(24);
  blood.update(
    [
      {
        key: "femurL",
        matrix: new THREE.Matrix4(),
        at: new THREE.Vector3(),
        axis: null,
        radius: 0.05,
        since: 0,
      },
    ],
    10,
    1,
    0,
  );
  const burn = createBurnView(createHazeUniforms());
  const flame = createBurnerFlame();
  const disc = rotorDisc(DISC);
  return { xray, blood, burn, flame, disc };
}

describe("the part's families in the register", () => {
  it("are ported in part 12 and drawn on every path", () => {
    for (const id of ["effects", "model-merged", "skier", "wingsuit", "cloth"]) {
      const row = GPU_PORTS.find((p) => p.id === id);
      expect(row?.kind, id).toBe("material");
      expect(row?.part, id).toBe(12);
      expect(row?.ported, id).toBe(true);
      for (const b of ["webgl", "webgpu", "webgpu-gl"] as const)
        expect(quarantinedOn(b, id), id).toBe(false);
    }
  });

  it("leave the other ShaderMaterials and grafts to the guards' part", () => {
    expect(GPU_PORTS.find((p) => p.id === "shader")).toMatchObject({ part: 16, ported: false });
    expect(GPU_PORTS.find((p) => p.id === "haze-graft")).toMatchObject({
      part: 16,
      ported: false,
    });
  });
});

describe("the grafts' flags", () => {
  it("name the graft and keep WebGL's program keyed as before", () => {
    const m = nodeGraft(new THREE.MeshStandardMaterial(), "model-merged", "pbr");
    expect(m.userData).toMatchObject({ graft: "pbr", glsl: "model-merged" });
    const u = {
      uFlow: { value: new THREE.Vector3() },
      uFlTime: { value: 0 },
      uFloat: { value: 0 },
    };
    const kit = withFlutter(new THREE.MeshStandardMaterial(), u as never);
    expect(kit.userData).toMatchObject({ graft: "flutter", glsl: "skier" });
    expect(kit.customProgramCacheKey()).toMatch(/:flutter:/);
    // The very uniforms WebGL's graft is handed.
    const own = kit.userData.graftOwn as Record<string, THREE.IUniform>;
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    kit.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
    for (const name of ["uFlow", "uFlTime", "uFloat"])
      expect(shader.uniforms[name], name).toBe(own[name]);
  });

  it("are not hidden on the webgpu paths", () => {
    const { xray, blood, burn, flame, disc } = effects();
    const scene = new THREE.Scene();
    scene.add(xray.group, blood.group, burn.group, flame.group, disc);
    const box = new THREE.BoxGeometry();
    for (const [family, kind] of [
      ["model-merged", "pbr"],
      ["skier", "rigid"],
      ["wingsuit", "wingsuit"],
      ["cloth", "envelope"],
    ])
      scene.add(new THREE.Mesh(box, nodeGraft(new THREE.MeshStandardMaterial(), family, kind)));
    const q = createQuarantine("webgpu");
    q.hide(scene);
    expect(q.counts()).toEqual({});
    q.restore();
  });
});

describe("the effects' twins (built on plain Node)", () => {
  it("flag every ShaderMaterial of the effects with its twin", () => {
    const { xray, blood, burn, flame, disc } = effects();
    const kinds = (root: THREE.Object3D) =>
      new Set(shaders(root).map((m) => `${m.userData.glsl}:${m.userData.twin}`));
    // The veil (the glass and the mask hang on his skin; the bones load
    // with the X-ray's model).
    expect([...kinds(xray.group)]).toEqual(["effects:xray-veil"]);
    expect([...kinds(blood.group)]).toEqual(["effects:xray-blood"]);
    expect([...kinds(burn.group)].sort()).toEqual(
      [
        "effects:burn-flames",
        "effects:burn-glow",
        "effects:burn-smoke",
        "effects:burn-sparks",
      ].sort(),
    );
    expect([...kinds(flame.group)]).toEqual(["effects:flame"]);
    expect([...kinds(disc)]).toEqual(["effects:rotor"]);
  });

  it("are what the dressing hands, each reading the material drawn", async () => {
    const { NodeMaterial } = await import("three/webgpu");
    const { effectTwin } = await import("../pwa/src/game/effects-tsl.ts");
    const { xray, burn, flame, disc } = effects();
    const all = [xray.group, burn.group, flame.group, disc].flatMap(shaders);
    for (const m of all) {
      const twin = effectTwin(m, m.userData.twin as string)!;
      expect(twin, m.userData.twin as string).toBeInstanceOf(NodeMaterial);
      expect(twin.transparent).toBe(m.transparent);
      expect(twin.fragmentNode).not.toBeNull();
      // The classic material carries a node, so its draw's uniforms refresh.
      expect((m as unknown as { twinNode?: { isNode: boolean } }).twinNode?.isNode).toBe(true);
    }
    const veil = shaders(xray.group).find((m) => m.userData.twin === "xray-veil")!;
    const twin = effectTwin(veil, "xray-veil")!;
    expect([twin.depthTest, twin.depthWrite, twin.depthFunc]).toEqual([
      true,
      true,
      THREE.AlwaysDepth,
    ]);
    // The bones' and the organs' (one program for them all), the glass's and
    // the mask's, which three's own skinned vertex carries.
    for (const kind of ["xray-piece", "xray-glass", "xray-mask"]) {
      const m = new THREE.ShaderMaterial({ transparent: true, colorWrite: kind !== "xray-mask" });
      const t = effectTwin(m, kind)!;
      expect(t, kind).toBeInstanceOf(NodeMaterial);
      expect(t.vertexNode === null, kind).toBe(kind !== "xray-piece");
      expect(t.colorWrite, kind).toBe(kind !== "xray-mask");
    }
    expect(effectTwin(new THREE.ShaderMaterial(), "rock")).toBeNull();
  });

  it("clear the depth under him by a draw on the node renderer", () => {
    const { xray } = effects();
    const veil = xray.group.children.find(
      (o) => ((o as THREE.Mesh).material as THREE.Material)?.userData?.twin === "xray-veil",
    )!;
    let cleared = 0;
    const call = (r: object) =>
      veil.onBeforeRender(
        { ...r, clearDepth: () => cleared++ } as never,
        null as never,
        null as never,
        null as never,
        null as never,
        null as never,
      );
    call({});
    expect(cleared).toBe(1);
    call({ isWebGPURenderer: true });
    expect(cleared).toBe(1);
  });
});

describe("the part's TSL", () => {
  it("names only what three's TSL exports", async () => {
    // A name three does not have is undefined, typed as anything, and
    // throws only inside a node function at the first build.
    const { readFileSync } = await import("node:fs");
    const TSL = (await import("three/tsl")) as Record<string, unknown>;
    for (const file of [
      "model-grafts-tsl.ts",
      "cloth-tsl.ts",
      "effects-tsl.ts",
      "balloon-flame-tsl.ts",
      "fire-tsl.ts",
      "burn-tsl.ts",
      "xray-tsl.ts",
      "figure-tsl.ts",
    ]) {
      const src = readFileSync(new URL(`../pwa/src/game/${file}`, import.meta.url), "utf8");
      for (const m of src.matchAll(/const \{([^}]*)\} = TSL as N;/g)) {
        const names = m[1]
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
        expect(
          names.filter((n) => !(n in TSL)),
          file,
        ).toEqual([]);
      }
    }
  });
});

describe("the grafts on the copy", () => {
  it("set their nodes on the copy alone", async () => {
    const { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } = await import("three/webgpu");
    const { finishGraft } = await import("../pwa/src/game/model-grafts-tsl.ts");
    const pbr = nodeGraft(new THREE.MeshStandardMaterial(), "model-merged", "pbr");
    const copy = new MeshStandardNodeMaterial();
    finishGraft(copy, pbr);
    expect(copy.metalnessNode).not.toBeNull();
    expect(copy.roughnessNode).not.toBeNull();
    const coat = new MeshPhysicalNodeMaterial();
    finishGraft(coat, pbr);
    expect(coat.clearcoatNode).not.toBeNull();
    for (const kind of ["rigid", "flutter"]) {
      const m = nodeGraft(new THREE.MeshStandardMaterial(), "skier", kind);
      const c = new MeshStandardNodeMaterial();
      finishGraft(c, m);
      expect(c.positionNode, kind).not.toBeNull();
      // The material drawn keeps none: the shadow passes copy ITS position.
      expect((m as unknown as { positionNode?: unknown }).positionNode, kind).toBeUndefined();
      // A clone copies the flag in its userData but never WebGL's graft: it
      // is drawn plain on both (a dead skier's baked remains).
      const plain = new MeshStandardNodeMaterial();
      finishGraft(plain, m.clone());
      expect(plain.positionNode, kind).toBeNull();
    }
  });

  it("clip a copy by its material's own planes, as a mask", async () => {
    const { MeshStandardNodeMaterial } = await import("three/webgpu");
    const { finishGraft } = await import("../pwa/src/game/model-grafts-tsl.ts");
    const m = new THREE.MeshStandardMaterial({ clippingPlanes: [new THREE.Plane()] });
    const copy = new MeshStandardNodeMaterial();
    finishGraft(copy, m);
    expect(copy.maskNode).not.toBeNull();
    expect((m as unknown as { graftNode?: { isNode: boolean } }).graftNode?.isNode).toBe(true);
  });

  it("dissolve his skin under the X-ray where the view flags it", async () => {
    const { MeshStandardNodeMaterial } = await import("three/webgpu");
    const { dissolveSkin } = await import("../pwa/src/game/xray-tsl.ts");
    const plain = new THREE.MeshStandardMaterial();
    const untouched = new MeshStandardNodeMaterial();
    dissolveSkin(untouched, plain);
    expect(untouched.maskNode).toBeNull();
    const skin = new THREE.MeshStandardMaterial();
    nodeDissolve(skin, { uXrSolid: { value: 1 }, uXrEdge: { value: new THREE.Color() } });
    const copy = new MeshStandardNodeMaterial();
    dissolveSkin(copy, skin);
    expect(copy.maskNode).not.toBeNull();
    expect(Object.hasOwn(copy, "setupOutput")).toBe(true);
    const remains = new MeshStandardNodeMaterial();
    dissolveSkin(remains, skin.clone());
    expect(remains.maskNode).toBeNull();
  });
});
