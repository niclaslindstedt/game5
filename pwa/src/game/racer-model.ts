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
// air past him and flutter, the faster he goes; his suit is skin tight, so
// all it does is RIPPLE in a fine shiver on its lee side, where the flow
// leaves it. Both read his airflow — his own motion through still air,
// taken off the skeleton's world place frame by frame — turned into the
// frame his chest was bound in, so the bib streams back whichever way he
// is folded.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame } from "./skier-rig.ts";

/** THE WIND'S NUMBERS: how the bib and the suit answer the air. */
export const RACER_WIND = {
  /** The airflow, m/s, at which the bib streams fully back. */
  full: 22,
  /** How far its hem streams back at full stream, m, and flutters off the
   * suit along its normal — a slow flog under a quick flutter. */
  stream: 0.06,
  flutter: 0.03,
  flog: 0.018,
  /** The flutter's beat, rad/s, at rest and gained per m/s of air. */
  beat: 8,
  beatPerMs: 0.42,
  /** THE SUIT'S SHIVER: a skin-tight suit does not stream, but at a speed
   * event's pace the cloth over the soft backs of the thighs, the calves
   * and the upper arms shivers in the wake — waves running back along the
   * limb, m deep at full, their length m, their speed past him a share of
   * the air's, and the tilt they give the light (a shading the eye reads
   * where a few millimetres of motion alone would not show). */
  ripple: 0.0028,
  rippleFrom: 9,
  rippleFull: 34,
  rippleLength: 0.09,
  rippleRun: 0.35,
  rippleTilt: 0.5,
  /** How quickly the airflow read off his motion settles, 1/s. */
  settle: 6,
  /** THE BIB SWUNG BY HIS MOTION: its loose hem hung as a damped spring
   * off his chest — kicked up by a landing, swung out by a turn. Its
   * natural frequency, Hz, its damping ratio, how far it lies over per m/s²
   * felt, m, and the most it ever travels, m. */
  swingHz: 2.6,
  swingDamp: 0.22,
  swingGain: 0.0026,
  swingMost: 0.07,
} as const;

/** THE RUN'S CLOCK the cloth moves on, s, set once a frame by the
 * renderer (`setRacerClock`): slow motion slows the bib, a held frame
 * holds it, a replay plays it again — the wall clock stands in only when
 * no run has set it lately (a menu's stage). */
let runClock: { t: number; wall: number } | null = null;

export function setRacerClock(t: number): void {
  runClock = { t, wall: performance.now() };
}

function clockNow(): number {
  return runClock && performance.now() - runClock.wall < 500
    ? runClock.t
    : performance.now() / 1000;
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

/** HOW FREELY THE SUIT SHIVERS at a point (0..1): the soft backs of the
 * limbs the most, the trunk — held by the back protector and the bib —
 * a third as much. */
export function suitFreedom(p: THREE.Vector3, pelvis: BoneFrame): number {
  const trunk = Math.abs(p.x) < 0.15 && p.y > pelvis.head.y - 0.04;
  return trunk ? 0.35 : 1;
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
            ? suitFreedom(v, bind.pelvis)
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
  /** Read his airflow and his motion off the skeleton's world place: call
   * once a frame after the pose is laid (`now`, s, the run's clock — read
   * off `setRacerClock` when not handed). */
  update(group: THREE.Object3D, chest: THREE.Bone, now?: number): void;
};

/** A world vector turned into the frame the chest was bound in — the
 * frame the model's vertices are stated in. */
function intoBind(
  v: THREE.Vector3,
  group: THREE.Object3D,
  chest: THREE.Bone,
  bindQ: THREE.Quaternion,
  q: THREE.Quaternion,
): THREE.Vector3 {
  group.getWorldQuaternion(q).invert();
  v.applyQuaternion(q);
  return v.applyQuaternion(q.copy(chest.quaternion).invert()).applyQuaternion(bindQ);
}

/** THE AIRFLOW past him, taken off his own motion — the chest bone's world
 * velocity, smoothed, turned into the frame his chest was bound in — and
 * THE BIB'S SWING, a damped spring driven by what he feels (his
 * acceleration less gravity) in the same frame. */
export function createRacerWind(): RacerWind {
  const uniforms = {
    uAir: { value: new THREE.Vector3() },
    uSwing: { value: new THREE.Vector3() },
    uTime: { value: 0 },
  };
  const W = RACER_WIND;
  const last = new THREE.Vector3();
  const here = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const lastVel = new THREE.Vector3();
  const air = new THREE.Vector3();
  const felt = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const swing = new THREE.Vector3();
  const swingV = new THREE.Vector3();
  const pull = new THREE.Vector3();
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
  const omega = 2 * Math.PI * W.swingHz;
  let at = Number.NaN;
  let moving = false;
  const settle = (): void => {
    swing.set(0, 0, 0);
    swingV.set(0, 0, 0);
    uniforms.uSwing.value.set(0, 0, 0);
    moving = false;
  };
  return {
    uniforms,
    update(group, chest, now = clockNow()) {
      if (now === at) return;
      chest.getWorldPosition(here);
      const dt = Number.isNaN(at) ? 0 : now - at;
      at = now;
      uniforms.uTime.value = now % 1000;
      // A first frame, a jump back (a restart, a replay's seek) or a gap: lay
      // the cloth at rest and read on from here.
      if (dt <= 0 || dt > 0.25) {
        last.copy(here);
        settle();
        return;
      }
      vel.copy(here).sub(last).divideScalar(dt);
      last.copy(here);
      // A teleport (a reset) is no motion: lay it at rest.
      if (vel.lengthSq() > 120 * 120) {
        vel.set(0, 0, 0);
        settle();
      }
      // The air past him is his motion reversed, smoothed over a few frames.
      const k = 1 - Math.exp(-W.settle * dt);
      air.lerp(pull.copy(vel).negate(), k);
      intoBind(uniforms.uAir.value.copy(air), group, chest, bindQ, q);
      // What he feels: his acceleration, less gravity's pull, smoothed a
      // little — a landing a spike upward, a carve a push to the inside.
      if (moving) {
        pull.copy(vel).sub(lastVel).divideScalar(dt);
        pull.y += 9.81;
        felt.lerp(pull, 1 - Math.exp(-30 * dt));
      } else felt.set(0, 9.81, 0);
      lastVel.copy(vel);
      moving = true;
      // The hem hangs back against what he feels; at rest (gravity alone)
      // it lies where it was cut, so only the change from 1 g swings it.
      rest.copy(felt);
      rest.y -= 9.81;
      intoBind(rest, group, chest, bindQ, q).multiplyScalar(-W.swingGain);
      // The spring, stepped in small steps so a slow frame cannot blow it up.
      const steps = Math.min(8, Math.ceil(dt * 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        pull
          .copy(rest)
          .sub(swing)
          .multiplyScalar(omega * omega)
          .addScaledVector(swingV, -2 * W.swingDamp * omega);
        swingV.addScaledVector(pull, h);
        swing.addScaledVector(swingV, h);
      }
      if (swing.length() > W.swingMost) swing.setLength(W.swingMost);
      uniforms.uSwing.value.copy(swing);
    },
  };
}

/** The wind's graft on a part's material, after the world's own wrap: the
 * bib streamed back, fluttering and swung by his motion; the suit
 * shivering on its lee side. */
export function graftWind(material: THREE.Material, kind: "bib" | "suit", wind: RacerWind): void {
  const inner = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:racer-${kind}`;
  const W = RACER_WIND;
  const f = (n: number) => n.toFixed(5);
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uAir = wind.uniforms.uAir;
    shader.uniforms.uSwing = wind.uniforms.uSwing;
    shader.uniforms.uTime = wind.uniforms.uTime;
    const head = `
  float rAir = length(uAir);
  vec3 rWd = rAir > 0.05 ? uAir / rAir : vec3(0.0);`;
    // THE SUIT'S SHIVER as a wave along the limb: its height and its slope,
    // the slope tilting the normal so the light runs with the wave.
    const wave = `
  float rLee = smoothstep(0.0, 0.5, dot(objectNormal, rWd)) * flap;
  float rA = rLee * smoothstep(${f(W.rippleFrom)}, ${f(W.rippleFull)}, rAir);
  float rK = 6.2832 / ${f(W.rippleLength)};
  float rPh = -dot(position, rWd) * rK + dot(position, vec3(17.0, 5.0, 11.0)) - uTime * rAir * ${f(W.rippleRun)} * rK;
  float rWob = sin(rPh) * (0.7 + 0.3 * sin(rPh * 0.37 + uTime * 3.1));`;
    const normal =
      kind === "suit"
        ? `#include <beginnormal_vertex>${head}${wave}
  objectNormal = normalize(objectNormal - rWd * rA * cos(rPh) * ${f(W.rippleTilt)});`
        : "#include <beginnormal_vertex>";
    const body =
      kind === "bib"
        ? `${head}
  // The windward cloth is pressed onto him and keeps still; the lee side
  // lifts off and streams with the air, and only OUT, never into the suit.
  float lee = smoothstep(-0.2, 0.6, dot(objectNormal, rWd));
  float a = flap * lee * smoothstep(0.0, ${f(W.full)}, rAir);
  float ph = uTime * (${f(W.beat)} + rAir * ${f(W.beatPerMs)}) + position.y * 21.0 + position.x * 13.0;
  float flog = sin(uTime * (2.3 + rAir * 0.16) + position.y * 7.0);
  transformed += rWd * a * ${f(W.stream)} * (0.75 + 0.25 * sin(ph * 0.47));
  transformed += objectNormal * a * (${f(W.flutter)} * (0.5 + 0.5 * sin(ph)) * (0.4 + 0.6 * a) + ${f(W.flog)} * max(0.0, flog));
  // Swung by his motion: the free hem the most, and never into him.
  vec3 sw = uSwing * flap;
  float into = dot(sw, objectNormal);
  transformed += sw - objectNormal * min(0.0, into);`
        : `
  transformed += objectNormal * rA * ${f(W.ripple)} * rWob;`;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flap;\nuniform vec3 uAir;\nuniform vec3 uSwing;\nuniform float uTime;",
      )
      .replace("#include <beginnormal_vertex>", normal)
      .replace("#include <begin_vertex>", `#include <begin_vertex>${body}`);
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
