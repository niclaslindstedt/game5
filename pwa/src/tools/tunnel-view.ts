// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S WIND-TUNNEL VIEWS (`make world ARGS="--free --views=tunnels"`):
// the resort's wind tunnels (R30) as BUILDINGS, through the game's own
// renderer, where the map lays them — the first tunnel of the map, or the
// harness's stub pair on a map that has none.
//
//   * tunnel-mouth — the ENTRANCE: the fan house a skier rides in through,
//     from up the approach three quarters off its front;
//   * tunnel-span — the GALLERY halfway down the lane, from beside it;
//   * tunnel-exit — the EXIT PORTAL, from out past it looking back;
//   * tunnels — THE SHEET: those three from three sides each, and a row
//     from inside the lane (down it, back at the fan, up at the crown).

import type { Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import {
  TUNNEL_LOOK,
  archRadius,
  tunnelPointAt,
  tunnelsOf,
  type WindTunnel,
} from "../game/wind-tunnel-plan.ts";

/** What the lens looks at: a middle, the way its front faces, its size. */
type Subject = { x: number; y: number; z: number; facing: number; size: number };

const ROWS = ["mouth", "span", "exit"] as const;
type Row = (typeof ROWS)[number];

/** The views this module answers for the world lab. */
export const TUNNEL_VIEWS = ["tunnels", ...ROWS.map((r) => `tunnel-${r}`)] as const;

/** The sheet's columns: azimuth off the front (degrees, clockwise from
 * above), the lens's height over the snow, its distance in sizes. */
const ANGLES = [
  { name: "front 3/4", az: 35, high: 2.2, dist: 1.6 },
  { name: "back 3/4", az: 215, high: 6, dist: 1.8 },
  { name: "side, low", az: 95, high: 1.6, dist: 1.1 },
];

/** How far behind the entrance the fan house stands, m: the fan's own
 * place (`wind-tunnels.ts`) — its drum is 3.2 m deep. */
const FAN_BACK = TUNNEL_LOOK.fanBack + 3.2;

/** Each subject on the first tunnel. */
function subjectOf(tunnel: WindTunnel, row: Row): Subject {
  const r = archRadius(tunnel);
  if (row === "mouth") {
    const p = tunnelPointAt(tunnel, 0);
    return {
      x: p.x - Math.sin(p.heading) * FAN_BACK,
      y: p.y + r * 0.6,
      z: p.z - Math.cos(p.heading) * FAN_BACK,
      // Its front is the intake, facing back up the approach.
      facing: p.heading + Math.PI,
      size: 16,
    };
  }
  if (row === "span") {
    const p = tunnelPointAt(tunnel, tunnel.length / 2);
    return { ...p, y: p.y + r * 0.5, facing: p.heading + Math.PI / 2, size: 22 };
  }
  const p = tunnelPointAt(tunnel, tunnel.length);
  return { ...p, y: p.y + r * 0.6, facing: p.heading, size: 14 };
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

/** The lane from inside: down it, back at the fan, up at the crown. */
function insidePoses(tunnel: WindTunnel): { name: string; pose: LensPose }[] {
  const at = (s: number, up = 1.7) => {
    const p = tunnelPointAt(tunnel, s);
    return { x: p.x, y: p.y + up, z: p.z, h: p.heading };
  };
  const a = at(40);
  const b = at(90);
  const c = at(16);
  const fan = at(-FAN_BACK, 3.5);
  const crown = at(70, archRadius(tunnel) - 0.6);
  return [
    { name: "down the lane", pose: { eye: a, target: b, fov: 60, roll: 0 } },
    { name: "back at the fan", pose: { eye: c, target: fan, fov: 60, roll: 0 } },
    {
      name: "up at the crown",
      pose: { eye: at(40, 1.2), target: crown, fov: 70, roll: 0 },
    },
  ];
}

type Lab = {
  level: Level;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** The wind-tunnel views, keyed by name. */
export function tunnelShots(lab: Lab): Record<string, () => string> {
  const shots: Record<string, () => string> = {};
  const first = () => tunnelsOf(lab.level)[0];
  for (const row of ROWS) {
    shots[`tunnel-${row}`] = () => {
      const t = first();
      if (!t) return "no wind tunnel on this map";
      const v = ANGLES[0];
      lab.setOverride(poseOf(lab.level, subjectOf(t, row), v.az, v.high, v.dist));
      lab.still();
      lab.setOverride(null);
      return `the ${row} of ${t.id}`;
    };
  }
  shots.tunnels = () => {
    const t = first();
    if (!t) return "no wind tunnel on this map";
    const cellW = 426;
    const cellH = 240;
    const rows = ROWS.length + 1;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * ANGLES.length;
    sheet.height = cellH * rows;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    const cell = (col: number, r: number, pose: LensPose, label: string) => {
      const x = col * cellW;
      const y = r * cellH;
      lab.setOverride(pose);
      lab.still();
      g.drawImage(lab.canvas, x, y, cellW, cellH);
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(x, y, cellW, 20);
      g.fillStyle = "#fff";
      g.fillText(label, x + 6, y + 14);
    };
    ROWS.forEach((row, r) => {
      const s = subjectOf(t, row);
      ANGLES.forEach((v, col) =>
        cell(col, r, poseOf(lab.level, s, v.az, v.high, v.dist), `${row} · ${v.name}`),
      );
    });
    insidePoses(t).forEach((p, col) => cell(col, ROWS.length, p.pose, `inside · ${p.name}`));
    lab.setOverride(null);
    // The sheet stands in for the stage until the next view.
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return `${t.id}'s fan house, gallery and exit from three sides, and from inside`;
  };
  return shots;
}
