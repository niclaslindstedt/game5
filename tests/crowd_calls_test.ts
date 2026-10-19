// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR HURT, AND THE AIR AMBULANCE CALLED FOR HIM MID-RUN
// (`engine/game/crowd-hurt.ts`, `pwa/src/game/crowd-calls.ts`): a share of
// the crowd's own falls leave one down, injuries on or off; once he lies
// still a machine is sent for him in the run's own calls, he is the
// rescue's from then, a second one near it is taken by the same machine,
// the landed machine can be taken with the press — safe for work too — and
// the book carries the call into the runs after.

import { describe, expect, it } from "vitest";
import {
  CROWD,
  NEUTRAL_INPUT,
  createGame,
  heliDoor,
  hurtFall,
  standSkier,
  stealWithin,
  step,
  throwAmateur,
  waitsForRescue,
  type Amateur,
  type GameState,
} from "@engine";

import { MOST, SETTLE, callCrowd, stepRun } from "../pwa/src/game/crowd-calls.ts";
import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);

const ride = (sfw = false): GameState =>
  createGame({ level, seed: 38, mode: "free", crowd: 24, quiet: true, sfw, gore: !sfw });

const run = (s: GameState, seconds: number, through = stepRun): void => {
  for (let i = 0; i < Math.round(seconds * 120); i++) through(s, NEUTRAL_INPUT);
};

/** Amateur `k` of the run thrown down hurt where he skis. */
function hurt(s: GameState, k: number): Amateur {
  const a = s.crowd!.amateurs.filter((m) => m.mode === "ski")[k];
  throwAmateur(a, 1, "roll");
  a.timer = 2;
  a.hurt = true;
  return a;
}

describe("an amateur hurt on his own", () => {
  it("is a share of his own falls, never a draw, and only where the ambulance flies", () => {
    const s = ride();
    const race = createGame({ level, seed: 38, mode: "downhill", quiet: true });
    const a = { ...s.crowd!.amateurs[0] };
    let hurtRoll = 0;
    let hurtSkier = 0;
    let hurtRace = 0;
    const N = 20000;
    const draws = s.crowd!.rng.int(0, 1 << 30);
    const again = ride().crowd!.rng.int(0, 1 << 30);
    for (let i = 0; i < N; i++) {
      for (const run of [s, race]) run.t = i / 120;
      for (const [run, cause, add] of [
        [s, "roll", () => hurtRoll++],
        [s, "skier", () => hurtSkier++],
        [race, "landing", () => hurtRace++],
      ] as const) {
        delete a.hurt;
        a.id = i % 400;
        hurtFall(run, a, cause);
        if (a.hurt) add();
      }
    }
    expect(Math.abs(hurtRoll / N - CROWD.fall.hurt)).toBeLessThan(CROWD.fall.hurt * 0.25);
    // A body run into is `person-hit.ts`' to judge, and a race flies no ambulance.
    expect(hurtSkier).toBe(0);
    expect(hurtRace).toBe(0);
    // ...and the crowd's stream is drawn as it was.
    expect(draws).toBe(again);
  });

  it("lies where he fell, past getting up, until he is called for", () => {
    const s = ride();
    const a = hurt(s, 0);
    run(s, SETTLE + 8, step);
    expect(a.mode).toBe("down");
    expect(waitsForRescue(a)).toBe(true);
    // A fall that hurt nobody: up again in a few seconds.
    const t = ride();
    const b = t.crowd!.amateurs.filter((m) => m.mode === "ski")[0];
    throwAmateur(b, 1, "roll");
    b.timer = 2;
    run(t, SETTLE + 8, step);
    expect(b.mode).not.toBe("down");
  });
});

describe("the air ambulance called for him mid-run", () => {
  it("is sent once he lies still, to where he lies, in his own kit", () => {
    const s = ride();
    const a = hurt(s, 0);
    run(s, SETTLE - 0.5);
    expect(s.rescue ?? []).toHaveLength(0);
    const lay = { x: a.thrown!.x, z: a.thrown!.z };
    run(s, 1);
    expect(s.rescue).toHaveLength(1);
    const call = s.rescue![0];
    expect(call.start).toBeGreaterThan(0);
    expect(call.start).toBeLessThanOrEqual(s.t);
    expect(call.down).toBeGreaterThan(call.start);
    expect(call.up).toBeGreaterThan(call.down);
    const c = call.casualties[0];
    expect(c.amateur).toBe(a.id);
    expect(c.look?.body).toBe(a.body);
    expect(c.look?.dress).toHaveLength(6);
    expect(Math.hypot(c.x - lay.x, c.z - lay.z)).toBeLessThan(1);
    // ...and from the call he is the rescue's: off the crowd's snow.
    run(s, 0.1);
    expect(a.mode).toBe("lift");
    expect(a.hurt).toBeUndefined();
    expect(a.thrown).toBeNull();
    // Called once.
    run(s, 5);
    expect(s.rescue).toHaveLength(1);
  });

  it("takes a second one down near it on the same machine", () => {
    const s = ride();
    hurt(s, 0);
    run(s, SETTLE + 0.5);
    const call = s.rescue![0];
    const up = call.up;
    const near = s.crowd!.amateurs.find((m) => m.mode === "ski")!;
    near.x = call.casualties[0].x + 6;
    near.z = call.casualties[0].z + 4;
    near.y = level.groundAt(near.x, near.z);
    throwAmateur(near, -1, "landing");
    near.hurt = true;
    run(s, SETTLE + 0.5);
    expect(s.rescue).toHaveLength(1);
    expect(call.casualties).toHaveLength(2);
    expect(call.casualties[1].amateur).toBe(near.id);
    expect(call.casualties[1].known).toBeGreaterThan(0);
    expect(call.up).toBeGreaterThan(up);
  });

  it("sends no more than its machines, the rest waiting their turn", () => {
    const s = ride();
    for (let k = 0; k < MOST + 1; k++) hurt(s, k);
    // Far apart enough not to share a machine is the map's to say; at most
    // `MOST` machines either way.
    run(s, SETTLE + 0.5);
    const crowd = s.rescue!.filter((r) => r.casualties.some((c) => c.amateur !== undefined));
    expect(crowd.length).toBeLessThanOrEqual(MOST);
    const called = crowd.reduce((n, r) => n + r.casualties.length, 0);
    expect(called).toBeLessThanOrEqual(MOST + 1);
  });

  it("makes the same calls on the same steps, run again", () => {
    const a = ride();
    const b = ride();
    hurt(a, 1);
    hurt(b, 1);
    run(a, SETTLE + 2);
    run(b, SETTLE + 2);
    expect(JSON.stringify(b.rescue)).toBe(JSON.stringify(a.rescue));
    expect(callCrowd(a)).toBe(0);
  });

  it("is a machine to take once it is down, safe for work too", () => {
    for (const sfw of [false, true]) {
      const s = ride(sfw);
      hurt(s, 0);
      run(s, SETTLE + 0.5);
      const call = s.rescue![0];
      run(s, call.down - s.t + 2);
      const door = heliDoor(call.site);
      standSkier(s, door.x, door.z, 0);
      expect(stealWithin(s)?.livery).toBe("rescue");
      stepRun(s, { ...NEUTRAL_INPUT, machine: true });
      expect(s.heli!.livery).toBe("rescue");
      expect(s.rescue![0].stolen).toBeDefined();
    }
  });

  it("is carried into the next run by the book, for whoever he was", () => {
    const s = ride();
    hurt(s, 0);
    run(s, SETTLE + 2);
    const made = s.rescue![0];
    const next = bookRun(createRescueBook(), s, ride());
    expect(next.rescue).toHaveLength(1);
    const kept = next.rescue![0];
    expect(kept.start).toBeCloseTo(made.start - s.t, 6);
    expect(kept.site).toEqual(made.site);
    // The next run's crowd is another: nobody in it is his.
    expect(kept.casualties[0].amateur).toBeUndefined();
    expect(kept.casualties[0].look).toEqual(made.casualties[0].look);
  });
});
