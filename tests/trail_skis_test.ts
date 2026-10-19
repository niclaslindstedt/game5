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
import { createKeep, DRIFT_MOST, drawnContacts, LIFT_OFF } from "../pwa/src/game/trail-skis.ts";
import { flatLevel } from "./support/synthetic.ts";

const FLAT = flatLevel({ packed: 1 });
/** Powder, where a skater holds a steady pace and his V a steady angle. */
const POWDER = flatLevel({ packed: 0 });

function stage(spec: SkiSpec = SKIS, speed = 4, level = FLAT): GameState {
  const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: level.size / 2, z: 400, heading: 0, speed });
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
        if (gait.lift[n] <= LIFT_OFF) continue;
        lifted++;
        const side = n === 0 ? -1 : 1;
        for (const c of feet.filter((f) => f.side === side)) expect(c.touching).toBe(false);
      }
    }
    expect(lifted).toBeGreaterThan(20);
  });

  it("cuts each skating stroke straight along its ski, never far from the ski drawn", () => {
    const state = stage(SKIS, 3.5, POWDER);
    const keep = createKeep();
    // Each stroke's binding positions, a stroke a list, by ski.
    const strokes: { side: number; yaw: number; points: [number, number][] }[] = [];
    const open: ((typeof strokes)[number] | null)[] = [null, null];
    for (let i = 0; i < 120 * 8; i++) {
      step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
      const k = state.skier;
      const pen = drawnContacts(k, keep, []);
      const drawn = drawnContacts(k, undefined, []);
      for (let n = 0; n < 2; n++) {
        const side = n === 0 ? -1 : 1;
        const mid = pen.findIndex((c) => c.side === side && c.station === "mid");
        if (!pen[mid].touching) {
          open[n] = null;
          continue;
        }
        expect(
          Math.hypot(pen[mid].x - drawn[mid].x, pen[mid].z - drawn[mid].z),
        ).toBeLessThanOrEqual(DRIFT_MOST + 1e-9);
        if (!open[n]) {
          open[n] = { side, yaw: skiYaw(k, side) + k.heading, points: [] };
          strokes.push(open[n]!);
        }
        open[n]!.points.push([pen[mid].x, pen[mid].z]);
      }
    }
    // Past the first strides, while the skate comes in.
    const long = strokes.slice(2).filter((s) => s.points.length > 60);
    expect(long.length).toBeGreaterThan(4);
    for (const s of long) {
      // Every point on the chord from its first to its last: straight.
      const [x0, z0] = s.points[0];
      const [x1, z1] = s.points[s.points.length - 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      expect(len).toBeGreaterThan(1);
      for (const [x, z] of s.points) {
        expect(Math.abs((x - x0) * (z1 - z0) - (z - z0) * (x1 - x0)) / len).toBeLessThan(0.03);
      }
      // ...and that chord angled off his way as the ski is.
      expect(Math.abs(Math.atan2(x1 - x0, z1 - z0) - s.yaw)).toBeLessThan(0.08);
    }
    // The strokes alternate, each angled off the way he goes.
    expect(new Set(long.map((s) => s.side)).size).toBe(2);
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
