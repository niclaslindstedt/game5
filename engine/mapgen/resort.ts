// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26, R27 — THE RESORT'S PLAN: where the lifts go on the massif, and which
// runs leave the top of each, built to which colour, heading where.
//
// A ski area is laid out from its lifts. The piste maps agree on a shape
// that recurs wherever the ground allows it, and this is that shape:
//
//   * A GONDOLA climbs from the village to the MID-STATION on the bench —
//     the first stage, where most of the mountain meets.
//   * A CHAIR climbs from the mid-station to the PEAK's top station, and
//     the steep sector under the peak is where the blacks and the reds are.
//   * A CHAIR climbs from the valley floor to the SHOULDER, the gentle
//     sector's top: the long blues, a red down its steeper edge, and the
//     transport lane that carries a skier who will not ski a red back across
//     to the bench.
//   * A DRAG climbs beside the village to the top of the NURSERY slopes.
//   * Where the face beyond the peak has room, a CHAIR climbs to an OUTER
//     top on the steep sector.
//
// Every run is a SLOT — a top station, a colour to build to, a target to
// steer for and a side to leave on — and the pistes are walked the
// gentlest first, each colour in the order the slots are listed: the
// greens and the blues are the trunks the reds and the blacks come down
// onto, for a piste merges only into a run no harder than itself (R29) —
// a skier who came down a blue is never made to ski a red to the lift.
// A region (R21) tilts the colours a slot is built to (`TILT`): a fell's
// steep slot is a red, a continental's blue slot a red, a maritime's black
// a red.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { GRADES, PISTE_GRADES, type GradeRow, type PisteGrade } from "./grades.ts";
import type { RunSpec } from "./network.ts";
import type { RegionId } from "./regions.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { TerrainPlan } from "./terrain.ts";
import type { Lift, RunKind } from "./types.ts";

/** A station: a lift's top or the village, as a plan point. */
type Point = { x: number; z: number };

/** A lift as planned: its two ends in plan. */
export type LiftPlan = { id: string; kind: Lift["kind"]; bottom: Point; top: Point };

/** One run slot. */
type Slot = {
  /** The lift whose top it leaves. */
  from: string;
  kind: RunKind;
  /** The colour it is built to before the region's tilt. */
  aim: PisteGrade;
  /** Where it steers for. */
  target: (s: Stations) => Point;
  /** Which way across the fall line it leaves the top, as a multiple of
   * the side the peak stands on (−1: toward the shoulder). */
  lean: number;
  /** Across the fall line from the station, m, as a multiple of the side. */
  offset: number;
  /** The odds the slot is laid at all. */
  odds: number;
  /** The wave's amplitude, rad. */
  amplitude: number;
  /** Whether a harder country (R21) keeps the slot at its colour: the runs
   * home from the mid-station, whose bench no black can leave from (R12),
   * and the blue among them a harder area's one easy way down. */
  firm: boolean;
};

/** Every station of the plan. */
type Stations = {
  side: number;
  village: Point;
  mid: Point;
  peak: Point;
  shoulder: Point;
  shoulderFoot: Point;
  nursery: Point;
  outer: Point | null;
  outerFoot: Point | null;
};

/** A slot, written short: the lift, the kind, the colour, where it steers,
 * its lean and its offset (× the peak's side), its odds, its amplitude, and
 * whether a harder country keeps its colour. */
function slot(
  from: string,
  kind: RunKind,
  aim: PisteGrade,
  target: (s: Stations) => Point,
  lean: number,
  offset: number,
  odds: number,
  amplitude: number,
  firm = false,
): Slot {
  return { from, kind, aim, target, lean, offset, odds, amplitude, firm };
}

/** R27 — THE SLOTS, in the order they are listed (the pistes are walked
 * the gentlest first, `planResort`): the nursery, the trunks home from the
 * mid-station, the shoulder's, the peak's, the outer top's — and the lanes
 * last, which cross what they meet and join the run they are
 * laid to (`laneTarget`). A lane's target is the side of the mountain it
 * heads for. */
const SLOTS: readonly Slot[] = [
  slot("D1", "piste", "green", (s) => ({ x: s.nursery.x, z: s.village.z }), -0.3, 0, 1, 0.7),
  slot(
    "D1",
    "piste",
    "green",
    (s) => ({ x: s.nursery.x - s.side * 320, z: s.village.z }),
    -1,
    -90,
    0.6,
    0.7,
  ),
  slot("G1", "piste", "red", (s) => s.village, 0.4, 0, 1, 0.45, true),
  slot(
    "G1",
    "piste",
    "blue",
    (s) => ({ x: s.village.x - s.side * 320, z: s.village.z }),
    -1,
    -90,
    1,
    0.6,
    true,
  ),
  slot(
    "G1",
    "piste",
    "red",
    (s) => ({ x: s.mid.x + s.side * 420, z: s.village.z }),
    1,
    90,
    0.7,
    0.4,
    true,
  ),
  slot("C2", "piste", "blue", (s) => s.shoulderFoot, -0.3, 0, 1, 0.6),
  slot(
    "C2",
    "piste",
    "blue",
    (s) => ({ x: s.shoulder.x + s.side * 480, z: s.village.z }),
    1,
    90,
    0.8,
    0.6,
  ),
  slot(
    "C2",
    "piste",
    "red",
    (s) => ({ x: s.shoulder.x - s.side * 260, z: s.village.z }),
    -1,
    -90,
    0.75,
    0.4,
  ),
  slot(
    "C1",
    "piste",
    "black",
    (s) => ({ x: s.peak.x + s.side * 160, z: s.village.z }),
    0.5,
    40,
    1,
    0.3,
  ),
  slot("C1", "piste", "red", (s) => s.mid, -0.6, -90, 1, 0.45),
  slot(
    "C1",
    "piste",
    "blue",
    (s) => ({ x: s.mid.x - s.side * 380, z: s.mid.z }),
    -1,
    -180,
    0.7,
    0.5,
  ),
  slot("C3", "piste", "black", (s) => s.outerFoot ?? s.village, 0.4, 0, 1, 0.3),
  slot("C3", "piste", "red", (s) => s.village, -0.8, -90, 0.7, 0.45),
  slot("G1", "road", "green", (s) => s.shoulderFoot, -1, -60, 1, 0.05),
  slot(
    "G1",
    "road",
    "green",
    (s) => ({ x: s.peak.x + s.side * 400, z: s.mid.z }),
    1,
    60,
    0.7,
    0.05,
  ),
  slot("C2", "road", "green", (s) => s.mid, 1, 92, 0.85, 0.05),
  slot("C1", "road", "green", (s) => s.shoulder, -1, -138, 0.5, 0.05),
];

/** R21, R27 — how a region tilts the colours its slots are built to: the
 * fell's low rounded country a step gentler (its reds blues, its blacks
 * reds — a green and a blue area with a red or two), the continental's big
 * faces a step harder (its blues reds, its reds blacks — mostly red and
 * black), the maritime's deep heavy snow without a black (its blacks reds —
 * a blue and red area); the alpine as the slots are laid. The green stays
 * green anywhere: a nursery is a nursery. */
const TILT: Readonly<Record<RegionId, Partial<Record<PisteGrade, PisteGrade>>>> = {
  alpine: {},
  fell: { red: "blue", black: "red" },
  continental: { blue: "red", red: "black" },
  maritime: { black: "red" },
};

function tilted(slot: Slot, region: RegionId): PisteGrade {
  const to = TILT[region][slot.aim] ?? slot.aim;
  const harder = PISTE_GRADES.indexOf(to) > PISTE_GRADES.indexOf(slot.aim);
  return slot.firm && harder ? slot.aim : to;
}

/** THE TRANSPORT LANE's row (R27): the green's, the lane's numbers over it. */
export const ROAD_ROW: GradeRow = {
  ...GRADES.green,
  track: {
    ...GRADES.green.track,
    steepest: RR.road.grade,
    maxGrade: RR.road.grade,
    width: RR.road.width,
    sweeps: { min: 0, max: 0 },
  },
  kickers: { ...GRADES.green.kickers, on: { min: 0, max: 0 } },
  drift: { min: 0, max: 0 },
};

/** R26 — the stations and the lifts between them. */
function placeStations(rng: Rng, plan: TerrainPlan): { stations: Stations; lifts: LiftPlan[] } {
  const m = plan.massif;
  if (!m) throw new Error("not a resort's mountain");
  const L = RR.lift;
  const size = R.world.size;
  const span = plan.baseZ - plan.summitZ;
  const at = (u: number): number => plan.summitZ + span * u;
  const side = m.side;
  const village = { x: m.villageX, z: plan.baseZ + 60 };
  const mid = { x: m.benchX, z: at(m.benchU) - 20 };
  const peak = { x: m.peakX - side * 40, z: plan.summitZ + L.below };
  const shoulder = { x: m.shoulderX, z: plan.summitZ + L.below + 10 };
  const shoulderFoot = { x: (m.shoulderX + m.villageX) / 2 - side * 60, z: plan.baseZ + 40 };
  const nursery = {
    x: m.villageX - side * inBand(rng, L.nursery.across),
    z: at(inBand(rng, L.nursery.at)),
  };
  const outerX = m.peakX + side * inBand(rng, L.outer.across);
  const outerU = inBand(rng, L.outer.at);
  const room = Math.abs(outerX - size / 2) < RR.massif.flank.inner - 220;
  const outer = room ? { x: outerX, z: at(outerU) } : null;
  const outerFoot = room ? { x: outerX - side * 80, z: plan.baseZ + 40 } : null;
  const stations: Stations = {
    side,
    village,
    mid,
    peak,
    shoulder,
    shoulderFoot,
    nursery,
    outer,
    outerFoot,
  };
  const lifts: LiftPlan[] = [
    { id: "G1", kind: "gondola", bottom: { x: village.x + side * 30, z: village.z }, top: mid },
    // The peak's chair leaves beside the gondola's top, a skate from it
    // (R29).
    { id: "C1", kind: "chair", bottom: { x: mid.x + side * 45, z: mid.z + 20 }, top: peak },
    { id: "C2", kind: "chair", bottom: shoulderFoot, top: shoulder },
    {
      id: "D1",
      kind: "drag",
      bottom: { x: nursery.x + side * 60, z: village.z - 10 },
      top: nursery,
    },
  ];
  if (outer && outerFoot) lifts.push({ id: "C3", kind: "chair", bottom: outerFoot, top: outer });
  return { stations, lifts };
}

/** R26, R27 — plan the resort: the lifts, and the run slots in the order
 * they are walked, each turned into a spec with its colour's row. */
export function planResort(
  rng: Rng,
  plan: TerrainPlan,
): { lifts: LiftPlan[]; specs: RunSpec[]; village: Point } {
  const { stations, lifts } = placeStations(rng, plan);
  const tops = new Map(lifts.map((l) => [l.id, l.top]));
  const specs: RunSpec[] = [];
  for (const slot of SLOTS) {
    const top = tops.get(slot.from);
    // Every slot draws its odds whether or not its lift was built, so a
    // missing outer top moves nothing after it.
    const laid = rng.chance(slot.odds);
    if (!top || !laid) continue;
    const aim = slot.kind === "road" ? "green" : tilted(slot, plan.region.id);
    const row = slot.kind === "road" ? ROAD_ROW : GRADES[aim];
    const x = top.x + slot.offset * stations.side;
    const target = slot.target(stations);
    const toward = Math.atan2(target.x - x, Math.max(200, target.z - top.z));
    specs.push({
      id: String(specs.length + 1),
      from: slot.from,
      kind: slot.kind,
      row,
      x,
      z: top.z,
      heading: Math.max(-1, Math.min(1, toward + slot.lean * stations.side * 0.6)),
      target,
      amplitude: slot.amplitude,
      lean: slot.lean * stations.side,
    });
  }
  // The pistes the gentlest first, each colour in slot order: a piste
  // merges only into a run no harder than itself (R29), so the easier ones
  // are the trunks the harder come down onto. The lanes last: they cross
  // the pistes, and a piste never meets one.
  const rank = (sp: RunSpec): number => PISTE_GRADES.indexOf(sp.row.id ?? "green");
  const ordered = specs
    .filter((sp) => sp.kind === "piste")
    .sort((a, c) => rank(a) - rank(c))
    .concat(specs.filter((sp) => sp.kind === "road"));
  return { lifts, specs: ordered, village: stations.village };
}
