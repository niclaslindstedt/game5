// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST (`pwa/src/game/ghost.ts`, `ghost-run.ts`): a run kept as the
// controls that rode it. The codec is exact, a tape replays to the same
// digest, and the ghost put back beside a run of the same map rides the
// recording's own line — within a skis length for the whole lap, which on a
// deterministic engine is to the bit.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  botInput,
  createGame,
  placeRun,
  step,
  type GameState,
  type SkierInput,
} from "@engine";
import {
  GHOST_FORMAT,
  createControlRecorder,
  ghostMatches,
  ghostStage,
  mapPrint,
  readControls,
  readsAsGhost,
  sealGhost,
  snapInput,
  type ControlTape,
  type GhostRun,
  type GhostStage,
} from "../pwa/src/game/ghost.ts";
import { createRunBook, type RunTicket } from "../pwa/src/game/ghost-run.ts";
import {
  createInputModel,
  NO_KEYS,
  neutralTouch,
  sampleInput,
} from "../pwa/src/game/input-model.ts";
import { recordId, type RecordBook, type RecordKey } from "../pwa/src/game/records.ts";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ laps: 1 });
const KEY: RecordKey = { seed: 7, skis: "chamois", mode: "timeTrial", laps: 1 };
const TICKET: RunTicket = { key: KEY, assist: { yaw: 1, air: 1 } };
/** Long enough for the bot to take a lap of the stadium and the lights. */
const MAX_STEPS = 240 * TUNING.physicsHz;

const trial = (): GameState =>
  createGame({ level: LEVEL, seed: 7, mode: "timeTrial", laps: 1, quiet: true });

/** FNV-1a over the skis's place and speed every tenth of a second. */
function digestOf(poses: readonly { x: number; z: number; speed: number }[]): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < poses.length; i += 12) {
    for (const v of [poses[i].x, poses[i].z, poses[i].speed]) {
      hash ^= Math.round(v * 1000) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16);
}

/** The bot's lap, on the tape's grid and written down. */
function recordLap(): {
  tape: ControlTape;
  poses: { x: number; z: number; speed: number }[];
  time: number;
} {
  const run = trial();
  const rec = createControlRecorder();
  const poses: { x: number; z: number; speed: number }[] = [];
  for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
    const input = snapInput(botInput(run));
    rec.record(input);
    step(run, input);
    poses.push({ x: run.skier.x, z: run.skier.z, speed: run.skier.speed });
  }
  expect(run.progress.finished).toBe(true);
  return { tape: rec.seal(), poses, time: run.progress.time };
}

const RECORDED = recordLap();

describe("the grid", () => {
  it("puts every axis on the tape's grid, and a value already on it stays put", () => {
    const a = snapInput({
      steer: 0.1234,
      tuck: 0.777,
      brake: 0.001,
      lean: -0.5555,
      reset: true,
    });
    expect(Math.round(a.steer * 127)).toBeCloseTo(a.steer * 127, 9);
    expect(Math.round(a.lean * 127)).toBeCloseTo(a.lean * 127, 9);
    expect(Math.round(a.tuck * 255)).toBeCloseTo(a.tuck * 255, 9);
    expect(a.brake).toBe(0);
    expect(a.reset).toBe(true);
    const again = snapInput({ ...a });
    expect(again).toEqual(a);
  });

  it("centre is a positive zero, and out-of-range is clamped", () => {
    const a = snapInput({ steer: -0.001, tuck: 2, brake: -1, lean: -3, reset: false });
    expect(Object.is(a.steer, 0)).toBe(true);
    expect(a.tuck).toBe(1);
    expect(a.brake).toBe(0);
    expect(a.lean).toBe(-1);
  });

  it("is applied where the player's input is made", () => {
    const model = createInputModel();
    const keys = { ...NO_KEYS, right: true, tuck: true };
    for (let i = 0; i < 7; i++) {
      const input = sampleInput(model, keys, neutralTouch(), TUNING.dt, false);
      expect(snapInput({ ...input })).toEqual(input);
    }
  });
});

describe("the codec", () => {
  it("hands back exactly the controls a step was ridden on", () => {
    const rec = createControlRecorder();
    const inputs: SkierInput[] = [
      snapInput({ steer: 0.3, tuck: 1, brake: 0, lean: -0.2, reset: false }),
      snapInput({ steer: -1, tuck: 0, brake: 0.5, lean: 1, reset: true }),
      { ...NEUTRAL_INPUT },
    ];
    for (const input of inputs) rec.record(input);
    const tape = readControls(rec.seal());
    expect(tape.steps).toBe(3);
    for (let i = 0; i < inputs.length; i++) expect({ ...tape.at(i) }).toEqual(inputs[i]);
    expect({ ...tape.at(3) }).toEqual(NEUTRAL_INPUT);
  });

  it("a lap is a few kilobytes", () => {
    expect(JSON.stringify(RECORDED.tape).length).toBeLessThan(40_000);
  });
});

describe("a tape replays", () => {
  it("to the same digest and the same time", () => {
    const run = trial();
    const tape = readControls(RECORDED.tape);
    const poses: { x: number; z: number; speed: number }[] = [];
    for (let i = 0; i < tape.steps; i++) {
      step(run, tape.at(i));
      poses.push({ x: run.skier.x, z: run.skier.z, speed: run.skier.speed });
    }
    expect(run.progress.finished).toBe(true);
    expect(run.progress.time).toBe(RECORDED.time);
    expect(digestOf(poses)).toBe(digestOf(RECORDED.poses));
  });
});

describe("a tape with a wipeout in it", () => {
  it("replays the crash, the tumble and the reset step for step", () => {
    // Into the lone trunk flat out: the skier thrown, lying, stood back up.
    const at = { x: LONE_TREE.x + 0.4, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 };
    const ride = (inputs: (i: number) => SkierInput) => {
      const run = trial();
      placeRun(run, at);
      const seen: string[] = [];
      for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
        step(run, inputs(i));
        for (const e of run.events)
          if (e.kind === "wipeout" || e.kind === "reset") seen.push(`${e.kind}@${i}`);
      }
      return { run, seen };
    };
    const rec = createControlRecorder();
    const first = ride((i) => {
      const input = snapInput({ ...NEUTRAL_INPUT, tuck: i < 360 ? 1 : 0.5, steer: 0 });
      rec.record(input);
      return input;
    });
    expect(first.seen.some((s) => s.startsWith("wipeout"))).toBe(true);
    const tape = readControls(rec.seal());
    const again = ride((i) => tape.at(i));
    expect(again.seen).toEqual(first.seen);
    expect(again.run.skier.x).toBe(first.run.skier.x);
    expect(again.run.skier.z).toBe(first.run.skier.z);
  });
});

describe("what names the snow", () => {
  it("is the record-book row and the map's fingerprint, for a time trial only", () => {
    const stage = ghostStage(KEY, LEVEL)!;
    expect(stage.id).toBe(recordId(KEY));
    expect(stage.map).toBe(mapPrint(syntheticLevel({ laps: 1 })));
    expect(ghostStage({ ...KEY, mode: "slalom" }, LEVEL)).toBeNull();
    const moved = syntheticLevel({ laps: 1 });
    moved.checkpoints[1] = { ...moved.checkpoints[1], x: moved.checkpoints[1].x + 5 };
    expect(mapPrint(moved)).not.toBe(stage.map);
  });

  it("a stored run is trusted only as far as a run could have written it", () => {
    const stage = ghostStage(KEY, LEVEL)!;
    const run = sealGhost(RECORDED.tape, stage, KEY, TICKET.assist, RECORDED.time);
    expect(run.format).toBe(GHOST_FORMAT);
    expect(readsAsGhost(JSON.parse(JSON.stringify(run)))).toBe(true);
    expect(ghostMatches(run, stage)).toBe(true);
    expect(ghostMatches(run, { ...stage, map: "00000000" })).toBe(false);
    expect(readsAsGhost({ ...run, format: GHOST_FORMAT + 1 })).toBe(false);
    expect(readsAsGhost({ ...run, skis: "hovercraft" })).toBe(false);
    expect(readsAsGhost({ ...run, value: 0 })).toBe(false);
    expect(readsAsGhost({ ...run, assist: { yaw: 2, air: 1 } })).toBe(false);
    expect(readsAsGhost({ ...run, steer: undefined })).toBe(false);
    expect(readsAsGhost(null)).toBe(false);
  });

  it("a run skied without poles says so, and one with them carries nothing new", () => {
    const stage = ghostStage(KEY, LEVEL)!;
    expect("poles" in sealGhost(RECORDED.tape, stage, KEY, TICKET.assist, RECORDED.time)).toBe(
      false,
    );
    const bare = sealGhost(RECORDED.tape, stage, KEY, TICKET.assist, RECORDED.time, false);
    expect(bare.poles).toBe(false);
    expect(readsAsGhost(JSON.parse(JSON.stringify(bare)))).toBe(true);
    expect(readsAsGhost({ ...bare, poles: "no" })).toBe(false);
  });
});

/** An in-memory store, so the rig runs without a browser. */
function memoryStore() {
  let book: RecordBook = {};
  const ghosts = new Map<string, GhostRun>();
  return {
    ghosts,
    store: {
      loadBook: () => book,
      saveBook: (next: RecordBook) => {
        book = next;
      },
      loadGhost: (stage: GhostStage) => {
        const run = ghosts.get(stage.id);
        return run && ghostMatches(run, stage) ? run : null;
      },
      saveGhost: (run: GhostRun) => {
        ghosts.set(run.id, JSON.parse(JSON.stringify(run)) as GhostRun);
      },
    },
  };
}

/** Ride a trial through the rig with `drive` on the bars; the rig's ghost's
 * places are handed to `watch` every step. */
function rideThroughRig(
  rig: ReturnType<typeof createRunBook>,
  drive: (run: GameState) => SkierInput,
  watch?: (run: GameState, ghost: GameState | null, i: number) => void,
): GameState {
  const run = trial();
  rig.arm(run, TICKET);
  for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
    const input = snapInput(drive(run));
    step(run, input);
    rig.step(input, run.events);
    watch?.(run, rig.ghost(), i);
  }
  return run;
}

describe("the rig", () => {
  it("files the first run, leaves its tape, and puts it back as a ghost on the lap's own line", () => {
    const mem = memoryStore();
    let shown: GameState | null = null;
    const rig = createRunBook({ show: (g) => (shown = g), store: mem.store, now: () => 42 });

    const first = rideThroughRig(rig, botInput);
    expect(first.progress.finished).toBe(true);
    expect(rig.settled()).toEqual({ time: first.progress.time, record: true });
    expect(rig.ghost()).toBeNull();
    expect(mem.ghosts.size).toBe(1);
    const row = rig.standing(KEY)!;
    expect(row.value).toBe(first.progress.time);
    expect(row.at).toBe(42);
    expect(row.splits.length).toBe(first.progress.passed);

    // THE SECOND RUN: the player sits on the grid, and the ghost rides the
    // recorded lap beside him. Within a skis length of the recording on every
    // step of the lap — and, the engine being deterministic, exactly on it.
    const length = first.skier.spec.length;
    let worst = 0;
    let steps = 0;
    rideThroughRig(
      rig,
      () => ({ ...NEUTRAL_INPUT }),
      (_run, ghost, i) => {
        expect(ghost).not.toBeNull();
        if (i >= RECORDED.poses.length) return;
        const at = RECORDED.poses[i];
        worst = Math.max(worst, Math.hypot(ghost!.skier.x - at.x, ghost!.skier.z - at.z));
        steps++;
      },
    );
    expect(shown).not.toBeNull();
    expect(steps).toBe(RECORDED.poses.length);
    expect(worst).toBeLessThan(length);
    expect(worst).toBe(0);
    expect(rig.ledger().standing?.value).toBe(first.progress.time);
  });

  it("a slower run keeps the record and the tape that set it", () => {
    const mem = memoryStore();
    const rig = createRunBook({ show: () => {}, store: mem.store });
    const first = rideThroughRig(rig, botInput);
    const tape = mem.ghosts.get(recordId(KEY))!;
    // Half tuck: the same line, later.
    const slow = rideThroughRig(rig, (run) => ({
      ...botInput(run),
      tuck: botInput(run).tuck * 0.6,
    }));
    expect(slow.progress.finished).toBe(true);
    expect(slow.progress.time).toBeGreaterThan(first.progress.time);
    expect(rig.settled()?.record).toBe(false);
    expect(mem.ghosts.get(recordId(KEY))).toEqual(tape);
    expect(rig.standing(KEY)!.value).toBe(first.progress.time);
  });

  it("a race is filed but keeps no tape, and a run armed late keeps none either", () => {
    const mem = memoryStore();
    const rig = createRunBook({ show: () => {}, store: mem.store });
    const race: RunTicket = { ...TICKET, key: { ...KEY, mode: "slalom" } };
    const run = createGame({ level: LEVEL, seed: 7, rivals: 0, quiet: true });
    rig.arm(run, race);
    for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
      const input = snapInput(botInput(run));
      step(run, input);
      rig.step(input, run.events);
    }
    expect(rig.settled()?.record).toBe(true);
    expect(mem.ghosts.size).toBe(0);

    const late = trial();
    step(late, NEUTRAL_INPUT);
    rig.arm(late, TICKET);
    for (let i = 0; i < MAX_STEPS && !late.progress.finished; i++) {
      const input = snapInput(botInput(late));
      step(late, input);
      rig.step(input, late.events);
    }
    expect(rig.settled()?.record).toBe(true);
    expect(mem.ghosts.size).toBe(0);
  });

  it("a run with damage on is filed but keeps no tape: the tape cannot carry what bent", () => {
    const mem = memoryStore();
    const rig = createRunBook({ show: () => {}, store: mem.store });
    const run = createGame({
      level: LEVEL,
      seed: 7,
      mode: "timeTrial",
      laps: 1,
      damage: true,
      quiet: true,
    });
    rig.arm(run, TICKET);
    for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
      const input = snapInput(botInput(run));
      step(run, input);
      rig.step(input, run.events);
    }
    expect(run.progress.finished).toBe(true);
    expect(rig.settled()?.record).toBe(true);
    expect(mem.ghosts.size).toBe(0);
  });

  it("a run without poles keeps its tape, and its ghost skis without them", () => {
    const mem = memoryStore();
    const rig = createRunBook({ show: () => {}, store: mem.store, now: () => 1 });
    const run = createGame({
      level: LEVEL,
      seed: 7,
      mode: "timeTrial",
      laps: 1,
      quiet: true,
      poles: false,
    });
    rig.arm(run, TICKET);
    for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
      const input = snapInput(botInput(run));
      step(run, input);
      rig.step(input, run.events);
    }
    expect(run.progress.finished).toBe(true);
    expect([...mem.ghosts.values()][0].poles).toBe(false);
    // The next run — on poles — rides beside a ghost that has none.
    rig.arm(trial(), TICKET);
    expect(rig.ghost()?.skier.poles).toBe(false);
  });

  it("an unarmed run is nobody's: nothing filed, nothing kept", () => {
    const mem = memoryStore();
    const rig = createRunBook({ show: () => {}, store: mem.store });
    const run = trial();
    rig.arm(run, null);
    for (let i = 0; i < MAX_STEPS && !run.progress.finished; i++) {
      const input = snapInput(botInput(run));
      step(run, input);
      rig.step(input, run.events);
    }
    expect(rig.settled()).toBeNull();
    expect(rig.standing(KEY)).toBeNull();
    expect(mem.ghosts.size).toBe(0);
  });
});
