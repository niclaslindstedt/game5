// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE ON THE NODE RENDERER (`docs/webgpu.md`, part 7). What the suite
// holds: the register runs the grade's pass on every path; the pass is
// WebGL's own on WebGL and draws on three's own target through the node
// grade elsewhere, over the SAME uniforms; the picture hands the node
// renderer its target, tells the haze where to mix and counts the scene
// before the grade; the alpine is graded (which is why the node frame was
// short of blue before the port); the node grade is built on plain Node as
// a `RenderPipeline` with its own output transform off; and every number of
// the GLSL fragment, and three's GLSL tone-map fit, is in the TSL.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import type { Level } from "@engine";

import { COLOUR_GRADES, gradeOf, gradeTone, isNeutral } from "../pwa/src/game/colour-grade.ts";
import { GPU_PORTS, runsPass } from "../pwa/src/game/gpu-backend.ts";
import { createGradePass, GRADE_FRAGMENT, type GradeUniforms } from "../pwa/src/game/grade-pass.ts";
import { createRegionPicture, drawsStraight } from "../pwa/src/game/region-picture.ts";

const GAME = join(__dirname, "../pwa/src/game");
const level = { region: "alpine" } as unknown as Level;

describe("the grade's row in the register", () => {
  it("runs the pass on every path from part 7", () => {
    const row = GPU_PORTS.find((p) => p.id === "grade-pass");
    expect(row?.ported).toBe(true);
    expect(row?.part).toBe(7);
    for (const b of ["webgl", "webgpu", "webgpu-gl"] as const)
      expect(runsPass(b, "grade-pass")).toBe(true);
  });
});

describe("the blue the node frame was short of", () => {
  it("is the alpine's grade: the alpine is graded, so its frame goes through the pass", () => {
    expect(isNeutral(gradeOf("alpine"))).toBe(false);
    expect(isNeutral(gradeOf("alpine", true))).toBe(false);
    const calm = { graded: true, buzz: 0, burning: false, samples: 4, canvas: 4 };
    expect(drawsStraight(calm)).toBe(false);
    // A clear sky's blue as ACES leaves it (136, 179, 219) is the blue
    // WebGL's canvas shows after the grade (134, 182, 234 measured in the
    // game): the shade's cool split lifts the blue of everything below white.
    const out = gradeTone(COLOUR_GRADES.alpine, (136 << 16) | (179 << 8) | 219);
    expect([(out >> 16) & 255, (out >> 8) & 255, out & 255]).toEqual([133, 182, 234]);
  });
});

describe("the pass (createGradePass)", () => {
  it("is WebGL's own target and quad with no node grade", () => {
    const pass = createGradePass(2);
    expect((pass.target as { isWebGLRenderTarget?: boolean }).isWebGLRenderTarget).toBe(true);
    expect(pass.target.samples).toBe(2);
    const gl = { render: vi.fn() };
    pass.render(gl as never);
    expect(gl.render).toHaveBeenCalledTimes(1);
    pass.dispose();
  });

  it("draws on three's own target through the node grade, over the same uniforms", () => {
    let seen: GradeUniforms | null = null;
    const drawn = { render: vi.fn(), dispose: vi.fn() };
    const pass = createGradePass(4, (u) => ((seen = u), drawn));
    const target = pass.target as THREE.RenderTarget & { isWebGLRenderTarget?: boolean };
    expect(target.isRenderTarget).toBe(true);
    expect(target.isWebGLRenderTarget).toBeUndefined();
    expect(target.texture.type).toBe(THREE.HalfFloatType);
    expect(target.samples).toBe(4);
    expect(seen).not.toBeNull();
    const u = seen as unknown as GradeUniforms;
    expect(u.uPicture.value).toBe(target.texture);
    pass.setGrade(COLOUR_GRADES.fell);
    expect(u.uContrast.value).toBe(COLOUR_GRADES.fell.contrast);
    expect(u.uSplit.value.toArray()).toEqual([...COLOUR_GRADES.fell.split]);
    pass.setBuzz(0.5, 3);
    pass.setBlaze(0.2, 0.1, 0.3, 4);
    expect(u.uBuzz.value).toBe(0.5);
    expect(u.uBlaze.value.toArray()).toEqual([0.2, 0.1, 0.3]);
    expect(u.uTime.value).toBe(4);
    const gl = { render: vi.fn() };
    pass.render(gl as never);
    expect(drawn.render).toHaveBeenCalledTimes(1);
    expect(gl.render).not.toHaveBeenCalled();
    pass.dispose();
    expect(drawn.dispose).toHaveBeenCalledTimes(1);
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
    info: { render: { calls: 99, triangles: 99, points: 99 } },
  };
}

describe("the picture on the node renderer (createRegionPicture with a node half)", () => {
  it("draws a graded region into the pass and the grade after it, the haze in linear light", () => {
    const log: string[] = [];
    const gl = fakeRenderer(log);
    const node = {
      canvas: 4,
      grade: () => ({ render: () => void log.push("grade"), dispose: () => {} }),
      hazeInDisplay: (on: boolean) => void log.push(`haze display=${on}`),
      info: () => ({ calls: 12, triangles: 34, points: 5 }),
    };
    const picture = createRegionPicture(gl as never, () => "4", node);
    const target = picture.load(level);
    expect((target as THREE.RenderTarget | null)?.isRenderTarget).toBe(true);
    picture.draw(new THREE.Scene(), new THREE.Camera());
    expect(log).toEqual(["haze display=false", "render into target", "grade"]);
    // The scene's draw, counted off the node renderer before the grade's.
    expect(picture.info()).toEqual({ calls: 12, triangles: 34, points: 5 });
    expect(gl.getRenderTarget()).toBeNull();
    picture.dispose();
  });

  it("keeps WebGL's picture as it was without one", () => {
    const log: string[] = [];
    const gl = fakeRenderer(log);
    const picture = createRegionPicture(gl as never, () => "4");
    const target = picture.load(level);
    expect((target as { isWebGLRenderTarget?: boolean } | null)?.isWebGLRenderTarget).toBe(true);
    // The quad is WebGL's: the renderer draws it too.
    picture.draw(new THREE.Scene(), new THREE.Camera());
    expect(log).toEqual(["render into target", "render into canvas"]);
    expect(picture.info()).toEqual({ calls: 99, triangles: 99, points: 99 });
    picture.dispose();
  });
});

describe("the node grade (grade-tsl.ts)", () => {
  it("is built on plain Node as a RenderPipeline with its own output transform off", async () => {
    const { gradeOutput, nodeGradePass } = await import("../pwa/src/game/grade-tsl.ts");
    let made: GradeUniforms | null = null;
    const pass = createGradePass(0, (u) => {
      made = u;
      return { render() {}, dispose() {} };
    });
    const u = made as unknown as GradeUniforms;
    expect((gradeOutput(u, pass.target.texture) as { isNode?: boolean }).isNode).toBe(true);
    const order: string[] = [];
    let target: unknown = "the pass's";
    const renderer = {
      toneMapping: THREE.ACESFilmicToneMapping,
      outputColorSpace: THREE.SRGBColorSpace,
      getRenderTarget: () => target,
      setRenderTarget: (t: unknown) => void (order.push(`onto ${t ?? "canvas"}`), (target = t)),
    };
    const drawn = nodeGradePass(renderer as never, u);
    expect(drawn.pipeline.isRenderPipeline).toBe(true);
    expect(drawn.pipeline.outputColorTransform).toBe(false);
    drawn.pipeline.render = vi.fn(() => void order.push("quad"));
    drawn.render();
    expect(order).toEqual(["onto canvas", "quad", "onto the pass's"]);
    drawn.dispose();
    pass.dispose();
  });

  it("restates every number of the GLSL fragment, and three's GLSL tone-map fit", () => {
    const tsl = readFileSync(join(GAME, "grade-tsl.ts"), "utf8");
    const numbers = (src: string): Set<number> =>
      new Set([...src.matchAll(/(?<![\w.])\d+\.\d+|(?<![\w.])\d+(?![\w.])/g)].map((m) => +m[0]));
    const said = numbers(tsl);
    // `MID_P` is `sqrt(0.18)` there, and the GLSL's `vec3(1.0)`-style ones
    // and zeros are TSL's plain 1 and 0.
    said.add(Math.sqrt(0.18));
    const missing = [...numbers(GRADE_FRAGMENT)].filter(
      (n) => ![...said].some((m) => Math.abs(m - n) < 1e-7),
    );
    expect(missing).toEqual([]);
    // The fit restated is the GLSL one (0.432951 alone, not times 0.983729).
    const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
    expect(chunk).toContain("v * ( 0.983729 * v + 0.4329510 ) + 0.238081");
    expect(tsl).toContain(".div(v.mul(v.mul(0.983729).add(0.432951)).add(0.238081))");
  });
});

describe("the warm-up through the grade's target (warmNode)", () => {
  it("draws into the target the caller set, through one pixel of it, and puts its scissor back", async () => {
    const { warmNode } = await import("../pwa/src/game/environment.ts");
    const { createHazeUniforms } = await import("../pwa/src/game/haze.ts");
    const { KeyLight } = await import("../pwa/src/game/world-lights.ts");
    const target = new THREE.RenderTarget(640, 360);
    const seen: string[] = [];
    let scissor = false;
    let onto: THREE.RenderTarget | null = target;
    const gl = {
      shadowMap: { enabled: false },
      render: () =>
        void seen.push(
          `into ${onto === target ? "target" : "canvas"} ${target.scissor.toArray().join(",")} test=${scissor}`,
        ),
      setRenderTarget: (t: THREE.RenderTarget | null) => void (onto = t),
      getRenderTarget: () => onto,
      getScissorTest: () => scissor,
      setScissorTest: (on: boolean) => void (scissor = on),
      getScissor: (v: THREE.Vector4) => v.set(0, 0, 640, 360),
      setScissor: () => {},
    };
    const frame = { beginFrame: () => {}, endFrame: () => {} };
    const quarantine = { hide: () => {}, restore: () => {} };
    const sun = new KeyLight(createHazeUniforms());
    warmNode(gl as never, new THREE.Scene(), new THREE.Camera(), sun, 400, frame, quarantine);
    expect(seen).toEqual(["into target 0,0,1,1 test=true"]);
    expect(target.scissor.toArray()).toEqual([0, 0, 640, 360]);
    expect(onto).toBe(target);
  });
});
