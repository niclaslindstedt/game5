// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S STATION VIEWS (`make buildings`, or `make world
// ARGS=--views=stations`): every kind of lift station's buildings
// (`station-build.ts`) through the game's own renderer, where the map
// stands them.
//
//   * station-<kind>-<end> — a chair's, a gondola's or a drag's FOOT or TOP
//     (the longest lift of the kind), from three quarters off its line at a
//     skier's eye, as a 1280 × 720 frame;
//   * stations — THE SHEET: every one of those six from three sides (its
//     front three quarters, its back three quarters and close at the snow)
//     drawn into one picture, a row a station.

import { planLift, stationHouses, type Level, type LiftKind, type LiftPlan } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

const KINDS: readonly LiftKind[] = ["chair", "gondola", "drag"];
const ENDS = ["foot", "top"] as const;

/** The views this module answers for the world lab. */
export const STATION_VIEWS = [
  "stations",
  ...KINDS.flatMap((k) => ENDS.map((e) => `station-${k}-${e}`)),
] as const;

/** The sheet's columns: azimuth off the line's heading (degrees, clockwise
 * from above), the lens's height over the snow, and its distance in the
 * station's sizes. */
const ANGLES = [
  { name: "front 3/4", az: 40, high: 3, dist: 1.25 },
  { name: "back 3/4", az: 215, high: 5, dist: 1.25 },
  { name: "close", az: 110, high: 1.7, dist: 0.7 },
];

/** The longest lift of a kind on the map, planned. */
function longest(level: Level, kind: LiftKind): LiftPlan | null {
  const lifts = (level.resort?.lifts ?? []).filter((l) => l.kind === kind);
  if (lifts.length === 0) return null;
  const lift = lifts.reduce((a, b) =>
    Math.hypot(b.top.x - b.bottom.x, b.top.z - b.bottom.z) >
    Math.hypot(a.top.x - a.bottom.x, a.top.z - a.bottom.z)
      ? b
      : a,
  );
  return planLift(level, lift);
}

/** A lens on one station's house and wheel, `az` degrees round from the
 * line's heading. */
export function stationPose(
  level: Level,
  kind: LiftKind,
  end: "foot" | "top",
  az: number,
  high: number,
  dist: number,
): LensPose | null {
  const plan = longest(level, kind);
  if (!plan) return null;
  const h = stationHouses(level, plan)[end === "top" ? 1 : 0];
  // The middle of the house and its wheel.
  const cx = (h.x + h.wheel.x) / 2;
  const cz = (h.z + h.wheel.z) / 2;
  const size = Math.max(
    10,
    Math.hypot(h.x - h.wheel.x, h.z - h.wheel.z) + h.halfLength + h.halfWidth,
  );
  const a = plan.heading + (az * Math.PI) / 180;
  const r = size * dist;
  const ex = cx + Math.sin(a) * r;
  const ez = cz + Math.cos(a) * r;
  const mid = (level.groundAt(cx, cz) + h.top) / 2;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + high, mid - 2), z: ez },
    target: { x: cx, y: mid, z: cz },
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

/** The station views, keyed by name. */
export function stationShots(lab: Lab): Record<string, () => string> {
  const one = (kind: LiftKind, end: "foot" | "top") => () => {
    const pose = stationPose(lab.level, kind, end, ANGLES[0].az, ANGLES[0].high, ANGLES[0].dist);
    if (!pose) return `no ${kind} on this map`;
    lab.setOverride(pose);
    lab.still();
    lab.setOverride(null);
    return `the longest ${kind}'s ${end} station`;
  };
  const shots: Record<string, () => string> = {};
  for (const k of KINDS) for (const e of ENDS) shots[`station-${k}-${e}`] = one(k, e);
  shots.stations = () => {
    const cellW = 426;
    const cellH = 240;
    const rows = KINDS.flatMap((k) => ENDS.map((e) => [k, e] as const));
    const sheet = document.createElement("canvas");
    sheet.width = cellW * ANGLES.length;
    sheet.height = cellH * rows.length;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    rows.forEach(([kind, end], row) => {
      ANGLES.forEach((v, col) => {
        const pose = stationPose(lab.level, kind, end, v.az, v.high, v.dist);
        const x = col * cellW;
        const y = row * cellH;
        if (pose) {
          lab.setOverride(pose);
          lab.still();
          g.drawImage(lab.canvas, x, y, cellW, cellH);
        }
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(x, y, cellW, 20);
        g.fillStyle = "#fff";
        g.fillText(`${kind} ${end} · ${pose ? v.name : "none on this map"}`, x + 6, y + 14);
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
    return "every station from three sides";
  };
  return shots;
}
