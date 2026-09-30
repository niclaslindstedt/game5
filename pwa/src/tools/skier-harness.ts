// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB's page (driven by `scripts/skier-preview.mjs`): the skier
// IN MOTION, as the game draws him. The driver skis each move through the
// real engine and hands this page every other step's `SkierState`
// (`frames.json`); the page builds the pair and its skier with the game's
// own builder (`createSkisModel` — the committed Blender models when the
// build draws them, `loadModels`), POSES THEM THROUGH EVERY STATE IN TURN
// (the body's spring on his legs stepped at the frame rate as the game
// steps it, so a landing's fold is the game's), and at the chosen frames
// photographs him from several sides at once. Two sheets:
//
//   moves      one move: a column a moment across its window, a row a view
//              (behind, the rear three-quarter, the side, the front
//              three-quarter, the front, the chase camera's place) —
//              previews/skier-<move>.png
//   turntable  the stance, a full tuck and a skate stride at its push, the
//              lens walked round him every 45° and over him —
//              previews/skier-turntable.png
//
// Every view is stated in the skier's own heading frame, aimed at his
// centre of gravity (or, thrown, the middle of his body), so "behind" is
// behind him whichever way the run took him.

import * as THREE from "three";
import { skisById, type SkierState, type TrickPose } from "@engine";

import { loadModels } from "../game/skier-models.ts";
import { gaitOf } from "../game/skier-pose.ts";
import { createSkisModel, SKI_STYLES, type SkisModel } from "../game/skis-body.ts";

type Frame = {
  t: number;
  skier: SkierState;
  trick: TrickPose | null;
  /** The snow under him: its height and its normal. */
  ground: [number, number, number, number];
};
type Move = { id: string; title: string; frames: Frame[]; shots: number[] };
type Data = {
  skis: string;
  slot: number;
  moves: Move[];
  turntable: { name: string; frames: Frame[] }[];
};
type View = "back" | "back3" | "side" | "front3" | "front" | "chase";

declare global {
  interface Window {
    __skier?: { ready: Promise<void>; sheet(): { rows: number; cols: number; note: string } };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "moves";
const moveId = params.get("move") ?? "";
const cell = Number(params.get("cell") ?? 260);
const views = (params.get("views") ?? "back,back3,side,front3,front").split(",") as View[];

/** Where each view's lens stands in the skier's heading frame — x to his
 * right, y up, z ahead — m from his centre, and its field. */
const VIEW_AT: Record<View, { at: [number, number, number]; fov: number; ahead?: number }> = {
  back: { at: [0, 1.1, -4.4], fov: 34 },
  back3: { at: [3, 1, -3.2], fov: 34 },
  side: { at: [4.4, 0.35, 0], fov: 34 },
  front3: { at: [3, 0.8, 3.2], fov: 34 },
  front: { at: [0, 0.6, 4.4], fov: 34 },
  chase: { at: [0, 1.6, -5.2], fov: 62, ahead: 8 },
};
/** The turntable's bearings round him, deg from behind, clockwise from
 * above, and the one from over him. */
const TURNS = [0, 45, 90, 135, 180, 225, 270, 315];

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const host = document.getElementById("sheet") as HTMLDivElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x8b95a3, 1.35));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
sun.shadow.camera.right = sun.shadow.camera.top = 4;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
// THE SNOW under him: a plane laid on the ground's own normal where he is,
// with a metre grid on it so the move reads against something fixed.
const snow = new THREE.Group();
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xe9eff6, roughness: 0.95 }),
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
const grid = new THREE.GridHelper(200, 200, 0xa9b6c6, 0xc9d3de);
grid.position.y = 0.003;
snow.add(plane, grid);
scene.add(snow);

const lens = new THREE.PerspectiveCamera(34, 4 / 3, 0.05, 300);
const Y = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

let data: Data;
let model: SkisModel;

async function load(): Promise<void> {
  const [frames] = await Promise.all([
    fetch("./frames.json").then((r) => r.json() as Promise<Data>),
    loadModels(),
  ]);
  data = frames;
  const plain = <M extends THREE.Material>(m: M): M => m;
  model = createSkisModel(skisById(data.skis), SKI_STYLES[data.slot % SKI_STYLES.length], plain);
  model.root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  scene.add(model.root);
}

/** Pose the pair and its skier at one engine state, `dt` s after the last,
 * and lay the snow under him. Returns where to aim: his centre, and his
 * heading. */
function poseAt(f: Frame, dt: number): { centre: THREE.Vector3; heading: number } {
  const c = f.skier;
  model.pose(c, { x: c.x, y: c.y, z: c.z, q: c.q }, 0, f.trick, dt);
  const [gy, nx, ny, nz] = f.ground;
  const off = c.thrown;
  const cx = off ? off.x : c.x;
  const cz = off ? off.z : c.z;
  snow.position.set(cx, gy, cz);
  snow.quaternion.setFromUnitVectors(Y, tmp.set(nx, ny, nz));
  const centre = new THREE.Vector3(cx, off ? Math.max(off.y, gy + 0.5) : c.y - 0.1, cz);
  sun.position.set(centre.x + 4, centre.y + 8, centre.z - 3);
  sun.target.position.copy(centre);
  return { centre, heading: off ? off.heading : c.heading };
}

/** Aim the lens from a view (or a bearing round him) at a centre. */
function aim(view: View | number, centre: THREE.Vector3, heading: number): THREE.Camera {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  // Right of the heading is (fz, −fx) — the engine's clockwise sign.
  const rx = fz;
  const rz = -fx;
  let at: [number, number, number];
  let ahead = 0;
  if (typeof view === "number") {
    const b = (view * Math.PI) / 180;
    // A bearing from BEHIND him, clockwise from above: 90 is his right.
    at = [Math.sin(b) * 4.4, 1, -Math.cos(b) * 4.4];
    lens.fov = 34;
  } else {
    const v = VIEW_AT[view];
    at = v.at;
    ahead = v.ahead ?? 0;
    lens.fov = v.fov;
  }
  lens.position.set(
    centre.x + rx * at[0] + fx * at[2],
    centre.y + at[1],
    centre.z + rz * at[0] + fz * at[2],
  );
  lens.lookAt(centre.x + fx * ahead, centre.y - (ahead ? 0.5 : 0), centre.z + fz * ahead);
  lens.aspect = 4 / 3;
  lens.updateProjectionMatrix();
  return lens;
}

function label(text: string, x: number, y: number, title = false): void {
  const el = document.createElement("div");
  el.className = title ? "label title" : "label";
  el.textContent = text;
  el.style.left = `${x + 6}px`;
  el.style.top = `${y + 4}px`;
  host.appendChild(el);
}

/** What a frame says about itself on the sheet. */
function caption(f: Frame): string {
  const c = f.skier;
  const words = [`${f.t.toFixed(2)} s`, `${Math.round(c.speed * 3.6)} km/h`];
  if (c.thrown) words.push("THROWN");
  else if (c.airborne) words.push("air");
  else if (c.jumpLoad > 0) words.push(`load ${c.jumpLoad.toFixed(1)} s`);
  else if (c.popped < 0.3) words.push("pop");
  else {
    const gait = gaitOf(c);
    if (gait.skate > 0.3) words.push("skate");
    else if (gait.pole > 0.3) words.push("pole");
  }
  if (c.skid > 0.3) words.push("skid");
  if (c.carve > 0.3) words.push("cut");
  return words.join(" · ");
}

/** Lay out a grid of `rows` × `cols` cells under a title strip. */
function layout(rows: number, cols: number): { w: number; h: number; top: number } {
  const w = cell;
  const h = Math.round(cell * 0.75);
  const top = 26;
  renderer.setSize(cols * w, rows * h + top, false);
  canvas.style.width = `${cols * w}px`;
  canvas.style.height = `${rows * h + top}px`;
  renderer.setScissor(0, 0, cols * w, rows * h + top);
  renderer.setViewport(0, 0, cols * w, rows * h + top);
  renderer.setClearColor(0x0b1116);
  renderer.clear();
  for (const old of host.querySelectorAll(".label")) old.remove();
  return { w, h, top };
}

function drawCell(cam: THREE.Camera, col: number, row: number, rows: number, w: number, h: number): void {
  const x = col * w;
  const y = (rows - 1 - row) * h;
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
  renderer.render(scene, cam);
}

function drawMove(): { rows: number; cols: number; note: string } {
  const move = data.moves.find((m) => m.id === moveId) ?? data.moves[0];
  const rows = views.length;
  const cols = move.shots.length;
  const { w, h, top } = layout(rows, cols);
  label(`${move.id} — ${move.title}`, 0, 0, true);
  let posedTo = -1;
  move.shots.forEach((shot, col) => {
    // Step his legs' spring through every recorded state to this one.
    let aimAt = { centre: new THREE.Vector3(), heading: 0 };
    for (let i = posedTo + 1; i <= shot; i++) {
      const dt = i > 0 ? move.frames[i].t - move.frames[i - 1].t : 0;
      aimAt = poseAt(move.frames[i], dt);
    }
    if (shot <= posedTo) aimAt = poseAt(move.frames[shot], 0);
    posedTo = Math.max(posedTo, shot);
    views.forEach((view, row) => {
      drawCell(aim(view, aimAt.centre, aimAt.heading), col, row, rows, w, h);
      label(row === 0 ? `${caption(move.frames[shot])}` : view, col * w, top + row * h);
    });
  });
  return { rows, cols, note: move.title };
}

function drawTurntable(): { rows: number; cols: number; note: string } {
  const rows = data.turntable.length;
  const cols = TURNS.length;
  const { w, h, top } = layout(rows, cols);
  label("turntable — the stance, the tuck, a skate stride; the lens every 45° from behind", 0, 0, true);
  data.turntable.forEach((moment, row) => {
    let aimAt = { centre: new THREE.Vector3(), heading: 0 };
    moment.frames.forEach((f, i) => {
      aimAt = poseAt(f, i > 0 ? f.t - moment.frames[i - 1].t : 0);
    });
    TURNS.forEach((deg, col) => {
      drawCell(aim(deg, aimAt.centre, aimAt.heading), col, row, rows, w, h);
      label(`${moment.name} · ${deg}°`, col * w, top + row * h);
    });
  });
  return { rows, cols, note: "turntable" };
}

window.__skier = {
  ready: load(),
  sheet: () => (sheet === "turntable" ? drawTurntable() : drawMove()),
};
