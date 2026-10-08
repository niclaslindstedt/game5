// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREET FURNITURE, BUILT — what stands along the streets the
// engine lays (`village-furniture.ts`), on the facade kit beside the
// buildings (`village-build.ts`), as a mountain village's look (the
// research is `docs/buildings.md`, "The village and its streets"):
//
//   * THE STREET LAMPS: an anthracite column five to six and a half metres
//     tall at the back of the sidewalk, a short arm out over the kerb and a
//     LANTERN on it — four glazed sides under a little hipped cap, lit
//     after dark — with the light it lays on the snow baked with the
//     floodlights' (`streetLampMasts`, `piste-lights.ts`);
//   * THE BUS STOP: a shelter of steel and glass, its bench and its
//     timetable, and the stop's sign on a pole at the kerb;
//   * THE SIGNS: the village's name board where the road comes in, the
//     car park's at its mouth, a crossing's either side of it on the main
//     street;
//   * THE SNOW POLES down the road out's banks, banded orange and black,
//     so the plough finds the road's edge.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`, the lamps'
// light by the floodlights' bake.

import {
  STREET_FURNITURE as F,
  villageOf,
  type Level,
  type StreetLamp,
  type Village,
} from "@engine";

import { FACADE } from "./facade-paint.ts";
import type { FacadeKit } from "./facade-kit.ts";
import { solidOf, type PisteLamp, type PisteMast } from "./piste-light-plan.ts";
import { idHash, signBoard, solid, type Skin } from "./resort-props.ts";
import { KERB, roadY } from "./street-plan.ts";
import { LOOSE } from "./trail-stamp.ts";

const COLUMN: Skin = { layer: FACADE.plain, tint: 0x2e3236 };
const STEEL: Skin = { layer: FACADE.steel, tint: 0xffffff };
const SNOW: Skin = { layer: FACADE.snow, tint: 0xffffff };

/** The lantern: its half width, its glass's height, its cap's. */
const LANTERN = { half: 0.24, glass: 0.42, cap: 0.22 };

/** Build the street furniture of `level`'s village onto `kit` (nothing
 * where the map has none). */
export function buildStreetFurniture(kit: FacadeKit, level: Level): void {
  const v = villageOf(level);
  if (!v) return;
  for (const l of v.lamps) lamp(kit, level, l);
  busStop(kit, level, v);
  for (const p of v.poles) snowPole(kit, level, p.x, p.z);
  signs(kit, level, v);
}

/** One lamp: the column on its base, the arm toward the road, the
 * lantern. The frame's +z is the arm's way. */
function lamp(kit: FacadeKit, level: Level, l: StreetLamp): void {
  const y = roadY(level, l.x, l.z) + KERB;
  kit.at(l.x, y, l.z, l.heading);
  const h = l.height;
  // The cast base, the column tapering a little, a collar under the arm.
  kit.column(0, 0, -0.4, 0.55, 0.13, COLUMN.layer, COLUMN.tint, 8);
  kit.frustum(ring(0.075, 8), ring(0.055, 8), 0.55, h - 0.1, COLUMN.layer, COLUMN.tint, null);
  kit.column(0, 0, h - 0.4, h - 0.25, 0.08, COLUMN.layer, COLUMN.tint, 8);
  // The arm out over the kerb, a scroll under it.
  const arm = F.lamp.arm;
  solid(kit, -0.035, h - 0.1, -0.05, 0.035, h - 0.02, arm, COLUMN);
  solid(kit, -0.025, h - 0.5, 0.02, 0.025, h - 0.1, 0.07, COLUMN);
  solid(kit, -0.025, h - 0.35, 0.05, 0.025, h - 0.1, arm * 0.45, COLUMN);
  // The lantern hung off the arm's end: its frame, four lit panes, its cap
  // with the snow on it.
  const L = LANTERN;
  const top = h - 0.1;
  const z = arm;
  const g0 = top - 0.12 - L.glass;
  const g1 = top - 0.12;
  solid(kit, -0.03, g1, z - 0.03, 0.03, top, z + 0.03, COLUMN);
  solid(
    kit,
    -L.half * 0.7,
    g0 - 0.08,
    z - L.half * 0.7,
    L.half * 0.7,
    g0,
    z + L.half * 0.7,
    COLUMN,
  );
  kit.glow = 1;
  kit.wall(-L.half, z + L.half, L.half, z + L.half, g0, g1, FACADE.plain, 0xfff1d0);
  kit.wall(L.half, z - L.half, -L.half, z - L.half, g0, g1, FACADE.plain, 0xfff1d0);
  kit.wall(L.half, z + L.half, L.half, z - L.half, g0, g1, FACADE.plain, 0xfff1d0);
  kit.wall(-L.half, z - L.half, -L.half, z + L.half, g0, g1, FACADE.plain, 0xfff1d0);
  kit.glow = 0;
  const c = L.half + 0.06;
  kit.frustum(
    [
      [-c, z - c],
      [c, z - c],
      [c, z + c],
      [-c, z + c],
    ],
    [
      [-0.04, z - 0.04],
      [0.04, z - 0.04],
      [0.04, z + 0.04],
      [-0.04, z + 0.04],
    ],
    g1,
    g1 + L.cap,
    COLUMN.layer,
    COLUMN.tint,
    SNOW,
  );
}

/** A ring of `n` corners `r` from the frame's axis, as `kit.prism` takes. */
function ring(r: number, n: number, x = 0, z = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    out.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
  }
  return out;
}

/** THE BUS STOP: the shelter with its open front to the road (+z), its
 * glass back and ends, its roof and bench; the sign at the kerb. */
function busStop(kit: FacadeKit, level: Level, v: Village): void {
  const b = v.bus;
  if (!b) return;
  const y = roadY(level, b.x, b.z) + KERB;
  kit.at(b.x, y, b.z, b.heading);
  const hx = F.bus.along / 2;
  const hz = F.bus.deep / 2;
  const top = 2.4;
  for (const [x, z] of [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
  ])
    solid(kit, x - 0.05, -0.3, z - 0.05, x + 0.05, top, z + 0.05, STEEL);
  // The glass: the back and the two ends, a band of frit across it.
  kit.wall(hx, -hz, -hx, -hz, 0.12, top - 0.1, FACADE.glazing, 0xdfe8ee);
  kit.wall(-hx, -hz, hx, -hz, 0.12, top - 0.1, FACADE.glazing, 0xdfe8ee);
  for (const s of [-1, 1]) {
    kit.wall(s * hx, -hz, s * hx, hz * 0.4, 0.12, top - 0.1, FACADE.glazing, 0xdfe8ee);
    kit.wall(s * hx, hz * 0.4, s * hx, -hz, 0.12, top - 0.1, FACADE.glazing, 0xdfe8ee);
  }
  // The roof: a thin slab overhanging the front, its snow.
  solid(kit, -hx - 0.15, top, -hz - 0.1, hx + 0.15, top + 0.12, hz + 0.35, STEEL, SNOW);
  solid(kit, -hx - 0.1, top + 0.12, -hz - 0.05, hx + 0.1, top + 0.3, hz + 0.3, SNOW);
  // The bench along the back, the timetable on one end.
  solid(kit, -hx + 0.3, 0.42, -hz + 0.1, hx - 0.3, 0.48, -hz + 0.5, {
    layer: FACADE.boards,
    tint: 0xc9a07a,
  });
  for (const x of [-hx + 0.5, hx - 0.5])
    solid(kit, x - 0.04, 0, -hz + 0.2, x + 0.04, 0.42, -hz + 0.4, STEEL);
  kit.glow = 1;
  solid(kit, hx - 0.06, 0.9, -hz + 0.15, hx - 0.02, 1.9, -hz + 0.85, {
    layer: FACADE.plain,
    tint: 0xeef2f4,
  });
  kit.glow = 0;
  // The stop's sign at the kerb: a pole, a round yellow disc with a dark
  // band and a little timetable box.
  const sy = roadY(level, b.sign.x, b.sign.z) + KERB;
  kit.at(b.sign.x, sy, b.sign.z, b.heading + Math.PI / 2);
  solid(kit, -0.04, -0.3, -0.04, 0.04, 2.9, 0.04, STEEL);
  disc(kit, 0, 2.55, 0.32, 0xf2c230, 0.05);
  solid(kit, -0.2, 2.47, 0.06, 0.2, 2.63, 0.08, { layer: FACADE.plain, tint: 0x1c5a3a });
  solid(kit, -0.18, 1.3, 0.04, 0.18, 1.8, 0.1, { layer: FACADE.plain, tint: 0xf4f4f0 });
}

/** A disc of `r` on a pole at the frame's (x, y), facing ±z both ways. */
function disc(kit: FacadeKit, x: number, y: number, r: number, tint: number, z: number): void {
  const n = 12;
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0: [number, number, number] = [x + Math.cos(a0) * r, y + Math.sin(a0) * r, side * z];
      const p1: [number, number, number] = [x + Math.cos(a1) * r, y + Math.sin(a1) * r, side * z];
      const m: [number, number, number] = [x, y, side * z];
      if (side > 0) kit.tri(m, p0, p1, [0, 0], [1, 0], [1, 1], FACADE.plain, tint);
      else kit.tri(m, p1, p0, [0, 0], [1, 0], [1, 1], FACADE.plain, tint);
    }
  }
}

/** A snow pole: banded orange and black, 2 m out of the bank. */
function snowPole(kit: FacadeKit, level: Level, x: number, z: number): void {
  const y = level.groundAt(x, z) + LOOSE;
  kit.at(x, y, z, 0);
  const h = F.pole.height;
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = -0.4 + ((h + 0.4) * i) / bands;
    const y1 = -0.4 + ((h + 0.4) * (i + 1)) / bands;
    const tint = i % 2 === 0 ? 0x1c1c1c : 0xf26a12;
    kit.column(0, 0, y0, y1, 0.02, FACADE.plain, tint, 4);
  }
  // A reflector near the top.
  kit.glow = 0;
  solid(kit, -0.03, h - 0.35, 0.02, 0.03, h - 0.2, 0.03, { layer: FACADE.plain, tint: 0xfff4e0 });
}

/** A rectangular sign on a pole at (x, z) facing `heading`: its board
 * `w` × `h` m in `ground`, its foot `y0` over the snow. */
function plate(
  kit: FacadeKit,
  level: Level,
  x: number,
  z: number,
  heading: number,
  w: number,
  h: number,
  y0: number,
  draw: (top: number) => void,
): void {
  const y = level.groundAt(x, z) + LOOSE;
  kit.at(x, y, z, heading);
  solid(kit, -0.035, -0.3, -0.035, 0.035, y0 + h, 0.035, STEEL);
  draw(y0);
  solid(kit, -w / 2, y0 + h, -0.04, w / 2, y0 + h + 0.06, 0.06, SNOW);
}

/** THE SIGNS: the village's name where each road comes in, the car
 * park's at its aisles, a crossing's beside the square's crossing. */
function signs(kit: FacadeKit, level: Level, v: Village): void {
  // The name board where a road out leaves the village, facing in-coming
  // traffic, on its right.
  for (const id of v.ends.road) {
    const st = v.streets.find((s) => s.id === id);
    if (!st || st.points.length < 4) continue;
    const p = st.points[Math.min(st.points.length - 1, 3)];
    const lat = st.section.lane + st.section.sides[0].bank + 0.4;
    // Coming in the road runs back up its points: its right is the
    // street's left.
    const x = p.x - Math.cos(p.heading) * lat;
    const z = p.z + Math.sin(p.heading) * lat;
    plate(kit, level, x, z, p.heading, 1.6, 0.55, 1.6, (y0) => {
      solid(kit, -0.8, y0, 0.04, 0.8, y0 + 0.55, 0.08, { layer: FACADE.plain, tint: 0xf2c230 });
      signBoard(kit, -0.72, 0.72, y0 + 0.08, y0 + 0.47, 0.08, 0xf2c230, 0x1c1c1c, `${level.seed}`);
    });
  }
  // The car park's sign at the mouth of its first aisle.
  const p1 = v.streets.find((s) => s.id === "P1");
  if (p1 && p1.points.length > 2) {
    const p = p1.points[2];
    const lat = p1.section.lane + 0.8;
    const x = p.x + Math.cos(p.heading) * lat;
    const z = p.z - Math.sin(p.heading) * lat;
    plate(kit, level, x, z, p.heading + Math.PI, 0.6, 0.6, 1.9, (y0) => {
      solid(kit, -0.3, y0, 0.04, 0.3, y0 + 0.6, 0.08, { layer: FACADE.plain, tint: 0x1f4fa0 });
      // The P: its stem and its bowl.
      const w = { layer: FACADE.plain, tint: 0xf4f4f4 };
      solid(kit, -0.14, y0 + 0.1, 0.08, -0.06, y0 + 0.5, 0.1, w);
      solid(kit, -0.06, y0 + 0.42, 0.08, 0.12, y0 + 0.5, 0.1, w);
      solid(kit, -0.06, y0 + 0.28, 0.08, 0.12, y0 + 0.34, 0.1, w);
      solid(kit, 0.1, y0 + 0.3, 0.08, 0.16, y0 + 0.48, 0.1, w);
    });
  }
  // The crossing's sign either side of the square's crossing: a blue
  // square with a white triangle.
  for (const c of v.crossings) {
    if (!c.id.endsWith("@square")) continue;
    for (const side of [-1, 1]) {
      const lat = side * (c.across / 2 + 0.9);
      const x = c.x + Math.cos(c.heading) * lat;
      const z = c.z - Math.sin(c.heading) * lat;
      plate(kit, level, x, z, c.heading + (side > 0 ? Math.PI : 0), 0.6, 0.6, 2.0, (y0) => {
        solid(kit, -0.3, y0, 0.04, 0.3, y0 + 0.6, 0.08, { layer: FACADE.plain, tint: 0x1f4fa0 });
        kit.tri(
          [-0.24, y0 + 0.08, 0.09],
          [0.24, y0 + 0.08, 0.09],
          [0, y0 + 0.52, 0.09],
          [0, 0],
          [1, 0],
          [0.5, 1],
          FACADE.plain,
          0xf4f4f4,
        );
      });
    }
  }
}

/** The light the village's lamps lay, as the floodlights' bake reads a
 * mast (`bakePisteLight`): each lantern two beams thrown out along the
 * street either way at 60° off the nadir, wide across, half the lamp's
 * flux each — a residential street's spread. */
export function streetLampMasts(level: Level): PisteMast[] {
  const v = villageOf(level);
  if (!v) return [];
  const aim = (60 * Math.PI) / 180;
  // The solid angle the beam fills, sr: what its flux is spread over.
  const solid = solidOf(aim);
  return v.lamps.map((l) => {
    const y = roadY(level, l.x, l.z) + KERB;
    const lx = l.x + Math.sin(l.heading) * F.lamp.arm;
    const lz = l.z + Math.cos(l.heading) * F.lamp.arm;
    const ly = y + l.height - 0.4;
    const lumens = (F.lamp.lumens / 2) * (0.9 + 0.2 * idHash(`${l.street}${l.x | 0}`, 1));
    const lamps: PisteLamp[] = [Math.PI / 2, -Math.PI / 2].map((turn) => {
      const bearing = l.heading + turn;
      const dx = Math.sin(bearing) * Math.sin(aim);
      const dz = Math.cos(bearing) * Math.sin(aim);
      const dy = -Math.cos(aim);
      return { x: lx, y: ly, z: lz, dx, dy, dz, aim, bearing, lumens, peak: lumens / solid };
    });
    return { x: l.x, y, z: l.z, height: l.height, side: 1, heading: l.heading, lamps };
  });
}
