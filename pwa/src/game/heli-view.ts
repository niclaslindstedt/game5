// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER AS DRAWN (`heli.ts`) — the Blender model (`make models`,
// `models/heli.glb`: `heli_body`, `heli_rotor` spun about its own up,
// `heli_tail_rotor` about its own right) hung on the engine's skid datum
// and attitude; both rotors as an eye sees them spool up (`rotor-look.ts`):
// the blades turning, smeared thin into a haze as they come up to speed,
// and the strobed ghost of them creeping backwards at full rpm; the
// anti-collision beacon and the nav lights; the PAD it
// stands on, painted on the valley's snow (a ring and an H) with a wind
// sock beside it — and, while it waits there for a skier, the machine and
// its pad LIT UP for him to ride to; the WRECK, the airframe TORN APART
// the moment it goes down (`heli-shatter.ts`: its own meshes cut into the
// pieces it comes apart in and flung off the blast, charring as they fly;
// `explosion.ts` burns them); and THE WASH it drives into the
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
import { createShatter, type ShatterHooks } from "./heli-shatter.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import { createRotorEye, type RotorLook } from "./rotor-look.ts";
import { heliModelUrl } from "./skier-models.ts";

const R = HELI.rotor.radius;
const TR = HELI.tail.radius;
/** The main rotor's turn at full speed, rad/s. */
const ROTOR_OMEGA = (HELI.rotor.rpm / 60) * 2 * Math.PI;
/** How near the parked machine a skier has to be for it to light up, m. */
const LIGHT_UP = 90;
/** The wash's puffs a second at full thrust over loose snow, under the
 * hover; the radius band they rise in, rotor radii. */
const WASH_RATE = 70;
const WASH_BAND = [0.6, 2.4] as const;
/** What a burnt airframe goes to: soot — and how long its paint takes to
 * char in the fire, s. */
const SOOT = new THREE.Color(0.035, 0.032, 0.03);
const CHAR = 1.6;

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
  update(
    state: GameState,
    alpha: number,
    dt: number,
    player: { x: number; z: number },
    hooks: ShatterHooks,
  ): void;
  /** The machine as drawn this frame — what the lens frames. */
  drawn(): { x: number; y: number; z: number; heading: number; q: THREE.Quaternion } | null;
  /** The way it was going before it went down, m/s (the engine stops a
   * wreck dead). */
  way(): THREE.Vector3;
  /** Throw this frame's wash into the snow cloud. */
  blow(state: GameState, dt: number, puff: WashPuff, loose: (x: number, z: number) => number): void;
  /** Resolved once the model is in the group (or the stand-in, should it
   * not load) — awaited before the run's programs are compiled, so none of
   * them is linked mid-ride. */
  ready: Promise<void>;
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
  // The blades' own material, named as the model's is, so the hand-over to
  // the drawn smear fades them alone.
  const blades = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.55, name: "rotor" }),
    haze,
    "heli",
  );
  const rotor = new THREE.Group();
  rotor.name = "heli_rotor";
  rotor.position.set(0, HELI.rotor.hub, HELI.rotor.at);
  for (let i = 0; i < HELI.rotor.blades; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, R), blades);
    blade.position.z = R / 2;
    const arm = new THREE.Group();
    arm.rotation.y = (i / HELI.rotor.blades) * Math.PI * 2;
    arm.add(blade);
    rotor.add(arm);
  }
  const tail = new THREE.Group();
  tail.name = "heli_tail_rotor";
  tail.position.set(HELI.tail.hub.x, HELI.tail.hub.y, HELI.tail.hub.z);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.03, TR * 2, 0.15), blades);
  tail.add(tb);
  // The model's own frame faces +z already here: wrap it as the glTF is.
  const turned = new THREE.Group();
  turned.add(body, rotor, tail);
  turned.rotation.y = Math.PI;
  g.add(turned);
  return g;
}

/** A rotor's blades as the shader draws them, in the rotor's own frame. */
type DiscSpec = {
  /** The tip's radius and where the blades start, m. */
  radius: number;
  root: number;
  /** The chord, m, and the share of it the tip tapers off, from `tipFrom`
   * (a share of the radius) out. */
  chord: number;
  taper: number;
  tipFrom: number;
  /** Where the painted tip band starts, a share of the radius (past 1 for
   * none). */
  band: number;
  blades: number;
  /** Blade 0's angle in the disc's plane, rad, and the way the smear
   * trails it: +1 toward a larger angle. */
  first: number;
  trail: 1 | -1;
};

const MAIN_DISC: DiscSpec = {
  radius: R,
  root: 0.5,
  chord: 0.35,
  taper: 0.4,
  tipFrom: (R - 0.35) / R,
  band: (R - 0.32) / R,
  blades: HELI.rotor.blades,
  first: -Math.PI / 2,
  trail: 1,
};
const TAIL_DISC: DiscSpec = {
  radius: TR,
  root: 0.1,
  chord: 0.18,
  taper: 0.11,
  tipFrom: 0,
  band: 2,
  blades: HELI.tail.blades,
  first: Math.PI / 2,
  trail: -1,
};

/** THE SMEAR: each blade's ink spread over the arc it sweeps in one
 * picture (`RotorLook.smear`), the pattern faded toward an even haze as the
 * strobe dissolves it (`contrast`). A blade covers its own width of disc
 * whatever it is smeared over, so the wedges thin as they widen and a rotor
 * at speed is a faint haze — darkest at the root, where the blade is widest
 * for its radius, with the painted tips a ring at its rim. */
function rotorDisc(d: DiscSpec): THREE.Mesh {
  const f = (v: number): string => v.toFixed(5);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uSmear: { value: 0 },
      uContrast: { value: 1 },
      uBlade: { value: new THREE.Color(0.05, 0.052, 0.056) },
      uTip: { value: new THREE.Color(0.5, 0.05, 0.06) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      void main() {
        vAt = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uSmear;
      uniform float uContrast;
      uniform vec3 uBlade;
      uniform vec3 uTip;
      varying vec2 vAt;
      const float GAP = ${f((2 * Math.PI) / d.blades)};
      void main() {
        float m = length(vAt);
        float r = m / ${f(d.radius)};
        if (r > 1.0 || m < ${f(d.root)}) discard;
        // Where this point is behind the nearest blade, along the way the
        // smear trails it.
        float a = atan(vAt.y, vAt.x);
        float behind = mod(${f(d.trail)} * (a - ${f(d.first)}), GAP);
        float chord = ${f(d.chord)} * (1.0 - ${f(d.taper)} * smoothstep(${f(d.tipFrom)}, 1.0, r));
        float hw = 0.5 * chord / m;
        // A blade narrower than a pixel is drawn a pixel wide and as much
        // fainter, so a far rotor neither shimmers nor vanishes.
        float pixel = length(fwidth(vAt));
        float drawn = max(hw, 0.7 * pixel / m);
        float smear = max(uSmear, 1e-4);
        // Each blade's width swept over [0, smear] behind it: the share of
        // the picture this point is under a blade — the blade's own, and
        // the trails of the blades ahead where the smear reaches them.
        float cover = 0.0;
        for (int k = -1; k <= 2; k++) {
          float b = behind + float(k) * GAP;
          cover += max(min(b + drawn, smear) - max(b - drawn, 0.0), 0.0);
        }
        cover *= hw / (drawn * smear);
        cover = mix(2.0 * hw / GAP, cover, uContrast);
        float rim = 1.0 - smoothstep(1.0 - pixel / ${f(d.radius)}, 1.0, r);
        // Read stronger than the ink alone, as a disc reads against the
        // snow: a blade's share of a picture lifted and eased, so the haze
        // at speed is a grey sheet and its ghost wedges still show.
        float alpha = uOpacity * rim * pow(clamp(2.5 * cover, 0.0, 1.0), 0.6);
        gl_FragColor = vec4(r > ${f(d.band)} ? uTip : uBlade, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(d.radius, 96), material);
  disc.renderOrder = 5;
  disc.visible = false;
  return disc;
}

/** Sets a disc to this frame's look. */
function lookDisc(disc: THREE.Mesh, look: RotorLook, on: boolean): void {
  const u = (disc.material as THREE.ShaderMaterial).uniforms;
  u.uOpacity.value = look.disc;
  u.uSmear.value = Math.min(look.smear, 9);
  u.uContrast.value = look.contrast;
  disc.visible = on && look.disc > 0.01;
}

/** The model's blades drawn as solid as `look.blades` says. Their materials
 * are transparent for good (`bladesOf`): toggled as the rotor spooled up,
 * each was a program of its own linked the moment he sat on the skid. */
function fadeBlades(meshes: THREE.Mesh[], look: RotorLook): void {
  const o = look.blades;
  for (const mesh of meshes) {
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.opacity = o;
    mesh.visible = o > 0.01;
    mesh.castShadow = o > 0.5;
  }
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
  let model: THREE.Object3D | null = null;
  const shatter = createShatter();
  group.add(shatter.group);
  let lampMats: THREE.MeshStandardMaterial[] = [];
  const allMats: THREE.Material[] = [];
  const originals = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  // The smears ride their rotors, turned with them: the main's flat under
  // its hub, the tail's in the plane its blades turn in.
  const disc = rotorDisc(MAIN_DISC);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  const tailDisc = rotorDisc(TAIL_DISC);
  tailDisc.rotation.y = Math.PI / 2;
  // The eye on each rotor: a blade's width as read two thirds of the way
  // out, where the eye reads a rotor's turn.
  const mainEye = createRotorEye({
    blades: HELI.rotor.blades,
    rpm: HELI.rotor.rpm,
    width: MAIN_DISC.chord / (0.6 * R),
  });
  const tailEye = createRotorEye({
    blades: HELI.tail.blades,
    rpm: HELI.tail.rpm,
    width: TAIL_DISC.chord / (0.6 * TR),
  });
  let mainBlades: THREE.Mesh[] = [];
  let tailBlades: THREE.Mesh[] = [];
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

  /** A rotor's blades (the `rotor` and the tip bands' `paint`), each on a
   * material of its own — the body shares them in the model — so they can
   * be faded as the smear takes over. */
  const bladesOf = (node: THREE.Object3D): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    node.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const m = o.material;
      if (!(m instanceof THREE.MeshStandardMaterial) || !/^(rotor|paint)/i.test(m.name)) return;
      if (/^paint/i.test(m.name)) {
        (disc.material as THREE.ShaderMaterial).uniforms.uTip.value.copy(m.color);
      }
      // Transparent from the start, drawn solid at an opacity of 1 (before
      // every effect, which all draw at a later `renderOrder`): the program
      // the spun-up rotor needs is the one compiled behind the loading card.
      const own = m.clone();
      own.transparent = true;
      o.material = own;
      out.push(o);
    });
    return out;
  };

  const adopt = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      if (o.name === "heli_rotor") {
        mainBlades = bladesOf(o);
        o.add(disc);
      }
      if (o.name === "heli_tail_rotor") {
        tailBlades = bladesOf(o);
        o.add(tailDisc);
      }
    });
    root.traverse((o) => {
      if (o.name === "heli_rotor") rotor = o;
      if (o.name === "heli_tail_rotor") tail = o;
      if (o instanceof THREE.Mesh && o !== disc && o !== tailDisc) {
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
    model = root;
  };
  // The Blender model where the build packs it (`heliModelUrl`), the code's
  // stand-in where it is switched off or will not load.
  const url = heliModelUrl();
  const ready = (url ? new GLTFLoader().loadAsync(url) : Promise.reject(new Error("no model")))
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
  let shown: { x: number; y: number; z: number; heading: number; q: THREE.Quaternion } | null =
    null;
  let clock = 0;
  let wrecked = false;
  // The way the machine was going and its rotor's turn before it went
  // down, for the pieces it comes apart in (the engine stops it dead).
  const vel = new THREE.Vector3();
  let spinWas = 0;
  let charred = 0;
  let washDebt = 0;
  // A stream of the wash's own, so a lab's frame is the same frame twice.
  let seed = 0x4e11;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const wash: Wash = { x: 0, y: 0, z: 0 };

  /** Each material's finish as built, put back when a wreck is cleared. */
  const finish = new Map<
    THREE.MeshStandardMaterial,
    { rough: number; metal: number; clear: number }
  >();

  /** THE WRECK: every surface burnt `k` of the way — dark, sooted, matte
   * at 1 — and back at 0. The pieces share these materials. */
  function blacken(k: number): void {
    if (k === charred) return;
    for (const [m, c] of originals) {
      if (!finish.has(m)) {
        const clear = m instanceof THREE.MeshPhysicalMaterial ? m.clearcoat : 0;
        finish.set(m, { rough: m.roughness, metal: m.metalness, clear });
      }
      const f = finish.get(m)!;
      m.color.copy(c).multiplyScalar(1 - 0.95 * k);
      m.color.lerp(SOOT, 0.6 * k);
      m.roughness = f.rough + (1 - f.rough) * k;
      m.metalness = f.metal * (1 - k);
      if (m instanceof THREE.MeshPhysicalMaterial) m.clearcoat = f.clear * (1 - k);
    }
    charred = k;
  }

  return {
    group,
    update(state, alpha, dt, player, hooks) {
      const h = state.heli;
      group.visible = !!h;
      if (!h) return;
      clock += dt;
      const wreck = h.mode === "wreck";
      if (wreck && !wrecked && model) {
        // IT COMES APART, from where it was last drawn in the air: the
        // machine as it stood, torn into its pieces and flung.
        machine.updateMatrixWorld(true);
        shatter.burst(machine, model, vel, spinWas);
      }
      if (!wreck && wrecked) {
        shatter.clear();
        blacken(0);
      }
      if (wreck !== wrecked) {
        wrecked = wreck;
        track.tick = -1;
      }
      // Charring as it burns.
      if (wreck) blacken(Math.min(1, h.t / CHAR));
      machine.visible = !wreck || !model;
      shatter.update(dt, (px, pz) => level.groundAt(px, pz), hooks);
      observe(track, { x: h.x, y: h.y, z: h.z, q: heliQuat(h) }, state.tick);
      sample(track, alpha, at);
      const { x, y, z } = at;
      if (!wreck) {
        vel.set(h.vx, h.vy, h.vz);
        spinWas = -h.spool * ROTOR_OMEGA;
      }
      machine.position.set(x, y, z);
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      machine.quaternion.copy(q);
      shown = { x, y, z, heading: h.heading, q };
      if (wreck && !model) {
        // The stand-in, should no model have loaded: down on its side.
        machine.rotateZ(0.55);
        machine.rotateX(0.12);
      }
      if (rotor) {
        rotor.rotation.x = wreck ? 0.32 : 0;
        rotor.rotation.z = wreck ? -0.22 : 0;
      }
      // THE ROTORS as the eye sees them (`rotor-look.ts`): each turned to
      // its strobed pattern, its blades handed over to the smear as they
      // blur. The pattern is the eye's, so it is stepped on the frame's
      // time, and stands still behind the pause card.
      const s = wreck ? 0 : h.spool;
      const main = mainEye.step(s, dt);
      const back = tailEye.step(s, dt);
      if (rotor) rotor.rotation.y = -main.phase;
      if (tail) tail.rotation.x = back.phase;
      // A wreck's blades are broken pieces (`heli-shatter.ts` shares their
      // materials), never a smear: drawn solid.
      fadeBlades(mainBlades, wreck ? { ...main, blades: 1 } : main);
      fadeBlades(tailBlades, wreck ? { ...back, blades: 1 } : back);
      lookDisc(disc, main, !wreck);
      lookDisc(tailDisc, back, !wreck);
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
    way() {
      return vel;
    },
    ready,
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
      shatter.dispose();
      (disc.material as THREE.Material).dispose();
      (tailDisc.material as THREE.Material).dispose();
      lampMats = [];
    },
  };
}
