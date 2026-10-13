// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RACER'S HARD KIT (`Outfit.bike`, `racerKit`) and THE FEET —
// what a racer on the race bike wears over the race shell and the jersey:
//
//   THE FULL-FACE  the slalom shell's chin guard grown into a full chin bar
//                  stood well out in front of the mouth, CHEEK PLATES closing
//                  it to the shell, vents across the bar, and a long PEAK
//                  over the goggles
//   THE NECK BRACE a hard collar on the shoulders round the neck, its front
//                  and back struts down the chest and between the blades
//   THE FEET       his own feet in the boots' liners on the skis; on the
//                  bike FLAT-PEDAL SHOES — a low dark upper, a gum sole and
//                  the accent's heel tab
//
// Laid on the loom (`dress-loft.ts`): the helmet riding the head, the brace
// the chest, the feet each its boot's bone.

import { shellAt, shellNormal } from "./helmet-shape.ts";
import {
  add,
  bindPose,
  dirInBone,
  inBone,
  mul,
  norm,
  rides,
  sub,
  type Loom,
  type V3,
} from "./dress-loft.ts";
import { helmetOf, RACER_KIT, type Outfit } from "./outfit.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const H = (x: number, y: number, z: number): V3 => inBone("head", v(x, y, z));
const HD = (x: number, y: number, z: number): V3 => dirInBone("head", v(x, y, z));
const toV = (p: [number, number, number]): V3 => v(p[0], p[1], p[2]);
const DARK = 0x101114;

/** THE FULL-FACE over the slalom shell (`dress-head.ts` cuts the shell and
 * its goggles; this adds the bar, the plates and the peak). */
export function cutFullFace(loom: Loom, o: Outfit): void {
  const h = helmetOf(o);
  // THE CHIN BAR: from ear cover to ear cover, level with the mouth and
  // well out in front of it — in the trim, the shell's colour across its
  // middle round the dark vents (a white bar under the face reads as a
  // beard from the chase).
  const bar = [
    H(-0.11, -0.045, 0.035),
    H(-0.094, -0.08, 0.112),
    H(0, -0.102, 0.17),
    H(0.094, -0.08, 0.112),
    H(0.11, -0.045, 0.035),
  ];
  const toward = (p: V3) => norm(sub(p, H(0, -0.03, 0.02)));
  loom.tube({
    path: bar,
    face: bar.map(toward),
    round: 0.05,
    sections: [
      { s: 0, w: 0.03, f: 0.012, b: 0.008 },
      { s: 0.1, w: 0.036, f: 0.018, b: 0.01 },
      { s: 0.27, w: 0.04, f: 0.022, b: 0.01 },
      { s: 0.44, w: 0.036, f: 0.018, b: 0.01 },
      { s: 0.54, w: 0.03, f: 0.012, b: 0.008 },
    ],
    step: 0.02,
    segments: 10,
    square: 2.6,
    colour: (s, t) => {
      const mid = Math.abs(s - 0.27);
      // Three vents across the bar's front, the trim round them.
      if (mid < 0.05 && Math.cos(t) > 0.55 && Math.abs(Math.sin(t)) < 0.35) return DARK;
      return mid < 0.09 ? h.shell : h.trim;
    },
    weights: () => rides("head"),
    hard: true,
  });
  // THE CHEEK PLATES: the shell carried down from the ear covers into the
  // bar's ends, so the face is framed by the helmet all round.
  for (const side of [-1, 1]) {
    const path = [H(side * 0.112, -0.012, 0.0), H(side * 0.108, -0.06, 0.07)];
    loom.tube({
      path,
      face: [HD(side, 0, 0.15), HD(side, -0.1, 0.35)],
      sections: [
        { s: 0, w: 0.042, f: 0.008, b: 0.006 },
        { s: 0.08, w: 0.034, f: 0.01, b: 0.006 },
      ],
      step: 0.02,
      segments: 8,
      square: 3,
      colour: () => h.shell,
      weights: () => rides("head"),
      hard: true,
    });
  }
  // THE PEAK: long and raked up a little over the goggles, the trim's.
  const pts: V3[] = [];
  const faces: V3[] = [];
  for (let k = -4; k <= 4; k++) {
    const a = (k / 4) * 0.66;
    const p = toV(shellAt(0.05, a));
    const n = toV(shellNormal(0.05, a));
    pts.push(H(p.x, p.y + 0.004, p.z));
    faces.push(norm(add(HD(n.x, n.y * 0.2, n.z), HD(0, 0.12, 0))));
  }
  loom.tube({
    path: pts,
    face: faces,
    round: 0.02,
    sections: [
      { s: 0, w: 0.004, f: 0.01, b: 0.002 },
      { s: 0.05, w: 0.004, f: 0.05, b: 0.002 },
      { s: 0.18, w: 0.004, f: 0.07, b: 0.002 },
      { s: 0.31, w: 0.004, f: 0.05, b: 0.002 },
      { s: 0.36, w: 0.004, f: 0.01, b: 0.002 },
    ],
    step: 0.03,
    segments: 6,
    square: 2.6,
    colour: (s) => (Math.abs(s - 0.18) < 0.05 ? h.shell : h.trim),
    weights: () => rides("head"),
    hard: true,
  });
}

/** THE NECK BRACE: a hard ring on the shoulders round the neck's base,
 * riding the chest, with a strut down the breastbone and one between the
 * shoulder blades. */
export function cutBrace(loom: Loom): void {
  const { frames: F, pose: P } = bindPose();
  const up = F.chest.y;
  const ahead = F.chest.z;
  const across = F.chest.x;
  const c = add(P.neck, mul(up, -0.012));
  const ring: V3[] = [];
  const out: V3[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // A wider ring across the shoulders than front to back.
    const r = add(mul(across, Math.sin(a) * 0.098), mul(ahead, Math.cos(a) * 0.085));
    ring.push(add(c, add(r, mul(up, Math.cos(a) * 0.01))));
    out.push(norm(add(norm(r), mul(up, 0.9))));
  }
  const B = RACER_KIT.brace;
  loom.tube({
    path: ring,
    face: out,
    sections: [
      { s: 0, w: 0.026, f: 0.01, b: 0.012 },
      { s: 2, w: 0.026, f: 0.01, b: 0.012 },
    ],
    step: 0.03,
    segments: 8,
    square: 2.8,
    colour: (s) => (Math.abs(((s / 0.57) % 1) - 0.5) < 0.06 ? B.accent : B.body),
    weights: () => rides("chest"),
    hard: true,
  });
  for (const k of [1, -1]) {
    const top = add(c, mul(ahead, k * 0.09));
    loom.tube({
      path: [top, add(top, add(mul(up, -0.13), mul(ahead, k * 0.012)))],
      face: [mul(ahead, k), mul(ahead, k)],
      sections: [
        { s: 0, w: 0.024, f: 0.008, b: 0.004 },
        { s: 0.13, w: 0.018, f: 0.006, b: 0.004 },
      ],
      step: 0.04,
      segments: 6,
      square: 3,
      colour: () => B.body,
      weights: () => rides("chest"),
      hard: true,
    });
  }
}

/** HIS FEET — in the boots' padded liners (hidden in the shells while he
 * stands on his skis, his own when he is thrown off them), or, in a
 * racer's kit, in FLAT-PEDAL SHOES. */
export function cutFeet(loom: Loom, o: Outfit): void {
  const { pose: P } = bindPose();
  const S = RACER_KIT.shoe;
  const liner = 0x26282c;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const bt = P.boots[i];
    const n = { x: bt.n.x, y: bt.n.y, z: bt.n.z };
    const f = { x: bt.f.x, y: bt.f.y, z: bt.f.z };
    const top = P.feet[i];
    // A shoe is cut low: the ankle in the riding pants' hem over it.
    const ankle = o.bike ? 0.15 : 0.24;
    loom.tube({
      path: [add(top, mul(n, -0.24 + ankle)), add(top, mul(n, -0.24))],
      face: [f, f],
      sections: [
        { s: 0, w: 0.05, f: 0.055, b: 0.052 },
        { s: ankle, w: 0.046, f: 0.05, b: 0.05 },
      ],
      step: 0.12,
      segments: 8,
      colour: () => (o.bike ? S.upper : liner),
      weights: () => rides(`boot_${s}`),
    });
    const sole = add(top, mul(n, -0.275));
    loom.tube({
      path: [add(sole, mul(f, -0.11)), add(sole, mul(f, 0.16))],
      face: [n, n],
      sections: [
        { s: 0, w: 0.035, f: 0.03, b: 0.02 },
        { s: 0.06, w: 0.044, f: 0.045, b: 0.03 },
        { s: 0.2, w: 0.045, f: 0.035, b: 0.03 },
        { s: 0.27, w: 0.03, f: 0.015, b: 0.02 },
      ],
      step: 0.08,
      segments: 8,
      // The shoe's gum sole under its upper, the heel tab in the accent.
      colour: (u, t) =>
        !o.bike ? liner : Math.cos(t) < -0.45 ? S.sole : u < 0.04 ? S.accent : S.upper,
      weights: () => rides(`boot_${s}`),
    });
  }
}
