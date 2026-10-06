// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAIL JAM AS THE APP READS IT (`knuckle-huck-run.ts`, the jam both
// formats share): a rail jam's session on the HUD — its own field of
// riders, the last hit called as the feature it was ridden on — the board
// at the buzzer, and a feature's trick as it is named
// (`strings-railjam.ts`'s `jibName`).

import { describe, expect, it } from "vitest";

import {
  RAIL_JAM,
  createGame,
  railHitImpression,
  railKind,
  type GameState,
  type JibRecord,
} from "@engine";

import { jamOf } from "../pwa/src/game/knuckle-huck-run.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";

const RIDE: JibRecord = {
  id: "F4",
  section: 4,
  kind: "rail",
  on: 270,
  off: 90,
  stances: ["slide"],
  swaps: 0,
  press: null,
  pressed: 0,
  length: 10,
  whole: true,
  t: 0,
};

/** A rail jam with `hits` hits of `r` ridden, at `t` s of its clock. */
function jammed(hits: number, t: number, r = RIDE): GameState {
  const state = createGame({ seed: 11, mode: "railJam", quiet: true });
  for (let k = 0; k < hits; k++) {
    state.jam!.hits.push({
      trick: null,
      t: t - (hits - k) * 12,
      fell: false,
      impression: railHitImpression(r, false),
      kind: railKind(r),
      jib: r,
    });
  }
  state.progress.time = t;
  return state;
}

describe("the rail jam on the HUD and the plate", () => {
  it("reads a fresh jam on its own clock and field", () => {
    const hud = jamOf(createGame({ seed: 11, mode: "railJam", quiet: true }));
    expect(hud?.format).toBe("rail");
    expect(hud?.left).toBe(RAIL_JAM.jam);
    expect(hud?.riders).toBe(RAIL_JAM.field + 1);
    expect(hud?.last).toBeNull();
  });

  it("calls the last hit as the feature it was ridden on", () => {
    const hud = jamOf(jammed(3, 60));
    expect(hud?.last?.jib?.ride.id).toBe("F4");
    expect(hud?.last?.jib?.shape).toBe("downFlatDown");
    expect(hud?.last?.trick).toBeNull();
    expect(hud?.score).toBeGreaterThan(0);
  });

  it("names a feature's trick on and off", () => {
    expect(STRINGS.jibName(RIDE, "downFlatDown")).toBe("270 ON · SLIDE · 90 OUT · KINKED RAIL");
    expect(
      STRINGS.jibName(
        { ...RIDE, kind: "box", on: 0, off: 0, stances: ["fifty"], press: "nose" },
        "down",
      ),
    ).toBe("50-50 · NOSE PRESS · DOWN BOX");
  });

  it("puts the whole board on the plate at the buzzer", () => {
    const state = jammed(4, RAIL_JAM.jam);
    state.jam!.closed = true;
    const hud = jamOf(state);
    expect(hud?.done).toBe(true);
    expect(hud?.board).toHaveLength(RAIL_JAM.field + 1);
    expect(hud?.board.filter((r) => r.you)).toHaveLength(1);
  });
});
