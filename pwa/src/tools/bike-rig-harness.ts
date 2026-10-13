// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER'S STUDIO page (`scripts/bike-rig-preview.mjs`): the
// procedural rig's bike (`bike-dh-build.ts`) and rider (`bike-rider-build.ts`)
// alone on a studio floor, the rider SOLVED by the game's own inverse
// kinematics (`bike-rider-ik.ts`) on the poses the bot rides on the real
// engine — so the stance, the turn, the crouch, the air, the landing and the
// brake are each photographed at the moment the ride had them, close and
// lit, with none of the world in the way and in seconds rather than the
// world lab's minutes. A FILMSTRIP through the ride's hardest landing shows
// the two moving together frame by frame.
//
// The studio's materials are plain standard ones over the builders' vertex
// paint (the game's own are the haze's, whose sky a studio has none of); the
// world lab (`make bike ARGS=--rig=ik`) is where the pair is judged in game.
//
// It exposes `window.__rig.sheet()`, which lays every frame out as a contact
// sheet for the driver to photograph and hands back every frame.

import * as THREE from "three";
import {
  bikeAim,
  bikePilot,
  bikePose,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  step,
  TUNING,
  type BikePose,
  type GameState,
} from "@engine";

import { buildDhBike } from "../game/bike-dh-build.ts";
import { buildRiderFigure } from "../game/bike-rider-build.ts";
import { createRiderDynamics, solveRider, type RiderJoints } from "../game/bike-rider-ik.ts";
import { BIKE_LOOK } from "../game/bike-look.ts";
import { poseBike } from "../game/bike-view.ts";
import { createHazeUniforms } from "../game/haze.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __rig?: { ready: Promise<string>; sheet(): Promise<{ frames: Frame[] }> };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const trail = params.get("trail") || "B1";
const width = Number(params.get("w") ?? 960);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);
const rideFor = Number(params.get("for") ?? 40);
const film = Number(params.get("film") ?? 8);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

// ── THE RIDE: the bot down the trail, a pose and a solve every 1/60 s ──
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
type Moment = { t: number; pose: BikePose; joints: RiderJoints; speed: number };

function ride(): Moment[] {
  let s: GameState = createGame({
    level: generateLevel(seed),
    mode: "free",
    summer: true,
    bike: true,
    bikeTrail: trail,
    sky: { weather: "fair", hour: 11 },
    crowd: 0,
    quiet: true,
  });
  const aim = bikeAim(s);
  const dyn = createRiderDynamics();
  const out: Moment[] = [];
  const pos = new THREE.Vector3();
  const last = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const nv = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const qi = new THREE.Quaternion();
  let have = 0;
  let lastPitch = 0;
  for (let f = 0; f < rideFor / FRAME; f++) {
    for (let k = 0; k < STEPS; k++) s = step(s, s.bike ? bikePilot(s, aim) : NEUTRAL_INPUT);
    const b = s.bike;
    if (!b?.onIt || s.skier.thrown) {
      have = 0;
      dyn.reset();
      continue;
    }
    const pose = bikePose(b);
    // The frame's acceleration in its own frame, as the game's view reads it
    // off the bike's drawn motion.
    pos.set(pose.x, pose.y, pose.z);
    if (have > 0) {
      nv.copy(pos).sub(last).divideScalar(FRAME);
      if (have > 1) acc.copy(nv).sub(vel).divideScalar(FRAME).clampLength(0, 40);
      vel.copy(nv);
    }
    have = Math.min(2, have + 1);
    last.copy(pos);
    qi.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w).invert();
    const a = acc.clone().applyQuaternion(qi);
    const lag = dyn.step({ x: a.x, y: a.y, z: a.z }, (pose.pitch - lastPitch) / FRAME, FRAME);
    lastPitch = pose.pitch;
    const crank = dyn.crank(pose, FRAME);
    pose.crank = crank;
    out.push({ t: f * FRAME, pose, joints: solveRider(pose, lag, crank), speed: s.skier.speed });
  }
  return out;
}

const RIDE = ride();

/** THE MOMENTS worth a close look, each the ride's own. */
function moments(): { id: string; at: number }[] {
  const by = (score: (m: Moment, i: number) => number): number => {
    let best = 0;
    let at = 0;
    RIDE.forEach((m, i) => {
      const v = score(m, i);
      if (v > best) {
        best = v;
        at = i;
      }
    });
    return at;
  };
  const ground = (m: Moment) => !m.pose.airborne;
  // The longest flight's middle.
  let air = 0;
  let run = 0;
  let longest = 0;
  RIDE.forEach((m, i) => {
    run = m.pose.airborne ? run + 1 : 0;
    if (run > longest) {
      longest = run;
      air = i - (run >> 1);
    }
  });
  // The hardest landing: the deepest fork within a few frames of touching.
  const land = by((m, i) =>
    ground(m) && RIDE.slice(Math.max(0, i - 8), i).some((p) => p.pose.airborne)
      ? m.pose.forkShare + m.pose.shockShare
      : 0,
  );
  return [
    { id: "cruise", at: by((m) => (ground(m) && Math.abs(m.pose.roll) < 0.05 ? 1 + m.speed : 0)) },
    { id: "turn", at: by((m) => (ground(m) ? Math.abs(m.pose.roll) : 0)) },
    { id: "crouch", at: by((m) => (ground(m) ? m.pose.crouch : 0)) },
    { id: "air", at: air },
    { id: "land", at: land },
    { id: "brake", at: by((m) => (ground(m) ? m.pose.front + m.pose.rear * 0.5 : 0)) },
    { id: "pedal", at: by((m) => (m.pose.pedalling ? 1 + m.speed : 0)) },
  ];
}

// ── THE STUDIO ──────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9cfe0);
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b5a43, 1.2));
const sun = new THREE.DirectionalLight(0xfff2de, 2.6);
sun.position.set(-3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
sun.shadow.camera.right = sun.shadow.camera.top = 3;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x8a7556, roughness: 1 }),
);
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(40, 80, 0x5f4f39, 0x75634a);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
floor.add(grid);

const haze = createHazeUniforms();
const bike = buildDhBike(haze);
const rider = buildRiderFigure(haze);
/** The builders' haze materials swapped for plain ones over the same paint. */
function studio(o: THREE.Object3D): void {
  o.traverse((m) => {
    if (!(m instanceof THREE.Mesh)) return;
    const was = m.material as THREE.MeshStandardMaterial;
    m.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: was.color,
      roughness: was.roughness,
      metalness: was.metalness,
      envMapIntensity: 0,
      side: was.side,
    });
    m.castShadow = true;
    m.receiveShadow = true;
  });
}
studio(bike.root);
studio(rider.group);
scene.add(bike.root);
bike.nodes.frame.add(rider.group);

const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 100);
const R = BIKE_LOOK.rimF + BIKE_LOOK.tyre;
const tmp = new THREE.Vector3();
const up = new THREE.Vector3();

/** Stand the bike and rider at `m`, heading taken off, on a floor laid
 * under both tyres. */
function stand(m: Moment): void {
  const q = new THREE.Quaternion(m.pose.q.x, m.pose.q.y, m.pose.q.z, m.pose.q.w);
  const h = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.pose.heading);
  bike.root.position.set(0, 0, 0);
  bike.root.quaternion.copy(h.invert().multiply(q));
  poseBike(bike.nodes, m.pose);
  rider.pose(m.joints, true);
  bike.root.updateMatrixWorld(true);
  // Each tyre's foot: its axle less a wheel's radius down the frame's up.
  up.set(0, 1, 0).applyQuaternion(bike.root.quaternion);
  const foot = (n: THREE.Object3D) =>
    n.getWorldPosition(new THREE.Vector3()).addScaledVector(up, -R);
  const f = foot(bike.nodes.wheelF);
  const r = foot(bike.nodes.wheelR);
  const along = f.clone().sub(r).normalize();
  const normal = along
    .clone()
    .cross(new THREE.Vector3(1, 0, 0))
    .normalize();
  if (normal.y < 0) normal.negate();
  // In the air the floor is left where the trail would be, a flight's
  // height under him.
  const lift = m.pose.airborne ? 0.9 : 0;
  floor.position.copy(r.clone().lerp(f, 0.5)).addScaledVector(normal, -lift);
  floor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  sun.target.position.copy(floor.position);
  sun.position.copy(floor.position).add(tmp.set(-3, 6, 4));
}

const VIEWS: Record<string, [number, number, number]> = {
  // From his left (the body frame's +x), level with the hips.
  side: [3.4, 1.0, 0.2],
  // Three quarters ahead, a little above.
  front: [-1.9, 1.3, 2.6],
  // Three quarters behind.
  rear: [1.9, 1.5, -2.6],
};

function shoot(view: string, look: [number, number, number]): string {
  camera.position.set(...look);
  camera.lookAt(0, 0.55, 0.05);
  renderer.render(scene, camera);
  return canvas.toDataURL("image/png");
}

const frames: Frame[] = [];
const caption = (m: Moment) =>
  `${(m.speed * 3.6).toFixed(0)} km/h  roll ${((m.pose.roll * 180) / Math.PI).toFixed(0)}°  pitch ${((m.pose.pitch * 180) / Math.PI).toFixed(0)}°  crouch ${m.pose.crouch.toFixed(2)}  shift ${m.pose.shift.toFixed(2)}  fork ${(m.pose.forkShare * 100).toFixed(0)}%`;

async function sheet(): Promise<{ frames: Frame[] }> {
  const picks = moments();
  for (const p of picks) {
    const m = RIDE[p.at];
    stand(m);
    for (const [v, look] of Object.entries(VIEWS))
      frames.push({
        view: `${p.id}-${v}`,
        label: `${p.id} · ${v}`,
        caption: caption(m),
        png: shoot(v, look),
      });
  }
  // THE FILMSTRIP: the landing, from the side, a frame every 1/15 s.
  const land = picks.find((p) => p.id === "land")!.at;
  for (let k = 0; k < film; k++) {
    const i = Math.max(0, Math.min(RIDE.length - 1, land - 12 + k * 4));
    const m = RIDE[i];
    stand(m);
    frames.push({
      view: `film-${k}`,
      label: `landing ${((i - land) * FRAME).toFixed(2)} s`,
      caption: caption(m),
      png: shoot("side", VIEWS.side),
    });
  }
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${Math.round(width * scale)}px)`;
  const head = document.createElement("header");
  head.textContent = `procedural rider · seed ${seed} · trail ${trail} · ${RIDE.length} frames ridden`;
  sheetEl.append(head);
  for (const f of frames) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = f.png;
    img.width = Math.round(width * scale);
    const cap = document.createElement("figcaption");
    cap.textContent = `${f.label}\n${f.caption}`;
    fig.append(img, cap);
    sheetEl.append(fig);
  }
  canvas.style.display = "none";
  await Promise.all([...sheetEl.querySelectorAll("img")].map((i) => i.decode()));
  return { frames };
}

window.__rig = {
  ready: Promise.resolve(`seed ${seed}, trail ${trail}, ${RIDE.length} frames on the bike`),
  sheet,
};
