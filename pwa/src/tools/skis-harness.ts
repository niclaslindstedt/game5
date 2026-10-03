// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS LAB's page (driven by `scripts/skis-preview.mjs`): every pair
// and its skier built with the game's own builder (`createSkisModel`) and
// drawn onto one labelled CONTACT SHEET, a cell a view. It exists because
// a pair and a skier are judged by LOOKING, and neither the race (one frame
// of one camera) nor the world lab (a run the bot happened to ski) can hold
// the skier in an exact pose from an exact side. The sheets:
//
//   skis       every pair, the skier stood on it on the move, from the
//              side, the front, the rear, three-quarters and the chase
//              camera's place
//   poses      one pair (`skis=`) in every pose the skier takes — at rest,
//              on the move, carving either way, in the tuck, poling, in
//              the air, folded by a landing, leaning back and forward, the
//              grabs — by view
//   topsheets  every pair in its own topsheet (`ski-topsheets.ts`), a view
//              a column (three-quarters on unless `views=` says)
//   skier      the skier CLOSE UP on one pair, in the poses that read most
//              (at rest, on the move, carving, the tuck, in the air,
//              landed), from behind at the chase camera's height, the rear
//              three-quarter, the side and the front three-quarter — the
//              man judged as a man rather than as sixty pixels on a slope
//   head       the helmet alone, close — every start-line kit a row, round
//              it from the front, three-quarters, the side, the rear
//              three-quarter, the back and over the back as the chase
//              camera sees it, and a PROFILE: the side drawn flat on a
//              centimetre grid centred on the head's middle, to measure
//              against a photograph of a real ski helmet
//   landing    one pair landing: the skier's body on its legs
//              (`stepSkierSpring`) kicked by a skier stopped dead from
//              `vy` m/s, a frame every 60 ms, from the side and the rear
//   asset      one pair (`skis=`) as the builder draws it, then a row for
//              every MODELLED version of it handed in as glTF
//              (`asset-<i>.glb` beside the page, never in the tree — the
//              `blender-assets` skill makes them), each set down on the
//              spec by `lookFrame` and stood on by the game's own skier
//   rig        the builder's pair and every modelled one side by side,
//              posed at the same engine moments — the skis on their edges,
//              skidded, each leg at its bump and its droop — the models by
//              their rigs (`ski-rig.ts`), as the game would pose one
//   clips      every clip the first model carries, played across its
//              length a frame a column (the skier left off) — and every
//              clip of a modelled SKIER (`skier=`), him alone
//   figure     a modelled SKIER (`skier.glb` beside the page) beside the
//              game's own, on the builder's pair, in every pose of the
//              poses sheet — both posed by the same `skierPose`, the model
//              through its bones (`skier-rig.ts`)
//
// A modelled skier also takes the game's figure's place on the asset and
// rig sheets, so a modelled pair is judged with a modelled man on it.
//
// The elevations (side, front, rear) are ORTHOGRAPHIC — a drawing, the
// scale the traced profiles in `ski-looks.ts` are stated at — with a metre
// grid behind them; the three-quarter and chase views are the lens's.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gearLift, KNEE_TRAVEL, skiTilt } from "../game/ski-gear.ts";
import { rigAsset, type AssetRig } from "../game/ski-rig.ts";
import { rigSkier, type SkierRig } from "../game/skier-rig.ts";
import {
  freshSkier,
  SKIS,
  SKI_CATALOG,
  skisById,
  type Save,
  type SkiSpec,
  type SkierState,
  type TrickPose,
} from "@engine";

import { joltOf } from "../game/skier-save.ts";
import { createSkier, type SkierFigure } from "../game/skier-figure.ts";
import {
  createSkierSpring,
  skierPose,
  stepSkierSpring,
  type SkierPoseInput,
  type SkierSpring,
} from "../game/skier-pose.ts";
import {
  createSkisModel,
  mountsOf,
  REST_SAG,
  pairStyle,
  SLOT_DRESS,
  type SkisModel,
} from "../game/skis-body.ts";
import { TOPSHEETS } from "../game/ski-topsheets.ts";
import { lookFrame } from "../game/ski-looks.ts";

type Sheet =
  | "skis"
  | "poses"
  | "landing"
  | "topsheets"
  | "skier"
  | "head"
  | "asset"
  | "rig"
  | "clips"
  | "figure";
type View =
  "side" | "front" | "rear" | "three" | "chase" | "top" | "back" | "back3" | "near" | "front3";

declare global {
  interface Window {
    __skis?: { ready: Promise<void>; sheet(): { rows: number; cols: number; note: string } };
  }
}

const params = new URLSearchParams(location.search);
const sheet = (params.get("sheet") ?? "skis") as Sheet;
const cell = Number(params.get("cell") ?? 300);
const spec = skisById(params.get("skis") ?? SKIS.id);
const slot = Number(params.get("slot") ?? 0) % SLOT_DRESS.length;
const landVy = Number(params.get("vy") ?? 6);
const onlyViews = (params.get("views") ?? "").split(",").filter(Boolean) as View[];
const assetNames = (params.get("assets") ?? "").split(",").filter(Boolean);
const riderName = params.get("skier") ?? params.get("rider") ?? "";

/** The moments the skier sheet shows him close up in. */
const RIDER_POSES = [
  "at rest",
  "on the move",
  "carving left",
  "in the tuck",
  "in the air",
  "landed, folded",
];

/** A moment to pose the skier at: what the engine would report. */
type Moment = {
  name: string;
  steer?: number;
  lean?: number;
  /** The tuck the body is in, 0..1, and a pole plant in hand, 0..1. */
  crouch?: number;
  plant?: number;
  /** The skid, 0..1 — the skis pivoted across the way. */
  skid?: number;
  airborne?: boolean;
  /** The body on its legs, folded by this much, m. */
  bump?: number;
  trick?: TrickPose;
  /** The skier rolled, rad (a carve is skied rolled into the turn). */
  roll?: number;
  /** Either leg's compression past its rest, m. */
  left?: number;
  right?: number;
  /** A near fall ridden out (`skier-save.ts`), shown at its peak. */
  save?: Omit<Save, "t">;
};

const POSES: Moment[] = [
  { name: "at rest" },
  { name: "on the move" },
  { name: "carving left", steer: -1, roll: -0.35 },
  { name: "carving right", steer: 1, roll: 0.35 },
  { name: "in the tuck", crouch: 1 },
  { name: "poling", plant: 1 },
  { name: "in the air", airborne: true, lean: 0.25 },
  { name: "landed, folded", bump: 0.18 },
  { name: "leaning back", lean: 1 },
  { name: "leaning forward", lean: -1 },
  { name: "daffy", airborne: true, trick: "daffy" },
  { name: "spread", airborne: true, trick: "spread" },
  { name: "grab", airborne: true, trick: "grab" },
  { name: "saved a landing", save: { kind: "landing", size: 1, side: 0, fore: 1 } },
  { name: "trunk on the right", save: { kind: "tree", size: 1, side: 1, fore: 0 } },
  { name: "hand down, left", save: { kind: "body", size: 1, side: -1, fore: 0 } },
  { name: "edge bit, right", save: { kind: "edge", size: 1, side: 1, fore: 0 } },
];

/** The moments the rig sheet poses every pair at: the edge each way, the
 * skid, and each leg through the drawn travel. */
const RIG_MOMENTS: Moment[] = [
  { name: "rest" },
  { name: "edge left", steer: -1 },
  { name: "edge right", steer: 1 },
  { name: "skid", skid: 1, steer: 0.5 },
  { name: "left bump", left: KNEE_TRAVEL[1] },
  { name: "left droop", left: KNEE_TRAVEL[0] },
  { name: "right bump", right: KNEE_TRAVEL[1] },
  { name: "right droop", right: KNEE_TRAVEL[0] },
];
/** The clips sheet's frames across a clip. */
const CLIP_FRAMES = 6;

const VIEWS_OF: Record<Sheet, View[]> = {
  skis: ["side", "front", "rear", "three", "chase"],
  poses: ["side", "front", "rear", "chase"],
  landing: ["side", "rear"],
  topsheets: ["three"],
  skier: ["back", "back3", "near", "front3"],
  head: [],
  asset: ["side", "front", "rear", "three", "chase"],
  rig: ["three", "side", "front", "rear"],
  clips: ["three"],
  figure: ["back", "back3", "near", "front3", "three", "side"],
};

/** The head sheet's angles round the helmet: the bearing from its front,
 * clockwise from above, deg, and the lens's height over it, m. */
const HEAD_VIEWS: { name: string; bearing: number; rise: number }[] = [
  { name: "front", bearing: 0, rise: 0.02 },
  { name: "three", bearing: 45, rise: 0.05 },
  { name: "side", bearing: 90, rise: 0.02 },
  { name: "rear three", bearing: 135, rise: 0.05 },
  { name: "back", bearing: 180, rise: 0.02 },
  { name: "chase", bearing: 180, rise: 0.45 },
  { name: "profile", bearing: -90, rise: 0 },
];
/** The pose the head sheet holds him in: on the move, the skis straight. */
const HEAD_POSE: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
  mounts: mountsOf(SKIS),
};
const riders = new Map<number, SkierFigure>();
/** The skier alone in a kit, stood at the origin in the head sheet's pose. */
function riderOf(kit: number): SkierFigure {
  let r = riders.get(kit);
  if (!r) {
    r = createSkier(SLOT_DRESS[kit], (m) => m);
    r.pose(HEAD_POSE);
    scene.add(r.group);
    riders.set(kit, r);
  }
  return r;
}

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const host = document.getElementById("sheet") as HTMLDivElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x8b95a3, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.4);
sun.position.set(4, 7, 3);
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
// A metre grid on the ground and, for the elevations, on a wall behind.
const grid = new THREE.GridHelper(40, 40, 0x9aa8b8, 0xc4ceda);
grid.position.y = 0.002;
scene.add(grid);
const wall = new THREE.GridHelper(40, 40, 0x9aa8b8, 0xc4ceda);
scene.add(wall);

const plain = <M extends THREE.Material>(m: M): M => m;
const models = new Map<string, SkisModel>();
/** A pair built once, in its own topsheet, the slot's skier on it. */
function modelOf(s: SkiSpec): SkisModel {
  const key = s.id;
  let m = models.get(key);
  if (!m) {
    m = createSkisModel(s, pairStyle(s, SLOT_DRESS[slot]), plain);
    scene.add(m.root);
    models.set(key, m);
  }
  return m;
}

/** The engine's state for a pair at a moment, at rest on the flat. */
function stateAt(s: SkiSpec, at: Moment): SkierState {
  const c = freshSkier(s);
  c.skiCompression[0] = REST_SAG + (at.left ?? 0);
  c.skiCompression[1] = REST_SAG + (at.right ?? 0);
  c.steer = at.steer ?? 0;
  c.edge = c.steer * s.edgeMax * 0.75;
  c.skid = at.skid ?? 0;
  c.skiAngle = c.skid * 0.8 * Math.sign(at.steer ?? 1) + c.edge * 0.08;
  c.lean = at.lean ?? 0;
  c.hipRight = c.steer * s.hipReach;
  c.hipAft = c.lean * 0.2;
  c.crouch = at.crouch ?? 0;
  c.tuck = at.plant ? 1 : c.crouch;
  c.roll = at.roll ?? 0;
  c.airborne = at.airborne ?? false;
  c.landing = 5;
  c.speed = at.plant ? 1 : 15;
  c.way = c.speed;
  return c;
}

/** Pose one pair for a moment, the skier's legs at `legs`. */
function posed(s: SkiSpec, at: Moment, legs: SkierSpring | null): SkisModel {
  const m = modelOf(s);
  for (const other of models.values()) other.root.visible = other === m;
  const c = stateAt(s, at);
  const roll = at.roll ?? 0;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
  // Pose with dt 0, so the model's own spring holds; then lay the skier by
  // hand at the moment's crouch, plant and fold.
  m.pose(c, { x: 0, y: s.cogHeight, z: 0, q: { x: q.x, y: q.y, z: q.z, w: q.w } }, 0, at.trick);
  m.poseSkier(skierAt(c, at, legs));
  return m;
}

/** What the skier is posed by at a moment, the legs at `legs`. */
function skierAt(c: SkierState, at: Moment, legs: SkierSpring | null): SkierPoseInput {
  return {
    bump: legs ? legs.bump : (at.bump ?? 0),
    hipRight: c.hipRight,
    hipAft: c.hipAft,
    lean: c.lean,
    steer: c.steer,
    edge: skiTilt(c),
    skiAngle: c.skiAngle,
    crouch: c.crouch,
    drop: c.spec.crouchDrop * c.crouch,
    lift: gearLift(c),
    plant: at.plant ?? 0,
    airborne: c.airborne,
    landing: c.landing,
    trick: at.trick ?? null,
    jolt: at.save ? joltOf({ ...at.save, t: 0.15 }) : undefined,
    mounts: mountsOf(c.spec),
  };
}

/** THE MODELLED VERSIONS: each glTF is stated in the trace's own frame (z
 * forward from the tail, y up from the snow), exported with glTF's forward
 * on -z — so it is turned about y to face +z and set on the spec the way
 * `lookFrame` sets a trace. They carry no skier: the game's own stands on
 * each, where the builder stands him. */
const assets: THREE.Group[] = [];
const rigs: AssetRig[] = [];
let assetRider: SkierFigure | null = null;
/** A modelled skier, turned as a modelled pair is, in a holder that
 * stands where the game's figure stands (its frame is the pose's). */
let riderModel: { holder: THREE.Group; rig: SkierRig } | null = null;
async function loadAssets(): Promise<void> {
  const F = lookFrame(spec);
  const loader = new GLTFLoader();
  for (let i = 0; i < assetNames.length; i++) {
    const gltf = await loader.loadAsync(`asset-${i}.glb`);
    gltf.scene.rotation.y = Math.PI;
    const holder = new THREE.Group();
    holder.add(gltf.scene);
    holder.position.set(0, spec.cogHeight + F.y(0), F.z(0));
    holder.visible = false;
    scene.add(holder);
    assets.push(holder);
    rigs.push(rigAsset(gltf.scene, gltf.animations));
  }
  if (riderName) {
    const gltf = await new GLTFLoader().loadAsync("skier.glb");
    gltf.scene.rotation.y = Math.PI;
    const holder = new THREE.Group();
    holder.add(gltf.scene);
    holder.position.set(0, spec.cogHeight, 0);
    holder.visible = false;
    scene.add(holder);
    riderModel = { holder, rig: rigSkier(holder, gltf.animations) };
  }
  assetRider = createSkier(SLOT_DRESS[slot], (m) => m);
  assetRider.group.position.set(0, spec.cogHeight, 0);
  assetRider.group.visible = false;
  scene.add(assetRider.group);
}

/** Show modelled version `i` (-1: none), posed by its rig at a moment —
 * or playing a clip, with nobody on it — with the skier posed at the moment. */
function showAsset(i: number, at: Moment, clip?: { name: string; t: number }): void {
  assets.forEach((a, k) => (a.visible = k === i));
  if (!assetRider) return;
  assetRider.group.visible = i >= 0 && !clip && !riderModel;
  if (i < 0) return;
  for (const m of models.values()) m.root.visible = false;
  const c = stateAt(spec, at);
  if (clip) rigs[i].play(clip.name, clip.t);
  else rigs[i].pose(c);
  assetRider.pose(skierAt(c, at, null));
}

/** The modelled skier in a cell: posed at the moment by the game's own
 * pose, playing one of his clips alone, or away. On the skis he stands in
 * for the game's figure, which is hidden. */
function showRider(c: Cell, onMachine: boolean): void {
  if (!riderModel) return;
  const { holder, rig } = riderModel;
  holder.visible = onMachine || !!c.riderClip;
  for (const m of models.values()) m.setSkierVisible(!holder.visible);
  if (c.riderClip) {
    for (const m of models.values()) m.root.visible = false;
    assets.forEach((a) => (a.visible = false));
    rig.play(c.riderClip.name, c.riderClip.t);
  } else if (holder.visible) {
    rig.pose(skierPose(skierAt(stateAt(c.spec, c.at), c.at, c.legs)));
  }
}

const ortho = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 50);
const lens = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

/** The camera for a view of a pair, and where the wall grid stands. */
function camera(view: View, s: SkiSpec): THREE.Camera {
  // The elevations are 4.4 m across (a downhill ski is 2.2 m long, and a
  // skier angulated reaches past his stance), centred on the pair's middle.
  const half = 2.2;
  const set = (x: number, y: number, z: number) => {
    ortho.left = -half;
    ortho.right = half;
    ortho.top = half * 0.75;
    ortho.bottom = -half * 0.75;
    ortho.position.set(x, y, z);
    ortho.lookAt(0, y, x === 0 ? (z > 0 ? -1 : 1) : -0.1);
    ortho.updateProjectionMatrix();
    return ortho;
  };
  wall.visible = view === "side" || view === "front" || view === "rear";
  if (view === "side") {
    wall.rotation.set(0, 0, Math.PI / 2);
    wall.position.set(-3, 0, 0);
    return set(10, 0.75, -0.1);
  }
  if (view === "front") {
    wall.rotation.set(Math.PI / 2, 0, 0);
    wall.position.set(0, 0, -4);
    return set(0, 0.75, 10);
  }
  if (view === "rear") {
    wall.rotation.set(Math.PI / 2, 0, 0);
    wall.position.set(0, 0, 4);
    return set(0, 0.75, -10);
  }
  lens.aspect = 4 / 3;
  // THE CLOSE-UPS, aimed at the skier's chest (about 0.5 m over the CoG).
  const chest = s.cogHeight + 0.5;
  if (view === "near") {
    // The side at a metre and a half across, centred on the skier.
    ortho.left = -0.95;
    ortho.right = 0.95;
    ortho.top = 0.71;
    ortho.bottom = -0.71;
    ortho.position.set(10, chest - 0.1, -0.2);
    ortho.lookAt(0, chest - 0.1, -0.2);
    ortho.updateProjectionMatrix();
    return ortho;
  }
  if (view === "back" || view === "back3" || view === "front3") {
    lens.fov = 30;
    const at = { back: [0, 1.75, -3.6], back3: [2.2, 1.55, -2.9], front3: [2.4, 1.5, 2.6] }[view];
    lens.position.set(at[0], s.cogHeight + at[1], at[2]);
    lens.lookAt(0, chest - 0.15, -0.2);
    lens.updateProjectionMatrix();
    return lens;
  }
  if (view === "three") {
    lens.fov = 32;
    lens.position.set(5.2, 2.6, 5.4);
    lens.lookAt(0, 0.55, -0.15);
  } else if (view === "top") {
    lens.fov = 32;
    lens.position.set(0, 11, -0.2);
    lens.lookAt(0, 0, -0.2);
  } else {
    // THE CHASE CAMERA's place on level snow at a crawl (`camera-rigs.ts`:
    // 5 m back, 2.2 m over his centre of gravity, the look pitched to stand
    // him under the middle of the frame) — the view the skier is judged from.
    lens.fov = 59;
    lens.position.set(0, 3.2, -5);
    lens.lookAt(0, 0.35, 7);
  }
  lens.updateProjectionMatrix();
  return lens;
}

type Cell = {
  /** The modelled version drawn instead of the builder's pair. */
  asset?: number;
  /** The modelled skier on the pair instead of the game's figure. */
  model?: boolean;
  /** One of the modelled skier's clips, played with him alone. */
  riderClip?: { name: string; t: number };
  /** A clip of it played at a moment instead of its rig posed. */
  clip?: { name: string; t: number };
  spec: SkiSpec;
  at: Moment;
  legs: SkierSpring | null;
  view: View;
  label: string;
};

function cells(): { rows: number; cols: number; list: Cell[] } {
  const views = VIEWS_OF[sheet].filter((v) => !onlyViews.length || onlyViews.includes(v));
  const list: Cell[] = [];
  if (sheet === "skis") {
    for (const s of SKI_CATALOG) {
      for (const view of views) {
        list.push({
          spec: s,
          at: POSES[1],
          legs: null,
          view,
          label: `${s.name} · ${s.kind} · ${view}`,
        });
      }
    }
    return { rows: SKI_CATALOG.length, cols: views.length, list };
  }
  if (sheet === "asset") {
    const rows = ["builder", ...assetNames];
    rows.forEach((name, r) => {
      for (const view of views) {
        list.push({
          spec,
          at: POSES[1],
          legs: null,
          view,
          label: `${spec.name} · ${name} · ${view}`,
          asset: r - 1,
        });
      }
    });
    return { rows: rows.length, cols: views.length, list };
  }
  if (sheet === "rig") {
    const machines = ["builder", ...assetNames];
    for (const at of RIG_MOMENTS) {
      machines.forEach((name, k) => {
        for (const view of views) {
          list.push({
            spec,
            at,
            legs: null,
            view,
            label: `${name} · ${at.name} · ${view}`,
            asset: k - 1,
          });
        }
      });
    }
    return { rows: RIG_MOMENTS.length, cols: machines.length * views.length, list };
  }
  if (sheet === "figure") {
    for (const at of POSES) {
      for (const model of [false, true]) {
        for (const view of views) {
          const label = `${model ? riderName : "game"} · ${at.name} · ${view}`;
          list.push({ spec, at, legs: null, view, label, model });
        }
      }
    }
    return { rows: POSES.length, cols: 2 * views.length, list };
  }
  if (sheet === "clips") {
    const clips = rigs[0]?.clips ?? [];
    const riderClips = riderModel?.rig.clips ?? [];
    for (const name of riderClips) {
      const seconds = riderModel!.rig.seconds(name);
      for (let f = 0; f < CLIP_FRAMES; f++) {
        const t = (seconds * f) / (CLIP_FRAMES - 1);
        list.push({
          spec,
          at: POSES[1],
          legs: null,
          view: views[0] ?? "three",
          label: `${riderName} · ${name} · ${t.toFixed(2)} s`,
          riderClip: { name, t },
        });
      }
    }
    for (const c of clips) {
      for (let f = 0; f < CLIP_FRAMES; f++) {
        const t = (c.seconds * f) / (CLIP_FRAMES - 1);
        list.push({
          spec,
          at: POSES[1],
          legs: null,
          view: views[0] ?? "three",
          label: `${assetNames[0]} · ${c.name} · ${t.toFixed(2)} s`,
          asset: 0,
          clip: { name: c.name, t },
        });
      }
    }
    return { rows: clips.length + riderClips.length, cols: CLIP_FRAMES, list };
  }
  if (sheet === "topsheets") {
    // Every pair in its own topsheet, a view a column.
    const cols = Math.max(1, views.length);
    for (const s of SKI_CATALOG) {
      const l = TOPSHEETS[s.id];
      for (const view of views.length ? views : (["three"] as View[])) {
        list.push({
          spec: s,
          at: POSES[1],
          legs: null,
          view,
          label: `${s.name} · ${l.name} · ${l.pattern} · ${view}`,
        });
      }
    }
    return { rows: SKI_CATALOG.length, cols, list };
  }
  if (sheet === "poses" || sheet === "skier") {
    const moments = sheet === "poses" ? POSES : POSES.filter((p) => RIDER_POSES.includes(p.name));
    for (const at of moments) {
      for (const view of views) {
        list.push({ spec, at, legs: null, view, label: `${spec.name} · ${at.name} · ${view}` });
      }
    }
    return { rows: moments.length, cols: views.length, list };
  }
  // THE LANDING: the body on its legs, stepped at 120 Hz through a skier
  // stopped dead from `landVy` m/s down, a frame every 60 ms.
  const frames: SkierSpring[] = [];
  const legs = createSkierSpring();
  stepSkierSpring(legs, -landVy, true, 1 / 120);
  for (let i = 0; i < 12; i++) {
    frames.push({ ...legs });
    for (let k = 0; k < 7; k++) stepSkierSpring(legs, 0, false, 1 / 120);
  }
  for (const view of views) {
    frames.forEach((f, i) => {
      list.push({
        spec,
        at: { name: "landing" },
        legs: f,
        view,
        label: `${(i * 58).toString().padStart(3)} ms · fold ${(f.bump * 100).toFixed(0)} cm`,
      });
    });
  }
  return { rows: views.length, cols: frames.length, list };
}

/** THE HEAD SHEET: every kit a row, every angle a column. */
function drawHeads(): { rows: number; cols: number; note: string } {
  const rows = SLOT_DRESS.length;
  const cols = HEAD_VIEWS.length;
  const w = cell;
  const h = Math.round(cell * 0.75);
  renderer.setSize(cols * w, rows * h, false);
  canvas.style.width = `${cols * w}px`;
  canvas.style.height = `${rows * h}px`;
  for (const old of host.querySelectorAll(".label")) old.remove();
  for (const m of models.values()) m.root.visible = false;
  ground.visible = grid.visible = wall.visible = false;
  const head = skierPose(HEAD_POSE).head;
  // The profile's centimetre grid, stood in the plane of symmetry behind
  // the head, centred on its middle.
  const cmGrid = new THREE.GridHelper(0.6, 60, 0xd8452e, 0x8795a6);
  cmGrid.rotation.z = Math.PI / 2;
  cmGrid.visible = false;
  scene.add(cmGrid);
  lens.aspect = 4 / 3;
  lens.fov = 14;
  for (let row = 0; row < rows; row++) {
    for (const [k, r] of riders) r.group.visible = k === row;
    riderOf(row).group.visible = true;
    HEAD_VIEWS.forEach((v, col) => {
      const x = col * w;
      const y = (rows - 1 - row) * h;
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
      const b = (v.bearing * Math.PI) / 180;
      if (v.name === "profile") {
        // Flat, 0.5 m across and centred 4 cm ahead of the head's middle,
        // the front to the right as a photograph of a helmet's left side
        // has it.
        ortho.left = -0.25;
        ortho.right = 0.25;
        ortho.top = 0.1875;
        ortho.bottom = -0.1875;
        ortho.position.set(head.x - 2, head.y, head.z + 0.04);
        ortho.lookAt(head.x, head.y, head.z + 0.04);
        ortho.updateProjectionMatrix();
        cmGrid.position.set(head.x + 0.3, head.y, head.z);
        cmGrid.visible = true;
        renderer.render(scene, ortho);
        cmGrid.visible = false;
      } else {
        lens.position.set(head.x + Math.sin(b) * 1.6, head.y + v.rise, head.z + Math.cos(b) * 1.6);
        lens.lookAt(head.x, head.y - 0.03, head.z);
        lens.updateProjectionMatrix();
        renderer.render(scene, lens);
      }
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = `slot ${row} · ${v.name}`;
      label.style.left = `${x + 6}px`;
      label.style.top = `${row * h + 4}px`;
      host.appendChild(label);
    });
  }
  return { rows, cols, note: "head · every kit" };
}

function draw(): { rows: number; cols: number; note: string } {
  if (sheet === "head") return drawHeads();
  const { rows, cols, list } = cells();
  const w = cell;
  const h = Math.round(cell * 0.75);
  renderer.setSize(cols * w, rows * h, false);
  canvas.style.width = `${cols * w}px`;
  canvas.style.height = `${rows * h}px`;
  for (const old of host.querySelectorAll(".label")) old.remove();
  list.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * w;
    const y = (rows - 1 - row) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
    posed(c.spec, c.at, c.legs);
    showAsset(c.asset ?? -1, c.at, c.clip);
    showRider(c, !!c.model || (c.asset !== undefined && c.asset >= 0 && !c.clip));
    renderer.render(scene, camera(c.view, c.spec));
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = c.label;
    label.style.left = `${x + 6}px`;
    label.style.top = `${row * h + 4}px`;
    host.appendChild(label);
  });
  return { rows, cols, note: `${sheet}${sheet === "skis" ? "" : ` · ${spec.name}`}` };
}

const WITH_ASSETS: Sheet[] = ["asset", "rig", "clips", "figure"];
window.__skis = {
  ready: WITH_ASSETS.includes(sheet) ? loadAssets() : Promise.resolve(),
  sheet: draw,
};
