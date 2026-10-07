// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S CABIN VIEWS (`make world ARGS=--views=cabin,cabins-air`):
// the log buildings beside the runs (`cabinsOf`) as a skier and a drone see
// them, through the game's own renderer.
//
//   * cabin, cabin-2, cabin-3 — a group of buildings (the ones with a
//     companion first) from the run it stands beside, a skier's eye 30 m down
//     the run below it, looking back up at it;
//   * cabin-near — the first group's building close, at three quarters
//     from its front on the side with the clearest view, the lens a little
//     over its floor;
//   * cabins-air — the busiest corner of the ski area (the group with most
//     groups round it), from a drone 120–200 m up out over the valley,
//     looking down at it;
//   * lodge, lodge-near, lodge-2 — an afterski lodge from the snow before
//     its terrace, close off one end of its racks, and the mountain's (the
//     afterski lab's, `make afterski`);
//   * tower-pad, tower-edge, tower-span — the lift towers where they meet
//     the runs (`tower-view.ts`'s).

import { cabinsOf, trackPointAt, type Cabin, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { TOWER_VIEWS, towerView } from "./tower-view.ts";

/** The views this module answers for the world lab. */
export const SITE_VIEWS = [
  "cabin",
  "cabin-2",
  "cabin-3",
  "cabin-near",
  "cabins-air",
  ...TOWER_VIEWS,
] as const;

/** The groups' first buildings, the ones with a companion first. */
function groupsOf(level: Level): Cabin[] {
  const all = cabinsOf(level);
  const firsts = all.filter((c, i) => all.findIndex((o) => o.group === c.group) === i);
  const size = (c: Cabin): number => all.filter((o) => o.group === c.group).length;
  return firsts.sort((a, b) => size(b) - size(a) || a.group - b.group);
}

function pose(
  eye: { x: number; z: number },
  high: number,
  at: Cabin,
  rise: number,
  level: Level,
  fov = 58,
): LensPose {
  return {
    eye: { x: eye.x, y: level.groundAt(eye.x, eye.z) + high, z: eye.z },
    target: { x: at.x, y: at.y + rise, z: at.z },
    fov,
    roll: 0,
  };
}

/** How far round a group the drone looks for its neighbours, m. */
const NEIGHBOURS = 260;

/** A drone over the busiest corner of the ski area: the group with the
 * most other groups within `NEIGHBOURS` m, and those groups' middle seen
 * from 120–200 m up out over the valley below it, looking down at about
 * 45°, so the runs and their cabins read together. */
function aerial(level: Level, groups: Cabin[]): { pose: LensPose; note: string } {
  const near = (a: Cabin): Cabin[] =>
    groups.filter((b) => Math.hypot(a.x - b.x, a.z - b.z) < NEIGHBOURS);
  const best = groups.map(near).sort((a, b) => b.length - a.length || a[0].group - b[0].group)[0];
  const mx = best.reduce((a, c) => a + c.x, 0) / best.length;
  const mz = best.reduce((a, c) => a + c.z, 0) / best.length;
  let span = 0;
  for (const a of best)
    for (const b of best) span = Math.max(span, Math.hypot(a.x - b.x, a.z - b.z));
  // Far enough back that the lot fits the frame, 120–200 m up at 45°.
  const high = Math.min(200, Math.max(120, span * 0.6));
  const out = high;
  // Out over the valley: down the fall line of the ground under them.
  const y = level.groundAt(mx, mz);
  const gx = level.groundAt(mx + 20, mz) - level.groundAt(mx - 20, mz);
  const gz = level.groundAt(mx, mz + 20) - level.groundAt(mx, mz - 20);
  const g = Math.hypot(gx, gz) || 1;
  // Back past the group lowest down, so every one is in front of the lens.
  const dx = -gx / g;
  const dz = -gz / g;
  const ahead = Math.max(0, ...best.map((c) => (c.x - mx) * dx + (c.z - mz) * dz));
  const ex = mx + dx * (ahead + out);
  const ez = mz + dz * (ahead + out);
  return {
    pose: {
      eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 30, y + high), z: ez },
      target: { x: mx, y, z: mz },
      fov: 52,
      roll: 0,
    },
    note: `from the air: ${best.map((c) => c.id).join(", ")}, ${Math.round(span)} m across`,
  };
}

/** THE AFTERSKI LODGES (`lodge`, `lodge-near`, `lodge-2`): the valley's
 * (or the mountain's, `lodge-2`) from a skier's eye on the snow out before
 * its terrace, square on — and close, from off one end of its racks. */
function lodgeView(level: Level, name: string): { pose: LensPose; note: string } | null {
  const lodges = cabinsOf(level).filter((c) => c.kind === "afterski");
  const c = lodges[name === "lodge-2" ? Math.min(1, lodges.length - 1) : 0];
  if (!c) return null;
  const near = name === "lodge-near";
  const a = c.heading + (near ? 0.6 : 0.12);
  const far = near ? 19 : 34;
  const eye = { x: c.x + Math.sin(a) * far, z: c.z + Math.cos(a) * far };
  const high = Math.max(1.7, c.y + (near ? 1.2 : 0.4) - level.groundAt(eye.x, eye.z));
  const at = {
    ...c,
    x: c.x + Math.sin(c.heading) * (near ? 9 : 4),
    z: c.z + Math.cos(c.heading) * (near ? 9 : 4),
  };
  return {
    pose: pose(eye, high, at, near ? 1.2 : 2.6, level, near ? 55 : 50),
    note: `afterski ${c.id}, ${lodges.length} on the map, ${Math.round(c.y - (level.mountain?.base.y ?? 0))} m up`,
  };
}

export function cabinView(level: Level, name: string): { pose: LensPose; note: string } | null {
  if (name.startsWith("lodge")) return lodgeView(level, name);
  if (name.startsWith("tower")) return towerView(level, name);
  const groups = groupsOf(level);
  if (groups.length === 0) return null;
  const pick = name === "cabin-2" ? 1 : name === "cabin-3" ? 2 : 0;
  const c = groups[Math.min(pick, groups.length - 1)];
  const said = `${c.id} (${c.kind}) by ${c.run}, ${cabinsOf(level).length} buildings on the map`;
  if (name === "cabin-near") {
    // Three quarters from the front, whichever side has no trunk in the
    // way: the turn off its front with the fewest trees by the sight line.
    const blockers = (a: number): number => {
      const ex = c.x + Math.sin(a) * 18;
      const ez = c.z + Math.cos(a) * 18;
      let n = 0;
      for (const t of level.trees) {
        const vx = c.x - ex;
        const vz = c.z - ez;
        const k = Math.max(
          0,
          Math.min(1, ((t.x - ex) * vx + (t.z - ez) * vz) / (vx * vx + vz * vz)),
        );
        if (Math.hypot(ex + vx * k - t.x, ez + vz * k - t.z) < 2.5 + t.crown * 0.5) n++;
      }
      return n;
    };
    const turns = [0.55, -0.55, 0.85, -0.85, 0.25, -0.25].map((d) => c.heading + d);
    const a = turns.reduce((best, t) => (blockers(t) < blockers(best) ? t : best), turns[0]);
    const eye = { x: c.x + Math.sin(a) * 18, z: c.z + Math.cos(a) * 18 };
    const high = Math.max(3.2, c.y + 2.5 - level.groundAt(eye.x, eye.z));
    return { pose: pose(eye, high, c, 2.4, level, 50), note: `close: ${said}` };
  }
  if (name === "cabins-air") return aerial(level, groups);
  const run = level.resort?.runs.find((r) => r.id === c.run);
  const line = run ? { track: { points: run.points, length: run.length } } : level;
  const p = trackPointAt(line, c.s + 30);
  return { pose: pose(p, 1.7, c, 2.5, level), note: `from the run: ${said}` };
}
