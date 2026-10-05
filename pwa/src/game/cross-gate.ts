// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS'S START GATE, DRAWN — the start device over the top of the
// course (`cross-gate-plan.ts` says where and how big): a steel hinge beam
// across the head of the ramp, a post between each two doors and one at
// each end, a rubber-gripped HANDLE either side of every post a racer can
// reach, and the DOORS — one a lane, a white panel at his shins numbered in
// the lane's order — each falling forward flat onto the ramp at GO; over it
// all a truss FRAME on two uprights hung with the start's banner, and
// white boards walling both sides of the platform, a blue rail along their
// top — light, so the side in its own shade still reads as a board.
//
// Built in code, in the marks' faceted look (`tree-mesh.ts`'s bench), in
// the gate's own frame: x across to the racer's right, z down the course,
// y up from the snow at the middle of the hinge line. The lane numbers and
// the banner are canvases.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { bannerTexture } from "./banner-texture.ts";
import { CROSS_GATE, crossGatePlan, doorAngle, sinceDrop } from "./cross-gate-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { STRINGS } from "./strings.ts";
import { Shape, type V3 } from "./tree-mesh.ts";

const colour = (hex: THREE.ColorRepresentation): THREE.Color => new THREE.Color(hex);
const STEEL = colour(0x8d959d);
const BEAM = colour(0x2a2f36);
const GRIP = colour(0x15181c);
const TRUSS = colour(0xc4cacf);
const BOARD = [colour(0xe9eef2), colour(0xdbe2e8)];
const RAIL = colour(PALETTE.gateBlue);
const DOOR = colour(0xf2f4f6);
const EDGE = colour(0x3a4048);

export type CrossGate = {
  group: THREE.Group;
  /** The doors to the run's moment: up under the starter's word, falling
   * at GO. */
  update(state: GameState): void;
  dispose(): void;
};

/** The doors' faces: each lane's number, left to right, on the race's red
 * band over white — one canvas, a quarter a door. */
function numberTexture(count: number): THREE.CanvasTexture {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell * count;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  for (let k = 0; k < count; k++) {
    const x0 = k * cell;
    g.fillStyle = "#f2f4f6";
    g.fillRect(x0, 0, cell, 64);
    g.fillStyle = PALETTE.flag;
    g.fillRect(x0, 0, cell, 14);
    g.fillStyle = "#15181c";
    g.font = "700 40px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(k + 1), x0 + cell / 2, 40);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** THE START GATE of `level`'s ski cross, or null on a map with none. */
export function createCrossGate(level: Level, haze: HazeUniforms): CrossGate | null {
  const plan = crossGatePlan(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "cross-gate";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string): THREE.Material => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  /** The snow under a point of the gate's frame, in that frame. */
  const snowAt = (x: number, z: number): number =>
    level.groundAt(plan.x + plan.rx * x + plan.fx * z, plan.z + plan.rz * x + plan.fz * z) - plan.y;
  const s = new Shape(0, { stems: false, wind: true });
  s.facet = 0.7;
  const P = CROSS_GATE.post;
  const Hd = CROSS_GATE.handle;
  const posts = plan.posts;
  const left = posts[0];
  const right = posts[posts.length - 1];

  // THE HINGE BEAM along the snow across every door.
  {
    const y0 = Math.min(snowAt(left, 0), snowAt(right, 0)) - 0.05;
    const y1 = Math.max(snowAt(left, 0), snowAt(right, 0)) + 0.07;
    const d = 0.07;
    const box = (a: V3, b: V3, c: V3, e: V3, n: V3): void => s.quad(a, b, c, e, BEAM, n);
    box([left, y1, -d], [right, y1, -d], [right, y1, d], [left, y1, d], [0, 1, 0]);
    box([left, y0, d], [right, y0, d], [right, y1, d], [left, y1, d], [0, 0, 1]);
    box([right, y0, -d], [left, y0, -d], [left, y1, -d], [right, y1, -d], [0, 0, -1]);
  }
  // THE POSTS, and the HANDLES either side of each a door's racer reaches:
  // an arm out from the post and a rubber grip back up the platform.
  posts.forEach((x, k) => {
    const foot = snowAt(x, 0) - 0.1;
    s.tube([x, foot, 0], [x, foot + 0.1 + P.height, 0], P.radius, P.radius, 6, STEEL);
    const cap = foot + 0.1 + P.height;
    s.tube([x, cap, 0], [x, cap + 0.03, 0], P.radius * 1.3, P.radius * 0.6, 6, GRIP);
    for (const side of [-1, 1]) {
      if ((side < 0 && k === 0) || (side > 0 && k === posts.length - 1)) continue;
      const y = snowAt(x, 0) + Hd.height;
      const gx = x + side * Hd.out;
      s.tube([x, y, 0], [gx, y, -0.04], 0.018, 0.018, 5, STEEL);
      s.tube([gx, y, -0.04], [gx, y + 0.02, -Hd.reach], 0.024, 0.026, 6, GRIP);
    }
  });

  // THE FRAME: two uprights out past the end posts and a truss across.
  const F = CROSS_GATE.frame;
  const fx = right + F.out;
  const top = Math.max(snowAt(-fx, 0), snowAt(fx, 0)) + F.height;
  for (const x of [-fx, fx]) {
    const foot = snowAt(x, 0) - 0.15;
    s.tube([x, foot, 0], [x, top + 0.1, 0], 0.07, 0.06, 6, TRUSS);
  }
  {
    const chord = 0.36;
    for (const dy of [0, -chord]) {
      for (const dz of [-0.18, 0.18]) {
        s.tube([-fx, top + dy, dz], [fx, top + dy, dz], 0.03, 0.03, 5, TRUSS);
      }
    }
    // The diagonals, zigzag along both faces.
    const bays = Math.max(4, Math.round((2 * fx) / 0.7));
    for (let b = 0; b < bays; b++) {
      const x0 = -fx + (2 * fx * b) / bays;
      const x1 = -fx + (2 * fx * (b + 1)) / bays;
      const [ya, yb] = b % 2 === 0 ? [0, -chord] : [-chord, 0];
      for (const dz of [-0.18, 0.18]) {
        s.tube([x0, top + ya, dz], [x1, top + yb, dz], 0.016, 0.016, 4, TRUSS);
      }
    }
  }

  // THE PLATFORM'S WALLS: boards along both sides from its back to the
  // doors, a rail along their top.
  const W = CROSS_GATE.wall;
  const wx = plan.half + W.out;
  for (const side of [-1, 1]) {
    const x = side * wx;
    const n = Math.max(2, Math.round(plan.back / 0.6));
    for (let k = 0; k < n; k++) {
      const za = -plan.back + (plan.back * k) / n;
      const zb = -plan.back + (plan.back * (k + 1)) / n;
      const ya = snowAt(x, za);
      const yb = snowAt(x, zb);
      const out: V3 = [side, 0, 0];
      const a: V3 = side > 0 ? [x, ya - 0.2, za] : [x, yb - 0.2, zb];
      const b: V3 = side > 0 ? [x, yb - 0.2, zb] : [x, ya - 0.2, za];
      const c: V3 = side > 0 ? [x, yb + W.height, zb] : [x, ya + W.height, za];
      const d: V3 = side > 0 ? [x, ya + W.height, za] : [x, yb + W.height, zb];
      s.quad(a, b, c, d, BOARD[k % 2], out);
      // ...and its inner face, to the racers.
      s.quad(b, a, d, c, BOARD[(k + 1) % 2], [-side, 0, 0]);
    }
    s.tube(
      [x, snowAt(x, -plan.back) + W.height, -plan.back],
      [x, snowAt(x, 0) + W.height, 0],
      0.04,
      0.04,
      4,
      RAIL,
    );
  }
  const body = s.geometry();
  geos.push(body);
  const frame = new THREE.Mesh(body, std({ vertexColors: true, roughness: 0.6 }, "cross-gate"));
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // THE BANNER under the truss, hung back to back — a plane drawn from
  // behind reads its lettering mirrored.
  const span = 2 * fx - 0.4;
  const banner = bannerTexture(span / F.banner, STRINGS.startLine);
  texs.push(banner);
  const bannerGeo = new THREE.PlaneGeometry(span, F.banner);
  geos.push(bannerGeo);
  const bannerMat = std({ map: banner, roughness: 0.6 }, "cross-gate-banner");
  for (const turn of [0, Math.PI]) {
    const b = new THREE.Mesh(bannerGeo, bannerMat);
    b.position.set(0, top - 0.36 - F.banner / 2 - 0.04, turn === 0 ? 0.2 : -0.2);
    b.rotation.y = turn;
    group.add(b);
  }

  // THE DOORS: each on a pivot at its hinge, the panel standing up off it
  // — a white face numbered down the course, its edges dark.
  const D = CROSS_GATE.door;
  const numbers = numberTexture(plan.doors.length);
  texs.push(numbers);
  const faceMat = std({ map: numbers, roughness: 0.55 }, "cross-gate-door-face");
  const doorMat = std({ vertexColors: true, roughness: 0.55 }, "cross-gate-door");
  const pivots: THREE.Group[] = [];
  plan.doors.forEach((door, k) => {
    const w = door.width / 2;
    const t = 0.025;
    const d = new Shape(0, { stems: false, wind: true });
    d.facet = 0.8;
    d.quad([w, 0, -t], [-w, 0, -t], [-w, D.height, -t], [w, D.height, -t], DOOR, [0, 0, -1]);
    d.quad(
      [-w, D.height, -t],
      [-w, D.height, t],
      [w, D.height, t],
      [w, D.height, -t],
      EDGE,
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const x = side * w;
      const near: V3 = [x, 0, side > 0 ? -t : t];
      const far: V3 = [x, 0, side > 0 ? t : -t];
      d.quad(near, far, [far[0], D.height, far[2]], [near[0], D.height, near[2]], EDGE, [
        side,
        0,
        0,
      ]);
    }
    const geo = d.geometry();
    geos.push(geo);
    const face = new THREE.PlaneGeometry(door.width, D.height);
    face.translate(0, D.height / 2, t + 0.001);
    const uv = face.getAttribute("uv") as THREE.BufferAttribute;
    const n = plan.doors.length;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / n);
    geos.push(face);
    const pivot = new THREE.Group();
    const panel = new THREE.Mesh(geo, doorMat);
    const print = new THREE.Mesh(face, faceMat);
    panel.castShadow = true;
    print.castShadow = true;
    pivot.add(panel, print);
    pivot.position.set(door.across, door.y - plan.y + 0.07, 0);
    group.add(pivot);
    pivots.push(pivot);
  });

  group.position.set(plan.x, plan.y, plan.z);
  group.rotation.y = plan.heading;
  return {
    group,
    update(state) {
      const t = sinceDrop(state);
      plan.doors.forEach((door, k) => {
        pivots[k].rotation.x = doorAngle(t, door.open);
      });
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
