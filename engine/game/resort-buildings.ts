// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SKI AREA'S OWN BUILDINGS STAND — the village round the hub at
// the foot of the lifts, and the mountain's restaurant and patrol hut up at
// its tops (`defs/resort-buildings.ts` the kinds and their measure).
//
// THE VILLAGE stands along the hub's edge, OUTSIDE its groomed band — the
// crowd skates straight across the hub to the lifts' queues, so nothing
// may stand in it — each building facing the hub, the open snow it looks
// over at the runs coming down: the base lodge in the middle (nearest the
// village's point), the ticket office and the first aid nearest the main
// lift's bottom station, the rental and the ski school by the lodge, the
// hotels a step further back and along, the garage and the pump house off
// at the hub's far end. Each kind tries the valley's edge of the hub first
// — where a real base's buildings stand, looking up its runs over the
// plaza — then the mountain's, along the edge either way of its target and
// at a few setbacks, the nearest first, and stands at the first that fits.
//
// THE MOUNTAIN: a restaurant beside the top station of the longest chair or
// gondola, its terrace turned down the mountain to the view, on half the
// maps a second at the top of a lower one; the patrol's hut beside the
// highest top.
//
// Every building keeps off a run's snow and out of its path, out of a
// lift's line and its stations, its queue's lane and the summits' ramps,
// out of the tunnels, the hub, the pads, the gates, the start and the
// finish arena, its roof clear of every crown (`cabins.ts`'s `fits`, with
// this placer's clearances on the roof's rectangle). Placed after every
// cabin and lodge, so not one of those moves; a pure function of the map,
// off hashes of its seed — never the stream — so no digest moves either. A
// map without a ski area (one piste) has none.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hubAt } from "../mapgen/query.ts";
import type { Level } from "../mapgen/types.ts";
import type { Cabin } from "./cabins.ts";
import { downhillOf, pick } from "./cabin-site.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";
import {
  MOUNTAIN_KINDS,
  RESORT_LAYOUT as R,
  BASE_KINDS,
  VILLAGE_KINDS,
  type MountainKind,
  type ResortKind,
  type VillageKind,
} from "./defs/resort-buildings.ts";
import { liftPlans, queueLane } from "./lift-line.ts";
import { REAL_RUN, inRealYard, placeRealHouses } from "./real-houses.ts";
import { placeOnStreets, streetHit } from "./village-place.ts";
import { planVillageStreets, rememberStreets } from "./village-streets.ts";

/** What a ski area building keeps clear of (`RESORT_LAYOUT.fit`'s numbers,
 * m), the lanes the lifts' queues stand in (in the world), and whether a
 * trunk inside its walls is felled for it. */
export type Fit = {
  clear: { readonly [K in keyof typeof R.fit]: number };
  queues: readonly (readonly { x: number; z: number }[])[];
  fell: boolean;
  /** Whether its terrace may stand out over packed snow (a top's pad),
   * its walls kept off it. */
  deck: boolean;
  /** Whether its whole lot is cleared of trees (a village building on its
   * street: `village.ts`'s `felledTrees`), so no crown is asked about. */
  lot?: boolean;
  /** A point its roof may not reach (a street, an open place), when given:
   * false where it may not. */
  keep?: (x: number, z: number) => boolean;
  /** How far past its roof a building's yard is cleared of trunks, m — a
   * real house's (`real-houses.ts`), felled for it (`fellsTree`). */
  clearing?: number;
  /** A multiple on the fall its footprint may be terraced over, the stone
   * under its floor and the cut behind it — a real house's
   * (`REAL_HOUSES.steep`), stood on its real slope with a walk-out storey
   * under it. */
  steep?: number;
};

/** Stand a kind at a place facing a heading, beside a run at an arc, in a
 * group of this placer's (0 the village, then one a mountain building),
 * if it fits — `cabins.ts`'s own `stand`. */
export type StandAt = (
  kind: CabinKind,
  x: number,
  z: number,
  heading: number,
  run: string,
  s: number,
  group: number,
  fit: Fit,
) => Cabin | null;

/** Whether `kind` is one of the ski area's own buildings (the village's
 * or the mountain's) rather than a log cabin, a shed or an afterski lodge. */
export function isResortBuilding(kind: CabinKind): kind is ResortKind {
  return (VILLAGE_KINDS as readonly CabinKind[]).includes(kind) || isMountainBuilding(kind);
}

/** Whether `kind` is one of the mountain's (the restaurant, the patrol). */
export function isMountainBuilding(kind: CabinKind): kind is MountainKind {
  return (MOUNTAIN_KINDS as readonly CabinKind[]).includes(kind);
}

/** Every one of the ski area's own buildings of `cabins` (`cabinsOf`). */
export function resortBuildingsOf(cabins: readonly Cabin[]): Cabin[] {
  return cabins.filter((c) => isResortBuilding(c.kind));
}

/** The point in the world just outside a building's DOOR — the middle of
 * its front, a metre past the walls (on its terrace, its porch or its
 * apron where it has one) — and the heading out of it. Where a walker
 * comes out of it and goes in. */
export function buildingDoor(c: Cabin): { x: number; z: number; heading: number } {
  const d = CABINS[c.kind];
  const out = d.depth / 2 + 1;
  return {
    x: c.x + Math.sin(c.heading) * out,
    z: c.z + Math.cos(c.heading) * out,
    heading: c.heading,
  };
}

/** THE FRONT of a building — its terrace, porch or apron, the snow a
 * crowd stands about on before it: a rectangle in the building's frame
 * from the walls' front to `deep` m past the roof's reach, as its middle
 * in the world, its half-width across the front, its half-depth, and the
 * heading it faces. A point (u, v) of it — u right across, v out — is at
 * x = cx + u·cos h + v·sin h, z = cz − u·sin h + v·cos h. */
export function buildingFront(
  c: Cabin,
  deep = 4,
): { x: number; z: number; half: number; depth: number; heading: number } {
  const d = CABINS[c.kind];
  const depth = (d.reach.front + deep) / 2;
  const mid = d.depth / 2 + depth;
  return {
    x: c.x + Math.sin(c.heading) * mid,
    z: c.z + Math.cos(c.heading) * mid,
    half: d.width / 2 + d.reach.side,
    depth,
    heading: c.heading,
  };
}

/** Whether a tree's trunk at (x, z) stands inside the walls of one of the
 * ski area's buildings of `cabins` — its site cleared for it, so the tree
 * is not drawn (the walls keep a skier from it as they keep him from the
 * room) — or in a real house's yard (`real-houses.ts`). */
export function fellsTree(cabins: readonly Cabin[], x: number, z: number): boolean {
  for (const c of cabins) {
    if (c.run === REAL_RUN && inRealYard(c, x, z)) return true;
    if (!isResortBuilding(c.kind)) continue;
    const d = CABINS[c.kind];
    const dx = x - c.x;
    const dz = z - c.z;
    if (Math.abs(dx) > d.width + d.depth || Math.abs(dz) > d.width + d.depth) continue;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    if (insideWalls(d.width, d.depth, dx * fz - dz * fx, dx * fx + dz * fz)) return true;
  }
  return false;
}

/** Whether a point in a building's frame (`lx` across, `lz` out) is inside
 * walls `width` × `depth`, by more than a trunk's half-thickness. */
export function insideWalls(width: number, depth: number, lx: number, lz: number): boolean {
  return Math.abs(lx) < width / 2 - 0.4 && Math.abs(lz) < depth / 2 - 0.4;
}

/** Place the ski area's buildings of `level` with `stand`, after the log
 * buildings `placed` (which the village's streets keep off). */
export function placeResortBuildings(
  level: Level,
  stand: StandAt,
  placed: readonly Cabin[] = [],
): void {
  const resort = level.resort;
  if (!resort) return;
  const queues = liftPlans(level).map((p) =>
    queueLane(p).map(({ u, v }) => ({
      x: p.lift.bottom.x + p.dx * u + p.dz * v,
      z: p.lift.bottom.z + p.dz * u - p.dx * v,
    })),
  );
  // THE VILLAGE: on its streets where a loop of them fits below the hub,
  // else along the hub's edge.
  const fit: Fit = { clear: R.fit, queues, fell: true, deck: false };
  const streets = planVillageStreets(level, placed);
  rememberStreets(level, streets);
  if (streets) placeOnStreets(level, streets, stand, fit, hotelsOf(level));
  else placeVillage(level, stand, fit);
  placeMountain(level, stand, {
    clear: { ...R.fit, station: 12 },
    queues,
    fell: true,
    deck: true,
  });
  // A REAL FACE's houses, last, so nothing above moves for them.
  const hit = streets ? streetHit(streets) : null;
  placeRealHouses(level, stand, hit ? { ...fit, keep: (x, z) => !hit(x, z, 1) } : fit);
}

/** How many hotel blocks the village is dealt. */
function hotelsOf(level: Level): number {
  const seed = level.seed >>> 0;
  return (
    R.hotels.least + Math.floor(pick(seed, "village", 0, 31) * (R.hotels.most - R.hotels.least + 1))
  );
}

/** A site along the hub's edge: which edge, where along it, how far off. */
type Spot = { up: boolean; x: number; gap: number; cost: number };

function placeVillage(level: Level, stand: StandAt, fit: Fit): void {
  const resort = level.resort;
  const hub = resort?.hub;
  if (!resort || !hub) return;
  const x0 = hub.x0;
  const x1 = hub.x0 + hub.step * (hub.top.length - 1);
  const mid = hubAt(hub, (x0 + x1) / 2);
  if (!mid) return;
  // The mountain's side of the hub: its upper edge when the summit lies up
  // the map from it (the smaller z), else its lower.
  const summitZ = level.mountain?.summit.z ?? 0;
  const mountainUp = summitZ < (mid.top + mid.bottom) / 2;
  const village = resort.village;
  // The MAIN LIFT: of the lifts leaving the hub, the one whose bottom
  // station stands nearest the village.
  let main = village.x;
  let best = Infinity;
  for (const lift of resort.lifts) {
    const e = hubAt(hub, lift.bottom.x);
    if (!e || lift.bottom.z < e.top - 10 || lift.bottom.z > e.bottom + 10) continue;
    const d = hypot(lift.bottom.x - village.x, lift.bottom.z - village.z);
    if (d < best) {
      best = d;
      main = lift.bottom.x;
    }
  }
  // The end of the hub further from the village, for the service buildings
  // (the nearer end if the further has no room).
  const far = Math.abs(x1 - village.x) > Math.abs(x0 - village.x) ? x1 : x0;
  const near = far === x1 ? x0 : x1;
  const hotels = hotelsOf(level);
  let lodgeX = village.x;
  const kinds: VillageKind[] = [];
  for (const k of BASE_KINDS) {
    if (k === "hotel") for (let i = 0; i < hotels; i++) kinds.push(k);
    else kinds.push(k);
  }
  let n = 0;
  for (const kind of kinds) {
    const target =
      kind === "ticket" || kind === "firstAid"
        ? main
        : kind === "rental" || kind === "school"
          ? lodgeX
          : kind === "garage" || kind === "pumpHouse"
            ? far
            : village.x;
    const service = kind === "garage" || kind === "pumpHouse";
    const spots: Spot[] = [];
    for (const valley of [true, false]) {
      // The valley's edge first; the mountain's costs a little more.
      const up = valley ? !mountainUp : mountainUp;
      const from = service ? x0 : Math.max(x0, target - R.along);
      const to = service ? x1 : Math.min(x1, target + R.along);
      for (let x = from; x <= to; x += R.step) {
        for (const gap of R.gap) {
          const along = service
            ? Math.min(Math.abs(x - far), Math.abs(x - near) + R.along)
            : Math.abs(x - target);
          // The hotels spread along the edge and back from it, the others
          // keep as near their target and the hub as they can.
          const cost =
            kind === "hotel"
              ? along * 0.5 + gap * 1.5 + (valley ? 0 : 40)
              : along + gap * 2 + (valley ? 0 : 60);
          spots.push({ up, x, gap, cost });
        }
      }
    }
    spots.sort((a, b) => a.cost - b.cost || a.x - b.x || a.gap - b.gap);
    const def = CABINS[kind];
    for (const sp of spots) {
      const at = edgeSite(hub, sp, def.depth / 2 + def.reach.front);
      if (!at) continue;
      const c = stand(kind, at.x, at.z, at.heading, "hub", sp.x, 0, fit);
      if (!c) continue;
      c.id = `V${++n}`;
      if (kind === "restaurant") lodgeX = sp.x;
      break;
    }
  }
}

/** Where a building stands at a spot along the hub's edge: its middle
 * `gap` past the edge plus `front` (its walls' half-depth and its front's
 * reach), out square to the edge as it runs there, facing back across it. */
function edgeSite(
  hub: NonNullable<NonNullable<Level["resort"]>["hub"]>,
  sp: Spot,
  front: number,
): { x: number; z: number; heading: number } | null {
  const a = hubAt(hub, sp.x - 10);
  const b = hubAt(hub, sp.x + 10);
  const e = hubAt(hub, sp.x);
  if (!a || !b || !e) return null;
  const za = sp.up ? a.top : a.bottom;
  const zb = sp.up ? b.top : b.bottom;
  // The edge's tangent along x, and its normal out of the hub.
  const tx = 20;
  const tz = zb - za;
  const len = hypot(tx, tz);
  let nx = -tz / len;
  let nz = tx / len;
  if (sp.up ? nz > 0 : nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const z0 = sp.up ? e.top : e.bottom;
  const off = sp.gap + front;
  return { x: sp.x + nx * off, z: z0 + nz * off, heading: Math.atan2(-nx, -nz) };
}

function placeMountain(level: Level, stand: StandAt, fit: Fit): void {
  const resort = level.resort;
  if (!resort) return;
  const seed = level.seed >>> 0;
  const carried = resort.lifts
    .filter((l) => l.kind !== "drag")
    .map((l) => ({ l, len: hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z) }))
    .sort((a, b) => b.len - a.len || (a.l.id < b.l.id ? -1 : 1));
  let group = 1;
  const ring = (
    kind: MountainKind,
    cx: number,
    cz: number,
    run: string,
    near: number,
    far: number,
    salt: number,
    f: Fit,
  ): Cabin | null => {
    const turn0 = pick(seed, run, salt, 41) * 2 * Math.PI;
    const def = CABINS[kind];
    const reach = Math.max(def.width / 2 + def.reach.side, def.depth / 2 + def.reach.front);
    for (let d = near + reach * 0.5; d <= far + reach; d += 4) {
      for (let k = 0; k < 24; k++) {
        const a = turn0 + (k * 2 * Math.PI) / 24;
        const x = cx + Math.sin(a) * d;
        const z = cz + Math.cos(a) * d;
        // Turned to the view down the mountain.
        const heading = downhillOf(level, x, z);
        const c = stand(kind, x, z, heading, run, 0, group, f);
        if (c) {
          group++;
          return c;
        }
      }
    }
    return null;
  };
  let m = 0;
  // The first beside the longest lift's top that has room for it.
  let first: (typeof carried)[number] | undefined;
  for (const c of carried) {
    const hut = ring("mountainHut", c.l.top.x, c.l.top.z, c.l.id, R.hut.near, R.hut.far, 1, fit);
    if (hut) {
      hut.id = `M${++m}`;
      first = c;
      break;
    }
  }
  const top = first?.l.top;
  if (first && top) {
    // A second, on half the maps, at the top of a lower lift — the one
    // whose top stands nearest half way up the mountain.
    const mtn = level.mountain;
    if (pick(seed, "mountain", 0, 42) < R.hut.second && mtn) {
      const half = mtn.base.y + mtn.vertical / 2;
      const lower = carried
        .filter((c) => c !== first && c.l.top.y < top.y - 0.15 * mtn.vertical)
        .sort((a, b) => Math.abs(a.l.top.y - half) - Math.abs(b.l.top.y - half));
      for (const c of lower) {
        const h2 = ring("mountainHut", c.l.top.x, c.l.top.z, c.l.id, R.hut.near, R.hut.far, 2, fit);
        if (h2) {
          h2.id = `M${++m}`;
          break;
        }
      }
    }
  }
  // The patrol's hut beside the highest top — or, with no room there, the
  // next highest.
  const tops = resort.lifts
    .slice()
    .sort((a, b) => b.top.y - a.top.y || (a.id < b.id ? -1 : 1))
    .slice(0, R.patrol.tops);
  const f = { ...fit, clear: { ...fit.clear, station: 8 } };
  for (const lift of tops) {
    const p = ring("patrol", lift.top.x, lift.top.z, lift.id, R.patrol.near, R.patrol.far, 3, f);
    if (p) {
      p.id = `M${++m}`;
      break;
    }
  }
}
