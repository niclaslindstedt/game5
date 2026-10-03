// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S FIGURES (`crowd-rig.ts`, `crowd-shapes.ts`, `crowd-dress.ts`):
// posed by the player's own pose, built to a triangle budget at three cuts
// with every pose the same mesh, weighted off an amateur's numbers, and
// dressed off his id.

import { describe, expect, it } from "vitest";
import { CROWD_BODIES, createGame, type Amateur } from "@engine";

import { CROWD_PALETTE } from "../pwa/src/game/crowd-dress.ts";
import { outfitOf } from "../pwa/src/game/crowd-dress.ts";
import {
  CROWD_LOOKS,
  CROWD_POSES,
  crowdTargets,
  dialsOf,
  poseCrowd,
  type V3,
} from "../pwa/src/game/crowd-rig.ts";
import { CROWD_LODS, buildCrowdFigure, crowdTriangles } from "../pwa/src/game/crowd-shapes.ts";
import { skierPose } from "../pwa/src/game/skier-pose.ts";

const sub = (a: V3, b: { x: number; y: number; z: number } | V3): V3 =>
  Array.isArray(b) ? [a[0] - b[0], a[1] - b[1], a[2] - b[2]] : [a[0] - b.x, a[1] - b.y, a[2] - b.z];

describe("the crowd is posed by the player's own pose", () => {
  const STAND = { hipRight: 0, hipAft: 0, lean: 0, steer: 0, airborne: false, landing: 10 };
  // The reference man is the player's size: his joints, to the millimetre,
  // are the player's (the crowd stands on the snow, so only the offsets
  // between joints are compared).
  for (const [name, input, dial] of [
    ["the stance", { ...STAND, crouch: 0 }, {}],
    ["the tuck", { ...STAND, crouch: 1, tuck: 1 }, { crouch: 1 }],
  ] as const) {
    it(`${name}: the knees, hips and head where the player's are`, () => {
      const player = skierPose(input);
      const crowd = poseCrowd(CROWD_LOOKS.man, dial);
      const p = (v: { x: number; y: number; z: number }): V3 => [v.x, v.y, v.z];
      const legP = sub(p(player.knees[0]), player.hips);
      const legC = sub(crowd.kneeL, crowd.pelvis);
      const headP = sub(p(player.head), player.hips);
      const headC = sub(crowd.head, crowd.pelvis);
      for (let i = 0; i < 3; i++) {
        expect(legC[i]).toBeCloseTo(legP[i], 6);
        expect(headC[i]).toBeCloseTo(headP[i], 6);
      }
    });
  }

  it("every shape stands on its skis on the snow but the fall and the air", () => {
    for (const body of CROWD_BODIES) {
      const targets = crowdTargets(CROWD_LOOKS[body]);
      targets.forEach((t, k) => {
        const pose = k === 0 ? "stand" : CROWD_POSES[k - 1];
        if (pose === "down" || pose === "air" || pose === "lean" || pose === "leanLeft") return;
        expect(Math.min(t.skiL.mid[1], t.skiR.mid[1]), `${body} ${pose}`).toBeCloseTo(0, 6);
        expect(t.head[1], `${body} ${pose}`).toBeGreaterThan(t.pelvis[1]);
      });
      // Leaned, the outside ski stays on the snow and the head goes in.
      const [, , right, left] = targets;
      expect(right.skiL.mid[1]).toBeCloseTo(0, 6);
      expect(right.head[0]).toBeGreaterThan(0.2 * CROWD_LOOKS[body].height);
      expect(left.skiR.mid[1]).toBeCloseTo(0, 6);
      expect(left.head[0]).toBeLessThan(-0.2 * CROWD_LOOKS[body].height);
      // Down, he lies on the snow.
      const down = targets[1 + CROWD_POSES.indexOf("down")];
      expect(down.pelvis[1]).toBeLessThan(0.25 * CROWD_LOOKS[body].height);
    }
  });

  it("a child is a child: shorter, on shorter skis, with no poles", () => {
    expect(CROWD_LOOKS.child.height).toBeLessThan(CROWD_LOOKS.teen.height * 0.8);
    expect(CROWD_LOOKS.child.ski).toBeLessThan(CROWD_LOOKS.man.ski * 0.7);
    expect(CROWD_LOOKS.child.poles).toBe(false);
  });
});

describe("the figures are built", () => {
  it("to a budget at each cut, every pose the same mesh", () => {
    for (const body of CROWD_BODIES) {
      const [near, mid, far] = CROWD_LODS.map((lod) => crowdTriangles(body, lod));
      expect(near).toBeLessThanOrEqual(300);
      expect(mid).toBeLessThan(near);
      expect(far).toBeLessThan(mid);
      expect(far).toBeLessThanOrEqual(110);
      for (const lod of CROWD_LODS) {
        const g = buildCrowdFigure(body, lod);
        expect(g.morphAttributes.position).toHaveLength(CROWD_POSES.length);
        expect(g.morphTargetsRelative).toBe(true);
        const slots = g.getAttribute("aSlot").array;
        expect(slots.length).toBe(g.getAttribute("position").count);
      }
    }
  });
});

describe("an amateur's weights and kit", () => {
  const state = createGame({ seed: 7, mode: "free", quiet: true, crowd: 120 });
  const crowd = state.crowd!;
  const at = (over: Partial<Amateur>): Amateur => ({ ...crowd.amateurs[0], ...over });
  const w = (over: Partial<Amateur>) => {
    const out = new Array<number>(CROWD_POSES.length).fill(0);
    const mirror = dialsOf(at(over), out);
    return { out, mirror, of: (k: (typeof CROWD_POSES)[number]) => out[CROWD_POSES.indexOf(k)] };
  };

  it("a turn each way on its own target, never one run backwards", () => {
    const right = w({ lean: 0.4, fall: 0, fallSide: 1 });
    expect(right.of("lean")).toBeGreaterThan(0.5);
    expect(right.of("leanLeft")).toBe(0);
    const left = w({ lean: -0.4, fall: 0, fallSide: 1 });
    expect(left.of("leanLeft")).toBeGreaterThan(0.5);
    expect(left.of("lean")).toBe(0);
    for (const v of [...right.out, ...left.out]) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("down in the snow, nothing else shows, mirrored to the side he fell on", () => {
    const down = w({ fall: 1, fallSide: -1, lean: 0.4, crouch: 0.8, across: 1 });
    expect(down.of("down")).toBe(1);
    expect(down.mirror).toBe(-1);
    for (const k of CROWD_POSES) if (k !== "down") expect(down.of(k)).toBe(0);
  });

  it("each dealt a kit of his own, the same every time; a ski school in one bib", () => {
    const seen = new Set<string>();
    for (const a of crowd.amateurs) {
      const kit = outfitOf(a, crowd.groups[a.group], 7);
      expect(kit).toEqual(outfitOf(a, crowd.groups[a.group], 7));
      for (const i of kit) expect(i).toBeLessThan(CROWD_PALETTE.length);
      if (a.body === "retro") expect(kit[1]).toBe(kit[0]);
      seen.add(kit.slice(0, 4).join(","));
    }
    expect(seen.size).toBeGreaterThan(crowd.amateurs.length * 0.8);
    for (const g of crowd.groups.filter((x) => x.kind === "school")) {
      const bibs = g.members.slice(1).map((m) => outfitOf(crowd.amateurs[m], g, 7)[0]);
      expect(new Set(bibs).size).toBe(1);
    }
  });
});
