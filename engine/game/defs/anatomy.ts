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
//   - THE LEGS UNDER AN AXIAL LOAD — a fall from a height landed on the
//     feet (cadaver drop and pendulum tests of the leg, and the falls
//     from height a trauma unit sees): the load goes up the chain, and the
//     chain breaks from the bottom. The heel bone (the calcaneus) breaks
//     at about 6–8 kN, the tibia's end at the ankle (the pilon) a little
//     past it, the tibia's top in the knee (the plateau) at some 8–10 kN
//     with the knee bent, the femur's shaft at about 10–15 kN, and the
//     femur's head is driven into the hip socket (the acetabulum) at a
//     load between those. A ski boot spreads the heel's load over its sole
//     and holds the ankle, which moves the even chance up the scale a
//     little, never off it. A leg carries half his weight's stop, so for
//     the medium build (80 kg) a landing's g is some 0.39 kN on each leg —
//     and a heavier skier's g is a harder load (`body.ts` scales it);
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
//   - HOW A BREAK BREAKS (Cohen et al. 2016, long bones struck by a
//     pendulum): at 21 J a simple transverse break and no fragment; at
//     47 J — 2.3 times — 95 % of the bones came apart comminuted, a double
//     butterfly of polygonal fragments; at 60 J the chip knocked out at
//     the point of impact twice the size. The more energy a bone takes past
//     what breaks it, the more fracture surface it has to make: the AO/OTA's
//     simple (A), wedge (B) and multifragmentary (C) patterns, in order of
//     the energy that made them (`comminute`);
//   - THE CRACK beside the break: a hairline (an undisplaced fracture) of
//     the same bone at four fifths of the break's dose and a rank under it
//     (never under 1) — the scale's own step between a fracture that
//     holds and one that does not (a linear skull fracture is AIS 2, a
//     depressed one 3–4; a femoral crack 2, the shaft broken 3).
//   - THE ORGANS (the trauma and sports-medicine series): in ski and
//     snowboard falls a fifth to a quarter of the seriously hurt have an
//     abdominal injury, and the SPLEEN is the organ torn first and most
//     (a fall onto the left flank), the kidney (a blow from behind) and the
//     liver (the right) after it, the three often together; in falls from a
//     height the lungs are bruised in every other fall from the second
//     floor up, with the ribs over them, the liver is the abdomen's first
//     injury (an even chance of it from some fifteen metres) and the spleen
//     the organ deceleration tears most — both together past some
//     twenty-five; the heart is bruised by a hard blow square on the
//     breastbone, the brain bleeds under a blow that breaks the skull, and
//     the bladder tears in about one pelvic ring fracture in ten. Their
//     doses below sit between those: past the ribs' break for the lung, past
//     the skull's for the bleed, and a landing's deceleration past the
//     spine's break for the trunk's organs.
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

/** THE BONES the body is drawn with (`hud-body.tsx`) — every bone of a
 * front view large enough to paint, the small ones kept as their group
 * (the hand, the foot, the ribs, the vertebrae of a region): a kind, and
 * the paired ones once a side. */
export const BONE_KINDS = [
  "skull",
  "mandible",
  "cervical",
  "clavicle",
  "scapula",
  "sternum",
  "ribs",
  "thoracic",
  "lumbar",
  "pelvis",
  "humerus",
  "radius",
  "ulna",
  "hand",
  "femur",
  "patella",
  "tibia",
  "fibula",
  "foot",
] as const;

export type BoneKind = (typeof BONE_KINDS)[number];

/** The kinds there are two of, one a side. */
const PAIRED = [
  "clavicle",
  "scapula",
  "humerus",
  "radius",
  "ulna",
  "hand",
  "femur",
  "patella",
  "tibia",
  "fibula",
  "foot",
] as const satisfies readonly BoneKind[];

type PairedKind = (typeof PAIRED)[number];

/** One bone: a midline kind, or a paired kind and its side. */
export type Bone = Exclude<BoneKind, PairedKind> | `${PairedKind}${"L" | "R"}`;

/** Whether a bone kind is one a side. */
export function pairedBone(kind: BoneKind): kind is PairedKind {
  return (PAIRED as readonly BoneKind[]).includes(kind);
}

/** THE BONES, in the order every per-bone array keeps them: each kind in
 * turn, a paired one left then right. */
export const BONES: readonly Bone[] = BONE_KINDS.flatMap((k): Bone[] =>
  pairedBone(k) ? [`${k}L`, `${k}R`] : [k as Exclude<BoneKind, PairedKind>],
);

/** THE ORGANS the body is drawn with (`hud-body.tsx`), inside the bones
 * that hold them: the brain in the skull, the heart and the lungs in the
 * rib cage, the liver, the spleen, the stomach and the kidneys under its
 * lower ribs, the bowel in the belly and the bladder in the pelvis — the
 * ones a fall or a blow tears (see `INJURIES`). */
export const ORGAN_KINDS = [
  "brain",
  "heart",
  "lung",
  "liver",
  "spleen",
  "stomach",
  "bowel",
  "kidney",
  "bladder",
] as const;

export type OrganKind = (typeof ORGAN_KINDS)[number];

/** The organs there are two of, one a side. */
const PAIRED_ORGANS = ["lung", "kidney"] as const satisfies readonly OrganKind[];

type PairedOrgan = (typeof PAIRED_ORGANS)[number];

/** One organ: a single one, or a paired kind and its side. */
export type Organ = Exclude<OrganKind, PairedOrgan> | `${PairedOrgan}${"L" | "R"}`;

/** Whether an organ kind is one a side. */
export function pairedOrgan(kind: OrganKind): kind is PairedOrgan {
  return (PAIRED_ORGANS as readonly OrganKind[]).includes(kind);
}

/** THE ORGANS, in the order every per-organ array keeps them: each kind in
 * turn, a paired one left then right. */
export const ORGANS: readonly Organ[] = ORGAN_KINDS.flatMap((k): Organ[] =>
  pairedOrgan(k) ? [`${k}L`, `${k}R`] : [k as Exclude<OrganKind, PairedOrgan>],
);

/** WHAT A FRACTURE IS: a `hairline` crack that holds, or a `break`. */
export type Fracture = "hairline" | "break";

/** HOW A LOAD MEETS A PART: `blunt` a blow on it (g at the part, off the
 * stop it is brought to), `load` the landing's own load through the legs
 * and the spine (g), `drawer` the same landing taken in the back seat or
 * crooked (g, raised by how far), `twist` a caught edge or a twisting fall
 * (m/s of slide when the edge bit), `bend` the shin levered forward over
 * the boot (m/s of a fall over the tips), `heat` a fire's thermal dose on
 * the skin ((kW/m²)^4/3 · s, `defs/heli-wreck.ts`). */
export type Mechanism = "blunt" | "load" | "drawer" | "twist" | "bend" | "heat";

/** WHICH SIDE OF THE TRUNK a blow came on, for the injuries that care:
 * the front, the back (the kidneys), the left (the spleen), the right (the
 * liver). */
export type Facing = "front" | "back" | "left" | "right";

/** ONE INJURY a part can take: its severity (AIS), the mechanism that does
 * it, the dose of that mechanism with an even chance of it (`at`), and —
 * for the trunk's organs — the side the blow must come from (`face`); a
 * bone broken only by a blow from some sides names them (`on`: the
 * collarbone off the point of the shoulder — `outside`, the part's own
 * outer side — the shoulder blade from behind). A FRACTURE
 * names the bones it cracks or breaks (on a paired part, the part's side
 * of each) and which (`fracture`): the body drawn shows it on the bone and
 * says nothing of it in words — unless it is more than the bone (`said`,
 * the spinal cord), which is said. An injury to an ORGAN names it
 * (`organs`, a paired one on the side the blow came from): the body drawn
 * paints the organ by it, and it is said. */
export type InjuryDef = {
  part: BodyPart | "arm" | "hand" | "shoulder" | "thigh" | "knee" | "shin" | "foot";
  ais: 1 | 2 | 3 | 4 | 5;
  mech: Mechanism;
  at: number;
  face?: Facing;
  on?: readonly (Facing | "outside")[];
  bones?: readonly BoneKind[];
  fracture?: Fracture;
  said?: true;
  organs?: readonly OrganKind[];
};

/** THE INJURIES, by name — the engine names them and never says them
 * (`pwa/src/game/strings-body.ts` owns the words). A paired part's ladder
 * is written once and stands on either side. */
export const INJURIES = {
  // THE HEAD — in a helmet, which on snow changes the peak little (the
  // headform study) and against a trunk crushes its liner (`helmet`).
  headBump: { part: "head", ais: 1, mech: "blunt", at: 45 },
  concussion: { part: "head", ais: 2, mech: "blunt", at: 95, organs: ["brain"] },
  knockedOut: { part: "head", ais: 3, mech: "blunt", at: 150, organs: ["brain"] },
  skullFracture: {
    part: "head",
    ais: 4,
    mech: "blunt",
    at: 230,
    bones: ["skull"],
    fracture: "break",
  },
  crackedSkull: {
    part: "head",
    ais: 2,
    mech: "blunt",
    at: 184,
    bones: ["skull"],
    fracture: "hairline",
  },
  // The jaw, by a blow to the face.
  brokenJaw: {
    part: "head",
    ais: 2,
    mech: "blunt",
    at: 125,
    face: "front",
    bones: ["mandible"],
    fracture: "break",
  },
  crackedJaw: {
    part: "head",
    ais: 1,
    mech: "blunt",
    at: 100,
    face: "front",
    bones: ["mandible"],
    fracture: "hairline",
  },
  brainInjury: { part: "head", ais: 5, mech: "blunt", at: 320, organs: ["brain"] },
  // THE NECK, whipped by the head's blow (`share`) and by a landing.
  whiplash: { part: "neck", ais: 1, mech: "blunt", at: 24 },
  neckSprain: { part: "neck", ais: 2, mech: "blunt", at: 45 },
  neckFracture: {
    part: "neck",
    ais: 3,
    mech: "blunt",
    at: 80,
    bones: ["cervical"],
    fracture: "hairline",
  },
  brokenNeck: {
    part: "neck",
    ais: 5,
    mech: "blunt",
    at: 130,
    bones: ["cervical"],
    fracture: "break",
  },
  // THE CHEST — the ribs and the lungs behind them.
  bruisedRibs: { part: "chest", ais: 1, mech: "blunt", at: 24 },
  crackedRibs: {
    part: "chest",
    ais: 1,
    mech: "blunt",
    at: 42,
    bones: ["ribs"],
    fracture: "hairline",
  },
  brokenRibs: { part: "chest", ais: 2, mech: "blunt", at: 52, bones: ["ribs"], fracture: "break" },
  crackedSternum: {
    part: "chest",
    ais: 1,
    mech: "blunt",
    at: 58,
    face: "front",
    bones: ["sternum"],
    fracture: "hairline",
  },
  brokenSternum: {
    part: "chest",
    ais: 2,
    mech: "blunt",
    at: 72,
    face: "front",
    bones: ["sternum"],
    fracture: "break",
  },
  collapsedLung: { part: "chest", ais: 3, mech: "blunt", at: 85, organs: ["lung"] },
  flailChest: {
    part: "chest",
    ais: 4,
    mech: "blunt",
    at: 130,
    bones: ["ribs", "sternum"],
    fracture: "break",
  },
  // THE BACK — the thoracolumbar spine, by a blow on it and by the axial
  // load of a landing the legs did not take.
  bruisedBack: { part: "back", ais: 1, mech: "blunt", at: 24 },
  backStrain: { part: "back", ais: 1, mech: "load", at: 13 },
  compressedVertebra: {
    part: "back",
    ais: 2,
    mech: "load",
    at: 15.5,
    bones: ["lumbar"],
    fracture: "hairline",
  },
  brokenBack: { part: "back", ais: 3, mech: "load", at: 21, bones: ["lumbar"], fracture: "break" },
  brokenBackBlow: {
    part: "back",
    ais: 3,
    mech: "blunt",
    at: 75,
    bones: ["thoracic"],
    fracture: "break",
  },
  crackedVertebra: {
    part: "back",
    ais: 1,
    mech: "blunt",
    at: 60,
    bones: ["thoracic"],
    fracture: "hairline",
  },
  spinalCord: {
    part: "back",
    ais: 5,
    mech: "load",
    at: 30,
    bones: ["lumbar"],
    fracture: "break",
    said: true,
  },
  // THE ABDOMEN — winded from any side; the kidneys from behind, the
  // spleen from the left and the liver from the right.
  winded: { part: "abdomen", ais: 1, mech: "blunt", at: 20 },
  bruisedKidney: {
    part: "abdomen",
    ais: 2,
    mech: "blunt",
    at: 42,
    face: "back",
    organs: ["kidney"],
  },
  tornKidney: {
    part: "abdomen",
    ais: 3,
    mech: "blunt",
    at: 75,
    face: "back",
    organs: ["kidney"],
  },
  tornSpleen: {
    part: "abdomen",
    ais: 3,
    mech: "blunt",
    at: 62,
    face: "left",
    organs: ["spleen"],
  },
  rupturedSpleen: {
    part: "abdomen",
    ais: 4,
    mech: "blunt",
    at: 100,
    face: "left",
    organs: ["spleen"],
  },
  tornLiver: {
    part: "abdomen",
    ais: 3,
    mech: "blunt",
    at: 62,
    face: "right",
    organs: ["liver"],
  },
  lacerated: {
    part: "abdomen",
    ais: 4,
    mech: "blunt",
    at: 105,
    face: "front",
    organs: ["stomach", "bowel"],
  },
  // THE PELVIS — the hip pointer of a fall on the side, and the ring.
  bruisedHip: { part: "pelvis", ais: 1, mech: "blunt", at: 18 },
  crackedPelvis: {
    part: "pelvis",
    ais: 2,
    mech: "blunt",
    at: 48,
    bones: ["pelvis"],
    fracture: "hairline",
  },
  brokenPelvis: {
    part: "pelvis",
    ais: 3,
    mech: "blunt",
    at: 75,
    bones: ["pelvis"],
    fracture: "break",
  },
  // THE SHOULDER — a point load on it, and the fall on the arm: the
  // collarbone and the joints off the point of the shoulder or up the arm,
  // the shoulder blade only from behind and only hard.
  bruisedShoulder: { part: "shoulder", ais: 1, mech: "blunt", at: 15 },
  separatedShoulder: {
    part: "shoulder",
    ais: 1,
    mech: "blunt",
    at: 24,
    on: ["outside"],
  },
  dislocatedShoulder: {
    part: "shoulder",
    ais: 2,
    mech: "blunt",
    at: 31,
    on: ["outside"],
  },
  crackedCollarbone: {
    part: "shoulder",
    ais: 1,
    mech: "blunt",
    at: 30,
    bones: ["clavicle"],
    on: ["outside"],
    fracture: "hairline",
  },
  brokenCollarbone: {
    part: "shoulder",
    ais: 2,
    mech: "blunt",
    at: 38,
    bones: ["clavicle"],
    on: ["outside"],
    fracture: "break",
  },
  // The shoulder blade, which takes a hard blow from behind to break —
  // one of the high-energy fractures, rare in a fall flat on the back.
  crackedScapula: {
    part: "shoulder",
    ais: 1,
    mech: "blunt",
    at: 60,
    bones: ["scapula"],
    on: ["back"],
    fracture: "hairline",
  },
  brokenScapula: {
    part: "shoulder",
    ais: 2,
    mech: "blunt",
    at: 78,
    bones: ["scapula"],
    on: ["back"],
    fracture: "break",
  },
  // THE ARM — the elbow and the bones either side of it.
  bruisedElbow: { part: "arm", ais: 1, mech: "blunt", at: 16 },
  dislocatedElbow: { part: "arm", ais: 2, mech: "blunt", at: 36 },
  crackedArm: {
    part: "arm",
    ais: 1,
    mech: "blunt",
    at: 37,
    bones: ["humerus"],
    fracture: "hairline",
  },
  brokenArm: { part: "arm", ais: 2, mech: "blunt", at: 46, bones: ["humerus"], fracture: "break" },
  crackedForearm: {
    part: "arm",
    ais: 1,
    mech: "blunt",
    at: 33,
    bones: ["ulna"],
    fracture: "hairline",
  },
  brokenForearm: {
    part: "arm",
    ais: 2,
    mech: "blunt",
    at: 41,
    bones: ["radius", "ulna"],
    fracture: "break",
  },
  // THE HAND — the skier's thumb, then the wrist.
  sprainedThumb: { part: "hand", ais: 1, mech: "blunt", at: 12 },
  sprainedWrist: { part: "hand", ais: 1, mech: "blunt", at: 17 },
  skiersThumb: { part: "hand", ais: 2, mech: "blunt", at: 21 },
  // The wrist's crack is the scaphoid's, among the hand's bones; its break
  // the radius's end above them.
  crackedWrist: {
    part: "hand",
    ais: 1,
    mech: "blunt",
    at: 22,
    bones: ["hand"],
    fracture: "hairline",
  },
  crackedRadius: {
    part: "hand",
    ais: 1,
    mech: "blunt",
    at: 24,
    bones: ["radius"],
    fracture: "hairline",
  },
  brokenWrist: {
    part: "hand",
    ais: 2,
    mech: "blunt",
    at: 28,
    bones: ["radius"],
    fracture: "break",
  },
  brokenHand: { part: "hand", ais: 2, mech: "blunt", at: 33, bones: ["hand"], fracture: "break" },
  // THE THIGH — a dead leg, and the femur, which takes a trunk to break.
  deadLeg: { part: "thigh", ais: 1, mech: "blunt", at: 26 },
  crackedFemur: {
    part: "thigh",
    ais: 2,
    mech: "blunt",
    at: 72,
    bones: ["femur"],
    fracture: "hairline",
  },
  brokenFemur: {
    part: "thigh",
    ais: 3,
    mech: "blunt",
    at: 90,
    bones: ["femur"],
    fracture: "break",
  },
  // THE KNEE — skiing's own injury: sprained by a hard landing, the
  // medial ligament by the twist, the cruciate by the twist and by the
  // back seat, the meniscus behind it, and the kneecap by a blow.
  sprainedKnee: { part: "knee", ais: 1, mech: "drawer", at: 13 },
  bruisedKnee: { part: "knee", ais: 1, mech: "blunt", at: 20 },
  tornMcl: { part: "knee", ais: 2, mech: "twist", at: 9.5 },
  tornAcl: { part: "knee", ais: 2, mech: "drawer", at: 15 },
  tornAclTwist: { part: "knee", ais: 2, mech: "twist", at: 11.5 },
  tornMeniscus: { part: "knee", ais: 2, mech: "twist", at: 13 },
  crackedKneecap: {
    part: "knee",
    ais: 1,
    mech: "blunt",
    at: 48,
    bones: ["patella"],
    on: ["front"],
    fracture: "hairline",
  },
  brokenKneecap: {
    part: "knee",
    ais: 2,
    mech: "blunt",
    at: 60,
    bones: ["patella"],
    on: ["front"],
    fracture: "break",
  },
  // THE SHIN — bruised by a trunk, broken over the boot's rim.
  bruisedShin: { part: "shin", ais: 1, mech: "blunt", at: 22 },
  crackedBootTop: {
    part: "shin",
    ais: 1,
    mech: "bend",
    at: 16,
    bones: ["tibia"],
    fracture: "hairline",
  },
  bootTop: {
    part: "shin",
    ais: 2,
    mech: "bend",
    at: 20,
    bones: ["tibia", "fibula"],
    fracture: "break",
  },
  crackedShin: {
    part: "shin",
    ais: 1,
    mech: "blunt",
    at: 76,
    bones: ["tibia"],
    fracture: "hairline",
  },
  brokenShin: {
    part: "shin",
    ais: 2,
    mech: "blunt",
    at: 95,
    bones: ["tibia", "fibula"],
    fracture: "break",
  },
  // THE FOOT, in a boot that takes most of what reaches it.
  bruisedFoot: { part: "foot", ais: 1, mech: "blunt", at: 28 },
  sprainedAnkle: { part: "foot", ais: 1, mech: "blunt", at: 45 },
  // The ankle's break is the fibula's end (the outer ankle bone).
  crackedAnkle: {
    part: "foot",
    ais: 1,
    mech: "blunt",
    at: 56,
    bones: ["fibula"],
    fracture: "hairline",
  },
  brokenAnkle: {
    part: "foot",
    ais: 2,
    mech: "blunt",
    at: 70,
    bones: ["fibula"],
    fracture: "break",
  },
  crackedFoot: {
    part: "foot",
    ais: 1,
    mech: "blunt",
    at: 68,
    bones: ["foot"],
    fracture: "hairline",
  },
  brokenFoot: { part: "foot", ais: 2, mech: "blunt", at: 85, bones: ["foot"], fracture: "break" },
  // A FALL FROM A HEIGHT LANDED ON THE FEET (`load`, the landing's g at
  // the medium build, each leg): the heel, the pilon, the plateau, the
  // femur and the hip socket, bottom to top — about 17 g a cracked heel
  // (6.7 kN), 21 g a broken one, 25 g the pilon, 27 g the plateau, 30 g
  // the socket and 33 g the femur. A flat landing at the legs' buckle
  // (14 g) is a chance in six of a cracked heel; a fall of tens of metres
  // onto hard snow breaks the leg from the heel to the hip.
  crackedHeel: {
    part: "foot",
    ais: 1,
    mech: "load",
    at: 17,
    bones: ["foot"],
    fracture: "hairline",
  },
  brokenHeel: { part: "foot", ais: 2, mech: "load", at: 21, bones: ["foot"], fracture: "break" },
  pilonFracture: {
    part: "shin",
    ais: 3,
    mech: "load",
    at: 25,
    bones: ["tibia", "fibula"],
    fracture: "break",
  },
  plateauFracture: {
    part: "knee",
    ais: 3,
    mech: "load",
    at: 27,
    bones: ["tibia"],
    fracture: "break",
  },
  brokenHipSocket: {
    part: "pelvis",
    ais: 3,
    mech: "load",
    at: 30,
    bones: ["pelvis"],
    fracture: "break",
  },
  femurDriven: {
    part: "thigh",
    ais: 3,
    mech: "load",
    at: 33,
    bones: ["femur"],
    fracture: "break",
  },
  // BURNS — a burning wreck's fireball on the skin (`heat`). Bare skin
  // takes a first-degree burn at an even chance of 105 (kW/m²)^4/3 · s, a
  // second-degree one at 290 and a full-thickness one at about 1,000 (the
  // process-safety literature's burn thresholds); the clothes over a part
  // let through only a share of it, which is each dose below over that
  // share: the face between the helmet and the goggles bare, the neck half
  // under the collar, a glove a third, a jacket's or trousers' insulated
  // shell a quarter. The AIS ranks a burn by the share of the body's skin
  // it covers; a part here is a small share, so a burn on it ranks low
  // unless it is deep or on the face and the hands, which a burns unit
  // takes in at any size — and BREATHING IN the ball (the chest's)
  // scorches the airway, the inhalation injury of a body engulfed in one.
  burntFace: { part: "head", ais: 1, mech: "heat", at: 105 },
  facialBurns: { part: "head", ais: 2, mech: "heat", at: 290 },
  deepFacialBurns: { part: "head", ais: 3, mech: "heat", at: 1000 },
  burntNeck: { part: "neck", ais: 1, mech: "heat", at: 210 },
  airwayBurn: { part: "chest", ais: 3, mech: "heat", at: 900 },
  burntHand: { part: "hand", ais: 1, mech: "heat", at: 300 },
  handBurns: { part: "hand", ais: 2, mech: "heat", at: 830 },
  burntArm: { part: "arm", ais: 1, mech: "heat", at: 420 },
  armBurns: { part: "arm", ais: 2, mech: "heat", at: 1160 },
  burntLeg: { part: "thigh", ais: 1, mech: "heat", at: 420 },
  legBurns: { part: "thigh", ais: 2, mech: "heat", at: 1160 },
  // THE ORGANS' OWN — the rest of what a blow or a fall from a height does
  // inside the bones (the research in the header's ORGANS paragraph). A
  // bleed under the skull past the blow that breaks it; the lung bruised
  // under a blow on the ribs (the commonest chest injury of blunt trauma,
  // and of a fall), the heart by a hard one square on the breastbone; the
  // liver torn through and the bowel bruised; the bladder torn with the
  // ring of the pelvis broken round it — a blow square on the front of the
  // pelvis, twice the one that breaks the ring.
  brainBleed: { part: "head", ais: 4, mech: "blunt", at: 265, organs: ["brain"] },
  bruisedLung: { part: "chest", ais: 3, mech: "blunt", at: 70, organs: ["lung"] },
  bruisedHeart: {
    part: "chest",
    ais: 3,
    mech: "blunt",
    at: 110,
    face: "front",
    organs: ["heart"],
  },
  rupturedLiver: {
    part: "abdomen",
    ais: 4,
    mech: "blunt",
    at: 100,
    face: "right",
    organs: ["liver"],
  },
  bruisedBowel: {
    part: "abdomen",
    ais: 2,
    mech: "blunt",
    at: 70,
    face: "front",
    organs: ["bowel"],
  },
  tornBladder: {
    part: "pelvis",
    ais: 3,
    mech: "blunt",
    at: 150,
    face: "front",
    organs: ["bladder"],
  },
  // DECELERATION (`load`, the landing's g on the trunk): a fall from a
  // height landed on the feet stops the organs as hard as the skeleton, and
  // they tear on what holds them — the lungs bruised first, then the liver
  // and the spleen torn on their ligaments.
  bruisedLungFall: { part: "chest", ais: 3, mech: "load", at: 30, organs: ["lung"] },
  tornLiverFall: { part: "abdomen", ais: 3, mech: "load", at: 32, organs: ["liver"] },
  tornSpleenFall: { part: "abdomen", ais: 3, mech: "load", at: 34, organs: ["spleen"] },
} as const satisfies Record<string, InjuryDef>;

export type InjuryKind = keyof typeof INJURIES;

/** THE BODY (`body.ts`). */
export const INJURY = {
  /** THE STOP each part is brought to against a hard surface, m: the
   * flesh, the bone's own flex and the clothes over it — the half of the
   * stopping distance that is the body's. The snow's half is `snow`; a
   * solid adds `solid` by what it is made of (a trunk its bark and sway) and,
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
  /** WHAT A SOLID GIVES, m, by what it is made of (`upright-grid.ts`'
   * `Stuff`): a TRUNK its bark, its branches and its sway; a lift tower's
   * or a mast's bare STEEL next to nothing; a tower's foam PAD
   * (`TOWER_PAD`, 0.22 m of it) most of its thickness crushed, which is
   * what it is wrapped round a column on a run for; a cabin's LOG wall a
   * little less than a living trunk; a crag's ROCK nothing at all but the
   * frost and the lichen on it. */
  solid: { trunk: 0.01, steel: 0.003, padded: 0.15, log: 0.006, rock: 0.002 },
  /** The most of a rotor blade's speed a blow off one is judged at, m/s —
   * past it every ladder is long since at its top. */
  blade: 60,
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
    neck: 0.25,
    handArm: 0.5,
    handShoulder: 0.5,
    elbowShoulder: 0.4,
    kneeThigh: 0.5,
    kneeShin: 0.4,
    footShin: 0.5,
    trunk: 0.6,
    /** ...and met flat on a side, the flank itself: the lower ribs and the
     * spleen or the liver under them. */
    flank: 0.9,
    /** A head met first down the spine — a dive — loads the neck along it
     * on top of the whip: the diving injury's cervical fracture. */
    neckAxial: 0.35,
    /** A sole met first along a straight body loads the leg along it, in a
     * landing's g: feet first into a trunk at 40 km/h, the femur's even
     * chance. */
    legAxial: 0.7,
  },
  /** A SEAT met with the trunk upright over it: this share of the hips'
   * blow runs up the spine as its load (g) — the ejection seat's and the
   * seated fall's compression fracture, from a drop of a few metres onto
   * hard snow; nothing from a fall on the side or the back. */
  seat: 0.18,
  /** A TRUNK met on the skis: square in front of them the tips meet it and
   * the skis stop over the bindings' release and the legs' fold, `stop` m —
   * the shins levered and the knees twisted, the blow the body's own once
   * it is thrown on into it — the tips meet it only within `lane` m of his
   * line past its own radius (his feet's stance and a ski's half-width);
   * wider of it, the skis pass it, and so beside him it takes the shoulder, the arm, the
   * ribs, the flank, the hip, the thigh and a glancing share of the head. */
  front: { stop: 0.6, lane: 0.25 },
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
  perBlow: 5,
  /** HOW A BREAK BREAKS, by its ENERGY over the energy of its even chance
   * (`body.ts`' `energyOver`): a SIMPLE break under `wedge`, a WEDGE — a
   * butterfly fragment knocked out of it — under `shatter`, and past that
   * MULTIFRAGMENTARY, the bone shattered (the pendulum study's 2.3 times). */
  comminute: { wedge: 1.6, shatter: 2.3 },
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
  /** THE LANDING THE LEGS COULD NOT STOP (`flight.ts`' `carriedThrough`):
   * the spine, the organs and the neck are hurt the step his trunk meets
   * the snow, or this many s after the skis did at the latest. */
  owedMost: 0.2,
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
