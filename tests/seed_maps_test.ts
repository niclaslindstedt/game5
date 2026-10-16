// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The start card's worker (`seed-maps.ts`) builds the map on the card and
// the next mountain ahead of it. Off the card to the rider card, the ride's
// world is built behind the cards — so the worker and the map ahead go
// first (`leaveSeedCard`): on a phone the two together were more memory
// than the tab was given.
/// <reference path="../pwa/src/vite-env.d.ts" />
import { afterEach, describe, expect, it, vi } from "vitest";

/** Every worker spawned, what it was asked and whether it was ended. */
type Fake = {
  asked: { seed: number }[];
  ended: boolean;
  onmessage: ((e: { data: unknown }) => void) | null;
};
const workers: Fake[] = [];

vi.stubGlobal("__APP_VERSION__", "test");
vi.stubGlobal("window", {
  setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
  clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
});
vi.stubGlobal(
  "Worker",
  class implements Fake {
    asked: { seed: number }[] = [];
    ended = false;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      workers.push(this);
    }
    postMessage(ask: { seed: number }): void {
      this.asked.push(ask);
    }
    terminate(): void {
      this.ended = true;
    }
  },
);

const { leaveSeedCard, wantSeed } = await import("../pwa/src/game/seed-maps.ts");

/** The charts looked for in the store (none here) and the worker asked. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** The worker answers its last job: refused, so nothing is painted. */
const answer = (w: Fake, seed: number) =>
  w.onmessage?.({
    data: { seed, region: "alpine", face: null, grade: null, ok: false, error: "" },
  });

const ask = (seed: number) => ({ seed, region: "alpine" as const, face: null, grade: null });

describe("the start card's worker", () => {
  afterEach(() => {
    leaveSeedCard(ask(0));
    workers.length = 0;
  });

  it("is ended off the card while it builds the next mountain ahead", async () => {
    wantSeed(ask(788882));
    await settle();
    const w = workers.at(-1)!;
    expect(w.asked.map((a) => a.seed)).toEqual([788882]);
    answer(w, 788882);
    await settle();
    // On to the mountain after it.
    expect(w.asked).toHaveLength(2);
    expect(w.asked[1].seed).not.toBe(788882);
    expect(w.ended).toBe(false);
    leaveSeedCard(ask(788882));
    expect(w.ended).toBe(true);
    // Back on the start card, it asks again.
    wantSeed(ask(788882));
    await settle();
    expect(workers.length).toBe(2);
  });

  it("finishes the ride's own map first, then goes", async () => {
    wantSeed(ask(42));
    await settle();
    const w = workers.at(-1)!;
    leaveSeedCard(ask(42));
    expect(w.ended).toBe(false);
    answer(w, 42);
    await settle();
    expect(w.asked).toHaveLength(1);
    expect(w.ended).toBe(true);
  });
});
