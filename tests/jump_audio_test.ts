// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP, HEARD (`jump-voice.ts`, `jump-bed.ts`, `jump-bank.ts`,
// `route.ts`'s `Contact.jump`): the jury's light is the start signal and no
// count; off the bar, the take-off and the touch are the jump's own sounds,
// a telemark's slap split; the engine's landing, the score and the course's
// chimes say nothing on a jump; the tracks rise with the in-run's speed, the
// flight's wind with the speed and the V, and the crowd roars louder past K
// and loudest past HS — and on a real jump the beds hand the skis and the
// wind back and forth with the ride bed.

import { describe, expect, it } from "vitest";

import { botInput, createGame, step, type GameEvent, type GameState } from "@engine";
import { safeCutoff } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { rideShares } from "../pwa/src/game/audio/chute-bed.ts";
import { jumpVoiceOf } from "../pwa/src/game/audio/jump-bed.ts";
import {
  crowdRoar,
  JUMP_LAYERS,
  jumpExcitement,
  jumpTargets,
  type JumpVoice,
} from "../pwa/src/game/audio/jump-voice.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import { withJumpContest } from "../pwa/src/game/ski-jump-run.ts";
import { levelFor } from "./support/levels.ts";

const HEADSET = safeCutoff(1e9, 16000);
const MIX = { wind: 1, snow: 1, events: 1 };
const QUIET: JumpVoice = {
  tracks: 0,
  air: 0,
  speed: 0,
  vee: 0,
  lay: 0,
  t: 0,
  near: 1,
  roar: 0,
  groan: 0,
};
const ON_JUMP = { jump: { landing: null } } as const;
const TOUCH: GameEvent = { kind: "skiJump", t: 9, stage: "touch", speed: 29, distance: 126 };

describe("a ski jump's moments (route.ts, jump-bank.ts)", () => {
  it("starts on the light's signal, never the count", () => {
    expect(soundForEvent({ kind: "count", t: 1, left: 2 }, ON_JUMP)).toBeNull();
    expect(soundForEvent({ kind: "go", t: 3 }, ON_JUMP)?.id).toBe("sj_signal");
    expect(soundForEvent({ kind: "go", t: 3 })?.id).toBe("go");
  });

  it("hears the bar, the take-off and the touch — a telemark split", () => {
    const bar = soundForEvent({ kind: "skiJump", t: 3, stage: "go", speed: 1 }, ON_JUMP);
    expect(bar?.id).toBe("sj_bar");
    const crisp = soundForEvent(
      { kind: "skiJump", t: 8, stage: "takeOff", speed: 26, timing: 0.01 },
      ON_JUMP,
    );
    const late = soundForEvent(
      { kind: "skiJump", t: 8, stage: "takeOff", speed: 26, timing: 0.18 },
      ON_JUMP,
    );
    expect(crisp?.id).toBe("sj_takeoff");
    expect(crisp!.shape!.gain!).toBeGreaterThan(late!.shape!.gain!);
    expect(soundForEvent(TOUCH, ON_JUMP)?.id).toBe("sj_land");
    expect(soundForEvent(TOUCH, { jump: { landing: "telemark" } })?.id).toBe("sj_telemark");
    for (const id of ["sj_signal", "sj_bar", "sj_takeoff", "sj_land", "sj_telemark"])
      expect(RUN_BANK[id], id).toBeDefined();
    // Off a jump the moments are silent: the run has no jump to hear.
    expect(soundForEvent(TOUCH)).toBeNull();
  });

  it("says nothing of the engine's landing, the score or the course on a jump", () => {
    const events: GameEvent[] = [
      {
        kind: "land",
        t: 9,
        airTime: 4,
        impact: 5,
        speed: 36,
        harsh: false,
        lost: 0,
        g: 3,
        off: 0,
      },
      { kind: "trick", t: 9, trick: "landing", spins: 1, points: 40, mult: 1 },
      { kind: "combo", t: 10, points: 1800, base: 1800, mult: 1, sketchy: false },
      { kind: "checkpoint", t: 12, index: 1, lap: 0, split: 9 },
      { kind: "lap", t: 12, lap: 1, time: 9 },
      { kind: "finish", t: 12, time: 9, place: 1 },
    ];
    for (const e of events) {
      expect(soundForEvent(e, ON_JUMP), e.kind).toBeNull();
      expect(soundForEvent(e), e.kind).not.toBeNull();
    }
  });
});

describe("a ski jump's beds (jump-voice.ts)", () => {
  it("raises the tracks with the in-run's speed, and nothing off them", () => {
    const at = (speed: number, tracks = 1) => jumpTargets({ ...QUIET, tracks, speed }, MIX);
    expect(at(25).groove.level).toBeGreaterThan(at(12).groove.level);
    expect(at(25).groove.cutoff!).toBeGreaterThan(at(12).groove.cutoff!);
    expect(at(25).whir.hz!).toBeGreaterThan(at(12).whir.hz!);
    expect(at(25, 0).groove.level).toBe(0);
    expect(at(25, 0).rumble.level).toBe(0);
  });

  it("raises the flight's wind with the speed and opens it with the V", () => {
    const fly = (speed: number, vee: number) =>
      jumpTargets({ ...QUIET, air: 1, speed, vee, lay: 1 }, MIX);
    expect(fly(28, 1).rush.level).toBeGreaterThan(fly(20, 1).rush.level);
    expect(fly(28, 1).rush.level).toBeGreaterThan(fly(28, 0).rush.level);
    expect(fly(28, 1).whistle.level).toBeGreaterThan(fly(28, 0).whistle.level);
    expect(fly(28, 1).rush.cutoff!).toBeGreaterThan(fly(28, 0).rush.cutoff!);
    expect(jumpTargets({ ...QUIET, speed: 28, vee: 1 }, MIX).rush.level).toBe(0);
  });

  it("roars louder past K and loudest past HS, and groans at a fall", () => {
    const hill = { p: 110, k: 126, hs: 140 };
    expect(jumpExcitement(126, 126, 140)).toBeGreaterThan(jumpExcitement(100, 126, 140));
    expect(jumpExcitement(140, 126, 140)).toBeGreaterThan(jumpExcitement(126, 126, 140));
    expect(jumpExcitement(145, 126, 140)).toBe(1);
    const at = (distance: number, fell = false) =>
      crowdRoar(hill, null, { distance, since: 1, fell });
    expect(at(140).roar).toBeGreaterThan(at(126).roar);
    expect(at(126).roar).toBeGreaterThan(at(100).roar);
    expect(at(126, true).roar).toBeLessThan(at(126).roar);
    expect(at(126, true).groan).toBe(1);
    // Rising with him in the air past P, and dying away after the touch.
    expect(crowdRoar(hill, 135, null).roar).toBeGreaterThan(crowdRoar(hill, 115, null).roar);
    expect(crowdRoar(hill, null, { distance: 130, since: 12, fell: false }).roar).toBeLessThan(
      at(130).roar / 4,
    );
    const loud = jumpTargets({ ...QUIET, roar: 1 }, MIX);
    expect(loud.roar.level).toBeGreaterThan(jumpTargets({ ...QUIET, roar: 0.3 }, MIX).roar.level);
    expect(jumpTargets({ ...QUIET, near: 0.1, roar: 1 }, MIX).roar.level).toBeLessThan(
      loud.roar.level,
    );
  });

  it("keeps every layer's cutoff under a headset's Nyquist, and every layer named", () => {
    const loud = jumpTargets(
      { tracks: 1, air: 1, speed: 40, vee: 1, lay: 1, t: 3, near: 1, roar: 1, groan: 0 },
      MIX,
    );
    for (const name of Object.keys(JUMP_LAYERS) as (keyof typeof loud)[]) {
      expect(loud[name], name).toBeDefined();
      if (loud[name].cutoff !== undefined)
        expect(loud[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
    }
  });
});

describe("a real jump, heard (jump-bed.ts)", () => {
  it("hands the skis and the wind to the jump and back, and the crowd roars at the touch", () => {
    const state: GameState = createGame(
      withJumpContest({ level: levelFor(1), seed: 1, mode: "skiJump", quiet: true }),
    );
    expect(rideShares(state)).toEqual({ air: 1, snow: 0 });
    let tracked = 0;
    let flew = false;
    let roared = 0;
    for (let i = 0; i < 120 * 30 && !state.progress.finished; i++) {
      step(state, botInput(state));
      const v = jumpVoiceOf(state)!;
      const stage = state.jump!.stage;
      if (stage === "tracks") {
        expect(rideShares(state)).toEqual({ air: 1, snow: 0 });
        expect(v.tracks).toBe(1);
        tracked = Math.max(tracked, v.speed);
      }
      if (stage === "air") {
        flew = true;
        expect(rideShares(state)).toEqual({ air: 0, snow: 0 });
        expect(v.air).toBe(1);
      }
      if (stage === "down") {
        expect(rideShares(state)).toEqual({ air: 1, snow: 1 });
        roared = Math.max(roared, v.roar);
      }
    }
    expect(tracked).toBeGreaterThan(20);
    expect(flew).toBe(true);
    expect(roared).toBeGreaterThan(0.3);
  });
});
