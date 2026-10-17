import { describe, expect, it } from "vitest";

import { createAttemptRace, poolWidth } from "../pwa/src/game/attempt-race.ts";

describe("the map's attempts run side by side", () => {
  it("keeps the lowest attempt accepted, once every one below it is refused", () => {
    const race = createAttemptRace(16);
    expect([race.next(), race.next(), race.next()]).toEqual([0, 1, 2]);
    expect(race.settle(2, true)).toEqual({ kind: "open" });
    // Nothing above an accepted attempt is started.
    expect(race.next()).toBeNull();
    expect(race.settle(0, false)).toEqual({ kind: "open" });
    expect(race.settle(1, true)).toEqual({ kind: "won", attempt: 1 });
  });

  it("starts the next attempt as each one is refused", () => {
    const race = createAttemptRace(4);
    race.next();
    race.next();
    expect(race.settle(0, false)).toEqual({ kind: "open" });
    expect(race.next()).toBe(2);
    expect(race.settle(1, false)).toEqual({ kind: "open" });
    expect(race.next()).toBe(3);
    expect(race.settle(3, true)).toEqual({ kind: "open" });
    expect(race.settle(2, false)).toEqual({ kind: "won", attempt: 3 });
  });

  it("names the attempts that can no longer win", () => {
    const race = createAttemptRace(8);
    for (let i = 0; i < 4; i++) race.next();
    race.settle(1, true);
    expect(race.moot().sort()).toEqual([2, 3]);
  });

  it("is lost when every attempt is refused", () => {
    const race = createAttemptRace(2);
    race.next();
    race.next();
    expect(race.settle(1, false)).toEqual({ kind: "open" });
    expect(race.settle(0, false)).toEqual({ kind: "lost" });
    expect(race.next()).toBeNull();
  });

  it("leaves a core to the page and holds no more than four", () => {
    expect(poolWidth(2)).toBe(2);
    expect(poolWidth(6)).toBe(4);
    expect(poolWidth(16)).toBe(4);
    expect(poolWidth(0)).toBe(3);
  });
});
