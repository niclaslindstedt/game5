// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER AT A CRAWL AND ON HIS EDGE (`board-moves.ts`) AND HIS FALLS
// (`board-crash.ts`), held on the synthetic maps: the ONE-FOOT SKATE (the
// rear foot out, a short power-limited push, the foot strapped back in once
// a push buys nothing), the STEP TURN about the front foot, NO SIDESTEP up a
// slope, the SIDESLIP down a steep face on the uphill edge and the FALLING
// LEAF across it, the DOWNHILL EDGE CAUGHT as a fall of its own each way
// (slammed onto his back off the heel edge, thrown onto his face off the
// toe edge), the BOARD KEPT ON through every fall, and the dig out of a bog
// with no poles. A pair of skis keeps every one of its own answers.

import { describe, expect, it } from "vitest";

import {
  LYNX,
  NEUTRAL_INPUT,
  RAGDOLL,
  SKIS,
  TUNING,
  createGame,
  freeFootOf,
  pairById,
  placeRun,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
  type SkiSpec,
} from "@engine";
import { LONE_TREE, flatLevel, syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;
const TUCK: Partial<SkierInput> = { tuck: 1 };
const K = TUNING.board;

/** The steep face: 31°, the fall line down +z. */
const FACE = flatLevel({ packed: 1, grade: 0.6, slopeFrom: 0, size: 4000 });
/** Stood across it facing up the hill (`toe`, the hill on his toe side) or
 * down it (the hill on his heel side). */
const across = (toe: boolean) => ({ x: 2000, z: 1000, heading: toe ? Math.PI / 2 : -Math.PI / 2 });
/** The steer away from the hill, of full, for a rider stood `across`. */
const away = (toe: boolean, share: number): Partial<SkierInput> => ({
  steer: (toe ? -1 : 1) * share,
});

function stage(
  spec: SkiSpec,
  level: Level,
  at: Parameters<typeof placeRun>[1],
  snowDepth?: number,
): GameState {
  const state = createGame({ level, spec, snowDepth, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, at);
  return state;
}

function ride(
  state: GameState,
  seconds: number,
  at: (t: number, s: GameState) => Partial<SkierInput>,
  each?: (t: number) => void,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * HZ); i++) {
    step(state, { ...NEUTRAL_INPUT, ...at(i / HZ, state) });
    events.push(...state.events);
    each?.(i / HZ);
  }
  return events;
}

const wipeoutOf = (events: GameEvent[]): string | null => {
  const w = events.find((e) => e.kind === "wipeout");
  return w && w.kind === "wipeout" ? w.cause : null;
};

/** How far apart a thrown body's feet lie. */
function feetApart(state: GameState): number {
  const P = state.skier.thrown!.points;
  const a = 3 * RAGDOLL.footL;
  const b = 3 * RAGDOLL.footR;
  return Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]);
}

describe("the one-foot skate", () => {
  it("names the rear foot as the free one, by the rider's stance, and none on skis", () => {
    expect(freeFootOf(LYNX)).toBe("right");
    expect(freeFootOf({ ...LYNX, board: { ...LYNX.board!, lead: "goofy" } })).toBe("left");
    expect(freeFootOf(SKIS)).toBeNull();
  });

  it("takes the rear foot out to push off a standstill, slower than a skier's skate, and straps it back in past a push's worth", () => {
    const level = flatLevel({ packed: 1, grade: 0.12, slopeFrom: 240 });
    const at = { x: 1500, z: 200, heading: 0 };
    const board = stage(LYNX, level, at);
    const skis = stage(SKIS, level, at);
    let out = -1;
    let strapped = -1;
    let topFlat = 0;
    ride(
      board,
      20,
      () => TUCK,
      (t) => {
        const c = board.skier;
        if (out < 0 && c.board!.free) out = t;
        if (out >= 0 && strapped < 0 && !c.board!.free) strapped = c.speed;
        if (c.z < 240) topFlat = Math.max(topFlat, c.speed);
      },
    );
    ride(skis, 5, () => TUCK);
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(0.5);
    // A push from one foot is good to about a running pace, no more.
    expect(topFlat * 3.6).toBeGreaterThan(8);
    expect(topFlat * 3.6).toBeLessThan(15);
    // Strapped back in once going `strap` (16 km/h), on the pitch.
    expect(strapped).toBeGreaterThanOrEqual(K.skate.strap);
    expect(board.skier.board!.free).toBe(false);
    expect(board.skier.stride).toBeGreaterThan(5);
    // A skier's two-legged skate gets further in five seconds.
    const b5 = stage(LYNX, level, at);
    ride(b5, 5, () => TUCK);
    expect(skis.skier.speed).toBeGreaterThan(b5.skier.speed);
  });

  it("hops the board along with both feet in, in loose snow", () => {
    const state = stage(LYNX, flatLevel({ packed: 0 }), { x: 1500, z: 300, heading: 0 });
    let free = false;
    ride(
      state,
      1,
      () => TUCK,
      () => {
        free ||= state.skier.board!.free;
      },
    );
    expect(free).toBe(false);
    expect(state.skier.board!.hop).toBe(1);
  });

  it("steps round on the spot about the strapped front foot", () => {
    const state = stage(LYNX, flatLevel({ packed: 1 }), { x: 1500, z: 200, heading: 0 });
    const c = state.skier;
    const half = LYNX.board!.stance / 2;
    const front = () => [c.x + half * Math.sin(c.heading), c.z + half * Math.cos(c.heading)];
    const [ax, az] = front();
    const h0 = c.heading;
    ride(state, 4, () => ({ steer: 1 }));
    const [bx, bz] = front();
    expect(c.heading - h0).toBeGreaterThan(Math.PI / 2);
    expect(Math.hypot(bx - ax, bz - az)).toBeLessThan(0.05);
  });
});

describe("across the fall line", () => {
  it("never sidesteps up a slope on a board, where a pair of skis climbs it", () => {
    // The steer toward the hill: the skis step up it, the board only sets its edge.
    const board = stage(LYNX, FACE, across(false));
    const skis = stage(SKIS, FACE, across(false));
    const z0 = board.skier.z;
    ride(board, 4, () => away(false, -1));
    ride(skis, 4, () => away(false, -1));
    expect(skis.skier.z).toBeLessThan(z0 - 0.3);
    expect(Math.abs(board.skier.z - z0)).toBeLessThan(0.1);
    expect(board.skier.sidestep).not.toBe(0);
  });

  it("sideslips down the face on the uphill edge eased off, and stops on it set again", () => {
    for (const toe of [false, true]) {
      const state = stage(LYNX, FACE, across(toe));
      const c = state.skier;
      const z0 = c.z;
      ride(state, 1, () => ({}));
      expect(Math.abs(c.z - z0)).toBeLessThan(0.15);
      let top = 0;
      const events = ride(
        state,
        3,
        () => away(toe, 0.5),
        () => (top = Math.max(top, c.speed)),
      );
      expect(c.z - z0).toBeGreaterThan(1.5);
      expect(top).toBeLessThan(2.5);
      expect(Math.abs(c.board!.slip)).toBeGreaterThan(K.slip.hold);
      events.push(...ride(state, 2, () => ({})));
      expect(c.speed).toBeLessThan(0.1);
      expect(wipeoutOf(events)).toBeNull();
      expect(c.thrown).toBeNull();
    }
  });

  it("drifts across the slope in a falling leaf, forward on the lean forward and back on the lean back", () => {
    const level = flatLevel({ packed: 1, grade: 0.47, slopeFrom: 0, size: 4000 });
    const drift = (lean: number) => {
      const state = stage(LYNX, level, across(false));
      const x0 = state.skier.x;
      const events = ride(state, 2, () => ({ ...away(false, 0.4), lean }));
      expect(wipeoutOf(events)).toBeNull();
      return { across: state.skier.x - x0, leaf: state.skier.board!.leaf };
    };
    const fwd = drift(1);
    const back = drift(-1);
    // Facing down the hill (heading −π/2), his nose points −x.
    expect(fwd.across).toBeLessThan(-0.3);
    expect(back.across).toBeGreaterThan(0.1);
    expect(Math.sign(fwd.leaf)).toBe(-Math.sign(back.leaf));
  });
});

describe("the caught downhill edge", () => {
  it("slams him onto his back off the heel edge and onto his face off the toe edge, the board kept on", () => {
    for (const [toe, cause] of [
      [true, "slam"],
      [false, "faceplant"],
    ] as const) {
      const state = stage(LYNX, FACE, across(toe));
      const events = ride(state, 4, (t) => away(toe, t < 1 ? 0.75 : 1));
      expect(wipeoutOf(events)).toBe(cause);
      const thrown = state.skier.thrown!;
      expect(thrown.board).toEqual({ stance: LYNX.board!.stance, back: cause === "slam" });
      expect(thrown.skis).toHaveLength(0);
      // ...his hands put down, never his knees twisted over a ski.
      const hurt = events.flatMap((e) => (e.kind === "injury" ? [e.part] : []));
      expect(hurt.some((p) => p === "handL" || p === "handR")).toBe(true);
      expect(hurt.some((p) => p === "kneeL" || p === "kneeR")).toBe(false);
    }
  });

  it("sends a slam backward over the heel edge and a faceplant forward over the toe edge", () => {
    for (const toe of [true, false]) {
      const state = stage(LYNX, FACE, across(toe));
      let at: number | null = null;
      ride(
        state,
        2.5,
        (t) => away(toe, t < 1 ? 0.75 : 1),
        () => {
          const b = state.skier.thrown;
          if (b && at === null) at = b.z;
        },
      );
      // Either way the body goes over down the hill, +z, past where it was thrown.
      expect(at).not.toBeNull();
      expect(state.skier.thrown!.z).toBeGreaterThan(at! + 0.3);
    }
  });

  it("keeps a pair of skis' caught edge a catch", () => {
    const state = stage(SKIS, flatLevel({ packed: 1 }), {
      x: 1500,
      z: 300,
      heading: Math.PI / 2,
    });
    state.skier.vz = 45 / 3.6;
    state.skier.edge = -1;
    expect(wipeoutOf(ride(state, 2, () => ({ steer: -1 })))).toBe("catch");
  });
});

describe("the board kept on", () => {
  it("lets no binding go into a trunk, the feet held their stance apart all the fall", () => {
    const state = stage(LYNX, syntheticLevel(), {
      x: LONE_TREE.x + 0.4,
      z: LONE_TREE.z - 40,
      heading: 0,
      speed: 50 / 3.6,
    });
    let lo = Infinity;
    let hi = 0;
    const events = ride(
      state,
      5,
      () => TUCK,
      () => {
        if (!state.skier.thrown) return;
        expect(state.skier.thrown.skis).toHaveLength(0);
        const d = feetApart(state);
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      },
    );
    expect(wipeoutOf(events)).toBe("tree");
    expect(lo).toBeGreaterThan(LYNX.board!.stance - 0.02);
    expect(hi).toBeLessThan(LYNX.board!.stance + 0.02);
  });

  it("digs and hops out of a bog with no poles, and rocks the board in its hole without catching an edge", () => {
    const state = stage(
      pairById("lynx"),
      flatLevel({ packed: 0 }),
      { x: 1500, z: 300, heading: 0 },
      2.5,
    );
    let phase = "push";
    let packed = -1;
    const events = ride(state, 10, (t, s) => {
      const c = s.skier;
      if (phase === "push" && c.trench >= 0.15) phase = "rock";
      if (phase === "rock" && c.trench === 0) {
        phase = "out";
        packed = t;
      }
      if (phase !== "rock") return phase === "push" ? TUCK : {};
      const q = Math.sin(2 * Math.PI * 1.2 * t) >= 0 ? 1 : -1;
      return { steer: q, tuck: 0.35, lean: q };
    });
    expect(events.some((e) => e.kind === "stuck")).toBe(true);
    expect(packed).toBeGreaterThan(0);
    expect(wipeoutOf(events)).toBeNull();
  });
});
