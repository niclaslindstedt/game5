// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PENETRATING WOUNDS — what a bullet or a fragment does to the part it
// strikes (`gunfire.ts`), spread into the body's one catalog
// (`anatomy.ts`' `INJURIES`) so the HUD, the gore and the hurt read them
// as they read every other injury.
//
// The mechanism is `pierce`: the dose is the round's KINETIC ENERGY at the
// part, J (½mv² at the speed it still has there). A rifle round carries
// ~1,700 J out of the muzzle and ~850 J at 300 m, a door gun's ~3,300 J,
// a heavy machine gun's over 15,000; a rocket's fragments a few hundred to
// a thousand. Every rung's even chance (`at`) is set so that what decides
// the wound is WHERE it struck: any service round through the trunk is
// a serious wound at once, through the head a critical one; a spent round
// or a fragment's edge may only graze a limb.
//
// The severities are the Abbreviated Injury Scale's for penetrating
// trauma, restated in our own words:
//   - THE HEAD: a graze of the scalp is minor; a missile through the skull
//     into the brain is critical (5 — the scale's 6 is not on our ladders);
//   - THE NECK: a wound of its muscles moderate; a great vessel torn (the
//     carotid, the jugular) severe; the cord cut critical;
//   - THE CHEST: a penetrating wound into the chest with the lung struck is
//     serious; with the blood and air filling the chest (the haemothorax,
//     the pneumothorax) severe; the heart or the aorta pierced critical;
//   - THE BELLY: a penetrating wound into it, the bowel perforated,
//     serious; the liver torn through severe; the great vessels behind it
//     critical;
//   - THE LIMBS: a wound through the muscle minor to moderate; the long
//     bone broken by it serious (a gunshot fracture is an open,
//     comminuted one); the main artery of the thigh torn severe.
// More than one wound sums by the injury severity score like any other
// injury (`severityOf`), and a part already hurt is hurt again more easily
// (`injury.weaken`): enough hits kill. What bleeds is `gore.ts`'s: a
// wound bleeds out through its hole, an organ pierced bleeds inside.

import type { InjuryDef } from "./anatomy.ts";

/** THE WOUNDS, by name — the words are `strings-body.ts`'. */
export const WOUNDS = {
  // THE HEAD.
  grazedScalp: { part: "head", ais: 1, mech: "pierce", at: 25 },
  shotHead: { part: "head", ais: 5, mech: "pierce", at: 80, organs: ["brain"] },
  // THE NECK.
  shotNeck: { part: "neck", ais: 2, mech: "pierce", at: 30 },
  shotNeckVessel: { part: "neck", ais: 4, mech: "pierce", at: 450 },
  shotNeckCord: { part: "neck", ais: 5, mech: "pierce", at: 1500, said: true },
  // THE CHEST, and the same from behind.
  shotChest: { part: "chest", ais: 3, mech: "pierce", at: 40, organs: ["lung"] },
  shotChestBleed: { part: "chest", ais: 4, mech: "pierce", at: 380, organs: ["lung"] },
  shotHeart: { part: "chest", ais: 5, mech: "pierce", at: 1500, organs: ["heart"] },
  shotBack: { part: "back", ais: 3, mech: "pierce", at: 40, organs: ["lung"] },
  shotSpine: {
    part: "back",
    ais: 4,
    mech: "pierce",
    at: 600,
    bones: ["thoracic"],
    fracture: "break",
  },
  shotSpinalCord: { part: "back", ais: 5, mech: "pierce", at: 1800, said: true },
  // THE BELLY AND THE PELVIS.
  shotBelly: { part: "abdomen", ais: 3, mech: "pierce", at: 40, organs: ["bowel"] },
  shotLiver: { part: "abdomen", ais: 4, mech: "pierce", at: 450, organs: ["liver"] },
  shotBellyVessel: { part: "abdomen", ais: 5, mech: "pierce", at: 1700 },
  shotHip: { part: "pelvis", ais: 2, mech: "pierce", at: 30 },
  shotPelvis: {
    part: "pelvis",
    ais: 3,
    mech: "pierce",
    at: 550,
    bones: ["pelvis"],
    fracture: "break",
  },
  shotIliac: { part: "pelvis", ais: 4, mech: "pierce", at: 1400, organs: ["bladder"] },
  // THE ARMS.
  shotShoulder: { part: "shoulder", ais: 2, mech: "pierce", at: 30 },
  shotShoulderBone: {
    part: "shoulder",
    ais: 3,
    mech: "pierce",
    at: 650,
    bones: ["scapula", "clavicle"],
    fracture: "break",
  },
  shotArm: { part: "arm", ais: 1, mech: "pierce", at: 20 },
  shotHumerus: {
    part: "arm",
    ais: 3,
    mech: "pierce",
    at: 600,
    bones: ["humerus"],
    fracture: "break",
  },
  shotHand: { part: "hand", ais: 1, mech: "pierce", at: 15 },
  shotHandBones: {
    part: "hand",
    ais: 2,
    mech: "pierce",
    at: 250,
    bones: ["hand"],
    fracture: "break",
  },
  // THE LEGS.
  shotThigh: { part: "thigh", ais: 2, mech: "pierce", at: 30 },
  shotFemur: {
    part: "thigh",
    ais: 3,
    mech: "pierce",
    at: 650,
    bones: ["femur"],
    fracture: "break",
  },
  shotFemoral: { part: "thigh", ais: 4, mech: "pierce", at: 1500 },
  shotKnee: { part: "knee", ais: 2, mech: "pierce", at: 30 },
  shotKneecap: {
    part: "knee",
    ais: 3,
    mech: "pierce",
    at: 550,
    bones: ["patella"],
    fracture: "break",
  },
  shotShin: { part: "shin", ais: 1, mech: "pierce", at: 20 },
  shotTibia: {
    part: "shin",
    ais: 3,
    mech: "pierce",
    at: 550,
    bones: ["tibia", "fibula"],
    fracture: "break",
  },
  shotFoot: { part: "foot", ais: 1, mech: "pierce", at: 15 },
  shotFootBones: {
    part: "foot",
    ais: 2,
    mech: "pierce",
    at: 250,
    bones: ["foot"],
    fracture: "break",
  },
} as const satisfies Record<string, InjuryDef>;
