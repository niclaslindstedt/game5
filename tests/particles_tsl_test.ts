// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARTICLES AND THE AIR ON THE NODE RENDERER (`docs/webgpu.md`, part
// 9): the spray, the snowfall and the spindrift, the snow cloud and its
// shadow, the billboards, the sparks and the snow guns' plumes, each drawn
// there by a NODE TWIN of its ShaderMaterial (`particle-twins-tsl.ts`) or,
// where WebGL draws `gl_PointSize` points, by a stand-in a quad a point
// (`glow-tsl.ts`'s stands). What the suite holds: the register draws the
// family on every path; every system carries its twin's flag in it and is
// not hidden; the billboards' batches are keyed apart and nothing else is;
// every twin is made on plain Node, once a material, as a node material
// over the ShaderMaterial's pipeline; and a stand draws as many quads as
// WebGL draws points, hides the points while it does and puts them back.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createBillboards } from "../pwa/src/game/billboards.ts";
import { GPU_PORTS, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { createPlumes } from "../pwa/src/game/snow-gun-plume.ts";
import { createSnowCloud } from "../pwa/src/game/snow-cloud.ts";
import { createSnowfall } from "../pwa/src/game/snowfall.ts";
import { createSparks } from "../pwa/src/game/sparks.ts";
import { createSpray, flySprayOn } from "../pwa/src/game/spray.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();

/** Every ShaderMaterial and points material under `root`, with what it hangs on. */
function materialsOf(root: THREE.Object3D): { object: THREE.Object3D; material: THREE.Material }[] {
  const out: { object: THREE.Object3D; material: THREE.Material }[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) out.push({ object: o, material: m });
  });
  return out;
}

/** One of every particle system, as the renderer makes them. */
function systems() {
  const haze = createHazeUniforms();
  flySprayOn(false);
  const cpu = createSpray(haze);
  flySprayOn(true);
  const gpu = createSpray(haze);
  gpu.setFlight?.(true);
  flySprayOn(null);
  const fall = createSnowfall(haze);
  const cloud = createSnowCloud(haze);
  const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const boards = [createBillboards(tex, 2, 8), createBillboards(tex, 1, 8, true)];
  const sparks = createSparks();
  const plumes = createPlumes(level, [], haze);
  return { haze, cpu, gpu, fall, cloud, boards, sparks, plumes };
}

describe("the particles in the register", () => {
  it("are ported in part 9 and drawn on every path", () => {
    const row = GPU_PORTS.find((p) => p.id === "particles");
    expect(row?.kind).toBe("material");
    expect(row?.part).toBe(9);
    expect(row?.ported).toBe(true);
    for (const b of ["webgl", "webgpu", "webgpu-gl"] as const) {
      expect(quarantinedOn(b, "particles")).toBe(false);
    }
    // Every other ShaderMaterial waits for its own part.
    expect(GPU_PORTS.find((p) => p.id === "shader")?.ported).toBe(false);
  });
});

describe("the particles' flags", () => {
  it("name each system's twin in the particles' family", () => {
    const s = systems();
    const twinOf = (root: THREE.Object3D): string[] =>
      materialsOf(root)
        .filter(({ material }) => material.userData.glsl === "particles")
        .map(({ material }) => String(material.userData.twin ?? material.userData.sprite));
    expect(twinOf(s.cpu.points)).toEqual(["spray"]);
    expect(twinOf(s.gpu.points)).toEqual(["spray-gpu"]);
    expect(twinOf(s.fall.group)).toEqual(["snowfall", "spindrift"]);
    expect(twinOf(s.cloud.mesh)).toEqual(["snow-cloud", "cloud-shadow"]);
    expect(twinOf(s.plumes.mesh)).toEqual(["plume"]);
    for (const b of s.boards) expect(twinOf(b.mesh)).toEqual(["billboards"]);
    // The sparks' heads are three's own points, stood in for, never hidden.
    const heads = materialsOf(s.sparks.group).find(
      ({ object }) => (object as THREE.Points).isPoints,
    );
    expect(heads?.material.userData.sprite).toBe("plain");
    expect(heads?.material.userData.glsl).toBe(undefined);
  });

  it("key the billboards' batches apart, and nothing else", () => {
    const s = systems();
    const [a, b] = s.boards.map(
      (x) => (x.mesh.material as unknown as Record<string, unknown>).twinOwn,
    );
    expect(typeof a).toBe("string");
    expect(a).not.toBe(b);
    for (const root of [s.cpu.points, s.fall.group, s.cloud.mesh, s.plumes.mesh]) {
      for (const { material } of materialsOf(root)) {
        expect((material as unknown as Record<string, unknown>).twinOwn).toBe(undefined);
      }
    }
  });
});

describe("the particles' twins", () => {
  it("are made on plain Node, once a material, over its pipeline", async () => {
    const { createTwins } = await import("../pwa/src/game/sky-twins-tsl.ts");
    const { float } = await import("three/tsl");
    const s = systems();
    const twins = createTwins(s.haze, { display: float(0), exposure: float(1) });
    const roots = [s.cpu.points, s.gpu.points, s.fall.group, s.cloud.mesh, s.plumes.mesh];
    for (const b of s.boards) roots.push(b.mesh);
    let made = 0;
    for (const root of roots) {
      for (const { material } of materialsOf(root)) {
        if (typeof material.userData.twin !== "string") continue;
        const twin = twins.of(material);
        expect(twin?.isNodeMaterial, String(material.userData.twin)).toBe(true);
        expect(twins.of(material)).toBe(twin);
        expect(twin?.vertexNode).not.toBe(null);
        expect(twin?.fragmentNode).not.toBe(null);
        expect(twin?.blending).toBe(material.blending);
        expect(twin?.depthWrite).toBe(material.depthWrite);
        expect(twin?.fog).toBe(false);
        expect(twin?.lights).toBe(false);
        // A node on the ShaderMaterial drawn: its bindings refreshed every draw.
        expect((material as unknown as { twinNode?: { isNode?: boolean } }).twinNode?.isNode).toBe(
          true,
        );
        made++;
      }
    }
    expect(made).toBe(8);
  });

  it("stand in for points a quad a point, and put them back", async () => {
    const { createGlowSprites } = await import("../pwa/src/game/glow-tsl.ts");
    const { pointStand } = await import("../pwa/src/game/particle-twins-tsl.ts");
    const s = systems();
    const scene = new THREE.Scene();
    scene.add(s.fall.group, s.sparks.group);
    const drift = s.fall.group.children.find((o) => (o as THREE.Points).isPoints) as THREE.Points;
    const heads = s.sparks.group.children.find((o) => (o as THREE.Points).isPoints) as THREE.Points;
    drift.visible = true;
    heads.visible = true;
    drift.geometry.setDrawRange(0, 37);
    heads.geometry.setDrawRange(0, 5);
    const stands = createGlowSprites(s.haze, (p) => pointStand(p, s.haze));
    stands.begin(scene);
    expect(drift.visible).toBe(false);
    expect(heads.visible).toBe(false);
    const drawn = (name: string) =>
      s.fall.group.children.concat(s.sparks.group.children).find((o) => o.name === name) as
        (THREE.Object3D & { count: number }) | undefined;
    const driftStand = drawn("points-stand");
    expect(driftStand?.count).toBe(37);
    expect(((driftStand as THREE.Mesh).material as THREE.Material).name).toBe("spindrift");
    const headStand = drawn("glow-sprites");
    expect(headStand?.count).toBe(5);
    // The stands read the points through instanced mirrors of their own
    // buffers: a plain attribute would be stepped by the vertex.
    const { perPoint } = await import("../pwa/src/game/glow-tsl.ts");
    const grains = drift.geometry.getAttribute("position") as THREE.BufferAttribute;
    const mirror = perPoint(grains);
    expect(mirror.isInstancedBufferAttribute).toBe(true);
    expect(mirror.array).toBe(grains.array);
    expect(perPoint(grains)).toBe(mirror);
    grains.needsUpdate = true;
    stands.end();
    stands.begin(scene);
    expect(mirror.version).toBe(grains.version);
    stands.end();
    expect(drift.visible).toBe(true);
    expect(heads.visible).toBe(true);
    expect(driftStand?.visible).toBe(false);
    expect(headStand?.visible).toBe(false);
  });
});
