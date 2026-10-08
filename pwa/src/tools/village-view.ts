// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S VILLAGE VIEWS (`make buildings`, or `make world
// ARGS="--free --views=village"`): the ski area's own buildings
// (`village-build.ts`, `mountain-build.ts`) through the game's own
// renderer, where the map stands them (`cabinsOf`'s resort kinds).
//
//   * village-<kind> — the first building of a kind (the base lodge, the
//     ticket office, the rental, the ski school, the first aid, a hotel, the
//     garage, the pump house, the mountain restaurant, the patrol hut) from
//     three quarters off its front at a skier's eye, as a 1280 × 720 frame;
//   * village-plaza — the BASE from over the hub, looking across it at the
//     village as a skier coming down the last run sees it;
//   * village-lift — the base from high up the main lift's line, looking
//     down on it;
//   * village-air — the whole village from the air over the valley, its
//     streets, blocks, square and car park laid out under the lens;
//   * village-street — down the main street at a walker's eye from one
//     end, the shops and the sidewalks either side;
//   * village-square — the square from across the main street, the bus
//     stop, the crossing and the base lodge behind;
//   * village-back — down the back street, the parked strip and its
//     windrows;
//   * village — THE SHEET: every kind on the map from its front three
//     quarters, its back three quarters and from far off, a row a kind.

import {
  CABINS,
  resortBuildingsOf,
  cabinsOf,
  streetAt,
  villageOf,
  type StreetPoint,
  type Cabin,
  type CabinKind,
  type Level,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

const KINDS: readonly CabinKind[] = [
  "restaurant",
  "ticket",
  "rental",
  "school",
  "firstAid",
  "hotel",
  "garage",
  "pumpHouse",
  "house",
  "apartments",
  "shop",
  "church",
  "mountainHut",
  "patrol",
];

/** The views this module answers for the world lab. */
export const VILLAGE_VIEWS = [
  "village",
  "village-plaza",
  "village-lift",
  "village-air",
  "village-street",
  "village-square",
  "village-back",
  ...KINDS.map((k) => `village-${k}`),
] as const;

/** The sheet's columns: azimuth off the building's front (degrees,
 * clockwise from above), the lens's height over the snow, its distance in
 * the building's sizes. */
const ANGLES = [
  { name: "front 3/4", az: 35, high: 1.8, dist: 1.25 },
  { name: "back 3/4", az: 200, high: 4, dist: 1.25 },
  { name: "far", az: -20, high: 12, dist: 4 },
];

/** A lens on one building, `az` degrees round from its front. */
export function buildingPose(
  level: Level,
  c: Cabin,
  az: number,
  high: number,
  dist: number,
): LensPose {
  const d = CABINS[c.kind];
  const size = Math.max(9, Math.hypot(d.width, d.depth + d.reach.front));
  // The middle of the walls and what stands before them.
  const fwd = d.reach.front / 2;
  const cx = c.x + Math.sin(c.heading) * fwd;
  const cz = c.z + Math.cos(c.heading) * fwd;
  const a = c.heading + (az * Math.PI) / 180;
  const r = size * dist;
  const ex = cx + Math.sin(a) * r;
  const ez = cz + Math.cos(a) * r;
  const mid = c.y + d.walls * 0.45;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + high, mid - 2), z: ez },
    target: { x: cx, y: mid, z: cz },
    fov: 55,
    roll: 0,
  };
}

/** The base's heart — the lodge, the buildings round it within 150 m —
 * its middle, its spread and the way the lodge faces. */
function baseOf(level: Level): { x: number; y: number; z: number; r: number; face: number } | null {
  const all = resortBuildingsOf(cabinsOf(level)).filter((c) => !isMountain(c.kind));
  const lodge = all.find((c) => c.kind === "restaurant") ?? all[0];
  if (!lodge) return null;
  const v = all.filter((c) => Math.hypot(c.x - lodge.x, c.z - lodge.z) < 150);
  let x = 0;
  let y = 0;
  let z = 0;
  for (const c of v) {
    x += c.x;
    y += c.y;
    z += c.z;
  }
  x /= v.length;
  y /= v.length;
  z /= v.length;
  let r = 30;
  for (const c of v) r = Math.max(r, Math.hypot(c.x - x, c.z - z));
  return { x, y, z, r, face: lodge.heading };
}

function isMountain(kind: CabinKind): boolean {
  return kind === "mountainHut" || kind === "patrol";
}

/** A lens `high` m over the street `id` at arc `s`, looking `ahead` m
 * along it (back the way it runs when `ahead` is negative), `lat` m to
 * its right. */
function streetPose(
  level: Level,
  id: string,
  s: number,
  ahead: number,
  lat: number,
  high: number,
): LensPose | null {
  const v = villageOf(level);
  const st = v?.streets.find((q) => q.id === id);
  if (!st) return null;
  const p: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  const q: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  streetAt(st, s, p);
  streetAt(st, s + ahead, q);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  const ex = p.x + rx * lat;
  const ez = p.z + rz * lat;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + high, z: ez },
    target: { x: q.x + rx * lat * 0.3, y: level.groundAt(q.x, q.z) + high * 0.6, z: q.z },
    fov: 60,
    roll: 0,
  };
}

type Lab = {
  level: Level;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** The village views, keyed by name. */
export function villageShots(lab: Lab): Record<string, () => string> {
  const first = (kind: CabinKind) => cabinsOf(lab.level).find((c) => c.kind === kind) ?? null;
  const shots: Record<string, () => string> = {};
  const frame = (pose: LensPose, note: string) => {
    lab.setOverride(pose);
    lab.still();
    lab.setOverride(null);
    return note;
  };
  for (const kind of KINDS) {
    shots[`village-${kind}`] = () => {
      const c = first(kind);
      if (!c) return `no ${kind} on this map`;
      const v = ANGLES[0];
      return frame(buildingPose(lab.level, c, v.az, v.high, v.dist), `${c.id}, the ${kind}`);
    };
  }
  shots["village-plaza"] = () => {
    const b = baseOf(lab.level);
    if (!b) return "no village on this map";
    // From out over the hub, in front of the buildings, looking back at them.
    const d = b.r * 0.6 + 55;
    const ex = b.x + Math.sin(b.face) * d;
    const ez = b.z + Math.cos(b.face) * d;
    return frame(
      {
        eye: { x: ex, y: lab.level.groundAt(ex, ez) + 24, z: ez },
        target: { x: b.x, y: b.y + 4, z: b.z },
        fov: 60,
        roll: 0,
      },
      `the base from the plaza, ${b.r.toFixed(0)} m across`,
    );
  };
  shots["village-lift"] = () => {
    const b = baseOf(lab.level);
    if (!b) return "no village on this map";
    const d = b.r * 1.4 + 160;
    const ex = b.x + Math.sin(b.face) * d;
    const ez = b.z + Math.cos(b.face) * d;
    return frame(
      {
        eye: { x: ex, y: Math.max(lab.level.groundAt(ex, ez) + 30, b.y + 70), z: ez },
        target: { x: b.x, y: b.y, z: b.z },
        fov: 55,
        roll: 0,
      },
      "the base from up the mountain",
    );
  };
  shots["village-air"] = () => {
    const v = villageOf(lab.level);
    if (!v) return "no village streets on this map";
    const { x, z } = v.centre;
    // From out over the valley, high, looking back up at the village.
    const ex = x + 40;
    const ez = z + v.valley * 230;
    return frame(
      {
        eye: { x: ex, y: lab.level.groundAt(x, z) + 150, z: ez },
        target: { x, y: lab.level.groundAt(x, z), z: z + v.valley * 20 },
        fov: 55,
        roll: 0,
      },
      `the village from the air, ${v.streets.length} streets`,
    );
  };
  shots["village-street"] = () => {
    const v = villageOf(lab.level);
    const id = v?.main[0];
    const pose = id ? streetPose(lab.level, id, 6, 60, 4.4, 1.7) : null;
    if (!pose) return "no village streets on this map";
    return frame(pose, "down the main street");
  };
  shots["village-square"] = () => {
    const v = villageOf(lab.level);
    const sq = v?.areas.find((a) => a.kind === "square");
    if (!v || !sq) return "no village square on this map";
    // From the main street's far sidewalk across from it, looking over the
    // crossing at the square and the lodge behind it.
    const main = v.streets.filter((s) => v.main.includes(s.id));
    let best: { st: (typeof main)[number]; s: number } | null = null;
    let d = Infinity;
    for (const st of main) {
      for (const p of st.points) {
        const e = Math.hypot(p.x - sq.x - 12, p.z - sq.z);
        if (e < d) {
          d = e;
          best = { st, s: p.s };
        }
      }
    }
    if (!best) return "no main street by the square";
    const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
    streetAt(best.st, best.s, at);
    const hub = v.valley > 0 ? 1 : -1;
    // The far side's sidewalk: the main street's reach on the valley side.
    const lat = -hub * 5.6;
    const ex = at.x + Math.cos(at.heading) * lat;
    const ez = at.z - Math.sin(at.heading) * lat;
    return frame(
      {
        eye: { x: ex, y: lab.level.groundAt(ex, ez) + 1.8, z: ez },
        target: { x: sq.x - 6, y: sq.y + 3.5, z: sq.z },
        fov: 64,
        roll: 0,
      },
      "the square across the main street",
    );
  };
  shots["village-back"] = () => {
    const v = villageOf(lab.level);
    const id = v?.back[0];
    const pose = id ? streetPose(lab.level, id, 6, 50, -2, 1.7) : null;
    if (!pose) return "no back street on this map";
    return frame(pose, "down the back street");
  };
  shots.village = () => {
    const rows = KINDS.map((k) => [k, first(k)] as const).filter(([, c]) => c);
    if (rows.length === 0) return "no ski area buildings on this map";
    const cellW = 426;
    const cellH = 240;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * ANGLES.length;
    sheet.height = cellH * rows.length;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    rows.forEach(([kind, c], row) => {
      ANGLES.forEach((v, col) => {
        const x = col * cellW;
        const y = row * cellH;
        if (c) {
          lab.setOverride(buildingPose(lab.level, c, v.az, v.high, v.dist));
          lab.still();
          g.drawImage(lab.canvas, x, y, cellW, cellH);
        }
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(x, y, cellW, 20);
        g.fillStyle = "#fff";
        g.fillText(`${kind} ${c?.id ?? ""} · ${v.name}`, x + 6, y + 14);
      });
    });
    lab.setOverride(null);
    // The sheet stands in for the stage until the next view.
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return `${rows.length} kinds from three sides`;
  };
  return shots;
}
