// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CROSS AS READ (`pwa/src/game/ski-cross-run.ts`, `snapshot.ts`):
// the start gate's commands on a heat in place of the lights, the round on
// the HUD, the plate's offer after the qualification and after a heat, the
// bracket the next heat is stood up with, and a restart that stands the
// same heat up again.
import { describe, expect, it } from "vitest";

import {
  SKI_CROSS,
  TUNING,
  WOLVERINE,
  createGame,
  generateLevel,
  skiCrossCourseOf,
  step,
  NEUTRAL_INPUT,
  type GameState,
} from "@engine";
import { recipeOf } from "../pwa/src/game/replay.ts";
import { secondRunOf } from "../pwa/src/game/slalom-heat.ts";
import { crossNextOf, crossOf, nextBracket } from "../pwa/src/game/ski-cross-run.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { levelFor } from "./support/levels.ts";

const SEED = 38;
const BASE = generateLevel(SEED, { course: skiCrossCourseOf(levelFor(SEED)) ?? undefined });

/** The qualification, stood up and its clock stopped at `time` — home, or
 * out — as the plate would find it. */
function qualified(time: number | null): GameState {
  const state = createGame({
    seed: SEED,
    level: BASE,
    mode: "skiCross",
    spec: WOLVERINE,
    quiet: true,
  });
  const p = state.progress;
  p.finished = true;
  state.phase = "finished";
  if (time === null) p.out = { status: "dnf", why: "fall", gate: 2 };
  else p.time = time;
  return state;
}

describe("the qualification as read", () => {
  it("is billed as the qualification, with the start clock's word and no heat", () => {
    const state = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      quiet: true,
    });
    const snap = takeSnapshot(state);
    expect(snap.race?.discipline).toBe("skiCross");
    expect(snap.cross?.round).toBe("qualify");
    expect(snap.cross?.word).toBeNull();
    expect(snap.cross?.order).toEqual([]);
    // Its next run is a heat, which the slalom's offer leaves alone.
    expect(secondRunOf(qualified(1))).toBeNull();
  });

  it("offers the quarter-final to a time in the best sixteen, and the final ranking to the rest", () => {
    const fast = qualified(1);
    expect(crossNextOf(fast)).toEqual({ kind: "heat", round: "quarter" });
    const b = nextBracket(fast);
    expect(b?.ranked[0].id).toBeNull();
    const slow = qualified(9999);
    // Behind every racer home, ahead of the ones who went out.
    const next = crossNextOf(slow);
    expect(next?.kind).toBe("out");
    expect(next?.kind === "out" && next.place).toBeGreaterThan(SKI_CROSS.qualify);
    expect(nextBracket(slow)).toBeNull();
    expect(crossNextOf(qualified(null))?.kind).toBe("out");
  });
});

describe("a heat as read", () => {
  const bracket = nextBracket(qualified(1));
  const heat = createGame({
    ...recipeOf(qualified(1), "skiCross"),
    bracket: bracket ?? undefined,
    rivals: undefined,
    countdown: undefined,
  });

  it("is the player's quarter-final, three of the start list beside him", () => {
    expect(heat.cross?.round).toBe("quarter");
    expect(heat.rivals).toHaveLength(SKI_CROSS.heat - 1);
    expect(heat.bracket).toBe(bracket);
    const snap = takeSnapshot(heat);
    expect(snap.cross?.round).toBe("quarter");
    expect(snap.cross?.heat).toBe(1);
    expect(snap.skiers).toBe(SKI_CROSS.heat);
  });

  it("says SKIERS READY, then ATTENTION, then nothing until the doors drop — and no lights", () => {
    const run = createGame(recipeOf(heat, "skiCross"));
    const words: (string | null)[] = [];
    for (let i = 0; i < (run.rules.countdown + 0.5) * TUNING.physicsHz; i++) {
      step(run, NEUTRAL_INPUT);
      const snap = takeSnapshot(run);
      expect(snap.countdown).toBe(0);
      expect(snap.go).toBe(false);
      const w = snap.cross?.word ?? null;
      if (words[words.length - 1] !== w) words.push(w);
    }
    expect(words).toEqual(["ready", "attention", "go"]);
  });

  it("stands the same heat up again on a restart", () => {
    const again = createGame(recipeOf(heat, "skiCross"));
    expect(again.cross).toEqual(heat.cross);
    expect(again.rules.countdown).toBe(heat.rules.countdown);
    expect(again.rivals.map((r) => [r.id, r.pace, r.react])).toEqual(
      heat.rivals.map((r) => [r.id, r.pace, r.react]),
    );
  });

  it("orders the four and says who goes through", () => {
    const hud = crossOf(heat)!;
    expect(hud.order).toHaveLength(SKI_CROSS.heat);
    expect(hud.through).toBe(SKI_CROSS.through);
    expect(hud.next).toBeNull();
  });
});
