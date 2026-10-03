// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY UNDER THE KIT, as measures — never as a mesh: the dress
// (`dress-garments.ts`) cuts every garment to these plus its own ease, so
// a garment IS the skier's silhouette and nothing is drawn under it (the
// body the old figure carried under its clothes was triangles no camera
// ever saw).
//
// Both bodies are the ANSUR II survey's means (US Army anthropometric
// survey, 2012: 4,082 men and 1,986 women, mm) — the man's are the very
// figures the Blender suit was built to (`scripts/blender/skier.py`'s
// `ANSUR`), the woman's the same measures off the women's file. The game
// gives both the same BONES (`BODY` in `skier-pose.ts`, which the engine's
// ragdoll throws too — so every pose and every animation is one rig): the
// survey gives the flesh round them, each trunk level laid onto the game's
// spine by where it falls between the hip joint (`trochanterion`) and the
// base of the neck (`cervicale`) on that body. So a woman reads as one by
// what the survey says differs: shoulders a ninth narrower (biacromial
// 365 against 416 mm), a waist narrower against hips as broad (hip
// breadth 349 against 346), slimmer arms (biceps 296 against 358 mm round)
// — and a braid out from under the helmet.

/** A trunk level: a share of the spine (the hip joint 0, the neck's base
 * 1), the body's half breadth there and its depth ahead of and behind the
 * spine's line, m. */
export type TrunkLevel = { level: number; w: number; f: number; b: number };

export type BodyMeasure = {
  trunk: TrunkLevel[];
  /** Where the crotch and the waist fall, as levels. */
  crotch: number;
  waist: number;
  /** Half the shoulders' breadth at the acromion and over the deltoids. */
  acromion: number;
  deltoid: number;
  /** The limbs' radii, m (a circumference over 2π). */
  thigh: number;
  lowerThigh: number;
  calf: number;
  ankle: number;
  biceps: number;
  forearm: number;
  wrist: number;
  neck: number;
  /** The forearm's length to the wrist as a share of the elbow-to-fist
   * bone. */
  wristAt: number;
};

/** The survey's means, mm. */
const MAN = {
  trochanterion: 901,
  crotch: 846,
  waist_h: 1056,
  tenth_rib_h: 1121,
  chest_h: 1291,
  axilla_h: 1329,
  acromion_h: 1441,
  cervicale: 1517,
  hip_breadth: 346,
  buttock_depth: 246,
  waist_breadth: 326,
  waist_depth: 238,
  chest_breadth: 289,
  chest_depth: 254,
  biacromial: 416,
  bideltoid: 510,
  neck_base: 435,
  thigh: 625,
  lower_thigh: 409,
  calf: 392,
  ankle: 229,
  biceps: 358,
  forearm: 310,
  wrist: 176,
  forearm_length: 268,
};
const WOMAN: typeof MAN = {
  trochanterion: 836,
  crotch: 766,
  waist_h: 978,
  tenth_rib_h: 1030,
  chest_h: 1172,
  axilla_h: 1214,
  acromion_h: 1334,
  cervicale: 1398,
  hip_breadth: 349,
  buttock_depth: 230,
  waist_breadth: 288,
  waist_depth: 205,
  chest_breadth: 263,
  chest_depth: 245,
  biacromial: 365,
  bideltoid: 446,
  neck_base: 358,
  thigh: 622,
  lower_thigh: 398,
  calf: 369,
  ankle: 213,
  biceps: 296,
  forearm: 252,
  wrist: 152,
  forearm_length: 239,
};

const MM = 0.001;
const r = (circ: number) => (circ * MM) / (2 * Math.PI);

function measure(A: typeof MAN, female: boolean): BodyMeasure {
  const level = (h: number) => (h - A.trochanterion) / (A.cervicale - A.trochanterion);
  const bh = (A.hip_breadth / 2) * MM;
  const bd = A.buttock_depth * MM;
  const wb = (A.waist_breadth / 2) * MM;
  const wd = A.waist_depth * MM;
  const cb = (A.chest_breadth / 2) * MM;
  const cd = A.chest_depth * MM;
  // A woman's chest carries its depth ahead (the bust), a man's spread
  // round; her seat sits further behind the spine's line.
  const bust = female ? 0.6 : 0.51;
  return {
    crotch: level(A.crotch),
    waist: level(A.waist_h),
    acromion: (A.biacromial / 2) * MM,
    deltoid: (A.bideltoid / 2) * MM,
    trunk: [
      { level: level(A.crotch) - 0.04, w: bh * 0.8, f: bd * 0.3, b: bd * 0.45 },
      { level: level(A.crotch) + 0.05, w: bh, f: bd * 0.4, b: bd * (female ? 0.56 : 0.52) },
      { level: 0.08, w: bh, f: bd * 0.42, b: bd * (female ? 0.58 : 0.55) },
      { level: level(A.waist_h), w: wb, f: wd * 0.55, b: wd * 0.45 },
      { level: level(A.tenth_rib_h), w: wb * 0.97, f: wd * 0.55, b: wd * 0.46 },
      { level: 0.52, w: cb * 1.05, f: cd * bust, b: cd * 0.48 },
      { level: level(A.chest_h), w: cb * 1.12, f: cd * (bust - 0.01), b: cd * 0.5 },
      { level: level(A.axilla_h), w: cb * 1.2, f: cd * 0.47, b: cd * 0.5 },
      {
        level: level(A.acromion_h) - 0.05,
        w: (A.biacromial / 2) * MM * 0.9,
        f: cd * 0.4,
        b: cd * 0.44,
      },
      { level: 0.95, w: r(A.neck_base) * 1.5, f: 0.08, b: 0.08 },
      { level: 1.0, w: r(A.neck_base), f: r(A.neck_base), b: r(A.neck_base) },
    ],
    thigh: r(A.thigh),
    lowerThigh: r(A.lower_thigh),
    calf: r(A.calf),
    ankle: r(A.ankle),
    biceps: r(A.biceps),
    forearm: r(A.forearm),
    wrist: r(A.wrist),
    neck: r(A.neck_base),
    wristAt: (A.forearm_length * MM) / 0.34,
  };
}

export const BODY_MEASURES = { man: measure(MAN, false), woman: measure(WOMAN, true) } as const;

/** The trunk at a level, smoothed between the survey's levels (linear
 * between them, flat past the ends). */
export function trunkAt(m: BodyMeasure, level: number): TrunkLevel {
  const t = m.trunk;
  if (level <= t[0].level) return { ...t[0], level };
  for (let i = 0; i + 1 < t.length; i++) {
    if (level <= t[i + 1].level) {
      const u = (level - t[i].level) / (t[i + 1].level - t[i].level);
      const k = u * u * (3 - 2 * u);
      return {
        level,
        w: t[i].w + (t[i + 1].w - t[i].w) * k,
        f: t[i].f + (t[i + 1].f - t[i].f) * k,
        b: t[i].b + (t[i + 1].b - t[i].b) * k,
      };
    }
  }
  return { ...t[t.length - 1], level };
}
