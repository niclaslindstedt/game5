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
// WHAT THE AIR DOES TO HIM is the shader's (`graftWind`), its numbers and
// its spring `racer-wind.ts`': his bib is a tabard open at the sides, so its
// hem and free edges stream back in the air past him and flap, the faster
// he goes, and it SWINGS on a spring off what he does (slapped down on a
// landing, out to the side round a turn, draped off his chest in the
// tuck); his suit is skin tight, so all it does is SHIVER where it is slack,
// fine wrinkles racing downstream over its lee side that the gloss shows as
// light running over him. Both read his airflow and his push — his own
// motion, taken off the skeleton's world place frame by frame on the run's
// clock — turned into the frame his chest was bound in, so they answer the
// same way whichever way he is folded.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose } from "./dress-loft.ts";
import { SKIER_BONES } from "./skier-rig.ts";
import {
  RACER_SWING,
  RACER_WIND,
  bibFreedom,
  createSwing,
  racerTime,
  suitFreedom,
} from "./racer-wind.ts";

export { setRacerClock } from "./racer-wind.ts";

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
            ? suitFreedom(v, bind)
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
  /** Read his airflow and his push off the skeleton's world place: call
   * once a frame after the pose is laid. */
  update(group: THREE.Object3D, chest: THREE.Bone): void;
};

/** THE AIRFLOW past him and THE PUSH on his bib, taken off his own motion:
 * the chest bone's world velocity and its change, smoothed, turned into the
 * frame his chest was bound in — on the run's clock (`racerTime`). */
export function createRacerWind(): RacerWind {
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
  const force = new THREE.Vector3();
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
  // The force he feels standing at rest, in the chest's bind frame: the
  // ground's push straight up his bound trunk.
  const rest = new THREE.Vector3(0, RACER_SWING.g, 0);
  const swing = createSwing();
  let at = Number.NaN;
  let fresh = true;
  const settle = (): void => {
    swing.settle();
    air.set(0, 0, 0);
    acc.set(0, 0, 0);
    fresh = true;
  };
  return {
    uniforms,
    update(group, chest) {
      const now = racerTime();
      if (now === at) return;
      chest.getWorldPosition(now3);
      const dt = Number.isNaN(at) ? 0 : now - at;
      at = now;
      uniforms.uTime.value = now % 1000;
      if (dt <= 0 || dt > 0.25) {
        last.copy(now3);
        if (dt !== 0) settle();
        return;
      }
      vel.copy(now3).sub(last).divideScalar(dt);
      last.copy(now3);
      // A reset, a restart or a cut: he did not move there, he was put.
      if (vel.lengthSq() > 120 * 120) {
        settle();
        return;
      }
      if (fresh) {
        lastVel.copy(vel);
        fresh = false;
      }
      // His push: the change in his velocity, smoothed over a few frames.
      const kp = 1 - Math.exp(-RACER_WIND.push * dt);
      acc.lerp(force.copy(vel).sub(lastVel).divideScalar(dt), kp);
      lastVel.copy(vel);
      // The air past him is his motion reversed, smoothed over a few frames.
      const k = 1 - Math.exp(-RACER_WIND.settle * dt);
      air.lerp(force.copy(vel).negate(), k);
      // Into the group's frame, then out of the chest's present turn into
      // the turn it was bound in.
      group.getWorldQuaternion(q).invert();
      toBind.copy(chest.quaternion).invert().premultiply(bindQ);
      uniforms.uAir.value.copy(air).applyQuaternion(q).applyQuaternion(toBind);
      // The force he feels (his push less gravity), the same way round.
      force
        .copy(acc)
        .setY(acc.y + RACER_SWING.g)
        .applyQuaternion(q)
        .applyQuaternion(toBind);
      swing.step(force, rest, dt);
      uniforms.uSwing.value.set(swing.at.x, swing.at.y, swing.at.z);
    },
  };
}

/** The wind's graft on a part's material, after the world's own wrap: the
 * bib streamed back, flapping and swung, the suit shivering where it is
 * slack on its lee side. */
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
    // Both read the air first, where the normal is begun, so the suit's
    // shiver can tip the normal the light reads as well as the surface.
    const air = `
  float racerAir = length(uAir);
  vec3 racerWd = racerAir > 0.05 ? uAir / racerAir : vec3(0.0);
  float racerMove = 0.0;`;
    const normal =
      kind === "bib"
        ? ""
        : `
  // THE SHIVER: wrinkles running DOWNSTREAM over the slack of the suit on
  // its lee side, their slope tipping the normal — the light running over
  // the gloss print is how a tight suit shows the air at all.
  {
    float lee = smoothstep(-0.15, 0.55, dot(objectNormal, racerWd));
    float a = flap * lee * smoothstep(${f(W.shiverFrom)}, ${f(W.shiverFull)}, racerAir);
    float kw = 6.28318 / ${f(W.wrinkle)};
    float ph = uTime * (${f(W.shiverBeat)} + racerAir * ${f(W.shiverBeatPerMs)}) - dot(position, racerWd) * kw
      + sin(dot(position, vec3(17.0, 29.0, 11.0))) * 2.0;
    float m = 0.6 + 0.4 * sin(uTime * 3.1 + dot(position, vec3(5.0, 3.0, 7.0)));
    racerMove = a * m * ${f(W.shiver)} * sin(ph);
    vec3 along = racerWd - objectNormal * dot(objectNormal, racerWd);
    objectNormal = normalize(objectNormal - along * a * m * ${f(W.shiver * W.sheen)} * kw * cos(ph));
  }`;
    const body =
      kind === "bib"
        ? `
  // The windward cloth is pressed onto him and keeps still; the lee side
  // lifts off and streams with the air, and only OUT, never into the suit.
  float lee = smoothstep(-0.2, 0.6, dot(objectNormal, racerWd));
  float a = flap * lee * smoothstep(0.0, ${f(W.full)}, racerAir);
  // The flap runs DOWN the bib from the shoulders to the hem.
  float ph = uTime * (${f(W.beat)} + racerAir * ${f(W.beatPerMs)}) + position.y * 19.0 + position.x * 11.0;
  transformed += racerWd * a * ${f(W.stream)} * (0.75 + 0.25 * sin(ph * 0.47));
  transformed += objectNormal * a * ${f(W.flutter)} * (0.5 + 0.5 * sin(ph)) * (0.4 + 0.6 * a);
  // THE SWING: the bib's spring, all but what would press it into him.
  vec3 sw = uSwing - objectNormal * min(0.0, dot(uSwing, objectNormal));
  transformed += sw * flap;`
        : `
  transformed += objectNormal * racerMove;`;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flap;\nuniform vec3 uAir;\nuniform vec3 uSwing;\nuniform float uTime;",
      )
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>${air}${normal}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>${body}`);
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
