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
// and the collision alike (a skier meets its walls — `building-walls.ts`). A pure function of the map, off hashes of its seed and
// nothing else — never the stream, never the generator's order — so no
// map's digest and no run's moves for it.

import { inWater } from "../mapgen/real-water.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hubAt, nearestWithin, outsideHub } from "../mapgen/query.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { AFTERSKI } from "./defs/afterski.ts";
import { CABINS, CABIN_LAYOUT, type CabinKind } from "./defs/cabins.ts";
import { helipadOf } from "./heli-pad.ts";
import { clearOfLifts } from "./lift-line.ts";
import { pisteMasts } from "./piste-masts.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { treesNear } from "./upright-grid.ts";
import {
  downhillOf,
  groomedAt,
  liftsNear,
  pick,
  pointAt,
  rectPoints,
  roofRadius,
  roofReach,
  roofsMeet,
  toSegment,
  toward,
  wallRadius,
  type Line,
} from "./cabin-site.ts";
import { insideWalls, placeResortBuildings, type Fit } from "./resort-buildings.ts";

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

const L = CABIN_LAYOUT;
/** The cell the buildings stood so far are kept on, m. */
const GRID = 32;
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
  // The groomer's snow a building keeps off (on a real face, not the
  // fell's wind crust folded into the packed field).
  const groomed = groomedAt(level);
  // The widest each line runs, m, so a building far from a line skips it
  // (`clearOnPlan`); and the buildings stood so far on a grid of their
  // middles, so a roof is held against its neighbours only.
  const widest = lines.map((l) => l.track.points.reduce((w, p) => Math.max(w, p.width), 0));
  const courseWidest = level.track.points.reduce((w, p) => Math.max(w, p.width), 0);
  const grid = new Map<number, Cabin[]>();
  const cellOf = (x: number, z: number): number =>
    Math.floor(x / GRID) * 65536 + Math.floor(z / GRID);
  let reachMost = 0;

  /** Whether the building fits here, and its floor and lowest ground —
   * judged as a cabin is, or with a `fit` on its roof's rectangle and that
   * fit's clearances (the ski area's own buildings, `resort-buildings.ts`). */
  const fits = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    group: number,
    fit?: Fit,
  ): { y: number; base: number } | null => {
    const radius = roofRadius(kind);
    const edge = radius + 40;
    if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) return null;
    // Off every run's snow, by the packed field and by every run's line.
    // (An afterski lodge's terrace, and a mountain building's on its `fit`,
    // may stand out over packed snow; its walls may not.)
    const deck = kind === "afterski" || !!fit?.deck;
    // Only the lifts near enough to matter (`liftsNear`); a roof's whole
    // rectangle, grown by the 2 m pad, lies within its radius and 3 m.
    const near = liftsNear(level, x, z, radius + 3);
    for (const [px, pz] of rectPoints(kind, x, z, heading, !deck, 2, 3)) {
      if (groomed(px, pz)) return null;
      if ((level.iceAt?.(px, pz) ?? 0) > 0) return null;
      if (inWater(level.water, px, pz)) return null;
      if (near.length > 0 && !clearOfLifts(level, px, pz, near)) return null;
    }
    // A building judged on its rectangle is held off its neighbours'
    // roofs and settled first: those are cheaper to ask than every point
    // of it against everything else.
    if (fit && roofsNear(kind, x, z, heading, fit.clear.roof)) return null;
    const settled = fit ? settle(kind, x, z, heading, radius, fit) : null;
    if (fit && !settled) return null;
    if (fit ? !clearOnPlan(kind, x, z, heading, fit) : !clearRound(x, z, radius)) {
      return null;
    }
    for (const k of level.kickers ?? []) {
      if (hypot(k.x - x, k.z - z) < C.kicker + radius + k.landing / 2) return null;
    }
    for (const c of level.cliffs ?? []) {
      const reach = c.width / 2 + c.face + c.landing + 15;
      if (hypot(c.x - x, c.z - z) < reach + radius) return null;
    }
    // No other building's roof within a stride of this one's.
    // A building of its own group stands a step from its walls instead.
    for (const o of fit ? [] : cabins) {
      const room =
        o.group === group
          ? wallRadius(o.kind) + wallRadius(kind) + 1
          : roofRadius(o.kind) + radius + C.roof;
      if (hypot(o.x - x, o.z - z) < room) return null;
    }
    return settled ?? settle(kind, x, z, heading, radius, fit);
  };

  /** Whether a building's roof (grown by `gap`) meets one stood already. */
  const roofsNear = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    gap: number,
  ): boolean => {
    const r = roofReach(kind, gap) + reachMost + gap;
    const placed = { kind, x, z, heading };
    for (let i = Math.floor((x - r) / GRID); i <= Math.floor((x + r) / GRID); i++) {
      for (let j = Math.floor((z - r) / GRID); j <= Math.floor((z + r) / GRID); j++) {
        for (const o of grid.get(i * 65536 + j) ?? []) {
          if (hypot(o.x - x, o.z - z) > r) continue;
          if (roofsMeet(o, placed, gap)) return true;
        }
      }
    }
    return false;
  };

  /** A cabin's clearances, on the circle round its roof: the runs and the
   * course, the ski area's furniture, the gates, the start and the finish. */
  const clearRound = (x: number, z: number, radius: number): boolean => {
    for (const line of lines) {
      nearestWithin(line, x, z, radius + 60, hit);
      if (hit.distance === Infinity) continue;
      const w = line.track.points[hit.index].width;
      if (hit.distance - w / 2 < radius + 3) return false;
    }
    nearestWithin(course, x, z, radius + 120, hit);
    if (hit.distance !== Infinity) {
      const w = level.track.points[hit.index].width;
      if (hit.distance - w / 2 < radius + (venue ? C.venue : 3)) return false;
    }
    // Clear of the ski area's furniture.
    for (const lift of lifts) {
      for (const end of [lift.bottom, lift.top]) {
        if (hypot(end.x - x, end.z - z) < C.station + radius) return false;
      }
      for (const ramp of lift.ramps ?? []) {
        const d = toSegment(x, z, ramp.from.x, ramp.from.z, ramp.to.x, ramp.to.z);
        if (d < ramp.width / 2 + radius + 8) return false;
      }
    }
    for (const t of tunnels) {
      for (const q of t.points) {
        if (hypot(q.x - x, q.z - z) < t.width / 2 + C.tunnel + radius) return false;
      }
    }
    if (hub && outsideHub(hub, x, z) < C.hub + radius) return false;
    for (const m of masts) {
      if (hypot(m.x - x, m.z - z) < radius + C.mast) return false;
    }
    for (const p of pads) {
      if (hypot(p.x - x, p.z - z) < radius + C.pad) return false;
    }
    for (const cp of cps) {
      if (hypot(cp.x - x, cp.z - z) < C.gate + radius) return false;
    }
    if (hypot(level.spawn.x - x, level.spawn.z - z) < C.start + radius) return false;
    if (finish && hypot(finish.x - x, finish.z - z) < C.finish + radius) return false;
    return true;
  };

  /** A ski area building's clearances, on its roof's rectangle (every
   * point of it, a few metres apart): the runs and the course past their
   * edges, every lift's stations and the lane its queue stands in, the
   * summits' ramps, the wind tunnels, the hub, the masts, the pads, the
   * gates, the start and the finish arena. */
  const clearOnPlan = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    fit: Fit,
  ): boolean => {
    const F = fit.clear;
    const pts = rectPoints(kind, x, z, heading, true, 0, 4);
    // The lines that pass near enough to matter: one further from the
    // middle than the roof's reach, the clearance and its own half-width
    // is clear of every point of the roof.
    let far = 0;
    for (const [px, pz] of pts) far = Math.max(far, hypot(px - x, pz - z));
    const near: Line[] = [];
    for (let k = 0; k < lines.length; k++) {
      nearestWithin(lines[k], x, z, far + F.line + widest[k] / 2 + 1, hit);
      if (hit.distance !== Infinity) near.push(lines[k]);
    }
    nearestWithin(course, x, z, far + Math.max(F.line, C.venue) + courseWidest / 2 + 1, hit);
    const nearCourse = hit.distance !== Infinity;
    // And so the lifts, queues, masts and gates: one a point of the roof
    // could come within its clearance of lies that and `far` from the middle.
    const by = (d: number, c: number): boolean => d < c + far + 1;
    const nearLifts = lifts.filter(
      (l) =>
        by(hypot(l.bottom.x - x, l.bottom.z - z), F.station) ||
        by(hypot(l.top.x - x, l.top.z - z), F.station) ||
        (l.ramps ?? []).some((r) =>
          by(toSegment(x, z, r.from.x, r.from.z, r.to.x, r.to.z), r.width / 2 + F.ramp),
        ),
    );
    const nearQueues = fit.queues.filter((q) =>
      q.some(
        (a, i) =>
          i + 1 < q.length && by(toSegment(x, z, a.x, a.z, q[i + 1].x, q[i + 1].z), F.queue),
      ),
    );
    const nearMasts = masts.filter((m) => by(hypot(m.x - x, m.z - z), C.mast));
    const nearGates = cps.filter((cp) => by(hypot(cp.x - x, cp.z - z), F.gate));
    for (const [px, pz] of pts) {
      if (fit.keep && !fit.keep(px, pz)) return false;
      for (const line of near) {
        nearestWithin(line, px, pz, F.line + 40, hit);
        if (hit.distance === Infinity) continue;
        if (hit.distance - line.track.points[hit.index].width / 2 < F.line) return false;
      }
      if (nearCourse) nearestWithin(course, px, pz, F.line + 60, hit);
      if (nearCourse && hit.distance !== Infinity) {
        const w = level.track.points[hit.index].width;
        if (hit.distance - w / 2 < (venue ? C.venue : F.line)) return false;
      }
      for (const lift of nearLifts) {
        for (const end of [lift.bottom, lift.top]) {
          if (hypot(end.x - px, end.z - pz) < F.station) return false;
        }
        for (const ramp of lift.ramps ?? []) {
          const d = toSegment(px, pz, ramp.from.x, ramp.from.z, ramp.to.x, ramp.to.z);
          if (d < ramp.width / 2 + F.ramp) return false;
        }
      }
      for (const q of nearQueues) {
        for (let i = 0; i + 1 < q.length; i++) {
          if (toSegment(px, pz, q[i].x, q[i].z, q[i + 1].x, q[i + 1].z) < F.queue) return false;
        }
      }
      for (const t of tunnels) {
        const a = t.points[0];
        const b = t.points[t.points.length - 1];
        if (toSegment(px, pz, a.x, a.z, b.x, b.z) < t.width / 2 + F.tunnel) return false;
      }
      if (hub && outsideHub(hub, px, pz) < F.hub) return false;
      for (const m of nearMasts) {
        if (hypot(m.x - px, m.z - pz) < C.mast) return false;
      }
      for (const p of pads) {
        if (hypot(p.x - px, p.z - pz) < F.pad) return false;
      }
      for (const cp of nearGates) {
        if (hypot(cp.x - px, cp.z - pz) < F.gate) return false;
      }
      if (hypot(level.spawn.x - px, level.spawn.z - pz) < F.start) return false;
      if (finish && hypot(finish.x - px, finish.z - pz) < F.finish) return false;
    }
    return true;
  };

  /** No crown over the roof, and the floor terraced into the ground: the
   * floor and the lowest ground under the walls, or null. */
  const settle = (
    kind: CabinKind,
    x: number,
    z: number,
    heading: number,
    radius: number,
    fit?: Fit,
  ): { y: number; base: number } | null => {
    const def = CABINS[kind];
    // No crown over the roof: every trunk near, in the building's frame,
    // kept a share of its crown outside the roof's rectangle — but for a
    // trunk inside the walls of a building whose site is cleared for it
    // (`fit.fell`), felled for it.
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const r = def.reach;
    for (const i of fit?.lot ? [] : treesNear(level, x, z, radius + 12, near)) {
      const t = level.trees[i];
      const dx = t.x - x;
      const dz = t.z - z;
      const lx = dx * fz - dz * fx;
      const lz = dx * fx + dz * fz;
      if (fit?.fell && insideWalls(def.width, def.depth, lx, lz)) continue;
      // A yard cleared round the roof (a real house's) fells what stands in it.
      const c = fit?.clearing;
      if (
        c !== undefined &&
        Math.abs(lx) < def.width / 2 + r.side + c &&
        lz > -def.depth / 2 - r.back - c &&
        lz < def.depth / 2 + r.front + c
      ) {
        continue;
      }
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
    // A real house on its real slope (`fit.steep`) stands a walk-out
    // storey of stone under its floor, as a chalet built into a hill does.
    const steep = fit?.steep ?? 1;
    if (hi - lo > def.terrace * steep) return null;
    // Never dug in at the front: the porch's deck and the doorstep stand
    // clear of the snow before them.
    let front = -Infinity;
    const lz = def.depth / 2 + def.reach.front;
    for (const lx of [-def.width / 2, 0, def.width / 2]) {
      front = Math.max(front, level.groundAt(x + lx * fz + lz * fx, z - lx * fx + lz * fz));
    }
    const P = L.plinth;
    const y = Math.max(lo + P.least, hi - (def.cut ?? P.cut) * steep, front + P.door);
    if (y - lo > (def.plinth ?? P.most) * steep + 1e-9) return null;
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
    fit?: Fit,
  ): Cabin | null => {
    const at = fits(kind, x, z, heading, group, fit);
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
    const cell = cellOf(x, z);
    const list = grid.get(cell);
    if (list) list.push(cabin);
    else grid.set(cell, [cabin]);
    reachMost = Math.max(reachMost, roofReach(kind, 0));
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
  // The ski area's own buildings, after every cabin and lodge so not one
  // of those moves for them.
  placeResortBuildings(
    level,
    (kind, x, z, heading, run, s, group, fit) =>
      stand(kind, x, z, heading, run, s, groups + group, fit),
    cabins.slice(),
  );
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
