// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIENCE LAB's page (driven by `scripts/audience-preview.mjs`): the
// crowd a race is watched by (`spectator-plan.ts`, drawn and moved by
// `spectators.ts` / `spectator-shapes.ts`), as labelled contact sheets of
// the figure and its moves, and as the crowd on a real race through the
// game's own renderer.
//
// A SCREENSHOT OF A RACE CANNOT REVIEW AN AUDIENCE. The fans are a band of
// colour past a fence at ninety kilometres an hour, and whether a flag is
// held upside down or a clap misses the hands is a thing nobody could say
// from it. So the moves are judged one fan at a time, frame by frame, and
// the crowd where it stands. The sheets (`?sheet=`):
//
//   moves   every STYLE (a row: clap, wave, bell, flag, jump, sign, horn,
//           film) through its animation (a column): at rest and a few
//           seconds later, a racer coming, frames a tenth of a second
//           apart with him level, and turned to follow him past;
//   looks   the first fans `?seed=`'s plan deals, stood in a line in what
//           they were dealt — the crowd's variety, at the near cut;
//   cuts    a few of them at the NEAR, MID and FAR cuts, the triangles, and the
//           far cut at the size the game draws a fan at 120 m;
//   race    the crowd on `?seed=`'s race through the game's renderer, the
//           bot skiing, at named views (`window.__aud.shoot(view)`):
//           `start`, `turn`, `pitch`, `jump`, `line` (each bank from across
//           the piste as the racer reaches it), `slope` (the finish slope
//           from the piste), `pass-0` … `pass-5` (one bank of it frame by
//           frame as the racer goes by), `finish` (down the last stretch to
//           the arch), `stand` (a grandstand from the line), `arena` (the
//           finish circle from behind the video wall), `overview` and
//           `chase` (the game's own camera). On a SKI CROSS (`?mode=skiCross`,
//           `?heat=1` a heat of four out of the gate together) the start
//           gate as well: `doors` (from down the start ramp under the
//           starter's word), `doors-back` (behind the racers in it),
//           `doors-go` (from beside it as the doors drop) and `doors-out`
//           (a moment later, the racers out of it), `berm` (a turning
//           gate's flag on the inside of the first berm, the crowd on its
//           outside), `corridor` (the first corridor gate's two flags) and
//           `fence` (along the course's fence) and `finish-line` (the red
//           line under the arch).
//
// Sets `window.__done` when a sheet is on screen; the race sheet sets it
// once loaded and answers `__aud.order(views)` (the views in the order the
// run reaches them) and `__aud.shoot(view)`.

import * as THREE from "three";
import {
  botInput,
  createGame,
  isGameMode,
  nearestTrackPoint,
  SKI_CROSS,
  skisById,
  step,
  trackPointAt,
  type GameState,
  type WeatherKind,
} from "@engine";

import { createHazeUniforms } from "../game/haze.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";
import { FAN_HATS, FAN_STYLES, planSpectators, type Fan } from "../game/spectator-plan.ts";
import {
  buildFanFigure,
  FAN_CUT_NAMES,
  fanMaterial,
  fanTriangles,
  fanUniforms,
  type FanCut,
} from "../game/spectator-shapes.ts";
import { fanAttributes } from "../game/spectators.ts";

declare global {
  interface Window {
    __done?: boolean;
    __aud?: { order(views: string[]): string[]; shoot(view: string): Promise<string> };
  }
}

const params = new URLSearchParams(location.search);
const sheet = params.get("sheet") ?? "moves";
const seed = Number(params.get("seed") ?? 38);
const modeParam = params.get("mode") ?? "slalom";
const mode = isGameMode(modeParam) ? modeParam : "slalom";
/** A ski cross's heat of four out of the gate together, rather than its
 * qualification alone. */
const heat = params.get("heat") === "1";

const CELL_W = 170;
const CELL_H = 230;

const haze = createHazeUniforms();
haze.uHaze.value = 0;
const uniforms = fanUniforms();
const material = fanMaterial(haze, uniforms);

/** A stand-in fan at the origin facing +z (toward the lens). */
function standIn(over: Partial<Fan> = {}): Fan {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    height: 1.75,
    girth: 1,
    style: 0,
    hat: 2,
    coat: false,
    pack: false,
    scarf: true,
    dress: [0, 9, 1, 2],
    dress2: [17, 0, 14, 1],
    phase: 0.1,
    lively: 0.9,
    reach: 50,
    kind: "finish",
    arena: false,
    along: 0,
    bank: 0,
    ...over,
  };
}

/** One fan as the game draws him, at `x`. */
function figure(fan: Fan, cut: FanCut, x = 0): THREE.InstancedMesh {
  const g = new THREE.BufferGeometry();
  const src = buildFanFigure(cut);
  for (const name of ["position", "normal", "color", "aBone"])
    g.setAttribute(name, src.getAttribute(name));
  for (const [name, a] of Object.entries(fanAttributes([{ ...fan, x, y: 0, z: 0 }])))
    g.setAttribute(name, a);
  const mesh = new THREE.InstancedMesh(g, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(x, 0, 0));
  mesh.frustumCulled = false;
  return mesh;
}

/** The snow, a metre rule, the lights and a camera framing `w` m across,
 * from in front of the fans and round `azimuth` rad. */
function stage(
  scene: THREE.Scene,
  w: number,
  cy: number,
  azimuth = 0.45,
  elev = 0.15,
): THREE.Camera {
  const snow = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshLambertMaterial({ color: 0xeef3f8 }),
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);
  for (let m = -Math.ceil(w); m < Math.ceil(w); m++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.02, 0.04),
      new THREE.MeshBasicMaterial({ color: m % 2 ? 0x11181d : 0x7d8b96 }),
    );
    band.position.set(m + 0.5, 0.01, 0.8);
    scene.add(band);
  }
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
  key.position.set(0.5, 0.75, 0.6);
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

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

/** Where a racer is for a moment of the moves sheet, and the clock. */
type Moment = { name: string; t: number; racer: [number, number] | null; arena?: number };

/** A racer `d` m off at `a` rad round from straight ahead (+z), toward +x. */
const racerAt = (d: number, a: number): [number, number] => [Math.sin(a) * d, Math.cos(a) * d];

const MOMENTS: readonly Moment[] = [
  { name: "rest", t: 1.0, racer: null },
  { name: "rest +3.7 s", t: 4.7, racer: null },
  { name: "rest +8.9 s", t: 9.9, racer: null },
  { name: "arena music", t: 2.0, racer: null, arena: 1 },
  { name: "racer at 40 m", t: 3.0, racer: racerAt(40, -0.9) },
  { name: "at 6 m · 0.0 s", t: 3.0, racer: racerAt(6, -0.4) },
  { name: "0.1 s", t: 3.1, racer: racerAt(6, -0.3) },
  { name: "0.2 s", t: 3.2, racer: racerAt(6, -0.2) },
  { name: "0.3 s", t: 3.3, racer: racerAt(6, -0.1) },
  { name: "passing right", t: 3.5, racer: racerAt(7, 1.1) },
  { name: "passed, behind", t: 3.8, racer: racerAt(12, 2.2) },
];

function setMoment(m: Moment): void {
  uniforms.uFanTime.value = m.t;
  uniforms.uFanArena.value = m.arena ?? 0;
  uniforms.uFanWave.value.set(0, 0, 0, 0);
  const s = uniforms.uFanSkier.value;
  for (const u of s) u.set(0, 0, 0, 0);
  if (m.racer) s[0].set(m.racer[0], 0, m.racer[1], 1);
}

function moveCells(): Cell[] {
  return FAN_STYLES.flatMap((style, row) =>
    MOMENTS.map((m, k) => ({
      name: k === 0 ? `${style} — ${m.name}` : m.name,
      foot: "",
      draw(scene: THREE.Scene) {
        setMoment(m);
        scene.add(
          figure(
            standIn({
              style: row,
              hat: row % FAN_HATS.length,
              phase: 0.13 * row + 0.05,
              dress: [row % 8, 9, (row + 3) % 8, (row + 5) % 8],
              arena: m.arena === 1,
            }),
            "near",
          ),
        );
        return stage(scene, 2.3, 1.05);
      },
    })),
  );
}

function dealt(n: number): Fan[] {
  const plan = planSpectators(createGame({ seed, mode: "slalom", quiet: true }).level);
  const step = Math.max(1, Math.floor(plan.fans.length / n));
  return plan.fans.filter((_, i) => i % step === 0).slice(0, n);
}

function lookCells(): Cell[] {
  const fans = dealt(48);
  return fans.map((f) => ({
    name: `${FAN_STYLES[f.style]} · ${FAN_HATS[f.hat]}`,
    foot: `${f.height.toFixed(2)} m ×${f.girth.toFixed(2)}${f.coat ? " coat" : ""}${f.pack ? " pack" : ""}${f.scarf ? " scarf" : ""} · ${f.kind}`,
    draw(scene: THREE.Scene) {
      setMoment(MOMENTS[0]);
      scene.add(figure({ ...f, yaw: 0 }, "near"));
      return stage(scene, 2.6, 1.0);
    },
  }));
}

function cutCells(): Cell[] {
  const fans = dealt(6);
  return fans.flatMap((f) => [
    ...FAN_CUT_NAMES.map((cut) => ({
      name: `${FAN_STYLES[f.style]} — ${cut}`,
      foot: `${fanTriangles(cut)} tris`,
      draw(scene: THREE.Scene) {
        setMoment(MOMENTS[6]);
        scene.add(figure({ ...f, yaw: 0 }, cut));
        return stage(scene, 2.6, 1.0);
      },
    })),
    {
      name: "far at 120 m",
      foot: "the game's pixels",
      draw(scene: THREE.Scene) {
        setMoment(MOMENTS[6]);
        scene.add(figure({ ...f, yaw: 0 }, "far"));
        // A 60° lens at 120 m: the cell's height is 139 m of view.
        return stage(scene, (139 * CELL_W) / CELL_H / 12, 1.0);
      },
    },
  ]);
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

// ── THE RACE: the crowd on a mountain, through the game's renderer ──────

async function race(): Promise<void> {
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
  const cross = mode === "skiCross";
  const state: GameState = createGame({
    seed,
    mode,
    quiet: true,
    ...(cross ? { spec: skisById(SKI_CROSS.skis) } : {}),
    ...(cross && heat
      ? {
          cross: {
            round: "quarter" as const,
            index: 0,
            racers: [
              { id: null, rank: 1 },
              { id: 0, rank: 8 },
              { id: 1, rank: 9 },
              { id: 2, rank: 16 },
            ],
          },
        }
      : {}),
  });
  const hour = Number(params.get("hour"));
  const weather = params.get("weather");
  const hourSet = params.get("hour") !== null && Number.isFinite(hour);
  if (hourSet || weather) {
    renderer.setSky({
      ...(hourSet ? { hour } : {}),
      ...(weather ? { weather: weather as WeatherKind } : {}),
    });
  }
  await renderer.load(state);
  const level = state.level;
  // The finish line's arc: the piste's end on a downhill, short of it on
  // a slalom, whose course is a stretch of the piste.
  const length = level.checkpoints[level.checkpoints.length - 1]?.s ?? level.track.length;
  const startS = level.checkpoints[0]?.s ?? 0;
  const plan = planSpectators(level);
  const FRAME = 1 / 60;
  const sOf = (x: number, z: number) => nearestTrackPoint(level, x, z).s;
  const racerS = () => (state.progress.finished ? length + 1 : sOf(state.skier.x, state.skier.z));

  /** The first bank of a kind, its middle as an arc and a side. */
  const bankOf = (kind: string) => {
    const b = plan.banks.find((k) => k.kind === kind);
    if (!b) return null;
    const hit = nearestTrackPoint(level, b.x, b.z);
    return { bank: b, s: hit.s, side: Math.sign(hit.lateral) || 1 };
  };
  const passBank = (() => {
    const b = plan.banks.find((k) => k.kind === "finish");
    if (!b) return null;
    // The fan of the slope's bank nearest a hundred metres up from the line.
    let best = b.from;
    let gap = Infinity;
    for (let i = b.from; i < b.to; i++) {
      const s = sOf(plan.fans[i].x, plan.fans[i].z);
      if (Math.abs(s - (length - 100)) < gap) {
        gap = Math.abs(s - (length - 100));
        best = i;
      }
    }
    const f = plan.fans[best];
    const hit = nearestTrackPoint(level, f.x, f.z);
    return { x: f.x, y: f.y, z: f.z, s: hit.s, side: Math.sign(hit.lateral) || 1 };
  })();

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
  /** From the piste `back` m in from a bank's fence at arc `s`, `side` the
   * bank's, `up` m high, looking at the bank `ahead` m up the piste. */
  const across = (s: number, side: number, up = 1.8, back = 11, ahead = 6): void => {
    const p = trackPointAt(level, s);
    const q = trackPointAt(level, s - ahead);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const e = {
      x: p.x + rx * side * (p.width / 2 - back),
      z: p.z + rz * side * (p.width / 2 - back),
    };
    const qx = Math.cos(q.heading);
    const qz = -Math.sin(q.heading);
    const a = { x: q.x + qx * side * (q.width / 2 + 6), z: q.z + qz * side * (q.width / 2 + 6) };
    look([e.x, level.groundAt(e.x, e.z) + up, e.z], [a.x, level.groundAt(a.x, a.z) + 1.2, a.z], 55);
  };

  /** The arc each view wants the racer at, or null for none. */
  const at: Record<string, () => number | null> = {
    start: () => startS + 4,
    course: () => (startS + length) / 2,
    combo: () => bankOf("combo")?.s ?? null,
    turn: () => bankOf("turn")?.s ?? null,
    pitch: () => bankOf("pitch")?.s ?? null,
    jump: () => bankOf("jump")?.s ?? null,
    line: () => bankOf("line")?.s ?? null,
    slope: () => length - 120,
    finish: () => length - 45,
    stand: () => length - 12,
    arena: () => length + 1,
    overview: () => length - 60,
    chase: () => length - 70,
    idle: () => length * 0.35,
    screen: () => length + 1,
  };
  const PASS = [-34, -16, -6, 0, 8, 22];
  PASS.forEach((ds, k) => {
    at[`pass-${k}`] = () => (passBank ? passBank.s + ds : null);
  });

  // A SKI CROSS's own views: the start gate under the starter's word and as
  // its doors drop — held to the run's clock, s after GO (`when`), ahead of
  // every arc — and the course's flags and fence.
  const xc = level.skiCross;
  const go = state.rules.countdown;
  const when: Record<string, number> = { "doors-go": go + 0.1, "doors-out": go + 0.9 };
  const firstOf = (kind: "berm" | "corridor") => {
    if (!xc) return null;
    if (kind === "berm") {
      const b = xc.features.find((f) => f.kind === "berm");
      const cp = level.checkpoints.find((c) => c.flags && c.pole && b && c.s >= b.from - 2);
      return b && cp ? { s: cp.s, side: b.side ?? 1, cp } : null;
    }
    const cp = level.checkpoints.find((c) => c.flags && !c.pole && c.s > 60);
    return cp ? { s: cp.s, side: 1, cp } : null;
  };
  if (xc) {
    at.doors = () => -4;
    at["doors-back"] = () => -3;
    at["doors-go"] = () => -2;
    at["doors-out"] = () => -1;
    at.berm = () => (firstOf("berm")?.s ?? 0) - 20;
    at.corridor = () => (firstOf("corridor")?.s ?? 0) - 25;
    at.fence = () => (xc.from + xc.to) / 2 - 30;
    at["finish-line"] = () => xc.to - 30;
  }

  const shots: Record<string, () => string> = {
    start() {
      if (level.slalom) {
        // The start house from below on the course, its knot beside it.
        const h = level.checkpoints[0];
        const p = trackPointAt(level, h.s + 24);
        look([p.x, p.y + 4, p.z], [h.x, h.y + 1.5, h.z], 60);
        return "the start house and its knot, from down the course";
      }
      const b = bankOf("start");
      across(b?.s ?? 15, 1, 2.2);
      return "the knot at the start, from across the piste";
    },
    course() {
      const mid = (startS + length) / 2;
      const p = trackPointAt(level, mid + 40);
      const q = trackPointAt(level, mid - 80);
      look([p.x, p.y + 9, p.z], [q.x, q.y, q.z], 60);
      return `up the course from ${(mid + 40).toFixed(0)} m, both banks behind the nets`;
    },
    combo() {
      const b = bankOf("combo");
      if (!b) return "no combination on this course";
      across(b.s, b.side, 2.5);
      return `the crowd at a combination at ${b.s.toFixed(0)} m`;
    },
    turn() {
      const b = bankOf("turn");
      if (!b) return "no turn bank on this map";
      across(b.s, b.side, 2.5);
      return `the inside of a hard turn at ${b.s.toFixed(0)} m`;
    },
    pitch() {
      const b = bankOf("pitch");
      if (!b) return "no pitch bank on this map";
      across(b.s, b.side, 2.5);
      return `a steep pitch at ${b.s.toFixed(0)} m`;
    },
    jump() {
      const b = bankOf("jump");
      if (!b) return "no jump bank on this map";
      across(b.s, b.side, 2.5);
      return `a jump's crowd at ${b.s.toFixed(0)} m`;
    },
    line() {
      const b = bankOf("line");
      if (!b) return "no knots on this map";
      across(b.s, b.side, 2.2);
      return `a knot by the line at ${b.s.toFixed(0)} m`;
    },
    slope() {
      const p = trackPointAt(level, length - 150);
      const q = trackPointAt(level, length - 40);
      look([p.x, p.y + 6, p.z], [q.x, q.y + 1, q.z], 60);
      return "down the finish slope between its banks";
    },
    finish() {
      const p = trackPointAt(level, length - 70);
      const q = trackPointAt(level, length + 5);
      look([p.x, p.y + 4, p.z], [q.x, q.y + 3, q.z], 60);
      return "down the last stretch to the arch";
    },
    stand() {
      const st = plan.stands[0];
      if (!st) return "no grandstand";
      const fx = Math.sin(st.facing);
      const fz = Math.cos(st.facing);
      const e = { x: st.x + fx * 16, z: st.z + fz * 16 };
      look(
        [e.x, level.groundAt(e.x, e.z) + 2, e.z],
        [st.x - fx * 2, st.y + 2.5, st.z - fz * 2],
        60,
      );
      return `a grandstand (${st.rows} rows, ${st.width} m) from the finish`;
    },
    arena() {
      const a = plan.arena;
      if (!a) return "no arena";
      const fx = Math.sin(a.heading);
      const fz = Math.cos(a.heading);
      const e = { x: a.x + fx * (a.depth + 30), z: a.z + fz * (a.depth + 30) };
      look(
        [e.x, level.groundAt(e.x, e.z) + 14, e.z],
        [a.x - fx * 10, level.groundAt(a.x, a.z) + 1, a.z - fz * 10],
        60,
      );
      return "the finish arena from behind the video wall";
    },
    overview() {
      const a = plan.arena;
      const p = trackPointAt(level, length - 60);
      const x = a ? a.x : p.x;
      const z = a ? a.z : p.z;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      look(
        [x - fx * 150, level.groundAt(x, z) + 110, z - fz * 150],
        [x, level.groundAt(x, z), z],
        50,
      );
      return "over the finish and its banks";
    },
    chase() {
      renderer.draw(state, 0, FRAME, true);
      return "the game's own camera";
    },
    idle() {
      if (!passBank) return "no finish slope";
      across(passBank.s, passBank.side, 1.9, 9, 4);
      return `the finish slope's bank at ${passBank.s.toFixed(0)} m with the racer far up the hill`;
    },
    screen() {
      const a = plan.arena;
      if (!a) return "no arena";
      const sc = a.screen;
      const fx = Math.sin(sc.facing);
      const fz = Math.cos(sc.facing);
      const e = { x: sc.x + fx * 26, z: sc.z + fz * 26 };
      look([e.x, level.groundAt(e.x, e.z) + 3, e.z], [sc.x, sc.y - 1.5, sc.z], 55);
      return "the video wall and the leader's platform from the finish circle";
    },
  };
  /** A point `ahead` m down the course from arc `s` and `side` m to its
   * right, on the snow, `up` m over it. */
  const point = (s: number, side: number, up: number): [number, number, number] => {
    const p = trackPointAt(level, s);
    const x = p.x + Math.cos(p.heading) * side;
    const z = p.z - Math.sin(p.heading) * side;
    return [x, level.groundAt(x, z) + up, z];
  };
  if (xc) {
    const doors = xc.from;
    shots.doors = () => {
      look(point(doors + 16, 0, 2.2), point(doors - 1, 0, 1.4), 55);
      return "the start gate from down its ramp, the racers behind their doors";
    };
    shots["doors-back"] = () => {
      const p = trackPointAt(level, 0);
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const ex = p.x - fx * 5;
      const ez = p.z - fz * 5;
      look([ex, level.groundAt(ex, ez) + 3.4, ez], point(doors + 30, 0, -2), 60);
      return "behind the racers in the gate, down the start ramp";
    };
    shots["doors-go"] = () => {
      look(point(doors + 5, 11, 2.4), point(doors, 0, 0.6), 50);
      return `the doors dropping, ${(state.t - go).toFixed(2)} s after GO`;
    };
    shots["doors-out"] = () => {
      look(point(doors + 5, 11, 2.4), point(doors + 2, 0, 0.6), 55);
      return `out of the gate, ${(state.t - go).toFixed(2)} s after GO`;
    };
    shots.berm = () => {
      const b = firstOf("berm");
      if (!b) return "no berm on this course";
      // From the inside of the turn, its flag in front, the wall and its
      // crowd across the course behind it.
      const half = xc.width / 2;
      look(point(b.s - 14, b.side * (half - 1), 1.8), point(b.s + 4, -b.side * half, 1.5), 60);
      return `the first berm's turning gate at ${b.s.toFixed(0)} m, its crowd on the outside`;
    };
    shots.corridor = () => {
      const c = firstOf("corridor");
      if (!c) return "no corridor gate on this course";
      look(point(c.s - 16, 0, 2.4), point(c.s, 0, 0.8), 55);
      return `a corridor gate at ${c.s.toFixed(0)} m, a flag at each end`;
    };
    shots["finish-line"] = () => {
      look(point(xc.to - 14, -3, 2.2), point(xc.to + 2, 0, 0.5), 60);
      return "the finish line and its arch from the last metres";
    };
    shots.fence = () => {
      const s0 = (xc.from + xc.to) / 2;
      const half = xc.width / 2;
      look(point(s0 - 30, half - 0.5, 1.6), point(s0 + 10, half + 1, 0.8), 55);
      return `along the fence at ${s0.toFixed(0)} m`;
    };
  }
  PASS.forEach((ds, k) => {
    shots[`pass-${k}`] = () => {
      if (!passBank) return "no finish slope";
      across(passBank.s, passBank.side, 1.9, 9, 4);
      return `the finish slope's bank at ${passBank.s.toFixed(0)} m, racer ${ds >= 0 ? "+" : ""}${ds} m`;
    };
  });

  window.__aud = {
    order(views) {
      return views
        .map((v) => ({ v, s: at[v]?.() ?? Infinity }))
        .sort((a, b) => a.s - b.s)
        .map((x) => x.v);
    },
    async shoot(view) {
      const shoot = shots[view];
      if (!shoot) throw new Error(`no view ${view} (${Object.keys(shots).join(", ")})`);
      const want = at[view]?.() ?? null;
      // Ride the bot on to the moment, a frame drawn now and then so the
      // tracks keep up.
      let n = 0;
      const until = when[view] ?? -1;
      while (state.t < until) step(state, botInput(state));
      while (want !== null && racerS() < want && state.t < 600) {
        for (let i = 0; i < 2; i++) step(state, botInput(state));
        if (n++ % 3 === 0) renderer.draw(state, 0, FRAME, false);
      }
      // A few frames drawn as they come, so the lens and the crowd settle —
      // drawn without stepping where the view is held to the clock.
      for (let i = 0; i < 4; i++) {
        if (until < 0) for (let k = 0; k < 2; k++) step(state, botInput(state));
        renderer.draw(state, 0, FRAME, false);
      }
      const what = shoot();
      return `${what} — racer at ${racerS().toFixed(0)} m of ${length.toFixed(0)}, t ${state.t.toFixed(1)} s, ${(state.skier.speed * 3.6).toFixed(0)} km/h, ${plan.fans.length} fans`;
    },
  };
  window.__done = true;
}

if (sheet === "race") {
  void race();
} else {
  const cells = sheet === "looks" ? lookCells() : sheet === "cuts" ? cutCells() : moveCells();
  const cols = sheet === "looks" ? 12 : sheet === "cuts" ? 8 : MOMENTS.length;
  drawSheet(cells, cols);
}
