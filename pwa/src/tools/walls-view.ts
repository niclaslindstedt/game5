// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S WALLS VIEW (`make buildings`, or `make world ARGS="--free
// --views=walls"`): every kind of building on the map with the SOLID the
// engine meets it as (`building-walls.ts`) drawn over the game's own
// picture of it, so a reviewer can see the solid stands where the walls
// are drawn — a row a kind:
//
//   * from above — the building from straight over it, every wall slab's
//     two faces in red at the snow, the door shut across its doorway in
//     yellow, a terrace's rail, a woodpile or a post in orange;
//   * front 3/4 — the same lines from a skier's eye off its front;
//   * at the wall — the skier SKIED INTO the wall at 6 m/s (one flank, the
//     one without the door) and stopped against it, from beside him.
//
// The skier is the lab's own run's (`lab.state`), stood and skied there
// with the engine's own step, so the picture is where the physics left him.

import {
  CABINS,
  NEUTRAL_INPUT,
  TUNING,
  cabinsOf,
  doorPlanOf,
  placeRun,
  step,
  wallSegmentsOf,
  type Cabin,
  type CabinKind,
  type GameState,
  type Level,
  type WallSegment,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

/** The views this module answers for the world lab. */
export const WALL_VIEWS = ["walls"] as const;

/** Every kind, in the order the rows are drawn. */
const KINDS: readonly CabinKind[] = [
  "hut",
  "cabin",
  "chalet",
  "shed",
  "afterski",
  "restaurant",
  "ticket",
  "rental",
  "school",
  "firstAid",
  "hotel",
  "garage",
  "pumpHouse",
  "house",
  "apartments",
  "hall",
  "shop",
  "church",
  "mountainHut",
  "patrol",
];

type Lab = {
  level: Level;
  state?: GameState;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

type V3 = { x: number; y: number; z: number };

/** A point of the world on the picture of `pose`, in a cell `w` × `h` —
 * the renderer's own lens (`camera.ts`'s `aimLens`: looking at the target
 * with world up, `fov` the vertical field), or null behind the lens. */
function project(
  p: V3,
  pose: LensPose,
  aspect: number,
  w: number,
  h: number,
): [number, number] | null {
  const e = pose.eye;
  let fx = pose.target.x - e.x;
  let fy = pose.target.y - e.y;
  let fz = pose.target.z - e.z;
  const fl = Math.hypot(fx, fy, fz);
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // right = forward × up, up' = right × forward.
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dz = p.z - e.z;
  const depth = dx * fx + dy * fy + dz * fz;
  if (depth < 0.1) return null;
  const t = Math.tan((pose.fov * Math.PI) / 360);
  const sx = (dx * rx + dz * rz) / depth / (t * aspect);
  const sy = (dx * ux + dy * uy + dz * uz) / depth / t;
  return [((sx + 1) / 2) * w, ((1 - sy) / 2) * h];
}

/** A lens on `c`: straight over it (a hair off plumb, so world up still
 * reads), or `az` degrees round off its front at a skier's eye. */
function lensOn(level: Level, c: Cabin, view: "above" | "front"): LensPose {
  const d = CABINS[c.kind];
  const reach = d.reach.front;
  const cx = c.x + Math.sin(c.heading) * (reach / 2);
  const cz = c.z + Math.cos(c.heading) * (reach / 2);
  const size = Math.max(9, d.width + 4, d.depth + reach + 4);
  if (view === "above") {
    const high = size / (2 * Math.tan((40 * Math.PI) / 360)) + d.ridge + 6;
    return {
      eye: {
        x: cx - Math.sin(c.heading) * 0.05,
        y: c.y + high,
        z: cz - Math.cos(c.heading) * 0.05,
      },
      target: { x: cx, y: c.y, z: cz },
      fov: 40,
      roll: 0,
    };
  }
  const a = c.heading + (30 * Math.PI) / 180;
  const r = size * 1.3;
  const ex = c.x + Math.sin(a) * r;
  const ez = c.z + Math.cos(a) * r;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 3, c.y + 2), z: ez },
    target: { x: c.x, y: c.y + d.walls * 0.4, z: c.z },
    fov: 55,
    roll: 0,
  };
}

/** Draw `c`'s solid over a cell drawn through `pose` as a wire frame: each
 * slab's two faces at the floor and at the eaves, its ends up between
 * them — a terrace's rail at its top, a post or a woodpile to its own. */
function overlay(
  g: CanvasRenderingContext2D,
  c: Cabin,
  segs: readonly WallSegment[],
  k: number,
  pose: LensPose,
  aspect: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
): void {
  const d = CABINS[c.kind];
  const line = (pts: V3[]): void => {
    g.beginPath();
    let open = false;
    for (const q of pts) {
      const p = project(q, pose, aspect, w, h);
      if (!p) {
        open = false;
        continue;
      }
      if (open) g.lineTo(ox + p[0], oy + p[1]);
      else g.moveTo(ox + p[0], oy + p[1]);
      open = true;
    }
    g.stroke();
  };
  for (const s of segs) {
    if (s.cabin !== k) continue;
    const wall = s.half >= 0.15;
    g.strokeStyle = s.door !== null ? "#ffd400" : wall ? "#ff2a2a" : "#ff9a1a";
    g.lineWidth = s.door !== null ? 3 : 2;
    // The walls from the floor to the eaves; a door to its lintel; a rail,
    // a stack or a post from the floor to its own top.
    const lo = c.y;
    const hi =
      s.door !== null
        ? c.y + (doorPlanOf(c)?.height ?? d.walls)
        : wall
          ? c.y + d.walls
          : Math.max(c.y + 0.3, s.top);
    const ex = s.bx - s.ax;
    const ez = s.bz - s.az;
    const len = Math.hypot(ex, ez);
    const ring: [number, number][] = [];
    if (len < 1e-6) {
      const r = s.half;
      ring.push(
        [s.ax - r, s.az - r],
        [s.ax + r, s.az - r],
        [s.ax + r, s.az + r],
        [s.ax - r, s.az + r],
      );
    } else {
      const nx = (-ez / len) * s.half;
      const nz = (ex / len) * s.half;
      ring.push(
        [s.ax + nx, s.az + nz],
        [s.bx + nx, s.bz + nz],
        [s.bx - nx, s.bz - nz],
        [s.ax - nx, s.az - nz],
      );
    }
    for (const y of [lo, hi]) line([...ring, ring[0]].map(([x, z]) => ({ x, y, z })));
    for (const [x, z] of ring)
      line([
        { x, y: lo, z },
        { x, y: hi, z },
      ]);
  }
}

/** Ski the lab's skier into `c`'s flank without the door at 6 m/s and let
 * him stop there; the lens beside him. */
function skiInto(state: GameState, c: Cabin): { pose: LensPose; note: string } {
  const d = CABINS[c.kind];
  const door = doorPlanOf(c);
  const side = door?.side === "right" ? -1 : 1;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const world = (lx: number, lz: number) => ({
    x: c.x + lx * fz + lz * fx,
    z: c.z - lx * fx + lz * fz,
  });
  const from = world(side * (d.width / 2 + 6), 0);
  const to = world(side * (d.width / 2 - 2), 0);
  delete state.crowd;
  placeRun(state, { x: from.x, z: from.z, heading: Math.atan2(to.x - from.x, to.z - from.z) });
  const s = state.skier;
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  for (let i = 0; i < 2.5 * TUNING.physicsHz; i++) {
    if (i < 1.5 * TUNING.physicsHz && !s.thrown) {
      s.vx = ((to.x - from.x) / len) * 6;
      s.vz = ((to.z - from.z) / len) * 6;
    }
    step(state, NEUTRAL_INPUT);
  }
  // From beside him along the wall, a little back and up.
  const along = world(side * (d.width / 2 + 2.2), d.depth / 2 + 5);
  const pose: LensPose = {
    eye: { x: along.x, y: s.y + 2.2, z: along.z },
    target: { x: s.x, y: s.y + 0.8, z: s.z },
    fov: 50,
    roll: 0,
  };
  const at = Math.abs((s.x - c.x) * fz - (s.z - c.z) * fx) - d.width / 2;
  return { pose, note: `${s.thrown ? "thrown, " : ""}${at.toFixed(2)} m off the wall` };
}

/** The walls views, keyed by name. */
export function wallShots(lab: Lab): Record<string, () => string> {
  return {
    walls: () => {
      const cabins = cabinsOf(lab.level);
      const rows = KINDS.map((k) => cabins.find((c) => c.kind === k)).filter(
        (c): c is Cabin => !!c,
      );
      if (rows.length === 0) return "no buildings on this map";
      const segs = wallSegmentsOf(lab.level);
      const cellW = 420;
      const cellH = 236;
      const cols = ["from above", "front 3/4", "skied into its flank at 6 m/s"];
      const sheet = document.createElement("canvas");
      sheet.width = cellW * cols.length;
      sheet.height = cellH * rows.length;
      const g = sheet.getContext("2d") as CanvasRenderingContext2D;
      g.fillStyle = "#0b1116";
      g.fillRect(0, 0, sheet.width, sheet.height);
      g.font = "13px monospace";
      const aspect = lab.canvas.width / lab.canvas.height;
      rows.forEach((c, row) => {
        const k = cabins.indexOf(c);
        const y = row * cellH;
        let note = "";
        cols.forEach((name, col) => {
          const x = col * cellW;
          let pose: LensPose;
          if (col < 2) pose = lensOn(lab.level, c, col === 0 ? "above" : "front");
          else if (lab.state) {
            const hit = skiInto(lab.state, c);
            pose = hit.pose;
            note = hit.note;
          } else return;
          lab.setOverride(pose);
          lab.still();
          g.drawImage(lab.canvas, x, y, cellW, cellH);
          if (col < 2) overlay(g, c, segs, k, pose, aspect, x, y, cellW, cellH);
          g.fillStyle = "rgba(0,0,0,0.55)";
          g.fillRect(x, y, cellW, 20);
          g.fillStyle = "#fff";
          g.fillText(`${c.kind} ${c.id} · ${name}${col === 2 ? ` · ${note}` : ""}`, x + 6, y + 14);
        });
      });
      lab.setOverride(null);
      lab.canvas.style.display = "none";
      sheet.id = "sheet";
      document.body.prepend(sheet);
      document.body.style.overflow = "visible";
      document.documentElement.style.height = "auto";
      document.body.style.height = "auto";
      return `${rows.length} kinds, the solid over the drawing`;
    },
  };
}
