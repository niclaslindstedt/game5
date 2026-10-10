// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S BUILDINGS ON ITS STREETS — the base's own buildings and the
// town round them stood on lots fronting the streets the plan lays
// (`village-streets.ts`), as one compact village:
//
//   * THE FRONT ROW, between the main street and the hub, faces the runs
//     (its back to the street): the base lodge beside the square, the
//     rental and the ski school past it; the ticket office and first aid
//     on the square's other side, on the walk from the car park; hotels
//     out toward the ends, looking up the mountain.
//   * ACROSS THE MAIN STREET, facing it at the back of its sidewalk: the
//     CHURCH opposite the square, the SHOPS either side of it, apartment
//     chalets and houses further out.
//   * ALONG THE BACK STREET, both sides, behind their yards: chalet houses
//     and apartment chalets, and the hotels the front row had no room for.
//   * ON THE ROAD OUT, past the back street: the garage and the pump house,
//     where the machines come and go without crossing the village.
// Lots are laid along each street's side in turn, a gap dealt between one
// roof and the next and now and then a garden left open, each building
// tried at its place and a few metres on until it fits (`cabins.ts`'s
// `stand`, with the ski area's clearances, its whole lot cleared of trees
// and kept off every street) — and no more than `VILLAGE_LOTS.most` in
// all. A pure function of the plan and hashes of the map's seed.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { pick } from "./cabin-site.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";
import type { VillageKind } from "./defs/resort-buildings.ts";
import { VILLAGE_AREAS as A, VILLAGE_LOTS as L, sideReach } from "./defs/village-streets.ts";
import { REAL_HOUSES, realHouseNear, realHousesOf, snappedHeading } from "./real-houses.ts";
import type { Fit, StandAt } from "./resort-buildings.ts";
import {
  besidePoint,
  reachOf,
  type Street,
  type StreetPoint,
  type VillageStreets,
} from "./village-streets.ts";

/** One side of a line of street pieces, as lots are laid along it: its
 * points end to end (each knowing its piece), the side, the arcs no lot
 * may take (junctions, the square, the car park), how a building faces it
 * and how far back it stands. */
type Frontage = {
  points: (StreetPoint & { piece: Street })[];
  side: 0 | 1;
  blocked: [number, number][];
  faceIn: boolean;
  setback: (kind: CabinKind, k: number) => number;
};

/** Whether (x, z) is on a street (to the back of its sidewalks, `pad` m
 * more) or in an open place of the plan. */
export function streetHit(plan: VillageStreets): (x: number, z: number, pad: number) => boolean {
  const boxes = plan.streets.map((st) => {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const p of st.points) {
      x0 = Math.min(x0, p.x);
      z0 = Math.min(z0, p.z);
      x1 = Math.max(x1, p.x);
      z1 = Math.max(z1, p.z);
    }
    const r = Math.max(reachOf(st, 0), reachOf(st, 1));
    return { st, x0: x0 - r, z0: z0 - r, x1: x1 + r, z1: z1 + r };
  });
  return (x, z, pad) => {
    for (const b of boxes) {
      if (x < b.x0 - pad || x > b.x1 + pad || z < b.z0 - pad || z > b.z1 + pad) continue;
      const pts = b.st.points;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const c = pts[i];
        const ex = c.x - a.x;
        const ez = c.z - a.z;
        const len2 = Math.max(1e-9, ex * ex + ez * ez);
        const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / len2));
        const dx = x - (a.x + ex * t);
        const dz = z - (a.z + ez * t);
        const side = dx * ez - dz * ex > 0 ? 1 : 0;
        if (hypot(dx, dz) < reachOf(b.st, side) + pad) return true;
      }
    }
    for (const a of plan.areas) {
      const fx = Math.sin(a.heading);
      const fz = Math.cos(a.heading);
      const dx = x - a.x;
      const dz = z - a.z;
      if (
        Math.abs(dx * fz - dz * fx) < a.half + pad &&
        Math.abs(dx * fx + dz * fz) < a.depth + pad
      ) {
        return true;
      }
    }
    return false;
  };
}

/** Stand the village's buildings on `plan`'s streets with `stand`. */
export function placeOnStreets(
  level: Level,
  plan: VillageStreets,
  stand: StandAt,
  base: Fit,
  hotels: number,
): void {
  const seed = level.seed >>> 0;
  const hit = streetHit(plan);
  const fit: Fit = {
    ...base,
    clear: { ...base.clear, roof: 3 },
    lot: true,
    keep: (x, z) => !hit(x, z, 0.3),
  };
  const byId = new Map(plan.streets.map((s) => [s.id, s]));
  // A REAL FACE's houses (`real-houses.ts`): once the village's ground
  // holds enough of them, its houses, apartments and shops stand only
  // beside one.
  const real = realHousesOf(level).length > 0;
  const dense = real && realHousesIn(level, plan) >= REAL_HOUSES.village;
  const keepsToReal = (kind: CabinKind) =>
    dense && (kind === "house" || kind === "apartments" || kind === "shop");
  const line = (ids: readonly string[]): Frontage["points"] => {
    const out: Frontage["points"] = [];
    let s0 = 0;
    for (const id of ids) {
      const st = byId.get(id);
      if (!st) continue;
      const pts = st.points;
      for (let i = out.length === 0 ? 0 : 1; i < pts.length; i++) {
        out.push({ ...pts[i], s: s0 + pts[i].s, piece: st });
      }
      s0 += st.length;
    }
    return out;
  };
  const sV = plan.valley;
  // The main street runs along x: its hub side is its right where the
  // valley lies toward +z.
  const hubSide: 0 | 1 = sV > 0 ? 1 : 0;
  const valleySide: 0 | 1 = hubSide === 1 ? 0 : 1;
  const mainLine = line(plan.main);
  const backLine = line(plan.back);
  const sOfX = (pts: Frontage["points"], x: number) => {
    let best = Infinity;
    let s = 0;
    for (const p of pts) {
      if (Math.abs(p.x - x) < best) {
        best = Math.abs(p.x - x);
        s = p.s;
      }
    }
    return s;
  };
  // The junctions along a line, blocked to the other streets' reach.
  // The junctions along a line where a street leaves it on `side`,
  // blocked to that street's reach.
  const junctionBlocks = (pts: Frontage["points"], side: 0 | 1): [number, number][] => {
    const out: [number, number][] = [];
    for (const j of plan.junctions) {
      if (j.exit) continue;
      const near = pts.find((p) => hypot(p.x - j.x, p.z - j.z) < 1);
      if (!near) continue;
      let r = 0;
      for (const id of j.streets) {
        const st = byId.get(id);
        if (!st || st.kind === "main" || st.kind === "back") continue;
        // Which side of the line the street goes off to: its other end's.
        const far = st.from === j.id ? st.points[st.points.length - 1] : st.points[0];
        const rx = Math.cos(near.heading);
        const rz = -Math.sin(near.heading);
        const goes = (far.x - j.x) * rx + (far.z - j.z) * rz > 0 ? 1 : 0;
        if (goes !== side) continue;
        r = Math.max(r, reachOf(st, 0), reachOf(st, 1));
      }
      if (r === 0) continue;
      out.push([near.s - r - 2, near.s + r + 2]);
    }
    return out;
  };
  let count = 0;
  let k = 0;
  const deal = (salt: number) => pick(seed, "village-lots", k++, salt);
  const gap = () => L.gap.least + (L.gap.most - L.gap.least) * deal(1);
  const total = (pts: Frontage["points"]) => pts[pts.length - 1].s;
  /** Lay `kinds` along `f` from arc `from` in the direction `dir`, to
   * `limit`; returns the kinds left over. */
  const lay = (
    f: Frontage,
    kinds: CabinKind[],
    from: number,
    dir: 1 | -1,
    limit: number,
    gardens: boolean,
  ): CabinKind[] => {
    let s = from;
    const left = kinds.slice();
    while (left.length > 0 && count < L.most) {
      const kind = left[0];
      const d = CABINS[kind];
      const w = d.width + 2 * d.reach.side;
      let placed = false;
      if (gardens && deal(2) < L.garden.share) {
        s += dir * (L.garden.along.least + (L.garden.along.most - L.garden.along.least) * deal(3));
      }
      for (let tries = 0; tries < 40; tries++) {
        const a = dir > 0 ? s : s - w;
        const b = a + w;
        if (dir > 0 ? b > limit : a < limit) return left;
        if (a < 0 || b > total(f.points)) return left;
        const block = f.blocked.find(([p, q]) => b > p && a < q);
        if (block) {
          s = dir > 0 ? block[1] : block[0];
          continue;
        }
        const c = standOn(f, kind, (a + b) / 2, count);
        if (c) {
          count++;
          f.blocked.push([a, b]);
          s = dir > 0 ? b + gap() : a - gap();
          placed = true;
          break;
        }
        s += dir * 4;
      }
      if (!placed) return left;
      left.shift();
    }
    return left;
  };
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  /** Stand `kind` on frontage `f` with its middle at arc `s`. */
  const standOn = (f: Frontage, kind: CabinKind, s: number, n: number) => {
    const pts = f.points;
    let i = 1;
    while (i < pts.length - 1 && pts[i].s < s) i++;
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const t = p1.s > p0.s ? Math.max(0, Math.min(1, (s - p0.s) / (p1.s - p0.s))) : 0;
    at.x = p0.x + (p1.x - p0.x) * t;
    at.z = p0.z + (p1.z - p0.z) * t;
    at.heading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    const piece = t < 0.5 ? p0.piece : p1.piece;
    const d = CABINS[kind];
    const reach = sideReach(piece.section, f.side);
    const off =
      reach + f.setback(kind, n) + d.depth / 2 + (f.faceIn ? d.reach.front : d.reach.back);
    const sign = f.side === 0 ? -1 : 1;
    const q = besidePoint(at, sign * off);
    const toward = Math.atan2(at.x - q.x, at.z - q.z);
    const heading = f.faceIn ? toward : toward + Math.PI;
    // On a real face, the town keeps to where real houses stand, and a
    // building beside one is turned to its bearing where it can be.
    if (keepsToReal(kind) && !realHouseNear(level, q.x, q.z, REAL_HOUSES.near)) return null;
    const turned = real ? snappedHeading(level, kind, q.x, q.z, heading) : heading;
    const c =
      (turned !== heading ? stand(kind, q.x, q.z, turned, piece.id, s, 0, fit) : null) ??
      stand(kind, q.x, q.z, heading, piece.id, s, 0, fit);
    if (c) c.id = `V${n + 1}`;
    return c;
  };
  const core = () => L.setback.core;
  const home = () =>
    L.setback.house.least + (L.setback.house.most - L.setback.house.least) * deal(4);

  // THE FRONT ROW, either side of the square.
  const sq = A.square.along / 2;
  const squareS = sOfX(mainLine, plan.square);
  const carpark = plan.areas.find((a) => a.kind === "carpark");
  const front: Frontage = {
    points: mainLine,
    side: hubSide,
    blocked: [...junctionBlocks(mainLine, hubSide), [squareS - sq, squareS + sq]],
    faceIn: false,
    setback: core,
  };
  if (carpark) {
    const c = sOfX(mainLine, carpark.x);
    front.blocked.push([c - carpark.half - 2, c + carpark.half + 2]);
  }
  // The car park's side (east if there is none) takes the ticket office
  // and first aid, the walk from the cars to the lifts passing them.
  const east = plan.carparkSide >= 0 ? 1 : -1;
  const hotelsLeft: VillageKind[] = Array.from({ length: hotels }, () => "hotel" as const);
  const lodgeSide: CabinKind[] = ["restaurant", "rental", "school"];
  const ticketSide: CabinKind[] = ["ticket", "firstAid"];
  const fromEdge = (dir: 1 | -1) => (dir > 0 ? squareS + sq + 1 : squareS - sq - 1);
  const endOf = (dir: 1 | -1) => (dir > 0 ? total(mainLine) : 0);
  lay(front, lodgeSide, fromEdge(-east as 1 | -1), -east as 1 | -1, endOf(-east as 1 | -1), false);
  lay(front, ticketSide, fromEdge(east as 1 | -1), east as 1 | -1, endOf(east as 1 | -1), false);
  // The hotels out toward the front row's ends, either side in turn.
  for (let any = true; any && hotelsLeft.length > 0;) {
    any = false;
    for (const dir of [1, -1] as const) {
      if (hotelsLeft.length === 0) break;
      if (lay(front, ["hotel"], fromEdge(dir), dir, endOf(dir), false).length === 0) {
        hotelsLeft.pop();
        any = true;
      }
    }
  }

  // ACROSS THE MAIN STREET: the church opposite the square, the shops
  // either side of it, apartments and houses out toward the ends.
  const across: Frontage = {
    points: mainLine,
    side: valleySide,
    blocked: junctionBlocks(mainLine, valleySide),
    faceIn: true,
    setback: core,
  };
  const churchLeft = lay(
    across,
    ["church"],
    squareS - CABINS.church.width / 2 - CABINS.church.reach.side,
    1,
    total(mainLine),
    false,
  );
  const churchAt = churchLeft.length === 0 ? squareS : NaN;
  const townKinds = (near: boolean, n: number): CabinKind[] => {
    const out: CabinKind[] = [];
    for (let i = 0; i < n; i++) {
      const u = deal(5);
      out.push(near ? (u < 0.75 ? "shop" : "apartments") : u < 0.55 ? "house" : "apartments");
    }
    return out;
  };
  for (const dir of [1, -1] as const) {
    const startS = Number.isNaN(churchAt)
      ? squareS + dir * sq
      : churchAt + dir * (CABINS.church.width / 2 + CABINS.church.reach.side + gap());
    lay(across, townKinds(true, 4), startS, dir, endOf(dir), false);
    lay(across, townKinds(false, 6), startS, dir, endOf(dir), true);
  }

  // THE SERVICE BUILDINGS on the road out, past the back street.
  const roadId = plan.ends.road[0] || plan.ends.road[1];
  const road = byId.get(roadId);
  if (road) {
    const pts = line([roadId]);
    const r = Math.max(...plan.streets.filter((s) => s.kind === "back").map((s) => reachOf(s, 0)));
    for (const side of [1, 0] as const) {
      const f: Frontage = {
        points: pts,
        side,
        blocked: [],
        faceIn: true,
        setback: () => 2,
      };
      const left = lay(f, ["garage", "pumpHouse"], r + 8, 1, total(pts), false);
      if (left.length === 0) break;
      // What did not fit on that side is tried on the other.
      if (left.length === 1) {
        const g = { ...f, side: (1 - side) as 0 | 1 };
        lay(g, left, r + 8, 1, total(pts), false);
        break;
      }
    }
  }

  // ALONG THE BACK STREET: the houses either side, the hotels the front
  // row had no room for on its valley side.
  const backEnd = total(backLine);
  const backSouth: Frontage = {
    points: backLine,
    side: valleySide,
    blocked: junctionBlocks(backLine, valleySide),
    faceIn: true,
    setback: home,
  };
  const backNorth: Frontage = {
    ...backSouth,
    side: hubSide,
    blocked: junctionBlocks(backLine, hubSide),
  };
  const southKinds: CabinKind[] = [...hotelsLeft, ...townKinds(false, 14)];
  lay(backSouth, southKinds, 0, 1, backEnd, true);
  lay(backNorth, townKinds(false, 14), 0, 1, backEnd, true);
}

/** How many of a real face's houses stand on the village's ground — within
 * `REAL_HOUSES.near` of its streets' bounds. */
function realHousesIn(level: Level, plan: VillageStreets): number {
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const st of plan.streets) {
    if (st.exit) continue;
    for (const p of st.points) {
      x0 = Math.min(x0, p.x);
      z0 = Math.min(z0, p.z);
      x1 = Math.max(x1, p.x);
      z1 = Math.max(z1, p.z);
    }
  }
  const m = REAL_HOUSES.near;
  return realHousesOf(level).filter(
    (h) => h.x > x0 - m && h.x < x1 + m && h.z > z0 - m && h.z < z1 + m,
  ).length;
}
