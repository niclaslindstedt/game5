// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNELS' BUILDINGS, BUILT — what stands still of the resort's
// horizontal lifts (R30, `wind-tunnel-plan.ts`), on the facade kit
// (`facade-kit.ts`) in the materials the real thing is built of
// (`docs/buildings.md`), as ONE geometry for every tunnel of the map in
// world metres. The moving and the lit parts — the arches' steel hoops and
// their rings of light, the translucent canopy, the chevrons, the fan's
// blades and the blown snow — stay `wind-tunnels.ts`'s.
//
// A tunnel is drawn as a long GALLERY, the kind built over a conveyor or a
// road where the snow comes down: steel ribs on a footing, a translucent
// sheet between them, a heavier portal at either end.
//
//   * THE FOOTINGS: a concrete strip footing along each side of the lane
//     under the arches' feet, standing a little proud of the snow, so the
//     ribs bear on something and the gallery reads as built into the bed.
//   * THE SNOW ON THE CROWN: a curved roof sheds its snow off the steep
//     flanks and keeps it on the flatter crown — a band of settled snow
//     along the top, its width and depth wandering ring to ring, drawn
//     from below too, so the lane under it sees the shadowed band through
//     the sheet.
//   * THE PORTALS: at the entrance and the exit a deep steel portal frame
//     round the arch, its faces in the tunnel's colour, on two concrete
//     buttresses capped with snow.
//   * THE FAN HOUSE: the drum (a shroud of white composite panels, dark
//     inside, a band of the tunnel's colour round it) the blades turn in,
//     standing in front of the entrance on concrete feet, snow on its
//     crown, and the sign gantry over it — the sign's lit arrows are
//     `wind-tunnels.ts`'s.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import type { Level } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import { FacadeKit, type Tint, type V3 } from "./facade-kit.ts";
import {
  TUNNEL_LOOK,
  archRadius,
  marksAlong,
  tunnelPaint,
  tunnelPointAt,
  type TunnelPoint,
  type WindTunnel,
} from "./wind-tunnel-plan.ts";

/** How far past the half circle an arch's feet run into the snow, rad —
 * the hoops' own (`wind-tunnels.ts`). */
export const ARCH_FEET = 0.16;

/** THE FAN HOUSE: its drum's depth along the lane, how far it stands out
 * of the arch, and the sign over it — its board's size, how high over the
 * drum's crown its foot stands, its posts. */
export const FAN_HOUSE = {
  depth: 3.2,
  /** The drum's radius past the arch's, m. */
  out: 0.9,
  /** The shroud's thickness, m. */
  shell: 0.28,
  /** The bellmouth ahead of the drum: how long and how far it flares. */
  bell: { length: 0.9, flare: 0.75 },
  sign: { width: 6.4, height: 2.2, foot: -0.4, rise: 1.5, post: 2.4 },
} as const;

/** Where a tunnel's fan stands: the middle of its drum's mouth on the
 * snow, `fanBack` m and the drum's depth before the entrance, facing the
 * way the air goes, and the drum's radius. */
export type FanSpot = { x: number; y: number; z: number; heading: number; r: number };

/** The fan before a tunnel's entrance. */
export function fanOf(level: Level, tunnel: WindTunnel): FanSpot {
  const at = tunnelPointAt(tunnel, 0);
  const back = TUNNEL_LOOK.fanBack + FAN_HOUSE.depth;
  const x = at.x - Math.sin(at.heading) * back;
  const z = at.z - Math.cos(at.heading) * back;
  const y = Math.min(at.y, level.groundAt(x, z));
  return { x, y, z, heading: at.heading, r: archRadius(tunnel) + FAN_HOUSE.out };
}

/** The tints, sRGB: white leaves a layer as painted. */
export const TUNNEL_TINT = {
  as: 0xffffff,
  /** The portals' and the gantry's dark steel. */
  steel: 0x5a6168,
  /** The drum's inside and its rims. */
  inside: 0x4a5056,
  rim: 0x3a3f45,
  board: 0x22262b,
  /** Snow seen from under, through the sheet. */
  under: 0xcdd7e1,
} as const;
const T = TUNNEL_TINT;

/** The footings: half their width, how proud of the bed, how deep under. */
const FOOTING = { half: 0.32, proud: 0.32, deep: 0.5 };

/** THE SNOW ON THE CROWN: a ring every this many metres; its half-width
 * round the arch, degrees, between these; its depth at the crown, m; the
 * steps across it. */
const CROWN = { every: 18, from: 16, to: 28, depth: [0.1, 0.24], steps: 4 };

/** THE PORTALS: the frame's depth along the lane and its section across,
 * m; the steps round the arch; the buttresses. */
const PORTAL = { depth: 0.9, inner: 0.25, outer: 0.45, around: 12 };

/** An integer hash to 0..1, the picture's own. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A quad a b c d in the kit's frame, wound so it faces `out` whatever
 * order its corners came in (the winding rule, settled once here). */
function face(
  kit: FacadeKit,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  out: V3,
  layer: FacadeLayer,
  tint: Tint,
): void {
  const n = cross(sub(b, a), sub(d, a));
  if (dot(n, out) >= 0) kit.quad(a, b, c, d, layer, tint);
  else kit.quad(b, a, d, c, layer, tint);
}

/** A lane's frame at a point: its right and its way, in plan. */
function frameAt(p: TunnelPoint): { right: V3; fwd: V3 } {
  return {
    right: [Math.cos(p.heading), 0, -Math.sin(p.heading)],
    fwd: [Math.sin(p.heading), 0, Math.cos(p.heading)],
  };
}

/** The point at angle `a` (0 the right foot, π the left) round an arch of
 * radius `r` over the lane point `p`, and its outward direction. */
function round(p: TunnelPoint, r: number, a: number): { at: V3; out: V3 } {
  const { right } = frameAt(p);
  const out: V3 = [right[0] * Math.cos(a), Math.sin(a), right[2] * Math.cos(a)];
  return { at: [p.x + out[0] * r, p.y + out[1] * r, p.z + out[2] * r], out };
}

/** Build every tunnel of the map into one kit. */
export function buildTunnels(level: Level, tunnels: readonly WindTunnel[], minArea = 0): FacadeKit {
  const kit = new FacadeKit();
  kit.minArea = minArea;
  tunnels.forEach((tunnel, ti) => {
    if (tunnel.points.length < 2 || tunnel.length <= 0) return;
    kit.at(0, 0, 0, 0);
    footings(kit, level, tunnel);
    crownSnow(kit, tunnel, ti);
    const paint = tunnelPaint(ti);
    portal(kit, level, tunnel, 0, paint);
    portal(kit, level, tunnel, tunnel.length, paint);
    fanHouse(kit, level, fanOf(level, tunnel), paint);
  });
  return kit;
}

/** THE FOOTINGS down both sides of the lane, a length between two arches
 * at a time, their foot under the snow and their top a little over the
 * bed. The kit's frame is the world's. */
function footings(kit: FacadeKit, level: Level, tunnel: WindTunnel): void {
  const r = archRadius(tunnel);
  const along = marksAlong(tunnel.length, TUNNEL_LOOK.archEvery, 0, true);
  const p = { x: 0, y: 0, z: 0, heading: 0 };
  for (const side of [-1, 1]) {
    // Each station: the inner and outer top edges, and their feet.
    const rows = along.map((s) => {
      tunnelPointAt(tunnel, s, p);
      const { right } = frameAt(p);
      const top = p.y + FOOTING.proud;
      const at = (lat: number): [V3, V3] => {
        const x = p.x + right[0] * lat;
        const z = p.z + right[2] * lat;
        const foot = Math.min(p.y, level.groundAt(x, z)) - FOOTING.deep;
        return [
          [x, top, z],
          [x, foot, z],
        ];
      };
      const [inTop, inFoot] = at(side * (r - FOOTING.half));
      const [outTop, outFoot] = at(side * (r + FOOTING.half));
      return { inTop, inFoot, outTop, outFoot, right, fwd: frameAt(p).fwd };
    });
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      const outward: V3 = [a.right[0] * side, 0, a.right[2] * side];
      const inward: V3 = [-outward[0], 0, -outward[2]];
      face(kit, a.inTop, b.inTop, b.outTop, a.outTop, [0, 1, 0], FACADE.concrete, 0xd8d4cc);
      face(kit, a.outFoot, b.outFoot, b.outTop, a.outTop, outward, FACADE.concrete, T.as);
      face(kit, a.inFoot, b.inFoot, b.inTop, a.inTop, inward, FACADE.concrete, T.as);
    }
    // The two ends.
    for (const [row, way] of [
      [rows[0], -1],
      [rows[rows.length - 1], 1],
    ] as const) {
      const out: V3 = [row.fwd[0] * way, 0, row.fwd[2] * way];
      face(kit, row.inFoot, row.outFoot, row.outTop, row.inTop, out, FACADE.concrete, T.as);
    }
  }
}

/** THE SNOW ON THE CROWN: a band along the gallery's top, a little proud
 * of the sheet, deepest at the crown and thinning to nothing at its edges,
 * its width and depth dealt ring by ring off the tunnel's place; and its
 * underside, seen from the lane through the sheet. */
function crownSnow(kit: FacadeKit, tunnel: WindTunnel, ti: number): void {
  const r = archRadius(tunnel) - 0.02;
  const rings = marksAlong(tunnel.length, CROWN.every, 0, true);
  const p = { x: 0, y: 0, z: 0, heading: 0 };
  const n = CROWN.steps;
  const rows = rings.map((s, k) => {
    tunnelPointAt(tunnel, s, p);
    const seed = ti * 7919 + k * 31;
    const half = ((CROWN.from + (CROWN.to - CROWN.from) * hash(seed)) * Math.PI) / 180;
    // Thin at the two ends, where the portals shelter nothing.
    const ends = Math.min(1, s / 12, (tunnel.length - s) / 12) * 0.7 + 0.3;
    const depth = (CROWN.depth[0] + (CROWN.depth[1] - CROWN.depth[0]) * hash(seed + 1)) * ends;
    const top: V3[] = [];
    const under: V3[] = [];
    const outs: V3[] = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const a = Math.PI / 2 - half + 2 * half * u;
      const bell = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      const base = round(p, r, a);
      top.push(add(base.at, base.out, 0.03 + depth * bell));
      under.push(base.at);
      outs.push(base.out);
    }
    return { top, under, outs, fwd: frameAt(p).fwd };
  });
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    for (let j = 0; j < n; j++) {
      const out = add(a.outs[j], a.outs[j + 1]);
      const shade = 0xf4f7fb - (j === 0 || j === n - 1 ? 0x0a0806 : 0);
      face(kit, a.top[j], b.top[j], b.top[j + 1], a.top[j + 1], out, FACADE.snow, shade);
      const inward: V3 = [-out[0], -out[1], -out[2]];
      face(
        kit,
        a.under[j],
        b.under[j],
        b.under[j + 1],
        a.under[j + 1],
        inward,
        FACADE.snow,
        T.under,
      );
    }
  }
  // The band's cut ends, where its depth shows.
  for (const [row, way] of [
    [rows[0], -1],
    [rows[rows.length - 1], 1],
  ] as const) {
    const out: V3 = [row.fwd[0] * way, 0, row.fwd[2] * way];
    for (let j = 0; j < n; j++) {
      face(
        kit,
        row.under[j],
        row.under[j + 1],
        row.top[j + 1],
        row.top[j],
        out,
        FACADE.snow,
        0xe3ebf3,
      );
    }
  }
}

/** A PORTAL `s` m down a tunnel: a deep steel frame round the arch, its
 * faces along the lane in the tunnel's colour, on two concrete buttresses
 * with snow on them. */
function portal(kit: FacadeKit, level: Level, tunnel: WindTunnel, s: number, paint: Tint): void {
  const p = tunnelPointAt(tunnel, s);
  const { fwd, right } = frameAt(p);
  const r = archRadius(tunnel);
  const r0 = r - PORTAL.inner;
  const r1 = r + PORTAL.outer;
  const half = PORTAL.depth / 2;
  const n = PORTAL.around;
  const span = Math.PI + 2 * ARCH_FEET;
  for (let k = 0; k < n; k++) {
    const a0 = -ARCH_FEET + (span * k) / n;
    const a1 = -ARCH_FEET + (span * (k + 1)) / n;
    const at = (a: number, rr: number, w: number): V3 => add(round(p, rr, a).at, fwd, w * half);
    const mid = (a0 + a1) / 2;
    const out = round(p, 1, mid).out;
    const inward: V3 = [-out[0], -out[1], -out[2]];
    // Outside, inside, and the two faces along the lane.
    face(
      kit,
      at(a0, r1, -1),
      at(a1, r1, -1),
      at(a1, r1, 1),
      at(a0, r1, 1),
      out,
      FACADE.steel,
      T.steel,
    );
    face(
      kit,
      at(a0, r0, -1),
      at(a1, r0, -1),
      at(a1, r0, 1),
      at(a0, r0, 1),
      inward,
      FACADE.steel,
      T.steel,
    );
    for (const w of [-1, 1]) {
      const o: V3 = [fwd[0] * w, 0, fwd[2] * w];
      face(kit, at(a0, r0, w), at(a1, r0, w), at(a1, r1, w), at(a0, r1, w), o, FACADE.panel, paint);
    }
  }
  // The buttresses, either foot, in the lane's own frame.
  kit.at(p.x, 0, p.z, p.heading);
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? r - 0.35 : -(r + 1.6);
    const x1 = side > 0 ? r + 1.6 : -(r - 0.35);
    const lo = Math.min(level.groundAt(p.x + right[0] * x0, p.z + right[2] * x0), p.y) - 0.5;
    const hi = p.y + 1.4;
    kit.box(x0, lo, -half - 0.3, x1, hi, half + 0.3, FACADE.concrete, T.as, {
      layer: FACADE.concrete,
      tint: 0xd8d4cc,
    });
    kit.box(x0 + 0.06, hi, -half - 0.24, x1 - 0.06, hi + 0.16, half + 0.24, FACADE.snow, 0xe8eef5, {
      layer: FACADE.snow,
      tint: T.as,
    });
  }
  kit.at(0, 0, 0, 0);
}

/** THE FAN HOUSE: the drum the blades turn in, its feet, its band, the
 * snow on its crown and the sign gantry over it. Its frame: the drum's
 * mouth at z 0, +z the way the air goes. */
function fanHouse(kit: FacadeKit, level: Level, f: FanSpot, paint: Tint): void {
  kit.at(f.x, f.y, f.z, f.heading);
  const d = FAN_HOUSE.depth;
  const r1 = f.r;
  const r0 = f.r - FAN_HOUSE.shell;
  const n = 20;
  const span = Math.PI + 2 * ARCH_FEET;
  const pt = (a: number, r: number, z: number): V3 => [Math.cos(a) * r, Math.sin(a) * r, z];
  for (let k = 0; k < n; k++) {
    const a0 = -ARCH_FEET + (span * k) / n;
    const a1 = -ARCH_FEET + (span * (k + 1)) / n;
    const m = (a0 + a1) / 2;
    const out: V3 = [Math.cos(m), Math.sin(m), 0];
    const inward: V3 = [-out[0], -out[1], 0];
    face(kit, pt(a0, r1, 0), pt(a1, r1, 0), pt(a1, r1, d), pt(a0, r1, d), out, FACADE.panel, T.as);
    face(
      kit,
      pt(a0, r0, 0),
      pt(a1, r0, 0),
      pt(a1, r0, d),
      pt(a0, r0, d),
      inward,
      FACADE.plain,
      T.inside,
    );
    // The BELLMOUTH the air is drawn in by, flared out ahead of the mouth:
    // white inside, where a skier coming at it looks, its lip in the
    // tunnel's colour.
    const fl = FAN_HOUSE.bell;
    const z0 = -fl.length;
    face(
      kit,
      pt(a0, r0, 0),
      pt(a1, r0, 0),
      pt(a1, r0 + fl.flare, z0),
      pt(a0, r0 + fl.flare, z0),
      [-out[0], -out[1], -0.8],
      FACADE.panel,
      0xf2f4f5,
    );
    face(
      kit,
      pt(a0, r1, 0),
      pt(a1, r1, 0),
      pt(a1, r1 + fl.flare, z0),
      pt(a0, r1 + fl.flare, z0),
      [out[0], out[1], 0.8],
      FACADE.panel,
      T.as,
    );
    face(
      kit,
      pt(a0, r0 + fl.flare, z0),
      pt(a1, r0 + fl.flare, z0),
      pt(a1, r1 + fl.flare, z0),
      pt(a0, r1 + fl.flare, z0),
      [0, 0, -1],
      FACADE.plain,
      paint,
    );
    face(
      kit,
      pt(a0, r0, d),
      pt(a1, r0, d),
      pt(a1, r1, d),
      pt(a0, r1, d),
      [0, 0, 1],
      FACADE.plain,
      T.rim,
    );
    // The band of the tunnel's colour round its middle.
    const b = r1 + 0.03;
    face(
      kit,
      pt(a0, b, d * 0.38),
      pt(a1, b, d * 0.38),
      pt(a1, b, d * 0.62),
      pt(a0, b, d * 0.62),
      out,
      FACADE.plain,
      paint,
    );
  }
  // The drum's feet: a concrete block under each.
  const ground = (lx: number, lz: number) => {
    const w = kit.world([lx, 0, lz]);
    return level.groundAt(w[0], w[2]) - f.y;
  };
  for (const side of [-1, 1]) {
    const x = side * (r1 - FAN_HOUSE.shell / 2);
    const lo = Math.min(ground(x - 0.8, -0.4), ground(x + 0.8, d + 0.4), 0) - 0.5;
    kit.box(x - 0.8, lo, -0.4, x + 0.8, 0.7, d + 0.4, FACADE.concrete, T.as, {
      layer: FACADE.concrete,
      tint: 0xd8d4cc,
    });
  }
  // The fan's SWITCHGEAR beside the drum, on the right: a ribbed steel
  // cabinet on a pad, its louvres and its door, snow on its lid.
  const cx = r1 + 1.5;
  const pad = Math.min(ground(cx - 0.9, 0.6), ground(cx + 0.9, 2.6), 0) - 0.4;
  kit.box(cx - 0.9, pad, 0.6, cx + 0.9, 0.25, 2.6, FACADE.concrete, T.as, {
    layer: FACADE.concrete,
    tint: 0xd8d4cc,
  });
  kit.box(cx - 0.7, 0.25, 0.8, cx + 0.7, 2.05, 2.4, FACADE.cladding, 0x8d969e, null);
  kit.inset(cx + 0.7, 2.1, cx + 0.7, 1.1, 1.1, 1.7, 0.03, FACADE.louvre, T.as);
  kit.inset(cx - 0.45, 0.8, cx + 0.45, 0.8, 0.3, 1.95, 0.03, FACADE.plain, 0x6c747b);
  kit.box(cx - 0.8, 2.05, 0.7, cx + 0.8, 2.15, 2.5, FACADE.plain, T.rim);
  kit.box(cx - 0.75, 2.15, 0.75, cx + 0.75, 2.3, 2.45, FACADE.snow, 0xe8eef5, {
    layer: FACADE.snow,
    tint: T.as,
  });
  // Snow on its crown, deepest at the top.
  const half = (30 * Math.PI) / 180;
  const steps = 4;
  const rows: V3[][] = [[], []];
  const base: V3[][] = [[], []];
  [0.15, d - 0.15].forEach((z, w) => {
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      const a = Math.PI / 2 - half + 2 * half * u;
      const bell = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      rows[w].push(pt(a, r1 + 0.02 + 0.28 * bell, z));
      base[w].push(pt(a, r1 + 0.02, z));
    }
  });
  for (let j = 0; j < steps; j++) {
    const m = Math.PI / 2 - half + 2 * half * ((j + 0.5) / steps);
    const out: V3 = [Math.cos(m), Math.sin(m), 0];
    face(kit, rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j], out, FACADE.snow, T.as);
    face(
      kit,
      base[0][j],
      base[0][j + 1],
      rows[0][j + 1],
      rows[0][j],
      [0, 0, -1],
      FACADE.snow,
      0xe3ebf3,
    );
    face(
      kit,
      base[1][j],
      base[1][j + 1],
      rows[1][j + 1],
      rows[1][j],
      [0, 0, 1],
      FACADE.snow,
      0xe3ebf3,
    );
  }
  // The sign gantry: two posts off the crown and the board on them, its
  // face toward the skier coming at the mouth (−z).
  const S = FAN_HOUSE.sign;
  const foot = r1 + S.foot;
  const b0 = foot + S.rise;
  const b1 = b0 + S.height;
  for (const sx of [-1, 1]) {
    const x = sx * S.post;
    kit.box(
      x - 0.11,
      foot - 0.4,
      -0.11 + 0.3,
      x + 0.11,
      b0 + 0.2,
      0.11 + 0.3,
      FACADE.steel,
      T.steel,
      null,
    );
  }
  kit.box(-S.width / 2, b0, -0.11, S.width / 2, b1, 0.11, FACADE.plain, T.board, {
    layer: FACADE.steel,
    tint: T.steel,
  });
  // Its frame round the face, and the snow on its head.
  kit.box(
    -S.width / 2 - 0.08,
    b0 - 0.08,
    0.11,
    S.width / 2 + 0.08,
    b1 + 0.08,
    0.3,
    FACADE.steel,
    T.steel,
    null,
  );
  kit.box(
    -S.width / 2 + 0.05,
    b1,
    -0.1,
    S.width / 2 - 0.05,
    b1 + 0.14,
    0.28,
    FACADE.snow,
    0xe8eef5,
    {
      layer: FACADE.snow,
      tint: T.as,
    },
  );
  kit.at(0, 0, 0, 0);
}

export type { Tint };
