// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSTRUMENTS AND THE TOOLS ON THE NODE RENDERER (`docs/webgpu.md`,
// part 14). What the suite holds: the register runs the snow lab's probe,
// the trail corner and the GPU's timer on every path and keeps the two
// guards for the GLSL's part; the node renderer's timer files each pass
// under the slice on top when it began (a shadow map's under `shadow`),
// sums a frame only once every pass it noted is answered, gives up on one
// that lags, and keeps the A/B's tags apart; the instruments' and the gear
// stage's materials carry their flags and keep WebGL's programs keyed as
// before, and every twin and graft is made on plain Node; the harnesses
// and the gear stage make their renderer through `createGpu`; and the
// part's TSL names only what three exports.

import { readFileSync } from "node:fs";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { GpuMode } from "../pwa/src/game/benchmark-report.ts";
import { GPU_PORTS, graftOf, quarantinedOn, runsPass } from "../pwa/src/game/gpu-backend.ts";
import { createNodeTimer, type TimedRenderer } from "../pwa/src/game/gpu-timer-node.ts";
import type { RenderSeam } from "../pwa/src/game/render-seam.ts";
import { createBackdrop } from "../pwa/src/game/stage-backdrop.ts";

/** The source of a module under `pwa/src/`. */
const source = (file: string): string =>
  readFileSync(new URL(`../pwa/src/${file}`, import.meta.url), "utf8");

describe("the register after part 14", () => {
  it("runs the probe, the trail corner and the timer on every path", () => {
    for (const id of ["snow-under", "trail-overlay", "gpu-timer"]) {
      expect(
        GPU_PORTS.find((p) => p.id === id),
        id,
      ).toMatchObject({ part: 14, ported: true });
      for (const b of ["webgl", "webgpu", "webgpu-gl"] as const) expect(runsPass(b, id)).toBe(true);
    }
  });

  it("keeps the two guards, which hide nothing the game draws, for the GLSL's part", () => {
    for (const id of ["shader", "haze-graft"]) {
      expect(
        GPU_PORTS.find((p) => p.id === id),
        id,
      ).toMatchObject({ part: 16, ported: false });
      expect(quarantinedOn("webgpu", id), id).toBe(true);
    }
    // Nothing else is left for part 14.
    expect(GPU_PORTS.filter((p) => p.part === 14 && !p.ported)).toEqual([]);
  });
});

/** A node renderer as far as the timer reaches it: `pass` begins a pass
 * (drawn into a shadow map's depth when `shadow`), `answer` lands every
 * query written so far at `ms` a pass. */
function fakeRenderer(timestamps = true) {
  const pool = { timestamps: new Map<string, number>() };
  let target: { depthTexture: { name: string } } | null = null;
  const written: string[] = [];
  let calls = 0;
  const r: TimedRenderer = {
    info: { frame: 0 },
    backend: {
      trackTimestamp: false,
      isWebGPUBackend: true,
      device: { features: { has: (n: string) => timestamps && n === "timestamp-query" } },
      timestampQueryPool: { render: pool },
      initTimestampQuery(_type: string, uid: string) {
        if (this.trackTimestamp) written.push(uid);
      },
    },
    getRenderTarget: () => target,
    resolveTimestampsAsync: () => Promise.resolve(0),
  };
  return {
    r,
    pass(shadow = false) {
      target = shadow ? { depthTexture: { name: "ShadowDepthTexture" } } : null;
      r.backend.initTimestampQuery("render", `r:${++calls}:1:f${r.info.frame}`, {});
      target = null;
    },
    answer(ms: number) {
      pool.timestamps.clear();
      for (const uid of written) pool.timestamps.set(uid, ms);
      written.length = 0;
    },
  };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

describe("the node renderer's timer (gpu-timer-node.ts)", () => {
  it("files every pass under the slice on top when it began", async () => {
    const f = fakeRenderer();
    const timer = createNodeTimer(f.r, "split");
    expect([timer.supported, timer.mode]).toEqual([true, "passes"]);
    expect(f.r.backend.trackTimestamp).toBe(true);
    timer.push("trail");
    f.pass();
    timer.pop();
    f.pass(); // the sky's passes, pushed under nothing: not timed
    timer.push("scene");
    f.pass(true); // the key's map, drawn inside the scene's render
    f.pass();
    timer.push("grade");
    f.pass();
    timer.pop();
    timer.pop();
    timer.frame();
    expect(timer.totals().frames).toBe(0); // nothing answered yet
    f.answer(2);
    timer.frame(); // an empty frame: it asks again, and files what is in
    await settle();
    const t = timer.totals();
    expect(t.frames).toBe(1);
    expect(t.ms).toEqual({ trail: 2, shadow: 2, scene: 2, grade: 2 });
    timer.dispose();
    expect(f.r.backend.trackTimestamp).toBe(false);
  });

  it("names each frame's queries apart, keeps the tags apart and gives up on a laggard", async () => {
    const f = fakeRenderer();
    const timer = createNodeTimer(f.r, "passes");
    timer.push("scene");
    f.pass();
    timer.frame("terrain");
    expect(f.r.info.frame).toBe(1);
    f.answer(3);
    timer.push("scene");
    f.pass();
    timer.frame();
    await settle();
    expect(timer.totals().tags.terrain).toEqual({ frames: 1, ms: 3 });
    expect(timer.totals().frames).toBe(0);
    // The second frame's pass is never answered.
    for (let k = 0; k < 14; k++) {
      timer.push("scene");
      f.pass();
      timer.frame();
    }
    await settle();
    expect(timer.totals().dropped).toBeGreaterThan(0);
    timer.reset();
    expect(timer.totals()).toEqual({ frames: 0, dropped: 0, ms: {}, tags: {} });
  });

  it("is asked again once the node renderer is ready, unless asked otherwise", async () => {
    const { createInstruments } = await import("../pwa/src/game/renderer-instruments.ts");
    let up = false;
    let open: () => void = () => undefined;
    const made: string[] = [];
    const seam = {
      gl: {},
      native: false,
      ready: new Promise<void>((done) => (open = done)),
      timer(mode: GpuMode) {
        const f = fakeRenderer(up);
        made.push(`${mode}:${up}`);
        return createNodeTimer(f.r, mode);
      },
    } as unknown as RenderSeam;
    const inst = createInstruments(seam);
    inst.setTimer("passes");
    expect(inst.timer.supported).toBe(false); // the device is not there yet
    up = true;
    open();
    await settle();
    expect(inst.timer.supported).toBe(true);
    expect(made).toEqual(["passes:false", "passes:true"]);
    // Asked for "off" in between: the late answer is not taken.
    up = false;
    let reopen: () => void = () => undefined;
    (seam as { ready: Promise<void> }).ready = new Promise<void>((done) => (reopen = done));
    inst.setTimer("passes");
    inst.setTimer("off");
    up = true;
    reopen();
    await settle();
    expect(inst.timer.mode).toBe("off");
  });

  it("is off where the device writes no timestamps", () => {
    const f = fakeRenderer(false);
    const timer = createNodeTimer(f.r, "passes");
    expect([timer.supported, timer.mode]).toEqual([false, "off"]);
    expect(f.r.backend.trackTimestamp).toBe(false);
  });
});

describe("the instruments' and the stage's materials", () => {
  it("carry their flags and keep WebGL's programs keyed as before", () => {
    for (const summer of [false, true]) {
      const backdrop = createBackdrop(summer);
      const kinds = new Set<string>();
      backdrop.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (!m) return;
        const kind = graftOf(m) ?? (m.userData.twin as string | undefined);
        if (kind?.startsWith("stage-")) {
          kinds.add(kind);
          expect(m.userData.glsl).toBe("props");
          expect(quarantinedOn("webgpu", "props")).toBe(false);
        }
        // WebGL's program keys never read the flags.
        expect(m.customProgramCacheKey()).not.toMatch(/stage-|twin|graft/);
      });
      expect([...kinds].sort()).toEqual(
        summer ? ["stage-meadow", "stage-sky"] : ["stage-sky", "stage-snow"],
      );
      backdrop.dispose();
    }
    expect(source("game/trail-overlay.ts")).toMatch(
      /nodeTwin\(material, "trail-overlay", "trail-overlay"\)/,
    );
    expect(source("game/snow-under.ts")).toMatch(/"snow-under", "under-copy"\)/);
  });

  it("are drawn by twins and grafts made on plain Node", async () => {
    const { MeshStandardNodeMaterial, NodeMaterial } = await import("three/webgpu");
    const { instrumentTwin } = await import("../pwa/src/game/instruments-tsl.ts");
    const { finishStage, stageSkyTwin } = await import("../pwa/src/game/stage-tsl.ts");
    const overlay = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null } },
      transparent: true,
    });
    const twin = instrumentTwin(overlay, "trail-overlay")!;
    expect(twin).toBeInstanceOf(NodeMaterial);
    expect([twin.transparent, twin.depthTest, twin.toneMapped]).toEqual([true, false, false]);
    expect((overlay as unknown as { passNode?: { isNode: boolean } }).passNode?.isNode).toBe(true);
    const copy = new THREE.ShaderMaterial({
      uniforms: { uDepth: { value: new THREE.DepthTexture(4, 4) } },
    });
    expect(instrumentTwin(copy, "under-copy")).toBeInstanceOf(NodeMaterial);
    expect(instrumentTwin(copy, "rotor")).toBeNull();
    const backdrop = createBackdrop(false);
    let sky: THREE.ShaderMaterial | null = null;
    let snow: THREE.Material | null = null;
    backdrop.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m?.userData.twin === "stage-sky") sky = m as THREE.ShaderMaterial;
      if (m && graftOf(m) === "stage-snow") snow = m;
    });
    const dome = stageSkyTwin(sky!);
    expect(dome.vertexNode).not.toBeNull();
    expect([dome.depthWrite, dome.side]).toEqual([false, THREE.BackSide]);
    const lit = new MeshStandardNodeMaterial();
    expect(finishStage(lit, snow!, "stage-snow")).toBe(true);
    expect([lit.colorNode, lit.emissiveNode].every((n) => n !== null)).toBe(true);
    expect(finishStage(new MeshStandardNodeMaterial(), snow!, "stage-other")).toBe(false);
    backdrop.dispose();
  });
});

describe("the renderers of their own", () => {
  it("are made through createGpu by the gear stage and every harness that drew its own", () => {
    const own = [
      "game/gear-stage.ts",
      ...[
        "audience",
        "birds",
        "board",
        "bones",
        "cabins",
        "civilians",
        "crowd",
        "gear",
        "helmet",
        "skier",
        "skis",
        "trees",
      ].map((n) => `tools/${n}-harness.ts`),
    ];
    for (const file of own) {
      const text = source(file);
      expect(text, file).toMatch(/await createGpu\(/);
      expect(text, file).not.toMatch(/new THREE\.WebGLRenderer\(/);
    }
    // The bare WebGL renderer is made in two places only: the world's seam
    // and the renderer of its own on WebGL.
    expect(source("game/own-gpu.ts")).toMatch(/new THREE\.WebGLRenderer\(/);
  });
});

describe("the part's TSL", () => {
  it("names only what three's TSL exports", async () => {
    const TSL = (await import("three/tsl")) as Record<string, unknown>;
    for (const file of ["game/instruments-tsl.ts", "game/stage-tsl.ts"]) {
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
