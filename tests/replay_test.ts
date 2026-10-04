// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY (`pwa/src/game/replay.ts`, `replay-shots.ts`, `camera-tv.ts`):
// a race recorded as the controls that rode it and rebuilt — the field
// included — reaches the same flag on the same step, every rival with it;
// the director cuts to a flight BEFORE its take-off and runs it slow; and
// the broadcast's lenses stand at the edge of the wood, never in it.
import { describe, expect, it } from "vitest";

import {
  RACE,
  SWIFT,
  TUNING,
  botInput,
  createGame,
  nearestTrackPoint,
  step,
  type GameState,
  type SkierInput,
} from "@engine";
import { createLineClear } from "../pwa/src/game/camera-clear.ts";
import { standFor, TV } from "../pwa/src/game/camera-tv.ts";
import { snapInput } from "../pwa/src/game/ghost.ts";
import { createReplayRig, recipeOf, startPrint, type Replay } from "../pwa/src/game/replay.ts";
import { WATCHING_CAMERAS } from "../pwa/src/game/replay-run.ts";
import {
  SHOTS,
  SLOW,
  directAt,
  planShots,
  shotWindow,
  type ReplayShot,
} from "../pwa/src/game/replay-shots.ts";
import { RUN_CAMERAS } from "../pwa/src/game/settings.ts";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;
/** Long enough for the field to take a lap of the stadium and the lights. */
const MAX_STEPS = 240 * HZ;
/** How long the recording runs on past the flag in the original, s. */
const COAST = 4;

type Ride = {
  /** A fold of every skier's pose over the whole ride, and every skier's
   * plan position each tenth of a second — what a replay comes back to. */
  digest: string;
  trace: number[];
  finish: { at: number; time: number; place: number } | null;
  rivals: (number | null)[];
  airborne: boolean[];
};

/** FNV-1a over every skier's place and speed, every tenth of a second. */
function fold(hash: number, run: GameState): number {
  for (const v of [run.skier.x, run.skier.z, run.skier.speed]) {
    hash ^= Math.round(v * 1000) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function watchStep(
  state: GameState,
  input: SkierInput,
  i: number,
  ride: Ride,
  hash: number,
): number {
  step(state, input);
  ride.airborne.push(state.skier.airborne);
  for (const e of state.events) {
    if (e.kind === "finish" && !ride.finish) ride.finish = { at: i, time: e.time, place: e.place };
  }
  if (i % 12 !== 0) return hash;
  hash = fold(hash, state);
  ride.trace.push(state.skier.x, state.skier.z);
  for (const r of state.rivals) {
    hash = fold(hash, r.run);
    ride.trace.push(r.run.skier.x, r.run.skier.z);
  }
  return hash;
}

function close(ride: Ride, hash: number, state: GameState): Ride {
  ride.digest = hash.toString(16);
  ride.rivals = state.rivals.map((r) => (r.run.progress.finished ? r.run.progress.time : null));
  return ride;
}

/** The bot's race, on the tape's grid and recorded — as the app does it. */
function rideRecorded(
  state: GameState,
  mode: "slalom" | "timeTrial",
): { ride: Ride; open: () => Replay | null } {
  const rig = createReplayRig();
  rig.arm(state, mode);
  const ride: Ride = { digest: "", trace: [], finish: null, rivals: [], airborne: [] };
  let hash = 0x811c9dc5;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (ride.finish && i > ride.finish.at + COAST * HZ) break;
    const input = snapInput(botInput(state));
    hash = watchStep(state, input, i, ride, hash);
    rig.step(input, state);
  }
  return { ride: close(ride, hash, state), open: rig.open };
}

/** A replay ridden to its end off its own tape. */
function rideReplay(replay: Replay): Ride {
  const ride: Ride = { digest: "", trace: [], finish: null, rivals: [], airborne: [] };
  let hash = 0x811c9dc5;
  for (let i = 0; !replay.over(); i++) {
    hash = watchStep(replay.state, replay.input(), i, ride, hash);
  }
  return close(ride, hash, replay.state);
}

describe("the replay reaches the same flag", () => {
  const level = syntheticLevel({ laps: 1 });
  // A field whose passes leave the kicker's flight its own shot: the
  // director spaces the edit, and a rival's pass a few seconds before the
  // take-off crowds a small air out of it (seed 11's does since the step
  // turn quickened the start).
  const SEED = 7;
  // The field on the start line beside him (a time trial with rivals, as
  // the benchmark rides it): every rival's run is rebuilt with his.
  const field = { mode: "timeTrial", rivals: RACE.rivals, laps: 1 } as const;
  const race = createGame({ level, seed: SEED, ...field, quiet: true });
  const recorded = rideRecorded(race, "timeTrial");
  const replay = recorded.open();

  it("records a race the field finishes", () => {
    expect(recorded.ride.finish).not.toBeNull();
    expect(race.rivals.length).toBeGreaterThan(0);
    expect(replay).not.toBeNull();
    expect(replay!.bill.time).toBe(recorded.ride.finish!.time);
    expect(replay!.bill.place).toBe(recorded.ride.finish!.place);
  });

  it("rebuilds the same afternoon, the field dealt the same paces", () => {
    expect(replay!.state).not.toBe(race);
    expect(replay!.state.level).toBe(race.level);
    expect(startPrint(replay!.state)).toBe(
      startPrint(createGame(recipeOf(createGame({ level, seed: SEED, ...field }), "timeTrial"))),
    );
  });

  it("rebuilds a run skied without poles without them", () => {
    const bare = createGame({
      level,
      seed: SEED,
      mode: "slalom",
      laps: 1,
      quiet: true,
      poles: false,
    });
    expect(createGame(recipeOf(bare, "slalom")).skier.poles).toBe(false);
    expect(createGame(recipeOf(race, "timeTrial")).skier.poles).toBe(true);
  });

  it("rides the tape to the same finish, on the same step, every rival with it", () => {
    const again = rideReplay(replay!);
    expect(again.finish).toEqual(recorded.ride.finish);
    // The recording stops a little past the flag rather than running on
    // through the coast home.
    expect(again.airborne.length).toBeLessThan(recorded.ride.airborne.length);
    // Every skier on the same metre of snow, as far as the replay runs.
    expect(again.trace).toEqual(recorded.ride.trace.slice(0, again.trace.length));
    const cut = createGame({ level, seed: SEED, ...field, quiet: true });
    const recut = rideRecorded(cut, "timeTrial");
    expect(recut.ride.digest).toBe(recorded.ride.digest);
    const replayed = rideReplay(recut.open()!);
    const rivals = recut.ride.rivals;
    expect(replayed.rivals.filter((t) => t !== null).length).toBeGreaterThan(0);
    replayed.rivals.forEach((t, i) => {
      if (t !== null && rivals[i] !== null) expect(t).toBeCloseTo(rivals[i]!, 9);
    });
  });

  it("replays a slalom to the same verdict, its board rebuilt, the second run's too", () => {
    const first = createGame({ level, seed: 5, mode: "slalom", spec: SWIFT, quiet: true });
    const rec = rideRecorded(first, "slalom");
    const again = rideReplay(rec.open()!);
    expect(again.finish).toEqual(rec.ride.finish);
    expect(again.trace).toEqual(rec.ride.trace.slice(0, again.trace.length));
    const second = createGame({
      level: first.level,
      seed: 5,
      mode: "slalom",
      spec: SWIFT,
      quiet: true,
      heat: { run: 2, player: 90, field: first.field!.runs },
    });
    expect(startPrint(createGame(recipeOf(second, "slalom")))).toBe(startPrint(second));
    expect(createGame(recipeOf(second, "slalom")).level.slalom?.run).toBe(2);
  });

  it("replays a time trial to the same figure", () => {
    const trial = createGame({ level, seed: 5, mode: "timeTrial", laps: 1, quiet: true });
    const rec = rideRecorded(trial, "timeTrial");
    const again = rideReplay(rec.open()!);
    expect(again.finish).toEqual(rec.ride.finish);
  });

  it("keeps no tape of a free ride or of a run already under way", () => {
    const rig = createReplayRig();
    rig.arm(createGame({ level, seed: 3, mode: "free", quiet: true }), "free");
    expect(rig.offers()).toBe(false);
    const late = createGame({ level, seed: 3, mode: "slalom", quiet: true });
    step(late, botInput(late));
    rig.arm(late, "slalom");
    rig.step(botInput(late), late);
    expect(rig.offers()).toBe(false);
    expect(rig.open()).toBeNull();
  });

  it("cuts to a flight before its take-off, and runs the flight slow", () => {
    const air = replay!.plan.filter((s) => s.kind === "air");
    expect(air.length).toBeGreaterThan(0);
    for (const shot of air) {
      // The shot is filed at the TAKE-OFF: on the snow then, in the air soon.
      expect(recorded.ride.airborne[shot.at]).toBe(false);
      expect(recorded.ride.airborne.slice(shot.at + 1, shot.at + 30)).toContain(true);
      const { from } = shotWindow(shot);
      expect(from).toBeLessThan(shot.at);
      expect(directAt(replay!.plan, from).shot).toBe(shot);
      expect(directAt(replay!.plan, shot.at - 1).shot).toBe(shot);
      expect(directAt(replay!.plan, shot.at + 1).rate).toBeCloseTo(SLOW.rate, 9);
      expect(directAt(replay!.plan, from - 1).shot).not.toBe(shot);
    }
    // ...and the flag is always a shot.
    expect(replay!.plan.some((s) => s.kind === "finish")).toBe(true);
  });
});

describe("the running order (replay-shots.ts)", () => {
  const shot = (at: number, weight: number): ReplayShot => ({
    kind: "air",
    at,
    runs: HZ,
    weight,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 20,
  });

  it("keeps the big one of a crowded pair, drops the small, and caps the count", () => {
    const plan = planShots([shot(1000, 0.4), shot(1200, 0.9), shot(20_000, 0.1)]);
    expect(plan.map((s) => s.at)).toEqual([1200]);
    const many = planShots(Array.from({ length: 100 }, (_, i) => shot(i * 20 * HZ, 0.5)));
    expect(many.length).toBe(SHOTS.most);
  });

  it("ramps the rate in and out and runs full speed off a shot", () => {
    const one = shot(2000, 1);
    const plan = [one];
    expect(directAt(plan, 0)).toEqual({ shot: null, rate: 1 });
    const into = directAt(plan, one.at - Math.round((SLOW.in / 2) * HZ)).rate;
    expect(into).toBeLessThan(1);
    expect(into).toBeGreaterThan(SLOW.rate);
    expect(directAt(plan, one.at + one.runs + Math.round(SLOW.out * HZ) + 1).rate).toBe(1);
  });
});

describe("the broadcast (camera-tv.ts)", () => {
  it("is reached only on the watching ladder", () => {
    expect(WATCHING_CAMERAS[0]).toBe("tv");
    expect(RUN_CAMERAS as readonly string[]).not.toContain("tv");
  });

  it("stands a lens beside every kicker, off the track and clear of every trunk", () => {
    for (const seed of LEVEL_SEEDS.slice(0, 4)) {
      const level = levelFor(seed);
      const clear = createLineClear(level);
      for (const k of level.kickers.filter((kk) => kk.onTrack)) {
        const fx = Math.sin(k.heading);
        const fz = Math.cos(k.heading);
        const take: ReplayShot = {
          kind: "air",
          at: 0,
          runs: HZ,
          weight: 1,
          x: k.x - fx * 2,
          y: k.y,
          z: k.z - fz * 2,
          heading: k.heading,
          speed: 20,
        };
        const stand = standFor(take, level, clear);
        expect(stand, `${seed} ${k.id}`).not.toBeNull();
        const hit = nearestTrackPoint(level, stand!.x, stand!.z);
        expect(hit.distance).toBeGreaterThan(level.track.points[hit.index].width / 2);
        expect(stand!.y).toBeCloseTo(level.groundAt(stand!.x, stand!.z) + TV.lift, 6);
        for (const t of level.trees) {
          expect(Math.hypot(t.x - stand!.x, t.z - stand!.z)).toBeGreaterThan(t.radius);
        }
        // The sightline from the lip to the lens is open all the way.
        const lip = { x: k.x, y: level.groundAt(k.x, k.z) + TV.aimUp, z: k.z };
        expect(clear(lip, stand!)).toBe(1);
      }
    }
  });

  it("frames the finish from beside the arch", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const line = level.checkpoints[level.checkpoints.length - 1];
    const flag: ReplayShot = {
      kind: "finish",
      at: 1,
      runs: HZ,
      weight: 1,
      x: line.x,
      y: line.y,
      z: line.z,
      heading: line.heading,
      speed: 20,
    };
    const stand = standFor(flag, level, createLineClear(level));
    expect(stand).not.toBeNull();
    expect(Math.hypot(stand!.x - line.x, stand!.z - line.z)).toBeLessThan(60);
  });
});
