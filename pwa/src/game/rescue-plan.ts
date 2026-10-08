// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE ON THE NEXT RUN, PLANNED — where the air ambulance that takes
// an INJURED skier off the mountain (the run before, `GameState.gore`) has set down,
// and what it and its crew are doing at every moment after the player,
// skiing down the next run, first comes within sight of the spot.
// Three-free and DOM-free, so the suite reads it; `rescue-view.ts` draws it.
// The research behind every number is `docs/rescue.md`.
//
// WHERE IT LANDS (`planRescue`): on a fairly flat patch 22–42 m from him,
// the rotor's whole disc clear of the trees, of a lift's line and of the
// snow round it, and off the groomed run where there is room — a slope
// landing is made ACROSS the slope (the uphill skid set first, the nose
// along the contour), never facing down it (the tail rotor). Of the two
// ways along the contour it faces the one that puts him AHEAD, and its
// door on his side, so the crew come to it from the front quarter, in the
// pilot's sight, never past the tail; and a patch level with him, or below
// him, is taken before one above (the disc sits lowest on the uphill side,
// and a load is carried down, not up).
//
// WHAT HAPPENS (`rescueAt`, a pure function of the seconds since it was
// started — `RescueClock`): the four of them knelt by him on the stretcher
// lift it together, carry it to the cabin at a walk on a curve that ends
// square to the door, lift it to the floor and walk it in — the doctor
// and the paramedic stepping up first to take it — then the two patrollers
// walk clear and turn to watch; the machine, its rotor turning all the
// while, comes up into a hover, turns down the valley, dips its nose and
// goes. Started when the player first comes within `RESCUE.reach`, so he
// sees it; the carry alone takes longer than he takes to ski past.

import { HELI, fromEuler, rotate, treesNear, type CrowdBody, type Level, type Vec3 } from "@engine";

import { railOf, RESCUE_STRIDE, type CrewMove, type Hand } from "./rescue-crew.ts";

const R = HELI.rotor.radius;

/** The rescue's numbers, m, s, m/s. */
export const RESCUE = {
  /** How near the player first comes before it starts, m. */
  reach: 180,
  site: {
    /** The rings searched round him, nearest the middle first, m. */
    radii: [30, 26, 34, 22, 38, 42],
    /** The steepest the skids are set on (a flight manual's 6–10°), as a
     * gradient, and the steepest taken when nothing flatter is clear. */
    slope: 0.15,
    slopeMost: 0.24,
    /** The room the disc keeps from a trunk and a lift's line, m past its
     * radius; the room the carry keeps from a trunk, m. */
    trees: 2.5,
    lift: 22,
    path: 1.6,
    /** The gap kept under the disc's rim, m. */
    rim: 1.4,
  },
  /** THE STRETCHER: a vacuum mattress on a frame, m — its length, its
   * width, and where the bearers' hands hold its rails (across and along
   * from its middle). */
  stretcher: { length: 2.0, width: 0.56, rail: 0.31, along: 0.72 },
  /** The walking pace with a stretcher between four, m/s. */
  walk: 0.8,
  /** THE CABIN DOOR on the side he is loaded through: how far aft of the
   * skid datum's middle its middle is, and how far outboard the skin, m. */
  door: { z: 1.4, skin: HELI.body.width / 2 },
  /** Seconds each part of it takes. */
  time: {
    kneel: 2.5,
    rise: 2.2,
    raise: 1.0,
    inch: 0.9,
    climb: 1.8,
    slide: 2.8,
    turn: 1.0,
    clear: 11,
    spool: 1.6,
    hover: 4.0,
    away: 40,
  },
  /** How far the stretcher's front end is carried short of the skin before
   * it is raised, then over the floor's edge, m. */
  short: 0.42,
  over: 0.06,
  /** The hover, m over the snow, and the climb-out: the acceleration, the
   * cruise and the climb, m/s², m/s, m/s. */
  hover: 4.5,
  accel: 2.4,
  cruise: 38,
  climb: 2.2,
} as const;

/** Who carries, at his corner: across (+ his right) and along (+ ahead)
 * of the stretcher's middle, the hand on its rail, and what he is. */
export type Bearer = {
  role: "doctor" | "paramedic" | "patrol";
  body: CrowdBody;
  across: number;
  along: number;
  hand: Exclude<Hand, null>;
  /** Whether he flies with the casualty. */
  boards: boolean;
};

const S = RESCUE.stretcher;
export const BEARERS: readonly Bearer[] = [
  { role: "doctor", body: "woman", across: -1, along: 1, hand: "R", boards: true },
  { role: "paramedic", body: "man", across: 1, along: 1, hand: "L", boards: true },
  { role: "patrol", body: "man", across: -1, along: -1, hand: "R", boards: false },
  { role: "patrol", body: "freerider", across: 1, along: -1, hand: "L", boards: false },
];

type P2 = { x: number; z: number };

export type RescuePlan = {
  /** Where he lay (the stretcher's middle at the start), the snow there. */
  spot: Vec3;
  /** THE MACHINE as it sits: its skid datum, heading, and the attitude the
   * snow under its skids leaves it at; the side its door is on (+1 its
   * right), the heading it leaves on. */
  site: Vec3 & { heading: number; pitch: number; roll: number; side: 1 };
  away: number;
  /** The way out of the door (horizontal), and the floor's height in the
   * door, m. */
  out: P2;
  floor: number;
  /** THE CARRY: the path's points and their arc lengths, m. */
  path: { pts: P2[]; s: number[]; length: number };
  /** Where the stretcher's middle stops: carried (`end`), and in the cabin. */
  end: P2;
  cabin: P2;
  /** The moments each part starts, s from the start. */
  at: {
    rise: number;
    carry: number;
    raise: number;
    inch: number;
    climb: number;
    slide: number;
    clear: number;
    lift: number;
    gone: number;
  };
};

const hy = (x: number, z: number): number => Math.hypot(x, z);
const fwdOf = (h: number): P2 => ({ x: Math.sin(h), z: Math.cos(h) });
const rightOf = (h: number): P2 => ({ x: Math.cos(h), z: -Math.sin(h) });
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const ease = (u: number): number => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The downhill way over a reach, horizontal, unit (or none on the flat). */
function downhill(level: Level, x: number, z: number, d: number): P2 | null {
  const gx = level.groundAt(x - d, z) - level.groundAt(x + d, z);
  const gz = level.groundAt(x, z - d) - level.groundAt(x, z + d);
  const g = hy(gx, gz);
  return g / (2 * d) < 0.02 ? null : { x: gx / g, z: gz / g };
}

/** How far (x, z) is from the segment a–b, horizontally. */
function toSegment(x: number, z: number, a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
  return hy(x - a.x - dx * t, z - a.z - dz * t);
}

const near: number[] = [];

/** THE HEADING it is set down on at (x, z): along the contour — of its two
 * ways the one that puts him on its RIGHT, the side its door and hoist are
 * on — or, on the flat, with him ahead and to the right of the door. And
 * how far ahead of the middle he is, as a share of the way to him. */
function headingAt(
  level: Level,
  x: number,
  z: number,
  spot: P2,
): { heading: number; ahead: number } {
  const to = { x: spot.x - x, z: spot.z - z };
  const d = hy(to.x, to.z) || 1;
  const fall = downhill(level, x, z, 6);
  let heading: number;
  if (fall) {
    const a = Math.atan2(fall.z, -fall.x);
    const rt = rightOf(a);
    heading = to.x * rt.x + to.z * rt.z >= 0 ? a : a + Math.PI;
  } else heading = Math.atan2(to.x, to.z) - Math.PI / 3;
  heading = wrap(heading);
  const f = fwdOf(heading);
  return { heading, ahead: (to.x * f.x + to.z * f.z) / d };
}

/** A patch's cost to land on, or null where it cannot be landed on. */
function siteCost(level: Level, x: number, z: number, spot: Vec3, r: number, relax: boolean) {
  const edge = R + 6;
  if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) return null;
  const y = level.groundAt(x, z);
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(x, z, n);
  const slope = Math.sqrt(Math.max(0, 1 - n.y * n.y)) / Math.max(0.2, n.y);
  if (slope > (relax ? RESCUE.site.slopeMost : RESCUE.site.slope)) return null;
  // The disc's rim kept clear of the snow round it.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const g = level.groundAt(x + Math.sin(a) * R, z + Math.cos(a) * R);
    if (g - y > HELI.rotor.hub - RESCUE.site.rim) return null;
  }
  // The skids as they would sit, along the contour: inside the limit too.
  const way = headingAt(level, x, z, spot);
  const sit = seated(level, x, z, way.heading);
  const most = Math.atan(relax ? RESCUE.site.slopeMost : RESCUE.site.slope);
  if (Math.abs(sit.pitch) > most || Math.abs(sit.roll) > most) return null;
  if (treesNear(level, x, z, R + (relax ? 0.8 : RESCUE.site.trees), near).length > 0) return null;
  for (const lift of level.resort?.lifts ?? []) {
    if (toSegment(x, z, lift.bottom, lift.top) < R + RESCUE.site.lift) return null;
  }
  // The carry's way to it, clear of trunks.
  const d = hy(x - spot.x, z - spot.z);
  for (let t = 2; t < d - R * 0.5; t += 1) {
    const px = spot.x + ((x - spot.x) * t) / d;
    const pz = spot.z + ((z - spot.z) * t) / d;
    if (treesNear(level, px, pz, RESCUE.site.path, near).length > 0) return null;
  }
  // Off the groomed run where it can be; level with him or below him; as
  // near the middle ring as there is room.
  let piste = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    piste += level.packedAt(x + Math.sin(a) * R * 0.8, z + Math.cos(a) * R * 0.8);
  }
  const rise = y - spot.y;
  // He ahead of the door, not off past the tail.
  const behind = Math.max(0, 0.15 - way.ahead);
  return (
    30 * behind +
    12 * piste +
    3 * Math.abs(rise) +
    3 * Math.max(0, rise) +
    40 * slope +
    Math.abs(r - 30)
  );
}

/** THE PATCH, its heading along the contour and its door's side. */
function pickSite(level: Level, spot: Vec3) {
  for (const relax of [false, true]) {
    let best: { x: number; z: number; cost: number } | null = null;
    for (const r of [...RESCUE.site.radii, ...(relax ? [50, 60, 18] : [])]) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = spot.x + Math.sin(a) * r;
        const z = spot.z + Math.cos(a) * r;
        const cost = siteCost(level, x, z, spot, r, relax);
        if (cost !== null && (!best || cost < best.cost)) best = { x, z, cost };
      }
    }
    if (best) return best;
  }
  // Nowhere clear: the flattest seat round him, the fewest trunks under
  // the disc, wherever it is (a steep face in the woods has no good one).
  let flat = { x: spot.x + 30, z: spot.z, cost: Infinity };
  const edge = R + 6;
  for (const r of [22, 30, 40, 50, 60]) {
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const x = spot.x + Math.sin(a) * r;
      const z = spot.z + Math.cos(a) * r;
      if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) continue;
      const sit = seated(level, x, z, headingAt(level, x, z, spot).heading);
      const cost =
        Math.max(Math.abs(sit.pitch), Math.abs(sit.roll)) +
        0.05 * treesNear(level, x, z, R, near).length;
      if (cost < flat.cost) flat = { x, z, cost };
    }
  }
  return flat;
}

/** The ground under the four skid ends: the datum's height and the
 * attitude the skids are left at. */
function seated(level: Level, x: number, z: number, heading: number) {
  const f = fwdOf(heading);
  const rt = rightOf(heading);
  const sk = HELI.skid;
  const at = (side: number, along: number) =>
    level.groundAt(
      x + rt.x * side * (sk.track / 2) + f.x * along,
      z + rt.z * side * (sk.track / 2) + f.z * along,
    );
  const lf = at(-1, sk.front);
  const rf = at(1, sk.front);
  const lb = at(-1, sk.back);
  const rb = at(1, sk.back);
  // Set down uphill skid first: it rests on the highest of its ends.
  const y = Math.max((lf + rf + lb + rb) / 4, Math.max(lf, rf, lb, rb) - 0.08);
  const pitch = Math.atan2((lf + rf - lb - rb) / 2, sk.front - sk.back);
  const roll = Math.atan2((lf + lb - rf - rb) / 2, sk.track);
  return { y, pitch, roll };
}

/** A point of the machine as it sits, body frame (x right, y up, z ahead,
 * off the skid datum), in the world. */
function onMachine(site: RescuePlan["site"], p: Vec3): Vec3 {
  const w = rotate(fromEuler(site.heading, site.pitch, site.roll), p);
  return { x: site.x + w.x, y: site.y + w.y, z: site.z + w.z };
}

/** THE PLAN for a skier found INJURED lying at `spot`. */
export function planRescue(level: Level, spot: { x: number; z: number }): RescuePlan {
  const sy = level.groundAt(spot.x, spot.z);
  const c: Vec3 = { x: spot.x, y: sy, z: spot.z };
  const best = pickSite(level, c);
  const heading = headingAt(level, best.x, best.z, c).heading;
  const rt = rightOf(heading);
  const side = 1 as const;
  const sit = seated(level, best.x, best.z, heading);
  const site = { x: best.x, y: sit.y, z: best.z, heading, pitch: sit.pitch, roll: sit.roll, side };
  // Leaving: down the valley, the fall line read over a long reach.
  const valley = downhill(level, best.x, best.z, 60) ?? downhill(level, best.x, best.z, 200);
  const away = valley ? Math.atan2(valley.x, valley.z) : heading;
  const out = { x: rt.x * side, z: rt.z * side };
  const door = onMachine(site, {
    x: side * RESCUE.door.skin,
    y: HELI.body.floor,
    z: RESCUE.door.z,
  });
  // The stretcher's middle where the carry ends (its front end `short` off
  // the skin) and where it ends in the cabin.
  const off = RESCUE.door.skin + S.length / 2 + RESCUE.short;
  const mid = onMachine(site, { x: 0, y: 0, z: RESCUE.door.z });
  const end = { x: mid.x + out.x * off, z: mid.z + out.z * off };
  const cabin = { x: mid.x, z: mid.z };
  // THE CARRY: a curve from where he lay that comes in square to the door.
  const gap = hy(end.x - c.x, end.z - c.z);
  const k = clamp(0.45 * gap, 3, 14);
  const ctrl = { x: end.x + out.x * k, z: end.z + out.z * k };
  const pts: P2[] = [];
  const s: number[] = [];
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const d = u * u;
    const p = { x: a * c.x + b * ctrl.x + d * end.x, z: a * c.z + b * ctrl.z + d * end.z };
    s.push(i === 0 ? 0 : s[i - 1] + hy(p.x - pts[i - 1].x, p.z - pts[i - 1].z));
    pts.push(p);
  }
  const length = s[N];
  const T = RESCUE.time;
  const rise = T.kneel;
  const carry = rise + T.rise;
  const raise = carry + length / RESCUE.walk;
  const inch = raise + T.raise;
  const climb = inch + T.inch;
  const slide = climb + T.climb;
  const clear = slide + T.slide;
  const lift = slide + T.slide * 0.55 + 2 * T.turn + T.clear + 1;
  return {
    spot: c,
    site,
    away,
    out,
    floor: door.y,
    path: { pts, s, length },
    end,
    cabin,
    at: { rise, carry, raise, inch, climb, slide, clear, lift, gone: lift + T.away },
  };
}

/** Where along the carry the stretcher's middle is at arc `d`, and its
 * heading there. */
function along(plan: RescuePlan, d: number): { x: number; z: number; heading: number } {
  const { pts, s, length } = plan.path;
  const at = clamp(d, 0, length);
  let i = 0;
  while (i < s.length - 2 && s[i + 1] < at) i++;
  const span = s[i + 1] - s[i] || 1;
  const u = (at - s[i]) / span;
  const a = pts[i];
  const b = pts[i + 1];
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** One bearer at a moment: where he stands, which way he faces, how he
 * is posed and whether he is drawn. */
export type CrewPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  move: CrewMove;
  shown: boolean;
};

/** How many spans of `RAISE` a bearer raises or lowers his corner to hold
 * the stretcher level on a slope: past it (a steep face) it tilts. */
const LEVEL_MOST = 1.6;

/** THE MOMENT: the machine, the stretcher (the middle of its rails and its
 * attitude) and the four. */
export type RescueFrame = {
  heli: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    roll: number;
    /** The rotor's share of its rpm, the thrust as a share of the weight,
     * and whether it is gone from sight. */
    spool: number;
    thrust: number;
    shown: boolean;
  };
  stretcher: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    roll: number;
    shown: boolean;
  };
  crew: CrewPose[];
};

export function freshRescueFrame(): RescueFrame {
  const crew = BEARERS.map(() => ({
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    shown: true,
    move: { rise: 0, stride: 0, walking: 0, hand: null, raise: 0 } as CrewMove,
  }));
  return {
    heli: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, spool: 1, thrust: 0.15, shown: true },
    stretcher: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, shown: true },
    crew,
  };
}

/** Where a bearer's hand grips the rail, his own frame, by how far up he
 * has risen (knelt 0, stood 1). */
function handIn(rise: number): { x: number; z: number } {
  const r = ease(rise);
  return { x: 0.3 + (0.27 - 0.3) * r, z: 0.12 + (0.02 - 0.12) * r };
}

/** THE STRETCHER'S MIDDLE at `t`, its heading, and how far it has come:
 * carried along the way, inched over the floor's edge, slid into the
 * cabin. */
function middleAt(plan: RescuePlan, t: number) {
  const A = plan.at;
  const carried = clamp(t - A.carry, 0, A.raise - A.carry) * RESCUE.walk;
  const mid = along(plan, carried);
  if (t < A.inch) return { ...mid, came: carried };
  const inch = (RESCUE.short + RESCUE.over) * ease((t - A.inch) / RESCUE.time.inch);
  const into = RESCUE.door.skin + S.length / 2 + RESCUE.short - inch;
  const slid = into * ease((t - A.slide) / RESCUE.time.slide);
  const u = into - slid;
  return {
    x: plan.cabin.x + plan.out.x * u,
    z: plan.cabin.z + plan.out.z * u,
    heading: mid.heading,
    came: carried + inch + slid,
  };
}

/** Where bearer `j` stands at `t` while he holds his corner: his hand on
 * its rail. */
function bearerAt(plan: RescuePlan, j: number, t: number) {
  const b = BEARERS[j];
  const mid = middleAt(plan, t);
  const f = fwdOf(mid.heading);
  const rt = rightOf(mid.heading);
  const rise = ease((t - plan.at.rise) / RESCUE.time.rise);
  const cx = mid.x + rt.x * b.across * S.rail + f.x * b.along * S.along;
  const cz = mid.z + rt.z * b.across * S.rail + f.z * b.along * S.along;
  const hand = handIn(rise);
  // The stride by the ground HE has walked: the inner man of a turn walks
  // less of it than the outer.
  const turned = wrap(mid.heading - along(plan, 0).heading);
  const walked = mid.came - b.across * (S.rail + hand.x) * turned;
  return {
    x: cx - rt.x * b.across * hand.x - f.x * hand.z,
    z: cz - rt.z * b.across * hand.x - f.z * hand.z,
    heading: mid.heading,
    rise,
    walked,
    mid,
  };
}

/** When the rear two let go, s after the slide starts. */
const LET_GO = RESCUE.time.slide * 0.55;

/** THE RESCUE `t` s after it started (before it, as it stands waiting). */
export function rescueAt(level: Level, plan: RescuePlan, t: number, out: RescueFrame): RescueFrame {
  const A = plan.at;
  heliAt(level, plan, t, out.heli);
  const raised = ease((t - A.raise) / RESCUE.time.raise);
  const ground: number[] = [];
  let mid = middleAt(plan, t);
  let rise = 0;
  for (let j = 0; j < BEARERS.length; j++) {
    const b = BEARERS[j];
    const at = bearerAt(plan, j, t);
    mid = at.mid;
    rise = at.rise;
    const c = out.crew[j];
    c.x = at.x;
    c.z = at.z;
    c.y = level.groundAt(at.x, at.z);
    ground.push(c.y);
    c.heading = at.heading;
    c.shown = true;
    // Out of step with each other, as bearers walk a stretcher.
    const stride = at.walked / RESCUE_STRIDE + [0, 0.5, 0.25, 0.75][j];
    const moving =
      (t >= A.carry && t < A.raise) ||
      (t >= A.inch && t < A.inch + RESCUE.time.inch) ||
      (!b.boards && t >= A.slide && t < A.slide + LET_GO);
    c.move = { rise, stride, walking: moving ? 1 : 0, hand: b.hand, raise: 0 };
  }
  // HOLDING IT LEVEL: each corner's rail at its man's hand, the uphill men
  // lowering theirs and the downhill raising, up to `LEVEL_MOST` spans — then all
  // of them raising it to lift it onto the floor.
  const base = BEARERS.map((b, j) => ground[j] + railOf(b.body, rise, 0));
  const mean = base.reduce((a, b) => a + b, 0) / base.length;
  const ys: number[] = [];
  for (let j = 0; j < BEARERS.length; j++) {
    const b = BEARERS[j];
    const span = railOf(b.body, 1, 1) - railOf(b.body, 1, 0);
    const levelling = clamp((mean - base[j]) / span, -LEVEL_MOST, LEVEL_MOST) * rise;
    const raise = levelling + (1 - levelling) * raised;
    out.crew[j].move.raise = raise;
    ys.push(ground[j] + railOf(b.body, rise, raise));
  }
  // ONTO THE FLOOR: once the front two let go the front rests on the sill;
  // once the rear two do, the rear is let down onto it.
  const sill = plan.floor + 0.09;
  if (t >= A.climb) {
    const k = ease((t - A.climb) / 0.4);
    ys[0] += (sill - ys[0]) * k;
    ys[1] += (sill - ys[1]) * k;
  }
  if (t >= A.slide + LET_GO) {
    const k = ease((t - A.slide - LET_GO) / 0.6);
    ys[2] += (sill - ys[2]) * k;
    ys[3] += (sill - ys[3]) * k;
  }
  const st = out.stretcher;
  st.x = mid.x;
  st.z = mid.z;
  st.y = (ys[0] + ys[1] + ys[2] + ys[3]) / 4;
  st.heading = mid.heading;
  st.pitch = Math.atan2((ys[0] + ys[1] - ys[2] - ys[3]) / 2, 2 * S.along);
  st.roll = Math.atan2((ys[0] + ys[2] - ys[1] - ys[3]) / 2, 2 * S.rail);
  st.shown = t < A.clear + 1;
  // THE FRONT TWO let go and step up into the cabin; THE REAR TWO let go,
  // turn round, walk clear and turn back to watch it go.
  for (let j = 0; j < BEARERS.length; j++) {
    const b = BEARERS[j];
    const c = out.crew[j];
    if (b.boards && t >= A.climb) boardAt(level, plan, j, c, t - A.climb);
    if (!b.boards && t >= A.slide + LET_GO) clearAt(level, plan, j, c, t - A.slide - LET_GO);
  }
  return out;
}

/** A front man stepping up into the cabin `t` s after he let go. */
function boardAt(level: Level, plan: RescuePlan, j: number, c: CrewPose, t: number): void {
  const from = bearerAt(plan, j, plan.at.climb);
  const u = clamp(t / RESCUE.time.climb, 0, 1);
  // Facing the door: in through it, a step, and up onto the floor.
  const inward = 0.9 * u;
  c.x = from.x - plan.out.x * inward;
  c.z = from.z - plan.out.z * inward;
  c.heading = Math.atan2(-plan.out.x, -plan.out.z);
  const g = level.groundAt(from.x, from.z);
  c.y = g + (plan.floor - g) * ease((u - 0.3) / 0.5);
  c.move = {
    rise: 1,
    stride: (from.walked + inward) / RESCUE_STRIDE + [0, 0.5][j],
    walking: u < 1 ? 1 : 0,
    hand: null,
    raise: 0,
  };
  c.shown = u < 0.92;
}

/** A rear man `t` s after he let go: turned round, walked clear (out from
 * the door and off toward the nose, away from the tail) and turned back to
 * watch. */
function clearAt(level: Level, plan: RescuePlan, j: number, c: CrewPose, t: number): void {
  const T = RESCUE.time;
  const b = BEARERS[j];
  const from = bearerAt(plan, j, plan.at.slide + LET_GO);
  const f = fwdOf(plan.site.heading);
  const way = { x: plan.out.x + f.x * 0.45, z: plan.out.z + f.z * 0.45 };
  const n = Math.hypot(way.x, way.z);
  const dir = { x: way.x / n, z: way.z / n };
  const facing = Math.atan2(-plan.out.x, -plan.out.z);
  const going = Math.atan2(dir.x, dir.z);
  const walked = clamp(t - T.turn, 0, T.clear) * RESCUE.walk;
  // The two drift apart a little as they go.
  const rt = rightOf(going);
  const spread = -b.across * 1.2 * clamp(walked / 5, 0, 1);
  c.x = from.x + dir.x * walked + rt.x * spread;
  c.z = from.z + dir.z * walked + rt.z * spread;
  c.y = level.groundAt(c.x, c.z);
  const done = t > T.turn + T.clear;
  c.heading = done
    ? going + wrap(facing - going) * ease((t - T.turn - T.clear) / T.turn)
    : facing + wrap(going - facing) * ease(t / T.turn);
  c.move = {
    rise: 1,
    stride: walked / RESCUE_STRIDE + (b.across > 0 ? 0.5 : 0),
    walking: t > T.turn && !done ? 1 : 0,
    hand: null,
    raise: 0,
  };
}

/** THE MACHINE at `t`: sat with its rotor turning, then up into the
 * hover, turned down the valley, and away. */
function heliAt(level: Level, plan: RescuePlan, t: number, h: RescueFrame["heli"]): void {
  const s = plan.site;
  const T = RESCUE.time;
  const k = t - plan.at.lift;
  h.spool = 1;
  h.shown = t < plan.at.gone;
  if (k < T.spool) {
    h.x = s.x;
    h.y = s.y;
    h.z = s.z;
    h.heading = s.heading;
    h.pitch = s.pitch;
    h.roll = s.roll;
    h.thrust = 0.15 + 0.85 * ease(k / T.spool);
    return;
  }
  const up = k - T.spool;
  const ground = level.groundAt(s.x, s.z);
  const hover = ease(up / (T.hover * 0.6)) * RESCUE.hover;
  const settle = ease(up / 1.2);
  const turn = ease((up - T.hover * 0.35) / (T.hover * 0.65));
  const heading = s.heading + wrap(plan.away - s.heading) * turn;
  h.heading = heading;
  h.thrust = 1;
  const go = Math.max(0, up - T.hover);
  // Away: gathering speed down the valley, climbing all the while — and
  // never nearer the snow under it than the hover.
  const run =
    go < RESCUE.cruise / RESCUE.accel
      ? 0.5 * RESCUE.accel * go * go
      : RESCUE.cruise ** 2 / (2 * RESCUE.accel) +
        RESCUE.cruise * (go - RESCUE.cruise / RESCUE.accel);
  const f = fwdOf(plan.away);
  h.x = s.x + f.x * run;
  h.z = s.z + f.z * run;
  const under = level.groundAt(h.x, h.z);
  const climbOut = Math.max(ground + hover + RESCUE.climb * go, under + RESCUE.hover + 2 * go);
  h.y = Math.max(s.y + hover, climbOut) + (s.y - ground) * (1 - settle);
  const dip = clamp(go / 2, 0, 1) * (1 - clamp((go - 12) / 6, 0, 1) * 0.6);
  h.pitch = s.pitch * (1 - settle) - 0.16 * dip;
  h.roll = s.roll * (1 - settle);
}

/** WHEN IT STARTS: the run's clock the player first came within
 * `RESCUE.reach` of where he lay, or null while he has not. */
export type RescueClock = { started: number | null };

/** Start the clock the first time (`x`, `z`) is within reach, at `t`. */
export function watchRescue(
  plan: RescuePlan,
  clock: RescueClock,
  x: number,
  z: number,
  t: number,
): number {
  if (clock.started === null && hy(x - plan.spot.x, z - plan.spot.z) <= RESCUE.reach)
    clock.started = t;
  return clock.started === null ? -1 : t - clock.started;
}
