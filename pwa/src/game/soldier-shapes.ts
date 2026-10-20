// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SOLDIERS, BUILT — the army's winter infantry PROCEDURALLY, on the
// crowd's bench (`crowd-shapes.ts`' `Figure`, `tree-mesh.ts`): chunky,
// faceted, low-poly, one geometry a FIGURE (`SoldierKind`: on skis, on
// foot, the door gunner, the anti-armour man) at three cuts (`CrowdLod`),
// each carrying its poses (`soldier-pose.ts`) as MORPH TARGETS, so one
// draw call holds every soldier of that figure at that cut doing whatever
// he is doing — and, for a pose no target holds (a gunner on his gun at
// any aim), the same mesh posed outright (`poseSoldierFigure`).
//
// WHAT READS FROM FORTY METRES is a white figure with a helmet, a pack and
// a black rifle: so the smock and the trousers are white with the snow
// camouflage's sparse grey-green and grey blotches laid on per triangle
// (`camoAt`, read at the rest pose, so a blotch stays on its cloth through
// every pose), the helmet under a white cover, the webbing an off-white,
// the pack a rounded patrol rucksack under a white cover, the goggles
// dark over a white balaclava — and the weapons black and olive, the only
// dark things on him besides his boots. `docs/army.md` says why each.
//
// THE FRAME is the crowd's: x to his right, y up, z the way he faces, the
// snow under him at 0 (the gunner's: his seat's frame, `seatFrame`).

import * as THREE from "three";

import { cross, type Posed, type V3 } from "./crowd-rig.ts";
import {
  bodyFrames,
  cutOf,
  Figure,
  frameOf,
  ring,
  type CrowdLod,
  type Frame,
} from "./crowd-shapes.ts";
import { box } from "./civilian-shapes.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { camoAt, KIT_COLOURS, LAUNCHER, RIFLE, type Smock } from "./soldier-kit.ts";
import {
  PACK,
  SOLDIER_CARRIES,
  SOLDIER_LOOK,
  SOLDIER_POSES,
  soldierTargets,
  type Carried,
  type SoldierKind,
  type SoldierPose,
  type SoldierPoseName,
} from "./soldier-pose.ts";

const C = Object.fromEntries(
  Object.entries(KIT_COLOURS).map(([k, hex]) => [k, new THREE.Color(hex)]),
) as Record<keyof typeof KIT_COLOURS, THREE.Color>;
/** A cloth face's shade: lit and a shade under, the facets apart. */
const FULL = new THREE.Color(1, 1, 1);
const SHADE = new THREE.Color(0.88, 0.88, 0.88);

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));

/** The builder's memory of which vertices are CLOTH (the camouflage is
 * laid on them after): runs of vertex indices, [from, to). */
type Cloth = [number, number][];

/** Emit `draw` as cloth: its vertices remembered for the camouflage. */
function cloth(fig: Figure, runs: Cloth, draw: () => void): void {
  const from = fig.s.count;
  draw();
  runs.push([from, fig.s.count]);
}

// ── the skis, the boots ──────────────────────────────────────────────────

/** A ski's frame: forward, its right, and the normal up off its top. */
function skiFrame(sk: Posed["skiL"]): { f: V3; r: V3; n: V3 } {
  const f = norm(sub(sk.tip, sk.tail));
  const r = norm(sub(sk.side, sk.mid));
  return { f, r, n: norm(cross(f, r)) };
}

/** A TOURING SKI: a white plank, its tip turned up high and long, its
 * edges a shade under, a dark cable binding at its middle. */
function emitSki(fig: Figure, sk: Posed["skiL"], lod: CrowdLod): void {
  const { f, r, n } = skiFrame(sk);
  const half = mul(r, Math.hypot(...sub(sk.side, sk.mid)));
  const lift = mul(n, 0.018);
  const tl = add(sub(sk.tail, half), lift);
  const tr = add(add(sk.tail, half), lift);
  const pl = add(sub(sk.tip, half), lift);
  const pr = add(add(sk.tip, half), lift);
  fig.s.quad(tl, tr, pr, pl, C.skis, n);
  // The shovel: turned up a hand's height over a hand and a half.
  const curl = add(mul(f, 0.14), mul(n, 0.09));
  const narrow = mul(half, -0.25);
  fig.s.quad(
    pl,
    pr,
    add(add(pr, curl), narrow),
    sub(add(pl, curl), narrow),
    C.skis,
    norm(sub(n, f)),
  );
  if (lod === "far") return;
  const down = mul(n, -0.028);
  fig.s.quad(add(tl, down), tl, pl, add(pl, down), C.edge, mul(r, -1));
  fig.s.quad(tr, add(tr, down), add(pr, down), pr, C.edge, r);
  // The binding: a plate under the boot and the cable's heel throw.
  const at = (along: number, up: number): V3 => add(add(sk.mid, mul(f, along)), mul(n, up));
  box(fig, at(-0.2, 0.03), at(0.2, 0.03), r, n, 0.075, 0.025, C.binding);
}

/** THE BOOTS: a heavy leather boot each, the shaft up from the sole to the
 * trousers' hem, the sole's block heel to toe — on the ski, or set flat on
 * the floor when he stands. */
function emitBoots(fig: Figure, P: Posed, lod: CrowdLod, onSkis: boolean, hips: Frame): void {
  for (const [ankle, knee, sk] of [
    [P.ankleL, P.kneeL, P.skiL],
    [P.ankleR, P.kneeR, P.skiR],
  ] as const) {
    let { f, r, n } = skiFrame(sk);
    let sole = add(sk.mid, mul(n, onSkis ? 0.045 : 0.012));
    const shin = norm(sub(knee, ankle));
    if (!onSkis) {
      // A foot set down stands level whatever the shin leans; a kneeling
      // man's back foot keeps its toes to the shin.
      const down = Math.max(0, Math.min(1, (0.4 - ankle[1]) / 0.1));
      const flat = down * Math.max(0, Math.min(1, (shin[1] - 0.45) / 0.2));
      if (flat > 0) {
        const level = norm([f[0], 0, f[2]]);
        f = norm(mix(f, level, flat));
        n = norm(mix(n, [0, 1, 0], flat));
        r = norm(cross(n, f));
        sole = mix(sole, [ankle[0] + level[0] * 0.03, 0.012, ankle[2] + level[2] * 0.03], flat);
      }
    }
    const at = (along: number, up: number): V3 => add(add(sole, mul(f, along)), mul(n, up));
    if (lod === "far") {
      fig.limb(ankle, at(0.05, 0.04), hips.r, 0.062, 0.07, 3, C.boot);
      continue;
    }
    box(fig, at(-0.12, 0.045), at(0.2, 0.045), r, n, 0.11, 0.09, C.boot);
    fig.limb(at(-0.02, 0.08), add(ankle, mul(shin, 0.06)), r, 0.066, 0.07, cutOf(lod).limb, C.boot);
  }
}

// ── the body ─────────────────────────────────────────────────────────────

/** THE TROUSERS: over-white trousers, cut loose over the uniform. */
function emitLegs(fig: Figure, P: Posed, lod: CrowdLod, hips: Frame, runs: Cloth): void {
  const S = cutOf(lod).limb;
  cloth(fig, runs, () => {
    for (const [hip, knee, ankle] of [
      [P.hipL, P.kneeL, P.ankleL],
      [P.hipR, P.kneeR, P.ankleR],
    ] as const) {
      fig.limb(hip, knee, hips.r, 0.1, 0.078, S, FULL);
      fig.limb(knee, add(ankle, mul(norm(sub(knee, ankle)), 0.05)), hips.r, 0.078, 0.07, S, SHADE);
    }
  });
}

/** THE SMOCK: a hip-length white smock, roomy at the chest, its hood
 * rolled at the collar. */
function emitSmock(
  fig: Figure,
  P: Posed,
  lod: CrowdLod,
  hips: Frame,
  chest: Frame,
  runs: Cloth,
): void {
  const L = SOLDIER_LOOK;
  const seat = sub(P.pelvis, mul(hips.u, 0.1));
  const hem = sub(P.pelvis, mul(hips.u, 0.02));
  const belly = mix(P.pelvis, P.waist, 0.8);
  const ribs = mix(P.waist, P.neck, 0.55);
  const shoulders = mix(P.shoulderL, P.shoulderR, 0.5);
  const collar = add(P.neck, mul(chest.u, 0.03));
  const S = cutOf(lod).torso;
  const keyed: [V3, Frame, number, number][] =
    lod === "far"
      ? [
          [seat, hips, L.hip + 0.03, L.girth],
          [belly, hips, L.hip + 0.06, L.girth + 0.01],
          [shoulders, chest, L.shoulder + 0.05, L.girth * 0.9],
          [collar, chest, 0.08, 0.075],
        ]
      : [
          [seat, hips, L.hip + 0.03, L.girth],
          [hem, hips, L.hip + 0.05, L.girth + 0.015],
          [belly, hips, L.hip + 0.06, L.girth + 0.02],
          [ribs, chest, L.shoulder + 0.02, L.girth + 0.03],
          [shoulders, chest, L.shoulder + 0.05, L.girth * 0.92],
          [collar, chest, 0.085, 0.08],
        ];
  cloth(fig, runs, () =>
    fig.loft(
      keyed.map(([c, fr, rx, rz]) => ring(c, fr, rx, rz, S)),
      keyed.map(([c]) => c),
      (band) => [0, band % 2 ? FULL : SHADE],
      add(P.neck, mul(chest.u, 0.06)),
    ),
  );
  if (lod === "far") return;
  // The hood rolled behind the neck.
  const nape = sub(add(P.neck, mul(chest.u, 0.02)), mul(chest.f, 0.07));
  cloth(fig, runs, () =>
    fig.limb(
      sub(nape, mul(chest.r, 0.09)),
      add(nape, mul(chest.r, 0.09)),
      chest.u,
      0.045,
      0.045,
      4,
      SHADE,
      true,
    ),
  );
}

/** THE CHEST RIG: a belt of webbing and three magazine pouches across the
 * chest, with the pack's two shoulder straps over it. */
function emitRig(fig: Figure, P: Posed, lod: CrowdLod, hips: Frame, chest: Frame): void {
  const L = SOLDIER_LOOK;
  if (lod === "far") {
    const c = add(mix(P.waist, P.neck, 0.35), mul(chest.f, L.girth + 0.03));
    box(
      fig,
      sub(c, mul(chest.u, 0.08)),
      add(c, mul(chest.u, 0.06)),
      chest.r,
      chest.f,
      0.28,
      0.06,
      C.pouch,
    );
    return;
  }
  // The belt, low at the smock's waist.
  const belt = mix(P.pelvis, P.waist, 0.45);
  const S = cutOf(lod).torso;
  fig.loft(
    [
      ring(sub(belt, mul(hips.u, 0.025)), hips, L.hip + 0.065, L.girth + 0.025, S),
      ring(add(belt, mul(hips.u, 0.025)), hips, L.hip + 0.065, L.girth + 0.025, S),
    ],
    [belt, belt],
    () => [0, C.webbing],
    null,
  );
  for (const x of [-0.1, 0, 0.1]) {
    const c = add(add(mix(P.waist, P.neck, 0.35), mul(chest.f, L.girth + 0.035)), mul(chest.r, x));
    box(
      fig,
      sub(c, mul(chest.u, 0.08)),
      add(c, mul(chest.u, 0.06)),
      chest.r,
      chest.f,
      0.085,
      0.055,
      C.pouch,
    );
  }
  // The straps: up over each shoulder from the pouches to the pack.
  for (const s of [-1, 1]) {
    const front = add(
      add(mix(P.waist, P.neck, 0.62), mul(chest.f, L.girth + 0.02)),
      mul(chest.r, 0.12 * s),
    );
    const top = add(add(P.neck, mul(chest.u, 0.05)), mul(chest.r, 0.13 * s));
    const back = add(
      sub(mix(P.waist, P.neck, 0.7), mul(chest.f, L.girth + 0.03)),
      mul(chest.r, 0.12 * s),
    );
    box(fig, front, top, chest.r, chest.f, 0.05, 0.02, C.webbing);
    box(fig, top, back, chest.r, chest.u, 0.05, 0.02, C.webbing);
  }
}

/** THE PACK: a large-volume patrol rucksack under a white snow cover, as
 * ski troops carry one — a soft, rounded body (no box: a loaded fabric
 * bag bulges and its corners round off) on a frame that holds it close
 * to the back from the small of it to the shoulders, a domed lid over its
 * top, and a compression strap round each side. Its profile, bottom to top
 * (`PROFILE`: the share of `PACK.height` up, the half-width and the depth
 * as shares of `PACK.width` and `PACK.depth`), lofted as rings that stand
 * off the back by their own depth — so the bag's face lies on the smock
 * and only its belly stands out. */
const PROFILE: readonly (readonly [number, number, number])[] = [
  [0, 0.25, 0.3],
  [0.04, 0.42, 0.62],
  [0.14, 0.48, 0.86],
  [0.42, 0.5, 1],
  [0.72, 0.48, 0.92],
  [0.88, 0.44, 0.78],
];
/** The lid over the top: from `PROFILE`'s last ring, a little proud of it
 * all round, domed to its crown. */
const LID: readonly (readonly [number, number, number])[] = [
  [0.86, 0.47, 0.84],
  [0.93, 0.47, 0.82],
  [0.99, 0.38, 0.62],
];

/** How far the bag's face is pressed into the smock's line, m: the frame
 * pulls it onto the back, so no daylight shows between them. */
const HUG = 0.025;

function emitPack(fig: Figure, P: Posed, lod: CrowdLod, chest: Frame): void {
  const L = SOLDIER_LOOK;
  const sides = lod === "far" ? 5 : lod === "mid" ? 7 : 9;
  // Its foot on the small of the back, its top level with the shoulders.
  const foot = sub(mix(P.waist, P.neck, 0.5), mul(chest.u, PACK.height / 2 + PACK.drop));
  const at = (k: number, d: number): V3 =>
    sub(
      add(foot, mul(chest.u, k * PACK.height)),
      mul(chest.f, L.girth - HUG + d * PACK.depth * 0.5),
    );
  const lay = (rows: readonly (readonly [number, number, number])[]) => {
    const centres = rows.map(([k, , d]) => at(k, d));
    const rings = rows.map(([, w, d], i) =>
      ring(centres[i], chest, w * PACK.width, d * PACK.depth * 0.5, sides),
    );
    return { centres, rings };
  };
  const body = lay(PROFILE);
  fig.loft(body.rings, body.centres, () => [0, C.cover], at(0.9, 0.5));
  if (lod === "far") return;
  const lid = lay(LID);
  fig.loft(lid.rings, lid.centres, () => [0, C.whiteShade], at(1.01, 0.4));
  // The compression straps: round each side of the bag, low and high.
  for (const k of [0.3, 0.62]) {
    for (const s of [-1, 1]) {
      const c = add(at(k, 0.95), mul(chest.r, s * PACK.width * 0.5));
      box(
        fig,
        sub(c, mul(chest.f, PACK.depth * 0.32)),
        add(c, mul(chest.f, PACK.depth * 0.32)),
        chest.r,
        chest.u,
        0.012,
        0.03,
        C.webbing,
      );
    }
  }
}

/** THE ARMS: the smock's sleeves and the white mittens. */
function emitArms(fig: Figure, P: Posed, lod: CrowdLod, chest: Frame, runs: Cloth): void {
  const S = cutOf(lod).limb;
  for (const [shoulder, elbow, hand] of [
    [P.shoulderL, P.elbowL, P.handL],
    [P.shoulderR, P.elbowR, P.handR],
  ] as const) {
    cloth(fig, runs, () => {
      if (lod === "far") {
        fig.limb(shoulder, hand, chest.r, 0.062, 0.05, 3, FULL);
      } else {
        fig.limb(shoulder, elbow, chest.r, 0.074, 0.062, S, FULL);
        fig.limb(elbow, hand, chest.r, 0.062, 0.054, S, SHADE);
      }
    });
    if (lod === "far") continue;
    const into = norm(sub(hand, elbow));
    fig.limb(
      sub(hand, mul(into, 0.03)),
      add(hand, mul(into, 0.06)),
      chest.r,
      0.05,
      0.045,
      4,
      C.mitten,
      true,
    );
  }
}

/** THE HEAD: the balaclava, the goggles over the eyes, and the helmet in
 * its white cover. */
function emitHead(fig: Figure, P: Posed, lod: CrowdLod, chest: Frame): void {
  const r = SOLDIER_LOOK.head;
  const head = frameOf(chest.r, sub(P.head, P.neck));
  const at = (u: number, f = 0): V3 => add(add(P.head, mul(head.u, u * r)), mul(head.f, f * r));
  const HS = cutOf(lod).head;
  fig.loft(
    [
      ring(at(-1.0), head, r * 0.6, r * 0.65, HS),
      ring(at(-0.2), head, r * 0.92, r, HS),
      ring(at(0.35), head, r * 0.95, r, HS),
    ],
    [at(-1.0), at(-0.2), at(0.35)],
    () => [0, C.balaclava],
    null,
  );
  // The helmet: a brim a little out from the head, its dome over it.
  fig.loft(
    [
      ring(at(0.02, -0.08), head, r * 1.2, r * 1.26, HS),
      ring(at(0.5, -0.08), head, r * 1.12, r * 1.18, HS),
      ring(at(0.95, -0.1), head, r * 0.72, r * 0.78, HS),
    ],
    [at(0.02, -0.08), at(0.5, -0.08), at(0.95, -0.1)],
    (band) => [0, band === 0 ? C.whiteShade : C.cover],
    at(1.18, -0.12),
  );
  if (!cutOf(lod).small) return;
  // The goggles: a dark lens on a frame across the brow.
  const gw = 0.7;
  const gh = 0.24;
  const gc = at(-0.1, 1.04);
  const corner = (x: number, y: number): V3 => add(add(gc, mul(head.r, x * r)), mul(head.u, y * r));
  fig.s.quad(corner(-gw, -gh), corner(gw, -gh), corner(gw, gh), corner(-gw, gh), C.lens, head.f);
  // The strap round the helmet's side.
  for (const s of [-1, 1]) {
    fig.s.quad(
      corner(gw * s, -gh * 0.5),
      add(at(-0.05, 0), mul(head.r, 1.2 * r * s)),
      add(at(0.12, 0), mul(head.r, 1.2 * r * s)),
      corner(gw * s, gh * 0.5),
      C.metal,
      mul(head.r, s),
    );
  }
}

// ── the weapons ──────────────────────────────────────────────────────────

/** A long thing's frame: along it, its up, and its side. */
function along(c: Carried): {
  a: V3;
  u: V3;
  s: V3;
  at: (t: number, up?: number, side?: number) => V3;
} {
  const a = norm(sub(c.front, c.rear));
  const u = norm(sub(c.up, mul(a, dot(c.up, a))));
  const s = cross(a, u);
  return {
    a,
    u,
    s,
    at: (t, up = 0, side = 0) => add(add(add(c.rear, mul(a, t)), mul(u, up)), mul(s, side)),
  };
}

/** THE RIFLE: a black 5.56 mm-class carbine — the stock, the receiver and
 * its optic, the curved magazine, the pistol grip, the handguard and the
 * barrel. */
function emitRifle(fig: Figure, c: Carried, lod: CrowdLod): void {
  const { a, u, s, at } = along(c);
  const R = RIFLE;
  const t1 = R.stock;
  const t2 = t1 + R.receiver;
  const t3 = t2 + R.handguard;
  if (lod === "far") {
    box(fig, at(0, -0.02), at(t3), s, u, R.width, R.depth, C.metal);
    box(
      fig,
      at(R.magazine, -0.03),
      at(R.magazine + 0.04, -R.magazineDrop),
      s,
      a,
      0.025,
      0.06,
      C.metal,
    );
    return;
  }
  box(fig, at(0, -0.025), at(t1, -0.005), s, u, R.width, 0.1, C.polymer);
  box(fig, at(t1), at(t2), s, u, R.width + 0.005, 0.075, C.metal);
  box(fig, at(t2), at(t3), s, u, R.width + 0.012, 0.055, C.polymer);
  fig.limb(at(t3), at(R.length), s, 0.009, 0.008, 4, C.metal);
  box(
    fig,
    at(R.magazine - 0.01, -0.03),
    at(R.magazine + 0.05, -R.magazineDrop),
    s,
    a,
    0.026,
    0.065,
    C.metal,
  );
  box(
    fig,
    at(R.grip - 0.01, -0.03),
    at(R.grip - 0.035, -R.gripDrop - 0.01),
    s,
    a,
    0.03,
    0.035,
    C.polymer,
  );
  if (cutOf(lod).small)
    box(fig, at(t1 + 0.06, 0.06), at(t1 + 0.17, 0.06), s, u, 0.03, 0.045, C.metal);
}

/** THE LAUNCHER: an olive tube with its ends capped darker, its sight
 * folded up on the left and its grip underneath. */
function emitLauncher(fig: Figure, c: Carried, lod: CrowdLod): void {
  const { u, s, at } = along(c);
  const L = LAUNCHER;
  const r = L.diameter / 2;
  const sides = lod === "near" ? 8 : lod === "mid" ? 6 : 4;
  fig.limb(at(0.06), at(L.length - 0.06), s, r, r, sides, C.tube);
  fig.limb(at(0), at(0.06), s, r * 1.12, r * 1.12, sides, C.binding);
  fig.limb(at(L.length - 0.06), at(L.length), s, r * 1.12, r * 1.12, sides, C.binding);
  if (lod === "far") return;
  box(fig, at(L.grip, -r), at(L.grip - 0.02, -L.gripDrop - r * 0.4), s, u, 0.03, 0.04, C.polymer);
  box(
    fig,
    at(L.sight, r * 0.7, -r * 0.9),
    at(L.sight, r * 1.9, -r * 0.9),
    s,
    s,
    0.04,
    0.012,
    C.binding,
  );
}

/** A POLE: a grey shaft and its basket. */
function emitPole(fig: Figure, top: V3, tip: V3, lod: CrowdLod, ref: V3): void {
  fig.limb(top, tip, ref, 0.012, 0.009, 3, C.pole);
  if (lod === "far") return;
  const a = norm(sub(tip, top));
  const basket = sub(tip, mul(a, 0.08));
  const fr = frameOf(ref, a);
  fig.loft(
    [ring(basket, fr, 0.05, 0.05, 4), ring(add(basket, mul(a, 0.01)), fr, 0.05, 0.05, 4)],
    [basket, basket],
    () => [0, C.binding],
    null,
  );
}

// ── the figure ───────────────────────────────────────────────────────────

/** Build one pose of a figure at a cut — the same calls in the same order
 * for every pose — recording which vertices are cloth. */
function emit(fig: Figure, kind: SoldierKind, pose: SoldierPose, lod: CrowdLod, runs: Cloth): void {
  const P = pose.posed;
  const carries = SOLDIER_CARRIES[kind];
  const { hips, chest } = bodyFrames(P);
  if (carries.skis) {
    emitSki(fig, P.skiL, lod);
    emitSki(fig, P.skiR, lod);
  }
  emitBoots(fig, P, lod, carries.skis, hips);
  emitLegs(fig, P, lod, hips, runs);
  emitSmock(fig, P, lod, hips, chest, runs);
  emitRig(fig, P, lod, hips, chest);
  emitPack(fig, P, lod, chest);
  emitArms(fig, P, lod, chest, runs);
  emitHead(fig, P, lod, chest);
  if (carries.rifle && pose.rifle) emitRifle(fig, pose.rifle, lod);
  if (carries.tube && pose.tube) emitLauncher(fig, pose.tube, lod);
  if (carries.skis && pose.poles)
    for (const [top, tip] of pose.poles) emitPole(fig, top, tip, lod, chest.r);
}

/** Lay the camouflage on the cloth's triangles, each by where its middle
 * is at the rest pose; `whites` keeps them white. */
function paint(g: THREE.BufferGeometry, runs: Cloth, smock: Smock): void {
  const pos = g.getAttribute("position").array as Float32Array;
  const col = g.getAttribute("color").array as Float32Array;
  const white = C.white;
  const tints = [white, C.blotch, C.blotchDark];
  for (const [from, to] of runs) {
    for (let v = from; v + 2 < to; v += 3) {
      const cx = (pos[3 * v] + pos[3 * v + 3] + pos[3 * v + 6]) / 3;
      const cy = (pos[3 * v + 1] + pos[3 * v + 4] + pos[3 * v + 7]) / 3;
      const cz = (pos[3 * v + 2] + pos[3 * v + 5] + pos[3 * v + 8]) / 3;
      const tint = smock === "camo" ? tints[camoAt(cx, cy, cz)] : white;
      for (let k = 0; k < 3; k++) {
        const i = 3 * (v + k);
        col[i] *= tint.r;
        col[i + 1] *= tint.g;
        col[i + 2] *= tint.b;
      }
    }
  }
}

const built = new Map<string, THREE.BufferGeometry>();

/** ONE FIGURE AT ONE CUT in its smock, its rest pose the base and every
 * other pose of `SOLDIER_POSES[kind]` a relative morph target (positions
 * and normals), in that order. Built once a session and shared. */
export function buildSoldierFigure(
  kind: SoldierKind,
  lod: CrowdLod,
  smock: Smock = "camo",
): THREE.BufferGeometry {
  const key = `${kind}:${lod}:${smock}`;
  const cached = built.get(key);
  if (cached) return cached;
  let runs: Cloth = [];
  const shapes = soldierTargets(kind).map((pose, i) => {
    const fig = new Figure();
    const r: Cloth = [];
    emit(fig, kind, pose, lod, r);
    if (i === 0) runs = r;
    return fig.s.geometry();
  });
  const base = shapes[0];
  paint(base, runs, smock);
  const bp = base.getAttribute("position").array as Float32Array;
  const bn = base.getAttribute("normal").array as Float32Array;
  const delta = (g: THREE.BufferGeometry, name: "position" | "normal", from: Float32Array) => {
    const a = g.getAttribute(name).array as Float32Array;
    if (a.length !== from.length) throw new Error(`soldier ${key}: a pose changed the mesh`);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] - from[i];
    return new THREE.Float32BufferAttribute(out, 3);
  };
  base.morphAttributes.position = shapes.slice(1).map((g) => delta(g, "position", bp));
  base.morphAttributes.normal = shapes.slice(1).map((g) => delta(g, "normal", bn));
  base.morphTargetsRelative = true;
  for (const g of shapes.slice(1)) g.dispose();
  // Every pose's reach, so a soldier is never culled out of his own lean.
  base.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.4);
  built.set(key, base);
  return base;
}

/** ONE FIGURE AT ONE CUT IN ANY POSE — the same mesh as
 * `buildSoldierFigure`, triangle for triangle, its positions and normals
 * written into `into`'s (a clone of that geometry, its morph weights left
 * at zero): a gunner on his gun at an aim no target holds. */
export function poseSoldierFigure(
  kind: SoldierKind,
  lod: CrowdLod,
  pose: SoldierPose,
  into: THREE.BufferGeometry,
): void {
  const fig = new Figure();
  emit(fig, kind, pose, lod, []);
  const g = fig.s.geometry();
  for (const name of ["position", "normal"] as const) {
    const to = into.getAttribute(name) as THREE.BufferAttribute;
    const from = g.getAttribute(name).array as Float32Array;
    if (from.length !== to.array.length)
      throw new Error(`soldier ${kind}:${lod}: a pose changed the mesh`);
    (to.array as Float32Array).set(from);
    to.needsUpdate = true;
  }
  g.dispose();
}

/** How many triangles a figure's cut is. */
export function soldierTriangles(kind: SoldierKind, lod: CrowdLod): number {
  return buildSoldierFigure(kind, lod).getAttribute("position").count / 3;
}

/** THE SOLDIERS' MATERIAL: Lambert, vertex-coloured, in the haze — one
 * program for every figure. */
export function soldierMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return hazeMaterial(material, haze, "soldiers");
}

/** A SOLDIER TO STAND SOMEWHERE: a mesh of a figure at a cut, in a named
 * pose (`pose`, a morph weight of 1 on its target), or posed outright
 * (`posed`, on a geometry of its own). */
export class SoldierView {
  readonly mesh: THREE.Mesh;
  private own: THREE.BufferGeometry | null = null;
  constructor(
    readonly kind: SoldierKind,
    readonly lod: CrowdLod,
    material: THREE.Material,
    smock: Smock = "camo",
  ) {
    this.mesh = new THREE.Mesh(buildSoldierFigure(kind, lod, smock), material);
    this.mesh.castShadow = true;
    this.mesh.updateMorphTargets();
  }
  /** Into a named pose, `share` of the way from his rest (blended with
   * `from` at 1 − share when given). */
  pose<K extends SoldierKind>(
    name: SoldierPoseName<K>,
    share = 1,
    from?: SoldierPoseName<K>,
  ): void {
    const names = SOLDIER_POSES[this.kind] as readonly string[];
    const w = this.mesh.morphTargetInfluences;
    if (!w) return;
    w.fill(0);
    const set = (n: string, k: number) => {
      const i = names.indexOf(n);
      if (i > 0) w[i - 1] += k;
    };
    set(name, share);
    if (from) set(from, 1 - share);
  }
  /** Posed outright: a gunner at his gun's aim (`gunnerPosed`), say. */
  posed(pose: SoldierPose): void {
    if (!this.own) {
      this.own = (this.mesh.geometry as THREE.BufferGeometry).clone();
      this.own.morphAttributes = {};
      this.mesh.geometry = this.own;
      this.mesh.updateMorphTargets();
    }
    poseSoldierFigure(this.kind, this.lod, pose, this.own);
  }
  dispose(): void {
    this.own?.dispose();
  }
}
