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
// The numbers are a real class's — an ALL-MOUNTAIN TWIN, the board most
// riders ride — kept as the BAND each sits in, never a make. Sources are
// the board-sizing and stance charts and the carving and wind-tunnel
// literature gathered in the project's snowboard research.
//
// Nothing here is on the ski card or dealt to a start line: `SKI_CATALOG`
// is the skis alone, and a board is ridden only where a run asks for one by
// its id (`pairById`) — the labs and the suite, until it has a figure.

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

/** THE BOARDS, in the order a rider would pick them. */
export const BOARD_CATALOG: readonly SkiSpec[] = [LYNX];

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
