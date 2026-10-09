// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI AS THE HUD READS IT (`snapshot.ts`'s `afterski`), DOM-free:
// the way to the nearest lodge's door while one is near him on a free ride
// (`near` once he stands where the machine press takes him in), the room
// while he is in it, and — after a buzzed fall — the skis he has still to
// fetch — and, in town, the skis on his shoulder (`town.ts`). The BUZZ
// itself is the snapshot's own `buzz`.

import { AFTERSKI, afterskiWithin, doorOf, lodgesOf, type GameState } from "@engine";

export type HudAfterski =
  | { kind: "call"; away: number; near: boolean }
  | { kind: "inside"; beers: number; total: number; drinking: boolean }
  | { kind: "fetch"; left: number }
  /** In town on foot: `walking` once the pair is on his shoulder, false
   * while it is coming off his feet or going back on. */
  | { kind: "town"; walking: boolean };

/** How far from a lodge's door the HUD calls it, m. */
const CALL = 45;

export function afterskiOf(state: GameState): HudAfterski | null {
  const c = state.skier;
  if (c.town) return { kind: "town", walking: c.town.phase === "walk" };
  const a = state.afterski;
  if (!a) return null;
  if (c.fetch) return { kind: "fetch", left: c.fetch.carried.filter((k) => !k).length };
  if (a.inside) return { kind: "inside", beers: a.beers, total: a.total, drinking: a.sip >= 0 };
  if (c.thrown || c.lift || state.heli?.rider || state.sled?.rider) return null;
  let away = Infinity;
  for (const lodge of lodgesOf(state.level)) {
    // The door he has just come out of is not called until he is away.
    if (lodge.id === a.out) continue;
    const door = doorOf(lodge);
    away = Math.min(away, Math.hypot(door.x - c.x, door.z - c.z));
  }
  if (away > CALL) return null;
  return { kind: "call", away: Math.max(0, away - AFTERSKI.reach), near: afterskiWithin(state) };
}
