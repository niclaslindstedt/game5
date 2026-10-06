// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S CABIN VIEWS (`make world ARGS=--views=cabin,cabins-air`):
// the log buildings beside the runs (`cabinsOf`) as a skier and a drone see
// them, through the game's own renderer.
//
//   * cabin, cabin-2, cabin-3 — a group of buildings (the ones with a
//     companion first) from the run it stands beside, a skier's eye 30 m down
//     the run below it, looking back up at it;
//   * cabin-near — the first group's building close, at three quarters
//     from its front, the lens a little over its floor;
//   * cabins-air — the first group from a drone 34 m over it and 48 m out
//     in front, with the woods round it.

import { cabinsOf, trackPointAt, type Cabin, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

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

export function cabinView(level: Level, name: string): { pose: LensPose; note: string } | null {
  const groups = groupsOf(level);
  if (groups.length === 0) return null;
  const pick = name === "cabin-2" ? 1 : name === "cabin-3" ? 2 : 0;
  const c = groups[Math.min(pick, groups.length - 1)];
  const said = `${c.id} (${c.kind}) by ${c.run}, ${cabinsOf(level).length} buildings on the map`;
  if (name === "cabin-near") {
    const a = c.heading + 0.55;
    const eye = { x: c.x + Math.sin(a) * 18, z: c.z + Math.cos(a) * 18 };
    const high = Math.max(3.2, c.y + 2.5 - level.groundAt(eye.x, eye.z));
    return { pose: pose(eye, high, c, 2.4, level, 50), note: `close: ${said}` };
  }
  if (name === "cabins-air") {
    const a = c.heading + 0.4;
    const eye = { x: c.x + Math.sin(a) * 48, z: c.z + Math.cos(a) * 48 };
    const high = Math.max(30, c.y + 34 - level.groundAt(eye.x, eye.z));
    return { pose: pose(eye, high, c, 0, level, 42), note: `from the air: ${said}` };
  }
  const run = level.resort?.runs.find((r) => r.id === c.run);
  const line = run ? { track: { points: run.points, length: run.length } } : level;
  const p = trackPointAt(line, c.s + 30);
  return { pose: pose(p, 1.7, c, 2.5, level), note: `from the run: ${said}` };
}
