// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A CANOPY CATCHES (`chute.ts`'s snag): the cloth and the lines
// against the crowns, a lift's ropes, its towers' columns and the chairs and
// cabins hanging from it — a pure question of where everything is this step.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { crownAt } from "./canopy.ts";
import type { ChuteSnag, ChuteState } from "./chute-state.ts";
import { CHUTE } from "./defs/chute.ts";
import { carrierAt, carrierPlace, liftPlans, ropeAt, upRope } from "./lift-line.ts";
import type { GameState } from "./state.ts";

/** WHAT THE CANOPY HAS CAUGHT ON this step, if anything: the cloth (its
 * middle and either tip) or the lines in a crown, or on a lift's rope, a
 * tower's column or a chair or cabin hanging from it — the canopy `span`
 * m from tip to tip. */
export function snagOf(state: GameState, ch: ChuteState, span: number): ChuteSnag | null {
  const c = state.skier;
  const level = state.level;
  const half = span / 2;
  const rx = Math.cos(ch.canopyHeading);
  const rz = -Math.sin(ch.canopyHeading);
  const pts = [
    { x: ch.x, y: ch.y, z: ch.z },
    { x: ch.x + rx * half, y: ch.y, z: ch.z + rz * half },
    { x: ch.x - rx * half, y: ch.y, z: ch.z - rz * half },
    { x: ch.x + rx * half * 0.5, y: ch.y, z: ch.z + rz * half * 0.5 },
    { x: ch.x - rx * half * 0.5, y: ch.y, z: ch.z - rz * half * 0.5 },
    ...[0.33, 0.66].map((s) => ({
      x: c.x + (ch.x - c.x) * s,
      y: c.y + (ch.y - c.y) * s,
      z: c.z + (ch.z - c.z) * s,
    })),
  ];
  const held = (on: ChuteSnag["on"], index: number, p: { x: number; y: number; z: number }) => ({
    on,
    index,
    x: p.x,
    y: p.y,
    z: p.z,
    lines: Math.max(1.5, hypot3(p.x - c.x, p.y - c.y, p.z - c.z)),
  });
  const S = CHUTE.snag;
  for (let i = 0; i < 5; i++) {
    const p = pts[i];
    const tree = crownAt(level, p.x, p.y, p.z, S.crown);
    if (tree >= 0) return held("tree", tree, p);
  }
  const plans = liftPlans(level);
  for (let k = 0; k < plans.length; k++) {
    const plan = plans[k];
    const bx = plan.lift.bottom.x;
    const bz = plan.lift.bottom.z;
    const r = upRope(plan);
    for (const p of pts) {
      const u = (p.x - bx) * plan.dx + (p.z - bz) * plan.dz;
      const v = (p.x - bx) * plan.dz - (p.z - bz) * plan.dx;
      if (u < -4 || u > plan.length + 4 || Math.abs(v) > r + 6) continue;
      // The towers' columns.
      for (const s of plan.supports) {
        if (s.station || p.y < s.ground || p.y > s.ground + s.rope + 1) continue;
        if (hypot(p.x - s.x, p.z - s.z) < plan.look.column + S.tower) return held("tower", k, p);
      }
      if (u < 0 || u > plan.length) continue;
      const rope = ropeAt(plan, u);
      // The ropes, up and down: a point of the cloth or the lines near one,
      // or the lines from him to the canopy laid across it.
      for (const side of [r, -r]) {
        if (hypot(v - side, p.y - rope) < S.rope) return held("rope", k, p);
        if (p !== pts[0]) continue;
        // In the line's cross-section: the lines, him to the canopy, passing
        // within reach of the rope.
        const hv = (c.x - bx) * plan.dz - (c.z - bz) * plan.dx;
        const dv = v - hv;
        const dy = p.y - c.y;
        const sh = clamp(((side - hv) * dv + (rope - c.y) * dy) / (dv * dv + dy * dy + 1e-9), 0, 1);
        if (hypot(hv + dv * sh - side, c.y + dy * sh - rope) < S.rope) {
          const at = { x: c.x + (p.x - c.x) * sh, y: rope, z: c.z + (p.z - c.z) * sh };
          return held("rope", k, at);
        }
      }
      // A chair or a cabin hung under it.
      if (plan.lift.kind === "drag" || p.y > rope + 0.5 || p.y < rope - plan.look.hang - 1.5) {
        continue;
      }
      const n = Math.max(1, Math.floor((2 * plan.length) / plan.look.every));
      for (let j = 0; j < n; j++) {
        const spot = carrierAt(plan, j, state.t);
        if (!spot.out || Math.abs(spot.u - u) > 4) continue;
        const at = carrierPlace(plan, spot);
        const cy = ropeAt(plan, spot.u) - plan.look.hang * 0.6;
        if (hypot3(p.x - at.x, p.y - cy, p.z - at.z) < S.carrier) return held("carrier", k, p);
      }
    }
  }
  return null;
}
