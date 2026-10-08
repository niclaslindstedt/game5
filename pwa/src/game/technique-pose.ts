// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW EACH TECHNIQUE IS STOOD — a POSE ROW per riding technique
// (`engine/game/defs/technique.ts`'s `TechniqueId`), read by `skier-pose.ts`
// on top of the readings the engine hands every skier alike. The engine's
// row says how a racer works his ski (how fast he rolls it, how far he
// stands it); this one says how he CARRIES HIMSELF doing it — his upper
// body, his hands and poles, his legs, how he goes from one turn to the
// next and how he folds between them. Presentation only: nothing here is
// read by the physics, so no digest moves.
//
// Every number is the measured one of its discipline at the top level
// (`docs/disciplines.md` § Slalom and § Giant slalom, super-G and downhill;
// *(est.)* there marks an estimate), turned into the pose's terms. The FREE
// row is the pose as it stands without this table, to the last bit — so a
// run that names no technique (a free ride, the labs' run alone, the crowd, every
// lab that poses him by hand) is drawn exactly as before.
//
// Three-free and DOM-free: the suite reads it (`tests/technique_pose_test.ts`).

import { TECHNIQUES, type TechniqueId } from "@engine";

import { KNEE_MOST } from "./skier-limbs.ts";
import { clamp01, type V3 } from "./skier-vec.ts";
import { smooth } from "./skier-stroke.ts";

export type TechniquePose = {
  id: TechniqueId;
  /** THE COUNTER-ROTATION at a full turn, rad: the shoulders turned toward
   * the outside ski off the skis' line (the pelvis 0.4 of it) — the upper
   * body kept square to the fall line while the skis turn under it. */
  twist: number;
  /** THE TRUNK'S FORWARD BEND stood up, rad off upright. */
  pitch: number;
  /** THE ANGULATION: the share of the legs' lean in the world the trunk
   * takes back at the hips (a hinge; 0 a stiff stick). */
  angulate: number;
  /** THE UPPER BODY'S LEAD into a turn, a share of `skier-pose.ts`'s
   * `LEAD`: under 1 a quiet upper body over legs that do the work, over 1
   * the body crossed over the skis into the new turn. */
  lead: number;
  /** THE HANDS off the mounts' grips, m: wider (x, each side), higher (y)
   * and further ahead (z). */
  hands: V3;
  /** THE TURN'S POLE PLANT: the share of it he makes (0 never, 1 every
   * turn), and how far forward the fist reaches for it, a multiple of
   * `TURN_PLANT.reach` — a slalom's short firm touch by the boot reaches
   * less than a free skier's swing. */
  plant: { share: number; reach: number };
  /** THE POLES CARRIED UNDER THE ARMS stood up out of the tuck, 0..1: a
   * speed racer's bent poles, which never hang. */
  underArm: number;
  /** THE BLOCK at a pole gate's turning pole: the hand that clears it —
   * the OUTSIDE hand punched forward and across (a slalom's cross-block),
   * or the INSIDE one carried at it (a giant slalom's) — and how much of a
   * block he makes, 0..1. */
  block: { hand: "outside" | "inside"; weight: number };
  /** THE STANCE: how much wider each boot stands than the pair's own half
   * stance, m (negative: narrower) — the pairs stand 0.3 m apart, already
   * in the speed events' 0.25–0.35 m *(est.)*; a slalom racer stands about
   * hip width. */
  stance: number;
  /** THE LEGS IN A TURN: the most the inside knee folds, rad of flexion
   * (180° less the measured knee angle), how much further the pelvis tilts
   * over the higher ski than the shared rule (a multiple) — the inside
   * leg folded, the outside long — and the share of a turn the outside leg
   * is HELD long and still (the hips lifted over it by `HOLD_RISE` × it). */
  legs: { kneeMost: number; hike: number; hold: number };
  /** THE TRANSITION from one turn to the next: how far both legs are
   * pulled up together as the edges cross, m (a cross-under, the skis
   * crossing under a level body; negative a cross-over's rise), and how
   * level the trunk is held through it, 0..1 of its roll taken out. */
  transition: { retract: number; level: number };
  /** THE TUCK: the trunk's pitch in a full tuck, rad off upright — LOW on
   * a straight, HIGH in a turn or rough snow. How deep he tucks is the
   * engine's (`crouch`, which the drag is read off): a slalom racer's bot
   * never tucks between gates, only into the finish. */
  tuck: { low: number; high: number };
};

/** THE FREE SKIER: the shared pose, every number what `skier-pose.ts`
 * holds without a row. */
export const FREE_POSE: TechniquePose = {
  id: "free",
  twist: 0.28,
  pitch: 0.32,
  angulate: 0.6,
  lead: 1,
  hands: { x: 0, y: 0, z: 0 },
  plant: { share: 1, reach: 1 },
  underArm: 0,
  block: { hand: "outside", weight: 0 },
  stance: 0,
  legs: { kneeMost: KNEE_MOST.bent, hike: 1, hold: 0 },
  transition: { retract: 0, level: 0 },
  tuck: { low: 1.25, high: 1.25 },
};

/** THE SLALOM RACER. Countered 15–30° and square to the fall line, the
 * upper body quiet over legs working under it; the hands up, forward and
 * wider than the hips; a short firm pole touch by the boot every turn, the
 * arm kept forward; the OUTSIDE hand punched forward and down at chest
 * height across the turning pole (the cross-block). The inside knee folds
 * to 67 ± 12° (113° of flexion), the outside held only ~11 % of a turn; a
 * hip-width stance; a RETRACTION between turns — both legs pulled up, the
 * skis crossed under a level body. Never a speed racer's tuck. */
export const SLALOM_POSE: TechniquePose = {
  id: "slalom",
  twist: 0.42,
  pitch: 0.36,
  angulate: 0.62,
  lead: 0.6,
  hands: { x: 0.04, y: 0.1, z: 0.1 },
  plant: { share: 1, reach: 0.55 },
  underArm: 0,
  block: { hand: "outside", weight: 1 },
  stance: -0.02,
  legs: { kneeMost: KNEE_MOST.bent, hike: 1.15, hold: 0.11 },
  transition: { retract: 0.11, level: 0.6 },
  tuck: { low: 1.15, high: 1.05 },
};

/** THE GIANT SLALOM RACER. The trunk bent forward 27 ± 8°, countered a
 * little less than a slalom; the hands forward and wide, the pole rarely
 * planted, the gate blocked with the INSIDE hand and arm *(est.)*; the
 * inside knee to 64 ± 9° (116°), the outside LONG and held still 34 % of a
 * turn under a high load; a cross-under on the flat and a cross-over on
 * the steep (half a retraction). */
export const GIANT_SLALOM_POSE: TechniquePose = {
  id: "giantSlalom",
  twist: 0.3,
  pitch: 0.47,
  angulate: 0.6,
  lead: 0.85,
  hands: { x: 0.08, y: 0.04, z: 0.08 },
  plant: { share: 0.25, reach: 0.8 },
  underArm: 0.2,
  block: { hand: "inside", weight: 0.8 },
  stance: 0,
  legs: { kneeMost: 2.02, hike: 1.2, hold: 0.34 },
  transition: { retract: 0.05, level: 0.4 },
  tuck: { low: 1.2, high: 1.05 },
};

/** THE SUPER-G RACER. Countered only ~5–10° *(est.)*, the body crossed
 * over the skis into each turn with little unweighting; the bent poles
 * carried under the arms, the hands forward and together; the inside knee
 * to 60 ± 8° (120°), the outside held 42 % of a turn; the pair's own
 * stance, a little wider than a slalom's; a low tuck on the straights, a high one in the turns. */
export const SUPER_G_POSE: TechniquePose = {
  id: "superG",
  twist: 0.15,
  pitch: 0.42,
  angulate: 0.55,
  lead: 1.15,
  hands: { x: -0.06, y: 0.04, z: 0.06 },
  plant: { share: 0, reach: 1 },
  underArm: 1,
  block: { hand: "outside", weight: 0 },
  stance: 0,
  legs: { kneeMost: 2.09, hike: 1.2, hold: 0.42 },
  transition: { retract: -0.03, level: 0.2 },
  tuck: { low: 1.4, high: 1.03 },
};

/** THE DOWNHILL RACER. The least counter-rotation (~5–10° *(est.)*), a
 * cross-over; the bent poles under the arms, the hands forward and
 * together; the inside knee to 58 ± 9° (122°), the outside held 38 % of a
 * turn; the pair's own stance; a LOW TUCK on the straights — the torso
 * 0–15° off level — standing into a HIGH ONE (25–35°) in the turns and
 * the rough. */
export const DOWNHILL_POSE: TechniquePose = {
  id: "downhill",
  twist: 0.12,
  pitch: 0.42,
  angulate: 0.52,
  lead: 1.15,
  hands: { x: -0.06, y: 0.04, z: 0.06 },
  plant: { share: 0, reach: 1 },
  underArm: 1,
  block: { hand: "outside", weight: 0 },
  stance: 0,
  legs: { kneeMost: 2.13, hike: 1.2, hold: 0.38 },
  transition: { retract: -0.03, level: 0.2 },
  tuck: { low: 1.45, high: 1.0 },
};

/** THE SKI-CROSS RACER (R35). A giant slalom racer's stance a little
 * lower and wider for the rollers and the landings *(est.)*: the trunk bent
 * forward, countered a little through the berms; the hands forward and
 * wide for balance in the pack, the poles planted only out of the gate and
 * on the flats; the inside knee deep in a berm, the outside long; a
 * cross-under on the flat; a glider's low tuck on the straights and a high
 * one over the features. */
export const SKI_CROSS_POSE: TechniquePose = {
  id: "skiCross",
  twist: 0.22,
  pitch: 0.45,
  angulate: 0.55,
  lead: 0.95,
  hands: { x: 0.1, y: 0.04, z: 0.08 },
  plant: { share: 0.1, reach: 0.8 },
  underArm: 0.3,
  block: { hand: "outside", weight: 0 },
  stance: 0.02,
  legs: { kneeMost: 2.06, hike: 1.2, hold: 0.36 },
  transition: { retract: 0.05, level: 0.35 },
  tuck: { low: 1.35, high: 1.05 },
};

/** THE SPEED SKIER (R34). No turn: the tuck held rigid all the way down —
 * the head low and the SEAT HIGH to press the skis down, the trunk folded
 * past level and the hands in front of the helmet, carried some 20 cm
 * ahead of it as the speed builds (the leading edge and a rudder), together;
 * the bent poles braced under the arms; the skis flat, a little closer
 * than hip width; no counter, no angulation to speak of, no plant. */
export const SPEED_SKI_POSE: TechniquePose = {
  id: "speedSki",
  twist: 0.04,
  pitch: 0.45,
  angulate: 0.2,
  lead: 0.8,
  hands: { x: -0.08, y: 0.08, z: 0.2 },
  plant: { share: 0, reach: 1 },
  underArm: 1,
  block: { hand: "outside", weight: 0 },
  stance: -0.02,
  legs: { kneeMost: 2.0, hike: 1, hold: 0 },
  transition: { retract: 0, level: 0.5 },
  tuck: { low: 1.55, high: 1.4 },
};

/** THE MOGUL SKIER (R40). The upper body square to the fall line and
 * still while the skis turn under it — the most counter-rotation of any
 * row — the trunk bent well forward over the knees; the hands up, forward
 * and wide, a pole plant on every turn, short, by the boot; a hip-width
 * stance; the knees folded deepest of all as a mogul is absorbed and the
 * outside leg held long only for a moment; a big RETRACTION between turns,
 * the skis crossed under a level body. Never a tuck. */
export const MOGULS_POSE: TechniquePose = {
  id: "moguls",
  twist: 0.55,
  pitch: 0.42,
  angulate: 0.55,
  lead: 0.45,
  hands: { x: 0.08, y: 0.12, z: 0.14 },
  plant: { share: 1, reach: 0.5 },
  underArm: 0,
  block: { hand: "outside", weight: 0 },
  stance: -0.03,
  legs: { kneeMost: KNEE_MOST.bent, hike: 1.2, hold: 0.08 },
  transition: { retract: 0.15, level: 0.8 },
  tuck: { low: 1.15, high: 1.05 },
};

export const TECHNIQUE_POSES: Readonly<Record<TechniqueId, TechniquePose>> = {
  free: FREE_POSE,
  slalom: SLALOM_POSE,
  giantSlalom: GIANT_SLALOM_POSE,
  superG: SUPER_G_POSE,
  downhill: DOWNHILL_POSE,
  skiCross: SKI_CROSS_POSE,
  speedSki: SPEED_SKI_POSE,
  moguls: MOGULS_POSE,
};

/** The pose row a run's skier carries himself by: its technique's (the
 * engine's `techniqueOf` names the same rows), the free skier's when it
 * names none. */
export function techniquePoseOf(
  rules: { technique?: TechniqueId } | null | undefined,
): TechniquePose {
  return TECHNIQUE_POSES[TECHNIQUES[rules?.technique ?? "free"].id];
}

/** How far the hips are lifted over the outside leg at a full hold, m,
 * and the knee's flexion it is let out to at the most, rad — the measured
 * outside knee at its longest, 127–132° (48–53° of flexion), never locked. */
export const HOLD_RISE = 0.1;
export const HOLD_FLEX = 0.87;

/** The trunk's pitch in a full tuck on row `row`, rad off upright, `turn`
 * 0..1 into a turn: the low tuck on a straight, the high in a turn. */
export function tuckPitch(row: TechniquePose, turn: number): number {
  return row.tuck.low + (row.tuck.high - row.tuck.low) * smooth(clamp01(turn));
}

/** HOW FAR THROUGH AN EDGE CHANGE he is, 0..1: the skis near flat (`tilt`,
 * rad) while he has been turning (`swing`, his recent edge, rad) — 0 on a
 * straight run, where a flat ski is no transition at all. */
export function transitOf(tilt: number, swing: number): number {
  return smooth(clamp01(swing / 0.35)) * (1 - smooth(clamp01(Math.abs(tilt) / 0.35)));
}

/** A pole gate as the block reads it (`Checkpoint`'s own fields). */
type PoleGate = {
  x: number;
  z: number;
  heading: number;
  width: number;
  pole?: "open" | "closed";
  turn?: -1 | 1;
};

/** What the block reads of a run: its gates and the one it owes. */
export type BlockRun = {
  level: { checkpoints: readonly PoleGate[] };
  progress?: { nextCheckpoint: number };
};

/** THE BLOCK at a gate: the side the turning pole passes him on (−1 his
 * left, 1 his right) and how far into the block he is, 0..1. */
export type GateBlock = { side: -1 | 1; w: number };

export const NO_BLOCK: GateBlock = { side: 1, w: 0 };

/** THE BLOCK'S TIMING, s to the turning pole: the punch starts `lead` s
 * before he reaches it, is out from `hit` s before to `hold` s after, and
 * drawn back over `back` s — a quick jab, eased at both ends; and how far
 * across from his line the pole may pass and still be blocked, m (full
 * inside `near`, none past `far`). */
export const BLOCK = { lead: 0.4, hit: 0.06, hold: 0.04, back: 0.32, near: 1.0, far: 2.2 };

/**
 * THE GATE HE IS CLEARING: the turning pole of the open pole gate he owes
 * — or the one he has just passed, so the punch is drawn back after it
 * rather than dropped — as a side and a weight off WHERE IT STANDS from
 * him, measured along the way he is going (`vx`, `vz`) and timed by his
 * speed. A pure function of the run: no state, the same in a still.
 */
export function gateBlock(
  run: BlockRun | null | undefined,
  skier: { x: number; z: number; vx: number; vz: number; speed: number },
): GateBlock {
  const next = run?.progress?.nextCheckpoint;
  if (!run || next === undefined || skier.speed < 3) return NO_BLOCK;
  const v = Math.hypot(skier.vx, skier.vz);
  if (v < 1e-3) return NO_BLOCK;
  const fx = skier.vx / v;
  const fz = skier.vz / v;
  let best = NO_BLOCK;
  for (const k of [next - 1, next]) {
    const c = run.level.checkpoints[k];
    if (!c || c.pole !== "open" || c.turn === undefined) continue;
    // The turning pole: the gate's end `turn` names, across its line.
    const px = c.x + Math.cos(c.heading) * c.turn * (c.width / 2) - skier.x;
    const pz = c.z - Math.sin(c.heading) * c.turn * (c.width / 2) - skier.z;
    const along = px * fx + pz * fz;
    const across = px * fz - pz * fx;
    const tau = along / skier.speed;
    const time =
      tau >= BLOCK.hit
        ? 1 - smooth(clamp01((tau - BLOCK.hit) / (BLOCK.lead - BLOCK.hit)))
        : tau >= -BLOCK.hold
          ? 1
          : 1 - smooth(clamp01((-tau - BLOCK.hold) / BLOCK.back));
    const near = 1 - smooth(clamp01((Math.abs(across) - BLOCK.near) / (BLOCK.far - BLOCK.near)));
    const w = time * near;
    if (w > best.w) best = { side: across >= 0 ? 1 : -1, w };
  }
  return best;
}

/**
 * THE BLOCKING FIST: where the hand that clears the turning pole goes at a
 * full block, from its shoulder (`shoulder`, the body frame) — the OUTSIDE
 * hand punched forward and down at chest height, across to the pole's side
 * in front of his chest (the cross-block), or the INSIDE hand carried at
 * the pole ahead of its shoulder. `side` is the pole's side (1 right).
 */
export function blockFist(hand: "outside" | "inside", side: -1 | 1, shoulder: V3): V3 {
  return hand === "outside"
    ? { x: side * 0.06, y: shoulder.y - 0.16, z: shoulder.z + 0.5 }
    : { x: shoulder.x + side * 0.1, y: shoulder.y - 0.02, z: shoulder.z + 0.56 };
}

/** Which fist blocks (0 left), for the pole on `side` (1 right). */
export const blockingHand = (hand: "outside" | "inside", side: -1 | 1): 0 | 1 =>
  (hand === "outside") === side > 0 ? 0 : 1;

/** The pole out of fist `i` (0 left) as it blocks: down and back, a little
 * out to that hand's own side — clear of his legs, never swept back through
 * him from a fist punched out ahead of his chest, nor held out like a
 * lance. */
export function blockPole(i: 0 | 1): V3 {
  const out = i === 0 ? -1 : 1;
  const len = Math.hypot(0.35, 0.7, 0.62);
  return { x: (out * 0.35) / len, y: -0.7 / len, z: -0.62 / len };
}

/** THE POLES UNDER THE ARMS, out of a fist: back along his side under the
 * arm, near level and a little out, the baskets behind his hips — a speed
 * racer's bent poles. */
export function underArmPole(side: number): V3 {
  const len = Math.hypot(0.14, 0.06, 1);
  return { x: (side * 0.14) / len, y: 0.06 / len, z: -1 / len };
}

/** THE STANCE HIS TECHNIQUE STANDS IN: each ski moved `stance` m further
 * out (negative: in) across the skis' own line (pivoted `angle` rad), in
 * the snow's plane and rolled into the body as `ski-stand.ts` lays the
 * stance — so the skis, the boots in them and every ski's gap to the snow
 * move as one. A racer's stance is his carve's: thrown across into a skid
 * (`skid`, 0..1) or stepping round at a crawl (`speed`, m/s) he stands on
 * the pair's own. */
export function widenStand(
  stand: {
    incline: number;
    lift: [number, number];
    out: [number, number];
    fore: [number, number];
  },
  stance: number,
  angle: number,
  skid = 0,
  speed = 10,
): void {
  const by = stance * (1 - clamp01(skid)) * smooth(clamp01((speed - 4) / 6));
  if (by === 0) return;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const cr = Math.cos(stand.incline);
  const sr = Math.sin(stand.incline);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    stand.lift[i] += side * by * ca * sr;
    stand.out[i] += side * by * ca * cr;
    stand.fore[i] -= side * by * sa;
  }
}

/** HOW A RUN'S SKIER IS RIDING, for the pose: his technique's row and the
 * block he is making at a gate. */
export type Riding = { style: TechniquePose; block: GateBlock };

/** What `ridingOf` reads of a run. */
export type RidingRun = BlockRun & { rules: { technique?: TechniqueId } };

/** The run's skier riding as his technique rides, at the gate he owes. */
export function ridingOf(
  run: RidingRun,
  skier: { x: number; z: number; vx: number; vz: number; speed: number },
): Riding {
  const style = techniquePoseOf(run.rules);
  return { style, block: style.block.weight > 0 ? gateBlock(run, skier) : NO_BLOCK };
}
