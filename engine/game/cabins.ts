// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE CABINS STAND — the log buildings of a ski area, here and there
// beside its runs and, a little more often, beside its transport lanes:
// a station every `CABIN_LAYOUT.every` metres down every run, a hash of the
// map's seed, the run and the station deciding whether a GROUP stands
// there, which side, how far back from the edge and how it is turned; a
// group is one cabin, a cabin with its woodshed, or now and then a second
// cabin beside it (a hamlet). Fewer stand above the tree line.
//
// A building stands only where it belongs: on ground it can be terraced
// into (the fall across its footprint no more than its kind's plinth),
// off every run's snow, its roof clear of every trunk's crown — a cabin
// stands in a clearing or at a wood's edge, never with a spruce through its
// eaves — and clear of every lift's line and stations, the summits' ramps,
// the floodlight masts, the helicopter's pad and the parked snowmobile,
// the kickers and the cliffs, the gates, the start,
// the finish arena, the hub on the valley floor and its wind tunnels, and a
// venue's course set over the map. Its front faces the run it stands by.
//
// A REAL THING THE MAP KNOWS, not a decoration: a position, a heading, a
// footprint and a kind, kept per map and read by the drawing, the minimap
// and the collision alike (a skier meets its walls, `cabinWalls`, as he
// meets a trunk). A pure function of the map, off hashes of its seed and
// nothing else — never the stream, never the generator's order — so no
// map's digest and no run's moves for it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hubAt, nearestWithin, outsideHub } from "../mapgen/query.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { AFTERSKI } from "./defs/afterski.ts";
import { CABINS, CABIN_LAYOUT, type CabinKind } from "./defs/cabins.ts";
import { helipadOf } from "./heli-pad.ts";
import { clearOfLifts } from "./lift-line.ts";
import { pisteMasts } from "./piste-masts.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { treesNear, type Upright } from "./upright-grid.ts";

/** One building as it stands: the middle of its walls' footprint in plan,
 * the FLOOR (the plinth's top) and the lowest ground under its walls, the
 * way its front faces (heading convention), the run it stands beside and
 * where down it, and which group it is one of. Its measure is its kind's
 * (`CABINS`). */
export type Cabin = {
  id: string;
  kind: CabinKind;
  x: number;
  z: number;
  y: number;
  base: number;
  heading: number;
  run: string;
  s: number;
  group: number;
};

type Line = { id: string; road: boolean; track: { points: TrackPoint[]; length: number } };

const L = CABIN_LAYOUT;
/** How far off the hub's edge a lodge beside it is first tried, m. */
const AFTERSKI_HUB_GAP = CABIN_LAYOUT.clear.hub;

/** The spots tried at a station, in order: along the run (m), which side
 * (1 the dealt one, −1 the other) and how far back past the edge (m; −1
 * the dealt setback). */
const SEARCH: readonly (readonly [number, number, number])[] = [
  [0, 1, -1],
  [0, 1, 30],
  [20, 1, -1],
  [-20, 1, -1],
  [0, -1, -1],
  [20, 1, 30],
  [-20, 1, 30],
  [0, -1, 30],
  [35, 1, 14],
  [-35, 1, 14],
  [20, -1, 14],
  [-20, -1, 14],
  [0, 1, 45],
  [30, 1, 45],
  [-30, 1, 45],
  [0, -1, 45],
];

/** A small FNV hash of the seed, a run, a station and a salt, to 0..1. */
function pick(seed: number, id: string, k: number, salt: number): number {
  let h = 2166136261 ^ (seed >>> 0);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ k, 16777619);
  h = Math.imul(h ^ salt, 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The lines a ski area's cabins stand along: every run and lane of the
 * area, or the one piste of a map that has none. */
function linesOf(level: Level): Line[] {
  const runs = level.resort?.runs;
  if (runs && runs.length > 0) {
    return runs.map((r) => ({
      id: r.id,
      road: r.kind === "road",
      track: { points: r.points, length: r.length },
    }));
  }
  return [{ id: "piste", road: false, track: level.track }];
}

/** Whether a venue is set over the map (R31–R38): its course is then
 * `level.track`, and kept further from. */
function hasVenue(level: Level): boolean {
  return !!(
    level.slalom ||
    level.downhill ||
    level.superG ||
    level.giantSlalom ||
    level.speedSki ||
    level.skiCross ||
    level.bigAir ||
    level.slopestyle
  );
}

/** A building's corners in plan — its walls' (`pad` 0) or wider — in the
 * world, from its middle and heading: the building's x is the heading's
 * right, its z the heading. */
function rectPoints(
  kind: CabinKind,
  x: number,
  z: number,
  heading: number,
  roof: boolean,
  pad: number,
): [number, number][] {
  const d = CABINS[kind];
  const r = roof ? d.reach : { side: 0, back: 0, front: 0 };
  const x0 = -d.width / 2 - r.side - pad;
  const x1 = d.width / 2 + r.side + pad;
  const z0 = -d.depth / 2 - r.back - pad;
  const z1 = d.depth / 2 + r.front + pad;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const out: [number, number][] = [];
  for (const u of [0, 0.5, 1]) {
    for (const v of [0, 0.5, 1]) {
      const lx = x0 + (x1 - x0) * u;
      const lz = z0 + (z1 - z0) * v;
      // Right of the heading is (cos h, −sin h).
      out.push([x + lx * fz + lz * fx, z - lx * fx + lz * fz]);
    }
  }
  return out;
}

/** The radius of a building's roof, m — the circle that holds it. */
function roofRadius(kind: CabinKind): number {
  const d = CABINS[kind];
  const r = d.reach;
  return hypot(d.width / 2 + r.side, d.depth / 2 + Math.max(r.front, r.back));
}

/** Half a building's walls' longer side, m. */
function wallRadius(kind: CabinKind): number {
  return Math.max(CABINS[kind].width, CABINS[kind].depth) / 2;
}

const cache = new WeakMap<Level, Cabin[]>();

/** EVERY CABIN of `level`, worked out once. */
export function cabinsOf(level: Level): readonly Cabin[] {
  let list = cache.get(level);
  if (!list) {
    list = placeCabins(level);
    cache.set(level, list);
  }
  return list;
}

/** The heading straight down the ground's fall line at (x, z). */
function downhillOf(level: Level, x: number, z: number): number {
  const gx = level.groundAt(x + 4, z) - level.groundAt(x - 4, z);
  const gz = level.groundAt(x, z + 4) - level.groundAt(x, z - 4);
  return Math.atan2(-gx, -gz);
}

/** `from` turned toward `to` by no more than `most` radians. */
function toward(from: number, to: number, most: number): number {
  let d = to - from;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return from + Math.max(-most, Math.min(most, d));
}

function placeCabins(level: Level): Cabin[] {
  const seed = level.seed >>> 0;
  const lines = linesOf(level);
  const venue = hasVenue(level);
  const C = L.clear;
  const cabins: Cabin[] = [];
  const near: number[] = [];
  const masts = pisteMasts(level);
  const pads = level.resort ? [helipadOf(level), sledSpotOf(level)] : [];
  const lifts = level.resort?.lifts ?? [];
  const tunnels = level.resort?.tunnels ?? [];
  const hub = level.resort?.hub;
  const cps = level.checkpoints;
  const finish = cps.length > 0 ? cps[cps.length - 1] : null;
  const treeLine = level.mountain ? level.mountain.treeLine - level.mountain.altitude : Infinity;
  const base = level.mountain ? level.mountain.base.y : 0;
  const hit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
  const course = { track: level.track };

  /** Whether the building fits here, and its floor and lowest ground. */
  const fits = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    group: number,
  ): { y: number; base: number } | null => {
    const def = CABINS[kind];
    const radius = roofRadius(kind);
    const edge = radius + 40;
    if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) return null;
    // Off every run's snow, by the packed field and by every run's line.
    for (const [px, pz] of rectPoints(kind, x, z, heading, kind !== "afterski", 2)) {
      if (level.packedAt(px, pz) > 0.25) return null;
      if ((level.iceAt?.(px, pz) ?? 0) > 0) return null;
      if (!clearOfLifts(level, px, pz)) return null;
    }
    for (const line of lines) {
      nearestWithin(line, x, z, radius + 60, hit);
      if (hit.distance === Infinity) continue;
      const w = line.track.points[hit.index].width;
      if (hit.distance - w / 2 < radius + 3) return null;
    }
    nearestWithin(course, x, z, radius + 120, hit);
    if (hit.distance !== Infinity) {
      const w = level.track.points[hit.index].width;
      if (hit.distance - w / 2 < radius + (venue ? C.venue : 3)) return null;
    }
    // Clear of the ski area's furniture.
    for (const lift of lifts) {
      for (const end of [lift.bottom, lift.top]) {
        if (hypot(end.x - x, end.z - z) < C.station + radius) return null;
      }
      for (const ramp of lift.ramps ?? []) {
        const ex = ramp.to.x - ramp.from.x;
        const ez = ramp.to.z - ramp.from.z;
        const len2 = Math.max(1e-6, ex * ex + ez * ez);
        const t = Math.max(
          0,
          Math.min(1, ((x - ramp.from.x) * ex + (z - ramp.from.z) * ez) / len2),
        );
        const d = hypot(ramp.from.x + ex * t - x, ramp.from.z + ez * t - z);
        if (d < ramp.width / 2 + radius + 8) return null;
      }
    }
    for (const t of tunnels) {
      for (const q of t.points) {
        if (hypot(q.x - x, q.z - z) < t.width / 2 + C.tunnel + radius) return null;
      }
    }
    if (hub && outsideHub(hub, x, z) < C.hub + radius) return null;
    for (const m of masts) {
      if (hypot(m.x - x, m.z - z) < radius + C.mast) return null;
    }
    for (const p of pads) {
      if (hypot(p.x - x, p.z - z) < radius + C.pad) return null;
    }
    for (const k of level.kickers ?? []) {
      if (hypot(k.x - x, k.z - z) < C.kicker + radius + k.landing / 2) return null;
    }
    for (const c of level.cliffs ?? []) {
      const reach = c.width / 2 + c.face + c.landing + 15;
      if (hypot(c.x - x, c.z - z) < reach + radius) return null;
    }
    for (const cp of cps) {
      if (hypot(cp.x - x, cp.z - z) < C.gate + radius) return null;
    }
    if (hypot(level.spawn.x - x, level.spawn.z - z) < C.start + radius) return null;
    if (finish && hypot(finish.x - x, finish.z - z) < C.finish + radius) return null;
    // No other building's roof within a stride of this one's.
    // A building of its own group stands a step from its walls instead.
    for (const o of cabins) {
      const room =
        o.group === group
          ? wallRadius(o.kind) + wallRadius(kind) + 1
          : roofRadius(o.kind) + radius + C.roof;
      if (hypot(o.x - x, o.z - z) < room) return null;
    }
    // No crown over the roof: every trunk near, in the building's frame,
    // kept a share of its crown outside the roof's rectangle.
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const r = def.reach;
    for (const i of treesNear(level, x, z, radius + 12, near)) {
      const t = level.trees[i];
      const dx = t.x - x;
      const dz = t.z - z;
      const lx = dx * fz - dz * fx;
      const lz = dx * fx + dz * fz;
      const m = Math.max(t.crown * C.crown + 0.5, C.trunk);
      if (
        lx > -def.width / 2 - r.side - m &&
        lx < def.width / 2 + r.side + m &&
        lz > -def.depth / 2 - r.back - m &&
        lz < def.depth / 2 + r.front + m + C.yard
      ) {
        return null;
      }
    }
    // Terraced into the slope: the back dug in under the floor by up to
    // `plinth.cut`, the front kept `plinth.door` over the snow before it,
    // the stone showing on the downhill side no more than `plinth.most` —
    // a site that cannot have all three is left alone.
    let hi = -Infinity;
    let lo = Infinity;
    for (const [px, pz] of rectPoints(kind, x, z, heading, false, 0.3)) {
      const g = level.groundAt(px, pz);
      if (g > hi) hi = g;
      if (g < lo) lo = g;
    }
    if (hi - lo > def.terrace) return null;
    // Never dug in at the front: the porch's deck and the doorstep stand
    // clear of the snow before them.
    let front = -Infinity;
    const fx0 = Math.sin(heading);
    const fz0 = Math.cos(heading);
    const lz = def.depth / 2 + def.reach.front;
    for (const lx of [-def.width / 2, 0, def.width / 2]) {
      front = Math.max(front, level.groundAt(x + lx * fz0 + lz * fx0, z - lx * fx0 + lz * fz0));
    }
    const P = L.plinth;
    const y = Math.max(lo + P.least, hi - P.cut, front + P.door);
    if (y - lo > (def.plinth ?? P.most) + 1e-9) return null;
    return { y, base: lo };
  };

  /** Stand `kind` at (`x`, `z`) facing `heading`, if it fits. */
  const stand = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    run: string,
    s: number,
    group: number,
  ): Cabin | null => {
    const at = fits(kind, x, z, heading, group);
    if (!at) return null;
    const cabin: Cabin = {
      id: `H${cabins.length + 1}`,
      kind,
      x,
      z,
      y: at.y,
      base: at.base,
      heading,
      run,
      s,
      group,
    };
    cabins.push(cabin);
    return cabin;
  };

  const at: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  const KINDS: CabinKind[] = ["hut", "cabin", "chalet"];
  let groups = 0;
  for (const line of lines) {
    const pts = line.track.points;
    const length = line.track.length;
    for (let s = L.head, k = 0; s < length - L.tail; s += L.every, k++) {
      if (cabins.length >= L.most) break;
      let chance = line.road ? L.chance.road : L.chance.piste;
      // Read the station.
      pointAt(pts, length, s, at);
      if (at.y - base > treeLine) chance *= L.chance.high;
      if (pick(seed, line.id, k, 1) >= chance) continue;
      // Not within a group's stride of another group.
      let crowded = false;
      for (const o of cabins) {
        if (hypot(o.x - at.x, o.z - at.z) < L.apart) crowded = true;
      }
      if (crowded) continue;
      // The first building: its kind, its side, how far back and how turned.
      const u = pick(seed, line.id, k, 2);
      let acc = 0;
      let kind: CabinKind = "hut";
      for (const kk of KINDS) {
        acc += CABINS[kk].share;
        if (u < acc) {
          kind = kk;
          break;
        }
      }
      const side0 = pick(seed, line.id, k, 3) < 0.5 ? 1 : -1;
      const back0 = L.setback.min + (L.setback.max - L.setback.min) * pick(seed, line.id, k, 4);
      const turn = (pick(seed, line.id, k, 5) * 2 - 1) * L.lean;
      const def = CABINS[kind];
      // The dealt spot first, then the others the search tries in a fixed
      // order — further back, along the run, the other side — so a station
      // in the woods finds the clearing or the wood's edge beside it.
      let first: Cabin | null = null;
      for (const [ds, sideK, backK] of SEARCH) {
        const side = side0 * sideK;
        const back = backK < 0 ? back0 : backK;
        pointAt(pts, length, s + ds, at);
        // Out from the centreline to the right (side 1) or the left: right
        // of the heading is (cos h, −sin h).
        const rx = Math.cos(at.heading) * side;
        const rz = -Math.sin(at.heading) * side;
        const off = at.width / 2 + back + def.depth / 2 + def.reach.front;
        // Facing the run — back toward the line it stands beside — and
        // turned toward the fall line, as a cabin is built looking down
        // its slope with its back dug into it and its porch out over it.
        const cx = at.x + rx * off;
        const cz = at.z + rz * off;
        const heading = toward(Math.atan2(-rx, -rz), downhillOf(level, cx, cz), L.downhill) + turn;
        first = stand(kind, cx, cz, heading, line.id, s + ds, groups);
        if (first) break;
      }
      if (!first) continue;
      const heading = first.heading;
      const group = groups++;
      // Its companions, along the run beside it on the side the hash says.
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const along = pick(seed, line.id, k, 6) < 0.5 ? 1 : -1;
      // A spot beside the first building in its own frame (`lx` to its
      // right, `lz` toward its front), the side the hash says first.
      const beside = (kind2: CabinKind, spots: [number, number][], turn2: number): void => {
        for (const [lx, lz] of spots) {
          const sx = first.x + fz * lx + fx * lz;
          const sz = first.z - fx * lx + fz * lz;
          if (stand(kind2, sx, sz, heading + turn2, line.id, first.s, group)) return;
        }
      };
      if (pick(seed, line.id, k, 7) < L.companion.shed) {
        const sh = CABINS.shed;
        const gap = def.width / 2 + def.reach.side + sh.width / 2 + 1.6;
        const lz = -def.depth / 2 + sh.depth / 2 + 0.4;
        const behind = -def.depth / 2 - def.reach.back - sh.depth / 2 - sh.reach.front - 1.2;
        beside(
          "shed",
          [
            [along * gap, lz],
            [-along * gap, lz],
            [along * (def.width / 4), behind],
          ],
          along * 0.08,
        );
      }
      if (pick(seed, line.id, k, 8) < L.companion.hamlet) {
        const second: CabinKind = pick(seed, line.id, k, 9) < 0.6 ? "hut" : "cabin";
        const gap = roofRadius(kind) + roofRadius(second) + 3;
        beside(
          second,
          [
            [-along * gap, 2],
            [along * gap, 2],
            [-along * gap, -6],
          ],
          -along * 0.15,
        );
      }
    }
  }
  placeLodges(level, lines, base, (x, z, heading, run, s) => {
    const lodge = stand("afterski", x, z, heading, run, s, groups);
    if (!lodge) return null;
    groups++;
    lodge.id = `A${cabins.filter((c) => c.kind === "afterski").length}`;
    return lodge;
  });
  return cabins;
}

/** THE AFTERSKI LODGES (`AFTERSKI.lodge`), placed after every cabin so not
 * one of those moves for them: one on the valley floor beside the lowest
 * reach of a run, and — on most maps — one on a shelf part way down the
 * mountain beside a run or a lane. Each tries the stations of
 * its band in order of how well they suit it (the lowest first; the
 * nearest the band's middle), each side of the run and a few setbacks,
 * and stands at the first that fits — facing its run, turned toward the
 * fall line as a cabin is. `stand` is the placer's own. */
function placeLodges(
  level: Level,
  lines: Line[],
  base: number,
  stand: (x: number, z: number, heading: number, run: string, s: number) => Cabin | null,
): void {
  const A = AFTERSKI.lodge;
  const seed = level.seed >>> 0;
  const vertical = level.mountain ? Math.max(1, level.mountain.vertical) : 1;
  const def = CABINS.afterski;
  const at: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  type Station = { line: Line; s: number; score: number; at?: TrackPoint; side?: number };
  const runs = lines.filter((l) => !l.road);
  const pool = runs.length > 0 ? runs : lines;
  const hubLine: Line = { id: "hub", road: true, track: { points: [], length: 0 } };
  const tryAt = (list: Station[], away: Cabin | null): Cabin | null => {
    list.sort((a, b) => a.score - b.score || (a.line.id < b.line.id ? -1 : 1) || a.s - b.s);
    for (const st of list.slice(0, A.tries)) {
      if (st.at) Object.assign(at, st.at);
      else pointAt(st.line.track.points, st.line.track.length, st.s, at);
      if (away && hypot(at.x - away.x, at.z - away.z) < A.apart) continue;
      const first = pick(seed, st.line.id, Math.round(st.s), 21) < 0.5 ? 1 : -1;
      for (const side of st.side ? [st.side] : [first, -first]) {
        for (const back of A.setbacks) {
          const rx = Math.cos(at.heading) * side;
          const rz = -Math.sin(at.heading) * side;
          const off = at.width / 2 + back + def.depth / 2 + def.reach.front;
          const cx = at.x + rx * off;
          const cz = at.z + rz * off;
          const heading = toward(Math.atan2(-rx, -rz), downhillOf(level, cx, cz), A.downhill);
          const lodge = stand(cx, cz, heading, st.line.id, st.s);
          if (lodge) return lodge;
        }
      }
    }
    return null;
  };
  // THE VALLEY'S: along the hub's edge on the mountain's side, where the
  // runs come in, and the last `bottom` m of every run — the lowest first.
  const low: Station[] = [];
  const hub = level.resort?.hub;
  if (hub) {
    const x1 = hub.x0 + hub.step * (hub.top.length - 1);
    for (let x = hub.x0; x <= x1; x += A.every) {
      const edges = hubAt(hub, x);
      if (!edges) continue;
      // On the mountain's side of it, where the runs come in: a station
      // on that edge, the "run" along it, its width the hub's clearance —
      // so the lodge stands that far off the edge, facing it.
      const up = !level.mountain || level.mountain.summit.z < (edges.top + edges.bottom) / 2;
      const z = up ? edges.top : edges.bottom;
      const y = level.groundAt(x, z);
      const finish = level.mountain
        ? hypot(level.mountain.base.x - x, level.mountain.base.z - z)
        : 0;
      low.push({
        line: hubLine,
        s: x,
        score: y + finish * 0.02,
        side: 1,
        at: {
          x,
          z,
          y,
          s: x,
          heading: up ? Math.PI / 2 : -Math.PI / 2,
          width: 2 * AFTERSKI_HUB_GAP,
        },
      });
    }
  }
  for (const line of pool) {
    const len = line.track.length;
    for (let s = Math.max(0, len - A.bottom); s <= len - A.tail; s += A.every) {
      pointAt(line.track.points, len, s, at);
      low.push({ line, s, score: at.y });
    }
  }
  const valley = tryAt(low, null);
  // THE MOUNTAIN'S, on most maps: a station part way down a run or a lane,
  // the nearest the band's middle first.
  if (pick(seed, "afterski", 0, 22) >= A.midChance) return;
  const mid: Station[] = [];
  const [lo, hi] = A.band;
  for (const line of lines) {
    const len = line.track.length;
    for (let s = A.every; s <= len - A.tail; s += A.every) {
      pointAt(line.track.points, len, s, at);
      const share = (at.y - base) / vertical;
      if (share < lo || share > hi) continue;
      mid.push({ line, s, score: Math.abs(share - (lo + hi) / 2) });
    }
  }
  tryAt(mid, valley);
}

/** A line's station `s` m down it (`trackPointAt` over bare points). */
function pointAt(points: TrackPoint[], length: number, s: number, out: TrackPoint): void {
  const n = points.length;
  const u = Math.max(0, Math.min(length, s));
  let i = Math.min(n - 2, Math.max(0, Math.floor((u / Math.max(1e-6, length)) * (n - 1))));
  while (i > 0 && points[i].s > u) i--;
  while (i < n - 2 && points[i + 1].s <= u) i++;
  const a = points[i];
  const b = points[Math.min(n - 1, i + 1)];
  const t = b.s > a.s ? (u - a.s) / (b.s - a.s) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.s = u;
  out.heading = t < 0.5 ? a.heading : b.heading;
  out.width = a.width + (b.width - a.width) * t;
}

const walls = new WeakMap<Level, Upright[]>();

/**
 * EVERY CABIN'S WALLS as a skier meets them: a row of posts round each
 * footprint, set in by their radius so their outer face is the wall's, no
 * further apart than `wall.gap` — solid to a skier, his thrown body and
 * his skis as a trunk is (`posts.ts`), from the lowest ground under the
 * building to its eaves. Kept per map.
 */
export function cabinWalls(level: Level): readonly Upright[] {
  let list = walls.get(level);
  if (list) return list;
  list = [];
  const r = L.wall.radius;
  for (const c of cabinsOf(level)) {
    const d = CABINS[c.kind];
    const hx = d.width / 2 - r;
    const hz = d.depth / 2 - r;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const height = c.y - c.base + d.walls;
    const corners: [number, number][] = [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ];
    for (let e = 0; e < 4; e++) {
      const [ax, az] = corners[e];
      const [bx, bz] = corners[(e + 1) % 4];
      const len = hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / L.wall.gap));
      for (let i = 0; i < n; i++) {
        const lx = ax + ((bx - ax) * i) / n;
        const lz = az + ((bz - az) * i) / n;
        list.push({
          x: c.x + lx * fz + lz * fx,
          z: c.z - lx * fx + lz * fz,
          y: c.base,
          height,
          radius: r,
          stuff: "log",
        });
      }
    }
  }
  walls.set(level, list);
  return list;
}
