// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL RUN DOWN, AS DRAWN, HEARD AND SAID — the three-free half of
// what is left of one (`beast-wreck.ts`): which side the blow landed on,
// whether anything is left whole, the blood it has to lose; and the sound
// (`route.ts`, `wild-bank.ts`) and the news line (`run-news.ts`) a hit
// earns by what it did.

import { describe, expect, it } from "vitest";

import { beastById, type BeastEvent, type StruckBeast } from "@engine";
import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import { bledBetween, bloodOut, wreckOf, WRECK } from "../pwa/src/game/beast-wreck.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import type { GameState } from "@engine";

function struck(over: Partial<StruckBeast>): StruckBeast {
  return {
    group: 0,
    member: 0,
    species: "moose",
    t: 4,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    killed: true,
    crush: 0.6,
    knocked: true,
    ...over,
  };
}

function event(over: Partial<BeastEvent>): BeastEvent {
  return {
    kind: "beast",
    t: 1,
    species: "moose",
    group: 0,
    member: 0,
    x: 0,
    y: 0,
    z: 0,
    speed: 20,
    height: 1.9,
    taken: 15,
    thrown: false,
    killed: true,
    crush: 0.8,
    ...over,
  };
}

describe("an animal run down, as drawn", () => {
  it("is met on the side the fling left: flung to its right, struck on its left", () => {
    // Facing +z (heading 0), its right is +x.
    const moose = beastById("moose");
    expect(wreckOf(struck({ vx: 5 }), moose).side).toBe(-1);
    expect(wreckOf(struck({ vx: -5 }), moose).side).toBe(1);
    const w = wreckOf(struck({ vx: 5 }), moose);
    expect(Math.abs(w.along)).toBeLessThanOrEqual(WRECK.along * moose.length + 1e-9);
  });

  it("bursts only small and killed and crushed past `burst`", () => {
    const hare = beastById("hare");
    const moose = beastById("moose");
    expect(wreckOf(struck({ species: "hare", crush: 0.9 }), hare).burst).toBe(true);
    expect(wreckOf(struck({ species: "hare", crush: 0.1 }), hare).burst).toBe(false);
    expect(wreckOf(struck({ species: "hare", crush: 0.9, killed: false }), hare).burst).toBe(false);
    expect(wreckOf(struck({ crush: 1 }), moose).burst).toBe(false);
  });

  it("bleeds out what it has to lose, and never more", () => {
    const moose = beastById("moose");
    const all = bloodOut(moose, 1);
    // Some 70 ml a kilogram, a good half of it out on the snow.
    expect(all).toBeGreaterThan(10);
    expect(all).toBeLessThan(moose.mass * 0.07);
    let sum = 0;
    for (let u = 0; u < 120; u += 0.5) sum += bledBetween(moose, 1, u, u + 0.5);
    expect(sum).toBeCloseTo(all, 1);
    expect(bledBetween(moose, 0, 0, 10)).toBe(0);
  });
});

describe("an animal run into, as heard and said", () => {
  const state = { skier: {}, events: [] } as unknown as GameState;

  it("knocked down thumps and cries; killed is run clean through; a brush is a bump", () => {
    expect(soundForEvent(event({ killed: false, speed: 8, taken: 3 }))?.id).toBe("beast_knock");
    expect(soundForEvent(event({}))?.id).toBe("beast_crush");
    expect(soundForEvent(event({ killed: false, speed: 1, taken: 0.2 }))?.id).toBe("bump");
    expect(RUN_BANK.beast_knock).toBeDefined();
    expect(RUN_BANK.beast_crush).toBeDefined();
    // The bigger and the harder, the louder.
    const hare = soundForEvent(event({ species: "hare", height: 0.35, taken: 1, crush: 0.2 }));
    const moose = soundForEvent(event({}));
    expect(moose!.shape!.gain!).toBeGreaterThan(hare!.shape!.gain!);
  });

  it("says a blow that did not throw him, and leaves a throw to the wipeout", () => {
    expect(newsFor(event({ species: "hare", thrown: false }), state)?.text).toBe(
      STRINGS.newsBeastSplat(STRINGS.beastWord.hare),
    );
    expect(newsFor(event({ killed: false, speed: 6 }), state)?.text).toBe(
      STRINGS.newsBeastKnocked(STRINGS.beastWord.moose),
    );
    expect(newsFor(event({ thrown: true }), state)).toBeNull();
    expect(newsFor(event({ killed: false, speed: 1 }), state)).toBeNull();
  });
});
