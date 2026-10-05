// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE A-NET BULGING round what it caught (three-free): a downhill's net
// is drawn as a sheet on its line (`gates.ts`), and a body or a ski driven
// into it (`nets.ts`'s `catchInNets`) is past that line — so the sheet is
// pushed out round each of them, the way a real net billows into a pocket
// round a racer and closes over his skis: most where the thing is, dying
// away along the net over `reach` m and up and down it over `rise` m, held
// at its top by the cable. What is in the net is the engine's own answer
// (`Thrown.netted`, `netPocket`); this module only shapes the sheet.

import { netPocket, speedCourseOf, type GameState, type Level } from "@engine";

/** THE BULGE: how far along the net, m, and up and down it, m, a dent is
 * felt, and how far the sheet stands out past what made it, m — it lies
 * over him, not through him. */
export const NET_BULGE = { reach: 3.5, rise: 1.3, over: 0.15 } as const;

/** One thing in a net: where it is, the way out through the net there and
 * how far past the net's line it stands, m. */
export type NetDent = { x: number; y: number; z: number; ux: number; uz: number; past: number };

/** Everything of the thrown skier in a net this step — his body's points
 * (`Thrown.netted`) and his skis' ends — written into `out`, which is
 * returned. Empty while nobody is down. */
export function netDents(state: GameState, out: NetDent[]): NetDent[] {
  out.length = 0;
  const b = state.skier.thrown;
  if (!b) return out;
  const level = state.level;
  const add = (pts: readonly number[], j: number): void => {
    const net = netPocket(level, pts[j], pts[j + 2]);
    if (net) out.push({ x: pts[j], y: pts[j + 1], z: pts[j + 2], ...net });
  };
  if (b.netted) {
    for (let i = 0; 3 * i < b.points.length; i++) if (b.netted & (1 << i)) add(b.points, 3 * i);
  }
  for (const ski of b.skis) {
    add(ski.ends, 0);
    add(ski.ends, 3);
  }
  return out;
}

/** How far out the net's sheet at (x, y, z) — on its line, `up` m over its
 * foot of a net `height` m tall — is pushed by `dents`, m (0 for none),
 * and which way: the deepest dent's own way out. */
export function bulgeAt(
  x: number,
  y: number,
  z: number,
  up: number,
  height: number,
  dents: readonly NetDent[],
  out: { by: number; ux: number; uz: number },
): typeof out {
  out.by = 0;
  // The cable along its top holds it.
  const hold = 1 - (up / height) ** 2;
  if (hold <= 0) return out;
  for (const d of dents) {
    // Where the dent stands on the net's line.
    const along = Math.hypot(x - (d.x - d.ux * d.past), z - (d.z - d.uz * d.past));
    if (along >= NET_BULGE.reach) continue;
    const dy = y - d.y;
    if (Math.abs(dy) >= NET_BULGE.rise) continue;
    const a = 1 - (along / NET_BULGE.reach) ** 2;
    const v = 1 - (dy / NET_BULGE.rise) ** 2;
    const by = (d.past + NET_BULGE.over) * a * a * v * v * hold;
    if (by <= out.by) continue;
    out.by = by;
    out.ux = d.ux;
    out.uz = d.uz;
  }
  return out;
}

/** Whether `level` carries A-nets a body can be caught in. */
export function hasNets(level: Level): boolean {
  return speedCourseOf(level) !== null;
}
