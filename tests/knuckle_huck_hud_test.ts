// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KNUCKLE HUCK AS THE APP READS IT (`knuckle-huck-run.ts`): the jam on
// the HUD — the clock left, the hits, the place, the last hit called — the
// board at the buzzer, and a press or a butter as the judges call it
// (`strings-bigair.ts`'s `trickName`).

import { describe, expect, it } from "vitest";

import {
  KNUCKLE_HUCK,
  createGame,
  hitImpression,
  jamKind,
  readTrick,
  type FlightRecord,
  type GameState,
} from "@engine";

import { jamOf } from "../pwa/src/game/knuckle-huck-run.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";

function flight(over: Partial<FlightRecord> = {}): FlightRecord {
  return {
    flight: 1,
    flip: 0,
    spin: 0,
    grabs: [],
    air: 1,
    length: 12,
    height: 1,
    switchIn: false,
    switchOut: false,
    landing: 0.2,
    outcome: "landed",
    t: 10,
    ...over,
  };
}

const BUTTER = flight({ spin: Math.PI / 2, butter: { end: "nose", held: 1, yaw: Math.PI / 2 } });

/** A jam with `hits` hits of `f` ridden, at `t` s of its clock. */
function jammed(hits: number, t: number, f = BUTTER): GameState {
  const state = createGame({ seed: 11, mode: "knuckleHuck", quiet: true });
  for (let k = 0; k < hits; k++) {
    state.jam!.hits.push({
      trick: f,
      t: t - (hits - k) * 15,
      fell: false,
      impression: hitImpression(f, false),
      kind: jamKind(readTrick(f)),
    });
  }
  state.progress.time = t;
  return state;
}

describe("the knuckle huck on the HUD and the plate", () => {
  it("reads a fresh jam: the whole clock, no hit, no mark", () => {
    const hud = jamOf(createGame({ seed: 11, mode: "knuckleHuck", quiet: true }));
    expect(hud?.left).toBe(KNUCKLE_HUCK.jam);
    expect(hud?.hits).toBe(0);
    expect(hud?.riders).toBe(KNUCKLE_HUCK.field + 1);
    expect(hud?.score).toBe(0);
    expect(hud?.last).toBeNull();
    expect(hud?.done).toBe(false);
    expect(hud?.board).toEqual([]);
  });

  it("is null on any other run", () => {
    expect(jamOf(createGame({ seed: 11, mode: "bigAir", quiet: true }))).toBeNull();
  });

  it("calls the last hit and marks the session as it stands", () => {
    const hud = jamOf(jammed(3, 60));
    expect(hud?.hits).toBe(3);
    expect(hud?.left).toBe(KNUCKLE_HUCK.jam - 60);
    expect(hud?.score).toBeGreaterThan(0);
    expect(hud?.last?.trick?.butter?.end).toBe("nose");
    expect(hud?.last?.ago).toBeCloseTo(15, 5);
    expect(hud?.place).toBeGreaterThanOrEqual(1);
    expect(hud?.place).toBeLessThanOrEqual(KNUCKLE_HUCK.field + 1);
  });

  it("draws the whole board at the buzzer, the player on it once", () => {
    const state = jammed(5, KNUCKLE_HUCK.jam);
    state.jam!.closed = true;
    const hud = jamOf(state);
    expect(hud?.done).toBe(true);
    expect(hud?.board).toHaveLength(KNUCKLE_HUCK.field + 1);
    expect(hud?.board.filter((r) => r.you)).toHaveLength(1);
    expect(hud?.board.find((r) => r.you)?.place).toBe(hud?.place);
  });
});

describe("a press and a butter as the judges call them", () => {
  it("names the end, the way and the turn", () => {
    expect(STRINGS.trickName(readTrick(BUTTER))).toBe("NOSE BUTTER RIGHT 180");
    const tail = flight({
      spin: -1.5 * Math.PI,
      butter: { end: "tail", held: 1, yaw: -Math.PI / 2 },
    });
    expect(STRINGS.trickName(readTrick(tail))).toBe("TAIL BUTTER LEFT 360");
    const press = flight({ butter: { end: "nose", held: 1, yaw: 0 } });
    expect(STRINGS.trickName(readTrick(press))).toBe("NOSE PRESS");
    const flip = flight({ flip: 2 * Math.PI, butter: { end: "nose", held: 1, yaw: 0 } });
    expect(STRINGS.trickName(readTrick(flip))).toBe("NOSE PRESS BACKFLIP");
  });
});

describe("a butter's stance", () => {
  it("is the way he rode into it, not the way he left the lip", () => {
    const wound = flight({
      spin: Math.PI / 2,
      switchIn: true,
      butter: { end: "nose", held: 1, yaw: 1.7 },
    });
    expect(STRINGS.trickName(readTrick(wound))).toBe("NOSE BUTTER RIGHT 180");
    const away = flight({
      spin: Math.PI,
      switchIn: true,
      butter: { end: "nose", held: 1, yaw: 1.2 },
    });
    expect(readTrick(away).switchIn).toBe(true);
  });
});
