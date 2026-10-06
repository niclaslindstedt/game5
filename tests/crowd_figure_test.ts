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
import { PLANT, plantLength } from "../pwa/src/game/skier-spring.ts";

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

  it("every shape stands on its skis on the snow but the air", () => {
    for (const body of CROWD_BODIES) {
      const targets = crowdTargets(CROWD_LOOKS[body]);
      targets.forEach((t, k) => {
        const pose = k === 0 ? "stand" : CROWD_POSES[k - 1];
        if (pose === "air" || pose === "lean" || pose === "leanLeft") return;
        expect(Math.min(t.skiL.mid[1], t.skiR.mid[1]), `${body} ${pose}`).toBeCloseTo(0, 6);
        expect(t.head[1], `${body} ${pose}`).toBeGreaterThan(t.pelvis[1]);
      });
      // Leaned, the outside ski stays on the snow and the head goes in.
      const [, , right, left] = targets;
      expect(right.skiL.mid[1]).toBeCloseTo(0, 6);
      expect(right.head[0]).toBeGreaterThan(0.2 * CROWD_LOOKS[body].height);
      expect(left.skiR.mid[1]).toBeCloseTo(0, 6);
      expect(left.head[0]).toBeLessThan(-0.2 * CROWD_LOOKS[body].height);
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

  it("working, he skates and poles the player's own stride, never glides still", () => {
    const sum = (r: ReturnType<typeof w>, name: string) =>
      CROWD_POSES.filter((k) => k.startsWith(name)).reduce((x, k) => x + r.of(k), 0);
    const work = { mode: "ski", push: 1, fall: 0, plough: 0, crouch: 0.2, lean: 0 } as const;
    // Rolling, a skate, wholly; its keys moving through his stride.
    const seen = new Set<string>();
    for (let pole = 0; pole < 2; pole += 0.25) {
      const r = w({ ...work, body: "man", speed: 4, pole });
      expect(sum(r, "skate")).toBeCloseTo(1, 3);
      expect(sum(r, "pole")).toBeCloseTo(0, 3);
      seen.add(
        CROWD_POSES.filter((k) => k.startsWith("skate")).sort((a, b) => r.of(b) - r.of(a))[0],
      );
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    // At a walk on the flat, a double pole; with no poles, a skate.
    expect(sum(w({ ...work, body: "man", speed: 1, pole: 0.3 }), "pole")).toBeCloseTo(1, 3);
    const child = w({ ...work, body: "child", speed: 1, pole: 0.3 });
    expect(sum(child, "pole")).toBe(0);
    expect(sum(child, "skate")).toBeGreaterThan(0.5);
    // Not working, neither.
    const glide = w({ ...work, push: 0, body: "man", speed: 4, pole: 0.3 });
    expect(sum(glide, "skate") + sum(glide, "pole")).toBe(0);
  });

  it("a turn each way on its own target, never one run backwards", () => {
    const right = w({ lean: 0.4, fall: 0, fallSide: 1 });
    expect(right.of("lean")).toBeGreaterThan(0.5);
    expect(right.of("leanLeft")).toBe(0);
    const left = w({ lean: -0.4, fall: 0, fallSide: 1 });
    expect(left.of("leanLeft")).toBeGreaterThan(0.5);
    expect(left.of("lean")).toBe(0);
    for (const v of [...right.out, ...left.out]) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("a pole plant on every turn he begins, by the player's own rule", () => {
    const turning = { mode: "ski", speed: 8, crouch: 0.3, plough: 0, push: 0, fall: 0 } as const;
    const into = (turnT: number, over: Partial<Amateur> = {}) =>
      w({ ...turning, turnSide: 1, turnHeld: 1, turnT, fallSide: 1, ...over });
    // A turn to the right plants the right pole, swung to the touch and
    // trailed back, and is over when the player's plant would be.
    const touch = into(0.2);
    expect(touch.of("plantRight")).toBeGreaterThan(0.5);
    expect(touch.of("plantLeft") + touch.of("trailLeft")).toBe(0);
    expect(into(0.5).of("trailRight")).toBeGreaterThan(touch.of("trailRight"));
    const over = into(plantLength(8) + 0.01);
    for (const k of ["plantRight", "trailRight"] as const) expect(over.of(k)).toBe(0);
    // ...the left one on a turn to the left, and the other again mirrored.
    expect(into(0.2, { turnSide: -1 }).of("plantLeft")).toBeGreaterThan(0.5);
    expect(into(0.2, { fallSide: -1 }).of("plantLeft")).toBeGreaterThan(0.5);
    // None after a turn that never held, too slow, in a wedge, or down.
    for (const not of [
      { turnHeld: PLANT.held / 2 },
      { speed: PLANT.slow / 2 },
      { plough: 0.9 },
      { fall: 1, mode: "down" as const },
    ]) {
      const no = into(0.2, not);
      expect(no.of("plantRight") + no.of("trailRight")).toBe(0);
    }
  });

  it("stood still he waits alive, swung one way and the other on his own clock", () => {
    const still = { mode: "stop", speed: 0, push: 0, fall: 0 } as const;
    const seen = new Set<string>();
    for (let t = 0; t < 8; t += 0.5) {
      const out = new Array<number>(CROWD_POSES.length).fill(0);
      dialsOf(at({ ...still }), out, t);
      const idle = out[CROWD_POSES.indexOf("idle")];
      const away = out[CROWD_POSES.indexOf("idleAway")];
      expect(idle * away).toBe(0);
      if (idle > 0.5) seen.add("idle");
      if (away > 0.5) seen.add("away");
    }
    expect(seen.size).toBe(2);
    // Moving, he is not waiting.
    const moving = w({ mode: "ski", speed: 6, fall: 0 });
    expect(moving.of("idle") + moving.of("idleAway")).toBe(0);
  });

  it("down in the snow, no target shows: he is drawn off his ragdoll", () => {
    const down = w({ fall: 1, fallSide: -1, lean: 0.4, crouch: 0.8, across: 1 });
    expect(down.mirror).toBe(-1);
    for (const k of CROWD_POSES) expect(down.of(k)).toBe(0);
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
