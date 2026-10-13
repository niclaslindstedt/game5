// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AS DRAWN (`bike-look.ts`), THE RIDER ON IT
// (`skier-bike.ts`), ITS LENS (`camera-bike.ts`) and its HUD (`bike-hud.ts`):
// the drawing's axles stand where the physics' do, the shock shortens as
// the rear compresses, the pedals go round the bracket, his hands are on the
// grips and his feet on the pedals in reach of his hips, the ladder is the
// bike's while he rides, and the HUD names the trail he is on.
import { describe, expect, it } from "vitest";
import {
  BIKE,
  BIKE_BB,
  BIKE_REAR_AXLE,
  bikeFrontAxleAt,
  bikePose,
  freshBike,
  LYNX,
  NEUTRAL_INPUT,
  SKIS,
  step,
} from "@engine";

import { overLink, readParams } from "../pwa/src/game/url-params.ts";

import {
  frontAxle,
  gripsAt,
  LIFT_HOOK,
  pedalsAt,
  rearAxle,
  REAR_REST,
  SADDLE_TOP,
  shockAt,
  swingAt,
  BIKE_LOOK,
} from "../pwa/src/game/bike-look.ts";
import { BIKE_RIGS, ridingBike } from "../pwa/src/game/camera-bike.ts";
import { riderKey } from "../pwa/src/game/skier-bike.ts";
import { bikeOf } from "../pwa/src/game/bike-hud.ts";
import { BIKE_NODES } from "../pwa/src/game/bike-view.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the bike's geometry as drawn (bike-look.ts)", () => {
  it("the front axle is the engine's own, from the bottom bracket", () => {
    for (const [steer, comp] of [
      [0, 0],
      [0.3, 0.1],
      [-0.5, 0.2],
    ]) {
      const e = bikeFrontAxleAt(steer, comp, { x: 0, y: 0, z: 0 });
      const d = frontAxle(steer, comp);
      expect(dist(d, { x: e.x - BIKE_BB.x, y: e.y - BIKE_BB.y, z: e.z - BIKE_BB.z })).toBeLessThan(
        1e-9,
      );
    }
  });

  it("the rear axle rides the swingarm's arc within two centimetres of the engine's path", () => {
    const n = Math.hypot(BIKE.rearPath.y, BIKE.rearPath.z);
    expect(
      dist(REAR_REST, { x: 0, y: BIKE_REAR_AXLE.y - BIKE_BB.y, z: BIKE_REAR_AXLE.z - BIKE_BB.z }),
    ).toBeLessThan(1e-9);
    for (const f of [0.25, 0.5, 1]) {
      const comp = f * BIKE.rearEnd.travel;
      const path = {
        x: 0,
        y: REAR_REST.y + (comp * BIKE.rearPath.y) / n,
        z: REAR_REST.z + (comp * BIKE.rearPath.z) / n,
      };
      expect(dist(rearAxle(comp), path)).toBeLessThan(0.02);
    }
    // Compressed, the axle goes UP toward the frame.
    expect(swingAt(BIKE.rearEnd.travel)).toBeGreaterThan(0);
    expect(rearAxle(BIKE.rearEnd.travel).y).toBeGreaterThan(REAR_REST.y);
  });

  it("the shock shortens as the rear compresses, by a stroke in the class's band", () => {
    const open = shockAt(0).length;
    const shut = shockAt(BIKE.rearEnd.travel).length;
    expect(shut).toBeLessThan(open);
    // A downhill coil's stroke: 63–75 mm across measured shocks.
    expect(open - shut).toBeGreaterThan(0.04);
    expect(open - shut).toBeLessThan(0.1);
  });

  it("the pedals go round the bracket at the crank's length, opposite each other", () => {
    for (const a of [0, 1, 2.5, 4]) {
      const [l, r] = pedalsAt(a);
      expect(Math.hypot(l.y, l.z)).toBeCloseTo(BIKE_LOOK.crank, 9);
      expect(l.y).toBeCloseTo(-r.y, 9);
      expect(Math.sign(l.x)).toBe(-Math.sign(r.x));
    }
  });

  it("the bar is in the class's width, the grips turn with the steer, the hooks stand where they hang it", () => {
    const [a, b] = gripsAt(0);
    expect(dist(a, b)).toBeGreaterThan(0.6);
    expect(dist(a, b)).toBeLessThan(0.82);
    const [c] = gripsAt(0.4);
    expect(dist(a, c)).toBeGreaterThan(0.05);
    // The saddle low over the rear tyre, the lift hook the front tyre's top.
    expect(SADDLE_TOP.z).toBeLessThan(0);
    expect(SADDLE_TOP.y).toBeGreaterThan(0.4);
    expect(LIFT_HOOK.y - frontAxle(0, 0).y).toBeCloseTo(BIKE.front.radius, 9);
  });

  it("names every node the modelled bike is posed by", () => {
    expect(Object.keys(BIKE_NODES).sort()).toEqual(
      [
        "bars",
        "cranks",
        "fork",
        "frame",
        "pedalL",
        "pedalR",
        "shock",
        "shockBody",
        "shockRod",
        "swingarm",
        "wheelF",
        "wheelR",
      ].sort(),
    );
  });
});

describe("the rider on it (skier-bike.ts)", () => {
  // Settled on its springs at a trail head (a fresh bike has its rider at
  // the bracket until the first step lays him in the stance).
  let s = bikeRun(summerMap(38));
  for (let i = 0; i < 120; i++) s = step(s, NEUTRAL_INPUT);
  const pose = bikePose(s.bike!);
  const key = riderKey(pose);

  it("has his hands on the grips and his feet over the pedals", () => {
    const bb = { x: -pose.rider.x, y: -pose.rider.y, z: -pose.rider.z };
    const [g0, g1] = gripsAt(pose.steer);
    expect(dist(key.hands[0], { x: bb.x + g0.x, y: bb.y + g0.y, z: bb.z + g0.z })).toBeLessThan(
      1e-9,
    );
    expect(dist(key.hands[1], { x: bb.x + g1.x, y: bb.y + g1.y, z: bb.z + g1.z })).toBeLessThan(
      1e-9,
    );
    const [p0] = pedalsAt(pose.crank);
    expect(dist(key.feet[0], { x: bb.x + p0.x, y: bb.y + p0.y, z: bb.z + p0.z })).toBeLessThan(
      0.12,
    );
  });

  it("stands in reach: his feet under his hips by less than his legs, his hands ahead of them", () => {
    const legs = 0.44 + 0.46;
    for (const f of key.feet) {
      const d = Math.hypot(f.x - key.hipX, f.y - key.hipY, f.z - key.hipZ);
      expect(d).toBeLessThan(legs);
      expect(f.y).toBeLessThan(key.hipY - 0.4);
    }
    for (const h of key.hands) expect(h.z).toBeGreaterThan(key.hipZ + 0.2);
  });
});

describe("the lens on the bike (camera-bike.ts)", () => {
  it("is the bike's ladder while he rides, and his own once he is off or thrown", () => {
    const b = freshBike(BIKE.rider.mass);
    b.onIt = true;
    expect(ridingBike(b, false)).toBe(true);
    expect(ridingBike(b, true)).toBe(false);
    expect(ridingBike(undefined, false)).toBe(false);
    expect(Object.keys(BIKE_RIGS).sort()).toEqual([
      "chase",
      "far",
      "helmet",
      "high",
      "orbit",
      "tips",
    ]);
    expect(BIKE_RIGS.tips.kind).toBe("bolted");
    expect(BIKE_RIGS.chase.kind).toBe("boom");
  });
});

describe("the HUD on the bike (bike-hud.ts)", () => {
  it("names the trail he rides and counts no fall at the start", () => {
    let s = bikeRun(summerMap(38));
    s = step(s, NEUTRAL_INPUT);
    const hud = bikeOf(s);
    expect(hud?.kind).toBe("ridden");
    if (hud?.kind !== "ridden") return;
    expect(hud.trail).toBeTruthy();
    expect(hud.grade).toBeTruthy();
    expect(hud.falls).toBe(0);
  });

  it("is null on a run with no bike", () => {
    const s = bikeRun(summerMap(38));
    expect(bikeOf({ ...s, bike: undefined })).toBe(null);
  });
});

describe("the link (url-params.ts)", () => {
  it("?bike=1 is a summer ride on the bike, losing to an aircraft; a board is put away", () => {
    const card = { byLift: true, spec: LYNX };
    const bike = overLink(card, readParams("?start=free&bike=1"));
    expect(bike.bike).toBe(true);
    expect(bike.summer).toBe(true);
    expect(bike.byLift).toBe(false);
    expect(bike.spec).toBe(SKIS);
    // A summer link naming nothing rides the bike too.
    expect(overLink({}, readParams("?start=free&summer=1")).bike).toBe(true);
    const heli = overLink(card, readParams("?start=free&bike=1&heli=1"));
    expect(heli.heli).toBe(true);
    expect(heli.bike).toBe(false);
    // Winter has no bike.
    expect(overLink({}, readParams("?start=free")).bike).toBeFalsy();
  });
});
