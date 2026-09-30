// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A SKIER TURNS, and what the thumb does to it (`skier.ts`, the arcade's
// hands in `TUNING.arcade` and `TUNING.steer`). An all-mountain ski stood
// full on its edge on the groomer holds about a g — the yaw hand asks for
// `pathShare` of the corner grip and no more, so a bend is firm without
// being a flick — and turns in within a couple of tenths; a bend carved
// flat out pays for itself in the way (the scrub); a lean forward loads the
// tips and tightens the arc, a lean back lets it run; and past what the
// edge holds the ski skids rather than snapping round.

import { describe, expect, it } from "vitest";
import { SKIS, TUNING, createGame, placeRun, step, type GameState } from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
/** A gentle groomed pitch that about holds a carving skier's speed. */
const PITCH = flatLevel({ packed: 1, grade: 0.2, slopeFrom: 300, size: 4000 });

function bend(level: ReturnType<typeof flatLevel>, kmh: number): GameState {
  const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: level.size / 2, z: 400, heading: 0, speed: kmh / 3.6 });
  return state;
}

function settle(state: GameState, steer: number, seconds: number, lean = 0) {
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, { steer, tuck: 0, brake: 0, lean, reset: false });
  }
}

describe("the bend", () => {
  it("holds about a g on the groomer at full edge, and turns in quickly", () => {
    const state = bend(PITCH, 60);
    settle(state, 0, 0.5);
    let t90 = -1;
    // The lateral g over the second after the turn-in, at the speed he
    // came in with: a full edge held standing scrubs speed off, and the
    // radius goes as the speed squared.
    let gSum = 0;
    let gN = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, tuck: 0, brake: 0, lean: 0, reset: false });
      if (t90 < 0 && Math.abs(state.skier.wy) > 0.4) t90 = i * TUNING.dt;
      if (i >= 0.5 * TUNING.physicsHz && i < 1.5 * TUNING.physicsHz) {
        gSum += (state.skier.speed * Math.abs(state.skier.wy)) / TUNING.g;
        gN++;
      }
    }
    const g = gSum / gN;
    expect(g).toBeGreaterThan(0.6);
    expect(g).toBeLessThan(1.4);
    expect(t90).toBeGreaterThan(0);
    expect(t90).toBeLessThan(0.5);
  });

  it("pays for a bend carved flat out: full edge down the pitch no longer gains", () => {
    const run = (steer: number) => {
      const state = bend(PITCH, 60);
      for (let i = 0; i < 2.5 * TUNING.physicsHz; i++) {
        step(state, { steer, tuck: 1, brake: 0, lean: 0, reset: false });
      }
      return state.skier.speed * 3.6;
    };
    const straight = run(0);
    const bent = run(1);
    // The scrub: the same tuck through a full-edge bend is well down on the
    // straight, and about holds the speed it came in at.
    expect(straight - bent).toBeGreaterThan(8);
    expect(bent).toBeLessThan(60 * 1.15);
  });

  it("tightens the arc on a lean forward and lets it run on a lean back", () => {
    const forward = bend(PACKED, 40);
    const back = bend(PACKED, 40);
    settle(forward, 0.6, 1.5, -1);
    settle(back, 0.6, 1.5, 1);
    expect(Math.abs(forward.skier.heading)).toBeGreaterThan(Math.abs(back.skier.heading) * 1.1);
  });

  it("skids rather than snapping round past what the edge holds", () => {
    const state = bend(PACKED, 90);
    let worst = 0;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, tuck: 0, brake: 0, lean: 0, reset: false });
      const c = state.skier;
      if (Math.hypot(c.vx, c.vz) > 3) {
        const way = Math.atan2(c.vx, c.vz);
        let d = Math.abs(c.heading - way) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        worst = Math.max(worst, d);
      }
    }
    expect(worst).toBeLessThan(Math.PI / 3);
    expect(state.skier.thrown).toBeNull();
  });
});
