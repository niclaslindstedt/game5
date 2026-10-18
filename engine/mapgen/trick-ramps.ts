// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TRICK RAMPS ON EVERY SLOPE — the free ride's switch (`setTrickRamps`):
// built kickers laid down every piste of the ski area, off to one side of
// the run so the middle of it stays a run, in five steepnesses taken in
// turn — a 15° roller for a grab, a 25° and a 35° table for a flip, and
// two STEEP lips (45° and 55°) that throw a skier so high and so short that
// flat snow past them would break him: each of those stands in front of a
// RECEIVER, a mound across a gap whose back is the landing slope he comes
// down onto at the angle he falls at. Come at a steep lip too slowly and he
// drops into the gap and hits the receiver's face.
//
// EVERY RAMP IS BUILT AS A PARK BUILDS ONE, against the horizontal: the
// take-off a circular TRANSITION up from the ramp's foot, its radius picked
// so the push into the legs stays a skier's at speed (a lip of 55° on a 4 m
// radius would fold him); the steeper the lip, the tighter the radius and
// the taller it stands, but every take-off is about nine metres long. Past
// the lip a table carries a deck at the lip's height, then the landing
// slope at its angle to a floor dug a little under the run, and a run-out
// climbing back up to it; a gap jump's deck is the receiver's knoll.
//
// WHERE: on the stretches of a run that are straight from a ramp's foot to
// the bottom of its landing, no steeper than a park is built on, wide
// enough to keep a lane down the middle, and clear of every other run, ski
// route, lift line, station, kicker and drop — so nothing else the map laid
// is touched. Stamped onto a COPY of the ground, the trees it moved taken
// off, the runs' heights read back off it: the map handed in is left as it
// was (`base`), and nothing here draws from a stream, so no digest moves.

import type { Heightfield } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { angleDiff, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { landingEase, runoutEase } from "./kickers.ts";
import type {
  Kicker,
  Level,
  RampKind,
  Run,
  TrackPoint,
  TreeDef,
  TrickSize,
  Vec3,
} from "./types.ts";

/** One ramp as it is built, m and degrees: the lip's angle over the
 * horizontal and the transition's radius up to it; the full-height width
 * across; a gap jump's `gap` from the lip to the receiver's back and how
 * far its knoll stands under the lip (`knoll`); the level `deck` (the
 * knoll's, on a gap jump); the landing slope's length `fall` and the angle
 * it is built to. */
export type RampSpec = {
  lip: number;
  radius: number;
  width: number;
  gap: number;
  knoll: number;
  deck: number;
  fall: number;
  land: number;
};

export const TRICK_RAMPS = {
  kinds: {
    roller: { lip: 15, radius: 30, width: 6, gap: 0, knoll: 0, deck: 1, fall: 20, land: 18 },
    table: { lip: 25, radius: 22, width: 8, gap: 0, knoll: 0, deck: 5, fall: 20, land: 27 },
    big: { lip: 35, radius: 16, width: 9, gap: 0, knoll: 0, deck: 4, fall: 24, land: 32 },
    gap: { lip: 45, radius: 13, width: 9, gap: 7, knoll: 1.5, deck: 1, fall: 26, land: 34 },
    booter: { lip: 55, radius: 11, width: 8, gap: 5, knoll: 1.5, deck: 0.5, fall: 30, land: 37 },
  } satisfies Record<RampKind, RampSpec>,
  /** The order they come down a run in, and round again. */
  order: ["roller", "table", "gap", "big", "booter", "table"] as readonly RampKind[],
  /** How much further on than the ramp whose turn it is any other may be
   * laid instead, m. */
  wait: 60,
  /** Run between one run-out's end and the next ramp's foot, m. */
  apart: 35,
  /** Clear run under a top before the first ramp, and above the run's end
   * after the last run-out, m. */
  lead: 100,
  tail: 60,
  /** Most the line may turn from a ramp's foot to its landing's foot, rad,
   * and the most the run's middle may wander across off the straight
   * ramp's line from its foot to its run-out's end, m. */
  straight: 0.2,
  drift: 1.5,
  /** Steepest the line may fall under a ramp, m per m. */
  maxGrade: 0.32,
  /** The landing's floor under the run, m, and the run-out's length: a
   * base, and so much more for every metre of dig. */
  dig: { min: 0.5, max: 4 },
  runout: { base: 16, perDig: 6 },
  /** The lane kept down the run's middle, m either side of the line. */
  lane: 2,
  /** The side wall's width: a metre and so much more for every metre the
   * take-off stands, within these bounds, m. */
  wall: { perM: 0.9, min: 2, max: 5 },
  /** Room kept round a station from anything else on the map, m past the
   * run's half-width. */
  clear: 8,
} as const;

/** The park's size a ramp is scored and named as (R20's three). */
const SIZE: Record<RampKind, TrickSize> = {
  roller: "low",
  table: "medium",
  big: "high",
  gap: "high",
  booter: "high",
};

const RAD = Math.PI / 180;
const laid = new WeakMap<Level, Level>();

/** A ramp's built lengths, where the run falls at `fall` rad into its
 * foot: the take-off's (the transition turns the line's own fall up into
 * the lip's angle, so there is no kink at the foot) and its height over
 * the foot, and the length past the lip to the end of the landing slope. */
export function rampGeometry(
  kind: RampKind,
  fall = 0,
): { ramp: number; height: number; flight: number } {
  const z: RampSpec = TRICK_RAMPS.kinds[kind];
  return {
    ramp: z.radius * (Math.sin(z.lip * RAD) + Math.sin(fall)),
    height: z.radius * (Math.cos(fall) - Math.cos(z.lip * RAD)),
    flight: z.gap + z.deck + z.fall,
  };
}

/** A ramp laid: the kicker it is published as, and how it is built. */
type Laid = {
  k: Kicker;
  kind: RampKind;
  run: Run;
  /** Its lip's arc down the run and its middle's offset across it, m. */
  s: number;
  c: number;
  /** How steeply the run falls into its foot, rad. */
  fall: number;
  /** Altitudes: the take-off's foot, and the landing's floor. */
  foot: number;
  floor: number;
  runout: number;
  wall: number;
  /** The untouched snow it is built over. */
  under: (x: number, z: number) => number;
};

/** `level` with TRICK RAMPS down every piste of its ski area, or `level`
 * itself where it has no ski area or none of its runs carries one. The
 * same map is handed back for the same map asked again. */
export function setTrickRamps(level: Level): Level {
  if (level.trickRamps || !level.resort) return level;
  const had = laid.get(level);
  if (had) return had;
  const out = layRamps(level);
  laid.set(level, out);
  return out;
}

function layRamps(level: Level): Level {
  const resort = level.resort!;
  const blocked = obstacles(level);
  const ramps: Laid[] = [];
  resort.runs.forEach((run, n) => {
    if (run.kind !== "piste" || run.points.length < 2) return;
    ramps.push(...planRun(level, run, n, blocked));
  });
  if (ramps.length === 0) return level;
  // THE SURFACE the skis meet is the ramps' own, off their shape at any
  // point (a lip is sharper than the ground's grid can hold); the grid is
  // laid at its nodes for the drawing.
  const ground = stampGrid(level.ground, ramps);
  const index = indexRamps(ramps);
  const base = level.groundAt;
  const groundAt = (x: number, z: number): number => {
    const lift = rampsLift(index, x, z);
    return lift === null ? base(x, z) : base(x, z) + lift;
  };
  const e = 0.08;
  const normalAt = (x: number, z: number, out: Vec3): void => {
    if (rampsLift(index, x, z) === null) {
      level.normalAt(x, z, out);
      return;
    }
    const gx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e);
    const gz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    out.x = -gx * inv;
    out.y = inv;
    out.z = -gz * inv;
  };
  for (const r of ramps) r.k.y = groundAt(r.k.x, r.k.z);
  const at = (p: TrackPoint): TrackPoint => {
    const y = groundAt(p.x, p.z);
    return y === p.y ? p : { ...p, y };
  };
  const trees: TreeDef[] = [];
  for (const t of level.trees) {
    const y = groundAt(t.x, t.z);
    if (Math.abs(y - t.y) > 0.25) continue;
    trees.push(y === t.y ? t : { ...t, y });
  }
  return {
    ...level,
    ground,
    groundAt,
    normalAt,
    track: { ...level.track, points: level.track.points.map(at) },
    trees,
    kickers: (level.kickers ?? []).concat(ramps.map((r) => r.k)),
    resort: {
      ...resort,
      runs: resort.runs.map((r) =>
        ramps.some((x) => x.run === r) ? { ...r, points: r.points.map(at) } : r,
      ),
    },
    trickRamps: { base: level, count: ramps.length },
  };
}

/** Something a ramp keeps clear of: a point and its reach, m. */
type Obstacle = { x: number; z: number; r: number; run: number };

const BUCKET = 32;
type Grid = Map<number, Obstacle[]>;

function key(x: number, z: number): number {
  return Math.floor(x / BUCKET) * 65536 + Math.floor(z / BUCKET);
}

/** Every station of every run (by its index), the ski routes, the lift
 * lines and stations, and the kickers and drops already laid. */
function obstacles(level: Level): Grid {
  const grid: Grid = new Map();
  const add = (o: Obstacle): void => {
    const k = key(o.x, o.z);
    const at = grid.get(k);
    if (at) at.push(o);
    else grid.set(k, [o]);
  };
  const resort = level.resort!;
  resort.runs.forEach((run, n) => {
    for (const p of run.points) add({ x: p.x, z: p.z, r: p.width / 2, run: n });
  });
  for (const route of resort.routes ?? []) {
    for (const p of route.points) add({ x: p.x, z: p.z, r: p.width / 2 + 4, run: -1 });
  }
  for (const lift of resort.lifts) {
    const len = hypot(lift.top.x - lift.bottom.x, lift.top.z - lift.bottom.z);
    const steps = Math.max(1, Math.ceil(len / 8));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      add({
        x: lift.bottom.x + (lift.top.x - lift.bottom.x) * t,
        z: lift.bottom.z + (lift.top.z - lift.bottom.z) * t,
        r: 6,
        run: -1,
      });
    }
    add({ x: lift.bottom.x, z: lift.bottom.z, r: 30, run: -1 });
    add({ x: lift.top.x, z: lift.top.z, r: 30, run: -1 });
  }
  for (const k of level.kickers ?? []) {
    add({ x: k.x, z: k.z, r: k.ramp + k.landing + k.width / 2, run: -1 });
  }
  for (const c of level.cliffs ?? []) {
    add({ x: c.x, z: c.z, r: c.shelf + c.face + c.landing + c.width / 2, run: -1 });
  }
  return grid;
}

/** Whether anything but run `self` comes within `reach` of (x, z). */
function crowded(grid: Grid, x: number, z: number, reach: number, self: number): boolean {
  const far = reach + 40;
  const span = Math.ceil(far / BUCKET);
  const bx = Math.floor(x / BUCKET);
  const bz = Math.floor(z / BUCKET);
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      for (const o of grid.get((bx + i) * 65536 + (bz + j)) ?? []) {
        if (o.run === self) continue;
        if (hypot(o.x - x, o.z - z) < reach + o.r) return true;
      }
    }
  }
  return false;
}

/** The ramps down one run, in the order they are skied. */
function planRun(level: Level, run: Run, n: number, grid: Grid): Laid[] {
  const T = TRICK_RAMPS;
  const pts = run.points;
  const free = pts.map((p) => !crowded(grid, p.x, p.z, p.width / 2 + T.clear, n));
  const out: Laid[] = [];
  let next = pts[0].s + T.lead;
  let turn = n % T.order.length;
  let since = next;
  let side = n % 2 === 0 ? 1 : -1;
  for (let j = 0; j < pts.length; j++) {
    const p = pts[j];
    if (p.s < next) continue;
    const tries =
      p.s - since > T.wait
        ? T.order.map((_, t) => T.order[(turn + t) % T.order.length])
        : [T.order[turn]];
    let hit: Laid | null = null;
    for (const kind of tries) {
      hit = fits(level, run, j, kind, side, free) ?? fits(level, run, j, kind, -side, free);
      if (hit) break;
    }
    if (!hit) continue;
    hit.k.id = `${run.id}R${out.length + 1}`;
    out.push(hit);
    turn = (T.order.indexOf(hit.kind) + 1) % T.order.length;
    side = Math.sign(hit.c) === 1 ? -1 : 1;
    next = hit.s + rampGeometry(hit.kind).flight + hit.runout + T.apart;
    since = next;
  }
  return out;
}

/** The ramp of `kind` with its lip at station `j`, on `side` of the line,
 * or null where it will not stand. A ramp is STRAIGHT, down the line's
 * heading at its lip, and built over the untouched snow along its own
 * middle (`level.groundAt`): every height below is read there, so the
 * surface it gives is smooth however the run's stations bend under it. */
function fits(
  level: Level,
  run: Run,
  j: number,
  kind: RampKind,
  side: number,
  free: readonly boolean[],
): Laid | null {
  const T = TRICK_RAMPS;
  const z: RampSpec = T.kinds[kind];
  const pts = run.points;
  const p = pts[j];
  const step = pts[1].s - pts[0].s;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = fz;
  const rz = -fx;
  // The side wall, off the take-off's height: what keeps the lane clear.
  const wall = Math.max(
    T.wall.min,
    Math.min(T.wall.max, T.wall.perM * rampGeometry(kind).height + 1),
  );
  const c = side * (T.lane + wall + z.width / 2);
  const x = p.x + rx * c;
  const zz = p.z + rz * c;
  const at = (u: number): number => level.groundAt(x + fx * u, zz + fz * u);
  const into = Math.atan(Math.max(0, (at(-13) - at(-3)) / 10));
  const g = rampGeometry(kind, into);
  const foot = at(-g.ramp);
  const knollTop = foot + g.height - z.knoll;
  const below = at(g.flight);
  const dig = Math.max(
    T.dig.min,
    Math.min(T.dig.max, below - (knollTop - Math.tan(z.land * RAD) * z.fall)),
  );
  const floor = below - dig;
  const runout = T.runout.base + T.runout.perDig * dig;
  const from = p.s - g.ramp;
  const to = p.s + g.flight + runout;
  if (from < pts[0].s + T.lead || to > pts[pts.length - 1].s - T.tail) return null;
  const i0 = Math.max(0, Math.floor((from - pts[0].s) / step) - 2);
  const i1 = Math.min(pts.length - 1, Math.ceil((to - pts[0].s) / step) + 2);
  const iFlight = Math.min(pts.length - 1, Math.ceil((p.s + g.flight - pts[0].s) / step));
  const half = T.lane + wall + z.width;
  for (let i = i0; i <= i1; i++) {
    const q = pts[i];
    if (!free[i] || q.width / 2 < half) return null;
    if (i <= iFlight && Math.abs(angleDiff(q.heading, p.heading)) > T.straight) return null;
    // The run's middle stays off the straight ramp's side: the lane holds.
    const across = (q.x - p.x) * rx + (q.z - p.z) * rz;
    if (Math.abs(across) > T.drift) return null;
  }
  if ((at(-g.ramp) - below) / (g.ramp + g.flight) > T.maxGrade) return null;
  return {
    k: {
      id: "",
      x,
      z: zz,
      y: at(0),
      heading: p.heading,
      height: g.height,
      ramp: g.ramp,
      landing: g.flight + runout,
      width: z.width,
      onTrack: false,
      run: run.id,
      trick: true,
      size: SIZE[kind],
      rampKind: kind,
    },
    kind,
    run,
    s: p.s,
    c,
    fall: into,
    foot,
    floor,
    runout,
    wall,
    under: level.groundAt,
  };
}

/** The altitude of ramp `r`'s surface `u` metres past its lip, over a run
 * whose line stands at `line` there. Undefined outside the ramp. */
export function rampAltitude(
  kind: RampKind,
  fall: number,
  u: number,
  foot: number,
  floor: number,
  runout: number,
  line: number,
): number {
  const z: RampSpec = TRICK_RAMPS.kinds[kind];
  const g = rampGeometry(kind, fall);
  if (u <= 0) {
    const x = u + g.ramp - z.radius * Math.sin(fall);
    return foot + z.radius * Math.cos(fall) - Math.sqrt(Math.max(0, z.radius * z.radius - x * x));
  }
  const top = foot + g.height;
  if (u < z.gap) {
    // The gap: the take-off's back falling away, the trough at the run,
    // the receiver's back rising to its knoll.
    const knollTop = top - z.knoll;
    return Math.min(
      top,
      Math.max(line, top - 2 * Math.max(0, u - 1), knollTop - 1.5 * (z.gap - u)),
    );
  }
  const crest = top - z.knoll;
  const v = u - z.gap;
  if (v <= z.deck) return crest;
  const w = v - z.deck;
  if (w < z.fall) return crest - (crest - floor) * landingEase(w / z.fall);
  return floor + (line - floor) * runoutEase(Math.min(1, (w - z.fall) / runout));
}

/** How far ramp `r` lifts the snow at (x, z) over the untouched ground,
 * m (negative where it is dug), or null outside it: read in the ramp's own
 * frame, along it from the lip and across it from its middle — full height
 * across its width, a side wall either side of it, tilted with the
 * mountain's own fall across. */
function liftAt(r: Laid, x: number, z: number): number | null {
  const fx = Math.sin(r.k.heading);
  const fz = Math.cos(r.k.heading);
  const dx = x - r.k.x;
  const dz = z - r.k.z;
  const u = dx * fx + dz * fz;
  const g = rampGeometry(r.kind, r.fall);
  if (u <= -g.ramp || u >= g.flight + r.runout) return null;
  const inner = TRICK_RAMPS.kinds[r.kind].width / 2;
  const q = Math.abs(dx * fz - dz * fx);
  if (q >= inner + r.wall) return null;
  const mid = r.under(r.k.x + fx * u, r.k.z + fz * u);
  const lift = rampAltitude(r.kind, r.fall, u, r.foot, r.floor, r.runout, mid) - mid;
  return (1 - smoothstep(inner, inner + r.wall, q)) * lift;
}

/** A ramp's box on the ground, m: from the foot of the take-off to the
 * run-out's end, out past its side walls. */
function boxOf(r: Laid): { x0: number; z0: number; x1: number; z1: number } {
  const fx = Math.sin(r.k.heading);
  const fz = Math.cos(r.k.heading);
  const g = rampGeometry(r.kind, r.fall);
  const side = TRICK_RAMPS.kinds[r.kind].width / 2 + r.wall + 1;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const u of [-g.ramp - 1, g.flight + r.runout + 1]) {
    for (const v of [-side, side]) {
      const x = r.k.x + fx * u + fz * v;
      const z = r.k.z + fz * u - fx * v;
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
  }
  return { x0, z0, x1, z1 };
}

const CELL = 16;

/** The ramps standing over each `CELL`-metre square they reach. */
function indexRamps(ramps: readonly Laid[]): Map<number, Laid[]> {
  const out = new Map<number, Laid[]>();
  for (const r of ramps) {
    const b = boxOf(r);
    for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++) {
      for (let j = Math.floor(b.z0 / CELL); j <= Math.floor(b.z1 / CELL); j++) {
        const k = i * 65536 + j;
        const at = out.get(k);
        if (at) at.push(r);
        else out.set(k, [r]);
      }
    }
  }
  return out;
}

/** The lift the ramps give the snow at (x, z), m, or null off them all. */
function rampsLift(index: Map<number, Laid[]>, x: number, z: number): number | null {
  const at = index.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL));
  if (!at) return null;
  for (const r of at) {
    const lift = liftAt(r, x, z);
    if (lift !== null) return lift;
  }
  return null;
}

/** The ramps laid into a copy of `under`'s grid at every node they reach
 * — what the drawing reads. */
function stampGrid(under: Heightfield, ramps: readonly Laid[]): Heightfield {
  const ground: Heightfield = { ...under, data: under.data.slice() };
  const { cols, rows, cell, originX, originZ } = ground;
  for (const r of ramps) {
    const b = boxOf(r);
    const c0 = Math.max(0, Math.floor((b.x0 - originX) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((b.x1 - originX) / cell));
    const r0 = Math.max(0, Math.floor((b.z0 - originZ) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((b.z1 - originZ) / cell));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const lift = liftAt(r, originX + col * cell, originZ + row * cell);
        if (lift !== null) ground.data[row * cols + col] = under.data[row * cols + col] + lift;
      }
    }
  }
  return ground;
}
