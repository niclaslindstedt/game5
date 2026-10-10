// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HEAD AND THE HANDS, DRESSED — the helmet of the catalog (`outfit.ts`)
// over the head (`helmet-shape.ts`'s triangles, which the Blender model
// was built from too), a woman's braid out from under it, and the gloves
// closed round the pole grips; laid on the loom (`dress-loft.ts`), the
// helmet and the hair riding the head, a glove's fist riding the hand and
// its cuff the forearm.
//
//   RACE      the measured hard-eared shell, gloss, its stripe, the goggles
//             strapped round the outside
//   FREERIDE  the same shell in a matt white, SOFT EAR PADS over the ear
//             covers and a short PEAK over the goggles
//   VISOR     no goggles and no strap: a tinted VISOR dropped over the face
//             from the brim to the nose, hinged on the ear covers
//   SLALOM    the race shell and a CHIN GUARD, the bar a slalom racer
//             punches the gates away with, from ear cover to ear cover
//
// The gloves (`GloveId`): a GAUNTLET's long cuff flared over the sleeve;
// MITTENS, one round fist and a thumb; an UNDERCUFF's short cuff tucked up
// the sleeve; RACE gloves, the gauntlet with hard plates across the
// knuckles. A fist is the grip's own size: a hand 8.5 cm across closed
// round a 3 cm grip.

import {
  BEANIE,
  bareHeadParts,
  headAt,
  helmetParts,
  shellAt,
  shellNormal,
  type HelmetMaterial,
} from "./helmet-shape.ts";
import {
  add,
  bindPose,
  clothWeights,
  dirInBone,
  inBone,
  len,
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

const DARK = 0x101114;
const LINER = 0x26282c;
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const H = (x: number, y: number, z: number): V3 => inBone("head", v(x, y, z));
const HD = (x: number, y: number, z: number): V3 => dirInBone("head", v(x, y, z));
const toV = (p: [number, number, number]): V3 => v(p[0], p[1], p[2]);

/** The goggles and their strap — what a visor helmet has instead. */
const GOGGLE_PARTS: HelmetMaterial[] = ["frame", "foam", "lens", "strap", "band"];
/** How many shades a mirrored lens is graded in. */
const LENS_STEPS = 8;

/** A MIRRORED LENS'S SHADES, bottom to top: the tint itself low on the
 * cheeks, the sky's bright band across its upper middle, the coating
 * darkest under the brow. */
export function lensShades(lens: number): number[] {
  const keys: [number, number][] = [
    [0, lens],
    [0.4, lens],
    [0.68, mix(lens, 0xffffff, 0.45)],
    [1, mix(lens, 0x0c0d10, 0.6)],
  ];
  return Array.from({ length: LENS_STEPS }, (_, k) => {
    const u = k / (LENS_STEPS - 1);
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] < u) i++;
    const [a, ca] = keys[i];
    const [b, cb] = keys[i + 1];
    return mix(ca, cb, smoothstep((u - a) / (b - a)));
  });
}

/** The lens's colour a triangle, graded by its height (`lensShades`). */
function mirrored(position: number[], index: number[], lens: number): (tri: number) => number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < position.length; i += 3) {
    lo = Math.min(lo, position[i]);
    hi = Math.max(hi, position[i]);
  }
  const shades = lensShades(lens);
  return (tri) => {
    let y = 0;
    for (let k = 0; k < 3; k++) y += position[index[tri * 3 + k] * 3 + 1] / 3;
    const u = Math.max(0, Math.min(1, (y - lo) / (hi - lo || 1)));
    return shades[Math.round(u * (LENS_STEPS - 1))];
  };
}

/** Two sRGB hex colours mixed, `k` of the way from `a` to `b`. */
function mix(a: number, b: number, k: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/** What shines: the shell and its stripe, the goggles' frame and lens. */
const HARD: HelmetMaterial[] = ["shell", "stripe", "frame", "lens"];

/** The head dressed: in his helmet, or `bare` (indoors — his face, and his
 * hair or, on a man, a beanie in his helmet's colour). */
export function cutHead(loom: Loom, o: Outfit, tone?: number, bare = false): void {
  const h = gearOf("helmet", o.helmet);
  const body = gearOf("body", o.body);
  const skin = tone ?? body.skin;
  if (bare) {
    const cap = body.female ? body.hair : h.shell;
    const beanie = !body.female;
    for (const part of bareHeadParts(1, beanie)) {
      const colour = part.material === "knit" ? cap : part.material === "skin" ? skin : DARK;
      loom.rigid("head", part.position, part.normal, part.index, colour, false);
    }
    if (beanie) {
      // ITS CUFF: a band rolled round the brow in the helmet's trim colour.
      const lo = headAt(BEANIE.y);
      const hi = headAt(BEANIE.y + BEANIE.band);
      const ring = (s: number, at: typeof lo) => ({
        s,
        w: at.w + BEANIE.proud,
        f: at.f + BEANIE.proud,
        b: at.b + BEANIE.proud,
      });
      loom.tube({
        path: [H(0, BEANIE.y - 0.002, 0), H(0, BEANIE.y + BEANIE.band, 0)],
        face: [HD(0, 0, 1), HD(0, 0, 1)],
        sections: [ring(0, lo), ring(BEANIE.band + 0.002, hi)],
        step: 0.02,
        segments: 16,
        colour: () => h.trim,
        weights: () => rides("head"),
      });
    }
    braid(loom, body);
    return;
  }
  const paint: Record<HelmetMaterial, number> = {
    shell: h.shell,
    stripe: h.trim,
    frame: h.trim,
    // The strap printed in the lens's colour: a bright band round the
    // shell's back, what a skier's helmet reads by from behind.
    band: h.lens,
    trim: DARK,
    strap: DARK,
    foam: DARK,
    liner: LINER,
    knit: LINER,
    lens: h.lens,
    skin,
  };
  for (const part of helmetParts()) {
    if (o.helmet === "visor" && GOGGLE_PARTS.includes(part.material)) continue;
    // A freeride helmet carries no stripe: its shell is all the one white.
    const colour =
      part.material === "lens"
        ? mirrored(part.position, part.index, h.lens)
        : o.helmet === "freeride" && part.material === "stripe"
          ? h.shell
          : paint[part.material];
    loom.rigid(
      "head",
      part.position,
      part.normal,
      part.index,
      colour,
      HARD.includes(part.material),
    );
  }

  if (o.helmet === "freeride") {
    // SOFT EAR PADS: a fabric disc over each ear cover.
    for (const side of [-1, 1]) {
      const c = toV(shellAt(-0.035, (side * Math.PI) / 2));
      const n = toV(shellNormal(-0.035, (side * Math.PI) / 2));
      const at = H(c.x, c.y, c.z);
      const out = HD(n.x, n.y, n.z);
      loom.tube({
        path: [add(at, mul(out, -0.004)), add(at, mul(out, 0.012))],
        face: [HD(0, 0, 1), HD(0, 0, 1)],
        sections: [
          { s: 0, w: 0.036, f: 0.04, b: 0.04 },
          { s: 0.01, w: 0.034, f: 0.038, b: 0.038 },
          { s: 0.016, w: 0.026, f: 0.03, b: 0.03 },
        ],
        step: 0.01,
        segments: 12,
        square: 2.2,
        colour: () => h.trim,
        weights: () => rides("head"),
      });
    }
    // THE PEAK: a short brim standing out over the goggles.
    const pts: V3[] = [];
    const faces: V3[] = [];
    for (let k = -4; k <= 4; k++) {
      const a = (k / 4) * 0.62;
      const p = toV(shellAt(0.052, a));
      const n = toV(shellNormal(0.052, a));
      pts.push(H(p.x, p.y, p.z));
      faces.push(norm(add(HD(n.x, n.y * 0.2, n.z), HD(0, -0.35, 0))));
    }
    loom.tube({
      path: pts,
      face: faces,
      round: 0.02,
      sections: [
        { s: 0, w: 0.004, f: 0.006, b: 0.002 },
        { s: 0.05, w: 0.004, f: 0.03, b: 0.002 },
        { s: 0.17, w: 0.004, f: 0.034, b: 0.002 },
        { s: 0.29, w: 0.004, f: 0.03, b: 0.002 },
        { s: 0.34, w: 0.004, f: 0.006, b: 0.002 },
      ],
      step: 0.03,
      segments: 6,
      square: 2.6,
      colour: () => h.shell,
      weights: () => rides("head"),
      hard: true,
    });
  }

  if (o.helmet === "visor") {
    // THE VISOR: a toric lens round the face from the brim to the nose,
    // its rim in the trim and a hinge boss on each ear cover.
    const pts: V3[] = [];
    const faces: V3[] = [];
    for (let k = -6; k <= 6; k++) {
      const a = (k / 6) * 1.02;
      pts.push(H(Math.sin(a) * 0.118, -0.006, 0.026 + Math.cos(a) * 0.124));
      faces.push(HD(Math.sin(a), 0.05, Math.cos(a)));
    }
    loom.tube({
      path: pts,
      face: faces,
      round: 0.03,
      sections: [
        { s: 0, w: 0.04, f: 0.003, b: 0.003 },
        { s: 0.05, w: 0.052, f: 0.003, b: 0.003 },
        { s: 0.27, w: 0.054, f: 0.003, b: 0.003 },
        { s: 0.49, w: 0.052, f: 0.003, b: 0.003 },
        { s: 0.54, w: 0.04, f: 0.003, b: 0.003 },
      ],
      step: 0.03,
      segments: 6,
      square: 3,
      colour: () => h.lens,
      weights: () => rides("head"),
      hard: true,
    });
    for (const side of [-1, 1]) {
      const at = H(side * 0.112, -0.006, 0.012);
      loom.tube({
        path: [at, add(at, HD(side * 0.016, 0, 0))],
        face: [HD(0, 0, 1), HD(0, 0, 1)],
        sections: [
          { s: 0, w: 0.016, f: 0.016, b: 0.016 },
          { s: 0.016, w: 0.012, f: 0.012, b: 0.012 },
        ],
        step: 0.02,
        segments: 8,
        colour: () => h.trim,
        weights: () => rides("head"),
        hard: true,
      });
    }
  }

  if (o.helmet === "slalom") {
    // THE CHIN GUARD: a bar from ear cover to ear cover round the chin.
    const path = [
      H(-0.106, -0.062, 0.0),
      H(-0.082, -0.098, 0.082),
      H(0, -0.118, 0.13),
      H(0.082, -0.098, 0.082),
      H(0.106, -0.062, 0.0),
    ];
    const toward = (p: V3) => norm(sub(p, H(0, -0.03, 0.02)));
    loom.tube({
      path,
      face: path.map(toward),
      round: 0.05,
      sections: [
        { s: 0, w: 0.014, f: 0.012, b: 0.012 },
        { s: 0.1, w: 0.019, f: 0.016, b: 0.012 },
        { s: 0.24, w: 0.02, f: 0.018, b: 0.012 },
        { s: 0.38, w: 0.019, f: 0.016, b: 0.012 },
        { s: 0.48, w: 0.014, f: 0.012, b: 0.012 },
      ],
      step: 0.03,
      segments: 8,
      colour: () => h.trim,
      weights: () => rides("head"),
      hard: true,
    });
  }

  braid(loom, body);
}

/** A WOMAN'S BRAID: out from under the helmet's nape, over the collar and
 * down between her shoulder blades — three strands plaited (the lobes
 * alternating side to side), a tie and a short tuft at its end. Its top
 * rides the head; down the back it is handed to the chest, so it lies on
 * the jacket when she bends and swings with her head where it leaves it. */
function braid(loom: Loom, body: { female: boolean; hair: number; plait: number }): void {
  if (!body.female) return;
  const { frames: F, pose: P } = bindPose();
  const up = F.chest.y;
  const back = mul(F.chest.z, -1);
  const at = (b: number, u: number) => add(P.neck, add(mul(back, b), mul(up, u)));
  const path = [
    H(0, -0.045, -0.112),
    H(0, -0.09, -0.13),
    at(0.125, 0.0),
    at(0.142, -0.1),
    at(0.148, -0.2),
  ];
  const top = path[0];
  const L = 0.36;
  const tieAt = L - 0.05;
  const hair = body.hair;
  loom.tube({
    path,
    face: [HD(0, 0, -1), HD(0, 0, -1), back, back, back],
    round: 0.03,
    sections: [
      { s: 0, w: 0.032, f: 0.026, b: 0.026 },
      { s: 0.05, w: 0.03, f: 0.022, b: 0.022 },
      { s: 0.2, w: 0.024, f: 0.017, b: 0.017 },
      { s: tieAt - 0.01, w: 0.018, f: 0.013, b: 0.013 },
      { s: tieAt, w: 0.011, f: 0.009, b: 0.009 },
      { s: tieAt + 0.012, w: 0.012, f: 0.009, b: 0.009 },
      { s: L - 0.012, w: 0.02, f: 0.012, b: 0.012 },
      { s: L, w: 0.008, f: 0.005, b: 0.005 },
    ],
    step: 0.009,
    cuts: [tieAt - 0.006, tieAt + 0.006],
    segments: 10,
    // The plait: lobes 3 cm long, each leaning to the other side.
    fold: (sl, t) =>
      sl < tieAt - 0.01
        ? 0.0045 *
          Math.cos(t - Math.sign(Math.sin((sl / 0.03) * Math.PI)) * 0.9) *
          Math.abs(Math.sin((sl / 0.03) * Math.PI)) ** 0.6
        : 0,
    colour: (sl, t) => {
      if (sl > tieAt - 0.006 && sl < tieAt + 0.006) return DARK;
      // The strands' shadowed partings.
      return Math.abs(Math.sin((sl / 0.03) * Math.PI)) < 0.25 && Math.cos(t) > 0
        ? body.plait
        : hair;
    },
    weights: (p) => {
      const k = smoothstep((len(sub(p, top)) - 0.05) / 0.08);
      if (k <= 0) return rides("head");
      if (k >= 1) return rides("chest");
      return [
        { ...rides("head")[0], w: 1 - k },
        { ...rides("chest")[0], w: k },
      ];
    },
  });
}

/** THE GLOVES: a fist round each grip riding the hand, its cuff the
 * forearm, shared across the wrist. A fist is a ROUNDED BOX, not a tube:
 * the back of the hand flat from the wrist to the knuckles, the four
 * fingers curled round the grip and stacked up it (a groove between each
 * across the front), the THUMB laid over the grip's top — and a strap
 * cinched round the wrist. A mitten is the same fist with no fingers and
 * a fat thumb; the race glove carries hard plates over the knuckles and
 * the fingers' backs. */
export function cutGloves(loom: Loom, o: Outfit): void {
  const g = gearOf("gloves", o.gloves);
  const { frames: F, pose: P } = bindPose();
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const fa = F[`forearm_${s}`];
    const hand = F[`hand_${s}`];
    const d = fa.y;
    const fist = P.hands[i];
    // The fist's +z up the pole (from the basket to the fist), squared to
    // the forearm; its +x across the knuckles.
    const up = norm(sub(hand.z, mul(d, hand.z.x * d.x + hand.z.y * d.y + hand.z.z * d.z)));
    const across = norm({
      x: d.y * up.z - d.z * up.y,
      y: d.z * up.x - d.x * up.z,
      z: d.x * up.y - d.y * up.x,
    });
    // Toward his middle: the side the thumb wraps from.
    const inward = across.x * (i === 0 ? 1 : -1) > 0 ? 1 : -1;
    const wristS = 0.075;
    const weights = (p: V3): Influence[] => {
      const along = (p.x - fist.x) * d.x + (p.y - fist.y) * d.y + (p.z - fist.z) * d.z;
      const k = smoothstep((along + wristS + 0.03) / 0.05);
      if (k >= 1) return rides(`hand_${s}`);
      const cuff = clothWeights(p, [`forearm_${s}`]);
      if (k <= 0) return cuff;
      return [...cuff.map((c) => ({ ...c, w: c.w * (1 - k) })), { ...rides(`hand_${s}`)[0], w: k }];
    };
    const mitten = o.gloves === "mitten";
    const race = o.gloves === "race";
    const under = o.gloves === "undercuff";
    const cuffLen = under ? 0.075 : 0.155;
    const flare = under ? 0.044 : mitten ? 0.078 : 0.084;
    // The fist's half breadths: across the knuckles, up the grip (toward
    // the thumb) and down it (the little finger).
    const fw = mitten ? 0.05 : 0.045;
    const fu = mitten ? 0.055 : 0.05;
    const C = cuffLen;
    const end = mitten ? 0.085 : 0.075;
    const strap = [C - 0.058, C - 0.036];
    const sections = [
      { s: 0, w: flare * 0.96, f: flare * 0.96, b: flare * 0.96 },
      { s: 0.012, w: flare + 0.003, f: flare + 0.003, b: flare + 0.003 },
      ...(under
        ? []
        : [
            { s: 0.05, w: flare * 0.88, f: flare * 0.86, b: flare * 0.88 },
            { s: C - 0.075, w: 0.06, f: 0.056, b: 0.058 },
          ]),
      { s: C - 0.05, w: 0.043, f: 0.042, b: 0.044 },
      { s: C - 0.025, w: fw * 0.98, f: fu * 0.9, b: fu * 0.88 },
      { s: C + 0.005, w: fw, f: fu, b: fu * 0.96 },
      { s: C + 0.035, w: fw, f: fu * 0.98, b: fu * 0.94 },
      { s: C + end - 0.022, w: fw * 0.92, f: fu * 0.88, b: fu * 0.84 },
      { s: C + end - 0.008, w: fw * 0.72, f: fu * 0.66, b: fu * 0.62 },
      { s: C + end, w: fw * 0.38, f: fu * 0.34, b: fu * 0.32 },
    ];
    // The knuckles' line and the fingers' grooves, up the front of the fist.
    const knuckle = C + 0.012;
    const fingers = (sl: number, t: number): number => {
      if (mitten || sl < knuckle) return 0;
      const zUp = Math.sin(t);
      const front = Math.max(0, Math.cos(t) * 0) + 1;
      let k = 0;
      for (const at of [-0.5, 0, 0.5]) {
        k -= 0.0035 * front * Math.max(0, 1 - Math.abs(zUp - at) / 0.12);
      }
      return k * smoothstep((sl - knuckle) / 0.02);
    };
    loom.tube({
      path: [add(fist, mul(d, -C)), add(fist, mul(d, end))],
      face: [up, up],
      sections,
      step: 0.012,
      cuts: [strap[0], strap[1], knuckle, C + 0.03],
      segments: 14,
      square: mitten ? 2.5 : 3.0,
      fold: (sl, t) => {
        let k = fingers(sl, t);
        if (sl > strap[0] && sl < strap[1]) k += 0.004;
        // The race glove's plates: proud over the knuckles and the backs of
        // the fingers (the side away from the body's middle).
        if (race && sl > knuckle - 0.012 && sl < C + 0.05 && Math.cos(t) * -inward > 0.25) {
          k += 0.007;
        }
        // The gauntlet's cuff gathered by its drawcord just above the wrist.
        if (!under && sl > 0.03 && sl < C - 0.08) k += 0.003 * Math.sin((sl / 0.02) * Math.PI * 2);
        return k;
      },
      colour: (sl, t) => {
        if (sl > strap[0] && sl < strap[1]) return g.second;
        if (race && sl > knuckle - 0.012 && sl < C + 0.05 && Math.cos(t) * -inward > 0.25) {
          return g.second;
        }
        if (sl < 0.03 && !under) return mitten ? g.third : g.second;
        if (sl < C - 0.075 && !under) return mitten ? g.third : g.main;
        return g.main;
      },
      cap: [true, false],
      weights,
    });
    // THE THUMB: off the inside of the fist and over the top of the grip,
    // laid along it toward the knuckles.
    const base = add(
      fist,
      add(mul(up, fu * 0.7), add(mul(across, inward * fw * 0.6), mul(d, -0.022))),
    );
    const mid = add(base, add(mul(up, 0.014), add(mul(across, -inward * 0.012), mul(d, 0.03))));
    const tip = add(mid, add(mul(up, 0.004), add(mul(across, -inward * 0.012), mul(d, 0.022))));
    const tw = mitten ? 0.021 : 0.016;
    loom.tube({
      path: [base, mid, tip],
      face: [d, up, up],
      round: 0.012,
      sections: [
        { s: 0, w: tw * 1.15, f: tw * 1.1, b: tw * 1.1 },
        { s: 0.03, w: tw, f: tw * 0.95, b: tw * 0.95 },
        { s: 0.05, w: tw * 0.85, f: tw * 0.8, b: tw * 0.8 },
        { s: 0.058, w: tw * 0.4, f: tw * 0.4, b: tw * 0.4 },
      ],
      step: 0.012,
      segments: 8,
      colour: () => g.main,
      weights: () => rides(`hand_${s}`),
    });
  }
}
