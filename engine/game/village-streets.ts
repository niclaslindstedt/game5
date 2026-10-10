// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS — where a ski area's village lays its streets on
// the valley floor below the hub, as one compact network the village's
// buildings line (`village-place.ts`) and the street's furniture is set
// out along (`village-furniture.ts`): the numbers are
// `defs/village-streets.ts`'s, the research `docs/buildings.md`'s.
//
// THE PLAN, as a real base village is laid out below its lifts:
//   * THE MAIN STREET runs along the hub's valley edge a row of buildings
//     back from it — the base's own buildings between it and the snow,
//     facing the runs, and the shops facing it from the other side —
//     bowed a little off straight, as a street that follows its ground is.
//   * THE BACK STREET runs behind it, the houses either side of it.
//   * CROSS STREETS join the two, at both ends and once or twice between,
//     so the four make a LOOP traffic can circulate on (right-hand: a
//     lane each way, on the right of the street's way).
//   * THE ROAD OUT leaves the back street at one end of the village (on
//     half the maps at both) and runs down the valley off the map's edge,
//     so traffic comes and goes.
//   * THE SQUARE stands on the main street's hub side at the main lift — the
//     walk from the street to the lifts goes across it — and THE DAY CAR
//     PARK a little along from it, two aisles in from the street with the
//     bays either side, joined at the far end.
// Every street, to the back of its sidewalks, keeps off the runs and
// lanes, out of the lifts' lines and away from their stations and queues,
// out of the hub and its wind tunnels, away from the masts, the machines'
// pads, the gates, the start, the finish arena, the log buildings and the
// kickers, and inside the map; it climbs and leans no more than a street
// does (`VILLAGE_STREETS.grade`). A village whose loop cannot be laid
// clear anywhere near its point has no streets (its base's buildings then
// stand along the hub's edge as they did before there were streets).
//
// A pure function of the map, off hashes of its seed — never the stream —
// worked out once inside `cabinsOf` (the log buildings stand first and the
// streets keep off them; the village's buildings stand on the streets) and
// read back with `villageOf` (`village.ts`). No map's digest and no run's
// moves for it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hubAt, nearestWithin, outsideHub } from "../mapgen/query.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import type { Cabin } from "./cabins.ts";
import { groomedAt, pick, toSegment } from "./cabin-site.ts";
import { CABINS } from "./defs/cabins.ts";
import {
  SECTIONS,
  VILLAGE_AREAS as A,
  VILLAGE_STREETS as V,
  sideReach,
  type Section,
  type StreetKind,
} from "./defs/village-streets.ts";
import { helipadOf } from "./heli-pad.ts";
import { clearOfLifts, liftPlans, queueLane } from "./lift-line.ts";
import { pisteMasts } from "./piste-masts.ts";
import { REAL_HOUSES, realHousesOf } from "./real-houses.ts";
import {
  REAL_STREETS,
  inFrame,
  realCrosses,
  realExit,
  realProfile,
  realTownOf,
  realWeight,
  townLines,
  type FrameSeg,
} from "./real-streets.ts";
import { sledSpotOf } from "./sled-pad.ts";

/** A point of a street's centreline (or a lane's, a sidewalk's): in the
 * world, the snow's height there, the arc from the line's start and the
 * way it runs (heading convention: 0 = +z, clockwise from above). */
export type StreetPoint = { x: number; y: number; z: number; s: number; heading: number };

/** ONE STREET between two junctions: its kind and cross-section, its
 * centreline every `VILLAGE_STREETS.step` m from its first junction
 * (`from`) to its last (`to`), and whether it runs off the map's edge
 * there (`exit`: its last point is on the edge, `to` the junction there). */
export type Street = {
  id: string;
  kind: StreetKind;
  section: Section;
  points: StreetPoint[];
  length: number;
  from: number;
  to: number;
  exit: boolean;
};

/** A place streets meet (or a street leaves the map, `exit`): where, and
 * the streets that start or end there. */
export type Junction = {
  id: number;
  x: number;
  y: number;
  z: number;
  streets: string[];
  exit: boolean;
};

/** An open place along the main street (the square, the car park): a
 * rectangle of its middle, its heading (out of the street, toward the
 * hub), half its length along the street and half its depth. */
export type VillageArea = {
  kind: "square" | "carpark";
  x: number;
  y: number;
  z: number;
  heading: number;
  half: number;
  depth: number;
};

/** THE STREET PLAN of a village (`planVillageStreets`). */
export type VillageStreets = {
  /** Which way z runs out of the hub into the valley (+1 or −1). */
  valley: 1 | -1;
  /** The village's middle on the main street, and the z of the hub's
   * valley edge the plan is laid off. */
  centre: { x: number; z: number };
  edge: number;
  streets: Street[];
  junctions: Junction[];
  areas: VillageArea[];
  /** The main street's and the back street's pieces in order along x,
   * and each end's cross street (west, east) and road out (or ""). */
  main: string[];
  back: string[];
  ends: { cross: [string, string]; road: [string, string] };
  /** The square's middle along the main street (x) and which way along
   * it the car park lies (+1 east, −1 west; 0 none). */
  square: number;
  carparkSide: -1 | 0 | 1;
};

/** How near the hub's edge the square and the car park reach, m. */
const AREA_HUB = 0.5;

const remembered = new WeakMap<Level, VillageStreets | null>();

/** Keep the plan worked out for `level` inside `cabinsOf`. */
export function rememberStreets(level: Level, plan: VillageStreets | null): void {
  remembered.set(level, plan);
}

/** The plan kept for `level`, if `cabinsOf` has worked it out. */
export function rememberedStreets(level: Level): VillageStreets | null | undefined {
  return remembered.get(level);
}

/** A street's whole half-width to the back of each side. */
export function reachOf(st: Street, side: 0 | 1): number {
  return sideReach(st.section, side);
}

/** The world point `lat` m to the RIGHT of a centreline point in map
 * terms (right of a heading is (cos h, −sin h)) — the eye's LEFT, the map
 * view mirroring the world as seen (`input-model.ts`'s sign boundary). */
export function besidePoint(p: StreetPoint, lat: number): { x: number; z: number } {
  return { x: p.x + Math.cos(p.heading) * lat, z: p.z - Math.sin(p.heading) * lat };
}

/** A street's point `s` m along it, into `out`. */
export function streetAt(st: Street, s: number, out: StreetPoint): StreetPoint {
  const pts = st.points;
  const n = pts.length;
  const u = Math.max(0, Math.min(st.length, s));
  let i = Math.min(n - 2, Math.max(0, Math.floor((u / Math.max(1e-6, st.length)) * (n - 1))));
  while (i > 0 && pts[i].s > u) i--;
  while (i < n - 2 && pts[i + 1].s <= u) i++;
  const a = pts[i];
  const b = pts[Math.min(n - 1, i + 1)];
  const t = b.s > a.s ? (u - a.s) / (b.s - a.s) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.s = u;
  out.heading = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}

/** A polyline through `pts` resampled every `step` m, the snow's height,
 * arc and heading on every point. */
export function resample(
  level: Level,
  pts: readonly { x: number; z: number }[],
  step: number = V.step,
): StreetPoint[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  const total = cum[cum.length - 1];
  const n = Math.max(1, Math.round(total / step));
  const out: StreetPoint[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n;
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const seg = Math.max(1e-9, cum[j + 1] - cum[j]);
    const t = Math.max(0, Math.min(1, (s - cum[j]) / seg));
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    out.push({ x, y: level.groundAt(x, z), z, s, heading: Math.atan2(b.x - a.x, b.z - a.z) });
  }
  // A smoother heading: each point's from its neighbours.
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    out[i].heading = Math.atan2(b.x - a.x, b.z - a.z);
  }
  return out;
}

/** What a street keeps away from, worked out once a plan: is (x, z) clear
 * of everything `VILLAGE_STREETS.clear` names? `hubPad` overrides the
 * hub's clearance (the square and the car park reach up to it). */
type Clear = (x: number, z: number, hubPad?: number) => boolean;
/** An open place reaches up to the hub's groomed snow, which fades out
 * past its edge: the packed field is not asked there. */

function clearanceOf(level: Level, avoid: readonly Cabin[]): Clear {
  const C = V.clear;
  const resort = level.resort;
  const hub = resort?.hub;
  const lifts = resort?.lifts ?? [];
  const tunnels = resort?.tunnels ?? [];
  const lines = (resort?.runs ?? []).map((r) => ({
    track: { points: r.points as TrackPoint[], length: r.length },
  }));
  lines.push({ track: level.track });
  const queues = liftPlans(level).map((p) =>
    queueLane(p).map(({ u, v }) => ({
      x: p.lift.bottom.x + p.dx * u + p.dz * v,
      z: p.lift.bottom.z + p.dz * u - p.dx * v,
    })),
  );
  const masts = pisteMasts(level);
  const pads = resort ? [helipadOf(level), sledSpotOf(level)] : [];
  const cps = level.checkpoints;
  const finish = cps.length > 0 ? cps[cps.length - 1] : null;
  const hit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
  // The groomer's snow (on a real face, not the fell's wind crust).
  const groomed = groomedAt(level);
  const houses = avoid.map((c) => {
    const d = CABINS[c.kind];
    return {
      c,
      hw: d.width / 2 + d.reach.side + C.cabin,
      back: d.depth / 2 + d.reach.back + C.cabin,
      front: d.depth / 2 + d.reach.front + C.cabin,
    };
  });
  return (x, z, hubPad = C.hub) => {
    if (x < 0 || z < 0 || x > level.size || z > level.size) return false;
    if (hubPad >= C.hub && groomed(x, z)) return false;
    if ((level.iceAt?.(x, z) ?? 0) > 0) return false;
    if (!clearOfLifts(level, x, z)) return false;
    if (hub && outsideHub(hub, x, z) < hubPad) return false;
    for (const line of lines) {
      nearestWithin(line, x, z, C.line + 40, hit);
      if (hit.distance === Infinity) continue;
      if (hit.distance - line.track.points[hit.index].width / 2 < C.line) return false;
    }
    for (const lift of lifts) {
      for (const end of [lift.bottom, lift.top]) {
        if (hypot(end.x - x, end.z - z) < C.station) return false;
      }
      for (const ramp of lift.ramps ?? []) {
        const d = toSegment(x, z, ramp.from.x, ramp.from.z, ramp.to.x, ramp.to.z);
        if (d < ramp.width / 2 + C.line) return false;
      }
    }
    for (const q of queues) {
      for (let i = 0; i + 1 < q.length; i++) {
        if (toSegment(x, z, q[i].x, q[i].z, q[i + 1].x, q[i + 1].z) < C.queue) return false;
      }
    }
    for (const t of tunnels) {
      const a = t.points[0];
      const b = t.points[t.points.length - 1];
      if (toSegment(x, z, a.x, a.z, b.x, b.z) < t.width / 2 + C.tunnel) return false;
    }
    for (const m of masts) if (hypot(m.x - x, m.z - z) < C.mast) return false;
    for (const p of pads) if (hypot(p.x - x, p.z - z) < C.pad) return false;
    for (const cp of cps) if (hypot(cp.x - x, cp.z - z) < C.gate) return false;
    if (hypot(level.spawn.x - x, level.spawn.z - z) < C.start) return false;
    if (finish && hypot(finish.x - x, finish.z - z) < C.finish) return false;
    for (const k of level.kickers ?? []) {
      if (hypot(k.x - x, k.z - z) < C.kicker + k.landing / 2) return false;
    }
    for (const h of houses) {
      const dx = x - h.c.x;
      const dz = z - h.c.z;
      if (Math.abs(dx) > 80 || Math.abs(dz) > 80) continue;
      const fx = Math.sin(h.c.heading);
      const fz = Math.cos(h.c.heading);
      const lx = dx * fz - dz * fx;
      const lz = dx * fx + dz * fz;
      if (Math.abs(lx) < h.hw && lz > -h.back && lz < h.front) return false;
    }
    return true;
  };
}

/** Whether a street's line is clear to the back of both its sides, and
 * no steeper along or across than a street is built. */
function streetClear(pts: readonly StreetPoint[], section: Section, clear: Clear): boolean {
  const r0 = sideReach(section, 0);
  const r1 = sideReach(section, 1);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    for (const lat of [-r0, -r0 / 2, 0, r1 / 2, r1]) {
      const q = besidePoint(p, lat);
      if (!clear(q.x, q.z)) return false;
    }
    if (i > 0) {
      const a = pts[i - 1];
      if (Math.abs(p.y - a.y) > V.grade.along * Math.max(1e-6, p.s - a.s)) return false;
    }
  }
  return true;
}

/** A street's lean across, at worst (both reaches), rise over run. */
function leanAcross(level: Level, pts: readonly StreetPoint[], section: Section): number {
  const r0 = sideReach(section, 0);
  const r1 = sideReach(section, 1);
  let most = 0;
  for (const p of pts) {
    const a = besidePoint(p, -r0);
    const b = besidePoint(p, r1);
    most = Math.max(
      most,
      Math.abs(level.groundAt(b.x, b.z) - level.groundAt(a.x, a.z)) / (r0 + r1),
    );
  }
  return most;
}

/** One candidate laid out: the skeleton's lines before they are split at
 * their junctions. */
type Draft = {
  xa: number;
  xb: number;
  z0: number;
  sV: 1 | -1;
  mainV: (x: number) => number;
  backV: (x: number) => number;
  crosses: number[];
  roads: { end: 0 | 1; pts: { x: number; z: number }[] }[];
  square: number;
  carpark: { side: -1 | 1; p0: number; p1: number } | null;
};

/**
 * THE STREETS of `level`'s village, laid clear of everything above and of
 * the log buildings `avoid` (stood before them), or null where the map
 * has no ski area or no loop fits near its village.
 */
export function planVillageStreets(level: Level, avoid: readonly Cabin[]): VillageStreets | null {
  const resort = level.resort;
  const hub = resort?.hub;
  if (!resort || !hub || hub.top.length < 2) return null;
  const seed = level.seed >>> 0;
  const hx0 = hub.x0;
  const hx1 = hub.x0 + hub.step * (hub.top.length - 1);
  const mid = hubAt(hub, (hx0 + hx1) / 2);
  if (!mid) return null;
  // The valley's side of the hub: away from the summit.
  const summitZ = level.mountain?.summit.z ?? 0;
  const valley: 1 | -1 = summitZ < (mid.top + mid.bottom) / 2 ? 1 : -1;
  const clear = clearanceOf(level, avoid);
  const village = resort.village;
  // The main lift: of the lifts leaving the hub, the one whose bottom
  // station stands nearest the village — the square stands below it.
  let liftX = village.x;
  let best = Infinity;
  for (const lift of resort.lifts) {
    const e = hubAt(hub, lift.bottom.x);
    if (!e || lift.bottom.z < e.top - 10 || lift.bottom.z > e.bottom + 10) continue;
    const d = hypot(lift.bottom.x - village.x, lift.bottom.z - village.z);
    if (d < best) {
      best = d;
      liftX = lift.bottom.x;
    }
  }
  const deal = (salt: number, k = 0) => pick(seed, "village-streets", k, salt);
  const span0 = V.span.least + (V.span.most - V.span.least) * deal(1);
  const vMain = V.main.least + (V.main.most - V.main.least) * deal(2);
  const vBack = vMain + V.back.least + (V.back.most - V.back.least) * deal(3);
  const bendM = (deal(4) * 2 - 1) * V.bend;
  const bendB = (deal(5) * 2 - 1) * V.bend;
  const nCross = V.crosses.least + Math.floor(deal(6) * (V.crosses.most - V.crosses.least + 1));
  const roadEnd: 0 | 1 = deal(7) < 0.5 ? 0 : 1;
  const twoRoads = deal(8) < V.roads;
  const parkSide: -1 | 1 = deal(9) < 0.5 ? -1 : 1;

  const town = realTownOf(level);
  // The valley's side first; on a real face with a town whose village
  // has no room there — or whose town stands up the mountain's side of
  // the hub — the hub's mountain side, where a real town often stands
  // above a valley floor of water, and with no road out.
  const onSide = (sV: 1 | -1, roads: boolean): VillageStreets | null => {
    const centres = realCentres(level, village.x, span0, mid, sV, vBack, town?.streets ?? []);
    for (const spanShare of V.tries.span) {
      const span = span0 * spanShare;
      for (const off of centres) {
        const cx = village.x + off;
        const xa = Math.round(cx - span / 2);
        const xb = Math.round(cx + span / 2);
        if (xa < hx0 + 10 || xb > hx1 - 10) continue;
        // The hub's valley edge furthest out along the village, so no street
        // reaches into it.
        let z0 = sV > 0 ? -Infinity : Infinity;
        for (let x = xa - 40; x <= xb + 40; x += 10) {
          const e = hubAt(hub, Math.min(hx1, Math.max(hx0, x)));
          if (!e) continue;
          z0 = sV > 0 ? Math.max(z0, e.bottom) : Math.min(z0, e.top);
        }
        if (!Number.isFinite(z0)) continue;
        const vMax = sV > 0 ? level.size - z0 : z0;
        if (vMax < vBack + 20) continue;
        const bow = (a: number, x: number, ph: number) =>
          a * Math.sin(Math.PI * ((x - xa) / (xb - xa)) + ph);
        const mainV = (x: number) => vMain + bow(bendM, x, 0);
        const backV = (x: number) => vBack + bow(bendB, x, 0.4 * Math.PI);
        // On a real face with a town, the real streets' lines first.
        const segs = town ? inFrame(town.streets, z0, sV) : [];
        const exit = segs.length > 0 ? realExit(segs, xa, xb, vMax) : null;
        for (const [m, b] of realLines(segs, xa, xb, vMax, mainV, backV, vBack - vMain)) {
          const draft = layDraft(level, clear, {
            xa,
            xb,
            z0,
            sV,
            mainV: m,
            backV: b,
            vMax,
            liftX,
            nCross,
            roadEnd: exit ? exit.end : roadEnd,
            twoRoads,
            parkSide,
            deal,
            segs,
            exit,
            roads,
          });
          if (!draft) continue;
          const plan = build(level, draft);
          if (town) layTownStreets(level, plan, clear, town);
          return plan;
        }
      }
    }
    return null;
  };
  // A real town that stands up the mountain's side of the hub (above its
  // upper edge where it is nearest) has its village tried there first.
  const at = town ? hubAt(hub, Math.min(hx1, Math.max(hx0, town.town.x))) : null;
  const up = !!at && (town!.town.z - (valley > 0 ? at.top : at.bottom)) * valley < 0;
  if (up) return onSide(-valley as 1 | -1, false) ?? onSide(valley, true);
  const plan = onSide(valley, true);
  return plan || !town ? plan : onSide(-valley as 1 | -1, false);
}

/** The main and back streets' lines tried for one village: on a real face
 * with a town (`segs` its streets in the village's frame), the real main
 * street's with the real back street's, then with the dealt back street
 * carried behind it; last (and alone on any other map) the dealt pair. */
function realLines(
  segs: readonly FrameSeg[],
  xa: number,
  xb: number,
  vMax: number,
  mainV: (x: number) => number,
  backV: (x: number) => number,
  gap: number,
): [(x: number) => number, (x: number) => number][] {
  const out: [(x: number) => number, (x: number) => number][] = [];
  if (segs.length > 0) {
    const R = REAL_STREETS;
    const room = vMax - gap - 20;
    const m = realProfile(
      segs,
      xa,
      xb,
      () => R.main.band[0],
      () => Math.max(R.main.band[0], Math.min(R.main.band[1], room)),
      R.main.cover,
    );
    if (m) {
      const b = realProfile(
        segs,
        xa,
        xb,
        (x) => m(x) + R.back.gap[0],
        (x) => Math.max(m(x) + R.back.gap[0], Math.min(m(x) + R.back.gap[1], vMax - 20)),
        R.main.cover,
      );
      if (b) out.push([m, b]);
      const behind = (x: number) => m(x) + backV(x) - mainV(x);
      out.push([m, behind]);
    }
  }
  out.push([mainV, backV]);
  return out;
}

/** The centres the village is tried at, off its point (`tries.centre`) —
 * on a REAL FACE (`real-houses.ts`, `real-streets.ts`) with enough of its
 * houses and its town's streets on the village's ground, the one most of
 * them stand round added (inside the reach the list already searches) and
 * every centre tried in order of how many stand under its streets, the
 * most first. */
function realCentres(
  level: Level,
  vx: number,
  span: number,
  mid: { top: number; bottom: number },
  sV: 1 | -1,
  depth: number,
  streets: Parameters<typeof inFrame>[0],
): readonly number[] {
  const houses = realHousesOf(level);
  if (houses.length === 0 && streets.length === 0) return V.tries.centre;
  const reach = Math.max(...V.tries.centre.map(Math.abs));
  // The houses on the valley's side of the hub, within the village's depth.
  const edge = sV > 0 ? mid.bottom : mid.top;
  const xs = houses
    .filter((h) => {
      const v = (h.z - edge) * sV;
      return v > 0 && v < depth + REAL_HOUSES.near;
    })
    .map((h) => h.x);
  // …and the real town's streets there, a real house to every
  // `REAL_STREETS.house` m of them.
  const segs = inFrame(streets, edge, sV);
  const under = (off: number) =>
    xs.filter((x) => Math.abs(x - (vx + off)) < span / 2).length +
    realWeight(segs, vx + off - span / 2, vx + off + span / 2, depth + REAL_HOUSES.near) /
      REAL_STREETS.house;
  let peak = 0;
  for (let off = -reach; off <= reach; off += 10) if (under(off) > under(peak)) peak = off;
  const tried: readonly number[] = V.tries.centre;
  const list = [...tried, ...(tried.includes(peak) ? [] : [peak])];
  const counts = new Map(list.map((o) => [o, under(o)]));
  if (counts.get(peak)! < REAL_HOUSES.village) return V.tries.centre;
  return list
    .map((o, i) => ({ o, i, n: counts.get(o)! }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((c) => c.o);
}

type DraftAsk = {
  xa: number;
  xb: number;
  z0: number;
  sV: 1 | -1;
  mainV: (x: number) => number;
  backV: (x: number) => number;
  vMax: number;
  liftX: number;
  nCross: number;
  roadEnd: 0 | 1;
  twoRoads: boolean;
  parkSide: -1 | 1;
  deal: (salt: number, k?: number) => number;
  /** A real face's town in the village's frame, and where a real road
   * leaves down the valley (`real-streets.ts`). */
  segs: readonly FrameSeg[];
  exit: { end: 0 | 1; x: number } | null;
  /** Whether a road out must be laid (else none is tried). */
  roads: boolean;
};

/** Try one centre and span: the main street, the back street and the two
 * end cross streets must all be clear (the loop), one road out at least;
 * the square, the car park and the middle cross streets are fitted round
 * them. */
function layDraft(level: Level, clear: Clear, a: DraftAsk): Draft | null {
  const { xa, xb, z0, sV, mainV, backV, deal } = a;
  const zOf = (v: number) => z0 + sV * v;
  const along = (vOf: (x: number) => number, x0: number, x1: number) => {
    const out: { x: number; z: number }[] = [];
    const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 10));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      out.push({ x, z: zOf(vOf(x)) });
    }
    return out;
  };
  const lineOk = (pts: { x: number; z: number }[], kind: StreetKind) => {
    const r = resample(level, pts);
    return streetClear(r, SECTIONS[kind], clear) &&
      leanAcross(level, r, SECTIONS[kind]) <= V.grade.across
      ? r
      : null;
  };
  if (!lineOk(along(mainV, xa, xb), "main")) return null;
  if (!lineOk(along(backV, xa, xb), "back")) return null;
  const crossLine = (x: number) => [
    { x, z: zOf(mainV(x)) },
    { x, z: zOf(backV(x)) },
  ];
  for (const x of [xa, xb]) if (!lineOk(crossLine(x), "cross")) return null;
  // THE SQUARE below the main lift, slid along until its ground is clear.
  const sq = A.square.along / 2;
  const mainReachHub = sideReach(SECTIONS.main, sV > 0 ? 1 : 0);
  const areaOk = (u0: number, u1: number) => {
    for (let x = u0; x <= u1 + 1e-6; x += 4) {
      const vTop = mainV(x) - mainReachHub - 1;
      for (let v = AREA_HUB; v <= vTop; v += 4) {
        if (!clear(x, zOf(v), AREA_HUB)) return false;
      }
    }
    return true;
  };
  const lo = xa + 75;
  const hi = xb - 75;
  if (hi < lo) return null;
  let square = NaN;
  const want = Math.min(hi, Math.max(lo, a.liftX));
  for (let k = 0; k <= 12 && Number.isNaN(square); k++) {
    for (const s of k === 0 ? [0] : [k * 8, -k * 8]) {
      const u = want + s;
      if (u < lo || u > hi) continue;
      if (areaOk(u - sq, u + sq)) {
        square = u;
        break;
      }
    }
  }
  if (Number.isNaN(square)) return null;
  // THE CAR PARK on the dealt side of the square, or the other.
  const W = 2 * (A.carpark.bay.length * 2 + SECTIONS.aisle.lane * 2);
  let carpark: Draft["carpark"] = null;
  for (const side of [a.parkSide, -a.parkSide as -1 | 1]) {
    const p0 = side > 0 ? square + sq + A.carpark.gap : square - sq - A.carpark.gap - W;
    const p1 = p0 + W;
    if (p0 < xa + 12 || p1 > xb - 12) continue;
    if (areaOk(p0, p1)) {
      carpark = { side, p0, p1 };
      break;
    }
  }
  // THE MIDDLE CROSS STREETS: dealt along, clear of the ends, of each other,
  // of the square (the church stands across from it) and the car park.
  const crosses: number[] = [];
  const crossFree = (x: number) => {
    const taken = [xa, xb, ...crosses];
    if (taken.some((o) => Math.abs(o - x) < V.crosses.apart)) return false;
    if (Math.abs(x - square) < sq + 30) return false;
    if (carpark && x > carpark.p0 - 20 && x < carpark.p1 + 20) return false;
    return lineOk(crossLine(x), "cross") !== null;
  };
  // A real town's cross streets first, where they fit.
  if (a.segs.length > 0) {
    for (const x of realCrosses(a.segs, xa, xb, mainV, backV)) {
      if (crosses.length >= REAL_STREETS.crosses) break;
      if (crossFree(x)) crosses.push(x);
    }
  }
  for (let i = crosses.length; i < a.nCross; i++) {
    for (let t = 0; t < 8; t++) {
      const u = xa + (xb - xa) * ((i + 0.5 + (deal(20 + i, t) - 0.5) * 0.7) / a.nCross);
      const x = Math.round(u);
      if (!crossFree(x)) continue;
      crosses.push(x);
      break;
    }
  }
  crosses.sort((p, q) => p - q);
  // THE ROAD OUT off the back street's end, down the valley off the map's
  // edge, wandering a little.
  const roads: Draft["roads"] = [];
  const roadAt = (end: 0 | 1, k: number) => {
    const x0 = end === 0 ? xa : xb;
    const v0 = backV(x0);
    const vEnd = a.vMax - 0.5;
    const real = a.exit && a.exit.end === end && k === 0 ? a.exit.x - x0 : null;
    const wander = REAL_STREETS.exit.wander;
    const drift =
      real !== null ? Math.max(-wander, Math.min(wander, real)) : (deal(30 + end, k) * 2 - 1) * 30;
    const pts: { x: number; z: number }[] = [];
    const n = Math.max(2, Math.ceil((vEnd - v0) / 10));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const e = t * t * (3 - 2 * t);
      pts.push({ x: x0 + drift * e, z: zOf(v0 + (vEnd - v0) * t) });
    }
    return pts;
  };
  const ends: (0 | 1)[] = !a.roads
    ? []
    : a.twoRoads
      ? [a.roadEnd, (1 - a.roadEnd) as 0 | 1]
      : [a.roadEnd];
  for (const end of ends) {
    for (let k = 0; k < 4; k++) {
      const pts = roadAt(end, k);
      if (lineOk(pts, "road")) {
        roads.push({ end, pts });
        break;
      }
    }
  }
  if (roads.length === 0 && a.roads) {
    const other = (1 - a.roadEnd) as 0 | 1;
    for (let k = 0; k < 4 && roads.length === 0; k++) {
      const pts = roadAt(other, k);
      if (lineOk(pts, "road")) roads.push({ end: other, pts });
    }
  }
  if (roads.length === 0 && a.roads) return null;
  return { xa, xb, z0, sV, mainV, backV, crosses, roads, square, carpark };
}

/** Split the draft's lines at their junctions into the street graph. */
function build(level: Level, d: Draft): VillageStreets {
  const { xa, xb, z0, sV, mainV, backV } = d;
  const zOf = (v: number) => z0 + sV * v;
  const junctions: Junction[] = [];
  const streets: Street[] = [];
  const node = (x: number, z: number, exit = false): number => {
    const id = junctions.length;
    junctions.push({ id, x, y: level.groundAt(x, z), z, streets: [], exit });
    return id;
  };
  const add = (
    id: string,
    kind: StreetKind,
    pts: { x: number; z: number }[],
    from: number,
    to: number,
    exit = false,
  ): string => {
    const points = resample(level, pts);
    streets.push({
      id,
      kind,
      section: SECTIONS[kind],
      points,
      length: points[points.length - 1].s,
      from,
      to,
      exit,
    });
    junctions[from].streets.push(id);
    junctions[to].streets.push(id);
    return id;
  };
  const along = (vOf: (x: number) => number, x0: number, x1: number) => {
    const out: { x: number; z: number }[] = [];
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 10));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      out.push({ x, z: zOf(vOf(x)) });
    }
    return out;
  };
  // The car park's two aisles meet the main street at these x.
  const lane = SECTIONS.aisle.lane;
  const bay = A.carpark.bay.length;
  const cp = d.carpark;
  const aisleX = cp ? [cp.p0 + bay + lane, cp.p1 - bay - lane] : [];
  // The main street's junctions: its ends, the cross streets, the aisles.
  const mainXs = [xa, ...d.crosses, ...aisleX, xb].sort((p, q) => p - q);
  const backXs = [xa, ...d.crosses, xb];
  const mainNode = new Map<number, number>();
  const backNode = new Map<number, number>();
  for (const x of mainXs) mainNode.set(x, node(x, zOf(mainV(x))));
  for (const x of backXs) backNode.set(x, node(x, zOf(backV(x))));
  const main: string[] = [];
  for (let i = 0; i + 1 < mainXs.length; i++) {
    const x0 = mainXs[i];
    const x1 = mainXs[i + 1];
    main.push(add(`M${i + 1}`, "main", along(mainV, x0, x1), mainNode.get(x0)!, mainNode.get(x1)!));
  }
  const back: string[] = [];
  for (let i = 0; i + 1 < backXs.length; i++) {
    const x0 = backXs[i];
    const x1 = backXs[i + 1];
    back.push(add(`B${i + 1}`, "back", along(backV, x0, x1), backNode.get(x0)!, backNode.get(x1)!));
  }
  const crossIds: string[] = [];
  [xa, ...d.crosses, xb].forEach((x, i) => {
    crossIds.push(
      add(
        `X${i + 1}`,
        "cross",
        [
          { x, z: zOf(mainV(x)) },
          { x, z: zOf(backV(x)) },
        ],
        mainNode.get(x)!,
        backNode.get(x)!,
      ),
    );
  });
  const roads: [string, string] = ["", ""];
  d.roads.forEach((r, i) => {
    const last = r.pts[r.pts.length - 1];
    const exit = node(last.x, last.z, true);
    roads[r.end] = add(
      `R${i + 1}`,
      "road",
      r.pts,
      backNode.get(r.end === 0 ? xa : xb)!,
      exit,
      true,
    );
  });
  // THE CAR PARK'S AISLES: in from the main street, along its far end, and
  // back out — a U the cars drive round.
  const areas: VillageArea[] = [];
  const hubSide = sV > 0 ? 1 : 0;
  const mainReachHub = sideReach(SECTIONS.main, hubSide);
  const areaOf = (kind: VillageArea["kind"], u0: number, u1: number): VillageArea => {
    const um = (u0 + u1) / 2;
    const vTop = mainV(um) - mainReachHub - 0.5;
    const vLow = AREA_HUB;
    const vm = (vTop + vLow) / 2;
    const x = um;
    const z = zOf(vm);
    return {
      kind,
      x,
      y: level.groundAt(x, z),
      z,
      heading: sV > 0 ? Math.PI : 0,
      half: (u1 - u0) / 2,
      depth: (vTop - vLow) / 2,
    };
  };
  const sq = A.square.along / 2;
  areas.push(areaOf("square", d.square - sq, d.square + sq));
  if (cp) {
    areas.push(areaOf("carpark", cp.p0, cp.p1));
    const vIn = AREA_HUB + A.carpark.back + lane;
    const [ax, bx] = aisleX;
    const inA = node(ax, zOf(vIn));
    const inB = node(bx, zOf(vIn));
    const top = (x: number) => zOf(mainV(x));
    add(
      "P1",
      "aisle",
      [
        { x: ax, z: top(ax) },
        { x: ax, z: zOf(vIn) },
      ],
      mainNode.get(ax)!,
      inA,
    );
    add(
      "P2",
      "aisle",
      [
        { x: ax, z: zOf(vIn) },
        { x: bx, z: zOf(vIn) },
      ],
      inA,
      inB,
    );
    add(
      "P3",
      "aisle",
      [
        { x: bx, z: zOf(vIn) },
        { x: bx, z: top(bx) },
      ],
      inB,
      mainNode.get(bx)!,
    );
  }
  const mid = mainNode.get(xa)!;
  return {
    valley: sV,
    centre: { x: (xa + xb) / 2, z: junctions[mid].z },
    edge: z0,
    streets,
    junctions,
    areas,
    main,
    back,
    ends: { cross: [crossIds[0], crossIds[crossIds.length - 1]], road: roads },
    square: d.square,
    carparkSide: cp ? cp.side : 0,
  };
}

/** A real face's TOWN STREETS (`real-streets.ts`'s `townLines`) laid onto
 * `plan`: every stretch of the town's real streets near the village that
 * is clear (`clear`), off the plan's streets and open places and those
 * laid before it, and no steeper than a town street — each a street of
 * its own (`T1`, `T2`, …) with a junction at either end. */
function layTownStreets(
  level: Level,
  plan: VillageStreets,
  clear: Clear,
  town: NonNullable<ReturnType<typeof realTownOf>>,
): void {
  const T = REAL_STREETS.town;
  const section = SECTIONS.town;
  const r0 = sideReach(section, 0);
  const r1 = sideReach(section, 1);
  const own = Math.max(r0, r1);
  // The laid streets' points, bucketed, each with its reach.
  const CELL = 20;
  const grid = new Map<number, { x: number; z: number; r: number }[]>();
  const key = (i: number, j: number) => i * 4096 + j;
  const keep = (st: Street) => {
    const r = Math.max(reachOf(st, 0), reachOf(st, 1));
    for (const p of st.points) {
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      const cell = grid.get(k) ?? [];
      cell.push({ x: p.x, z: p.z, r });
      grid.set(k, cell);
    }
  };
  for (const st of plan.streets) keep(st);
  const offStreets = (x: number, z: number) => {
    const ci = Math.floor(x / CELL);
    const cj = Math.floor(z / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (const q of grid.get(key(i, j)) ?? []) {
          if (hypot(q.x - x, q.z - z) < q.r + T.apart) return false;
        }
      }
    }
    for (const a of plan.areas) {
      const fx = Math.sin(a.heading);
      const fz = Math.cos(a.heading);
      const dx = x - a.x;
      const dz = z - a.z;
      if (
        Math.abs(dx * fz - dz * fx) < a.half + T.apart &&
        Math.abs(dx * fx + dz * fz) < a.depth + T.apart
      ) {
        return false;
      }
    }
    return true;
  };
  const n = { x: 0, y: 1, z: 0 };
  const ok = (x: number, z: number, dx: number, dz: number) => {
    level.normalAt(x, z, n);
    const gx = -n.x / Math.max(1e-6, n.y);
    const gz = -n.z / Math.max(1e-6, n.y);
    if (Math.abs(gx * dx + gz * dz) > T.grade.along) return false;
    if (Math.abs(gx * dz - gz * dx) > T.grade.across) return false;
    // Across it, to the back of each side: right of its way is (dz, −dx).
    for (const lat of [-r0, 0, r1]) {
      const qx = x + dz * lat;
      const qz = z - dx * lat;
      if (!clear(qx, qz) || !offStreets(qx, qz)) return false;
    }
    return offStreets(x, z) || own === 0;
  };
  const node = (p: StreetPoint): number => {
    const id = plan.junctions.length;
    plan.junctions.push({ id, x: p.x, y: p.y, z: p.z, streets: [], exit: false });
    return id;
  };
  let count = 0;
  townLines(town, plan.centre, V.step, ok, (_main, pts) => {
    const points = resample(level, pts);
    if (points.length < 2) return false;
    const from = node(points[0]);
    const to = node(points[points.length - 1]);
    const st: Street = {
      id: `T${++count}`,
      kind: "town",
      section,
      points,
      length: points[points.length - 1].s,
      from,
      to,
      exit: false,
    };
    plan.streets.push(st);
    plan.junctions[from].streets.push(st.id);
    plan.junctions[to].streets.push(st.id);
    keep(st);
    return true;
  });
}
