// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIDESTEP (`sidestep.ts`): stood still across a slope too steep to
// walk, the steer held toward the hill steps the skier up it a ski at a
// time, each ski set down on a ledge of its own; on his platforms he is
// held however steep it is, and past `none` there is no platform to cut.
// Staged on the drag strip tilted into a face, his legs settled as a
// skier's are who has stopped there; and as the figure draws it
// (`skier-gait.ts`'s `sidestepGait`).

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  createGame,
  placeRun,
  sideSteps,
  sidestepPace,
  sidestepReach,
  step,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";
import { sidestepGait } from "../pwa/src/game/skier-gait.ts";

const DEG = Math.PI / 180;
const HZ = TUNING.physicsHz;
const D = TUNING.sidestep;

/** A face of `deg`° falling along +z, the skier across it facing +x with
 * the hill on his right, his way held for a second while his legs settle. */
function stage(deg: number, packed = 1): GameState {
  const level = flatLevel({ packed, grade: Math.tan(deg * DEG), slopeFrom: 200, size: 3000 });
  const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 800, heading: Math.PI / 2 });
  const c = state.skier;
  for (let i = 0; i < HZ; i++) {
    c.vx = c.vy = c.vz = 0;
    step(state, NEUTRAL_INPUT);
  }
  return state;
}

function ride(state: GameState, seconds: number, input: Partial<SkierInput>): void {
  for (let i = 0; i < seconds * HZ; i++) step(state, { ...NEUTRAL_INPUT, ...input });
}

describe("the sidestep (sidestep.ts)", () => {
  it("climbs a 25° slope a pair of steps at a time, the hill on his right", () => {
    const state = stage(25);
    const c = state.skier;
    expect(c.sidestep).toBe(1);
    const y0 = c.y;
    ride(state, 6, { steer: 1 });
    const pace = sidestepPace(25 * DEG, 1);
    // Six seconds of pairs, each `step` m up the snow.
    const rise = 6 * pace.rate * pace.step * Math.sin(25 * DEG);
    expect(c.y - y0).toBeGreaterThan(0.8 * rise);
    expect(c.speed).toBeLessThan(0.2);
    expect(c.sidestep).toBe(1);
  });

  it("holds him on his platforms on a 45° face, and climbs it more slowly", () => {
    const state = stage(45);
    const c = state.skier;
    expect(c.sidestep).toBe(1);
    const y0 = c.y;
    ride(state, 4, {});
    expect(Math.abs(c.y - y0)).toBeLessThan(0.05);
    ride(state, 6, { steer: 1 });
    expect(c.y - y0).toBeGreaterThan(0.3);
    expect(c.sidestep).toBe(1);
  });

  it("cuts no platform past `none`: on 52° he is not sidestepping", () => {
    const state = stage(52);
    expect(state.skier.sidestep).toBe(0);
  });

  it("steps round to face down the hill when asked away from it", () => {
    const state = stage(25);
    const c = state.skier;
    const h0 = c.heading;
    ride(state, 1.5, { steer: -1 });
    expect(c.sidestep).toBe(0);
    expect(Math.abs(c.heading - h0)).toBeGreaterThan(0.1);
  });

  it("lays each ski where it stands: one ski in the air at a time, the other on its ledge", () => {
    const state = stage(25);
    const c = state.skier;
    let lifted = 0;
    let both = 0;
    for (let i = 0; i < 3 * HZ; i++) {
      step(state, { ...NEUTRAL_INPUT, steer: 1 });
      const skis = c.contacts.filter((k) => k.kind === "ski");
      const off = new Set(skis.filter((k) => !k.touching).map((k) => k.side));
      if (off.size === 1) lifted++;
      if (off.size === 2) both++;
    }
    expect(lifted).toBeGreaterThan(HZ / 2);
    expect(both).toBe(0);
  });

  it("shortens and slows each step past `steep`, to nothing by `none`", () => {
    expect(sidestepReach(30 * DEG)).toBe(1);
    expect(sidestepReach(D.most)).toBeCloseTo(D.least, 6);
    expect(sidestepReach(D.none)).toBe(0);
    let was = 2;
    for (let deg = 30; deg <= 50; deg++) {
      const r = sidestepReach(deg * DEG);
      expect(r).toBeLessThanOrEqual(was);
      was = r;
    }
    expect(sidestepPace(30 * DEG, 0).step).toBeLessThan(sidestepPace(30 * DEG, 1).step);
  });

  it("moves each ski up whole in its own half of the pair", () => {
    expect(sideSteps(0)).toEqual({ uphill: 0, downhill: 0, body: 0 });
    expect(sideSteps(1)).toEqual({ uphill: 1, downhill: 1, body: 1 });
    const mid = sideSteps(0.5);
    expect(mid.uphill).toBe(1);
    expect(mid.downhill).toBe(0);
  });

  it("is drawn without a jump: the gait moves a little each frame and ends where it began", () => {
    const n = 240;
    let prev = sidestepGait(0, 1, 0.3);
    for (let k = 1; k <= n; k++) {
      const g = sidestepGait(k / n, 1, 0.3);
      for (const i of [0, 1]) {
        expect(Math.abs(g.out[i] - prev.out[i])).toBeLessThan(0.01);
        expect(Math.abs(g.lift[i] - prev.lift[i])).toBeLessThan(0.02);
      }
      prev = g;
    }
    expect(prev.out[0]).toBeCloseTo(0, 6);
    expect(prev.out[1]).toBeCloseTo(0, 6);
  });
});
