// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER AS DRAWN (`heli.ts`) — the Blender model (`make models`,
// `models/heli.glb`: `heli_body`, `heli_rotor` spun about its own up,
// `heli_tail_rotor` about its own right) hung on the engine's skid datum
// and attitude; the main rotor's blades thinning into a BLUR DISC as they
// come up to speed, the way an eye and a camera see a rotor turning six
// times a second; the anti-collision beacon and the nav lights; the PAD it
// stands on, painted on the valley's snow (a ring and an H) with a wind
// sock beside it — and, while it waits there for a skier, the machine and
// its pad LIT UP for him to ride to; the WRECK, black and broken where it
// came down (`explosion.ts` burns it); and THE WASH it drives into the
// snow under it, thrown up as cloud (`heli-wash.ts`'s field, the snow
// cloud's puffs), which turns a hover over powder into a whiteout.
//
// Presentation only: it reads `GameState.heli` and writes nothing back.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  HELI,
  heliQuat,
  helipadOf,
  inducedOf,
  washAt,
  type GameState,
  type HeliState,
  type Level,
  type Wash,
} from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import { heliModelUrl } from "./skier-models.ts";

const R = HELI.rotor.radius;
/** How near the parked machine a skier has to be for it to light up, m. */
const LIGHT_UP = 90;
/** The wash's puffs a second at full thrust over loose snow, under the
 * hover; the radius band they rise in, rotor radii. */
const WASH_RATE = 70;
const WASH_BAND = [0.6, 2.4] as const;
/** What a burnt airframe goes to: soot. */
const SOOT = new THREE.Color(0.035, 0.032, 0.03);

/** A puff the wash throws: where, its velocity, its size, m. */
export type WashPuff = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  size: number,
) => void;

export type HeliView = {
  group: THREE.Group;
  /** Draw the helicopter at the state's last step (eased toward it by
   * `alpha` from the step before); `player` is where the skier is drawn,
   * for the pad's lighting up. */
  update(state: GameState, alpha: number, dt: number, player: { x: number; z: number }): void;
  /** The machine as drawn this frame — what the lens frames. */
  drawn(): { x: number; y: number; z: number; heading: number } | null;
  /** Throw this frame's wash into the snow cloud. */
  blow(state: GameState, dt: number, puff: WashPuff, loose: (x: number, z: number) => number): void;
  dispose(): void;
};

/** A code-built stand-in, should the model not load: a body, a boom, the
 * skids and a rotor — so a missing file is a plain helicopter rather than
 * nothing to ride into. */
function standIn(haze: HazeUniforms): THREE.Group {
  const g = new THREE.Group();
  const paint = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.4 }),
    haze,
    "heli",
  );
  const dark = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.6 }),
    haze,
    "heli",
  );
  const body = new THREE.Group();
  body.name = "heli_body";
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), paint);
  cabin.scale.set(0.95, 0.85, 2.0);
  cabin.position.set(0, 1.55, 1.2);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 6, 10), paint);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 1.75, -3.6);
  body.add(cabin, boom);
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.1, 8), dark);
    skid.rotation.x = Math.PI / 2;
    skid.position.set((side * HELI.skid.track) / 2, HELI.skid.y, 0.05);
    body.add(skid);
  }
  const rotor = new THREE.Group();
  rotor.name = "heli_rotor";
  rotor.position.set(0, HELI.rotor.hub, HELI.rotor.at);
  for (let i = 0; i < HELI.rotor.blades; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, R), dark);
    blade.position.z = R / 2;
    const arm = new THREE.Group();
    arm.rotation.y = (i / HELI.rotor.blades) * Math.PI * 2;
    arm.add(blade);
    rotor.add(arm);
  }
  const tail = new THREE.Group();
  tail.name = "heli_tail_rotor";
  tail.position.set(HELI.tail.hub.x, HELI.tail.hub.y, HELI.tail.hub.z);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.03, HELI.tail.radius * 2, 0.15), dark);
  tail.add(tb);
  // The model's own frame faces +z already here: wrap it as the glTF is.
  const turned = new THREE.Group();
  turned.add(body, rotor, tail);
  turned.rotation.y = Math.PI;
  g.add(turned);
  return g;
}

/** THE BLUR DISC: a faint, streaked disc over the rotor's sweep, darker
 * toward the tips where the blades sweep fastest. */
function rotorDisc(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTurn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy / ${R.toFixed(2)};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTurn;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        if (r > 1.0 || r < 0.08) discard;
        float a = atan(vUv.y, vUv.x);
        // Three blades' worth of streak, smeared round the disc.
        float streak = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(3.0 * a - uTurn), 6.0);
        float tip = smoothstep(0.15, 0.95, r) * (1.0 - smoothstep(0.97, 1.0, r));
        gl_FragColor = vec4(vec3(0.07, 0.075, 0.08), uOpacity * streak * (0.25 + 0.75 * tip));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), material);
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 5;
  return disc;
}

/** THE PAD: a painted ring and an H on the snow, lamps round its rim, a
 * glow ring for lighting it up, and a wind sock off its edge. */
function padMarks(level: Level): {
  group: THREE.Group;
  glow: THREE.MeshBasicMaterial;
  lamps: THREE.MeshBasicMaterial;
  sock: THREE.Object3D;
} {
  const pad = helipadOf(level);
  const group = new THREE.Group();
  group.position.set(pad.x, pad.y + 0.04, pad.z);
  group.rotation.y = pad.heading;
  const paint = new THREE.MeshBasicMaterial({ color: 0xf2c418, transparent: true, opacity: 0.9 });
  const flat = (geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  const ring = flat(new THREE.RingGeometry(7.4, 8, 64), paint);
  group.add(ring);
  // The H, three bars, its legs along the way the machine faces.
  for (const [w, l, x] of [
    [0.7, 5, -1.6],
    [0.7, 5, 1.6],
    [3.2, 0.7, 0],
  ] as const) {
    const bar = flat(new THREE.PlaneGeometry(w, l), paint);
    bar.position.x = x;
    group.add(bar);
  }
  const glow = new THREE.MeshBasicMaterial({
    color: 0x7fe0ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = flat(new THREE.RingGeometry(8.2, 10, 64), glow);
  halo.position.y = 0.02;
  group.add(halo);
  const lamps = new THREE.MeshBasicMaterial({ color: 0x55ff88 });
  const lampGeo = new THREE.SphereGeometry(0.16, 8, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lamp = new THREE.Mesh(lampGeo, lamps);
    lamp.position.set(Math.sin(a) * 9, 0.12, Math.cos(a) * 9);
    group.add(lamp);
  }
  // The wind sock on its mast, off the pad's edge.
  const sock = new THREE.Group();
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 5, 8),
    new THREE.MeshBasicMaterial({ color: 0x9a9da3 }),
  );
  mast.position.y = 2.5;
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.12, 1.8, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff6a10, side: THREE.DoubleSide }),
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.set(0.9, 0, 0);
  const vane = new THREE.Group();
  vane.position.y = 4.9;
  vane.add(cone);
  sock.add(mast, vane);
  sock.position.set(-12, 0, -4);
  group.add(sock);
  return { group, glow, lamps, sock: vane };
}

export function createHeliView(level: Level, haze: HazeUniforms): HeliView {
  const group = new THREE.Group();
  group.name = "helicopter";
  const machine = new THREE.Group();
  group.add(machine);
  let rotor: THREE.Object3D | null = null;
  let tail: THREE.Object3D | null = null;
  let lampMats: THREE.MeshStandardMaterial[] = [];
  const allMats: THREE.Material[] = [];
  const originals = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  const disc = rotorDisc();
  disc.position.set(0, HELI.rotor.hub + 0.05, HELI.rotor.at);
  machine.add(disc);
  const marks = padMarks(level);
  group.add(marks.group);
  // THE LIGHTS as haloes, in the model's own frame (the glTF's: x its
  // right, y up, z aft): the red anti-collision beacons on the fin's top and
  // the belly, the nav lights at the stabiliser's tips — red to port, green
  // to starboard — and the white strobe that calls a skier to it.
  const lights = new THREE.Group();
  lights.rotation.y = Math.PI;
  machine.add(lights);
  const halo = (colour: number, x: number, y: number, z: number, size: number) => {
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
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 9;
    lights.add(sprite);
    return sprite;
  };
  // Where the builder (`scripts/blender/heli.py`) puts them: the beacon on
  // the fin's top strike point, the navs on the stabiliser's end plates.
  const finTop = HELI.body.strike.reduce((a, p) => (p.y > a.y ? p : a));
  const beacons = [
    halo(0xff2a10, 0, finTop.y + 0.02, -(HELI.body.tail + 0.17), 2.2),
    halo(0xff2a10, 0, 0.42, 0.45, 2),
  ];
  const stab = -(HELI.tail.hub.z + 1.35);
  const navs = [halo(0xff3020, -1.3, 1.85, stab, 1.2), halo(0x30ff60, 1.3, 1.85, stab, 1.2)];
  const strobe = halo(0xe8f4ff, 0, 2.1, 1.0, 6);
  let disposed = false;

  const adopt = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      if (o.name === "heli_rotor") rotor = o;
      if (o.name === "heli_tail_rotor") tail = o;
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          if (m instanceof THREE.MeshStandardMaterial) {
            hazeMaterial(m, haze, "heli");
            originals.set(m, m.color.clone());
            if (/lamp/i.test(m.name)) lampMats.push(m);
          }
          allMats.push(m);
        }
      }
    });
    machine.add(root);
  };
  // The Blender model where the build packs it (`heliModelUrl`), the code's
  // stand-in where it is switched off or will not load.
  const url = heliModelUrl();
  (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
    .then((gltf) => {
      if (disposed) return;
      // The model faces −z as glTF has it; the engine's nose is +z.
      gltf.scene.rotation.y = Math.PI;
      adopt(gltf.scene);
    })
    .catch(() => {
      if (!disposed) adopt(standIn(haze));
    });

  const q = new THREE.Quaternion();
  // Drawn between two steps on the RIDER'S own line (`interp.ts`), so the
  // skid he sits on never parts from under him between frames.
  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  let shown: { x: number; y: number; z: number; heading: number } | null = null;
  let clock = 0;
  let wrecked = false;
  let washDebt = 0;
  // A stream of the wash's own, so a lab's frame is the same frame twice.
  let seed = 0x4e11;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const wash: Wash = { x: 0, y: 0, z: 0 };

  /** Each material's finish as built, put back when a wreck is cleared. */
  const finish = new Map<THREE.MeshStandardMaterial, { rough: number; metal: number }>();

  /** THE WRECK: every surface burnt — dark, sooted, matte — and back. */
  function blacken(on: boolean): void {
    for (const [m, c] of originals) {
      if (!finish.has(m)) finish.set(m, { rough: m.roughness, metal: m.metalness });
      const f = finish.get(m)!;
      m.color.copy(c).multiplyScalar(on ? 0.05 : 1);
      if (on) m.color.lerp(SOOT, 0.6);
      m.roughness = on ? 1 : f.rough;
      m.metalness = on ? 0 : f.metal;
      if (m instanceof THREE.MeshPhysicalMaterial) m.clearcoat = on ? 0 : m.clearcoat;
    }
    wrecked = on;
  }

  return {
    group,
    update(state, alpha, dt, player) {
      const h = state.heli;
      group.visible = !!h;
      if (!h) return;
      clock += dt;
      observe(track, { x: h.x, y: h.y, z: h.z, q: heliQuat(h) }, state.tick);
      sample(track, alpha, at);
      const { x, y, z } = at;
      machine.position.set(x, y, z);
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      machine.quaternion.copy(q);
      shown = { x, y, z, heading: h.heading };
      const wreck = h.mode === "wreck";
      if (wreck !== wrecked) blacken(wreck);
      if (wreck) {
        // Down on its side, the rotor stopped, its mast bent over.
        machine.rotateZ(0.55);
        machine.rotateX(0.12);
      }
      if (rotor) {
        rotor.rotation.x = wreck ? 0.32 : 0;
        rotor.rotation.z = wreck ? -0.22 : 0;
      }
      // THE ROTORS: the blades drawn at a strobed turn as they come up to
      // speed, the disc thickening over them.
      const s = wreck ? 0 : h.spool;
      if (rotor) rotor.rotation.y = -(h.rotor * (1 - 0.93 * s * s));
      if (tail) tail.rotation.x = h.tailRotor * (1 - 0.9 * s);
      const dm = disc.material as THREE.ShaderMaterial;
      dm.uniforms.uOpacity.value = 0.55 * s * s;
      dm.uniforms.uTurn.value = clock * 9;
      disc.visible = s > 0.05;
      // THE LIGHTS: the beacon flashing while the rotor turns — and the
      // machine and its pad lit up for a skier near it with no rider on.
      const near = Math.hypot(player.x - h.x, player.z - h.z);
      const waiting = h.mode === "parked" && !h.rider && near < LIGHT_UP;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
      // The beacons flash once a second while the rotor turns or it waits
      // for him; the nav lights burn steady with the engine running; the
      // strobe double-flashes over a machine waiting for a skier.
      const live = !wrecked && (s > 0.05 || waiting);
      const flash = clock % 1 < 0.12;
      for (const b of beacons) b.visible = live && flash;
      for (const n of navs) n.visible = live;
      const beat = clock % 1.2;
      strobe.visible = !wrecked && waiting && (beat < 0.06 || (beat > 0.16 && beat < 0.22));
      for (const m of lampMats) {
        m.emissiveIntensity = live ? (flash ? 1.2 : 0.4) : 0.1;
      }
      marks.glow.opacity = waiting ? 0.25 + 0.5 * pulse : 0;
      marks.lamps.color.setRGB(0.2, waiting ? 0.6 + 0.4 * pulse : 0.45, 0.3);
      // The sock streams out down the wind.
      marks.sock.rotation.y = Math.sin(clock * 0.3) * 0.4;
    },
    drawn() {
      return shown;
    },
    blow(state, dt, puff, loose) {
      const h: HeliState | undefined = state.heli;
      if (!h || h.mode === "wreck" || h.thrust <= 0 || dt <= 0) return;
      const reach = HELI.wash.reach * 2 * R;
      const over = h.agl;
      if (over > reach) return;
      const lift = Math.min(1.4, h.thrust / (HELI.mass * 9.81));
      const k = lift * (1 - over / reach) ** 1.5;
      washDebt += WASH_RATE * k * dt;
      const vi = inducedOf(h.thrust);
      while (washDebt >= 1) {
        washDebt -= 1;
        const a = random() * Math.PI * 2;
        const r = R * (WASH_BAND[0] + (WASH_BAND[1] - WASH_BAND[0]) * random() ** 0.7);
        const px = h.x + Math.sin(a) * r;
        const pz = h.z + Math.cos(a) * r;
        const snow = loose(px, pz);
        if (random() > 0.25 + 0.75 * snow) continue;
        const g = state.level.groundAt(px, pz);
        washAt(state.level, h, px, g + 0.4, pz, wash);
        // Off the snow by its own size, so a puff's edge never cuts on it.
        const size = 1 + random() * 1.5;
        puff(
          px,
          g + 0.5 + size * 0.6,
          pz,
          wash.x * 0.7 + h.vx * 0.2,
          1 + random() * (1 + vi * 0.25),
          wash.z * 0.7 + h.vz * 0.2,
          size,
        );
      }
    },
    dispose() {
      disposed = true;
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of allMats) m.dispose();
      (disc.material as THREE.Material).dispose();
      lampMats = [];
    },
  };
}
