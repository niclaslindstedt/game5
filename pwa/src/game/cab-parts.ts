// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PIECES EVERY TAKEN VEHICLE'S CAB IS MADE OF (`carrier-cab.ts`,
// `truck-cab.ts`, `tank-driver.ts`, `tank-gunner.ts`) on the bench
// (`cab-kit.ts`): a dashboard's sloped face and the frame a panel is laid
// on it in, a steering wheel on its column with its spokes, its horn pad
// and its stalk, a pedal on its arm, a seat with its cushion, its back,
// its bolsters and its head rest, a fire extinguisher in its clips, a
// painted face laid on a dash. Each is built where the cab's plan puts it;
// none states a number of the cab it sits in. Presentation only.

import * as THREE from "three";

import { mix, quad, type CabKit } from "./cab-kit.ts";
import { wheelFrame, type WheelSpec } from "./army-cab-plan.ts";

type V3 = { x: number; y: number; z: number };

/** A DASHBOARD'S FACE: a plane through its top's edge and its foot's
 * (y, z), running across x. `on(x, u, o)` is a point on it — `x` across,
 * `u` up it from its foot, `o` out of it toward the driver; `len` its
 * length up the slope; `tilt` the angle a box laid on it is turned about
 * x so it lies in the face. */
export type DashFace = {
  on(x: number, u: number, o?: number): V3;
  len: number;
  tilt: number;
  up: { y: number; z: number };
  nrm: { y: number; z: number };
};

export function dashFace(top: { y: number; z: number }, foot: { y: number; z: number }): DashFace {
  const len = Math.hypot(top.y - foot.y, top.z - foot.z);
  const up = { y: (top.y - foot.y) / len, z: (top.z - foot.z) / len };
  // The face's normal, toward the driver.
  const nrm = { y: up.z, z: -up.y };
  return {
    on: (x, u, o = 0) => ({
      x,
      y: foot.y + up.y * u + nrm.y * o,
      z: foot.z + up.z * u + nrm.z * o,
    }),
    len,
    tilt: Math.atan2(up.z, up.y),
    up,
    nrm,
  };
}

/** A painted face `w` × `h` m laid on `face` with its middle at (`x`,
 * `u`), `o` proud of it, its canvas's left on the picture's left (+x). */
export function faceQuad(
  kit: CabKit,
  face: DashFace,
  x: number,
  u: number,
  w: number,
  h: number,
  o: number,
  m: THREE.Material,
  parent: THREE.Object3D,
): THREE.Mesh {
  return kit.mesh(
    quad(
      face.on(x + w / 2, u - h / 2, o),
      face.on(x - w / 2, u - h / 2, o),
      face.on(x - w / 2, u + h / 2, o),
      face.on(x + w / 2, u + h / 2, o),
    ),
    m,
    parent,
  );
}

/** The materials a steering wheel is made of. */
type WheelMats = { black: THREE.Material; dark: THREE.Material; rubber: THREE.Material };

/** A STEERING WHEEL on its column, the column's foot at `foot`: the
 * column and its shroud, the indicator's stalk, the rim, three spokes (to
 * either side and the broad one down) and the horn pad. Hands back the
 * group that turns with the steering (about its local y, the wheel's
 * axis). */
export function buildWheel(
  kit: CabKit,
  parent: THREE.Object3D,
  W: WheelSpec,
  foot: V3,
  m: WheelMats,
  spokes: readonly number[] = [0, Math.PI, Math.PI / 2],
): THREE.Group {
  const WF = wheelFrame(W);
  kit.rod(foot, WF.hub, 0.03, m.black, parent, 12);
  kit.rod(foot, mix(foot, WF.hub, 0.55), 0.05, m.dark, parent, 12);
  const stalkAt = mix(foot, WF.hub, 0.6);
  kit.rod(
    stalkAt,
    { x: stalkAt.x + 0.16, y: stalkAt.y + 0.01, z: stalkAt.z - 0.02 },
    0.007,
    m.black,
    parent,
    6,
  );
  const wheel = new THREE.Group();
  wheel.position.set(WF.hub.x, WF.hub.y, WF.hub.z);
  // The wheel's own frame: its face's normal (toward the driver) on its
  // local +y — so it turns about y.
  wheel.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(WF.axis.x, WF.axis.y, WF.axis.z).normalize(),
  );
  const turn = new THREE.Group();
  wheel.add(turn);
  parent.add(wheel);
  const rim = kit.mesh(new THREE.TorusGeometry(W.r, W.grip, 10, 48), m.rubber, turn);
  rim.rotation.x = Math.PI / 2;
  // The wheel's local −z is the rim's foot: the broad spoke runs there.
  for (const a of spokes) {
    const broad = Math.abs(a - Math.PI / 2) < 1e-6;
    const sp = kit.box(
      W.r - 0.04,
      0.012,
      broad ? 0.06 : 0.035,
      { x: 0, y: -0.015, z: 0 },
      m.black,
      turn,
      0.005,
    );
    sp.rotation.y = a;
    sp.position.set(Math.cos(a) * (W.r / 2), -0.015, -Math.sin(a) * (W.r / 2));
  }
  kit.mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 20), m.black, turn).position.y = -0.005;
  return turn;
}

/** A PEDAL hung from its arm's pivot at (`x`, `y`, `z`): the arm down and
 * forward to a pad `w` × `h` m. Its group tips about x as it is pressed. */
export function buildPedal(
  kit: CabKit,
  parent: THREE.Object3D,
  at: V3,
  w: number,
  h: number,
  m: { steel: THREE.Material; rubber: THREE.Material },
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(at.x, at.y, at.z);
  parent.add(g);
  kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: -0.14, z: -0.04 }, 0.008, m.steel, g, 6);
  const pad = kit.box(w, h, 0.016, { x: 0, y: -0.15, z: -0.045 }, m.rubber, g, 0.006);
  pad.rotation.x = -0.45;
  return g;
}

/** A SEAT as a cab plans it: the cushion's top, its middle along z, its
 * width and depth, the back's height and lean (rad, back from upright). */
export type SeatSpec = {
  top: number;
  z: number;
  width: number;
  depth: number;
  tall: number;
  lean: number;
};

/** A SEAT across at `x` on a floor at `floor`: its pedestal, its cushion,
 * its back with its bolsters and its head rest on two posts. Hands back
 * its back's group (leant, its local +y up the back). */
export function buildSeat(
  kit: CabKit,
  parent: THREE.Object3D,
  x: number,
  S: SeatSpec,
  floor: number,
  m: { frame: THREE.Material; cloth: THREE.Material; steel: THREE.Material },
): THREE.Group {
  kit.box(
    S.width * 0.8,
    S.top - 0.08 - floor,
    S.depth * 0.7,
    { x, y: (S.top - 0.08 + floor) / 2, z: S.z },
    m.frame,
    parent,
    0.02,
  );
  kit.box(S.width, 0.1, S.depth, { x, y: S.top - 0.05, z: S.z }, m.cloth, parent, 0.04);
  const back = new THREE.Group();
  back.position.set(x, S.top - 0.02, S.z - S.depth / 2 + 0.03);
  back.rotation.x = -S.lean;
  parent.add(back);
  kit.box(S.width, S.tall, 0.1, { x: 0, y: S.tall / 2, z: -0.05 }, m.cloth, back, 0.04);
  for (const s of [-1, 1])
    kit.box(
      0.06,
      S.tall * 0.7,
      0.1,
      { x: s * (S.width / 2 - 0.02), y: S.tall * 0.4, z: 0.0 },
      m.cloth,
      back,
      0.03,
    );
  kit.box(0.26, 0.17, 0.08, { x: 0, y: S.tall + 0.13, z: -0.06 }, m.cloth, back, 0.03);
  for (const s of [-1, 1])
    kit.rod(
      { x: s * 0.08, y: S.tall, z: -0.06 },
      { x: s * 0.08, y: S.tall + 0.06, z: -0.06 },
      0.008,
      m.steel,
      back,
      6,
    );
  return back;
}

/** A FIRE EXTINGUISHER stood at `at` (its middle) in two clips, its
 * valve, its hose and its handle toward +z. */
export function buildExtinguisher(
  kit: CabKit,
  parent: THREE.Object3D,
  at: V3,
  m: { red: THREE.Material; black: THREE.Material; steel: THREE.Material },
  tall = 0.34,
): void {
  kit
    .mesh(new THREE.CylinderGeometry(0.055, 0.055, tall, 16), m.red, parent)
    .position.set(at.x, at.y, at.z);
  kit
    .mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 10), m.black, parent)
    .position.set(at.x, at.y + tall / 2 + 0.03, at.z);
  kit.rod(
    { x: at.x - 0.02, y: at.y + tall / 2 + 0.06, z: at.z },
    { x: at.x - 0.02, y: at.y + tall / 2 + 0.06, z: at.z + 0.09 },
    0.007,
    m.black,
    parent,
    5,
  );
  for (const dy of [-0.1, 0.1])
    kit.box(0.04, 0.025, 0.13, { x: at.x, y: at.y + dy, z: at.z }, m.steel, parent, 0.006);
}

/** A RUBBER SEAL round a window's four corners (in order) and its pane
 * drawn clear from in here. */
export function buildPane(
  kit: CabKit,
  parent: THREE.Object3D,
  corners: readonly V3[],
  m: { rubber: THREE.Material; glass: THREE.Material },
  seal = 0.018,
): void {
  for (let i = 0; i < 4; i++) kit.rod(corners[i], corners[(i + 1) % 4], seal, m.rubber, parent, 6);
  const pane = kit.mesh(quad(corners[0], corners[1], corners[2], corners[3]), m.glass, parent);
  pane.renderOrder = 4;
  pane.castShadow = false;
}

/** A flat panel through four corners given as (z, y) pairs on the plane
 * x = `x` — a cab's wall piece. */
export function wallAt(
  kit: CabKit,
  parent: THREE.Object3D,
  x: number,
  m: THREE.Material,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): THREE.Mesh {
  return kit.mesh(
    quad(
      { x, y: a[1], z: a[0] },
      { x, y: b[1], z: b[0] },
      { x, y: c[1], z: c[0] },
      { x, y: d[1], z: d[0] },
    ),
    m,
    parent,
  );
}
