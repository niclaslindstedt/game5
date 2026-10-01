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
//   closeup    the lab's MOMENTS a row, close, from behind, the rear
//              three-quarter, the side and the front three-quarter
//   game       the same moments as the game's chase and far cameras frame
//              them, drawn at the pixels a 1280×720 frame gives him and
//              enlarged without smoothing
//   stretch    the model's skin at each moment coloured by how far every
//              triangle is stretched (red) or crushed (blue) off the pose
//              it was bound in, and the share outside the band, by region
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
type Moment = { name: string; say?: string; frames: Frame[] };
type Data = {
  skis: string;
  slot: number;
  moves: Move[];
  turntable: Moment[];
  moments: Moment[];
};
type Drawn = { rows: number; cols: number; note: string; table?: string[] };
type View = "back" | "back3" | "side" | "front3" | "front" | "chase";

declare global {
  interface Window {
    __skier?: { ready: Promise<void>; sheet(): Drawn };
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
    if (gait.stride > 0.3) words.push("stride");
    else if (gait.skate > 0.3) words.push("skate");
    else if (gait.pole > 0.3) words.push("pole");
  }
  if (c.skid > 0.3) words.push("skid");
  if (c.carve > 0.3) words.push("cut");
  return words.join(" · ");
}

/** Lay out a grid of `rows` × `cols` cells under a title strip. */
function layout(
  rows: number,
  cols: number,
  w = cell,
  h = Math.round(cell * 0.75),
): { w: number; h: number; top: number } {
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

function drawCell(
  cam: THREE.Camera,
  col: number,
  row: number,
  rows: number,
  w: number,
  h: number,
  what: THREE.Scene = scene,
): void {
  const x = col * w;
  const y = (rows - 1 - row) * h;
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
  renderer.render(what, cam);
}

/** Pose him through a moment's states, his legs' spring stepped through
 * every one; where to aim. */
function settle(moment: Moment): { centre: THREE.Vector3; heading: number } {
  let aimAt = { centre: new THREE.Vector3(), heading: 0 };
  moment.frames.forEach((f, i) => {
    aimAt = poseAt(f, i > 0 ? f.t - moment.frames[i - 1].t : 0);
  });
  return aimAt;
}

/** THE CLOSE-UP: a moment a row, four sides, the lens near and narrow. */
const CLOSE_AT: [string, [number, number, number]][] = [
  ["back", [0, 0.55, -3.1]],
  ["back3", [2.2, 0.5, -2.2]],
  ["side", [3.1, 0.25, 0]],
  ["front3", [2.2, 0.4, 2.2]],
];
function drawCloseup(): Drawn {
  const rows = data.moments.length;
  const cols = CLOSE_AT.length;
  const w = cell * 1.6;
  const { h, top } = layout(rows, cols, w, w);
  label(
    "closeup — each moment from behind, the rear three-quarter, the side, the front three-quarter",
    0,
    0,
    true,
  );
  data.moments.forEach((moment, row) => {
    const { centre, heading } = settle(moment);
    CLOSE_AT.forEach(([name, at], col) => {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      lens.fov = 30;
      lens.aspect = 1;
      lens.position.set(
        centre.x + fz * at[0] + fx * at[2],
        centre.y + at[1],
        centre.z - fx * at[0] + fz * at[2],
      );
      lens.lookAt(centre.x, centre.y + 0.05, centre.z);
      lens.updateProjectionMatrix();
      drawCell(lens, col, row, rows, w, h);
      label(
        col === 0
          ? `${moment.name} — ${moment.say ?? ""} · ${caption(moment.frames.at(-1)!)}`
          : name,
        col * w,
        top + row * h,
      );
    });
  });
  return { rows, cols, note: "closeup" };
}

/** THE DETAIL: the parts a still at range cannot judge — each hand on its
 * grip, the boots in the bindings, the head in the helmet — framed close
 * at each moment, off the model's own bones where they are posed (the
 * code's figure has none: its joints are read off the pose instead). */
const DETAIL: [string, string, [number, number, number]][] = [
  ["right hand", "hand_r", [0.55, 0.15, 0.45]],
  ["left hand", "hand_l", [-0.55, 0.15, 0.45]],
  ["boots", "boot_l", [0.75, 0.3, 0.55]],
  ["head", "head", [0.45, 0.1, 0.6]],
  ["chest", "chest", [0.15, 0.1, 1.0]],
  ["back", "chest", [0.15, 0.25, -1.0]],
];
function drawDetail(): Drawn {
  const rows = data.moments.length;
  const cols = DETAIL.length;
  const w = cell * 1.3;
  const { h, top } = layout(rows, cols, w, w);
  label(
    "detail — each hand on its grip, the boots in the bindings, the head, the jacket front and back",
    0,
    0,
    true,
  );
  const at = new THREE.Vector3();
  data.moments.forEach((moment, row) => {
    const { heading } = settle(moment);
    model.root.updateMatrixWorld(true);
    DETAIL.forEach(([name, bone, off], col) => {
      const b = model.root.getObjectByName("model-skier")?.getObjectByName(bone);
      if (!b) return;
      b.getWorldPosition(at);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      lens.fov = 30;
      lens.aspect = 1;
      lens.position.set(
        at.x + fz * off[0] + fx * off[2],
        at.y + off[1],
        at.z - fx * off[0] + fz * off[2],
      );
      lens.lookAt(at);
      lens.near = 0.02;
      lens.updateProjectionMatrix();
      drawCell(lens, col, row, rows, w, h);
      label(col === 0 ? `${moment.name} · ${name}` : name, col * w, top + row * h);
    });
  });
  return { rows, cols, note: "detail" };
}

/** THE GAME'S PIXELS: the chase and the far camera (`camera-rigs.ts`'s
 * boom: its distance, height, aim and field, the field widened with speed
 * as the rig widens it) laid on a 1280×720 frame, the window round him
 * rendered at exactly the frame's pixels into a target, then drawn
 * enlarged and unsmoothed — so a pose is judged at the size a player sees
 * it, and a part that reads only close up is seen not to. */
const FRAME = { w: 1280, h: 720 };
const CROP = { w: 300, h: 225, zoom: 2 };
const BOOMS: Record<
  string,
  {
    dist: number;
    height: number;
    aimAhead: number;
    aimHeight: number;
    fov: number;
    fovPerSpeed: number;
    fovMax: number;
  }
> = {
  chase: {
    dist: 5.2,
    height: 1.6,
    aimAhead: 8,
    aimHeight: -0.25,
    fov: 62,
    fovPerSpeed: 0.75,
    fovMax: 90,
  },
  far: {
    dist: 10,
    height: 3.6,
    aimAhead: 10,
    aimHeight: -0.2,
    fov: 56,
    fovPerSpeed: 0.45,
    fovMax: 80,
  },
};
const target = new THREE.WebGLRenderTarget(CROP.w, CROP.h, {
  type: THREE.HalfFloatType,
  magFilter: THREE.NearestFilter,
  minFilter: THREE.NearestFilter,
  samples: 4,
});
const shown = new THREE.Scene();
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: target.texture }),
);
shown.add(quad);
const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function drawGame(): Drawn {
  const rows = data.moments.length;
  const names = Object.keys(BOOMS);
  const cols = names.length;
  const w = CROP.w * CROP.zoom;
  const h = CROP.h * CROP.zoom;
  const { top } = layout(rows, cols, w, h);
  label(
    `game — the chase and far cameras at a ${FRAME.w}×${FRAME.h} frame's pixels, ×${CROP.zoom} unsmoothed`,
    0,
    0,
    true,
  );
  const eye = new THREE.Vector3();
  data.moments.forEach((moment, row) => {
    const { centre, heading } = settle(moment);
    const speed = moment.frames.at(-1)!.skier.speed;
    names.forEach((name, col) => {
      const b = BOOMS[name];
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const cam = new THREE.PerspectiveCamera(
        Math.min(b.fovMax, b.fov + b.fovPerSpeed * speed),
        FRAME.w / FRAME.h,
        0.05,
        400,
      );
      cam.position.set(centre.x - fx * b.dist, centre.y + b.height, centre.z - fz * b.dist);
      cam.lookAt(centre.x + fx * b.aimAhead, centre.y + b.aimHeight, centre.z + fz * b.aimAhead);
      cam.updateMatrixWorld();
      // Where his middle falls on the frame: the window is centred there.
      eye.copy(centre).project(cam);
      const px = ((eye.x + 1) / 2) * FRAME.w;
      const py = ((1 - eye.y) / 2) * FRAME.h;
      cam.setViewOffset(
        FRAME.w,
        FRAME.h,
        Math.round(px - CROP.w / 2),
        Math.round(py - CROP.h * 0.55),
        CROP.w,
        CROP.h,
      );
      cam.updateProjectionMatrix();
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, CROP.w, CROP.h);
      renderer.setScissor(0, 0, CROP.w, CROP.h);
      renderer.setClearColor(0x7d8b99);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      drawCell(flat, col, row, rows, w, h, shown);
      label(col === 0 ? `${moment.name} · ${name}` : name, col * w, top + row * h);
    });
  });
  return { rows, cols, note: "game" };
}

/** THE SKIN'S STRETCH: every skinned mesh of the model laid as the GPU
 * lays it (`applyBoneTransform`), each triangle's area against its area
 * as bound, and a copy drawn coloured by it — blue crushed to half, white
 * as bound, red stretched to half again — in place of the model. */
const STRETCH = { lo: 0.6, hi: 1.6 };
function stretchColour(r: number, out: THREE.Color): THREE.Color {
  const k = Math.log2(Math.max(1e-3, r)) / Math.log2(1.6);
  const c = Math.max(-1, Math.min(1, k));
  return c >= 0 ? out.setRGB(1, 1 - c, 1 - c) : out.setRGB(1 + c, 1 + c, 1);
}
const stretchScene = new THREE.Scene();
stretchScene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.2));
function drawStretch(): Drawn {
  const rows = data.moments.length;
  const views: [string, [number, number, number]][] = [CLOSE_AT[0], CLOSE_AT[2], CLOSE_AT[3]];
  const cols = views.length;
  const w = cell * 1.3;
  const { h, top } = layout(rows, cols, w, w);
  label(
    `stretch — each triangle's area off its bound area: blue ≤ ${STRETCH.lo}, white 1, red ≥ ${STRETCH.hi}`,
    0,
    0,
    true,
  );
  const table: string[] = [];
  const pos = new THREE.Vector3();
  const colour = new THREE.Color();
  data.moments.forEach((moment, row) => {
    const { centre, heading } = settle(moment);
    model.root.updateMatrixWorld(true);
    for (const old of [...stretchScene.children]) {
      if (old instanceof THREE.Mesh) {
        old.geometry.dispose();
        stretchScene.remove(old);
      }
    }
    // Every skinned mesh, laid in the world and coloured.
    const bad: Record<string, [number, number]> = {};
    const skier = model.root.getObjectByName("model-skier");
    skier?.traverse((o) => {
      if (!(o instanceof THREE.SkinnedMesh) || !o.visible) return;
      const g = o.geometry;
      const n = g.attributes.position.count;
      const world = new Float32Array(n * 3);
      const rest = new Float32Array(n * 3);
      o.skeleton.update();
      for (let i = 0; i < n; i++) {
        pos.fromBufferAttribute(g.attributes.position, i);
        rest.set([pos.x, pos.y, pos.z], i * 3);
        o.applyBoneTransform(i, pos.fromBufferAttribute(g.attributes.position, i));
        pos.applyMatrix4(o.matrixWorld);
        world.set([pos.x, pos.y, pos.z], i * 3);
      }
      const index: number[] = g.index
        ? Array.from(g.index.array as ArrayLike<number>)
        : [...Array(n).keys()];
      const tris = index.length / 3;
      const outPos = new Float32Array(tris * 9);
      const outCol = new Float32Array(tris * 9);
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      const area = (arr: Float32Array, i0: number, i1: number, i2: number) => {
        a.fromArray(arr, i0 * 3);
        b.fromArray(arr, i1 * 3).sub(a);
        c.fromArray(arr, i2 * 3).sub(a);
        return b.cross(c).length() / 2;
      };
      // The region a triangle belongs to: the bone weighing most on its
      // first corner.
      const si = g.attributes.skinIndex;
      const sw = g.attributes.skinWeight;
      const boneOf = (v: number) => {
        let best = 0;
        for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
        return o.skeleton.bones[si.getComponent(v, best)]?.name ?? "?";
      };
      for (let t = 0; t < tris; t++) {
        const [i0, i1, i2] = [index[3 * t], index[3 * t + 1], index[3 * t + 2]];
        const r0 = area(rest, i0, i1, i2);
        const r = r0 > 1e-9 ? area(world, i0, i1, i2) / r0 : 1;
        stretchColour(r, colour);
        for (const [k, v] of [i0, i1, i2].entries()) {
          outPos.set(world.subarray(v * 3, v * 3 + 3), t * 9 + k * 3);
          outCol.set([colour.r, colour.g, colour.b], t * 9 + k * 3);
        }
        const region = boneOf(i0).replace(/_[lr]$/, "");
        const tally = (bad[region] ??= [0, 0]);
        tally[0] += r0;
        if (r < STRETCH.lo || r > STRETCH.hi) tally[1] += r0;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(outCol, 3));
      geo.computeVertexNormals();
      stretchScene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
    });
    const parts = Object.entries(bad)
      .filter(([, [all]]) => all > 0)
      .map(([k, [all, out]]) => `${k} ${((100 * out) / all).toFixed(1)}%`);
    const total = Object.values(bad).reduce((s, [all, out]) => [s[0] + all, s[1] + out], [0, 0]);
    table.push(
      `${moment.name.padEnd(8)} outside ${((100 * total[1]) / (total[0] || 1)).toFixed(1)}%  ·  ${parts.join("  ")}`,
    );
    views.forEach(([name, at], col) => {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      lens.fov = 30;
      lens.aspect = 1;
      lens.position.set(
        centre.x + fz * at[0] + fx * at[2],
        centre.y + at[1],
        centre.z - fx * at[0] + fz * at[2],
      );
      lens.lookAt(centre.x, centre.y + 0.05, centre.z);
      lens.updateProjectionMatrix();
      drawCell(lens, col, row, rows, w, h, stretchScene);
      label(
        col === 0 ? `${moment.name} — ${table.at(-1)!.split("·")[0].trim()}` : name,
        col * w,
        top + row * h,
      );
    });
  });
  return { rows, cols, note: "stretch", table };
}

function drawMove(): Drawn {
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

function drawTurntable(): Drawn {
  const rows = data.turntable.length;
  const cols = TURNS.length;
  const { w, h, top } = layout(rows, cols);
  label(
    "turntable — the stance, the tuck, a skate stride; the lens every 45° from behind",
    0,
    0,
    true,
  );
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
  sheet: () =>
    sheet === "turntable"
      ? drawTurntable()
      : sheet === "closeup"
        ? drawCloseup()
        : sheet === "game"
          ? drawGame()
          : sheet === "detail"
            ? drawDetail()
            : sheet === "stretch"
              ? drawStretch()
              : drawMove(),
};
