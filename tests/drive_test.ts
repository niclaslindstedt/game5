// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER DOES FOR HIMSELF — the drive he works up at a crawl
// (`poles.ts`: skating, then double-poling, power-limited and automatic),
// the jump he loads and springs (`TUNING.jump`), and the edge CUT HARDER
// (`TUNING.carve`) — each staged on the synthetic strips with `placeRun`.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  createGame,
  angleDiff,
  driveForce,
  glideYaw,
  placeRun,
  skateAngle,
  skateShare,
  skateWork,
  step,
  strideShape,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
const PITCH = flatLevel({ packed: 1, grade: Math.tan(Math.PI / 9), slopeFrom: 200, size: 4000 });

function stage(level: ReturnType<typeof flatLevel>, kmh: number, z = 400): GameState {
  const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: level.size / 2, z, heading: 0, speed: kmh / 3.6 });
  return state;
}

function ride(state: GameState, seconds: number, input: Partial<SkierInput> = {}): void {
  const held = { ...NEUTRAL_INPUT, ...input };
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, held);
}

describe("the drive (poles.ts)", () => {
  it("is power-limited: strong off a standstill, less every metre a second after", () => {
    const slow = driveForce(SKIS, 1, 1, 1);
    const mid = driveForce(SKIS, 4, 1, 1);
    expect(slow).toBeGreaterThan(mid);
    expect(mid).toBeCloseTo(TUNING.poles.power / 4, 5);
    expect(driveForce(SKIS, TUNING.poles.fade, 1, 1)).toBe(0);
    // Powder takes the push off the baskets and the skating ski.
    expect(driveForce(SKIS, 2, 0, 1)).toBeLessThan(driveForce(SKIS, 2, 1, 1));
  });

  it("skates at a crawl and double-poles once rolling", () => {
    expect(skateShare(1)).toBe(1);
    expect(skateShare(TUNING.poles.skateTo + 1)).toBe(0);
  });

  it("shapes a stride whose mean is the whole push", () => {
    let sum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) sum += strideShape(i / n);
    expect(sum / n).toBeCloseTo(1, 2);
  });

  it("carries a skier with his hands off up to a skater's pace across the flat", () => {
    const state = stage(PACKED, 4);
    ride(state, 10);
    const kmh = state.skier.speed * 3.6;
    expect(kmh).toBeGreaterThan(18);
    expect(kmh).toBeLessThan(32);
    expect(state.skier.drive).toBeGreaterThan(0.9);
    expect(state.skier.stride).toBeGreaterThan(5);
  });

  it("leaves a skier standing still with his hands off standing", () => {
    const state = stage(PACKED, 0);
    ride(state, 3);
    expect(state.skier.speed).toBeLessThan(0.05);
  });

  it("stops working while the brake is on", () => {
    const state = stage(PACKED, 4);
    ride(state, 2, { brake: 1 });
    expect(state.skier.drive).toBeLessThan(0.05);
  });
});

describe("the skate goes where the ski points (poles.ts' glideYaw)", () => {
  it("glides each stride on the gliding ski's arm of the V, the right ski's while the left pushes", () => {
    const vee = skateAngle(3);
    // Past the push, the whole of the arm: right (clockwise) on a left push.
    expect(glideYaw(0.8, 3, 1)).toBeCloseTo(vee, 6);
    expect(glideYaw(1.8, 3, 1)).toBeCloseTo(-vee, 6);
    // Carried across over the push, never jumping at a stride's turn.
    expect(glideYaw(0.999999, 3, 1)).toBeCloseTo(glideYaw(1, 3, 1), 4);
    // Not skating, straight on.
    expect(glideYaw(0.8, 3, 0)).toBe(0);
    expect(skateWork(0.3, 3)).toBe(0);
    // The V closes as he rolls.
    expect(skateAngle(TUNING.poles.skateTo)).toBeLessThan(skateAngle(2));
  });

  it("takes him diagonally along the gliding ski — a zig-zag, not straight up the V", () => {
    const state = stage(PACKED, 4);
    ride(state, 0.6);
    const c = state.skier;
    let worst = 0;
    let left = 0;
    let right = 0;
    let n = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      const p = c.stride - Math.floor(c.stride);
      const way = angleDiff(c.heading, Math.atan2(c.vx, c.vz));
      if (way < -0.1) left += 1;
      if (way > 0.1) right += 1;
      // Gliding (past the push) he goes the way the ski he stands on points.
      if (p > TUNING.poles.duty && skateWork(c.drive, c.speed) > 0.5) {
        worst = Math.max(worst, Math.abs(angleDiff(way, c.glide)));
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(60);
    expect(worst).toBeLessThan(0.05);
    // Both arms of the V are skied, a good part of the time each.
    expect(left).toBeGreaterThan(60);
    expect(right).toBeGreaterThan(60);
  });
});

describe("the jump (TUNING.jump)", () => {
  /** Load it for `held` s at 50 km/h on the flat, let go, and read the pop
   * and the highest the skier's CoG rose over where it stood. */
  function jump(held: number): { pop: number; peak: number } {
    const state = stage(PACKED, 50);
    ride(state, 0.5);
    const y0 = state.skier.y;
    ride(state, held, { jump: true });
    let pop = 0;
    let peak = 0;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      for (const e of state.events) if (e.kind === "jump") pop = e.pop;
      peak = Math.max(peak, state.skier.y - y0);
    }
    return { pop, peak };
  }

  it("springs higher the longer it was loaded", () => {
    const tap = jump(0.05);
    const half = jump(1);
    const full = jump(2);
    expect(tap.pop).toBeGreaterThan(0);
    expect(half.pop).toBeGreaterThan(tap.pop);
    expect(full.pop).toBeGreaterThan(half.pop);
    expect(full.peak).toBeGreaterThan(half.peak);
    expect(full.peak).toBeGreaterThan(0.6);
  });

  it("is no higher for being held past two seconds", () => {
    expect(jump(3).pop).toBeCloseTo(jump(TUNING.jump.full).pop, 5);
  });

  it("sinks him onto his legs while it loads", () => {
    const state = stage(PACKED, 30);
    ride(state, 1, { jump: true });
    expect(state.skier.crouch).toBeGreaterThan(0.4);
    expect(state.skier.jumpLoad).toBeGreaterThan(0.9);
  });
});

describe("the edge cut harder (TUNING.carve)", () => {
  /** The mean yaw rate over a second at full edge at 80 km/h down the pitch,
   * and the speed kept. */
  function cut(carve: boolean): { wy: number; kmh: number } {
    const state = stage(PITCH, 80, 600);
    ride(state, 0.3, { tuck: 1 });
    let wy = 0;
    const n = TUNING.physicsHz;
    for (let i = 0; i < n; i++) {
      step(state, { ...NEUTRAL_INPUT, steer: 1, tuck: 1, carve });
      wy += Math.abs(state.skier.wy) / n;
    }
    return { wy, kmh: state.skier.speed * 3.6 };
  }

  it("turns tighter than the same edge not pressed, and costs little of the way", () => {
    const plain = cut(false);
    const hard = cut(true);
    expect(hard.wy).toBeGreaterThan(plain.wy * 1.15);
    expect(hard.kmh).toBeGreaterThan(plain.kmh - 8);
  });
});
