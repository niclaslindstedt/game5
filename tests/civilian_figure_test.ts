// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS' FIGURES (`civilian-moves.ts`, `civilian-shapes.ts`,
// `civilian-dress.ts`): every pose the same mesh, the feet on the floor
// stood, the seat under the sat, the cup at the mouth, the weights of a
// moment a whole body, and each person dressed the same every frame.

import { describe, expect, it } from "vitest";
import { CROWD_BODIES } from "@engine";

import { CIVILIAN_PALETTE, civilianKit, kitParts, PART } from "../pwa/src/game/civilian-dress.ts";
import {
  CIVILIAN_POSES,
  civilianDials,
  civilianPosed,
  handReach,
  moveOf,
} from "../pwa/src/game/civilian-moves.ts";
import {
  civilianAt,
  civilianHour,
  civilianPlanFor,
  freshCivilianPose,
  type CivilianPose,
} from "../pwa/src/game/civilian-plan.ts";
import { buildCivilianFigure, civilianTriangles } from "../pwa/src/game/civilian-shapes.ts";
import { CROWD_LOOKS } from "../pwa/src/game/crowd-rig.ts";
import { CROWD_LODS } from "../pwa/src/game/crowd-shapes.ts";
import { BODY } from "../pwa/src/game/skier-mounts.ts";
import { levelFor } from "./support/levels.ts";

const STOOD = new Set([
  "stand",
  "idle",
  "idleAway",
  "carry",
  "drink",
  "talk0",
  "talk1",
  "wave0",
  "wave1",
  "cheer0",
  "sweep0",
  "sweep1",
]);

describe("the civilians are posed off their keys", () => {
  it("stood, both boots on the floor; sat, the hips over the seat", () => {
    for (const body of CROWD_BODIES) {
      const k = CROWD_LOOKS[body].height / 1.8;
      for (const target of ["stand", ...CIVILIAN_POSES] as const) {
        const p = civilianPosed(body, target);
        const soles = [p.skiL.mid[1], p.skiR.mid[1]];
        if (STOOD.has(target)) {
          for (const y of soles) expect(Math.abs(y), `${body} ${target}`).toBeLessThan(0.05 * k);
        }
        // Nothing of him under the floor but a sole's thickness.
        expect(Math.min(...soles), `${body} ${target}`).toBeGreaterThan(-0.06 * k);
        expect(p.head[1], `${body} ${target}`).toBeGreaterThan(p.pelvis[1]);
      }
      const bench = civilianPosed(body, "bench");
      expect(bench.pelvis[1]).toBeGreaterThan(0.47 * k);
      expect(bench.pelvis[1]).toBeLessThan(0.47 * k + 0.18);
      const snow = civilianPosed(body, "snow");
      expect(snow.pelvis[1]).toBeLessThan(0.25);
    }
  });

  it("every hand within its arm's reach, a cup brought to the mouth", () => {
    const arm = BODY.upperArm + BODY.forearm;
    for (const target of ["stand", ...CIVILIAN_POSES] as const) {
      const { key } = moveOf(target);
      expect(handReach(key, true), target).toBeLessThan(arm + 1e-6);
      expect(handReach(key, false), target).toBeLessThan(arm + 1e-6);
    }
    for (const target of ["drink", "benchDrink", "snowDrink", "loungeSip"] as const) {
      const p = civilianPosed("man", target);
      const d = Math.hypot(...[0, 1, 2].map((i) => p.handR[i] - p.head[i]));
      expect(d, target).toBeLessThan(0.3);
    }
  });
});

describe("the civilians' figures", () => {
  it("are one mesh in every pose, under a budget at each cut", () => {
    for (const body of CROWD_BODIES) {
      for (const lod of CROWD_LODS) {
        const g = buildCivilianFigure(body, lod);
        const morphs = g.morphAttributes.position ?? [];
        expect(morphs.length).toBe(CIVILIAN_POSES.length);
        for (const m of morphs) {
          expect(m.count).toBe(g.getAttribute("position").count);
        }
        expect(g.getAttribute("aPart").count).toBe(g.getAttribute("position").count);
      }
      expect(civilianTriangles(body, "near")).toBeLessThan(900);
      expect(civilianTriangles(body, "far")).toBeLessThan(civilianTriangles(body, "mid"));
      expect(civilianTriangles(body, "mid")).toBeLessThan(civilianTriangles(body, "near"));
    }
  });
});

describe("a civilian's moment", () => {
  const level = levelFor(38);
  const plan = civilianPlanFor(level);
  const hour = civilianHour(level);

  it("is weighted as one whole body, never past it", () => {
    const pose = freshCivilianPose();
    const w = new Float32Array(CIVILIAN_POSES.length);
    const carry = CIVILIAN_POSES.indexOf("carry");
    for (let i = 0; i < plan.people.length; i++) {
      for (const t of [3.1, 47.6, 210.25]) {
        civilianAt(plan, i, t, hour, pose);
        civilianDials(pose, t, i, w);
        let sum = 0;
        w.forEach((x, k) => {
          expect(x).toBeGreaterThanOrEqual(0);
          if (k !== carry) sum += x;
        });
        expect(sum, `${plan.people[i].role} ${pose.activity}`).toBeLessThanOrEqual(1 + 1e-5);
      }
    }
  });

  it("is dressed the same every time, in the palette, the patrol in its cross", () => {
    const parts = [0, 0, 0, 0];
    for (const c of plan.people) {
      const a = civilianKit(c, level.seed);
      const b = civilianKit(c, level.seed);
      expect(a).toEqual(b);
      for (const k of a.colours) expect(k).toBeLessThan(CIVILIAN_PALETTE.length);
      if (c.role === "patrol") expect(a.mark).toBe(PART.cross);
      const pose: CivilianPose = { ...freshCivilianPose(), carry: "skis" };
      kitParts(a, pose, parts);
      expect(parts[1]).toBe(PART.skis);
    }
  });
});
