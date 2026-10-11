// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HARNESS-CONTAINER ON THE SKIER (`chute-scene.ts` wears it) — built
// after the sport rigs a skydiver flies, laid out as one is (the research is
// `docs/skydive.md` § *The rig as drawn*):
//
//   - THE CONTAINER: one slim, soft-cornered pack on the upper back, from the
//     yoke behind the neck to the belt line, a little narrower at the top
//     and thickest over the main; its side walls in the rig's colour, its
//     back in the dark cloth, every edge bound in tape. The RESERVE fills its
//     top tray under the RESERVE PIN COVER (a rounded flap, hinged at the
//     top so the spring can throw it open); the MAIN fills the lower one,
//     closed under a tuck-tab PIN COVER down its middle; the PILOT CHUTE's
//     pouch across the BOTTOM OF THE CONTAINER with its handle (a soft ball
//     on a short tab) showing to the right, where the right hand finds it.
//   - THE RISER COVERS: padded flaps out of the container's top corners over
//     each shoulder to the THREE-RING releases just under the collarbones.
//   - THE HARNESS: the MAIN LIFT WEBS down the chest from the rings to the
//     hip junctions, a CHEST STRAP across with its buckle, the LATERALS round
//     the flanks from the container's sides to the webs, the RED CUT-AWAY
//     PAD on the right web at the lower ribs and the RESERVE'S metal D on
//     the left, and a padded LEG STRAP round each thigh.
//
// Everything but the leg straps is laid in his CHEST bone's frame (x across
// to his right, y up the spine from the waist — the neck's base 0.275 m up,
// the shoulders' line 0.215 — z out of his chest; `skier-rig.ts`), sized to
// the dressed body (`dress-body.ts`: the back some 0.15 m behind the spine
// through the jacket), so it turns with the trunk as posed; the leg straps
// are each in its thigh's.

import * as THREE from "three";
import { CHUTE } from "@engine";

import { buildBaseContainer, type BaseColours } from "./base-rig.ts";

import type { BoneFrame } from "./skier-rig.ts";

type V = readonly [number, number, number];

/** WHERE THE PIECES ARE in his chest's frame, m. */
export const GEAR = {
  /** The container's outline seen from behind: its bottom and top, its
   * half widths there, the corner radii, how thick it stands out of the
   * backpad at the bottom and the top, and where the backpad lies (behind
   * the spine — the dressed back) at the chest and at the belt. */
  pack: {
    bottom: -0.165,
    top: 0.262,
    halfBottom: 0.17,
    halfTop: 0.152,
    rBottom: 0.05,
    rTop: 0.085,
    thickBottom: 0.15,
    thickTop: 0.112,
    padChest: -0.15,
    padBelt: -0.134,
    /** The seam between the reserve's tray (over) and the main's. */
    seam: 0.112,
  },
  /** How far his chest's front stands out of the spine at the lift webs,
   * the webs' line across (either side of the middle), where the handles sit
   * up the chest (the lower ribs) and the chest strap (the sternum). */
  front: 0.15,
  webs: 0.115,
  pads: 0.05,
  chestStrap: 0.15,
  /** Where each riser leaves the rig — the top of his shoulder, out of its
   * cover — and the three rings just under the collarbone. */
  riser: { x: 0.12, y: 0.29, z: -0.01 },
  rings: { y: 0.2, z: 0.13 },
  /** The trays' middles on the container's back: where a bag, a pilot chute
   * or the reserve's spring comes off it. */
  mainTray: { y: 0.0, z: -0.29 },
  reserveTray: { y: 0.2, z: -0.27 },
  /** The pilot chute's handle at the bottom of the container, right of
   * the middle: where the pull reaches. */
  pouch: { x: 0.075, y: -0.175, z: -0.24 },
  /** The leg strap down each thigh from the hip, m, and round it (over the
   * trousers). */
  leg: { down: 0.15, radius: 0.104 },
} as const;

export type Gear = {
  /** The container and harness, laid in the chest's frame. */
  body: THREE.Group;
  /** The leg straps, each in its thigh's frame. */
  legs: [THREE.Object3D, THREE.Object3D];
  /** The red cut-away pad and the pilot chute's handle: drawn on the
   * harness, or (`hold`) carried in a hand. */
  pad: THREE.Mesh;
  handle: THREE.Mesh;
  /** The reserve's metal handle on the left lift web (carried off in the
   * left hand as it is pulled), and the reserve's pin cover, hinged at the
   * container's top back edge (thrown open over his shoulders once it is). */
  reserveHandle: THREE.Object3D;
  reserveFlap: THREE.Object3D;
  dispose(): void;
};

const P = GEAR.pack;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The backpad's line: behind the spine where his back is, eased forward
 * from the chest to the belt (the waist is shallower than the chest). */
const padAt = (y: number): number => P.padBelt + (P.padChest - P.padBelt) * smooth(-0.14, 0.06, y);
/** The container's half width at a height (narrower to the top). */
const halfAt = (y: number): number =>
  P.halfBottom + (P.halfTop - P.halfBottom) * smooth(P.bottom, P.top, y);
/** How thick it stands at a height: thickest over the main, thinner over
 * the reserve and eased in at the very top under the yoke. */
const thickAt = (y: number): number =>
  P.thickBottom +
  (P.thickTop - P.thickBottom) * smooth(P.bottom + 0.1, P.top, y) -
  0.03 * smooth(P.top - 0.06, P.top, y);
/** THE BACK'S SURFACE at (x, y): the packed canopy bulging it a little
 * across, and the edges rolling in to the side walls. */
export function backAt(x: number, y: number): number {
  const u = Math.min(1, Math.abs(x) / halfAt(y));
  return padAt(y) - thickAt(y) * (1 - 0.1 * u * u);
}

/** The outline seen from behind as a path: the bottom's softer corners,
 * the top's rounder ones. */
function outline(inset = 0): THREE.Shape {
  const s = new THREE.Shape();
  const b = P.bottom + inset;
  const t = P.top - inset;
  const wb = P.halfBottom - inset;
  const wt = P.halfTop - inset;
  const rb = Math.max(0.005, P.rBottom - inset);
  const rt = Math.max(0.005, P.rTop - inset);
  s.moveTo(-wb + rb, b);
  s.lineTo(wb - rb, b);
  s.quadraticCurveTo(wb, b, wb, b + rb);
  s.lineTo(wt, t - rt);
  s.quadraticCurveTo(wt, t, wt - rt, t);
  s.lineTo(-wt + rt, t);
  s.quadraticCurveTo(-wt, t, -wt, t - rt);
  s.lineTo(-wb, b + rb);
  s.quadraticCurveTo(-wb, b, -wb + rb, b);
  return s;
}

/** A RIBBON of webbing swept along `pts`: `w` wide along `side` (kept
 * square to the run), `t` thick. */
function strap(pts: readonly V[], w: number, t: number, side: V, steps = 18): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const sideV = new THREE.Vector3(...side);
  const pos: number[] = [];
  const idx: number[] = [];
  const tan = new THREE.Vector3();
  const s = new THREE.Vector3();
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tan);
    s.copy(sideV).addScaledVector(tan, -sideV.dot(tan)).normalize();
    n.crossVectors(tan, s).normalize();
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      pos.push(
        p.x + s.x * a * w * 0.5 + n.x * b * t * 0.5,
        p.y + s.y * a * w * 0.5 + n.y * b * t * 0.5,
        p.z + s.z * a * w * 0.5 + n.z * b * t * 0.5,
      );
    if (i === 0) continue;
    const o = (i - 1) * 4;
    for (let k = 0; k < 4; k++) {
      const a0 = o + k;
      const a1 = o + ((k + 1) % 4);
      idx.push(a0, a1, a1 + 4, a0, a1 + 4, a0 + 4);
    }
  }
  const last = steps * 4;
  idx.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A FLAP of cloth laid on the container's back: `shape` (seen from
 * behind) extruded `t` thick with soft edges and wrapped onto the back's
 * surface `lift` m off it. */
function onBack(shape: THREE.Shape, t: number, lift: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: t * 0.4,
    bevelEnabled: true,
    bevelThickness: t * 0.3,
    bevelSize: Math.min(0.006, t * 0.6),
    bevelSegments: 2,
    curveSegments: 8,
  });
  const a = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i);
    const y = a.getY(i);
    // Extruded along +z from the shape's plane: laid outward, behind — a
    // reflection, so x is mirrored too (the shapes are symmetric) and every
    // face keeps its outward winding.
    a.setX(i, -x);
    a.setZ(i, backAt(x, y) - lift - a.getZ(i));
  }
  g.computeVertexNormals();
  return g;
}

/** A rounded rectangle centred on (cx, cy), seen from behind. */
function rounded(cx: number, cy: number, w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** BUILD THE RIG off three materials: the container's cloth, its colour
 * (the side walls, the flaps' trim) and the webbing — or (`base`) A BASE RIG
 * over a wingsuit: one slim tray (`CHUTE.base.container`) under one closing
 * flap, with no reserve, no reserve handle and no cut-away pad, the big
 * pilot chute's pouch across its bottom, soft and in the suit's colours
 * (`base-rig.ts`, painted through `baseColours`). */
export function createGear(
  cloth: THREE.Material,
  trim: THREE.Material,
  web: THREE.Material,
  std: (color: number, roughness: number) => THREE.MeshStandardMaterial,
  base = false,
  baseColours: BaseColours | null = null,
): Gear {
  const body = new THREE.Group();
  body.name = "harness";
  const geos: THREE.BufferGeometry[] = [];
  const own: THREE.Material[] = [];
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, into: THREE.Object3D = body) => {
    geos.push(g);
    const o = new THREE.Mesh(g, m);
    into.add(o);
    return o;
  };
  const mat = (color: number, roughness: number, smoothly = false): THREE.MeshStandardMaterial => {
    const m = std(color, roughness);
    own.push(m);
    if (smoothly) m.flatShading = false;
    return m;
  };

  // A BASE RIG's soft bag in the suit's colours, hung from the yoke with its
  // backpad on his back; the sport container's shell, tape and flaps are not
  // drawn under it.
  const soft = base && baseColours !== null;
  if (soft) {
    const K = CHUTE.base.container;
    const mid = { y: P.top - K.height / 2 + 0.02, z: padAt(0.05) - K.depth / 2 };
    geos.push(...buildBaseContainer(body, baseColours, K, mid));
  }
  const sport = new THREE.Group();
  sport.visible = !soft;
  body.add(sport);

  // THE CONTAINER'S SHELL: the outline extruded with rolled edges, laid
  // from the backpad out to the back's surface; its side walls painted in
  // the rig's colour off their normals, its back the dark cloth.
  const shellGeo = new THREE.ExtrudeGeometry(outline(0.02), {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 10,
  });
  {
    const a = shellGeo.getAttribute("position") as THREE.BufferAttribute;
    shellGeo.computeBoundingBox();
    const bb = shellGeo.boundingBox!;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i);
      const y = a.getY(i);
      const k = (a.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z);
      // The backpad wraps a little round his back at the edges.
      const u = Math.min(1, Math.abs(x) / halfAt(y));
      const pad = padAt(y) + 0.022 * u * u;
      // Laid from the backpad out (a reflection in z, so mirrored in x too:
      // the outline is symmetric and the faces keep their outward winding).
      a.setX(i, -x);
      a.setZ(i, pad + (backAt(x, y) - pad) * k);
    }
    shellGeo.computeVertexNormals();
    const n = shellGeo.getAttribute("normal") as THREE.BufferAttribute;
    const base = new THREE.Color((cloth as THREE.MeshStandardMaterial).color);
    const side = new THREE.Color((trim as THREE.MeshStandardMaterial).color);
    const col = new Float32Array(a.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < a.count; i++) {
      // The side walls (and the bottom's) in the colour; the back and the
      // backpad dark.
      const w = smooth(0.45, 0.7, Math.abs(n.getX(i)));
      c.copy(base).lerp(side, w);
      c.toArray(col, i * 3);
    }
    shellGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const shellMat = mat(0xffffff, 0.82, true);
  shellMat.vertexColors = true;
  mesh(shellGeo, shellMat, sport);

  // THE BINDING TAPE round the back's rim and across at the trays' seam.
  const tape = mat(0x0f1114, 0.7, true);
  const rim = outline(0.03)
    .getSpacedPoints(64)
    .map((p) => new THREE.Vector3(p.x, p.y, backAt(p.x, p.y) + 0.004));
  mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 96, 0.006, 5, true),
    tape,
    sport,
  );
  const seam: THREE.Vector3[] = [];
  const hs = halfAt(P.seam) - 0.03;
  for (let i = 0; i <= 12; i++) {
    const x = -hs + (2 * hs * i) / 12;
    seam.push(new THREE.Vector3(x, P.seam, backAt(x, P.seam) - 0.002));
  }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 24, 0.006, 5, false), tape, sport);

  // THE MAIN'S PIN COVER: a tuck-tab flap down the middle of the main tray,
  // and the BOTTOM FLAP's seam across under it.
  const flapCloth = mat(0x262a31, 0.85, true);
  const pin = new THREE.Shape();
  pin.moveTo(-0.045, P.seam - 0.01);
  pin.lineTo(0.045, P.seam - 0.01);
  pin.lineTo(0.045, -0.02);
  pin.quadraticCurveTo(0.045, -0.06, 0, -0.065);
  pin.quadraticCurveTo(-0.045, -0.06, -0.045, -0.02);
  pin.closePath();
  mesh(onBack(pin, 0.008, 0.003), flapCloth, sport);
  const bottomSeam: THREE.Vector3[] = [];
  const hb = halfAt(-0.1) - 0.035;
  for (let i = 0; i <= 10; i++) {
    const x = -hb + (2 * hb * i) / 10;
    bottomSeam.push(new THREE.Vector3(x, -0.1, backAt(x, -0.1) - 0.001));
  }
  mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bottomSeam), 20, 0.004, 4, false),
    tape,
    sport,
  );

  // THE BOC POUCH across the bottom of the container, its lip in tape.
  mesh(onBack(rounded(0, P.bottom + 0.035, 0.22, 0.05, 0.02), 0.022, 0.0), flapCloth, sport);
  // The handle (a soft ball on its tab), kept apart so a hand can carry it.
  const PO = GEAR.pouch;
  const tabGeo = new THREE.BoxGeometry(0.018, 0.035, 0.006);
  tabGeo.translate(PO.x, PO.y + 0.022, PO.z + 0.01);
  mesh(tabGeo, tape, sport);
  const ballGeo = new THREE.SphereGeometry(0.022, 10, 8);
  geos.push(ballGeo);
  const handle = new THREE.Mesh(ballGeo, mat(0xe8e4d6, 0.7, true));
  handle.position.set(PO.x, PO.y, PO.z);
  // On a BASE rig's bag the handle rides its bigger pouch, lower and further out.
  if (soft) {
    const K = CHUTE.base.container;
    const bottom = P.top + 0.02 - K.height;
    handle.position.set(PO.x, bottom - 0.03, padAt(0.05) - K.depth / 2 - 0.07);
  }
  body.add(handle);

  // THE RESERVE PIN COVER: a rounded tongue down from the top of the
  // container over the reserve tray, in the rig's colour with a light patch
  // (where the jumper's card is read), hung on a hinge at the top back edge
  // so the spring can throw it open.
  const hinge = new THREE.Group();
  const hingeY = P.top - 0.012;
  const hingeZ = backAt(0, hingeY);
  hinge.position.set(0, hingeY, hingeZ);
  body.add(hinge);
  hinge.visible = !base;
  const flapGroup = new THREE.Group();
  flapGroup.position.set(0, -hingeY, -hingeZ);
  hinge.add(flapGroup);
  const tongue = new THREE.Shape();
  const tw = halfAt(0.22) - 0.035;
  tongue.moveTo(-tw, P.top - 0.022);
  tongue.lineTo(tw, P.top - 0.022);
  tongue.lineTo(tw, P.seam + 0.045);
  tongue.quadraticCurveTo(tw, P.seam + 0.012, tw - 0.035, P.seam + 0.012);
  tongue.lineTo(-tw + 0.035, P.seam + 0.012);
  tongue.quadraticCurveTo(-tw, P.seam + 0.012, -tw, P.seam + 0.045);
  tongue.closePath();
  const flapColour = mat((trim as THREE.MeshStandardMaterial).color.getHex(), 0.7, true);
  mesh(onBack(tongue, 0.01, 0.004), flapColour, flapGroup);
  mesh(
    onBack(rounded(0, P.seam + 0.075, 0.075, 0.04, 0.008), 0.004, 0.016),
    mat(0xd7d9dc, 0.6, true),
    flapGroup,
  );

  // THE RISER COVERS: padded flaps out of the container's top corners, over
  // each shoulder to the three rings under the collarbone.
  const R = GEAR.riser;
  const G = GEAR.rings;
  const covers = mat(0x1b1e24, 0.8, true);
  const ringMat = mat(0xa7adb5, 0.3, true);
  const webMat = web;
  const F = GEAR.front;
  for (const s of [-1, 1]) {
    mesh(
      strap(
        [
          [s * 0.122, P.top - 0.03, padAt(0.25) - 0.02],
          [s * R.x, 0.282, -0.1],
          [s * R.x, R.y, -0.02],
          [s * R.x, 0.272, 0.06],
          [s * 0.118, 0.225, 0.112],
        ],
        0.072,
        0.022,
        [1, 0, 0],
      ),
      covers,
    );
    // The three rings, large over small, on the riser at the collarbone.
    for (const [r, dy] of [
      [0.016, 0],
      [0.011, -0.019],
      [0.007, -0.031],
    ] as const) {
      const g = new THREE.TorusGeometry(r, 0.0045, 6, 14);
      const o = mesh(g, ringMat);
      o.position.set(s * 0.118, G.y + dy, G.z + 0.006);
    }
    // THE MAIN LIFT WEB from the rings down the chest to the hip junction.
    mesh(
      strap(
        [
          [s * 0.118, G.y - 0.01, G.z],
          [s * GEAR.webs, 0.12, F],
          [s * (GEAR.webs - 0.005), 0.0, F - 0.004],
          [s * GEAR.webs, -0.1, F - 0.01],
          [s * 0.135, -0.18, 0.12],
          [s * 0.15, -0.24, 0.095],
        ],
        0.046,
        0.009,
        [1, 0, 0],
      ),
      webMat,
    );
    // The hip ring where the web meets the leg strap.
    const hip = mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 14), ringMat);
    hip.position.set(s * 0.137, -0.17, 0.126);
    hip.rotation.y = s * 0.4;
    // THE LATERALS round each flank from the container's side to the web.
    mesh(
      strap(
        [
          [s * (P.halfBottom - 0.01), -0.07, padAt(-0.07) - 0.03],
          [s * 0.19, -0.075, -0.02],
          [s * 0.17, -0.08, 0.09],
          [s * (GEAR.webs + 0.01), -0.085, F - 0.008],
        ],
        0.032,
        0.007,
        [0, 1, 0],
      ),
      webMat,
    );
  }
  // THE CHEST STRAP across the sternum, its buckle on the left.
  mesh(
    strap(
      [
        [-GEAR.webs, GEAR.chestStrap, F + 0.006],
        [0, GEAR.chestStrap, F + 0.022],
        [GEAR.webs, GEAR.chestStrap, F + 0.006],
      ],
      0.026,
      0.006,
      [0, 1, 0],
    ),
    webMat,
  );
  const buckle = mesh(new THREE.BoxGeometry(0.04, 0.034, 0.008), ringMat);
  buckle.position.set(-0.035, GEAR.chestStrap, F + 0.024);

  // THE RESERVE'S HANDLE on the left web: a steel D, its bar on the web.
  const reserveHandle = new THREE.Group();
  const dGeo = new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI);
  dGeo.rotateZ(Math.PI / 2);
  dGeo.rotateY(Math.PI / 2);
  const steel = mat(0xc4c9d0, 0.25, true);
  reserveHandle.add(new THREE.Mesh(dGeo, steel));
  const barGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6);
  reserveHandle.add(new THREE.Mesh(barGeo, steel));
  geos.push(dGeo, barGeo);
  reserveHandle.position.set(-GEAR.webs - 0.01, GEAR.pads, F + 0.012);
  reserveHandle.rotation.z = -0.15;
  body.add(reserveHandle);
  // THE CUT-AWAY PAD on the right web: a red pillow, kept apart so the hand
  // that punches it can carry it away.
  const padGeo = new THREE.CapsuleGeometry(0.022, 0.05, 3, 8);
  padGeo.rotateZ(Math.PI / 2);
  padGeo.scale(1, 1, 0.55);
  geos.push(padGeo);
  const pad = new THREE.Mesh(padGeo, mat(0xc8201c, 0.55, true));
  pad.position.set(GEAR.webs + 0.012, GEAR.pads, F + 0.016);
  body.add(pad);
  pad.visible = reserveHandle.visible = !base;

  // THE LEG STRAPS, padded, round each thigh (the torus's axis laid along
  // the bone), the strap's buckle at the front.
  const legGeo = new THREE.TorusGeometry(GEAR.leg.radius, 0.016, 6, 20);
  legGeo.rotateX(Math.PI / 2);
  legGeo.scale(1, 2.2, 1);
  // Higher at the front, where it buckles, than under the seat.
  legGeo.rotateX(0.3);
  geos.push(legGeo);
  const legStrap = (): THREE.Object3D => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(legGeo, webMat));
    return g;
  };
  const legs: [THREE.Object3D, THREE.Object3D] = [legStrap(), legStrap()];

  return {
    body,
    legs,
    pad,
    handle,
    reserveHandle,
    reserveFlap: hinge,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of own) m.dispose();
    },
  };
}

const m = new THREE.Matrix4();
const xs = new THREE.Vector3();
const ys = new THREE.Vector3();
const zs = new THREE.Vector3();
const keep = new THREE.Vector3();

/** Lay `obj` in a bone's frame (in `world`, the figure's group's matrix),
 * `down` m along the bone. */
export function layOnBone(obj: THREE.Object3D, f: BoneFrame, world: THREE.Matrix4, down = 0): void {
  m.makeBasis(
    xs.set(f.x.x, f.x.y, f.x.z),
    ys.set(f.y.x, f.y.y, f.y.z),
    zs.set(f.z.x, f.z.y, f.z.z),
  );
  m.setPosition(f.head.x + f.y.x * down, f.head.y + f.y.y * down, f.head.z + f.y.z * down);
  m.premultiply(world);
  m.decompose(obj.position, obj.quaternion, keep);
}
