// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OTHER SKIERS' TRACKS ON THE PISTE (`pwa/src/game/piste-tracks.ts`):
// how many and how churned off the hours of traffic, and the piste's own
// frame the lines are laid in — presentation only.

import { DataUtils } from "three";
import { describe, expect, it } from "vitest";

import { pisteDayOf, type Level } from "@engine";

import { NO_TRACKS, trackFrameOf, tracksOf } from "../pwa/src/game/piste-tracks.ts";
import { snowpackOf } from "../pwa/src/game/snowpack.ts";
import { syntheticLevel } from "./support/synthetic.ts";

describe("piste tracks", () => {
  it("none before the first chair, then more and more churned through the day", () => {
    expect(tracksOf(0)).toEqual(NO_TRACKS);
    let was = tracksOf(0.25);
    expect(was.many).toBeGreaterThan(0);
    expect(was.churn).toBe(0);
    for (const h of [0.5, 1, 2, 4, 6, 8]) {
      const t = tracksOf(h);
      expect(t.many).toBeGreaterThanOrEqual(was.many);
      expect(t.churn).toBeGreaterThanOrEqual(was.churn);
      was = t;
    }
    expect(tracksOf(2).many).toBeGreaterThan(0.9);
    expect(tracksOf(8).churn).toBe(1);
  });

  it("the snowpack reads them off the map's own hour", () => {
    const level = syntheticLevel();
    const at = (hour: number) => {
      const lv = { ...level, sun: { ...level.sun, hour } } as Level;
      return snowpackOf(lv).tracks;
    };
    expect(at(8.5).many).toBe(0);
    expect(at(11).many).toBeGreaterThan(0.5);
    expect(at(15).churn).toBeGreaterThan(at(11).churn);
    expect(at(11)).toEqual(
      tracksOf(pisteDayOf({ ...level, sun: { ...level.sun, hour: 11 } }).skied),
    );
  });

  it("the frame says how far across and down the piste a cell is", () => {
    // A straight piste heading +x (heading π/2), 30 m wide, 200 m long.
    const points = Array.from({ length: 101 }, (_, i) => ({
      x: i * 2,
      z: 0,
      s: i * 2,
      heading: Math.PI / 2,
      width: 30,
    }));
    const frame = trackFrameOf({ points }, 2, DataUtils.toHalfFloat);
    const un = DataUtils.fromHalfFloat;
    // A cell by its column and row, and where its middle is.
    const read = (c: number, r: number) => {
      const k = (r * frame.cols + c) * 4;
      return {
        x: frame.x0 + c * frame.cell,
        z: frame.z0 + r * frame.cell,
        across: un(frame.data[k]),
        whole: un(frame.data[k + 1]),
        rest: un(frame.data[k + 2]),
        inside: un(frame.data[k + 3]),
      };
    };
    const row = Math.round(-frame.z0 / frame.cell);
    for (const [c, r] of [
      [50, row],
      [60, row - 5],
      [70, row + 3],
    ]) {
      const at = read(c, r);
      expect(at.inside).toBe(1);
      expect(at.whole + at.rest).toBeCloseTo(at.x, 1);
      // Right of the way down is −z when it runs +x.
      expect(at.across).toBeCloseTo(-at.z, 2);
      // The 64s whole and the rest under 64, so a half float carries both.
      expect(at.whole % 64).toBe(0);
      expect(at.rest).toBeLessThan(64);
    }
    // Far off the piste the frame has nothing.
    expect(read(50, 0).inside).toBe(0);
  });
});
