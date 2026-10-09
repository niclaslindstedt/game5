// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE AS DRAWN — one big tracked snow groomer at the largest
// class's true size: the Blender model (`make models KIND=groomer`,
// `models/groomer.glb`, `GROOMER_NODES`), one copy of it a machine, hung on
// the engine's `GroomerState` and posed off it every frame — or, switched
// back (`VITE_MODEL_GROOMER=0`) or should the file not load, the code's
// stand-in (`groomer-build.ts`), posed alike. The BLADE rides on the snow
// and is lifted about its hinge on a pivot or backing up, the
// TILLER lifted about its hitch whenever it is up, the snow HEAP shown
// rolling ahead of the blade while it works, the BELTS run at its speed (the
// cleats' `run` morph), the BEACON's reflector turned.
//
// And the LAMPS' glow: a halo over every lens the class layout puts on it
// (`groomer-look.ts`, where the model has its lenses), seen from its front;
// a wide soft bloom over each bar, the dazzle a bank of LEDs throws in the
// night air; the beacon's flash sweeping round. The blade's and the
// tiller's halos ride their parts. The light they throw on the snow is the
// scene's (`groomer-scene.ts`, off the same points).
//
// The frame is the engine's (`defs/groomer.ts`): x right, y up, z forward,
// the origin on the snow under the middle of the tracks. Presentation only.

import * as THREE from "three";
import type { GroomerState } from "@engine";

import { buildGroomer, type GroomerBody, type GroomerPaint } from "./groomer-build.ts";
import { GROOMER_LAMPS, GROOMER_LOOK } from "./groomer-look.ts";
import { glow } from "./glow-sprite.ts";
import { GROOMER_NODES } from "./skier-models.ts";
import { mergeCasters } from "./sled-view.ts";

const LOOK = GROOMER_LOOK;
/** How far the blade is lifted on a pivot or backing up, rad about its hinge
 * (its tips some 0.35 m off the snow), and the tiller about its hitch
 * (its drum some 0.3 m up); how fast either moves, rad/s. */
const BLADE_UP = 0.18;
const TILLER_UP = 0.27;
const LIFT_RATE = 0.35;
const ZERO = new THREE.Vector3();

export type GroomerView = {
  group: THREE.Group;
  /** Pose it off the engine at `t` (the run's clock), `dt` the frame. */
  update(g: GroomerState, t: number, dt: number): void;
  /** Light its glow at `lit` (0 day … 1 night), seen from `eye`. */
  light(lit: number, eye: THREE.Vector3): void;
  /** The drawn machine, for the lens: its place and attitude. */
  drawn(): { x: number; y: number; z: number; heading: number; pitch: number; roll: number };
  /** The beacon's beam's heading this frame, world. */
  beaconHeading(): number;
  /** Drawn at the fleet's far cut (`groomer-far.ts`) instead: its own
   * body hidden and left unposed, its glow still its own. */
  setFar(far: boolean): void;
  dispose(): void;
};

/** A copy of the model's scene posed by its nodes, as a `GroomerBody`. */
function modelBody(scene: THREE.Object3D, made: THREE.Material[]): GroomerBody {
  const find = (name: string): THREE.Object3D | null => scene.getObjectByName(name) ?? null;
  let cleats: THREE.Mesh | null = null;
  find(GROOMER_NODES.cleats)?.traverse((o) => {
    if (o instanceof THREE.Mesh && o.morphTargetInfluences?.length) cleats = o;
  });
  let pitch: number = LOOK.belt.pitch;
  scene.traverse((o) => {
    if (typeof o.userData.cleatPitch === "number") pitch = o.userData.cleatPitch;
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });
  for (const name of Object.values(GROOMER_NODES)) {
    const node = find(name);
    if (node) mergeCasters(node, made);
  }
  const heap = find(GROOMER_NODES.heap);
  heap?.traverse((o) => {
    o.castShadow = false;
  });
  return {
    root: scene,
    blade: find(GROOMER_NODES.blade),
    tiller: find(GROOMER_NODES.tiller),
    heap,
    beacon: find(GROOMER_NODES.beacon),
    run(metres) {
      const c = cleats as THREE.Mesh | null;
      if (c?.morphTargetInfluences) {
        c.morphTargetInfluences[0] = (((metres / pitch) % 1) + 1) % 1;
      }
    },
  };
}

export function createGroomerView(
  paint: GroomerPaint,
  model: Promise<THREE.Object3D | null>,
): GroomerView {
  const own: THREE.Material[] = [];
  const group = new THREE.Group();
  group.name = "piste-machine";
  group.rotation.order = "YXZ";
  let body: GroomerBody | null = null;
  let code: ReturnType<typeof buildGroomer> | null = null;
  let disposed = false;
  let far = false;

  // The blade's and the tiller's pivots, which their halos ride.
  const bladeHold = new THREE.Group();
  bladeHold.position.set(0, LOOK.blade.hinge.y, LOOK.blade.hinge.z);
  const tillerHold = new THREE.Group();
  tillerHold.position.set(0, LOOK.tiller.hitch.y, LOOK.tiller.hitch.z);
  group.add(bladeHold, tillerHold);

  model.then((tpl) => {
    if (disposed) return;
    if (tpl) {
      body = modelBody(tpl.clone(true), own);
    } else {
      code = buildGroomer(paint);
      body = code;
    }
    body.root.visible = !far;
    group.add(body.root);
  });

  // ── THE GLOW over every lens, seen from its front.
  const halos: { s: THREE.Sprite; way: THREE.Vector3; bloom?: boolean }[] = [];
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
  for (const l of LOOK.lamps) {
    const way =
      l.face === "side"
        ? new THREE.Vector3(Math.sign(l.x), -0.2, 0)
        : new THREE.Vector3(0, -0.25, l.face === "front" ? 1 : -1);
    way.normalize();
    const s = sprite(0xf0f6ff, l.glow);
    const hold = l.bar === "blade" ? bladeHold : l.bar === "tiller" ? tillerHold : group;
    s.position
      .set(l.x, l.y, l.z)
      .addScaledVector(way, 0.08)
      .sub(hold === group ? ZERO : hold.position);
    hold.add(s);
    halos.push({ s, way });
  }
  // THE GLARE: one wide soft bloom over each roof bar.
  const F = GROOMER_LAMPS.front;
  const R = GROOMER_LAMPS.rear;
  for (const [y, z, face, size] of [
    [F.y, F.z + 0.6, 1, 8],
    [R.y, R.z - 0.5, -1, 5],
  ] as const) {
    const s = sprite(0xe4eeff, size);
    s.position.set(0, y, z);
    group.add(s);
    halos.push({ s, way: new THREE.Vector3(0, -0.3, face).normalize(), bloom: true });
  }
  // ── THE BEACON's flash, turning, and the glow in its dome.
  const B = GROOMER_LAMPS.beacon;
  const spin = new THREE.Group();
  spin.position.set(B.x, B.y, B.z);
  group.add(spin);
  const flash = sprite(0xff9a20, 3.6);
  flash.position.set(0, 0, 0.16);
  spin.add(flash);
  const glowBall = sprite(0xff8a10, 0.8);
  glowBall.position.set(B.x, B.y, B.z);
  group.add(glowBall);

  let run = 0;
  let beacon = 0;
  let bladeLift = 0;
  let tillerLift = 0;
  const toEye = new THREE.Vector3();
  const way = new THREE.Vector3();
  const at = new THREE.Vector3();
  const drawn = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 };
  const ease = (from: number, to: number, dt: number) =>
    from + THREE.MathUtils.clamp(to - from, -LIFT_RATE * dt, LIFT_RATE * dt);
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
      // The blade on the snow but on a pivot or backing up; the tiller down
      // while it combs.
      const up = g.mode === "turn" || (g.mode === "ridden" && g.speed < -0.3);
      bladeLift = ease(bladeLift, up ? BLADE_UP : 0, dt);
      tillerLift = ease(tillerLift, g.tiller ? 0 : TILLER_UP, dt);
      bladeHold.rotation.x = -bladeLift;
      tillerHold.rotation.x = tillerLift;
      run += g.speed * dt;
      // The beacon turns a revolution a second and a bit, flashing round.
      beacon = (t * Math.PI * 2.2) % (Math.PI * 2);
      spin.rotation.y = beacon;
      if (body && !far) {
        if (body.blade) body.blade.rotation.x = -bladeLift;
        if (body.tiller) body.tiller.rotation.x = tillerLift;
        if (body.heap) body.heap.visible = g.tiller && g.speed > 0.5;
        if (body.beacon) body.beacon.rotation.y = beacon;
        body.run(run);
      }
      group.updateMatrixWorld();
    },
    light(lit, eye) {
      const on = 0.25 + 0.75 * lit;
      for (const h of halos) {
        h.s.getWorldPosition(at);
        way.copy(h.way).transformDirection(h.s.parent!.matrixWorld);
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
    setFar(next) {
      far = next;
      if (body) body.root.visible = !far;
    },
    dispose() {
      disposed = true;
      code?.dispose();
      // The shadow casters merged for this copy are its own; the rest of
      // the copy's geometry is the model's, shared.
      if (!code) {
        body?.root.traverse((o) => {
          if (o instanceof THREE.Mesh && o.name.endsWith("-caster")) o.geometry.dispose();
        });
      }
      for (const m of own) m.dispose();
    },
  };
}
