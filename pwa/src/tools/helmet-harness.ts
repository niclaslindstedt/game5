// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELMET LAB's page (driven by `scripts/helmet-preview.mjs`): the head
// in its helmet, as the game draws it — the CODE's (`dress-head.ts` over `helmet-shape.ts`, on
// the dressed figure) and a MODEL's (a Blender skier, `make blender KIND=skier`, a
// candidate the driver serves beside it), both posed by the game's own
// pose on the same spot, so a row of one is a row of the other. Four
// sheets:
//
//   views    every source × kit a row; the head from the front, the
//            three-quarter, the side, the rear three-quarter, the back,
//            above, and the chase camera's angle down onto it
//   wire     the same heads with every triangle's edges drawn over them,
//            and how many triangles the head carries — where they went
//   profile  the side, the front and the top, flat, on a centimetre grid
//            centred on the head's middle, with the envelope a real ski
//            helmet of an adult's size fills drawn over it (the dashed
//            boxes) and the eye line
//   game     the whole skier stood and tucked as the CHASE and FAR cameras
//            frame him in a 1280×720 frame, the head's window enlarged
//            without smoothing — the pixels a player actually reads
//
// The head's frame (z ahead, y up, the origin at the middle of the head)
// is the code figure's `head` group; every lens is placed in it, so "front"
// is the face whichever way the pose turned the head.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SKIS } from "@engine";

import { dressOf } from "../game/skier-models.ts";
import { createSkier, type SkierFigure } from "../game/skier-figure.ts";
import { skierPose, type SkierPoseInput } from "../game/skier-pose.ts";
import { rigSkier } from "../game/skier-rig.ts";
import { coloursOf } from "../game/outfit.ts";
import { mountsOf, SLOT_DRESS } from "../game/skis-body.ts";

type Drawn = { rows: number; cols: number; note: string; table: string[] };

declare global {
  interface Window {
    __helmet?: { ready: Promise<void>; sheet(): Drawn };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "views";
const cell = Number(params.get("cell") ?? 300);
const slots = (params.get("slots") ?? "0").split(",").map(Number);
/** The sources drawn: `code` and every model file served beside the page. */
const sources = (params.get("sources") ?? "code").split(",");

/** The poses: on the move, stood up, and folded into the tuck. */
const STAND: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
  mounts: mountsOf(SKIS),
};
const TUCK: SkierPoseInput = { ...STAND, crouch: 1 };

/** The views round the head, in its own frame: the bearing from its
 * front, clockwise from above, deg, and how far up the lens looks down
 * from, deg. */
const VIEWS: { name: string; bearing: number; down: number }[] = [
  { name: "front", bearing: 0, down: 4 },
  { name: "three", bearing: 40, down: 12 },
  { name: "side", bearing: 90, down: 2 },
  { name: "rear three", bearing: 140, down: 12 },
  { name: "back", bearing: 180, down: 4 },
  { name: "above", bearing: 180, down: 80 },
  { name: "chase", bearing: 180, down: 17 },
];
const WIRE_VIEWS = ["front", "three", "side", "back", "above"];

/** THE ENVELOPE a ski helmet of an adult's medium fills (a head 19.5 cm
 * long and 15.5 wide in 2–3.5 cm of wall), cm: the smallest and the
 * largest — the profile's dashed boxes. Long × wide × from the lower edge
 * of the ear cover to the crown. */
const ENVELOPE = { long: [26, 28], wide: [21, 23], tall: [20, 22] } as const;

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

const lens = new THREE.PerspectiveCamera(13, 4 / 3, 0.05, 300);
const flat = new THREE.OrthographicCamera(-0.2, 0.2, 0.15, -0.15, 0.01, 10);

/** One head to draw: a source in a kit, posed. */
type Head = {
  label: string;
  root: THREE.Object3D;
  /** The head's frame as drawn — where every lens is placed from. */
  frame: THREE.Object3D;
  /** The triangles the head carries, by part. */
  tris: Map<string, number>;
  pose(p: SkierPoseInput): void;
};

const loader = new GLTFLoader();
const gltfs = new Map<string, Promise<GLTF>>();
const plain = <M extends THREE.Material>(m: M): M => m;

/** The code's figure in a kit; its head's triangles by material. */
function codeHead(slot: number): Head {
  const fig: SkierFigure = createSkier(SLOT_DRESS[slot], plain);
  fig.group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  // The head's share of the dressed skin: every triangle whose corners all
  // ride the head bone, by the mesh it is drawn in.
  const tris = new Map<string, number>();
  for (const o of fig.skin) {
    const head = o.skeleton.bones.findIndex((b) => b.name === "head");
    const idx = o.geometry.getAttribute("skinIndex");
    const wgt = o.geometry.getAttribute("skinWeight");
    const rides = (v: number) => {
      for (let k = 0; k < 4; k++)
        if (idx.getComponent(v, k) === head && wgt.getComponent(v, k) > 0.5) return true;
      return false;
    };
    const index = o.geometry.index!;
    let n = 0;
    for (let i = 0; i < index.count; i += 3) {
      if (rides(index.getX(i)) && rides(index.getX(i + 1)) && rides(index.getX(i + 2))) n++;
    }
    tris.set(o.name, n);
  }
  return {
    label: `code · slot ${slot}`,
    root: fig.group,
    frame: fig.head,
    tris,
    pose: (p) => fig.pose(p),
  };
}

/** A model in a kit, posed by the game's rig on the code figure's spot;
 * the triangles riding the head bone, by material. */
async function modelHead(file: string, slot: number, frameOf: Head): Promise<Head> {
  let job = gltfs.get(file);
  if (!job) {
    job = loader.loadAsync(file);
    gltfs.set(file, job);
  }
  const gltf = await job;
  const scene = cloneSkinned(gltf.scene);
  const tris = new Map<string, number>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;
    const dress = (m: THREE.Material) => {
      const own = m.clone() as THREE.MeshStandardMaterial;
      const d = dressOf(m.name, null, coloursOf(SLOT_DRESS[slot].outfit, SLOT_DRESS[slot].tone));
      if (d) own.color.setHex(d.colour);
      own.name = m.name;
      return own;
    };
    o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
    // The head's share: every triangle whose corners all ride the head.
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const head = o.skeleton.bones.findIndex((b) => b.name === "head");
    const idx = o.geometry.getAttribute("skinIndex");
    const wgt = o.geometry.getAttribute("skinWeight");
    const rides = (v: number) => {
      for (let k = 0; k < 4; k++)
        if (idx.getComponent(v, k) === head && wgt.getComponent(v, k) > 0.5) return true;
      return false;
    };
    const index = o.geometry.index;
    const corner = (i: number) => (index ? index.getX(i) : i);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = o.geometry.groups.length
      ? o.geometry.groups
      : [{ start: 0, count: index ? index.count : idx.count, materialIndex: 0 }];
    for (const g of groups) {
      const name = mats[g.materialIndex ?? 0].name;
      for (let i = g.start; i < g.start + g.count; i += 3) {
        if (rides(corner(i)) && rides(corner(i + 1)) && rides(corner(i + 2))) {
          tris.set(name, (tris.get(name) ?? 0) + 1);
        }
      }
    }
  });
  scene.rotation.y = Math.PI;
  const holder = new THREE.Group();
  holder.add(scene);
  const rig = rigSkier(holder, gltf.animations);
  return {
    label: `${file.replace(/^.*\//, "")} · slot ${slot}`,
    root: holder,
    frame: frameOf.frame,
    tris,
    pose: (p) => {
      frameOf.pose(p);
      rig.pose(skierPose(p));
    },
  };
}

let heads: Head[] = [];

async function load(): Promise<void> {
  const out: Head[] = [];
  for (const slot of slots) {
    // The code's figure is built for every row: its head group is the frame
    // every lens is placed in, drawn or not.
    const code = codeHead(slot);
    scene.add(code.root);
    for (const s of sources) {
      if (s === "code") out.push(code);
      else {
        const m = await modelHead(s, slot, code);
        scene.add(m.root);
        out.push(m);
      }
    }
  }
  heads = out;
}

/** Only this head drawn; the code figure whose head frame places a
 * model's lens is still posed while hidden. */
function only(h: Head): void {
  for (const o of heads) o.root.visible = o.root === h.root;
}

const P = new THREE.Vector3();
const Q = new THREE.Quaternion();

/** The lens round a head: `bearing` deg from its front, `down` deg above
 * its level, `dist` m off, in the head's own frame. */
function aimAt(h: Head, bearing: number, down: number, dist: number): THREE.PerspectiveCamera {
  h.root.updateMatrixWorld(true);
  h.frame.updateWorldMatrix(true, false);
  h.frame.getWorldPosition(P);
  h.frame.getWorldQuaternion(Q);
  const b = (bearing * Math.PI) / 180;
  const d = (down * Math.PI) / 180;
  const off = new THREE.Vector3(Math.sin(b) * Math.cos(d), Math.sin(d), Math.cos(b) * Math.cos(d));
  off.applyQuaternion(Q).multiplyScalar(dist);
  lens.position.copy(P).add(off);
  lens.up.set(0, 1, 0).applyQuaternion(Q);
  if (down > 60) lens.up.set(0, 0, 1).applyQuaternion(Q);
  lens.lookAt(P);
  lens.aspect = 4 / 3;
  lens.updateProjectionMatrix();
  sun.position.copy(P).add(new THREE.Vector3(2, 6, -3));
  sun.target.position.copy(P);
  return lens;
}

function layout(rows: number, cols: number, w: number, h: number): number {
  const top = 26;
  renderer.setSize(cols * w, rows * h + top, false);
  canvas.style.width = `${cols * w}px`;
  canvas.style.height = `${rows * h + top}px`;
  renderer.setScissor(0, 0, cols * w, rows * h + top);
  renderer.setViewport(0, 0, cols * w, rows * h + top);
  renderer.setClearColor(0x0b1116);
  renderer.clear();
  for (const old of host.querySelectorAll(".label")) old.remove();
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

/** Set a cell's viewport, cleared to its checker. */
function cellAt(col: number, row: number, rows: number, w: number, h: number): void {
  const x = col * w;
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
  opacity: 0.55,
  depthFunc: THREE.LessEqualDepth,
});

function total(t: Map<string, number>): number {
  let n = 0;
  for (const v of t.values()) n += v;
  return Math.round(n);
}

function drawViews(wire: boolean): Drawn {
  const views = wire ? VIEWS.filter((v) => WIRE_VIEWS.includes(v.name)) : VIEWS;
  const rows = heads.length;
  const cols = views.length;
  const w = cell;
  const h = Math.round(cell * 0.75);
  const top = layout(rows, cols, w, h);
  label(
    wire
      ? "wire — every triangle's edges over the head; the head's own triangles"
      : "views — the head in its helmet: code and model, every kit asked for",
    0,
    0,
    true,
  );
  const table: string[] = [];
  heads.forEach((head, row) => {
    head.pose(STAND);
    only(head);
    views.forEach((v, col) => {
      cellAt(col, row, rows, w, h);
      renderer.setViewport(col * w, (rows - 1 - row) * h, w, h);
      const cam = aimAt(head, v.bearing, v.down, v.name === "chase" ? 2.4 : 1.6);
      cam.fov = v.name === "chase" ? 9 : 13;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      if (wire) {
        renderer.autoClear = false;
        scene.overrideMaterial = WIRE;
        renderer.render(scene, cam);
        scene.overrideMaterial = null;
        renderer.autoClear = true;
      }
      label(col === 0 ? `${head.label} · ${v.name}` : v.name, col * w, top + row * h);
    });
    if (wire) label(`${total(head.tris)} triangles on the head`, 0, top + row * h + h - 24);
    table.push(
      `${head.label}: ${total(head.tris)} head triangles — ${[...head.tris]
        .map(([k, n]) => `${k} ${Math.round(n)}`)
        .join(", ")}`,
    );
  });
  return { rows, cols, note: wire ? "wire" : "views", table };
}

/** A dashed rectangle in the plane the flat lens looks along, cm, round
 * the head's middle. */
function box(w: number, h: number, cx: number, cy: number, colour: number): THREE.LineSegments {
  const pts = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => new THREE.Vector3((cx + x) / 100, (cy + y) / 100, 0));
  const g = new THREE.BufferGeometry().setFromPoints([0, 1, 1, 2, 2, 3, 3, 0].map((i) => pts[i]));
  const l = new THREE.LineSegments(
    g,
    new THREE.LineDashedMaterial({ color: colour, dashSize: 0.006, gapSize: 0.004 }),
  );
  l.computeLineDistances();
  return l;
}

function drawProfile(): Drawn {
  // Each plane: the bearing the flat lens looks from, and the envelope's
  // two measures across and up it with where the box is centred (cm off
  // the head's middle: the shell's middle 0.5 cm behind it, its crown
  // 12.5 cm over it). The side is the left, the front to the right, as a
  // photograph of a helmet's left side has it.
  const CROWN = 12.5;
  const PLANES = [
    {
      name: "side",
      bearing: -90,
      down: 0,
      across: ENVELOPE.long,
      up: ENVELOPE.tall,
      cx: -0.5,
      crown: true,
    },
    {
      name: "front",
      bearing: 0,
      down: 0,
      across: ENVELOPE.wide,
      up: ENVELOPE.tall,
      cx: 0,
      crown: true,
    },
    {
      name: "above",
      bearing: 0,
      down: 89.9,
      across: ENVELOPE.wide,
      up: ENVELOPE.long,
      cx: 0,
      crown: false,
    },
  ];
  const rows = heads.length;
  const cols = PLANES.length;
  const w = Math.round(cell * 1.3);
  const h = Math.round(w * 0.75);
  const top = layout(rows, cols, w, h);
  label(
    "profile — 40 cm across, a centimetre grid on the head's middle; dashed: a real helmet's envelope",
    0,
    0,
    true,
  );
  // The overlay: a grid of centimetres and the envelope's two boxes, laid
  // in the plane facing the flat lens, through the head's middle.
  const overlay = new THREE.Group();
  const grid = new THREE.GridHelper(0.4, 40, 0xd8452e, 0x8795a6);
  grid.rotation.x = Math.PI / 2;
  scene.add(overlay);
  heads.forEach((head, row) => {
    head.pose(STAND);
    only(head);
    PLANES.forEach((pl, col) => {
      cellAt(col, row, rows, w, h);
      const cam = aimAt(head, pl.bearing, pl.down, 2);
      flat.position.copy(cam.position);
      flat.quaternion.copy(cam.quaternion);
      flat.updateProjectionMatrix();
      overlay.clear();
      overlay.add(grid);
      pl.across.forEach((a, k) => {
        const u = pl.up[k];
        const cy = pl.crown ? CROWN - u / 2 : -0.5;
        overlay.add(box(a, u, pl.cx, cy, k ? 0xffe066 : 0x7ce0a0));
      });
      // Behind the head as the lens sees it, so the head stands over it.
      overlay.position
        .copy(P)
        .addScaledVector(new THREE.Vector3().subVectors(P, flat.position).normalize(), 0.3);
      overlay.quaternion.copy(flat.quaternion);
      renderer.render(scene, flat);
      label(col === 0 ? `${head.label} · ${pl.name}` : pl.name, col * w, top + row * h);
    });
  });
  scene.remove(overlay);
  return { rows, cols, note: "profile", table: [] };
}

/** The game's two booms and its frame (`camera-rigs.ts`'s chase and far,
 * standing still), and the window round the head shown enlarged. */
const FRAME = { w: 1280, h: 720 };
const BOOMS = {
  chase: { dist: 5.2, height: 1.6, aimAhead: 8, aimHeight: -0.25, fov: 62 },
  far: { dist: 10, height: 3.6, aimAhead: 10, aimHeight: -0.2, fov: 56 },
};
const CROP = { w: 120, h: 90, zoom: 3 };
const target = new THREE.WebGLRenderTarget(CROP.w, CROP.h, {
  type: THREE.HalfFloatType,
  magFilter: THREE.NearestFilter,
  minFilter: THREE.NearestFilter,
  samples: 4,
});
const shown = new THREE.Scene();
shown.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: target.texture }),
  ),
);
const unit = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function drawGame(): Drawn {
  const shots = [
    { name: "chase · stood", pose: STAND, boom: BOOMS.chase },
    { name: "chase · tuck", pose: TUCK, boom: BOOMS.chase },
    { name: "far · tuck", pose: TUCK, boom: BOOMS.far },
  ];
  const rows = heads.length;
  const cols = shots.length;
  const w = CROP.w * CROP.zoom;
  const h = CROP.h * CROP.zoom;
  const top = layout(rows, cols, w, h);
  label(
    `game — the head's window in a ${FRAME.w}×${FRAME.h} frame, ×${CROP.zoom} unsmoothed`,
    0,
    0,
    true,
  );
  // He skis down +z here (the figure's own forward).
  const head = new THREE.Vector3();
  heads.forEach((hd, row) => {
    only(hd);
    shots.forEach((s, col) => {
      hd.pose(s.pose);
      hd.root.updateMatrixWorld(true);
      hd.frame.getWorldPosition(head);
      const b = s.boom;
      const cam = new THREE.PerspectiveCamera(b.fov, FRAME.w / FRAME.h, 0.05, 400);
      cam.position.set(0, b.height + 0.9, -b.dist);
      cam.lookAt(0, 0.9 + b.aimHeight, b.aimAhead);
      cam.updateMatrixWorld();
      const at = head.clone().project(cam);
      const px = ((at.x + 1) / 2) * FRAME.w;
      const py = ((1 - at.y) / 2) * FRAME.h;
      cam.setViewOffset(
        FRAME.w,
        FRAME.h,
        Math.round(px - CROP.w / 2),
        Math.round(py - CROP.h * 0.4),
        CROP.w,
        CROP.h,
      );
      cam.updateProjectionMatrix();
      sun.position.set(2, 8, -3);
      sun.target.position.set(0, 0.8, 0);
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, CROP.w, CROP.h);
      renderer.setScissor(0, 0, CROP.w, CROP.h);
      renderer.setClearColor(0x7d8b99);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      cellAt(col, row, rows, w, h);
      renderer.render(shown, unit);
      label(col === 0 ? `${hd.label} · ${s.name}` : s.name, col * w, top + row * h);
    });
  });
  return { rows, cols, note: "game", table: [] };
}

window.__helmet = {
  ready: load(),
  sheet: () =>
    sheet === "wire"
      ? drawViews(true)
      : sheet === "profile"
        ? drawProfile()
        : sheet === "game"
          ? drawGame()
          : drawViews(false),
};
