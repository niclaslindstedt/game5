// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A BLOW COSTS THE SKIS AND THE LEGS — only on a run that asked for
// it (`GameState.damage`, the player's option; a rival never takes any).
//
// Three figures, each 0 sound … 1 wrecked (`SkierDamage`): the two skis'
// edges and the legs. A trunk dulls the edge on the side it was met on
// (both, a little each, met dead centre); a landing the legs could not take
// hurts the legs by how far past the pair's harsh speed it came in; a
// wipeout adds its own share to what its cause reaches. Nothing mends it
// but a new run — a reset stands a skier on dulled edges back on the piste.
//
// WHAT IT DOES TO THE SKIING is read by `skier.ts` through the four shares
// below, and a sound pair reads exactly 0 and exactly 1 from them, so a run
// without damage is the same arithmetic to the last bit:
//   - a DULLED EDGE pulls the line toward its own side (`skiPull`), and
//     bites less (`skiBite`);
//   - HURT LEGS are softer and less damped (`springShare`, `dampShare`), so
//     they sit lower and fold to the stop sooner — and at a lower speed
//     into the slope (`harshShare`).

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { harshSpeedOf } from "./limits.ts";
import type { DamagePart, GameEvent, GameState, SkierState } from "./state.ts";

const D = TUNING.damage;

/** The pull a dulled edge puts on the skis' line, rad, positive clockwise. */
export function skiPull(c: SkierState): number {
  return D.skiToe * (c.damage.ski[1] - c.damage.ski[0]);
}

/** The share of its sideways bite the ski on `side` (-1 left, +1 right)
 * still has. */
export function skiBite(c: SkierState, side: number): number {
  return 1 - D.skiGrip * c.damage.ski[side < 0 ? 0 : 1];
}

/** The shares of the legs' rate and damping they still have. */
export function springShare(c: SkierState): number {
  return 1 - D.springSoft * c.damage.legs;
}
export function dampShare(c: SkierState): number {
  return 1 - D.dampSoft * c.damage.legs;
}

/** The share of the pair's harsh speed (`harshSpeedOf`) the legs still take. */
export function harshShare(c: SkierState): number {
  return 1 - D.harshSoft * c.damage.legs;
}

function hurt(
  run: GameState,
  part: DamagePart,
  amount: number,
  out: GameEvent[],
  reported: Set<DamagePart>,
): void {
  if (amount <= 0) return;
  const d = run.skier.damage;
  const was = part === "legs" ? d.legs : d.ski[part === "skiLeft" ? 0 : 1];
  const now = clamp(was + amount, 0, 1);
  if (part === "legs") d.legs = now;
  else d.ski[part === "skiLeft" ? 0 : 1] = now;
  if (now - was >= D.report && !reported.has(part)) {
    reported.add(part);
    out.push({ kind: "damage", t: run.t, part, level: now });
  }
}

const reported = new Set<DamagePart>();

/** Charge the skis and the legs for this step's blows (`events`, the run's
 * own). A no-op on a run without damage. */
export function takeDamage(run: GameState, events: GameEvent[]): void {
  if (!run.damage) return;
  const c = run.skier;
  reported.clear();
  const n = events.length;
  for (let i = 0; i < n; i++) {
    const e = events[i];
    if (e.kind === "hit") {
      const over = (e.speed - D.treeFrom) * D.treeRate;
      if (over <= 0) continue;
      // Which side of the skier the trunk was on: his right in plan is
      // (cos h, −sin h).
      const across = (e.x - c.x) * Math.cos(c.heading) - (e.z - c.z) * Math.sin(c.heading);
      if (Math.abs(across) < 0.3) {
        hurt(run, "skiLeft", over / 2, events, reported);
        hurt(run, "skiRight", over / 2, events, reported);
      } else hurt(run, across < 0 ? "skiLeft" : "skiRight", over, events, reported);
    } else if (e.kind === "land") {
      const harsh = harshSpeedOf(c.spec) * harshShare(c);
      hurt(run, "legs", (e.impact - harsh) * D.landRate, events, reported);
    } else if (e.kind === "wipeout") {
      const w = D.wipeout;
      if (e.cause === "tree") hurt(run, "legs", w / 2, events, reported);
      else if (e.cause === "nose") {
        hurt(run, "skiLeft", w, events, reported);
        hurt(run, "skiRight", w, events, reported);
      } else {
        hurt(run, "legs", w, events, reported);
        hurt(run, c.roll > 0 ? "skiRight" : "skiLeft", w / 2, events, reported);
      }
    }
  }
}
