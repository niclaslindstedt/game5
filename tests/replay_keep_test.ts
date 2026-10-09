// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KEYFRAMES (`pwa/src/game/replay-keep.ts`) and the seek built on them
// (`replay.ts`): a run stood up from a copy taken on the way rides on to the
// very state the run itself reached — a race's field and a free ride's crowd
// with it — and a recording seeks back and forth to the same frames.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  botInput,
  createGame,
  placeRun,
  step,
  type GameState,
} from "@engine";
import { snapInput } from "../pwa/src/game/ghost.ts";
import { KEEP, createKeyframes, spacingAt } from "../pwa/src/game/replay-keep.ts";
import { CRASH, createReplayRig } from "../pwa/src/game/replay.ts";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;

/** Where every skier, amateur and rival stands — what a frame shows. */
function pose(state: GameState): string {
  const r = (v: number): string => v.toFixed(6);
  const runs = [state, ...state.rivals.map((v) => v.run)];
  const crowd = state.crowd?.amateurs.map((a) => `${r(a.x)},${r(a.z)}`).join(";") ?? "";
  return (
    runs
      .map((s) => `${r(s.skier.x)},${r(s.skier.y)},${r(s.skier.z)},${r(s.skier.speed)}`)
      .join("|") + `#${state.tick}#${crowd}`
  );
}

/** The bot's run, recorded as the app records it, its pose at every step. */
function ride(state: GameState, mode: "slalom" | "free" | "timeTrial", seconds: number) {
  const rig = createReplayRig();
  rig.arm(state, mode);
  const poses: string[] = [pose(state)];
  for (let i = 0; i < seconds * HZ; i++) {
    const input = snapInput(botInput(state));
    step(state, input);
    rig.step(input, state);
    poses.push(pose(state));
  }
  return { rig, poses };
}

describe("a run stood up from a keyframe", () => {
  const level = syntheticLevel({ laps: 1 });

  it("rides on to the same frames as the run, the field with it", () => {
    const race = createGame({ level, seed: 7, mode: "timeTrial", rivals: 3, laps: 1, quiet: true });
    const { rig, poses } = ride(race, "timeTrial", 30);
    const replay = rig.open()!;
    expect(replay.first).toBe(0);
    expect(pose(replay.state)).toBe(poses[0]);
    for (const at of [7 * HZ, 2 * HZ + 17, 25 * HZ + 3, 3 * HZ]) {
      replay.seek(at);
      replay.pump(() => true);
      expect(replay.at()).toBe(at);
      expect(pose(replay.state)).toBe(poses[at]);
      // ...and plays on from there off the tape.
      for (let i = 0; i < 90; i++) step(replay.state, replay.input());
      expect(pose(replay.state)).toBe(poses[at + 90]);
    }
  });

  it("stands a free ride up with its crowd, and leaves the run it was cut from alone", () => {
    const free = createGame({ level, seed: 3, mode: "free", quiet: true, crowd: 40 });
    expect(free.crowd?.amateurs.length).toBeGreaterThan(0);
    const { rig, poses } = ride(free, "free", 24);
    const live = pose(free);
    const replay = rig.open()!;
    replay.seek(19 * HZ + 5);
    replay.pump(() => true);
    expect(pose(replay.state)).toBe(poses[19 * HZ + 5]);
    while (!replay.over()) step(replay.state, replay.input());
    expect(pose(replay.state)).toBe(poses[poses.length - 1]);
    // The run itself never moved, and rides on recorded.
    expect(pose(free)).toBe(live);
    const input = snapInput(botInput(free));
    step(free, input);
    rig.step(input, free);
    expect(rig.open()!.end).toBe(24 * HZ + 1);
  });

  it("opens an instant replay ten seconds before the crash just taken", () => {
    // Tucked straight at the lone trunk, a long way up the slope from it.
    const run = createGame({ level, seed: 5, rivals: 0, countdown: 0, quiet: true });
    placeRun(run, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 120, heading: 0, speed: 50 / 3.6 });
    const rig = createReplayRig();
    rig.arm(run, "timeTrial");
    let fell: number | null = null;
    for (let i = 0; i < 20 * HZ && fell === null; i++) {
      const input = { ...NEUTRAL_INPUT, tuck: 1 };
      step(run, input);
      rig.step(input, run);
      if (run.events.some((e) => e.kind === "wipeout")) fell = i;
    }
    // The last ten seconds he skied into it — here the whole run, which is shorter.
    expect(CRASH.lead).toBe(10);
    expect(fell).toBeGreaterThan(2 * HZ);
    expect(fell).toBeLessThan(CRASH.lead * HZ);
    expect(rig.crash()).toBe(fell);
    const replay = rig.open("crash")!;
    expect(replay.moment).toBe(fell);
    expect(replay.at()).toBe(0);
    // The offer stands a while, then lapses.
    for (let i = 0; i < CRASH.offer * HZ; i++)
      rig.step({ ...NEUTRAL_INPUT }, (step(run, NEUTRAL_INPUT), run));
    expect(rig.crash()).toBeNull();
  });
});

describe("which copies are kept", () => {
  it("keeps every copy near the end and thins them with age, none past the window", () => {
    expect(spacingAt(5)).toBe(KEEP.every);
    expect(spacingAt(KEEP.near + 1)).toBe(KEEP.midEvery);
    expect(spacingAt(KEEP.mid + 1)).toBe(KEEP.farEvery);
    expect(spacingAt(KEEP.window + 1)).toBeNull();
    const state = createGame({ level: syntheticLevel(), seed: 1, mode: "timeTrial", quiet: true });
    const keys = createKeyframes(state);
    // Ten minutes of steps, the run itself never moving: only the count.
    const steps = 600 * HZ;
    for (let i = 1; i <= steps; i += 1) if (i % (KEEP.every * HZ) === 0) keys.step(state, i);
    const near = KEEP.near / KEEP.every;
    const mid = (KEEP.mid - KEEP.near) / KEEP.midEvery;
    const far = (KEEP.window - KEEP.mid) / KEEP.farEvery;
    expect(keys.count()).toBeLessThanOrEqual(near + mid + far + 2);
    expect(keys.first().step).toBeGreaterThanOrEqual(steps - KEEP.window * HZ);
    // The last stretch is never more than a copy's spacing from one.
    expect(steps - keys.before(steps - 1).step).toBeLessThanOrEqual(KEEP.every * HZ);
  });
});
