// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS, BUILT — the gate pole and its panel, a ski cross's
// stubby pole and triangular flag, the edge stake and its band, the marker
// over the owed gate, the start hut, and the inflatable arch with its
// skirts and blowers: every one PROCEDURALLY, on
// the trees' bench (`tree-mesh.ts`), in the same chunky, faceted, low-poly
// look as the woods and the wildlife around them. `gates.ts` places and
// colours them; the measures are `start-arch.ts`'s (`ARCH`, `GATE`) and
// `gates.ts`'s own.
//
// FLAT COLOUR A FACE, faceted light. A part that is one colour per instance
// (a pole, a panel, a stake — tinted by `setColorAt`) is built WHITE, so the
// instance's colour is the colour; a part with paint of its own (the hut's
// planks, the marker's white cap, the arch's piping) carries it per face.
// Every face is lit half by its own normal and half by the part's mass, so
// a pole reads as a faceted stake rather than a smooth tube and the arch as
// a fat fabric tube of panels.

import * as THREE from "three";

import { PALETTE } from "../identity.ts";
import { ARCH, GATE, type ArchPlan } from "./start-arch.ts";
import { Shape, type V3 } from "./tree-mesh.ts";

const colour = (hex: THREE.ColorRepresentation): THREE.Color => new THREE.Color(hex);
const WHITE = colour(0xffffff);

/** A fresh bench for a mark: no lean, no trunk, every face wound outward. */
function bench(facet = 0.6): Shape {
  const s = new Shape(0, { stems: false, wind: true });
  s.facet = facet;
  return s;
}

/** A ring of `sides` round (`x`, `z`) at height `y`. */
function ring(x: number, y: number, z: number, r: number, sides: number, turn = 0): V3[] {
  return Array.from({ length: sides }, (_, k) => {
    const a = turn + (k / sides) * Math.PI * 2;
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r] as V3;
  });
}

/** An upright faceted post from its foot at the origin: `bands` of
 * (height, radius, colour) stacked up it, capped flat or to a `point`. */
function post(
  s: Shape,
  bands: readonly { y: number; r: number; c: THREE.Color }[],
  sides: number,
  point = 0,
): void {
  const rings = bands.map((b) => ring(0, b.y, 0, b.r, sides));
  const centres = bands.map((b) => [0, b.y, 0] as V3);
  s.loft(rings, centres, (k) => bands[k + 1].c);
  const top = bands[bands.length - 1];
  s.cap(rings[rings.length - 1], [0, top.y + point, 0], top.c, [0, 1, 0]);
}

/** THE GATE POLE: a hinged plastic stake, its foot's spring hinge dark,
 * from the snow up to `height`. White: the instance's colour is its own. */
export function gatePole(height: number, radius: number): THREE.BufferGeometry {
  const s = bench();
  const hinge = colour(0x3a3e44);
  post(
    s,
    [
      { y: 0, r: radius * 1.3, c: hinge },
      { y: 0.16, r: radius * 1.3, c: hinge },
      { y: 0.2, r: radius, c: WHITE },
      { y: height, r: radius * 0.9, c: WHITE },
    ],
    5,
    radius,
  );
  return s.geometry();
}

/** THE PANEL between a gate's two poles: a cloth `gap` wide and `drop`
 * deep, hung from the poles' top at `top`, bellied by the wind a little so
 * its facets catch the light, a sleeve down each edge. Along x, facing z. */
export function gatePanel(gap: number, drop: number, top: number): THREE.BufferGeometry {
  const s = bench(0.75);
  const cols = 3;
  const rows = 2;
  const belly = gap * 0.05;
  const at = (i: number, j: number): V3 => {
    const u = i / cols;
    const v = j / rows;
    const z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.5 + 0.3) * belly;
    return [(u - 0.5) * gap, top - v * drop, z];
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      s.quad(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j), WHITE, [0, 0, 1]);
    }
  }
  // The sleeves the poles go through: a darker hem, slid down each pole.
  const sleeve = colour(0xd8dadc);
  for (const side of [-1, 1]) {
    const x = (side * gap) / 2;
    const r = 0.03;
    const sleeveRings = [
      ring(x, top - drop, 0, r, 4, Math.PI / 4),
      ring(x, top + 0.02, 0, r, 4, Math.PI / 4),
    ];
    s.loft(
      sleeveRings,
      [
        [x, top - drop, 0],
        [x, top, 0],
      ],
      () => sleeve,
    );
  }
  return s.geometry();
}

/** THE EDGE STAKE: a faceted pole to `height`, pointed at the top. White:
 * its grade's colour is the instance's. */
export function edgeStake(height: number, radius: number): THREE.BufferGeometry {
  const s = bench();
  post(
    s,
    [
      { y: 0, r: radius * 1.3, c: WHITE },
      { y: height, r: radius, c: WHITE },
    ],
    5,
    radius * 2,
  );
  return s.geometry();
}

/** THE BAND round a right-hand stake's top, `band` deep under `height`. */
export function edgeBand(height: number, band: number, radius: number): THREE.BufferGeometry {
  const s = bench();
  const r = radius * 1.4;
  const rings = [ring(0, height - band, 0, r, 5), ring(0, height, 0, r, 5)];
  s.loft(
    rings,
    [
      [0, height - band, 0],
      [0, height, 0],
    ],
    () => WHITE,
  );
  s.cap(rings[1], [0, height, 0], WHITE, [0, 1, 0]);
  s.cap(rings[0], [0, height - band, 0], WHITE, [0, -1, 0], true);
  return s.geometry();
}

/** THE MARKER over the owed gate: a cut gem, point down — four red facets
 * falling to the point and a white table on top that catches the sun from
 * the start, so it reads over a crest. About its centre. */
export function gateMarker(): THREE.BufferGeometry {
  const s = bench(0.8);
  const w = GATE.marker.width / 2;
  const h = GATE.marker.height;
  const red = colour(PALETTE.flag);
  const girdle = ring(0, h * 0.25, 0, w, 4, Math.PI / 4);
  const table = ring(0, h * 0.42, 0, w * 0.55, 4, Math.PI / 4);
  s.loft(
    [girdle, table],
    [
      [0, h * 0.25, 0],
      [0, h * 0.42, 0],
    ],
    () => red,
  );
  s.cap(table, [0, h * 0.42, 0], WHITE, [0, 1, 0]);
  s.cap(girdle, [0, -h * 0.58, 0], red, [0, -1, 0], true);
  return s.geometry();
}

/** THE START HUT: a timber box under a gabled roof with its eaves out and
 * its ridge loaded with snow, the side to the piste OPEN — a counter at
 * waist height, the starter's window. `width` across the piste's line
 * (x), `depth` along it (z), its open face to +x — the skier's right, and
 * the hut stands off the line's left edge, so the window is to the piste. */
export function startHut(width: number, depth: number, height: number): THREE.BufferGeometry {
  const s = bench(0.7);
  const plank = [colour(0x6b4a2e), colour(0x5c3f27)];
  const trim = colour(0x3e2a1a);
  const roof = colour(0x2c3036);
  const snow = colour(0xf2f5f8);
  const hw = width / 2;
  const hd = depth / 2;
  const boards = 5;
  // A wall from (x0, z0) to (x1, z1), planked in courses of two browns; a
  // window course left open where `open` asks (from–to of the height).
  const wall = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    out: V3,
    open?: [number, number],
  ): void => {
    for (let k = 0; k < boards; k++) {
      const y0 = (k / boards) * height;
      const y1 = ((k + 1) / boards) * height;
      if (open && y0 >= open[0] - 1e-6 && y1 <= open[1] + 1e-6) continue;
      s.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], plank[k % 2], out);
    }
  };
  wall(hw, -hd, hw, hd, [1, 0, 0], [height * 0.4, height * 0.8]);
  wall(-hw, hd, hw, hd, [0, 0, 1]);
  wall(hw, -hd, -hw, -hd, [0, 0, -1]);
  wall(-hw, -hd, -hw, hd, [-1, 0, 0]);
  // The counter under the window, and the posts at its corners.
  const cy = height * 0.4;
  s.quad([hw, cy, -hd], [hw, cy, hd], [hw + 0.25, cy, hd], [hw + 0.25, cy, -hd], trim, [0, 1, 0]);
  for (const z of [-hd, hd]) {
    s.tube([hw, 0, z], [hw, height, z], 0.07, 0.07, 4, trim);
  }
  // The gable roof: two slopes over the eaves, the gables' triangles, and
  // the snow on top — a white plane on each slope, thick at the ridge.
  const eave = 0.35;
  const ridge = height + width * 0.32;
  const rx = hw + eave;
  const rz = hd + eave;
  for (const side of [-1, 1]) {
    const e0: V3 = [side * rx, height - 0.08, -rz];
    const e1: V3 = [side * rx, height - 0.08, rz];
    const r0: V3 = [0, ridge, -rz];
    const r1: V3 = [0, ridge, rz];
    s.quad(e0, e1, r1, r0, roof, [side * 0.6, 1, 0]);
    const lift = 0.07;
    const m0: V3 = [side * rx * 0.85, height - 0.08 + (ridge - height) * 0.15 + lift, -rz];
    const m1: V3 = [side * rx * 0.85, height - 0.08 + (ridge - height) * 0.15 + lift, rz];
    s.quad(m0, m1, [0, ridge + lift * 1.6, rz], [0, ridge + lift * 1.6, -rz], snow, [
      side * 0.5,
      1,
      0,
    ]);
  }
  for (const z of [-hd, hd]) {
    s.tri([-hw, height, z], [hw, height, z], [0, ridge, z], plank[1], [0, 0, Math.sign(z)]);
  }
  return s.geometry();
}

/** THE ARCH'S TUBE in the world, round the plan's path (`path`, up one leg,
 * round the shoulder, across, round, down): a fat fabric tube of eight
 * panels a ring, flat-coloured the brand red, a narrow white PIPING ring at
 * every seam — at the shoulders and mid-span, one pair of stations either
 * side of each, never the nearest station's whole width (a candy cane). */
export function archTube(
  plan: ArchPlan,
  path: THREE.CurvePath<THREE.Vector3>,
): THREE.BufferGeometry {
  const s = bench(0.55);
  const lengths = path.getCurveLengths();
  const total = lengths[lengths.length - 1];
  const us: number[] = [0, 1];
  const seams: number[] = [];
  let from = 0;
  path.curves.forEach((curve, k) => {
    const to = lengths[k];
    // A straight leg or the span is one panel; a shoulder is bent through
    // five.
    const steps = curve instanceof THREE.LineCurve3 ? (k === 2 ? 2 : 1) : 5;
    for (let i = 1; i < steps; i++) us.push((from + ((to - from) * i) / steps) / total);
    if (curve instanceof THREE.QuadraticBezierCurve3) seams.push(from / total, to / total);
    if (k === 2) seams.push((from + to) / 2 / total);
    from = to;
  });
  const pipe = 0.05 / total;
  for (const u of seams) us.push(u - pipe, u + pipe);
  us.sort((a, b) => a - b);
  const fwd = new THREE.Vector3(-plan.rz, 0, plan.rx).normalize();
  const sides = 8;
  const rings: V3[][] = [];
  const centres: V3[] = [];
  const piped: boolean[] = [];
  const c = new THREE.Vector3();
  const t = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (const u of us) {
    path.getPointAt(u, c);
    path.getTangentAt(Math.min(0.999, Math.max(0.001, u)), t);
    v.crossVectors(t, fwd).normalize();
    rings.push(
      Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2 + Math.PI / sides;
        return [
          c.x + (Math.cos(a) * fwd.x + Math.sin(a) * v.x) * ARCH.tube,
          c.y + (Math.cos(a) * fwd.y + Math.sin(a) * v.y) * ARCH.tube,
          c.z + (Math.cos(a) * fwd.z + Math.sin(a) * v.z) * ARCH.tube,
        ] as V3;
      }),
    );
    centres.push([c.x, c.y, c.z]);
    piped.push(seams.some((sm) => Math.abs(sm - pipe - u) < 1e-9));
  }
  const red = colour(PALETTE.flag);
  s.loft(rings, centres, (k) => (piped[k] ? WHITE : red));
  return s.geometry();
}

/** AN ARCH'S FOOT: the weighted skirt it stands in, faceted, from the snow
 * at the origin. */
export function archSkirt(): THREE.BufferGeometry {
  const s = bench();
  const dark = colour(0x23282e);
  post(
    s,
    [
      { y: 0, r: ARCH.tube * 1.35, c: dark },
      { y: 0.8, r: ARCH.tube * 1.2, c: dark },
    ],
    8,
  );
  return s.geometry();
}

/** THE BLOWER that keeps the arch up: a squat box on the snow, its grille
 * a lighter face toward the leg. */
export function archBlower(): THREE.BufferGeometry {
  const s = bench(0.8);
  const dark = colour(0x23282e);
  const grille = colour(0x4a525a);
  const w = 0.225;
  const h = 0.4;
  const d = 0.275;
  const p = (x: number, y: number, z: number): V3 => [x * w, y * h, z * d];
  s.quad(p(-1, 0, 1), p(1, 0, 1), p(1, 1, 1), p(-1, 1, 1), grille, [0, 0, 1]);
  s.quad(p(1, 0, -1), p(-1, 0, -1), p(-1, 1, -1), p(1, 1, -1), dark, [0, 0, -1]);
  s.quad(p(1, 0, 1), p(1, 0, -1), p(1, 1, -1), p(1, 1, 1), dark, [1, 0, 0]);
  s.quad(p(-1, 0, -1), p(-1, 0, 1), p(-1, 1, 1), p(-1, 1, -1), dark, [-1, 0, 0]);
  s.quad(p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1), dark, [0, 1, 0]);
  return s.geometry();
}

/** A SKI-CROSS GATE'S STUBBY POLE: the short flex turning pole a racer
 * skis past and knocks, padded fat in foam over a dark spring hinge at
 * the snow, rounded off at `height`. White: the instance's colour is the
 * gate's. */
export function stubbyPole(height: number, radius: number): THREE.BufferGeometry {
  const s = bench();
  const hinge = colour(0x3a3e44);
  post(
    s,
    [
      { y: 0, r: radius * 0.7, c: hinge },
      { y: 0.07, r: radius * 0.7, c: hinge },
      { y: 0.09, r: radius, c: WHITE },
      { y: height - radius * 0.6, r: radius, c: WHITE },
      { y: height, r: radius * 0.55, c: WHITE },
    ],
    6,
    radius * 0.2,
  );
  return s.geometry();
}

/** A SKI-CROSS GATE'S TRIANGULAR FLAG: the panel between the stubby pole
 * at x = 0 and the long outside pole at x = `base`, its foot `foot` over
 * the snow, its short side `low` high at the stubby and its long side
 * `high` at the outside pole — the top edge falling toward the course —
 * bellied a little by the wind, a sleeve down each side. In the xy plane,
 * facing z. White: the instance's colour is the gate's. */
export function crossFlag(
  base: number,
  foot: number,
  low: number,
  high: number,
): THREE.BufferGeometry {
  const s = bench(0.75);
  const cols = 3;
  const rows = 2;
  const belly = base * 0.04;
  const at = (i: number, j: number): V3 => {
    const u = i / cols;
    const v = j / rows;
    const top = foot + low + (high - low) * u;
    const z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * belly;
    return [u * base, foot + (top - foot) * v, z];
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      s.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), WHITE, [0, 0, 1]);
    }
  }
  const sleeve = colour(0xd8dadc);
  for (const [x, top] of [
    [0, foot + low],
    [base, foot + high],
  ] as const) {
    const r = 0.028;
    s.loft(
      [ring(x, foot, 0, r, 4, Math.PI / 4), ring(x, top + 0.02, 0, r, 4, Math.PI / 4)],
      [
        [x, foot, 0],
        [x, top, 0],
      ],
      () => sleeve,
    );
  }
  return s.geometry();
}
