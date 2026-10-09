// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S ROOM VIEWS (`make interiors`, or `make world
// ARGS="--free --views=interiors"`): the furnished ground floor of every
// kind of building (`interior-build.ts`) through the game's own renderer,
// the lens stood INSIDE the building where the map stands it.
//
//   * room-<kind> — the first building of a kind from its front corner
//     inside, looking across the room to the far back corner, as a
//     1280 × 720 frame;
//   * room-<kind>-door — from just inside its door at a walker's eye;
//   * interiors — THE SHEET: every kind from the door, from a front corner
//     and from the back looking out at the windows, a row a kind.

import { cabinsOf, type Cabin, type CabinKind, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { planRoom } from "../game/interior-build.ts";
import { faceFrame, ROOMS } from "../game/interior-plan.ts";
import { holesOf } from "../game/interiors-view.ts";

const KINDS = Object.keys(ROOMS) as CabinKind[];

/** The views this module answers for the world lab. */
export const INTERIOR_VIEWS = [
  "interiors",
  ...KINDS.map((k) => `room-${k}`),
  ...KINDS.map((k) => `room-${k}-door`),
] as const;

type Angle = "door" | "corner" | "back";
const ANGLES: readonly Angle[] = ["door", "corner", "back"];

/** A point of a room's frame in the world. */
function inWorld(
  c: Cabin,
  plan: { oy: number; oz: number },
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const lz = z + plan.oz;
  return { x: c.x + x * fz + lz * fx, y: c.y + plan.oy + y, z: c.z - x * fx + lz * fz };
}

/** A lens inside `c`'s room. */
export function roomPose(level: Level, c: Cabin, angle: Angle): LensPose | null {
  const plan = planRoom(c, holesOf(level, c));
  if (!plan) return null;
  const H = plan.def.ceiling;
  const world = (x: number, y: number, z: number) => inWorld(c, plan, x, y, z);
  const eye = Math.min(H - 0.3, Math.max(1.6, H * 0.55));
  const m = 0.35;
  // Never inside a piece: walked toward the middle until clear of every
  // footprint that stands up to the eye.
  const free = (x: number, z: number): [number, number] => {
    const cx = (plan.x0 + plan.x1) / 2;
    const cz = (plan.z0 + plan.z1) / 2;
    for (let k = 0; k < 40; k++) {
      const hit = plan.pieces.some((q) => {
        if (q.y > eye || q.y + q.h < eye - 0.6) return false;
        const c = Math.abs(Math.cos(q.yaw));
        const s = Math.abs(Math.sin(q.yaw));
        const hx = (q.w * c + q.d * s) / 2 + 0.25;
        const hz = (q.w * s + q.d * c) / 2 + 0.25;
        return Math.abs(x - q.x) < hx && Math.abs(z - q.z) < hz;
      });
      if (!hit) break;
      x += (cx - x) * 0.08;
      z += (cz - z) * 0.08;
    }
    return [x, z];
  };
  if (angle === "door") {
    const door = plan.holes.find((h) => h.door);
    if (!door) return roomPose(level, c, "corner");
    const f = faceFrame(door.face, plan.width, plan.depth);
    const k = plan.def.wall + 0.45;
    const [ex, ez] = free(f.x + f.ux * door.u - f.nx * k, f.z + f.uz * door.u - f.nz * k);
    const tx = f.x + f.ux * door.u - f.nx * 6;
    const tz = f.z + f.uz * door.u - f.nz * 6;
    return {
      eye: world(ex, 1.65, ez),
      target: world(tx, 1.2, tz),
      fov: 78,
      roll: 0,
    };
  }
  if (angle === "corner") {
    // A front corner, looking to the far back one.
    const [ex, ez] = free(plan.x0 + m, plan.z1 - m);
    return {
      eye: world(ex, eye, ez),
      target: world(plan.x1 - 1, eye * 0.45, plan.z0 + 1),
      fov: 80,
      roll: 0,
    };
  }
  // The back corner on the other side, looking out at the front.
  const [ex, ez] = free(plan.x1 - m, plan.z0 + m);
  return {
    eye: world(ex, eye, ez),
    target: world(plan.x0 + 1, eye * 0.5, plan.z1 - 1),
    fov: 80,
    roll: 0,
  };
}

type Lab = {
  level: Level;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** The room views, keyed by name. */
export function interiorShots(lab: Lab): Record<string, () => string> {
  const first = (kind: CabinKind) => cabinsOf(lab.level).find((c) => c.kind === kind) ?? null;
  const shots: Record<string, () => string> = {};
  const frame = (pose: LensPose, note: string) => {
    lab.setOverride(pose);
    // Twice: the first frame builds the rooms round the lens.
    lab.still();
    lab.still();
    lab.setOverride(null);
    return note;
  };
  for (const kind of KINDS) {
    for (const [name, angle] of [
      [`room-${kind}`, "corner"],
      [`room-${kind}-door`, "door"],
    ] as const) {
      shots[name] = () => {
        const c = first(kind);
        if (!c) return `no ${kind} on this map`;
        const pose = roomPose(lab.level, c, angle);
        if (!pose) return `${kind} has no room`;
        const plan = planRoom(c, holesOf(lab.level, c));
        return frame(pose, `${c.id}, the ${kind}: ${plan?.pieces.length ?? 0} pieces`);
      };
    }
  }
  shots.interiors = () => {
    const rows = KINDS.map((k) => [k, first(k)] as const).filter(([, c]) => c);
    if (rows.length === 0) return "no buildings on this map";
    const cellW = 426;
    const cellH = 240;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * ANGLES.length;
    sheet.height = cellH * rows.length;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    rows.forEach(([kind, c], row) => {
      ANGLES.forEach((angle, col) => {
        const x = col * cellW;
        const y = row * cellH;
        const pose = c ? roomPose(lab.level, c, angle) : null;
        if (pose) {
          lab.setOverride(pose);
          lab.still();
          lab.still();
          g.drawImage(lab.canvas, x, y, cellW, cellH);
        }
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(x, y, cellW, 20);
        g.fillStyle = "#fff";
        g.fillText(`${kind} ${c?.id ?? ""} · ${angle}`, x + 6, y + 14);
      });
    });
    lab.setOverride(null);
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return `${rows.length} rooms from three sides`;
  };
  return shots;
}
