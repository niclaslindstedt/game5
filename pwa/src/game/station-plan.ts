// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATIONS AS LAID OUT — where every piece of a lift's two stations
// stands beyond the wheel, the house and the rope `lifts.ts` already draws,
// off the research in `docs/summit-stations.md`. Three-free, so the suite
// holds the layout (`tests/stations_test.ts`) and `lifts.ts` only builds it.
//
// AT A CHAIR'S TOP: the TERMINAL HOOD over the bullwheel and the unload; the
// way off straight on down the ramp in its lane beside the chairs
// (`CHAIR_EXIT`), the machine house on the lane's outer side; the
// OPERATOR'S BOOTH beside the unload on that side, glazed, looking down the
// ramp and up the line; the STOP GATE over the chairs' path short of the
// wheel, for a rider who did not get off; orange NETTING between the lane
// and the wheel the chairs swing round, and on its other side; the SIGNS
// across the far side of the way at the parting — an arrow board a run off
// the top, in its grade's colour, pointing the way it leaves — and the WIND
// MAST on the far corner of the house. On the highest top of the mountain
// the PATROL HUT on the pad's other side and the PISTE MAP BOARD where the
// rider comes up the line.
//
// AT A CHAIR'S FOOT: the hood, the booth by the load line, the LOAD LINE
// itself painted across the up rope's lane, and the roped CORRAL bringing a
// skier in on the diagonal past the house onto it — the load zone the
// engine boards from (`LIFT_LOOK.chair.entry`). A GONDOLA'S FOOT: the DOOR
// in the back of the station house with a canopy over it and the corral to
// it; its top the exit door in the house's front onto the pad. A DRAG'S
// FOOT: the operator's hut, the corral and the board at the head of the
// track.
//
// Every place is stated in a station's own frame — `u` m along the line
// from its wheel (positive up it), `v` m right of it — and turned to the
// world here.

import {
  chairLane,
  queueLane,
  stationHouses,
  type Level,
  type LiftPlan,
  type PisteGrade,
} from "@engine";

export type PartKind =
  | "hood"
  | "booth"
  | "gate"
  | "mast"
  | "patrol"
  | "board"
  | "load"
  | "door"
  | "canopy"
  | "hut"
  | "signpost"
  | "sign";

/** One piece set down: where (its foot on the snow, or `y` given), turned
 * `yaw` (its +z), sized as its builder reads it; a sign's run's grade. */
export type Part = {
  kind: PartKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  size: number;
  grade?: PisteGrade;
};

/** A run's arrow on a top's signs: its grade, and which way it points off
 * the parting — `1` to the up rope's side (the lane's, the house's), `-1`
 * across the line. */
export type Sign = { run: string; grade: PisteGrade; way: 1 | -1 };

/** A run of fence from `a` to `b` on the snow: orange NETTING round the
 * machinery, or a ROPE line on poles for a corral. */
export type Fence = {
  kind: "net" | "rope";
  a: { x: number; z: number };
  b: { x: number; z: number };
};

export type StationLayout = { parts: Part[]; fences: Fence[] };

/** The booth's set-back from the up rope at a foot, and from the way off
 * at a top, m, and how far short of the unload it stands along the line;
 * the netting's set-back from a rope, m; the corral lane's half-width, m. */
const BOOTH_OUT = 3.6;
const BOOTH_LANE = 2.4;
const BOOTH_BACK = 5;
const NET_OUT = 1.9;
const LANE = 1.4;
/** The net between the way off and the wheel, m outside the up rope; the
 * stop gate's step short of the wheel, m, and its post's inside the up
 * rope, m; the signs' boards: how high the
 * first stands, m, and the step between them; how far down a run its
 * bearing off the parting is read, m. */
const NET_IN = 1.25;
const GATE_SHORT = 2.5;
const GATE_IN = 1.3;
const SIGN_LOW = 1.4;
const SIGN_STEP = 0.5;
const SIGN_READ = 30;

/** Every station of the map laid out. */
export function layStations(level: Level, plans: readonly LiftPlan[]): StationLayout {
  const parts: Part[] = [];
  const fences: Fence[] = [];
  const peak = plans.reduce((m, p) => Math.max(m, p.lift.top.y), -Infinity);
  for (const p of plans) {
    const L = p.length;
    const g = p.look.gauge / 2;
    const h = p.look.house;
    const up = (u: number, v: number) => ({
      x: p.lift.bottom.x + p.dx * u + p.dz * v,
      z: p.lift.bottom.z + p.dz * u - p.dx * v,
    });
    const put = (kind: PartKind, u: number, v: number, yaw: number, size = 1, y?: number) => {
      const at = up(u, v);
      parts.push({ kind, x: at.x, y: y ?? level.groundAt(at.x, at.z), z: at.z, yaw, size });
    };
    const fence = (kind: Fence["kind"], u0: number, v0: number, u1: number, v1: number) =>
      fences.push({ kind, a: up(u0, v0), b: up(u1, v1) });
    const wheelY = (u: number) => level.groundAt(up(u, 0).x, up(u, 0).z) + p.look.wheel;
    const side = p.heading + Math.PI / 2;
    if (p.lift.kind === "chair") {
      const off = L - p.look.off;
      // THE TOP: the way off down the lane, the house beside it.
      const lane = chairLane(p);
      put("hood", L - 1, 0, p.heading, g * 2 + 2.4, wheelY(L) + 0.35);
      put("booth", off - BOOTH_BACK, lane.v + BOOTH_LANE, side + Math.PI);
      // The gate's post inside the ropes, its bar reaching out over the
      // up rope's chairs — clear of the way off beyond them.
      put("gate", L - GATE_SHORT, g - GATE_IN, side);
      fence("net", L - 2, g + NET_IN, L + 2.5, g + NET_IN);
      fence("net", L - 3, -g - NET_OUT, L + 1.5, -g - NET_OUT);
      // THE SIGNS across the far side of the way, facing up it: a post and
      // a board a run, those to one side above those to the other.
      put("signpost", lane.signs, lane.v, p.heading + Math.PI);
      signsOf(level, p).forEach((s, i) => {
        const at = up(lane.signs, lane.v);
        parts.push({
          kind: "sign",
          x: at.x,
          y: level.groundAt(at.x, at.z) + SIGN_LOW + i * SIGN_STEP,
          z: at.z,
          // A board points its own +x: across the line for `-1`, turned
          // about to the lane's side for `1`.
          yaw: p.heading + (s.way === 1 ? 0 : Math.PI),
          size: 1,
          grade: s.grade,
        });
      });
      // THE FOOT.
      const e = p.look.entry;
      put("hood", 1, 0, p.heading, g * 2 + 2.4, wheelY(0) + 0.35);
      put("booth", e.at + 1, g + BOOTH_OUT, side + Math.PI);
      put("load", e.at, e.side, p.heading, e.across * 2);
      corral(fence, p);
    } else if (p.lift.kind === "gondola") {
      const back = -(h.length + 1.5);
      put("canopy", L - 1, 0, p.heading, g * 2 + 3, wheelY(L) + 0.6);
      put("door", L + 1.5, 0, p.heading + Math.PI);
      put("canopy", 1, 0, p.heading, g * 2 + 3, wheelY(0) + 0.6);
      put("door", back, 0, p.heading + Math.PI);
      corral(fence, p);
    } else {
      const e = p.look.entry;
      put("hut", -2, -(h.width / 2 + 2.2), side);
      put("load", e.at, e.side, p.heading, e.across * 2);
      corral(fence, p);
    }
    // THE WIND MAST on the far corner of the top's house.
    if (p.lift.kind !== "drag") {
      const house = stationHouses(level, p)[1];
      const fx = house.x + p.dx * house.halfLength + p.dz * house.halfWidth;
      const fz = house.z + p.dz * house.halfLength - p.dx * house.halfWidth;
      parts.push({
        kind: "mast",
        x: fx,
        y: level.groundAt(fx, fz),
        z: fz,
        yaw: p.heading,
        size: 1,
      });
    }
    // THE HIGHEST TOP: the patrol's hut and the map board.
    if (p.lift.kind !== "drag" && p.lift.top.y === peak) {
      put("patrol", L - 10, -(g + 11), side);
      put("board", L - 17, g + 8, p.heading + Math.PI);
    }
  }
  return { parts, fences };
}

/** WHICH WAY EACH RUN OFF A CHAIR'S TOP LEAVES from the parting at the end
 * of the way off (`chairLane`): its bearing read `SIGN_READ` m down it, to
 * the up rope's side or across the line — those to the lane's side first,
 * each side's in the order the runs are listed. What the signs point and
 * the lead off a free ride's chair turns by. */
export function signsOf(level: Level, plan: LiftPlan): Sign[] {
  const lane = chairLane(plan);
  const runs = level.resort?.runs.filter((r) => r.from === plan.lift.id) ?? [];
  const signs = runs.map((r): Sign => {
    const at = r.points.find((q) => q.s >= SIGN_READ) ?? r.points[r.points.length - 1];
    const dx = at.x - plan.lift.bottom.x;
    const dz = at.z - plan.lift.bottom.z;
    const v = dx * plan.dz - dz * plan.dx;
    return { run: r.id, grade: r.grade, way: v >= lane.v ? 1 : -1 };
  });
  return [...signs.filter((s) => s.way === 1), ...signs.filter((s) => s.way === -1)];
}

/** A corral fenced either side of a lift's queue lane (`queueLane`, the
 * one the crowd queues on), from a step short of the load line out past
 * its mouth — rope lines on poles, `LANE` m either side. */
function corral(
  fence: (kind: Fence["kind"], u0: number, v0: number, u1: number, v1: number) => void,
  plan: LiftPlan,
): void {
  const lane = queueLane(plan);
  for (let k = 0; k + 1 < lane.length; k++) {
    const a = lane[k];
    const b = lane[k + 1];
    const len = Math.hypot(b.u - a.u, b.v - a.v) || 1;
    // The lane's normal in (u, v), and the last segment cut to the corral's
    // own length past its mouth.
    const nu = -(b.v - a.v) / len;
    const nv = (b.u - a.u) / len;
    const end = k + 2 === lane.length ? Math.min(1, CORRAL_TAIL / len) : 1;
    const bu = a.u + (b.u - a.u) * end;
    const bv = a.v + (b.v - a.v) * end;
    for (const s of [-1, 1])
      fence(
        "rope",
        a.u + nu * LANE * s,
        a.v + nv * LANE * s,
        bu + nu * LANE * s,
        bv + nv * LANE * s,
      );
  }
}

/** How far past the corral's mouth its fences run on, m. */
const CORRAL_TAIL = 8;
