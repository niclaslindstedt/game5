// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS, BUILT — every bird PROCEDURALLY, on the trees' bench
// (`tree-mesh.ts`): chunky, faceted and low-poly, one geometry a species
// FORM (the cock, the hen, a first-winter bird — `wild-traits.ts`) at two
// cuts (`BirdLod`: NEAR, and FAR at a third of the triangles, cut from the
// same builder so the hand-over keeps the silhouette). The proportions are
// the roster's row (`bird-defs.ts`) — a swan is long-necked because the
// roster says so — and the paint and the outline are `BIRD_STYLES` here.
//
// SEEN FROM BELOW is the design constraint. A chase camera on the snow looks
// UP at a bird against a winter sky, so what reads is the UNDERSIDE and the
// SILHOUETTE: every wing is two surfaces, a mantle on top and a belly colour
// beneath, and the neck, the TAIL (a raven's wedge, a blackcock's lyre, an
// owl's round fan) and the WING (a grouse's short round paddle, an eagle's
// long plank with its primaries splayed into fingers) are what stay legible
// when the bird is four pixels. Each face is ONE flat colour, the facets
// lit half by their own normal and half by the body's mass (`Shape.facet`):
// a gradient across a wing reads as grey mush at range.
//
// THE BODY IS LOFTED FROM KEYED RINGS, never equal ones (which make a
// cigar): a flat back over a keeled breast, full at the breast and tapering
// to the vent; the head a small faceted knob on a neck as long as the row
// says, the bill a measure of the head, not of the body.
//
// THE WINGS MOVE IN THE VERTEX SHADER. A rigid bird is a paper dart and a
// group of meshes per bird is three draw calls a bird; so the wing carries
// its own hinges: every wing vertex is MARKED a wing (`aWing`), the wrist is
// a column of vertices to fold at, and per instance the shader is told the
// FLAP (the shoulder's angle off level) and the FOLD (0 open, 1 closed along
// the flank). Both are read off `birdPose`; the graft rides in beside the
// haze's (`hazeMaterial`), so a bird fades into the same air as the wood
// behind it. One draw call a species form and cut.

import * as THREE from "three";

import type { BirdId, BirdSpec } from "./bird-defs.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { Shape, type V3 } from "./tree-mesh.ts";
import type { BirdForm } from "./wild-traits.ts";

/** Every colour one form of a bird has. */
export type BirdPaint = {
  /** The mantle: the back and the top of the wing. */
  readonly back: number;
  /** The underside: the belly and the underwing. */
  readonly belly: number;
  /** The wingtip — the outer hand, both faces. */
  readonly tip: number;
  readonly head: number;
  readonly bill: number;
  /** The tail's top, and its underside, when not the mantle's and belly's. */
  readonly tail?: number;
  readonly tailUnder?: number;
  /** The base of the tail, both faces — a young eagle's white. */
  readonly tailBase?: number;
  /** The top of the head (a woodpecker's red cap), or only its nape. */
  readonly crown?: number;
  readonly nape?: number;
  /** The face — an owl's pale disc. */
  readonly face?: number;
  /** The trailing half of the arm, on top — a blackcock's white bar, a
   * bunting's white secondaries. */
  readonly bar?: number;
  /** The underwing at the wrist — a young eagle's white patch. */
  readonly patch?: number;
};

/** The tail's outline, from below: a raven's diamond, a blackcock's lyre. */
export type TailForm = "square" | "wedge" | "fork" | "lyre" | "round" | "fan";

/** How a species is PAINTED and outlined, a form at a time. */
export type BirdStyle = BirdPaint & {
  /** The hen's paint over the cock's, and a first-winter bird's. */
  readonly female?: Partial<BirdPaint>;
  readonly young?: Partial<BirdPaint>;
  readonly tailForm?: TailForm;
  /** The head's size over a bird's of that length — an owl's is huge. */
  readonly headSize?: number;
  /** How many fingers the primaries splay into on a soarer, near to. */
  readonly fingers?: number;
};

export const BIRD_STYLES: Readonly<Record<BirdId, BirdStyle>> = {
  // Black all over, the heavy bill and the wedge tail: from below a cross
  // with a diamond on the end of it.
  raven: {
    back: 0x16181b,
    belly: 0x1c1f23,
    tip: 0x0e1012,
    head: 0x16181b,
    bill: 0x121314,
    tailForm: "wedge",
    fingers: 3,
  },
  // White for the winter, all of it — except the tail, whose outer feathers
  // stay black, and which is the one thing a flushed covey shows.
  ptarmigan: {
    back: 0xf3f4f2,
    belly: 0xf7f8f6,
    tip: 0xeceeea,
    head: 0xf3f4f2,
    bill: 0x202020,
    tail: 0x17181a,
    tailUnder: 0x17181a,
    tailForm: "round",
  },
  // The blackcock: glossy blue-black, the white wing bar and the lyre tail's
  // white undertail; the greyhen barred brown with a forked tail.
  blackgrouse: {
    back: 0x1a1d24,
    belly: 0x15171c,
    tip: 0x2a2c30,
    head: 0x1c2028,
    bill: 0x202020,
    tail: 0x15171c,
    tailUnder: 0xe8e8ea,
    bar: 0xe4e6e8,
    tailForm: "lyre",
    female: {
      back: 0x7a5e44,
      belly: 0x9c8466,
      tip: 0x5a4632,
      head: 0x7a5e44,
      tail: 0x6a5038,
      tailUnder: 0x8c7458,
      bar: 0xd8d4c8,
    },
  },
  // The cock: slate-black, a brown wing, a pale bill and a great round fan;
  // the hen a third smaller, rufous-barred with an orange breast.
  capercaillie: {
    back: 0x2d3034,
    belly: 0x1d1f22,
    tip: 0x5a4632,
    head: 0x24272b,
    bill: 0xd9d2b8,
    tail: 0x1a1b1d,
    tailForm: "fan",
    female: {
      back: 0x8a6a48,
      belly: 0xb88a58,
      tip: 0x6a5038,
      head: 0x8a6a48,
      bill: 0x5a5048,
      tail: 0x7a5a3c,
      tailUnder: 0x9c7e5a,
    },
  },
  // Glossy black, the yellow bill a skier sees on the ridge.
  chough: {
    back: 0x121417,
    belly: 0x1a1d21,
    tip: 0x0c0e10,
    head: 0x121417,
    bill: 0xe8c23a,
    tailForm: "square",
  },
  // Chocolate brown flecked white, black wings, the white undertail.
  nutcracker: {
    back: 0x4a3a30,
    belly: 0x6a5648,
    tip: 0x1c1a18,
    head: 0x3e302a,
    bill: 0x2a2826,
    tail: 0x1c1a18,
    tailUnder: 0xe6e2da,
    tailForm: "square",
  },
  // Soft grey, a pale face and a dark nape.
  jay: {
    back: 0x6f7378,
    belly: 0xc9ccce,
    tip: 0x4a4d52,
    head: 0xe6e8ea,
    bill: 0x2a2826,
    nape: 0x2a2c30,
    tailForm: "round",
  },
  // The cock's brick red with the dark wings of a finch; the hen olive.
  crossbill: {
    back: 0xb8453a,
    belly: 0xc65d4c,
    tip: 0x3a302c,
    head: 0xb8453a,
    bill: 0x3a3530,
    tail: 0x3a302c,
    tailForm: "fork",
    female: { back: 0x7c8a4a, belly: 0x9aa462, head: 0x7c8a4a },
  },
  // White below and across the wing, black at the tips and on the back; the
  // hen browner above.
  bunting: {
    back: 0x3a3632,
    belly: 0xf4f4f2,
    tip: 0x121314,
    head: 0xeeeae2,
    bill: 0x2a2826,
    bar: 0xf4f4f2,
    tailForm: "fork",
    female: { back: 0x6a5a48, head: 0xc8b89c, bar: 0xd8d0c0 },
  },
  // Black all over, the pale bill — the cock's whole crown red, the hen's
  // only the back of her head.
  woodpecker: {
    back: 0x131416,
    belly: 0x17181a,
    tip: 0x0e0f10,
    head: 0x131416,
    bill: 0xcfc6a8,
    crown: 0xc0282a,
    tailForm: "wedge",
    female: { crown: 0x131416, nape: 0xc0282a },
  },
  // Grey, barred, the great pale disc of a face and the yellow eyes.
  owl: {
    back: 0x8a8680,
    belly: 0xb4b0a8,
    tip: 0x5e5a54,
    head: 0xa8a49c,
    bill: 0xd8c24a,
    face: 0xd8d4cc,
    tailForm: "round",
    headSize: 1.7,
  },
  // Dark brown, darker below, the gold nape that names it, the primaries
  // splayed into fingers; a first-winter bird shows white at the base of
  // the tail and a white patch under each wing.
  eagle: {
    back: 0x4b3627,
    belly: 0x3e2e22,
    tip: 0x241c16,
    head: 0xa8854a,
    bill: 0x3a3a38,
    tail: 0x3a2d22,
    tailForm: "square",
    fingers: 4,
    young: { tailBase: 0xece8e0, patch: 0xece8e0, head: 0x8a6a40 },
  },
  // The one bird lighter than the sky, with the yellow on its bill; a
  // cygnet stays grey-brown through its first winter.
  swan: {
    back: 0xf1f3f2,
    belly: 0xf1f3f2,
    tip: 0xe4e7e6,
    head: 0xf1f3f2,
    bill: 0xe8c93a,
    tailForm: "round",
    young: {
      back: 0xa49c92,
      belly: 0xb8b0a6,
      tip: 0x948c82,
      head: 0x9a9288,
      bill: 0xc8a8a0,
    },
  },
  // Grey-brown, paler beneath, the orange band on a dark bill.
  goose: {
    back: 0x5e564a,
    belly: 0x9d9486,
    tip: 0x3a3530,
    head: 0x4a4238,
    bill: 0xe0912f,
    tailUnder: 0xe8e4dc,
    tailForm: "round",
  },
};

/** The two cuts every form is built at. */
export type BirdLod = "near" | "far";

/** One form's paint: the cock's, with the form's own over it. */
export function birdPaint(style: BirdStyle, form: BirdForm): BirdPaint {
  const over = form === "female" ? style.female : form === "young" ? style.young : undefined;
  return { ...style, ...over };
}

/** How far back the ARM sweeps at the shoulder and the HAND at the wrist
 * when a wing is fully folded, rad. */
const ARM_FOLD = 1.2;
const HAND_FOLD = 0.95;

/** The gap between a wing's two faces, m — enough that they never fight for
 * the same pixels; the tail's sheets closer still, or they read as two. */
const WING_SKIN = 0.006;
const TAIL_SKIN = 0.0015;

/** Where along the half-span the wing's vertex columns stand, as shares, at
 * each cut; the wrist is added between them, so the fold has a column to
 * hinge on. */
const STATIONS: Record<BirdLod, readonly number[]> = {
  near: [0.03, 0.3, 0.8, 1],
  far: [0.03, 1],
};

/** Where the wingtip's colour begins, as a share of the half-span. */
const TIP_FROM = 0.78;

/** How far the wing's crest — its thickest line, a third back from the
 * leading edge — stands over the trailing edge, in chords: the camber that
 * makes a near wing a pair of planes rather than a sheet. */
const CAMBER = 0.07;

const colour = (hex: number): THREE.Color => new THREE.Color(hex);

/** The wing's plan: the leading and trailing edge z at a share `s` of the
 * half-span, off the row's chord, taper and sweep. */
function wingEdges(spec: BirdSpec, s: number): { lead: number; trail: number } {
  const half = spec.span / 2;
  const c0 = spec.span * spec.wing.chord;
  const chord = c0 * (1 - (1 - spec.wing.taper) * s);
  const lead = c0 * 0.45 - spec.wing.sweep * half * Math.pow(s, 1.5);
  return { lead, trail: lead - chord };
}

/** One wing on `side` (+1 right, −1 left): a cambered top over a flat
 * underside, column by column out to the tip, the soarer's hand split into
 * fingers. Every vertex marked a wing. */
function wing(
  s: Shape,
  spec: BirdSpec,
  style: BirdStyle,
  p: BirdPaint,
  lod: BirdLod,
  side: number,
): void {
  s.mark("aWing", 1);
  const half = spec.span / 2;
  const wrist = spec.wing.wrist;
  const cols = [...new Set([...STATIONS[lod], wrist])].sort((a, b) => a - b);
  const fingers = lod === "near" ? (style.fingers ?? 0) : 0;
  const handEnd = fingers > 0 ? 0.8 : 1;
  const up: V3 = [0, 1, 0];
  const down: V3 = [0, -1, 0];
  const at = (u: number, z: number, y: number): V3 => [side * u * half, y, z];
  for (let i = 0; i + 1 < cols.length; i++) {
    const s0 = cols[i];
    const s1 = cols[i + 1];
    if (s0 >= handEnd - 1e-6) break;
    const e0 = wingEdges(spec, s0);
    const e1 = wingEdges(spec, s1);
    const tipSpan = s1 > TIP_FROM + 1e-6;
    const top = colour(tipSpan ? p.tip : p.back);
    const under = colour(
      tipSpan ? p.tip : p.patch !== undefined && s0 >= wrist - 1e-6 ? p.patch : p.belly,
    );
    const y = WING_SKIN / 2;
    const end = s1 >= 1 - 1e-6;
    // The underside, one plane a span (a triangle at the very tip).
    if (end) s.tri(at(s0, e0.lead, -y), at(s0, e0.trail, -y), at(s1, e1.lead, -y), under, down);
    else
      s.quad(
        at(s0, e0.lead, -y),
        at(s0, e0.trail, -y),
        at(s1, e1.trail, -y),
        at(s1, e1.lead, -y),
        under,
        down,
      );
    if (lod === "far" || end) {
      if (end) s.tri(at(s0, e0.lead, y), at(s1, e1.lead, y), at(s0, e0.trail, y), top, up);
      else
        s.quad(
          at(s0, e0.lead, y),
          at(s1, e1.lead, y),
          at(s1, e1.trail, y),
          at(s0, e0.trail, y),
          top,
          up,
        );
      continue;
    }
    // The top in two planes, the leading third up to the crest and the rest
    // falling to the trailing edge; the arm's trailing plane takes the bar.
    const crest = (e: { lead: number; trail: number }, u: number): V3 => {
      const c = e.lead - e.trail;
      return at(u, e.lead - c * 0.32, y + c * CAMBER);
    };
    const c0 = crest(e0, s0);
    const c1 = crest(e1, s1);
    const back = colour(
      !tipSpan && s1 <= wrist + 1e-6 && p.bar !== undefined ? p.bar : tipSpan ? p.tip : p.back,
    );
    s.quad(at(s0, e0.lead, y), at(s1, e1.lead, y), c1, c0, top, up);
    s.quad(c0, c1, at(s1, e1.trail, y), at(s0, e0.trail, y), back, up);
  }
  if (fingers === 0) return;
  // THE FINGERS: the hand's end split into blades fanned out past it, the
  // outer ones swept back, each a little over half its share of the chord
  // wide — narrower sticks read as stalks, a single tip as a dart.
  const e = wingEdges(spec, handEnd);
  const chord = e.lead - e.trail;
  const width = (chord / fingers) * 0.62;
  const reach = (1 - handEnd) * half * 1.15;
  const tip = colour(p.tip);
  for (let k = 0; k < fingers; k++) {
    const share = (k + 0.5) / fingers;
    const rootZ = e.lead - chord * share;
    const sweep = (share - 0.35) * reach * 0.9;
    const x0 = handEnd * half;
    const x1 = x0 + reach * (1 - share * 0.35);
    for (const y of [WING_SKIN / 2, -WING_SKIN / 2]) {
      const a: V3 = [side * x0, y, rootZ + width / 2];
      const b: V3 = [side * x0, y, rootZ - width / 2];
      const c: V3 = [side * x1, y + (y > 0 ? 0.002 : -0.002), rootZ - sweep - width * 0.3];
      const d: V3 = [side * x1, y, rootZ - sweep + width * 0.2];
      s.quad(a, d, c, b, tip, y > 0 ? up : down);
    }
  }
}

/** The tail's outline from below, root to tip, as (x, z) pairs: the fan
 * the shapes take, about the root's centre. */
function tailOutline(
  form: TailForm,
  rw: number,
  tw: number,
  root: number,
  tip: number,
): [number, number][] {
  const len = tip - root;
  const at = (x: number, u: number): [number, number] => [x, root + len * u];
  switch (form) {
    case "wedge":
      return [at(rw, 0), at(tw * 0.85, 0.88), at(0, 1.06), at(-tw * 0.85, 0.88), at(-rw, 0)];
    case "fork":
      return [at(rw, 0), at(tw, 1), at(0, 0.82), at(-tw, 1), at(-rw, 0)];
    case "lyre":
      return [
        at(rw, 0),
        at(tw * 1.6, 0.94),
        at(tw * 0.5, 0.8),
        at(0, 0.86),
        at(-tw * 0.5, 0.8),
        at(-tw * 1.6, 0.94),
        at(-rw, 0),
      ];
    case "round":
      return [at(rw, 0), at(tw * 0.95, 0.9), at(0, 1), at(-tw * 0.95, 0.9), at(-rw, 0)];
    case "fan":
      return [
        at(rw, 0),
        at(tw * 1.5, 0.82),
        at(tw * 0.8, 1),
        at(-tw * 0.8, 1),
        at(-tw * 1.5, 0.82),
        at(-rw, 0),
      ];
    default:
      return [at(rw, 0), at(tw, 1), at(-tw, 1), at(-rw, 0)];
  }
}

/** The tail: a two-sheeted fan out of the rump, its base band in its own
 * colour where the form has one. */
function tail(
  s: Shape,
  spec: BirdSpec,
  style: BirdStyle,
  p: BirdPaint,
  lod: BirdLod,
  r: number,
): void {
  s.mark("aWing", 0);
  const L = spec.length;
  const back = (1 - spec.neck) * L;
  const root = -back * 0.5;
  const outline = tailOutline(style.tailForm ?? "square", r * 0.45, spec.span * 0.07, root, -back);
  const base = lod === "near" && p.tailBase !== undefined ? 0.5 : 0;
  for (const [y, top] of [
    [TAIL_SKIN / 2, true],
    [-TAIL_SKIN / 2, false],
  ] as const) {
    const n: V3 = [0, top ? 1 : -1, 0];
    const tip = colour(top ? (p.tail ?? p.back) : (p.tailUnder ?? p.tail ?? p.belly));
    const band = colour(p.tailBase ?? 0);
    const centre: V3 = [0, y, root];
    const mid = (o: [number, number]): V3 => [o[0] * base, y, root + (o[1] - root) * base];
    for (let k = 0; k + 1 < outline.length; k++) {
      const o0: V3 = [outline[k][0], y, outline[k][1]];
      const o1: V3 = [outline[k + 1][0], y, outline[k + 1][1]];
      if (base > 0) {
        const m0 = mid(outline[k]);
        const m1 = mid(outline[k + 1]);
        s.tri(centre, m0, m1, band, n);
        s.quad(m0, o0, o1, m1, tip, n);
      } else {
        s.tri(centre, o0, o1, tip, n);
      }
    }
  }
}

/** The body, the neck, the head and the bill: a loft of keyed rings from
 * the vent to the head, capped behind and closed to the bill point ahead. */
function body(s: Shape, spec: BirdSpec, style: BirdStyle, p: BirdPaint, lod: BirdLod): number {
  s.mark("aWing", 0);
  const L = spec.length;
  const neckZ = spec.neck * L;
  const back = (1 - spec.neck) * L;
  const r = L * 0.12;
  const near = lod === "near";
  // A pentagon with its flat side up and a point down is a flat back over a
  // keel; the far cut a diamond.
  const sides = near ? 5 : 4;
  const turn = -Math.PI / 2;
  const ring = (z: number, rx: number, ry: number, dy: number, keel = 1.15): V3[] =>
    Array.from({ length: sides }, (_, k) => {
      const a = turn + (k / sides) * Math.PI * 2;
      const sn = Math.sin(a);
      return [Math.cos(a) * rx, dy + sn * ry * (sn > 0 ? 0.82 : keel), z] as V3;
    });
  const headR = r * 0.62 * (style.headSize ?? 1);
  const billLen = Math.min(headR * 1.35, neckZ * 0.5);
  const headZ = neckZ - billLen - headR * 0.55;
  const headY = r * 0.32;
  // The head's rings (near: the back of the skull, the crown, the face) are
  // placed off the bill; the trunk's keyed stations (the vent, the belly,
  // the breast, the neck's root) behind them, the breast drawn back under a
  // big head and the neck's root left out where there is no neck to root.
  type Station = { z: number; rx: number; ry: number; dy: number; keel: number };
  const head: Station[] = [
    { z: headZ - headR * 0.6, rx: headR * 0.8, ry: headR * 0.8, dy: headY, keel: 1 },
    ...(near ? [{ z: headZ, rx: headR, ry: headR * 0.95, dy: headY, keel: 1 }] : []),
    {
      z: headZ + headR * 0.55,
      rx: headR * 0.6,
      ry: headR * 0.62,
      dy: headY - headR * 0.08,
      keel: 1,
    },
  ];
  const breastZ = Math.min(0.05 * L, head[0].z - r * 0.35);
  const neckRootZ = Math.min(0.2 * L, head[0].z - headR * 0.4);
  const trunk: Station[] = [
    { z: -back * 0.56, rx: r * 0.34, ry: r * 0.32, dy: r * 0.08, keel: 1.15 },
    ...(near
      ? [
          {
            z: Math.min(-back * 0.22, breastZ - r * 0.5),
            rx: r * 0.9,
            ry: r * 0.86,
            dy: 0,
            keel: 1.15,
          },
        ]
      : []),
    { z: breastZ, rx: r, ry: r, dy: -r * 0.06, keel: 1.15 },
    ...(neckRootZ > breastZ + r * 0.3
      ? [{ z: neckRootZ, rx: r * 0.55, ry: r * 0.55, dy: r * 0.24, keel: 1 }]
      : []),
  ];
  const stations = [...trunk, ...head];
  const rings = stations.map((st) => ring(st.z, st.rx, st.ry, st.dy, st.keel));
  const centres = stations.map((st) => [0, st.dy, st.z] as V3);
  const backC = colour(p.back);
  const bellyC = colour(p.belly);
  const headC = colour(p.head);
  const crownC = colour(p.crown ?? p.head);
  const napeC = colour(p.nape ?? p.crown ?? p.head);
  // Span k joins ring k to ring k + 1: the trunk's spans back over belly,
  // then the neck in the head's colour, then the head — its top the
  // crown's, the back of the skull's top the nape's.
  const neck = trunk.length - 1;
  s.loft(rings, centres, (k, side) => {
    const a = turn + ((side + 0.5) / sides) * Math.PI * 2;
    const topFace = Math.sin(a) > 0.2;
    if (k < neck) return topFace ? backC : bellyC;
    if (k === neck) return headC;
    if (!topFace) return headC;
    return k === neck + 1 ? napeC : crownC;
  });
  // The vent, closed to a point behind; the face, closed round the bill.
  s.cap(rings[0], [0, r * 0.1, -back * 0.62], colour(p.tailUnder ?? p.belly), [0, 0, -1]);
  const face = rings[rings.length - 1];
  const faceC = colour(p.face ?? p.head);
  const front = centres[centres.length - 1];
  if (near) {
    // The face, then the bill: a pyramid out of it to the row's point.
    const billBase = face.map(
      (v) =>
        [
          front[0] + (v[0] - front[0]) * 0.45,
          front[1] + (v[1] - front[1]) * 0.45,
          v[2] + headR * 0.08,
        ] as V3,
    );
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      s.quad(face[k], face[k1], billBase[k1], billBase[k], faceC, [
        face[k][0] - front[0],
        face[k][1] - front[1],
        0.6,
      ]);
    }
    s.cap(billBase, [0, headY - headR * 0.15, neckZ], colour(p.bill), [0, 0, 1]);
  } else {
    s.cap(face, [0, headY - headR * 0.15, neckZ], colour(p.bill), [0, 0, 1]);
  }
  return r;
}

/**
 * One bird of a species FORM at a cut, in metres, shoulders at the origin,
 * bill toward +z: the body, the tail, and both wings LEVEL — the shader
 * flaps and folds them per instance. Carries `aWing` (1 on a wing vertex)
 * for the graft to read.
 */
export function buildBird(
  spec: BirdSpec,
  style: BirdStyle,
  form: BirdForm = "male",
  lod: BirdLod = "near",
): THREE.BufferGeometry {
  const p = birdPaint(style, form);
  const s = new Shape(0, { marks: { aWing: 1 }, stems: false, wind: true });
  s.facet = 0.6;
  const r = body(s, spec, style, p, lod);
  tail(s, spec, style, p, lod, r);
  s.facet = 0.45;
  wing(s, spec, style, p, lod, 1);
  wing(s, spec, style, p, lod, -1);
  return s.geometry();
}

/**
 * The species' material: Lambert, vertex-coloured (and tinted per instance —
 * the individual's shade), in the haze, with the wing hinges grafted into
 * its vertex shader. The species' own wrist is a UNIFORM, so every species'
 * material grafts the same source and three links ONE program for the whole
 * roster rather than one per species.
 */
export function birdMaterial(spec: BirdSpec, haze: HazeUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    // The tail and the wings are sheets, and a folded wing turns its faces
    // every way; a face that is never culled is a face that is never a hole.
    side: THREE.DoubleSide,
  });
  const num = (v: number): string => v.toFixed(4);
  const wrist = (spec.span / 2) * spec.wing.wrist;
  return hazeMaterial(material, haze, "bird", (shader) => {
    shader.uniforms.uWrist = { value: wrist };
    shader.vertexShader = `uniform float uWrist;
attribute float aWing;
attribute float aFlap;
attribute float aFold;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aWing > 0.5) {
\t\tfloat side = position.x < 0.0 ? -1.0 : 1.0;
\t\tfloat x = abs(position.x);
\t\tfloat y = position.y;
\t\tfloat z = position.z;
\t\tfloat hand = x - uWrist;
\t\tif (hand > 0.0) {
\t\t\tfloat a = aFold * ${num(HAND_FOLD)};
\t\t\tfloat c = cos(a);
\t\t\tfloat s = sin(a);
\t\t\tx = uWrist + hand * c + z * s;
\t\t\tz = -hand * s + z * c;
\t\t}
\t\tfloat b = aFold * ${num(ARM_FOLD)};
\t\tfloat cb = cos(b);
\t\tfloat sb = sin(b);
\t\tfloat ax = x * cb + z * sb;
\t\tfloat az = -x * sb + z * cb;
\t\tfloat cf = cos(aFlap);
\t\tfloat sf = sin(aFlap);
\t\ttransformed = vec3(side * (ax * cf - y * sf), ax * sf + y * cf, az);
\t}`,
    );
  });
}
