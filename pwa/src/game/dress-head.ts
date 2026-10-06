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
    band: h.trim,
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
      o.helmet === "freeride" && part.material === "stripe" ? h.shell : paint[part.material];
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

/** A WOMAN'S BRAID, out from under the helmet's nape and down her back. */
function braid(loom: Loom, body: { female: boolean; hair: number }): void {
  if (!body.female) return;
  const path = [H(0, -0.06, -0.118), H(0, -0.11, -0.142), H(0, -0.2, -0.142), H(0, -0.27, -0.128)];
  loom.tube({
    path,
    face: [HD(0, 0, -1), HD(0, 0, -1), HD(0, 0, -1), HD(0, 0, -1)],
    round: 0.04,
    sections: [
      { s: 0, w: 0.03, f: 0.026, b: 0.026 },
      { s: 0.06, w: 0.027, f: 0.024, b: 0.024 },
      { s: 0.17, w: 0.021, f: 0.019, b: 0.019 },
      { s: 0.22, w: 0.016, f: 0.014, b: 0.014 },
      { s: 0.235, w: 0.005, f: 0.005, b: 0.005 },
    ],
    step: 0.012,
    segments: 8,
    fold: (s, t) => 0.004 * Math.sin((s / 0.024) * Math.PI * 2 + t),
    colour: () => body.hair,
    weights: () => rides("head"),
  });
}

/** THE GLOVES: a fist round each grip riding the hand, its cuff the
 * forearm, shared across the wrist. */
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
    // the forearm.
    const up = norm(sub(hand.z, mul(d, hand.z.x * d.x + hand.z.y * d.y + hand.z.z * d.z)));
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
    const cuffLen = o.gloves === "undercuff" ? 0.07 : 0.15;
    const flare = o.gloves === "undercuff" ? 0.046 : mitten ? 0.08 : 0.088;
    const fw = mitten ? 0.056 : 0.05;
    const fd = mitten ? 0.064 : 0.058;
    const back = o.gloves === "race";
    loom.tube({
      path: [add(fist, mul(d, -cuffLen)), add(fist, mul(d, mitten ? 0.075 : 0.062))],
      face: [up, up],
      sections: [
        { s: 0, w: flare, f: flare, b: flare },
        { s: 0.02, w: flare + 0.003, f: flare + 0.003, b: flare + 0.003 },
        { s: cuffLen - 0.07, w: 0.055, f: 0.05, b: 0.05 },
        { s: cuffLen - 0.04, w: 0.047, f: 0.05, b: 0.05 },
        { s: cuffLen, w: fw, f: fd, b: fd * 0.95 },
        { s: cuffLen + 0.04, w: fw * 0.98, f: fd, b: fd * 0.95 },
        { s: cuffLen + (mitten ? 0.075 : 0.062), w: mitten ? 0.03 : 0.034, f: 0.035, b: 0.035 },
      ],
      step: 0.025,
      cuts: [cuffLen - 0.05, cuffLen + 0.01, cuffLen + 0.035],
      segments: 8,
      square: 2.4,
      fold: (sl, t) =>
        back && sl > cuffLen + 0.01 && sl < cuffLen + 0.035 ? 0.008 * Math.max(0, Math.cos(t)) : 0,
      colour: (sl, t) => {
        if (back && sl > cuffLen + 0.01 && sl < cuffLen + 0.035 && Math.cos(t) > 0) return g.second;
        if (sl < cuffLen - 0.05 && o.gloves !== "undercuff") return mitten ? g.third : g.second;
        return g.main;
      },
      weights,
    });
    if (mitten) {
      // The thumb, over the top of the grip.
      const base = add(fist, add(mul(up, 0.045), mul(d, -0.01)));
      loom.tube({
        path: [base, add(base, add(mul(up, 0.02), mul(d, 0.035)))],
        face: [d, d],
        sections: [
          { s: 0, w: 0.018, f: 0.018, b: 0.018 },
          { s: 0.04, w: 0.014, f: 0.014, b: 0.014 },
        ],
        step: 0.02,
        segments: 8,
        colour: () => g.main,
        weights: () => rides(`hand_${s}`),
      });
    }
  }
}
