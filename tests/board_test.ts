// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARD (`defs/boards.ts`): a board is a pair to the engine — one
// deck under both feet, its stations in one column at its whole width
// (`suspension.ts`), no poles — read by the skis' own model. Held here on
// the synthetic slope: it carves the arc its sidecut and edge ask for, tops
// out in its band, floats higher in powder than a pair of skis, rides fakie
// without ever turning round, and lands the slope's kicker.

import { describe, expect, it } from "vitest";

import {
  BOARD_CATALOG,
  LYNX,
  NEUTRAL_INPUT,
  SKI_CATALOG,
  SKIS,
  TOP_SPEED_PITCH,
  TUNING,
  carveCurvature,
  createGame,
  isBoardId,
  isPairId,
  isSkiId,
  pairById,
  placeRun,
  probesOf,
  step,
  terminalSpeed,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
  type SkiSpec,
} from "@engine";
import { SLOPE, flatLevel, pisteX, syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
const PITCH = flatLevel({
  packed: 1,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});

function stage(
  spec: SkiSpec,
  level: Level,
  at: { x: number; z: number; heading: number; speed?: number; pitch?: number },
  mode?: "free",
): GameState {
  const state = createGame({ level, spec, mode, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, at);
  return state;
}

/** Ride `seconds`, the input a function of the time and the state. */
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

/** The tuck and the brake that hold `kmh` (the ride lab's `hold`). */
function hold(s: GameState, kmh: number): Partial<SkierInput> {
  const err = kmh / 3.6 - s.skier.speed;
  return {
    tuck: Math.min(1, Math.max(0, 0.5 + 0.5 * err)),
    brake: Math.min(1, Math.max(0, -0.5 * err - 0.4)),
  };
}

/** A carve held at `kmh` on half the edge down the 20° pitch: the radius
 * the path bends at and the edge he stood on, over its last 1.5 s. */
function carve(spec: SkiSpec, kmh: number): { radius: number; edge: number; thrown: boolean } {
  const state = stage(spec, PITCH, { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 });
  const c = state.skier;
  let turned = 0;
  let dist = 0;
  let edge = 0;
  let n = 0;
  let last: { h: number; x: number; z: number } | null = null;
  ride(
    state,
    3,
    (_, s) => ({ ...TUCK, steer: 0.5, ...hold(s, kmh) }),
    (t) => {
      if (t < 1.5) return;
      const h = Math.atan2(c.vx, c.vz);
      if (last) {
        const d = h - last.h;
        turned += Math.atan2(Math.sin(d), Math.cos(d));
        dist += Math.hypot(c.x - last.x, c.z - last.z);
      }
      last = { h, x: c.x, z: c.z };
      edge += Math.abs(c.edge);
      n++;
    },
  );
  return { radius: dist / Math.abs(turned), edge: edge / n, thrown: c.thrown !== null };
}

describe("the board as a pair", () => {
  it("is a board of its own, off the ski card", () => {
    expect(BOARD_CATALOG).toContain(LYNX);
    expect(SKI_CATALOG).not.toContain(LYNX);
    expect(isBoardId("lynx")).toBe(true);
    expect(isPairId("lynx")).toBe(true);
    expect(isSkiId("lynx")).toBe(false);
    expect(pairById("lynx")).toBe(LYNX);
    expect(pairById("chamois")).toBe(SKIS);
    // A rider's crouch: the snowboarders' wind-tunnel band.
    expect(LYNX.cdATuck).toBeGreaterThanOrEqual(0.35);
    expect(LYNX.cdAUpright).toBeLessThanOrEqual(0.55);
  });

  it("stands on one column of four stations at the board's own width, poleless", () => {
    const state = stage(LYNX, PITCH, { x: 2000, z: 600, heading: 0 });
    const c = state.skier;
    expect(c.contacts).toHaveLength(4);
    expect(c.contacts.map((k) => k.station)).toEqual(["tip", "mid", "mid", "tail"]);
    for (const k of c.contacts) expect(k.side).toBe(0);
    expect(c.contacts[0].width).toBeCloseTo(LYNX.tipWidth, 9);
    expect(c.contacts[1].width).toBeCloseTo(LYNX.waist, 9);
    expect(c.contacts[3].width).toBeCloseTo(LYNX.tailWidth, 9);
    expect(c.poles).toBe(false);
    // The two feet one behind the other along the deck, front then back.
    const probes = probesOf(LYNX);
    const feet = probes.filter((p) => p.station === "mid");
    expect(feet.map((p) => p.leg)).toEqual([0, 1]);
    expect(feet[0].bz - feet[1].bz).toBeCloseTo(LYNX.board!.stance, 9);
    // Skis keep two columns, three stations each.
    expect(probesOf(SKIS)).toHaveLength(6);
  });
});

describe("the board on the snow", () => {
  it("carves the arc its sidecut and edge ask for at a moderate speed, and never tighter than the sidecut", () => {
    const board = carve(LYNX, 30);
    expect(board.thrown).toBe(false);
    const asked = 1 / carveCurvature(LYNX, board.edge);
    expect(board.radius / asked).toBeGreaterThan(0.85);
    expect(board.radius / asked).toBeLessThan(1.25);
    expect(board.radius).toBeGreaterThan(LYNX.sidecut * Math.cos(board.edge));
    // Its deep sidecut carves a shorter arc than the all-mountain ski's.
    expect(board.radius).toBeLessThan(carve(SKIS, 30).radius);
  });

  it("tops out in its band, a little under the all-mountain ski", () => {
    const state = stage(LYNX, PITCH, { x: 2000, z: 210, heading: 0, speed: 2 });
    ride(state, 30, () => TUCK);
    const kmh = state.skier.speed * 3.6;
    expect(kmh).toBeGreaterThan(LYNX.topSpeed * 0.9);
    expect(kmh).toBeLessThan(LYNX.topSpeed * 1.1);
    expect(kmh).toBeLessThan(terminalSpeed(LYNX, TOP_SPEED_PITCH) * 3.6);
    expect(LYNX.topSpeed).toBeLessThan(SKIS.topSpeed);
  });

  it("floats higher in powder than a pair of skis", () => {
    const sink = (spec: SkiSpec): number => {
      const state = stage(spec, flatLevel({ packed: 0 }), { x: 1500, z: 200, heading: 0 });
      ride(state, 3, () => ({}));
      const mid = state.skier.contacts.findIndex((k) => k.station === "mid");
      return state.skier.sinks[mid];
    };
    expect(sink(LYNX)).toBeLessThan(sink(SKIS));
  });

  it("rides fakie down a groomer without ever turning round, and steers the way pressed", () => {
    const state = stage(
      LYNX,
      flatLevel({ packed: 1, grade: 0.25, slopeFrom: 0 }),
      { x: 1500, z: 200, heading: Math.PI, pitch: Math.atan(0.25) },
      "free",
    );
    expect(state.rules.revert).toBe(true);
    let reverted = false;
    const events = ride(
      state,
      8,
      (t) => ({ steer: t > 3 && t < 4 ? 1 : 0 }),
      () => {
        reverted ||= state.skier.revert != null;
      },
    );
    expect(events.filter((e) => e.kind === "wipeout")).toHaveLength(0);
    expect(reverted).toBe(false);
    expect(state.skier.switched).toBe(true);
    expect(state.skier.way).toBeLessThan(-5);
    // Steered right, he went right (+x), riding tail first.
    expect(state.skier.x).toBeGreaterThan(1500 + 5);
  });

  it("lands the slope's kicker at 60 km/h", () => {
    const z = SLOPE.kickerZ - 60;
    const state = stage(LYNX, syntheticLevel(), { x: pisteX(z), z, heading: 0, speed: 60 / 3.6 });
    let flew = false;
    const events = ride(
      state,
      6,
      (_, s) => ({ ...TUCK, ...hold(s, 60) }),
      () => {
        flew ||= state.skier.airborne;
      },
    );
    expect(flew).toBe(true);
    expect(events.filter((e) => e.kind === "wipeout")).toHaveLength(0);
    expect(state.skier.thrown).toBeNull();
  });
});
