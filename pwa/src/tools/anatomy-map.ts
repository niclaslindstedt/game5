// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANATOMY LAB'S MAP (`make anatomy`, `anatomy-harness.ts`): how every
// bone traced off the skeleton plate (`references/anatomy/skeleton-front.svg`,
// public domain) is laid into the HUD's traced figure (`body-figure.ts`).
// DOM-free: the landmarks and the transforms, nothing drawn.
//
// TWO SETS OF LANDMARKS, read by eye off a grid laid over each picture:
// the PLATE's joints in its own units (`PLATE`, 436 × 842, head up), and
// the FIGURE's in the HUD's box (`FIGURE_JOINTS`, 92 × 211) — read off the
// photograph the outline was traced from, so a joint sits where that man's
// joint is. Every bone is then mapped by the joints it spans:
//   - a LONG BONE (and the forearm's two together, the shin's two together)
//     from its proximal joint to its distal one, its width by the figure's
//     stature over the plate's (`G`) — so it keeps the plate's thickness;
//   - THE HAND ray by ray: the carpus to the wrist, each digit (its
//     metacarpal and phalanges) base to fingertip, the tips the outline's;
//   - THE THORAX (ribs, sternum, thoracic spine) by a least-squares affine
//     through the shoulders, the jugular notch, the first lumbar vertebra
//     and the ribcage's widest points; the CLAVICLES and the SHOULDER
//     BLADES each end to end, so they meet the shoulders the figure has;
//   - THE PELVIS by the hip joints and the symphysis; the LUMBAR and the
//     CERVICAL spine between the pieces they join;
//   - THE SKULL by its orbits and its chin.
// The plate draws its RIGHT arm pronated (thumb in, radius crossed over the
// ulna) and its left supinated; the figure stands palms forward, so the
// right arm is the LEFT one MIRRORED. Every transform is affine, kept as an
// SVG matrix on the plate's own coordinates, so the lab can lay the plate's
// drawing of each bone warped exactly as the bone was.

import type { Bone } from "@engine";

export type Pt = [number, number];

/** An affine map as SVG writes it: x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = [number, number, number, number, number, number];

/** One traced component of the plate: its outer ring, its holes, its
 * centroid and its area (plate units). */
export type Comp = { outer: Pt[]; holes: Pt[][]; c: Pt; area: number };

/** The plate traced: every group id's components, and `REST` — what is
 * left of the skeleton once every labelled group is taken (the ribs, the
 * right femur, the pelvis's loose pieces). */
export type Traced = Record<string, Comp[]>;

/** A bone's piece: plate components and the map that lays them in. */
export type Piece = { comps: Comp[]; m: Matrix };

/** THE PLATE'S MIDLINE, x: what a left bone is mirrored across. */
const MID = 203;

/** THE PLATE'S STATURE, crown to sole, and the figure's (skull to sole):
 * the scale a bone's width is kept at. */
const PLATE_STATURE = 794;
const FIGURE_STATURE = 204.5;
export const G = FIGURE_STATURE / PLATE_STATURE;

/** THE PLATE'S JOINTS (its own units, read off a 5-unit grid). The right
 * arm's are the left's mirrored (see the header). */
const PLATE = {
  shoulderL: [286.7, 179.6],
  elbowL: [313.5, 304],
  wristL: [346, 409],
  hipR: [151, 388],
  hipL: [250, 388],
  kneeR: [175, 589],
  kneeL: [227.5, 589],
  ankleR: [182.5, 765],
  ankleL: [217.5, 765],
  orbitR: [186.5, 72],
  orbitL: [218.5, 72],
  chin: [202.5, 125],
  notch: [202.5, 158.5],
  c1: [200.75, 89.75],
  c7: [200.25, 148],
  l1: [201, 288],
  l5: [205, 357],
  symphysis: [201, 406],
  ribR: [133.25, 268.5],
  ribL: [273.5, 254],
  clavicleR: [124.75, 146],
  sternalR: [195.75, 156],
  clavicleL: [283.5, 145.5],
  sternalL: [211.75, 157.25],
  scapTopR: [125.5, 143.75],
  scapAngleR: [152, 227.75],
  scapTopL: [282, 145.5],
  scapAngleL: [251.25, 224.5],
} satisfies Record<string, Pt>;

/** THE FIGURE'S JOINTS (the HUD box's units, read off the traced
 * photograph on a 2-unit grid). Fingertips and digit bases are the traced
 * outline's own. */
export const FIGURE_JOINTS = {
  orbitR: [41.5, 17.6],
  orbitL: [49.1, 17.6],
  chin: [45.6, 30.4],
  notch: [45.5, 39.0],
  l1: [46.1, 77.5],
  ribX: [31.0, 60.6],
  shoulderR: [24.9, 46.6],
  shoulderL: [66.1, 46.6],
  elbowR: [22.3, 80.0],
  elbowL: [69.3, 80.0],
  wristR: [15.0, 101.3],
  wristL: [76.4, 101.5],
  carpusR: [13.4, 103.6],
  carpusL: [78.4, 103.6],
  hipR: [36.4, 103.0],
  hipL: [56.8, 103.0],
  symphysis: [46.7, 107.2],
  kneeR: [36.7, 153.0],
  kneeL: [59.6, 153.0],
  ankleR: [36.0, 191.5],
  ankleL: [60.6, 191.5],
  tarsusTopR: [36.0, 191.8],
  tarsusTopL: [60.6, 191.8],
  tarsusOutR: [33.4, 196.6],
  tarsusInR: [38.8, 196.6],
  tarsusOutL: [64.2, 196.6],
  tarsusInL: [58.4, 196.6],
  acromionR: [25.2, 42.2],
  sternalR: [43.6, 39.8],
  acromionL: [66.0, 42.2],
  sternalL: [47.6, 39.8],
  scapTopR: [25.2, 41.6],
  scapAngleR: [34.6, 64.0],
  scapTopL: [66.0, 41.6],
  scapAngleL: [56.8, 64.0],
} satisfies Record<string, Pt>;

/** EACH DIGIT, thumb to little finger, in two pieces as a hand bends:
 * the metacarpal from its BASE at the carpus to the KNUCKLE, the phalanges
 * from the knuckle to the TIP. The tip is the traced outline's; the
 * knuckle stands behind the web between the fingers (the midpoint of the
 * notches either side) by `KNUCKLE` of web-to-tip; the base is read at the
 * carpus's far edge. */
const DIGITS: Record<"R" | "L", { base: Pt; tip: Pt; web: Pt }[]> = {
  R: [
    { base: [11.4, 104.0], tip: [0.6, 111.7], web: [7.4, 107.6] },
    { base: [12.6, 105.8], tip: [5.0, 122.9], web: [7.5, 114.5] },
    { base: [13.6, 106.0], tip: [8.4, 124.9], web: [9.55, 116.75] },
    { base: [14.6, 105.9], tip: [11.7, 124.7], web: [11.8, 116.85] },
    { base: [15.6, 105.5], tip: [15.6, 122.0], web: [14.1, 115.6] },
  ],
  L: [
    { base: [79.6, 103.8], tip: [91.1, 107.7], web: [85.9, 105.6] },
    { base: [79.2, 105.6], tip: [89.6, 118.8], web: [86.4, 112.4] },
    { base: [78.3, 105.9], tip: [87.6, 120.9], web: [84.8, 114.6] },
    { base: [77.3, 105.9], tip: [84.9, 121.5], web: [81.4, 114.3] },
    { base: [76.3, 105.5], tip: [79.8, 120.2], web: [79.0, 114.0] },
  ],
};

/** How far behind the web the knuckle stands, of web-to-tip. */
const KNUCKLE = 0.3;

/** A digit's base, knuckle and tip in the figure. */
function digit(s: "R" | "L", i: number): [Pt, Pt, Pt] {
  const { base, tip, web } = DIGITS[s][i];
  return [base, [web[0] - (tip[0] - web[0]) * KNUCKLE, web[1] - (tip[1] - web[1]) * KNUCKLE], tip];
}

/** THE FEET'S RAYS on the plate, big toe first (read off a 1-unit grid
 * over its feet): each metatarsal's base and head and its toe's tip. The
 * plate draws the five metatarsals as one overlapping shape and four toes
 * as another; the lab cuts them apart ray by ray along these axes, so every
 * metatarsal and every toe is a bone of its own. */
export const PLATE_RAYS: Record<"R" | "L", { base: Pt; head: Pt; tip: Pt }[]> = {
  R: [
    { base: [187.5, 781.25], head: [165, 797.5], tip: [155.6, 818.75] },
    { base: [180, 776.25], head: [156.25, 796.25], tip: [145, 816.9] },
    { base: [175, 775.6], head: [149.4, 795], tip: [140, 815] },
    { base: [168.75, 776.25], head: [143.75, 793.1], tip: [134.4, 811.25] },
    { base: [161.25, 777.5], head: [141.25, 791.25], tip: [131.25, 806.25] },
  ],
  L: [
    { base: [212.5, 782.5], head: [233.75, 801.25], tip: [243.75, 820] },
    { base: [220, 777.5], head: [241.25, 798.75], tip: [255, 816.25] },
    { base: [226.25, 776.25], head: [247.5, 796.25], tip: [260.6, 815] },
    { base: [233.75, 775], head: [252.5, 793.75], tip: [265, 811.25] },
    { base: [240, 776.25], head: [256.25, 792.5], tip: [268.1, 805.6] },
  ],
};

/** THE SAME RAYS IN THE FIGURE, off the photograph of the feet on a half-
 * unit grid: each metatarsal's base at the tarsus, its head under the
 * toe's knuckle, and the toe's tip — the foot seen end on, so the toes are
 * short and the metatarsals shorter. */
const FIGURE_RAYS: Record<"R" | "L", { base: Pt; head: Pt; tip: Pt }[]> = {
  R: [
    { base: [37.4, 200.4], head: [36.4, 203.9], tip: [35.7, 207.6] },
    { base: [36.0, 200.0], head: [33.7, 203.7], tip: [33.4, 207.5] },
    { base: [34.6, 200.0], head: [31.9, 203.6], tip: [31.65, 207.2] },
    { base: [33.2, 200.2], head: [30.6, 203.5], tip: [30.4, 206.9] },
    { base: [31.8, 200.6], head: [29.3, 203.3], tip: [29.2, 206.5] },
  ],
  L: [
    { base: [59.2, 200.4], head: [60.0, 203.8], tip: [60.7, 207.2] },
    { base: [60.6, 200.0], head: [62.6, 203.6], tip: [62.9, 207.0] },
    { base: [62.0, 200.0], head: [64.3, 203.5], tip: [64.6, 206.7] },
    { base: [63.4, 200.2], head: [66.0, 203.3], tip: [66.3, 206.3] },
    { base: [64.8, 200.6], head: [67.6, 203.0], tip: [67.9, 205.8] },
  ],
};

/** How wide each limb's bones are kept, of the plate's (by `G`): the
 * figure is a slimmer man than the plate's, slimmest at the forearm and
 * the ankle. */
const WIDE = { arm: 0.86, fore: 0.82, carpus: 0.8, thigh: 0.92, shin: 0.8, ray: 0.62, toe: 0.66 };
/** The jaw's width, of the plate's (see `mandible`). */
const JAW = 0.9;
/** A finger's width, of its length's scale. */
const FINGER = 0.72;

// ── The affine algebra ───────────────────────────────────────────────────

const I: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` after `n` (n applied first). */
export function compose(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Matrix, p: Pt): Pt {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

/** Across the plate's midline. */
const MIRROR: Matrix = [-1, 0, 0, 1, 2 * MID, 0];
const mirror = (p: Pt): Pt => [2 * MID - p[0], p[1]];

/** From `a`→`b` onto `A`→`B`: along the way by the lengths' ratio, across
 * it by `k`. */
export function segment(a: Pt, b: Pt, A: Pt, B: Pt, k: number): Matrix {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const U = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  const n = [-u[1], u[0]];
  const N = [-U[1], U[0]];
  const s = L / l;
  const m00 = s * U[0] * u[0] + k * N[0] * n[0];
  const m01 = s * U[0] * u[1] + k * N[0] * n[1];
  const m10 = s * U[1] * u[0] + k * N[1] * n[0];
  const m11 = s * U[1] * u[1] + k * N[1] * n[1];
  return [m00, m10, m01, m11, A[0] - (m00 * a[0] + m01 * a[1]), A[1] - (m10 * a[0] + m11 * a[1])];
}

/** The least-squares affine taking each `[from, to]`. */
export function affine(pairs: [Pt, Pt][]): Matrix {
  const row = (k: 0 | 1): number[] => {
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const v = [0, 0, 0];
    for (const [p, q] of pairs) {
      const r = [p[0], p[1], 1];
      for (let i = 0; i < 3; i++) {
        v[i] += r[i] * q[k];
        for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j];
      }
    }
    for (let i = 0; i < 3; i++) {
      let m = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[m][i])) m = r;
      [M[i], M[m]] = [M[m], M[i]];
      [v[i], v[m]] = [v[m], v[i]];
      for (let r = 0; r < 3; r++) {
        if (r === i) continue;
        const f = M[r][i] / M[i][i];
        for (let c = i; c < 3; c++) M[r][c] -= f * M[i][c];
        v[r] -= f * v[i];
      }
    }
    return v.map((x, i) => x / M[i][i]);
  };
  const X = row(0);
  const Y = row(1);
  return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
}

// ── Which plate pieces make which bone, and how each is laid in ───────────

const F = FIGURE_JOINTS;

/** The REST's components by where they lie on the plate: the ribcage and
 * its loose ribs, the right femur, the pelvis's loose pieces. */
function rest(t: Traced, box: [number, number, number, number]): Comp[] {
  return (t.REST ?? []).filter(
    (c) =>
      c.area > 20 && c.c[0] >= box[0] && c.c[0] <= box[2] && c.c[1] >= box[1] && c.c[1] <= box[3],
  );
}

/** A plate group's components on one side of the midline. */
const side = (cs: Comp[], s: "R" | "L"): Comp[] =>
  cs.filter((c) => (s === "R" ? c.c[0] < MID : c.c[0] >= MID));

/** THE HAND, ray by ray, off the plate's LEFT hand (mirrored for the
 * right): the digits' phalanges sorted by their angle about the carpus,
 * thumb first, each metacarpal joined to the digit nearest its angle; the
 * carpus laid on the wrist, each metacarpal base to knuckle, each digit's
 * phalanges knuckle to tip. */
function hand(t: Traced, s: "R" | "L"): Piece[] {
  const flip = s === "R" ? MIRROR : I;
  const w = t.CarpalsLeft[0].c;
  const ang = (c: Comp): number => Math.atan2(c.c[1] - w[1], c.c[0] - w[0]);
  const rays = t.PhalangesLeft.map((c) => ({ a: ang(c), ph: c, mc: [] as Comp[] })).sort(
    (x, y) => x.a - y.a,
  );
  // A metacarpal comp of twice the usual area is two drawn fused (the
  // plate's ring and little): it goes between the two digits nearest it.
  const areas = t.MetacarpalsLeft.map((m) => m.area).sort((x, y) => x - y);
  const usual = areas[areas.length >> 1];
  const pairs: { comp: Comp; digits: [number, number] }[] = [];
  for (const m of t.MetacarpalsLeft) {
    const a = ang(m);
    const near = rays.map((r, i) => ({ i, d: Math.abs(r.a - a) })).sort((x, y) => x.d - y.d);
    if (m.area > 1.4 * usual) pairs.push({ comp: m, digits: [near[0].i, near[1].i] });
    else rays[near[0].i].mc.push(m);
  }
  const d = (p: Pt): number => Math.hypot(p[0] - w[0], p[1] - w[1]);
  const ends = (cs: Comp[]): [Pt, Pt] => {
    const ps = cs.flatMap((c) => c.outer);
    return [
      apply(
        flip,
        ps.reduce((a, p) => (d(p) < d(a) ? p : a)),
      ),
      apply(
        flip,
        ps.reduce((a, p) => (d(p) > d(a) ? p : a)),
      ),
    ];
  };
  const wristP = apply(flip, PLATE.wristL);
  const carpusP = apply(flip, w);
  const pieces: Piece[] = [
    {
      comps: t.CarpalsLeft,
      m: compose(segment(wristP, carpusP, F[`wrist${s}`], F[`carpus${s}`], G * WIDE.carpus), flip),
    },
  ];
  const lay = (cs: Comp[], from: [Pt, Pt], to: [Pt, Pt]): void => {
    const ratio =
      Math.hypot(to[1][0] - to[0][0], to[1][1] - to[0][1]) /
      Math.hypot(from[1][0] - from[0][0], from[1][1] - from[0][1]);
    pieces.push({
      comps: cs,
      m: compose(segment(from[0], from[1], to[0], to[1], ratio * FINGER), flip),
    });
  };
  rays.forEach((r, i) => {
    const [base, knuckle, tip] = digit(s, i);
    lay([r.ph], ends([r.ph]), [knuckle, tip]);
    if (r.mc.length) lay(r.mc, ends(r.mc), [base, knuckle]);
  });
  const half = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  for (const { comp, digits } of pairs) {
    const [b0, k0] = digit(s, digits[0]);
    const [b1, k1] = digit(s, digits[1]);
    lay([comp], ends([comp]), [half(b0, b1), half(k0, k1)]);
  }
  return pieces;
}

const SIDE = { R: "Right", L: "Left" } as const;
const tarsals = (t: Traced, s: "R" | "L"): Comp[] => t[`Tarsals${SIDE[s]}`];
/** A foot's tarsus at its outer (−1) or inner (+1) side, at the height of
 * its middle: the edge of its box that way. */
function sideOf(cs: Comp[], s: "R" | "L", way: number): Pt {
  const ps = cs.flatMap((c) => c.outer);
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  const inward = (s === "R" ? 1 : -1) * way;
  return [inward > 0 ? Math.max(...xs) : Math.min(...xs), (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** The middle of a group's box's top edge. */
function crownOf(cs: Comp[]): Pt {
  const ps = cs.flatMap((c) => c.outer);
  const xs = ps.map((p) => p[0]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ps.map((p) => p[1]))];
}

/** A FOOT'S TEN BONES, each its own piece: every metatarsal laid from its
 * base to its head, every toe from the head to its tip (the lab has cut
 * them apart: `Meta<side><i>`, `Toe<side><i>`). */
function rays(t: Traced, s: "R" | "L"): Piece[] {
  return PLATE_RAYS[s].flatMap((p, i) => {
    const f = FIGURE_RAYS[s][i];
    return [
      { comps: t[`Meta${s}${i}`] ?? [], m: segment(p.base, p.head, f.base, f.head, G * WIDE.ray) },
      { comps: t[`Toe${s}${i}`] ?? [], m: segment(p.head, p.tip, f.head, f.tip, G * WIDE.toe) },
    ];
  });
}

/** EVERY BONE'S PIECES, off the traced plate. */
export function planBones(t: Traced): Record<Bone, Piece[]> {
  const thorax0 = affine([
    [PLATE.shoulderL, F.shoulderL],
    [mirror(PLATE.shoulderL), F.shoulderR],
    [PLATE.notch, F.notch],
    [PLATE.l1, F.l1],
  ]);
  const thorax = affine([
    [PLATE.shoulderL, F.shoulderL],
    [mirror(PLATE.shoulderL), F.shoulderR],
    [PLATE.notch, F.notch],
    [PLATE.l1, F.l1],
    [PLATE.ribR, [F.ribX[0], apply(thorax0, PLATE.ribR)[1]]],
    [PLATE.ribL, [F.ribX[1], apply(thorax0, PLATE.ribL)[1]]],
  ]);
  const skull = affine([
    [PLATE.orbitR, F.orbitR],
    [PLATE.orbitL, F.orbitL],
    [PLATE.chin, F.chin],
  ]);
  const pelvis = affine([
    [PLATE.hipR, F.hipR],
    [PLATE.hipL, F.hipL],
    [PLATE.symphysis, F.symphysis],
  ]);
  const arm = (s: "R" | "L"): { up: Matrix; fore: Matrix } => {
    const flip = s === "R" ? MIRROR : I;
    const sh = apply(flip, PLATE.shoulderL);
    const el = apply(flip, PLATE.elbowL);
    const wr = apply(flip, PLATE.wristL);
    return {
      up: compose(segment(sh, el, F[`shoulder${s}`], F[`elbow${s}`], G * WIDE.arm), flip),
      fore: compose(segment(el, wr, F[`elbow${s}`], F[`wrist${s}`], G * WIDE.fore), flip),
    };
  };
  const leg = (s: "R" | "L"): { thigh: Matrix; shin: Matrix; tarsus: Matrix } => {
    const P = PLATE;
    const ankle = P[`ankle${s}`];
    // The foot is seen end on and splayed: laid by its ankle and the tips
    // of its big and little toes.
    return {
      thigh: segment(P[`hip${s}`], P[`knee${s}`], F[`hip${s}`], F[`knee${s}`], G * WIDE.thigh),
      shin: segment(P[`knee${s}`], ankle, F[`knee${s}`], F[`ankle${s}`], G * WIDE.shin),
      // The tarsus from under the ankle to the foot's two sides, the rays
      // from their bases to the toes' tips.
      tarsus: affine([
        [crownOf(tarsals(t, s)), F[`tarsusTop${s}`]],
        [sideOf(tarsals(t, s), s, -1), F[`tarsusOut${s}`]],
        [sideOf(tarsals(t, s), s, 1), F[`tarsusIn${s}`]],
      ]),
      // The metatarsals from their bases to their heads, fanning a little;
      // the toes from the heads down, short and side by side — a foot seen
      // end on, not the plate's splayed one seen from above.
    };
  };
  const aR = arm("R");
  const aL = arm("L");
  const lR = leg("R");
  const lL = leg("L");
  const one = (comps: Comp[], m: Matrix): Piece[] => [{ comps, m }];
  return {
    skull: one(t.Cranium, skull),
    // The jaw a little narrower than the plate's broad one, as this man's
    // is (its angles stand inside his neck's line).
    mandible: one(t.Mandible, compose(skull, [JAW, 0, 0, 1, (1 - JAW) * PLATE.chin[0], 0])),
    cervical: one(
      t.CervicalVertebrae,
      segment(PLATE.c1, PLATE.c7, apply(skull, PLATE.c1), apply(thorax, PLATE.c7), G),
    ),
    clavicleR: one(
      t.ClavicleRight,
      segment(PLATE.clavicleR, PLATE.sternalR, F.acromionR, F.sternalR, G),
    ),
    clavicleL: one(
      t.ClavicleLeft,
      segment(PLATE.clavicleL, PLATE.sternalL, F.acromionL, F.sternalL, G),
    ),
    scapulaR: one(
      side(t.Scapula, "R"),
      segment(PLATE.scapTopR, PLATE.scapAngleR, F.scapTopR, F.scapAngleR, G),
    ),
    scapulaL: one(
      side(t.Scapula, "L"),
      segment(PLATE.scapTopL, PLATE.scapAngleL, F.scapTopL, F.scapAngleL, G),
    ),
    sternum: one([...t.Manubrium, ...t.Sternum], thorax),
    ribs: one(rest(t, [125, 140, 280, 305]), thorax),
    thoracic: one(t.ThoracicVertebrae, thorax),
    lumbar: one(
      t.LumbarVertebrae,
      segment(PLATE.l1, PLATE.l5, apply(thorax, PLATE.l1), apply(pelvis, PLATE.l5), G),
    ),
    pelvis: one(
      [...t.PelvicGirdle, ...t.Sacrum, ...t.Coccyx, ...rest(t, [165, 365, 245, 425])],
      pelvis,
    ),
    humerusR: one(t.HumerusLeft, aR.up),
    humerusL: one(t.HumerusLeft, aL.up),
    radiusR: one(t.RadiusLeft, aR.fore),
    radiusL: one(t.RadiusLeft, aL.fore),
    ulnaR: one(t.UlnaLeft, aR.fore),
    ulnaL: one(t.UlnaLeft, aL.fore),
    handR: hand(t, "R"),
    handL: hand(t, "L"),
    femurR: one(rest(t, [120, 430, 200, 560]), lR.thigh),
    femurL: one(t.FemurLeft, lL.thigh),
    patellaR: one(t.PatellaRight, lR.thigh),
    patellaL: one(t.PatellaLeft, lL.thigh),
    tibiaR: one(t.TibiaRight, lR.shin),
    tibiaL: one(t.TibiaLeft, lL.shin),
    fibulaR: one(t.FibulaRight, lR.shin),
    fibulaL: one(t.FibulaLeft, lL.shin),
    footR: [{ comps: tarsals(t, "R"), m: lR.tarsus }, ...rays(t, "R")],
    footL: [{ comps: tarsals(t, "L"), m: lL.tarsus }, ...rays(t, "L")],
  };
}

/** THE SKULL'S ORBITS, which the plate shades rather than cuts: a rim
 * each in the plate's units, laid in by the skull's map. */
export const ORBITS: Pt[][] = [186.5, 218.7].map((cx, i) => {
  const s = i === 0 ? -1 : 1;
  // A rounded square (a superellipse), a little wider than high.
  return Array.from({ length: 20 }, (_, k) => {
    const a = (k / 20) * Math.PI * 2;
    const c = Math.cos(a);
    const n = Math.sin(a);
    const r = 1 / Math.cbrt(Math.abs(c) ** 3 + Math.abs(n) ** 3);
    return [cx + s * 11 * c * r, 72 + 10 * n * r] as Pt;
  });
});

/** WHERE A CRACK IS DRAWN on each bone, in the figure: a long bone half
 * way between its joints (a little lower on the shin), the rest at a spot
 * of its own; and the bone's way there. */
export function markSpots(): Record<Bone, { p: Pt; a: number }> {
  const along = (a: Pt, b: Pt, t: number): { p: Pt; a: number } => ({
    p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    a: Math.atan2(b[1] - a[1], b[0] - a[0]),
  });
  const across = (p: Pt, a = Math.PI / 2): { p: Pt; a: number } => ({ p, a });
  const out = {} as Record<Bone, { p: Pt; a: number }>;
  for (const s of ["R", "L"] as const) {
    const o = s === "R" ? -1 : 1;
    out[`humerus${s}`] = along(F[`shoulder${s}`], F[`elbow${s}`], 0.5);
    // The forearm's two bones side by side: the radius on the thumb's side.
    const fore = along(F[`elbow${s}`], F[`wrist${s}`], 0.5);
    const n: Pt = [-Math.sin(fore.a), Math.cos(fore.a)];
    const lat = s === "R" ? 1 : -1;
    out[`radius${s}`] = {
      p: [fore.p[0] + n[0] * 1.0 * lat, fore.p[1] + n[1] * 1.0 * lat],
      a: fore.a,
    };
    out[`ulna${s}`] = {
      p: [fore.p[0] - n[0] * 1.0 * lat, fore.p[1] - n[1] * 1.0 * lat],
      a: fore.a,
    };
    out[`femur${s}`] = along(F[`hip${s}`], F[`knee${s}`], 0.5);
    out[`patella${s}`] = across([F[`knee${s}`][0], F[`knee${s}`][1] - 1.4]);
    const shin = along(F[`knee${s}`], F[`ankle${s}`], 0.55);
    out[`tibia${s}`] = { p: [shin.p[0] - o * 0.9, shin.p[1]], a: shin.a };
    out[`fibula${s}`] = { p: [shin.p[0] + o * 2.6, shin.p[1]], a: shin.a };
    out[`clavicle${s}`] = along(F[`sternal${s}`], F[`acromion${s}`], 0.5);
    out[`scapula${s}`] = along(F[`scapTop${s}`], F[`scapAngle${s}`], 0.8);
    const [mb, mk] = digit(s, 2);
    out[`hand${s}`] = along(mb, mk, 0.5);
    out[`foot${s}`] = along(FIGURE_RAYS[s][1].base, FIGURE_RAYS[s][1].head, 0.5);
  }
  out.skull = across([49.2, 8.0], -0.5);
  out.mandible = across([48.6, 28.6], 0.4);
  out.cervical = across([45.6, 34.2]);
  out.sternum = across([45.6, 50.0]);
  out.ribs = across([31.8, 60.0], 1.2);
  out.thoracic = across([45.9, 73.0]);
  out.lumbar = across([46.3, 88.0]);
  out.pelvis = across([35.6, 94.6], 2.2);
  return out;
}
