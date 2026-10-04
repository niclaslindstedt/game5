// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY AS DRAWN — the figure the HUD's body panel paints (`hud-body.tsx`),
// as geometry and nothing else. DOM-free, so the root suite holds it and
// `make damage` lays it over a reference.
//
// THE CLASSIC ANATOMICAL FIGURE, FROM THE FRONT: standing, the arms a little
// out from the sides with the palms forward and the thumbs out, the feet a
// little apart — the view every anatomy plate is drawn in. So his RIGHT is
// on the viewer's LEFT. The outline was TRACED off a photograph in that
// stance (thresholded, followed round, simplified — the feet below the
// ankles traced again on their own off the skin's colour against the floor
// and its shadow, toe by toe — and the head redrawn as the scalp over the
// traced skull: the hair is not the body) into a 92 × 211 box, head up, a unit about
// 8.5 mm of a man of 1.78 m; the reference is not kept (`make damage
// --refs=DIR` lays a local one under it).
//
// THE TWENTY PARTS (`BODY_PARTS`) are cut out of that one outline by a
// polygon each (`REGIONS`, the clip), so the parts tile the silhouette and
// their seams fall where the body's do: the chin, the neck's base, the
// deltoid, the armpit, the wrist crease, the belt line, the groin, above
// and below the knee, the ankle. THE BACK cannot be seen from the front:
// its part is a strip behind the spine (`BACK`).
//
// THE BONES (`BONES`) are TRACED too — off a public-domain front-view
// skeleton plate (`references/anatomy/skeleton-front.svg`), every bone
// followed round in its own pixels and laid into this outline joint by
// joint (`make anatomy`, which writes them as `body-bones.ts` and checks
// each against the plate's drawing of it and against the flesh). Each bone
// has a MARK — the point a crack or a break is drawn across, and the
// bone's way there.

import type { Bone, BodyPart } from "@engine";

import { BONE_SHAPES, type BoneDraw } from "./body-bones.ts";

export { BONE_SHAPES, type BoneDraw };

/** The figure's box. */
export const FIGURE = { w: 92, h: 211 } as const;

type Pt = readonly [number, number];

/** THE OUTLINE, traced: the crown, down his left side (the viewer's
 * right) to the fingers and back up the arm, the leg and the foot, the
 * crotch, his right leg and arm, the shoulder, the neck and the face. */
const TRACE =
  "45.3,4.1 49,4.5 52,5.9 54,8.2 54.9,11.2 55,14.5 54.9,17.5 54.4,20.5 53.7,23.2 52.9,25.4 52.4,27.6 51.7,31.5 52.3,34.9 57.2,38.4 62,40.5 66.3,41.6 69,43.8 69.7,45.9 70.2,51.5 69.5,59.8 70.5,66.6 72,73.9 75.2,81.6 77.4,94.9 80.5,101.8 85.5,102.6 91.5,107.3 90.9,108.1 88.9,108.1 86.3,106.4 85.4,106.3 85.1,106.8 85.1,108.7 86.1,111.4 88,114.2 89.8,118.3 89.5,119.4 88.5,119.5 88.5,120.7 87.5,121 87.1,120.6 82.8,114.1 82.5,114.5 85.6,121.2 84.9,121.7 84,121.2 80.4,114.3 79.9,114.4 80.4,119.9 79.9,120.4 79.2,120.1 77.8,113.7 75.1,108.6 73.9,103.7 64.5,81.5 64.4,76.1 62.3,63.7 61.9,64.1 60.7,77 62.4,85.4 62.4,89.9 65.4,101 67.1,114.6 66.9,126.6 65.1,141 65.1,145.7 65.3,152.4 67.3,160.8 67.4,167.5 66,177.2 63.8,185.6 63.7,188.6 64,190.5 64.4,192.8 64.1,194.8 65,196.8 65,197.9 65.2,198.8 65.9,200.2 67,201 68.5,202.8 68.8,203.9 68.75,204.5 69,205.38 68.62,206 68.12,206.25 67.62,206.38 67,206.12 66.5,206.62 65.88,206.75 65.38,206.38 64.88,207 64,207.12 63.62,206.75 63.12,207.25 62.25,207.38 61.88,207 61.38,207.62 60,207.88 58.75,207.5 57.88,206.75 57.5,205.5 57.62,203.5 57.2,190.5 57.9,187.3 58,183.5 54.2,168.6 54.5,158.1 51.1,148.7 50.9,137 48.3,121.2 48.1,117.3 45.6,116.7 45.4,125.3 43.9,136.9 44.4,151.3 41,160 41.6,169.1 38.3,184 38.6,188.3 39.4,190.5 40,192.2 40.1,193.1 39.6,195.2 39.6,197.4 39.2,200.8 39.4,201.4 39.6,201.3 40,201.6 39.8,202.1 40,202.3 39.62,203.5 39.3,205.5 38.75,207 37,207.88 35.5,208 34.5,207.5 33.38,207.75 32.5,207.5 32.12,207.12 31.5,207.38 30.75,207.12 30.38,206.75 29.88,206.88 29.38,206.62 29,206.38 28.62,206.2 28.25,205.75 28.12,204.5 30.2,201.7 31.7,199 31.9,197.9 32.5,196.3 32.2,193.4 32.8,190.5 32.6,186.8 29.9,176.3 28.6,167.7 28.7,162.9 30.6,153.2 30.2,142 28.3,131.4 27.3,118.4 28,101.1 29.6,91.1 30.4,79.5 29.4,66.8 27.2,75.9 26.9,82.2 16.9,105.1 16.8,109.1 15.2,114.6 16.3,121.7 15.7,122.2 15.1,121.9 13.5,116.8 13,116.6 12.5,124.3 12.1,124.8 11.2,124.7 10.9,117.2 10.5,117.1 9.1,124.8 7.8,125 7.5,122.3 8.7,116.8 8.4,116.2 7.9,116.5 6,122.8 5.2,123.1 4.6,122.5 6.5,112.6 6.1,109.5 4.9,109.8 2.8,111.8 0.8,112.1 0,111.6 5.3,105.8 9.5,104 10.6,103 13.7,94.9 15.9,81.8 18.9,74.8 21.4,61.7 21.4,59.1 20.3,53.8 20.9,44.7 23.4,42 28.2,40.3 36.3,36 38.1,34.7 39.1,33.1 39.3,28.8 38.6,27.4 37.9,25.3 37,23.2 36.2,20.5 35.7,17.5 35.6,14.5 35.7,11.2 36.5,8.2 38.5,5.9 41.6,4.5";

/** The traced outline's corners, in the figure's box. */
export const OUTLINE_POINTS: readonly Pt[] = TRACE.split(" ").map(
  (p) => p.split(",").map(Number) as unknown as Pt,
);

const f = (n: number): string => (Math.round(n * 10) / 10).toString();
const at = (p: Pt): string => `${f(p[0])},${f(p[1])}`;

/** A closed polygon as a path. */
function poly(points: readonly Pt[]): string {
  return `M${points.map(at).join("L")}Z`;
}

/** The outline as a path. */
export const OUTLINE = poly(OUTLINE_POINTS);

/** The jaw's lower edge, his right to his left: the head's seam with the
 * neck. */
const JAW_LINE: Pt[] = [
  [36.4, 23.5],
  [38.8, 27.6],
  [41.8, 30.4],
  [45.3, 31.4],
  [48.8, 30.4],
  [51.8, 27.6],
  [54.4, 23.5],
];

/** THE PARTS' CUTS: each part is the outline clipped by its polygon. The
 * seams are shared corner for corner, so the parts tile the body. */
export const REGIONS: Record<Exclude<BodyPart, "back">, string> = {
  // The head down to the jaw's lower edge and the chin, which stands in
  // front of the neck.
  head: poly(
    JAW_LINE.concat([
      [76, 23.5],
      [76, -2],
      [16, -2],
      [16, 23.5],
    ] as Pt[]),
  ),
  neck: poly([[34, 24.6], ...JAW_LINE, [57, 24.6], [57, 33], [52.6, 37.5], [38.5, 37.5], [34, 33]]),
  shoulderR: poly([
    [-5, 24.6],
    [34, 24.6],
    [34, 33],
    [38.5, 37.5],
    [31.5, 42],
    [30.2, 52],
    [29.6, 58],
    [-5, 58],
  ]),
  shoulderL: poly([
    [57, 24.6],
    [97, 24.6],
    [97, 58],
    [61.9, 58],
    [61, 52],
    [59.8, 42],
    [52.6, 37.5],
    [57, 33],
  ]),
  chest: poly([
    [38.5, 37.5],
    [52.6, 37.5],
    [59.8, 42],
    [61, 52],
    [61.9, 58],
    [62, 64],
    [62.6, 73],
    [28.9, 73],
    [29.4, 64],
    [29.6, 58],
    [30.2, 52],
    [31.5, 42],
  ]),
  abdomen: poly([
    [28.9, 73],
    [62.6, 73],
    [62.6, 77],
    [63.6, 83],
    [66, 90],
    [67.6, 95],
    [25.4, 95],
    [27, 90],
    [28.6, 80],
  ]),
  pelvis: poly([
    [25.4, 95],
    [67.6, 95],
    [70.5, 103],
    [72, 107],
    [46.8, 119.5],
    [22, 107],
    [24.2, 100],
  ]),
  armR: poly([
    [-5, 58],
    [29.6, 58],
    [29.4, 64],
    [29, 70],
    [28.6, 80],
    [27, 90],
    [24.2, 100],
    [22, 106],
    [9, 98],
    [-5, 98],
  ]),
  armL: poly([
    [61.9, 58],
    [97, 58],
    [97, 98],
    [84, 98],
    [71, 106],
    [70.5, 103],
    [67.6, 95],
    [66, 90],
    [63.6, 83],
    [62.6, 77],
    [62.6, 73],
    [62, 64],
  ]),
  handR: poly([
    [-5, 98],
    [9, 98],
    [22, 106],
    [22, 130],
    [-5, 130],
  ]),
  handL: poly([
    [84, 98],
    [97, 98],
    [97, 130],
    [72, 130],
    [72, 107],
    [71, 106],
  ]),
  thighR: poly([
    [22, 107],
    [46.8, 119.5],
    [46.8, 146],
    [22, 146],
  ]),
  thighL: poly([
    [46.8, 119.5],
    [72, 107],
    [72, 146],
    [46.8, 146],
  ]),
  kneeR: poly([
    [20, 146],
    [46.8, 146],
    [46.8, 158],
    [20, 158],
  ]),
  kneeL: poly([
    [46.8, 146],
    [74, 146],
    [74, 158],
    [46.8, 158],
  ]),
  shinR: poly([
    [20, 158],
    [46.8, 158],
    [46.8, 194],
    [20, 194],
  ]),
  shinL: poly([
    [46.8, 158],
    [74, 158],
    [74, 194],
    [46.8, 194],
  ]),
  footR: poly([
    [20, 194],
    [46.8, 194],
    [46.8, 214],
    [20, 214],
  ]),
  footL: poly([
    [46.8, 194],
    [74, 194],
    [74, 214],
    [46.8, 214],
  ]),
};

/** THE BACK, which the front hides: a strip behind the spine, from the
 * neck's base to the sacrum. */
export const BACK = poly([
  [42.4, 37.5],
  [48.8, 37.5],
  [50.2, 70],
  [50.8, 97],
  [42.4, 97],
  [41.2, 70],
]);

/** THE ORDER the bones are drawn in, back to front: the shoulder blades
 * and the spine behind the ribs, the breastbone and the clavicles over
 * them, the limbs, and the skull last. */
export const BONE_ORDER: readonly Bone[] = [
  "scapulaL",
  "scapulaR",
  "thoracic",
  "lumbar",
  "cervical",
  "pelvis",
  "ribs",
  "sternum",
  "clavicleL",
  "clavicleR",
  "humerusL",
  "humerusR",
  "ulnaL",
  "ulnaR",
  "radiusL",
  "radiusR",
  "handL",
  "handR",
  "femurL",
  "femurR",
  "patellaL",
  "patellaR",
  "fibulaL",
  "fibulaR",
  "tibiaL",
  "tibiaR",
  "footL",
  "footR",
  "mandible",
  "skull",
];

/** THE LONG BONES, which a break parts end to end; the rest (a group of
 * small bones, a flat one) part only near the break. */
const LONG = /^(humerus|radius|ulna|femur|tibia|fibula|clavicle)/;

/** HOW A BONE FRACTURES — the bone's own geometry cut, never a mark drawn
 * on it; deterministic per bone. Every fracture runs along one irregular
 * line across the bone at its mark, skewed as a real fracture line runs:
 *   - a HAIRLINE is an incomplete crack: a fissure (`fissure`) cut into the
 *     bone from one edge along that line, tapering shut short of the far
 *     edge — the flesh shows through it;
 *   - a BREAK is complete: the bone cut along the line, its far side
 *     (`piece`, a long bone's whole far end, a flat or small bone's only
 *     near the line) displaced and angulated (`move`), with the bone less
 *     that piece (`rest`, filled even-odd) left where it was; and a long
 *     bone's break knocks out a butterfly fragment (`chip`) that is set
 *     apart on its own (`chipMove`). */
export type FractureDraw = {
  fissure: string;
  piece: string;
  rest: string;
  move: string;
  chip: string;
  chipMove: string;
};

/** A small, fixed sequence of numbers in [0, 1) off a bone's name. */
function jitter(bone: Bone): () => number {
  let h = 2166136261;
  for (let i = 0; i < bone.length; i++) h = Math.imul(h ^ bone.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** The plane outside everything, for a complement filled even-odd. */
const EVERYWHERE = "M-20,-20H112V231H-20Z";

export function fractureOf(bone: Bone): FractureDraw {
  const m = BONE_SHAPES[bone].mark;
  const rnd = jitter(bone);
  const long = LONG.test(bone);
  // Across the bone, and along it.
  const skew = (rnd() - 0.5) * 0.8;
  const u: Pt = [Math.cos(m.a + Math.PI / 2 + skew), Math.sin(m.a + Math.PI / 2 + skew)];
  const v: Pt = [Math.cos(m.a), Math.sin(m.a)];
  const at = (t: number, z: number): Pt => [m.x + u[0] * t + v[0] * z, m.y + u[1] * t + v[1] * z];
  // The fracture line: from well past one edge to well past the other.
  const half = m.r * 1.6 + 0.8;
  const N = 10;
  const zig = Math.min(0.5, 0.12 + m.r * 0.16);
  const ts: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i <= N; i++) {
    ts.push(-half + (2 * half * i) / N);
    zs.push((rnd() - 0.5) * 2 * zig);
  }
  const pts = ts.map((t, i) => at(t, zs[i]));
  // THE FISSURE: from the near edge (well outside it) along the line to a
  // little past the mark, as wide as a hair at its mouth and shut at its
  // end.
  const k = Math.round(N * 0.72);
  const mouth = Math.min(0.62, 0.3 + m.r * 0.1);
  const wid = (i: number): number => (mouth * (k - i)) / k;
  const fissure = poly([
    ...pts.slice(0, k + 1).map((_, i) => at(ts[i], zs[i] + wid(i) / 2)),
    ...pts
      .slice(0, k + 1)
      .map((_, i) => at(ts[i], zs[i] - wid(i) / 2))
      .reverse(),
  ]);
  // THE BREAK: everything past the line, as far as the piece reaches.
  const reach = long ? 60 : Math.max(2.4, m.r * 2.6);
  const far = (p: Pt): Pt => [p[0] + v[0] * reach, p[1] + v[1] * reach];
  const wide = long ? half + 40 : half;
  const piece = poly([
    at(-wide, zs[0]),
    ...pts,
    at(wide, zs[N]),
    far(at(wide, zs[N])),
    far(at(-wide, zs[0])),
  ]);
  const sign = rnd() < 0.5 ? -1 : 1;
  // Displaced as a broken bone is: shifted across by about half its width,
  // the ends drawn a little apart, and angulated.
  const slide = 0.4 + m.r * 0.2;
  const sideways = (0.3 + m.r * 0.55) * sign;
  const turn = sign * (6 + rnd() * 6);
  const move = `translate(${f(v[0] * slide + u[0] * sideways)} ${f(v[1] * slide + u[1] * sideways)}) rotate(${f(turn)} ${f(m.x)} ${f(m.y)})`;
  // THE BUTTERFLY: a wedge of the far side, its base on the line about the
  // mark, knocked out the other way.
  const c = N >> 1;
  const apex = at(ts[c] + (rnd() - 0.5) * m.r * 0.4, zs[c] + m.r * 0.95 + 0.3);
  const chip = long ? poly([pts[c - 2], pts[c - 1], pts[c], pts[c + 1], apex]) : "";
  const kick = -sign * (0.4 + m.r * 0.3);
  const chipMove = `translate(${f(u[0] * kick + v[0] * slide * 0.4)} ${f(u[1] * kick + v[1] * slide * 0.4)}) rotate(${f(-turn * 2)} ${f(apex[0])} ${f(apex[1])})`;
  return {
    fissure,
    piece: chip ? `${piece}${chip}` : piece,
    rest: `${EVERYWHERE}${piece}`,
    move,
    chip,
    chipMove,
  };
}
