// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MORTAL WOUNDS' NUMBERS (`gore.ts`) — read only on a run that asked
// for them (`CreateGameOptions.gore`, the INJURIES switch's).
//
// A BLOW PAST WHAT A BODY HOLDS TOGETHER. The doses below are the same
// blunt doses `body.ts` judges every injury on — a part's peak g over its
// give and the snow's or the solid's — at the far end of the ladder: a
// part takes a fracture at some 40–90 g, and a blow ten times that is no
// longer a fracture but the part torn away. They sit where the staged
// moments put them (`make gore`'s `--doses`): a body into a trunk at 15 m/s
// is broken but whole; at 25 m/s on its back on ice, or into a steel
// column, the arm or the leg that met it is gone. Each piece's dose is
// spread a seventh either way off a hash of the map and the piece, so two
// falls alike do not always lose the same limb.
//
// THE BLOOD. A grown man of the medium build carries some 5.6 litres
// (70 ml/kg); losing 40 % of it (class IV haemorrhage) is death. A severed
// femoral artery empties a body in minutes and a severed neck in under
// one; THE CLOCK HERE IS SHORTENED FOR PLAY — the flows below are some ten
// times a real one's, so a body that has lost a leg is seen to bleed out in
// the seconds the camera lingers rather than the minutes it would take.
// The heart races as the blood goes (the shock's tachycardia, 120 rising
// to 170 a minute) and the pressure falls with it; once it stops, the
// wounds only drain.

import type { DeathCause } from "../gore-state.ts";

export const GORE = {
  /** THE DOSE (blunt, g) that tears a piece off — on the parts named. */
  sever: {
    /** The neck's: the head torn off. */
    head: 1300,
    /** The arm's (the elbow's point): the whole arm off at the shoulder. */
    arm: 560,
    /** The hand's (a fall onto the hands at speed): the forearm off. */
    forearm: 620,
    /** The thigh's: the whole leg off at the hip. */
    leg: 430,
    /** The knee's: the shin off at the knee. */
    shin: 760,
    /** The abdomen's: the body torn in two at the waist. */
    waist: 980,
  },
  /** The spread of every piece's dose off its hash, ± a share. */
  spread: 0.14,
  /** THE SKULL CRUSHED: the head's own blunt dose, g. */
  crush: 1600,
  /** THE TRUNK OPENED: the chest's and the abdomen's blunt dose, g. */
  open: { chest: 760, abdomen: 560 },
  /** MORTAL past these: an injury of this AIS anywhere, or a body summed
   * to this injury severity score (`severityOf`). */
  mortalAis: 5,
  mortalIss: 50,
  /** RUN THROUGH: a point of the body coming down onto a spike's tip — a
   * tree's top, or a post's of no more than `post` m radius — inside
   * `reach` m of its axis and no more than `above` m over it nor `below`
   * under it, going down faster than `speed` m/s. It slides on down the
   * spike, slowed, and stops `sink` m under the tip at the most. */
  impale: { post: 0.16, reach: 0.32, above: 0.25, below: 0.9, speed: 3.5, sink: 0.55 },
  /** THE BLOOD: the body's volume, L, the share whose loss kills, and the
   * flow out of each wound at the full pressure, L/s (shortened, above). */
  blood: {
    volume: 5.6,
    fatal: 0.4,
    flow: {
      head: 0.45,
      arm: 0.16,
      forearm: 0.08,
      leg: 0.24,
      shin: 0.12,
      waist: 0.5,
      chest: 0.18,
      abdomen: 0.12,
      crush: 0.22,
      impaled: 0.2,
      fracture: 0.03,
    },
    /** A PART HIT HARD bleeds without a mortal wound (`bleedsOf`). A blunt
     * blow at `split` times an injury's even-chance energy splits the skin
     * under the clothes, and the part bleeds OUT at `out[ais]` L/s (the
     * scalp and the face `head` times that); any other injury of AIS 3 or
     * more bleeds INSIDE — a torn organ at `organ[ais]`, a closed break
     * (a femur's or the pelvis's takes litres) at `bone[ais]` — counted
     * among the litres lost and never seen. A split clots by half in
     * `clot` s, a bleed inside in `seal` s. */
    bleed: {
      split: 1.8,
      out: [0, 0, 0.012, 0.025, 0.04, 0.06],
      head: 2,
      organ: [0, 0, 0, 0.03, 0.05, 0.08],
      bone: [0, 0, 0, 0.02, 0.03, 0.04],
      clot: 20,
      seal: 60,
    },
    /** With the heart stopped: what still drains out of the wounds under
     * its own weight, as a share of the flow, and the seconds it halves in
     * — a body torn open empties onto the snow over the next half minute. */
    drain: 0.3,
    halve: 12,
  },
  /** THE HEART: its rate on the first wound and as all the blood that
   * kills is gone, beats a minute — and the seconds it beats on after
   * death, slowing and failing, before it stops. */
  heart: { first: 118, shock: 172, agonal: 4 },
  /** DEATH OF A MORTAL WOUND that does not kill at once: when the blood
   * that kills is gone, or he has lain still `still` s and it is `last` s
   * since the wound — whichever comes first. */
  still: 1.2,
  last: 7,
  /** UNDER A PISTE MACHINE (`groomer.ts`): a point of his body lying in a
   * working machine's footprint, behind its blade's face by `behind` m and
   * no more than `over` m over its tracks, while it moves faster than
   * `speed` m/s — twelve tonnes on two belts and a tiller's shaft turning
   * at some 1000 a minute do not leave a limb on. What goes is spat out of
   * the back of the tiller at `spit` m/s over the machine's own way (a
   * share spread off a hash) and `up` m/s up. */
  machine: { speed: 0.4, behind: 0.6, over: 1.4, spit: 6, up: 4 },
  /** A HELICOPTER'S BLAST (`heli.ts`): the skier on its skid when it comes
   * down is blown apart — each limb off at the shoulder or the elbow, the
   * hip or the knee (dealt off a hash), the head off `head` of the time,
   * torn in two at the waist `waist` of it, the trunk opened. Every piece
   * flies off the body's middle at `out` m/s (± a share off a hash) and
   * `up` m/s up, on top of the blast's own push. */
  blast: { head: 0.55, waist: 0.35, out: 11, up: 6, spread: 0.45 },
} as const;

/** The causes that kill AT ONCE. */
export const INSTANT: readonly DeathCause[] = [
  "head",
  "crush",
  "impaled",
  "opened",
  "torn",
  "maul",
  "machine",
  "blast",
  "rotor",
];
