// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S CLOTH — the shapes his kit is built from (`skier-figure.ts` hangs
// them on the pose). A wind jacket and a pair of insulated pants are not
// tubes: they bag, they gather where a joint bends and they stack where one
// piece of kit goes over another. So every part of him is a SHAPED SECTION
// (`shaped`) — rings of a rounded box laid along a line, more laid between
// the rings given (smoothed through them, Catmull–Rom) wherever a fold needs
// them and few where none does, each ring pushed in and out by a FOLD, a
// function of how far along the part it is and which way round:
//
//   * `creases` — a run of soft ridges round a joint (`cloth` lays the
//     rings to carry them), strongest at it and dying away along the limb,
//     in the crook of the bend — and PADS, where the cloth bags out: the
//     knee, the elbow, a sleeve ballooned between them;
//   * the TORSO's own fold (`torsoFold`) — the jacket gathering across the
//     belly as he leans over the bars, hanging in soft vertical folds down
//     the back from the shoulder blades, a channel down the spine;
//   * the PANTS' seat is two lobes and a cleft (`skier-figure.ts` lays them) — a
//     skier seen from behind is a backside in a pair of pants, never a can.
//
// Angles round a section: 0 is +x, π/2 +z, 3π/2 −z. On the torso +z is out
// of the chest; on a limb it is where the joint's bend points (`skier-figure.ts`
// turns each limb so): the front of the knee on a thigh and a shin, the
// point of the elbow on a sleeve — so a knee pad sits on the knee and the
// creases gather in the crook behind it.

import * as THREE from "three";

/** One ring of a shaped section: at `y` along it, `w` and `d` its half
 * width (x) and half depth (z), set `z` forward. */
export type Ring = { y: number; w: number; d: number; z?: number };

/** A ring pushed out (positive) or in, as a share of its radius, at `y`
 * along the part and `t` round it. */
export type Fold = (y: number, t: number) => number;

export type ShapeOptions = {
  /** Round a ring, 10 by default. */
  segments?: number;
  /** How boxy a section is: 2 an ellipse, higher squarer; 2.6 default. */
  boxy?: number;
  /** The most room between two rings, m — a number, or a function of
   * where along the part (fine where the creases gather, coarse between);
   * rings are laid between those given, smoothed through them. A crease
   * wants four rings a ridge or it breaks up into a saw. */
  step?: number | ((y: number) => number);
  fold?: Fold;
};

function smooth(p0: number, p1: number, p2: number, p3: number, u: number): number {
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
      (3 * p1 - p0 - 3 * p2 + p3) * u * u * u)
  );
}

/** The rings given with more between each pair, no further apart than
 * `step`, smoothed through them — the lengthwise positions straight, the
 * widths curved. */
function refine(rings: Ring[], step: ShapeOptions["step"]): Ring[] {
  if (step === undefined) return rings;
  const room = typeof step === "number" ? () => step : step;
  const out: Ring[] = [];
  const at = (i: number) => rings[Math.max(0, Math.min(rings.length - 1, i))];
  for (let i = 0; i + 1 < rings.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const gap = Math.abs(p2.y - p1.y);
    // The finest the stretch asks for anywhere along it.
    let want = Infinity;
    for (let k = 0; k <= 4; k++) want = Math.min(want, room(p1.y + ((p2.y - p1.y) * k) / 4));
    const sub = Math.max(0, Math.ceil(gap / want) - 1);
    for (let k = 0; k <= sub; k++) {
      const u = k / (sub + 1);
      out.push({
        y: p1.y + (p2.y - p1.y) * u,
        w: Math.max(0.002, smooth(p0.w, p1.w, p2.w, p3.w, u)),
        d: Math.max(0.002, smooth(p0.d, p1.d, p2.d, p3.d, u)),
        z: smooth(p0.z ?? 0, p1.z ?? 0, p2.z ?? 0, p3.z ?? 0, u),
      });
    }
  }
  out.push(rings[rings.length - 1]);
  return out;
}

/**
 * A SHAPED SECTION — rings of a rounded box laid along +y, closed at both
 * ends, with smooth normals: a sleeve that tapers and creases, a torso
 * with shoulders and a jacket's folds.
 */
export function shaped(given: Ring[], o: ShapeOptions = {}): THREE.BufferGeometry {
  const segments = o.segments ?? 10;
  const e = 2 / (o.boxy ?? 2.6);
  const rings = refine(given, o.step);
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) {
    for (let k = 0; k < segments; k++) {
      const t = (k / segments) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const f = 1 + (o.fold ? o.fold(r.y, t) : 0);
      pos.push(
        f * r.w * Math.sign(c) * Math.abs(c) ** e,
        r.y,
        (r.z ?? 0) + f * r.d * Math.sign(s) * Math.abs(s) ** e,
      );
    }
  }
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < segments; k++) {
      const a = i * segments + k;
      const b = i * segments + ((k + 1) % segments);
      idx.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  // The caps, each a fan round a point just past its end ring.
  for (const [i, dir] of [
    [0, -1],
    [rings.length - 1, 1],
  ] as const) {
    const r = rings[i];
    const lip = rings[i - dir];
    const past = lip ? Math.abs(r.y - lip.y) * 0.35 : 0;
    const centre = pos.length / 3;
    pos.push(0, r.y + dir * past, r.z ?? 0);
    for (let k = 0; k < segments; k++) {
      const a = i * segments + k;
      const b = i * segments + ((k + 1) % segments);
      if (dir > 0) idx.push(b, a, centre);
      else idx.push(a, b, centre);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A limb's rings: round sections `r` (half widths, m) spread evenly from
 * one joint (y 0) to `length`, a rounded end past each; `flat` the depth
 * as a share of the width. */
export function limbRings(length: number, r: number[], flat = 1): Ring[] {
  const first = r[0];
  const last = r[r.length - 1];
  return [
    { y: -first * 0.75, w: first * 0.55, d: first * 0.55 * flat },
    { y: -first * 0.35, w: first * 0.9, d: first * 0.9 * flat },
    ...r.map((w, i) => ({ y: (length * i) / (r.length - 1), w, d: w * flat })),
    { y: length + last * 0.35, w: last * 0.9, d: last * 0.9 * flat },
    { y: length + last * 0.75, w: last * 0.55, d: last * 0.55 * flat },
  ];
}

/** A place creases gather: `at` along the part, dying away over `reach`,
 * a ridge every `pitch` m, `amp` deep (a share of the radius) — on one
 * `side` (+1 the front of the part, its +z; -1 the back) or all round. */
export type Gather = { at: number; reach: number; pitch: number; amp: number; side?: number };

/** Cloth pushed out in one place — a knee pad, a sleeve bagged at the
 * elbow — `amp` of the radius at `at`, over `reach`, on `side`. */
export type Pad = { at: number; reach: number; amp: number; side?: number };

/** How much of a fold a side gets at `t` round the part. */
function sided(side: number | undefined, t: number): number {
  if (!side) return 1;
  return Math.max(0, side * Math.sin(t)) ** 1.2;
}

/** Soft ridges gathered round joints — across the crook where `side` says,
 * wound a little round the part — and the pads the cloth bags into. */
export function creases(gathers: Gather[], pads: Pad[] = []): Fold {
  return (y, t) => {
    let f = 0;
    for (const g of gathers) {
      const k = 1 - Math.abs(y - g.at) / g.reach;
      if (k <= 0) continue;
      const wind = 0.9 * Math.cos(t) + 0.5 * Math.cos(2 * t + 0.6);
      f += g.amp * k * k * sided(g.side, t) * Math.sin(((y - g.at) / g.pitch) * Math.PI * 2 + wind);
    }
    for (const p of pads) f += p.amp * bump(y, p.at, p.reach) * sided(p.side, t);
    return f;
  };
}

/** Room between rings for these gathers: a third of a ridge where they
 * are deep enough to see, `coarse` elsewhere. */
export function gatherStep(gathers: Gather[], coarse = 0.07): (y: number) => number {
  return (y) => {
    let s = coarse;
    for (const g of gathers) {
      if (Math.abs(y - g.at) < 0.75 * g.reach) s = Math.min(s, g.pitch / 3);
    }
    return s;
  };
}

/** A limb's cloth, coarse on purpose — `segments` round, boxy — creased at
 * its gathers and bagged at its pads, its rings laid to carry them. */
export function cloth(segments: number, gathers: Gather[], pads: Pad[] = []): ShapeOptions {
  return { segments, boxy: 2.4, fold: creases(gathers, pads), step: gatherStep(gathers) };
}

/** Both at once. */
export function both(a: Fold, b: Fold): Fold {
  return (y, t) => a(y, t) + b(y, t);
}

function bump(x: number, at: number, reach: number): number {
  const k = 1 - Math.abs(x - at) / reach;
  return k > 0 ? k * k * (3 - 2 * k) : 0;
}

/** THE JACKET's folds, in the torso's frame (y up the spine from the hips,
 * `top` the shoulders' height): gathered across the belly where he bends
 * over the bars, hanging in soft vertical folds down the back, the shoulder
 * blades under it and a channel down the spine. */
export function torsoFold(top: number): Fold {
  return (y, t) => {
    const front = Math.max(0, Math.sin(t));
    const back = Math.max(0, -Math.sin(t));
    // Across the belly: the jacket bunched in three soft rolls.
    const belly = 0.045 * front ** 1.5 * bump(y, 0.13, 0.12) * Math.sin(y * 95 + 0.8 * Math.cos(t));
    // Down the back: a few folds hanging from the blades, gone by the hem.
    const drape = 0.026 * back ** 2 * bump(y, 0.2, 0.17) * Math.sin(5 * t + y * 6);
    // The shoulder blades, and the spine between them.
    const across = Math.cos(t);
    const blades =
      0.04 * back * bump(y, top - 0.09, 0.12) * bump(Math.abs(across), 0.45, 0.35) -
      0.025 * back ** 6 * bump(y, 0.22, 0.2);
    // Where the arms go in, the jacket pulled into a crease or two.
    const pit = 0.03 * bump(Math.abs(across), 0.97, 0.1) * bump(y, top - 0.12, 0.08);
    return belly + drape + blades - pit;
  };
}
