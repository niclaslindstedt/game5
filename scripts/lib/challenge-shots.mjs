// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES' SCREENSHOT MOMENTS (`scripts/screenshot.mjs`'s
// `challenge-*` surfaces): where on a seed's free ride the skier is stood so
// the HUD shows a challenge, and the book a capture's page is handed so the
// pause card's list, the minimap and the statistics' tally have medals to
// show. Read off the game's own deal (`dealChallenges`) — a free ride's map
// deals the same challenges whichever run it was stood up on, so the seed's
// default build is the map the app rides.
//
//   line    stood 5 m above a timed line's start gate, running down its
//           run, so the clock starts a moment in and the chip comes up;
//   kicker  stood 12 m short of a trick kicker's lip at speed, square to it,
//           so he flies it, lands, and the plate comes up.
//
// The book (`fall-line.challenges.v1`) holds a silver on the first line, a
// gold on the first kicker, two hidden spots found and half the summits.

import { join } from "node:path";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

/** The poses and the book for `seed`'s free ride. */
export async function challengeShots(root, seed) {
  aliasEngine(root);
  const E = await import(join(root, "engine/index.ts"));
  const level = E.generateLevel(seed);
  const plan = E.dealChallenges(level);
  const lines = plan.challenges.filter(E.isLine);
  const tricks = plan.challenges.filter(E.isTrick);
  const spots = plan.challenges.find(E.isSpots);
  const summits = plan.challenges.find(E.isSummits);
  const pose = (x, z, h, v) => [x, z, h, v].map((n) => n.toFixed(3)).join(",");
  const out = { key: plan.key };
  if (lines.length > 0) {
    const line = lines[0];
    const run = E.dealtRuns(level).find((r) => r.id === line.run);
    const p = E.trackPointAt(run, line.start.s - 5);
    out.line = pose(p.x, p.z, p.heading, 12);
  }
  // The kicker with the most room before its lip: the biggest on a run.
  const trick =
    tricks.find((t) => t.run !== null && t.size !== "small") ??
    tricks.find((t) => t.run !== null) ??
    tricks[0];
  if (trick) {
    const k = trick.kicker;
    const back = 12;
    out.kicker = pose(
      k.x - Math.sin(k.heading) * back,
      k.z - Math.cos(k.heading) * back,
      k.heading,
      14,
    );
  }
  const at = Date.UTC(2026, 9, 1);
  const map = {};
  if (lines[0]) map[lines[0].id] = { medal: "silver", value: lines[0].medals.silver - 1.3, at };
  if (lines[1]) map[lines[1].id] = { medal: null, value: lines[1].medals.bronze + 6.2, at };
  if (tricks[0]) map[tricks[0].id] = { medal: "gold", value: 3, at };
  if (spots) {
    const found = spots.spots.slice(0, 2).map((s) => s.id);
    map[spots.id] = { medal: E.medalOf(spots, found.length), value: found.length, found, at };
  }
  if (summits) {
    const found = summits.tops.slice(0, Math.ceil(summits.tops.length / 2)).map((t) => t.lift);
    map[summits.id] = { medal: E.medalOf(summits, found.length), value: found.length, found, at };
  }
  out.book = JSON.stringify({ v: 1, maps: { [plan.key]: map } });
  return out;
}
