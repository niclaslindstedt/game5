// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW-REFERENCE LAB's page (driven by `scripts/snowref-preview.mjs`):
// the snow a rider throws and leaves, as the game draws it, laid against
// what real riders were MEASURED throwing (`spray-film.ts`). Three sheets:
//
//   spray   the shared scenes — a CARVE on the groomer, a ski HOCKEY STOP, a
//           board's HEELSIDE and TOESIDE stops, a TURN IN POWDER — one a
//           row, its moments the columns, each from a lens set side-on to
//           the way the snow went. Over every cell the reference's envelope
//           at that moment (dashed amber: how high, how far) and the game's
//           own plume measured off the drawn grains and puffs the same way
//           (solid cyan), and the moment's SCORE against the film, 0..100.
//   marks   what is left in the snow: a FALL IN POWDER from beside at three
//           moments and from over the hole, and the TRACK LINE behind a run
//           of carves on the groomer and in powder from the chase lens.
//   perf    the hockey stop's busiest moment at LOW, MEDIUM and HIGH: the
//           frame's time (drained, a software GPU's — compare rows, not
//           machines) and how many grains and puffs it drew.
//
// The sun is set by its height (`sun`, degrees): the day's 28° and the low
// sun's 8° are the two the contest shares. A map's own seed and region.

import {
  createGame,
  isRegionId,
  NEUTRAL_INPUT,
  pairById,
  placeRun,
  step,
  type GameState,
  type RegionId,
  type SkierInput,
  type SkiSpec,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { holdInput, type HoldMove } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset, type Tier } from "../game/settings-video.ts";
import {
  filmAt,
  FILM,
  frameScore,
  plumeOf,
  type FilmFrame,
  type FilmMove,
  type Plume,
} from "../game/spray-film.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";

type CellScore = { move: FilmMove; t: number; game: Plume; film: FilmFrame; score: number };

declare global {
  interface Window {
    __snowref?: {
      ready: Promise<void>;
      sheet(): Promise<{ w: number; h: number; note: string; scores: CellScore[]; perf: string[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const list = (name: string, fallback: string) =>
  (params.get(name) || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const seed = Number(params.get("seed") ?? 38);
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
const kind = params.get("sheet") ?? "spray";
const sunDeg = Number(params.get("sun") ?? 28);
const cellW = Number(params.get("w") ?? 400);
const cellH = Number(params.get("h") ?? 260);
const times = list("times", "0.4,0.8,1.2,1.6,2,2.4").map(Number);
const only = list("moves", "carve,stop,boardHeel,boardToe,powder") as FilmMove[];
const along = Number(params.get("at") ?? 1 / 3);

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const CHAMOIS = pairById("chamois");
const LYNX = pairById("lynx");
const first = createGame({ seed, region, mode: "free", rivals: 0, quiet: true, spec: CHAMOIS });
const level = first.level;
const DEG = Math.PI / 180;
const FRAME = 1 / 60;

/** A shared scene: what is ridden, where, how fast and on which hands. */
type Scene = {
  move: FilmMove;
  spec: SkiSpec;
  powder: boolean;
  hold: HoldMove;
  /** The held move's edge turned round — a board's heelside (steer −1 on a
   * regular stance; `edgeSideOf`). */
  flip?: boolean;
  /** A SLASH: the edge laid over with the brake half on for a second, then
   * let run — the powder photographs' turn, which keeps its speed. */
  slash?: boolean;
};
const SCENES: Scene[] = [
  { move: "carve", spec: CHAMOIS, powder: false, hold: "carve" },
  { move: "stop", spec: CHAMOIS, powder: false, hold: "stop" },
  { move: "boardHeel", spec: LYNX, powder: false, hold: "stop", flip: true },
  { move: "boardToe", spec: LYNX, powder: false, hold: "stop" },
  { move: "powder", spec: CHAMOIS, powder: true, hold: "turn", slash: true },
];

let piste = { x: 0, z: 0, heading: 0 };
let field = { x: 0, z: 0, heading: 0 };

function startOf(scene: { spec: SkiSpec; powder: boolean }, kmh: number): GameState {
  const state = createGame({ level, mode: "free", rivals: 0, quiet: true, spec: scene.spec });
  const at = scene.powder ? field : piste;
  placeRun(state, { x: at.x, z: at.z, heading: at.heading, speed: kmh / 3.6 });
  return state;
}

function inputOf(scene: Scene, state: GameState, heading: number, t: number): SkierInput {
  const kmh = FILM[scene.move].kmh;
  const input = holdInput(state, kmh, heading, scene.hold, t);
  if (scene.slash) return { ...input, tuck: 0, brake: t >= 0.3 && t < 1.0 ? 0.7 : 0 };
  return scene.flip && t >= 0.35 ? { ...input, steer: -input.steer } : input;
}

/** A pinhole off a lens pose, as three's camera lays it: −1..1 across and
 * up, null behind the lens. */
function projector(pose: LensPose, aspect: number) {
  const f = {
    x: pose.target.x - pose.eye.x,
    y: pose.target.y - pose.eye.y,
    z: pose.target.z - pose.eye.z,
  };
  const fl = Math.hypot(f.x, f.y, f.z);
  f.x /= fl;
  f.y /= fl;
  f.z /= fl;
  // right = f × up, up' = right × f
  const rl = Math.hypot(f.z, f.x) || 1;
  const r = { x: -f.z / rl, y: 0, z: f.x / rl };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const k = Math.tan((pose.fov * DEG) / 2);
  return (p: { x: number; y: number; z: number }) => {
    const d = { x: p.x - pose.eye.x, y: p.y - pose.eye.y, z: p.z - pose.eye.z };
    const z = d.x * f.x + d.y * f.y + d.z * f.z;
    if (z < 0.1) return null;
    const x = d.x * r.x + d.y * r.y + d.z * r.z;
    const y = d.x * u.x + d.y * u.y + d.z * u.z;
    return { x: x / (z * k * aspect), y: y / (z * k) };
  };
}

/** The lens side-on to the throw: square across `way` from the boots, far
 * enough back to hold the reference's widest throw. */
function sideLens(state: GameState, way: { x: number; z: number }, far: number): LensPose {
  const s = state.skier;
  // Across the throw, on the side the lens can see the rider's front from.
  const ax = way.z;
  const az = -way.x;
  const mid = { x: s.x + way.x * 1.2, z: s.z + way.z * 1.2 };
  const ex = mid.x + ax * far;
  const ez = mid.z + az * far;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 1.3, z: ez },
    target: { x: mid.x, y: level.groundAt(mid.x, mid.z) + 0.7, z: mid.z },
    fov: 46,
    roll: 0,
  };
}

/** The throw's box in the plane of the throw: from the boots out to `reach`
 * along `way`, up to `top` over the snow. */
function drawBox(
  ctx: CanvasRenderingContext2D,
  project: ReturnType<typeof projector>,
  s: { x: number; z: number },
  way: { x: number; z: number },
  f: FilmFrame,
  x0: number,
  y0: number,
  colour: string,
  dashed: boolean,
) {
  const at = (d: number, h: number) => {
    const x = s.x + way.x * d;
    const z = s.z + way.z * d;
    return project({ x, y: level.groundAt(x, z) + h, z });
  };
  const pts = [at(0, 0), at(0, f.top), at(f.reach, f.top), at(f.reach, 0)];
  if (pts.some((p) => !p)) return;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashed ? [7, 5] : []);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const px = x0 + ((p!.x + 1) / 2) * cellW;
    const py = y0 + ((1 - p!.y) / 2) * cellH;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

function measure(state: GameState, view: { x: number; z: number }, t: number): Plume {
  const s = state.skier;
  return plumeOf(renderer.plumes(), level.groundAt, s.x, s.z, view, t);
}

function label(ctx: CanvasRenderingContext2D, lines: string[], x0: number, y0: number) {
  ctx.fillStyle = "rgba(11,17,22,0.72)";
  ctx.fillRect(x0, y0 + cellH - 14 - 15 * lines.length, cellW, 14 + 15 * lines.length);
  ctx.fillStyle = "#e8eef4";
  lines.forEach((l, i) => ctx.fillText(l, x0 + 6, y0 + cellH - 4 - 15 * (lines.length - i)));
}

async function settle(state: GameState) {
  renderer.setOverride(null);
  renderer.setCamera("chase", true);
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
}

function ride(scene: Scene, state: GameState, heading: number, t0: number, until: number) {
  while (state.t - t0 < until) {
    for (let i = 0; i < 2; i++) step(state, inputOf(scene, state, heading, state.t - t0));
    renderer.draw(state, 0, FRAME, false);
  }
}

async function spraySheet(ctx: CanvasRenderingContext2D, labelW: number, headH: number) {
  const scores: CellScore[] = [];
  const scenes = SCENES.filter((s) => only.includes(s.move));
  for (let r = 0; r < scenes.length; r++) {
    const scene = scenes[r];
    const film = FILM[scene.move];
    // The powder photographs are of powder days, the snow a day or two
    // old: the map's own age of snow for the groomer, fresh for the meadow.
    renderer.setSnow(null, scene.powder ? "fresh" : undefined);
    const state = startOf(scene, film.kmh);
    const heading = state.skier.heading;
    const t0 = state.t;
    await settle(state);
    const y0 = headH + r * cellH;
    let sum = 0;
    for (let c = 0; c < times.length; c++) {
      const t = times[c];
      ride(scene, state, heading, t0, t);
      const s = state.skier;
      // The throw's way first, then the lens square across it.
      const rough = measure(state, { x: Math.sin(s.heading), z: Math.cos(s.heading) }, t);
      const way =
        rough.bits > 0 && Math.hypot(rough.wayX, rough.wayZ) > 0.5
          ? { x: rough.wayX, z: rough.wayZ }
          : { x: -Math.sin(s.heading), z: -Math.cos(s.heading) };
      const ref = filmAt(scene.move, t);
      const lens = sideLens(state, way, Math.max(5, ref.reach * 1.6 + 2.5));
      renderer.setOverride(lens);
      renderer.draw(state, 0, 0, true);
      const view = { x: -way.z, z: way.x };
      const game = measure(state, view, t);
      const score = frameScore(game, ref);
      sum += score;
      scores.push({ move: scene.move, t, game, film: ref, score });
      const x0 = labelW + c * cellW;
      ctx.drawImage(stage, x0, y0, cellW, cellH);
      const project = projector(lens, cellW / cellH);
      drawBox(ctx, project, s, way, ref, x0, y0, "#ffb347", true);
      drawBox(ctx, project, s, way, game, x0, y0, "#5fd3ff", false);
      label(
        ctx,
        [
          `${t.toFixed(1)} s · ${(s.speed * 3.6).toFixed(0)} km/h · score ${score.toFixed(0)}`,
          `top ${game.top.toFixed(2)}/${ref.top.toFixed(2)} reach ${game.reach.toFixed(1)}/${ref.reach.toFixed(1)} area ${game.area.toFixed(2)}/${ref.area.toFixed(2)}`,
        ],
        x0,
        y0,
      );
      renderer.setOverride(null);
    }
    ctx.fillStyle = "#e8eef4";
    [
      film.title.toUpperCase(),
      `${scene.spec.id} · ${film.kmh} km/h`,
      `mean ${(sum / times.length).toFixed(0)}`,
    ].forEach((l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 16 + i * 16));
    await new Promise((done) => setTimeout(done, 0));
  }
  renderer.setSnow(null);
  return scores;
}

/** THE FALL INTO POWDER: stood in the meadow at a crawl and laid down. */
const LAID_DOWN: SkierInput = { ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 };

async function marksSheet(ctx: CanvasRenderingContext2D, labelW: number, headH: number) {
  const titles = ["FALL IN POWDER", "TRACK LINE"];
  // Row 0: the fall, beside at three moments and over the hole.
  // Deep enough to lay him down (the world lab's powder views' dial).
  renderer.setSnow(null, "fresh");
  const fall = createGame({
    level,
    mode: "free",
    rivals: 0,
    quiet: true,
    spec: CHAMOIS,
    snowDepth: 2.5,
  });
  placeRun(fall, { x: field.x, z: field.z, heading: field.heading, speed: 12 / 3.6 });
  await settle(fall);
  const until = fall.t + 8;
  while (!fall.skier.thrown && fall.t < until) {
    for (let i = 0; i < 2; i++) step(fall, LAID_DOWN);
    renderer.draw(fall, 0, FRAME, false);
  }
  const into = fall.skier.thrown
    ? { x: fall.skier.thrown.x, z: fall.skier.thrown.z, h: fall.skier.thrown.heading }
    : null;
  const shots: { t: number; top: boolean }[] = [
    { t: 0.3, top: false },
    { t: 1, top: false },
    { t: 3, top: false },
    { t: 3, top: true },
  ];
  for (let c = 0; c < shots.length; c++) {
    const x0 = labelW + c * cellW;
    const off = fall.skier.thrown;
    if (!into || !off) {
      ctx.fillStyle = "#e8eef4";
      ctx.fillText("he did not fall", x0 + 8, headH + 20);
      continue;
    }
    while (fall.skier.thrown && fall.skier.thrown.t < shots[c].t) {
      for (let i = 0; i < 2; i++) step(fall, NEUTRAL_INPUT);
      renderer.draw(fall, 0, FRAME, false);
    }
    const now = fall.skier.thrown ?? off;
    const across = into.h + Math.PI / 2;
    const far = shots[c].top ? 1.4 : 3.6;
    const ex = into.x + Math.sin(across) * far;
    const ez = into.z + Math.cos(across) * far;
    renderer.setOverride({
      eye: { x: ex, y: level.groundAt(ex, ez) + (shots[c].top ? 4.4 : 1.0), z: ez },
      target: { x: now.x, y: level.groundAt(now.x, now.z) - 0.2, z: now.z },
      fov: 50,
      roll: 0,
    });
    renderer.draw(fall, 0, 0, true);
    ctx.drawImage(stage, x0, headH, cellW, cellH);
    renderer.setOverride(null);
    const under = level.groundAt(now.x, now.z) - now.y;
    label(
      ctx,
      [
        `${shots[c].t} s down in deep powder · ${shots[c].top ? "over the hole" : "beside"} · middle ${under.toFixed(2)} m under`,
      ],
      x0,
      headH,
    );
  }
  renderer.setSnow(null);
  // Row 1: the track line behind six seconds of carves, groomer and powder.
  const tracks: { powder: boolean; lens: "chase" | "low" }[] = [
    { powder: false, lens: "chase" },
    { powder: false, lens: "low" },
    { powder: true, lens: "chase" },
    { powder: true, lens: "low" },
  ];
  for (let c = 0; c < tracks.length; c++) {
    const tr = tracks[c];
    const scene: Scene = { move: "carve", spec: CHAMOIS, powder: tr.powder, hold: "carve" };
    const state = startOf(scene, tr.powder ? 30 : 45);
    const heading = state.skier.heading;
    await settle(state);
    ride(scene, state, heading, state.t, 6);
    const s = state.skier;
    if (tr.lens === "low") {
      // Low behind him at the snow, looking back up the line he cut.
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const ex = s.x - fx * 3 + fz * 1.5;
      const ez = s.z - fz * 3 - fx * 1.5;
      const bx = s.x - fx * 14;
      const bz = s.z - fz * 14;
      renderer.setOverride({
        eye: { x: ex, y: level.groundAt(ex, ez) + 0.5, z: ez },
        target: { x: bx, y: level.groundAt(bx, bz), z: bz },
        fov: 50,
        roll: 0,
      });
    } else {
      renderer.setOverride(null);
      for (let i = 0; i < 20; i++) renderer.draw(state, 0, FRAME, false);
    }
    renderer.draw(state, 0, 0, true);
    const x0 = labelW + c * cellW;
    ctx.drawImage(stage, x0, headH + cellH, cellW, cellH);
    renderer.setOverride(null);
    label(
      ctx,
      [`${tr.powder ? "powder" : "groomer"} · 6 s of carves · ${tr.lens}`],
      x0,
      headH + cellH,
    );
  }
  ctx.fillStyle = "#e8eef4";
  titles.forEach((t, r) => ctx.fillText(t, 8, headH + r * cellH + cellH / 2));
}

async function perfSheet(ctx: CanvasRenderingContext2D, headH: number): Promise<string[]> {
  const out: string[] = [];
  const tiers: Tier[] = ["low", "medium", "high"];
  for (let c = 0; c < tiers.length; c++) {
    renderer.setVideo(withPreset(DEFAULT_VIDEO, tiers[c]));
    const scene = SCENES[1];
    const state = startOf(scene, FILM.stop.kmh);
    const heading = state.skier.heading;
    await settle(state);
    ride(scene, state, heading, state.t, 1.2);
    const ms: number[] = [];
    renderer.drain();
    for (let i = 0; i < 24; i++) {
      for (let k = 0; k < 2; k++) step(state, inputOf(scene, state, heading, 1.2));
      const a = performance.now();
      renderer.draw(state, 0, FRAME, true);
      renderer.drain();
      ms.push(performance.now() - a);
    }
    ms.sort((a, b) => a - b);
    const bits = renderer.plumes().length;
    const line = `${tiers[c].toUpperCase()}: median ${ms[12].toFixed(1)} ms, worst ${ms[23].toFixed(1)} ms a frame; ${bits} grains and puffs drawn`;
    out.push(line);
    const x0 = c * cellW;
    ctx.drawImage(stage, x0, headH, cellW, cellH);
    label(ctx, [line.slice(0, 54), line.slice(54)], x0, headH);
  }
  renderer.setVideo(withPreset(DEFAULT_VIDEO, "high"));
  return out;
}

window.__snowref = {
  ready: (async () => {
    await renderer.load(first);
    const m = meadow(level);
    const n = { x: 0, y: 1, z: 0 };
    level.normalAt(m.x, m.z, n);
    const fall = Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0;
    field = { x: m.x, z: m.z, heading: fall };
    piste = pisteSpot(level, along);
  })(),
  async sheet() {
    const labelW = kind === "perf" ? 0 : 170;
    const headH = 34;
    const cols = kind === "spray" ? times.length : kind === "marks" ? 4 : 3;
    const rowN =
      kind === "spray"
        ? SCENES.filter((s) => only.includes(s.move)).length
        : kind === "marks"
          ? 2
          : 1;
    sheet.width = labelW + cellW * cols;
    sheet.height = headH + cellH * rowN;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    // The photographs are of still air: a clear sky and a breath of wind, so a
    // low sun's hour and a high one's differ only in the light.
    renderer.setSky({
      weather: { kind: "clear", wind: Number(params.get("wind") ?? 1) },
      hour: hourAt(level, sunDeg * DEG),
    });
    const note = `SNOW REFERENCE · ${kind.toUpperCase()} · seed ${seed}${region ? ` ${region}` : ""} · sun ${sunDeg}°`;
    ctx.fillText(
      `${note}${kind === "spray" ? " · dashed amber the film, solid cyan the game (top × reach, side-on to the throw)" : ""}`,
      8,
      10,
    );
    if (kind === "spray")
      times.forEach((t, c) => ctx.fillText(`${t} s`, labelW + c * cellW + 6, 26));
    let scores: CellScore[] = [];
    let perf: string[] = [];
    if (kind === "spray") scores = await spraySheet(ctx, labelW, headH);
    else if (kind === "marks") await marksSheet(ctx, labelW, headH);
    else perf = await perfSheet(ctx, headH);
    renderer.setSky(null);
    renderer.setOverride(null);
    return { w: sheet.width, h: sheet.height, note, scores, perf };
  },
};
