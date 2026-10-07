// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INJURY SCENARIOS — every moment the injury lab stages (`make
// injuries`, `scripts/injury-lab.mjs`) and the suite holds
// (`tests/injury_lab_test.ts`): a pose, a speed, and what it is driven into
// — the snow by its kind (deep powder, the ordinary loose snow, the
// groomed piste, ice), a cliff's drop onto the flat, a trunk, a lift
// tower's bare steel or its pad, a cabin's log wall — with what a trauma
// surgeon would expect of it.
//
// AN EXPECTATION IS A RATE: every moment is drawn `TRIALS` times (an injury
// is a chance on its risk curve, never a certainty), and
//   - each group in `expect` must come of it in at least `EXPECT` of the
//     trials — any one injury of the group counting, since one fall onto a
//     side breaks the ribs in one man and tears the spleen in the next;
//   - every injury in `never` may come of it in at most `NEVER` of them —
//     what that moment does not do (a fall into deep powder breaks
//     nothing; a fall onto the left side does not tear the liver; a pad
//     round a tower does not stave in the chest);
//   - `worst`, when given, holds the median of each trial's worst AIS.
//
// WHERE THE EXPECTATIONS COME FROM — the research `defs/anatomy.ts` is
// fitted to, read as the injury a moment is known for: a fall flat on the
// back is a bruise until the height and the snow make it the spine and the
// kidneys; a dive head first is the head and then, past a couple of metres,
// the neck (the diving injury); a fall on the side is the ribs and the
// organ under them — the spleen on the left, the liver on the right; a
// fall forward onto the hands is the wrist and the skier's thumb; onto the
// point of the shoulder, the collarbone; on the seat from a height, the
// pelvis and a lumbar vertebra crushed; a drop landed on the feet breaks
// the leg from the bottom up (the heel, the pilon, the plateau, the femur,
// the hip socket) and the spine above it, with the organs torn by the
// stop past some twenty metres; the back seat tears the cruciate, a caught
// edge twists the knee, the tips dug in lever the shin over the boot; a
// trunk met at 30–50 km/h is the head and the chest; steel is worse than
// a trunk and a pad far kinder than either; slid feet first into a wall
// the leg is broken along its length, and a trunk taken between the legs
// is the pelvis; a fall of thirty metres bursts the spine and the heels.

import type { Bone, InjuryKind } from "@engine";
import { anyRate, shatterRate, type Rates, type Staging } from "./injury-stage.ts";

export type InjuryScenario = Staging & {
  id: string;
  /** What the moment is, in words. */
  title: string;
  /** Groups of injuries, each of which must come of it (any one of the
   * group) in at least `EXPECT` of the trials. */
  expect: readonly (readonly InjuryKind[])[];
  /** Injuries that may come of it in at most `NEVER` of the trials. */
  never?: readonly InjuryKind[];
  /** The median worst AIS, at least and at most. */
  worst?: readonly [number, number];
  /** Bones that must be left SHATTERED in at least `EXPECT` of the trials. */
  shatter?: readonly Bone[];
};

/** The share of trials an expected group must come of. */
export const EXPECT = 0.5;
/** The share of trials an injury that should not come of a moment may. */
export const NEVER = 0.12;

/** WHAT A SCENARIO'S RATES MISS of what it expects, in words — empty
 * when the moment hurt him as it should. */
export function missesOf(s: InjuryScenario, r: Rates): string[] {
  const out: string[] = [];
  for (const group of s.expect) {
    const rate = anyRate(r, group);
    if (rate < EXPECT) out.push(`expected ${group.join("|")} (${Math.round(rate * 100)}%)`);
  }
  for (const kind of s.never ?? []) {
    const rate = r.rate.get(kind) ?? 0;
    if (rate > NEVER) out.push(`never ${kind} (${Math.round(rate * 100)}%)`);
  }
  for (const bone of s.shatter ?? []) {
    const rate = shatterRate(r, bone);
    if (rate < EXPECT) out.push(`expected the ${bone} shattered (${Math.round(rate * 100)}%)`);
  }
  if (s.worst && (r.worst < s.worst[0] || r.worst > s.worst[1])) {
    out.push(`worst AIS ${r.worst} outside ${s.worst[0]}–${s.worst[1]}`);
  }
  return out;
}

/** A fall from `h` m, as the speed it meets the snow at, m/s. */
export const fallFrom = (h: number): number => Math.sqrt(2 * 9.81 * h);
const kmh = (v: number): number => v / 3.6;

// The groups the scenarios share.
const HEAD_HURT: InjuryKind[] = [
  "concussion",
  "knockedOut",
  "crackedSkull",
  "skullFracture",
  "brainBleed",
  "brainInjury",
];
const HEAD_BROKEN: InjuryKind[] = ["crackedSkull", "skullFracture", "brainBleed", "brainInjury"];
const NECK_BROKEN: InjuryKind[] = ["neckFracture", "brokenNeck"];
const SPINE_BROKEN: InjuryKind[] = [
  "compressedVertebra",
  "brokenBack",
  "brokenBackBlow",
  "crackedVertebra",
  "spinalCord",
];
const RIBS: InjuryKind[] = ["crackedRibs", "brokenRibs", "flailChest"];
/** The ribs, or the lung under them — a part takes its worst injury of a
 * blow, so a lung torn by broken ribs is billed as the lung. */
const CHEST_HIT: InjuryKind[] = [...RIBS, "collapsedLung", "bruisedLung"];
const CHEST_CRUSHED: InjuryKind[] = [
  "flailChest",
  "brokenSternum",
  "collapsedLung",
  "bruisedLung",
  "bruisedHeart",
];
const SPLEEN: InjuryKind[] = ["tornSpleen", "rupturedSpleen", "tornSpleenFall"];
const LIVER: InjuryKind[] = ["tornLiver", "rupturedLiver", "tornLiverFall"];
const KIDNEY: InjuryKind[] = ["bruisedKidney", "tornKidney"];
const WRIST: InjuryKind[] = [
  "skiersThumb",
  "crackedWrist",
  "crackedRadius",
  "brokenWrist",
  "brokenHand",
  "brokenForearm",
];
const COLLARBONE: InjuryKind[] = [
  "crackedCollarbone",
  "brokenCollarbone",
  "separatedShoulder",
  "dislocatedShoulder",
];
const LEG_LOADED: InjuryKind[] = [
  "crackedHeel",
  "brokenHeel",
  "pilonFracture",
  "plateauFracture",
  "femurDriven",
  "brokenHipSocket",
];
const KNEE_TWISTED: InjuryKind[] = ["tornMcl", "tornAclTwist", "tornMeniscus"];
const LEG_BROKEN: InjuryKind[] = [
  "crackedFemur",
  "brokenFemur",
  "crackedShin",
  "brokenShin",
  "brokenKneecap",
  "brokenAnkle",
  "brokenFoot",
  "femurDriven",
  "plateauFracture",
  "pilonFracture",
];
/** The ankle turned or cracked in the boot. */
const ANKLE: InjuryKind[] = ["sprainedAnkle", "crackedAnkle", "crackedFoot"];
/** The belly's and the pelvis's organs torn by a blow on the front. */
const BELLY_TORN: InjuryKind[] = ["lacerated", "bruisedBowel", "tornBladder"];
/** Every fracture and every organ torn — what a soft fall must not do. */
const SERIOUS: InjuryKind[] = [
  "skullFracture",
  "brainBleed",
  "brainInjury",
  "brokenNeck",
  "neckFracture",
  "brokenBack",
  "brokenBackBlow",
  "spinalCord",
  "brokenRibs",
  "flailChest",
  "collapsedLung",
  "brokenPelvis",
  "brokenCollarbone",
  "brokenFemur",
  "tornSpleen",
  "tornLiver",
  "tornKidney",
];

export const INJURY_SCENARIOS: readonly InjuryScenario[] = [
  // ─── FALLS INTO THE SNOW, OFF THE SKIS ───────────────────────────────
  {
    id: "back-powder",
    title: "flat on his back from 4 m into a deep day's powder",
    ground: "powder",
    stage: { how: "fall", pose: "back", speed: fallFrom(4) },
    expect: [],
    never: SERIOUS,
    worst: [0, 1],
  },
  {
    id: "back-groomed",
    title: "flat on his back from 1.5 m onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "back", speed: fallFrom(1.5) },
    expect: [
      ["bruisedBack", "winded", "headBump", "concussion", "whiplash", "bruisedHip"],
      ["bruisedShoulder"],
    ],
    never: [...SPINE_BROKEN, "brokenCollarbone", "brokenScapula", "brokenPelvis", ...RIBS],
  },
  {
    id: "back-ice",
    title: "flat on his back from 5 m onto ice",
    ground: "ice",
    stage: { how: "fall", pose: "back", speed: fallFrom(5) },
    expect: [SPINE_BROKEN, KIDNEY, HEAD_HURT],
    never: [...SPLEEN, ...LIVER, "brokenJaw"],
  },
  {
    id: "head-powder",
    title: "head first from 2 m into a deep day's powder",
    ground: "powder",
    stage: { how: "fall", pose: "head", speed: fallFrom(2) },
    expect: [],
    never: [...SERIOUS, "concussion", "knockedOut"],
  },
  {
    id: "head-soft",
    title: "head first from a metre into loose snow",
    ground: "soft",
    stage: { how: "fall", pose: "head", speed: fallFrom(1) },
    expect: [],
    never: SERIOUS,
  },
  {
    id: "head-groomed-low",
    title: "head first from a metre onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "head", speed: fallFrom(1) },
    expect: [["headBump", "concussion", "whiplash", "neckSprain"]],
    never: [...HEAD_BROKEN, "brokenNeck"],
  },
  {
    id: "head-groomed",
    title: "head first from 3 m onto the groomer — the diving injury",
    ground: "groomed",
    stage: { how: "fall", pose: "head", speed: fallFrom(3) },
    expect: [HEAD_HURT, NECK_BROKEN],
  },
  {
    id: "head-ice",
    title: "head first from 6 m onto ice",
    ground: "ice",
    stage: { how: "fall", pose: "head", speed: fallFrom(6) },
    expect: [HEAD_BROKEN, ["brainInjury"], ["brokenNeck"]],
    // The neck driven down onto itself: the burst fracture.
    shatter: ["cervical"],
    worst: [5, 5],
  },
  {
    id: "left-groomed",
    title: "on his left side from 2.5 m onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "left", speed: fallFrom(2.5) },
    expect: [CHEST_HIT, COLLARBONE],
    never: [...SPLEEN, ...LIVER, ...KIDNEY],
  },
  {
    id: "left-ice",
    title: "on his left side from 4 m onto ice — the spleen",
    ground: "ice",
    stage: { how: "fall", pose: "left", speed: fallFrom(4) },
    expect: [CHEST_HIT, SPLEEN, ["crackedArm", "brokenArm"], ["bruisedFoot"]],
    never: [...LIVER, ...KIDNEY],
  },
  {
    id: "right-ice",
    title: "on his right side from 4 m onto ice — the liver",
    ground: "ice",
    stage: { how: "fall", pose: "right", speed: fallFrom(4) },
    expect: [CHEST_HIT, LIVER, ["crackedArm", "brokenArm"]],
    never: [...SPLEEN, ...KIDNEY],
  },
  {
    id: "face-groomed",
    title: "face down from 2 m onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "face", speed: fallFrom(2) },
    expect: [
      ["crackedJaw", "brokenJaw", "headBump", "concussion"],
      ["bruisedRibs", ...RIBS, "crackedSternum", "brokenSternum", "winded"],
      ["bruisedKnee", "crackedKneecap"],
      ["bruisedElbow"],
    ],
    never: [...KIDNEY, "brokenBackBlow"],
  },
  {
    id: "hands-groomed",
    title: "forward onto his outstretched hands from 1 m onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "hands", speed: fallFrom(1) },
    expect: [["sprainedThumb", "sprainedWrist", ...WRIST]],
    never: [...HEAD_HURT, ...NECK_BROKEN, ...SPINE_BROKEN],
  },
  {
    id: "hands-ice",
    title: "forward onto his outstretched hands from 2 m onto ice",
    ground: "ice",
    stage: { how: "fall", pose: "hands", speed: fallFrom(2) },
    expect: [WRIST, ["bruisedKnee", "crackedKneecap"]],
    never: [...HEAD_BROKEN, ...NECK_BROKEN],
  },
  {
    id: "shoulder-groomed",
    title: "onto the point of his shoulder from 1.5 m onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "shoulder", speed: fallFrom(1.5) },
    expect: [COLLARBONE],
    never: [...SPINE_BROKEN, ...LIVER],
  },
  {
    id: "seat-groomed",
    title: "sat down hard from a metre onto the groomer",
    ground: "groomed",
    stage: { how: "fall", pose: "seat", speed: fallFrom(1) },
    expect: [["bruisedHip", "crackedPelvis", "bruisedBack", "backStrain", "winded"]],
    never: ["brokenPelvis", "brokenBack", "spinalCord", ...HEAD_HURT],
  },
  {
    id: "seat-ice",
    title: "sat down from 4 m onto ice — the seated compression fracture",
    ground: "ice",
    stage: { how: "fall", pose: "seat", speed: fallFrom(4) },
    expect: [
      ["crackedPelvis", "brokenPelvis"],
      ["compressedVertebra", "brokenBack", "spinalCord"],
    ],
  },
  // ─── A CLIFF'S DROP, LANDED ON THE SKIS ON THE FLAT ──────────────────
  {
    id: "drop-2",
    title: "a 2 m drop to the flat groomer, ridden away",
    ground: "groomed",
    stage: { how: "drop", height: 2, speed: 8 },
    expect: [],
    never: [...LEG_LOADED, ...SPINE_BROKEN, "tornAcl"],
    worst: [0, 1],
  },
  {
    id: "drop-5",
    title: "a 5 m cliff to the flat groomer, landed square — hard, and taken by the legs",
    ground: "groomed",
    stage: { how: "drop", height: 5, speed: 8 },
    expect: [],
    never: [
      "brokenHeel",
      "pilonFracture",
      "plateauFracture",
      "femurDriven",
      "brokenHipSocket",
      "brokenBack",
      "spinalCord",
    ],
    worst: [0, 2],
  },
  {
    id: "drop-8",
    title: "an 8 m cliff to the flat groomer — the heel and the spine",
    ground: "groomed",
    stage: { how: "drop", height: 8, speed: 8 },
    expect: [["crackedHeel", "brokenHeel", "backStrain", "compressedVertebra", "brokenBack"]],
    never: ["femurDriven", "brokenHipSocket", "spinalCord", "tornLiverFall", "tornSpleenFall"],
  },
  {
    id: "drop-10",
    title: "a 10 m cliff to the flat groomer — the heel and the back",
    ground: "groomed",
    stage: { how: "drop", height: 10, speed: 8 },
    expect: [
      ["crackedHeel", "brokenHeel", "pilonFracture", "plateauFracture", "femurDriven"],
      ["compressedVertebra", "brokenBack", "spinalCord"],
    ],
  },
  {
    id: "drop-20",
    title: "a 20 m cliff to the flat groomer — the whole leg, the spine and the organs",
    ground: "groomed",
    stage: { how: "drop", height: 20, speed: 8 },
    expect: [
      ["femurDriven", "brokenHipSocket"],
      ["brokenBack", "spinalCord"],
      ["bruisedLungFall", "tornLiverFall", "tornSpleenFall"],
    ],
    worst: [4, 5],
  },
  {
    id: "drop-30",
    title: "a 30 m cliff to the flat groomer — the spine and the heels shattered",
    ground: "groomed",
    stage: { how: "drop", height: 30, speed: 8 },
    expect: [["spinalCord"], ["femurDriven", "brokenHipSocket"]],
    // The burst fracture: the lumbar spine and the heels driven apart.
    shatter: ["lumbar", "footL", "footR"],
    worst: [5, 5],
  },
  {
    id: "drop-10-powder",
    title: "a 10 m cliff into a deep day's powder",
    ground: "powder",
    stage: { how: "drop", height: 10, speed: 8 },
    expect: [],
    never: ["femurDriven", "brokenHipSocket", "plateauFracture", "spinalCord", "brokenBack"],
  },
  {
    id: "backseat",
    title: "a 6 m drop landed in the back seat, the tails 40° down — the cruciate",
    ground: "groomed",
    stage: { how: "drop", height: 6, speed: 10, pitch: 0.7 },
    expect: [["tornAcl"]],
  },
  {
    id: "backseat-low",
    title: "a 5 m drop landed in the back seat — the knee sprained",
    ground: "groomed",
    stage: { how: "drop", height: 5, speed: 10, pitch: 0.7 },
    expect: [["sprainedKnee", "tornAcl"]],
    never: ["bootTop", "brokenHeel", "brokenBack"],
  },
  {
    id: "nose",
    title: "a 3 m drop landed over the tips at 60 km/h — the boot-top fracture",
    ground: "groomed",
    stage: { how: "drop", height: 3, speed: kmh(60), pitch: -1 },
    expect: [["bootTop", "crackedBootTop"], ["bruisedShin"]],
  },
  {
    id: "catch",
    title: "an edge caught at 60 km/h, the skis thrown 40° across — the knee twisted",
    ground: "groomed",
    stage: { how: "catch", speed: kmh(60) },
    expect: [KNEE_TWISTED],
  },
  // ─── A SOLID MET ─────────────────────────────────────────────────────
  {
    id: "ski-trunk",
    title: "skied square into a trunk at 30 km/h — the head, the chest, the hips",
    ground: "groomed",
    stage: { how: "ski", stuff: "trunk", speed: kmh(30), offset: 0 },
    expect: [[...HEAD_HURT, ...CHEST_HIT, ...CHEST_CRUSHED, "brokenPelvis", "brokenFemur"]],
    worst: [2, 5],
  },
  {
    id: "ski-trunk-shoulder",
    title: "a trunk taken on the right shoulder skiing past it at 40 km/h",
    ground: "groomed",
    stage: { how: "ski", stuff: "trunk", speed: kmh(40), offset: 0.45 },
    expect: [COLLARBONE],
    never: [...SPLEEN, "brokenScapula", "bootTop"],
  },
  {
    id: "trunk-chest",
    title: "thrown chest first into a trunk at 50 km/h",
    ground: "groomed",
    stage: { how: "into", pose: "front", stuff: "trunk", speed: kmh(50) },
    expect: [CHEST_CRUSHED, BELLY_TORN],
    worst: [3, 5],
  },
  {
    id: "trunk-head",
    title: "thrown head first into a trunk at 30 km/h, in a helmet",
    ground: "groomed",
    stage: { how: "into", pose: "head", stuff: "trunk", speed: kmh(30) },
    expect: [HEAD_HURT, ["neckSprain", ...NECK_BROKEN]],
  },
  {
    id: "trunk-back",
    title: "thrown back first into a trunk at 35 km/h — the spine and the kidneys",
    ground: "groomed",
    stage: { how: "into", pose: "back", stuff: "trunk", speed: kmh(35) },
    expect: [["brokenBackBlow", "crackedVertebra"], KIDNEY, ["crackedScapula", "brokenScapula"]],
    never: [...SPLEEN, ...LIVER, "brokenSternum"],
  },
  {
    id: "steel-back",
    title: "thrown back first into a lift tower's bare steel at 40 km/h — the kidneys torn",
    ground: "groomed",
    stage: { how: "into", pose: "back", stuff: "steel", speed: kmh(40) },
    expect: [
      ["tornKidney"],
      ["brokenBackBlow", "crackedVertebra"],
      ["crackedScapula", "brokenScapula"],
    ],
    never: [...SPLEEN, ...LIVER],
  },
  {
    id: "trunk-straddle",
    title: "slid feet first at 40 km/h, the trunk between his legs — the pelvis",
    ground: "groomed",
    stage: { how: "into", pose: "feet", stuff: "trunk", speed: kmh(40) },
    expect: [["crackedPelvis", "brokenPelvis"], ["deadLeg", "bruisedShin"], ANKLE],
    never: [...HEAD_BROKEN, ...NECK_BROKEN],
  },
  {
    id: "wall-feet",
    title: "slid feet first into a cabin's log wall at 40 km/h — the legs broken",
    ground: "groomed",
    stage: { how: "into", pose: "feet", stuff: "log", speed: kmh(40) },
    expect: [LEG_BROKEN],
    never: [...HEAD_BROKEN, ...NECK_BROKEN],
  },
  {
    id: "steel-chest",
    title: "thrown chest first into a lift tower's bare steel at 40 km/h",
    ground: "groomed",
    stage: { how: "into", pose: "front", stuff: "steel", speed: kmh(40) },
    expect: [CHEST_CRUSHED, BELLY_TORN],
    worst: [3, 5],
  },
  {
    id: "padded-chest",
    title: "thrown chest first into a padded lift tower at 40 km/h",
    ground: "groomed",
    stage: { how: "into", pose: "front", stuff: "padded", speed: kmh(40) },
    expect: [],
    never: ["flailChest", "brokenSternum", "collapsedLung", "bruisedHeart", "bruisedLung"],
  },
  {
    id: "steel-head",
    title: "thrown head first into a lift tower's bare steel at 30 km/h, in a helmet",
    ground: "groomed",
    stage: { how: "into", pose: "head", stuff: "steel", speed: kmh(30) },
    expect: [HEAD_BROKEN],
  },
  {
    id: "padded-head",
    title: "thrown head first into a padded lift tower at 30 km/h, in a helmet",
    ground: "groomed",
    stage: { how: "into", pose: "head", stuff: "padded", speed: kmh(30) },
    expect: [],
    never: [...HEAD_BROKEN, "brokenNeck"],
  },
  {
    id: "wall-left",
    title: "thrown left side first into a cabin's log wall at 40 km/h",
    ground: "groomed",
    stage: { how: "into", pose: "left", stuff: "log", speed: kmh(40) },
    expect: [CHEST_HIT, SPLEEN, ["crackedArm", "brokenArm", "dislocatedElbow"]],
    never: LIVER,
  },
  {
    id: "ski-steel",
    title: "skied square into a lift tower's bare steel at 50 km/h",
    ground: "groomed",
    stage: { how: "ski", stuff: "steel", speed: kmh(50), offset: 0 },
    expect: [HEAD_BROKEN, CHEST_CRUSHED, BELLY_TORN],
    worst: [4, 5],
  },
  {
    id: "ski-padded",
    title: "skied square into a padded lift tower at 50 km/h",
    ground: "groomed",
    stage: { how: "ski", stuff: "padded", speed: kmh(50), offset: 0 },
    expect: [],
    worst: [0, 3],
  },
];
