// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP'S AUDIENCE, AS A PLAN — where the crowd of a jumping stadium
// stands (R43, `level.skiJump`), laid through `planSpectators`' own dealer
// on the stadium `ski-jump-arena-plan.ts` builds, so it is one plan, one
// stream and one look with every other race's crowd. Three-free and
// DOM-free.
//
// WHERE A SKI JUMP'S CROWD STANDS (the research is the arena plan's):
//
//   * MOST of them in the stadium round the out-run: the grandstands down
//     both sides, packed row on row, and the terraces across its foot over
//     the counter-slope, every face turned up the hill to the jumper.
//   * UP THE LANDING HILL behind the fences either side, from past the
//     knoll down to the stands — a couple of rows high up and eight deep by
//     the out-run, where the jumps land and the telemarks are seen. On the
//     left the fence stands further out: the broadcast's rail and its
//     landing camera run between it and the boards.
//   * THE COACHES on their two platforms, beside the take-off and the
//     landing, waving the jumper off.
//   * NOBODY on the in-run, at the tower, in the out-run or by the judges.

import { hillPoint, landingWidth } from "./ski-jump-frame.ts";
import type { JumpArenaPlan } from "./ski-jump-arena-plan.ts";
import { SJ_LOOK, skiJumpPlan } from "./ski-jump-plan.ts";
import type { Fence, FanDealer } from "./spectator-plan.ts";

/** The numbers a jumping stadium's crowd is laid by, m unless said. */
export const JUMP_FANS = {
  /** A stand's places: elbow room along a row, each taken at `fill`. */
  spacing: 0.58,
  fill: 0.93,
  /** Beside the landing hill: a fan every `spacing` m, row `row` behind
   * the next, each place taken at `fill`, on ground up to `steep` (stepped
   * into the snow, as a hill's crowd stands — the landing hill's own pitch
   * is 37°). */
  hill: { spacing: 0.62, row: 0.72, fill: 0.86, steep: 1.1 },
  /** Kept clear of every mast, flag, meter, board post and platform, m. */
  clear: 1.2,
  /** The coaches on each platform. */
  coaches: 9,
} as const;

/** THE CROWD round `level`'s jumping hill — the stands, the hill's banks
 * and the coaches — and the nets the hill's banks stand behind. */
export function planJumpBanks(dealer: FanDealer, arena: JumpArenaPlan): Fence[] {
  const { level, rng } = dealer;
  const f = arena.frame;
  const hill = f.hill;
  const J = JUMP_FANS;
  const fences: Fence[] = [];

  // THE STANDS: a fan a place, row on row, looking up the hill.
  arena.stands.forEach((s, i) => {
    const from = dealer.fans.length;
    const bx = -Math.sin(s.facing);
    const bz = -Math.cos(s.facing);
    const ax = Math.cos(s.facing);
    const az = -Math.sin(s.facing);
    const look = arena.looks[i];
    const kind = i < 2 ? "stand" : "back";
    for (let r = 0; r < s.rows; r++) {
      for (let k = -s.width / 2 + 0.5; k <= s.width / 2 - 0.5; k += J.spacing) {
        if (!rng.chance(J.fill)) continue;
        const back = (r + 0.5) * s.tread + rng.range(-0.1, 0.1);
        const along = k + rng.range(-0.1, 0.1);
        const x = s.x + ax * along + bx * back;
        const z = s.z + az * along + bz * back;
        const yaw = Math.atan2(look.x - x, look.z - z);
        dealer.seat(x, s.y + r * s.rise, z, yaw, kind, k + s.width / 2 + r * 0.37);
      }
    }
    dealer.close(kind, from);
  });

  // WHAT THE HILL'S CROWD KEEPS CLEAR OF: the masts, the flags, the wind
  // meters, the boards' posts and the platforms.
  const hp = skiJumpPlan(level);
  const keep: { x: number; z: number; r: number }[] = [];
  if (hp) {
    for (const m of hp.masts) keep.push({ x: m.x, z: m.z, r: J.clear });
    const at = (d: number, a: number, r: number) => {
      const p = hillPoint(f, d, a);
      keep.push({ x: p.x, z: p.z, r });
    };
    for (const m of hp.meters)
      at(m.d, m.side * (landingWidth(hill, m.d) / 2 + SJ_LOOK.meter.out), J.clear);
    for (const c of hp.coaches) {
      for (let k = -SJ_LOOK.coach.wide / 2; k <= SJ_LOOK.coach.wide / 2; k += 1.5)
        at(c.d + k, c.side * c.off, SJ_LOOK.coach.deep / 2 + J.clear);
    }
    for (const d of hp.judges.d) at(d, hp.judges.side * hp.judges.off, SJ_LOOK.judges.deep + 1);
  }
  const clear = (x: number, z: number): boolean =>
    keep.every((k) => (k.x - x) ** 2 + (k.z - z) ** 2 >= k.r * k.r);

  // UP THE LANDING HILL, behind a net either side.
  const H = J.hill;
  for (const b of arena.hillBanks) {
    const from = dealer.fans.length;
    const net: { x: number; z: number }[] = [];
    let along = 0;
    let netted = -Infinity;
    for (let d = b.d0; d <= b.d1; d += H.spacing) {
      if (along - netted >= 2) {
        netted = along;
        const p = hillPoint(f, d, b.side * b.fence(d));
        net.push({ x: p.x, z: p.z });
      }
      // The crowd faces across the hill and up it, toward the knoll.
      const towards = hillPoint(f, d - 35, 0);
      const deep = b.rows(d);
      for (let r = 0; r < deep; r++) {
        if (!rng.chance(H.fill - r * 0.04)) continue;
        const a = b.side * (b.front(d) + r * H.row + rng.range(-0.12, 0.18));
        const p = hillPoint(f, d + rng.range(-0.18, 0.18), a);
        if (!clear(p.x, p.z)) continue;
        const yaw = Math.atan2(towards.x - p.x, towards.z - p.z);
        dealer.put(p.x, p.z, yaw, "finish", along, H.steep);
      }
      along += H.spacing;
    }
    if (net.length > 1) fences.push({ points: net, height: 1.1, kind: "net" });
    dealer.close("finish", from);
  }

  // THE COACHES on their platforms.
  if (hp) {
    for (const c of hp.coaches) {
      const from = dealer.fans.length;
      const a = c.side * c.off;
      const foot = hillPoint(f, c.d, a);
      const g = Math.max(
        level.groundAt(foot.x, foot.z),
        ...[-1, 1].map((k) => {
          const p = hillPoint(f, c.d + (k * SJ_LOOK.coach.wide) / 2, a);
          return level.groundAt(p.x, p.z);
        }),
      );
      const deck = g + SJ_LOOK.coach.deck;
      const looking = hillPoint(f, c.d < hill.edge ? hill.edge : c.d - 8, 0);
      for (let i = 0; i < J.coaches; i++) {
        const k = -SJ_LOOK.coach.wide / 2 + 0.5 + ((SJ_LOOK.coach.wide - 1) * i) / (J.coaches - 1);
        const p = hillPoint(f, c.d + k, a + rng.range(-0.6, 0.6));
        dealer.seat(p.x, deck, p.z, Math.atan2(looking.x - p.x, looking.z - p.z), "start", k);
      }
      dealer.close("start", from);
    }
  }
  return fences;
}
