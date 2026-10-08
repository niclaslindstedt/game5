// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S RACE-BUILDING VIEWS (`make world ARGS="--views=race-buildings"`,
// and `--slalom` for the start house): the start's and the finish arena's
// buildings through the game's own renderer, where the map stands them.
//
//   * race-house — a slalom's START HOUSE (`--slalom`), from down the
//     course three quarters off its front;
//   * race-hut — the START HUT at the top of the piste (a run with no start
//     house: the lab's default run);
//   * race-stand, race-leader, race-screen — the finish arena's
//     GRANDSTAND, LEADER'S PLATFORM and VIDEO WALL;
//   * race-house-in — the television's shot inside the house, behind the
//     racer, out through the door;
//   * race-buildings — THE SHEET: every one of those from three sides,
//     a row a building, the rows this run has none of marked so.

import type { Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { HOUSE, startHousePlan } from "../game/start-house-plan.ts";
import { HUT, startHutSpot } from "../game/race-build.ts";
import { planSpectators, type SpectatorPlan } from "../game/spectator-plan.ts";

/** What the lens looks at: a middle, the way its front faces, its size. */
type Subject = { x: number; y: number; z: number; facing: number; size: number };

const ROWS = ["house", "hut", "stand", "leader", "screen"] as const;
type Row = (typeof ROWS)[number];

/** The views this module answers for the world lab. */
export const RACE_BUILDING_VIEWS = [
  "race-buildings",
  ...ROWS.map((r) => `race-${r}`),
  "race-house-in",
] as const;

/** The sheet's columns: azimuth off the front (degrees, clockwise from
 * above), the lens's height over the snow, its distance in sizes. */
const ANGLES = [
  { name: "front 3/4", az: 35, high: 2.2, dist: 1.6 },
  { name: "back 3/4", az: 205, high: 4, dist: 1.6 },
  { name: "side, low", az: 100, high: 1.4, dist: 1.0 },
];

let spectators: { level: Level; plan: SpectatorPlan } | null = null;
function arenaOf(level: Level) {
  if (spectators?.level !== level) spectators = { level, plan: planSpectators(level) };
  return spectators.plan;
}

/** Each building's subject on `level`, or null where it has none. */
function subjectOf(level: Level, row: Row): Subject | null {
  const house = startHousePlan(level);
  if (row === "house") {
    if (!house) return null;
    const back = HOUSE.depth / 2;
    return {
      x: house.x - house.fx * back,
      y: house.y + 2,
      z: house.z - house.fz * back,
      facing: house.heading,
      size: 7,
    };
  }
  if (row === "hut") {
    const s = startHutSpot(level, house !== null);
    if (!s) return null;
    // The hut's window looks across to the piste, at its right.
    return { ...s, y: s.y + HUT.height / 2, facing: s.heading + Math.PI / 2, size: 4.5 };
  }
  const plan = arenaOf(level);
  if (row === "stand") {
    const s = plan.stands[0];
    if (!s) return null;
    const bx = -Math.sin(s.facing);
    const bz = -Math.cos(s.facing);
    const deep = (s.rows * s.tread) / 2;
    return {
      x: s.x + bx * deep,
      y: s.y + (s.rows * s.rise) / 2,
      z: s.z + bz * deep,
      facing: s.facing,
      size: Math.min(26, s.width * 0.6),
    };
  }
  const a = plan.arena;
  if (!a) return null;
  if (row === "leader") {
    return {
      x: a.leader.x,
      y: Math.max(level.groundAt(a.leader.x, a.leader.z), a.y) + 1.2,
      z: a.leader.z,
      facing: a.leader.facing,
      size: 6,
    };
  }
  return { x: a.screen.x, y: a.screen.y - 1.5, z: a.screen.z, facing: a.screen.facing, size: 12 };
}

/** A lens on a subject, `az` degrees round from its front. */
function poseOf(level: Level, s: Subject, az: number, high: number, dist: number): LensPose {
  const a = s.facing + (az * Math.PI) / 180;
  const r = s.size * dist;
  const ex = s.x + Math.sin(a) * r;
  const ez = s.z + Math.cos(a) * r;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + high, s.y - 3), z: ez },
    target: { x: s.x, y: s.y, z: s.z },
    fov: 55,
    roll: 0,
  };
}

type Lab = {
  level: Level;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** The race-building views, keyed by name. */
export function raceBuildingShots(lab: Lab): Record<string, () => string> {
  const shots: Record<string, () => string> = {};
  for (const row of ROWS) {
    shots[`race-${row}`] = () => {
      const s = subjectOf(lab.level, row);
      if (!s) return `no ${row} on this run`;
      const v = ANGLES[0];
      lab.setOverride(poseOf(lab.level, s, v.az, v.high, v.dist));
      lab.still();
      lab.setOverride(null);
      return `the ${row}`;
    };
  }
  // The television's shot from inside the house, behind the racer, out
  // through the door (`START_SHOT.behind`).
  shots["race-house-in"] = () => {
    const plan = startHousePlan(lab.level);
    if (!plan) return "no start house on this run (--slalom)";
    const { lens, aim } = plan.shots.behind;
    lab.setOverride({ eye: lens, target: aim, fov: 52, roll: 0 });
    lab.still();
    lab.setOverride(null);
    return "inside the start house, out through the door";
  };
  shots["race-buildings"] = () => {
    const cellW = 426;
    const cellH = 240;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * ANGLES.length;
    sheet.height = cellH * ROWS.length;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    ROWS.forEach((row, r) => {
      const s = subjectOf(lab.level, row);
      ANGLES.forEach((v, col) => {
        const x = col * cellW;
        const y = r * cellH;
        if (s) {
          lab.setOverride(poseOf(lab.level, s, v.az, v.high, v.dist));
          lab.still();
          g.drawImage(lab.canvas, x, y, cellW, cellH);
        }
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(x, y, cellW, 20);
        g.fillStyle = "#fff";
        g.fillText(`${row} · ${s ? v.name : "none on this run"}`, x + 6, y + 14);
      });
    });
    lab.setOverride(null);
    // The sheet stands in for the stage until the next view.
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return "the start's and the finish arena's buildings from three sides";
  };
  return shots;
}
