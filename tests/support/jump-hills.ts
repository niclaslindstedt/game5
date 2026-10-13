// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// One ski jumping hill rebuilt and held to its row (`jump-hills.ts`): its
// map to its digest with no park, the hill R43 cuts on it to the hill's own
// digest, the line its box draws, and a contest stood up on its own day —
// shared by `jump_hills_test.ts` (the normal hills) and
// `jump_hills_large_test.ts` (the large).

import { expect } from "vitest";

import { SKIS, FULL_ASSIST, createGame, levelDigest, weatherOf } from "@engine";
import { MAP_ROUTES } from "../../pwa/src/game/map-routes.ts";
import { routeOf } from "../../pwa/src/game/route-shape.ts";
import { trickGameOptions } from "../../pwa/src/game/trick-maps.ts";
import { withJumpContest } from "../../pwa/src/game/ski-jump-run.ts";
import {
  buildJumpHill,
  hillProfile,
  jumpHillLevel,
  type JumpHill,
} from "../../pwa/src/game/jump-hills.ts";

const SKIER = { spec: SKIS, assist: FULL_ASSIST, damage: false };

export function checkHill(row: JumpHill): void {
  const built = buildJumpHill(row);
  expect(built.version).toBe(row.version);
  expect(levelDigest(built), `${row.id}'s map moved`).toBe(row.digest);
  // No park on a hill's map: the hill is what it was chosen for.
  expect((built.kickers ?? []).some((k) => k.trick)).toBe(false);
  const hill = jumpHillLevel(row, built);
  expect(hill.skiJump?.hill).toBe(row.hill);
  expect(levelDigest(hill), `${row.id}'s hill moved`).toBe(row.hillDigest);
  expect(MAP_ROUTES[row.id], `${row.id}'s line — run \`make routes\``).toBe(
    routeOf(hillProfile(hill)),
  );
  const state = createGame({
    ...withJumpContest({ ...trickGameOptions(row, SKIER, built), mode: "skiJump" }),
    quiet: true,
  });
  expect(state.level.skiJump?.hill).toBe(row.hill);
  expect(state.skiJumpContest).toBeDefined();
  expect(state.level.sun.dayOfYear).toBe(row.day.dayOfYear);
  expect(state.level.sun.hour).toBeCloseTo(row.day.hour, 6);
  // The jury let the day stand as the card bills it.
  expect(weatherOf(state.level).kind).toBe(row.day.weather);
}
