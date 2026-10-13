// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP RACER, MODELLED: the one skier the game draws as a Blender
// model rather than cut in code (`make blender KIND=racer`, `racer.py`) —
// a printed one-piece race suit over a back protector, the bib, the shin,
// arm and hand guards and a slalom helmet with its chin guard. He is worn
// as the BODY row's RACER on the DRESS card (`outfit.ts`), and drawn by
// `skier-dress.ts` in place of the code's cloth on the very skeleton the
// code's dress is skinned on: his skin was laid in the same bind pose
// (`dress-loft.ts`' `bindPose`) and is weighted to the same bones, by
// name, so every pose, clip and animation the game plays moves him bone
// for bone, unchanged.
//
// WHAT THE AIR DOES TO HIM is the shader's (`graftWind`): his bib is a
// tabard open at the sides, so its hem and free edges stream back in the
// air past him and flutter in waves running down it, the faster he goes; his
// suit is skin tight, so what it does is SHIVER — wrinkles running down its
// lee side, where the flow leaves it, shown as much by the light on them as
// by the cloth's own move. And the bib HANGS: its weight is what keeps it on
// him, so in the air, falling with him, it FLOATS up off his chest and back,
// and on a landing it slaps down and bounces (`RacerWind.float`, one damped
// spring a racer). All of it reads his own motion — the chest bone's world
// place from frame to frame, on the RUN'S clock (`setRacerClock`), so a
// pause holds it, a slow replay slows it and a lab's stepped run shows it —
// turned into the frame his chest was bound in, so the bib streams back
// whichever way he is folded.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame } from "./skier-rig.ts";

/** THE WIND'S NUMBERS: how the bib and the suit answer the air. */
export const RACER_WIND = {
  /** The airflow, m/s, at which the bib streams fully back. */
  full: 22,
  /** How far its hem streams back at full stream, m, and flutters off the
   * suit along its normal. */
  stream: 0.075,
  flutter: 0.03,
  /** The flutter's beat, rad/s, at rest and gained per m/s of air; how fast
   * its waves run down the bib, rad/m. */
  beat: 8,
  beatPerMs: 0.5,
  wave: 18,
  /** The suit's lee-side wrinkles: their height, m, at full shiver; their
   * spacing, m; the airflow, m/s, they start and are full at; how steeply
   * the light reads their slope. */
  ripple: 0.0022,
  rippleSpacing: 0.075,
  rippleFrom: 7,
  rippleFull: 34,
  rippleLight: 1.8,
  /** How quickly the airflow and his acceleration read off his motion
   * settle, 1/s. */
  settle: 6,
  shake: 24,
  /** THE BIB'S HANG, a damped spring on how much his weight holds it down:
   * its natural beat, rad/s, its damping ratio; how far it floats off him at
   * a full float, m, and how far it rises up him. */
  hang: 13,
  damp: 0.2,
  lift: 0.06,
  rise: 0.035,
} as const;

/** THE WIND'S CLOCK: the run's own time as last drawn, s (`setRacerClock`,
 * called by the renderer with `state.t` every frame). It stands while
 * nothing draws a run — the cards, a lab's still — and the cloth then rests. */
let clock = 0;

/** The run's time the racer's cloth is moved by, s. */
export function setRacerClock(t: number): void {
  clock = t;
}

/** One part of the model: its geometry in the body frame's bind pose,
 * skinned on `SKIER_BONES`, and its material as the model made it. */
export type RacerPart = {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** Whether the air moves it (the bib's flutter, the suit's ripple). */
  wind: "bib" | "suit" | null;
};

/** WHAT A DISCIPLINE WEARS: a slalom racer the whole kit (the shin guards
 * he knocks the poles off with, the knuckle shields, the chin guard); a giant
 * slalom racer only the arm pads; a speed racer none of it. */
export type RacerKit = "slalom" | "gs" | "speed";

const GATE_KIT = ["shin_guard", "guard_edge", "guard_strap", "shield", "chin_guard"];

/** The parts a kit leaves off, by the model's material names. */
export const KIT_PARTS: Record<RacerKit, ReadonlySet<string>> = {
  slalom: new Set(),
  gs: new Set(GATE_KIT),
  speed: new Set([...GATE_KIT, "arm_guard"]),
};

let loaded: RacerPart[] | null = null;
let loading: Promise<void> | null = null;

/** The model's parts once `loadRacer` has fetched them, else `null` (the
 * RACER body is then the code's dressed skier). */
export function racerParts(): RacerPart[] | null {
  return loaded;
}

/** Fetch the racer once from `url` (`skier-models.ts`'s `racerModelUrl`,
 * `null` when the build packs none); resolves when he is in (or given up on). */
export function loadRacer(url: string | null): Promise<void> {
  if (loading) return loading;
  if (!url) return (loading = Promise.resolve());
  loading = new GLTFLoader().loadAsync(url).then(
    (g) => {
      loaded = racerFrom(g.scene);
    },
    () => undefined,
  );
  return loading;
}

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** HOW FREE A POINT OF THE BIB IS (0 pinned, 1 its loose hem's corner):
 * the bib hangs off his shoulders and lies on his chest and back, so it is
 * held at the top and free toward its hem, freest at its open sides. */
export function bibFreedom(p: THREE.Vector3, chest: BoneFrame, pelvis: BoneFrame): number {
  const top = chest.head.y + chest.y.y * chest.length * 0.75;
  const hem = pelvis.head.y + 0.02;
  const down = smoothstep((top - p.y) / Math.max(0.1, top - hem));
  const across = Math.min(1, Math.abs(p.x) / 0.16);
  return down ** 1.4 * (0.55 + 0.45 * across * across);
}

/** The model's skinned meshes, read off its glTF scene into the body
 * frame (the glTF's frame turned half round about y) and its joints
 * renamed to `SKIER_BONES`' order. */
export function racerFrom(scene: THREE.Object3D): RacerPart[] {
  scene.updateMatrixWorld(true);
  const bind = bindPose().frames;
  const flip = new THREE.Matrix4().makeRotationY(Math.PI);
  const parts: RacerPart[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const src = o.geometry as THREE.BufferGeometry;
    const g = new THREE.BufferGeometry();
    const toBody = flip.clone().multiply(o.bindMatrix);
    const pos = src.getAttribute("position").clone() as THREE.BufferAttribute;
    pos.applyMatrix4(toBody);
    g.setAttribute("position", pos);
    const nrm = src.getAttribute("normal").clone() as THREE.BufferAttribute;
    nrm.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(toBody));
    g.setAttribute("normal", nrm);
    const uv = src.getAttribute("uv");
    if (uv) g.setAttribute("uv", uv.clone());
    // The joints by name: the model's skeleton to the game's.
    const names = o.skeleton.bones.map((b) => b.name);
    const index = names.map((n) => (SKIER_BONES as readonly string[]).indexOf(n));
    const si = src.getAttribute("skinIndex");
    const sw = src.getAttribute("skinWeight");
    const idx = new Uint16Array(si.count * 4);
    const wts = new Float32Array(si.count * 4);
    for (let i = 0; i < si.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const j = index[si.getComponent(i, k)] ?? -1;
        const w = j < 0 ? 0 : sw.getComponent(i, k);
        idx[i * 4 + k] = Math.max(0, j);
        wts[i * 4 + k] = w;
        sum += w;
      }
      for (let k = 0; k < 4; k++) wts[i * 4 + k] /= sum || 1;
      if (!sum) wts[i * 4] = 1;
    }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wts, 4));
    if (src.index) g.setIndex(src.index.clone());
    const material = (o.material as THREE.MeshStandardMaterial).clone();
    const name = material.name;
    const wind = name === "bib" ? "bib" : name === "suit" ? "suit" : null;
    // A white vertex colour under the print, so blood soaks into the suit as
    // into the code's cloth (`gore-soak.ts`).
    const white = new Float32Array(pos.count * 3).fill(1);
    g.setAttribute("color", new THREE.BufferAttribute(white, 3));
    material.vertexColors = true;
    // How free each point is in the air.
    const free = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      free[i] = wind === "bib" ? bibFreedom(v, bind.chest, bind.pelvis) : wind === "suit" ? 1 : 0;
    }
    g.setAttribute("flap", new THREE.BufferAttribute(free, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.2);
    if (name === "bib") material.side = THREE.DoubleSide;
    parts.push({ name, geometry: g, material, wind });
  });
  return parts;
}

/** The wind's uniforms, one set a dressed racer. */
export type RacerWind = {
  uniforms: {
    uAir: { value: THREE.Vector3 };
    uTime: { value: number };
    uFloat: { value: number };
  };
  /** Read his airflow and his weight off the skeleton's world place: call
   * once a frame after the pose is laid. */
  update(group: THREE.Object3D, chest: THREE.Bone): void;
};

const G = 9.81;

/** THE AIRFLOW past him and THE BIB'S HANG, taken off his own motion: the
 * chest bone's world velocity, smoothed, turned into the frame his chest was
 * bound in; and how hard his weight holds the bib down — gravity less his
 * acceleration, along the world's down — driving one damped spring. */
export function createRacerWind(): RacerWind {
  const uniforms = {
    uAir: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uFloat: { value: 0 },
  };
  const last = new THREE.Vector3();
  const here = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const was = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const air = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const bindQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const c = bindPose().frames.chest;
  basis.makeBasis(
    new THREE.Vector3(c.x.x, c.x.y, c.x.z),
    new THREE.Vector3(c.y.x, c.y.y, c.y.z),
    new THREE.Vector3(c.z.x, c.z.y, c.z.z),
  );
  bindQ.setFromRotationMatrix(basis);
  let at = Number.NaN;
  let fresh = true;
  // The spring: how far the bib floats (1 a full float, below 0 slapped
  // down), and how fast.
  let s = 0;
  let sv = 0;
  const W = RACER_WIND;
  return {
    uniforms,
    update(group, chest) {
      if (clock === at) return;
      chest.getWorldPosition(here);
      const dt = Number.isNaN(at) ? 0 : clock - at;
      at = clock;
      uniforms.uTime.value = clock % 1000;
      if (dt <= 0 || dt > 0.25) {
        // A cut, a restart or a run begun: start from rest here.
        last.copy(here);
        fresh = true;
        return;
      }
      vel.copy(here).sub(last).divideScalar(dt);
      last.copy(here);
      if (vel.lengthSq() > 120 * 120) {
        fresh = true;
        return;
      }
      if (fresh) {
        was.copy(vel);
        acc.set(0, 0, 0);
        fresh = false;
      }
      // His acceleration, smoothed over a few frames (a drawn run is eased
      // between the engine's steps, so its second difference is rough).
      acc.lerp(was.sub(vel).negate().divideScalar(dt), 1 - Math.exp(-W.shake * dt));
      was.copy(vel);
      // The air past him is his motion reversed, smoothed over a few frames.
      air.lerp(vel.clone().negate(), 1 - Math.exp(-W.settle * dt));
      // Into the group's frame, then out of the chest's present turn into
      // the turn it was bound in.
      group.getWorldQuaternion(q).invert();
      const local = uniforms.uAir.value.copy(air).applyQuaternion(q);
      local.applyQuaternion(q.copy(chest.quaternion).invert()).applyQuaternion(bindQ);
      // THE HANG: 1 standing on the snow, 0 falling free, past 1 on a
      // landing — and the spring after it, stepped in short steps.
      const hold = (G + acc.y) / G;
      const target = Math.max(-1.5, Math.min(1, 1 - hold));
      for (let left = dt; left > 0; left -= 1 / 240) {
        const h = Math.min(left, 1 / 240);
        sv += (W.hang * W.hang * (target - s) - 2 * W.damp * W.hang * sv) * h;
        s += sv * h;
      }
      s = Math.max(-1.5, Math.min(1.4, s));
      uniforms.uFloat.value = s;
    },
  };
}

/** The wind's graft on a part's material, after the world's own wrap: the
 * bib streamed back, fluttering and floating, the suit shivering on its lee
 * side. */
export function graftWind(material: THREE.Material, kind: "bib" | "suit", wind: RacerWind): void {
  const inner = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:racer-${kind}`;
  const W = RACER_WIND;
  const f = (n: number) => n.toFixed(5);
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uAir = wind.uniforms.uAir;
    shader.uniforms.uTime = wind.uniforms.uTime;
    shader.uniforms.uFloat = wind.uniforms.uFloat;
    // The air's direction and strength, read before the normal is laid.
    const air = `
  float air = length(uAir);
  vec3 wd = air > 0.05 ? uAir / air : vec3(0.0);`;
    // THE SUIT'S SHIVER: wrinkles across the flow, running down it, on the
    // lee side only — the normal tipped by their slope, so the light shows
    // them where the move itself is a couple of millimetres.
    const shiver = `${air}
  float lee = max(0.0, dot(objectNormal, wd));
  float shv = flap * lee * smoothstep(${f(W.rippleFrom)}, ${f(W.rippleFull)}, air);
  float kk = ${f((2 * Math.PI) / W.rippleSpacing)};
  float wph = dot(position, wd) * kk - uTime * (${f(W.beat * 2)} + air * ${f(W.beatPerMs * 3)})
    + sin(dot(position, vec3(9.0, 17.0, 5.0))) * 2.0;
  vec3 slope = wd - objectNormal * dot(wd, objectNormal);
  objectNormal = normalize(objectNormal - slope * shv * ${f(W.rippleLight * W.ripple)} * kk * cos(wph));`;
    const bibFree = `${air}
  // The windward cloth is pressed onto him and keeps still; the lee side
  // lifts off and streams with the air, and only OUT, never into the suit.
  float lee = smoothstep(-0.2, 0.6, dot(objectNormal, wd));
  float a = flap * lee * smoothstep(0.0, ${f(W.full)}, air);
  float fl = flap * uFloat;
  float ph = uTime * (${f(W.beat)} + air * ${f(W.beatPerMs)}) - position.y * ${f(W.wave)} + position.x * 13.0;
  float lift = max(0.0, fl);
  objectNormal = normalize(objectNormal + vec3(0.0, 1.0, 0.0) * (a + lift) * 0.35 * cos(ph));`;
    const header = `#include <common>
attribute float flap;
uniform vec3 uAir;
uniform float uTime;
uniform float uFloat;`;
    if (kind === "suit") {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", header)
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>${shiver}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
  transformed += normal * shv * ${f(W.ripple)} * sin(wph);`,
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", header)
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>${bibFree}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
  transformed += wd * a * ${f(W.stream)} * (0.75 + 0.25 * sin(ph * 0.47));
  transformed += normal * (a + lift * 0.6) * ${f(W.flutter)} * (0.5 + 0.5 * sin(ph)) * (0.4 + 0.6 * max(a, lift));
  // THE HANG: floated off him and up in the air, slapped down after.
  transformed += normal * lift * ${f(W.lift)} + vec3(0.0, 1.0, 0.0) * fl * ${f(W.rise)};`,
        );
    }
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
