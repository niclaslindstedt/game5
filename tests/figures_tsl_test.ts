// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIGURES ON THE NODE RENDERER (`docs/webgpu.md`, part 11): the crowd,
// the people on foot, the dogs and their steam, the traffic, a race's fans,
// the birds and the animals, and the blooded tree — each a classic material
// with a GLSL graft on WebGL, drawn on the node renderer by a FIGURE TWIN
// (`figure-tsl.ts`, `figure-twins-tsl.ts`). What the suite holds: the
// register draws the families on every path and leaves the rest hidden;
// every material carries its twin's flag and is not hidden; the uniforms a
// twin reads are the very objects WebGL's graft is handed; every twin is
// made on plain Node as a copy of its material with the graft's vertex, and
// paints its colour where the graft does; a caster whose WebGL depth takes
// the graft gets a shadow material moved the same way, and no other; the
// dogs' steam is drawn by a stand-in, a quad a puff; the attributes a twin
// packs to stay within eight vertex buffers; and the two fixes to three's
// node builder (`node-fixes-tsl.ts`).

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BEASTS, type GameState } from "@engine";

import {
  beastDepthMaterial,
  beastMaterial,
  BEAST_STYLES,
  buildBeast,
} from "../pwa/src/game/beast-shapes.ts";
import { BIRDS } from "../pwa/src/game/bird-defs.ts";
import { birdMaterial, wristOf } from "../pwa/src/game/bird-shapes.ts";
import { civilianDepth, civilianMaterial } from "../pwa/src/game/civilian-shapes.ts";
import { crowdMaterial } from "../pwa/src/game/crowd-shapes.ts";
import { dogMaterial } from "../pwa/src/game/dog-shapes.ts";
import { steamMaterial } from "../pwa/src/game/dogs-view.ts";
import { createBloodTrees } from "../pwa/src/game/gore-tree.ts";
import { GPU_PORTS, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { createHazeUniforms, hazeMaterial, type HazeUniforms } from "../pwa/src/game/haze.ts";
import { fanMaterial, fanUniforms } from "../pwa/src/game/spectator-shapes.ts";
import { createShadeDepth, shadeDepth } from "../pwa/src/game/terrain-shade.ts";
import { trafficMaterial } from "../pwa/src/game/traffic-view.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** One of every figure's material, as its view makes it. */
function figures(haze: HazeUniforms) {
  const beast = BEASTS[0];
  const { pivot } = buildBeast(beast, BEAST_STYLES[beast.id], "adult", "far");
  return {
    crowd: crowdMaterial(haze),
    civilians: civilianMaterial(haze),
    dogs: dogMaterial(haze),
    traffic: trafficMaterial(haze, { value: 0 }),
    fans: fanMaterial(haze, fanUniforms()),
    bird: birdMaterial(BIRDS[0], haze),
    beast: beastMaterial(beast, pivot, haze),
    beastDepth: beastDepthMaterial(beast, pivot),
    civilianDepth: civilianDepth(createShadeDepth(haze)),
  };
}

/** The uniforms WebGL's graft hands its program: `m`'s `onBeforeCompile`
 * run over three's own source for its kind. */
function grafted(m: THREE.Material): Record<string, THREE.IUniform> {
  const lib =
    m instanceof THREE.MeshStandardMaterial
      ? THREE.ShaderLib.standard
      : m instanceof THREE.MeshDepthMaterial
        ? THREE.ShaderLib.depth
        : THREE.ShaderLib.lambert;
  const shader = {
    uniforms: THREE.UniformsUtils.clone(lib.uniforms),
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader.uniforms;
}

/** The blooded tree, stained over the synthetic slope's lone tree. */
function bloodTree(haze: HazeUniforms): THREE.MeshStandardMaterial {
  const level = syntheticLevel();
  const tree = level.trees[0];
  const trees = createBloodTrees(
    level,
    (m) => hazeMaterial(m, haze, "gore"),
    () => 1,
  );
  const impaled = {
    x: tree.x,
    y: 0,
    z: tree.z,
    radius: 0.1,
    stuff: "tree",
    point: 0,
    sunk: 1,
    depth: 1,
    t: 2,
  };
  trees.update({ gore: { impaled } } as unknown as GameState);
  const mesh = trees.group.children[0] as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

describe("the figures in the register", () => {
  it("are ported in part 11 and drawn on every path", () => {
    for (const id of ["figures", "gore-tree"]) {
      const row = GPU_PORTS.find((p) => p.id === id);
      expect(row?.kind).toBe("material");
      expect(row?.part).toBe(11);
      expect(row?.ported).toBe(true);
      for (const b of ["webgl", "webgpu", "webgpu-gl"] as const) {
        expect(quarantinedOn(b, id)).toBe(false);
      }
    }
  });

  it("leave the other ShaderMaterials and grafts to their own parts", () => {
    expect(GPU_PORTS.find((p) => p.id === "shader")).toMatchObject({ part: 13, ported: false });
    expect(GPU_PORTS.find((p) => p.id === "haze-graft")).toMatchObject({
      part: 13,
      ported: false,
    });
    expect(quarantinedOn("webgpu", "haze-graft")).toBe(true);
  });
});

describe("the figures' flags", () => {
  it("name each figure's twin in the figures' family", () => {
    const haze = createHazeUniforms();
    const f = figures(haze);
    const kinds: Record<string, THREE.Material> = {
      crowd: f.crowd,
      civilians: f.civilians,
      dogs: f.dogs,
      traffic: f.traffic,
      fans: f.fans,
      bird: f.bird,
      beast: f.beast,
    };
    for (const [kind, m] of Object.entries(kinds)) {
      expect(m.userData.twin, kind).toBe(kind);
      expect(m.userData.glsl, kind).toBe("figures");
      expect(m.userData.haze, kind).toBe(true);
    }
    expect(f.fans.userData.hazeWall).toBe(true);
    const tree = bloodTree(haze);
    expect(tree.userData).toMatchObject({ twin: "gore-tree", glsl: "gore-tree" });
    // The depth materials whose graft the shadow takes, and no other.
    expect(f.civilianDepth.userData.figureDepth).toBe("civilians");
    expect(f.beastDepth.userData.figureDepth).toBe("beast");
    expect(shadeDepth(haze).userData.figureDepth).toBeUndefined();
  });

  it("hand the twin the very uniforms WebGL's graft is handed", () => {
    const haze = createHazeUniforms();
    const f = figures(haze);
    const tree = bloodTree(haze);
    for (const m of [
      f.crowd,
      f.civilians,
      f.traffic,
      f.fans,
      f.bird,
      f.beast,
      f.beastDepth,
      tree,
    ]) {
      const own = m.userData.figureOwn as Record<string, THREE.IUniform>;
      const uniforms = grafted(m);
      expect(Object.keys(own).length, m.type).toBeGreaterThan(0);
      for (const [name, u] of Object.entries(own)) expect(uniforms[name], name).toBe(u);
    }
    // A species' own wrist, not the roster's.
    expect((f.bird.userData.figureOwn as { uWrist: { value: number } }).uWrist.value).toBe(
      wristOf(BIRDS[0]),
    );
  });

  it("leave WebGL's programs keyed as before", () => {
    const f = figures(createHazeUniforms());
    expect(f.crowd.customProgramCacheKey()).toBe("haze:crowd");
    expect(f.civilians.customProgramCacheKey()).toBe("haze:civilians");
    expect(f.fans.customProgramCacheKey()).toBe("haze:spectators");
    expect(f.bird.customProgramCacheKey()).toBe("haze:bird");
    expect(f.beast.customProgramCacheKey()).toBe("haze:beast");
    expect(f.civilianDepth.customProgramCacheKey()).toBe("civilian-shade-depth");
  });

  it("are not hidden on the webgpu paths", () => {
    const f = figures(createHazeUniforms());
    const scene = new THREE.Scene();
    const box = new THREE.BoxGeometry();
    for (const m of [f.crowd, f.civilians, f.dogs, f.traffic, f.fans, f.bird, f.beast]) {
      scene.add(new THREE.InstancedMesh(box, m, 1));
    }
    const rock = hazeMaterial(
      new THREE.MeshStandardMaterial(),
      createHazeUniforms(),
      "rock",
      () => {},
    );
    scene.add(new THREE.Mesh(box, rock));
    const q = createQuarantine("webgpu");
    q.hide(scene);
    expect(q.counts()).toEqual({ "haze-graft:scene": 1 });
    q.restore();
  });
});

describe("the figures' twins (built on plain Node)", () => {
  it("copy the material and run the graft's vertex", async () => {
    const { MeshLambertNodeMaterial, MeshStandardNodeMaterial, NodeMaterial } =
      await import("three/webgpu");
    const { figureTwinOf } = await import("../pwa/src/game/figure-twins-tsl.ts");
    const haze = createHazeUniforms();
    const f = figures(haze);
    const tree = bloodTree(haze);
    const cases: [THREE.Material, string, boolean][] = [
      [f.crowd, "crowd", true],
      [f.civilians, "civilians", true],
      [f.dogs, "dogs", true],
      [f.traffic, "traffic", true],
      [f.fans, "fans", true],
      [f.bird, "bird", false],
      [f.beast, "beast", true],
      [tree, "gore-tree", false],
    ];
    for (const [m, kind, painted] of cases) {
      const twin = figureTwinOf(m, kind, haze)!;
      const standard = m instanceof THREE.MeshStandardMaterial;
      expect(twin, kind).toBeInstanceOf(
        standard ? MeshStandardNodeMaterial : MeshLambertNodeMaterial,
      );
      // Its own vertex, round three's morphs and instance.
      expect(twin.setupPosition, kind).not.toBe(NodeMaterial.prototype.setupPosition);
      expect(twin.side, kind).toBe(m.side);
      expect(twin.fog, kind).toBe(true);
      expect(twin.userData, kind).toBe(m.userData);
      // A painted twin draws its colour off the paint alone.
      expect(twin.vertexColors, kind).toBe(!painted);
      expect(twin.colorNode !== null, kind).toBe(painted);
      // The material drawn carries a node, so the renderer refreshes it.
      expect((m as unknown as { figureNode?: { isNode: boolean } }).figureNode?.isNode, kind).toBe(
        true,
      );
    }
    expect(figureTwinOf(f.fans, "fans", haze)!.maskNode).not.toBeNull();
    expect(figureTwinOf(f.crowd, "crowd", haze)!.maskNode).toBeNull();
    expect(tree.polygonOffset && figureTwinOf(tree, "gore-tree", haze)!.polygonOffset).toBe(true);
    // The traffic's roughness and its lamps.
    const traffic = figureTwinOf(f.traffic, "traffic", haze) as unknown as {
      roughnessNode: unknown;
      emissiveNode: unknown;
    };
    expect(traffic.roughnessNode).not.toBeNull();
    expect(traffic.emissiveNode).not.toBeNull();
    expect(figureTwinOf(new THREE.MeshBasicMaterial(), "rock", haze)).toBeNull();
  });

  it("is what the dressing's twins hand for a figure's flag", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const haze = createHazeUniforms();
    const twins = createTwins(haze, { display: float(0), exposure: float(1) });
    const f = figures(haze);
    const twin = twins.of(f.crowd);
    expect(twin).not.toBeNull();
    expect(twins.of(f.crowd)).toBe(twin);
  });
});

describe("the figures' shadows", () => {
  it("move a caster the way its WebGL depth does, and no other", async () => {
    const { figureShadowOf } = await import("../pwa/src/game/figure-twins-tsl.ts");
    const haze = createHazeUniforms();
    const f = figures(haze);
    for (const depth of [f.civilianDepth, f.beastDepth]) {
      const shadow = figureShadowOf(depth)!;
      expect(shadow).not.toBeNull();
      expect((shadow as unknown as { isShadowPassMaterial: boolean }).isShadowPassMaterial).toBe(
        true,
      );
      expect(shadow.userData).toBe(depth.userData);
      expect(shadow.blending).toBe(THREE.NoBlending);
      expect(figureShadowOf(depth)).toBe(shadow);
    }
    expect(figureShadowOf(shadeDepth(haze))).toBeNull();
    expect(figureShadowOf(undefined)).toBeNull();
  });
});

describe("the dogs' steam", () => {
  it("is drawn by a stand-in, a quad a puff", async () => {
    const { pointStand } = await import("../pwa/src/game/particle-twins-tsl.ts");
    const m = steamMaterial();
    expect(m.userData).toMatchObject({ glsl: "figures", sprite: "steam" });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(2), 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(2), 1));
    const stand = pointStand(new THREE.Points(geo, m), createHazeUniforms());
    expect(stand).not.toBeNull();
    expect(stand!.transparent).toBe(true);
    expect(stand!.depthWrite).toBe(false);
  });
});

describe("the vertex buffers a figure binds", () => {
  it("are packed into one interleaved copy where a twin reads more than eight", async () => {
    const { interleave } = await import("../pwa/src/game/figure-tsl.ts");
    const g = new THREE.BufferGeometry();
    g.setAttribute("aA", new THREE.BufferAttribute(new Float32Array([1, 2]), 1));
    g.setAttribute("aB", new THREE.BufferAttribute(new Float32Array([3, 4, 5, 6, 7, 8, 9, 10]), 4));
    interleave(g, ["aA", "aB"]);
    const a = g.getAttribute("fig_aA") as THREE.InterleavedBufferAttribute;
    const b = g.getAttribute("fig_aB") as THREE.InterleavedBufferAttribute;
    expect(a.data).toBe(b.data);
    expect(a.data.stride).toBe(5);
    expect([a.getX(1), b.getX(1), b.getW(1)]).toEqual([2, 7, 10]);
    // WebGL's own are left as they were, and a second call adds nothing.
    expect(g.getAttribute("aA")).toBeInstanceOf(THREE.BufferAttribute);
    interleave(g, ["aA", "aB"]);
    expect(g.getAttribute("fig_aA")).toBe(a);
    // An instanced set packs instanced.
    const i = new THREE.BufferGeometry();
    i.setAttribute("aC", new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
    i.setAttribute("aD", new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
    interleave(i, ["aC", "aD"]);
    const c = i.getAttribute("fig_aC") as THREE.InterleavedBufferAttribute;
    expect(c.data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);
  });
});

describe("the node builder's fixes", () => {
  it("write a function's code for each program and stage, and skip a copy into no buffer", async () => {
    await import("../pwa/src/game/node-fixes-tsl.ts");
    const { NodeBuilder, UniformArrayNode } = await import("three/webgpu");
    const built: string[] = [];
    const fake = (stage: string) =>
      ({
        shaderStage: stage,
        currentFunctionNode: null,
        buildFunctionCode(this: { shaderStage: string }) {
          built.push(this.shaderStage);
          return `fn ${this.shaderStage}`;
        },
      }) as unknown as InstanceType<typeof NodeBuilder>;
    const build = (NodeBuilder.prototype as unknown as { buildFunctionNode: (n: never) => unknown })
      .buildFunctionNode;
    const shaderNode = {} as never;
    const one = fake("vertex");
    const two = fake("vertex");
    const a = build.call(one, shaderNode);
    expect(build.call(one, shaderNode)).toBe(a);
    expect(build.call(two, shaderNode)).not.toBe(a);
    (one as unknown as { shaderStage: string }).shaderStage = "fragment";
    expect(build.call(one, shaderNode)).not.toBe(a);
    expect(built).toEqual(["vertex", "vertex", "fragment"]);
    const never = new UniformArrayNode([1, 2], "float");
    expect(() => never.updateBuffer()).not.toThrow();
  });
});
