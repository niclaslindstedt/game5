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
  LAB_BACKEND,
  backendLines,
  chooseBackend,
  freshBackend,
  glslOnly,
  pageBackend,
  quarantinedOn,
  readBackend,
  runsPass,
  setVisitBackend,
  skippedPasses,
} from "../pwa/src/game/gpu-backend.ts";
import { DEVICE_SETTINGS } from "../pwa/src/game/cloud-save.ts";
import { createQuarantine } from "../pwa/src/game/gpu-quarantine.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("the back end a visit draws on", () => {
  it("reads every back end and `auto` off the link, and nothing else", () => {
    for (const b of BACKENDS) expect(readBackend(b)).toBe(b);
    expect(readBackend("auto")).toBe("auto");
    for (const word of [null, undefined, "", "WebGPU", "gl", "webgpu2", "AUTO"]) {
      expect(readBackend(word)).toBeNull();
    }
  });

  it("asks for `auto` unless the link or the setting names another, the link first", () => {
    expect(DEFAULT_BACKEND).toBe("auto");
    expect(chooseBackend(null)).toBe("auto");
    expect(chooseBackend(null, "webgl")).toBe("webgl");
    expect(chooseBackend("webgpu", "webgl")).toBe("webgpu");
    expect(chooseBackend("webgl", "auto")).toBe("webgl");
    expect(readParams("").renderer).toBeNull();
    expect(readParams("?renderer=webgpu-gl").renderer).toBe("webgpu-gl");
    expect(readParams("?renderer=auto").renderer).toBe("auto");
    expect(readParams("?renderer=vulkan").renderer).toBeNull();
    // `?gpu=` is the GPU's timer, a different word.
    expect(readParams("?gpu=split").renderer).toBeNull();
  });

  it("draws a lab page on WebGL unless its link names one, and the game's page on its ask", () => {
    expect(LAB_BACKEND).toBe("webgl");
    expect(pageBackend("")).toBe("webgl");
    expect(pageBackend("?renderer=webgpu")).toBe("webgpu");
    setVisitBackend("auto");
    try {
      expect(pageBackend("?seed=4")).toBe("auto");
      expect(pageBackend("?renderer=webgl")).toBe("webgl");
    } finally {
      setVisitBackend(null); // as a lab page found it
    }
    expect(pageBackend("")).toBe("webgl");
  });

  it("keeps the setting a back end this build has, and `auto` otherwise", () => {
    expect(freshSettings().renderer).toBe("auto");
    expect(mergeSettings({ renderer: "webgl" }).renderer).toBe("webgl");
    expect(mergeSettings({ renderer: "webgpu-gl" }).renderer).toBe("webgpu-gl");
    expect(mergeSettings({ renderer: "metal" }).renderer).toBe("auto");
    // A machine's fact, never carried to another device by the cloud save.
    expect(DEVICE_SETTINGS).toContain("renderer");
  });

  it("states an ask that fell back as asked", () => {
    expect(freshBackend("auto").running).toBe("webgpu");
    expect(backendLines(freshBackend("auto", "webgpu-gl"))[0]).toBe(
      "RENDERER webgpu-gl (asked auto)",
    );
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
    const woods = glslOnly(new THREE.Mesh(new THREE.BoxGeometry()), "shadow-depth");
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
      "shadow-depth:scene": 1,
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
