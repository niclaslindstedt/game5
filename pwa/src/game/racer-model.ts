// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP RACER, MODELLED: the one skier the game draws as a Blender
// model rather than cut in code (`make blender KIND=racer`, `racer.py`) —
// a speed racer's printed one-piece suit over a back protector, the bib,
// race gloves and a speed helmet with no chin guard. He is worn as the
// BODY row's RACER on the DRESS card (`outfit.ts`), and drawn by
// `skier-dress.ts` in place of the code's cloth on the very skeleton the
// code's dress is skinned on: his skin was laid in the same bind pose
// (`dress-loft.ts`' `bindPose`) and is weighted to the same bones, by
// name, so every pose, clip and animation the game plays moves him bone
// for bone, unchanged.
//
// WHAT THE AIR DOES TO HIM is the shader's (`graftWind`), on the run's own
// clock (`setRacerClock`): his bib is a tabard open at the sides, so its
// hem and free edges stream back in the air past him and flutter in a
// wave run down from his shoulders; his suit is tight, so the air SHAKES
// only its slack (behind the upper arms, over the seat, down the backs of
// the thighs) and runs fine RIPPLES down its lee side, where the flow
// leaves it. Both read his airflow — his own motion through still air,
// taken off the skeleton's world place frame by frame. And where a joint
// FOLDS — the knee, the hip, the elbow — the suit CREASES, the deeper the
// further it is folded.

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
  stream: 0.085,
  flutter: 0.03,
  /** The flutter's beat, rad/s, at rest and gained per m/s of air, and how
   * many radians the wave runs from the bib's held top to its hem. */
  beat: 8,
  beatPerMs: 0.5,
  run: 7,
  /** THE SUIT IN THE AIR: the lee side's slack cloth shaken off the body,
   * m at full stream (`slack` says where it is slack), and the fine
   * ripples the flow runs down it — their wavelength, m, their speed as a
   * share of the air's, and how far they tilt the cloth's face. */
  shake: 0.0035,
  wave: 0.034,
  travel: 0.18,
  tilt: 0.55,
  /** How quickly the airflow read off his motion settles, 1/s. */
  settle: 6,
} as const;

/** THE CREASES a fold throws into the suit: at the back of the knee, the
 * front of the hip and the inside of the elbow, deeper the further the
 * joint is folded (the fold's angle, rad, at which they start and are
 * whole), their pitch along the limb (m), how far from the joint they
 * reach (m), how far they tilt the cloth's face and how dark they shade
 * it in their valleys. */
export const RACER_CREASE = {
  knee: { from: 0.35, whole: 1.9, reach: 0.075 },
  hip: { from: 0.35, whole: 1.9, reach: 0.07 },
  elbow: { from: 0.9, whole: 2.4, reach: 0.06 },
  pitch: 0.022,
  tilt: 0.7,
  shade: 0.22,
} as const;

/** The six folding joints, each a parent bone, a child bone and whether
 * the fold CLOSES the angle between their axes (the hip: the thigh comes
 * up toward the trunk) or opens it (the knee and the elbow). */
const JOINTS = [
  { kind: "knee", parent: "thigh_l", child: "shin_l", closes: false },
  { kind: "knee", parent: "thigh_r", child: "shin_r", closes: false },
  { kind: "hip", parent: "pelvis", child: "thigh_l", closes: true },
  { kind: "hip", parent: "pelvis", child: "thigh_r", closes: true },
  { kind: "elbow", parent: "upperarm_l", child: "forearm_l", closes: false },
  { kind: "elbow", parent: "upperarm_r", child: "forearm_r", closes: false },
] as const;

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
    // How free each point is in the air, and on the suit where a fold
    // creases it.
    const free = new Float32Array(pos.count);
    const crease = new Float32Array(pos.count * 4);
    const axis = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      free[i] =
        wind === "bib"
          ? bibFreedom(v, bind.chest, bind.pelvis)
          : wind === "suit"
            ? slackOf(v, bind)
            : 0;
      if (wind !== "suit") continue;
      const c = creaseOf(v, bind);
      crease.set([c.joint, c.weight, c.axial, 0], i * 4);
      axis.set([c.axis.x, c.axis.y, c.axis.z], i * 3);
    }
    g.setAttribute("flap", new THREE.BufferAttribute(free, 1));
    if (wind === "suit") {
      g.setAttribute("crease", new THREE.BufferAttribute(crease, 4));
      g.setAttribute("creaseAxis", new THREE.BufferAttribute(axis, 3));
    }
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.2);
    if (name === "bib") material.side = THREE.DoubleSide;
    parts.push({ name, geometry: g, material, wind });
  });
  return parts;
}

type Frames = ReturnType<typeof bindPose>["frames"];
const vec = (f: { x: number; y: number; z: number }) => new THREE.Vector3(f.x, f.y, f.z);

/** Where `p` lies against a bone's segment: how far along it (0..1) and
 * the offset from its axis. */
function segment(p: THREE.Vector3, b: BoneFrame): { t: number; perp: THREE.Vector3 } {
  const y = vec(b.y);
  const d = p.clone().sub(vec(b.head));
  const t = Math.min(1, Math.max(0, d.dot(y) / Math.max(1e-3, b.length)));
  return { t, perp: d.sub(y.multiplyScalar(t * b.length)) };
}

/** HOW SLACK THE SUIT IS at a point (0.25 skin tight, 1 its slackest): a
 * race suit is cut to the tuck, so stood or stretched it bags a little
 * behind the upper arms, over the seat and down the backs of the thighs —
 * the cloth the lee side's air shakes. */
export function slackOf(p: THREE.Vector3, bind: Frames): number {
  let slack = 0;
  const back = new THREE.Vector3(0, 0, -1);
  for (const [name, near, most] of [
    ["upperarm_l", 0.1, 1],
    ["upperarm_r", 0.1, 1],
    ["thigh_l", 0.13, 0.85],
    ["thigh_r", 0.13, 0.85],
  ] as const) {
    const s = segment(p, bind[name]);
    const r = s.perp.length();
    if (r > near || r < 1e-4) continue;
    const behind = smoothstep((s.perp.dot(back) / r + 0.1) / 0.8);
    const mid = smoothstep(s.t / 0.15) * smoothstep((1 - s.t) / 0.25);
    slack = Math.max(slack, most * behind * mid);
  }
  const pel = bind.pelvis;
  const seat =
    smoothstep((pel.head.z - 0.03 - p.z) / 0.08) *
    smoothstep(1 - Math.abs(p.y - pel.head.y + 0.04) / 0.14);
  return 0.25 + 0.75 * Math.max(slack, 0.8 * seat);
}

/** WHERE A FOLD CREASES THE SUIT: the joint whose fold reaches the point
 * (an index into the six folding joints), how hard (0..1), how far along
 * the limb from the joint (m) and the limb's axis there in the bind pose. */
export function creaseOf(
  p: THREE.Vector3,
  bind: Frames,
): { joint: number; weight: number; axial: number; axis: THREE.Vector3 } {
  let best = { joint: 0, weight: 0, axial: 0, axis: new THREE.Vector3(0, 1, 0) };
  JOINTS.forEach((j, k) => {
    const parent = vec(bind[j.parent].y);
    const child = vec(bind[j.child].y);
    const head = vec(bind[j.child].head);
    const axis = j.kind === "hip" ? child.clone() : parent.clone().add(child).normalize();
    // The inside of the fold: the child's axis off the parent's.
    const inner = child.clone().sub(parent.clone().multiplyScalar(child.dot(parent)));
    inner.sub(axis.clone().multiplyScalar(inner.dot(axis))).normalize();
    const d = p.clone().sub(head);
    const axial = d.dot(axis);
    const perp = d.sub(axis.clone().multiplyScalar(axial));
    const r = perp.length();
    const rule = RACER_CREASE[j.kind];
    const wide = j.kind === "elbow" ? 0.075 : 0.15;
    if (r < 1e-4 || r > wide) return;
    const weight =
      Math.exp(-((axial / rule.reach) ** 2)) *
      smoothstep(perp.dot(inner) / r / 0.75) *
      smoothstep((wide - r) / (wide * 0.3));
    if (weight > best.weight) best = { joint: k, weight, axial, axis };
  });
  return best;
}

let clock = { t: 0, at: -Infinity };
let held: THREE.Vector3 | null = null;

/** THE RUN'S CLOCK, s, for the wind to beat on: the renderer hands it the
 * moment it draws, so a replay's slow motion slows the cloth and a pause
 * stops it. Unfed for a moment (the rider card, a lab), the wall clock
 * takes over. */
export function setRacerClock(t: number): void {
  clock = { t, at: performance.now() };
}

/** A lab's AIRFLOW held, m/s in the world (the way the air moves past
 * him), in place of the one read off his motion; `null` lets it go. */
export function holdRacerAir(air: THREE.Vector3 | null): void {
  held = air ? air.clone() : null;
}

const racerNow = (): number => {
  const wall = performance.now();
  return wall - clock.at < 300 ? clock.t : 1e5 + wall / 1000;
};

/** The wind's uniforms, one set a dressed racer. */
export type RacerWind = {
  uniforms: {
    uAir: { value: THREE.Vector3 };
    uTime: { value: number };
    uBend: { value: number[] };
  };
  /** Read his airflow off the skeleton's world place and how far each
   * joint is folded: call once a frame after the pose is laid. */
  update(group: THREE.Object3D, bones: readonly THREE.Bone[]): void;
};

const BONE = (name: string) => (SKIER_BONES as readonly string[]).indexOf(name);

/** THE AIRFLOW past him, taken off his own motion (the chest bone's world
 * velocity, smoothed) in the frame his skin is posed in, and every
 * crease's fold off the bones' world turn. */
export function createRacerWind(): RacerWind {
  const uniforms = {
    uAir: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uBend: { value: [0, 0, 0, 0, 0, 0] },
  };
  const last = new THREE.Vector3();
  const now3 = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const air = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const chest = BONE("chest");
  const pairs = JOINTS.map((j) => ({ ...j, p: BONE(j.parent), c: BONE(j.child) }));
  let at = -1;
  return {
    uniforms,
    update(group, bones) {
      const now = racerNow();
      if (now === at) return;
      const dt = at < 0 ? 0 : now - at;
      at = now;
      uniforms.uTime.value = now % 600;
      pairs.forEach((j, k) => {
        a.setFromMatrixColumn(bones[j.p].matrixWorld, 1).normalize();
        b.setFromMatrixColumn(bones[j.c].matrixWorld, 1).normalize();
        const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
        const fold = j.closes ? Math.PI - angle : angle;
        const rule = RACER_CREASE[j.kind];
        uniforms.uBend.value[k] = smoothstep((fold - rule.from) / (rule.whole - rule.from));
      });
      bones[chest].getWorldPosition(now3);
      if (held) air.copy(held);
      else if (dt <= 0 || dt > 0.25) {
        last.copy(now3);
        return;
      } else {
        vel.copy(now3).sub(last).divideScalar(dt);
        if (vel.lengthSq() > 120 * 120) vel.set(0, 0, 0);
        // The air past him is his motion reversed, smoothed over a few frames.
        air.lerp(vel.negate(), 1 - Math.exp(-RACER_WIND.settle * dt));
      }
      last.copy(now3);
      group.getWorldQuaternion(q).invert();
      uniforms.uAir.value.copy(air).applyQuaternion(q);
    },
  };
}

const TAU = Math.PI * 2;

/** The wind's graft on a part's material, after the world's own wrap. It
 * works on the POSED skin (after the skinning), so the air is read the way
 * the cloth faces now: the bib streamed back and fluttering in a wave run
 * from its held top to its hem; the suit's slack shaken and fine ripples
 * run down its lee side with the flow, and creased where a joint folds. */
export function graftWind(material: THREE.Material, kind: "bib" | "suit", wind: RacerWind): void {
  const inner = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:racer-${kind}`;
  const W = RACER_WIND;
  const C = RACER_CREASE;
  const f = (n: number) => n.toFixed(5);
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uAir = wind.uniforms.uAir;
    shader.uniforms.uTime = wind.uniforms.uTime;
    shader.uniforms.uBend = wind.uniforms.uBend;
    const air = `
  float air = length(uAir);
  vec3 wd = air > 0.05 ? uAir / air : vec3(0.0);`;
    const body =
      kind === "bib"
        ? `${air}
  // The windward cloth is pressed onto him and keeps still; the lee side
  // lifts off and streams with the air, and only OUT, never into the suit.
  float lee = smoothstep(-0.2, 0.6, dot(objectNormal, wd));
  float a = flap * lee * smoothstep(0.0, ${f(W.full)}, air);
  float ph = uTime * (${f(W.beat)} + air * ${f(W.beatPerMs)}) - flap * ${f(W.run)} + position.x * 6.0;
  transformed += wd * a * ${f(W.stream)} * (0.8 + 0.2 * sin(ph * 0.53));
  transformed += objectNormal * a * ${f(W.flutter)} * (0.45 + 0.55 * sin(ph)) * (0.4 + 0.6 * a);`
        : `${air}
  float lee = smoothstep(0.0, 0.5, dot(objectNormal, wd));
  vRipA = lee * smoothstep(3.0, ${f(W.full * 1.4)}, air) * (0.35 + 0.65 * flap);
  float run = uTime * air * ${f((W.travel * TAU) / W.wave)};
  vec3 side = normalize(cross(wd + vec3(0.0, 1e-3, 0.0), objectNormal));
  float along = dot(transformed, wd) * ${f(TAU / W.wave)};
  float across = dot(transformed, side) * ${f(TAU / (W.wave * 2.7))};
  vRipPh = vec2(along - run + 1.3 * sin(across), along * 0.61 + across * 0.8 - run * 0.7);
  vRipAirV = normalize(mat3(modelViewMatrix) * (wd + vec3(0.0, 1e-4, 0.0)));
  float shake = sin(uTime * (${f(W.beat * 2.5)} + air * ${f(W.beatPerMs * 3)}) - along * 0.25);
  transformed += objectNormal * vRipA * flap * flap * ${f(W.shake)} * shake;
  vCrA = crease.y * uBend[int(crease.x + 0.5)];
  vCrPh = crease.z * ${f(TAU / C.pitch)} + 0.9 * sin(dot(position, vec3(19.0, 7.0, 23.0)));
  vec3 cax = creaseAxis;
  #ifdef USE_SKINNING
    cax = (skinMatrix * vec4(creaseAxis, 0.0)).xyz;
  #endif
  vCrAxV = normalize(mat3(modelViewMatrix) * cax);`;
    const vary =
      kind === "suit"
        ? "varying float vRipA;\nvarying vec2 vRipPh;\nvarying vec3 vRipAirV;\nvarying float vCrA;\nvarying float vCrPh;\nvarying vec3 vCrAxV;"
        : "";
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute float flap;\n${kind === "suit" ? "attribute vec4 crease;\nattribute vec3 creaseAxis;\n" : ""}uniform vec3 uAir;\nuniform float uTime;\nuniform float uBend[6];\n${vary}`,
      )
      .replace("#include <skinning_vertex>", `#include <skinning_vertex>${body}`);
    if (kind !== "suit") return;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${vary}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  diffuseColor.rgb *= 1.0 - ${f(C.shade)} * vCrA * (0.5 - 0.5 * sin(vCrPh));`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
  {
    vec3 ta = vRipAirV - normal * dot(vRipAirV, normal);
    float tl = length(ta);
    if (vRipA > 0.001 && tl > 1e-4)
      normal = normalize(normal + ta / tl * (vRipA * ${f(W.tilt)} * (cos(vRipPh.x) + 0.5 * cos(vRipPh.y))));
    vec3 tc = vCrAxV - normal * dot(vCrAxV, normal);
    float cl = length(tc);
    if (vCrA > 0.001 && cl > 1e-4)
      normal = normalize(normal + tc / cl * (vCrA * ${f(C.tilt)} * cos(vCrPh)));
  }`,
      );
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
