// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS, BUILT — every quadruped PROCEDURALLY, on the trees' bench
// (`tree-mesh.ts`): chunky, faceted and low-poly, one geometry a species
// FORM (grown or young — `wild-traits.ts`) at two cuts (`BeastLod`: NEAR,
// and FAR at a third of the triangles, cut from the same builder so the
// hand-over keeps the silhouette), sized off the roster's row
// (`beast-defs.ts`) and shaped and painted off `BEAST_STYLES` here.
//
// SEEN ACROSS THE SNOW at chase range is the design constraint: what reads
// is the SILHOUETTE against white — the hare's long ears and its tucked
// shape, the fox's brush, the reindeer's antlers and pale neck, the moose's
// hump and long face over its pale legs and its palms, the elk's dark neck
// and crown of tines, the lynx's tufts and stub tail, the squirrel's tail up
// over its back, the white rump of a roe or a sika, the wolf's long legs and
// straight-carried tail, the ibex's great swept horns and the chamois's
// little hooks — and the colour, which on a winter hill is mostly dark
// against light (and, on the white animals, the black tips of the ears). Each
// face is ONE flat colour; a coat graded across a flank reads as mud.
//
// THE BODY IS LOFTED FROM KEYED RINGS: the withers standing over the loins,
// the flank tucked up under them, the rump rounding down to the tail — rings
// of one size make a sausage. The legs are jointed (a straight fore cannon, a
// hind hock set back) and a hoofed animal stands on dark hooves.
//
// THE LEGS AND THE HEAD MOVE IN THE VERTEX SHADER, the birds' wings' trick:
// every vertex is MARKED with the part it is (`aPart`: x which leg — 0, or
// 1 + its phase in the gait — y where that leg's hip is, z 1 on the neck and
// head); per instance the shader is told the GAIT (where in its cycle the
// animal is), the STRIDE (how hard it is going) and the GRAZE (how far the
// head is down), all read off `beastPose`. THE ANTLERS AND HORNS GROW IN IT
// TOO: every vertex of a rack is marked with the root it grows from and the
// AGE its tine comes at (`aAntler`: xyz the root, w the rung of `TINE_AT`,
// −1 on everything else), and per instance the RACK (0..1, the
// individual's) scales the whole rack about its roots and folds away every
// tine it is too young for — a cow, a spiker and an old bull from one mesh.
// The four per-instance numbers ride one attribute (`aMotion`: gait,
// stride, graze, rack), because the instance's matrix and colour already
// take five of the sixteen a vertex may carry. One draw call a species form
// and cut, whatever the herd is doing.

import * as THREE from "three";

import type { BeastId, BeastSpec, Gait } from "./beast-defs.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { Shape, type V3 } from "./tree-mesh.ts";
import { TINE_AT, type BeastForm } from "./wild-traits.ts";

/** A rack's shape: a wapiti's or a sika's BRANCHED beam of forward tines, a
 * roe's short three points, a reindeer's long sweep with the brow shovel, a
 * moose's PALMS — or horns: the chamois's HOOKS, the ibex's SCIMITARS. */
export type RackForm = "branched" | "roe" | "reindeer" | "palmate" | "hooks" | "scimitar";

/** How a species is shaped past its length and height, and painted. */
export type BeastStyle = {
  readonly coat: number;
  readonly belly: number;
  readonly legs: number;
  readonly head: number;
  /** The ears' tips, the tail, and the neck when it is not the coat's (a
   * reindeer's pale one, a wapiti's dark mane). */
  readonly ears: number;
  readonly tail: number;
  readonly neckColor?: number;
  /** A rump patch (a roe's white, a wapiti's buff), a band down the flank (a
   * wolverine's pale stripe), the nose, and the hooves. */
  readonly rump?: number;
  readonly band?: number;
  readonly nose?: number;
  readonly hoof?: number;
  /** THE RACK: its shape, its colour, and its height over the shoulder's at
   * a full-grown old male's (a share of the height). */
  readonly rack?: { readonly form: RackForm; readonly color: number; readonly size: number };
  /** The tail's thickness as a share of the body's half-depth (a squirrel's
   * and a fox's brush are thick), and the colour of its last fifth — the
   * fox's white tip, the wolf's black one. */
  readonly tailThick?: number;
  readonly tailTip?: number;
  /** The body's width as a share of the height, how thick a leg is as a
   * share of the height, how long the neck is as a share of the length and
   * how high it carries the head (0 level, 1 straight up), the head's own
   * length as a share of the length, the ears' length as a share of the
   * height, and the tail's length as a share of the length and its droop
   * (0 straight out behind, 1 straight down, negative up over the back). */
  readonly width: number;
  readonly leg: number;
  readonly neck: number;
  readonly carriage: number;
  readonly headLength: number;
  readonly ear: number;
  readonly tailLength: number;
  readonly droop: number;
  /** How far down the body hangs between the legs, as a share of the
   * height: a hare is nearly all body, a moose is legs. */
  readonly depth: number;
  /** A shoulder hump, as a share of the height — the moose's. */
  readonly hump?: number;
};

export const BEAST_STYLES: Readonly<Record<BeastId, BeastStyle>> = {
  // White, with the black ear tips a winter hare keeps.
  hare: {
    coat: 0xeef1f2,
    belly: 0xf6f7f8,
    legs: 0xe8ebec,
    head: 0xeef1f2,
    ears: 0x1a1a1c,
    tail: 0xf8f9f9,
    width: 0.62,
    leg: 0.17,
    neck: 0.12,
    carriage: 0.55,
    headLength: 0.24,
    ear: 0.62,
    tailLength: 0.08,
    droop: 0.2,
    depth: 0.7,
  },
  // Rust-red, a pale belly, ear tufts, and the tail curled up over its back.
  squirrel: {
    coat: 0x9a4a26,
    belly: 0xefe6d8,
    legs: 0x8a4222,
    head: 0x9a4a26,
    ears: 0x7a3a1e,
    tail: 0xa6532c,
    width: 0.6,
    leg: 0.2,
    neck: 0.1,
    carriage: 0.6,
    headLength: 0.28,
    ear: 0.45,
    tailLength: 0.7,
    droop: -0.75,
    depth: 0.72,
    tailThick: 0.42,
  },
  // Rust on the snow, white bib, black stockings, the white-tipped brush.
  fox: {
    coat: 0xc2622a,
    belly: 0xf0ebe0,
    legs: 0x2a1e18,
    head: 0xc86a30,
    ears: 0x2a1e18,
    tail: 0xb85a26,
    nose: 0x1a1412,
    width: 0.42,
    leg: 0.12,
    neck: 0.16,
    carriage: 0.35,
    headLength: 0.3,
    ear: 0.25,
    tailLength: 0.62,
    droop: 0.25,
    depth: 0.52,
    tailThick: 0.26,
    tailTip: 0xf4f2ee,
  },
  // White on white, the dark nose; a thicker, shorter fox.
  arcticfox: {
    coat: 0xf1f3f4,
    belly: 0xf8f9f9,
    legs: 0xe6e9ea,
    head: 0xf1f3f4,
    ears: 0xe2e6e8,
    tail: 0xeef0f1,
    nose: 0x1a1818,
    width: 0.5,
    leg: 0.13,
    neck: 0.14,
    carriage: 0.35,
    headLength: 0.24,
    ear: 0.16,
    tailLength: 0.5,
    droop: 0.3,
    depth: 0.58,
    tailThick: 0.3,
  },
  // Grey-brown in winter, pale beneath, the white rump that flashes as it
  // goes, and the buck's short three-pointed antlers.
  roedeer: {
    coat: 0x6c5a4a,
    belly: 0xb4a898,
    legs: 0x5e4e40,
    head: 0x6a584a,
    ears: 0x5a4a3c,
    tail: 0xf4f0ea,
    rump: 0xf2eee6,
    nose: 0x1a1614,
    rack: { form: "roe", color: 0x8a7a62, size: 0.34 },
    width: 0.4,
    leg: 0.09,
    neck: 0.32,
    carriage: 0.65,
    headLength: 0.22,
    ear: 0.18,
    tailLength: 0.04,
    droop: 0.6,
    depth: 0.42,
  },
  // Grey-brown with the pale neck and the long swept antlers, the brow
  // shovel over the face — and the cows keep theirs all winter.
  reindeer: {
    coat: 0x6e5f50,
    belly: 0xcfc8b8,
    legs: 0x54483c,
    head: 0x5a4c40,
    ears: 0x5a4c40,
    tail: 0xe0dace,
    neckColor: 0xa89e8c,
    rump: 0xddd6c8,
    nose: 0x2a2420,
    rack: { form: "reindeer", color: 0xb0a084, size: 0.82 },
    width: 0.45,
    leg: 0.1,
    neck: 0.3,
    carriage: 0.55,
    headLength: 0.26,
    ear: 0.12,
    tailLength: 0.08,
    droop: 0.7,
    depth: 0.46,
  },
  // Dark brown in its winter coat, the pale face, the black hooks.
  chamois: {
    coat: 0x3a2e26,
    belly: 0x2e241e,
    legs: 0x2a221c,
    head: 0xd8ccb8,
    ears: 0x3a2e26,
    tail: 0x2a221c,
    nose: 0x1e1814,
    rack: { form: "hooks", color: 0x141210, size: 0.24 },
    width: 0.42,
    leg: 0.1,
    neck: 0.28,
    carriage: 0.6,
    headLength: 0.2,
    ear: 0.14,
    tailLength: 0.06,
    droop: 0.8,
    depth: 0.5,
  },
  // Grey-brown, low and heavy on short legs, and the great ridged horns swept
  // back over the neck — a billy's as long as he is tall.
  ibex: {
    coat: 0x6a5e50,
    belly: 0x8a7e6c,
    legs: 0x4a4038,
    head: 0x625646,
    ears: 0x5a4e40,
    tail: 0x3a322a,
    nose: 0x2a241e,
    rack: { form: "scimitar", color: 0x5e5444, size: 0.9 },
    width: 0.5,
    leg: 0.13,
    neck: 0.24,
    carriage: 0.5,
    headLength: 0.2,
    ear: 0.12,
    tailLength: 0.06,
    droop: 0.5,
    depth: 0.56,
  },
  // Tawny, with the dark mane and legs, the buff rump, and the bull's great
  // crown of tines.
  elk: {
    coat: 0xa0805a,
    belly: 0x3e2e22,
    legs: 0x3e2e22,
    head: 0x5a4230,
    ears: 0x5a4230,
    tail: 0xd8c49c,
    neckColor: 0x4e3828,
    rump: 0xd8c49c,
    nose: 0x1e1612,
    rack: { form: "branched", color: 0x9c8a6e, size: 0.78 },
    width: 0.42,
    leg: 0.085,
    neck: 0.32,
    carriage: 0.6,
    headLength: 0.24,
    ear: 0.14,
    tailLength: 0.05,
    droop: 0.8,
    depth: 0.45,
  },
  // Grizzled grey-tawny, big ears, a narrow muzzle, the bushy tail carried
  // low and black at its tip.
  coyote: {
    coat: 0x9c8a72,
    belly: 0xd8ccb8,
    legs: 0xa8865c,
    head: 0xa48c6c,
    ears: 0x8a6a48,
    tail: 0x8c7a64,
    nose: 0x1a1614,
    width: 0.38,
    leg: 0.1,
    neck: 0.18,
    carriage: 0.35,
    headLength: 0.28,
    ear: 0.22,
    tailLength: 0.42,
    droop: 0.6,
    depth: 0.46,
    tailThick: 0.28,
    tailTip: 0x1e1c1a,
  },
  // Near-black in its winter coat, the white rump, the stag's branched
  // antlers of four points.
  sika: {
    coat: 0x4e4238,
    belly: 0x6a5c50,
    legs: 0x3e342c,
    head: 0x564a40,
    ears: 0x4a3e34,
    tail: 0xf2eee8,
    rump: 0xf2eee8,
    nose: 0x1a1614,
    rack: { form: "branched", color: 0x9c8a6e, size: 0.5 },
    width: 0.42,
    leg: 0.09,
    neck: 0.3,
    carriage: 0.62,
    headLength: 0.22,
    ear: 0.16,
    tailLength: 0.07,
    droop: 0.7,
    depth: 0.44,
    tailThick: 0.5,
  },
  // Near-black, the hump, the long heavy face, the pale grey stockings, and
  // the bull's broad palms.
  moose: {
    coat: 0x2b211b,
    belly: 0x241c17,
    legs: 0xa09584,
    head: 0x33271f,
    ears: 0x2b211b,
    tail: 0x2b211b,
    nose: 0x1a1410,
    rack: { form: "palmate", color: 0xb8aa8c, size: 0.6 },
    width: 0.3,
    leg: 0.09,
    neck: 0.22,
    carriage: 0.45,
    headLength: 0.3,
    ear: 0.12,
    tailLength: 0.04,
    droop: 0.8,
    depth: 0.42,
    hump: 0.12,
  },
  // Grey-buff, pale beneath, black ear tufts and a black-tipped stub.
  lynx: {
    coat: 0xa89478,
    belly: 0xe6ddcc,
    legs: 0x9c8a70,
    head: 0xb09c80,
    ears: 0x1a1818,
    tail: 0x1e1a18,
    nose: 0x3a2a24,
    width: 0.4,
    leg: 0.15,
    neck: 0.14,
    carriage: 0.35,
    headLength: 0.22,
    ear: 0.2,
    tailLength: 0.16,
    droop: 0.55,
    depth: 0.5,
  },
  // Dark brown, low and heavy, with the pale band down its flank.
  wolverine: {
    coat: 0x2e2218,
    belly: 0x241a12,
    legs: 0x221a14,
    head: 0x3a2c22,
    ears: 0x2e2218,
    tail: 0x2e2218,
    band: 0x9c7a4e,
    width: 0.62,
    leg: 0.17,
    neck: 0.12,
    carriage: 0.3,
    headLength: 0.2,
    ear: 0.1,
    tailLength: 0.22,
    droop: 0.4,
    depth: 0.6,
    tailThick: 0.35,
  },
  // Grizzled grey, pale beneath, long in the leg, the tail carried low and
  // black at the tip.
  wolf: {
    coat: 0x80786c,
    belly: 0xd8d0c2,
    legs: 0x9a9284,
    head: 0x8a8274,
    ears: 0x5a5248,
    tail: 0x7a7266,
    nose: 0x1a1816,
    width: 0.38,
    leg: 0.1,
    neck: 0.2,
    carriage: 0.3,
    headLength: 0.26,
    ear: 0.14,
    tailLength: 0.4,
    droop: 0.55,
    depth: 0.45,
    tailThick: 0.25,
    tailTip: 0x1e1c1a,
  },
};

/** The two cuts every form is built at. */
export type BeastLod = "near" | "far";

/** Each leg's place in the gait cycle, as a share of it — left fore, right
 * fore, left hind, right hind. A walk is the four-beat, a trot the
 * diagonal pairs, a bound the pairs of fore and hind. */
export const LEG_PHASE: Readonly<Record<Gait, readonly [number, number, number, number]>> = {
  walk: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  bound: [0, 0.06, 0.5, 0.56],
};

/** How far a leg swings off plumb at a full stride, rad. */
export const LEG_SWING: Readonly<Record<Gait, number>> = { walk: 0.42, trot: 0.55, bound: 0.95 };

/** How far the head goes down at a full graze, rad. */
const GRAZE_ANGLE = 1.05;

/** What a young form changes: rounder (wider and deeper), a shorter neck
 * and muzzle on a bigger head, bigger ears — the build of every calf, kid
 * and cub, drawn at its own small size by the instance. */
const YOUNG = { width: 1.16, depth: 1.08, neck: 0.82, muzzle: 0.75, head: 1.2, ear: 1.15 };

const colour = (hex: number): THREE.Color => new THREE.Color(hex);

/** The spine's facets' share of the coat's colour (`buildBeast`). */
const DORSAL = 0.78;

/** A rack's vertex mark, off everything else. */
const NO_RACK = -1;

/** Mark everything pushed from here on as one part: its leg (0, or 1 + the
 * leg's phase share), its hip, whether it is the head's, and the rack's
 * root and rung. */
function part(
  s: Shape,
  leg: number,
  hip: number,
  head: number,
  rack: V3 | null = null,
  rung = NO_RACK,
): void {
  s.mark("aPart", leg, hip, head);
  if (rack) s.mark("aAntler", rack[0], rack[1], rack[2], rung);
  else s.mark("aAntler", 0, 0, 0, NO_RACK);
}

/** A tapering tube along a list of points (each its radius), one colour a
 * segment — a leg, a tail, an antler's beam. */
function chain(
  s: Shape,
  pts: readonly V3[],
  radii: readonly number[],
  sides: number,
  cols: readonly THREE.Color[],
): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    s.tube(pts[i], pts[i + 1], radii[i], radii[i + 1], sides, cols[Math.min(i, cols.length - 1)]);
  }
}

/** THE RACK on both sides of the crown, `root` the right one: beam first,
 * then each tine marked with the rung of `TINE_AT` it comes at. The far cut
 * keeps the beam alone. */
function rack(
  s: Shape,
  style: BeastStyle,
  spec: BeastSpec,
  root: V3,
  hl: number,
  lod: BeastLod,
): void {
  const r = style.rack;
  if (!r) return;
  const A = r.size * spec.height;
  const c = [colour(r.color)];
  const near = lod === "near";
  const sides = near ? 4 : 3;
  // Thick enough that a part-grown rack, scaled down about its roots, still
  // reads at chase range.
  const w = A * 0.05;
  for (const side of [-1, 1]) {
    const at = (x: number, y: number, z: number): V3 => [
      root[0] * side + side * x * A,
      root[1] + y * A,
      root[2] + z * A,
    ];
    const base: V3 = [root[0] * side, root[1], root[2]];
    const tine = (from: V3, to: V3, rung: number, thick = 0.7): void => {
      if (!near) return;
      part(s, 0, 0, 1, base, TINE_AT[rung]);
      chain(s, [from, to], [w * thick, w * 0.15], 3, c);
    };
    part(s, 0, 0, 1, base, 0);
    switch (r.form) {
      case "branched": {
        // Up and back off the skull, out, and curving forward at the crown;
        // the brow, bez and trez tines forward off the beam, the crown's fork.
        const pts = [
          base,
          at(0.12, 0.3, -0.12),
          at(0.3, 0.62, -0.3),
          at(0.36, 0.9, -0.3),
          at(0.3, 1.05, -0.12),
        ];
        chain(s, pts, [w * 1.3, w * 1.1, w, w * 0.8, w * 0.3], sides, c);
        tine(at(0.06, 0.12, -0.04), at(0.12, 0.3, 0.3), 1);
        tine(at(0.13, 0.33, -0.13), at(0.2, 0.48, 0.18), 2);
        tine(at(0.3, 0.62, -0.3), at(0.34, 0.8, -0.02), 3);
        tine(at(0.36, 0.9, -0.3), at(0.48, 1.08, -0.38), 4, 0.6);
        break;
      }
      case "roe": {
        const pts = [base, at(0.08, 0.55, -0.06), at(0.1, 1, -0.02)];
        chain(s, pts, [w * 1.6, w * 1.2, w * 0.4], sides, c);
        tine(at(0.08, 0.55, -0.06), at(0.1, 0.72, 0.25), 1);
        tine(at(0.09, 0.8, -0.04), at(0.1, 0.92, -0.25), 2);
        break;
      }
      case "reindeer": {
        // The long beam swept back and up, then forward over the face; the
        // brow SHOVEL down over the nose; the bez tine; a fork at the top.
        const pts = [
          base,
          at(0.1, 0.25, -0.28),
          at(0.22, 0.6, -0.42),
          at(0.24, 0.92, -0.25),
          at(0.18, 1.05, 0.05),
        ];
        chain(s, pts, [w * 1.1, w, w * 0.9, w * 0.7, w * 0.35], sides, c);
        if (near) {
          part(s, 0, 0, 1, base, TINE_AT[1]);
          const a = at(0.03, 0.12, -0.05);
          const b = at(0.02, 0.18, 0.28);
          const d = at(0.12, 0.08, 0.32);
          s.tri(a, b, d, c[0], [side, 0, 0]);
          s.tri(a, d, b, c[0], [-side, 0, 0]);
        }
        tine(at(0.12, 0.32, -0.3), at(0.25, 0.42, 0.05), 2);
        tine(at(0.24, 0.92, -0.25), at(0.36, 1.06, -0.32), 3);
        tine(at(0.22, 0.98, -0.12), at(0.34, 1.12, -0.02), 4, 0.6);
        break;
      }
      case "palmate": {
        // A short beam out sideways, then the PALM — a broad plate up and
        // back, tines along its rim — which only a grown bull carries.
        const knee = at(0.4, 0.12, -0.05);
        chain(s, [base, knee], [w * 1.8, w * 1.5], sides, c);
        if (near) {
          part(s, 0, 0, 1, base, TINE_AT[2]);
          const palm = [
            knee,
            at(0.62, 0.48, 0.1),
            at(0.95, 0.62, -0.05),
            at(1.02, 0.36, -0.3),
            at(0.7, 0.18, -0.38),
          ];
          for (let k = 1; k + 1 < palm.length; k++) {
            s.tri(palm[0], palm[k], palm[k + 1], c[0], [0, 1, 0.1]);
            s.tri(palm[0], palm[k + 1], palm[k], c[0], [0, -1, -0.1]);
          }
          tine(palm[1], at(0.66, 0.66, 0.2), 3, 1);
          tine(palm[2], at(1.02, 0.82, 0), 3, 1);
          tine(palm[3], at(1.18, 0.46, -0.3), 4, 1);
        } else {
          chain(s, [knee, at(0.95, 0.5, -0.1)], [w * 1.5, w * 0.6], sides, c);
        }
        break;
      }
      case "hooks": {
        // Straight up off the crown, and crooked back at the tip.
        const pts = [base, at(0.04, 0.7, 0.02), at(0.06, 0.95, -0.12), at(0.05, 0.82, -0.32)];
        chain(s, pts, [w * 2.6, w * 2, w * 1.4, w * 0.4], sides, c);
        break;
      }
      case "scimitar": {
        // A great ridged arc swept up and back over the neck: the ridges are
        // the facets of its rings.
        const pts = [
          base,
          at(0.04, 0.32, -0.14),
          at(0.1, 0.55, -0.42),
          at(0.16, 0.6, -0.72),
          at(0.2, 0.46, -0.96),
        ];
        chain(s, pts, [w * 2.4, w * 2.1, w * 1.7, w * 1.2, w * 0.4], sides, c);
        break;
      }
    }
  }
  void hl;
}

/**
 * One animal of a species FORM at a cut, in metres, standing on y = 0 with
 * its nose toward +z, legs plumb and head up. Carries `aPart` (the leg —
 * 0, or 1 + its phase share — its hip, and the head's flag) and `aAntler`
 * for the graft to read, and the PIVOT the head grazes about (the withers).
 */
export function buildBeast(
  spec: BeastSpec,
  style: BeastStyle,
  form: BeastForm = "adult",
  lod: BeastLod = "near",
): { geometry: THREE.BufferGeometry; pivot: { y: number; z: number } } {
  const s = new Shape(0, { marks: { aPart: 3, aAntler: 4 }, stems: false, wind: true });
  s.facet = 0.5;
  const near = lod === "near";
  const young = form === "young";
  const L = spec.length;
  const H = spec.height;
  const depth = style.depth * H * (young ? YOUNG.depth : 1);
  const bodyY = H - depth / 2;
  const ry = depth / 2;
  const rx = ((style.width * H) / 2) * (young ? YOUNG.width : 1);
  const hump = (style.hump ?? 0) * H;
  const coat = colour(style.coat);
  // COUNTERSHADED, as every coat is: the facets along the spine take the
  // whole sky and would read as a white stripe in the coat's own colour, so
  // they are painted a shade darker.
  const dorsal = colour(style.coat).multiplyScalar(DORSAL);
  const belly = colour(style.belly);
  const legs = colour(style.legs);
  const head = colour(style.head);
  const hoofed = spec.prints.pattern === "pairs";
  const hoof = colour(style.hoof ?? (hoofed ? 0x1c1814 : style.legs));

  // ── The body: keyed rings from the rump to the brisket ─────────────────
  // z share, radius share, rise (m), and how far the lower half is tucked.
  const keyed: readonly [number, number, number, number][] = near
    ? [
        [-0.5, 0.46, -0.06 * ry, 1],
        [-0.38, 0.95, 0, 1],
        [-0.12, 0.86, 0.03 * ry, 0.8],
        [0.12, 0.95, hump * 0.3 + 0.03 * ry, 0.92],
        [0.3, 1, hump + 0.08 * ry, 1],
        [0.46, 0.6, hump * 0.5 - 0.06 * ry, 1],
      ]
    : [
        [-0.5, 0.5, -0.06 * ry, 1],
        [-0.3, 0.95, 0, 0.9],
        [0.28, 1, hump + 0.06 * ry, 1],
        [0.46, 0.6, hump * 0.5, 1],
      ];
  const sides = near ? 6 : 4;
  const turn = -Math.PI / 2;
  part(s, 0, 0, 0);
  const rings: V3[][] = keyed.map(([zs, rs, rise, tuck]) =>
    Array.from({ length: sides }, (_, k) => {
      const a = turn + (k / sides) * Math.PI * 2;
      const sn = Math.sin(a);
      return [
        Math.cos(a) * rx * rs,
        bodyY + rise + sn * ry * rs * (sn < 0 ? tuck : 1),
        zs * L,
      ] as V3;
    }),
  );
  const centres = keyed.map(([zs, , rise]) => [0, bodyY + rise, zs * L] as V3);
  const rump = style.rump !== undefined ? colour(style.rump) : null;
  const band = style.band !== undefined ? colour(style.band) : null;
  s.loft(rings, centres, (k, side) => {
    const sn = Math.sin(turn + ((side + 0.5) / sides) * Math.PI * 2);
    if (rump && k === 0 && sn > -0.6) return rump;
    if (band && k >= 1 && k <= (near ? 2 : 1) && Math.abs(sn) < 0.6) return band;
    if (sn > 0.55) return dorsal;
    return sn > -0.4 ? coat : belly;
  });
  s.cap(rings[0], [0, centres[0][1], -L * 0.53], rump ?? coat, [0, 0, -1]);
  s.cap(rings[rings.length - 1], [0, centres[rings.length - 1][1], L * 0.5], coat, [0, 0, 1]);

  // ── The legs: jointed, hip to snow ─────────────────────────────────────
  const phase = LEG_PHASE[spec.gait];
  const legR = style.leg * H * 0.5;
  const hipY = bodyY;
  const stance: readonly [number, number][] = [
    [-1, 0.36],
    [1, 0.36],
    [-1, -0.38],
    [1, -0.38],
  ];
  stance.forEach(([side, zs], k) => {
    part(s, 1 + phase[k], hipY, 0);
    const x = side * rx * 0.55;
    const z = zs * L;
    const hind = k >= 2;
    const top = hind ? legR * 1.7 : legR * 1.25;
    if (!near) {
      chain(
        s,
        [
          [x, hipY, z],
          [x, 0.02, z],
        ],
        [top, legR * 0.6],
        3,
        [legs],
      );
      return;
    }
    // A hind leg's hock is set back and its cannon runs down to the foot; a
    // fore leg's knee is straight over its hoof.
    const knee: V3 = [x, hipY * (hind ? 0.42 : 0.4), z + (hind ? -0.07 : 0.015) * L];
    const pastern: V3 = [x, H * 0.07, z + (hind ? -0.01 : 0) * L];
    const foot: V3 = [x, 0.01, z + (hind ? 0 : 0.01) * L];
    chain(
      s,
      [[x, hipY + ry * 0.2, z], knee, pastern, foot],
      [top, legR * 0.85, legR * 0.6, legR * 0.7],
      4,
      [coat, legs, hoof],
    );
  });

  // ── The neck and head, about the pivot at the withers ─────────────────
  const pivot = { y: bodyY + ry * 0.4 + hump * 0.5, z: L * 0.4 };
  const neckLen = style.neck * L * (young ? YOUNG.neck : 1);
  const lift = style.carriage;
  const headBase: V3 = [
    0,
    pivot.y + neckLen * lift,
    pivot.z + neckLen * Math.sqrt(Math.max(0, 1 - lift * lift)),
  ];
  part(s, 0, 0, 1);
  const neckC = colour(style.neckColor ?? style.coat);
  chain(
    s,
    [[0, pivot.y - ry * 0.3, pivot.z - L * 0.04], headBase],
    [ry * 0.58, ry * 0.42],
    near ? 5 : 4,
    [neckC],
  );
  const hl = style.headLength * L * (young ? YOUNG.muzzle : 1);
  const hr = ry * 0.52 * (young ? YOUNG.head : 1);
  // The head as a faceted box loft: the skull, the cheek, the muzzle, the
  // nose — squared, because a box of a head is what reads as a deer's at
  // forty metres.
  const hsides = near ? 4 : 3;
  const hturn = near ? Math.PI / 4 : -Math.PI / 2;
  const hring = (z: number, y: number, r: number, squash: number): V3[] =>
    Array.from({ length: hsides }, (_, k) => {
      const a = hturn + (k / hsides) * Math.PI * 2;
      return [Math.cos(a) * r * 0.9, y + Math.sin(a) * r * squash, z] as V3;
    });
  const skull = hring(headBase[2] - hr * 0.3, headBase[1], hr, 1);
  const cheek = hring(headBase[2] + hl * 0.45, headBase[1] - hl * 0.12, hr * 0.82, 0.95);
  const muzzleR = Math.max(hr * 0.45, hl * 0.14);
  const muzzle = hring(headBase[2] + hl, headBase[1] - hl * 0.3, muzzleR, 0.9);
  const hRings = near ? [skull, cheek, muzzle] : [skull, muzzle];
  const hCentres = hRings.map(
    (r) => [0, r.reduce((a, v) => a + v[1], 0) / r.length, r[0][2]] as V3,
  );
  s.loft(hRings, hCentres, () => head);
  s.cap(skull, [0, headBase[1], headBase[2] - hr * 0.7], head, [0, 0, -1]);
  const tip = hCentres[hCentres.length - 1];
  s.cap(muzzle, [0, tip[1], tip[2] + muzzleR * 0.5], colour(style.nose ?? style.head), [0, 0, 1]);

  // The ears, up and back off the crown: a three-sided spike, the tip in
  // the ears' colour.
  const earLen = style.ear * H * (young ? YOUNG.ear : 1);
  const earC = colour(style.ears);
  for (const side of [-1, 1]) {
    const root: V3 = [side * hr * 0.6, headBase[1] + hr * 0.55, headBase[2] - hl * 0.02];
    const end: V3 = [side * hr * 1.05, root[1] + earLen, root[2] - earLen * 0.35];
    const w = Math.max(hr * 0.3, earLen * 0.18);
    if (near) {
      const mid: V3 = [(root[0] + end[0]) / 2, (root[1] + end[1]) / 2, (root[2] + end[2]) / 2];
      s.tube(root, mid, w, w * 0.75, 3, head);
      s.tube(mid, end, w * 0.75, w * 0.08, 3, earC);
    } else {
      s.tube(root, end, w, w * 0.1, 3, earC);
    }
  }

  // The rack, off the crown.
  if (!young)
    rack(s, style, spec, [hr * 0.38, headBase[1] + hr * 0.75, headBase[2] - hl * 0.05], hl, lod);
  else if (
    style.rack &&
    (style.rack.form === "hooks" ||
      style.rack.form === "scimitar" ||
      style.rack.form === "reindeer")
  ) {
    rack(s, style, spec, [hr * 0.38, headBase[1] + hr * 0.75, headBase[2] - hl * 0.05], hl, "far");
  }

  // ── The tail ──────────────────────────────────────────────────────────
  part(s, 0, 0, 0);
  const tl = style.tailLength * L;
  if (tl > 0.01) {
    const root: V3 = [0, bodyY + ry * 0.5, -L * 0.5];
    const d = style.droop;
    const run = Math.sqrt(Math.max(0, 1 - d * d));
    const end: V3 = [0, root[1] - tl * d, root[2] - tl * run];
    const thick = style.tailThick ?? 0.22;
    const tsides = near ? 4 : 3;
    if (style.tailTip !== undefined && near) {
      const mid: V3 = [0, root[1] - tl * d * 0.8, root[2] - tl * run * 0.8];
      const fin: V3 = [0, end[1] - tl * d * 0.15, end[2] - tl * run * 0.15];
      chain(s, [root, mid, fin], [ry * thick * 0.7, ry * thick, ry * 0.05], tsides, [
        colour(style.tail),
        colour(style.tailTip),
      ]);
    } else {
      s.tube(
        root,
        end,
        ry * thick * 0.8,
        ry * (style.tailThick ? thick * 0.7 : 0.1),
        tsides,
        colour(style.tailTip ?? style.tail),
      );
    }
  }

  return { geometry: s.geometry(), pivot };
}

/**
 * The species' material: Lambert, vertex-coloured (and tinted per instance —
 * the individual's shade), in the haze, with the legs' swing, the head's
 * graze and the rack's growth grafted into its vertex shader. The species'
 * own numbers are UNIFORMS (`gaitGraft`), so the whole roster shares one
 * program.
 */
export function beastMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
  haze: HazeUniforms,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return hazeMaterial(material, haze, "beast", gaitGraft(spec, pivot));
}

/** The shadow's material: the same graft over three's depth pass, so the
 * shadow on the snow walks with the legs and wears the rack that cast it. */
export function beastDepthMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });
  const graft = gaitGraft(spec, pivot);
  material.onBeforeCompile = (shader) => graft(shader);
  material.customProgramCacheKey = (): string => "beast-depth";
  return material;
}

/** The rack's growth, the legs' swing and the head's graze, as a
 * vertex-shader graft. The species' numbers go in as uniforms rather than
 * literals: the source is then the same for every species, and three links
 * it once. The rack grows first, in the animal's own frame, so the head
 * carries it down when it grazes. */
function gaitGraft(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): (shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }) => void {
  const gait = {
    uLegSwing: { value: LEG_SWING[spec.gait] },
    uLegLift: { value: spec.height * 0.12 },
    uLegReach: { value: spec.height },
    uHeadPivot: { value: new THREE.Vector2(pivot.y, pivot.z) },
  };
  return (shader) => {
    Object.assign(shader.uniforms, gait);
    shader.vertexShader = `uniform float uLegSwing;
uniform float uLegLift;
uniform float uLegReach;
uniform vec2 uHeadPivot;
attribute vec3 aPart;
attribute vec4 aAntler;
attribute vec4 aMotion;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aAntler.w > -0.5) {
\t\tfloat grown = step(aAntler.w, aMotion.w + 0.0001) * aMotion.w;
\t\ttransformed = aAntler.xyz + (transformed - aAntler.xyz) * grown;
\t}
\tif (aPart.x > 0.5) {
\t\tfloat ph = aMotion.x + (aPart.x - 1.0) * 6.2831853;
\t\tfloat swing = sin(ph) * aMotion.y * uLegSwing;
\t\tfloat dy = transformed.y - aPart.y;
\t\tfloat lift = max(0.0, cos(ph)) * aMotion.y * uLegLift * clamp(-dy / uLegReach, 0.0, 1.0);
\t\ttransformed.y = aPart.y + dy * cos(swing) + lift;
\t\ttransformed.z += dy * sin(swing);
\t}
\tif (aPart.z > 0.5) {
\t\tfloat g = aMotion.z * ${GRAZE_ANGLE.toFixed(4)};
\t\tfloat hy = transformed.y - uHeadPivot.x;
\t\tfloat hz = transformed.z - uHeadPivot.y;
\t\ttransformed.y = uHeadPivot.x + hy * cos(g) - hz * sin(g);
\t\ttransformed.z = uHeadPivot.y + hy * sin(g) + hz * cos(g);
\t}`,
    );
  };
}
