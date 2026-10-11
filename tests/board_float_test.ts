// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BOARD FLOATS: in deep powder the engine sinks a snowboard's stations
// tens of centimetres, but the drawn deck rides at the snow's surface — at
// most a few centimetres under it at a crawl — and the cut it draws under
// itself is as shallow (`trail-stamp.ts`'s `boardCut`, `board-input.ts`'s
// `boardRideSink`). Skis are drawn in their furrow as before.

import { describe, expect, it } from "vitest";

import { createGame, LYNX, NEUTRAL_INPUT, placeRun, rotate, step, type GameState } from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { boardLift, boardRideSink } from "../pwa/src/game/board-input.ts";
import { boardCut, drawnDepth, LOOSE, TRAIL } from "../pwa/src/game/trail-stamp.ts";

/** A board ridden down untracked powder at `speed` m/s on the deep dial. */
function ridden(speed: number, brake: number): GameState {
  const level = flatLevel({ size: 600, packed: 0, grade: 0.35 });
  const s = createGame({ level, spec: LYNX, rivals: 0, quiet: true, snowDepth: 2.5 });
  placeRun(s, { x: 300, z: 100, heading: 0, speed });
  for (let k = 0; k < 240; k++) step(s, { ...NEUTRAL_INPUT, brake });
  return s;
}

/** How far under the drawn snow's surface the drawn deck stands, m. */
function buried(s: GameState): number {
  const k = s.skier;
  const touching = k.contacts.filter((c) => c.touching);
  const mean = touching.reduce((a, c) => a + c.sink, 0) / touching.length;
  // The deck as `boardLift` raises it, then lowered by the root's sink.
  const lifted = Math.min(0.08, mean);
  const sink = boardRideSink(k, s.level, s.snowDepth, true);
  // Every station on untracked powder: the drawn snow is the ground and
  // its loose cover; the engine's station stands `c.sink` under the ground.
  return (
    touching.reduce((a, c) => a + (c.y + LOOSE) - (c.y - c.sink + lifted - sink), 0) /
    touching.length
  );
}

describe("a snowboard in deep powder", () => {
  it("sinks in the engine, and floats in the picture at a crawl", () => {
    const s = ridden(1, 0.6);
    const k = s.skier;
    const deepest = Math.max(...k.contacts.filter((c) => c.touching).map((c) => c.sink));
    expect(deepest).toBeGreaterThan(0.15);
    const under = buried(s);
    expect(under).toBeGreaterThanOrEqual(0);
    expect(under).toBeLessThanOrEqual(TRAIL.board.bury + 1e-6);
  });

  it("rides higher still at speed", () => {
    const slow = buried(ridden(1, 0.6));
    const fast = buried(ridden(12, 0));
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeLessThanOrEqual(TRAIL.board.bury);
  });

  it("cuts a trench no deeper than its float, where a ski's goes down with the sink", () => {
    const k = ridden(1, 0.6).skier;
    for (const c of k.contacts.filter((x) => x.touching)) {
      expect(boardCut(c, 0, 1, 2.5, undefined, 0.5)).toBeLessThanOrEqual(TRAIL.board.bury);
      expect(drawnDepth(c, 0, 1, 2.5)).toBeGreaterThanOrEqual(c.sink);
    }
  });
});

describe("a snowboard hopped along in deep powder", () => {
  it("keeps the deck out of the snow between hops", () => {
    const level = flatLevel({ size: 600, packed: 0 });
    const s = createGame({ level, spec: LYNX, rivals: 0, quiet: true, snowDepth: 2.5 });
    placeRun(s, { x: 300, z: 100, heading: 0, speed: 0.5 });
    let hops = 0;
    for (let k = 0; k < 600; k++) {
      step(s, { ...NEUTRAL_INPUT, tuck: 1 });
      const sk = s.skier;
      if (sk.contacts.some((c) => c.touching) || (sk.board?.hop ?? 0) <= 0) continue;
      hops++;
      const sink = boardRideSink(sk, level, s.snowDepth, true);
      expect(sink).toBeLessThanOrEqual(0);
      const lift = boardLift(sk);
      const up = rotate(sk.q, { x: 0, y: 1, z: 0 });
      const deck = sk.y + up.y * ((lift[0] + lift[1]) / 2 - sk.spec.cogHeight) - sink;
      expect(deck).toBeGreaterThanOrEqual(level.groundAt(sk.x, sk.z) + LOOSE - 1e-9);
    }
    expect(hops).toBeGreaterThan(0);
  });
});
