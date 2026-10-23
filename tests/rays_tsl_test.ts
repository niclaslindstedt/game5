// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAYS (`docs/webgpu.md`, part 18). What the suite holds: the PICTURE
// row's ladder adds one effect a stop and the cheap presets leave it off; a
// picture stored before the row keeps its preset; the picture marches the
// rays between the scene and the grade, and with the row OFF draws exactly
// what it drew before (no ray asked for, the grade's first pipeline); the
// node passes, the shaded grade and the water's mirror build on plain Node;
// and every number the rays are marched by is in the shaders.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import type { Level } from "@engine";

import { createGradePass, type GradeUniforms } from "../pwa/src/game/grade-pass.ts";
import { createPictureAuto } from "../pwa/src/game/picture-auto.ts";
import { PICTURE_PRICES, fitPicture, pricesFor } from "../pwa/src/game/picture-fit.ts";
import { createRegionPicture, drawsStraight } from "../pwa/src/game/region-picture.ts";
import {
  DEFAULT_VIDEO,
  RAYS_LEVELS,
  RAYS_LOOK,
  VIDEO_PRESETS,
  mergeVideo,
  presetOf,
  raysOn,
  readPicture,
} from "../pwa/src/game/settings-video.ts";

const GAME = join(__dirname, "../pwa/src/game");
const level = { region: "alpine" } as unknown as Level;

describe("the RAYS row", () => {
  it("adds one effect a stop, cheapest first", () => {
    expect(RAYS_LEVELS).toEqual(["off", "low", "high", "max"]);
    const count = (l: (typeof RAYS_LEVELS)[number]): number =>
      Object.values(RAYS_LOOK[l]).filter(Boolean).length;
    expect(RAYS_LEVELS.map(count)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < RAYS_LEVELS.length; i++) {
      const below = RAYS_LOOK[RAYS_LEVELS[i - 1]];
      const at = RAYS_LOOK[RAYS_LEVELS[i]];
      for (const k of Object.keys(below) as (keyof typeof below)[])
        if (below[k]) expect(at[k]).toBe(true);
    }
    expect(raysOn("off")).toBe(false);
    expect(RAYS_LEVELS.slice(1).every(raysOn)).toBe(true);
  });

  it("is off on the cheap presets and on the picture a first visit opens on", () => {
    expect(VIDEO_PRESETS.low.rays).toBe("off");
    expect(VIDEO_PRESETS.medium.rays).toBe("off");
    expect(VIDEO_PRESETS.high.rays).toBe("high");
    expect(DEFAULT_VIDEO.rays).toBe("off");
  });

  it("keeps a picture stored before it on its preset, and reads a link's stop", () => {
    const without = (v: typeof VIDEO_PRESETS.high): Partial<typeof v> => {
      const out: Partial<typeof v> = { ...v };
      delete out.rays;
      return out;
    };
    const high = without(VIDEO_PRESETS.high);
    expect(presetOf(mergeVideo(high))).toBe("high");
    const low = without(VIDEO_PRESETS.low);
    expect(presetOf(mergeVideo(low))).toBe("low");
    expect(mergeVideo({ ...high, terrain: "low" }).rays).toBe("off");
    expect(mergeVideo({ rays: "max" }).rays).toBe("max");
    expect(mergeVideo({ rays: "ultra" }).rays).toBe("off");
    expect(readPicture("rays:max")).toEqual({ rays: "max" });
  });
});

describe("PRESET ▸ AUTO with the rays", () => {
  const top = { ...VIDEO_PRESETS.high, rays: "max" as const };

  it("fits RAYS by its price on the node renderer, and holds it OFF on classic WebGL", () => {
    expect(pricesFor(false)).toBe(PICTURE_PRICES);
    const flat = pricesFor(true);
    for (const stop of RAYS_LEVELS) expect(flat.rays[stop]).toEqual({ cost: 0, benefit: 0 });
    // A machine with all the room in the world: the node renderer keeps MAX,
    // classic WebGL spends nothing on a row it does not draw.
    expect(fitPicture(top, 4, 200).rays).toBe("max");
    expect(fitPicture(top, 4, 200, flat).rays).toBe("off");
    // The rows it does draw fit as they would without the row at all.
    const withoutRays = fitPicture({ ...top, rays: "off" }, 12, undefined, flat);
    expect(fitPicture(top, 12, undefined, flat)).toEqual(withoutRays);
  });

  it("reads the back end off the renderer it times", () => {
    let video = { ...top };
    const auto = createPictureAuto(true, (change) => {
      const s = change({ autoPicture: true, video } as never) as { video: typeof video };
      video = s.video;
    });
    const gl = {
      drain: () => 2,
      drainLater: () => null,
      backend: () => ({ running: "webgl" as const }),
    };
    for (let i = 0; i < 400 && auto.wants(true, true); i++)
      auto.drawn(16, performance.now(), gl, video);
    expect(video.rays).toBe("off");
  });
});

/** A renderer as the picture sees it, logging what it is asked. */
function fakeRenderer(log: string[]) {
  let target: unknown = null;
  return {
    render: vi.fn(() => void log.push(`render into ${target ? "target" : "canvas"}`)),
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => void (target = t),
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(640, 360),
    getContextAttributes: () => ({ antialias: true }),
    extensions: { has: () => true },
    info: { render: { calls: 1, triangles: 1, points: 0 } },
  };
}

function nodeHalf(log: string[]) {
  const rays = {
    ready: (_t: unknown, look: { shade: boolean }) => void log.push(`ready ${look.shade}`),
    march: () => void log.push("march"),
    keep: (_t: unknown, _c: unknown, look: { mirror: boolean }) =>
      void log.push(`keep ${look.mirror}`),
  };
  return {
    canvas: 4,
    grade: () => ({
      render: (shaded?: boolean) => void log.push(`grade ${shaded ? "shaded" : "plain"}`),
      dispose: () => {},
    }),
    rays: vi.fn(() => rays),
    hazeInDisplay: () => {},
    info: () => ({ calls: 1, triangles: 1, points: 0 }),
  };
}

describe("the picture with the rays (createRegionPicture)", () => {
  const lens = new THREE.PerspectiveCamera();

  it("asks for no ray and draws the grade's own pipeline with the row OFF", () => {
    const log: string[] = [];
    const node = nodeHalf(log);
    const picture = createRegionPicture(
      fakeRenderer(log) as never,
      () => "4",
      node,
      () => "off",
    );
    picture.load(level);
    picture.draw(new THREE.Scene(), lens);
    expect(node.rays).not.toHaveBeenCalled();
    expect(log).toEqual(["render into target", "grade plain"]);
  });

  it("readies the target at the load, marches between the scene and the grade, keeps after", () => {
    const log: string[] = [];
    let stop: "off" | "max" = "max";
    const picture = createRegionPicture(
      fakeRenderer(log) as never,
      () => "4",
      nodeHalf(log),
      () => stop,
    );
    picture.load(level);
    expect(log).toEqual(["ready true"]);
    log.length = 0;
    picture.draw(new THREE.Scene(), lens);
    expect(log).toEqual(["render into target", "march", "grade shaded", "keep true"]);
    // Turned off: the target let go once, the grade plain, nothing kept.
    log.length = 0;
    stop = "off";
    picture.draw(new THREE.Scene(), lens);
    expect(log).toEqual(["ready false", "render into target", "grade plain", "keep false"]);
  });

  it("marches once and draws the shaded grade behind the card, and nothing with the row OFF", () => {
    const log: string[] = [];
    let stop: "off" | "high" = "off";
    const picture = createRegionPicture(
      fakeRenderer(log) as never,
      () => "4",
      nodeHalf(log),
      () => stop,
    );
    picture.load(level);
    picture.warm(lens);
    expect(log).toEqual([]);
    stop = "high";
    picture.load(level);
    log.length = 0;
    picture.warm(lens);
    expect(log).toEqual(["march", "grade shaded"]);
  });

  it("never draws a marching frame straight onto the canvas", () => {
    const calm = { graded: false, buzz: 0, burning: false, samples: 4, canvas: 4 };
    expect(drawsStraight(calm)).toBe(true);
    expect(drawsStraight({ ...calm, rays: true })).toBe(false);
  });

  it("draws nothing of the rays on WebGL", () => {
    const log: string[] = [];
    const picture = createRegionPicture(
      fakeRenderer(log) as never,
      () => "4",
      null,
      () => "max",
    );
    picture.load(level);
    picture.draw(new THREE.Scene(), lens);
    expect(log).toEqual(["render into target", "render into canvas"]);
  });
});

describe("the node passes (rays-tsl.ts)", () => {
  it("build on plain Node, and the shaded grade is a second pipeline built at the first ask", async () => {
    const { createNodeRays, mirrorMarch, rayHistory } = await import("../pwa/src/game/rays-tsl.ts");
    const { nodeGradePass } = await import("../pwa/src/game/grade-tsl.ts");
    const { createHazeUniforms } = await import("../pwa/src/game/haze.ts");
    const { KeyLight, SkyLight } = await import("../pwa/src/game/world-lights.ts");
    const haze = createHazeUniforms();
    const renderer = {
      toneMapping: THREE.ACESFilmicToneMapping,
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      shadowMap: { enabled: false },
    };
    const rays = createNodeRays(renderer as never, haze, new KeyLight(haze), new SkyLight(haze));
    const target = new THREE.RenderTarget(64, 36, { samples: 4 });
    rays.ready(target, RAYS_LOOK.high);
    expect(target.depthTexture).not.toBeNull();
    expect(target.resolveDepthBuffer).toBe(true);
    rays.ready(target, RAYS_LOOK.off);
    expect(target.depthTexture).toBeNull();
    expect(target.resolveDepthBuffer).toBe(false);

    let made: GradeUniforms | null = null;
    const pass = createGradePass(0, (u) => ((made = u), { render() {}, dispose() {} }));
    const asked = vi.fn(() => (seen: unknown) => rays.shade(seen));
    const drawn = nodeGradePass(renderer as never, made as unknown as GradeUniforms, asked);
    drawn.pipeline.render = vi.fn();
    drawn.render();
    expect(asked).not.toHaveBeenCalled();
    expect(drawn.pipeline.render).toHaveBeenCalledTimes(1);
    const { RenderPipeline } = await import("three/webgpu");
    const built = vi.spyOn(RenderPipeline.prototype, "render").mockImplementation(() => {});
    drawn.render(true);
    drawn.render(true);
    expect(asked).toHaveBeenCalledTimes(2);
    expect(built).toHaveBeenCalledTimes(2);
    expect(drawn.pipeline.render).toHaveBeenCalledTimes(1);
    built.mockRestore();

    const h = rayHistory(haze);
    expect(rayHistory(haze)).toBe(h);
    const node = mirrorMarch(h, h.view, h.view, h.view) as { isNode?: boolean };
    expect(node.isNode).toBe(true);
    drawn.dispose();
    pass.dispose();
    rays.dispose();
  });

  it("marches by every number it states", async () => {
    const { RAYS } = await import("../pwa/src/game/rays-tsl.ts");
    const src = readFileSync(join(GAME, "rays-tsl.ts"), "utf8");
    for (const key of Object.keys(RAYS)) expect(src).toMatch(new RegExp(`RAYS\\.${key}\\b`));
    // A branch whose block hands back a node is built as a `return` (and
    // commented out in an inline function): every branch's block is braced.
    expect(src).not.toMatch(/\(\) => \w+\.\w*[aA]ssign\(/);
    // The water's mirror reads the rays' history.
    const water = readFileSync(join(GAME, "water-tsl.ts"), "utf8");
    expect(water).toContain("mirrorMarch(rayHistory(d.haze)");
  });
});
