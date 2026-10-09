// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE LENS MAY NOT STAND INSIDE, for one map: the `LineClear` the booms
// pull their arm in against (`camera-rigs.ts`). Three-free, so the suite
// reads it (`tests/world_render_test.ts`).
//
// THE SOLIDS ARE THE ONES AS DRAWN, not the physics' trunks. A skis only
// meets a trunk, but a lens meets the crown: a spruce is drawn as a cone of
// skirts from a tenth of its height to its tip (`forest.ts`), and a lens
// anywhere inside that cone is a frame of green. Beside the trees stand the
// course's own marks — every checkpoint's two stakes, and the start/finish
// arch's two legs and the span across the track over them (`start-arch.ts`).
//
// The trees near the line are asked of the engine's own hash (`treesNear`),
// once per question, for the circle round the whole line; the line is then
// walked in short steps from the skier's helmet out to the lens, and the
// share of it before the first step that lands inside something is the
// answer. A skier already under a bough (the helmet inside a crown) is not
// a reason to pull the lens onto him: the walk starts counting at the first
// step that is out in the open.
//
// THE RIDDEN BOOMS DO NOT PULL IN FOR THE TREES (`{ trees: false }`): a boom
// pulled in for every trunk flicking past jolts the lens at the skier. They
// pull in only for the course's own marks, and are PUSHED OFF THE TRUNKS
// instead — a metre of free space round the bark and no more, asked of
// `createTrunksNear` (`camera-rigs.ts`'s `repel`). The planted lenses (the
// broadcast, the death cam) pull in for the trees as well.

import {
  CABINS,
  cabinsOf,
  HELI,
  heliPoint,
  liftPlans,
  stationHouses,
  treesNear,
  type HeliState,
  type Level,
  type StationHouse,
} from "@engine";

import type { LineClear, Trunk, TrunksNear, Vec3 } from "./camera-rigs.ts";
import { layStations } from "./station-plan.ts";
import { ARCH, archPlan } from "./start-arch.ts";

/** How far off any solid the lens is kept, m — a near plane's worth and a
 * little more, so the branch nearest the lens is never cut open by it. */
export const LENS_PAD = 0.45;
/** Walk step along the line, m. */
const STEP = 0.3;
/** Where a drawn crown starts, as a share of the tree's height; and the
 * share of the generator's crown radius the drawing is (`forest.ts`). */
const CROWN_FROM = 0.08;
const CROWN_DRAWN = 0.95;
/** Checkpoint stake: height and radius, m (`gates.ts`). */
const STAKE = { height: 3.2, radius: 0.06 };

type Post = { x: number; z: number; y0: number; y1: number; r: number };
type Banner = {
  x: number;
  z: number;
  ux: number;
  uz: number;
  half: number;
  /** Half its thickness along the track, m. */
  thick: number;
  y0: number;
  y1: number;
};

export type LineClearOptions = {
  /** Whether the trees are solid to the lens (default true). */
  trees?: boolean;
  /** THE SOLIDS THAT MOVE — the free ride's piste machines as drawn this
   * frame (`groomer-scene.ts`), asked once per question: a lens is never
   * stood in a cab twelve tonnes of steel drives through. */
  movers?: () => readonly SolidBox[];
  /** Whether a gondola station's platform roof over its wheel is solid
   * (default false: a lens carried in a cabin rides in under it). The
   * helicopter's crash lens, flying after a body flung over the stations,
   * keeps out of it. */
  canopies?: boolean;
};

/** A box standing on the snow: its middle, its long axis (a unit plan
 * direction), its half length along that and half width across, and its
 * foot and top, m. */
export type SolidBox = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  halfLength: number;
  halfWidth: number;
  base: number;
  top: number;
};

/** THE HELICOPTER'S CABIN as a box the lens keeps out of, into `out`: the
 * X-ray cam's (`camera-xray.ts`) — a skier shed off the skid falls past it,
 * and a lens a metre off his bones is a frame of the cabin's inside. Its
 * middle is the cabin's, however the machine lies; the box stands upright
 * round it, as tall as the cabin is long, so a machine turned over is
 * still inside it. */
export function heliBox(h: HeliState, out: SolidBox): SolidBox {
  const b = HELI.body;
  const mid = heliPoint(h, { x: 0, y: (b.floor + b.roof) / 2, z: (b.nose - 1.6) / 2 });
  const half = (b.nose + 1.6) / 2;
  out.x = mid.x;
  out.z = mid.z;
  out.dx = Math.sin(h.heading);
  out.dz = Math.cos(h.heading);
  out.halfLength = half;
  out.halfWidth = b.width / 2;
  out.base = mid.y - half;
  out.top = mid.y + half - LENS_PAD;
  return out;
}

/** THE WHOLE HELICOPTER as a box the ladder's booms keep out of, into
 * `out`, while nobody rides it (`machines.ts`'s `solids`): a skier who
 * jumps or falls off the skid goes down past the airframe, and a chase
 * boom behind him would stand in the boom or the cabin. Nose to tail fin,
 * skids to the hub, about its heading. */
export function heliHull(h: HeliState, out: SolidBox): SolidBox {
  const b = HELI.body;
  const mid = heliPoint(h, { x: 0, y: (b.floor + b.roof) / 2, z: (b.nose + b.tail) / 2 });
  out.x = mid.x;
  out.z = mid.z;
  out.dx = Math.sin(h.heading);
  out.dz = Math.cos(h.heading);
  out.halfLength = (b.nose - b.tail) / 2;
  out.halfWidth = b.width / 2;
  out.base = mid.y - (b.floor + b.roof) / 2;
  out.top = mid.y + (b.roof - b.floor) / 2 + 0.6 - LENS_PAD;
  return out;
}

const inBox = (h: SolidBox, x: number, y: number, z: number): boolean => {
  if (y < h.base || y > h.top + LENS_PAD) return false;
  const ox = x - h.x;
  const oz = z - h.z;
  const along = ox * h.dx + oz * h.dz;
  const across = ox * h.dz - oz * h.dx;
  return Math.abs(along) < h.halfLength + LENS_PAD && Math.abs(across) < h.halfWidth + LENS_PAD;
};

export function createLineClear(level: Level, opts: LineClearOptions = {}): LineClear {
  const trees = opts.trees ?? true;
  const posts: Post[] = [];
  let banner: Banner | null = null;
  const last = level.checkpoints.length - 1;
  level.checkpoints.forEach((cp, index) => {
    if (index === last) {
      // The finish line has no stakes: the arch stands over it instead.
      const arch = archPlan(level, cp);
      for (const f of arch.feet) {
        posts.push({ x: f.x, z: f.z, y0: f.y - 1, y1: arch.top, r: ARCH.tube });
      }
      const face = Math.max(ARCH.tube, ARCH.panel / 2);
      banner = {
        x: arch.x,
        z: arch.z,
        ux: arch.rx,
        uz: arch.rz,
        half: arch.reach + ARCH.tube,
        thick: ARCH.tube,
        y0: arch.top - face,
        y1: arch.top + face,
      };
      return;
    }
    const rx = Math.cos(cp.heading);
    const rz = -Math.sin(cp.heading);
    const half = cp.width / 2 + 1;
    for (const side of [-1, 1]) {
      const x = cp.x + rx * half * side;
      const z = cp.z + rz * half * side;
      const y = level.groundAt(x, z);
      posts.push({ x, z, y0: y - 1, y1: y + STAKE.height, r: STAKE.radius });
    }
  });

  // Every lift's station houses: a lens carried up a chair and led off its
  // top past the house is pulled in short of the wall, never through it.
  const houses: SolidBox[] = liftPlans(level)
    .flatMap((p) => stationHouses(level, p))
    .map((h: StationHouse) => ({ ...h, dx: h.plan.dx, dz: h.plan.dz }));
  // ...and every cabin, its porch or terrace out front and the roof's
  // ridge over it: a lens behind a skier stood at a lodge's door, on his
  // way out of the afterski, is pulled in short of the terrace.
  for (const c of cabinsOf(level)) {
    const d = CABINS[c.kind];
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    houses.push({
      x: c.x + (fx * d.reach.front) / 2,
      z: c.z + (fz * d.reach.front) / 2,
      dx: fx,
      dz: fz,
      halfLength: (d.depth + d.reach.front) / 2,
      halfWidth: d.width / 2 + d.reach.side,
      base: c.base,
      top: c.y + d.ridge,
    });
  }
  // ...and, asked for, every gondola station's platform roof
  // (`station-build.ts`'s `platformRoof`: 6.5 m either way of its middle,
  // 0.6 m wider either side than the part's size, a 1.3 m fascia under a
  // roof and its snow).
  if (opts.canopies)
    for (const part of layStations(level, liftPlans(level)).parts) {
      if (part.kind !== "canopy") continue;
      houses.push({
        x: part.x,
        z: part.z,
        dx: Math.sin(part.yaw),
        dz: Math.cos(part.yaw),
        halfLength: 6.5,
        halfWidth: part.size / 2 + 0.6,
        base: part.y - 0.1,
        top: part.y + 1.9,
      });
    }
  let movers: readonly SolidBox[] = [];

  const near: number[] = [];

  const inside = (x: number, y: number, z: number): boolean => {
    for (const i of near) {
      const t = level.trees[i];
      const d = Math.hypot(x - t.x, z - t.z);
      const h = y - t.y;
      if (h < -LENS_PAD || h > t.height + LENS_PAD) continue;
      const f = h / t.height;
      const crown =
        f < CROWN_FROM ? 0 : t.crown * CROWN_DRAWN * Math.max(0, 1 - (f - CROWN_FROM) / 0.92);
      if (d < Math.max(t.radius, crown) + LENS_PAD) return true;
    }
    for (const p of posts) {
      if (y < p.y0 || y > p.y1 + LENS_PAD) continue;
      if (Math.hypot(x - p.x, z - p.z) < p.r + LENS_PAD) return true;
    }
    for (const h of houses) if (inBox(h, x, y, z)) return true;
    for (const h of movers) if (inBox(h, x, y, z)) return true;
    const b = banner as Banner | null;
    if (b && y > b.y0 - LENS_PAD && y < b.y1 + LENS_PAD) {
      const dx = x - b.x;
      const dz = z - b.z;
      const across = dx * b.ux + dz * b.uz;
      const along = -dx * b.uz + dz * b.ux;
      if (Math.abs(across) < b.half + LENS_PAD && Math.abs(along) < b.thick + LENS_PAD) return true;
    }
    return false;
  };

  return (from: Vec3, to: Vec3): number => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return 1;
    movers = opts.movers?.() ?? [];
    if (trees) {
      treesNear(
        level,
        (from.x + to.x) / 2,
        (from.z + to.z) / 2,
        Math.hypot(dx, dz) / 2 + 5 + LENS_PAD,
        near,
      );
    }
    const n = Math.max(1, Math.ceil(len / STEP));
    let open = false;
    let last = 0;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const hit = inside(from.x + dx * s, from.y + dy * s, from.z + dz * s);
      if (!hit) {
        open = true;
        last = s;
      } else if (open) {
        return last;
      }
    }
    return 1;
  };
}

/** The trunks the ridden booms are pushed off: every tree's trunk as the
 * physics has it (`Level.trees`' radius), from a metre under its foot to its
 * tip. */
export function createTrunksNear(level: Level): TrunksNear {
  const ids: number[] = [];
  return (x: number, z: number, reach: number, out: Trunk[]): Trunk[] => {
    out.length = 0;
    for (const i of treesNear(level, x, z, reach, ids)) {
      const t = level.trees[i];
      out.push({ id: i, x: t.x, z: t.z, r: t.radius, y0: t.y - 1, y1: t.y + t.height });
    }
    return out;
  };
}
