// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S COCKPIT (`sled-cockpit-plan.ts`): the controls stand
// where a mountain machine's do, move as the engine's controls ask, and the
// display reads the machine.

import { describe, expect, it } from "vitest";
import { SLED } from "@engine";

import {
  COCKPIT,
  cockpitPose,
  freshGauge,
  gaugeOf,
  GAUGE,
  LEFT,
  RIGHT,
  TRAVEL,
} from "../pwa/src/game/sled-cockpit-plan.ts";
import { SLED_RIGS } from "../pwa/src/game/camera-sled.ts";

const controls = (
  o: Partial<{ throttle: number; brake: number; steer: number; lean: number }>,
) => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  lean: 0,
  ...o,
});

describe("the cockpit's layout", () => {
  it("puts the bar's ends on the engine's grips", () => {
    const end = COCKPIT.bar[COCKPIT.bar.length - 1];
    const start = COCKPIT.bar[0];
    expect(end.x).toBeCloseTo(SLED.grips.x, 2);
    expect(start.x).toBeCloseTo(-SLED.grips.x, 2);
    expect(end.y).toBeCloseTo(SLED.grips.y, 2);
    expect(Math.abs(end.z - SLED.grips.z)).toBeLessThan(0.03);
  });

  it("puts the throttle and the tether on the rider's right, the picture's right", () => {
    // Looking down +z in a right-handed frame, the picture's right is −x.
    expect(RIGHT).toBe(-1);
    expect(LEFT).toBe(1);
    expect(Math.sign(COCKPIT.tether.x)).toBe(RIGHT);
  });

  it("stands the grips outboard of the housings, and the bars over the post", () => {
    expect(COCKPIT.housing).toBeLessThan(COCKPIT.grip.from);
    expect(COCKPIT.grip.from).toBeLessThan(COCKPIT.grip.to);
    expect(COCKPIT.riser.y).toBeGreaterThan(COCKPIT.post.y);
  });

  it("frames the cockpit from behind and over the bars, looking down at them", () => {
    const eye = SLED_RIGS.helmet.kind === "bolted" ? SLED_RIGS.helmet.eye : null;
    expect(eye).not.toBeNull();
    expect(eye!.z).toBeLessThan(COCKPIT.bar[0].z);
    expect(eye!.y).toBeGreaterThan(COCKPIT.display.at.y + 0.4);
  });
});

describe("the controls' travel", () => {
  it("turns the bars by the model's linkage, and moves the levers with the engine's controls", () => {
    const rest = cockpitPose({ skiAngle: 0, controls: controls({}) });
    expect(rest).toEqual({ bars: 0, throttle: 0, brake: 0 });
    const full = cockpitPose({ skiAngle: 0.4, controls: controls({ throttle: 1, brake: 1 }) });
    expect(full.bars).toBeCloseTo(0.4 * TRAVEL.bars);
    expect(full.throttle).toBeCloseTo(TRAVEL.throttle);
    expect(full.brake).toBeCloseTo(TRAVEL.brake);
    const over = cockpitPose({ skiAngle: 0, controls: controls({ throttle: 3, brake: -1 }) });
    expect(over.throttle).toBeCloseTo(TRAVEL.throttle);
    expect(over.brake).toBe(0);
  });
});

describe("the display", () => {
  const machine = (speed: number, rpm: number, throttle: number, running = true) => ({
    speed,
    rpm,
    running,
    controls: controls({ throttle }),
  });

  it("reads the speed in km/h, the engine to fifty rpm, the altitude to ten metres and the clock", () => {
    const r = gaugeOf(machine(20, 6420, 1), freshGauge(), 0, 1534, 14.5);
    expect(r.speed).toBe(72);
    expect(r.rpm).toBe(6400);
    expect(r.rpmShare).toBeCloseTo(6420 / SLED.maxRpm);
    expect(r.altitude).toBe(1530);
    expect(r.clock).toBe("14:30");
    expect(r.redShare).toBeLessThan(1);
    expect(gaugeOf(machine(0, 0, 0), freshGauge(), 0, null, 0).altitude).toBeNull();
  });

  it("burns fuel flat out faster than at idle, and warms the coolant to its running heat", () => {
    const idle = freshGauge();
    const pull = freshGauge();
    for (let i = 0; i < 600; i++) {
      gaugeOf(machine(0, SLED.idleRpm, 0), idle, 1, null, 12);
      gaugeOf(machine(30, 8000, 1), pull, 1, null, 12);
    }
    expect(pull.fuel).toBeLessThan(idle.fuel);
    expect(idle.fuel).toBeLessThan(GAUGE.startFuel);
    expect(idle.coolant).toBeGreaterThan(GAUGE.warm - 5);
    expect(pull.coolant).toBeGreaterThan(idle.coolant);
  });

  it("keeps a stopped engine cold and full", () => {
    const mem = freshGauge();
    gaugeOf(machine(0, 0, 0, false), mem, 60, null, 9);
    expect(mem.fuel).toBe(GAUGE.startFuel);
    expect(mem.coolant).toBeCloseTo(GAUGE.coldStart);
  });
});
