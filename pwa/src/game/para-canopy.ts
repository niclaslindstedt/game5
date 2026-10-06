// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S WING AS DRAWN (`para-scene.ts` hangs it) — three-free, so
// the suite reads it. Every number is the class's (`docs/paramotor.md`):
//
//   * THE PLANFORM is an ellipse: a flat span of 7.8 m on 16 m² (a flat
//     aspect ratio near 3.8, a speed wing's), the chord 2.45 m at the centre
//     falling to half of it at the tips, the leading edge nearly straight
//     through the middle and swept back at the tips, the trailing edge the
//     more curved.
//   * THE ARC is tighter at the tips than in the middle, so seen from the
//     front it is a C whose tips curl down to some 65° — which leaves a
//     projected span of about 0.83 of the flat, as the class's sheets give.
//   * 25 CELLS between 26 ribs, each an airfoil 15 % thick with a little
//     camber; the TOP SKIN PILLOWS between the ribs and the trailing edge
//     is SCALLOPED between them; the CELL MOUTHS are open slots on the
//     underside just behind the nose, dark inside, and the outer two cells
//     of each tip are closed; a STABILIZER hangs under each tip.
//   * THE BRAKES pull the trailing edge down, more toward the tips than in
//     the middle, each toggle its own side.
//   * THE LINES in three levels of cascade — uppers off the canopy, middles,
//     mains — down the A, B and C rows and the brakes to the risers, in the
//     colours a line plan codes them by: the A's red, the brakes and the
//     stabilizer's orange, the rest yellow.
//
// The frame is the canopy's own: x to the right, y up the lines (the
// canopy's centre at the origin), z forward.

/** THE SHAPE. */
export const CANOPY = {
  cells: 25,
  /** The flat span along the arc, m, and the chord at the centre, m. */
  span: 7.8,
  chord: 2.45,
  /** The share of the chord the tips keep. */
  tip: 0.5,
  /** The arc's turn at the tip, rad, and how much of it gathers at the
   * tips (0 a round arc). */
  curl: 1.15,
  gather: 0.4,
  /** How far the leading edge sweeps back where the chord falls short, as
   * a share of what the chord loses. */
  sweep: 0.72,
  /** The section: thickness and camber, shares of the chord. */
  thick: 0.15,
  camber: 0.025,
  /** The top skin's pillow between ribs and the trailing edge's scallop,
   * shares of the chord. */
  pillow: 0.018,
  scallop: 0.035,
  /** The mouth along the underside behind the nose, shares of the chord;
   * the closed cells at each tip. */
  mouth: [0.01, 0.07] as const,
  closed: 2,
  /** The stabilizer's depth under the tip, m. */
  stabilo: 0.45,
  /** The trailing edge pulled down at a toggle all the way down, m, and
   * from how far back along the chord. */
  brake: 0.6,
  brakeFrom: 0.6,
  /** Strips across a cell, stations along the chord. */
  strips: 3,
  stations: 12,
} as const;

/** THE PAINT: a three-colour scheme in large panels — the base, the
 * swoosh across it, the tips — and the underside a shade under it; the
 * cells' insides, seen through the mouths. */
export const CANOPY_PAINT = {
  base: [0.86, 0.14, 0.12],
  swoosh: [0.97, 0.97, 0.95],
  tips: [0.08, 0.09, 0.12],
  under: 0.72,
  mouth: [0.04, 0.04, 0.05],
} as const;

/** THE LINES' COLOURS, by row — a line plan's coding, dulled a little, as
 * thin line reads at a few metres. */
export const LINE_PAINT = {
  A: [0.62, 0.1, 0.08],
  B: [0.72, 0.6, 0.12],
  C: [0.72, 0.6, 0.12],
  brake: [0.78, 0.38, 0.06],
  stabilo: [0.78, 0.38, 0.06],
} as const;

type Rib = {
  /** The rib's foot on the arc: x, y; its up (out of the arc). */
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Its chord and the leading edge's z. */
  chord: number;
  lead: number;
  /** Where along the span, −1..1. */
  u: number;
};

/** How finely the arc is integrated along each half-span. */
const ARC_STEPS = 400;

/** The arc's turn at `u` (−1..1 along the flat span). */
const turnAt = (u: number): number =>
  CANOPY.curl * ((1 - CANOPY.gather) * u + CANOPY.gather * u * u * u);

/** The arc sampled along the flat span: where each point lies. */
const ARC = (() => {
  const half = CANOPY.span / 2;
  const xs = new Float64Array(ARC_STEPS + 1);
  const ys = new Float64Array(ARC_STEPS + 1);
  // From the centre out to the right; the left is its mirror.
  let x = 0;
  let y = 0;
  const dl = half / ARC_STEPS;
  for (let i = 0; i <= ARC_STEPS; i++) {
    xs[i] = x;
    ys[i] = y;
    const a = turnAt((i + 0.5) / ARC_STEPS);
    x += Math.cos(a) * dl;
    y -= Math.sin(a) * dl;
  }
  return { xs, ys };
})();

/** The rib (or the section between ribs) at `u`. */
export function ribAt(u: number): Rib {
  const a = Math.min(1, Math.abs(u)) * ARC_STEPS;
  const i = Math.min(ARC_STEPS - 1, Math.floor(a));
  const f = a - i;
  const sx = ARC.xs[i] + (ARC.xs[i + 1] - ARC.xs[i]) * f;
  const y = ARC.ys[i] + (ARC.ys[i + 1] - ARC.ys[i]) * f;
  const turn = turnAt(u);
  const chord = CANOPY.chord * Math.sqrt(1 - (1 - CANOPY.tip ** 2) * u * u);
  const lost = CANOPY.chord - chord;
  return {
    x: Math.sign(u) * sx,
    y,
    nx: Math.sin(turn),
    ny: Math.cos(turn),
    chord,
    lead: 0.3 * CANOPY.chord - lost * CANOPY.sweep,
    u,
  };
}

/** The half-thickness of the section at `s` along the chord (a symmetric
 * four-digit section's). */
export function halfThick(s: number): number {
  return (
    5 *
    CANOPY.thick *
    (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4)
  );
}

/** A POINT ON THE CANOPY into `out` at `o`: at `u` along the span, `s`
 * along the chord, on the top skin (`side` 1) or the bottom (−1), `v`
 * across its cell (0 and 1 on the ribs), the trailing edge pulled down by
 * `drop` m. */
export function canopyPoint(
  u: number,
  s: number,
  side: number,
  v: number,
  drop: number,
  out: Float32Array | number[],
  o: number,
): void {
  const r = ribAt(u);
  const c = r.chord;
  const mean = CANOPY.camber * c * 4 * s * (1 - s);
  // The pillow: the skin bellied out between ribs, flat at them and dying
  // out toward the tail.
  const belly = Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.min(1, s / 0.92));
  const pillow = side > 0 ? CANOPY.pillow * c * belly : -0.3 * CANOPY.pillow * c * belly;
  const pull =
    s > CANOPY.brakeFrom ? drop * ((s - CANOPY.brakeFrom) / (1 - CANOPY.brakeFrom)) ** 2 : 0;
  const h = mean + side * halfThick(s) * c + pillow - pull;
  out[o] = r.x + r.nx * h;
  out[o + 1] = r.y + r.ny * h;
  out[o + 2] = r.lead - c * s;
}

/** How far the brakes pull the trailing edge down at `u`, m: both brakes
 * the more toward the tips, each toggle its own side. */
export function brakeDrop(u: number, left: number, right: number): number {
  const out = 0.35 + 0.65 * Math.abs(u);
  return CANOPY.brake * out * (u < 0 ? left : right);
}

/** THE PAINT AS THE SHADER LAYS IT, off each vertex's `aPaint` (its
 * place along the span, along the chord, and its skin — negative the
 * bottom, past 1.5 an open cell's), so the panels' edges, the mouths and
 * the ribs' seams are crisp at any distance. `canopyPaint(p)` is the
 * colour there; the same rule as `paintAt` below. */
export const PAINT_GLSL = /* glsl */ `
vec3 canopyPaint(vec3 p) {
  float u = p.x;
  float s = p.y;
  bool under = p.z < 0.0;
  bool open = abs(p.z) > 1.5;
  if (under && open && s > ${CANOPY.mouth[0].toFixed(3)} && s < ${CANOPY.mouth[1].toFixed(3)})
    return vec3(${CANOPY_PAINT.mouth.join(", ")});
  float au = abs(u);
  float line = 0.15 + au * 0.95;
  float off = abs(s - line);
  vec3 c = au > 0.8 ? vec3(${CANOPY_PAINT.tips.join(", ")})
    : off < 0.13 ? vec3(${CANOPY_PAINT.swoosh.join(", ")})
    : vec3(${CANOPY_PAINT.base.join(", ")});
  // The swoosh's edge piped in the tips' colour.
  if (au <= 0.8 && abs(off - 0.13) < 0.012) c = vec3(${CANOPY_PAINT.tips.join(", ")});
  // The ribs' seams, a shade darker.
  float v = fract((u + 1.0) * ${(CANOPY.cells / 2).toFixed(1)});
  if (v < 0.015 || v > 0.985) c *= 0.82;
  return under ? c * ${CANOPY_PAINT.under.toFixed(2)} : c;
}
`;

/** `canopyPaint` restated for the suite: the colour at `u`, `s` on a skin
 * (`side` 1 the top), cell `cell`. */
export function paintAt(u: number, s: number, side: number, cell: number): readonly number[] {
  const P = CANOPY_PAINT;
  const open = cell >= CANOPY.closed && cell < CANOPY.cells - CANOPY.closed;
  if (side < 0 && open && s > CANOPY.mouth[0] && s < CANOPY.mouth[1]) return P.mouth;
  const au = Math.abs(u);
  const off = Math.abs(s - (0.15 + au * 0.95));
  const c = au > 0.8 ? P.tips : off < 0.13 ? P.swoosh : P.base;
  return side < 0 ? c.map((x) => x * P.under) : c;
}

/** The chord's stations, bunched at the nose where the section is round. */
export const stationAt = (j: number): number => (j / CANOPY.stations) ** 1.7;

/** THE MESH'S LAYOUT: per cell, per skin, a grid of `strips + 1` across by
 * `stations + 1` along — its own vertices, so a cell's colours and its
 * seam at the rib are crisp — and the two stabilizers' triangles. */
export type CanopyLayout = {
  vertices: number;
  index: Uint32Array;
  /** Each vertex's `aPaint` (`PAINT_GLSL`). */
  paint: Float32Array;
};

const ACROSS = CANOPY.strips + 1;
const ALONG = CANOPY.stations + 1;
const GRID = ACROSS * ALONG;
/** Each stabilizer is a triangle, drawn both ways round. */
const STAB = 3;

export function canopyLayout(): CanopyLayout {
  const cells = CANOPY.cells;
  const vertices = cells * 2 * GRID + 2 * STAB;
  const paint = new Float32Array(vertices * 3);
  const index: number[] = [];
  let base = 0;
  for (let i = 0; i < cells; i++) {
    for (const side of [1, -1]) {
      for (let a = 0; a < ACROSS; a++) {
        const u = cellU(i, a / CANOPY.strips);
        for (let j = 0; j < ALONG; j++) {
          const open = i >= CANOPY.closed && i < CANOPY.cells - CANOPY.closed;
          paint.set([u, stationAt(j), side * (open ? 2 : 1)], (base + a * ALONG + j) * 3);
        }
      }
      for (let a = 0; a < CANOPY.strips; a++) {
        for (let j = 0; j < CANOPY.stations; j++) {
          const p = base + a * ALONG + j;
          const q = p + ALONG;
          // The top skin faces up, the bottom down.
          if (side > 0) index.push(p, p + 1, q + 1, p, q + 1, q);
          else index.push(p, q + 1, p + 1, p, q, q + 1);
        }
      }
      base += GRID;
    }
  }
  for (let t = 0; t < 2; t++) {
    for (let k = 0; k < STAB; k++) paint.set([t === 0 ? -1 : 1, 0.5, 1], (base + k) * 3);
    index.push(base, base + 1, base + 2, base, base + 2, base + 1);
    base += STAB;
  }
  return { vertices, index: new Uint32Array(index), paint };
}

/** Where `v` across cell `i` lies along the span, −1..1. */
export const cellU = (i: number, v: number): number => -1 + (2 * (i + v)) / CANOPY.cells;

/** THE MESH'S POSITIONS for the brakes, into `out` (`canopyLayout`'s
 * order). */
export function shapeCanopy(out: Float32Array, left: number, right: number): void {
  let base = 0;
  for (let i = 0; i < CANOPY.cells; i++) {
    for (const side of [1, -1]) {
      for (let a = 0; a < ACROSS; a++) {
        const v = a / CANOPY.strips;
        const u = cellU(i, v);
        const drop = brakeDrop(u, left, right);
        // The scallop: the tail cut short between ribs.
        const tail = 1 - CANOPY.scallop * Math.sin(Math.PI * v);
        for (let j = 0; j < ALONG; j++) {
          canopyPoint(u, stationAt(j) * tail, side, v, drop, out, (base + a * ALONG + j) * 3);
        }
      }
      base += GRID;
    }
  }
  // THE STABILIZERS: a fin under each tip, its point hung toward the pilot.
  for (const u of [-1, 1]) {
    const r = ribAt(u);
    canopyPoint(u, 0.12, -1, 0, 0, out, base * 3);
    canopyPoint(u, 0.92, -1, 0, 0, out, (base + 1) * 3);
    const d = CANOPY.stabilo;
    canopyPoint(u, 0.55, -1, 0, 0, out, (base + 2) * 3);
    // Down its rib's up, and in toward the middle.
    out[(base + 2) * 3] += -r.nx * d - Math.sign(u) * d * 0.3;
    out[(base + 2) * 3 + 1] += -r.ny * d;
    base += STAB;
  }
}

/** THE LINE PLAN. A node is a point on the canopy (a leaf, at `u`, `s` on
 * the bottom skin, or the stabilizer's point) or a knot: the mean of its
 * children drawn `down` of the way from them to its riser. Every node
 * hangs off one riser: the A, B and C risers and the brake's pulley on
 * each side. */
export type LineNode = {
  /** −1 the left riser set, 1 the right. */
  side: number;
  /** Which riser. */
  riser: "A" | "B" | "C" | "brake";
  /** Its colour (`LINE_PAINT`). */
  paint: keyof typeof LINE_PAINT;
  /** A leaf's place on the canopy, or a knot's children and how far down
   * toward the riser it hangs. */
  leaf: { u: number; s: number; stabilo?: boolean } | null;
  children: number[];
  down: number;
};

/** The rows along the chord, shares of it. */
const ROWS = { A: 0.08, B: 0.3, C: 0.56 } as const;
/** How far down from the canopy the middle and the main knots hang. */
const MIDDLE = 0.3;
const MAIN = 0.62;

/** THE WHOLE PLAN, each knot after its children. A node no knot gathers
 * (a main, the stabilizer's line) is tied straight to its riser. */
export function linePlan(): LineNode[] {
  const nodes: LineNode[] = [];
  const add = (n: LineNode): number => nodes.push(n) - 1;
  for (const side of [-1, 1]) {
    // The ribs on this side, centre out (every rib carries the A, B, C
    // rows; the closed tip's last rib the stabilizer).
    const ribs: number[] = [];
    for (let k = 0; k <= CANOPY.cells; k++) {
      const u = cellU(k, 0);
      if (side * u > 0.02) ribs.push(u);
    }
    if (side < 0) ribs.reverse();
    for (const row of ["A", "B", "C"] as const) {
      const leaves = ribs.map((u) =>
        add({
          side,
          riser: row,
          paint: row,
          leaf: { u, s: ROWS[row] },
          children: [],
          down: 0,
        }),
      );
      cascade(add, leaves, side, row);
    }
    // The brakes: the trailing edge's outer ribs.
    const tail = ribs.filter((u) => Math.abs(u) > 0.25 && Math.abs(u) < 0.97);
    const leaves = tail.map((u) =>
      add({
        side,
        riser: "brake",
        paint: "brake",
        leaf: { u, s: 0.985 },
        children: [],
        down: 0,
      }),
    );
    cascade(add, leaves, side, "brake");
    // The stabilizer's line, to the B riser.
    add({
      side,
      riser: "B",
      paint: "stabilo",
      leaf: { u: side, s: 0.55, stabilo: true },
      children: [],
      down: 0,
    });
  }
  return nodes;
}

/** Leaves gathered into middles in twos and threes, middles into mains. */
function cascade(
  add: (n: LineNode) => number,
  leaves: number[],
  side: number,
  riser: LineNode["riser"],
): void {
  const paint = riser;
  const gather = (from: number[], each: number, down: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < from.length; i += each) {
      const children = from.slice(i, i + each);
      out.push(add({ side, riser, paint, leaf: null, children, down }));
    }
    return out;
  };
  // The brakes run two uppers to a middle and every middle to one main.
  const middles = gather(leaves, 2, MIDDLE);
  gather(middles, riser === "brake" ? middles.length : 2, MAIN);
}
