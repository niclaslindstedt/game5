// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE FIRES BURN — a ski area's CAMP FIRES outside its huts and its
// BONFIRES on the valley floor at the bottom of the runs (`defs/fires.ts`
// says what each is and why it stands where it does).
//
//   * A CAMP FIRE is a hut's own: about a third to a half of the huts — a
//     log hut, cabin or chalet, an afterski lodge, a mountain restaurant,
//     the patrol's hut — keep one a few metres out from the front, to one
//     side of the door, on ground flat enough for its benches, off every
//     run's snow, clear of every trunk, post, wall and lift line. Its
//     benches stand in a ring round it facing it; most have a woodpile.
//   * A BONFIRE stands on the open valley floor near the village, two to
//     four of them, far apart: off the runs and the hub's snow, off the
//     streets, fifteen metres from any building, clear of the lifts, the
//     wind tunnels, the helicopter's pad, the parked snowmobile, the
//     balloon's site and the airstrip.
//
// A REAL THING THE MAP KNOWS: a position, a hearth, the flames' height, the
// benches round it and the building it belongs to, read by the contact
// (`fire-burn.ts`), the drawing and the people grilling round it alike. A
// pure function of the map off hashes of its seed on a salt of its own —
// never the stream, never the generator's order — so no map's digest and
// no run's moves for it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { inWater } from "../mapgen/real-water.ts";
import { outsideHub } from "../mapgen/query.ts";
import type { Level } from "../mapgen/types.ts";
import { airstripOf } from "./airstrip.ts";
import { balloonSiteOf } from "./balloon-site.ts";
import { groomedAt, pick } from "./cabin-site.ts";
import { cabinsOf, type Cabin } from "./cabins.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";
import { FIRE_KINDS, FIRE_LAYOUT, type FireKind } from "./defs/fires.ts";
import { helipadOf } from "./heli-pad.ts";
import { clearOfLifts } from "./lift-line.ts";
import { mapSolidsOf } from "./posts.ts";
import { uprightsNear } from "./upright-grid.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { onStreet } from "./village.ts";

/** A bench round a fire: its middle on the snow (y the ground), the way
 * its sitter faces — at the fire (the heading convention: 0 = +z,
 * clockwise from above) — and its length, m. */
export type FireSeat = { x: number; y: number; z: number; heading: number; length: number };

/** ONE FIRE: its id (`C1`… a camp fire, `B1`… a bonfire), its kind, the
 * hearth's middle on the ground and its radius, its flames' height, the
 * benches round it, its woodpile (where it stands and the way its long
 * side faces) or none, and the building it is the fire of (`Cabin.id`) —
 * none for a bonfire. A camp fire is the one with a grill: sausages on
 * sticks over the ring. */
export type Fire = {
  id: string;
  kind: FireKind;
  x: number;
  y: number;
  z: number;
  radius: number;
  flames: number;
  seats: FireSeat[];
  woodpile: { x: number; y: number; z: number; heading: number } | null;
  building: string | null;
};

/** The salt every fire's choice is dealt off. */
const SALT = 0xf1e3;
/** The huts that keep a fire. */
const HUTS: ReadonlySet<CabinKind> = new Set<CabinKind>([
  "hut",
  "cabin",
  "chalet",
  "afterski",
  "mountainHut",
  "patrol",
]);

const cache = new WeakMap<Level, Fire[]>();
const near: number[] = [];

/** EVERY FIRE of `level`, worked out once: the camp fires in the order of
 * their huts, then the bonfires. */
export function firesOf(level: Level): readonly Fire[] {
  // A summer map's bike park stands on the map it was laid on, and so do
  // the huts and their fires (`cabinsOf`).
  if (level.bikePark) return firesOf(level.bikePark.base);
  let list = cache.get(level);
  if (!list) {
    list = placeFires(level);
    cache.set(level, list);
  }
  return list;
}

/** The fires whose hearths, grown by `r`, reach (x, z) in plan, into
 * `out` (cleared first) — a handful at most. */
export function firesNear(level: Level, x: number, z: number, r: number, out: Fire[]): Fire[] {
  out.length = 0;
  for (const f of firesOf(level)) {
    const reach = f.radius + r;
    const dx = f.x - x;
    const dz = f.z - z;
    if (dx * dx + dz * dz < reach * reach) out.push(f);
  }
  return out;
}

/** The distance in plan from (x, z) to a building's walls, m (0 inside). */
function fromWalls(c: Cabin, x: number, z: number): number {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = dx * fz - dz * fx;
  const lz = dx * fx + dz * fz;
  return hypot(Math.max(0, Math.abs(lx) - d.width / 2), Math.max(0, Math.abs(lz) - d.depth / 2));
}

/** The steepest lean of the ground over a circle of `r` round (x, z), as
 * a slope read off its rim against its middle. */
function leanOver(level: Level, x: number, z: number, r: number): number {
  const g = level.groundAt(x, z);
  let most = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    most = Math.max(most, Math.abs(level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r) - g));
  }
  return most / r;
}

function placeFires(level: Level): Fire[] {
  // A map with no ski area (a synthetic one, a single piste) keeps none.
  if (!level.resort) return [];
  const seed = level.seed >>> 0;
  const groomed = groomedAt(level);
  const solids = mapSolidsOf(level);
  const fires: Fire[] = [];
  const cabins = cabinsOf(level);

  /** Whether a fire of `kind` fits at (x, z): in the map, on flat ground
   * off the snow, the water and the streets, clear of every solid and lift
   * line and of every fire stood so far. */
  const fits = (kind: FireKind, x: number, z: number, slope: number): boolean => {
    const def = FIRE_KINDS[kind];
    const ring = def.seats.ring + def.seats.length / 2;
    const edge = ring + 40;
    if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) return false;
    if (leanOver(level, x, z, ring) > slope) return false;
    for (const f of fires) {
      const other = FIRE_KINDS[f.kind];
      if (hypot(f.x - x, f.z - z) < ring + other.seats.ring + other.seats.length + 2) return false;
    }
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i === 12 ? 0 : ring;
      const px = x + Math.sin(a) * r;
      const pz = z + Math.cos(a) * r;
      if (groomed(px, pz)) return false;
      if ((level.iceAt?.(px, pz) ?? 0) > 0) return false;
      if (inWater(level.water, px, pz)) return false;
      if (!clearOfLifts(level, px, pz)) return false;
      if (onStreet(level, px, pz)) return false;
    }
    for (const i of uprightsNear(solids, x, z, ring + FIRE_LAYOUT.clear + 1, near)) {
      const s = solids[i];
      if (s.radius <= 0 || s.height <= 0) continue;
      if (hypot(s.x - x, s.z - z) < ring + FIRE_LAYOUT.clear + s.radius) return false;
    }
    return true;
  };

  /** The fire stood at (x, z): its benches round it (each where the snow
   * and the solids let it stand), its woodpile on the side `away` points
   * to, or null when it has fewer benches than its kind's least. */
  const light = (
    kind: FireKind,
    x: number,
    z: number,
    key: string,
    away: number,
    building: string | null,
  ): Fire | null => {
    const def = FIRE_KINDS[kind];
    const S = def.seats;
    const count = S.least + Math.floor(pick(seed, key, 1, SALT) * (S.most - S.least + 1));
    const turn = pick(seed, key, 2, SALT) * Math.PI * 2;
    const seats: FireSeat[] = [];
    for (let k = 0; k < count; k++) {
      const a = turn + (k / count) * Math.PI * 2;
      const sx = x + Math.sin(a) * S.ring;
      const sz = z + Math.cos(a) * S.ring;
      if (groomed(sx, sz)) continue;
      seats.push({
        x: sx,
        y: level.groundAt(sx, sz),
        z: sz,
        heading: Math.atan2(x - sx, z - sz),
        length: S.length,
      });
    }
    if (seats.length < S.least) return null;
    // The woodpile stands outside the benches, between two of them on the
    // side `away` points to — toward the hut it is cut for.
    let woodpile: Fire["woodpile"] = null;
    if (pick(seed, key, 3, SALT) < def.woodpile) {
      const a = away + Math.PI / count;
      const r = S.ring + S.length / 2 + 0.8;
      const wx = x + Math.sin(a) * r;
      const wz = z + Math.cos(a) * r;
      if (!groomed(wx, wz)) {
        woodpile = { x: wx, y: level.groundAt(wx, wz), z: wz, heading: a + Math.PI / 2 };
      }
    }
    return {
      id: key,
      kind,
      x,
      y: level.groundAt(x, z),
      z,
      radius: def.radius,
      flames: def.flames,
      seats,
      woodpile,
      building,
    };
  };

  // THE CAMP FIRES: a hut dealt one tries a few spots out from its front,
  // the dealt side first.
  const C = FIRE_LAYOUT.camp;
  // The huts in the order their hashes deal them, and as many fires as
  // the share asks of them — a hut that has no room for one passing it on
  // to the next.
  const huts = cabins
    .filter((c) => HUTS.has(c.kind))
    .map((c) => ({ c, u: pick(seed, c.id, 0, SALT) }))
    .sort((a, b) => a.u - b.u);
  const wantCamps = Math.max(huts.length > 0 ? 1 : 0, Math.round(huts.length * C.chance));
  let camps = 0;
  for (const { c } of huts) {
    if (camps >= wantCamps) break;
    const d = CABINS[c.kind];
    const ring = FIRE_KINDS.camp.seats.ring + FIRE_KINDS.camp.seats.length / 2;
    const least = d.depth / 2 + d.reach.front + C.eaves + ring;
    const off = Math.max(
      least,
      d.depth / 2 + C.off[0] + (C.off[1] - C.off[0]) * pick(seed, c.id, 4, SALT),
    );
    const side = pick(seed, c.id, 5, SALT) < 0.5 ? 1 : -1;
    const across = (d.width / 2) * (0.3 + 0.4 * pick(seed, c.id, 6, SALT));
    // ...or beside it, out past a flank's eaves.
    const flank = d.reach.side + C.eaves + ring;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    for (const [lx, lz] of [
      [side * across, off],
      [-side * across, off],
      [0, off + 2],
      [side * across, off + 3],
      [side * (d.width / 2 + flank), 0],
      [-side * (d.width / 2 + flank), 0],
    ] as const) {
      const x = c.x + lx * fz + lz * fx;
      const z = c.z - lx * fx + lz * fz;
      if (!fits("camp", x, z, C.slope)) continue;
      const fire = light("camp", x, z, `C${camps + 1}`, c.heading + Math.PI, c.id);
      if (!fire) continue;
      fires.push(fire);
      camps++;
      break;
    }
  }

  // THE BONFIRES: every spot of the grid round the village, the nearest
  // first (each a little further or nearer by its hash, so they do not all
  // crowd its nearest edge), stood where one fits until the dealt count.
  const B = FIRE_LAYOUT.bonfire;
  const want = B.least + Math.floor(pick(seed, "bonfire", 0, SALT) * (B.most - B.least + 1));
  const centre = level.resort.village;
  const hub = level.resort.hub;
  const pads = [helipadOf(level), sledSpotOf(level), balloonSiteOf(level)];
  const strip = airstripOf(level);
  const sx = Math.sin(strip.heading);
  const sz = Math.cos(strip.heading);
  const spots: { x: number; z: number; cost: number }[] = [];
  for (let dz = -B.search; dz <= B.search; dz += B.step) {
    for (let dx = -B.search; dx <= B.search; dx += B.step) {
      const d = hypot(dx, dz);
      if (d > B.search) continue;
      const k = (dx + B.search) * 4096 + (dz + B.search);
      spots.push({
        x: centre.x + dx,
        z: centre.z + dz,
        cost: d + pick(seed, "spot", k, SALT) * 80,
      });
    }
  }
  spots.sort((a, b) => a.cost - b.cost);
  let bonfires = 0;
  for (const { x, z } of spots) {
    if (bonfires >= want) break;
    if (hub && outsideHub(hub, x, z) < B.hub) continue;
    if (fires.some((f) => f.kind === "bonfire" && hypot(f.x - x, f.z - z) < B.apart)) continue;
    if (pads.some((p) => hypot(p.x - x, p.z - z) < B.pad)) continue;
    const ax = Math.abs((x - strip.x) * sx + (z - strip.z) * sz) - strip.length / 2;
    const ac = Math.abs((x - strip.x) * sz - (z - strip.z) * sx) - strip.width / 2;
    if (hypot(Math.max(0, ax), Math.max(0, ac)) < B.strip) continue;
    let tunnel = false;
    for (const t of level.resort.tunnels ?? []) {
      for (const q of t.points) {
        if (hypot(q.x - x, q.z - z) < t.width / 2 + B.tunnel) tunnel = true;
      }
    }
    if (tunnel) continue;
    const reach = B.building + FIRE_KINDS.bonfire.radius;
    if (cabins.some((c) => fromWalls(c, x, z) < reach)) continue;
    if (!fits("bonfire", x, z, B.slope)) continue;
    // The woodpile on the side away from the village.
    const fire = light(
      "bonfire",
      x,
      z,
      `B${bonfires + 1}`,
      Math.atan2(x - centre.x, z - centre.z),
      null,
    );
    if (!fire) continue;
    fires.push(fire);
    bonfires++;
  }
  return fires;
}
