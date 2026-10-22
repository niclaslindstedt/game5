// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDINGS AND THE PROPS ON THE NODE RENDERER (`docs/webgpu.md`, part
// 13). What the suite holds: the register draws the props' family on every
// path and leaves what is left to the harnesses' part; every building's,
// crag's, sign's, water's, tuft's, flag's, plate's, wall's, halo's and
// fire's material carries its flag, is not hidden, and keeps WebGL's
// program key; the grafts' own uniforms are the very objects WebGL's graft
// is handed; each graft finishes its copy alone (the shadows stay WebGL's)
// and hangs a node on the material drawn; every twin is made on plain
// Node; the rooms keep the sun out; and the part's TSL names only what
// three exports.

import { readFileSync } from "node:fs";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { plateMaterial, wallMaterial } from "../pwa/src/game/avalanche-plates.ts";
import { facadeMaterial } from "../pwa/src/game/facade-mesh.ts";
import { GPU_PORTS, graftOf, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { createHazeUniforms, type HazeUniforms } from "../pwa/src/game/haze.ts";
import { createPisteLights } from "../pwa/src/game/piste-lights.ts";
import { createRocks } from "../pwa/src/game/rocks.ts";
import { FOREST_LOOK } from "../pwa/src/game/settings-video.ts";
import { createGrass } from "../pwa/src/game/summer-grass.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** Every material under `root`. */
function materials(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) out.add(x);
  });
  return [...out];
}

/** The props that build on the synthetic slope, as their views make them. */
function props(haze: HazeUniforms) {
  const level = syntheticLevel();
  const rocks = createRocks(level, haze, FOREST_LOOK.high.rocks);
  // The ground's maps the tufts stand on (`summer-terrain.ts`'s).
  const map = () => ({ value: new THREE.DataTexture() });
  const ground = { uHeight: map(), uGround: map(), uSummerA: map(), uSummerB: map() };
  const grass = createGrass(haze, ground, { reach: 40, share: 1 });
  const lights = createPisteLights(level, haze);
  return {
    facade: facadeMaterial(haze, "test-facade"),
    plates: plateMaterial(haze),
    walls: wallMaterial(haze),
    rocks: rocks.group,
    grass: grass.group,
    lights: lights.group,
  };
}

/** The source of app module `file`. */
const source = (file: string): string =>
  readFileSync(new URL(`../pwa/src/game/${file}`, import.meta.url), "utf8");

/** The uniforms WebGL's graft hands its program: `m`'s `onBeforeCompile`
 * run over three's own source for its kind. */
function webglUniforms(m: THREE.Material): Record<string, THREE.IUniform> {
  const lib = (m as THREE.MeshLambertMaterial).isMeshLambertMaterial
    ? THREE.ShaderLib.lambert
    : THREE.ShaderLib.standard;
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  };
  m.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
  return shader.uniforms;
}

describe("the part's family in the register", () => {
  it("is ported in part 13 and drawn on every path", () => {
    const row = GPU_PORTS.find((p) => p.id === "props");
    expect(row).toMatchObject({ kind: "material", part: 13, ported: true });
    for (const b of ["webgl", "webgpu", "webgpu-gl"] as const)
      expect(quarantinedOn(b, "props")).toBe(false);
  });

  it("leaves what is left to the harnesses' part", () => {
    for (const id of ["shader", "haze-graft"]) {
      expect(
        GPU_PORTS.find((p) => p.id === id),
        id,
      ).toMatchObject({ part: 14, ported: false });
      expect(quarantinedOn("webgpu", id), id).toBe(true);
      expect(quarantinedOn("webgl", id), id).toBe(false);
    }
  });
});

describe("the props' flags", () => {
  it("name each graft and twin, and keep WebGL's program keyed as before", () => {
    const haze = createHazeUniforms();
    const p = props(haze);
    expect(graftOf(p.facade)).toBe("facade");
    expect(p.facade.customProgramCacheKey()).toBe("haze:facade-test-facade");
    expect(p.plates.userData).toMatchObject({ twin: "slab-plates", glsl: "props" });
    expect(graftOf(p.walls)).toBe("slab-walls");
    const kinds = (root: THREE.Object3D) =>
      materials(root)
        .map((m) => graftOf(m) ?? (m.userData.twin as string | undefined))
        .filter(Boolean);
    expect(kinds(p.rocks)).toContain("rock");
    expect(new Set(kinds(p.grass))).toEqual(new Set(["grass"]));
    expect(kinds(p.lights)).toContain("piste-glow");
  });

  it("are set where the views that need a whole map make their materials", () => {
    // The lakes, the fires, the flags, the rooms and the signs are built
    // only on a map that has them; their flags are read off the source.
    const flagged: [string, RegExp][] = [
      ["water-view.ts", /nodeGraft\(material, "props", "water"\)/],
      ["interiors-view.ts", /nodeGraft\(m, "props", "interiors"\)\.userData\.indoor = true/],
      ["route-sign.ts", /nodeGraft\(faceMat, "props", "print-bump"\)/],
      ["run-signs.ts", /nodeGraft\(faceMat, "props", "print-bump"\)/],
      ["challenge-flags.ts", /\[sailMat, "flag-sail"\],\s*\[pennantMat, "flag-pennant"\]/],
      ["challenge-flags.ts", /m\.userData\.figureOwn = wiring;\s*nodeTwin\(m, "props", kind\)/],
      ["fires-view.ts", /isShaderMaterial\) nodeTwin\(mat, "props", name\)/],
      ["facade-mesh.ts", /nodeGraft\(m, "props", "facade"\)/],
    ];
    for (const [file, flag] of flagged) expect(source(file), file).toMatch(flag);
    // Every fire shader is drawn under a name its twin knows.
    const names = [...source("fires-view.ts").matchAll(/^\s+"(fire-[a-z]+)",$/gm)].map((m) => m[1]);
    for (const kind of ["fire-embers", "fire-flames", "fire-glow", "fire-sparks", "fire-smoke"])
      expect(names, kind).toContain(kind);
  });

  it("are not hidden on the webgpu paths", () => {
    const haze = createHazeUniforms();
    const p = props(haze);
    const scene = new THREE.Scene();
    const box = new THREE.BoxGeometry();
    for (const m of [p.facade, p.plates, p.walls])
      scene.add(new THREE.Mesh(box, m as THREE.Material));
    scene.add(p.rocks, p.grass, p.lights);
    const q = createQuarantine("webgpu");
    q.hide(scene);
    expect(q.counts()).toEqual({});
    q.restore();
  });

  it("hand the node renderer the very uniforms WebGL's graft is handed", () => {
    const haze = createHazeUniforms();
    const p = props(haze);
    const rock = materials(p.rocks).find((m) => graftOf(m) === "rock")!;
    const tuft = materials(p.grass).find((m) => graftOf(m) === "grass")!;
    for (const m of [rock, tuft]) {
      const own = m.userData.graftOwn as Record<string, THREE.IUniform>;
      const handed = webglUniforms(m);
      expect(Object.keys(own).length, graftOf(m)!).toBeGreaterThan(0);
      for (const name of Object.keys(own))
        expect(handed[name], `${graftOf(m)}: ${name}`).toBe(own[name]);
    }
  });
});

describe("the grafts on the copy (built on plain Node)", () => {
  it("set their nodes on the copy alone and hang one on the material drawn", async () => {
    const { MeshLambertNodeMaterial, MeshStandardNodeMaterial } = await import("three/webgpu");
    const { finishGraft } = await import("../pwa/src/game/model-grafts-tsl.ts");
    const haze = createHazeUniforms();
    const how = { display: { value: 0 }, exposure: { value: 1 } } as never;
    const p = props(haze);
    const rock = materials(p.rocks).find((m) => graftOf(m) === "rock")!;
    const tuft = materials(p.grass).find((m) => graftOf(m) === "grass")!;
    const cases: [THREE.Material, string[]][] = [
      [p.facade, ["colorNode", "roughnessNode", "normalNode", "positionNode", "emissiveNode"]],
      [p.walls, ["positionNode", "vertexNode"]],
      [rock, ["colorNode", "positionNode", "vertexNode"]],
      [tuft, ["colorNode", "positionNode"]],
    ];
    for (const [m, nodes] of cases) {
      const lambert = (m as THREE.MeshLambertMaterial).isMeshLambertMaterial;
      const copy = lambert ? new MeshLambertNodeMaterial() : new MeshStandardNodeMaterial();
      finishGraft(copy, m, { haze, how });
      const c = copy as unknown as Record<string, unknown>;
      for (const n of nodes) expect(c[n], `${graftOf(m)}: ${n}`).not.toBeNull();
      // The material drawn keeps none: the shadow passes copy ITS position.
      expect((m as unknown as { positionNode?: unknown }).positionNode).toBeUndefined();
      expect((m as unknown as { graftNode?: { isNode: boolean } }).graftNode?.isNode).toBe(true);
    }
    // The facade's mist wall, as `graftGlow` discards past it.
    const copy = new MeshStandardNodeMaterial();
    finishGraft(copy, p.facade, { haze, how });
    expect(copy.maskNode).not.toBeNull();
    // The water's normal comes out of its colour's work, so it is lit in
    // the main flow, not three's normal sub-build.
    expect(source("water-tsl.ts")).toMatch(/normalFromColour\(c, /);
    expect(source("water-tsl.ts")).not.toMatch(/c\.normalNode =/);
  });

  it("light a normal made in the colour's flow in the main flow", async () => {
    const { normalFromColour } = await import("../pwa/src/game/figure-tsl.ts");
    const lit = { isNode: true };
    const normal = { isNode: true };
    const copy = { setupLighting: (_builder: unknown) => lit };
    normalFromColour(copy, normal as never);
    const builder = { context: { setupNormal: () => null as unknown } };
    expect(copy.setupLighting.call(copy, builder as never)).toBe(lit);
    expect(builder.context.setupNormal()).toBe(normal);
  });

  it("keep the sun out of the rooms", () => {
    expect(source("lights-tsl.ts")).toMatch(/userData\.indoor === true\) return undefined/);
  });
});

describe("the props' twins (built on plain Node)", () => {
  it("are made for every twin the props flag, over the material's own pipeline", async () => {
    const { NodeMaterial } = await import("three/webgpu");
    const { propTwinOf } = await import("../pwa/src/game/prop-twins-tsl.ts");
    const haze = createHazeUniforms();
    const p = props(haze);
    const plate = propTwinOf(p.plates, "slab-plates", haze)!;
    expect(plate).toBeInstanceOf(NodeMaterial);
    expect(plate.side).toBe(THREE.DoubleSide);
    const wiring = { uFlagWind: { value: new THREE.Vector2() }, uFlagTime: { value: 0 } };
    for (const kind of ["flag-sail", "flag-pennant"]) {
      const m = new THREE.MeshStandardMaterial({
        map: kind === "flag-sail" ? new THREE.DataTexture() : null,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      m.userData.figureOwn = wiring;
      const twin = propTwinOf(m, kind, haze)!;
      expect(twin, kind).toBeInstanceOf(NodeMaterial);
      expect((twin as unknown as { flatShading: boolean }).flatShading, kind).toBe(true);
    }
    const halo = materials(p.lights).find((m) => m.userData.twin === "piste-glow")!;
    const glow = propTwinOf(halo, "piste-glow", haze)!;
    expect(glow.blending).toBe(THREE.AdditiveBlending);
    expect(glow.fragmentNode).not.toBeNull();
    for (const kind of ["fire-embers", "fire-flames", "fire-glow", "fire-sparks", "fire-smoke"]) {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false });
      const twin = propTwinOf(m, kind, haze)!;
      expect(twin, kind).toBeInstanceOf(NodeMaterial);
      expect([twin.transparent, twin.depthWrite], kind).toEqual([true, false]);
      expect(twin.vertexNode, kind).not.toBeNull();
      // The classic material carries a node, so its draw's uniforms refresh.
      expect((m as unknown as { twinNode?: { isNode: boolean } }).twinNode?.isNode, kind).toBe(
        true,
      );
    }
    expect(propTwinOf(new THREE.ShaderMaterial(), "rotor", haze)).toBeNull();
  });
});

describe("the part's TSL", () => {
  it("names only what three's TSL exports", async () => {
    const TSL = (await import("three/tsl")) as Record<string, unknown>;
    for (const file of [
      "props-tsl.ts",
      "prop-twins-tsl.ts",
      "rock-tsl.ts",
      "water-tsl.ts",
      "grass-tsl.ts",
    ]) {
      for (const m of source(file).matchAll(/const \{([^}]*)\} = TSL as N;/g)) {
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
