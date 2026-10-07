// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE (R39): the section built to the rules (the walls, the vert,
// the transitions, the flat), the pipe cut into a built map in a copy of
// its ground, the physics of riding up a wall and back down it on the
// synthetic pipe (`pipeLevel`), the hit's air turned round to land on the
// wall it left, the judging (the alley-oop, the fall), the contest's format
// and the bot down it.

import { describe, expect, it } from "vitest";

import {
  HALFPIPE,
  HALFPIPE_RULE,
  MODE_RULES,
  NEUTRAL_INPUT,
  PIPE_FIELD,
  bestPipeRun,
  botInput,
  createGame,
  freshHalfpipe,
  isAlleyOop,
  pipeBoard,
  pipeCoords,
  pipeContestAfter,
  pipePhase,
  pipeRivalRun,
  pipeSection,
  placeRun,
  raceRiderOf,
  raceSkisOf,
  runImpression,
  setHalfpipe,
  simulateRun,
  skisById,
  step,
  wallAt,
  type FlightRecord,
  type GameState,
  type HitRead,
  type PipeContest,
} from "@engine";
import { levelFor } from "./support/levels.ts";
import { PIPE, pipeLevel } from "./support/synthetic.ts";

const R = HALFPIPE_RULE;
const RAD = Math.PI / 180;

describe("the halfpipe's section (R39)", () => {
  const s = pipeSection();

  it("is a 22-foot pipe: 6.7 m walls about 20 m apart, the vert at 83°", () => {
    expect(s.height).toBeCloseTo(6.7, 5);
    expect(2 * s.half).toBeCloseTo(R.span, 5);
    expect(wallAt(s, s.half).h).toBeCloseTo(s.height, 3);
    // The vert's top 0.2 m stands at the vert's angle.
    const slope = Math.atan(wallAt(s, s.half - 0.005).dh) / RAD;
    expect(slope).toBeGreaterThan(R.vert - 1);
    expect(slope).toBeLessThan(R.vert + 0.5);
  });

  it("rises smoothly from a flat between the transitions", () => {
    expect(2 * s.flat).toBeGreaterThan(5);
    expect(s.radius).toBeGreaterThan(5);
    expect(s.radius).toBeLessThan(9);
    let last = -1;
    let lastSlope = -1;
    for (let a = 0; a <= s.half; a += 0.05) {
      const w = wallAt(s, a);
      expect(w.h).toBeGreaterThanOrEqual(last - 1e-9);
      expect(w.dh).toBeGreaterThanOrEqual(lastSlope - 1e-6);
      last = w.h;
      lastSlope = w.dh;
    }
    expect(wallAt(s, 0).h).toBe(0);
    expect(wallAt(s, s.half + 1).h).toBeCloseTo(s.height, 6);
  });
});

describe("the pipe cut into a built map (R39)", () => {
  for (const seed of [1, 38]) {
    it(`seed ${seed}: a start gate above the mouth, the walls, the finish below`, () => {
      const level = setHalfpipe(levelFor(seed));
      const course = level.halfpipe!;
      const p = level.pipe!;
      expect(course).toBeDefined();
      expect(p).toBeDefined();
      expect(level.checkpoints.length).toBe(2);
      expect(course.vertical).toBeGreaterThan(40);
      // The walls stand full between from and to: the coping 6.7 m over the
      // flat, both sides, every 10 m — and the surface the engine reads is
      // the section, not the grid.
      const s = p.section;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const n = { x: 0, y: 0, z: 0 };
      for (let d = p.from + 5; d < p.to - 5; d += 10) {
        const at = (across: number) => ({
          x: p.x + d * fx + across * fz,
          z: p.z + d * fz - across * fx,
        });
        const mid = at(0);
        const floor = level.groundAt(mid.x, mid.z);
        for (const side of [-1, 1]) {
          const lip = at(side * (s.half - 0.01));
          expect(level.groundAt(lip.x, lip.z) - floor).toBeGreaterThan(6.4);
          // On the vert the normal lies near flat, pointing in.
          level.normalNear!(lip.x, floor + 6.5, lip.z, n);
          expect(Math.abs(n.y)).toBeLessThan(0.3);
          expect(Math.sign(pipeCoords(p, lip.x + n.x, lip.z + n.z).across)).toBe(side);
          expect(Math.abs(pipeCoords(p, lip.x + n.x, lip.z + n.z).across)).toBeLessThan(s.half);
        }
        // Nothing grows in it.
        expect(level.trees.every((t) => Math.hypot(t.x - mid.x, t.z - mid.z) > 15)).toBe(true);
      }
      // The grid under it is cut BELOW the section, for the renderer.
      const g = level.ground;
      const at0 = { x: p.x + (p.from + 40) * fx, z: p.z + (p.from + 40) * fz };
      const col = Math.round((at0.x - g.originX) / g.cell);
      const row = Math.round((at0.z - g.originZ) / g.cell);
      const node = { x: g.originX + col * g.cell, z: g.originZ + row * g.cell };
      expect(g.data[row * g.cols + col]).toBeLessThan(level.groundAt(node.x, node.z));
      // The map it was built over is untouched.
      expect(course.base).toBe(levelFor(seed));
      expect(course.base.pipe).toBeUndefined();
    });
  }

  it("is deterministic and cached: the same map, the same pipe", () => {
    const a = setHalfpipe(levelFor(1));
    const b = setHalfpipe(levelFor(1));
    expect(a).toBe(b);
  });
});

describe("the mode's rules", () => {
  it("is a strict, tricked course on the Raven at the medium build", () => {
    const r = MODE_RULES.halfpipe(1);
    expect(r.course).toBe(true);
    expect(r.gates).toBe("strict");
    expect(r.stunts).toBe(true);
    expect(r.spinMost).toBeGreaterThanOrEqual(8 * Math.PI);
    expect(raceSkisOf("halfpipe")).toBe("raven");
    expect(raceRiderOf("halfpipe")).toBe("medium");
  });
});

/** The synthetic pipe ridden from the flat at `speed` and `head` off the
 * pipe's line, for `seconds`, with `input` at each moment. */
function ride(
  speed: number,
  head: number,
  seconds: number,
  input: (s: GameState, t: number) => Partial<typeof NEUTRAL_INPUT> = () => ({}),
): GameState {
  const level = pipeLevel();
  const state = createGame({
    level,
    mode: "tricks",
    countdown: 0,
    quiet: true,
    spec: skisById("raven"),
  });
  placeRun(state, { x: PIPE.x, z: 120, heading: head * RAD, speed });
  for (let i = 0; i < seconds * 120; i++) {
    step(state, { ...NEUTRAL_INPUT, ...input(state, i / 120) });
  }
  return state;
}

describe("riding a wall (the synthetic pipe)", () => {
  it("one hit: up the right wall, out over the coping, back down onto the same wall", () => {
    const state = ride(17, 65, 4);
    const hits = state.tricks.flights.filter((f) => f.pipe);
    expect(hits.length).toBe(1);
    const h = hits[0];
    expect(h.pipe!.side).toBe(1);
    expect(h.pipe!.over).toBeGreaterThan(2);
    expect(h.pipe!.on).toBe("wall");
    expect(h.outcome).toBe("landed");
    expect(state.skier.thrown).toBeNull();
    // ...and he is back down and heading for the other wall.
    expect(pipeCoords(level(state), state.skier.x, state.skier.z).across).toBeLessThan(
      pipeSection().half,
    );
  });

  it("a 360 off the wall lands", () => {
    const state = ride(17, 65, 4, (s, t) => ({
      steer: s.skier.airborne && ((t > 1.1 && t < 1.18) || (t > 1.35 && t < 1.43)) ? -1 : 0,
    }));
    const h = state.tricks.flights.find((f) => f.pipe)!;
    expect(Math.abs(h.spin)).toBeGreaterThan(1.8 * Math.PI);
    expect(state.skier.thrown).toBeNull();
  });
});

function level(s: GameState) {
  return s.level.pipe!;
}

/** A hit as the judges read it, for the impression's arithmetic. */
function hit(over: number, spin: number, outcome: FlightRecord["outcome"] = "landed"): HitRead {
  return {
    read: {
      spin,
      flips: 0,
      offAxis: false,
      dir: spin > 0 ? "right" : null,
      flipDir: null,
      switchIn: false,
      grabs: [],
    } as unknown as HitRead["read"],
    alleyOop: false,
    over,
    on: "wall",
    side: 1,
    outcome,
    difficulty: spin / 180,
  };
}

describe("the judges", () => {
  it("call an uphill spin off a wall an alley-oop", () => {
    const f = { spin: 2 * Math.PI, pipe: { side: 1 } } as unknown as FlightRecord;
    expect(isAlleyOop(f)).toBe(true);
    expect(isAlleyOop({ ...f, spin: -2 * Math.PI })).toBe(false);
    expect(isAlleyOop({ ...f, spin: 0.2 })).toBe(false);
    expect(isAlleyOop({ spin: 2 * Math.PI } as unknown as FlightRecord)).toBe(false);
  });

  it("score bigger, higher runs higher, and a fall low", () => {
    const small = runImpression(
      [1, 2, 3, 4, 5, 6].map(() => hit(2, 180)),
      false,
    ).impression;
    const big = runImpression(
      [1, 2, 3, 4, 5, 6].map(() => hit(4.5, 720)),
      false,
    ).impression;
    expect(big).toBeGreaterThan(small);
    const fell = runImpression(
      [1, 2, 3].map(() => hit(4.5, 720)),
      true,
    ).impression;
    expect(fell).toBeLessThanOrEqual(30);
  });
});

describe("the contest", () => {
  it("is two qualification runs, the best twelve to a final of three", () => {
    let c: PipeContest = freshHalfpipe(7);
    expect(pipePhase(c)).toBe("qualification");
    c = {
      ...c,
      qualification: [
        { score: 80, fell: false },
        { score: 60, fell: false },
      ],
    };
    expect(pipePhase(c)).toBe(null);
    expect(HALFPIPE.qualification).toBe(2);
    expect(HALFPIPE.final).toBe(3);
    expect(HALFPIPE.finalists).toBe(12);
    expect(bestPipeRun(c.qualification)).toBe(80);
    expect(pipeBoard(c, "qualification", 2).length).toBe(HALFPIPE.field + 1);
  });

  it("deals the field off its own stream, the same every time", () => {
    const a = pipeRivalRun(7, 3, "final", 1);
    expect(pipeRivalRun(7, 3, "final", 1)).toEqual(a);
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThan(PIPE_FIELD.floor + PIPE_FIELD.span + PIPE_FIELD.wobble + 1);
  });
});

describe("the bot in the pipe", () => {
  it("rides a whole run wall to wall and is judged", () => {
    const state = createGame({ seed: 1, mode: "halfpipe", quiet: true, spec: skisById("raven") });
    for (let i = 0; i < 120 * 90 && !state.progress.finished && !state.progress.out; i++) {
      step(state, botInput(state));
    }
    expect(state.progress.finished).toBe(true);
    const hits = state.tricks.flights.filter((f) => f.pipe);
    expect(hits.length).toBeGreaterThanOrEqual(5);
    const sides = new Set(hits.map((f) => f.pipe!.side));
    expect(sides.size).toBe(2);
    const after = pipeContestAfter(state)!;
    expect(after.qualification.length).toBe(1);
    expect(after.qualification[0].score).toBeGreaterThan(20);
  });

  it("finishes in the simulator", () => {
    const r = simulateRun(1, { mode: "halfpipe", spec: skisById("raven") });
    expect(r.finished).toBe(true);
  });
});
