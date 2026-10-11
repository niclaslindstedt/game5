// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SNOWBOARD (`engine/sim/bot.ts`): a skid turns a board's one
// deck across his way, so the bot sheds speed through a hard turn by
// letting the tail slide rather than standing the board across his line —
// which had him sliding down the fall line past a gate on seed 6. Every
// gate of that run is taken now.

import { describe, expect, it } from "vitest";

import { LYNX, simulateRun } from "@engine";

describe("the bot on a board", () => {
  it("takes every gate of seed 6's red on the Lynx", { timeout: 120_000 }, () => {
    const r = simulateRun(6, { spec: LYNX });
    expect(r.finished).toBe(true);
    expect(r.missed).toBe(0);
    expect(r.wipeouts).toBe(0);
  });
});
