// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INJURY LAB'S MOMENTS, held: every scenario in
// `tests/support/injury-scenarios.ts` — a pose and a speed into the snow by
// its kind, off a cliff, into a trunk, a tower's steel or its pad, a log
// wall — staged `TRIALS` times on the bench (`injury-stage.ts`) and its
// rates held to what it expects (`missesOf`). `make injuries` prints the
// same rows with every rate beside them.
import { describe, expect, it } from "vitest";

import { INJURIES, type InjuryKind } from "@engine";
import { ratesOf } from "./support/injury-stage.ts";
import { INJURY_SCENARIOS, missesOf } from "./support/injury-scenarios.ts";

describe("the injury lab's moments", () => {
  for (const s of INJURY_SCENARIOS) {
    it(`${s.id}: ${s.title}`, () => {
      expect(missesOf(s, ratesOf(s))).toEqual([]);
    });
  }

  it("names each moment once, and only injuries the catalog has", () => {
    const ids = INJURY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const named = INJURY_SCENARIOS.flatMap((s) => [...s.expect.flat(), ...(s.never ?? [])]);
    for (const kind of named) expect(INJURIES[kind as InjuryKind], kind).toBeDefined();
  });
});
