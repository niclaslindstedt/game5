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
// WHAT THE AIR AND HIS OWN MOTION DO TO HIM (`createRacerWind`, drawn by
// `graftWind`). His bib is a tabard open at the sides, pinned only over his
// shoulders, so it does three things a real one does on a racer:
//   * it SWINGS — its hem a damped pendulum hung off his chest, driven by
//     what his chest feels (its acceleration against gravity): thrown out
//     in a turn, dropped off his chest as he folds into a tuck, kicked on
//     a landing, settling after;
//   * it STREAMS and FLAGS — the lee side lifted off and laid back along
//     the air past him, a wave running down it from the shoulders to the
//     hem, faster the faster he goes, its slope shading the cloth;
//   * it BILLOWS — the air caught under the back panel's hem lifting it
//     off the back protector between its open sides.
// His suit is skin tight, so all it does is RIPPLE: fine waves running
// downstream over its lee side (his limbs most, the trunk over the
// protector least), seen as much in the light on it as in its shape.
// Everything reads his airflow — his own motion through still air, taken
// off the skeleton's world place frame by frame — turned into the frame
// his chest was bound in, so it acts the same whichever way he is folded;
// and all of it runs on the RUN'S CLOCK when there is a run (`clock`), so
// a slowed replay slows it and a held frame holds it.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame } from "./skier-rig.ts";

/** THE WIND'S NUMBERS: how the bib and the suit answer the air. */
export const RACER_WIND = {
  /** The airflow, m/s, at which the bib streams fully back. */
  full: 22,
  /** How far its hem streams back at full stream, m; how far it flags off
   * the suit along its normal; how far the back panel billows. */
  stream: 0.06,
  flutter: 0.032,
  billow: 0.04,
  /** The flag's beat, rad/s, at rest and gained per m/s of air, and the
   * wave's length down the panel, m. */
  beat: 9,
  beatPerMs: 0.55,
  wave: 0.24,
  /** The suit's lee-side ripple, m at full stream, its wave's length, m,
   * and its beat, rad/s, at rest and per m/s. */
  ripple: 0.0016,
  rippleWave: 0.055,
  rippleBeat: 26,
  rippleBeatPerMs: 1.4,
  /** How quickly the airflow read off his motion settles, 1/s. */
  settle: 6,
  /** THE SWING: the hem's pendulum — its natural frequency, Hz, its
   * damping ratio, how far it hangs per m/s² felt, m, the share of that
   * along his spine (the bib cannot stretch, only bunch), and the most it
   * swings, m. */
  swingHz: 2.1,
  swingDamp: 0.16,
  swingPer: 0.0042,
  swingUp: 0.3,
  swingMost: 0.075,
  /** How quickly the chest's acceleration read off his motion settles, 1/s. */
  feel: 24,
} as const;

/** One part of the model: its geometry in the body frame's bind pose,
 * skinned on `SKIER_BONES`, and its material as the model made it. */
export type RacerPart = {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** Whether the air moves it (the bib's flutter, the suit's ripple). */
  wind: "bib" | "suit" | null;
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

/** HOW FREE THE SUIT IS over a bone: loose enough to ripple over the
 * limbs, held flat over the back protector and the chest, not at all at
 * the hands, the feet and the head. */
export function suitFreedom(bone: string): number {
  if (/arm|thigh|shin|knee|elbow|hip|shoulder/.test(bone)) return 1;
  if (bone === "pelvis" || bone === "chest") return 0.4;
  return 0;
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
      free[i] =
        wind === "bib"
          ? bibFreedom(v, bind.chest, bind.pelvis)
          : wind === "suit"
            ? suitFreedom(SKIER_BONES[idx[i * 4]] ?? "pelvis")
            : 0;
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
    uSwing: { value: THREE.Vector3 };
    uTime: { value: number };
  };
  /** The run's clock, s, for the next `update` — `null` off a run (a card's
   * stage), when the wall clock is read instead. */
  clock(t: number | null): void;
  /** Read his airflow and what his chest feels off the skeleton's world
   * place: call once a frame after the pose is laid. */
  update(group: THREE.Object3D, chest: THREE.Bone, wall: number): void;
};

/** THE AIR AND THE SWING read off his own motion: the chest bone's world
 * velocity and acceleration, smoothed, turned into the frame his chest was
 * bound in; the bib's hem stepped as a damped pendulum on what the chest
 * feels. */
export function createRacerWind(): RacerWind {
  const W = RACER_WIND;
  const uniforms = {
    uAir: { value: new THREE.Vector3() },
    uSwing: { value: new THREE.Vector3() },
    uTime: { value: 0 },
  };
  const last = new THREE.Vector3();
  const now3 = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const lastVel = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const air = new THREE.Vector3();
  const felt = new THREE.Vector3();
  const target = new THREE.Vector3();
  const x = new THREE.Vector3();
  const xv = new THREE.Vector3();
  const pull = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const toBind = new THREE.Quaternion();
  const bindQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const c = bindPose().frames.chest;
  basis.makeBasis(
    new THREE.Vector3(c.x.x, c.x.y, c.x.z),
    new THREE.Vector3(c.y.x, c.y.y, c.y.z),
    new THREE.Vector3(c.z.x, c.z.y, c.z.z),
  );
  bindQ.setFromRotationMatrix(basis);
  const GRAVITY = 9.81;
  const w = 2 * Math.PI * W.swingHz;
  let runT: number | null = null;
  let at = -1;
  let fresh = true;
  const rest = (): void => {
    x.set(0, 0, 0);
    xv.set(0, 0, 0);
    acc.set(0, 0, 0);
    air.set(0, 0, 0);
    uniforms.uAir.value.set(0, 0, 0);
    uniforms.uSwing.value.set(0, 0, 0);
    fresh = true;
  };
  return {
    uniforms,
    clock(t) {
      runT = t;
    },
    update(group, chest, wall) {
      const now = runT ?? wall / 1000;
      chest.getWorldPosition(now3);
      const dt = at < 0 ? 0 : now - at;
      // Backwards (a restart, a replay rewound) or a long gap: laid at rest.
      if (at >= 0 && (dt < 0 || dt > 0.25)) rest();
      at = now;
      uniforms.uTime.value = now % 1000;
      if (!(dt > 0) || dt > 0.25) {
        last.copy(now3);
        return;
      }
      vel.copy(now3).sub(last).divideScalar(dt);
      last.copy(now3);
      // A teleport (a reset, the camera's cut to another skier) lays him at rest.
      if (vel.lengthSq() > 120 * 120) {
        rest();
        return;
      }
      if (fresh) lastVel.copy(vel);
      // What his chest feels: its acceleration, smoothed (a frame's
      // difference of a difference is noise), against gravity.
      const kA = 1 - Math.exp(-W.feel * dt);
      acc.lerp(pull.copy(vel).sub(lastVel).divideScalar(dt), fresh ? 0 : kA);
      lastVel.copy(vel);
      fresh = false;
      // The air past him is his motion reversed, smoothed over a few frames.
      const k = 1 - Math.exp(-W.settle * dt);
      air.lerp(pull.copy(vel).negate(), k);
      // World → the group's frame → out of the chest's present turn into the
      // turn it was bound in.
      group.getWorldQuaternion(q).invert();
      toBind.copy(chest.quaternion).invert().premultiply(bindQ);
      uniforms.uAir.value.copy(air).applyQuaternion(q).applyQuaternion(toBind);
      // The hem hangs along gravity less the acceleration, from where it
      // hangs stood still (straight down his chest, in the bind's frame).
      felt
        .set(-acc.x, -acc.y - GRAVITY, -acc.z)
        .applyQuaternion(q)
        .applyQuaternion(toBind);
      target.set(felt.x, (felt.y + GRAVITY) * W.swingUp, felt.z).multiplyScalar(W.swingPer);
      // The damped pendulum, stepped in pieces no longer than the engine's.
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        pull
          .copy(target)
          .sub(x)
          .multiplyScalar(w * w)
          .addScaledVector(xv, -2 * W.swingDamp * w);
        xv.addScaledVector(pull, h);
        x.addScaledVector(xv, h);
      }
      if (x.length() > W.swingMost) {
        x.setLength(W.swingMost);
        xv.multiplyScalar(0.5);
      }
      uniforms.uSwing.value.copy(x);
    },
  };
}

/** The wind's graft on a part's material, after the world's own wrap. The
 * bib's every point moved off the suit (never into it) and its normal
 * tilted with the flag's wave; the suit's lee side rippling, its normal
 * tilted the more. */
export function graftWind(material: THREE.Material, kind: "bib" | "suit", wind: RacerWind): void {
  const inner = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:racer-${kind}`;
  const W = RACER_WIND;
  const f = (n: number) => n.toFixed(5);
  const top = (() => {
    const b = bindPose().frames.chest;
    return b.head.y + b.y.y * b.length * 0.75;
  })();
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uAir = wind.uniforms.uAir;
    shader.uniforms.uSwing = wind.uniforms.uSwing;
    shader.uniforms.uTime = wind.uniforms.uTime;
    const body =
      kind === "bib"
        ? `
  float rAirS = length(uAir);
  vec3 rWd = rAirS > 0.05 ? uAir / rAirS : vec3(0.0);
  float rSp = smoothstep(0.0, ${f(W.full)}, rAirS);
  // The windward cloth is pressed onto him; the lee side lifts off.
  float rLee = smoothstep(-0.2, 0.6, dot(objectNormal, rWd));
  float rK = ${f((2 * Math.PI) / W.wave)};
  float rPh = uTime * (${f(W.beat)} + rAirS * ${f(W.beatPerMs)}) - rK * (${f(top)} - position.y) + position.x * 9.0;
  float rFl = flap * rSp * (0.3 + 0.7 * rLee) * ${f(W.flutter)};
  rWind = rWd * flap * rLee * rSp * ${f(W.stream)} * (0.8 + 0.2 * sin(rPh * 0.37));
  rWind += objectNormal * rFl * (0.55 + 0.45 * sin(rPh));
  // The air caught under the back panel's hem, lifting it off his back
  // between its open sides.
  float rMid = 1.0 - smoothstep(0.08, 0.2, abs(position.x));
  rWind += objectNormal * rLee * rSp * pow(flap, 0.7) * rMid * ${f(W.billow)} * (0.8 + 0.2 * sin(uTime * 2.7 + position.y * 5.0));
  // The swing: the hem's pendulum, never into the suit.
  vec3 rSw = uSwing * flap;
  rSw -= objectNormal * min(0.0, dot(rSw, objectNormal));
  rWind += rSw;
  // The flag's slope in the light.
  objectNormal = normalize(objectNormal - vec3(0.0, 1.0, 0.0) * clamp(rFl * 0.45 * rK * cos(rPh), -0.6, 0.6));`
        : `
  float rAirS = length(uAir);
  vec3 rWd = rAirS > 0.05 ? uAir / rAirS : vec3(0.0);
  float rLee = smoothstep(0.05, 0.7, dot(objectNormal, rWd));
  float rA = flap * rLee * smoothstep(5.0, ${f(W.full * 1.5)}, rAirS);
  float rK = ${f((2 * Math.PI) / W.rippleWave)};
  float rPh = rK * dot(position, rWd) - uTime * (${f(W.rippleBeat)} + rAirS * ${f(W.rippleBeatPerMs)}) + 2.5 * sin(dot(position, vec3(17.0, 23.0, 11.0)));
  rWind = objectNormal * rA * ${f(W.ripple)} * sin(rPh);
  vec3 rAlong = rWd - objectNormal * dot(objectNormal, rWd);
  objectNormal = normalize(objectNormal - rAlong * clamp(rA * ${f(W.ripple)} * rK * cos(rPh) * 1.6, -0.45, 0.45));`;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flap;\nuniform vec3 uAir;\nuniform vec3 uSwing;\nuniform float uTime;",
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>\n  vec3 rWind = vec3(0.0);${body}`,
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed += rWind;");
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
