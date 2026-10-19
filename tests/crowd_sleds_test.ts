// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL SENT MID-RUN FOR AN AMATEUR DOWN where nothing can land
// (`pwa/src/game/rescue-dispatch.ts` chooses, `crowd-calls.ts` calls,
// `rescue-book.ts` keeps): the snowmobiles come for him with injuries off
// too, he is the rescue's from the call, their machines can be stolen the
// same run, and the book carries the call — and its stolen machines — into
// the runs after.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  createGame,
  planSledRescue,
  standSkier,
  stealWithin,
  throwAmateur,
  type Amateur,
  type GameState,
} from "@engine";

import { SETTLE, stepRun } from "../pwa/src/game/crowd-calls.ts";
import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { dispatchRescue } from "../pwa/src/game/rescue-dispatch.ts";
import { fitToLand } from "../pwa/src/game/rescue-plan.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);

/** A spot no machine can set down near that the patrol can still reach. */
const spot = (() => {
  for (let z = 200; z < level.size - 200; z += 90) {
    for (let x = 200; x < level.size - 200; x += 90) {
      const p = { x, z };
      if (!fitToLand(level, p) && planSledRescue(level, p)) return p;
    }
  }
  return null;
})();

const ride = (): GameState =>
  createGame({ level, seed: 38, mode: "free", crowd: 24, quiet: true, sfw: true, gore: false });

const run = (s: GameState, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 120); i++) stepRun(s, NEUTRAL_INPUT);
};

/** An amateur of the run thrown down hurt at the spot. */
function hurtAt(s: GameState, at: { x: number; z: number }): Amateur {
  const a = s.crowd!.amateurs.filter((m) => m.mode === "ski")[0];
  a.x = at.x;
  a.z = at.z;
  a.y = level.groundAt(at.x, at.z);
  a.vx = 0;
  a.vz = 0;
  throwAmateur(a, 1, "roll", 0, 0);
  a.timer = 2;
  a.hurt = true;
  return a;
}

describe("the patrol sent for an amateur down", () => {
  it("chooses the snowmobiles where nothing can land, the air ambulance where it can", () => {
    expect(spot).not.toBeNull();
    expect(dispatchRescue(level, [{ ...spot!, known: 0 }]).sleds).not.toBeNull();
    const fell = level.track.points[Math.floor(level.track.points.length * 0.3)];
    if (fitToLand(level, fell)) {
      expect(dispatchRescue(level, [{ x: fell.x, z: fell.z, known: 0 }]).flight).not.toBeNull();
    }
  });

  it("drives up for him mid-run with injuries off, and he is theirs from the call", () => {
    const s = ride();
    const a = hurtAt(s, spot!);
    run(s, SETTLE + 1);
    expect(s.rescue).toHaveLength(1);
    const call = s.rescue![0];
    expect(call.kind).toBe("sled");
    expect(call.sleds).toBeDefined();
    expect(call.sledsTaken).toEqual([null, null]);
    expect(call.casualties[0].amateur).toBe(a.id);
    expect(call.casualties[0].look?.body).toBe(a.body);
    expect(call.up).toBeGreaterThan(call.start + call.sleds!.go);
    run(s, 0.1);
    expect(a.mode).toBe("lift");
  });

  it("leaves a machine to steal while they work, and the book keeps it stolen", () => {
    const s = ride();
    hurtAt(s, spot!);
    run(s, SETTLE + 1);
    const call = s.rescue![0];
    const plan = call.sleds!;
    // On to when the machines stand parked, and beside the second.
    run(s, plan.parked[1] + 2);
    const p = plan.park[1];
    standSkier(s, p.x + Math.cos(p.heading) * 2.2, p.z - Math.sin(p.heading) * 2.2, p.heading);
    expect(stealWithin(s)?.livery).toBe("patrol");
    stepRun(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.sled!.livery).toBe("patrol");
    expect(call.sledsTaken![1]).not.toBeNull();
    const next = bookRun(createRescueBook(), s, ride());
    const kept = next.rescue![0];
    expect(kept.kind).toBe("sled");
    expect(kept.sledsTaken).toEqual(call.sledsTaken);
    expect(kept.casualties[0].amateur).toBeUndefined();
    expect(kept.casualties[0].look).toEqual(call.casualties[0].look);
  });
});
