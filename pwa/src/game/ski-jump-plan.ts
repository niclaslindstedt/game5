// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL AS PLANNED FOR THE DRAWING (R43): where every piece
// of the hill's furniture stands, read off the hill the map publishes
// (`Level.skiJump`) and the norm's own numbers (`SKI_JUMP_RULE`) — never a
// place restated. Three-free: `ski-jump-build.ts` builds the meshes off
// this, `ski-jump-view.ts` hangs and lights them, and the suite holds the
// places (`tests/ski_jump_look_test.ts`).
//
// What a large hill is, as a crowd and a broadcast see it (the research,
// in our own words — `docs/freestyle.md` § *Ski jumping*):
//
//   * THE IN-RUN is a concrete trough on a raised deck, about two and a half
//     metres between its guard walls, its floor carrying TWO TRACKS — ice
//     or porcelain grooves a ski's width, the skis' stance apart — with
//     snow between them; a stair runs down one side, lamps on posts down
//     both, and the numbered START GATES are crossbars over it near the
//     top, the jury's gate the bar the jumper sits on.
//   * THE START TOWER over its top: the jumpers' warming room at the deck,
//     its floors glazed toward the hill, a canopy over the gates.
//   * THE TABLE ends in a hard EDGE, a concrete face dropping to the knoll.
//   * THE LANDING HILL is groomed snow between low board walls that widen
//     from the knoll to the out-run; across it DYED LINES and lines of
//     spruce twigs give the eye its depth; the P point is a blue line, K a
//     red one, the hill size another; BLUE bands run down both sides from P
//     to K and RED ones from K to HS; DISTANCE BOARDS stand along both
//     walls, numbered every five metres with a tick every metre between.
//   * WIND FLAGS on poles down both sides as far as K, the anemometers on
//     masts beside the flight, the JUDGES' TOWER beside the landing hill
//     (five glazed cabins stepped down with the slope), the COACHES'
//     PLATFORMS beside the take-off and the landing, FLOODLIGHT MASTS down
//     both sides for an evening contest, and the leader's line to beat
//     laid across the snow in green.

import { ALBATROSS, SKI_JUMP_RULE, type Level } from "@engine";

import {
  hillFrame,
  hillPoint,
  landingWidth,
  type HillFrame,
  type SkiJumpHill,
} from "./ski-jump-frame.ts";
import { PISTE_LIGHT, solidOf, type PisteLamp, type PisteMast } from "./piste-light-plan.ts";
import { arenaMasts, SJ_ARENA } from "./ski-jump-arena-plan.ts";

const N = SKI_JUMP_RULE.norm;

export { landingWidth };

/** THE DRAWN SIZES (est., off photographs of large hills): the in-run's
 * guard walls (high over the floor, thick), the track's groove (wider
 * than the ski, its lip), the stair beside it; the landing hill's board
 * walls (`N`'s 70 cm); the boards (out past the wall, size); the flags,
 * the anemometers, the floodlight masts (spacing, height, out past the
 * wall); the judges' tower (cabins, the eye over the snow); the coaches'
 * platforms; the lines' widths, m. */
export const SJ_LOOK = {
  wall: { high: 0.55, thick: 0.3 },
  track: { over: 0.03, lip: 0.025 },
  stair: { width: 1.1, rise: 0.18 },
  rail: { high: 0.7 },
  board: { out: 0.55, every: 5, tick: 1, w: 0.9, h: 0.55, lift: 0.75, past: 5 },
  flag: { count: 8, pole: 4.2, out: 1.6 },
  meter: { pole: 7, out: 3.2 },
  mast: { every: 40, height: 26, over: 14, out: 6, lux: 70, lamps: 3 },
  judges: { cabins: 5, cabin: 2.6, deep: 2.4, eye: 6.5 },
  coach: { deck: 3.6, wide: 6, deep: 2.5 },
  line: { k: 0.5, hs: 0.5, p: 0.4, cross: 0.25, beat: 0.35, side: 0.6 },
  /** The in-run's lamps: a post on each wall every so far, its head over
   * the track. */
  lamp: { every: 8, high: 1.6 },
} as const;

/** One distance board: where it stands (m of plan, the side, −1 the
 * jumper's left) and the distance it reads, m — a TICK (no number) on the
 * metres between the numbered ones. */
export type JumpBoard = { d: number; side: -1 | 1; distance: number; tick: boolean };

/** A line dyed across the landing hill: m of plan, its width, m, and what
 * it marks. */
export type JumpLine = {
  d: number;
  width: number;
  kind: "p" | "k" | "hs" | "dye" | "twig" | "fall";
};

/** The hill's furniture, all of it m of plan along the line (`d`) and m
 * across it to the jumper's right (`a`). */
export type SkiJumpPlan = {
  frame: HillFrame;
  /** The in-run: from the deck to the edge, its floor's half-width, the
   * tracks' centres either side of the axis and their groove's half-width. */
  inRun: { from: number; to: number; half: number; track: number; groove: number };
  /** The start gates' places (m of plan) and numbers, the lowest first. */
  gates: readonly { d: number; number: number }[];
  /** The start tower's box behind the deck (m of plan, half its width). */
  tower: { from: number; to: number; half: number };
  /** The knoll's foot and the landing area's end, m of plan. */
  knoll: number;
  boards: readonly JumpBoard[];
  lines: readonly JumpLine[];
  /** The side bands, m of plan: blue from P to K, red from K to HS. */
  bands: { blue: [number, number]; red: [number, number] };
  flags: readonly { d: number; side: -1 | 1 }[];
  meters: readonly { d: number; side: -1 | 1 }[];
  /** The judges' tower: its cabins' places along (m of plan), its side and
   * how far off the axis it stands, m. */
  judges: { d: readonly number[]; side: -1 | 1; off: number };
  coaches: readonly { d: number; side: -1 | 1; off: number }[];
  masts: readonly PisteMast[];
};

/** WHERE A DISTANCE IS MARKED: the m of plan along the hill a landing is
 * credited `distance` m at — `distanceAt` read back, by halving. */
export function planOfDistance(hill: SkiJumpHill, distance: number): number {
  let lo = hill.edge;
  let hi = hill.outrun;
  if (distance <= 0) return lo;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (hill.distanceAt(mid) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The floodlight masts down both sides of the hill: from the in-run's
 * middle to past U, each lamp aimed at the snow ahead of it across the
 * hill — lit as a stage is, for the cameras (`SJ_LOOK.mast.lux`). */
function mastsOf(f: HillFrame, level: Level): PisteMast[] {
  const hill = f.hill;
  const M = SJ_LOOK.mast;
  const out: PisteMast[] = [];
  const from = hill.from + 20;
  // Down to the stadium, whose own masts light the out-run (`arenaMasts`).
  for (let d = from; d <= hill.u - SJ_ARENA.side.above - 6; d += M.every) {
    for (const side of [-1, 1] as const) {
      const a = side * (Math.max(landingWidth(hill, d) / 2, 3) + M.out);
      const foot = hillPoint(f, d, a);
      const y = level.groundAt(foot.x, foot.z);
      // Beside the raised in-run the mast stands from the ground far under
      // the deck, and is as much taller as its lamps must clear the deck.
      const height = Math.max(M.height, foot.y - y + M.over);
      const served = M.every * (Math.max(landingWidth(hill, d), 8) / 2);
      const lumens = (M.lux * served) / PISTE_LIGHT.utilisation / M.lamps;
      const lamps: PisteLamp[] = [];
      for (let i = 0; i < M.lamps; i++) {
        const spread = (i - (M.lamps - 1) / 2) * 0.7;
        const lx = foot.x + f.fx * spread;
        const lz = foot.z + f.fz * spread;
        const ly = y + height;
        // Thrown well across the hill and down it, so the foot of the mast is
        // no pool and the lamps of a side overlap into one wash.
        const t = hillPoint(f, d + 8 + i * 14, -side * 0.35 * landingWidth(hill, d));
        const ax = t.x - lx;
        const ay = t.y - ly;
        const az = t.z - lz;
        const n = Math.hypot(ax, ay, az);
        const aim = Math.atan2(Math.hypot(ax, az), -ay);
        lamps.push({
          x: lx,
          y: ly,
          z: lz,
          dx: ax / n,
          dy: ay / n,
          dz: az / n,
          aim,
          bearing: Math.atan2(ax, az),
          lumens,
          peak: lumens / solidOf(aim),
        });
      }
      // Facing across the hill, toward its axis.
      const heading = Math.atan2(-f.rx * side, -f.rz * side);
      out.push({ x: foot.x, y, z: foot.z, height, side, heading, lamps });
    }
  }
  out.push(...arenaMasts(f, level));
  return out;
}

const plans = new WeakMap<Level, SkiJumpPlan | null>();

/** THE HILL'S FURNITURE on `level`, or null on a map with no hill. */
export function skiJumpPlan(level: Level): SkiJumpPlan | null {
  const kept = plans.get(level);
  if (kept !== undefined) return kept;
  const f = hillFrame(level);
  const plan = f ? planOver(f, level) : null;
  plans.set(level, plan);
  return plan;
}

function planOver(f: HillFrame, level: Level): SkiJumpPlan {
  const hill = f.hill;
  const L = SJ_LOOK;
  const B = L.board;
  const w = hill.w;
  // The tracks: the skis' stance apart, a groove a little wider than the ski.
  const track = ALBATROSS.stance / 2;
  const groove = ALBATROSS.tipWidth / 2 + 0.02;
  const boards: JumpBoard[] = [];
  const first = Math.ceil(w / 2 / B.every) * B.every;
  for (let dist = first; dist <= hill.hs + B.past; dist += B.tick) {
    const d = planOfDistance(hill, dist);
    const tick = dist % B.every !== 0;
    for (const side of [-1, 1] as const) boards.push({ d, side, distance: dist, tick });
  }
  const at = (distance: number) => planOfDistance(hill, distance);
  const lines: JumpLine[] = [
    { d: hill.p, width: L.line.p, kind: "p" },
    { d: hill.k, width: L.line.k, kind: "k" },
    { d: hill.l, width: L.line.hs, kind: "hs" },
    { d: hill.to, width: L.line.k, kind: "fall" },
  ];
  // Spruce twigs every ten metres and a blue dye line on the fives between,
  // from half K to past HS, clear of the marked lines.
  for (let dist = first; dist <= hill.hs + B.past; dist += B.every) {
    const d = at(dist);
    if (lines.some((l) => Math.abs(l.d - d) < 2.5)) continue;
    lines.push({ d, width: L.line.cross, kind: dist % 10 === 0 ? "twig" : "dye" });
  }
  // The flags from the edge to K, a little past the knoll's foot first.
  const flags: { d: number; side: -1 | 1 }[] = [];
  for (let i = 0; i < L.flag.count; i++) {
    const d = hill.edge + 8 + ((hill.k - hill.edge - 8) * i) / (L.flag.count - 1);
    flags.push({ d, side: -1 }, { d, side: 1 });
  }
  // The anemometers at the edge, half K and K (`HILL_AIR`'s stations stand
  // between: the drawn masts are the three a hill carries in sight).
  const meters = [
    { d: hill.edge + 4, side: 1 as const },
    { d: at(w / 2), side: -1 as const },
    { d: hill.k, side: 1 as const },
  ];
  // The judges' tower: the norm's band along (0.6–0.8 w) and off the axis
  // (0.25–0.5 w), at the near end of both, on the jumper's left; its five
  // cabins stepped down the slope one a cabin's width apart.
  const T = N.tower;
  const mid = at(((T.from + T.to) / 2) * w);
  const judges = {
    d: Array.from(
      { length: L.judges.cabins },
      (_, i) => mid + (i - (L.judges.cabins - 1) / 2) * L.judges.cabin,
    ),
    side: -1 as const,
    off: T.off[0] * w,
  };
  const coaches = [
    { d: hill.edge - 4, side: 1 as const, off: N.widths.inRun / 2 + 6 },
    { d: at(w * 0.85), side: 1 as const, off: landingWidth(hill, at(w * 0.85)) / 2 + 7 },
  ];
  return {
    frame: f,
    inRun: { from: 0, to: hill.edge, half: N.widths.inRun / 2, track, groove },
    gates: hill.gates.map((g) => ({ d: g.x, number: g.number })),
    tower: { from: -9, to: 0, half: 4.5 },
    knoll: hill.edge,
    boards,
    lines,
    bands: { blue: [hill.p, hill.k], red: [hill.k, hill.l] },
    flags,
    meters,
    judges,
    coaches,
    masts: mastsOf(f, level),
  };
}
