// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOSTS' SHARE OF THE STORE (`ghost.ts`'s `saveGhost`): every map beaten
// files a tape, and nothing used to let one go — until `localStorage` was
// full and the record book, the settings and the statistics could no longer
// be saved. The tapes are held to a budget, the oldest let go first, and a
// full store makes room by letting old tapes go rather than refusing.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GHOST_BUDGET,
  GHOST_ORDER,
  GHOST_PREFIX,
  saveGhost,
  type GhostRun,
} from "../pwa/src/game/ghost.ts";

const globals = globalThis as unknown as { localStorage?: unknown };
let store: Map<string, string>;
let quota = Infinity;
let before: unknown;

beforeEach(() => {
  store = new Map();
  quota = Infinity;
  before = globals.localStorage;
  globals.localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      let used = 0;
      for (const [key, value] of store) if (key !== k) used += value.length;
      if (used + String(v).length > quota) throw new Error("QuotaExceededError");
      store.set(k, String(v));
    },
    removeItem: (k: string) => void store.delete(k),
  };
});

afterEach(() => {
  if (before === undefined) delete globals.localStorage;
  else globals.localStorage = before;
});

/** A stand-in tape of about `size` characters (the store never reads it). */
const tape = (id: string, size: number): GhostRun =>
  ({ id, pad: "x".repeat(size) }) as unknown as GhostRun;

const tapes = (): string[] =>
  [...store.keys()]
    .filter((k) => k.startsWith(GHOST_PREFIX))
    .map((k) => k.slice(GHOST_PREFIX.length));

const tapeChars = (): number =>
  [...store].filter(([k]) => k.startsWith(GHOST_PREFIX)).reduce((n, [, v]) => n + v.length, 0);

describe("the ghosts' share of the store", () => {
  it("keeps every tape while they fit the budget, in the order saved", () => {
    for (const id of ["a", "b", "c"]) saveGhost(tape(id, 1000));
    expect(tapes().sort()).toEqual(["a", "b", "c"]);
    expect(JSON.parse(store.get(GHOST_ORDER)!)).toEqual(["a", "b", "c"]);
  });

  it("lets the oldest tapes go once the budget is passed, never the new one", () => {
    const size = Math.floor(GHOST_BUDGET / 4.2);
    for (const id of ["a", "b", "c", "d", "e", "f"]) saveGhost(tape(id, size));
    expect(tapeChars()).toBeLessThanOrEqual(GHOST_BUDGET);
    expect(tapes()).toContain("f");
    expect(tapes()).not.toContain("a");
    expect(tapes()).not.toContain("b");
  });

  it("a tape saved again counts as the newest", () => {
    const size = Math.floor(GHOST_BUDGET / 4.2);
    for (const id of ["a", "b", "a", "c", "d", "e"]) saveGhost(tape(id, size));
    expect(tapes().sort()).toEqual(["a", "c", "d", "e"]);
  });

  it("makes room in a full store by letting old tapes go", () => {
    store.set("fall-line.records.v1", "r".repeat(5000));
    for (const id of ["a", "b"]) saveGhost(tape(id, 2000));
    quota = 9000;
    saveGhost(tape("c", 2000));
    expect(tapes()).toContain("c");
    expect(tapes()).not.toContain("a");
    // What is not a tape is never touched.
    expect(store.get("fall-line.records.v1")).toHaveLength(5000);
  });
});
