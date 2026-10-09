// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S VEHICLES BUILT IN CODE — the cars of each class, the ski
// bus and the bicycle (`traffic.ts`'s kinds, sized off `VEHICLES`), on the
// trees' bench (`tree-mesh.ts`'s `Shape`): faceted and flat-lit, the
// mountain's one look. A car is a LOFT of rings down its length — the
// sill, the shoulder at the belt line, the roof's edge drawn in over the
// tumblehome — under its own side profile (the bonnet, the screen's rake,
// the roof, the hatch, the estate's long roof, the van's box), its wheel
// arches cut up into the rings over each axle so the wheels show under
// them; the screens, the side windows between their pillars, the sills,
// the bumpers' lower lips, the grille and the plates painted onto the
// faces; the lamps' lenses set proud on its ends. Every vertex carries the
// MARKS the shared material reads (`traffic-view.ts`'s `trafficMaterial`):
//   * `aPaint` — 1 where the instance's paint colours it (the body), 0 on
//     what is the same on every car (glass, rubber, plastic, plates);
//   * `aLamp` — which lamp a lens is (head, tail, left and right
//     indicator), lit by the instance's levels (`traffic-look.ts`);
//   * `aRough` — the surface's roughness (the clear coat, the glass, the
//     rubber);
//   * `aFold` — snow off the roof, folded away on a car that wears only
//     the roof's slab;
//   * `aGlass` — the bus's windows, lit from inside after dark.
// The frame is the vehicle's: x its right, y up off the road, z forward,
// the body's middle at 0. The wheels are instances of their own (one
// unit wheel, `buildWheel`), turned and steered by the view. The parts
// they are built of — the surfaces, the faces, the glass, the lenses, the
// bicycle and the wheels — are `traffic-parts.ts`.

import * as THREE from "three";
import { VEHICLES, type VehicleKind } from "@engine";

import { lampLayout } from "./traffic-look.ts";
import {
  C,
  col,
  S,
  box,
  emitBike,
  face,
  lens,
  pane,
  shape,
  surface,
  type Surface,
  type TrafficCut,
} from "./traffic-parts.ts";
import type { Shape, V3 } from "./tree-mesh.ts";

export type { TrafficCut } from "./traffic-parts.ts";
export { buildBikeWheel, buildWheel } from "./traffic-parts.ts";

// ── THE BODIES ──────────────────────────────────────────────────────────

/** A BODY'S PROFILE, its distances back from the nose (m): the roof line
 * as (back, height) knots from the nose to the tail; the belt line (the
 * windows' sill) and the eave (the bus's band over its windows; a car's
 * roof edge); the underside; where the windscreen's foot, the roof's front
 * and back and the rear screen's foot are; the side windows' spans; and
 * whether it carries roof rails. */
type Profile = {
  top: readonly [number, number][];
  belt: number;
  eave?: number;
  bottom: number;
  screen: [number, number];
  rear: [number, number];
  windows: readonly [number, number][];
  rails?: boolean;
  /** The roof's edge drawn in over the shoulder, a share of the width. */
  tumble: number;
};

/** The bus's side windows, a pane every 1.45 m behind the door. */
function busWindows(): [number, number][] {
  const out: [number, number][] = [[0.15, 1.25]];
  for (let z = 2.55; z + 1.3 < 11.4; z += 1.45) out.push([z, z + 1.3]);
  return out;
}

/** THE PROFILES, off the classes' measured shapes (`docs/traffic.md`). */
const PROFILES: Readonly<Record<Exclude<VehicleKind, "bike">, Profile>> = {
  hatch: {
    top: [
      [0, 0.64],
      [0.13, 0.78],
      [0.85, 0.9],
      [1.62, 1.43],
      [2.1, 1.47],
      [3.3, 1.43],
      [3.82, 1.02],
      [3.97, 0.97],
      [4.05, 0.86],
    ],
    belt: 0.98,
    bottom: 0.25,
    screen: [0.85, 1.62],
    rear: [3.3, 3.82],
    windows: [
      [1.68, 2.52],
      [2.62, 3.25],
    ],
    tumble: 0.8,
  },
  estate: {
    top: [
      [0, 0.64],
      [0.15, 0.78],
      [1.05, 0.92],
      [1.88, 1.45],
      [2.5, 1.48],
      [4.3, 1.43],
      [4.55, 1.02],
      [4.65, 0.9],
    ],
    belt: 0.99,
    bottom: 0.25,
    screen: [1.05, 1.88],
    rear: [4.3, 4.55],
    windows: [
      [1.94, 2.82],
      [2.92, 3.7],
      [3.8, 4.26],
    ],
    rails: true,
    tumble: 0.8,
  },
  suv: {
    top: [
      [0, 0.8],
      [0.15, 0.96],
      [0.95, 1.08],
      [1.74, 1.63],
      [2.3, 1.67],
      [3.86, 1.63],
      [4.24, 1.16],
      [4.45, 1.05],
    ],
    belt: 1.13,
    bottom: 0.38,
    screen: [0.95, 1.74],
    rear: [3.86, 4.24],
    windows: [
      [1.8, 2.7],
      [2.8, 3.8],
    ],
    rails: true,
    tumble: 0.82,
  },
  van: {
    top: [
      [0, 0.82],
      [0.12, 0.98],
      [0.7, 1.2],
      [1.45, 2.3],
      [1.8, 2.45],
      [5.5, 2.45],
      [5.55, 2.38],
    ],
    belt: 1.22,
    bottom: 0.42,
    screen: [0.7, 1.45],
    rear: [5.55, 5.55],
    windows: [[1.5, 2.25]],
    tumble: 0.93,
  },
  bus: {
    top: [
      [0, 3.0],
      [0.18, 3.1],
      [11.85, 3.1],
      [12, 3.0],
    ],
    belt: 1.15,
    eave: 2.8,
    bottom: 0.36,
    screen: [0, 0],
    rear: [12, 12],
    windows: busWindows(),
    tumble: 0.93,
  },
};

/** The roof line's height `back` m from the nose. */
function topAt(p: Profile, back: number): number {
  const t = p.top;
  if (back <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (back <= t[i][0]) {
      const [z0, y0] = t[i - 1];
      const [z1, y1] = t[i];
      return y0 + ((y1 - y0) * (back - z0)) / Math.max(1e-6, z1 - z0);
    }
  }
  return t[t.length - 1][1];
}

/** What the band of a ring's side from one point to the next is: the
 * sill's dark lip, the door's two faces (under and over the swage), the
 * greenhouse (the windows' band), the bus's eave over it, the roof's
 * rounded edge and its crown. */
type Band = "sill" | "door" | "upper" | "green" | "eave" | "edge" | "crown";

/** One ring of the loft: its distance back, its points (the right side
 * from the underside up to the crown, then the left back down) and the
 * band each point begins. */
type Ring = { back: number; pts: V3[]; bands: Band[] };

/** THE BODY OF `kind` at `cut`, into `s`, with its plates, grille,
 * mirrors and lenses. */
function emitBody(s: Shape, kind: Exclude<VehicleKind, "bike">, cut: TrafficCut): void {
  const V = VEHICLES[kind];
  const p = PROFILES[kind];
  const L = V.length;
  const half = V.width / 2;
  const bus = kind === "bus";
  // The axles, back from the nose, and the arches over them.
  const axles = [V.front, V.front + V.wheelbase];
  const arch = V.wheel + (bus ? 0.1 : 0.07);
  const distant = cut === "distant";
  const backs = new Set<number>(
    distant ? [0, 0.3, L - 0.3, L] : [0, 0.05, 0.14, 0.3, L - 0.3, L - 0.14, L - 0.05, L],
  );
  for (const [z] of p.top) backs.add(z);
  for (const z of [...p.screen, ...p.rear]) backs.add(z);
  // The side windows' pillars, each its own ring, are past a distant
  // car's pixels: its glass runs from the first window to the last.
  const sideGlass: [number, number] = [p.windows[0][0], p.windows[p.windows.length - 1][1]];
  for (const [a, b] of distant ? [sideGlass] : p.windows) {
    backs.add(a);
    backs.add(b);
  }
  if (cut === "near") {
    for (const a of axles) {
      backs.add(a - arch - 0.03);
      backs.add(a + arch + 0.03);
      for (let i = 0; i <= 6; i++) backs.add(a - arch * Math.cos((i / 6) * Math.PI));
    }
  }
  const sorted = [...backs].filter((b) => b >= 0 && b <= L).sort((a, b) => a - b);
  const bottomAt = (back: number): number => {
    if (cut !== "near") return p.bottom;
    let y = p.bottom;
    for (const a of axles) {
      const d = Math.abs(back - a);
      if (d < arch) y = Math.max(y, V.wheel + Math.sqrt(arch * arch - d * d) * 0.92);
    }
    return y;
  };
  /** The body drawn in round its corners in plan: a bus's a little, a
   * car's to some 0.82 of its width at the bumpers. */
  const widthAt = (back: number): number => {
    const end = Math.min(back, L - back);
    const most = bus ? 0.06 : 0.18;
    const u = Math.min(1, end / 0.3);
    return half * (1 - most * (1 - Math.sqrt(u * (2 - u))));
  };
  const rings: Ring[] = sorted.map((back) => {
    const z = L / 2 - back;
    const top = topAt(p, back);
    const w = widthAt(back);
    const bot = Math.min(bottomAt(back), top - 0.22);
    const sill = Math.min(bot + 0.12, top - 0.14);
    const belt = Math.max(sill + 0.04, Math.min(p.belt, top - 0.05));
    const swage = sill + (belt - sill) * 0.6;
    const roofed = top > p.belt + 0.08;
    const rw = w * (roofed ? p.tumble : 0.9);
    const drop = bus ? 0.03 : roofed ? 0.06 : 0.04;
    const pts: V3[] = distant
      ? [
          [w * 0.95, bot, z],
          [w * 0.97, belt, z],
        ]
      : [
          [w * 0.93, bot, z],
          [w * 0.98, sill, z],
          [w, swage, z],
          [w * 0.97, belt, z],
        ];
    const bands: Band[] = distant ? ["door", "green"] : ["sill", "door", "upper", "green"];
    if (p.eave !== undefined) {
      pts.push([w * 0.97, Math.min(p.eave, top - 0.04), z]);
      bands.push("eave");
    }
    pts.push([rw, top - drop, z]);
    bands.push("edge");
    pts.push([rw * 0.55, top, z]);
    bands.push("crown");
    const left = pts.map(([x, y, zz]) => [-x, y, zz] as V3).reverse();
    // The left side's bands run back down: the edge from its point j to
    // j + 1 is the mirror of the right side's band two below the top.
    const m = pts.length;
    const leftBands = Array.from({ length: m }, (_, j): Band =>
      j < m - 1 ? bands[m - 2 - j] : "sill",
    );
    return { back, pts: [...pts, ...left], bands: [...bands, ...leftBands] };
  });
  const n = rings[0].pts.length;
  const inSpan = (b: number, spans: readonly [number, number][]) =>
    spans.some(([a, c]) => b > a && b < c);
  const body = bus ? S.white : S.paint;
  // A distant car's side glass is one strip from its first window to its last.
  const glassSpans: readonly [number, number][] = distant ? [sideGlass] : p.windows;
  /** The surface of `band` between two rings at `back`. */
  const surfaceOf = (band: Band, back: number, roofed: boolean): Surface => {
    switch (band) {
      case "sill":
        return S.trim;
      case "door":
      case "upper":
        return S.paint;
      case "green":
        return roofed && inSpan(back, glassSpans) ? (bus ? S.busGlass : S.glass) : body;
      case "edge":
      case "crown":
        return inSpan(back, [p.screen, p.rear]) ? S.glass : body;
      default:
        return body;
    }
  };
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    const mid = (a.back + b.back) / 2;
    const roofed = topAt(p, a.back) > p.belt + 0.08 && topAt(p, b.back) > p.belt + 0.08;
    const cy = (a.pts[0][1] + a.pts[n / 2 - 1][1]) / 2;
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      // The last edge (the left foot to the right) is the underside; the
      // middle one (crown to crown) the roof's crown.
      const band: Band = i === n / 2 - 1 ? "crown" : a.bands[i];
      const f = i === n - 1 ? S.under : surfaceOf(band, mid, roofed);
      const out: V3 = [(a.pts[i][0] + a.pts[i1][0]) / 2, (a.pts[i][1] + a.pts[i1][1]) / 2 - cy, 0];
      if (f === S.glass || f === S.busGlass)
        pane(s, f, a.pts[i], a.pts[i1], b.pts[i1], b.pts[i], out);
      else face(s, f, a.pts[i], a.pts[i1], b.pts[i1], b.pts[i], out);
    }
  }
  const sides = n / 2;
  // The ends: the nose (z +) and the tail.
  const ends = [
    { ring: rings[0], z: L / 2, n: 1 },
    { ring: rings[rings.length - 1], z: -L / 2, n: -1 },
  ];
  for (const e of ends) {
    const pts = e.ring.pts;
    const cy = (pts[0][1] + pts[sides - 1][1]) / 2;
    const c: V3 = [0, cy, e.z];
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      surface(s, bus ? S.white : S.paint);
      s.tri(pts[i], pts[i1], c, (bus ? S.white : S.paint).c, [0, 0, e.n]);
    }
  }
  const lay = lampLayout(kind);
  const nose = L / 2 + 0.006;
  const tail = -L / 2 - 0.006;
  const lowTop = Math.min(topAt(p, 0), bus ? 0.9 : 0.6);
  // The bumpers' lower lips, the grille and the plates.
  face(
    s,
    S.trim,
    [half * 0.9, p.bottom, nose],
    [-half * 0.9, p.bottom, nose],
    [-half * 0.9, p.bottom + 0.14, nose],
    [half * 0.9, p.bottom + 0.14, nose],
    [0, 0, 1],
  );
  face(
    s,
    S.trim,
    [-half * 0.9, p.bottom, tail],
    [half * 0.9, p.bottom, tail],
    [half * 0.9, p.bottom + 0.12, tail],
    [-half * 0.9, p.bottom + 0.12, tail],
    [0, 0, -1],
  );
  if (bus) {
    // The windscreen, the destination board over it, the rear window.
    pane(
      s,
      S.glass,
      [half - 0.1, 0.95, nose],
      [-half + 0.1, 0.95, nose],
      [-half + 0.1, 2.62, nose],
      [half - 0.1, 2.62, nose],
      [0, 0, 1],
    );
    face(
      s,
      S.trim,
      [half - 0.25, 2.66, nose],
      [-half + 0.25, 2.66, nose],
      [-half + 0.25, 2.92, nose],
      [half - 0.25, 2.92, nose],
      [0, 0, 1],
    );
    pane(
      s,
      S.glass,
      [-half + 0.2, 1.95, tail],
      [half - 0.2, 1.95, tail],
      [half - 0.2, 2.75, tail],
      [-half + 0.2, 2.75, tail],
      [0, 0, -1],
    );
    // The skirt and the stripe in the operator's colour.
    for (const [z, nz] of [
      [nose, 1],
      [tail, -1],
    ] as const) {
      const x0 = nz > 0 ? half * 0.95 : -half * 0.95;
      face(
        s,
        S.paint,
        [x0, p.bottom + 0.14, z],
        [-x0, p.bottom + 0.14, z],
        [-x0, 0.9, z],
        [x0, 0.9, z],
        [0, 0, nz],
      );
    }
  } else {
    const gy = Math.min(lowTop - 0.08, lay.head.y + 0.02);
    face(
      s,
      S.trim,
      [half * 0.42, gy - 0.16, nose],
      [-half * 0.42, gy - 0.16, nose],
      [-half * 0.42, gy, nose],
      [half * 0.42, gy, nose],
      [0, 0, 1],
    );
  }
  if (cut === "near") {
    const py = p.bottom + 0.2;
    face(
      s,
      S.plate,
      [0.26, py, nose + 0.002],
      [-0.26, py, nose + 0.002],
      [-0.26, py + 0.11, nose + 0.002],
      [0.26, py + 0.11, nose + 0.002],
      [0, 0, 1],
    );
    const ry = bus ? 0.55 : p.bottom + 0.32;
    face(
      s,
      S.plate,
      [-0.26, ry, tail - 0.002],
      [0.26, ry, tail - 0.002],
      [0.26, ry + 0.11, tail - 0.002],
      [-0.26, ry + 0.11, tail - 0.002],
      [0, 0, -1],
    );
    // The door mirrors, at the windscreen's foot.
    if (!bus) {
      const mz = L / 2 - p.screen[0] - 0.12;
      const my = p.belt + 0.08;
      for (const sx of [1, -1]) {
        const x0 = sx * (half + 0.01);
        const x1 = sx * (half + 0.17);
        box(
          s,
          S.paint,
          [Math.min(x0, x1), my, mz - 0.07],
          [Math.max(x0, x1), my + 0.13, mz + 0.05],
        );
      }
    } else {
      for (const sx of [1, -1]) {
        box(
          s,
          S.trim,
          [sx > 0 ? half : -half - 0.06, 2.1, L / 2 - 0.25],
          [sx > 0 ? half + 0.06 : -half, 2.5, L / 2 - 0.2],
        );
      }
    }
    if (p.rails) {
      const y = topAt(p, (p.screen[1] + p.rear[0]) / 2);
      const z0 = L / 2 - p.screen[1] - 0.15;
      const z1 = L / 2 - p.rear[0] + 0.1;
      for (const sx of [1, -1]) {
        const x = sx * half * p.tumble * 0.88;
        box(s, S.trim, [x - 0.025, y, z1], [x + 0.025, y + 0.05, z0]);
      }
    }
    if (bus) {
      // The air conditioning's pod on the roof.
      box(s, S.white, [-0.85, 3.1, -1.2], [0.85, 3.32, 1.4]);
    }
  }
  // THE LENSES: the headlamps, the tail lamps, the indicators.
  const H = lay.head;
  const T = lay.tail;
  for (const sx of [1, -1]) {
    const x = sx * H.x;
    lens(s, C.head, [x, H.y, nose + 0.004], H.w, H.h, 1, [1, 0, 0, 0]);
    lens(s, C.tail, [sx * T.x, T.y, tail - 0.004], T.w, T.h, -1, [0, 1, 0, 0]);
    const ind = sx < 0 ? [0, 0, 1, 0] : [0, 0, 0, 1];
    lens(s, C.amber, [x, H.y - H.h / 2 - 0.045, nose + 0.004], H.w * 0.7, 0.05, 1, ind);
    lens(s, C.amber, [sx * T.x, T.y - T.h / 2 - 0.06, tail - 0.004], T.w * 0.8, 0.06, -1, ind);
  }
}

// ── THE SNOW, THE ROOF BOX AND THE RACK ─────────────────────────────────

/** Whether a body's profile has a roof a box or a rack can stand on, and
 * where (its height and its span, m along z). */
export function roofOf(kind: Exclude<VehicleKind, "bike">): {
  y: number;
  z0: number;
  z1: number;
  w: number;
} {
  const p = PROFILES[kind];
  const L = VEHICLES[kind].length;
  const y = Math.max(...p.top.map(([, h]) => h));
  return {
    y,
    z0: L / 2 - p.rear[0] + 0.05,
    z1: L / 2 - p.screen[1] - 0.05,
    w: (VEHICLES[kind].width / 2) * p.tumble,
  };
}

/** THE SNOW a car wears: a slab over every face of its top that holds it
 * (the bonnet, the screens, the roof, the boot), the roof's own marked to
 * stay and the rest to fold away on a car that wears only that. */
function emitSnow(s: Shape, kind: Exclude<VehicleKind, "bike">): void {
  const p = PROFILES[kind];
  const V = VEHICLES[kind];
  const L = V.length;
  const roof = roofOf(kind);
  const steps: number[] = [];
  for (let b = 0.12; b <= L - 0.08; b += 0.18) steps.push(b);
  steps.push(L - 0.08);
  const width = (back: number) => {
    const top = topAt(p, back);
    const roofed = top > p.belt + 0.08;
    return (V.width / 2) * (roofed ? p.tumble : 0.9) - 0.04;
  };
  /** The slab's thickness: thin on the steep screens, deepest on the flat. */
  const depth = (back: number) => {
    const d = (topAt(p, back + 0.05) - topAt(p, back - 0.05)) / 0.1;
    return Math.max(0, 0.11 - 0.09 * Math.min(1, Math.abs(d) / 1.4));
  };
  for (let i = 0; i + 1 < steps.length; i++) {
    const a = steps[i];
    const b = steps[i + 1];
    const za = L / 2 - a;
    const zb = L / 2 - b;
    const onRoof = za <= roof.z1 + 0.06 && zb >= roof.z0 - 0.06;
    surface(s, S.snow, undefined, onRoof ? 0 : 1);
    const ya = topAt(p, a);
    const yb = topAt(p, b);
    const da = depth(a);
    const db = depth(b);
    if (da + db < 0.01) continue;
    const wa = width(a);
    const wb = width(b);
    // The top, crowned over the middle, and the sides falling to the roof.
    const ca = ya + da;
    const cb = yb + db;
    s.quad(
      [wa, ya + da * 0.4, za],
      [wa * 0.5, ca, za],
      [wb * 0.5, cb, zb],
      [wb, yb + db * 0.4, zb],
      C.snow,
      [0.3, 1, 0],
    );
    s.quad(
      [wa * 0.5, ca, za],
      [-wa * 0.5, ca, za],
      [-wb * 0.5, cb, zb],
      [wb * 0.5, cb, zb],
      C.snow,
      [0, 1, 0],
    );
    s.quad(
      [-wa * 0.5, ca, za],
      [-wa, ya + da * 0.4, za],
      [-wb, yb + db * 0.4, zb],
      [-wb * 0.5, cb, zb],
      C.snow,
      [-0.3, 1, 0],
    );
    s.quad(
      [wa + 0.02, ya - 0.01, za],
      [wa, ya + da * 0.4, za],
      [wb, yb + db * 0.4, zb],
      [wb + 0.02, yb - 0.01, zb],
      C.snow,
      [1, 0.2, 0],
    );
    s.quad(
      [-wa, ya + da * 0.4, za],
      [-wa - 0.02, ya - 0.01, za],
      [-wb - 0.02, yb - 0.01, zb],
      [-wb, yb + db * 0.4, zb],
      C.snow,
      [-1, 0.2, 0],
    );
  }
}

/** A ROOF BOX: a long, low faceted shell on two bars, its nose drawn in
 * like a wedge, `len` m long. */
function emitRoofBox(s: Shape, kind: Exclude<VehicleKind, "bike">): void {
  const r = roofOf(kind);
  const len = Math.min(1.9, r.z1 - r.z0 - 0.05);
  const mid = (r.z0 + r.z1) / 2 - 0.08;
  const w = Math.min(0.42, r.w - 0.12);
  const y0 = r.y + 0.08;
  const h = 0.36;
  // The bars under it.
  for (const z of [mid - len * 0.3, mid + len * 0.3])
    box(s, S.trim, [-r.w * 0.9, r.y, z - 0.03], [r.w * 0.9, y0, z + 0.03]);
  surface(s, { c: C.paint, paint: 1, rough: 0.28 });
  const ring = (z: number, k: number): V3[] => {
    const ww = w * k;
    const hh = h * (0.55 + 0.45 * k);
    return [
      [ww, y0 + 0.02, z],
      [ww * 1.02, y0 + hh * 0.55, z],
      [ww * 0.78, y0 + hh, z],
      [-ww * 0.78, y0 + hh, z],
      [-ww * 1.02, y0 + hh * 0.55, z],
      [-ww, y0 + 0.02, z],
    ];
  };
  const zs = [mid + len / 2, mid + len / 2 - 0.25, mid - len / 2 + 0.15, mid - len / 2];
  const ks = [0.55, 1, 1, 0.8];
  const rings = zs.map((z, i) => ring(z, ks[i]));
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < 6; i++) {
      const i1 = (i + 1) % 6;
      s.quad(rings[k][i], rings[k][i1], rings[k + 1][i1], rings[k + 1][i], C.paint, [
        rings[k][i][0],
        rings[k][i][1] - y0 - h / 2,
        0,
      ]);
    }
  }
  for (const [ri, nz] of [
    [0, 1],
    [rings.length - 1, -1],
  ] as const) {
    const c: V3 = [0, y0 + h * 0.45, zs[ri]];
    for (let i = 0; i < 6; i++) s.tri(rings[ri][i], rings[ri][(i + 1) % 6], c, C.paint, [0, 0, nz]);
  }
}

/** The skis' topsheets on a rack, linear. */
const RACK_SKIS = [
  col(0.7, 0.05, 0.03),
  col(0.03, 0.12, 0.45),
  col(0.85, 0.85, 0.82),
  col(0.6, 0.4, 0.02),
];

/** A SKI RACK: two bars and the skis laid flat on them, tips forward. */
function emitRack(s: Shape, kind: Exclude<VehicleKind, "bike">): void {
  const r = roofOf(kind);
  const mid = (r.z0 + r.z1) / 2;
  const y0 = r.y + 0.06;
  for (const z of [mid - 0.42, mid + 0.42])
    box(s, S.trim, [-r.w * 0.9, r.y, z - 0.035], [r.w * 0.9, y0 + 0.03, z + 0.035]);
  const xs = [-0.3, -0.21, 0.21, 0.3];
  xs.forEach((x, i) => {
    const c = RACK_SKIS[(i >> 1) % RACK_SKIS.length];
    const f: Surface = { c, paint: 0, rough: 0.35 };
    box(s, f, [x - 0.04, y0 + 0.03, mid - 0.85], [x + 0.04, y0 + 0.05, mid + 0.85]);
    // The tip turned up.
    surface(s, f);
    s.quad(
      [x + 0.04, y0 + 0.05, mid + 0.85],
      [x - 0.04, y0 + 0.05, mid + 0.85],
      [x - 0.035, y0 + 0.11, mid + 0.97],
      [x + 0.035, y0 + 0.11, mid + 0.97],
      c,
      [0, 1, 0.5],
    );
    box(s, S.trim, [x - 0.045, y0 + 0.05, mid - 0.1], [x + 0.045, y0 + 0.1, mid + 0.12]);
  });
}

// ── THE GEOMETRIES ──────────────────────────────────────────────────────

/** What a vehicle kind is drawn with at a cut: its body (and, a car, the
 * snow it may wear and what it may carry on its roof). */
export type VehicleGeometries = {
  body: THREE.BufferGeometry;
  snow: THREE.BufferGeometry | null;
  box: THREE.BufferGeometry | null;
  rack: THREE.BufferGeometry | null;
};

/** THE GEOMETRIES OF `kind` AT `cut`, built anew (the view keeps them). */
export function buildVehicle(kind: VehicleKind, cut: TrafficCut): VehicleGeometries {
  const body = shape();
  if (kind === "bike") {
    emitBike(body);
    return { body: body.geometry(), snow: null, box: null, rack: null };
  }
  const k: Exclude<VehicleKind, "bike"> = kind;
  emitBody(body, k, cut);
  const car = k !== "bus";
  const make = (f: (s: Shape, k: Exclude<VehicleKind, "bike">) => void) => {
    const s = shape();
    f(s, k);
    return s.geometry();
  };
  return {
    body: body.geometry(),
    snow: car ? make(emitSnow) : null,
    box: car && kind !== "van" ? make(emitRoofBox) : null,
    rack: car && kind !== "van" ? make(emitRack) : null,
  };
}

/** How many triangles `kind`'s body is at `cut`. */
export function vehicleTriangles(kind: VehicleKind, cut: TrafficCut): number {
  const g = buildVehicle(kind, cut);
  const n = g.body.getAttribute("position").count / 3;
  for (const x of [g.body, g.snow, g.box, g.rack]) x?.dispose();
  return n;
}
