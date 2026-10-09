// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT RIDES THE ROPE, AS BUILT (`lift-shapes.ts`'s `Shape`, instanced by
// `lifts.ts`; `docs/lifts.md` the real parts and their measure): the
// detachable grip every carrier hangs from, a QUAD CHAIR, an EIGHT-SEAT
// CABIN, a drag's SPRING BOX and T-BAR, and a terminal's BULLWHEEL.
//
// A carrier's frame is its grip's: the rope at the origin, +z the way it
// travels (the way a chair's riders face), +x its right — OUTBOARD, away
// from the tower, on whichever rope it rides (the down side is the up
// side turned round) — and y down from the rope.

import * as THREE from "three";

import { CHAIR_BACK, CHAIR_SEAT } from "./skier-seat.ts";
import { LIFT_PAINT as P, Shape } from "./lift-shapes.ts";

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A DETACHABLE GRIP: the jaws round the rope, the carriage over it with
 * the rollers a terminal's rail carries it on and the tyre plate a
 * station's tyres drive it by, its outboard side where the hanger hangs
 * from. Returns the hanger's root. */
export function grip(s: Shape): THREE.Vector3 {
  s.box(0.2, 0.2, 0.46, 0.06, 0.02, 0, P.dark);
  s.box(0.08, 0.36, 0.62, 0.18, -0.04, 0, P.dark);
  s.box(0.24, 0.05, 0.7, 0.08, 0.16, 0, P.galv);
  for (const z of [-0.26, 0.26]) s.wheel(0.07, 0.06, -0.06, 0.2, z, 6);
  return v3(0.18, -0.2, 0);
}

/** How far a chair's cushions stand: their top under the grip, m. */
const CUSHION = 0.11 - CHAIR_SEAT;

/** A DETACHABLE QUAD CHAIR from its grip down: the hanger curving down
 * behind the back to the seat's beam, the back and seat frames, four
 * padded seats and backrests and the armrests — its safety bar a part of
 * its own (`chairBarGeometry`), swung down and up about its pivot. Its
 * seat's top and its backrest's face stand where the rider's pose is
 * built to sit (`CHAIR_SEAT`, `CHAIR_BACK`). */
export function chairGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  const root = grip(s);
  const seatY = CUSHION - 0.05;
  const back = CHAIR_BACK - 0.1;
  const beam = seatY - 0.09;
  // THE HANGER: down from the grip, swept back over the riders' heads and
  // down behind the backrest to the seat's beam.
  s.tube(
    [
      root,
      v3(0.16, -0.7, -0.03),
      v3(0.02, -1.15, -0.3),
      v3(0, -1.5, back - 0.07),
      v3(0, beam + 0.05, back - 0.07),
      v3(0, beam, -0.12),
    ],
    0.055,
    P.galv,
    8,
  );
  // THE FRAMES: the beam under the seat, the rail behind the backrest's
  // top, and at each end the side frame and the armrest.
  const half = 1.13;
  const top = CUSHION + 0.62;
  s.tube([v3(-half, beam, -0.12), v3(half, beam, -0.12)], 0.045, P.dark);
  s.tube([v3(-half, top - 0.05, back), v3(half, top - 0.05, back)], 0.035, P.dark);
  for (const x of [-half, half]) {
    s.tube([v3(x, top - 0.05, back), v3(x, beam, back + 0.02), v3(x, beam, 0.2)], 0.035, P.dark);
    s.tube(
      [v3(x, CUSHION + 0.24, back + 0.04), v3(x, CUSHION + 0.24, 0.12), v3(x, beam, 0.2)],
      0.03,
      P.dark,
    );
  }
  // THE PAN and the FOUR SEATS and BACKS, each its own cushion.
  s.box(2.24, 0.04, 0.6, 0, seatY - 0.02, -0.07, P.dark);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.545;
    s.pad(0.52, 0.1, 0.56, x, CUSHION - 0.05, -0.07, P.cushion, 0.045);
    s.pad(0.52, 0.09, 0.6, x, CUSHION + 0.33, CHAIR_BACK - 0.045, P.seat, 0.04, Math.PI / 2 - 0.12);
  }
  return s.geometry();
}

/** THE SAFETY BAR'S PIVOT on a chair, in its grip's frame, m: at the
 * backrest's top rail, each end — what the bar swings about. And how far
 * it swings up off the riders' laps to stand clear over their heads, rad
 * (about +x: negative lifts it). */
const BAR_HALF = 1.13 + 0.04;
export const CHAIR_BAR = { y: CUSHION + 0.57, z: CHAIR_BACK - 0.1, up: -2.2 } as const;

/** A CHAIR'S SAFETY BAR, lowered, about its pivot (`CHAIR_BAR` at the
 * origin): its arms off the back's top at each end, over and down to the
 * bar across the riders' laps, two drops to the footrest under their
 * boots — the footrest going up and down with it. */
export function chairBarGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  const at = (x: number, y: number, z: number) => v3(x, y - CHAIR_BAR.y, z - CHAIR_BAR.z);
  const lap = CUSHION + 0.45;
  for (const x of [-BAR_HALF, BAR_HALF]) {
    s.tube(
      [
        at(x, CHAIR_BAR.y, CHAIR_BAR.z),
        at(x, CHAIR_BAR.y + 0.03, -0.12),
        at(x, lap + 0.04, 0.3),
        at(x, lap, 0.42),
      ],
      0.03,
      P.galv,
    );
  }
  s.tube([at(-BAR_HALF, lap, 0.42), at(BAR_HALF, lap, 0.42)], 0.032, P.galv);
  // A footrest a pair of seats: two drops off the bar to a frame of two
  // rails with a grid between them.
  const foot = CUSHION - 0.5;
  for (const cx of [-0.58, 0.58]) {
    s.tube([at(cx, lap, 0.42), at(cx, foot + 0.1, 0.46), at(cx, foot, 0.5)], 0.028, P.galv);
    for (const z of [0.4, 0.62]) {
      s.tube([at(cx - 0.45, foot, z), at(cx + 0.45, foot, z)], 0.022, P.galv, 4);
    }
    s.box(0.9, 0.015, 0.2, cx, foot - 0.01 - CHAIR_BAR.y, 0.51 - CHAIR_BAR.z, P.dark);
  }
  return s.geometry();
}

/** A chair's safety bar at range: the bar across and the footrest. */
export function chairBarFarGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  s.box(2.34, 0.06, 0.06, 0, CUSHION + 0.45 - CHAIR_BAR.y, 0.42 - CHAIR_BAR.z, P.galv);
  s.box(2.0, 0.05, 0.24, 0, CUSHION - 0.5 - CHAIR_BAR.y, 0.51 - CHAIR_BAR.z, P.dark);
  return s.geometry();
}

/** The cabin's bands, from the grip down, m — its roof's crown and eave,
 * the top and the foot of its window band, its belt, its floor. The
 * rider's own cabin is built to the same (`own-cabin.ts`). */
export const CABIN_Y = {
  crown: -2.05,
  eave: -2.2,
  glassTop: -2.33,
  glassFoot: -3.17,
  belt: -3.27,
  skirt: -4.0,
  floor: -4.22,
} as const;

/** The cabin's half-width across and half-length along, m. */
export const CABIN_HALF = { w: 1.0, l: 1.08 } as const;

/** A cabin's hardware above its roof: the grip, the hanger down to the
 * roof and the suspension frame spread across it. */
export function cabinHanger(s: Shape): void {
  const root = grip(s);
  const y = CABIN_Y.crown;
  s.tube([root, v3(0.16, -0.65, 0), v3(0, -1.05, 0), v3(0, y + 0.12, 0)], 0.07, P.galv, 8);
  s.box(0.24, 0.2, 0.24, 0, y + 0.08, 0, P.dark);
  s.box(1.25, 0.07, 0.12, 0, y - 0.01, 0, P.dark);
  s.box(0.12, 0.07, 1.4, 0, y - 0.01, 0, P.dark);
}

/** An EIGHT-SEAT CABIN from its grip down: the hanger, a body rounded at
 * its corners and lofted from its skirt to its crown, a window band right
 * round it between the pillars and the mullions, the door's seams on its
 * right (the platform's) side and a ski rack on each end. */
export function cabinGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  cabinHanger(s);
  const Y = CABIN_Y;
  const { w, l } = CABIN_HALF;
  const ring = (y: number, inset: number, cut: number) => ({
    y,
    hw: w - inset,
    hl: l - inset,
    cut,
  });
  s.loft(
    [
      ring(Y.floor, 0.15, 0.3),
      ring(Y.skirt, 0.02, 0.36),
      ring(Y.belt, 0, 0.38),
      ring(Y.glassFoot, 0, 0.38),
      ring((Y.glassFoot + Y.glassTop) / 2 + 0.1, 0.01, 0.375),
      ring(Y.glassTop, 0.03, 0.37),
      ring(Y.eave, 0.06, 0.36),
      ring(Y.crown, 0.3, 0.28),
    ],
    // The glass's upper half catches the sky; its corners are pillars.
    (band, face) =>
      band === 0
        ? P.skirt
        : band === 3 || band === 4
          ? face % 2 === 0
            ? band === 4
              ? P.sky
              : P.glass
            : P.cabin
          : band >= 5 || band === 2
            ? P.roof
            : P.cabin,
    P.roof,
    P.skirt,
  );
  const glassY = (Y.glassTop + Y.glassFoot) / 2;
  const glassH = Y.glassTop - Y.glassFoot;
  // The mullions: one up the middle of the left flank and of each end.
  s.box(0.06, glassH, 0.08, -w - 0.005, glassY, 0, P.cabin);
  for (const z of [-l, l]) s.box(0.08, glassH, 0.06, 0, glassY, z + Math.sign(z) * 0.005, P.cabin);
  // The door on the right flank: its two leaves' seams and their rails.
  const bodyY = (Y.glassTop + Y.skirt) / 2;
  const bodyH = Y.glassTop - Y.skirt;
  for (const z of [-0.5, 0, 0.5]) s.box(0.02, bodyH, 0.035, w + 0.005, bodyY, z, P.skirt);
  s.box(0.04, 0.05, 1.3, w + 0.02, Y.glassTop + 0.03, 0, P.skirt);
  s.box(0.04, 0.05, 1.1, w + 0.02, Y.skirt + 0.04, 0, P.skirt);
  // THE SKI RACKS on the ends: a tray at the skirt, a rail at the belt.
  for (const z of [-l - 0.06, l + 0.06]) {
    s.box(1.15, 0.05, 0.14, 0, Y.skirt + 0.06, z, P.dark);
    s.box(1.15, 0.05, 0.05, 0, Y.belt - 0.1, z, P.dark);
    for (const x of [-0.55, -0.18, 0.18, 0.55])
      s.box(0.04, 0.72, 0.04, x, Y.skirt + 0.38, z, P.dark);
  }
  return s.geometry();
}

/** A DRAG'S SPRING BOX from its grip down: the grip on the rope and the
 * housing of the reel its cord is wound on, the cord leaving its foot
 * 0.58 m under the rope. */
export function springBoxGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  s.box(0.16, 0.18, 0.36, 0, 0.06, 0, P.dark);
  s.tube([v3(0, -0.02, 0), v3(0, -0.14, 0)], 0.025, P.dark, 4);
  s.geo(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 8).translate(0, -0.34, 0), P.spring);
  s.geo(new THREE.CylinderGeometry(0.08, 0.11, 0.05, 8).translate(0, -0.13, 0), P.dark);
  s.geo(new THREE.CylinderGeometry(0.11, 0.05, 0.06, 8).translate(0, -0.55, 0), P.dark);
  return s.geometry();
}

/** A T-BAR, its bar's middle at the origin: the stem up to the cord's
 * eye 0.6 m over it, and the bar across — a metre wide, its arms bent
 * down a little and padded in rubber where a skier sits on them. */
export function teeGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  s.tube([v3(0, 0, 0), v3(0, 0.6, 0)], 0.022, P.dark, 6);
  s.box(0.06, 0.08, 0.03, 0, 0.6, 0, P.dark);
  s.tube([v3(-0.5, -0.07, 0), v3(-0.1, 0, 0), v3(0.1, 0, 0), v3(0.5, -0.07, 0)], 0.022, P.galv, 6);
  for (const x of [-1, 1]) {
    s.tube([v3(x * 0.46, -0.063, 0), v3(x * 0.16, -0.01, 0)], 0.04, P.rubber, 6);
  }
  return s.geometry();
}

/** A BULLWHEEL of radius 1 turning flat about y, 1 thick: its lined rim,
 * six spokes and its hub — scaled to its station by the instance. */
export function bullwheelGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  const n = 20;
  const ins = 0.9;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (r: number, a: number, y: number) => v3(Math.sin(a) * r, y, Math.cos(a) * r);
    const mid = (i + 0.5) / n;
    const out = v3(Math.sin(mid * Math.PI * 2), 0, Math.cos(mid * Math.PI * 2));
    s.quad(p(1, a0, -0.5), p(1, a1, -0.5), p(1, a1, 0.5), p(1, a0, 0.5), P.rubber, out);
    s.quad(
      p(ins, a0, -0.5),
      p(ins, a1, -0.5),
      p(ins, a1, 0.5),
      p(ins, a0, 0.5),
      P.dark,
      out.clone().negate(),
    );
    s.quad(p(ins, a0, 0.5), p(1, a0, 0.5), p(1, a1, 0.5), p(ins, a1, 0.5), P.hub, v3(0, 1, 0));
    s.quad(
      p(ins, a0, -0.5),
      p(1, a0, -0.5),
      p(1, a1, -0.5),
      p(ins, a1, -0.5),
      P.dark,
      v3(0, -1, 0),
    );
  }
  for (let k = 0; k < 3; k++) {
    s.geo(
      new THREE.BoxGeometry(0.08, 0.5, 1.85),
      P.dark,
      new THREE.Matrix4().makeRotationY((k * Math.PI) / 3),
    );
  }
  s.geo(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10), P.hub);
  return s.geometry();
}

/** A CHAIR AT RANGE: the grip, the hanger, the seat and back as two
 * slabs — its outline in a sixth of the triangles (its bar is
 * `chairBarFarGeometry`). */
export function chairFarGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  const back = CHAIR_BACK - 0.1;
  s.box(0.22, 0.3, 0.6, 0.08, 0, 0, P.dark);
  s.tube(
    [
      v3(0.16, -0.15, 0),
      v3(0.02, -1.15, -0.3),
      v3(0, -1.5, back - 0.07),
      v3(0, CUSHION - 0.14, back - 0.07),
    ],
    0.06,
    P.galv,
    4,
  );
  s.box(2.24, 0.12, 0.58, 0, CUSHION - 0.06, -0.07, P.cushion);
  s.box(2.24, 0.62, 0.1, 0, CUSHION + 0.31, CHAIR_BACK - 0.05, P.seat);
  return s.geometry();
}

/** A CHAIR ACROSS THE VALLEY: its seat and back alone, the hanger too
 * thin to see that far (`CHAIR_DISTANT` in `lifts.ts`). */
export function chairDistantGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  s.box(2.24, 0.12, 0.58, 0, CUSHION - 0.06, -0.07, P.cushion);
  s.box(2.24, 0.62, 0.1, 0, CUSHION + 0.31, CHAIR_BACK - 0.05, P.seat);
  return s.geometry();
}

/** A CABIN AT RANGE: the hanger and the lofted body with its window
 * band, nothing hung on it. */
export function cabinFarGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  const Y = CABIN_Y;
  const { w, l } = CABIN_HALF;
  s.box(0.22, 0.3, 0.6, 0.08, 0, 0, P.dark);
  s.tube([v3(0.16, -0.15, 0), v3(0, -1.05, 0), v3(0, Y.crown, 0)], 0.08, P.galv, 4);
  const ring = (y: number, inset: number, cut: number) => ({
    y,
    hw: w - inset,
    hl: l - inset,
    cut,
  });
  s.loft(
    [
      ring(Y.floor, 0.15, 0.3),
      ring(Y.belt, 0, 0.38),
      ring(Y.glassFoot, 0, 0.38),
      ring(Y.glassTop, 0.03, 0.37),
      ring(Y.crown, 0.3, 0.28),
    ],
    (band, face) =>
      band === 2
        ? face % 2 === 0
          ? P.glass
          : P.cabin
        : band === 3
          ? P.roof
          : band === 1
            ? P.roof
            : P.cabin,
    P.roof,
    P.skirt,
  );
  return s.geometry();
}

/** A spring box and a T-bar at range: a block and a bar. */
export function springBoxFarGeometry(): THREE.BufferGeometry {
  return new Shape().box(0.2, 0.62, 0.2, 0, -0.27, 0, P.spring).geometry();
}
export function teeFarGeometry(): THREE.BufferGeometry {
  return new Shape()
    .box(0.04, 0.6, 0.04, 0, 0.3, 0, P.dark)
    .box(1.0, 0.05, 0.05, 0, -0.02, 0, P.galv)
    .geometry();
}
