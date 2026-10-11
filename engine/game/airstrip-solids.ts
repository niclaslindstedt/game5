// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT STANDS AT THE AIRSTRIP, MET AS SOLIDS — the strip's buildings
// (`airstrip-site.ts`: the hangar, the fuel shed, the hut) and the
// windsock's mast, and the JUMP PLANE standing on the snow (parked,
// stopped after a landing, or rolling with no one aboard): each a set of
// upright BOXES, oriented in plan, from a foot to a top.
//
// A skier on his skis is held out of every box as he is out of a
// building's wall (`collision.ts`): pushed back through the nearest face,
// the blow's normal part coming back at the trunks' restitution and the
// part along the face scrubbed, and reported as a `hit` on a post of what
// the box is made of — a crawl into it is held off, a run into it at speed
// a blow that throws him (`crash.ts`'s `wipeoutCause`, the body's give by
// what it is made of). The plane's boxes are read off its own frame
// (`planePoint`): the fuselage, the tailcone, the stabiliser, the main
// skis and legs, the struts' low halves and the propeller's disc — a skier
// rides UNDER the high wing and the struts' upper halves, as a man of his
// height walks under them; the camera is kept out of the wing as well
// (`planeBoxes`'s `wing`).
//
// A free ride's alone (`RunRules.heli`, the one with the strip), so no
// race meets any of it and no digest moves; nothing is drawn from the
// stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { stripSiteOf, STRIP_SITE } from "./airstrip-site.ts";
import { TUNING } from "./defs/tuning.ts";
import { onSkis } from "./groomer.ts";
import { planePoint } from "./plane.ts";
import type { PlaneState } from "./plane-state.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { Stuff } from "./upright-grid.ts";
import type { Level } from "../mapgen/types.ts";

/** An upright box: its middle in plan, its long axis (a unit plan
 * direction), half its length along that and half its width across, its
 * foot and its top (world heights), m, and what it is made of — the shape
 * the camera's clearance reads too (`camera-clear.ts`'s `SolidBox`). */
export type StripBox = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  halfLength: number;
  halfWidth: number;
  base: number;
  top: number;
  stuff: Stuff;
};

const K = TUNING.trees;
/** How far under and over the skier's centre of gravity his body reaches,
 * m (his boots and his helmet). */
const FOOT = 1.0;
const HEAD = 0.85;

const fixed = new WeakMap<Level, StripBox[]>();

/** THE STRIP'S BUILDINGS AND MAST as boxes, worked out once a map. */
export function stripBoxes(level: Level): readonly StripBox[] {
  let out = fixed.get(level);
  if (out) return out;
  const site = stripSiteOf(level);
  out = site.buildings.map((b) => ({
    x: b.x,
    z: b.z,
    dx: Math.cos(b.heading),
    dz: -Math.sin(b.heading),
    halfLength: b.width / 2,
    halfWidth: b.depth / 2,
    base: b.base - 1,
    top: b.floor + b.eave + b.rise,
    stuff: b.stuff,
  }));
  const s = site.sock;
  out.push({
    x: s.x,
    z: s.z,
    dx: 1,
    dz: 0,
    halfLength: 0.08,
    halfWidth: 0.08,
    base: s.y - 1,
    top: s.y + STRIP_SITE.sock.mast,
    stuff: "steel",
  });
  fixed.set(level, out);
  return out;
}

/** The plane's boxes in its own frame (x right, y up, z forward, off the
 * ground datum): a box's corners from (x0, y0, z0) to (x1, y1, z1). */
const PARTS: readonly (readonly [number, number, number, number, number, number])[] = [
  // The cabin and the nose to the spinner.
  [-0.64, 0.95, -3.0, 0.64, 2.68, 3.5],
  // The tailcone to the tail ski.
  [-0.42, 1.2, -7.45, 0.42, 2.5, -3.0],
  // The fin.
  [-0.1, 2.2, -7.2, 0.1, 4.55, -5.8],
  // The stabiliser and elevators.
  [-2.56, 1.9, -7.2, 2.56, 2.08, -6.1],
  // The main legs and skis, either side.
  [1.25, 0, -1.1, 1.75, 1.05, 1.5],
  [-1.75, 0, -1.1, -1.25, 1.05, 1.5],
  // The struts' low halves, out to where a skier's head passes under.
  [0.6, 1.0, -0.4, 2.5, 2.0, -0.1],
  [-2.5, 1.0, -0.4, -0.6, 2.0, -0.1],
  // The propeller's disc.
  [-1.28, 0.6, 3.25, 1.28, 3.16, 3.6],
];
/** The wing, for the camera only: a skier passes under it. */
const WING = [-7.95, 2.68, -1.5, 7.95, 3.05, 0.45] as const;

/** THE PLANE ON THE SNOW as boxes into `out` (cleared first) — none while
 * it flies or is a wreck (whose pieces are the wreck's own); `wing` the
 * wing as well (the camera's). */
export function planeBoxes(p: PlaneState, out: StripBox[], wing = false): StripBox[] {
  out.length = 0;
  if (p.mode === "wreck" || !p.grounded) return out;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  // The plane's right in plan (the engine's +x).
  const rx = fz;
  const rz = -fx;
  const parts = wing ? [...PARTS, WING] : PARTS;
  for (const [x0, y0, z0, x1, y1, z1] of parts) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [x0, x1]) {
      for (const y of [y0, y1]) {
        for (const z of [z0, z1]) {
          const w = planePoint(p, { x, y, z });
          lo = Math.min(lo, w.y);
          hi = Math.max(hi, w.y);
        }
      }
    }
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    out.push({
      x: p.x + rx * mx + fx * mz,
      z: p.z + rz * mx + fz * mz,
      dx: fx,
      dz: fz,
      halfLength: (z1 - z0) / 2,
      halfWidth: (x1 - x0) / 2,
      base: lo,
      top: hi,
      stuff: "steel",
    });
  }
  return out;
}

const own: StripBox[] = [];

/** THE SKIER HELD OUT OF THE STRIP'S SOLIDS this step, after his own step
 * and the trees': every building, the mast and the plane on the snow; the
 * worst blow reported as a `hit` on a post. A free ride's alone. */
export function meetStrip(state: GameState, events: GameEvent[]): void {
  if (!state.rules.heli || !onSkis(state) || state.plane?.rider) return;
  const c = state.skier;
  const level = state.level;
  const site = stripSiteOf(level);
  // Nowhere near the strip: nothing to meet.
  const reach = site.strip.length / 2 + 120;
  if (hypot(c.x - site.strip.x, c.z - site.strip.z) > reach) {
    const p = state.plane;
    if (!p || hypot(c.x - p.x, c.z - p.z) > 20) return;
  }
  const boxes = state.plane
    ? [...stripBoxes(level), ...planeBoxes(state.plane, own)]
    : stripBoxes(level);
  const R = K.bodyRadius;
  let worst = 0;
  let hitX = 0;
  let hitZ = 0;
  let stuff: Stuff = "steel";
  for (const b of boxes) {
    if (c.y + HEAD < b.base || c.y - FOOT > b.top) continue;
    const dx = c.x - b.x;
    const dz = c.z - b.z;
    const u = dx * b.dx + dz * b.dz;
    const v = dx * b.dz - dz * b.dx;
    const ou = Math.max(0, Math.abs(u) - b.halfLength);
    const ov = Math.max(0, Math.abs(v) - b.halfWidth);
    if (hypot(ou, ov) >= R) continue;
    // Out through the nearest face.
    const dAlong = b.halfLength + R - Math.abs(u);
    const dAcross = b.halfWidth + R - Math.abs(v);
    let nx: number;
    let nz: number;
    let depth: number;
    if (dAcross < dAlong) {
      const s = v >= 0 ? 1 : -1;
      nx = b.dz * s;
      nz = -b.dx * s;
      depth = dAcross;
    } else {
      const s = u >= 0 ? 1 : -1;
      nx = b.dx * s;
      nz = b.dz * s;
      depth = dAlong;
    }
    c.x += nx * depth;
    c.z += nz * depth;
    const vn = c.vx * nx + c.vz * nz;
    if (vn < 0) {
      const closing = -vn;
      const tx = c.vx - vn * nx;
      const tz = c.vz - vn * nz;
      const scrub = 1 - K.scrub * Math.min(1, closing / 8);
      c.vx = tx * scrub - K.restitution * vn * nx;
      c.vz = tz * scrub - K.restitution * vn * nz;
      if (closing > worst) {
        worst = closing;
        hitX = c.x - nx * R;
        hitZ = c.z - nz * R;
        stuff = b.stuff;
      }
    }
    derive(c, level);
  }
  if (worst >= K.hitSpeed && c.hitCooldown <= 0) {
    c.hitCooldown = K.cooldown;
    events.push({
      kind: "hit",
      t: state.t,
      speed: worst,
      x: hitX,
      z: hitZ,
      stuff,
      radius: 0,
      post: true,
    });
  }
}

/** THE THROWN BODY HELD OUT OF THE SAME BOXES (`ragdoll.ts`, after the
 * walls): every point of `P` (its last place `L`, its radius `radius[i]`)
 * pushed out through the nearest face and the way into it taken off, the
 * closing speed put into `struck` for the body's blows. A free ride's
 * alone, as the skier's. */
export function ragdollOutOfStrip(
  state: GameState,
  P: number[],
  L: number[],
  radius: ArrayLike<number>,
  struck: number[],
  dt: number,
): void {
  if (!state.rules.heli) return;
  const level = state.level;
  const site = stripSiteOf(level);
  const n = radius.length;
  const x = P[0];
  const z = P[2];
  if (hypot(x - site.strip.x, z - site.strip.z) > site.strip.length / 2 + 120) {
    const p = state.plane;
    if (!p || hypot(x - p.x, z - p.z) > 20) return;
  }
  const boxes = state.plane
    ? [...stripBoxes(level), ...planeBoxes(state.plane, own)]
    : stripBoxes(level);
  for (const b of boxes) {
    for (let i = 0; i < n; i++) {
      const j = 3 * i;
      const y = P[j + 1];
      const r = radius[i];
      if (y + r < b.base || y - r > b.top) continue;
      const dx = P[j] - b.x;
      const dz = P[j + 2] - b.z;
      const u = dx * b.dx + dz * b.dz;
      const v = dx * b.dz - dz * b.dx;
      if (Math.abs(u) >= b.halfLength + r || Math.abs(v) >= b.halfWidth + r) continue;
      const dAlong = b.halfLength + r - Math.abs(u);
      const dAcross = b.halfWidth + r - Math.abs(v);
      let nx: number;
      let nz: number;
      let depth: number;
      if (dAcross < dAlong) {
        const s = v >= 0 ? 1 : -1;
        nx = b.dz * s;
        nz = -b.dx * s;
        depth = dAcross;
      } else {
        const s = u >= 0 ? 1 : -1;
        nx = b.dx * s;
        nz = b.dz * s;
        depth = dAlong;
      }
      const closing = -((P[j] - L[j]) * nx + (P[j + 2] - L[j + 2]) * nz) / dt;
      if (closing > struck[i]) struck[i] = closing;
      P[j] += nx * depth;
      P[j + 2] += nz * depth;
      // The way into the face gone, as the walls take it.
      const into = (P[j] - L[j]) * nx + (P[j + 2] - L[j + 2]) * nz;
      if (into < 0) {
        L[j] += into * nx;
        L[j + 2] += into * nz;
      }
    }
  }
}
