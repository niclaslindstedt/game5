// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RACE'S FURNITURE IS SOLID (`pwa/src/game/drawn-solids.ts`): a slalom's
// start house walled round its door, a ski cross's start frame and the
// boards along its platform, and a ski jump's piers, tower, masts, boards,
// flags and stands — on the maps those races are run on, in their modes.

import { describe, expect, it } from "vitest";

import { createGame } from "@engine";

import { drawnKinds } from "../pwa/src/game/drawn-solids.ts";
import { JUMP_HILLS, jumpHillLevel } from "../pwa/src/game/jump-hills.ts";
import { buildPinnedLevel } from "../pwa/src/game/pinned.ts";
import { RACE_MAPS } from "../pwa/src/game/race-maps.ts";
import { meets } from "./support/drawn-hits.ts";

describe("a race's furniture is solid", () => {
  it("walls a slalom's start house round its door", () => {
    const slalom = RACE_MAPS.slalom![0];
    const run = createGame({ seed: slalom.seed, level: buildPinnedLevel(slalom), mode: "slalom" });
    expect(meets(run.level, "start house", "slalom")).toBe(true);
  });

  it("stands a ski cross's start frame and walls its platform", () => {
    const cross = RACE_MAPS.skiCross![0];
    const run = createGame({ seed: cross.seed, level: buildPinnedLevel(cross), mode: "skiCross" });
    expect(meets(run.level, "cross gate", "skiCross")).toBe(true);
  });

  it("stands a ski jump's piers, tower, masts, boards, flags and stands", () => {
    const hill = createGame({ seed: 1, level: jumpHillLevel(JUMP_HILLS[0]), mode: "skiJump" });
    const posts = drawnKinds(hill.level).get("ski jump") ?? [];
    // The floodlight masts down both sides, and the tower standing tall.
    expect(posts.filter((u) => u.radius === 0.18).length).toBeGreaterThanOrEqual(8);
    expect(posts.some((u) => u.height > 20)).toBe(true);
  });
});
