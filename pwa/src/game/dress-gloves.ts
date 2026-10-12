// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GLOVES, DRESSED — a fist closed round each pole grip, laid on the loom
// (`dress-loft.ts`): the fist riding the hand, the cuff the forearm, shared
// across the wrist.
//
// A ski glove is built the way the shops sell it, and drawn as its parts so
// each reads at a glance: a SHELL over the back of the hand with a padded
// KNUCKLE band; a PALM of leather (or a synthetic grip) sewn over the palm,
// the fingers' insides and the thumb; four FINGERS pre-curved round the
// grip, stacked up it, each its own tube so the fist reads as fingers and
// not as a lump; the THUMB laid over the grip from the palm's side; a WRIST
// STRAP cinched round the wrist with its tab; and a CUFF —
//
//   GAUNTLET   long and flared over the jacket's sleeve, its top bound in
//              the accent and gathered by a drawcord with its toggle
//   MITTENS    one round mitt where the fingers are, a fat thumb, and a
//              fleece-lined gauntlet cuff turned over at the top
//   UNDERCUFF  a short knit cuff tucked up the sleeve: the leather work
//              glove's look, a palm of a lighter hide and its seams
//   RACE       the gauntlet with HARD PLATES over the knuckles and the
//              fingers' backs and the slalom's POLE GUARD — a shield over
//              the back of the hand a racer punches the gates away with
//
// The grip is the pole's top (`skier-rig.ts`'s hand bone stands at it, its
// +z up the pole): the fist closes round it a hand's breadth down, the
// knuckles ahead of it on the back's side, the fingers curled round its
// front into the palm. A fist is the grip's own size: a gloved hand ~10 cm
// across round a 3 cm grip.

import {
  add,
  bindPose,
  clothWeights,
  mul,
  norm,
  rides,
  smoothstep,
  sub,
  type Influence,
  type Loom,
  type V3,
} from "./dress-loft.ts";
import { gearOf, type Outfit } from "./outfit.ts";

const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Where the fingers stand up the grip (m down it from its top), their
 * half widths up it and half thicknesses: the index under the thumb, the
 * little finger smallest at the foot. */
const FINGERS = [
  { up: -0.016, w: 0.0118, t: 0.0122, reach: 1 },
  { up: -0.039, w: 0.0122, t: 0.0126, reach: 1.04 },
  { up: -0.062, w: 0.0116, t: 0.012, reach: 0.98 },
  { up: -0.083, w: 0.0098, t: 0.0104, reach: 0.9 },
];

/** Where the WRIST is, m along the forearm from the grip's top: the
 * strap's middle, where the hand gives way to the cuff. */
const WRIST = -0.056;

/** A GLOVE'S SIZE, measured off real ones (`make glove-metrics`): a cuff's
 * length from the wrist to its mouth, m, and the half widths of its mouth
 * and of the wrist under its strap. A gauntlet laid flat is ~0.9 of its
 * hand's length from the wrist to the mouth, its mouth ~1.45 the palm's
 * width and its wrist ~0.9 — ~41 cm round the mouth and ~28 round the
 * wrist on a man's hand — and it flares out of the strap over its first
 * ~8 cm and runs on near straight, its drawcord gathering the rim. A race
 * glove's cuff is half that, a knit undercuff a wristband's. */
const CUFFS = {
  gauntlet: { length: 0.172, mouth: 0.062, wrist: 0.043 },
  mitten: { length: 0.165, mouth: 0.063, wrist: 0.044 },
  race: { length: 0.095, mouth: 0.055, wrist: 0.043 },
  undercuff: { length: 0.065, mouth: 0.04, wrist: 0.035 },
} as const;

/** A WOMAN'S HAND against a man's: the survey's mean breadth and girth
 * (78 mm and 187 mm against 88 and 212). */
const WOMAN_HAND = 0.89;

/** A glove's girths scaled to the hand in it, and a cuff to the forearm
 * (rounder on a heavier build). */
const handScale = (o: Outfit): number => (gearOf("body", o.body).female ? WOMAN_HAND : 1);
const limbScale = (o: Outfit): number => 1 + (gearOf("weight", o.weight).girth - 1) * 0.7;

/** Whether the gloves are pulled on OVER the sleeve (a gauntlet's cuff),
 * rather than tucked up under it (the undercuff). */
export const overSleeve = (o: Outfit): boolean => o.gloves !== "undercuff";

/** WHERE A CUFF'S MOUTH STANDS over the sleeve it is pulled on over: `at`
 * m along the forearm from the grip's top (negative, up the arm), and the
 * room inside it — the sleeve is gathered into the mouth to fit (a real
 * sleeve's cuff is cinched in under the gauntlet), so nothing of it pokes
 * out through the glove. */
export function gauntletMouth(o: Outfit): { at: number; room: number } {
  const c = CUFFS[o.gloves];
  return { at: WRIST - c.length, room: c.mouth * handScale(o) * limbScale(o) * 0.86 - 0.003 };
}

/** THE GLOVES: one a hand, its fist round the grip and its cuff up the
 * forearm. */
export function cutGloves(loom: Loom, o: Outfit): void {
  const g = gearOf("gloves", o.gloves);
  const { frames: F, pose: P } = bindPose();
  const mitten = o.gloves === "mitten";
  const race = o.gloves === "race";
  const under = o.gloves === "undercuff";
  const k = handScale(o);
  const limb = limbScale(o);
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const fa = F[`forearm_${s}`];
    const hand = F[`hand_${s}`];
    const d = fa.y;
    const top = P.hands[i];
    // The fist's frame: `up` the pole squared to the forearm `d`, and
    // `across` them — the back of the hand faces away from his middle.
    const up = norm(sub(hand.z, mul(d, dot(hand.z, d))));
    const across = norm(cross(d, up));
    const out = across.x * (i === 0 ? 1 : -1) > 0 ? 1 : -1;
    const back = mul(across, out);
    /** A point of the fist: `a` along the forearm from the grip, `b` toward
     * the back of the hand, `u` up the grip from its top. */
    const at = (a: number, b: number, u: number): V3 =>
      add(top, add(mul(d, a), add(mul(back, b), mul(up, u))));
    // On a ring laid with `face: up` along `d`, +x is `across`: the back of
    // the hand is where cos(t) has the sign of `out`.
    const backness = (t: number): number => Math.cos(t) * out;

    const weights = (p: V3): Influence[] => {
      const along = dot(sub(p, top), d);
      const k = smoothstep((along - WRIST + 0.035) / 0.05);
      if (k >= 1) return rides(`hand_${s}`);
      const cuff = clothWeights(p, [`forearm_${s}`]);
      if (k <= 0) return cuff;
      return [...cuff.map((c) => ({ ...c, w: c.w * (1 - k) })), { ...rides(`hand_${s}`)[0], w: k }];
    };
    const onHand = (): Influence[] => rides(`hand_${s}`);

    // THE HAND: the back and the palm, from the wrist to the knuckles, its
    // middle a little down the grip from its top.
    const mid = -0.046 * k;
    const hw = (mitten ? 0.0265 : 0.025) * k;
    const hu = (mitten ? 0.057 : 0.054) * k;
    // The wrist's padding is the same whatever the hand in it: a smaller
    // hand's glove is a little rounder there than its hand's scale.
    const pad = 1 + (1 - k) * 0.4;
    const knuckle = 0.078;
    const H0 = 0.0;
    loom.tube({
      path: [at(WRIST - 0.015, 0.002, mid + 0.004), at(0.012, 0.003, mid)],
      face: [up, up],
      round: 0.02,
      sections: [
        { s: H0, w: hw * 1.03 * pad, f: hu * 0.96 * pad, b: hu * 0.96 * pad },
        { s: 0.03, w: hw * pad, f: hu * 0.95 * pad, b: hu * 0.93 * pad },
        { s: 0.055, w: hw, f: hu, b: hu * 0.96 },
        { s: knuckle - 0.004, w: hw * 0.98, f: hu * 0.98, b: hu * 0.94 },
        { s: knuckle + 0.007, w: hw * 0.8, f: hu * 0.86, b: hu * 0.82 },
      ],
      step: 0.022,
      cuts: [0.06, 0.074],
      segments: 12,
      angles: [Math.PI / 2 - out * 0.9, -Math.PI / 2 + out * 0.9],
      square: 3.2,
      fold: (sl, t) => {
        let proud = 0;
        // The padded knuckle band across the back.
        if (sl > 0.06 && sl < 0.074 && backness(t) > 0.35) proud += mitten ? 0.002 : 0.004;
        // The race glove's shield proud over the back of the hand.
        if (race && sl > 0.015 && sl < 0.057 && backness(t) > 0.45) proud += 0.0035;
        return proud;
      },
      colour: (sl, t) => {
        const b = backness(t);
        if (b < -0.25) return g.palm;
        if (sl > 0.06 && sl < 0.074 && b > 0.35) return race ? g.second : g.second;
        if (race && sl > 0.015 && sl < 0.057 && b > 0.45) return g.second;
        // A panel of piping down the back's middle on the gauntlet.
        return g.main;
      },
      cap: [true, false],
      weights: onHand,
    });

    // THE FINGERS: curled round the grip's front from the knuckles into the
    // palm — or, in a mitten, one mitt where all four are.
    // A smaller hand's fingers wrap the same grip closer, and so reach less
    // far round it: the curl drawn in about the grip's middle.
    const wrap = 1 - (1 - k) * 0.6;
    const wrapped = (a: number, b: number, u: number): V3 =>
      at(0.012 + (a - 0.012) * wrap, b * wrap, u);
    const curl = (u: number, reach: number): V3[] => [
      wrapped(-0.002, 0.021, u),
      wrapped(0.018, 0.024, u),
      wrapped(0.03 + 0.004 * reach, 0.004, u),
      wrapped(0.024, -0.019, u),
      wrapped(0.004, -0.027, u),
    ];
    const fingerColour = (sl: number, t: number, plates: boolean): number => {
      // The ring's +x (the curl's way × up) lies in the curl's plane, and
      // points out of the curl on the same side as a hand ring's back.
      const outside = backness(t) > -0.2;
      if (!outside) return g.palm;
      if (plates && sl > 0.012 && sl < 0.05) return g.second;
      return g.main;
    };
    if (mitten) {
      const u = -0.05 * k;
      loom.tube({
        path: curl(u, 1.08),
        face: [up, up, up, up, up],
        round: 0.016,
        sections: [
          { s: 0, w: 0.019 * k, f: 0.046 * k, b: 0.046 * k },
          { s: 0.035, w: 0.02 * k, f: 0.048 * k, b: 0.046 * k },
          { s: 0.07, w: 0.019 * k, f: 0.046 * k, b: 0.044 * k },
          { s: 0.092, w: 0.016 * k, f: 0.04 * k, b: 0.038 * k },
        ],
        step: 0.018,
        segments: 12,
        square: 2.8,
        colour: (sl, t) => fingerColour(sl, t, false),
        cap: [false, true],
        weights: onHand,
      });
    } else {
      for (const f of FINGERS) {
        const path = curl(f.up * k, f.reach);
        const fw = f.w * k;
        const ft = f.t * k;
        loom.tube({
          path,
          face: path.map(() => up),
          round: 0.012,
          sections: [
            { s: 0, w: ft * 1.05, f: fw, b: fw },
            { s: 0.03, w: ft, f: fw, b: fw },
            { s: 0.06, w: ft * 0.95, f: fw * 0.95, b: fw * 0.95 },
            { s: 0.08 * f.reach, w: ft * 0.88, f: fw * 0.88, b: fw * 0.88 },
          ],
          step: 0.02,
          cuts: race ? [0.012, 0.05] : [],
          segments: 7,
          square: 2.6,
          fold: (sl, t) => (race && sl > 0.012 && sl < 0.05 && backness(t) > 0.3 ? 0.0028 : 0),
          colour: (sl, t) => fingerColour(sl, t, race),
          cap: [false, true],
          weights: onHand,
        });
      }
    }

    // THE THUMB: from the palm's side of the hand, over the grip and laid
    // across the index finger's middle.
    const tw = (mitten ? 0.016 : 0.0135) * k;
    const t0 = at(-0.035, -0.024, -0.008);
    const t1 = at(-0.008, -0.034, 0.004);
    const t2 = at(0.016, -0.031, 0.002);
    const t3 = at(0.028, -0.016, -0.006);
    loom.tube({
      path: [t0, t1, t2, t3],
      face: [back, back, back, back],
      round: 0.012,
      sections: [
        { s: 0, w: tw * 1.35, f: tw * 1.25, b: tw * 1.2 },
        { s: 0.03, w: tw * 1.08, f: tw, b: tw },
        { s: 0.055, w: tw * 0.98, f: tw * 0.92, b: tw * 0.92 },
        { s: 0.078, w: tw * 0.84, f: tw * 0.8, b: tw * 0.8 },
      ],
      step: 0.018,
      segments: 7,
      square: 2.5,
      colour: (_sl, t) => (Math.sin(t) > 0.3 ? g.main : g.palm),
      cap: [false, true],
      weights: onHand,
    });

    // THE CUFF: from the wrist up the forearm — a gauntlet's pulled on over
    // the sleeve, a race glove's short one, an undercuff's knit tucked under
    // it — with the wrist strap cinched round it. A gauntlet's mouth is laid
    // round the SLEEVE, on the forearm's own line (the sleeve is gathered
    // into it, `gauntletMouth`), and it flares out of the strap over its
    // first few centimetres and runs on near straight to the mouth.
    const cuffOf = CUFFS[o.gloves];
    const C = cuffOf.length;
    const flare = cuffOf.mouth * k * limb;
    const cinch = cuffOf.wrist * k;
    const w0 = WRIST - C;
    const strap = [C - 0.03, C - 0.008];
    const rim = under ? 0.012 : 0.016;
    loom.tube({
      path: under
        ? [at(w0, 0, mid * 0.4), at(WRIST + 0.006, 0.002, mid + 0.004)]
        : [
            at(w0, 0, 0),
            at(w0 + 0.06, 0, mid * 0.12),
            at(WRIST - 0.02, 0.002, mid * 0.85),
            at(WRIST + 0.006, 0.002, mid + 0.004),
          ],
      face: under ? [up, up] : [up, up, up, up],
      sections: under
        ? [
            { s: 0, w: flare * 0.94, f: flare * 0.94, b: flare * 0.94 },
            { s: rim * 0.6, w: flare, f: flare, b: flare },
            { s: C - 0.028, w: cinch, f: cinch * 1.06, b: cinch * 1.06 },
            { s: C, w: hw * pad, f: hu * 0.9 * pad, b: hu * 0.9 * pad },
          ]
        : [
            // The rim, gathered by its drawcord.
            { s: 0, w: flare * 0.93, f: flare * 0.93, b: flare * 0.93 },
            { s: rim * 0.6, w: flare * 0.98, f: flare * 0.98, b: flare * 0.98 },
            { s: 0.03, w: flare, f: flare, b: flare },
            { s: C - 0.08, w: flare * 0.97, f: flare * 0.97, b: flare * 0.97 },
            // Out of the strap, the flare.
            { s: C - 0.048, w: cinch * 1.22, f: cinch * 1.26, b: cinch * 1.26 },
            { s: C - 0.028, w: cinch, f: cinch * 1.18, b: cinch * 1.18 },
            { s: C, w: hw * 1.08 * pad, f: hu * 0.96 * pad, b: hu * 0.96 * pad },
          ],
      step: 0.024,
      cuts: [rim, strap[0], strap[1], under ? rim : 0.052],
      segments: 12,
      square: 2.6,
      fold: (sl) => {
        let proud = 0;
        if (sl > strap[0] && sl < strap[1]) proud += 0.0035;
        // The rim's binding rolled proud of the cuff.
        if (sl < rim) proud += 0.002;
        return proud;
      },
      colour: (sl, t) => {
        if (sl > strap[0] && sl < strap[1]) return g.second;
        if (sl < rim) return mitten ? g.third : g.accent;
        if (under) return g.third;
        if (mitten && sl < 0.052) return g.third;
        // The palm's leather carried up the inside of the wrist.
        if (sl > C - 0.02 && backness(t) < -0.4) return g.palm;
        return g.main;
      },
      cap: [false, false],
      weights,
    });
    // The strap's TAB, out of its buckle on the back of the wrist; and on a
    // gauntlet the drawcord's TOGGLE hanging off the rim.
    const tab = at(WRIST - C + strap[0] + 0.011, hw + 0.006, mid + 0.02);
    loom.tube({
      path: [tab, add(tab, add(mul(up, 0.03), mul(back, 0.004)))],
      face: [back, back],
      sections: [
        { s: 0, w: 0.011, f: 0.003, b: 0.003 },
        { s: 0.03, w: 0.01, f: 0.003, b: 0.003 },
      ],
      step: 0.03,
      segments: 4,
      square: 4,
      colour: () => (race || under ? g.second : g.accent),
      weights,
    });
    if (!under && !mitten) {
      const cord = at(w0 + 0.012, -flare * 0.7, -flare * 0.6);
      loom.tube({
        path: [cord, add(cord, add(mul(up, -0.028), mul(d, 0.006)))],
        face: [d, d],
        sections: [
          { s: 0, w: 0.0025, f: 0.0025, b: 0.0025 },
          { s: 0.016, w: 0.0025, f: 0.0025, b: 0.0025 },
          { s: 0.018, w: 0.006, f: 0.006, b: 0.006 },
          { s: 0.028, w: 0.0055, f: 0.0055, b: 0.0055 },
        ],
        step: 0.01,
        segments: 5,
        colour: (sl) => (sl < 0.017 ? g.third : g.accent),
        hard: true,
        weights,
      });
    }
  }
}
