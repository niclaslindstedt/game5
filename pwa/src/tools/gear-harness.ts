// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR LAB's page (driven by `scripts/gear-preview.mjs`): the skier in
// his kit as the game draws him — the dressed figure (`skier-dress.ts`, the
// outfit cut on the loom and skinned on the rig) on his skis, built by the
// game's own builder (`createSkisModel`) and posed by the game's own pose —
// and, beside it, a MODELLED skier (a Blender glTF the driver serves, posed
// by the same rig and dressed in the outfit's colours), so the two roads
// to the same kit are judged in one frame. Seven sheets:
//
//   catalog   every piece of every slot asked for, worn over the default
//             kit, a row a piece: behind, the rear three-quarter, the side,
//             the front three-quarter — and close on what the slot is (the
//             head for a helmet, a fist for a glove)
//   outfits   every start-line outfit (the player's default and each
//             rival's), a row each, the same four sides
//   poses     one outfit through the moves the rig is posed in — stood, a
//             carve each way, the tuck, a pole plant, leaning back, in the
//             air, the three grabs — from the rear three-quarter and the
//             side: what a garment does to a joint shows here first
//   game      every outfit as the game's CHASE and FAR cameras frame it in
//             a 1280×720 frame, stood and tucked, enlarged unsmoothed — the
//             pixels a player reads
//   wire      the outfits with every triangle's edges, counted by mesh
//   compare   the dressed figure and every model asked for, a row each, in
//             the same kit through the same moves, with each one's
//             triangles and what it costs to make
//   refs      the local REFERENCE photographs the driver was pointed at
//             (`--refs`, never committed), a row a slot, beside that slot's
//             pieces as drawn — real gear and ours side by side

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SKI_CATALOG, SKIS, type SkiSpec, type TrickPose } from "@engine";

import { dressOutfit, outfitKey } from "../game/dress.ts";
import {
  coloursOf,
  DEFAULT_OUTFIT,
  GEAR,
  GEAR_SLOTS,
  type GearSlot,
  type Outfit,
} from "../game/outfit.ts";
import { dressOf } from "../game/skier-models.ts";
import { loadModels } from "../game/skier-models.ts";
import { skierPose, type SkierPoseInput } from "../game/skier-pose.ts";
import { rigSkier } from "../game/skier-rig.ts";
import {
  createSkisModel,
  mountsOf,
  pairStyle,
  SLOT_DRESS,
  type SkisModel,
} from "../game/skis-body.ts";
import type { SkierDress } from "../game/skier-dress.ts";

type Drawn = { rows: number; cols: number; note: string; table: string[] };

declare global {
  interface Window {
    __gear?: { ready: Promise<void>; sheet(): Drawn };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "catalog";
const cell = Number(params.get("cell") ?? 300);
const slotsAsked = (params.get("slots") ?? GEAR_SLOTS.join(",")).split(",") as GearSlot[];
/** Outfits: start-line slot numbers, or seven ids joined by dots. */
const outfitsAsked = (params.get("outfits") ?? "0,1,2,3").split(",");
const models = (params.get("models") ?? "").split(",").filter(Boolean);
const refs = (params.get("refs") ?? "").split(",").filter(Boolean);
const spec: SkiSpec = SKI_CATALOG.find((s) => s.id === (params.get("skis") ?? SKIS.id)) ?? SKIS;

function dressFrom(asked: string): SkierDress {
  if (/^\d+$/.test(asked)) return SLOT_DRESS[Number(asked) % SLOT_DRESS.length];
  const ids = asked.split(".");
  const o = { ...DEFAULT_OUTFIT };
  GEAR_SLOTS.forEach((slot, i) => {
    if (ids[i]) (o as Record<GearSlot, string>)[slot] = ids[i];
  });
  return { outfit: o };
}
const dresses = outfitsAsked.map(dressFrom);

// ---------------------------------------------------------------- scene
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
sun.position.set(3, 8, -2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
sun.shadow.camera.right = sun.shadow.camera.top = 3;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const snow = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xe9eff6, roughness: 0.95 }),
);
snow.rotation.x = -Math.PI / 2;
snow.receiveShadow = true;
scene.add(snow);
const lens = new THREE.PerspectiveCamera(26, 3 / 4, 0.03, 300);
const plain = <M extends THREE.Material>(m: M): M => m;

// ---------------------------------------------------------------- poses
type Moment = { name: string; input: Partial<SkierPoseInput> };
const carve = (steer: number): Partial<SkierPoseInput> => ({
  steer,
  edge: steer * 0.8,
  hipRight: steer * SKIS.hipReach,
});
const MOMENTS: Moment[] = [
  { name: "stood", input: {} },
  { name: "carve left", input: carve(-1) },
  { name: "carve right", input: carve(1) },
  { name: "tuck", input: { crouch: 1 } },
  { name: "plant", input: { plant: 1 } },
  { name: "lean back", input: { lean: -1, hipAft: -0.2 } },
  { name: "air", input: { airborne: true, lean: 0.25 } },
  ...(["daffy", "spread", "grab"] as TrickPose[]).map((trick) => ({
    name: trick,
    input: { airborne: true, trick },
  })),
];
const inputOf = (m: Moment): SkierPoseInput => ({
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
  bump: 0,
  mounts: mountsOf(spec),
  ...m.input,
});

// ---------------------------------------------------------------- subjects
/** One skier to draw: the dressed figure or a model, posed at a moment. */
type Subject = {
  label: string;
  root: THREE.Object3D;
  tris: number;
  /** What it cost to make, as the lab measured it (the figure's cut) or
   * as said (a model's `make blender`). */
  cost: string;
  pose(m: Moment): void;
};

const figures = new Map<string, SkisModel>();
/** The dressed figure on the pair, built once per outfit. */
function figureOf(d: SkierDress): { model: SkisModel; ms: number } {
  const key = outfitKey(d.outfit, d.tone);
  let m = figures.get(key);
  let ms = 0;
  if (!m) {
    const t0 = performance.now();
    dressOutfit(d.outfit, d.tone);
    ms = performance.now() - t0;
    m = createSkisModel(spec, pairStyle(spec, d), plain);
    m.root.position.set(0, spec.cogHeight, 0);
    m.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(m.root);
    figures.set(key, m);
  }
  return { model: m, ms };
}

function dressedTris(d: SkierDress): number {
  const cut = dressOutfit(d.outfit, d.tone);
  return (cut.cloth.index.length + cut.hard.index.length) / 3;
}

function figureSubject(d: SkierDress, label: string): Subject {
  const { model, ms } = figureOf(d);
  return {
    label,
    root: model.root,
    tris: dressedTris(d),
    cost: `cut in ${ms.toFixed(0)} ms`,
    pose: (m) => {
      const dressed = model.root.getObjectByName("dressed");
      if (dressed) dressed.visible = true;
      model.poseSkier(inputOf(m));
    },
  };
}

const loader = new GLTFLoader();
async function modelSubject(file: string, d: SkierDress): Promise<Subject> {
  const gltf: GLTF = await loader.loadAsync(file);
  const sceneOf = cloneSkinned(gltf.scene);
  const colours = coloursOf(d.outfit, d.tone);
  let tris = 0;
  sceneOf.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    const dress = (mat: THREE.Material) => {
      const own = mat.clone() as THREE.MeshStandardMaterial;
      const c = dressOf(mat.name, null, colours);
      if (c) own.color.setHex(c.colour);
      return own;
    };
    o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
  });
  sceneOf.rotation.y = Math.PI;
  // The model stands on its own copy of the pair, the code skier hidden.
  const pair = createSkisModel(spec, pairStyle(spec, d), plain);
  pair.root.position.set(0, spec.cogHeight, 0);
  const holder = new THREE.Group();
  holder.add(sceneOf);
  pair.root.add(holder);
  scene.add(pair.root);
  const rig = rigSkier(holder, gltf.animations);
  return {
    label: file.replace(/^.*\//, ""),
    root: pair.root,
    tris,
    cost: "made by Blender",
    pose: (m) => {
      pair.poseSkier(inputOf(m));
      const dressed = pair.root.getObjectByName("dressed");
      if (dressed) dressed.visible = false;
      rig.pose(skierPose(inputOf(m)));
    },
  };
}

let shown: THREE.Object3D | null = null;
function only(root: THREE.Object3D): void {
  for (const m of scene.children) {
    if (m === snow || m === sun || m === sun.target || m instanceof THREE.HemisphereLight) continue;
    m.visible = m === root;
  }
  shown = root;
}

// ---------------------------------------------------------------- lenses
type View = {
  name: string;
  bearing: number;
  up: number;
  dist: number;
  aim: "body" | "head" | "hand";
  /** Where on him a body view aims, m over the snow (his middle when left out). */
  at?: number;
};
const BODY_VIEWS: View[] = [
  { name: "behind", bearing: 180, up: 12, dist: 4.2, aim: "body" },
  { name: "rear three", bearing: 140, up: 10, dist: 4.2, aim: "body" },
  { name: "side", bearing: 90, up: 4, dist: 4.2, aim: "body" },
  { name: "front three", bearing: 35, up: 8, dist: 4.2, aim: "body" },
];
const CLOSE: Partial<Record<GearSlot, View>> = {
  helmet: { name: "head", bearing: 140, up: 10, dist: 1.1, aim: "head" },
  gloves: { name: "fist", bearing: 60, up: 20, dist: 0.9, aim: "hand" },
  poles: { name: "poles", bearing: 115, up: 10, dist: 3.6, aim: "body", at: 0.55 },
  body: { name: "front", bearing: 0, up: 6, dist: 3.4, aim: "body" },
  jacket: { name: "back close", bearing: 165, up: 14, dist: 2.2, aim: "body" },
  pants: { name: "legs", bearing: 150, up: 4, dist: 2.4, aim: "body", at: 0.5 },
};

const at = new THREE.Vector3();
function aim(root: THREE.Object3D, v: View, w: number, h: number): THREE.PerspectiveCamera {
  root.updateMatrixWorld(true);
  if (v.aim === "body") at.set(0, v.at ?? spec.cogHeight + 0.1, 0);
  else {
    const bone = root.getObjectByName(v.aim === "head" ? "head" : "hand_r");
    if (bone) bone.getWorldPosition(at);
  }
  const b = (v.bearing * Math.PI) / 180;
  const u = (v.up * Math.PI) / 180;
  lens.position.set(
    at.x + Math.sin(b) * Math.cos(u) * v.dist,
    at.y + Math.sin(u) * v.dist,
    at.z + Math.cos(b) * Math.cos(u) * v.dist,
  );
  lens.up.set(0, 1, 0);
  lens.lookAt(at);
  lens.aspect = w / h;
  lens.fov = 26;
  lens.updateProjectionMatrix();
  sun.position.set(at.x + 2, at.y + 7, at.z - 3);
  sun.target.position.copy(at);
  return lens;
}

// ---------------------------------------------------------------- the sheet
function layout(rows: number, cols: number, w: number, h: number, extra = 0): number {
  const top = 26;
  renderer.setSize(cols * w + extra, rows * h + top, false);
  canvas.style.width = `${cols * w + extra}px`;
  canvas.style.height = `${rows * h + top}px`;
  renderer.setScissor(0, 0, cols * w + extra, rows * h + top);
  renderer.setViewport(0, 0, cols * w + extra, rows * h + top);
  renderer.setClearColor(0x0b1116);
  renderer.clear();
  for (const old of host.querySelectorAll(".label, img")) old.remove();
  return top;
}

function label(text: string, x: number, y: number, title = false): void {
  const el = document.createElement("div");
  el.className = title ? "label title" : "label";
  el.textContent = text;
  el.style.left = `${x + 6}px`;
  el.style.top = `${y + 4}px`;
  host.appendChild(el);
}

function cellAt(col: number, row: number, rows: number, w: number, h: number, x0 = 0): void {
  const x = x0 + col * w;
  const y = (rows - 1 - row) * h;
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
  renderer.clear();
}

const WIRE = new THREE.MeshBasicMaterial({
  color: 0x0b1116,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
  depthFunc: THREE.LessEqualDepth,
});

function drawRows(
  title: string,
  rowsOf: { label: string; subject: Subject; moment?: Moment }[],
  views: (row: number) => View[],
  wire = false,
): Drawn {
  const cols = Math.max(...rowsOf.map((_, i) => views(i).length));
  const rows = rowsOf.length;
  const w = cell;
  const h = Math.round(cell * 1.15);
  const top = layout(rows, cols, w, h);
  label(title, 0, 0, true);
  const table: string[] = [];
  rowsOf.forEach((r, row) => {
    r.subject.pose(r.moment ?? MOMENTS[0]);
    only(r.subject.root);
    views(row).forEach((v, col) => {
      cellAt(col, row, rows, w, h);
      const cam = aim(r.subject.root, v, w, h);
      renderer.render(scene, cam);
      if (wire) {
        renderer.autoClear = false;
        scene.overrideMaterial = WIRE;
        renderer.render(scene, cam);
        scene.overrideMaterial = null;
        renderer.autoClear = true;
      }
      label(col === 0 ? `${r.label} · ${v.name}` : v.name, col * w, top + row * h);
    });
    if (wire || sheet === "compare") {
      label(`${r.subject.tris} triangles · ${r.subject.cost}`, 0, top + row * h + h - 22);
    }
    table.push(`${r.label}: ${r.subject.tris} triangles, ${r.subject.cost}`);
  });
  return { rows, cols, note: sheet, table };
}

const nameOf = (slot: GearSlot, id: string) =>
  (GEAR[slot] as readonly { id: string; name: string }[]).find((g) => g.id === id)?.name ?? id;
const outfitLabel = (o: Outfit) => GEAR_SLOTS.map((s) => nameOf(s, o[s])).join(" · ");

function drawCatalog(): Drawn {
  const rows: { label: string; subject: Subject }[] = [];
  const close: View[] = [];
  for (const slot of slotsAsked) {
    for (const g of GEAR[slot] as readonly { id: string; name: string }[]) {
      const outfit = { ...DEFAULT_OUTFIT, [slot]: g.id } as Outfit;
      rows.push({
        label: `${slot}: ${g.name}`,
        subject: figureSubject({ outfit }, g.name),
      });
      close.push(CLOSE[slot] ?? BODY_VIEWS[0]);
    }
  }
  return drawRows(
    "catalog — every piece over the default kit: behind, rear three, side, front three, close",
    rows,
    (i) => [...BODY_VIEWS, close[i]],
  );
}

function drawOutfits(wire: boolean): Drawn {
  const rows = dresses.map((d, i) => ({
    label: `${outfitsAsked[i]}: ${outfitLabel(d.outfit)}`,
    subject: figureSubject(d, outfitsAsked[i]),
  }));
  return drawRows(
    wire
      ? "wire — every triangle's edges, and each outfit's count"
      : "outfits — every start-line kit asked for, from four sides",
    rows,
    () => (wire ? BODY_VIEWS.slice(0, 3) : [...BODY_VIEWS, CLOSE.helmet!]),
    wire,
  );
}

function drawPoses(): Drawn {
  const d = dresses[0];
  const subject = figureSubject(d, outfitsAsked[0]);
  const rows = MOMENTS.map((m) => ({ label: m.name, subject, moment: m }));
  return drawRows(
    `poses — ${outfitLabel(d.outfit)}, through the moves the rig is posed in`,
    rows,
    () => [BODY_VIEWS[0], BODY_VIEWS[1], BODY_VIEWS[2], BODY_VIEWS[3]],
  );
}

let compared: Subject[] = [];
function drawCompare(): Drawn {
  const pick = ["stood", "carve left", "tuck", "air", "daffy"];
  const moments = MOMENTS.filter((m) => pick.includes(m.name));
  const rowsOf: { label: string; subject: Subject; moment: Moment }[] = [];
  for (const s of compared) {
    for (const m of moments)
      rowsOf.push({ label: `${s.label} · ${m.name}`, subject: s, moment: m });
  }
  return drawRows(
    "compare — the dressed figure (code) and each model, one kit, the same moves",
    rowsOf,
    () => [BODY_VIEWS[1], BODY_VIEWS[2], BODY_VIEWS[3]],
  );
}

/** THE GAME'S CAMERAS (`camera-rigs.ts`' chase and far, standing still) in
 * a 1280×720 frame, the window round him enlarged unsmoothed. */
const FRAME = { w: 1280, h: 720 };
const BOOMS = {
  chase: { dist: 5.2, height: 1.6, aimAhead: 8, aimHeight: -0.25, fov: 62 },
  far: { dist: 10, height: 3.6, aimAhead: 10, aimHeight: -0.2, fov: 56 },
};
const CROP = { w: 170, h: 220, zoom: 1.7 };
const target = new THREE.WebGLRenderTarget(CROP.w, CROP.h, {
  type: THREE.HalfFloatType,
  magFilter: THREE.NearestFilter,
  minFilter: THREE.NearestFilter,
  samples: 4,
});
const blit = new THREE.Scene();
blit.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: target.texture }),
  ),
);
const unit = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function drawGame(): Drawn {
  const shots = [
    { name: "chase · stood", moment: MOMENTS[0], boom: BOOMS.chase },
    { name: "chase · carve", moment: MOMENTS[2], boom: BOOMS.chase },
    { name: "chase · tuck", moment: MOMENTS[3], boom: BOOMS.chase },
    { name: "far · tuck", moment: MOMENTS[3], boom: BOOMS.far },
  ];
  const subjects = [
    ...dresses.map((d, i) => figureSubject(d, outfitsAsked[i])),
    ...compared.slice(1),
  ];
  const rows = subjects.length;
  const cols = shots.length;
  const w = CROP.w * CROP.zoom;
  const h = CROP.h * CROP.zoom;
  const top = layout(rows, cols, w, h);
  label(`game — his window in a ${FRAME.w}×${FRAME.h} frame, ×${CROP.zoom} unsmoothed`, 0, 0, true);
  const centre = new THREE.Vector3();
  subjects.forEach((s, row) => {
    only(s.root);
    shots.forEach((shot, col) => {
      s.pose(shot.moment);
      s.root.updateMatrixWorld(true);
      const b = shot.boom;
      const cam = new THREE.PerspectiveCamera(b.fov, FRAME.w / FRAME.h, 0.05, 400);
      cam.position.set(0, b.height + 0.9, -b.dist);
      cam.lookAt(0, 0.9 + b.aimHeight, b.aimAhead);
      cam.updateMatrixWorld();
      centre.set(0, spec.cogHeight * 0.85, 0).project(cam);
      const px = ((centre.x + 1) / 2) * FRAME.w;
      const py = ((1 - centre.y) / 2) * FRAME.h;
      cam.setViewOffset(
        FRAME.w,
        FRAME.h,
        Math.round(px - CROP.w / 2),
        Math.round(py - CROP.h / 2),
        CROP.w,
        CROP.h,
      );
      cam.updateProjectionMatrix();
      sun.position.set(2, 8, -3);
      sun.target.position.set(0, 0.8, 0);
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, CROP.w, CROP.h);
      renderer.setScissor(0, 0, CROP.w, CROP.h);
      renderer.setClearColor(0xdfe7ef);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      cellAt(col, row, rows, w, h);
      renderer.render(blit, unit);
      label(col === 0 ? `${s.label} · ${shot.name}` : shot.name, col * w, top + row * h);
    });
  });
  return { rows, cols, note: "game", table: [] };
}

/** THE REFERENCES: the photographs in a row a slot (their file names lead
 * with the slot: `jacket-…`, `pants-…`), the slot's pieces as drawn after
 * them. */
function drawRefs(): Drawn {
  const w = cell;
  const h = Math.round(cell * 1.15);
  const bySlot = GEAR_SLOTS.map((slot) => ({
    slot,
    photos: refs.filter((r) =>
      r
        .replace(/^.*\//, "")
        .startsWith(slot === "gloves" ? "glove" : slot === "poles" ? "pole" : slot),
    ),
  })).filter((r) => r.photos.length && slotsAsked.includes(r.slot));
  const maxPhotos = Math.min(4, Math.max(0, ...bySlot.map((r) => r.photos.length)));
  const maxPieces = Math.max(1, ...bySlot.map((r) => GEAR[r.slot].length));
  const rows = bySlot.length;
  const x0 = maxPhotos * w;
  const top = layout(rows, maxPieces, w, h, x0);
  label(
    "refs — real gear (local photographs, never committed) beside the pieces as drawn",
    0,
    0,
    true,
  );
  bySlot.forEach((r, row) => {
    r.photos.slice(0, maxPhotos).forEach((src, k) => {
      const img = document.createElement("img");
      img.src = src;
      img.style.cssText = `position:absolute;left:${k * w}px;top:${top + row * h}px;width:${w}px;height:${h}px;object-fit:contain;background:#222`;
      host.appendChild(img);
    });
    (GEAR[r.slot] as readonly { id: string; name: string }[]).forEach((g, col) => {
      const outfit = { ...DEFAULT_OUTFIT, [r.slot]: g.id } as Outfit;
      const s = figureSubject({ outfit }, g.name);
      s.pose(MOMENTS[0]);
      only(s.root);
      cellAt(col, row, rows, w, h, x0);
      renderer.render(scene, aim(s.root, CLOSE[r.slot] ?? BODY_VIEWS[1], w, h));
      label(`${r.slot}: ${g.name}`, x0 + col * w, top + row * h);
    });
  });
  return { rows, cols: maxPhotos + maxPieces, note: "refs", table: [] };
}

async function load(): Promise<void> {
  await loadModels();
  compared = [figureSubject(dresses[0], "code · dressed")];
  for (const f of models) compared.push(await modelSubject(f, dresses[0]));
  void shown;
}

window.__gear = {
  ready: load(),
  sheet: () => {
    switch (sheet) {
      case "outfits":
        return drawOutfits(false);
      case "wire":
        return drawOutfits(true);
      case "poses":
        return drawPoses();
      case "game":
        return drawGame();
      case "compare":
        return drawCompare();
      case "refs":
        return drawRefs();
      default:
        return drawCatalog();
    }
  },
};
