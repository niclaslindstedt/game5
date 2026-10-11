// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREESTYLE JUDGES (`judge.ts`): a flight read as the trick it turned,
// an impression marked by what it turned, how high and how it came down,
// and a panel of six whose highest and lowest marks are dropped — the
// reader and the marks slopestyle's jumps, the halfpipe's hits and the
// moguls' airs are called and scored by.

import { describe, expect, it } from "vitest";

import {
  JUDGING,
  impressionOf,
  panelScore,
  readTrick,
  trickKind,
  type FlightRecord,
} from "@engine";

/** A table's length the impressions are marked against, m. */
const TABLE = 15;

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
    landing: 0.3,
    outcome: "landed",
    t: 10,
    ...over,
  };
}

describe("the judges", () => {
  it("read a flight as the trick it turned", () => {
    const r = readTrick(flight({ spin: -4 * Math.PI + 0.2, flip: 2 * Math.PI * 2 - 0.3 }));
    expect(r.spin).toBe(720);
    expect(r.dir).toBe("left");
    expect(r.flips).toBe(2);
    expect(r.flipDir).toBe("back");
    expect(r.offAxis).toBe(true);
    expect(trickKind(r)).toBe("left");
    expect(trickKind(readTrick(flight({ flip: -2 * Math.PI })))).toBe("front");
    expect(trickKind(readTrick(flight()))).toBe("straight");
  });

  it("score a harder trick higher, a fall low and a knuckled jump down", () => {
    const table = TABLE;
    const straight = impressionOf(flight({ grabs: ["grab"] }), table, false);
    const cork = impressionOf(flight({ spin: 8 * Math.PI, flip: 4 * Math.PI }), table, false);
    const fell = impressionOf(
      flight({ spin: 8 * Math.PI, flip: 4 * Math.PI, outcome: "fell" }),
      table,
      false,
    );
    const short = impressionOf(flight({ length: table - 2 }), table, false);
    expect(cork).toBeGreaterThan(straight + 30);
    expect(fell).toBeLessThan(JUDGING.fall + JUDGING.fallSpan + 0.01);
    expect(short).toBeLessThan(impressionOf(flight(), table, false));
  });

  it("drop the highest and lowest of six marks and cut the mean to two decimals", () => {
    for (let jump = 0; jump < 20; jump++) {
      const s = panelScore(70.4, 7, jump);
      expect(Math.abs(s - 70.4)).toBeLessThanOrEqual(JUDGING.spread + 0.5);
      expect(Math.round(s * 100)).toBeCloseTo(s * 100, 6);
      expect(panelScore(70.4, 7, jump)).toBe(s);
    }
  });
});
