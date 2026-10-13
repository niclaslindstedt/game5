// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP'S SITE — what stands on and beside the jump plane's strip
// (`airstrip.ts`), laid the way a winter mountain strip is laid out:
//   * THE MARKERS down both edges, no more than `STRIP_SITE.markers.every`
//     apart (a mountain strip's rule: ≤100 m, low enough for a wingtip to
//     clear — a marker board under half a metre), a spruce bough stuck in
//     the snow between each pair, and a row across each end (the
//     THRESHOLDS);
//   * THE APRON: packed snow off one edge (the side the town is, where
//     the jumpers walk out from), the plane's parking beside the strip's
//     take-off end;
//   * ON IT, from the take-off end: a HANGAR for the plane (a door wider
//     than its wing, `hangar.door`), a FUEL SHED (the drums on a pallet, a
//     hand pump) and a small HUT (the manifest and the packing room);
//   * THE WINDSOCK on its mast off the far edge, abeam where a landing
//     touches down.
// Each building is placed by a search along its side of the strip — beside
// the runway, never past either end (so the approach and the climb-out are
// clear), outside the strip's own clearance (a wingtip on the centre line
// clears it), inside the map, on snow flat enough for a plinth, and clear
// of every trunk, street, building, run, lift, water and machine's place
// the strip itself keeps off (`keepOffs`, `stripRoomAt`). The other side
// is tried when one is full, and a lean-to stands in for the hangar where
// nothing bigger fits.
//
// NOTHING ELSE AVOIDS ANY OF IT: the site is worked out after every other
// placement and asked by none, so no map, no village and no digest moves.
// A pure function of the map, worked out once and kept per map.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { airstripOf, keepOffs, type Airstrip, type Keep } from "./airstrip.ts";
import { CORRIDOR } from "./airstrip-corridor.ts";
import { stripRoomAt } from "./airstrip-room.ts";
import { liftPlans } from "./lift-line.ts";
import type { Stuff } from "./upright-grid.ts";
import { treesNear } from "./upright-grid.ts";
import { streetMaskAt } from "./village.ts";
import type { Level } from "../mapgen/types.ts";

/** The site's measures, m. [winter strip practice: edge markers ≤100 m
 * apart and ≤0.5 m tall on snow; a windsock of ≈3.6 m on a 5–6 m mast;
 * a hangar door ≥17 × 4 m for a 16 m span; a fuel shed of drums and a
 * hand pump; a jumpers' hut] */
export const STRIP_SITE = {
  /** The edge markers: their spacing, how far outside the packed edge
   * they stand, and how many cross each end. */
  markers: { every: 50, out: 1.2, across: 6 },
  /** The gap kept between the strip's packed edge and anything built, on
   * top of the strip's clearance (`PLANE.strip.clear`), m. */
  gap: 4,
  /** THE HANGAR: along the strip (its door wall facing it), deep, the
   * eaves, the ridge's rise; the door's width and height. A LEAN-TO where
   * the hangar does not fit. */
  hangar: { width: 22, depth: 15, eave: 5.6, rise: 1.6, door: { width: 18, height: 4.8 } },
  leanTo: { width: 18, depth: 9, eave: 4.6, rise: 1.2, door: { width: 17, height: 4.2 } },
  /** THE FUEL SHED and THE HUT: width (along), depth, eaves, rise. */
  fuel: { width: 4.4, depth: 3.2, eave: 2.5, rise: 0.5 },
  hut: { width: 6.5, depth: 4.6, eave: 2.8, rise: 1.4 },
  /** The gap between two buildings, m; the most the snow under one may
   * fall across it (a plinth takes the rest), m. */
  apart: 4,
  fall: 2.4,
  /** THE WINDSOCK: the mast's height, the sock's length and mouth, how
   * far outside the edge it stands, and how far past the threshold. */
  sock: { mast: 5.8, length: 3.6, mouth: 0.9, out: 9, past: 60 },
  /** How far inside the map's edge anything is kept, m. */
  edge: 30,
  /** The gaps kept from a lift's line and a tunnel's lane, m. */
  lineGap: 14,
  tunnelGap: 10,
} as const;

/** What a building is. */
export type StripBuildingKind = "hangar" | "leanTo" | "fuel" | "hut";

/** A building beside the strip: its kind; its middle (x, z), the snow's
 * lowest under it (`base`) and its floor (the highest, a plinth over the
 * rest); the heading its FRONT faces (toward the strip, the heading
 * convention); its width along the front, its depth back from it, its
 * eaves over the floor and its ridge's rise, m; what its walls are made
 * of. */
export type StripBuilding = {
  kind: StripBuildingKind;
  x: number;
  z: number;
  base: number;
  floor: number;
  heading: number;
  width: number;
  depth: number;
  eave: number;
  rise: number;
  stuff: Stuff;
};

/** A marker by the strip: an edge board, a bough between two, or a board
 * of a threshold row; where it stands and the heading the strip runs. */
export type StripMarker = {
  kind: "board" | "bough" | "threshold";
  x: number;
  y: number;
  z: number;
};

/** THE SITE: the strip it is laid round; the side of the strip the apron
 * and the buildings stand on (1 the right of the take-off heading, −1 the
 * left); the markers; the buildings; the windsock's foot; the apron as a
 * rectangle in the strip's own frame (`along` from the strip's middle down
 * the take-off heading, `across` out to the apron's side), m. */
export type StripSite = {
  strip: Airstrip;
  side: number;
  markers: StripMarker[];
  buildings: StripBuilding[];
  sock: { x: number; y: number; z: number };
  apron: { along0: number; along1: number; across0: number; across1: number };
};

const T = STRIP_SITE;
const sites = new WeakMap<Level, StripSite>();
const near: number[] = [];

/** THE SITE round `level`'s strip, worked out once. */
export function stripSiteOf(level: Level): StripSite {
  let site = sites.get(level);
  if (!site) {
    site = layOut(level);
    sites.set(level, site);
  }
  return site;
}

/** A point of the strip's frame in the world: `along` from its middle
 * down the take-off heading, `across` to its right. */
export function stripPoint(
  strip: Airstrip,
  along: number,
  across: number,
): { x: number; z: number } {
  const fx = Math.sin(strip.heading);
  const fz = Math.cos(strip.heading);
  return { x: strip.x + fx * along + fz * across, z: strip.z + fz * along - fx * across };
}

/** (x, z) in the strip's frame: how far along it and across it. */
export function stripFrame(
  strip: Airstrip,
  x: number,
  z: number,
): { along: number; across: number } {
  const fx = Math.sin(strip.heading);
  const fz = Math.cos(strip.heading);
  const dx = x - strip.x;
  const dz = z - strip.z;
  return { along: dx * fx + dz * fz, across: dx * fz - dz * fx };
}

const felled = new WeakMap<Level, Uint8Array>();

/** Whether `level` is a map a strip is laid on: a ski area's, with no race
 * course or freestyle venue set over it (`createGame` sets one for every
 * mode but the free ride's and the field's) — the maps a jump plane may
 * fly from. A race's map fells nothing for a strip it never shows. */
export function stripLaid(level: Level): boolean {
  return (
    !!level.resort &&
    !level.slalom &&
    !level.downhill &&
    !level.superG &&
    !level.giantSlalom &&
    !level.speedSki &&
    !level.skiCross &&
    !level.slopestyle &&
    !level.halfpipe &&
    !level.moguls &&
    !level.aerials &&
    !level.skiJump
  );
}

/** THE AIR CLEARED OFF EACH END: a tree whose top stands into the surface
 * a strip's approach and climb-out are kept clear under — rising one in
 * twenty off the end (a small field's approach surface), as wide as the
 * corridor (`CORRIDOR`'s half-width, widening as it goes), read out as far
 * as `reach` m — is felled, as a field's owner tops the wood off its ends.
 * A wood left standing there took the wings off a plane climbing out at
 * fifteen metres (`plane-wings.ts`). */
export const STRIP_AIR = { rise: 1 / 20, reach: 600 } as const;

/** THE CANOPIES' LANDING AREA: the strip's middle is where a skydiver's
 * canopy is flown to (`chute-pilot.ts`), and a drop zone keeps a licensed
 * jumper's landing area this far from any hazard, m — every crown reaching
 * inside it is felled, so a canopy set down a few tens of metres off the
 * centre line in a crosswind is down on the snow, never in a tree. */
export const STRIP_DROP = 30;

/** THE TREES FELLED FOR THE STRIP: 1 for each of `level.trees` standing
 * within the strip's clearance of its centre line (`Airstrip.clear`) — a
 * clearing cut through the wood where the floor's only room is wooded —
 * up into the air off either end (`STRIP_AIR`), round the canopies'
 * landing area at its middle (`STRIP_DROP`), or inside a margin round
 * one of its buildings. */
export function stripFelled(level: Level): Uint8Array {
  let out = felled.get(level);
  if (out) return out;
  out = new Uint8Array(level.trees.length);
  const site = stripSiteOf(level);
  const s = site.strip;
  if (s.tier !== "village") {
    const half = s.length / 2;
    const need = s.width / 2 + s.clear;
    for (const i of treesNear(level, s.x, s.z, half + need, near)) {
      const t = level.trees[i];
      const f = stripFrame(s, t.x, t.z);
      const along = Math.max(-half, Math.min(half, f.along));
      if (hypot(f.along - along, f.across) <= need) out[i] = 1;
    }
    for (const i of treesNear(level, s.x, s.z, STRIP_DROP + 10, near)) {
      const t = level.trees[i];
      if (hypot(t.x - s.x, t.z - s.z) - t.crown <= STRIP_DROP) out[i] = 1;
    }
    const ends = [
      {
        y: level.groundAt(s.x + Math.sin(s.heading) * half, s.z + Math.cos(s.heading) * half),
        way: 1,
      },
      {
        y: level.groundAt(s.x - Math.sin(s.heading) * half, s.z - Math.cos(s.heading) * half),
        way: -1,
      },
    ];
    for (let i = 0; i < level.trees.length; i++) {
      const t = level.trees[i];
      const f = stripFrame(s, t.x, t.z);
      for (const e of ends) {
        const d = f.along * e.way - half;
        if (d < 0 || d > STRIP_AIR.reach) continue;
        if (Math.abs(f.across) > CORRIDOR.half + CORRIDOR.widen * d + t.crown) continue;
        if (t.y + t.height > e.y + STRIP_AIR.rise * d) out[i] = 1;
      }
    }
  }
  for (const b of site.buildings) {
    for (const i of treesNear(level, b.x, b.z, hypot(b.width, b.depth) / 2 + 3, near)) out[i] = 1;
  }
  felled.set(level, out);
  return out;
}

/** Whether (x, z) is on the apron's packed snow. */
export function onApron(site: StripSite, x: number, z: number): boolean {
  const f = stripFrame(site.strip, x, z);
  const a = site.apron;
  const across = f.across * site.side;
  return f.along >= a.along0 && f.along <= a.along1 && across >= a.across0 && across <= a.across1;
}

function layOut(level: Level): StripSite {
  const strip = airstripOf(level);
  const keep = keepOffs(level);
  const markers = markersOf(level, strip);
  // The side the town is on first: the jumpers walk out from it.
  const resort = level.resort;
  const home = resort ? resort.village : strip;
  const toward = stripFrame(strip, home.x, home.z).across >= 0 ? 1 : -1;
  const placed: StripBuilding[] = [];
  let side = toward;
  // Each first where it fells no tree, then where a clearing is cut for it
  // (`stripFelled`).
  found: for (const fell of [false, true]) {
    for (const s of [toward, -toward]) {
      const hangar =
        place(level, strip, keep, placed, s, "hangar", fell) ??
        place(level, strip, keep, placed, s, "leanTo", fell);
      if (!hangar) continue;
      side = s;
      placed.push(hangar);
      break found;
    }
  }
  for (const kind of ["fuel", "hut"] as const) {
    const b =
      place(level, strip, keep, placed, side, kind, false) ??
      place(level, strip, keep, placed, -side, kind, false) ??
      place(level, strip, keep, placed, side, kind, true) ??
      place(level, strip, keep, placed, -side, kind, true);
    if (b) placed.push(b);
  }
  // The apron: from the strip's edge out to the fronts of the buildings on
  // its side, along their whole run and the parking at the take-off end.
  const half = strip.length / 2;
  let along0 = -half + 5;
  let along1 = -half + 60;
  let across1 = strip.width / 2 + 12;
  for (const b of placed) {
    const f = stripFrame(strip, b.x, b.z);
    if (Math.sign(f.across) !== side) continue;
    along0 = Math.min(along0, f.along - b.width / 2 - 3);
    along1 = Math.max(along1, f.along + b.width / 2 + 3);
    across1 = Math.max(across1, Math.abs(f.across) - b.depth / 2 + 2);
  }
  return {
    strip,
    side,
    markers,
    buildings: placed,
    sock: sockOf(level, strip, keep, side),
    apron: { along0, along1, across0: strip.width / 2 - 1, across1 },
  };
}

/** The edge boards both sides every `markers.every` m or closer, a bough
 * between each pair, and a board row across both ends. */
function markersOf(level: Level, strip: Airstrip): StripMarker[] {
  const out: StripMarker[] = [];
  const half = strip.length / 2;
  const edge = strip.width / 2 + T.markers.out;
  const n = Math.ceil(strip.length / T.markers.every);
  const mark = (kind: StripMarker["kind"], along: number, across: number): void => {
    const p = stripPoint(strip, along, across);
    out.push({ kind, x: p.x, y: level.groundAt(p.x, p.z), z: p.z });
  };
  for (let i = 0; i <= n; i++) {
    const along = -half + (i / n) * strip.length;
    for (const s of [-1, 1]) {
      mark("board", along, s * edge);
      if (i < n) mark("bough", along + strip.length / n / 2, s * edge);
    }
  }
  const k = T.markers.across;
  for (const end of [-half - 1.5, half + 1.5]) {
    for (let i = 0; i < k; i++)
      mark("threshold", end, -strip.width / 2 + ((i + 0.5) / k) * strip.width);
  }
  return out;
}

const SIZES = {
  hangar: { ...T.hangar, stuff: "steel" },
  leanTo: { ...T.leanTo, stuff: "log" },
  fuel: { ...T.fuel, stuff: "steel" },
  hut: { ...T.hut, stuff: "log" },
} as const;

/** The first spot for a `kind` down its side of the strip from the
 * take-off end, or null. */
function place(
  level: Level,
  strip: Airstrip,
  keep: readonly Keep[],
  placed: readonly StripBuilding[],
  side: number,
  kind: StripBuildingKind,
  fell: boolean,
): StripBuilding | null {
  const size = SIZES[kind];
  const half = strip.length / 2;
  // The front stands outside the strip's clearance (a wingtip on the centre
  // line clears it by a span), the small buildings a step further out.
  const front =
    strip.width / 2 +
    Math.max(6, strip.clear) +
    T.gap +
    (kind === "hangar" || kind === "leanTo" ? 0 : 1);
  const across = side * (front + size.depth / 2);
  const heading = Math.atan2(-Math.cos(strip.heading) * side, Math.sin(strip.heading) * side);
  for (let along = -half + size.width / 2 + 6; along <= half - size.width / 2; along += 4) {
    const p = stripPoint(strip, along, across);
    const b = fits(level, p.x, p.z, heading, size, keep, placed, fell);
    if (b) return { kind, x: p.x, z: p.z, heading, ...size, ...b };
  }
  return null;
}

/** Whether a footprint `size` faced `heading` at (x, z) stands on room
 * enough: its base and floor, or null. */
function fits(
  level: Level,
  x: number,
  z: number,
  heading: number,
  size: { width: number; depth: number; eave: number; rise: number },
  keep: readonly Keep[],
  placed: readonly StripBuilding[],
  fell: boolean,
): { base: number; floor: number } | null {
  const hw = size.width / 2;
  const hd = size.depth / 2;
  const reach = hypot(hw, hd);
  const m = T.edge + reach;
  if (x < m || z < m || x > level.size - m || z > level.size - m) return null;
  if (!fell && treesNear(level, x, z, reach + 3, near).length > 0) return null;
  // Off every run, the hub, the water and every building by its size.
  if (stripRoomAt(level, x, z) < reach) return null;
  for (const b of placed) {
    if (hypot(b.x - x, b.z - z) < reach + hypot(b.width, b.depth) / 2 + T.apart) return null;
  }
  for (const k of keep) if (hypot(k.x - x, k.z - z) < k.r + reach) return null;
  // Across the footprint and a margin: no street, and the snow's fall.
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const u = (i / 2) * (hw + 2);
      const v = (j / 2) * (hd + 2);
      const px = x + fz * u + fx * v;
      const pz = z - fx * u + fz * v;
      if (streetMaskAt(level, px, pz) !== 0) return null;
      if (Math.abs(i) <= 1 && Math.abs(j) <= 1) {
        const y = level.groundAt(x + fz * u * 0.9 + fx * v * 0.9, z - fx * u * 0.9 + fz * v * 0.9);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
  }
  for (const i of [-1, 1]) {
    for (const j of [-1, 1]) {
      const y = level.groundAt(x + fz * hw * i + fx * hd * j, z - fx * hw * i + fz * hd * j);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  if (hi - lo > T.fall) return null;
  for (const p of liftPlans(level)) {
    const rx = x - p.lift.bottom.x;
    const rz = z - p.lift.bottom.z;
    const u = rx * p.dx + rz * p.dz;
    const v = rx * p.dz - rz * p.dx;
    if (u > -reach && u < p.length + reach && Math.abs(v) < T.lineGap + reach) return null;
  }
  for (const t of level.resort?.tunnels ?? []) {
    for (const q of t.points) {
      if (hypot(q.x - x, q.z - z) < reach + T.tunnelGap + t.width / 2) return null;
    }
  }
  return { base: lo, floor: hi + 0.15 };
}

/** The windsock off the far edge from the apron, abeam the landing's
 * touchdown — or, where something stands there, nearer the edge or on the
 * apron's side. */
function sockOf(
  level: Level,
  strip: Airstrip,
  keep: readonly Keep[],
  side: number,
): { x: number; y: number; z: number } {
  const th = stripFrame(strip, strip.land.threshold.x, strip.land.threshold.z).along;
  const way = Math.cos(strip.land.heading - strip.heading) > 0 ? 1 : -1;
  const half = strip.length / 2;
  const along = Math.max(-half + 10, Math.min(half - 10, th + way * T.sock.past));
  const out = strip.width / 2 + T.sock.out;
  for (const across of [-side * out, -side * (out - 4), side * out]) {
    const p = stripPoint(strip, along, across);
    const clear =
      treesNear(level, p.x, p.z, 2, near).length === 0 &&
      streetMaskAt(level, p.x, p.z) === 0 &&
      keep.every((k) => hypot(k.x - p.x, k.z - p.z) >= k.r * 0.5);
    if (clear) return { x: p.x, y: level.groundAt(p.x, p.z), z: p.z };
  }
  const p = stripPoint(strip, along, -side * out);
  return { x: p.x, y: level.groundAt(p.x, p.z), z: p.z };
}
