// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TANK'S GUNNER'S STATION AND HIS SIGHT AS DRAWN — what the TIPS rung
// sees in a tank he took from the army (`tank-station-plan.ts`' gunner,
// painted by `tank-paint.ts`), built in code in the TURRET's frame on the
// cab bench (`cab-kit.ts`, `cab-parts.ts`), and the reticle laid over the
// lens while he looks through the sight:
//
//   * THE TURRET'S INSIDE on his side of the gun: the basket's floor and
//     its mat, the walls under their pale spall liner, the roof with the
//     commander's cupola ring behind him and its lid, the front wall round
//     the gun's cradle, the turret ring's race; on the far side of the gun
//     the loader's wall, the coaxial machine gun and the ready rounds'
//     bases behind their door;
//   * THE BREECH, its block and its ring, run back from the trunnion and
//     ELEVATING with the gun, the cradle's face over the gun's port and
//     the AUXILIARY TELESCOPE along it; the breech's guard between him and
//     the recoil;
//   * THE PRIMARY SIGHT's body down from the roof to its eyepiece and the
//     rubber brow pad; the CONTROL HANDLES under it, turned and tipped as
//     he lays the gun, their palm switches and thumb buttons; the chest
//     pad; the manual handwheels for the traverse and the elevation,
//     turning as the turret and the gun do;
//   * THE FIRE CONTROL'S PANEL by his knee (the round, the laser's range,
//     the gun ready) and the turret's indicator on the front wall, live;
//   * HIS SEAT and the commander's behind it, and HIM (`seated-figure.ts`),
//     leant to the eyepiece, his hands on the handles;
//   * THE RETICLE (`paintReticle`) at the sight's head on the roof, turned
//     with the gun, square in front of the lens while he looks through it
//     (`TANK_SIGHT`): the field's black circle, the aiming mark, the
//     laser's range.
//
// Built with the world on a ride that carries the army (every program
// linked behind the loading card) and hung in his tank's turret as drawn.
// Presentation only: it reads `GameState.armour` and writes nothing.

import * as THREE from "three";
import { ARMOUR, ARMY_VEHICLE, type ArmourRide } from "@engine";

import { CabKit, quad } from "./cab-kit.ts";
import { buildExtinguisher, buildSeat, wallAt } from "./cab-parts.ts";
import type { HazeUniforms } from "./haze.ts";
import { createSeatedFigure } from "./seated-figure.ts";
import { TANK_GUNNER as C, TANK_SIGHT, type TankStation } from "./tank-station-plan.ts";
import { paintAzimuth, paintFireControl, paintReticle, RETICLE_PX } from "./tank-paint.ts";

type V3 = { x: number; y: number; z: number };

/** How often the faces and the reticle are painted again, Hz. */
const PAINT_HZ = 10;
/** px a metre on the faces. */
const PX = 1800;
/** His kit (`seated-figure.ts`): the carrier's driver's. */
const KIT = [0, 16, 25, 33, 1, 40, 45, 0];
/** The gun's trunnion in the turret's frame (`army-vehicle-shapes.ts`'
 * `TANK_GUN`, off the engine's ring height). */
const TRUNNION = { y: ARMY_VEHICLE.tank.ring, z: 1.25 };

export type TankGunner = {
  /** The station, in the turret's frame; the reticle hangs in it too. */
  group: THREE.Group;
  /** One frame: `station` which of the tank's lenses is up (the gunner's
   * station drawn for "gunner", the reticle for "sight"), `range` the
   * laser's range when it is read, `loaded` the gun ready. */
  update(
    r: ArmourRide | null,
    station: TankStation,
    dt: number,
    range: () => number | null,
    loaded: boolean,
  ): void;
  dispose(): void;
};

export function createTankGunner(haze: HazeUniforms): TankGunner {
  const group = new THREE.Group();
  group.name = "tank_gunner";
  const room = new THREE.Group();
  room.visible = false;
  group.add(room);
  const kit = new CabKit(haze, "tank-gunner");
  const ds = THREE.DoubleSide;
  const liner = kit.std({ color: 0xd3d4c8, roughness: 0.9, side: ds });
  const plate = kit.std({ color: 0x5b5f55, roughness: 0.75, side: ds });
  const dark = kit.std({ color: 0x1d1f1c, roughness: 0.8 });
  const black = kit.std({ color: 0x0e0f0f, roughness: 0.6 });
  const rubber = kit.std({ color: 0x0a0a0a, roughness: 0.85 });
  const steel = kit.std({ color: 0x8a8d88, roughness: 0.35, metalness: 0.75 });
  const gunMetal = kit.std({ color: 0x3e413d, roughness: 0.45, metalness: 0.6 });
  const olive = kit.std({ color: 0x48503a, roughness: 0.8 });
  const cloth = kit.std({ color: 0x2e3329, roughness: 0.97 });
  const red = kit.std({ color: 0xb21d17, roughness: 0.45 });
  const brass = kit.std({ color: 0xb08d3a, roughness: 0.4, metalness: 0.8 });
  const lamp = kit.std({
    color: 0xd0f0e0,
    emissive: 0x9ff0c8,
    emissiveIntensity: 0.3,
    roughness: 0.4,
  });
  const lens = kit.std({
    color: 0x1a2a24,
    emissive: 0x2c5a48,
    emissiveIntensity: 0.4,
    roughness: 0.1,
  });

  const R = C.room;
  const far = -R.wall;

  // ── THE TURRET'S INSIDE ─────────────────────────────────────────────
  const floor = kit.mesh(
    quad(
      { x: R.wall, y: R.floor, z: R.back },
      { x: far, y: R.floor, z: R.back },
      { x: far, y: R.floor, z: R.front },
      { x: R.wall, y: R.floor, z: R.front },
    ),
    plate,
    room,
  );
  floor.receiveShadow = true;
  kit.mesh(
    quad(
      { x: R.wall, y: R.roof, z: R.back },
      { x: far, y: R.roof, z: R.back },
      { x: far, y: R.roof, z: R.front },
      { x: R.wall, y: R.roof, z: R.front },
    ),
    liner,
    room,
  );
  for (const x of [R.wall, far])
    wallAt(
      kit,
      room,
      x,
      liner,
      [R.back, R.floor],
      [R.front, R.floor],
      [R.front, R.roof],
      [R.back, R.roof],
    );
  kit.mesh(
    quad(
      { x: far, y: R.floor, z: R.back },
      { x: R.wall, y: R.floor, z: R.back },
      { x: R.wall, y: R.roof, z: R.back },
      { x: far, y: R.roof, z: R.back },
    ),
    plate,
    room,
  );
  // The front wall round the gun's port.
  const port = { half: 0.48, lo: 1.88, hi: 2.62 };
  const front = (x0: number, x1: number, y0: number, y1: number) =>
    kit.mesh(
      quad(
        { x: x1, y: y0, z: R.front },
        { x: x0, y: y0, z: R.front },
        { x: x0, y: y1, z: R.front },
        { x: x1, y: y1, z: R.front },
      ),
      liner,
      room,
    );
  front(port.half, R.wall, R.floor, R.roof);
  front(far, -port.half, R.floor, R.roof);
  front(-port.half, port.half, R.floor, port.lo);
  front(-port.half, port.half, Math.min(R.roof, port.hi), R.roof);
  // The turret ring's race round the walls, and the basket's floor mat.
  const race = kit.mesh(
    new THREE.TorusGeometry(R.wall - 0.04, 0.03, 6, 48, Math.PI * 0.9),
    steel,
    room,
  );
  race.rotation.x = Math.PI / 2;
  race.rotation.z = -Math.PI * 0.45;
  race.position.set(0, 1.6, -0.1);
  kit.box(0.7, 0.012, 0.9, { x: C.seat.x, y: R.floor + 0.006, z: 0.0 }, rubber, room, 0.005);
  // The commander's cupola's ring and lid behind him, and his seat.
  const cup = { x: 0.75, z: -0.6 };
  const ring = kit.mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 32), steel, room);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cup.x, R.roof - 0.03, cup.z);
  const lid = kit.mesh(new THREE.CircleGeometry(0.38, 28), olive, room);
  lid.rotation.x = Math.PI / 2;
  lid.position.set(cup.x, R.roof - 0.006, cup.z);
  kit.box(0.3, 0.06, 0.28, { x: cup.x, y: 1.86, z: cup.z - 0.3 }, cloth, room, 0.02);
  kit.rod(
    { x: cup.x, y: 1.83, z: cup.z - 0.3 },
    { x: cup.x, y: R.floor, z: cup.z - 0.3 },
    0.025,
    steel,
    room,
  );
  // The dome lamp.
  kit.box(0.12, 0.025, 0.07, { x: 1.2, y: R.roof - 0.013, z: -0.3 }, lamp, room, 0.01);
  // An extinguisher on the wall, the intercom's box and its leads.
  buildExtinguisher(kit, room, { x: R.wall - 0.08, y: 1.35, z: -0.55 }, { red, black, steel }, 0.3);
  kit.box(0.06, 0.16, 0.12, { x: R.wall - 0.04, y: 2.08, z: -0.25 }, dark, room, 0.01);
  for (const dz of [-0.03, 0.03])
    kit
      .mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10), black, room)
      .position.set(R.wall - 0.075, 2.1, -0.25 + dz);
  kit.rod(
    { x: R.wall - 0.06, y: 2.0, z: -0.25 },
    { x: R.wall - 0.1, y: 1.7, z: -0.1 },
    0.006,
    black,
    room,
    5,
  );

  // ── ON THE FAR SIDE OF THE GUN ──────────────────────────────────────
  // The coaxial machine gun beside the breech, its box and its belt.
  kit.box(0.12, 0.16, 0.7, { x: -0.48, y: 2.18, z: 0.45 }, gunMetal, room, 0.01);
  kit.box(0.2, 0.18, 0.28, { x: -0.62, y: 2.02, z: 0.3 }, olive, room, 0.015);
  // The ready rounds' bases behind their door in the bustle's wall.
  kit.box(1.0, 0.7, 0.04, { x: -0.8, y: 1.95, z: R.back + 0.03 }, plate, room, 0.01);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      const base = kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14), brass, room);
      base.rotation.x = Math.PI / 2;
      base.position.set(-1.15 + i * 0.22, 1.8 + j * 0.28, R.back + 0.06);
    }

  // ── THE BREECH, ELEVATING WITH THE GUN ──────────────────────────────
  const cradle = new THREE.Group();
  cradle.position.set(0, TRUNNION.y, TRUNNION.z);
  room.add(cradle);
  const Br = C.breech;
  // The cradle's face over the port, the ring and the block.
  kit.box(
    port.half * 2 + 0.12,
    port.hi - port.lo + 0.14,
    0.08,
    { x: 0, y: 0, z: R.front - TRUNNION.z - 0.05 },
    gunMetal,
    cradle,
    0.02,
  );
  kit.box(
    Br.half * 2.2,
    Br.half * 2.2,
    0.35,
    { x: 0, y: 0, z: R.front - TRUNNION.z - 0.3 },
    gunMetal,
    cradle,
    0.03,
  );
  kit.box(
    Br.half * 2,
    Br.half * 2,
    Br.back - 0.9,
    { x: 0, y: 0, z: -(Br.back + 0.9) / 2 + 0.45 },
    steel,
    cradle,
    0.04,
  );
  // The block's face, its handle and the recoil cylinders over it.
  kit.box(
    Br.half * 1.4,
    Br.half * 1.4,
    0.04,
    { x: 0, y: 0, z: -Br.back + 0.02 },
    gunMetal,
    cradle,
    0.01,
  );
  kit.rod(
    { x: 0.12, y: -0.12, z: -Br.back },
    { x: 0.22, y: -0.22, z: -Br.back - 0.06 },
    0.015,
    black,
    cradle,
  );
  for (const s of [-1, 1])
    kit.rod(
      { x: s * 0.2, y: Br.half + 0.05, z: R.front - TRUNNION.z - 0.4 },
      { x: s * 0.2, y: Br.half + 0.05, z: -Br.back + 0.5 },
      0.045,
      gunMetal,
      cradle,
      12,
    );
  // THE AUXILIARY TELESCOPE along the gun on his side, its eyepiece.
  kit.rod(
    { x: 0.36, y: -0.12, z: R.front - TRUNNION.z - 0.1 },
    { x: 0.36, y: -0.12, z: -0.95 },
    0.035,
    olive,
    cradle,
    12,
  );
  const aux = kit.mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.06, 12), rubber, cradle);
  aux.position.set(0.36, -0.12, -0.98);
  aux.rotation.x = Math.PI / 2;
  // THE GUARD between him and the breech's recoil: a frame and its plate.
  const G = R.gun;
  wallAt(
    kit,
    room,
    G,
    kit.std({ color: 0x6b7062, roughness: 0.6, side: ds }),
    [-0.95, 1.25],
    [0.6, 1.25],
    [0.6, 1.98],
    [-0.95, 1.98],
  );
  kit.rod({ x: G, y: 1.98, z: -0.95 }, { x: G, y: 1.98, z: 0.6 }, 0.02, steel, room);
  kit.rod({ x: G, y: 1.25, z: -0.95 }, { x: G, y: 1.98, z: -0.95 }, 0.02, steel, room);
  kit.rod({ x: G, y: R.floor, z: 0.2 }, { x: G, y: 1.25, z: 0.2 }, 0.025, steel, room);

  // ── THE PRIMARY SIGHT ───────────────────────────────────────────────
  const S = C.sight;
  kit.box(
    S.half * 2,
    R.roof - S.eyepiece + 0.06,
    S.half * 2,
    { x: S.x, y: (R.roof + S.eyepiece) / 2 + 0.03, z: S.z },
    olive,
    room,
    0.02,
  );
  kit.box(
    S.half * 2 + 0.03,
    0.05,
    S.half * 2 + 0.03,
    { x: S.x, y: S.eyepiece + 0.08, z: S.z },
    dark,
    room,
    0.01,
  );
  const ep = kit.mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.14, 16), black, room);
  ep.rotation.x = Math.PI / 2;
  ep.position.set(S.x, S.eyepiece, S.z - S.half - 0.07);
  const glassAt = kit.mesh(new THREE.CircleGeometry(0.03, 16), lens, room);
  glassAt.rotation.y = Math.PI;
  glassAt.position.set(S.x, S.eyepiece, S.z - S.half - 0.141);
  // The brow pad: a rubber roll over the eyepiece.
  const brow = kit.mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 10), rubber, room);
  brow.rotation.z = Math.PI / 2;
  brow.position.set(S.x, S.eyepiece + 0.07, S.z - S.half - 0.12);
  // The sight's own knobs: the magnification, the filter, the reticle's light.
  for (const [dx, dy] of [
    [-0.13, 0.05],
    [-0.13, -0.05],
    [0.13, 0.0],
  ])
    kit
      .mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), black, room)
      .position.set(S.x + dx, S.eyepiece + 0.12 + dy, S.z - S.half + 0.02);

  // ── THE CONTROL HANDLES ─────────────────────────────────────────────
  const Hn = C.handles;
  kit.rod(
    { x: Hn.x, y: R.floor + 0.3, z: Hn.z + 0.18 },
    { x: Hn.x, y: Hn.y - 0.05, z: Hn.z + 0.04 },
    0.03,
    dark,
    room,
    10,
  );
  const handles = new THREE.Group();
  handles.position.set(Hn.x, Hn.y, Hn.z);
  room.add(handles);
  kit.box(0.2, 0.08, 0.12, { x: 0, y: 0, z: 0 }, dark, handles, 0.025);
  for (const s of [-1, 1]) {
    // A palm grip each side, leant out, its palm switch, its thumb's
    // laser button and its index finger's trigger.
    const g = new THREE.Group();
    g.position.set(s * Hn.half, 0, -0.04);
    g.rotation.z = s * 0.35;
    handles.add(g);
    kit.box(0.045, 0.14, 0.05, { x: 0, y: 0, z: 0 }, rubber, g, 0.02);
    kit.box(0.05, 0.08, 0.012, { x: 0, y: -0.01, z: 0.03 }, black, g, 0.004);
    kit.box(0.02, 0.02, 0.02, { x: 0, y: 0.08, z: -0.01 }, red, g, 0.005);
    kit.box(0.018, 0.035, 0.012, { x: 0, y: 0.03, z: -0.03 }, steel, g, 0.004);
    kit.rod(
      { x: -s * 0.02, y: 0, z: 0 },
      { x: -s * Hn.half + s * 0.1, y: 0, z: 0.02 },
      0.012,
      steel,
      g,
      6,
    );
  }
  // The chest pad.
  kit.box(
    0.26,
    0.16,
    0.06,
    { x: C.chest.x, y: C.chest.y, z: C.chest.z },
    cloth,
    room,
    0.03,
  ).rotation.x = -0.3;
  kit.rod(
    { x: C.chest.x, y: C.chest.y - 0.06, z: C.chest.z + 0.03 },
    { x: C.chest.x, y: R.floor + 0.3, z: Hn.z + 0.18 },
    0.012,
    steel,
    room,
    6,
  );

  // ── THE HANDWHEELS ──────────────────────────────────────────────────
  const handwheel = (at: V3, axis: "x" | "z", r: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(at.x, at.y, at.z);
    if (axis === "x") g.rotation.y = Math.PI / 2;
    room.add(g);
    const spin = new THREE.Group();
    g.add(spin);
    kit.mesh(new THREE.TorusGeometry(r, 0.012, 6, 28), black, spin);
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3])
      kit.rod(
        { x: 0, y: 0, z: 0 },
        { x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0 },
        0.008,
        steel,
        spin,
        5,
      );
    kit.rod({ x: r, y: 0, z: 0 }, { x: r, y: 0, z: 0.06 }, 0.012, red, spin, 6);
    return spin;
  };
  const traverseWheel = handwheel({ x: R.wall - 0.12, y: 1.62, z: 0.1 }, "x", 0.11);
  const elevateWheel = handwheel({ x: 0.58, y: 1.5, z: 0.48 }, "z", 0.09);

  // ── THE FIRE CONTROL AND THE INDICATOR ──────────────────────────────
  const eyeAt = C.eye;
  const facing = (
    p: { x: number; y: number; z: number; w: number; h: number },
    m: THREE.Material,
    depth: number,
  ) => {
    const yaw = Math.atan2(eyeAt.x - p.x, eyeAt.z - p.z);
    const tilt = Math.atan2(eyeAt.y - p.y, Math.hypot(eyeAt.x - p.x, eyeAt.z - p.z));
    const holder = new THREE.Group();
    holder.position.set(p.x, p.y, p.z);
    holder.rotation.set(0, yaw, 0);
    room.add(holder);
    const tip = new THREE.Group();
    tip.rotation.x = -tilt;
    holder.add(tip);
    kit.box(p.w + 0.03, p.h + 0.03, depth, { x: 0, y: 0, z: -depth / 2 }, dark, tip, 0.01);
    kit.mesh(new THREE.PlaneGeometry(p.w, p.h), m, tip).position.z = 0.002;
  };
  const Pn = C.panel;
  const fc = kit.canvas(Math.round(Pn.w * PX), Math.round(Pn.h * PX));
  paintFireControl(fc.ctx, null, false);
  facing(Pn, kit.face(fc.texture, 0.4), 0.08);
  const A = C.azimuth;
  const az = kit.canvas(256, 256);
  paintAzimuth(az.ctx, 0);
  const azFace = kit.mesh(
    new THREE.PlaneGeometry(A.r * 2.4, A.r * 2.4),
    kit.face(az.texture, 0.35),
    room,
  );
  azFace.rotation.y = Math.PI;
  azFace.position.set(A.x, A.y, A.z - 0.01);
  kit.box(A.r * 2.6, A.r * 2.6, 0.04, { x: A.x, y: A.y, z: A.z + 0.012 }, dark, room, 0.01);

  // ── THE SEAT AND HIM ────────────────────────────────────────────────
  const St = C.seat;
  buildSeat(kit, room, St.x, St, R.floor, { frame: dark, cloth, steel });
  const Bd = C.body;
  const gunner = createSeatedFigure(
    haze,
    {
      x: St.x,
      left: 1,
      eye: { x: S.x, y: S.eyepiece, z: S.z - S.half - 0.2 },
      shoulder: Bd.shoulder,
      hip: Bd.hip,
      upperArm: Bd.upperArm,
      forearm: Bd.forearm,
      thigh: Bd.thigh,
      shin: Bd.shin,
    },
    KIT,
    "tank_gunner",
  );
  room.add(gunner.group);
  const feet: [V3, V3] = [
    { x: St.x + 0.12, y: R.floor + 0.04, z: 0.25 },
    { x: St.x - 0.12, y: R.floor + 0.04, z: 0.25 },
  ];
  const gripAt = (s: number): V3 => ({ x: Hn.x + s * Hn.half, y: Hn.y, z: Hn.z - 0.06 });

  // ── THE RETICLE at the sight's head ─────────────────────────────────
  const head = new THREE.Group();
  head.position.set(TANK_SIGHT.head.x, TANK_SIGHT.head.y, TANK_SIGHT.head.z);
  head.visible = false;
  group.add(head);
  const laid = new THREE.Group();
  head.add(laid);
  const ret = kit.canvas(RETICLE_PX, RETICLE_PX);
  paintReticle(ret.ctx, null, false);
  const d = TANK_SIGHT.reticle;
  const side = 2 * d * Math.tan((TANK_SIGHT.fov * Math.PI) / 360) * 1.02;
  const overlay = (m: THREE.Material, w: number, x: number): void => {
    const o = kit.mesh(new THREE.PlaneGeometry(w, side * 1.2), m, laid);
    // The plane's +z faces the lens behind it: turned round to face back.
    o.rotation.y = Math.PI;
    o.position.set(x, 0, d);
    o.renderOrder = 1000;
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = false;
  };
  const mats: THREE.Material[] = [];
  const sheet = (p: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial => {
    const m = new THREE.MeshBasicMaterial({
      ...p,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    mats.push(m);
    return m;
  };
  ret.texture.colorSpace = THREE.SRGBColorSpace;
  overlay(sheet({ map: ret.texture }), side * 1.2, 0);
  const blind = sheet({ color: 0x000000 });
  for (const s of [-1, 1]) overlay(blind, side * 4, s * (side * 0.6 + side * 2 - 0.0005));

  let since = Infinity;
  let spunT = 0;
  let spunE = 0;
  return {
    group,
    update(r, station, dt, range, loaded) {
      room.visible = station === "gunner";
      head.visible = station === "sight";
      if (!r || !station || station === "driver") {
        since = Infinity;
        return;
      }
      const b = r.body;
      cradle.rotation.x = r.dead ? 0.12 : -b.gun;
      laid.rotation.x = -b.gun;
      // The handles turned and tipped with his hands, the handwheels with
      // the turret and the gun.
      handles.rotation.y = -r.traverse * 0.35;
      handles.rotation.x = r.elevate * 0.3;
      spunT += r.traverse * ARMOUR.tank.traverse * dt * 40;
      spunE += r.elevate * ARMOUR.tank.elevate * dt * 120;
      traverseWheel.rotation.z = spunT;
      elevateWheel.rotation.z = spunE;
      if (station === "gunner") {
        const turn = -r.traverse * 0.35;
        const at = (s: number): V3 => {
          const p = gripAt(s);
          const dx = p.x - Hn.x;
          const dz = p.z - Hn.z;
          return {
            x: Hn.x + dx * Math.cos(turn) + dz * Math.sin(turn),
            y: p.y,
            z: Hn.z - dx * Math.sin(turn) + dz * Math.cos(turn),
          };
        };
        gunner.pose(at(1), at(-1), feet, true);
      }
      since += dt;
      if (since >= 1 / PAINT_HZ) {
        since = 0;
        const m = range();
        if (station === "sight") {
          paintReticle(ret.ctx, m, loaded);
          ret.texture.needsUpdate = true;
        } else {
          paintFireControl(fc.ctx, m, loaded);
          fc.texture.needsUpdate = true;
          paintAzimuth(az.ctx, b.turret);
          az.texture.needsUpdate = true;
        }
      }
    },
    dispose() {
      gunner.dispose();
      for (const m of mats) m.dispose();
      kit.dispose();
    },
  };
}
