// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A VILLAGE'S STREETS CARRY — worked out from the street plan
// (`village-streets.ts`) for whatever drives, walks, parks and is lit on
// them: the LANES traffic keeps to (right-hand, a lane each way; a loop
// round the village and the road out), the SIDEWALKS, the PARKING BAYS
// (along the back street's kerb and in the day car park), the CROSSINGS,
// the BUS STOP, the STREET LAMPS and the SNOW POLES down the road out
// (`STREET_FURNITURE`). Pure functions of the plan; no stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import {
  SECTIONS,
  STREET_FURNITURE as F,
  VILLAGE_AREAS as A,
  sideReach,
} from "./defs/village-streets.ts";
import {
  besidePoint,
  reachOf,
  resample,
  streetAt,
  type Street,
  type StreetPoint,
  type VillageStreets,
} from "./village-streets.ts";

/** ONE LANE of a street, the way traffic runs on it: its street, which
 * way (+1 from the street's first junction to its last, −1 back), the
 * junctions it leaves and reaches, its line (the lane's middle, on the
 * right of its way as a driver sees it — the map's side 0 for +1) and its
 * length. A car on it at arc `s` is at
 * `streetAt`-style interpolation of `points`. */
export type Lane = {
  id: string;
  street: string;
  dir: 1 | -1;
  from: number;
  to: number;
  points: StreetPoint[];
  length: number;
};

/** A SIDEWALK: its street and side (0 left, 1 right of the street's way),
 * its middle line (trimmed short of the junctions) and its width. */
export type Walk = {
  id: string;
  street: string;
  side: 0 | 1;
  points: StreetPoint[];
  width: number;
};

/** A PARKING BAY: its middle, the way a car parked in it faces, its
 * length and width, the street it is reached from and whether it is a
 * kerbside bay or one of the car park's. */
export type Bay = {
  id: string;
  kind: "kerb" | "lot";
  street: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  length: number;
  width: number;
};

/** A CROSSING: its middle on the street, the street's heading there, how
 * far it runs across (the carriageway and any parking) and its width
 * along the street. */
export type Crossing = {
  id: string;
  street: string;
  s: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  across: number;
  width: number;
};

/** A STREET LAMP: its foot, the lantern's height over it and the way its
 * arm reaches (toward the road). */
export type StreetLamp = {
  x: number;
  y: number;
  z: number;
  height: number;
  heading: number;
  street: string;
};

/** THE BUS STOP: the shelter's middle and the way its open front faces
 * (toward the road), the pole with the stop's sign at the kerb, and where
 * on its lane the bus stands (`lane`, `s`). */
export type BusStop = {
  x: number;
  y: number;
  z: number;
  heading: number;
  street: string;
  sign: { x: number; y: number; z: number };
  lane: string;
  s: number;
};

/** A SNOW POLE down a road's edge. */
export type SnowPole = { x: number; y: number; z: number };

/** Everything the streets carry. `loop` is the lanes, in order, that run
 * round the village's loop (the main street east, an end's cross street
 * down, the back street west, the other end's cross street up). */
export type StreetFurniture = {
  lanes: Lane[];
  loop: string[];
  walks: Walk[];
  bays: Bay[];
  crossings: Crossing[];
  lamps: StreetLamp[];
  bus: BusStop | null;
  poles: SnowPole[];
};

/** How far short of its junction at `end` (0 its first, 1 its last) a
 * street's sidewalks and banks stop — past the other streets' reach there
 * — and its carriageway's patch (the junction's own snow) reaches. */
export function trimAt(v: VillageStreets, st: Street, end: 0 | 1): { walk: number; road: number } {
  const j = v.junctions[end === 0 ? st.from : st.to];
  if (j.exit) return { walk: 0, road: 0 };
  let walk = 0;
  let road = 0;
  for (const id of j.streets) {
    if (id === st.id) continue;
    const o = v.streets.find((s) => s.id === id);
    if (!o) continue;
    walk = Math.max(walk, reachOf(o, 0), reachOf(o, 1));
    road = Math.max(
      road,
      o.section.lane + Math.max(o.section.sides[0].park, o.section.sides[1].park),
    );
  }
  return { walk: walk + 0.5, road };
}

/** The line `lat` m to the right of a street's centreline, from arc `s0`
 * to `s1` (reversed when `s0 > s1`), every `step` m. */
export function offsetLine(
  level: Level,
  st: Street,
  lat: number,
  s0: number,
  s1: number,
  step = 4,
): StreetPoint[] {
  const out: { x: number; z: number }[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step));
  const p: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (let i = 0; i <= n; i++) {
    streetAt(st, s0 + ((s1 - s0) * i) / n, p);
    out.push(besidePoint(p, lat));
  }
  return resample(level, out, step);
}

/** THE FURNITURE of a village's streets. */
export function furnishStreets(level: Level, v: VillageStreets): StreetFurniture {
  const lanes: Lane[] = [];
  const walks: Walk[] = [];
  const bays: Bay[] = [];
  const crossings: Crossing[] = [];
  const lamps: StreetLamp[] = [];
  const poles: SnowPole[] = [];
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const st of v.streets) {
    const S = st.section;
    // THE LANES: one each way, in the middle of its half — on the right
    // of its way as a driver sees it, which is the map's left
    // (`besidePoint`'s negative side: the map view mirrors the world as
    // the eye sees it).
    for (const dir of [1, -1] as const) {
      const pts =
        dir === 1
          ? offsetLine(level, st, -S.lane / 2, 0, st.length)
          : offsetLine(level, st, S.lane / 2, st.length, 0);
      lanes.push({
        id: `${st.id}${dir > 0 ? "+" : "-"}`,
        street: st.id,
        dir,
        from: dir > 0 ? st.from : st.to,
        to: dir > 0 ? st.to : st.from,
        points: pts,
        length: pts[pts.length - 1].s,
      });
    }
    const t0 = trimAt(v, st, 0);
    const t1 = trimAt(v, st, 1);
    // THE SIDEWALKS, short of the junctions.
    for (const side of [0, 1] as const) {
      const sd = S.sides[side];
      if (sd.walk <= 0) continue;
      const s0 = t0.walk;
      const s1 = st.length - t1.walk;
      if (s1 - s0 < 4) continue;
      const sign = side === 0 ? -1 : 1;
      const lat = sign * (S.lane + sd.park + sd.bank + sd.walk / 2);
      walks.push({
        id: `${st.id}:${side}`,
        street: st.id,
        side,
        points: offsetLine(level, st, lat, s0, s1),
        width: sd.walk,
      });
    }
    // THE CROSSINGS at both ends of a street with a sidewalk, where it
    // meets another street.
    const walked = S.sides[0].walk > 0 || S.sides[1].walk > 0;
    if (walked) {
      for (const end of [0, 1] as const) {
        const j = v.junctions[end === 0 ? st.from : st.to];
        if (j.exit || j.streets.length < 2) continue;
        const t = end === 0 ? t0 : t1;
        const off = t.road + F.crossing.off + F.crossing.width / 2;
        if (off * 2 > st.length) continue;
        const s = end === 0 ? off : st.length - off;
        streetAt(st, s, at);
        crossings.push({
          id: `${st.id}@${end}`,
          street: st.id,
          s,
          x: at.x,
          y: at.y,
          z: at.z,
          heading: at.heading,
          across: 2 * S.lane + S.sides[0].park + S.sides[1].park,
          width: F.crossing.width,
        });
      }
    }
    // THE LAMPS: a lit street's, every `every` m on its sidewalk's back
    // edge (the main street's both sides, staggered); the road out's one at
    // the village's edge.
    if (st.kind === "aisle") continue;
    const height = st.kind === "main" ? F.lamp.height.main : F.lamp.height.other;
    const sides: (0 | 1)[] =
      st.kind === "main" ? [0, 1] : st.kind === "road" ? [S.sides[0].walk > 0 ? 0 : 1] : [0];
    sides.forEach((side, k) => {
      const sd = S.sides[side];
      const sign = side === 0 ? -1 : 1;
      const lat = sign * (sideReach(S, side) - (sd.walk > 0 ? 0.3 : sd.bank * 0.3));
      const start = t0.walk + 2 + (k * F.lamp.every) / 2;
      const end = st.kind === "road" ? Math.min(st.length - 2, start + 1) : st.length - t1.walk - 2;
      for (let s = start, i = 0; s <= end; s += F.lamp.every, i++) {
        const jit = (((i * 7919 + st.id.length * 31) % 13) / 12 - 0.5) * 2 * F.lamp.jitter;
        const ss = Math.max(start, Math.min(end, s + jit));
        if (crossings.some((c) => c.street === st.id && Math.abs(c.s - ss) < 3)) continue;
        streetAt(st, ss, at);
        const q = besidePoint(at, lat);
        lamps.push({
          x: q.x,
          y: level.groundAt(q.x, q.z),
          z: q.z,
          height,
          heading: Math.atan2(at.x - q.x, at.z - q.z),
          street: st.id,
        });
      }
    });
    // THE SNOW POLES down a road out, both sides, in its banks.
    if (st.kind === "road") {
      for (let s = t0.walk + F.pole.every; s < st.length - 2; s += F.pole.every) {
        streetAt(st, s, at);
        for (const side of [0, 1] as const) {
          const lat = (side === 0 ? -1 : 1) * (S.lane + S.sides[side].bank * 0.7);
          const q = besidePoint(at, lat);
          poles.push({ x: q.x, y: level.groundAt(q.x, q.z), z: q.z });
        }
      }
    }
    // THE KERBSIDE BAYS along a parking strip, clear of the crossings.
    for (const side of [0, 1] as const) {
      const sd = S.sides[side];
      if (sd.park <= 0) continue;
      const sign = side === 0 ? -1 : 1;
      const len = F.kerb.length;
      for (let s = t0.walk + len / 2 + 2; s <= st.length - t1.walk - len / 2 - 2; s += len) {
        if (crossings.some((c) => c.street === st.id && Math.abs(c.s - s) < len / 2 + 2)) continue;
        streetAt(st, s, at);
        const q = besidePoint(at, sign * (S.lane + sd.park / 2));
        bays.push({
          id: `${st.id}k${bays.length + 1}`,
          kind: "kerb",
          street: st.id,
          x: q.x,
          y: level.groundAt(q.x, q.z),
          z: q.z,
          // Parked with the traffic on its side of the street: side 0
          // carries the way the street runs (see THE LANES), side 1 the
          // way back.
          heading: side === 0 ? at.heading : at.heading + Math.PI,
          length: len,
          width: F.kerb.width,
        });
      }
    }
  }
  // THE CAR PARK'S BAYS: a row either side of each aisle in from the
  // street, square to it, from past the main street's reach to the far
  // aisle's edge.
  const B = A.carpark.bay;
  const hubSide = v.valley > 0 ? 1 : 0;
  const mainReach = sideReach(SECTIONS.main, hubSide);
  for (const id of ["P1", "P3"]) {
    const st = v.streets.find((s) => s.id === id);
    if (!st) continue;
    const inward = id === "P1";
    const lane = st.section.lane;
    const near = mainReach + 1;
    const far = st.length - lane - 0.5;
    for (let d = near + B.width / 2; d <= far - B.width / 2; d += B.width) {
      const s = inward ? d : st.length - d;
      streetAt(st, s, at);
      for (const side of [-1, 1]) {
        const q = besidePoint(at, side * (lane + B.length / 2));
        bays.push({
          id: `${id}b${bays.length + 1}`,
          kind: "lot",
          street: id,
          x: q.x,
          y: level.groundAt(q.x, q.z),
          z: q.z,
          // Nose in, away from the aisle.
          heading: Math.atan2(q.x - at.x, q.z - at.z),
          length: B.length,
          width: B.width,
        });
      }
    }
  }
  // A CROSSING over the main street at the square, and the BUS STOP on the
  // square's edge, the side away from the car park.
  let bus: BusStop | null = null;
  const sq = v.areas.find((a) => a.kind === "square");
  if (sq) {
    const hit = nearestOn(v, v.main, v.square, sq.z);
    if (hit) {
      const st = hit.street;
      const S = st.section;
      streetAt(st, hit.s, at);
      crossings.push({
        id: `${st.id}@square`,
        street: st.id,
        s: hit.s,
        x: at.x,
        y: at.y,
        z: at.z,
        heading: at.heading,
        across: 2 * S.lane,
        width: F.crossing.width,
      });
      const away = v.carparkSide === 0 ? 1 : -v.carparkSide;
      const bx = v.square + away * (A.square.along / 2 - F.bus.along / 2 - 1);
      const b = nearestOn(v, v.main, bx, sq.z);
      if (b) {
        streetAt(b.street, b.s, at);
        const sign = hubSide === 0 ? -1 : 1;
        const reach = sideReach(b.street.section, hubSide);
        const q = besidePoint(at, sign * (reach + F.bus.deep / 2 + 0.3));
        const k = besidePoint(at, sign * (b.street.section.lane + 0.3));
        // The bus stands on the lane on the square's side.
        const laneId = `${b.street.id}${sign < 0 ? "+" : "-"}`;
        const ln = lanes.find((l) => l.id === laneId);
        bus = {
          x: q.x,
          y: level.groundAt(q.x, q.z),
          z: q.z,
          heading: Math.atan2(at.x - q.x, at.z - q.z),
          street: b.street.id,
          sign: { x: k.x, y: level.groundAt(k.x, k.z), z: k.z },
          lane: laneId,
          s: ln ? nearestS(ln.points, at.x, at.z) : 0,
        };
      }
    }
  }
  // THE LOOP: the main street east, the east end's cross street down, the
  // back street west, the west end's cross street up.
  const loop = [
    ...v.main.map((id) => `${id}+`),
    `${v.ends.cross[1]}+`,
    ...v.back
      .slice()
      .reverse()
      .map((id) => `${id}-`),
    `${v.ends.cross[0]}-`,
  ];
  return { lanes, loop, walks, bays, crossings, lamps, bus, poles };
}

/** The arc along `points` nearest (x, z). */
function nearestS(points: readonly StreetPoint[], x: number, z: number): number {
  let best = Infinity;
  let s = 0;
  for (const p of points) {
    const d = hypot(p.x - x, p.z - z);
    if (d < best) {
      best = d;
      s = p.s;
    }
  }
  return s;
}

/** Of the streets `ids`, the one passing nearest (x, z), and the arc on it. */
export function nearestOn(
  v: VillageStreets,
  ids: readonly string[],
  x: number,
  z: number,
): { street: Street; s: number; d: number } | null {
  let out: { street: Street; s: number; d: number } | null = null;
  for (const id of ids) {
    const st = v.streets.find((s) => s.id === id);
    if (!st) continue;
    for (const p of st.points) {
      const d = hypot(p.x - x, p.z - z);
      if (!out || d < out.d) out = { street: st, s: p.s, d };
    }
  }
  return out;
}
