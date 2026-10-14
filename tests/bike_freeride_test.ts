// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREERIDE LOOK (`?bikelook=freeride`): the big-mountain bike built in
// code on the game's bike nodes (`bike-freeride.ts`), the style its rider
// rides it with (`bike-ride-style.ts` — the whip, the table, the foot out,
// the brake) and the freerider's kit (`outfit.ts`' `rideKit`,
// `dress-bike.ts`). Presentation only: the engine never reads any of it.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { bikePose, step, NEUTRAL_INPUT } from "@engine";

import { readParams } from "../pwa/src/game/url-params.ts";
import { buildFreerideBike } from "../pwa/src/game/bike-freeride.ts";
import { RIDE_STYLE, rideStyleOf } from "../pwa/src/game/bike-ride-style.ts";
import { bikeLookOf } from "../pwa/src/game/bike-variant.ts";
import { BIKE_NODES } from "../pwa/src/game/bike-view.ts";
import { dressOutfit, outfitKey } from "../pwa/src/game/dress.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { DEFAULT_OUTFIT, GEAR_SLOTS, helmetOf, rideKit, RIDE_KIT } from "../pwa/src/game/outfit.ts";
import { freerideKey, riderKey, underHim } from "../pwa/src/game/skier-bike.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

describe("the freeride look's switch", () => {
  it("reads only its own two words", () => {
    expect(bikeLookOf("freeride")).toBe("freeride");
    expect(bikeLookOf("trail")).toBe("trail");
    expect(bikeLookOf("bmx")).toBeNull();
    expect(readParams("?bikelook=freeride").bikeLook).toBe("freeride");
    expect(readParams("").bikeLook).toBeNull();
  });
});

describe("the freeride bike (bike-freeride.ts)", () => {
  it("hangs every part off the nodes the game poses", () => {
    const built = buildFreerideBike(createHazeUniforms());
    for (const key of Object.keys(BIKE_NODES) as (keyof typeof BIKE_NODES)[]) {
      const node = built.nodes[key];
      expect(node.name).toBe(BIKE_NODES[key]);
      let up: THREE.Object3D | null = node;
      while (up && up !== built.root) up = up.parent;
      expect(up).toBe(built.root);
      let meshes = 0;
      node.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++;
      });
      expect(meshes, key).toBeGreaterThan(0);
    }
    built.dispose();
  });
});

describe("the freerider's style (bike-ride-style.ts)", () => {
  const level = summerMap(38);

  it("is nothing at rest on the ground, and the same answer every time it is asked", () => {
    const s = bikeRun(level);
    for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
    const a = rideStyleOf(s.bike!, s.level, s.t);
    expect(a.trick).toBe("none");
    expect(a.yaw).toBe(0);
    expect(a.roll).toBe(0);
    expect(rideStyleOf(s.bike!, s.level, s.t)).toEqual(a);
  });

  it("throws a long air's trick, never past its shape, and unwinds it before the ground", () => {
    const s = bikeRun(level);
    for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
    const b = s.bike!;
    // Launched high off the snow it rides: a long flight, sampled through.
    const lifted = { ...b, airborne: true, y: b.y + 6, vy: 4, airTime: 0 };
    let most = 0;
    let last = 1;
    for (let k = 0; k <= 400; k++) {
      const air = k / 120;
      const at = {
        ...lifted,
        airTime: air,
        y: lifted.y + 4 * air - 0.5 * 9.81 * air * air,
        vy: 4 - 9.81 * air,
      };
      const st = rideStyleOf(at, s.level, s.t + air);
      if (st.trick === "none") continue;
      const shape = st.trick === "whip" ? RIDE_STYLE.whip : RIDE_STYLE.table;
      expect(Math.abs(st.yaw)).toBeLessThanOrEqual(shape.yaw + 1e-9);
      expect(Math.abs(st.roll)).toBeLessThanOrEqual(shape.roll + 1e-9);
      most = Math.max(most, st.amount);
      last = st.amount;
    }
    expect(most).toBeGreaterThan(0.8);
    expect(last).toBeLessThan(0.05);
  });

  it("a short hop gets nothing", () => {
    const s = bikeRun(level);
    for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
    const b = s.bike!;
    const hop = { ...b, airborne: true, y: b.y + 0.15, vy: 0.5, airTime: 0.05 };
    expect(rideStyleOf(hop, s.level, s.t).trick).toBe("none");
  });

  it("the rider's hands and feet go round with the bike in a whip, his hips only a share", () => {
    const s = bikeRun(level);
    for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
    const pose = bikePose(s.bike!);
    const none = {
      trick: "none",
      side: 1,
      amount: 0,
      yaw: 0,
      roll: 0,
      footOut: 0,
      foot: 0,
      brake: 0,
      flight: 0,
    } as const;
    const still = freerideKey(pose, none);
    const yaw = -RIDE_STYLE.whip.yaw;
    const roll = RIDE_STYLE.whip.roll;
    const whipped = freerideKey(pose, { ...none, trick: "whip", amount: 1, yaw, roll });
    for (let i = 0; i < 2; i++) {
      const h = underHim(still.hands[i], yaw, roll);
      expect(
        Math.hypot(h.x - whipped.hands[i].x, h.y - whipped.hands[i].y, h.z - whipped.hands[i].z),
      ).toBeLessThan(1e-9);
      const f = underHim(still.feet[i], yaw, roll);
      expect(
        Math.hypot(f.x - whipped.feet[i].x, f.y - whipped.feet[i].y, f.z - whipped.feet[i].z),
      ).toBeLessThan(1e-9);
    }
    expect(Math.abs(whipped.twist - still.twist)).toBeLessThan(Math.abs(yaw) * 0.5);
    // Riding plainly, the freerider is the trail rider's stance spread.
    expect(riderKey(pose).hands).toEqual(still.hands);
  });
});

describe("the freerider's kit (outfit.ts, dress-bike.ts)", () => {
  it("is the rider's own body and build, no poles, the kit's helmet", () => {
    const k = rideKit(DEFAULT_OUTFIT);
    expect(k.bike).toBe(true);
    expect(k.body).toBe(DEFAULT_OUTFIT.body);
    expect(k.weight).toBe(DEFAULT_OUTFIT.weight);
    expect(k.poles).toBe("none");
    expect(helmetOf(k).shell).toBe(RIDE_KIT.helmet.shell);
    expect(GEAR_SLOTS).not.toContain("bike");
  });

  it("is cut and kept apart from the same pieces off the bike", () => {
    const k = rideKit(DEFAULT_OUTFIT);
    expect(outfitKey(k)).not.toBe(outfitKey({ ...k, bike: false }));
    const kit = dressOutfit(k);
    const plain = dressOutfit({ ...k, bike: false });
    expect(kit.cloth.index.length).toBeGreaterThan(0);
    expect(kit.hard.index.length).toBeGreaterThan(plain.hard.index.length);
    expect(kit.cloth.index.length).not.toBe(plain.cloth.index.length);
    // Every vertex rides bones that sum to one.
    for (let i = 0; i < kit.cloth.skinWeight.length; i += 4) {
      const w = kit.cloth.skinWeight;
      expect(w[i] + w[i + 1] + w[i + 2] + w[i + 3]).toBeCloseTo(1, 5);
    }
  });
});
