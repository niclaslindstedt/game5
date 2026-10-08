// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE PEOPLE ON FOOT GATHER — the PLACES of a ski area the civilians
// (`civilian-plan.ts`) are dealt at, and the one test every foot of theirs
// is held to (`civilianClear`). Three-free, so the suite holds it.
//
// A PLACE (`Spot`) is a building's or a station's own patch of snow or
// deck: an origin and a heading (the way the place faces — out of a door,
// across a terrace, toward a load line) and a rectangle in that frame
// where a person may stand, with a POST (where a member of staff works)
// and SEATS where it has them. Every place comes out of ONE list of SOURCES
// (`SPOT_SOURCES`), one function a kind of building: the lifts' feet and
// tops, the afterski lodges' terraces and yards, the cabins' porches, the
// village's base area. A new kind of building is a source added to that
// list and nothing else — the roles name the KINDS of place they are dealt
// at (`civilian-roles.ts`), never a building.
//
// OFF THE SKIING, ALWAYS: a civilian stands and walks only on snow no
// skier is meant to be on — clear of every run, lane and course past its
// edge, the wind tunnels, every lift's line, houses, queue
// lanes and boarding rings, the helicopter's pad and the parked sled, the
// trees, the cabins' walls, the lodges' terraces (save the deck itself, for
// whoever is dealt onto it), their steps and racks — and on ground a man
// stands on. The HUB's flat on the valley floor is the base area itself —
// the village, the lifts' feet and the walk between them — so a civilian
// may cross it, held off the run and lane lines through it, its tunnels
// and its lifts' corrals as everywhere else. A post at a lift is the one exception: the lift crew stands at
// its booth beside the load line, which is the lift's own furniture.

import {
  BOARDING_RING,
  CABINS,
  CORRAL_TAIL,
  boardingRing,
  cabinsOf,
  isMountainBuilding,
  isResortBuilding,
  clearOfLifts,
  helipadOf,
  liftPlans,
  pisteGap,
  queueLane,
  sledSpotOf,
  stationHouses,
  type Cabin,
  type Level,
  type LiftPlan,
} from "@engine";

import { DECK, DECK_END, GAP, TERRACE, TERRACE_TABLES } from "./lodge-measure.ts";
import { layStations } from "./station-plan.ts";
import { wildGround } from "./wild-ground.ts";

/** The kinds of place: a lift's foot (its post the booth by the load
 * line), a lift's top (the operator's booth), the snow about a top's
 * station (the patrol's), the base area about a lift's foot and the
 * village, an afterski lodge's terrace (a deck) and the yard before it,
 * and a cabin's porch. */
export type SpotKind = "liftFoot" | "liftTop" | "summit" | "base" | "terrace" | "yard" | "porch";

/** A seat in the world: where the sitter's hips are over the floor, the way
 * he faces, and the seat's height over the floor, m. */
export type Seat = { x: number; z: number; heading: number; height: number };

/** A rectangle in a place's frame, m: `x` to the right of its heading, `z`
 * along it. */
export type Rect = { x0: number; x1: number; z0: number; z1: number };

export type Spot = {
  id: string;
  kind: SpotKind;
  /** The origin and the way the place faces. */
  x: number;
  z: number;
  heading: number;
  /** Where people may stand, in the place's frame. */
  area: Rect;
  /** The floor's height when the place is a built deck; absent on snow. */
  deck?: number;
  /** The furniture on a deck a person keeps out of, in the place's frame. */
  keepOut: readonly Rect[];
  /** Where a member of staff works, in the world, and the way he faces. */
  post?: { x: number; z: number; heading: number };
  seats: readonly Seat[];
  /** The building or lift the place belongs to. */
  of: string;
};

/** What a person keeps clear of, m: a run's edge, a wind
 * tunnel's edge, a station house's walls, a queue lane's middle, a
 * boarding ring's rim, the helicopter's pad and the parked sled, a trunk, a
 * cabin's walls (and a lodge's terrace, steps and racks); the map's rim;
 * the steepest ground he stands or walks on (rise over run). */
export const CIVILIAN_CLEAR = {
  piste: 2.5,
  tunnel: 3,
  house: 1.2,
  lane: 3,
  ring: 1.5,
  pad: 14,
  sled: 4,
  trunk: 1.1,
  wall: 0.7,
  rim: 12,
  slope: 0.42,
} as const;

/** A point (`lx` right of `heading`, `lz` along it) of a frame at (`x`, `z`)
 * in the world. */
export function frameAt(
  x: number,
  z: number,
  heading: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return { x: x + lx * fz + lz * fx, z: z - lx * fx + lz * fz };
}

/** A world point in a frame at (`x`, `z`) facing `heading`. */
function intoFrame(
  x: number,
  z: number,
  heading: number,
  wx: number,
  wz: number,
): { lx: number; lz: number } {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const dx = wx - x;
  const dz = wz - z;
  return { lx: dx * fz - dz * fx, lz: dx * fx + dz * fz };
}

const inRect = (r: Rect, lx: number, lz: number, pad = 0): boolean =>
  lx > r.x0 - pad && lx < r.x1 + pad && lz > r.z0 - pad && lz < r.z1 + pad;

/** Distance from (x, z) to the segment a–b, m. */
function toSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const ex = bx - ax;
  const ez = bz - az;
  const len2 = ex * ex + ez * ez;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2)) : 0;
  return Math.hypot(ax + ex * t - x, az + ez * t - z);
}

/** What a map's furniture is to the clearance test, worked out once. */
type Obstacles = {
  houses: { x: number; z: number; dx: number; dz: number; hl: number; hw: number }[];
  lanes: { ax: number; az: number; bx: number; bz: number }[];
  rings: { x: number; z: number }[];
  pads: { x: number; z: number; r: number }[];
  cabins: readonly Cabin[];
};

const obstacles = new WeakMap<Level, Obstacles>();

function obstaclesOf(level: Level): Obstacles {
  const hit = obstacles.get(level);
  if (hit) return hit;
  const plans = liftPlans(level);
  const houses: Obstacles["houses"] = [];
  const lanes: Obstacles["lanes"] = [];
  const rings: Obstacles["rings"] = [];
  for (const p of plans) {
    for (const h of stationHouses(level, p)) {
      houses.push({ x: h.x, z: h.z, dx: p.dx, dz: p.dz, hl: h.halfLength, hw: h.halfWidth });
    }
    const world = (u: number, v: number) => ({
      x: p.lift.bottom.x + p.dx * u + p.dz * v,
      z: p.lift.bottom.z + p.dz * u - p.dx * v,
    });
    const lane = queueLane(p);
    for (let k = 0; k + 1 < lane.length; k++) {
      const a = world(lane[k].u, lane[k].v);
      const b = world(lane[k + 1].u, lane[k + 1].v);
      lanes.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
    }
    rings.push(boardingRing(p));
  }
  const pads: Obstacles["pads"] = [];
  if (level.resort) {
    const heli = helipadOf(level);
    const sled = sledSpotOf(level);
    pads.push({ x: heli.x, z: heli.z, r: CIVILIAN_CLEAR.pad });
    pads.push({ x: sled.x, z: sled.z, r: CIVILIAN_CLEAR.sled });
  }
  const out: Obstacles = { houses, lanes, rings, pads, cabins: cabinsOf(level) };
  obstacles.set(level, out);
  return out;
}

/** Whether (x, z) is inside a cabin's walls — or an afterski lodge's
 * terrace, steps or racks — with `pad` m to spare. */
function inBuilding(level: Level, x: number, z: number, pad: number): boolean {
  for (const c of obstaclesOf(level).cabins) {
    const d = CABINS[c.kind];
    const reach = Math.max(d.width, d.depth) / 2 + d.reach.front + 6;
    if (Math.abs(c.x - x) > reach || Math.abs(c.z - z) > reach) continue;
    const { lx, lz } = intoFrame(c.x, c.z, c.heading, x, z);
    if (Math.abs(lx) < d.width / 2 + pad && Math.abs(lz) < d.depth / 2 + pad) return true;
    // The ski area's own: its terrace, apron or porch and what stands on it
    // (the tables, the racks, the deck chairs) as well.
    if (isResortBuilding(c.kind)) {
      if (
        Math.abs(lx) < d.width / 2 + d.reach.side + pad &&
        lz > 0 &&
        lz < d.depth / 2 + d.reach.front + pad
      )
        return true;
    }
    if (c.kind === "afterski") {
      const front = d.depth / 2 + TERRACE;
      // The deck, and the racks and steps on the snow before it.
      if (Math.abs(lx) < d.width / 2 + DECK_END + pad && lz > 0 && lz < front + pad) return true;
      if (Math.abs(lx) < GAP + pad && lz < front + 1.6) return true;
      if (Math.abs(lx) < 6.6 + pad && lz < front + 1.5 + pad) return true;
    }
  }
  return false;
}

/**
 * WHETHER A CIVILIAN MAY STAND AT (x, z) on the snow: off every run, lane
 * and course past its edge and every other piece of the ski area a skier
 * or a lift uses, clear of the trees and the buildings, on the map and on
 * ground a man stands on. `post`: a member of the lift crew at his booth,
 * who stands inside the lift's own clearance and beside its load line.
 * `spare`: metres more kept from everything — a line checked every
 * `2 × spare` m is then clear between its samples too, every clearance
 * here being a distance.
 */
export function civilianClear(
  level: Level,
  x: number,
  z: number,
  post = false,
  spare = 0,
): boolean {
  const C = CIVILIAN_CLEAR;
  const ground = wildGround(level);
  if (!ground.inside(x, z, C.rim)) return false;
  if (ground.onIce(x, z)) return false;
  if (ground.nearestTree(x, z, C.trunk + spare)) return false;
  if (inBuilding(level, x, z, C.wall + spare)) return false;
  const o = obstaclesOf(level);
  const house = C.house + spare;
  for (const h of o.houses) {
    const u = (x - h.x) * h.dx + (z - h.z) * h.dz;
    const v = (x - h.x) * h.dz - (z - h.z) * h.dx;
    if (Math.abs(u) < h.hl + house && Math.abs(v) < h.hw + house) return false;
  }
  for (const p of o.pads) if (Math.hypot(p.x - x, p.z - z) < p.r + spare) return false;
  if (post) return true;
  if (ground.slope(x, z) > C.slope) return false;
  if (pisteGap(level, x, z, 40) < C.piste + spare) return false;
  for (const t of level.resort?.tunnels ?? []) {
    const m = t.width / 2 + C.tunnel + spare;
    for (const q of t.points) if (Math.hypot(q.x - x, q.z - z) < m) return false;
  }
  if (!clearOfLifts(level, x, z)) return false;
  // The lifts' clearance is a box, not a distance: the spare kept round it
  // as eight points on a ring.
  if (spare > 0) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (!clearOfLifts(level, x + Math.sin(a) * spare, z + Math.cos(a) * spare)) return false;
    }
  }
  const lane = C.lane + spare;
  for (const l of o.lanes) if (toSegment(x, z, l.ax, l.az, l.bx, l.bz) < lane) return false;
  const ring = BOARDING_RING.radius + CORRAL_TAIL / 2 + C.ring + spare;
  for (const r of o.rings) if (Math.hypot(r.x - x, r.z - z) < ring) return false;
  return true;
}

/** Whether (x, z) lies past the HUB's valley-side edge (R29) — off the
 * base, down toward the valley. The base's rounds keep to its mountain
 * side; what lies below it is the valley's own. False off the hub's
 * reach across, or on a map with none. */
export function pastHub(level: Level, x: number, z: number): boolean {
  const hub = level.resort?.hub;
  if (!hub || hub.bottom.length === 0) return false;
  const i = Math.round((x - hub.x0) / hub.step);
  if (i < 0 || i >= hub.bottom.length) return false;
  const down = Math.sign(hub.bottom[i] - hub.top[i]);
  return (z - hub.bottom[i]) * down > 0;
}

/** Whether a point of `spot`'s frame is a place to stand: on a deck, on it
 * and out of its furniture; on the snow, `civilianClear`. */
export function standable(level: Level, spot: Spot, lx: number, lz: number): boolean {
  if (spot.deck !== undefined) {
    if (!inRect(spot.area, lx, lz)) return false;
    for (const k of spot.keepOut) if (inRect(k, lx, lz, 0.3)) return false;
    return true;
  }
  const p = frameAt(spot.x, spot.z, spot.heading, lx, lz);
  return civilianClear(level, p.x, p.z);
}

// --- THE SOURCES ----------------------------------------------------------

/** THE BASE AREA's places: how many patches of open snow about a lift's
 * foot station and about the village, and how far apart the village's
 * are, m. At peak hours a real base is a crossroads of people on foot —
 * the more places, the more of them standing about and walking between. */
export const BASE_PLACES = { lift: 3, village: 5, apart: 32 } as const;

/** Candidate patches about a box (a station house): `gap` m off each of its
 * four sides, each a rectangle `w` × `d` facing out from the box — kept
 * only where its middle and its corners are clear. */
function aboutBox(
  level: Level,
  box: { x: number; z: number; dx: number; dz: number; hl: number; hw: number },
  gap: number,
  w: number,
  d: number,
): { x: number; z: number; heading: number; area: Rect }[] {
  const out: { x: number; z: number; heading: number; area: Rect }[] = [];
  const up = Math.atan2(box.dx, box.dz);
  const sides: [number, number, number][] = [
    [box.hl + gap + d / 2, 0, up],
    [-(box.hl + gap + d / 2), 0, up + Math.PI],
    [0, box.hw + gap + d / 2, up + Math.PI / 2],
    [0, -(box.hw + gap + d / 2), up - Math.PI / 2],
  ];
  for (const [u, v, heading] of sides) {
    const x = box.x + box.dx * u + box.dz * v;
    const z = box.z + box.dz * u - box.dx * v;
    const area: Rect = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 };
    let ok = true;
    for (const [lx, lz] of [
      [0, 0],
      [area.x0, area.z0],
      [area.x1, area.z0],
      [area.x0, area.z1],
      [area.x1, area.z1],
    ]) {
      const p = frameAt(x, z, heading, lx, lz);
      if (!civilianClear(level, p.x, p.z)) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ x, z, heading, area });
  }
  return out;
}

const houseBox = (level: Level, p: LiftPlan, i: 0 | 1) => {
  const h = stationHouses(level, p)[i];
  return { x: h.x, z: h.z, dx: p.dx, dz: p.dz, hl: h.halfLength, hw: h.halfWidth };
};

/** The booth (or a gondola's door, a drag's hut) nearest an end of a lift. */
function boothNear(
  booths: readonly { kind: string; x: number; z: number; yaw: number }[],
  at: { x: number; z: number },
): { x: number; z: number; yaw: number; kind: string } | null {
  let best: { x: number; z: number; yaw: number; kind: string } | null = null;
  let bestD = 45;
  for (const b of booths) {
    const d = Math.hypot(b.x - at.x, b.z - at.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** THE LIFTS: at every foot the crew's post by its booth (a gondola's at
 * its door, a drag's at its hut) and the base area about its station
 * house; at a chair's or a gondola's top the operator's booth and the
 * snow about the top station. */
function liftSpots(level: Level): Spot[] {
  const plans = liftPlans(level);
  const parts = layStations(level, plans).parts.filter(
    (p) => p.kind === "booth" || p.kind === "door" || p.kind === "hut",
  );
  const out: Spot[] = [];
  const tiny: Rect = { x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5 };
  for (const p of plans) {
    const id = p.lift.id;
    const foot = boothNear(parts, p.lift.bottom);
    if (foot) {
      // Out in front of the booth's window (a door's side), facing the line.
      const ahead = foot.kind === "door" ? 1.4 : 1.3;
      const aside = foot.kind === "door" ? 2 : 0;
      const at = frameAt(foot.x, foot.z, foot.yaw, aside, ahead);
      out.push({
        id: `${id}-foot`,
        kind: "liftFoot",
        x: at.x,
        z: at.z,
        heading: foot.yaw,
        area: tiny,
        keepOut: [],
        post: { x: at.x, z: at.z, heading: foot.yaw },
        seats: [],
        of: id,
      });
    }
    [4, 10, 18]
      .flatMap((gap) => aboutBox(level, houseBox(level, p, 0), gap, 9, 6))
      .filter((b, k, all) => all.findIndex((o) => Math.hypot(o.x - b.x, o.z - b.z) < 12) === k)
      .slice(0, BASE_PLACES.lift)
      .forEach((b, k) =>
        out.push({ id: `${id}-base${k}`, kind: "base", ...b, keepOut: [], seats: [], of: id }),
      );
    if (p.lift.kind === "drag") continue;
    const top = boothNear(parts, p.lift.top);
    if (top && top.kind === "booth") {
      const at = frameAt(top.x, top.z, top.yaw, 0, 1.3);
      out.push({
        id: `${id}-top`,
        kind: "liftTop",
        x: at.x,
        z: at.z,
        heading: top.yaw,
        area: tiny,
        keepOut: [],
        post: { x: at.x, z: at.z, heading: top.yaw },
        seats: [],
        of: id,
      });
    }
    const summit = aboutBox(level, houseBox(level, p, 1), 3, 6, 4)[0];
    if (summit) {
      out.push({ id: `${id}-summit`, kind: "summit", ...summit, keepOut: [], seats: [], of: id });
    }
  }
  return out;
}

/** THE AFTERSKI LODGES: the terrace (its deck, its tables kept out of and
 * their benches the seats) and the yard of snow before it, past the racks. */
function lodgeSpots(level: Level): Spot[] {
  const out: Spot[] = [];
  const d = CABINS.afterski;
  const T = TERRACE_TABLES;
  for (const c of cabinsOf(level)) {
    if (c.kind !== "afterski") continue;
    const z0 = d.depth / 2;
    const front = z0 + TERRACE;
    const seats: Seat[] = [];
    const keepOut: Rect[] = [];
    for (const tx of T.x) {
      for (const tz of T.z) {
        keepOut.push({
          x0: tx - T.half,
          x1: tx + T.half,
          z0: z0 + tz - T.bench,
          z1: z0 + tz + T.bench,
        });
        for (const side of [-1, 1]) {
          for (const dx of [-0.5, 0.5]) {
            const at = frameAt(c.x, c.z, c.heading, tx + dx, z0 + tz + side * T.bench);
            // A bench by the wall faces out, the other back in.
            seats.push({
              x: at.x,
              z: at.z,
              heading: c.heading + (side < 0 ? 0 : Math.PI),
              height: T.seat,
            });
          }
        }
      }
    }
    out.push({
      id: `${c.id}-terrace`,
      kind: "terrace",
      x: c.x,
      z: c.z,
      heading: c.heading,
      area: {
        x0: -(d.width / 2 + DECK_END - 0.4),
        x1: d.width / 2 + DECK_END - 0.4,
        z0: z0 + 0.4,
        z1: front - 0.4,
      },
      deck: c.y + DECK.top,
      keepOut,
      seats,
      of: c.id,
    });
    out.push({
      id: `${c.id}-yard`,
      kind: "yard",
      x: c.x,
      z: c.z,
      heading: c.heading,
      area: { x0: -d.width / 2 - 1, x1: d.width / 2 + 1, z0: front + 2.2, z1: front + 4.4 },
      keepOut: [],
      seats: [],
      of: c.id,
    });
  }
  return out;
}

/** THE CABINS: the open snow before a hut's, a cabin's or a chalet's porch
 * (the yard the placer keeps clear, `CABIN_LAYOUT.clear.yard`) — and before
 * each of the ski area's own buildings (`isResortBuilding`), past its
 * terrace, apron or porch: the village's a place of the base area, the
 * mountain's a yard. */
function cabinSpots(level: Level): Spot[] {
  const out: Spot[] = [];
  for (const c of cabinsOf(level)) {
    if (c.kind === "afterski" || c.kind === "shed") continue;
    const d = CABINS[c.kind];
    const z0 = d.depth / 2 + d.reach.front + 0.8;
    const own = isResortBuilding(c.kind);
    out.push({
      id: `${c.id}-${own ? "front" : "porch"}`,
      kind: own ? (isMountainBuilding(c.kind) ? "yard" : "base") : "porch",
      x: c.x,
      z: c.z,
      heading: c.heading,
      area: { x0: -d.width / 2, x1: d.width / 2, z0, z1: z0 + 3 },
      keepOut: [],
      seats: [],
      of: c.id,
    });
  }
  return out;
}

/** THE VILLAGE'S BASE AREA: open snow about the village point on the
 * valley floor, where the walks to the lifts start. */
function villageSpots(level: Level): Spot[] {
  const v = level.resort?.village;
  if (!v) return [];
  const out: Spot[] = [];
  for (let k = 0; k < 12 && out.length < BASE_PLACES.village; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (const r of [20, 35, 50, 70, 95, 120]) {
      const box = {
        x: v.x + Math.sin(a) * r,
        z: v.z + Math.cos(a) * r,
        dx: 0,
        dz: 1,
        hl: 0,
        hw: 0,
      };
      const hit = aboutBox(level, box, 0, 8, 6)[0];
      if (!hit) continue;
      if (out.some((o) => Math.hypot(o.x - hit.x, o.z - hit.z) < BASE_PLACES.apart)) continue;
      out.push({
        id: `village${out.length}`,
        kind: "base",
        ...hit,
        keepOut: [],
        seats: [],
        of: "village",
      });
      break;
    }
  }
  return out;
}

/** EVERY SOURCE OF PLACES, in the order they are dealt. A new kind of
 * building adds its function here. */
export const SPOT_SOURCES: readonly ((level: Level) => Spot[])[] = [
  liftSpots,
  lodgeSpots,
  cabinSpots,
  villageSpots,
];

const spots = new WeakMap<Level, readonly Spot[]>();

/** Every place of `level`, found once. */
export function spotsOf(level: Level): readonly Spot[] {
  let hit = spots.get(level);
  if (!hit) {
    hit = SPOT_SOURCES.flatMap((source) => source(level));
    spots.set(level, hit);
  }
  return hit;
}
