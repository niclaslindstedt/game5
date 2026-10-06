// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY'S WORDS — the body instrument (`hud-body.tsx`), the g meter
// (`hud-gforce.tsx`).
// Stated beside the one table and spread into it (`strings.ts`), so every
// word the player reads is still one `STRINGS` key. Templates, never
// concatenations at the call site (§39.2).
//
// The engine names every injury (`defs/anatomy.ts`) and never says one;
// these are the words. They say WHAT is hurt, plainly — a torn ligament, a
// broken bone, a bruised kidney — and nothing about how it looks.

import type { BodyPart, InjuryKind } from "@engine";

/** Which side a paired part is on, as the line says it: `LEFT ` / `RIGHT `
 * (with the space), and nothing for a part of the trunk. */
export function sideWord(part: BodyPart): string {
  if (part.endsWith("L")) return "LEFT ";
  if (part.endsWith("R")) return "RIGHT ";
  return "";
}

/** Every injury's line, the side handed in as `sideWord` says it. */
const INJURY_WORDS: Record<InjuryKind, (side: string) => string> = {
  headBump: () => "BUMPED HEAD",
  concussion: () => "CONCUSSION",
  knockedOut: () => "KNOCKED OUT COLD",
  skullFracture: () => "FRACTURED SKULL",
  crackedSkull: () => "CRACKED SKULL",
  brokenJaw: () => "BROKEN JAW",
  crackedJaw: () => "CRACKED JAW",
  brainInjury: () => "SERIOUS BRAIN INJURY",
  whiplash: () => "WHIPLASH",
  neckSprain: () => "SPRAINED NECK",
  neckFracture: () => "CRACKED NECK VERTEBRA",
  brokenNeck: () => "BROKEN NECK",
  bruisedRibs: () => "BRUISED RIBS",
  brokenRibs: () => "BROKEN RIBS",
  crackedRibs: () => "CRACKED RIBS",
  crackedSternum: () => "CRACKED BREASTBONE",
  brokenSternum: () => "BROKEN BREASTBONE",
  collapsedLung: () => "COLLAPSED LUNG",
  flailChest: () => "CRUSHED CHEST",
  bruisedBack: () => "BRUISED BACK",
  backStrain: () => "STRAINED BACK",
  compressedVertebra: () => "COMPRESSED VERTEBRA",
  brokenBack: () => "BROKEN BACK",
  brokenBackBlow: () => "BROKEN BACK",
  crackedVertebra: () => "CRACKED VERTEBRA",
  spinalCord: () => "SPINAL CORD INJURY",
  winded: () => "WINDED",
  bruisedKidney: () => "BRUISED KIDNEY",
  tornKidney: () => "TORN KIDNEY",
  tornSpleen: () => "TORN SPLEEN",
  rupturedSpleen: () => "RUPTURED SPLEEN",
  tornLiver: () => "TORN LIVER",
  lacerated: () => "INTERNAL INJURY",
  bruisedHip: () => "BRUISED HIP",
  crackedPelvis: () => "CRACKED PELVIS",
  brokenPelvis: () => "BROKEN PELVIS",
  bruisedShoulder: (s) => `BRUISED ${s}SHOULDER`,
  separatedShoulder: (s) => `SEPARATED ${s}SHOULDER`,
  dislocatedShoulder: (s) => `DISLOCATED ${s}SHOULDER`,
  brokenCollarbone: (s) => `BROKEN ${s}COLLARBONE`,
  crackedCollarbone: (s) => `CRACKED ${s}COLLARBONE`,
  crackedScapula: (s) => `CRACKED ${s}SHOULDER BLADE`,
  brokenScapula: (s) => `BROKEN ${s}SHOULDER BLADE`,
  bruisedElbow: (s) => `BRUISED ${s}ELBOW`,
  dislocatedElbow: (s) => `DISLOCATED ${s}ELBOW`,
  brokenArm: (s) => `BROKEN ${s}ARM`,
  crackedArm: (s) => `CRACKED ${s}ARM`,
  crackedForearm: (s) => `CRACKED ${s}FOREARM`,
  brokenForearm: (s) => `BROKEN ${s}FOREARM`,
  sprainedThumb: (s) => `SPRAINED ${s}THUMB`,
  sprainedWrist: (s) => `SPRAINED ${s}WRIST`,
  skiersThumb: (s) => `TORN ${s}THUMB LIGAMENT`,
  crackedRadius: (s) => `CRACKED ${s}WRIST BONE`,
  brokenWrist: (s) => `BROKEN ${s}WRIST`,
  crackedWrist: (s) => `CRACKED ${s}WRIST`,
  brokenHand: (s) => `BROKEN ${s}HAND`,
  deadLeg: (s) => `DEAD ${s}LEG`,
  brokenFemur: (s) => `BROKEN ${s}THIGH BONE`,
  crackedFemur: (s) => `CRACKED ${s}THIGH BONE`,
  sprainedKnee: (s) => `SPRAINED ${s}KNEE`,
  bruisedKnee: (s) => `BRUISED ${s}KNEE`,
  tornMcl: (s) => `TORN ${s}MCL`,
  tornAcl: (s) => `TORN ${s}ACL`,
  tornAclTwist: (s) => `TORN ${s}ACL`,
  tornMeniscus: (s) => `TORN ${s}MENISCUS`,
  brokenKneecap: (s) => `BROKEN ${s}KNEECAP`,
  crackedKneecap: (s) => `CRACKED ${s}KNEECAP`,
  bruisedShin: (s) => `BRUISED ${s}SHIN`,
  bootTop: (s) => `BROKEN ${s}SHIN AT THE BOOT`,
  brokenShin: (s) => `BROKEN ${s}SHIN`,
  crackedBootTop: (s) => `CRACKED ${s}SHIN AT THE BOOT`,
  crackedShin: (s) => `CRACKED ${s}SHIN`,
  bruisedFoot: (s) => `BRUISED ${s}FOOT`,
  sprainedAnkle: (s) => `SPRAINED ${s}ANKLE`,
  crackedAnkle: (s) => `CRACKED ${s}ANKLE`,
  brokenAnkle: (s) => `BROKEN ${s}ANKLE`,
  crackedFoot: (s) => `CRACKED ${s}FOOT`,
  brokenFoot: (s) => `BROKEN ${s}FOOT`,
  burntFace: () => "BURNT FACE",
  facialBurns: () => "BURNS TO THE FACE",
  deepFacialBurns: () => "DEEP BURNS TO THE FACE",
  burntNeck: () => "BURNT NECK",
  airwayBurn: () => "BURNT AIRWAY",
  burntHand: (s) => `BURNT ${s}HAND`,
  handBurns: (s) => `BURNS TO THE ${s}HAND`,
  burntArm: (s) => `BURNT ${s}ARM`,
  armBurns: (s) => `BURNS TO THE ${s}ARM`,
  burntLeg: (s) => `BURNT ${s}LEG`,
  legBurns: (s) => `BURNS TO THE ${s}LEG`,
};

/** How the whole body is, by its injury severity score (`body-tile.ts`). */
export type BodyCondition = "sound" | "bruised" | "hurt" | "injured" | "serious" | "critical";

export const BODY_STRINGS = {
  /** One injury's line. */
  injury: (kind: InjuryKind, part: BodyPart): string => INJURY_WORDS[kind](sideWord(part)),
  /** ...and how many more there are than the panel lists. */
  injuryMore: (n: number): string => `+${n} MORE`,
  conditions: {
    sound: "FIT",
    bruised: "BRUISED",
    hurt: "HURT",
    injured: "INJURED",
    serious: "SERIOUSLY INJURED",
    critical: "CRITICAL",
  } satisfies Record<BodyCondition, string>,
  /** The body as a whole, for a screen reader. */
  bodyAria: (condition: string, n: number): string =>
    `Body: ${condition.toLowerCase()}, ${n === 0 ? "no injuries" : `${n} ${n === 1 ? "injury" : "injuries"}`}`,
  /** THE G METER: the blow. */
  gForce: (g: number): string => (g < 10 ? g.toFixed(1) : Math.round(g).toString()),
  gUnit: "G",
  /** The run's hardest blow he fell on so far, under the body. */
  hardest: (g: number): string => `HARDEST ${Math.round(g)} G`,
};
