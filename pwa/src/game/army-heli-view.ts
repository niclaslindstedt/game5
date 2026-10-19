// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER AS DRAWN — the military utility helicopter
// (`ARMY_HELI`; the Blender model `make models KIND=army`, `models/army.glb`,
// nodes `ARMY_NODES`) posed by whoever flies it: where its skid datum is and
// its attitude, how far its rotor has spooled, how far each sliding door
// stands open and where each door gun points. Both rotors as an eye sees
// them (`rotor-look.ts`: the blades blurring into a smear and the strobed
// ghost of them, `rotor-disc.ts`), the red anti-collision beacons flashing
// and the nav lights burning while the rotor turns. Should the model not
// load (or the build switch the helicopter off) a code-built stand-in with
// the same nodes is drawn in its place.
//
// THE FRAME. The machine's group is the BODY FRAME of `ARMY_HELI` exactly —
// x to the right, y up, z forward, the origin the skid datum — so a place
// out of `army-heli-plan.ts` (a seat, a gun's grip, the rope's hook, the
// muzzle) set in it lands on the drawn machine. The glTF is handed to it
// turned from glTF's own frame (the nose on -z) by a mirror of z alone,
// the way the game's code-built figures share its world.
//
// Presentation only: it reads the pose it is handed and writes nothing.

import * as THREE from "three";
import { ARMY_HELI } from "@engine";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { ARMY_NODES, doorSlide, lightsOf, type P3 } from "./army-heli-plan.ts";
import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { fadeBlades, lookDisc, rotorDisc, shadeDisc, type DiscSpec } from "./rotor-disc.ts";
import { createRotorEye } from "./rotor-look.ts";
import { armyModelUrl } from "./skier-models.ts";

const R = ARMY_HELI.rotor.radius;
const TR = ARMY_HELI.tail.radius;

/** A door gun's aim: `yaw` from square out of the door (positive toward
 * the nose), `pitch` above level, rad (`clampAim` holds it in its stops). */
export type GunAim = { yaw: number; pitch: number };

/** THE MACHINE THIS FRAME, as its flier hands it over. */
export type ArmyHeliPose = {
  /** The skid datum in the world, m. */
  x: number;
  y: number;
  z: number;
  /** Its attitude, body to world (`fromEuler(heading, pitch, roll)`). */
  q: { x: number; y: number; z: number; w: number };
  /** The rotor's share of its full rpm, 0..1. */
  spool: number;
  /** How far each sliding door stands open, 0 shut … 1 open. */
  doors: { r: number; l: number };
  /** Each door gun's aim. */
  guns: { r: GunAim; l: GunAim };
};

/** A pose of a machine on the snow with nothing turning. */
export function restingPose(x: number, y: number, z: number, heading = 0): ArmyHeliPose {
  const h = heading / 2;
  return {
    x,
    y,
    z,
    q: { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) },
    spool: 0,
    doors: { r: 0, l: 0 },
    guns: { r: { yaw: 0, pitch: 0 }, l: { yaw: 0, pitch: 0 } },
  };
}

export type ArmyHeliView = {
  group: THREE.Group;
  /** Draw it in this pose, `dt` s of the picture on (the rotors' eye and
   * the beacons are stepped on it). */
  pose(p: ArmyHeliPose, dt: number): void;
  /** A point of the body frame (`army-heli-plan.ts`), in the world as the
   * machine was last drawn. */
  toWorld(p: P3, out?: THREE.Vector3): THREE.Vector3;
  /** The machine's group — its matrix is the body frame's — for a figure
   * sat in it to ride. */
  readonly body: THREE.Object3D;
  /** The pace the run is shown at (game seconds a wall second): the eye on
   * the rotors is a high-speed camera slowed with it. */
  setPace(pace: number): void;
  /** How lit the rotor's smear is, 0 (night) … 1 (day). */
  shade(light: number): void;
  /** Resolved once the model (or the stand-in) is in the group. */
  ready: Promise<void>;
  dispose(): void;
};

/** The main rotor's smear: four blades, the model's blade 0 at 45° in the
 * rotor's own plane; the node is turned the way the heli-ski machine's is,
 * so the smear trails it the same way. */
const MAIN_DISC: DiscSpec = {
  radius: R,
  root: 0.62,
  chord: ARMY_HELI.rotor.chord,
  taper: 0.4,
  tipFrom: (R - 0.4) / R,
  band: (R - 0.4) / R,
  blades: ARMY_HELI.rotor.blades,
  first: Math.PI / 4,
  trail: 1,
};
const TAIL_DISC: DiscSpec = {
  radius: TR,
  root: 0.12,
  chord: ARMY_HELI.tail.chord,
  taper: 0.11,
  tipFrom: 0,
  band: 2,
  blades: ARMY_HELI.tail.blades,
  first: Math.PI / 2,
  trail: -1,
};

/** THE STAND-IN: a box cabin, a boom, the fin, the skids, a rotor, the two
 * doors and the two guns — under the model's own node names, in the
 * glTF's frame (y up, the nose on -z), so the same hands pose it. */
function standIn(): THREE.Group {
  const root = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({ color: 0x353d27, roughness: 0.75, name: "paint" });
  const wash = new THREE.MeshStandardMaterial({ color: 0xc6c9c8, roughness: 0.8, name: "trim" });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d1a, roughness: 0.6, name: "dark" });
  const blades = new THREE.MeshStandardMaterial({ color: 0x141513, roughness: 0.6, name: "rotor" });
  const B = ARMY_HELI.body;
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };
  const body = new THREE.Group();
  body.name = ARMY_NODES.body;
  const len = B.nose + 3.35;
  body.add(
    mesh(
      new THREE.BoxGeometry(B.width, B.roof - B.floor, len),
      olive,
      0,
      (B.roof + B.floor) / 2,
      -(B.nose - len / 2),
    ),
    mesh(new THREE.BoxGeometry(1.4, 0.55, 4.6), wash, 0, B.roof + 0.27, 1.2),
    mesh(new THREE.BoxGeometry(0.45, 0.5, 5.2), olive, 0, B.boom + 0.1, 5.7),
    mesh(new THREE.BoxGeometry(0.12, 1.9, 0.9), olive, 0, 3.0, -B.tail - 0.4),
  );
  for (const s of [-1, 1]) {
    const skid = mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.9, 8),
      dark,
      (s * ARMY_HELI.skid.track) / 2,
      ARMY_HELI.skid.y,
      0,
    );
    skid.rotation.x = Math.PI / 2;
    body.add(skid);
  }
  const rotor = new THREE.Group();
  rotor.name = ARMY_NODES.rotor;
  rotor.position.set(0, ARMY_HELI.rotor.hub, -ARMY_HELI.rotor.at);
  for (let i = 0; i < ARMY_HELI.rotor.blades; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = Math.PI / 4 + (i / ARMY_HELI.rotor.blades) * Math.PI * 2;
    const blade = mesh(new THREE.BoxGeometry(R, 0.05, ARMY_HELI.rotor.chord), blades, R / 2, 0, 0);
    arm.add(blade);
    rotor.add(arm);
  }
  const t = ARMY_HELI.tail.hub;
  const tail = new THREE.Group();
  tail.name = ARMY_NODES.tail;
  tail.position.set(t.x, t.y, -t.z);
  tail.add(mesh(new THREE.BoxGeometry(0.04, TR * 2, 0.24), blades, 0, 0, 0));
  root.add(body, rotor, tail);
  const d = ARMY_HELI.door;
  const g = ARMY_HELI.gun.pivot;
  for (const [s, door, gun] of [
    [1, ARMY_NODES.doorR, ARMY_NODES.gunR],
    [-1, ARMY_NODES.doorL, ARMY_NODES.gunL],
  ] as const) {
    const dn = new THREE.Group();
    dn.name = door;
    dn.position.set((s * B.width) / 2, d.sill, -d.front);
    const w = d.front - d.back;
    dn.add(
      mesh(
        new THREE.BoxGeometry(0.05, d.head - d.sill, w),
        olive,
        s * 0.03,
        (d.head - d.sill) / 2,
        w / 2,
      ),
    );
    const gn = new THREE.Group();
    gn.name = gun;
    gn.position.set(s * g.x, g.y, -g.z);
    gn.add(mesh(new THREE.BoxGeometry(1.2, 0.1, 0.08), dark, s * 0.2, 0.05, 0));
    root.add(dn, gn);
  }
  return root;
}

export function createArmyHeliView(haze: HazeUniforms): ArmyHeliView {
  const group = new THREE.Group();
  group.name = "army-helicopter";
  const machine = new THREE.Group();
  group.add(machine);
  const nodes: Partial<Record<keyof typeof ARMY_NODES, THREE.Object3D>> = {};
  const homes = new Map<THREE.Object3D, THREE.Vector3>();
  const mats: THREE.Material[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = [];
  let mainBlades: THREE.Mesh[] = [];
  let tailBlades: THREE.Mesh[] = [];
  let disposed = false;
  let pace = 1;

  const disc = rotorDisc(MAIN_DISC);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.04;
  const tailDisc = rotorDisc(TAIL_DISC);
  tailDisc.rotation.y = Math.PI / 2;
  const mainEye = createRotorEye({
    blades: ARMY_HELI.rotor.blades,
    rpm: ARMY_HELI.rotor.rpm,
    width: MAIN_DISC.chord / (0.6 * R),
  });
  const tailEye = createRotorEye({
    blades: ARMY_HELI.tail.blades,
    rpm: ARMY_HELI.tail.rpm,
    width: TAIL_DISC.chord / (0.6 * TR),
  });

  // THE LIGHTS as haloes, in the body frame.
  const halo = (colour: number, p: P3, size: number): THREE.Sprite => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow(),
        color: colour,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    sprite.position.set(p.x, p.y, p.z);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 9;
    sprite.visible = false;
    machine.add(sprite);
    mats.push(sprite.material);
    return sprite;
  };
  const L = lightsOf();
  const beacons = L.beacons.map((b) => halo(0xff2a10, b, 2.4));
  const navs = [halo(0xff3020, L.red, 1.2), halo(0x30ff60, L.green, 1.2)];

  /** A rotor's blades (the `rotor` and the tip bands' `trim`), each on a
   * material of its own, transparent from the start, so they can be faded
   * as the smear takes over. */
  const bladesOf = (node: THREE.Object3D): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    node.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const m = o.material;
      if (!(m instanceof THREE.MeshStandardMaterial) || !/^(rotor|trim)/i.test(m.name)) return;
      if (/^trim/i.test(m.name)) {
        (disc.material as THREE.ShaderMaterial).uniforms.uTip.value.copy(m.color);
      }
      const own = m.clone();
      own.transparent = true;
      o.material = own;
      out.push(o);
    });
    return out;
  };

  const adopt = (scene: THREE.Object3D): void => {
    // glTF's frame (the nose on -z) into the body frame (the nose on +z).
    scene.scale.z = -1;
    scene.traverse((o) => {
      for (const [key, name] of Object.entries(ARMY_NODES)) {
        if (o.name === name) {
          nodes[key as keyof typeof ARMY_NODES] = o;
          homes.set(o, o.position.clone());
        }
      }
    });
    if (nodes.rotor) {
      mainBlades = bladesOf(nodes.rotor);
      nodes.rotor.add(disc);
    }
    if (nodes.tail) {
      tailBlades = bladesOf(nodes.tail);
      nodes.tail.add(tailDisc);
    }
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === disc || o === tailDisc) return;
      o.castShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof THREE.MeshStandardMaterial) {
          hazeMaterial(m, haze, "army");
          if (/lamp/i.test(m.name)) lampMats.push(m);
        }
        mats.push(m);
      }
    });
    machine.add(scene);
  };

  const url = armyModelUrl();
  const ready = (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
    .then((gltf) => {
      if (!disposed) adopt(gltf.scene);
    })
    .catch(() => {
      if (!disposed) adopt(standIn());
    });

  let clock = 0;
  const g = ARMY_HELI.gun;
  return {
    group,
    body: machine,
    ready,
    pose(p, dt) {
      clock += dt;
      machine.position.set(p.x, p.y, p.z);
      machine.quaternion.set(p.q.x, p.q.y, p.q.z, p.q.w);
      // The doors slide aft (glTF +z) from their shut place.
      for (const [key, open] of [
        ["doorR", p.doors.r],
        ["doorL", p.doors.l],
      ] as const) {
        const n = nodes[key];
        const home = n && homes.get(n);
        if (n && home) n.position.set(home.x, home.y, home.z + doorSlide(open));
      }
      // Each gun turned in its own frame (glTF's): the yaw about its up,
      // carrying the muzzle toward the nose; the elevation about its
      // fore-and-aft axis — each the mirror of the other side's.
      for (const [key, side, aim] of [
        ["gunR", 1, p.guns.r],
        ["gunL", -1, p.guns.l],
      ] as const) {
        const n = nodes[key];
        if (!n) continue;
        const yaw = Math.max(-g.yaw, Math.min(g.yaw, aim.yaw));
        const pitch = Math.max(-g.pitch.down, Math.min(g.pitch.up, aim.pitch));
        n.rotation.set(0, side * yaw, side * pitch, "YZX");
      }
      const main = mainEye.step(p.spool, dt, pace);
      const back = tailEye.step(p.spool, dt, pace);
      if (nodes.rotor) nodes.rotor.rotation.y = -main.phase;
      if (nodes.tail) nodes.tail.rotation.x = back.phase;
      fadeBlades(mainBlades, main);
      fadeBlades(tailBlades, back);
      lookDisc(disc, main, true);
      lookDisc(tailDisc, back, true);
      const live = p.spool > 0.05;
      const flash = clock % 1 < 0.12;
      for (const b of beacons) b.visible = live && flash;
      for (const n of navs) n.visible = live;
      for (const m of lampMats) m.emissiveIntensity = live ? (flash ? 1.2 : 0.4) : 0.1;
    },
    toWorld(p, out = new THREE.Vector3()) {
      machine.updateWorldMatrix(true, false);
      return out.set(p.x, p.y, p.z).applyMatrix4(machine.matrixWorld);
    },
    setPace(next) {
      pace = next > 0 ? next : 1;
    },
    shade(light) {
      shadeDisc(disc, light);
      shadeDisc(tailDisc, light);
    },
    dispose() {
      disposed = true;
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of mats) m.dispose();
      (disc.material as THREE.Material).dispose();
      (tailDisc.material as THREE.Material).dispose();
    },
  };
}
