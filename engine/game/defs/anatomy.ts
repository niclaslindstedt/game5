// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY'S CATALOG — the block of `TUNING` that answers to `body.ts`:
// the twenty parts a skier is kept as, how much each one gives when it
// meets the snow or a trunk, what the snow itself gives, and the ladder of
// injuries each part can take with the load that does it. It lives beside
// `tuning.ts` and is folded in as `TUNING.injury`, which is how the whole
// repo spells it; nothing reads this module directly but `body.ts`.
//
// EVERY NUMBER HERE IS A MEASUREMENT OR SITS BETWEEN TWO. The sources, in
// the order the numbers below lean on them:
//   - HEAD DROPS ON SNOW (Bailly, Donnadieu, Masson & Arnoux 2023): a 6 kg
//     headform at 6.1 m/s peaks at 51 g on soft snow, 106 g on hard and
//     170 g on very hard — which is what `give` is fitted to: a stop of
//     v² / 2s, peaked half a sine (π/2 the mean), at 6.1 m/s over the
//     head's own 6 mm and the snow's 5.0, 2.2 and 1.2 cm;
//   - CONCUSSION at a head acceleration of 70–100 g (the mean of measured
//     cases 96–103 g), a skull fracture from about 140 g bare and the
//     helmet's test passed at 250 g from 5.4 m/s;
//   - THE CHEST's 60 g over 3 ms (Mertz & Gadd), soft tissue hurt from
//     about 46;
//   - THE SPINE (Eiband 1959; the ejection seat's Dynamic Response Index):
//     about 18 g headward borne without injury, a compression fracture
//     from 20–25 g — read here off the landing's load (`flight.ts`'s
//     `landingLoad`, the equivalent fall height over the legs' stroke),
//     which a failed landing hands the spine whole;
//   - THE KNEE: the anterior cruciate parts at 2.2 kN (Woo 1991); a third
//     of its tears are the valgus and outward twist of a caught edge, a
//     fifth the phantom foot and a twelfth the boot driven into the shin by
//     a landing in the back seat; the medial ligament is the twist's;
//   - THE BOOT-TOP FRACTURE: the shin levered over the boot's rim in a
//     forward fall at speed (the tibia's 280–320 N·m dynamic);
//   - THE HAND: the skier's thumb (the ulnar ligament, the pole in the hand
//     of a fall on it — four in ten of the upper body's injuries) and the
//     wrist broken at 1.6–3.4 kN, from about 0.6 m of fall;
//   - THE TREE: a mean 43 km/h at the moment of a collision, a mean
//     injury severity score of 14.7 against 9.1 for any other fall, and a
//     trunk at 30 km/h already able to kill a skier in a helmet;
//   - ICE: a hard surface lengthens every risk (the cruciate's odds twelve
//     times on an icy slope) — which is the snow's `give` doing it here, not
//     a rule of its own.
// The SEVERITY of each injury is its Abbreviated Injury Scale rank (AIS):
// 1 minor, 2 moderate, 3 serious, 4 severe, 5 critical. Six — unsurvivable
// — is not on any ladder: this is a game, and the worst it says is
// critical.

/** THE PARTS, in the order every per-part array keeps them — the body as
 * the HUD draws it, seen from behind (`hud-body.tsx`). */
export const BODY_PARTS = [
  "head",
  "neck",
  "chest",
  "back",
  "abdomen",
  "pelvis",
  "shoulderL",
  "shoulderR",
  "armL",
  "armR",
  "handL",
  "handR",
  "thighL",
  "thighR",
  "kneeL",
  "kneeR",
  "shinL",
  "shinR",
  "footL",
  "footR",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

/** HOW A LOAD MEETS A PART: `blunt` a blow on it (g at the part, off the
 * stop it is brought to), `load` the landing's own load through the legs
 * and the spine (g), `drawer` the same landing taken in the back seat or
 * crooked (g, raised by how far), `twist` a caught edge or a twisting fall
 * (m/s of slide when the edge bit), `bend` the shin levered forward over
 * the boot (m/s of a fall over the tips). */
export type Mechanism = "blunt" | "load" | "drawer" | "twist" | "bend";

/** WHICH SIDE OF THE TRUNK a blow came on, for the injuries that care:
 * the front, the back (the kidneys), the left (the spleen), the right (the
 * liver). */
export type Facing = "front" | "back" | "left" | "right";

/** ONE INJURY a part can take: its severity (AIS), the mechanism that does
 * it, the dose of that mechanism with an even chance of it (`at`), and —
 * for the trunk's organs — the side the blow must come from. */
export type InjuryDef = {
  part: BodyPart | "arm" | "hand" | "shoulder" | "thigh" | "knee" | "shin" | "foot";
  ais: 1 | 2 | 3 | 4 | 5;
  mech: Mechanism;
  at: number;
  face?: Facing;
};

/** THE INJURIES, by name — the engine names them and never says them
 * (`pwa/src/game/strings-body.ts` owns the words). A paired part's ladder
 * is written once and stands on either side. */
export const INJURIES = {
  // THE HEAD — in a helmet, which on snow changes the peak little (the
  // headform study) and against a trunk crushes its liner (`helmet`).
  headBump: { part: "head", ais: 1, mech: "blunt", at: 45 },
  concussion: { part: "head", ais: 2, mech: "blunt", at: 95 },
  knockedOut: { part: "head", ais: 3, mech: "blunt", at: 150 },
  skullFracture: { part: "head", ais: 4, mech: "blunt", at: 230 },
  brainInjury: { part: "head", ais: 5, mech: "blunt", at: 320 },
  // THE NECK, whipped by the head's blow (`share`) and by a landing.
  whiplash: { part: "neck", ais: 1, mech: "blunt", at: 24 },
  neckSprain: { part: "neck", ais: 2, mech: "blunt", at: 45 },
  neckFracture: { part: "neck", ais: 3, mech: "blunt", at: 80 },
  brokenNeck: { part: "neck", ais: 5, mech: "blunt", at: 130 },
  // THE CHEST — the ribs and the lungs behind them.
  bruisedRibs: { part: "chest", ais: 1, mech: "blunt", at: 24 },
  brokenRibs: { part: "chest", ais: 2, mech: "blunt", at: 52 },
  collapsedLung: { part: "chest", ais: 3, mech: "blunt", at: 85 },
  flailChest: { part: "chest", ais: 4, mech: "blunt", at: 130 },
  // THE BACK — the thoracolumbar spine, by a blow on it and by the axial
  // load of a landing the legs did not take.
  bruisedBack: { part: "back", ais: 1, mech: "blunt", at: 24 },
  backStrain: { part: "back", ais: 1, mech: "load", at: 13 },
  compressedVertebra: { part: "back", ais: 2, mech: "load", at: 15.5 },
  brokenBack: { part: "back", ais: 3, mech: "load", at: 21 },
  brokenBackBlow: { part: "back", ais: 3, mech: "blunt", at: 75 },
  spinalCord: { part: "back", ais: 5, mech: "load", at: 30 },
  // THE ABDOMEN — winded from any side; the kidneys from behind, the
  // spleen from the left and the liver from the right.
  winded: { part: "abdomen", ais: 1, mech: "blunt", at: 20 },
  bruisedKidney: { part: "abdomen", ais: 2, mech: "blunt", at: 42, face: "back" },
  tornKidney: { part: "abdomen", ais: 3, mech: "blunt", at: 75, face: "back" },
  tornSpleen: { part: "abdomen", ais: 3, mech: "blunt", at: 62, face: "left" },
  rupturedSpleen: { part: "abdomen", ais: 4, mech: "blunt", at: 100, face: "left" },
  tornLiver: { part: "abdomen", ais: 3, mech: "blunt", at: 62, face: "right" },
  lacerated: { part: "abdomen", ais: 4, mech: "blunt", at: 105, face: "front" },
  // THE PELVIS — the hip pointer of a fall on the side, and the ring.
  bruisedHip: { part: "pelvis", ais: 1, mech: "blunt", at: 18 },
  crackedPelvis: { part: "pelvis", ais: 2, mech: "blunt", at: 48 },
  brokenPelvis: { part: "pelvis", ais: 3, mech: "blunt", at: 75 },
  // THE SHOULDER — a point load on it, and the fall on the arm.
  bruisedShoulder: { part: "shoulder", ais: 1, mech: "blunt", at: 15 },
  separatedShoulder: { part: "shoulder", ais: 1, mech: "blunt", at: 24 },
  dislocatedShoulder: { part: "shoulder", ais: 2, mech: "blunt", at: 31 },
  brokenCollarbone: { part: "shoulder", ais: 2, mech: "blunt", at: 38 },
  // THE ARM — the elbow and the bones either side of it.
  bruisedElbow: { part: "arm", ais: 1, mech: "blunt", at: 16 },
  dislocatedElbow: { part: "arm", ais: 2, mech: "blunt", at: 36 },
  brokenArm: { part: "arm", ais: 2, mech: "blunt", at: 46 },
  // THE HAND — the skier's thumb, then the wrist.
  sprainedThumb: { part: "hand", ais: 1, mech: "blunt", at: 12 },
  sprainedWrist: { part: "hand", ais: 1, mech: "blunt", at: 17 },
  skiersThumb: { part: "hand", ais: 2, mech: "blunt", at: 21 },
  brokenWrist: { part: "hand", ais: 2, mech: "blunt", at: 28 },
  // THE THIGH — a dead leg, and the femur, which takes a trunk to break.
  deadLeg: { part: "thigh", ais: 1, mech: "blunt", at: 26 },
  brokenFemur: { part: "thigh", ais: 3, mech: "blunt", at: 90 },
  // THE KNEE — skiing's own injury: sprained by a hard landing, the
  // medial ligament by the twist, the cruciate by the twist and by the
  // back seat, the meniscus behind it, and the kneecap by a blow.
  sprainedKnee: { part: "knee", ais: 1, mech: "drawer", at: 13 },
  bruisedKnee: { part: "knee", ais: 1, mech: "blunt", at: 20 },
  tornMcl: { part: "knee", ais: 2, mech: "twist", at: 9.5 },
  tornAcl: { part: "knee", ais: 2, mech: "drawer", at: 15 },
  tornAclTwist: { part: "knee", ais: 2, mech: "twist", at: 11.5 },
  tornMeniscus: { part: "knee", ais: 2, mech: "twist", at: 13 },
  brokenKneecap: { part: "knee", ais: 2, mech: "blunt", at: 60 },
  // THE SHIN — bruised by a trunk, broken over the boot's rim.
  bruisedShin: { part: "shin", ais: 1, mech: "blunt", at: 22 },
  bootTop: { part: "shin", ais: 2, mech: "bend", at: 20 },
  brokenShin: { part: "shin", ais: 2, mech: "blunt", at: 95 },
  // THE FOOT, in a boot that takes most of what reaches it.
  bruisedFoot: { part: "foot", ais: 1, mech: "blunt", at: 28 },
  sprainedAnkle: { part: "foot", ais: 1, mech: "blunt", at: 45 },
  brokenAnkle: { part: "foot", ais: 2, mech: "blunt", at: 70 },
} as const satisfies Record<string, InjuryDef>;

export type InjuryKind = keyof typeof INJURIES;

/** THE BODY (`body.ts`). */
export const INJURY = {
  /** THE STOP each part is brought to against a hard surface, m: the
   * flesh, the bone's own flex and the clothes over it — the half of the
   * stopping distance that is the body's. The snow's half is `snow`; a
   * trunk adds `tree` (the bark, the branches, the trunk's own sway) and,
   * on the head, the helmet's liner crushing (`helmet`) — which it does
   * against a trunk and not against snow (the headform study). A LIMB's give
   * is its joints folding as well — the arm at the elbow and the shoulder
   * under a hand put down, the leg at the knee and the boot's shell round
   * the foot — so it is several times the trunk's. */
  give: {
    head: 0.006,
    neck: 0.006,
    chest: 0.04,
    back: 0.03,
    abdomen: 0.06,
    pelvis: 0.04,
    shoulder: 0.03,
    arm: 0.05,
    hand: 0.06,
    thigh: 0.05,
    knee: 0.05,
    shin: 0.04,
    foot: 0.08,
  },
  tree: 0.01,
  helmet: 0.012,
  /** THE SNOW'S GIVE, m: bare ice, the groomer (the study's hard snow),
   * and loose snow — `soft` of it at once and `deep` more for every unit of
   * the run's snow dial (`depthUnder`, the new fall counted in), so a body
   * dropped into a deep day's powder is stopped over a third of a metre. */
  snow: { ice: 0.012, packed: 0.022, soft: 0.05, deep: 0.12 },
  /** A blow's peak over its mean: a half sine's (π/2). */
  peak: Math.PI / 2,
  /** THE RISK CURVE: an injury of dose `at` is an even chance, and the
   * chance at a dose `d` is 1 / (1 + (at / d)^steep) — the log-logistic of
   * the injury-risk curves — so three quarters of the dose is a chance in
   * eleven and a quarter more six in seven; under `floor` of it, none — so
   * a square landing a pro calls clean (`landing.clean`) hurts nothing. */
  steep: 8,
  floor: 0.5,
  /** A part already hurt is hurt again more easily: every AIS rank it has
   * taken lowers its every threshold by this share. */
  weaken: 0.06,
  /** WHAT REACHES A PART BESIDE THE ONE STRUCK — the ragdoll's points
   * (`ragdoll.ts`) are the hips, the shoulders, the head and the joints, and
   * a blow on one is shared on: the head's whips the neck, a hand's runs up
   * the arm to the shoulder (the fall on an outstretched hand), a knee's
   * into the thigh and the shin, a shoulder's or a hip's into the trunk on
   * the side it faces down. */
  share: {
    neck: 0.35,
    handArm: 0.5,
    handShoulder: 0.5,
    elbowShoulder: 0.4,
    kneeThigh: 0.5,
    kneeShin: 0.4,
    footShin: 0.5,
    trunk: 0.6,
  },
  /** A TRUNK met on the skis: square in front of them the tips meet it and
   * the skis stop over the bindings' release and the legs' fold, `stop` m —
   * the shins levered and the knees twisted, the blow the body's own once
   * it is thrown on into it; beside him it takes the shoulder, the arm, the
   * ribs, the flank, the hip, the thigh and a glancing share of the head. */
  front: { stop: 0.6 },
  side: { shoulder: 1, arm: 0.7, chest: 0.6, abdomen: 0.5, pelvis: 0.4, thigh: 0.4, head: 0.25 },
  /** THE LANDING: the knees' drawer load is `square` of the landing's g
   * on a landing square on the skis — the cruciate is torn by the back seat
   * and the twist, not by a load the legs fold straight down under — and
   * more by `backSeat` at the tails as far down as `landing.tailsDown`, and
   * by `crooked` at a roll as far as `landing.rolled`; the neck takes `neck`
   * of the landing's load as a blow; and a landing the legs folded under
   * (`legsFold`) hands the spine `folded` times its load; one he came
   * down on his body in (`SkierState.bodyHit`) the legs carried `onBody`
   * of. */
  square: 0.6,
  backSeat: 1.2,
  crooked: 0.6,
  neck: 1.6,
  folded: 1.3,
  onBody: 0.4,
  /** The most new injuries one step's blows do — the worst of what was
   * drawn. */
  perBlow: 3,
  /** THE FALLS that are a mechanism rather than a blow: a caught edge
   * twists the knee of the ski that caught at the slide's speed; a fall at
   * speed twists it at `rollTwist` of the speed; a fall over the tips
   * levers the shins over the boots at the speed and twists the knees at
   * `noseTwist` of it. */
  rollTwist: 0.5,
  noseTwist: 0.45,
  /** A point's way into the snow under this is lying on it, not meeting
   * it, m/s. */
  touch: 0.8,
  /** THE G METER: a blow is billed from `shown` g (a landing from
   * `landingShown`, since an ordinary one is two or three), and held
   * `hold` s — a harder one in that time takes its place, a softer one
   * waits. Only a blow he FELL on is shown — he went down, or the skier he
   * shouldered did — and a fall within `fallWindow` s after a blow makes
   * it the fall's (the shove that put him over a moment later). */
  shown: 3,
  landingShown: 2,
  hold: 1.6,
  fallWindow: 0.5,
} as const;
