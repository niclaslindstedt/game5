// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE AS DRAWN — the Blender model (`models/plane.glb`, made by
// `make models KIND=plane` off `PLANE`: `scripts/blender/plane.py`) where
// the build packs it, the code's stand-in (`plane-standin.ts`) until it is
// in and wherever it is switched off (`VITE_MODEL_PLANE=0`) or will not
// load. Either is posed the same way every frame off the engine's plane:
// the propeller turned and its blur disc faded in with the spin, the
// elevator, the rudder, the ailerons and the flaps on their hinges where
// the engine has them, the sliding door as far open as it is, the lamps
// lit — the red and green navs at the wing tips while the engine runs, the
// red beacons flashing, the white strobes' double flash in the air — and
// after dark the landing light in the left wing's leading edge thrown onto
// the snow ahead (`lamps`). Charred where it came down (`char`).
//
// THE COCKPIT (`plane-cockpit.ts`) is built off the model's own glass when
// it arrives and shown while the eye is in it — the outside's glass put
// away for its own clear panes — or near enough outside to see the pilot
// through the glass, which is then let half clear. The skin stays
// two-sided: the pilot's eye sits close under the cowling's top line, and
// a one-sided skin would cull the very cowling he looks along.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLANE, type Level, type PlaneState, type Quat } from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { Flood } from "./headlamp.ts";
import { createPlaneCockpit, type PlaneCockpit } from "./plane-cockpit.ts";
import { createPlaneStandIn } from "./plane-standin.ts";
import { PLANE_NODES, planeModelUrl } from "./skier-models.ts";

export type PlaneLook = {
  /** The airframe in the engine's body frame (x right, y up, z forward,
   * the origin the ground datum). */
  group: THREE.Group;
  /** Settled once the model is in, or the stand-in is kept. */
  ready: Promise<void>;
  /** One frame's pose off the engine's plane, `clock` s into the run —
   * the cockpit's controls and displays too, off `level`, `dt` s on. */
  pose(p: PlaneState, clock: number, level?: Level, dt?: number): void;
  /** Every surface charred `k` of the way: 0 as built, 1 burnt black. */
  char(k: number): void;
  /** Whether the eye is in the cockpit, whether it is the pilot's own,
   * and whether it is near enough outside to see in. */
  inside(on: boolean, own?: boolean, near?: boolean): void;
  /** After dark (`lit` > 0), the landing light's beam into `out`, the
   * airframe drawn at `at` — and the cockpit lit for the night. */
  lamps(
    p: PlaneState,
    at: { x: number; y: number; z: number; q: Quat },
    lit: number,
    out: Flood[],
  ): void;
  dispose(): void;
};

/** The blur disc's opacity at the propeller's full spin. */
const DISC = 0.2;
/** The landing light's power after dark. */
const LANDING = 1.1;

/** Where the builder lays the lamps, in the engine's body frame: the navs
 * at the tips' leading edges (red at +x, the pilot's left), the strobes
 * behind them, the beacons on the fin's top and under the belly, the
 * landing light in the left wing's leading edge. */
const W = PLANE.wing;
const TIP_Y = W.root.y + (W.span / 2) * Math.tan(W.dihedral);
const FIN_TOP = PLANE.fin.tip;
const LIGHTS = {
  navs: [
    { x: W.span / 2 + 0.03, y: TIP_Y + 0.02, z: W.root.le - 0.12, colour: 0xff3020 },
    { x: -(W.span / 2 + 0.03), y: TIP_Y + 0.02, z: W.root.le - 0.12, colour: 0x30ff60 },
  ],
  strobes: [
    { x: W.span / 2 + 0.03, y: TIP_Y + 0.04, z: W.root.le - 1.2 },
    { x: -(W.span / 2 + 0.03), y: TIP_Y + 0.04, z: W.root.le - 1.2 },
  ],
  beacons: [
    { x: 0, y: FIN_TOP.y + 0.04, z: FIN_TOP.le - 0.3 * FIN_TOP.chord },
    { x: 0, y: 0.92, z: -0.5 },
  ],
  landing: { x: 2.4, y: W.root.y + 2.4 * Math.tan(W.dihedral), z: W.root.le + 0.05 },
};

/** One posable node: the node, its rest rotation and position. */
type Joint = { node: THREE.Object3D; q0: THREE.Quaternion; p0: THREE.Vector3 };

/** The parts a frame poses, on the model or the stand-in. */
type Parts = {
  pose(p: PlaneState): void;
  materials: THREE.Material[];
  inside(on: boolean): void;
};

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const turn = new THREE.Quaternion();

function joint(node: THREE.Object3D): Joint {
  return { node, q0: node.quaternion.clone(), p0: node.position.clone() };
}

/** `j` turned `angle` about its own `axis` off its rest. */
function about(j: Joint | undefined, axis: THREE.Vector3, angle: number): void {
  if (!j) return;
  j.node.quaternion.copy(j.q0).multiply(turn.setFromAxisAngle(axis, angle));
}

/** THE MODEL's parts: its nodes by name, each turned off its rest. Every
 * hinge's local x runs along it, a positive turn lowering the trailing
 * edge (the rudder's: swinging it to the door's side, the engine's −x),
 * so the engine's signs come over as: the elevator as it is, the right
 * aileron (the door's side, −x) down for a positive aileron, the left
 * one up, the flaps down, the rudder reversed. The propeller turns about
 * its local z, which is the model's aft. */
function modelParts(root: THREE.Object3D, haze: HazeUniforms): Parts {
  const nodes = new Map<string, Joint>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const glass: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    if (Object.values(PLANE_NODES).includes(o.name as never)) nodes.set(o.name, joint(o));
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!(m instanceof THREE.MeshStandardMaterial) || materials.includes(m)) continue;
      hazeMaterial(m, haze, "plane");
      materials.push(m);
      if (/glass/i.test(m.name)) glass.push(m);
    }
  });
  const n = (k: keyof typeof PLANE_NODES) => nodes.get(PLANE_NODES[k]);
  const door = n("door");
  const extras = (door?.node.userData ?? {}) as { shut?: number[]; turn?: number };
  const shut = new THREE.Vector3(...(extras.shut ?? [0, 0, 0]));
  return {
    materials,
    pose(p) {
      about(n("prop"), Z, p.prop);
      about(n("elevator"), X, p.surfaces.elevator);
      about(n("rudder"), X, -p.surfaces.rudder);
      about(n("aileronR"), X, p.surfaces.aileron);
      about(n("aileronL"), X, -p.surfaces.aileron);
      const flap = p.surfaces.flaps * PLANE.controls.flaps;
      about(n("flapR"), X, flap);
      about(n("flapL"), X, flap);
      if (door) {
        const k = 1 - Math.max(0, Math.min(1, p.door));
        door.node.position.copy(door.p0).addScaledVector(shut, k);
        about(door, Y, (extras.turn ?? 0) * k);
      }
    },
    inside(on) {
      for (const g of glass) {
        g.transparent = on;
        g.opacity = on ? 0.12 : 1;
        g.depthWrite = !on;
        g.needsUpdate = true;
      }
    },
  };
}

/** THE STAND-IN's parts, its own signs (`plane-standin.ts`'s hinges). */
function standInParts(look: ReturnType<typeof createPlaneStandIn>): Parts {
  look.disc.visible = false;
  return {
    materials: look.materials,
    pose(p) {
      look.prop.rotation.z = -p.prop;
      look.elevator.rotation.x = -p.surfaces.elevator;
      look.rudder.rotation.y = -p.surfaces.rudder;
      look.ailerons[0].rotation.x = -p.surfaces.aileron;
      look.ailerons[1].rotation.x = p.surfaces.aileron;
      const flap = -p.surfaces.flaps * PLANE.controls.flaps;
      look.flaps[0].rotation.x = flap;
      look.flaps[1].rotation.x = flap;
    },
    inside: (on) => look.inside(on),
  };
}

export function createPlaneLook(haze: HazeUniforms, url = planeModelUrl()): PlaneLook {
  const group = new THREE.Group();
  group.name = "plane_look";
  const standIn = createPlaneStandIn(haze);
  group.add(standIn.group);
  let parts = standInParts(standIn);
  let colours = parts.materials.map((m) => (m as THREE.MeshStandardMaterial).color.clone());
  let charred = 0;
  let disposed = false;

  // THE BLUR DISC across the propeller's sweep, the model's and the
  // stand-in's alike.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(PLANE.prop.diameter / 2, 40),
    new THREE.MeshBasicMaterial({
      color: 0x2a2c30,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  disc.position.set(0, PLANE.prop.hub.y, PLANE.prop.hub.z + 0.02);
  disc.renderOrder = 8;
  group.add(disc);

  // THE LIGHTS as haloes over the model's own lamps.
  const halo = (colour: number, at: { x: number; y: number; z: number }, size: number) => {
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
    sprite.position.set(at.x, at.y, at.z);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 9;
    group.add(sprite);
    return sprite;
  };
  const navs = LIGHTS.navs.map((l) => halo(l.colour, l, 1.3));
  const strobes = LIGHTS.strobes.map((l) => halo(0xe8f4ff, l, 3));
  const beacons = LIGHTS.beacons.map((l) => halo(0xff2a10, l, 1.8));
  const sprites = [...navs, ...strobes, ...beacons];
  let lampMats: THREE.MeshStandardMaterial[] = [];
  let cockpit: PlaneCockpit | null = null;

  const ready = (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
    .then((gltf) => {
      if (disposed) return;
      // The model faces −z as glTF has it; the engine's nose is +z.
      gltf.scene.rotation.y = Math.PI;
      const next = modelParts(gltf.scene, haze);
      group.remove(standIn.group);
      group.add(gltf.scene);
      parts = next;
      // THE COCKPIT, off the model's own glass, in the airframe's frame.
      let body: THREE.Object3D | null = null;
      gltf.scene.traverse((o) => {
        if (o.name === PLANE_NODES.body) body = o;
      });
      if (body) {
        group.updateMatrixWorld(true);
        const back = group.matrixWorld.clone().invert();
        cockpit = createPlaneCockpit(body, (mesh) => back.clone().multiply(mesh.matrixWorld), haze);
        group.add(cockpit.group);
      }
      colours = parts.materials.map((m) => (m as THREE.MeshStandardMaterial).color.clone());
      lampMats = parts.materials.filter(
        (m): m is THREE.MeshStandardMaterial =>
          m instanceof THREE.MeshStandardMaterial && /lamp/i.test(m.name),
      );
      charred = -1;
    })
    .catch(() => undefined);

  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  const q = new THREE.Quaternion();
  return {
    group,
    ready,
    pose(p, clock, level, dt = 0) {
      parts.pose(p);
      if (cockpit && level) cockpit.update(p, level, clock, dt);
      disc.material.opacity = DISC * Math.max(0, Math.min(1, (p.spin - 0.2) / 0.6));
      const live = p.mode !== "wreck" && p.spin > 0.05;
      const flash = clock % 1 < 0.1;
      const beat = clock % 1.3;
      for (const n of navs) n.visible = live;
      for (const b of beacons) b.visible = live && flash;
      const strobe = live && !p.grounded && (beat < 0.05 || (beat > 0.14 && beat < 0.19));
      for (const s of strobes) s.visible = strobe;
      for (const m of lampMats) m.emissiveIntensity = live ? (flash ? 1.2 : 0.6) : 0.1;
    },
    char(k) {
      if (k === charred) return;
      parts.materials.forEach((m, i) => {
        if (m instanceof THREE.MeshStandardMaterial) m.color.copy(colours[i]).multiplyScalar(1 - k);
      });
      charred = k;
    },
    inside(on, own = on, near = false) {
      if (cockpit) cockpit.show(on, own, near);
      else parts.inside(on);
    },
    lamps(p, at, lit, out) {
      cockpit?.night(lit);
      if (lit <= 0 || p.mode === "wreck" || p.spin < 0.05) return;
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      v.set(LIGHTS.landing.x, LIGHTS.landing.y, LIGHTS.landing.z).applyQuaternion(q);
      d.set(0, -0.18, 1).normalize().applyQuaternion(q);
      out.push({
        x: at.x + v.x,
        y: at.y + v.y,
        z: at.z + v.z,
        dx: d.x,
        dy: d.y,
        dz: d.z,
        colour: [1, 0.96, 0.88],
        power: LANDING * lit,
      });
    },
    dispose() {
      disposed = true;
      cockpit?.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of parts.materials) m.dispose();
      for (const s of sprites) s.material.dispose();
      disc.material.dispose();
    },
  };
}
