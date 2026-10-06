// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BIG AIR AS THE APP READS IT (`big-air-run.ts`): the jump on the HUD, the
// panel's score and the board on the plate, what comes next, the contest
// the next run is stood up with — and a trick as the judges call it
// (`strings-bigair.ts`).

import { describe, expect, it } from "vitest";

import {
  BIG_AIR,
  createGame,
  freshBigAir,
  readTrick,
  type BigAirContest,
  type FlightRecord,
  type GameState,
} from "@engine";

import { bigAirOf, nextContest } from "../pwa/src/game/big-air-run.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";

function flight(over: Partial<FlightRecord> = {}): FlightRecord {
  return {
    flight: 1,
    flip: 0,
    spin: 0,
    grabs: [],
    air: 2.2,
    length: 30,
    height: 2,
    switchIn: false,
    switchOut: false,
    landing: 0.2,
    outcome: "landed",
    t: 10,
    ...over,
  };
}

/** A run of `contest` over, with `flights` jumped. */
function jumped(contest: BigAirContest | undefined, flights: FlightRecord[]): GameState {
  const state = createGame({ seed: 11, mode: "bigAir", quiet: true, bigAir: contest });
  state.tricks.flights = flights;
  state.progress.finished = true;
  return state;
}

describe("big air on the HUD and the plate", () => {
  const fresh = createGame({ seed: 11, mode: "bigAir", quiet: true });

  it("reads the qualification's first jump, unjudged while it is on", () => {
    const hud = bigAirOf(fresh);
    expect(hud).not.toBeNull();
    expect(hud?.phase).toBe("qualification");
    expect(hud?.jump).toBe(1);
    expect(hud?.of).toBe(BIG_AIR.qualification);
    expect(hud?.judged).toBeNull();
    expect(hud?.next).toBeNull();
  });

  it("is null on any other run", () => {
    expect(bigAirOf(createGame({ seed: 11, mode: "slalom", quiet: true }))).toBeNull();
  });

  it("judges the jump once the run is over and offers the next", () => {
    const state = jumped(undefined, [flight({ spin: 6 * Math.PI, flip: 2 * Math.PI })]);
    const hud = bigAirOf(state);
    expect(hud?.judged?.score).toBeGreaterThan(40);
    expect(hud?.judged?.trick?.spin).toBe(1080);
    expect(hud?.next).toEqual({ kind: "jump", jump: 2 });
    expect(hud?.board.some((r) => r.you)).toBe(true);
    expect(nextContest(state)?.qualification).toHaveLength(1);
  });

  it("shows each row the jumps taken so far, never a blank for one to come", () => {
    const first = bigAirOf(jumped(undefined, [flight({ spin: 2 * Math.PI })]));
    for (const r of first?.board ?? []) {
      expect(r.scores).toHaveLength(1);
      const line = STRINGS.bigAirRow("qualification", r.scores, r.fell, r.total);
      expect(line).not.toContain("–");
      expect(line).not.toContain("=");
    }
    const c = nextContest(jumped(undefined, [flight({ spin: 2 * Math.PI })])) ?? undefined;
    const second = bigAirOf(jumped(c, [flight({ spin: 4 * Math.PI })]));
    for (const r of second?.board ?? []) expect(r.scores).toHaveLength(2);
    expect(STRINGS.bigAirRow("qualification", [88.25, 40], [false, true], 88.25)).toBe(
      "88.25 · FALL · BEST 88.25",
    );
    expect(STRINGS.bigAirRow("final", [91, 84.5], [false, false], 175.5)).toBe(
      "91.00 · 84.50 · TOTAL 175.50",
    );
    expect(STRINGS.bigAirRow("qualification", [86], [false], 86)).toBe("86.00");
  });

  it("ends the contest after the qualification for a skier who never jumped", () => {
    let c: BigAirContest = freshBigAir(11);
    for (let k = 0; k < BIG_AIR.qualification - 1; k++) c = nextContest(jumped(c, [])) ?? c;
    const last = jumped(c, []);
    expect(bigAirOf(last)?.next?.kind).toBe("out");
    expect(nextContest(last)).toBeNull();
  });
});

describe("a trick as the judges call it", () => {
  it("names the spin, the flips, the cork, the switch and the grab", () => {
    const r = readTrick(
      flight({ spin: -7 * Math.PI, flip: 4 * Math.PI, switchIn: true, grabs: ["grab"] }),
    );
    expect(STRINGS.trickName(r)).toBe("SWITCH LEFT DOUBLE CORK 1260 MUTE");
    expect(STRINGS.trickName(readTrick(flight({ flip: 2 * Math.PI })))).toBe("BACKFLIP");
    expect(STRINGS.trickName(readTrick(flight()))).toBe("STRAIGHT AIR");
    expect(STRINGS.trickName(readTrick(flight({ spin: 2 * Math.PI })))).toBe("RIGHT 360");
  });
});
