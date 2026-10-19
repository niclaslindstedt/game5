// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAIL FOLLOWS THE SKIS AS DRAWN (`pwa/src/game/trail-skis.ts`): a
// skater's skis opened into the V leave diagonal strokes, a ski lifted for
// the recovery leaves none, and a board's footprint is the engine's own.

import { describe, expect, it } from "vitest";

import {
  createGame,
  pairById,
  placeRun,
  SKIS,
  step,
  type GameState,
  type SkierState,
  type SkiSpec,
} from "@engine";

import { gaitOf } from "../pwa/src/game/skier-gait.ts";
import { drawnContacts, LIFT_OFF } from "../pwa/src/game/trail-skis.ts";
import { flatLevel } from "./support/synthetic.ts";

const FLAT = flatLevel({ packed: 1 });

function stage(spec: SkiSpec = SKIS, speed = 4): GameState {
  const state = createGame({ level: FLAT, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: FLAT.size / 2, z: 400, heading: 0, speed });
  return state;
}

/** Each drawn ski's line off the heading, rad, clockwise positive. */
function skiYaw(skier: SkierState, side: number): number {
  const feet = drawnContacts(skier).filter((c) => c.side === side);
  const tip = feet.find((c) => c.station === "tip")!;
  const tail = feet.find((c) => c.station === "tail")!;
  const yaw = Math.atan2(tip.x - tail.x, tip.z - tail.z) - skier.heading;
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

describe("the skis' footprint as drawn", () => {
  it("lays each ski of a skater's V along its own arm", () => {
    const state = stage();
    let seen = 0;
    for (let i = 0; i < 1200; i++) {
      step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
      const k = state.skier;
      const gait = gaitOf(k);
      if (gait.skate < 0.5) continue;
      seen++;
      for (const [n, side] of [
        [0, -1],
        [1, 1],
      ] as const) {
        expect(skiYaw(k, side)).toBeCloseTo(k.skiAngle + gait.splay[n], 2);
      }
      // The V opens: the left ski anticlockwise, the right clockwise.
      expect(skiYaw(k, -1)).toBeLessThan(skiYaw(k, 1));
    }
    expect(seen).toBeGreaterThan(100);
  });

  it("lifts the pen of a ski swung clear for the recovery", () => {
    const state = stage();
    let lifted = 0;
    for (let i = 0; i < 1200; i++) {
      step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
      const k = state.skier;
      const gait = gaitOf(k);
      const feet = drawnContacts(k);
      for (let n = 0; n < 2; n++) {
        const side = n === 0 ? -1 : 1;
        const up = gait.lift[n] > LIFT_OFF;
        for (const c of feet.filter((f) => f.side === side)) {
          const engine = k.contacts.find((e) => e.side === side && e.station === c.station)!;
          expect(c.touching).toBe(engine.touching && !up);
        }
        if (up) lifted++;
      }
    }
    expect(lifted).toBeGreaterThan(20);
  });

  it("stands a straight-running pair where the engine's stations are", () => {
    const state = stage(SKIS, 15);
    step(state, { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false });
    const k = state.skier;
    expect(gaitOf(k).skate).toBe(0);
    const feet = drawnContacts(k);
    k.contacts.forEach((c, i) => {
      expect(Math.hypot(feet[i].x - c.x, feet[i].z - c.z)).toBeLessThan(1e-6 + 0.02);
    });
  });

  it("leaves a board's footprint as the engine's own", () => {
    const state = stage(pairById("lynx"));
    step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
    expect(drawnContacts(state.skier)).toBe(state.skier.contacts);
  });

  it("never writes the engine's contacts", () => {
    const state = stage();
    for (let i = 0; i < 300; i++)
      step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
    const before = JSON.stringify(state.skier.contacts);
    drawnContacts(state.skier);
    expect(JSON.stringify(state.skier.contacts)).toBe(before);
  });
});
