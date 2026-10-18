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
//
// HOW REAL BLEEDING STOPS. A body's own haemostasis works in three steps:
// the cut vessel's wall goes into SPASM at once, a plug of platelets forms
// in it within a minute or so, and the clot sets over it in minutes. An
// artery CUT CLEAN THROUGH (a limb torn off) does it best — its ends
// retract into the flesh and clamp down, so a torn limb spurts on the beat
// at first and then slows to an ooze; it is the artery cut part way that
// cannot close and keeps on. Blood from the veins and the skin's small
// vessels never spurts: it wells and runs, and once its flow is down to a
// millilitre or two a second it leaves a wound — or the hem of a sodden
// sleeve — as DROPS (a passive drop is some 0.05 ml), not a stream. On
// the shortened clock the spasm halves a torn artery's spurt in a couple
// of seconds and leaves a few per cent of its flow oozing, which clots in
// its turn.

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
  /** ...and short of them, MORTAL BY THE WHOLE BODY as often as a trauma
   * ward's patients die of the same score: many injuries each short of
   * critical kill together. A logistic with its even chance at `half` and
   * its odds growing e-fold every `spread` points: one in ten at a score of
   * 33, three in ten at 41 and over half at 48 — the major-trauma outcome
   * series' curve for young, fit patients (a skier on the snow is one),
   * which runs below the all-ages ward's. Drawn once a
   * run off a hash (the run's FRAILTY), never the stream: a run that
   * lives through a score lives through any lesser one, and dies of the
   * blow that takes him past it. A score under `least` never kills. */
  frailty: { half: 46, spread: 6, least: 16 },
  /** RUN THROUGH: a point of the body coming down onto a spike's tip — a
   * tree's top, or a post's of no more than `post` m radius — inside
   * `reach` m of its axis and no more than `above` m over it nor `below`
   * under it, going down faster than `speed` m/s — the trunk's points
   * only (the hips and the shoulders); a limb or the head that comes down
   * so is torn open on it instead (`Gash`). It slides on down the
   * spike, slowed — on a post `sink` m under the tip at the most. */
  impale: {
    post: 0.16,
    reach: 0.32,
    above: 0.25,
    below: 0.9,
    speed: 3.5,
    sink: 0.55,
    /** ON A TREE he SINKS DOWN IT under his weight, the stem tapering to
     * its tip, until the trunk is `stop` m in radius (thicker than his
     * weight can force through him) — at most `deep` of the tree's height
     * and never nearer the snow than `clear` m. He slides at `slide` m/s,
     * slowed as the wood thickens to `least` m/s at the end. */
    stop: 0.07,
    deep: 0.35,
    clear: 2.4,
    slide: 2.4,
    least: 0.2,
  },
  /** SMASHED AGAINST STONE OR WOOD: a body ARRIVING at a rigid solid — a
   * trunk, a boulder, steel, a wall, or a crag's bare rock underfoot; never
   * a padded tower or the snow, which give — at more than `speed` m/s
   * (100 km/h), or having done so inside the last `window` s, is not broken
   * there but CRUSHED: every point of him that meets the solid faster than
   * `hit` m/s is pulped where it hit. The head bursts (the skull and the
   * brain out of it); a shoulder stoves in the chest, a hip bursts the
   * belly; a hand, an elbow, a knee or a foot is gone to the joint above it,
   * left as meat on the solid rather than flung off whole. What was crushed
   * is SMEARED on the solid where it met it.
   *
   * Where the number comes from: forensic series of fatal falls find the
   * head injuries extensive, the skull burst and the brain extruded, in
   * falls from above some 30 m — an arrival at 24 m/s or more; and the
   * reconstruction rule of thumb for frontal collisions puts the torso torn
   * and the limbs amputated past about 100 km/h. A body met at 90 km/h is
   * broken (the dose's wounds, above, still tear and crush on their own); at
   * 100 km/h on a solid, what hits is pulp. `rock` is the share of a cell's
   * bare rock (`bareRockAt`) that counts as stone underfoot.
   *
   * MET SQUARE ON — a shoulder or a hip on the solid with his way into its
   * face inside `square` (the cosine between them) — the MIDDLE OF HIM is
   * crushed: the chest and the belly burst together, and the arms and the
   * legs, held to nothing now, are torn off at the shoulders and the hips
   * and go on the way he was going, `fling` of his speed, past the solid on
   * the side each was on at `past` m/s and `up` m/s up.
   *
   * THE BLOOD OUT OF IT. A man of the medium build carries some 5.6 litres
   * (70 ml/kg). Of it the heart's chambers hold about half a litre, the
   * lungs' vessels about as much again, the liver some 10 % of it and the
   * great vessels — the aorta and the venae cavae — the rest of the torso's
   * share; a torn aorta alone empties a body in moments. A middle crushed
   * open bursts all of them at once: `burst` litres leave him in the first
   * moments at up to `pour` L/s, on top of what the opened wounds go on
   * bleeding and draining after — some three to four litres on the snow
   * and the solid all told.
   *
   * A PAD round a lift's tower gives: a foam wrap `TOWER_PAD.thick` deep,
   * crushed flat at about `pad` g, takes the first √(2·g·thick) — some
   * 11 m/s — off a blow and no more. Built for a skier lost at a cruising
   * pace, it is nothing to one at 100 km/h: what is left of his closing
   * speed past the foam is held to the same numbers as bare steel. */
  smash: {
    speed: 27.8,
    window: 0.3,
    hit: 9,
    rock: 0.5,
    square: 0.7,
    fling: 0.8,
    past: 3,
    up: 1.5,
    burst: 2.2,
    pour: 5,
    pad: 30,
  },
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
      pulped: 0.3,
      impaled: 0.2,
      gash: 0.05,
      fracture: 0.03,
    },
    /** A TORN ARTERY CLOSING: the share of a wound's flow that spurts
     * halves every `halve` s off the moment it was torn (the spasm and the
     * retraction); `ooze` of it is left welling out without a beat, and
     * that clots by half every `clot` s. An open fracture's bone end only
     * oozes, clotting the same. */
    spasm: { halve: 2.5, ooze: 0.04, clot: 10 },
    /** A PART HIT HARD bleeds without a mortal wound (`bleedsOf`). A blunt
     * blow at `split` times an injury's even-chance energy splits the skin
     * under the clothes, and the part bleeds OUT at `out[ais]` L/s (the
     * scalp and the face `head` times that); any other injury of AIS 3 or
     * more bleeds INSIDE — a torn organ at `organ[ais]`, a closed break
     * (a femur's or the pelvis's takes litres) at `bone[ais]` — counted
     * among the litres lost and never seen. A split's blood is the skin's
     * and the veins', welling and never on the beat. A split clots by half in
     * `clot` s, a bleed inside in `seal` s. */
    bleed: {
      split: 1.8,
      out: [0, 0, 0.0015, 0.003, 0.005, 0.008],
      head: 2,
      organ: [0, 0, 0, 0.03, 0.05, 0.08],
      bone: [0, 0, 0, 0.02, 0.03, 0.04],
      clot: 8,
      seal: 60,
    },
    /** With the heart stopped: what still drains out of the wounds under
     * its own weight, as a share of the flow, and the seconds it halves in
     * — a body torn open seeps onto the snow over the next half minute. */
    drain: 0.2,
    halve: 8,
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
