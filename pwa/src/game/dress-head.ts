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
// The gloves are `dress-gloves.ts`'.

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
  dirInBone,
  inBone,
  len,
  mul,
  norm,
  rides,
  smoothstep,
  sub,
  type Loom,
  type V3,
} from "./dress-loft.ts";
import { cutFace } from "./dress-face.ts";
import { gearOf, helmetOf, type Outfit } from "./outfit.ts";

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
  const h = helmetOf(o);
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
  // His face is cut on its own (`dress-face.ts`), in place of the
  // helmet's plain egg and wedge of a nose.
  cutFace(loom, skin, body.female);
  for (const part of helmetParts()) {
    if (part.material === "skin") continue;
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
    // THE PEAK: a short brim standing out over the goggles — a full-face's
    // twice as long (`Outfit.bike`).
    const reach = o.bike ? 2.1 : 1;
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
        { s: 0.05, w: 0.004, f: 0.03 * reach, b: 0.002 },
        { s: 0.17, w: 0.004, f: 0.034 * reach, b: 0.002 },
        { s: 0.29, w: 0.004, f: 0.03 * reach, b: 0.002 },
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

  if (o.helmet === "slalom" || o.bike) {
    // THE CHIN GUARD: a bar from ear cover to ear cover round the chin — on
    // a downhill rider's full-face the shell itself carried down round his
    // jaw, deep and standing well out ahead of his mouth.
    const k = o.bike ? 1 : 0;
    const path = [
      H(-0.106 - 0.006 * k, -0.062 - 0.01 * k, 0.0),
      H(-0.082 - 0.006 * k, -0.098 - 0.012 * k, 0.082 + 0.012 * k),
      H(0, -0.118 - 0.016 * k, 0.13 + 0.03 * k),
      H(0.082 + 0.006 * k, -0.098 - 0.012 * k, 0.082 + 0.012 * k),
      H(0.106 + 0.006 * k, -0.062 - 0.01 * k, 0.0),
    ];
    const deep = 1 + 0.9 * k;
    const toward = (p: V3) => norm(sub(p, H(0, -0.03, 0.02)));
    loom.tube({
      path,
      face: path.map(toward),
      round: 0.05,
      sections: [
        { s: 0, w: 0.014 * deep, f: 0.012, b: 0.012 },
        { s: 0.1, w: 0.019 * deep, f: 0.016, b: 0.012 },
        { s: 0.24, w: 0.02 * deep, f: 0.018, b: 0.012 },
        { s: 0.38, w: 0.019 * deep, f: 0.016, b: 0.012 },
        { s: 0.48 + 0.04 * k, w: 0.014 * deep, f: 0.012, b: 0.012 },
      ],
      step: 0.03,
      segments: 8,
      colour: () => (o.bike ? h.shell : h.trim),
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
