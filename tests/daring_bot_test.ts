// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DARING BOT and THE SHOWCASE it rides under the menu's cards: the knob
// is off by default (the plain rider and every digest unmoved), and with it
// on, on the showcase's rules, the bot gets a lot of air, lands most of it,
// leaves the piste, and is stood up again at the top by the restart rule.

import { describe, expect, it } from "vitest";
import {
  createGame,
  DARING,
  DARING_BOT,
  fieldRules,
  rideShowcase,
  RIDER_BOT,
  roamAt,
  showcaseNow,
  showcaseOptions,
  showcaseOver,
  showcaseRules,
  step,
  TUNING,
  venueOf,
  type SkierInput,
} from "@engine";
import { levelFor } from "./support/levels.ts";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

const still: SkierInput = { steer: 0, tuck: 0, brake: 1, lean: 0, reset: false };

describe("the daring knob", () => {
  it("is off on the plain rider, so nothing it rides moves", () => {
    expect(RIDER_BOT.daring).toBeUndefined();
    expect(DARING_BOT.daring).toBeDefined();
  });

  it("is reached only through the showcase flag: a run without one is the field's", () => {
    const level = levelFor(1);
    const plain = createGame({ level, seed: 1, quiet: true });
    expect(plain.showcase).toBeUndefined();
    expect(plain.rules).toEqual(fieldRules(1));
    const shown = createGame({ level, seed: 1, quiet: true, showcase: 0 });
    expect(shown.showcase).toBe(0);
    expect(shown.rules).toEqual(showcaseRules(1));
  });

  it("deals the showcase no course, no field and every trick", () => {
    const r = showcaseRules(1);
    expect(r.course).toBe(false);
    expect(r.stunts).toBe(true);
    expect(r.tricks).toBe(true);
    expect(r.countdown).toBe(0);
    expect(r.limit).toBe(0);
  });

  it("skis each take its own way", () => {
    const level = levelFor(1);
    const a = createGame({ level, seed: 1, quiet: true, showcase: 0 });
    const b = createGame({ level, seed: 1, quiet: true, showcase: 1 });
    const offsets = [100, 400, 700, 1000].map((s) => [roamAt(a, s, DARING), roamAt(b, s, DARING)]);
    expect(offsets.some(([x, y]) => x !== y)).toBe(true);
  });
});

describe("the showcase", () => {
  it("hands a plain mountain's run to the backdrop and keeps a venue's or a free ride's", () => {
    const level = levelFor(1);
    const race = createGame({ level, seed: 1, quiet: true });
    expect(venueOf(level)).toBe(false);
    expect(showcaseNow(race)).toBe(true);
    const free = createGame({ level, seed: 1, quiet: true, mode: "free" });
    expect(showcaseNow(free)).toBe(false);
    const next = showcaseOptions(race);
    expect(next.showcase).toBe(0);
    expect(showcaseOptions(createGame(next)).showcase).toBe(1);
  });

  it("is over at once on a dead-flat map, all of it the valley floor", () => {
    const state = createGame({ level: flatLevel(), seed: 1, quiet: true, showcase: 0 });
    let end = null;
    for (let i = 0; i < 5 * TUNING.physicsHz && !end; i++) {
      step(state, still);
      end = showcaseOver(state);
    }
    expect(end).toBe("bottom");
  });

  it("is over when he has gone nowhere downhill for a while", () => {
    const state = createGame({ level: syntheticLevel(), seed: 1, quiet: true, showcase: 0 });
    let end = null;
    for (let i = 0; i < 14 * TUNING.physicsHz && !end; i++) {
      step(state, still);
      end = showcaseOver(state);
    }
    expect(end).toBe("stalled");
  });

  it("is ridden daring: much air, most of it landed, off the piste, and down to the bottom", () => {
    const level = levelFor(1);
    const rider = rideShowcase(level, 240, RIDER_BOT);
    const daring = rideShowcase(level, 240, DARING_BOT);
    expect(daring.flights).toBeGreaterThanOrEqual(10);
    expect(daring.flights).toBeGreaterThan(rider.flights * 2);
    expect(daring.longest).toBeGreaterThanOrEqual(1.5);
    expect(daring.tricks).toBeGreaterThanOrEqual(5);
    expect(daring.banked).toBeGreaterThan(daring.bailed * 3);
    expect(daring.wipeouts).toBeLessThanOrEqual(2);
    expect(daring.offPiste).toBeGreaterThan(0.1);
    expect(daring.ends.stalled).toBe(0);
    expect(daring.ends.bottom).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
