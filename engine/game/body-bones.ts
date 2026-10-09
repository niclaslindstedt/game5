// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY READ: what its injuries come to — the bones an injury cracks or
// breaks and each bone's grade (`fracturesOf`), the organs it hurts
// (`organsOf`), whether it is said in words, and the injury severity score.
// Readouts of `BodyState` only (`body.ts` deals the injuries); nothing in
// the physics reads them.

import {
  BODY_PARTS,
  BONES,
  INJURIES,
  ORGANS,
  pairedBone,
  pairedOrgan,
  type BodyPart,
  type Bone,
  type InjuryDef,
  type InjuryKind,
  type Organ,
} from "./defs/anatomy.ts";
import { TUNING } from "./defs/tuning.ts";
import type { BodyState, Injury } from "./state.ts";

const I = TUNING.injury;
const PARTS = BODY_PARTS.length;

/** The ISS's regions, by part: the head and neck, the chest (the thoracic
 * spine with it), the abdomen, and the limbs with the pelvis. */
const REGION: number[] = BODY_PARTS.map((p) =>
  p === "head" || p === "neck" ? 0 : p === "chest" || p === "back" ? 1 : p === "abdomen" ? 2 : 3,
);

/** THE BONES an injury cracks or breaks — on a paired part, its side of
 * each — or none. */
export function bonesOf(kind: InjuryKind, part: BodyPart): Bone[] {
  const def = INJURIES[kind] as InjuryDef;
  if (!def.bones) return [];
  const side = part.endsWith("L") ? "L" : part.endsWith("R") ? "R" : "";
  return def.bones.map((b) => (pairedBone(b) ? `${b}${side}` : b) as Bone);
}

/** Whether an injury is SAID in words: anything but a bone's fracture,
 * which the body drawn shows on the bone — the spinal cord, more than its
 * vertebra, is said. */
export function saidOf(kind: InjuryKind): boolean {
  const def = INJURIES[kind] as InjuryDef;
  return !def.fracture || def.said === true;
}

/** THE ORGANS an injury hurts — a paired one on its side — or none. */
export function organsOfInjury(h: Injury): Organ[] {
  const def = INJURIES[h.kind] as InjuryDef;
  if (!def.organs) return [];
  return def.organs.map((o) => (pairedOrgan(o) ? `${o}${h.side ?? "L"}` : o) as Organ);
}

/** EVERY ORGAN'S STATE, in `ORGANS` order: the worst AIS any injury on the
 * body did to it, 0 sound. */
export function organsOf(body: BodyState): number[] {
  const worst = new Array<number>(ORGANS.length).fill(0);
  for (const h of body.injuries)
    for (const o of organsOfInjury(h)) {
      const i = ORGANS.indexOf(o);
      if (h.ais > worst[i]) worst[i] = h.ais;
    }
  return worst;
}

/** WHAT A FRACTURE SHOWS on its bone: sound, a HAIRLINE crack, a SIMPLE
 * break, a WEDGE (a butterfly fragment knocked out) or SHATTERED
 * (multifragmentary) — the last three a break graded by the energy that
 * did it (`injury.comminute`). */
export const FRACTURE_GRADE = { sound: 0, hairline: 1, simple: 2, wedge: 3, shatter: 4 } as const;

/** One injury's grade on its bones. */
function gradeOf(def: InjuryDef, energy: number): number {
  if (def.fracture !== "break") return FRACTURE_GRADE.hairline;
  const C = I.comminute;
  if (energy >= C.shatter) return FRACTURE_GRADE.shatter;
  return energy >= C.wedge ? FRACTURE_GRADE.wedge : FRACTURE_GRADE.simple;
}

/** Every bone's grade and the energy of the fracture behind it. */
function boneFractures(body: BodyState): { grade: number[]; energy: number[] } {
  const grade = new Array<number>(BONES.length).fill(0);
  const energy = new Array<number>(BONES.length).fill(0);
  for (const h of body.injuries) {
    const def = INJURIES[h.kind] as InjuryDef;
    if (!def.fracture) continue;
    const e = h.energy ?? 1;
    const g = gradeOf(def, e);
    for (const b of bonesOf(h.kind, h.part)) {
      const i = BONES.indexOf(b);
      if (g > grade[i] || (g === grade[i] && e > energy[i])) {
        grade[i] = g;
        energy[i] = e;
      }
    }
  }
  return { grade, energy };
}

/** EVERY BONE'S STATE, in `BONES` order (`FRACTURE_GRADE`): 0 sound, 1 a
 * hairline crack, 2 a simple break, 3 a wedge, 4 shattered — the worst any
 * injury on the body did to it. */
export function fracturesOf(body: BodyState): number[] {
  return boneFractures(body).grade;
}

/** EVERY BONE'S FRACTURE ENERGY, in `BONES` order: the energy of the
 * fracture it shows over that fracture's even chance (0 sound) — how far
 * the drawing throws its pieces apart. */
export function fractureEnergyOf(body: BodyState): number[] {
  return boneFractures(body).energy;
}

/** THE INJURY SEVERITY SCORE: the squares of the worst AIS in each of the
 * three worst-hurt regions, summed — 0 unhurt, 16 and up major trauma, 75
 * the scale's top. */
export function severityOf(body: BodyState): number {
  const top = [0, 0, 0, 0];
  for (let p = 0; p < PARTS; p++) top[REGION[p]] = Math.max(top[REGION[p]], body.worst[p]);
  top.sort((a, b) => b - a);
  return top[0] * top[0] + top[1] * top[1] + top[2] * top[2];
}
