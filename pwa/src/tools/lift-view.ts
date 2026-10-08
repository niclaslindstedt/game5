// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S LIFT HARDWARE VIEWS (`make lifts`): the moving and the
// standing hardware of the lifts (`lifts.ts`, `lift-shapes.ts`) through the
// game's own renderer, where the map stands it — the towers, their heads
// and sheave trains, the chairs, the gondola cabins, the T-bars and the
// bullwheels (`docs/lifts.md` says what each really is).
//
//   * lift-tower, lift-chair, lift-cabin, lift-tbar — one part close, as
//     a 1280 × 720 frame;
//   * lifts — THE SHEET: a chair's tower from three sides and at chase
//     range, a gondola's and a drag's tower heads, a chair from three
//     sides, a cabin from two, a T-bar on its rope, the lines from a
//     skier's eye and a bullwheel, and the far cuts through a long lens —
//     a picture a part, one sheet.
//
// The carriers are where the engine's clock has them (`carrierAt`), so
// the lens is aimed at the one nearest the middle of its line.

import {
  DRAG_ARM,
  carrierAt,
  carrierCount,
  planLift,
  ropeAt,
  stationHouses,
  type GameState,
  type Level,
  type LiftKind,
  type LiftPlan,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

/** The views this module answers for the world lab. */
export const LIFT_VIEWS = ["lifts", "lift-tower", "lift-chair", "lift-cabin", "lift-tbar"] as const;

type Lab = {
  level: Level;
  state?: GameState;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

type P3 = { x: number; y: number; z: number };

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

/** The up rope's offset right of the line, m. */
const upRope = (p: LiftPlan) => (p.lift.kind === "drag" ? DRAG_ARM : p.look.gauge / 2);

/** A point on the up rope `u` m up the line, `drop` m under it. */
function onRope(p: LiftPlan, u: number, drop = 0, o = upRope(p)): P3 {
  return {
    x: p.lift.bottom.x + p.dx * u + p.dz * o,
    y: ropeAt(p, u) - drop,
    z: p.lift.bottom.z + p.dz * u - p.dx * o,
  };
}

/** The tower nearest the middle of a lift's line: its head at the rope. */
function midTower(p: LiftPlan): P3 | null {
  const towers = p.supports.filter((s) => !s.station);
  if (towers.length === 0) return null;
  const mid = p.length / 2;
  const s = towers.reduce((a, b) => (Math.abs(b.u - mid) < Math.abs(a.u - mid) ? b : a));
  return { x: s.x, y: s.ground + s.rope, z: s.z };
}

/** Where the carrier nearest `share` of the line on the up side is at `t`. */
function carrierNear(p: LiftPlan, t: number, share: number): number | null {
  let best: number | null = null;
  for (let k = 0; k < carrierCount(p); k++) {
    const c = carrierAt(p, k, t);
    if (c.side !== 0 || !c.out) continue;
    if (best === null || Math.abs(c.u - p.length * share) < Math.abs(best - p.length * share)) {
      best = c.u;
    }
  }
  return best;
}

/** A lens on `at`, `az` degrees round from the line's heading (0 looking
 * at its front from up the line... 180 from behind), `dist` m out and
 * `rise` m over it, kept over the snow. */
function lens(
  level: Level,
  p: LiftPlan,
  at: P3,
  az: number,
  dist: number,
  rise: number,
  fov = 50,
): LensPose {
  const a = p.heading + (az * Math.PI) / 180;
  const ex = at.x + Math.sin(a) * dist;
  const ez = at.z + Math.cos(a) * dist;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 1.2, at.y + rise), z: ez },
    target: at,
    fov,
    roll: 0,
  };
}

/** A view: a lens, or a reason there is none. */
type View = { name: string; pose(level: Level, t: number): LensPose | null };

const tower =
  (kind: LiftKind, az: number, dist: number, rise: number, down = 0, fov = 50) =>
  (level: Level): LensPose | null => {
    const p = longest(level, kind);
    const h = p && midTower(p);
    return p && h ? lens(level, p, { ...h, y: h.y - down }, az, dist, rise, fov) : null;
  };

const carrier =
  (kind: LiftKind, drop: number, az: number, dist: number, rise: number, fov = 50) =>
  (level: Level, t: number): LensPose | null => {
    const p = longest(level, kind);
    const u = p && carrierNear(p, t, 0.45);
    if (!p || u === null) return null;
    const c = onRope(p, u, drop);
    if (kind === "drag") c.y = level.groundAt(c.x, c.z) + 1.1;
    return lens(level, p, c, az, dist, rise, fov);
  };

/** The line from a skier's eye beside it, looking up it. */
const line =
  (kind: LiftKind) =>
  (level: Level): LensPose | null => {
    const p = longest(level, kind);
    if (!p) return null;
    const u = p.length * (kind === "gondola" ? 0.5 : 0.3);
    const side = upRope(p) + 14;
    const ex = p.lift.bottom.x + p.dx * u + p.dz * side;
    const ez = p.lift.bottom.z + p.dz * u - p.dx * side;
    const ahead = onRope(p, Math.min(p.length, u + 90), 4, 0);
    return {
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.7, z: ez },
      target: ahead,
      fov: 60,
      roll: 0,
    };
  };

/** A lift's top bullwheel, from beside it and over it. */
const wheel =
  (kind: LiftKind) =>
  (level: Level): LensPose | null => {
    const p = longest(level, kind);
    if (!p) return null;
    const w = stationHouses(level, p)[1].wheel;
    const at = { x: w.x, y: w.ground + w.rope, z: w.z };
    return lens(level, p, at, 130, 6, 2.5);
  };

const SHEET: readonly View[] = [
  { name: "chair tower · front 3/4", pose: tower("chair", 35, 9, 1, 2) },
  { name: "chair tower · side", pose: tower("chair", 90, 8, 0.5, 2) },
  { name: "chair tower · downhill face", pose: tower("chair", 205, 5, -9, 4) },
  { name: "chair tower · chase range", pose: tower("chair", 150, 28, -4, 6) },
  { name: "gondola tower head", pose: tower("gondola", 40, 11, 2, 2) },
  { name: "drag tower", pose: tower("drag", 60, 7, -1, 2) },
  { name: "chair · front 3/4", pose: carrier("chair", 2.2, 30, 4.5, 0.4) },
  { name: "chair · behind", pose: carrier("chair", 2.2, 180, 4.5, 0.8) },
  { name: "chair · side", pose: carrier("chair", 2.0, 90, 5, 0) },
  { name: "cabin · 3/4", pose: carrier("gondola", 3.2, 35, 6.5, 0.5) },
  { name: "cabin · side", pose: carrier("gondola", 3.2, 95, 6.5, 0.2) },
  { name: "t-bar on its rope", pose: carrier("drag", 3, 70, 3.2, 0.4) },
  { name: "chair line · skier's eye", pose: line("chair") },
  { name: "drag bullwheel", pose: wheel("drag") },
  { name: "gondola line · skier's eye", pose: line("gondola") },
  { name: "chair tower · far cut, 170 m", pose: tower("chair", 60, 170, 0, 4, 9) },
  { name: "chair · far cut, 120 m", pose: carrier("chair", 2, 200, 120, 3, 5) },
  { name: "cabin · far cut, 150 m", pose: carrier("gondola", 3, 60, 150, 2, 5) },
];

const ONE: Record<string, View> = {
  "lift-tower": SHEET[0],
  "lift-chair": SHEET[6],
  "lift-cabin": SHEET[9],
  "lift-tbar": SHEET[11],
};

/** The lift hardware views, keyed by name. */
export function liftShots(lab: Lab): Record<string, () => string> {
  const t = () => lab.state?.t ?? 0;
  const shots: Record<string, () => string> = {};
  for (const [name, v] of Object.entries(ONE)) {
    shots[name] = () => {
      const pose = v.pose(lab.level, t());
      if (!pose) return "none on this map";
      lab.setOverride(pose);
      lab.still();
      lab.setOverride(null);
      return v.name;
    };
  }
  shots.lifts = () => {
    const cols = 3;
    const cellW = 426;
    const cellH = 240;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * cols;
    sheet.height = cellH * Math.ceil(SHEET.length / cols);
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    SHEET.forEach((v, i) => {
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;
      const pose = v.pose(lab.level, t());
      if (pose) {
        lab.setOverride(pose);
        lab.still();
        g.drawImage(lab.canvas, x, y, cellW, cellH);
      }
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(x, y, cellW, 20);
      g.fillStyle = "#fff";
      g.fillText(`${v.name}${pose ? "" : " · none on this map"}`, x + 6, y + 14);
    });
    lab.setOverride(null);
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return "the lifts' hardware, part by part";
  };
  return shots;
}
