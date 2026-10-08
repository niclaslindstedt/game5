// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS LAB's page (driven by `scripts/civilians-preview.mjs`): the
// people on foot about a free ride's ski area (`civilian-plan.ts`, drawn by
// `civilians-view.ts`), as labelled contact sheets of the figures and as
// the ski area through the game's own renderer.
//
// A person on foot is forty pixels by a lift's foot in the game, so a cup
// that misses the mouth, a shovel through the leg or a sitter hovering over
// his bench all come back as "there are people". The sheets (`?sheet=`):
//
//   figures   every body (a row) at the stance and at each pose its morph
//             targets are (a column), NEAR cut, each twice: from the front
//             at three quarters, and from the side;
//   moves     every activity strobed over its cycle as the view blends it
//             (`civilianDials` off a plan's pose), a row each;
//   props     what is held and what stands on the snow, close: the skis on
//             a shoulder, a mug, a beer, the shovel and the broom worked, a
//             snowball, the three heads, the staff in their colours, a deck
//             chair with its lounger, a snowman with its builders, and the
//             three cuts with their triangles;
//   resort    `?seed=`'s free ride through the game's renderer at `?hour=`,
//             at a named view (`window.__civilians.shoot(view)`): `lift`
//             (a lift's foot and its crew), `terrace` (an afterski lodge's
//             terrace), `base` (the base area round a lift's foot), `walker`
//             (a walker close up), `cocoa` (a ring with mugs), `overview`.
//
// Sets `window.__done` when a sheet is on screen; the resort sheet sets it
// once loaded and answers `__civilians.shoot`.

import * as THREE from "three";
import { CROWD_BODIES, NEUTRAL_INPUT, createGame, step, type CrowdBody } from "@engine";

import { PART, civilianKit, kitParts, type Head } from "../game/civilian-dress.ts";
import { CIVILIAN_POSES, civilianDials, type CivilianTarget } from "../game/civilian-moves.ts";
import {
  civilianAt,
  civilianHour,
  civilianPlanFor,
  freshCivilianPose,
  type Civilian,
  type CivilianPlan,
  type CivilianPose,
} from "../game/civilian-plan.ts";
import type { Activity, Carry, Dress } from "../game/civilian-roles.ts";
import { spotsOf } from "../game/civilian-spots.ts";
import {
  buildCivilianFigure,
  buildCivilianProps,
  civilianMaterial,
  civilianTriangles,
} from "../game/civilian-shapes.ts";
import { CROWD_LODS, type CrowdLod } from "../game/crowd-shapes.ts";
import { createHazeUniforms } from "../game/haze.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";

declare global {
  interface Window {
    __done?: boolean;
    __civilians?: { shoot(view: string): Promise<string> };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "figures";
const seed = Number(params.get("seed") ?? 38);
const only = params.get("bodies");
const bodies: readonly CrowdBody[] = only
  ? CROWD_BODIES.filter((b) => only.split(",").includes(b))
  : CROWD_BODIES;

const CELL_W = 200;
const CELL_H = 240;
const TARGETS = CIVILIAN_POSES.length;

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

const haze = createHazeUniforms();
haze.uHaze.value = 0;
const material = civilianMaterial(haze);

/** A stand-in civilian of `body` dressed as `dress`, for the kit. */
function standIn(body: CrowdBody, dress: Dress, tint: number, role: Civilian["role"]): Civilian {
  return {
    id: "lab",
    role,
    body,
    dress,
    tint,
    keen: 0,
    spot: "lab",
    home: { x: 0, y: 0, z: 0, heading: 0, seat: null },
    deck: false,
    leg: null,
    routine: [],
    total: 1,
    offset: 0,
  };
}

/** The kit's instance numbers: colours, and the parts shown. */
type Look = { colours: number[]; parts: number[] };

function lookOf(c: Civilian, head: Head | null, carry: Carry, ball = false): Look {
  const kit = civilianKit(c, seed);
  if (head) kit.head = head;
  const pose: CivilianPose = { ...freshCivilianPose(), carry };
  const parts = kitParts(kit, pose, [0, 0, 0, 0]);
  if (ball) parts[2] = PART.snowball;
  return { colours: kit.colours, parts };
}

/** One figure as the game draws it: an instanced mesh of one. */
function figure(
  body: CrowdBody,
  lod: CrowdLod,
  weights: ArrayLike<number>,
  look: Look,
  x: number,
  heading: number,
  z = 0,
  y = 0,
): THREE.InstancedMesh {
  const geometry = buildCivilianFigure(body, lod).clone();
  const c = look.colours;
  geometry.setAttribute(
    "aDress",
    new THREE.InstancedBufferAttribute(new Float32Array(c.slice(0, 4)), 4),
  );
  geometry.setAttribute(
    "aDress2",
    new THREE.InstancedBufferAttribute(new Float32Array(c.slice(4, 8)), 4),
  );
  geometry.setAttribute(
    "aKit",
    new THREE.InstancedBufferAttribute(new Float32Array(look.parts), 4),
  );
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.morphTargetInfluences = Array.from(weights);
  mesh.setMorphAt(0, mesh);
  mesh.morphTexture!.needsUpdate = true;
  mesh.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/** The snow, a metre rule along it, the light and a camera framing `w` m
 * round `cy` m up, from the FRONT at `azimuth` rad round and `elev` up. */
function stage(
  scene: THREE.Scene,
  w: number,
  cy: number,
  azimuth = 0.5,
  elev = 0.22,
): THREE.Camera {
  const snow = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: 0xeef3f8 }),
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);
  for (let m = -Math.ceil(w); m < Math.ceil(w); m++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.02, 0.04),
      new THREE.MeshBasicMaterial({ color: m % 2 ? 0x11181d : 0x7d8b96 }),
    );
    band.position.set(m + 0.5, 0.01, -1.4);
    scene.add(band);
  }
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
  key.position.set(0.55, 0.72, 0.62);
  scene.add(key);
  const h = (w * CELL_H) / CELL_W;
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
  const d = 30;
  camera.position.set(
    Math.sin(azimuth) * Math.cos(elev) * d,
    cy + Math.sin(elev) * d,
    Math.cos(azimuth) * Math.cos(elev) * d,
  );
  camera.lookAt(0, cy, 0);
  return camera;
}

const weightsOf = (dials: Partial<Record<CivilianTarget, number>>): number[] =>
  CIVILIAN_POSES.map((k) => dials[k] ?? 0);

/** What a target holds, for the figures sheet. */
function carryFor(target: CivilianTarget | "stand"): { carry: Carry; ball?: boolean } {
  if (target === "carry" || target.startsWith("walk")) return { carry: "skis" };
  if (target.includes("rink") || target.includes("Sip")) return { carry: "mug" };
  if (target.startsWith("cheer") || target.startsWith("dance")) return { carry: "beer" };
  if (target.startsWith("shovel")) return { carry: "shovel" };
  if (target.startsWith("sweep")) return { carry: "broom" };
  if (target.startsWith("throw")) return { carry: "none", ball: true };
  return { carry: "none" };
}

const HEADS: readonly Head[] = ["helmet", "beanie", "hair"];
const SEATS: Partial<Record<CivilianTarget, number>> = {
  bench: 0.47,
  benchDrink: 0.47,
  benchTalk: 0.47,
};

/** A bench under a sitter: a plank on two legs, 0.47 m high. */
function bench(scene: THREE.Scene, x: number, z: number, heading: number): void {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.3), wood);
  top.position.set(0, 0.445, -0.04);
  g.add(top);
  for (const sx of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.26), wood);
    leg.position.set(sx, 0.21, -0.04);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  scene.add(g);
}

function figureCells(): Cell[] {
  const names = ["stand", ...CIVILIAN_POSES] as const;
  return bodies.flatMap((body, row) =>
    names.map((target, k) => ({
      name: k === 0 ? `${body} — ${target}` : target,
      foot:
        k === 0 ? `${CROWD_LOOKS_HEIGHT(body)} m · ${civilianTriangles(body, "near")} tris` : "",
      draw(scene: THREE.Scene) {
        const w = new Array<number>(TARGETS).fill(0);
        if (k > 0) w[k - 1] = 1;
        const { carry, ball } = carryFor(target);
        const c = standIn(body, "guest", (row * 13 + k * 7) / 97 + 0.01, "walker");
        const look = lookOf(c, HEADS[(row + k) % 3], carry, ball);
        // From the front at three quarters, and side on beside him.
        scene.add(figure(body, "near", w, look, -0.55, 0));
        scene.add(figure(body, "near", w, look, 0.6, -Math.PI / 2 - 0.5));
        if (target in SEATS) {
          bench(scene, -0.55, 0, 0);
          bench(scene, 0.6, 0, -Math.PI / 2 - 0.5);
        }
        if (target === "lounge" || target === "loungeSip")
          deckchairs(scene, [
            [-0.55, 0, 0],
            [0.6, 0, -Math.PI / 2 - 0.5],
          ]);
        return stage(scene, 2.6, 0.9);
      },
    })),
  );
}

function CROWD_LOOKS_HEIGHT(body: CrowdBody): string {
  return {
    man: "1.8",
    woman: "1.68",
    teen: "1.66",
    child: "1.18",
    oldMan: "1.75",
    oldWoman: "1.62",
    freerider: "1.82",
    retro: "1.72",
  }[body];
}

/** Deck chairs at `[x, z, heading]`, built as the game builds them. */
function deckchairs(scene: THREE.Scene, at: [number, number, number][]): void {
  const plan = {
    props: at.map(([x, z, heading]) => ({ kind: "deckchair" as const, x, y: 0, z, heading })),
  } as unknown as CivilianPlan;
  scene.add(
    new THREE.Mesh(
      buildCivilianProps(plan, [0, 0, 0]),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    ),
  );
}

// ── THE MOVES: every activity strobed as the view blends it ─────────────

type Move = {
  name: string;
  act: Activity;
  span: number;
  carry: Carry;
  seat?: number | null;
  body: CrowdBody;
  dress?: Dress;
  id?: number;
  /** A walker's pace, m/s: his `walked` runs with the clock. */
  walk?: number;
  head?: Head;
};

const MOVES: readonly Move[] = [
  { name: "stand (idle)", act: "stand", span: 7.3, carry: "none", body: "man", head: "beanie" },
  {
    name: "walk, skis on shoulder",
    act: "walk",
    span: 1.1,
    carry: "skis",
    body: "woman",
    walk: 1,
    head: "helmet",
  },
  {
    name: "walk, empty-handed",
    act: "walk",
    span: 1.1,
    carry: "none",
    body: "oldMan",
    walk: 0.85,
    head: "hair",
  },
  { name: "talk", act: "talk", span: 4, carry: "none", body: "teen", head: "beanie" },
  {
    name: "wave (lift crew)",
    act: "wave",
    span: 2,
    carry: "none",
    body: "man",
    dress: "lift",
    head: "beanie",
  },
  { name: "drink cocoa", act: "drink", span: 4, carry: "mug", body: "woman", head: "hair" },
  {
    name: "drink, on a bench",
    act: "drink",
    span: 4,
    carry: "beer",
    body: "man",
    seat: 0.47,
    head: "hair",
  },
  {
    name: "sip in a deck chair",
    act: "drink",
    span: 4,
    carry: "mug",
    body: "oldWoman",
    seat: 0.32,
    head: "beanie",
  },
  {
    name: "rest in the snow, talk",
    act: "talk",
    span: 6,
    carry: "none",
    body: "freerider",
    seat: 0,
    head: "helmet",
  },
  { name: "cheer with a beer", act: "cheer", span: 3, carry: "beer", body: "retro", head: "hair" },
  { name: "dance (A)", act: "dance", span: 1, carry: "beer", body: "man", id: 0, head: "hair" },
  { name: "dance (B)", act: "dance", span: 1, carry: "beer", body: "woman", id: 1, head: "beanie" },
  {
    name: "shovel (worker)",
    act: "shovel",
    span: 2.6,
    carry: "shovel",
    body: "man",
    dress: "worker",
    head: "beanie",
  },
  {
    name: "sweep (lift crew)",
    act: "sweep",
    span: 1.3,
    carry: "broom",
    body: "woman",
    dress: "lift",
    head: "beanie",
  },
  {
    name: "throw a snowball",
    act: "throw",
    span: 2.4,
    carry: "none",
    body: "child",
    head: "beanie",
  },
  { name: "build a snowman", act: "build", span: 3, carry: "none", body: "child", head: "helmet" },
];
const FRAMES = 8;

function moveCells(): Cell[] {
  return MOVES.flatMap((mv, row) =>
    Array.from({ length: FRAMES }, (_, f): Cell => {
      const u = f / FRAMES;
      return {
        name: f === 0 ? mv.name : "",
        foot: `${(u * mv.span).toFixed(2)} s`,
        draw(scene) {
          // A swung move (a sip, a throw) over its whole span; a held one
          // (a word, a wave) strobed in the middle of a longer hold.
          const whole = mv.act === "throw" || mv.act === "drink";
          const span = whole ? mv.span : mv.span / 0.6;
          const clock = whole ? u * mv.span : span * 0.2 + u * mv.span;
          const pose: CivilianPose = {
            ...freshCivilianPose(),
            activity: mv.act,
            clock,
            span,
            carry: mv.carry,
            seat: mv.seat ?? null,
            walked: (mv.walk ?? 0) * clock,
            shown: true,
          };
          const w = new Float32Array(TARGETS);
          civilianDials(pose, clock, mv.id ?? row, w);
          const c = standIn(mv.body, mv.dress ?? "guest", (row * 31 + 5) / 101, "walker");
          const kit = civilianKit(c, seed);
          kit.head = mv.head ?? kit.head;
          const parts = kitParts(kit, pose, [0, 0, 0, 0]);
          // A move that is read across the body (a dance's sway, a wave)
          // is turned toward the lens; the rest are seen from the side.
          const facing = ["dance", "wave", "talk", "cheer"].includes(mv.act)
            ? -0.75
            : -Math.PI / 2 + 0.35;
          scene.add(figure(mv.body, "near", w, { colours: kit.colours, parts }, 0, facing, 0, 0));
          if (mv.seat === 0.47) bench(scene, 0, 0, facing);
          if (mv.seat === 0.32) deckchairs(scene, [[0, 0, facing]]);
          if (mv.act === "build")
            snowmen(scene, [[0.65 * Math.sin(facing), 0, 0.65 * Math.cos(facing)]]);
          return stage(scene, 2.2, 0.85, 0.15, 0.18);
        },
      };
    }),
  );
}

function snowmen(scene: THREE.Scene, at: [number, number, number][]): void {
  const plan = {
    props: at.map(([x, y, z]) => ({ kind: "snowman" as const, x, y, z, heading: 0.5 })),
  } as unknown as CivilianPlan;
  scene.add(
    new THREE.Mesh(
      buildCivilianProps(plan, [0, 0, 0]),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    ),
  );
}

// ── THE PROPS: held, stood on the snow, the heads, the staff, the cuts ──

function propCells(): Cell[] {
  const one = (
    name: string,
    body: CrowdBody,
    target: CivilianTarget | "stand",
    carry: Carry,
    opts: {
      dress?: Dress;
      head?: Head;
      ball?: boolean;
      az?: number;
      w?: number;
      cy?: number;
      dials?: Partial<Record<CivilianTarget, number>>;
    } = {},
  ): Cell => ({
    name,
    foot: "",
    draw(scene) {
      const w = opts.dials
        ? weightsOf(opts.dials)
        : weightsOf(target === "stand" ? {} : { [target]: 1 });
      const c = standIn(
        body,
        opts.dress ?? "guest",
        0.37,
        opts.dress === "patrol" ? "patrol" : "walker",
      );
      scene.add(figure(body, "near", w, lookOf(c, opts.head ?? null, carry, opts.ball), 0, 0));
      return stage(scene, opts.w ?? 1.6, opts.cy ?? 1.0, opts.az ?? 0.6, 0.2);
    },
  });
  const cells: Cell[] = [
    one("skis on the shoulder", "man", "carry", "skis", { head: "helmet", az: 1.2, w: 2.4 }),
    one("skis, walking", "woman", "walk1", "skis", {
      head: "beanie",
      az: -0.9,
      w: 2.4,
      dials: { walk1: 1, carry: 1 },
    }),
    one("a mug of cocoa", "woman", "drink", "mug", { head: "hair", az: 0.9, w: 1.0, cy: 1.35 }),
    one("a beer, cheering", "man", "cheer0", "beer", { head: "hair", az: 0.4, w: 1.4, cy: 1.4 }),
    one("the shovel, scoop", "man", "shovel0", "shovel", {
      dress: "worker",
      head: "beanie",
      az: 1.3,
      w: 2.4,
    }),
    one("the shovel, throw", "man", "shovel1", "shovel", {
      dress: "worker",
      head: "beanie",
      az: 0.3,
      w: 2.4,
    }),
    one("the broom", "woman", "sweep0", "broom", {
      dress: "lift",
      head: "beanie",
      az: 1.0,
      w: 2.4,
    }),
    one("a snowball", "child", "throw0", "none", {
      ball: true,
      head: "beanie",
      az: 1.4,
      w: 1.6,
      cy: 0.8,
    }),
    one("helmet", "man", "stand", "none", { head: "helmet", az: 0.7, w: 0.8, cy: 1.55 }),
    one("beanie", "oldWoman", "stand", "none", { head: "beanie", az: 0.7, w: 0.8, cy: 1.42 }),
    one("own hair", "woman", "stand", "none", { head: "hair", az: 2.3, w: 0.8, cy: 1.45 }),
    one("patrol, the cross", "man", "idle", "none", { dress: "patrol", az: Math.PI - 0.5, w: 1.6 }),
    one("lift crew, the bib", "man", "stand", "none", { dress: "lift", w: 1.6 }),
    one("ski school", "woman", "talk1", "none", { dress: "school", head: "helmet", w: 1.6 }),
    one("worker", "man", "stand", "shovel", { dress: "worker", w: 1.6 }),
    one("guest desk", "woman", "wave0", "none", { dress: "host", head: "hair", w: 1.8 }),
  ];
  cells.push({
    name: "a deck chair and its lounger",
    foot: "",
    draw(scene) {
      deckchairs(scene, [[0, 0, 0]]);
      const c = standIn("man", "guest", 0.61, "lounger");
      scene.add(figure("man", "near", weightsOf({ lounge: 1 }), lookOf(c, "hair", "none"), 0, 0));
      return stage(scene, 2.4, 0.6, 1.2, 0.3);
    },
  });
  cells.push({
    name: "a snowman and its builders",
    foot: "",
    draw(scene) {
      snowmen(scene, [[0, 0, 0]]);
      [0, 2.3, 4.2].forEach((a, k) => {
        const c = standIn("child", "guest", 0.13 + k * 0.29, "builder");
        scene.add(
          figure(
            "child",
            "near",
            weightsOf({ [k === 2 ? "build1" : "build0"]: 1 }),
            lookOf(c, HEADS[k], "none"),
            Math.sin(a) * 0.75,
            a + Math.PI,
            Math.cos(a) * 0.75,
          ),
        );
      });
      return stage(scene, 2.6, 0.6, 0.5, 0.35);
    },
  });
  for (const lod of CROWD_LODS) {
    cells.push({
      name: `man — ${lod}`,
      foot: `${civilianTriangles("man", lod)} tris (all parts)`,
      draw(scene) {
        const c = standIn("man", "guest", 0.21, "walker");
        scene.add(
          figure(
            "man",
            lod,
            weightsOf({ walk1: 1, carry: 1 }),
            lookOf(c, "helmet", "skis"),
            0,
            0.6,
          ),
        );
        return stage(scene, 2.4, 1.0);
      },
    });
  }
  cells.push({
    name: "far at 120 m",
    foot: "the game's pixels",
    draw(scene) {
      const c = standIn("man", "guest", 0.21, "walker");
      scene.add(
        figure(
          "man",
          "far",
          weightsOf({ walk1: 1, carry: 1 }),
          lookOf(c, "helmet", "skis"),
          0,
          0.6,
        ),
      );
      // A 50° lens at 120 m: the cell's height is 112 m of view.
      return stage(scene, (112 * CELL_W) / CELL_H / 12, 0.9);
    },
  });
  return cells;
}

function drawSheet(cells: Cell[], cols: number): void {
  const rows = Math.ceil(cells.length / cols);
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  canvas.width = CELL_W * Math.min(cols, cells.length);
  canvas.height = CELL_H * rows;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setSize(CELL_W, CELL_H, false);
  renderer.setClearColor(new THREE.Color(0x9fb9cf));
  const labels = document.getElementById("labels") as HTMLDivElement;
  const label = (text: string, col: number, row: number, dy: number, cls: string): void => {
    if (!text) return;
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const scene = new THREE.Scene();
    renderer.render(scene, c.draw(scene));
    ctx.drawImage(cell, col * CELL_W, row * CELL_H);
    label(c.name, col, row, 4, "label");
    label(c.foot, col, row, CELL_H - 34, "label foot");
  });
  renderer.dispose();
  window.__done = true;
}

// ── THE RESORT: a free ride's ski area through the game's renderer ──────

async function resort(): Promise<void> {
  const width = Number(params.get("w") ?? 1280);
  const height = Number(params.get("h") ?? 720);
  const hourParam = params.get("hour");
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  await loadModels();
  const renderer = createWorldRenderer(canvas, {
    video: withPreset(DEFAULT_VIDEO, "high"),
    preserveDrawingBuffer: true,
  });
  renderer.resize(width, height, 1);
  const state = createGame({
    seed,
    mode: "free",
    quiet: true,
    ...(hourParam !== null ? { sky: { hour: Number(hourParam) } } : {}),
  });
  await renderer.load(state);
  const FRAME = 1 / 60;
  const t0 = Number(params.get("t") ?? 20);
  while (state.t < t0) {
    for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
    renderer.draw(state, 0, FRAME, false);
  }
  const level = state.level;
  const plan = civilianPlanFor(level);
  const hour = civilianHour(level);
  const spots = spotsOf(level);
  const look = (eye: [number, number, number], at: [number, number, number], fov = 50): void => {
    renderer.setOverride({
      eye: { x: eye[0], y: eye[1], z: eye[2] },
      target: { x: at[0], y: at[1], z: at[2] },
      fov,
      roll: 0,
    });
    renderer.draw(state, 0, FRAME, true);
    renderer.setOverride(null);
  };
  /** Everyone out now, where they are. */
  const out = (): { i: number; p: CivilianPose }[] => {
    const list: { i: number; p: CivilianPose }[] = [];
    plan.people.forEach((_, i) => {
      const p = civilianAt(plan, i, state.t, hour, freshCivilianPose());
      if (p.shown) list.push({ i, p });
    });
    return list;
  };
  /** A lens `back` m off `at` along `bearing` and `up` m over the snow there. */
  const from = (
    at: { x: number; y: number; z: number },
    bearing: number,
    back: number,
    up: number,
    fov = 45,
    lookUp = 0.9,
  ): void => {
    const ex = at.x + Math.sin(bearing) * back;
    const ez = at.z + Math.cos(bearing) * back;
    look([ex, Math.max(level.groundAt(ex, ez), at.y) + up, ez], [at.x, at.y + lookUp, at.z], fov);
  };
  /** The place of `kind` with the most people out round it. */
  const busiestSpot = (
    kind: string,
  ): { x: number; y: number; z: number; heading: number } | null => {
    const people = out();
    let best: { x: number; y: number; z: number; heading: number } | null = null;
    let most = -1;
    for (const s of spots) {
      if (s.kind !== kind) continue;
      const n = people.filter((q) => Math.hypot(q.p.x - s.x, q.p.z - s.z) < 25).length;
      if (n > most) {
        most = n;
        best = { x: s.x, y: level.groundAt(s.x, s.z), z: s.z, heading: s.heading };
      }
    }
    return best;
  };
  const shots: Record<string, () => string> = {
    lift() {
      const crew = out().find((q) => plan.people[q.i].role === "liftAttendant");
      if (!crew) return "no lift crew out";
      from(crew.p, crew.p.heading + 0.9, 7, 2.2, 45);
      return `${plan.people[crew.i].spot}'s crew, ${crew.p.activity}`;
    },
    terrace() {
      const s = busiestSpot("terrace");
      if (!s) return "no terrace";
      // From out front of the lodge, a little up.
      from(s, s.heading + 0.35, 16, 5, 50, 1.2);
      const n = out().filter(
        (q) =>
          plan.people[q.i].spot.includes("terrace") || Math.hypot(q.p.x - s.x, q.p.z - s.z) < 20,
      ).length;
      return `the terrace, ${n} out round it`;
    },
    yard() {
      const s = busiestSpot("yard");
      if (!s) return "no yard";
      from(s, s.heading + 0.5, 14, 4, 50, 0.8);
      return "a lodge's yard";
    },
    base() {
      const s = busiestSpot("base");
      if (!s) return "no base";
      from(s, s.heading + 2.4, 24, 8, 50, 0.6);
      return "the base area";
    },
    walker() {
      const w =
        out().find((q) => q.p.activity === "walk" && q.p.carry === "skis") ??
        out().find((q) => q.p.activity === "walk");
      if (!w) return "nobody walking";
      from(w.p, w.p.heading + 1.1, 5, 1.6, 40, 1.0);
      return `${plan.people[w.i].role} walking, ${w.p.carry}`;
    },
    cocoa() {
      const c =
        out().find((q) => plan.people[q.i].role === "cocoa") ??
        out().find((q) => plan.people[q.i].role === "rester");
      if (!c) return "no cocoa ring";
      from(c.p, c.p.heading + 2.6, 6, 2, 45, 0.9);
      return `${plan.people[c.i].role}, ${c.p.activity}`;
    },
    kids() {
      const c =
        out().find((q) => plan.people[q.i].role === "builder") ??
        out().find((q) => plan.people[q.i].role === "snowballer");
      if (!c) return "no children at play";
      from(c.p, c.p.heading + 0.4, 7, 2.4, 45, 0.6);
      return `${plan.people[c.i].role}, ${c.p.activity}`;
    },
    overview() {
      const s = busiestSpot("liftFoot") ?? busiestSpot("base")!;
      from(s, s.heading + 2.8, 70, 35, 50, 0);
      return "over the base area";
    },
  };
  window.__civilians = {
    async shoot(view) {
      const shoot = shots[view];
      if (!shoot) throw new Error(`no view ${view} (${Object.keys(shots).join(", ")})`);
      for (let i = 0; i < 30; i++) {
        step(state, NEUTRAL_INPUT);
        if (i % 2) renderer.draw(state, 0, FRAME, false);
      }
      const what = shoot();
      const n = out().length;
      return `${what} — t ${state.t.toFixed(0)} s, hour ${hour.toFixed(1)}, ${n} of ${plan.people.length} out`;
    },
  };
  window.__done = true;
}

if (sheet === "resort") {
  void resort();
} else {
  const cells = sheet === "moves" ? moveCells() : sheet === "props" ? propCells() : figureCells();
  const cols = sheet === "moves" ? FRAMES : sheet === "props" ? 7 : CIVILIAN_POSES.length + 1;
  drawSheet(cells, cols);
}
