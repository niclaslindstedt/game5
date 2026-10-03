// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD LAB's page (driven by `scripts/crowd-preview.mjs`): the free
// ride's amateurs, as labelled contact sheets of the figures and as the
// crowd out on a real mountain through the game's own renderer.
//
// A SCREENSHOT OF A FREE RIDE CANNOT REVIEW A CROWD. In the game an amateur
// is forty pixels on a slope at whatever moment the frame caught him, so a
// child whose head is too small and a lean that folds the knees backwards
// both come back as "there are people". The figures are judged side by
// side, at every pose and every cut, and the crowd is judged where it
// skis. The sheets (`?sheet=`):
//
//   figures   every body (a row) at the stance and at each of the player's
//             poses its morph targets are (a column) — NEAR cut, from behind
//             and a little to the side, where the chase camera sees one;
//   lods      every body at its NEAR, MID and FAR cut, with the triangles,
//             and the far cut at the size the game draws it at 150 m;
//   moments   the poses BLENDED as the crowd is drawn (`dialsOf` off an
//             amateur's numbers): a carve each way, the bomber's tuck, the
//             beginner's wedge, a hockey stop, a side-slip, a double pole, a
//             kicker, a drunk's sway, down in the snow;
//   dress     a real crowd's first groups (`createGame`'s free ride on
//             `?seed=`) stood in a line in what they were dealt, by group;
//   slope     the crowd on `?seed=`'s mountain `?t=` seconds into a free ride,
//             through the game's renderer, at a named view
//             (`window.__crowd.shoot(view)`): `busy` over the busiest stretch
//             of green, `group` beside a family or a ski school, `chase`
//             behind a carver, `kicker` at a lip someone is going for,
//             `overview` a hundred metres over the busiest run.
//
// Sets `window.__done` when a sheet is on screen; the slope sheet sets it
// once loaded and answers `__crowd.shoot`.

import * as THREE from "three";
import {
  CROWD_BODIES,
  createGame,
  crowdNet,
  NEUTRAL_INPUT,
  step,
  type Amateur,
  type CrowdBody,
  type GameState,
  liftPlans,
  queueSpot,
} from "@engine";

import { outfitOf, type Outfit } from "../game/crowd-dress.ts";
import { CROWD_LOOKS, CROWD_POSES, dialsOf, type CrowdPose } from "../game/crowd-rig.ts";
import {
  CROWD_LODS,
  buildCrowdFigure,
  crowdMaterial,
  crowdTriangles,
  type CrowdLod,
} from "../game/crowd-shapes.ts";
import { createHazeUniforms } from "../game/haze.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";

declare global {
  interface Window {
    __done?: boolean;
    __crowd?: { shoot(view: string): Promise<string> };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "figures";
const seed = Number(params.get("seed") ?? 38);
const t0 = Number(params.get("t") ?? 60);
const only = params.get("bodies");
const bodies: readonly CrowdBody[] = only
  ? CROWD_BODIES.filter((b) => only.split(",").includes(b))
  : CROWD_BODIES;

const CELL_W = 190;
const CELL_H = 240;

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

const haze = createHazeUniforms();
haze.uHaze.value = 0;
const material = crowdMaterial(haze);

/** A stand-in amateur at rest: what `dialsOf` and `outfitOf` read. */
function standIn(body: CrowdBody, id: number, over: Partial<Amateur> = {}): Amateur {
  return {
    id,
    group: id,
    rank: 0,
    body,
    kind: "cruiser",
    knobs: {
      skill: 0.5,
      aggression: 0.5,
      offPiste: 0,
      width: 0.5,
      wobble: 0,
      stopper: 0,
      jumper: 0,
      style: "carve",
      turn: 30,
    },
    mode: "ski",
    run: 0,
    s: 0,
    d: 0,
    speed: 0,
    yaw: 0,
    centre: 0,
    phase: 0,
    wander: 0,
    wanderTo: 0,
    kickerAt: NaN,
    kickerD: 0,
    cap: 0,
    timer: 0,
    think: 0,
    airT: 0,
    airH: 0,
    airAt: 0,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    lean: 0,
    crouch: 0.15,
    plough: 0,
    across: 0,
    fall: 0,
    fallSide: 1,
    pole: 0,
    push: 0,
    lift: -1,
    carrier: -1,
    seat: 0,
    tx: 0,
    tz: 0,
    ts: 0,
    ...over,
  };
}

/** One figure as the game draws it: an instanced mesh of one, its morph
 * weights and its outfit set, mirrored, at `x`. */
function figure(
  body: CrowdBody,
  lod: CrowdLod,
  weights: ArrayLike<number>,
  outfit: Outfit,
  mirror: number,
  x: number,
): THREE.InstancedMesh {
  const geometry = buildCrowdFigure(body, lod).clone();
  geometry.setAttribute(
    "aDress",
    new THREE.InstancedBufferAttribute(new Float32Array(outfit.slice(0, 4)), 4),
  );
  geometry.setAttribute(
    "aDress2",
    new THREE.InstancedBufferAttribute(new Float32Array([outfit[4], outfit[5], outfit[6], 0]), 4),
  );
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.morphTargetInfluences = Array.from(weights);
  mesh.setMorphAt(0, mesh);
  mesh.morphTexture!.needsUpdate = true;
  mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(mirror, 1, 1));
  mesh.position.x = x;
  mesh.frustumCulled = false;
  return mesh;
}

/** The snow, a metre rule along it, and a camera framing `w` × `h` m round
 * `cy` m up, from `azimuth` rad round from behind and `elev` rad above. */
function stage(
  scene: THREE.Scene,
  w: number,
  cy: number,
  azimuth = 0.55,
  elev = 0.32,
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
    band.position.set(m + 0.5, 0.01, 1.1);
    scene.add(band);
  }
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
  key.position.set(-0.55, 0.72, -0.42);
  scene.add(key);
  const h = (w * CELL_H) / CELL_W;
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
  const d = 30;
  // From behind (−z) and round to the side.
  camera.position.set(
    Math.sin(azimuth) * Math.cos(elev) * d,
    cy + Math.sin(elev) * d,
    -Math.cos(azimuth) * Math.cos(elev) * d,
  );
  camera.lookAt(0, cy, 0);
  return camera;
}

/** The morph weights for a few named dials, the rest at the stance. */
const weightsOf = (dials: Partial<Record<CrowdPose, number>>): number[] =>
  CROWD_POSES.map((k) => dials[k] ?? 0);

const sample = (body: CrowdBody, id: number): Outfit =>
  outfitOf(standIn(body, id), undefined, seed);

function figureCells(): Cell[] {
  const names = ["stand", ...CROWD_POSES];
  return bodies.flatMap((body, row) =>
    names.map((pose, k) => ({
      name: k === 0 ? `${body} — ${pose}` : pose,
      foot: k === 0 ? `${CROWD_LOOKS[body].height} m · ${crowdTriangles(body, "near")} tris` : "",
      draw(scene) {
        const w = new Array<number>(CROWD_POSES.length).fill(0);
        if (k > 0) w[k - 1] = 1;
        scene.add(figure(body, "near", w, sample(body, row * 7 + 3), 1, 0));
        return stage(scene, 2.6, 0.85);
      },
    })),
  );
}

function lodCells(): Cell[] {
  return bodies.flatMap((body, row) => [
    ...CROWD_LODS.map((lod) => ({
      name: `${body} — ${lod}`,
      foot: `${crowdTriangles(body, lod)} tris`,
      draw(scene: THREE.Scene) {
        scene.add(
          figure(body, lod, weightsOf({ crouch: 0.3, lean: 0.6 }), sample(body, row * 5 + 1), 1, 0),
        );
        return stage(scene, 2.6, 0.85);
      },
    })),
    {
      name: `${body} — far at 150 m`,
      foot: "the game's pixels",
      draw(scene: THREE.Scene) {
        scene.add(
          figure(
            body,
            "far",
            weightsOf({ crouch: 0.3, lean: 0.6 }),
            sample(body, row * 5 + 1),
            1,
            0,
          ),
        );
        // A 60° lens at 150 m: the cell's height is 173 m of view.
        return stage(scene, (173 * CELL_W) / CELL_H / 12, 0.85);
      },
    },
  ]);
}

/** The moments the crowd is drawn in, as an amateur's numbers. */
const MOMENTS: readonly { name: string; at: Partial<Amateur> }[] = [
  { name: "carve right", at: { crouch: 0.35, lean: 0.5 } },
  { name: "carve left", at: { crouch: 0.35, lean: -0.5 } },
  { name: "bomber's tuck", at: { crouch: 0.95 } },
  { name: "beginner's wedge", at: { crouch: 0.45, plough: 0.9 } },
  { name: "hockey stop", at: { crouch: 0.3, across: 1 } },
  { name: "side-slip", at: { crouch: 0.3, across: 0.85, lean: -0.15 } },
  { name: "double pole", at: { push: 1, pole: Math.PI / 2 } },
  { name: "off a kicker", at: { mode: "air", airAt: 0.5, airT: 1, crouch: 0.55 } },
  { name: "drunk's sway", at: { lean: 0.35, crouch: 0.1, plough: 0.3 } },
  { name: "down", at: { fall: 1, fallSide: -1 } },
];

function momentCells(): Cell[] {
  return bodies.flatMap((body, row) =>
    MOMENTS.map((m, k) => ({
      name: k === 0 ? `${body} — ${m.name}` : m.name,
      foot: "",
      draw(scene: THREE.Scene) {
        const w = new Float32Array(CROWD_POSES.length);
        const mirror = dialsOf(standIn(body, 0, m.at), w);
        scene.add(figure(body, "near", w, sample(body, row * 11 + k), mirror, 0));
        return stage(scene, 2.6, 0.85);
      },
    })),
  );
}

function dressCells(): Cell[] {
  const state = createGame({ seed, mode: "free", quiet: true });
  const crowd = state.crowd!;
  const cells: Cell[] = [];
  for (const g of crowd.groups) {
    if (cells.length >= 24) break;
    const people = g.members.map((m) => crowd.amateurs[m]);
    cells.push({
      name: `${g.kind} of ${people.length}`,
      foot: people.map((a) => `${a.kind}/${a.body}`).join(" · "),
      draw(scene) {
        people.forEach((a, k) => {
          const x = (k - (people.length - 1) / 2) * 0.9;
          scene.add(figure(a.body, "near", weightsOf({ crouch: 0.2 }), outfitOf(a, g, seed), 1, x));
        });
        return stage(scene, Math.max(2.6, people.length * 0.95 + 0.6), 0.85, 0.3, 0.2);
      },
    });
  }
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

// ── THE SLOPE: the crowd on a mountain, through the game's renderer ─────

async function slope(): Promise<void> {
  const width = Number(params.get("w") ?? 1280);
  const height = Number(params.get("h") ?? 720);
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  await loadModels();
  const renderer = createWorldRenderer(canvas, {
    video: withPreset(DEFAULT_VIDEO, "high"),
    preserveDrawingBuffer: true,
  });
  renderer.resize(width, height, 1);
  const state: GameState = createGame({ seed, mode: "free", quiet: true });
  await renderer.load(state);
  const FRAME = 1 / 60;
  // The crowd skis on while the player stands; a frame is drawn now and
  // then so the tracks and the snow keep up.
  while (state.t < t0) {
    for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
    renderer.draw(state, 0, FRAME, false);
  }
  const level = state.level;
  const crowd = state.crowd!;
  const net = crowdNet(level);
  const out = (a: Amateur) => a.mode !== "lift";
  const look = (eye: [number, number, number], at: [number, number, number], fov = 50) => {
    renderer.setOverride({
      eye: { x: eye[0], y: eye[1], z: eye[2] },
      target: { x: at[0], y: at[1], z: at[2] },
      fov,
      roll: 0,
    });
    renderer.draw(state, 0, FRAME, true);
    renderer.setOverride(null);
  };
  /** A point behind and above `a`, looking past him down his way. */
  const behind = (a: Amateur, back: number, up: number, fov = 50): void => {
    const ex = a.x - Math.sin(a.heading) * back;
    const ez = a.z - Math.cos(a.heading) * back;
    look(
      [ex, Math.max(level.groundAt(ex, ez), a.y) + up, ez],
      [a.x + Math.sin(a.heading) * 10, a.y, a.z + Math.cos(a.heading) * 10],
      fov,
    );
  };
  /** The amateur with the most others within `r` m. */
  const busiest = (r: number, pick: (a: Amateur) => boolean = out): Amateur => {
    let best = crowd.amateurs.find(out)!;
    let most = -1;
    for (const a of crowd.amateurs) {
      if (!pick(a)) continue;
      let n = 0;
      for (const o of crowd.amateurs) if (out(o) && Math.hypot(o.x - a.x, o.z - a.z) < r) n++;
      if (n > most) {
        most = n;
        best = a;
      }
    }
    return best;
  };
  const shots: Record<string, () => string> = {
    busy() {
      const a = busiest(60, (o) => out(o) && net.runs[o.run].grade === "green");
      behind(a, 45, 22, 55);
      return `the busiest green, round amateur ${a.id} (${a.kind})`;
    },
    group() {
      const g =
        crowd.groups.find((x) => x.kind === "school" && out(crowd.amateurs[x.members[0]])) ??
        crowd.groups.find((x) => x.kind === "family" && out(crowd.amateurs[x.members[0]]))!;
      const a = crowd.amateurs[g.members[Math.floor(g.members.length / 2)]];
      const ex = a.x + Math.cos(a.heading) * 12;
      const ez = a.z - Math.sin(a.heading) * 12;
      look([ex, level.groundAt(ex, ez) + 3, ez], [a.x, a.y + 0.6, a.z], 45);
      return `a ${g.kind} of ${g.members.length} from the side`;
    },
    chase() {
      const a = busiest(80, (o) => out(o) && o.kind === "carver") ?? crowd.amateurs[0];
      behind(a, 7, 2.2, 60);
      return `behind a carver at ${(a.speed * 3.6).toFixed(0)} km/h`;
    },
    kicker() {
      const a =
        crowd.amateurs.find((o) => o.mode === "air") ??
        crowd.amateurs.find((o) => !Number.isNaN(o.kickerAt)) ??
        busiest(40);
      behind(a, 14, 3, 50);
      return `amateur ${a.id} (${a.kind}) ${a.mode === "air" ? "in the air" : "lining up"}`;
    },
    // THE LIFTS (`crowd-lift.ts`): the longest queue at its lift's foot,
    // from beside its corral, the load line and the chairs coming round.
    queue() {
      const plans = liftPlans(level);
      let lift = 0;
      crowd.queues.forEach((q, i) => {
        if (q.length > (crowd.queues[lift]?.length ?? 0)) lift = i;
      });
      const p = plans[lift];
      const load = queueSpot(p, 0);
      const back = queueSpot(p, 6);
      const ex = back.x + p.dz * 9 - p.dx * 4;
      const ez = back.z - p.dx * 9 - p.dz * 4;
      look(
        [ex, level.groundAt(ex, ez) + 3.5, ez],
        [load.x, level.groundAt(load.x, load.z) + 1, load.z],
        55,
      );
      return `${p.lift.id}'s queue of ${crowd.queues[lift]?.length ?? 0}`;
    },
    chairs() {
      // A rider on a chair, from beside his chair a little below it.
      const plans = liftPlans(level);
      const a = crowd.amateurs.find(
        (o) => o.mode === "ride" && plans[o.lift]?.lift.kind === "chair" && o.timer > 2,
      );
      if (!a) return "nobody on a chair";
      const p = plans[a.lift];
      const ex = a.x + p.dz * 9 - p.dx * 6;
      const ez = a.z - p.dx * 9 - p.dz * 6;
      look([ex, a.y - 1, ez], [a.x, a.y, a.z], 50);
      const on = crowd.amateurs.filter((o) => o.mode === "ride" && o.lift === a.lift).length;
      return `${p.lift.id}'s chair ${a.carrier} with amateur ${a.id} on it, ${on} riding`;
    },
    overview() {
      const a = busiest(120);
      behind(a, 150, 95, 50);
      return `a hundred metres over the busiest run, round amateur ${a.id} (${net.runs[a.run].grade})`;
    },
  };
  window.__crowd = {
    async shoot(view) {
      const shoot = shots[view];
      if (!shoot) throw new Error(`no view ${view} (${Object.keys(shots).join(", ")})`);
      // A second between views, so each is its own moment of the crowd.
      for (let i = 0; i < 60; i++) {
        step(state, NEUTRAL_INPUT);
        if (i % 2) renderer.draw(state, 0, FRAME, false);
      }
      const modes: Record<string, number> = {};
      for (const a of crowd.amateurs) modes[a.mode] = (modes[a.mode] ?? 0) + 1;
      const what = shoot();
      return `${what} — t ${state.t.toFixed(0)} s, ${Object.entries(modes)
        .map(([k, n]) => `${n} ${k}`)
        .join(", ")}`;
    },
  };
  window.__done = true;
}

if (sheet === "slope") {
  void slope();
} else {
  const cells =
    sheet === "lods"
      ? lodCells()
      : sheet === "moments"
        ? momentCells()
        : sheet === "dress"
          ? dressCells()
          : figureCells();
  const cols =
    sheet === "lods"
      ? 4
      : sheet === "moments"
        ? MOMENTS.length
        : sheet === "dress"
          ? 6
          : CROWD_POSES.length + 1;
  drawSheet(cells, cols);
}
