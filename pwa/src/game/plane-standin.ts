// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE AS THE CODE BUILDS IT — the stand-in the run draws until a
// modelled one is made, built off `PLANE`'s own numbers so it is the
// machine the engine flies to the centimetre: the fuselage lofted through
// its stations with the jump door's opening cut out of its side (the right
// as a pilot sees it) and the door slid open aft along the outside; the
// high wing on its dihedral with the flaps and the ailerons hinged on its
// trailing edge; the lift struts; the tailplane with its elevator, the fin
// with its rudder; the three-bladed propeller turning in front of a
// spinner, with a blurred disc as it spins up; the spring legs on their
// wheel-skis and the tail ski. Faceted on purpose, in the trees' low-poly
// way; one livery.

import * as THREE from "three";
import { PLANE } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** What moves on it, each turned by `plane-scene.ts` every frame. */
export type PlaneStandIn = {
  group: THREE.Group;
  /** The propeller's hub, turned about its own forward axis. */
  prop: THREE.Group;
  /** The blur disc across the propeller's sweep, faded in with its spin. */
  disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /** The hinged surfaces, each turned about its hinge's own x (the
   * elevator, the flaps and the ailerons) or y (the rudder). */
  elevator: THREE.Group;
  rudder: THREE.Group;
  ailerons: [THREE.Group, THREE.Group];
  flaps: [THREE.Group, THREE.Group];
  /** Every material it is painted with — darkened for the wreck. */
  materials: THREE.MeshStandardMaterial[];
  /** Seen from the pilot's seat or from outside: inside, the skin is drawn
   * one-sided so the world shows through the windscreen's frame, the glass
   * panes are put away and the panel and its coaming stand ahead of him. */
  inside(on: boolean): void;
};

/** Points round a station's cross-section, from the keel up the right side
 * over the top and down the left: how many, and how square its corners
 * are (an exponent of a superellipse: 2 an ellipse, higher squarer). */
const RING = 14;
const SQUARE = 3;

/** The jump door's side: the sign of its x (`PLANE.door`). */
const SIDE = Math.sign(PLANE.door.x);

/** One station of the fuselage: its z, its bottom and top, its half width. */
type Station = { z: number; bottom: number; top: number; half: number };

/** The fuselage's stations with two more laid at the door's edges, so its
 * opening falls on a ring. */
function stations(): Station[] {
  const base: Station[] = PLANE.fuselage.stations.map((s) => ({ ...s }));
  for (const z of [PLANE.door.front, PLANE.door.back]) {
    const i = base.findIndex((s) => s.z < z);
    const a = base[i - 1];
    const b = base[i];
    const t = (a.z - z) / (a.z - b.z);
    const lerp = (u: number, v: number): number => u + (v - u) * t;
    base.splice(i, 0, {
      z,
      bottom: lerp(a.bottom, b.bottom),
      top: lerp(a.top, b.top),
      half: lerp(a.half, b.half),
    });
  }
  return base;
}

/** A point round a station, `k` of `RING`: 0 the keel, a quarter the right
 * side's middle, a half the top. */
function ringPoint(s: Station, k: number): THREE.Vector3 {
  const a = (k / RING) * Math.PI * 2;
  const sx = Math.sin(a);
  const cy = -Math.cos(a);
  const px = Math.sign(sx) * Math.pow(Math.abs(sx), 2 / SQUARE);
  const py = Math.sign(cy) * Math.pow(Math.abs(cy), 2 / SQUARE);
  const mid = (s.top + s.bottom) / 2;
  const half = (s.top - s.bottom) / 2;
  return new THREE.Vector3(px * s.half, mid + py * half, s.z);
}

/** THE FUSELAGE: the stations lofted ring to ring, the door's opening on
 * door's side left out. */
function fuselage(): THREE.BufferGeometry {
  const st = stations();
  const D = PLANE.door;
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): void => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  for (let i = 0; i + 1 < st.length; i++) {
    const s0 = st[i];
    const s1 = st[i + 1];
    const inDoor = s0.z <= D.front + 1e-6 && s1.z >= D.back - 1e-6;
    for (let k = 0; k < RING; k++) {
      const a = ringPoint(s0, k);
      const b = ringPoint(s0, k + 1);
      const c = ringPoint(s1, k + 1);
      const d = ringPoint(s1, k);
      // The door's side between the sill and the lintel is the doorway.
      const midY = (a.y + b.y) / 2;
      const out = a.x * SIDE > 0.05 && b.x * SIDE > 0.05;
      if (inDoor && out && midY > D.bottom && midY < D.top) continue;
      quad(a, d, c, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A flat panel `span` × `chord` × `thick` hung off a hinge at its leading
 * edge — the group's origin — reaching back along −z. */
function hinged(
  span: number,
  chord: number,
  thick: number,
  material: THREE.Material,
): { hinge: THREE.Group; mesh: THREE.Mesh } {
  const hinge = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(span, thick, chord), material);
  mesh.position.z = -chord / 2;
  hinge.add(mesh);
  return { hinge, mesh };
}

/** A strut or leg from `a` to `b`, `r` m thick. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3().subVectors(b, a).normalize(),
  );
  return mesh;
}

export function createPlaneStandIn(haze: HazeUniforms): PlaneStandIn {
  const group = new THREE.Group();
  group.name = "plane_standin";
  const std = (color: number, roughness: number, metal = 0): THREE.MeshStandardMaterial =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color, roughness, metalness: metal, flatShading: true }),
      haze,
      "plane",
    );
  const paint = std(0xe8e6df, 0.45);
  paint.side = THREE.DoubleSide;
  const stripe = std(0xd8432c, 0.45);
  const dark = std(0x23262b, 0.6);
  const glass = std(0x1b2a38, 0.15, 0.3);
  const metal = std(0x9aa0a6, 0.35, 0.6);
  const materials = [paint, stripe, dark, glass, metal];

  group.add(new THREE.Mesh(fuselage(), paint));

  // THE WINDSCREEN and the cabin's windows, dark panels on the skin.
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.06), glass);
  screen.position.set(0, 2.42, 1.15);
  screen.rotation.x = -0.75;
  group.add(screen);
  const panes: THREE.Mesh[] = [screen];
  for (const side of [-1, 1]) {
    for (const z of [0.6, -0.4, -1.4]) {
      // The door side's aft windows are in the door.
      if (side === SIDE && z < PLANE.door.front) continue;
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.6), glass);
      w.position.set(side * 0.635, 2.2, z);
      group.add(w);
      panes.push(w);
    }
  }
  // A stripe down each side under the windows.
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 6.2), stripe);
    s.position.set(side * 0.64, 1.75, -1.2);
    if (side === SIDE) s.scale.z = 0.35;
    if (side === SIDE) s.position.z = 1.0;
    group.add(s);
  }

  // THE JUMP DOOR slid open aft along the outside, and the dark floor of
  // the cabin seen through the doorway.
  const D = PLANE.door;
  const doorLen = D.front - D.back;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, D.top - D.bottom, doorLen), paint);
  door.position.set(D.x + SIDE * 0.06, (D.top + D.bottom) / 2, D.back - doorLen / 2 + 0.2);
  group.add(door);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(PLANE.cabin.width, 0.04, PLANE.cabin.front - PLANE.cabin.back),
    dark,
  );
  floor.position.set(0, PLANE.cabin.floor, (PLANE.cabin.front + PLANE.cabin.back) / 2);
  group.add(floor);

  // THE WING, two halves on the dihedral, the flaps inboard and the
  // ailerons outboard on the trailing edge.
  const W = PLANE.wing;
  const half = W.span / 2;
  const fixed = W.chord * (1 - W.flap.chord);
  const flaps: THREE.Group[] = [];
  const ailerons: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(0, W.root.y, W.root.le);
    wing.rotation.z = side * W.dihedral;
    const box = new THREE.Mesh(new THREE.BoxGeometry(half, 0.17, fixed), paint);
    box.position.set((side * half) / 2, 0, -fixed / 2);
    wing.add(box);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, W.chord), stripe);
    tip.position.set(side * half, 0, -W.chord / 2);
    wing.add(tip);
    // The flap from a hand's width off the cabin to the aileron's root.
    const flapSpan = half * W.flap.span - 0.4;
    const ailSpan = half * W.aileron.span;
    const f = hinged(flapSpan, W.chord - fixed, 0.08, paint);
    f.hinge.position.set((side * flapSpan) / 2 + side * 0.3, -0.02, -fixed);
    wing.add(f.hinge);
    flaps.push(f.hinge);
    const a = hinged(ailSpan, W.chord * W.aileron.chord, 0.07, paint);
    a.hinge.position.set(side * (half - ailSpan / 2 - 0.05), -0.02, -fixed);
    wing.add(a.hinge);
    ailerons.push(a.hinge);
    group.add(wing);
  }

  // THE LIFT STRUTS, cabin to wing, both sides.
  const S = PLANE.struts;
  for (const side of [-1, 1]) {
    const foot = new THREE.Vector3(side * S.foot.x, S.foot.y, S.foot.z);
    const head = new THREE.Vector3(side * S.head.x, S.head.y, S.head.z);
    group.add(rod(foot, head, 0.045, metal));
  }

  // THE TAIL: the tailplane and its elevator, the fin and its rudder.
  const T = PLANE.tail;
  const fixedT = T.chord * (1 - T.elevator);
  const plane = new THREE.Mesh(new THREE.BoxGeometry(T.span, 0.08, fixedT), paint);
  plane.position.set(0, T.y, T.le - fixedT / 2);
  group.add(plane);
  const elev = hinged(T.span, T.chord - fixedT, 0.06, stripe);
  elev.hinge.position.set(0, T.y, T.le - fixedT);
  group.add(elev.hinge);
  const F = PLANE.fin;
  const finShape = new THREE.Shape();
  const rudderAt = (le: number, chord: number): number => le - chord * (1 - F.rudder);
  finShape.moveTo(F.root.le, F.root.y);
  finShape.lineTo(F.dorsal, F.root.y);
  finShape.lineTo(F.root.le, F.root.y + 0.35);
  finShape.lineTo(F.tip.le, F.tip.y);
  finShape.lineTo(rudderAt(F.tip.le, F.tip.chord), F.tip.y);
  finShape.lineTo(rudderAt(F.root.le, F.root.chord), F.root.y);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
  finGeo.translate(0, 0, -0.04);
  finGeo.rotateY(-Math.PI / 2);
  // The shape is drawn in (z, y) and turned onto the fuselage's plane.
  group.add(new THREE.Mesh(finGeo, paint));
  const rudder = new THREE.Group();
  const hingeTop = rudderAt(F.tip.le, F.tip.chord);
  const hingeRoot = rudderAt(F.root.le, F.root.chord);
  rudder.position.set(0, F.root.y, hingeRoot);
  const rudderShape = new THREE.Shape();
  rudderShape.moveTo(0, 0);
  rudderShape.lineTo(hingeTop - hingeRoot, F.tip.y - F.root.y);
  rudderShape.lineTo(hingeTop - hingeRoot - F.tip.chord * F.rudder, F.tip.y - F.root.y);
  rudderShape.lineTo(-F.root.chord * F.rudder, 0);
  rudderShape.closePath();
  const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, { depth: 0.07, bevelEnabled: false });
  rudderGeo.translate(0, 0, -0.035);
  rudderGeo.rotateY(-Math.PI / 2);
  rudder.add(new THREE.Mesh(rudderGeo, stripe));
  group.add(rudder);

  // THE PROPELLER: the spinner, three blades on the hub, the blur disc.
  const P = PLANE.prop;
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(P.spinner / 2, 0.55, 10), dark);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.set(0, P.hub.y, P.hub.z + 0.18);
  group.add(spinner);
  const prop = new THREE.Group();
  prop.position.set(0, P.hub.y, P.hub.z);
  for (let i = 0; i < P.blades; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / P.blades) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, P.diameter / 2, 0.04), dark);
    blade.position.y = P.diameter / 4;
    blade.rotation.y = 0.35;
    arm.add(blade);
    prop.add(arm);
  }
  group.add(prop);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(P.diameter / 2, 32),
    new THREE.MeshBasicMaterial({
      color: 0x2a2c30,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  disc.position.set(0, P.hub.y, P.hub.z + 0.02);
  group.add(disc);

  // THE GEAR: the spring legs out to the axles, the wheels and the main
  // skis, and the tail ski on its leg.
  const G = PLANE.gear;
  for (const side of [-1, 1]) {
    const axle = new THREE.Vector3((side * G.track) / 2, G.wheel, G.leg.z);
    group.add(rod(new THREE.Vector3(side * G.leg.x, G.leg.y, G.leg.z), axle, 0.05, metal));
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(G.wheel, G.wheel, 0.2, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.copy(axle);
    group.add(wheel);
    const ski = new THREE.Mesh(new THREE.BoxGeometry(G.ski.width, 0.07, G.ski.length), stripe);
    ski.position.set(axle.x, 0.04, G.leg.z + G.ski.front - G.ski.length / 2);
    group.add(ski);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(G.ski.width, 0.06, 0.4), stripe);
    tip.position.set(axle.x, 0.04 + G.ski.tip / 2, G.leg.z + G.ski.front + 0.15);
    tip.rotation.x = -Math.atan2(G.ski.tip, 0.4);
    group.add(tip);
  }
  const tailTop = new THREE.Vector3(0, G.tail.y + 0.35, G.tail.z + 0.1);
  group.add(rod(tailTop, new THREE.Vector3(0, G.tail.y + 0.04, G.tail.z), 0.04, metal));
  const tailSki = new THREE.Mesh(new THREE.BoxGeometry(G.tail.width, 0.05, G.tail.length), stripe);
  tailSki.position.set(0, G.tail.y + 0.02, G.tail.z);
  group.add(tailSki);

  // THE COCKPIT, drawn only from the pilot's seat: the instrument panel
  // across the cabin under the windscreen, its coaming over it, and the
  // two frames either side of the screen.
  const cockpit = new THREE.Group();
  cockpit.visible = false;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.08), dark);
  panel.position.set(0, 1.7, 1.4);
  panel.rotation.x = -0.15;
  cockpit.add(panel);
  const coaming = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.05, 0.22), dark);
  coaming.position.set(0, 1.87, 1.36);
  cockpit.add(coaming);
  for (const side of [-1, 1]) {
    const post = rod(
      new THREE.Vector3(side * 0.6, 2.08, 1.3),
      new THREE.Vector3(side * 0.56, 2.62, 0.95),
      0.035,
      paint,
    );
    cockpit.add(post);
  }
  group.add(cockpit);

  return {
    group,
    prop,
    disc,
    elevator: elev.hinge,
    rudder,
    ailerons: [ailerons[0], ailerons[1]],
    flaps: [flaps[0], flaps[1]],
    materials,
    inside(on) {
      if (cockpit.visible === on) return;
      cockpit.visible = on;
      for (const w of panes) w.visible = !on;
      paint.side = on ? THREE.FrontSide : THREE.DoubleSide;
      paint.needsUpdate = true;
    },
  };
}
