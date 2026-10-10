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
// ramp and up the line; and the WIND MAST on the far corner of the house.
// Nothing stands across the way off — no stop gate, no netting: a rider
// stood up slides straight on down the ramp, through the parting and off
// the pad's lean to his run. Straight ahead of him past the parting stands
// the PISTE MAP BOARD, the ski area painted as the start card paints it
// (`map-board.ts`), and beside it, on the side each run lies, the runs'
// SIGNS (`run-sign-plan.ts`'s `summitSigns`). A GONDOLA'S TOP has its board too, facing the rider
// walked out of its door.
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
  CABIN_HALF,
  CORRAL_TAIL,
  HOUSE_CLEAR,
  carrierGripAt,
  chairLane,
  gondolaGrip,
  platformOf,
  queueLane,
  runsOffTop,
  stationHouses,
  type Level,
  type LiftPlan,
  type PisteGrade,
} from "@engine";

export type PartKind = "hood" | "booth" | "mast" | "board" | "load" | "door" | "canopy" | "hut";

/** One piece set down: where (its foot on the snow, or `y` given), turned
 * `yaw` (its +z), sized as its builder reads it. */
export type Part = {
  kind: PartKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  size: number;
  /** A hood's reach ahead of its wheel over the rail, m. */
  length?: number;
  /** A platform roof's RAIL the cabins creep round the wheel on: how far
   * under the roof it hangs and the half circle's radius, m. */
  rail?: { drop: number; radius: number };
};

/** A run's arrow on a top's signs: its grade, and which way it points off
 * the parting — `1` to the up rope's side (the lane's, the house's), `-1`
 * across the line. */
export type Sign = { run: string; grade: PisteGrade; way: 1 | -1 };

/** A run of fence from `a` to `b` on the snow: a ROPE line on poles for a
 * corral. (A chair's top has none: its way off is open.) */
export type Fence = {
  kind: "rope";
  a: { x: number; z: number };
  b: { x: number; z: number };
};

export type StationLayout = { parts: Part[]; fences: Fence[] };

/** The booth's set-back from the up rope at a foot, and from the way off
 * at a top, m, and how far short of the unload it stands along the line;
 * the corral lane's half-width, m. */
const BOOTH_OUT = 3.6;
const BOOTH_LANE = 2.4;
const BOOTH_BACK = 5;
const LANE = 1.4;
/** A gondola's platform roof stands its columns this far past the outer
 * edge of the platform its rider waits on, m — so neither he nor the cabin
 * coming round to him rides through one. */
const CANOPY_CLEAR = 1.5;
/** A chair's half-width across the line, m (`lifts.ts`'s chair, its bar
 * 2.3 m), and how far past it a hood's columns stand, m — the columns are
 * set in `HOOD_INSET` from the hood's edge (`station-build.ts`'s
 * `terminal`), so the chairs and their riders run between them. */
const CHAIR_HALF = 1.2;
const HOOD_CLEAR = 0.6;
const HOOD_INSET = 0.7;
/** A hood's underside over the chairs' grips, m, and how far it reaches past
 * the load line or the unload point, m. */
const HOOD_OVER = 0.2;
const HOOD_PAST = 2;
/** The map board at a gondola's top: m down the line from its wheel past
 * the door its rider is walked out of, and across it — off the cut under
 * the way in. */
const BOARD = { u: 14, v: 14 };
/** Where a gondola's rider is walked out onto the pad, m short of its
 * wheel (`TUNING.lift.door`). */
const DOOR_OUT = 10;

/** Every station of the map laid out. */
export function layStations(level: Level, plans: readonly LiftPlan[]): StationLayout {
  const parts: Part[] = [];
  const fences: Fence[] = [];
  for (const p of plans) {
    const L = p.length;
    const g = p.look.gauge / 2;
    const h = p.look.house;
    const up = (u: number, v: number) => ({
      x: p.lift.bottom.x + p.dx * u + p.dz * v,
      z: p.lift.bottom.z + p.dz * u - p.dx * v,
    });
    const put = (
      kind: PartKind,
      u: number,
      v: number,
      yaw: number,
      size = 1,
      y?: number,
      length?: number,
    ) => {
      const at = up(u, v);
      const part: Part = { kind, x: at.x, y: y ?? level.groundAt(at.x, at.z), z: at.z, yaw, size };
      if (length !== undefined) part.length = length;
      parts.push(part);
    };
    const fence = (kind: Fence["kind"], u0: number, v0: number, u1: number, v1: number) =>
      fences.push({ kind, a: up(u0, v0), b: up(u1, v1) });
    const wheelY = (u: number) => level.groundAt(up(u, 0).x, up(u, 0).z) + p.look.wheel;
    const side = p.heading + Math.PI / 2;
    if (p.lift.kind === "chair") {
      const off = L - p.look.off;
      // THE TOP: the way off down the lane, the house beside it.
      const lane = chairLane(p);
      // Each TERMINAL'S HOOD is centred on its wheel, turned to face down
      // its rail (+z out along the line), its underside just over the
      // chairs' grips there (`carrierGripAt`), reaching from round the back
      // of the wheel, where the chairs turn, out past the unload at the top
      // and the load line at the foot.
      const hood = (g + CHAIR_HALF + HOOD_CLEAR + HOOD_INSET) * 2;
      const e = p.look.entry;
      const grip = (u: number) => carrierGripAt(p, u) + HOOD_OVER;
      put("hood", L, 0, p.heading + Math.PI, hood, grip(L), p.look.off + HOOD_PAST);
      put("booth", off - BOOTH_BACK, lane.v + BOOTH_LANE, side + Math.PI);
      // THE FOOT.
      put("hood", 0, 0, p.heading, hood, grip(0), e.at + HOOD_PAST);
      put("booth", e.at + 1, g + BOOTH_OUT, side + Math.PI);
      put("load", e.at, e.side, p.heading, e.across * 2);
      corral(fence, p);
    } else if (p.lift.kind === "gondola") {
      const back = -(h.length + HOUSE_CLEAR.gondola);
      // THE PLATFORM ROOF over each wheel, as wide as the platform's far
      // edge from the line (the rider stands there beside his cabin's way)
      // and its clearance either side.
      const stand = platformOf(p);
      const edge = Math.max(
        g + CABIN_HALF,
        Math.abs((stand.x - p.lift.bottom.x) * p.dz - (stand.z - p.lift.bottom.z) * p.dx),
      );
      const roof = (edge + CANOPY_CLEAR) * 2;
      // Each turned to face out along its rail (+z), the wheel 1 m behind
      // its middle; under it the RAIL the cabins run round the wheel on at
      // their grips' height (`gondolaGrip`).
      const canopy = (u: number, yaw: number, roofY: number, gripY: number) => {
        put("canopy", u, 0, yaw, roof, roofY);
        parts[parts.length - 1].rail = { drop: roofY - gripY, radius: g };
      };
      canopy(L - 1, p.heading + Math.PI, wheelY(L) + 0.6, gondolaGrip(p, L));
      put("door", L + HOUSE_CLEAR.gondola, 0, p.heading + Math.PI);
      canopy(1, p.heading, wheelY(0) + 0.6, gondolaGrip(p, 0));
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
    // THE PISTE MAP BOARD, facing where the rider is let go.
    const board = mapBoardOf(p);
    if (board) {
      parts.push({ kind: "board", ...board, y: level.groundAt(board.x, board.z), size: 1 });
    }
  }
  return { parts, fences };
}

/** WHERE A TOP'S PISTE MAP BOARD STANDS, turned (`yaw`) to where its rider
 * is let go (`off`): at a chair's top straight ahead of him past the
 * parting (`chairLane`), at a gondola's beside its door; a drag's top has
 * none. The run signs off the top stand beside it (`summitSigns`). */
export function mapBoardOf(
  p: LiftPlan,
): { x: number; z: number; yaw: number; off: { x: number; z: number } } | null {
  if (p.lift.kind === "drag") return null;
  const L = p.length;
  const g = p.look.gauge / 2;
  const up = (u: number, v: number) => ({
    x: p.lift.bottom.x + p.dx * u + p.dz * v,
    z: p.lift.bottom.z + p.dz * u - p.dx * v,
  });
  const lane = p.lift.kind === "chair" ? chairLane(p) : null;
  const at = lane ? up(lane.signs, lane.v) : up(L - BOARD.u, g + BOARD.v);
  const off = lane ? up(lane.exit, lane.v) : up(L - DOOR_OUT, 0);
  return { x: at.x, z: at.z, yaw: Math.atan2(off.x - at.x, off.z - at.z), off };
}

/** WHICH WAY EACH RUN OFF A CHAIR'S TOP LEAVES from the parting at the end
 * of the way off (`chairLane`): every run a rider stood off it can ski onto
 * from the pad (`runsOffTop` — a lane leaving up the contour above the pad
 * is not one), to the up rope's side or across the line as the point it is
 * joined at lies — those to the lane's side first, each side's in the order
 * the runs are listed. What a map from before the ramps signs at the
 * parting (`summitSigns`). */
export function signsOf(level: Level, plan: LiftPlan): Sign[] {
  const lane = chairLane(plan);
  const runs = level.resort?.runs ?? [];
  const signs = runsOffTop(level, plan).map(({ run, at }): Sign => {
    const r = runs[run];
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
