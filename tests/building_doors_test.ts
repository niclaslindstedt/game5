// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOOR OPENED (`doorway.ts`): on a free ride the machine press at a
// building's door, stopped before it, starts the skier's move — to the
// handle, the lever, the leaf swung over its stated time, through it to
// stand inside — and the leaf's closer brings it back and latches it once
// he is clear; the same from inside lets him out. A shut door holds him; a
// press away from any door does nothing; and a race never opens one.

import { describe, expect, it } from "vitest";

import {
  BUILDING_WALLS,
  DOOR,
  NEUTRAL_INPUT,
  TUNING,
  activeLeaf,
  buildingAt,
  buildingDoors,
  cabinsOf,
  createGame,
  doorFrame,
  doorOpen,
  doorPoint,
  doorWithin,
  leafShare,
  moveLength,
  placeRun,
  step,
  type BuildingDoor,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";
import { doorCallOf } from "../pwa/src/game/door-hud.ts";
import { doorReach } from "../pwa/src/game/door-reach.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import { DOOR_BANK } from "../pwa/src/game/audio/door-bank.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const PRESS: SkierInput = { ...NEUTRAL_INPUT, machine: true };

/** One door of every way of opening (in, out, rolled), off the corpus. */
function doorsOfEachWay(): { level: Level; door: BuildingDoor }[] {
  const seen = new Map<string, { level: Level; door: BuildingDoor }>();
  for (const seed of LEVEL_SEEDS) {
    const level = levelFor(seed);
    for (const door of buildingDoors(level)) {
      const key = `${door.swing}-${door.leaves}`;
      if (!seen.has(key)) seen.set(key, { level, door });
    }
    if (seen.size >= 4) break;
  }
  return [...seen.values()];
}

/** A free ride stood `w` m out of `door`'s wall (negative: inside), facing it. */
function before(level: Level, door: BuildingDoor, w: number): GameState {
  const state = createGame({ level, mode: "free", quiet: true });
  delete state.crowd;
  const f = doorFrame(door);
  const p = doorPoint(f, 0, w);
  placeRun(state, { x: p.x, z: p.z, heading: Math.atan2(f.x - p.x, f.z - p.z) });
  state.skier.vx = state.skier.vy = state.skier.vz = 0;
  return state;
}

/** Step `state` `s` seconds on `input` (pressed on the first step only),
 * the events kept. */
function ride(state: GameState, s: number, press = false, held = NEUTRAL_INPUT): GameEvent[] {
  const all: GameEvent[] = [];
  const n = Math.round(s * TUNING.physicsHz);
  for (let i = 0; i < n; i++) {
    step(state, press && i === 0 ? PRESS : held);
    all.push(...state.events);
  }
  return all;
}

describe("a door opened on the machine press", () => {
  const cases = doorsOfEachWay();

  it("finds doors of every way of opening", () => {
    const ways = new Set(cases.map((c) => c.door.swing));
    expect(ways.has("in")).toBe(true);
    expect(ways.has("out")).toBe(true);
  });

  for (const { level, door } of cases) {
    const name = `${door.kind} (${door.swing}, ${door.leaves} leaf)`;
    it(`${name}: in through it, the leaf swung, and shut behind him`, () => {
      const state = before(level, door, 2);
      expect(doorWithin(state)).toBe(true);
      const events = ride(state, 0.5, true);
      expect(state.doorway?.move).toBeTruthy();
      const move = state.doorway!.move!;
      // The leaf is set moving off its latch at its stated moment.
      events.push(...ride(state, move.open - 0.5 + 0.05));
      const leaf = activeLeaf(door);
      const opening = leafShare(state, door.id, leaf);
      expect(opening).toBeGreaterThan(0);
      expect(opening).toBeLessThan(0.2);
      // ...and is fully open after its swing.
      const swing = door.swing === "roll" ? DOOR.leaf.rollUp : DOOR.leaf.swing;
      events.push(...ride(state, swing));
      expect(leafShare(state, door.id, leaf)).toBeGreaterThan(0.95);
      expect(doorOpen(state, door.id)).toBe(true);
      // Through, he stands inside its walls.
      events.push(...ride(state, moveLength(move) - move.open - swing + 0.1));
      expect(state.doorway?.move ?? null).toBeNull();
      if (door.kind !== "afterski") {
        const k = cabinsOf(level).findIndex((c) => c.id === door.id);
        expect(buildingAt(level, state.skier.x, state.skier.z)).toBe(k);
      }
      // Let go, its closer brings it back and latches it.
      const later = ride(state, DOOR.leaf.dwell + DOOR.leaf.close + 4);
      expect(leafShare(state, door.id, leaf)).toBe(0);
      expect(doorOpen(state, door.id)).toBe(false);
      const all = [...events, ...later];
      expect(all.filter((e) => e.kind === "door" && e.phase === "open")).toHaveLength(1);
      expect(all.filter((e) => e.kind === "door" && e.phase === "shut")).toHaveLength(1);
    });
  }

  it("the closer takes at least five seconds from 90° toward shut", () => {
    const { level, door } = cases.find((c) => c.door.swing !== "roll")!;
    const state = before(level, door, 2);
    ride(state, 0.1, true);
    const move = state.doorway!.move!;
    ride(state, moveLength(move) + 0.2);
    // Stood well clear, the closer begins.
    const leaf = activeLeaf(door);
    const at = (deg: number): number => (deg * Math.PI) / 180 / DOOR.leaf.open;
    let t = 0;
    while (leafShare(state, door.id, leaf) > at(90) && t < 30) {
      ride(state, 0.02);
      t += 0.02;
    }
    let shut = 0;
    while (leafShare(state, door.id, leaf) > at(12) && shut < 30) {
      ride(state, 0.02);
      shut += 0.02;
    }
    expect(shut).toBeGreaterThanOrEqual(5);
  });

  it("lets him out again from inside", () => {
    const { level, door } = cases.find((c) => c.door.kind !== "afterski")!;
    const state = before(level, door, 2);
    ride(state, 0.1, true);
    // Inside, stood with his skis across, while the door shuts behind him.
    ride(state, moveLength(state.doorway!.move!) + DOOR.leaf.close + 6, false, {
      ...NEUTRAL_INPUT,
      brake: 1,
    });
    expect(doorOpen(state, door.id)).toBe(false);
    // Turned round to face the door from inside, and pressed.
    const f = doorFrame(door);
    const c = state.skier;
    placeRun(state, { x: c.x, z: c.z, heading: Math.atan2(f.x - c.x, f.z - c.z) });
    expect(doorWithin(state)).toBe(true);
    ride(state, 0.1, true);
    ride(state, moveLength(state.doorway!.move!));
    const w = (state.skier.x - f.x) * f.nx + (state.skier.z - f.z) * f.nz;
    expect(w).toBeGreaterThan(BUILDING_WALLS.wall);
  });

  it("a shut door holds him; a press away from any door does nothing", () => {
    const { level, door } = cases[0];
    const state = before(level, door, 3);
    const f = doorFrame(door);
    // Skied at the shut door at a walk, he is held outside it.
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      state.skier.vx = -f.nx * 2;
      state.skier.vz = -f.nz * 2;
      step(state, NEUTRAL_INPUT);
      if (state.skier.thrown) break;
    }
    const w = (state.skier.x - f.x) * f.nx + (state.skier.z - f.z) * f.nz;
    expect(w).toBeGreaterThan(0);
    // Far from it, the press opens nothing.
    const far = before(level, door, 40);
    ride(far, 0.5, true);
    expect(far.doorway).toBeUndefined();
  });

  it("never opens on a race", () => {
    const { level, door } = cases[0];
    const state = createGame({ level, quiet: true });
    const f = doorFrame(door);
    const p = doorPoint(f, 0, 2);
    placeRun(state, { x: p.x, z: p.z, heading: Math.atan2(f.x - p.x, f.z - p.z) });
    expect(doorWithin(state)).toBe(false);
    ride(state, 0.5, true);
    expect(state.doorway).toBeUndefined();
  });

  it("is called on the HUD, reached for with a hand on the lever, and heard opened and shut", () => {
    for (const { level, door } of cases) {
      const state = before(level, door, 2);
      expect(doorCallOf(state)?.shut, door.kind).toBe(false);
      const events = ride(state, TUNING.dt, true);
      expect(doorCallOf(state)).toBeNull();
      const move = state.doorway!.move!;
      // At the press's end his hand is on the handle, the lever's height
      // over what he stands on.
      events.push(...ride(state, move.open - TUNING.dt));
      const r = doorReach(state)!;
      expect(r.weight, door.kind).toBeGreaterThan(0.95);
      const c = state.skier;
      const over = r.y - (c.y - c.spec.cogHeight);
      expect(over).toBeGreaterThan(door.swing === "roll" ? 0.2 : 0.85);
      expect(over).toBeLessThan(1.6);
      expect(Math.hypot(r.x - c.x, r.z - c.z)).toBeLessThan(0.9);
      events.push(...ride(state, moveLength(move) + 15, false, { ...NEUTRAL_INPUT, brake: 1 }));
      const heard = events.filter((e) => e.kind === "door").map((e) => soundForEvent(e)?.id);
      expect(heard.length, door.kind).toBe(2);
      for (const id of heard) expect(DOOR_BANK[id!], id).toBeDefined();
    }
  });

  it("lets him through on foot in town, his skis kept on his shoulder", () => {
    const { level, door } = cases.find((c) => c.door.kind !== "afterski")!;
    const state = before(level, door, 2);
    const c = state.skier;
    const ski = (side: number) => ({
      side,
      held: 1,
      mount: c.spec.mount,
      ends: [0, 0, 0, 0, 0, 0],
      last: [0, 0, 0, 0, 0, 0],
      kick: [0, 0, 0, 0, 0, 0],
      up: [0, 1, 0] as [number, number, number],
      spin: 0,
      touching: 0,
      hooked: 0,
      hook: [0, 0, 0, 0, 0, 0],
      tried: 0,
    });
    c.town = {
      phase: "walk",
      phaseT: 0,
      t: 0,
      skis: [ski(-1), ski(1)],
      at: { x: c.x, z: c.z, heading: c.heading },
      walked: 0,
    };
    ride(state, TUNING.dt, true);
    const move = state.doorway!.move!;
    // Stepped until the move lets him go, on foot still.
    for (let i = 0; i < (moveLength(move) + 1) * TUNING.physicsHz && state.doorway?.move; i++) {
      step(state, NEUTRAL_INPUT);
    }
    expect(state.doorway?.move ?? null).toBeNull();
    expect(c.town?.phase).toBe("walk");
    expect(c.town!.walked).toBeGreaterThan(1.5);
    const f = doorFrame(door);
    expect((c.x - f.x) * f.nx + (c.z - f.z) * f.nz).toBeLessThan(-1);
  });
});
