// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS — the snowmaking a ski area stands along its runs in a
// THIN SEASON: early in the winter, building the base, and late in it,
// patching the worn runs (`SNOW_GUN.season`), on a day it is not snowing.
// Fan guns on carriages and columns and lances leaned over the run, at the
// hydrants on each covered run's WINDWARD edge, past the groomed width,
// aimed across the piste and a little down it so the cone lands on it.
// Every number and where it comes from is `defs/snow-guns.ts`.
//
//   * STANDING (`snowGunsOut`, `snowGunsOf`): on any map whose day is a
//     thin season's and whose sky is dry, in every mode — a ski area leaves
//     its guns where they stand — and a skier meets one as he meets a
//     floodlight mast (`posts.ts`): a carriage's bulk, a column's or a
//     lance's pole.
//   * RUNNING (`snowGunsRun`): only cold — not under a spring noon's sun,
//     not in a gale — and only on a run whose rules have the ski area's
//     machines (`RunRules.groomer`, the free ride): a race is never run
//     through a plume. Then each one has laid a WHALE of heavy machine
//     snow where its cone lands (`machineSnowOf`), loose snow the physics
//     reads as such (`snow.ts`'s `packedSnow`) and the renderer heaps.
//
// A pure function of the map, kept per map, drawing from no stream: no
// map's digest moves, and a run without guns never reads any of it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "../mapgen/query.ts";
import { snows, weatherOf } from "../mapgen/weather.ts";
import type { PisteGrade } from "../mapgen/grades.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { cabinsOf } from "./cabins.ts";
import { sunAtRun } from "./clock.ts";
import { CABINS } from "./defs/cabins.ts";
import { SNOW_GUN } from "./defs/snow-guns.ts";
import { clearOfLifts } from "./lift-line.ts";
import { mastLines, pisteMasts } from "./piste-masts.ts";
import { treesNear } from "./upright-grid.ts";
import { windFromOf } from "./wind.ts";

const G = SNOW_GUN;

/** How a gun stands: a fan gun on its two-wheeled carriage or up on a
 * column, or a lance. */
export type SnowGunMount = "carriage" | "tower" | "lance";

/** One gun as it stands: its foot on the snow, how it is mounted, which
 * side of its run (+1 the skier's left going down) and where on it (the
 * run's index in `mastLines`, its arc, the piste's width there); its AIM
 * in plan (rad, 0 = +z, clockwise from above — across the run and a little
 * down it), the nozzle's point (world) and how far it throws, m; and the
 * middle of its WHALE, where the cone lands. */
export type SnowGun = {
  x: number;
  y: number;
  z: number;
  mount: SnowGunMount;
  side: number;
  line: number;
  s: number;
  width: number;
  aim: number;
  nozzle: { x: number; y: number; z: number };
  reach: number;
  land: { x: number; z: number };
};

/** A FNV hash of a string and a salt, on [0, 1). */
function hashOf(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** THE SEASON a map's day falls in for the guns: "early" (the base built),
 * "late" (the runs patched) or null (midwinter: nature's snow will do). */
export function gunSeason(level: Pick<Level, "sun">): "early" | "late" | null {
  const d = level.sun.dayOfYear;
  const S = G.season;
  if (d >= S.early.from || d <= S.early.to) return "early";
  if (d >= S.late.from && d <= S.late.to) return "late";
  return null;
}

/** THE GUNS STAND on `level`: a thin season's day under a dry sky. */
export function snowGunsOut(level: Pick<Level, "sun" | "weather">): boolean {
  return gunSeason(level) !== null && !snows(weatherOf(level).kind);
}

/** THE GUNS RUN on `level`: they stand, the air is still enough, and it is
 * cold — a late season's spring sun past `warm` stops them. */
export function snowGunsRun(level: Pick<Level, "sun" | "weather">): boolean {
  if (!snowGunsOut(level)) return false;
  if (weatherOf(level).wind > G.windMost) return false;
  return gunSeason(level) === "early" || sunAtRun(level).elevation < G.warm;
}

/** Whether a run of grade `grade` and id `id` carries guns at all. */
function covered(id: string, grade: PisteGrade | undefined): boolean {
  return hashOf(id, 0x5309) < G.cover[grade ?? "blue"];
}

const sites = new WeakMap<Level, SnowGun[]>();

/**
 * WHERE THE GUNS STAND on `level` — every one, whether or not the season
 * has them out (`snowGunsOut` says so): down each covered run from `first`
 * m, a fan gun every `fan.every` m or a lance every `lance.every` m, on the
 * run's windward edge past the groomed width. One that would stand in a
 * lift's line, on another run's snow, by a trunk, a mast, a cabin or
 * another gun is nudged along the run, and left out where nothing clears
 * it. Pure, and kept per map.
 */
export function snowGunsOf(level: Level): readonly SnowGun[] {
  const known = sites.get(level);
  if (known) return known;
  const guns: SnowGun[] = [];
  const lines = mastLines(level);
  const runs = level.resort?.runs;
  const many = lines.length > 1;
  const near: number[] = [];
  const cps = level.checkpoints;
  const finish = cps.length > 0 ? cps[cps.length - 1] : null;
  const masts = pisteMasts(level);
  const cabins = cabinsOf(level);
  // The wind's way, toward which a plume drifts: the guns stand upwind.
  const from = windFromOf(level);
  const wx = -Math.sin(from);
  const wz = -Math.cos(from);
  const clearAt = (x: number, z: number): boolean => {
    const C = G.clear;
    if (x < 0 || z < 0 || x > level.size || z > level.size) return false;
    if (many && level.packedAt(x, z) > 0.5) return false;
    if (!clearOfLifts(level, x, z)) return false;
    if (treesNear(level, x, z, C.tree, near).length > 0) return false;
    if (finish && hypot(finish.x - x, finish.z - z) < C.finish) return false;
    if (hypot(level.spawn.x - x, level.spawn.z - z) < C.start) return false;
    for (const m of masts) if (hypot(m.x - x, m.z - z) < C.mast) return false;
    for (const c of cabins) {
      if (hypot(c.x - x, c.z - z) < CABINS[c.kind].width / 2 + C.cabin) return false;
    }
    for (const g of guns) if (hypot(g.x - x, g.z - z) < C.gun) return false;
    return true;
  };
  const at: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  const NUDGE = [0, 6, -6, 12, -12];

  lines.forEach((run, index) => {
    const meta = runs?.[index];
    if (meta && meta.kind !== "piste") return;
    if (!covered(run.id, meta?.grade)) return;
    const fan = hashOf(run.id, 0xfa2) < G.fanShare;
    const every = fan ? G.fan.every : G.lance.every;
    const out = fan ? G.fan.out : G.lance.out;
    const reach = fan ? G.fan.reach : G.lance.reach;
    const line = { track: { points: run.points, length: run.length } };
    for (let s0 = G.first, k = 0; s0 < run.length - 15; s0 += every, k++) {
      trackPointAt(line, s0, at);
      // Windward: the edge the wind blows from, across this stretch; in a
      // calm the run's own side, both on a wide one.
      const lx = Math.cos(at.heading);
      const lz = -Math.sin(at.heading);
      const cross = wx * lx + wz * lz;
      const own = hashOf(run.id, 0x51de) < 0.5 ? 1 : -1;
      const side = Math.abs(cross) > 0.2 ? (cross > 0 ? -1 : 1) : k % 2 === 0 ? own : -own;
      let placed: { s: number; x: number; z: number } | null = null;
      for (const ds of NUDGE) {
        const s = s0 + ds;
        if (s < 0 || s > run.length) continue;
        trackPointAt(line, s, at);
        const off = at.width / 2 + out;
        const x = at.x + Math.cos(at.heading) * side * off;
        const z = at.z - Math.sin(at.heading) * side * off;
        if (clearAt(x, z)) {
          placed = { s, x, z };
          break;
        }
      }
      if (!placed) continue;
      trackPointAt(line, placed.s, at);
      const mount: SnowGunMount = !fan
        ? "lance"
        : hashOf(`${run.id}:${k}`, 0x70e) < G.towerShare
          ? "tower"
          : "carriage";
      // THE AIM: in across the run toward its far side, swung down it just
      // so far that the cone lands on the middle of the piste.
      const across = at.width / 2 + out;
      const land = reach * G.whale.land;
      const down = land > across ? Math.acos(across / land) : 0;
      const inward = at.heading - (side * Math.PI) / 2;
      const aim = inward + side * down;
      const y = level.groundAt(placed.x, placed.z);
      const nozzle = nozzleOf(placed.x, y, placed.z, mount, aim);
      guns.push({
        x: placed.x,
        y,
        z: placed.z,
        mount,
        side,
        line: index,
        s: placed.s,
        width: at.width,
        aim,
        nozzle,
        reach,
        land: {
          x: placed.x + Math.sin(aim) * land,
          z: placed.z + Math.cos(aim) * land,
        },
      });
    }
  });
  sites.set(level, guns);
  return guns;
}

/** The nozzle's point of a gun standing at (x, y, z) aimed `aim`: a fan
 * gun's ring at its drum's mouth, a lance's head at the end of its leaned
 * tube. */
export function nozzleOf(
  x: number,
  y: number,
  z: number,
  mount: SnowGunMount,
  aim: number,
): { x: number; y: number; z: number } {
  if (mount === "lance") {
    const L = G.lance;
    const h = Math.sin(L.lean) * L.length;
    return {
      x: x + Math.sin(aim) * h,
      y: y + Math.cos(L.lean) * L.length,
      z: z + Math.cos(aim) * h,
    };
  }
  const F = G.fan;
  const reachOut = (F.length / 2) * Math.cos(F.tilt);
  return {
    x: x + Math.sin(aim) * reachOut,
    y: y + F.nozzle[mount] + (F.length / 2) * Math.sin(F.tilt),
    z: z + Math.cos(aim) * reachOut,
  };
}

/** The guns STANDING on `level` — none unless the season has them out. */
export function standingGuns(level: Level): readonly SnowGun[] {
  return snowGunsOut(level) ? snowGunsOf(level) : [];
}

/** What a skier meets of a gun: the cylinder about its foot, m. */
export function gunSolid(g: SnowGun): { radius: number; height: number } {
  if (g.mount === "lance") return { radius: G.lance.solid, height: G.lance.length * 0.8 };
  if (g.mount === "tower") return { radius: G.fan.solid.tower, height: G.fan.nozzle.tower };
  return { radius: G.fan.solid.carriage, height: G.fan.nozzle.carriage + G.fan.radius };
}

/** One WHALE: its middle, the unit way it runs along (the throw's), its
 * half-length and half-width, m, and its crest, m. */
export type Whale = {
  x: number;
  z: number;
  ux: number;
  uz: number;
  a: number;
  b: number;
  h: number;
};

/** THE MACHINE SNOW the running guns have laid: every whale, and a grid of
 * them by cell for the physics' lookup. */
export type MachineSnow = { whales: Whale[]; cells: Map<string, number[]>; cell: number };

/** The whale under gun `g`. */
export function whaleOf(g: SnowGun): Whale {
  const W = G.whale;
  return {
    x: g.land.x,
    z: g.land.z,
    ux: Math.sin(g.aim),
    uz: Math.cos(g.aim),
    a: (g.reach * W.along) / 2,
    b: (g.reach * W.across) / 2,
    h: W.height * (g.mount === "lance" ? W.lance : 1),
  };
}

/** THE MACHINE SNOW on `level`: a whale under every gun standing. */
export function machineSnowOf(level: Level): MachineSnow {
  const whales = standingGuns(level).map(whaleOf);
  const cell = 32;
  const cells = new Map<string, number[]>();
  whales.forEach((w, i) => {
    const r = Math.max(w.a, w.b);
    for (let cx = Math.floor((w.x - r) / cell); cx <= Math.floor((w.x + r) / cell); cx++) {
      for (let cz = Math.floor((w.z - r) / cell); cz <= Math.floor((w.z + r) / cell); cz++) {
        const key = `${cx},${cz}`;
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
    }
  });
  return { whales, cells, cell };
}

/** How deep a whale lies at (x, z) relative to its crest, 0..1: a smooth
 * mound, full at its middle and nothing at its rim. */
export function whaleShare(w: Whale, x: number, z: number): number {
  const dx = x - w.x;
  const dz = z - w.z;
  const along = (dx * w.ux + dz * w.uz) / w.a;
  const across = (dx * w.uz - dz * w.ux) / w.b;
  const r2 = along * along + across * across;
  if (r2 >= 1) return 0;
  const k = 1 - r2;
  return k * k;
}

/** THE MACHINE SNOW LYING at (x, z), m — the deepest whale there. */
export function machineSnowAt(snow: MachineSnow, x: number, z: number): number {
  const list = snow.cells.get(`${Math.floor(x / snow.cell)},${Math.floor(z / snow.cell)}`);
  if (!list) return 0;
  let d = 0;
  for (const i of list) {
    const w = snow.whales[i];
    const h = w.h * whaleShare(w, x, z);
    if (h > d) d = h;
  }
  return d;
}
