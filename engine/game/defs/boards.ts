// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARDS — the snowboards this game is ridden on, stated as data beside
// the skis (`skis.ts`). A board is the same kind of thing to the engine as
// a pair of skis: a sidecut on the snow under a rider whose legs are the
// only suspension, read by the same model. What makes it a board is
// `SkiSpec.board` (`BoardFit`): ONE deck under BOTH feet, so its stations
// stand in one column down the deck's centreline at the board's whole width
// (`suspension.ts`), the feet one behind the other along it, no poles in the
// rider's hands, and a twin that rides backward (FAKIE) as well as forward
// and never turns round to ride the other way (`switch.ts`).
//
// The body frame is the skis' own: z along the board, nose forward, x to
// its right. The rider stands across it — a REGULAR rider (the left foot at
// the nose) faces the board's right, so his toe edge is its right edge and
// his heel edge its left; a GOOFY one the other way round. The two edges
// are not each other's mirror: the heelside is the weaker (`BoardFit.heel`,
// read through `limits.ts`'s `edgeSideOf`), and the board is ridden with
// its own technique (`defs/technique.ts`'s `BOARD_TECHNIQUE`).
//
// THE RANGE is six boards, each a real CLASS of board kept as the BANDS its
// numbers sit in, never a make — as the skis are classes of ski, and each an
// answer to a kind of snow: the LYNX (an all-mountain twin, the board most
// riders ride), the PIKA (a beginner's soft rocker board), the STOAT (a soft
// park twin), the PTARMIGAN (a freeride powder board: long, set back,
// tapered, its nose rockered), the WOLF (a stiff big-mountain charger) and
// the GOSHAWK (an alpine carving board ridden in hard boots: long, narrow,
// stiff, on steep forward angles). Sources are the board-sizing and stance
// charts and the carving and wind-tunnel literature gathered in the
// project's snowboard research; the bands are restated in `docs/riding.md`
// and `tests/board_range_test.ts` holds every board inside its own.
//
// THE OUTLINE AND THE SPEC AGREE: each board's nose and tail are its waist
// plus twice the side depth its sidecut cuts over its effective edge (0.76
// of its length, the look's contact points — `board-look.ts`), R ≈ c² / 8d,
// so the deck drawn is the circle the physics carves.
//
// `SKI_CATALOG` is the skis alone and no board is dealt to a start line: a
// board is ridden where a run asks for one by its id (`pairById`) — the
// player's pick on the gear card where a run lets a free choice of pair (the
// free ride and the park run; the app's `boardAllowed`), the night's keen
// riders (`enthusiasts.ts`, off a stream of their own), the labs and the
// suite. A board added moves no ski run.

import { SKIS, isSkiId, skisById, type BoardId, type PairId, type SkiSpec } from "./skis.ts";

/** THE LYNX — an ALL-MOUNTAIN TWIN snowboard, named for the cat whose wide
 * paws carry it over deep snow: 1.56 m long, 25 cm under the feet, a 7.8 m
 * sidecut, ridden duck at +15/−15 on a centred stance. It floats where a
 * pair of skis sinks (the whole rider on one wide deck), carves a short arc
 * off its deep sidecut, is slower onto an edge than a ski (the edge is half
 * a board's width from the foot that tips it), rides fakie as well as
 * forward, and is slow in a tuck — a rider crouches side-on to the wind and
 * cannot fold his shoulders out of it as a skier does. */
export const LYNX: SkiSpec = {
  ...SKIS,
  id: "lynx",
  name: "Lynx",
  kind: "All-mountain board",
  blurb: "One wide deck under both feet: floats the powder, carves short, rides either way round.",
  // The catalog's medium rider, 80 kg in his kit, as every pair carries.
  skierMass: 80,
  // The board ~3.0 kg (2.3–4.5 kg bare, ~3.0 kg at 159 cm ±15 %), a pair
  // of strap bindings ~1.7 kg (4.5–5 kg with the board), soft boots ~2 kg
  // (1.5–2.5): 6.7 kg, and no poles.
  gearMass: 6.7,
  // 156 cm: an all-mountain board for a rider of about 1.75–1.80 m runs
  // 150–162 cm, about his chin to his nose.
  length: 1.56,
  // 25 cm under the feet: the waist is set by the boot, not the class —
  // 25–25.5 cm for the middle of men's boot sizes.
  waist: 0.25,
  // A true twin, nose and tail alike, each 4.5 cm wider than the waist (the
  // band is 2–4 cm; the carving literature's reference board, 2.4 cm of
  // side depth on 125 cm of contact, is 4.8): 2.25 cm of side depth over
  // ~1.18 m of effective edge is the 7.8 m circle below
  // (R ≈ c² / 8d + d / 2).
  tipWidth: 0.295,
  tailWidth: 0.295,
  // THE SIDECUT: an all-mountain board's 7–9 m (a park twin 6.5–8.6, a
  // freeride board 8–11). It carves R_sc · cos(edge) as a ski does
  // (`carveCurvature`): 3.9 m at 60° of edge, 5.5 m at 45°.
  sidecut: 7.8,
  // Medium-soft: a twin is softer than a freeride board and torsionally
  // looser, for presses and butters.
  flex: 0.4,
  // A hybrid: camber under the feet, the contact points lifted 1–2 cm.
  rocker: 0.2,
  // 55°: soft-boot carving stands a board at 40–60°; past that a duck
  // stance on a 25 cm waist drags its boots on the snow (boot-out).
  edgeMax: 0.96,
  // Both feet stand on the deck's centreline: nothing between them across.
  stance: 0,
  // A centred twin: the stance's middle over the board's middle.
  mount: 0.5,
  // A rider's crouch, side-on: the wind-tunnel band for snowboarders is
  // 0.35–0.55 m² across their postures. Stood up he is at its top; his
  // tuck takes off little (crouching cuts his height and none of his
  // width), ~1.7× a racing skier's (0.25–0.35) and a touch over the
  // all-mountain skier's half-tuck — so a board is a little slower flat out.
  cdAUpright: 0.55,
  cdATuck: 0.5,
  // No poles to plant.
  poleReach: 0,
  // The terminal speed on the 20° pitch in his crouch (`terminalSpeed`,
  // `make ride SCENARIO=schuss ARGS="--skis lynx"`): a few km/h under the
  // all-mountain ski's.
  topSpeed: 114,
  board: {
    // 53 cm binding centre to binding centre: 0.30–0.32 × the rider's
    // height (a stance chart runs 43–48 cm for riders under 1.55 m to
    // 56–58 cm over 1.81 m).
    stance: 0.53,
    // DUCK at +15/−15: the freestyle and all-mountain stance that rides
    // switch as well as forward (forward stances run +15…+24 / −15…0).
    front: (15 * Math.PI) / 180,
    back: (-15 * Math.PI) / 180,
    // REGULAR, the left foot forward — some 70 % of riders.
    lead: "regular",
    // THE HEELSIDE IS THE WEAKER EDGE. On his toes his knees drive forward
    // and down into the slope and his ankles flex the boots' tongues; on
    // his heels he sits back over the edge on the highbacks, which stop
    // his shins at their forward lean (12–20° for a carver), so his ankles
    // add next to nothing and his hips go back rather than in. So the
    // heel edge stands at ~47° where the toe edge stands at 55°, and what
    // he angulates past his lean is three fifths of it (est.).
    heel: { edge: 0.85, angulate: 0.6 },
    // Across the board the wind meets his front: an upright figure's drag
    // area is ~0.84 m², a skier's folded racing tuck ~0.46; crouched over
    // his knees, his chest still square to that wind, he is between (est.).
    across: { upright: 0.84, crouch: 0.6 },
  },
};

const deg = (d: number): number => (d * Math.PI) / 180;

/** THE PIKA — a BEGINNER'S board, named for the small round creature of the
 * talus slopes that never strays far: short, soft and ROCKERED between the
 * feet, so its edges stand off the snow until it is tipped onto one and a
 * late or sloppy edge is forgiven rather than caught. 148 cm (a beginner
 * rides a few centimetres under his all-mountain size, about his
 * collarbone) on a 25 cm waist and a 7 m sidecut, the softest flex and the
 * most rocker in the range. It turns at a touch and slides out of trouble,
 * holds little edge and is the slowest flat out. */
export const PIKA: SkiSpec = {
  ...LYNX,
  id: "pika",
  name: "Pika",
  kind: "Beginner board",
  blurb: "Short, soft and rockered: turns at a touch and forgives a late edge.",
  // A light deck (~2.6 kg), basic strap bindings and soft boots.
  gearMass: 6.3,
  // 148 cm: a few centimetres under the all-mountain size.
  length: 1.48,
  waist: 0.25,
  // 2.26 cm of side depth over 1.12 m of effective edge: the 7 m circle.
  tipWidth: 0.295,
  tailWidth: 0.295,
  // A beginner's board runs 7–8 m: a short arc that comes round easily.
  sidecut: 7,
  // The softest in the range, and rockered between the feet.
  flex: 0.2,
  rocker: 0.5,
  // ~45°: a beginner tips a soft board onto its edge and no further.
  edgeMax: 0.78,
  legs: { rate: 6600, bump: 450, rebound: 800, travel: 0.48 },
  cdAUpright: 0.55,
  cdATuck: 0.54,
  topSpeed: 109,
  board: {
    ...LYNX.board!,
    // 51 cm: a touch narrower than the all-mountain stance, easier to stand.
    stance: 0.51,
    // +15/0: the forward stance a first lesson sets.
    front: deg(15),
    back: 0,
  },
};

/** THE STOAT — a FREESTYLE PARK twin, named for the weasel that twists and
 * doubles back faster than the eye: SOFT and torsionally loose for presses
 * and butters, a TRUE TWIN on a centred stance ridden duck at +18/−18 so it
 * is the same board either way round, a few centimetres shorter than the
 * all-mountain board so it spins easily, a short 7.2 m sidecut, flat to
 * rockered between the feet, and a wide stance on soft legs that swallow a
 * landing. Loose on an edge at speed and slow in a tuck. */
export const STOAT: SkiSpec = {
  ...LYNX,
  id: "stoat",
  name: "Stoat",
  kind: "Park board",
  blurb: "A soft true twin: spins, presses and lands anything, loose on an edge at speed.",
  gearMass: 6.4,
  // 152 cm: a park board runs 2–5 cm under the all-mountain size.
  length: 1.52,
  waist: 0.25,
  // 2.3 cm of side depth over 1.16 m of effective edge: the 7.2 m circle.
  tipWidth: 0.296,
  tailWidth: 0.296,
  // A park twin's 6.5–8 m.
  sidecut: 7.2,
  flex: 0.25,
  rocker: 0.35,
  edgeMax: 0.9,
  // A park rider's legs: the softest fold and the most travel (the Hare's).
  legs: { rate: 6800, bump: 460, rebound: 820, travel: 0.48 },
  cdAUpright: 0.55,
  cdATuck: 0.52,
  topSpeed: 111,
  board: {
    ...LYNX.board!,
    // 55 cm: a park rider stands wide, for landings and for riding switch.
    stance: 0.55,
    // Duck at +18/−18.
    front: deg(18),
    back: deg(-18),
  },
};

/** THE PTARMIGAN — a FREERIDE POWDER board, named for the grouse whose
 * feathered feet are its snowshoes: LONG, DIRECTIONAL and SET BACK — 163 cm
 * on a 26.8 cm waist, its nose wider than its tail (1.2 cm of taper) and
 * ROCKERED so it rises onto deep snow, camber under the feet, a 9 m
 * sidecut, the stance 4 cm behind the board's middle so the nose rides up
 * without the back leg burning, on a forward stance of +21/−6. It floats
 * where the rest bog and turns there on its base; on the groomer it is long
 * and vague, and ridden fakie its long nose is the tail. */
export const PTARMIGAN: SkiSpec = {
  ...LYNX,
  id: "ptarmigan",
  name: "Ptarmigan",
  kind: "Powder board",
  blurb: "Long, set back and rockered at the nose: floats the deep snow the others sink in.",
  // A longer, wider deck (~3.3 kg) on the same bindings and boots.
  gearMass: 7,
  // 163 cm: a freeride board runs 2–6 cm over the all-mountain size.
  length: 1.63,
  // 26.8 cm: the widest waist in the range (the class's 25–27 cm), the
  // most deck under the rider and the least pressure on the snow.
  waist: 0.268,
  // Directional: a 31.7 cm nose over a 30.5 cm tail — 2.1 cm of side depth
  // on the mean over 1.24 m of effective edge, the 9 m circle.
  tipWidth: 0.317,
  tailWidth: 0.305,
  // A freeride board's 8–11 m.
  sidecut: 9,
  // A stiffer tail under a softer nose: a little firmer than the twin.
  flex: 0.5,
  // The nose rockered.
  rocker: 0.45,
  edgeMax: 0.94,
  // SET BACK 4 cm (the class's 2.5–10 cm): the stance's middle stands
  // 0.5 − 0.04 / 1.63 of the length from the tail.
  mount: 0.5 - 0.04 / 1.63,
  cdAUpright: 0.55,
  cdATuck: 0.5,
  topSpeed: 114,
  board: {
    ...LYNX.board!,
    stance: 0.54,
    // A forward stance, +21/−6 (the front +15…+24, the back −15…0).
    front: deg(21),
    back: deg(-6),
  },
};

/** THE WOLF — a BIG-MOUNTAIN CHARGER, named for the one that runs its line
 * for miles: long, STIFF and directional, full camber with a little rise at
 * the nose — 164 cm on a 25.8 cm waist, a 10 m sidecut for a long fast arc,
 * set back 2.5 cm on a forward stance of +18/−3. The fastest of the
 * soft-boot boards flat out and the steadiest at speed and off a big
 * landing; slow edge to edge and unforgiving of a lazy one. */
export const WOLF: SkiSpec = {
  ...LYNX,
  id: "wolf",
  name: "Wolf",
  kind: "Big-mountain board",
  blurb: "Long, stiff and fast: holds a big arc at speed and lands big, slow edge to edge.",
  gearMass: 7.3,
  length: 1.64,
  waist: 0.258,
  // A 30.3 cm nose over a 29.1 cm tail: 1.9 cm of side depth on the mean
  // over 1.25 m of effective edge, the 10 m circle.
  tipWidth: 0.303,
  tailWidth: 0.291,
  sidecut: 10,
  flex: 0.8,
  rocker: 0.15,
  edgeMax: 1,
  mount: 0.5 - 0.025 / 1.64,
  // A firmer leg, set for speed and big landings.
  legs: { rate: 7700, bump: 510, rebound: 930, travel: 0.45 },
  cdAUpright: 0.55,
  cdATuck: 0.47,
  topSpeed: 118,
  board: {
    ...LYNX.board!,
    stance: 0.55,
    front: deg(18),
    back: deg(-3),
  },
};

/** THE GOSHAWK — an ALPINE CARVING board, the hard-boot race board, named
 * for the hawk that carves through the trees at full tilt: LONG, NARROW
 * and STIFF, full camber, short tips — 172 cm on a 19.5 cm waist (the
 * class's 17–21 cm; a 174 cm giant slalom board is 19), a 13.5 m sidecut
 * (a giant slalom board's 13–17 m), ridden in HARD BOOTS on plate bindings
 * at steep forward angles, +57/+51 (the front 50–60°, the back 3–6° lower),
 * so the boots stand inside the edges and the board lays over to 70°
 * without dragging them. The hard boot holds the heelside nearly as hard
 * as the toeside, and faced down the board the rider folds into a narrower
 * tuck — the one board that grips like a race ski. Hopeless in powder, the
 * heaviest kit, and no friend in the park. */
export const GOSHAWK: SkiSpec = {
  ...LYNX,
  id: "goshawk",
  name: "Goshawk",
  kind: "Alpine carving board",
  blurb: "Long, narrow and stiff, ridden in hard boots: grips like a race ski and lays over flat.",
  // A 3.9 kg race deck, ~2.1 kg of plate bindings, ~3.4 kg of hard boots.
  gearMass: 9.4,
  length: 1.72,
  waist: 0.195,
  // A 23 cm nose over a 22.35 cm tail: 1.6 cm of side depth on the mean over
  // 1.31 m of effective edge, the 13.5 m circle.
  tipWidth: 0.23,
  tailWidth: 0.2235,
  sidecut: 13.5,
  flex: 0.85,
  rocker: 0,
  // 70°: a hard-boot carver lays the board over past what a soft boot can.
  edgeMax: 1.22,
  mount: 0.5 - 0.02 / 1.72,
  legs: { rate: 7800, bump: 520, rebound: 940, travel: 0.42 },
  // Faced down the board on steep angles he folds into a tuck nearer a
  // skier's than a side-on rider's.
  cdAUpright: 0.55,
  cdATuck: 0.42,
  topSpeed: 126,
  board: {
    ...LYNX.board!,
    // 47 cm: an alpine stance is narrower than a soft-boot one (est.).
    stance: 0.47,
    front: deg(57),
    back: deg(51),
    // The hard boot's shell holds the heel edge nearly as well as the toe.
    heel: { edge: 0.95, angulate: 0.85 },
    // Faced down the board, a wind across it meets his side (est.).
    across: { upright: 0.7, crouch: 0.5 },
  },
};

/** THE BOARDS, in the order a rider would pick them: the all-mountain twin
 * that refuses nothing first, the one that asks most of him last. */
export const BOARD_CATALOG: readonly SkiSpec[] = [LYNX, PIKA, STOAT, PTARMIGAN, WOLF, GOSHAWK];

/** Whether a pair is a snowboard. */
export function isBoard(spec: SkiSpec): boolean {
  return spec.board !== undefined;
}

/** The skis or the board with this id — the catalog's skis, then the
 * boards; the all-mountain ski for an id this build does not carry. */
export function pairById(id: string): SkiSpec {
  return BOARD_CATALOG.find((s) => s.id === id) ?? skisById(id);
}

/** Whether `id` names a pair of skis or a board this build carries. */
export function isPairId(id: string): id is PairId {
  return isBoardId(id) || isSkiId(id);
}

/** Whether `id` names a board this build carries. */
export function isBoardId(id: string): id is BoardId {
  return BOARD_CATALOG.some((s) => s.id === id);
}
