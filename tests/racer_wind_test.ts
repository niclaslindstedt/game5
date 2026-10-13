// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACER IN THE AIR (`racer-model.ts`): where the suit is slack, where a
// fold creases it, and the shader graft landing on the chunks it is written
// against — a chunk three renames is a graft that silently does nothing.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import {
  createRacerWind,
  creaseOf,
  graftWind,
  RACER_CREASE,
  slackOf,
} from "../pwa/src/game/racer-model.ts";

const bind = bindPose().frames;
const at = (f: { x: number; y: number; z: number }) => new THREE.Vector3(f.x, f.y, f.z);

describe("the racer's suit", () => {
  it("creases at the back of the knee, not its front", () => {
    const knee = at(bind.shin_l.head);
    const back = creaseOf(knee.clone().add(new THREE.Vector3(0, 0, -0.06)), bind);
    const front = creaseOf(knee.clone().add(new THREE.Vector3(0, 0, 0.06)), bind);
    expect(back.joint).toBe(0);
    expect(back.weight).toBeGreaterThan(0.5);
    expect(front.weight).toBeLessThan(0.05);
  });

  it("creases at the front of the hip and the inside of the elbow", () => {
    const hip = creaseOf(at(bind.thigh_r.head).add(new THREE.Vector3(0, 0, 0.09)), bind);
    expect(hip.joint).toBe(3);
    expect(hip.weight).toBeGreaterThan(0.3);
    const elbow = at(bind.forearm_l.head);
    const inside = at(bind.forearm_l.y).multiplyScalar(0.045);
    expect(creaseOf(elbow.clone().add(inside), bind).joint).toBe(4);
  });

  it("is slack behind the thigh and over the seat, tight on the shin", () => {
    const thigh = at(bind.thigh_l.head).add(at(bind.thigh_l.y).multiplyScalar(0.2));
    expect(slackOf(thigh.clone().add(new THREE.Vector3(0, 0, -0.08)), bind)).toBeGreaterThan(0.7);
    const shin = at(bind.shin_l.head).add(at(bind.shin_l.y).multiplyScalar(0.25));
    expect(slackOf(shin.add(new THREE.Vector3(0, 0, -0.06)), bind)).toBeCloseTo(0.25, 2);
    for (const f of Object.values(bind)) {
      const s = slackOf(at(f.head), bind);
      expect(s).toBeGreaterThanOrEqual(0.25);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("folds its creases in only past the bind pose's own bend", () => {
    expect(RACER_CREASE.knee.whole).toBeGreaterThan(RACER_CREASE.knee.from);
    expect(RACER_CREASE.elbow.from).toBeGreaterThan(RACER_CREASE.knee.from);
  });
});

describe("the wind's graft", () => {
  const compiled = (kind: "bib" | "suit") => {
    const m = new THREE.MeshStandardMaterial();
    graftWind(m, kind, createRacerWind());
    const lib = THREE.ShaderLib.standard;
    const shader = {
      uniforms: {},
      vertexShader: lib.vertexShader,
      fragmentShader: lib.fragmentShader,
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    return { m, shader };
  };

  it("lands on the posed skin, and the suit's ripples and creases on the fragment", () => {
    const bib = compiled("bib");
    expect(bib.shader.vertexShader).toContain("attribute float flap;");
    expect(bib.shader.vertexShader).toMatch(/skinning_vertex>[\s\S]*float lee/);
    expect(bib.shader.fragmentShader).not.toContain("vRipA");
    const suit = compiled("suit");
    expect(suit.shader.vertexShader).toContain("attribute vec4 crease;");
    expect(suit.shader.vertexShader).toContain("vCrA = crease.y * uBend");
    expect(suit.shader.fragmentShader).toMatch(/normal_fragment_maps>[\s\S]*vRipAirV/);
    expect(suit.shader.fragmentShader).toMatch(/color_fragment>[\s\S]*vCrPh/);
    expect(suit.m.customProgramCacheKey()).toContain("racer-suit");
  });
});
