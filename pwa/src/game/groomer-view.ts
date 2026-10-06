// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE AS DRAWN — one big tracked snow groomer, built in code
// off `GROOMER`'s measures (the class, never a make): two rubber belts
// 1.65 m wide over their road wheels, the sprocket high at the back; the
// chassis in its red paint, the cab forward on it with glass all round and
// a white roof; the engine bay behind it with its stack; the TWELVE-WAY
// BLADE out front on its push arms and rams, its wings swung forward, its
// top edge striped, a heap of snow rolling ahead of it while it works; the
// TILLER behind on its arm, its hood, its finishers and the rubber comb
// trailing on the snow, its corner flags up; and the LAMPS — a bar of LED
// work lamps across the front of the roof, a pair on the nose, a bar on the
// back of the roof over the tiller, and the amber BEACON turning on top.
//
// The frame is the engine's (`defs/groomer.ts`): x right, y up, z forward,
// the origin on the snow under the middle of the tracks. Posed every frame
// off the engine's `GroomerState`: placed and turned to the snow, the belts'
// cleats and the wheels run at its speed, the beacon turned, the heap shown
// while the blade works, the lamps lit by the dark.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GROOMER, type GroomerState } from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

const K = GROOMER;
/** Each belt's middle, right of the machine's middle, m. */
const BELT_X = K.tracks.span / 2 - K.tracks.width / 2;
const BELT_W = K.tracks.width;
/** The cleats' pitch along a belt, m. */
const CLEAT = 0.26;
/** The road wheels' radius, m, and where they stand along the belt. */
const WHEEL_R = 0.36;
const WHEELS = [-1.75, -0.88, 0, 0.88, 1.75];
/** The roof's top, m. */
const ROOF = K.roof;

/** Where the machine's lamps are and the way they point, its frame — what
 * the scene deals to the lamp slots (`groomer-scene.ts`). */
export const GROOMER_LAMPS = {
  /** The roof bar's middle, aimed ahead and down at the snow before the
   * blade. */
  front: { y: ROOF + 0.18, z: 1.45, down: 0.42 },
  /** The rear bar's, aimed back and down at the tiller and the swath. */
  rear: { y: ROOF + 0.12, z: -0.25, down: 0.55 },
  /** The beacon's, turning. */
  beacon: { y: ROOF + 0.42, z: 0.35 },
} as const;

export type GroomerView = {
  group: THREE.Group;
  /** Pose it off the engine at `t` (the run's clock), `dt` the frame. */
  update(g: GroomerState, t: number, dt: number): void;
  /** Light its lamps at `lit` (0 day … 1 night), seen from `eye`. */
  light(lit: number, eye: THREE.Vector3): void;
  /** The drawn machine, for the lens: its place and attitude. */
  drawn(): { x: number; y: number; z: number; heading: number; pitch: number; roll: number };
  /** The beacon's beam's heading this frame, world. */
  beaconHeading(): number;
  dispose(): void;
};

/** The paint, shared by every machine on the map. */
export type GroomerPaint = ReturnType<typeof groomerPaint>;

export function groomerPaint(haze: HazeUniforms) {
  const mats: THREE.Material[] = [];
  const paint = (params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(params), haze, "groomer");
    mats.push(m);
    return m;
  };
  return {
    red: paint({ color: 0xd0141c, roughness: 0.38, metalness: 0.25 }),
    darkRed: paint({ color: 0x7c0a10, roughness: 0.5, metalness: 0.2 }),
    white: paint({ color: 0xf2f3f0, roughness: 0.35, metalness: 0.1 }),
    rubber: paint({ color: 0x18191b, roughness: 0.92 }),
    steel: paint({ color: 0x9aa1a8, roughness: 0.35, metalness: 0.8 }),
    dark: paint({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 }),
    chrome: paint({ color: 0xd8dde2, roughness: 0.15, metalness: 1 }),
    yellow: paint({ color: 0xffc21a, roughness: 0.45, metalness: 0.1 }),
    black: paint({ color: 0x0c0c0d, roughness: 0.55 }),
    glass: paint({
      color: 0x0d1820,
      roughness: 0.06,
      metalness: 0.9,
      emissive: 0xffb062,
      emissiveIntensity: 0,
    }),
    lamp: paint({
      color: 0xf4f8ff,
      roughness: 0.1,
      emissive: 0xe8f0ff,
      emissiveIntensity: 0.5,
    }),
    amber: paint({
      color: 0xff9a1a,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
      emissive: 0xff7a00,
      emissiveIntensity: 0.6,
    }),
    tail: paint({ color: 0x8a0005, roughness: 0.3, emissive: 0xff1010, emissiveIntensity: 0.4 }),
    orange: paint({ color: 0xff5a10, roughness: 0.6, side: THREE.DoubleSide }),
    snow: paint({ color: 0xeef3f9, roughness: 0.95 }),
    dispose(): void {
      for (const m of mats) m.dispose();
    },
  };
}

/** A belt's side profile, (z, y), round its idler, sprocket and run on the
 * snow — the outline, and the same inset by the belt's thickness. */
function beltOutline(inset: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const arc = (cz: number, cy: number, r: number, a0: number, a1: number) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      pts.push(new THREE.Vector2(cz + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  // The idler forward, low; the sprocket aft, high.
  arc(2.3, 0.46, 0.46 - inset, -Math.PI / 2, Math.PI / 2);
  arc(-2.4, 0.72, 0.62 - inset, Math.PI / 2, (3 * Math.PI) / 2);
  return pts;
}

export function createGroomerView(paint: GroomerPaint): GroomerView {
  const geometries: THREE.BufferGeometry[] = [];
  const own: THREE.Material[] = [];
  const keep = <G extends THREE.BufferGeometry>(g: G): G => {
    geometries.push(g);
    return g;
  };
  const group = new THREE.Group();
  group.name = "piste-machine";
  group.rotation.order = "YXZ";
  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D = group,
    shadow = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(keep(g), m);
    mesh.castShadow = shadow;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  /** Merge a list of pieces into one draw of `m`. */
  const lump = (pieces: THREE.BufferGeometry[], m: THREE.Material, parent = group): THREE.Mesh => {
    const merged = mergeGeometries(
      pieces.map((p) => (p.index ? p.toNonIndexed() : p)),
      false,
    )!;
    for (const p of pieces) p.dispose();
    return add(merged, m, parent);
  };
  /** A rod from `a` to `b`, radius `r`. */
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, sides = 8): THREE.BufferGeometry => {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, sides);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    g.applyQuaternion(q);
    const m = a.clone().add(b).multiplyScalar(0.5);
    return g.translate(m.x, m.y, m.z);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ── THE BELTS: a loop of rubber round each side's wheels, its cleats in
  // two runs that slide along with the speed, its road wheels turning.
  const belts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(beltOutline(0));
    shape.holes.push(new THREE.Path(beltOutline(0.11).reverse()));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: BELT_W,
      bevelEnabled: false,
      curveSegments: 4,
    });
    g.rotateY(-Math.PI / 2);
    g.translate(side * BELT_X + BELT_W / 2, 0, 0);
    belts.push(g);
  }
  lump(belts, paint.rubber);
  const cleatRun = (y: number, from: number, to: number, slope: number): THREE.Group => {
    const pieces: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let z = from; z <= to; z += CLEAT) {
        pieces.push(box(BELT_W * 0.98, 0.06, 0.07, side * BELT_X, y + (z - from) * slope, z));
      }
    }
    const holder = new THREE.Group();
    group.add(holder);
    lump(pieces, paint.steel, holder);
    return holder;
  };
  const bottomCleats = cleatRun(0.03, -2.3, 2.3, 0);
  const topSlope = (1.34 - 0.92) / (-2.4 - 2.3);
  const topCleats = cleatRun(0.95, -2.2, 2.2, topSlope);
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = keep(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, BELT_W * 0.86, 14).rotateZ(Math.PI / 2),
  );
  const hubGeo = keep(new THREE.CylinderGeometry(0.16, 0.16, BELT_W * 0.9, 8).rotateZ(Math.PI / 2));
  for (const side of [-1, 1]) {
    for (const z of WHEELS) {
      const w = new THREE.Mesh(wheelGeo, paint.dark);
      w.position.set(side * BELT_X, WHEEL_R + 0.08, z);
      w.add(new THREE.Mesh(hubGeo, paint.steel));
      group.add(w);
      wheels.push(w);
    }
    // The sprocket aft and the idler forward.
    const sp = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(0.5, 0.5, BELT_W * 0.8, 12).rotateZ(Math.PI / 2)),
      paint.red,
    );
    sp.position.set(side * BELT_X, 0.72, -2.4);
    group.add(sp);
    wheels.push(sp);
    const id = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(0.34, 0.34, BELT_W * 0.8, 12).rotateZ(Math.PI / 2)),
      paint.dark,
    );
    id.position.set(side * BELT_X, 0.46, 2.3);
    group.add(id);
    wheels.push(id);
  }

  // ── THE CHASSIS AND THE BODY: the frame over the belts, the engine bay
  // aft of the cab with its grille and stack, the nose ahead of it, the
  // fenders over the belts, a white band down each side.
  lump(
    [
      box(2.5, 0.42, 5.1, 0, 1.18, 0),
      box(2.3, 0.95, 2.2, 0, 1.86, -1.45),
      box(2.0, 0.55, 0.75, 0, 1.68, 2.2),
      // The fenders over each belt.
      box(BELT_W + 0.1, 0.12, 4.7, -BELT_X, 1.42, 0.05),
      box(BELT_W + 0.1, 0.12, 4.7, BELT_X, 1.42, 0.05),
    ],
    paint.red,
  );
  lump(
    [
      box(0.04, 0.16, 4.6, -K.tracks.span / 2 - 0.03, 1.42, 0.05),
      box(0.04, 0.16, 4.6, K.tracks.span / 2 + 0.03, 1.42, 0.05),
      box(2.32, 0.1, 2.22, 0, 2.38, -1.45),
    ],
    paint.white,
  );
  lump(
    [
      // The bay's grilles, the nose's, the frame's underside.
      box(2.0, 0.6, 0.04, 0, 1.86, -2.57),
      box(0.04, 0.5, 1.6, -1.16, 1.9, -1.45),
      box(0.04, 0.5, 1.6, 1.16, 1.9, -1.45),
      box(1.4, 0.3, 0.04, 0, 1.62, 2.58),
      box(2.2, 0.3, 5.0, 0, 0.82, 0),
    ],
    paint.black,
  );
  // The stack and the rail along the bay.
  lump(
    [
      rod(v(0.85, 2.3, -2.1), v(0.85, 3.25, -2.1), 0.08),
      rod(v(-1.05, 2.5, -2.45), v(-1.05, 2.5, -0.45), 0.025, 6),
      rod(v(-1.05, 2.43, -2.45), v(-1.05, 2.5, -2.45), 0.025, 6),
    ],
    paint.black,
  );
  add(new THREE.CylinderGeometry(0.1, 0.09, 0.12, 8).translate(0.85, 3.3, -2.1), paint.chrome);
  // The steps up to the cab's door, on its left.
  lump([box(0.5, 0.05, 0.4, -1.3, 0.75, 0.6), box(0.5, 0.05, 0.4, -1.3, 1.15, 0.6)], paint.yellow);

  // ── THE CAB: a red belt line, glass all round above it, red pillars, a
  // white roof over it all.
  const CAB = { x: 1.06, back: -0.35, front: 1.6, sill: 2.0, top: ROOF - 0.08, nose: 1.95 };
  lump(
    [box(CAB.x * 2, 0.6, CAB.front - CAB.back + 0.3, 0, 1.7, (CAB.back + CAB.front + 0.3) / 2)],
    paint.red,
  );
  {
    // The glass: a side profile (z, y) — the back wall upright, the screen
    // raked forward to the nose — run across the cab.
    const s = new THREE.Shape([
      new THREE.Vector2(CAB.back, CAB.sill),
      new THREE.Vector2(CAB.nose, CAB.sill),
      new THREE.Vector2(CAB.front, CAB.top),
      new THREE.Vector2(CAB.back, CAB.top),
    ]);
    const g = new THREE.ExtrudeGeometry(s, { depth: CAB.x * 2 - 0.04, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(CAB.x - 0.02, 0, 0);
    add(g, paint.glass);
  }
  const pillars: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    pillars.push(
      rod(v(sx * CAB.x, CAB.sill, CAB.nose), v(sx * CAB.x, CAB.top, CAB.front), 0.06, 6),
    );
    pillars.push(box(0.1, CAB.top - CAB.sill, 0.1, sx * CAB.x, (CAB.top + CAB.sill) / 2, CAB.back));
    pillars.push(box(0.1, CAB.top - CAB.sill, 0.08, sx * CAB.x, (CAB.top + CAB.sill) / 2, 0.55));
  }
  pillars.push(box(CAB.x * 2, 0.1, 0.1, 0, CAB.sill + 0.02, CAB.nose));
  lump(pillars, paint.red);
  lump(
    [
      box(CAB.x * 2 + 0.16, 0.14, CAB.front - CAB.back + 0.22, 0, ROOF, (CAB.back + CAB.front) / 2),
      // The mirrors, out on their arms.
      box(0.06, 0.32, 0.22, -CAB.x - 0.45, 2.55, 1.55),
      box(0.06, 0.32, 0.22, CAB.x + 0.45, 2.55, 1.55),
    ],
    paint.white,
  );
  lump(
    [
      rod(v(-CAB.x, 2.6, 1.45), v(-CAB.x - 0.45, 2.55, 1.55), 0.02, 5),
      rod(v(CAB.x, 2.6, 1.45), v(CAB.x + 0.45, 2.55, 1.55), 0.02, 5),
      // The wiper.
      rod(
        v(-0.2, CAB.sill + 0.1, CAB.nose - 0.02),
        v(0.35, CAB.sill + 0.75, CAB.nose - 0.17),
        0.012,
        4,
      ),
    ],
    paint.black,
  );

  // ── THE LAMPS: the roof's front bar of six, the nose's pair, the rear
  // bar's four, each a lens lit by the dark with a halo seen from its front.
  const halos: { s: THREE.Sprite; way: THREE.Vector3; size: number; bloom?: boolean }[] = [];
  const sprite = (colour: number, size: number): THREE.Sprite => {
    const sm = new THREE.SpriteMaterial({
      map: glow(),
      color: colour,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      opacity: 0,
    });
    own.push(sm);
    const s = new THREE.Sprite(sm);
    s.scale.set(size, size, 1);
    s.renderOrder = 9;
    return s;
  };
  const housings: THREE.BufferGeometry[] = [];
  const lenses: THREE.BufferGeometry[] = [];
  const lampHead = (x: number, y: number, z: number, back: boolean, size: number, halo: number) => {
    const w = 0.26 * size;
    const h = 0.17 * size;
    const face = back ? -1 : 1;
    housings.push(box(w + 0.04, h + 0.04, 0.12, x, y, z));
    lenses.push(box(w, h, 0.02, x, y, z + face * 0.065));
    const s = sprite(0xf0f6ff, halo);
    s.position.set(x, y, z + face * 0.12);
    group.add(s);
    halos.push({ s, way: new THREE.Vector3(0, -0.25, face).normalize(), size: halo });
  };
  const F = GROOMER_LAMPS.front;
  housings.push(box(2.4, 0.07, 0.1, 0, F.y - 0.12, F.z - 0.05));
  for (let i = 0; i < 8; i++) lampHead(-1.05 + i * 0.3, F.y, F.z, false, 0.9, 1.6);
  // The A-pillars' pair, high on the cab's front corners.
  for (const sx of [-1, 1]) lampHead(sx * 1.32, ROOF - 0.35, 1.75, false, 0.8, 1.3);
  for (const sx of [-1, 1]) lampHead(sx * 0.72, 1.72, 2.6, false, 1.1, 1.8);
  // The blade's own pair, on its arms' heads.
  for (const sx of [-1, 1]) lampHead(sx * 1.25, 1.5, 2.5, false, 0.8, 1.2);
  const R = GROOMER_LAMPS.rear;
  housings.push(box(1.8, 0.07, 0.1, 0, R.y - 0.12, CAB.back - 0.02));
  for (let i = 0; i < 4; i++) lampHead(-0.75 + i * 0.5, R.y, CAB.back - 0.04, true, 1, 1.3);
  // THE GLARE: one wide soft bloom over each bar, the dazzle a bank of LEDs
  // throws in the night air when it faces the eye.
  for (const [z, face, size] of [
    [F.z + 0.6, 1, 7.5],
    [CAB.back - 0.5, -1, 4.5],
  ] as const) {
    const s = sprite(0xe4eeff, size);
    s.position.set(0, F.y, z);
    group.add(s);
    halos.push({ s, way: new THREE.Vector3(0, -0.3, face).normalize(), size, bloom: true });
  }
  lump(housings, paint.black);
  const lensMesh = lump(lenses, paint.lamp);
  lensMesh.castShadow = false;
  // The tail lights at the bay's corners.
  lump(
    [box(0.22, 0.12, 0.04, -0.85, 1.65, -2.6), box(0.22, 0.12, 0.04, 0.85, 1.65, -2.6)],
    paint.tail,
  );

  // ── THE BEACON: an amber dome on the roof, a reflector turning in it, and
  // its flash.
  const B = GROOMER_LAMPS.beacon;
  add(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 12).translate(0, ROOF + 0.11, B.z), paint.black);
  add(
    new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(1, 1.6, 1)
      .translate(0, ROOF + 0.15, B.z),
    paint.amber,
    group,
    false,
  );
  const spin = new THREE.Group();
  spin.position.set(0, ROOF + 0.26, B.z);
  group.add(spin);
  add(new THREE.BoxGeometry(0.16, 0.12, 0.02), paint.chrome, spin, false);
  const flash = sprite(0xff9a20, 3.6);
  flash.position.set(0, 0.04, 0.18);
  spin.add(flash);
  const glowBall = sprite(0xff8a10, 0.9);
  glowBall.position.set(0, ROOF + 0.3, B.z);
  group.add(glowBall);

  // ── THE BLADE: its middle and two wings swung forward, a curved
  // moldboard each, the cutting edge steel, the top edge striped in
  // warning yellow and black; on two push arms and two rams off the nose.
  const blade = new THREE.Group();
  group.add(blade);
  const moldboard = (width: number): THREE.BufferGeometry => {
    const pts: THREE.Vector2[] = [];
    // The face, a quarter round from the edge on the snow up to the lip.
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(-0.38 + Math.cos(a) * 0.38, 0.02 + Math.sin(a) * 1.05));
    }
    pts.push(
      new THREE.Vector2(0.06, 1.12),
      new THREE.Vector2(-0.08, 1.12),
      new THREE.Vector2(-0.16, 0.2),
      new THREE.Vector2(-0.08, 0.02),
    );
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth: width,
      bevelEnabled: false,
    });
    g.rotateY(-Math.PI / 2);
    g.translate(width / 2, 0, 0);
    return g;
  };
  const MID = 3.1;
  const WING = (K.blade.width - MID) / 2 / Math.cos(0.42);
  const wingAt = (sx: number): THREE.Matrix4 =>
    new THREE.Matrix4()
      .makeTranslation(sx * MID * 0.5, 0, K.blade.ahead)
      .multiply(new THREE.Matrix4().makeRotationY(-sx * 0.42))
      .multiply(new THREE.Matrix4().makeTranslation(sx * WING * 0.5, 0, 0));
  lump(
    [
      moldboard(MID).translate(0, 0, K.blade.ahead),
      moldboard(WING).applyMatrix4(wingAt(-1)),
      moldboard(WING).applyMatrix4(wingAt(1)),
    ],
    paint.red,
    blade,
  );
  const edgePieces: THREE.BufferGeometry[] = [box(MID, 0.08, 0.06, 0, 0.04, K.blade.ahead + 0.01)];
  const stripes: THREE.BufferGeometry[] = [];
  const blacks: THREE.BufferGeometry[] = [];
  const stripeRow = (width: number, m: THREE.Matrix4 | null, z: number) => {
    const n = Math.round(width / 0.3);
    for (let i = 0; i < n; i++) {
      const g = box(width / n, 0.13, 0.05, -width / 2 + (i + 0.5) * (width / n), 1.1, z);
      if (m) g.applyMatrix4(m);
      (i % 2 === 0 ? stripes : blacks).push(g);
    }
  };
  stripeRow(MID, null, K.blade.ahead - 0.01);
  for (const sx of [-1, 1]) {
    stripeRow(WING, wingAt(sx), 0);
    edgePieces.push(box(WING, 0.08, 0.06, 0, 0.04, 0.01).applyMatrix4(wingAt(sx)));
  }
  lump(stripes, paint.yellow, blade);
  lump(blacks, paint.black, blade);
  lump(edgePieces, paint.steel, blade);
  lump(
    [
      rod(v(-0.95, 0.75, 2.2), v(-0.95, 0.55, K.blade.ahead - 0.25), 0.12),
      rod(v(0.95, 0.75, 2.2), v(0.95, 0.55, K.blade.ahead - 0.25), 0.12),
      box(2.2, 0.22, 0.22, 0, 0.6, K.blade.ahead - 0.28),
    ],
    paint.dark,
    blade,
  );
  lump(
    [
      rod(v(-0.55, 1.5, 2.55), v(-0.55, 0.95, K.blade.ahead - 0.3), 0.07),
      rod(v(0.55, 1.5, 2.55), v(0.55, 0.95, K.blade.ahead - 0.3), 0.07),
    ],
    paint.chrome,
    blade,
  );
  // THE HEAP rolling ahead of the blade while it works.
  const heapPieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 22; i++) {
    const x = -2.4 + (i / 21) * 4.8;
    const r = 0.26 + 0.12 * Math.sin(i * 2.3) ** 2;
    heapPieces.push(
      new THREE.IcosahedronGeometry(r, 1)
        .scale(1.3, 0.75, 1)
        .translate(
          x,
          r * 0.45,
          K.blade.ahead + 0.2 + 0.08 * Math.cos(i * 1.7) + Math.abs(x) * 0.18,
        ),
    );
  }
  const heap = lump(heapPieces, paint.snow);
  heap.castShadow = false;

  // ── THE TILLER: its arm off the frame's tail, its hood, the finishers at
  // its ends, the rubber comb trailing on the snow, the corner flags.
  const tiller = new THREE.Group();
  group.add(tiller);
  const TB = K.tiller.behind;
  const TW = K.tiller.width;
  lump(
    [
      rod(v(-0.7, 0.95, -2.5), v(-0.7, 0.7, -3.35), 0.11),
      rod(v(0.7, 0.95, -2.5), v(0.7, 0.7, -3.35), 0.11),
      box(1.8, 0.24, 0.3, 0, 0.85, -3.3),
    ],
    paint.dark,
    tiller,
  );
  {
    const hood = new THREE.CylinderGeometry(0.55, 0.55, TW, 16, 1, false, 0, Math.PI).rotateZ(
      Math.PI / 2,
    );
    hood.translate(0, 0.42, -3.95);
    add(hood, paint.red, tiller);
    const ends = [-1, 1].map((sx) => box(0.06, 0.6, 1.2, (sx * TW) / 2, 0.36, -3.95));
    lump(ends, paint.dark, tiller);
    lump([box(TW, 0.08, 0.1, 0, 0.98, -3.95)], paint.white, tiller);
    // The comb: a rubber mat trailing behind on the snow, its teeth.
    const comb: THREE.BufferGeometry[] = [box(TW, 0.05, 0.72, 0, 0.1, -(TB - 0.4))];
    for (let x = -TW / 2 + 0.06; x < TW / 2; x += 0.14)
      comb.push(box(0.05, 0.05, 0.3, x, 0.04, -(TB - 0.12)));
    lump(comb, paint.rubber, tiller);
    const poles = [-1, 1].map((sx) =>
      rod(v((sx * (TW - 0.1)) / 2, 0.9, -4.1), v((sx * (TW - 0.1)) / 2, 2.4, -4.1), 0.02, 5),
    );
    lump(poles, paint.black, tiller);
    const flags = [-1, 1].map((sx) =>
      new THREE.PlaneGeometry(0.42, 0.28)
        .translate(0.21, 0, 0)
        .rotateY(Math.PI / 2)
        .translate((sx * (TW - 0.1)) / 2, 2.25, -4.1),
    );
    lump(flags, paint.orange, tiller);
    lump(
      [
        box(0.2, 0.12, 0.04, -(TW / 2 - 0.2), 0.75, -4.3),
        box(0.2, 0.12, 0.04, TW / 2 - 0.2, 0.75, -4.3),
      ],
      paint.tail,
      tiller,
    );
  }

  let phase = 0;
  let beacon = 0;
  const lens = paint.lamp;
  const toEye = new THREE.Vector3();
  const way = new THREE.Vector3();
  const at = new THREE.Vector3();
  const drawn = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 };
  return {
    group,
    update(g, t, dt) {
      group.position.set(g.x, g.y, g.z);
      group.rotation.set(-g.pitch, g.heading, -g.roll);
      drawn.x = g.x;
      drawn.y = g.y;
      drawn.z = g.z;
      drawn.heading = g.heading;
      drawn.pitch = g.pitch;
      drawn.roll = g.roll;
      // The belts run: the ground run still on the snow as the machine
      // moves over it, the top run carried forward at twice its speed.
      phase = (phase + g.speed * dt) % CLEAT;
      bottomCleats.position.z = -phase;
      topCleats.position.z = phase;
      for (const w of wheels) w.rotation.x += (g.speed * dt) / WHEEL_R;
      // The beacon turns a revolution a second, flashing round.
      beacon = (t * Math.PI * 2.2) % (Math.PI * 2);
      spin.rotation.y = beacon;
      // The heap while the blade works; the tiller down while it combs.
      heap.visible = g.tiller && g.speed > 0.5;
      tiller.position.y = g.tiller ? 0 : 0.22;
      group.updateMatrixWorld();
    },
    light(lit, eye) {
      // The lamps, by the dark — always a little on; the work is the night's.
      const on = 0.25 + 0.75 * lit;
      lens.emissiveIntensity = 0.6 + 5 * on;
      paint.glass.emissiveIntensity = 0.035 * lit * lit;
      paint.amber.emissiveIntensity = 0.8 + 2.5 * on;
      paint.tail.emissiveIntensity = 0.3 + 1.5 * on;
      for (const h of halos) {
        h.s.getWorldPosition(at);
        way.copy(h.way).transformDirection(group.matrixWorld);
        const facing = way.dot(toEye.subVectors(eye, at).normalize());
        const k = THREE.MathUtils.smoothstep(facing, h.bloom ? 0.3 : -0.2, h.bloom ? 0.95 : 0.8);
        (h.s.material as THREE.SpriteMaterial).opacity = (h.bloom ? 0.45 * lit : on) * k;
      }
      const f = flash.material as THREE.SpriteMaterial;
      flash.getWorldPosition(at);
      way.set(0, 0, 1).transformDirection(flash.matrixWorld);
      f.opacity =
        (0.12 + 0.88 * lit) *
        THREE.MathUtils.smoothstep(way.dot(toEye.subVectors(eye, at).normalize()), 0.2, 0.95);
      (glowBall.material as THREE.SpriteMaterial).opacity = 0.15 + 0.6 * lit;
    },
    drawn: () => drawn,
    beaconHeading: () => drawn.heading + beacon,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of own) m.dispose();
    },
  };
}
