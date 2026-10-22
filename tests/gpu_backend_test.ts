// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH BACK END DRAWS THE WORLD (`gpu-backend.ts`), the link that names it
// (`?renderer=`, `url-params.ts`), and the quarantine that hides what the
// webgpu paths cannot draw yet (`gpu-quarantine.ts`) — `docs/webgpu.md`.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  BACKENDS,
  DEFAULT_BACKEND,
  GPU_PORTS,
  backendLines,
  chooseBackend,
  freshBackend,
  glslOnly,
  quarantinedOn,
  readBackend,
  runsPass,
  skippedPasses,
} from "../pwa/src/game/gpu-backend.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("the back end a visit draws on", () => {
  it("reads every back end off the link, and nothing else", () => {
    for (const b of BACKENDS) expect(readBackend(b)).toBe(b);
    for (const word of [null, undefined, "", "WebGPU", "gl", "webgpu2"]) {
      expect(readBackend(word)).toBeNull();
    }
  });

  it("is WebGL unless the link names another", () => {
    expect(DEFAULT_BACKEND).toBe("webgl");
    expect(chooseBackend(null)).toBe("webgl");
    expect(chooseBackend("webgpu")).toBe("webgpu");
    expect(readParams("").renderer).toBeNull();
    expect(readParams("?renderer=webgpu-gl").renderer).toBe("webgpu-gl");
    expect(readParams("?renderer=vulkan").renderer).toBeNull();
    // `?gpu=` is the GPU's timer, a different word.
    expect(readParams("?gpu=split").renderer).toBeNull();
  });
});

describe("the register of what is ported (GPU_PORTS)", () => {
  it("names each system once, with a part of the plan", () => {
    const ids = GPU_PORTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of GPU_PORTS) expect(p.part).toBeGreaterThanOrEqual(1);
  });

  it("runs every pass on WebGL and only the ported ones on the webgpu paths", () => {
    for (const p of GPU_PORTS.filter((row) => row.kind === "pass")) {
      expect(runsPass("webgl", p.id)).toBe(true);
      expect(runsPass("webgpu", p.id)).toBe(p.ported);
      expect(runsPass("webgpu-gl", p.id)).toBe(p.ported);
    }
    // A pass nobody registered has nothing to port.
    expect(runsPass("webgpu", "not-a-pass")).toBe(true);
    expect(skippedPasses("webgl")).toEqual([]);
    expect(skippedPasses("webgpu")).toEqual(
      GPU_PORTS.filter((p) => p.kind === "pass" && !p.ported).map((p) => p.id),
    );
  });

  it("hides a material family only on the webgpu paths, until ported", () => {
    expect(quarantinedOn("webgl", "shader")).toBe(false);
    expect(quarantinedOn("webgpu", "terrain")).toBe(
      !GPU_PORTS.find((p) => p.id === "terrain")?.ported,
    );
    // A family nobody registered is GLSL nobody has ported: hidden.
    expect(quarantinedOn("webgpu", "unheard-of")).toBe(true);
  });

  it("writes what ran, what it skipped and what it hid", () => {
    const state = freshBackend("webgpu", "webgpu-gl");
    state.quarantined = { "shader:sky": 1, "terrain:terrain": 2 };
    const lines = backendLines(state);
    expect(lines[0]).toBe("RENDERER webgpu-gl (asked webgpu)");
    expect(lines.join("\n")).toContain(`SKIPPED ${skippedPasses("webgpu-gl").join(" · ")}`);
    expect(lines.join("\n")).toContain("QUARANTINED terrain:terrain ×2 · shader:sky ×1");
    expect(backendLines(freshBackend("webgl"))).toEqual(["RENDERER webgl"]);
  });
});

describe("the quarantine (gpu-quarantine.ts)", () => {
  const stage = () => {
    const scene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial());
    sky.name = "sky";
    const figure = new THREE.Group();
    figure.name = "wingsuit";
    const suit = new THREE.Mesh(
      new THREE.PlaneGeometry(),
      glslOnly(new THREE.MeshStandardMaterial(), "haze-graft"),
    );
    figure.add(suit);
    const woods = glslOnly(new THREE.Mesh(new THREE.BoxGeometry()), "snow-under");
    const lift = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const both = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshBasicMaterial(),
      new THREE.RawShaderMaterial(),
    ]);
    scene.add(sky, figure, woods, lift, both);
    return { scene, sky, suit, woods, lift, both };
  };

  it("hides every GLSL-drawn object for the frame and shows it again after", () => {
    const { scene, sky, suit, woods, lift, both } = stage();
    const q = createQuarantine("webgpu");
    q.hide(scene);
    expect([sky.visible, suit.visible, woods.visible, both.visible]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(lift.visible).toBe(true);
    expect(q.counts()).toMatchObject({
      "shader:sky": 1,
      "haze-graft:wingsuit": 1,
      "snow-under:scene": 1,
    });
    q.restore();
    for (const o of [sky, suit, woods, lift, both]) expect(o.visible).toBe(true);
  });

  it("hides nothing on WebGL", () => {
    const { scene, sky, suit } = stage();
    const q = createQuarantine("webgl");
    q.hide(scene);
    expect(sky.visible && suit.visible).toBe(true);
    expect(q.counts()).toEqual({});
  });
});
