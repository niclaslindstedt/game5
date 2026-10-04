// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE LAB's page (driven by `scripts/technique-preview.mjs`): each
// riding TECHNIQUE (`defs/technique.ts`) skied down one course by the bot,
// photographed through the game's own renderer — the committed models, the
// dressed skier, the tracks his skis cut — as three sheets:
//
//   path     straight down on a stretch of the course, one panel a row side
//            by side: the snow and the tracks as drawn at the stretch's end,
//            the skier strobed into it every `strobe` s (the figure as
//            drawn, cut out of a frame shot from the same height at that
//            moment), his centre of gravity's line in yellow, a tick where
//            he faces, the turning poles ringed in their colour
//   behind   a TV lens up the course behind him at four moments of one turn:
//            the TRANSITION (the edge through flat), the EDGE SET (half its
//            peak), the APEX (the gate he passes, or the peak edge) and the
//            EXIT (back under half) — a row a technique
//   side     the apex from his OUTSIDE, from the FRONT and from his INSIDE:
//            the angulation, the inside leg folded and the outside one long
//
// The turn is the one whose apex is nearest the middle of the stretch, so
// every row is photographed at the same place on the hill. A row is skied
// twice: once headless, to find the stretch's moments, then again —
// identically, the engine is deterministic — drawn from a couple of seconds
// before them. A clear sky with the sun 25° up; the physics keeps the map's
// own weather (the new snow it lays is the physics', and the table is
// measured under it).

import * as THREE from "three";
import {
  RIDER_BOT,
  SKI_CATALOG,
  botInput,
  createGame,
  nearestTrackPoint,
  step,
  trackPointAt,
  type GameState,
  type Level,
  type TechniqueId,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { standOf } from "../game/ski-stand.ts";
import { hourAt } from "./stage.ts";

type Course = "slalom" | "piste";
type Row = { technique: TechniqueId; skis: string; course: Course };
type Moment = "transition" | "edge set" | "apex" | "exit";
type Cell = { img: HTMLCanvasElement; lines: string[] };
type Drawn = {
  row: Row;
  path: HTMLCanvasElement;
  pathNote: string[];
  behind: Cell[];
  side: Cell[];
  end: number;
  turn: string;
};

declare global {
  interface Window {
    __tech?: {
      ready: Promise<void>;
      /** Ski and photograph every row; resolves to what each run did. */
      run(): Promise<{ technique: string; end: number; turn: string }[]>;
      /** Lay one sheet out on the page; resolves to its size. */
      sheet(name: string): { w: number; h: number; note: string };
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 360);
const cellH = Number(params.get("h") ?? 240);
const pathW = Number(params.get("pw") ?? 240);
const pathH = Number(params.get("ph") ?? 900);
const strobe = Number(params.get("strobe") ?? 0.25);
const spans: Record<Course, number> = {
  slalom: Number(params.get("span-slalom") ?? 60),
  piste: Number(params.get("span-piste") ?? 300),
};
const rows: Row[] = (params.get("rows") ?? "slalom:swift:slalom")
  .split(",")
  .filter(Boolean)
  .map((r) => {
    const [technique, skis, course] = r.split(":");
    return { technique: technique as TechniqueId, skis, course: course as Course };
  });

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheetEl = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
const DEG = Math.PI / 180;
const FRAME = 1 / 60;
/** The edge past which a ski is on one side when the turns are counted,
 * rad — the lab's measurement counts them from the same 10°
 * (`ride-helpers.mjs`'s `TURN_EDGE`). */
const TURN_EDGE = 0.17;
/** How far round the strobed skier his frame is cut out, m. */
const CROP = 1.6;
/** How much of the cut-out frame is laid into the plan, a share of its
 * width: the figure and its skis, not the snow either side. */
const CLIP = 0.3;
/** The path's lens: its field of view, deg, and how far the stretch's own
 * length is padded inside the panel. */
const PLAN_FOV = 30;
const PLAN_PAD = 1.08;

let courses: Record<Course, Level> | null = null;

/** A row's run stood up — as the lab's measurement does
 * (`technique-measure.mjs`'s `gameOf`): the slalom under its own rules,
 * the piste as a time trial, alone, no lights. */
function gameOf(row: Row): GameState {
  return createGame({
    level: courses![row.course],
    mode: row.course === "slalom" ? "slalom" : "timeTrial",
    rivals: 0,
    countdown: 0,
    spec: SKI_CATALOG.find((s) => s.id === row.skis),
    technique: row.technique,
    quiet: true,
  });
}

/** One step of the bot's run. */
const skiOn = (state: GameState) => step(state, botInput(state, RIDER_BOT));

type Rec = { t: number; x: number; z: number; edge: number; s: number; started: boolean };

/** THE RUN, headless: every step recorded, and the times it passed a gate. */
function record(row: Row): { recs: Rec[]; gates: number[]; end: number } {
  const state = gameOf(row);
  const recs: Rec[] = [];
  const gates: number[] = [];
  while (!state.progress.finished && state.t < 400) {
    skiOn(state);
    const c = state.skier;
    const s = nearestTrackPoint(state.level, c.x, c.z).s;
    recs.push({ t: state.t, x: c.x, z: c.z, edge: c.edge, s, started: state.progress.started });
    for (const e of state.events) if (e.kind === "checkpoint") gates.push(e.t);
  }
  return { recs, gates, end: state.t };
}

type Turn = {
  moments: Record<Moment, number>;
  /** +1 a right turn (the edge positive), −1 a left. */
  side: number;
  /** When he passed the turn's gate, s after the peak edge (the research
   * puts the peak at or just after the gate: a little negative), or null
   * for a turn with no gate in it. */
  gate: number | null;
};

/** THE TURN TO PHOTOGRAPH and its four moments, s: of the turns he makes on
 * the stretch, the one whose apex — its peak edge — is nearest its middle. */
function turnOf(recs: Rec[], gates: number[], mid: number): Turn | null {
  // Each flip of the edge past TURN_EDGE from one side to the other.
  const flips: { i: number; side: number }[] = [];
  let side = 0;
  recs.forEach((r, i) => {
    if (!r.started) return;
    const now = r.edge > TURN_EDGE ? 1 : r.edge < -TURN_EDGE ? -1 : 0;
    if (now !== 0 && now !== side) {
      flips.push({ i, side: now });
      side = now;
    }
  });
  let best: Turn | null = null;
  let gap = Infinity;
  for (let k = 1; k + 1 < flips.length; k++) {
    const a = flips[k];
    const b = flips[k + 1];
    // The transition: where the edge went through flat before this side.
    let from = a.i;
    while (from > flips[k - 1].i && Math.sign(recs[from - 1].edge) === a.side) from -= 1;
    let peak = from;
    for (let i = from; i < b.i; i++) {
      if (Math.abs(recs[i].edge) > Math.abs(recs[peak].edge)) peak = i;
    }
    if (Math.abs(recs[peak].s - mid) >= gap) continue;
    const top = Math.abs(recs[peak].edge);
    let set = from;
    while (set < peak && Math.abs(recs[set].edge) < top * 0.5) set += 1;
    let exit = peak;
    while (exit < b.i && Math.abs(recs[exit].edge) > top * 0.5) exit += 1;
    const gate = gates.find((t) => t >= recs[from].t && t < recs[b.i].t);
    gap = Math.abs(recs[peak].s - mid);
    best = {
      moments: {
        transition: recs[from].t,
        "edge set": recs[set].t,
        apex: recs[peak].t,
        exit: recs[exit].t,
      },
      side: a.side,
      gate: gate === undefined ? null : gate - recs[peak].t,
    };
  }
  return best;
}

/** Where the drawn body is, the engine's point carried to the figure the
 * game draws — turned about the feet, so as much as half a metre inside
 * the centre of gravity in a hard turn (`ski-stand.ts`). */
function bodyOf(state: GameState, level: Level): THREE.Vector3 {
  const c = state.skier;
  const stand = standOf(c, c.airborne ? 0 : 1);
  const rx = Math.cos(c.heading);
  const rz = -Math.sin(c.heading);
  const x = c.x + rx * stand.pivot.x * 0.6;
  const z = c.z + rz * stand.pivot.x * 0.6;
  return new THREE.Vector3(x, level.groundAt(x, z) + 0.85, z);
}

/** A lens `back` m behind the body along `dirX/dirZ`, `across` m to the
 * right of it and `up` m over it (never under 0.8 m over the snow where
 * it stands, on a hill rising behind him), at the body. */
function lensAt(
  level: Level,
  body: THREE.Vector3,
  dirX: number,
  dirZ: number,
  back: number,
  across: number,
  up: number,
  fov: number,
): LensPose {
  const x = body.x - dirX * back + dirZ * across;
  const z = body.z - dirZ * back - dirX * across;
  return {
    eye: { x, y: Math.max(body.y + up, level.groundAt(x, z) + 0.8), z },
    target: { x: body.x + dirX * 0.6, y: body.y - 0.05, z: body.z + dirZ * 0.6 },
    fov,
    roll: 0,
  };
}

/** The piste's heading at the skier — the way the course runs there. */
function courseHeading(state: GameState): number {
  const near = nearestTrackPoint(state.level, state.skier.x, state.skier.z);
  return trackPointAt(state.level, near.s).heading;
}

/** What a cell says: the moment, the clock, the speed, the edge, the
 * inclination, the skid, and the outside ski's share of the load. */
function readout(state: GameState, name: string, t0: number): string[] {
  const c = state.skier;
  const stand = standOf(c, c.airborne ? 0 : 1);
  const skid = Math.atan2(
    Math.sin(Math.atan2(c.vx, c.vz) - c.heading),
    Math.cos(Math.atan2(c.vx, c.vz) - c.heading),
  );
  const outside = c.edge >= 0 ? stand.share[0] : stand.share[1];
  return [
    `${name} · ${(state.t - t0).toFixed(2)} s · ${(c.speed * 3.6).toFixed(0)} km/h`,
    `edge ${(Math.abs(c.edge) / DEG).toFixed(0)}° · incl ${(Math.abs(c.incline) / DEG).toFixed(0)}° · skid ${(Math.abs(skid) / DEG).toFixed(0)}° · out ${Math.round(outside * 100)}%`,
  ];
}

/** A copy of the frame just drawn. */
function grab(w: number, h: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(stage, 0, 0, w, h);
  return out;
}

/** Draw `state` once through `view` at `w`×`h` and keep it. */
function shoot(state: GameState, view: LensPose, w: number, h: number): HTMLCanvasElement {
  renderer.resize(w, h, 1);
  renderer.setOverride(view);
  renderer.draw(state, 0, 0, true);
  renderer.setOverride(null);
  return grab(w, h);
}

/** THE PLAN of a stretch: a lens straight down over its middle, high
 * enough for the stretch's length to fill the panel, the start of it at
 * the top; and how it maps the world onto the panel. */
function planOf(level: Level, s0: number, s1: number) {
  const pts = level.track.points.filter((p) => p.s >= s0 && p.s <= s1);
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const dx = (b.x - a.x) / len;
  const dz = (b.z - a.z) / len;
  const cx = (a.x + b.x) / 2;
  const cz = (a.z + b.z) / 2;
  const cy = pts.reduce((sum, p) => sum + level.groundAt(p.x, p.z), 0) / pts.length;
  const tan = Math.tan((PLAN_FOV / 2) * DEG);
  const height = ((len / 2) * PLAN_PAD) / tan;
  // A whisker down the course off the vertical: the lens's up is then up
  // the course, so he skis down the panel.
  const lift = height * 0.01;
  const view: LensPose = {
    eye: { x: cx + dx * lift, y: cy + height, z: cz + dz * lift },
    target: { x: cx, y: cy, z: cz },
    fov: PLAN_FOV,
    roll: 0,
  };
  const cam = new THREE.PerspectiveCamera(PLAN_FOV, pathW / pathH, 0.1, 6000);
  cam.position.set(view.eye.x, view.eye.y, view.eye.z);
  cam.up.set(0, 1, 0);
  cam.lookAt(cx, cy, cz);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const v = new THREE.Vector3();
  const toPanel = (x: number, y: number, z: number): [number, number] => {
    v.set(x, y, z).project(cam);
    return [((v.x + 1) / 2) * pathW, ((1 - v.y) / 2) * pathH];
  };
  const pxPerM = pathH / (2 * height * tan);
  return { view, toPanel, pxPerM, height, dx, dz };
}

/** SKI ONE ROW and photograph it. */
async function shootRow(row: Row): Promise<Drawn> {
  const level = courses![row.course];
  const { recs, gates, end } = record(row);
  const startAt = recs.find((r) => r.started)?.t ?? 0;
  const mid =
    row.course === "slalom" && level.slalom
      ? (level.slalom.from + level.slalom.to) / 2
      : level.track.length / 2;
  const s0 = mid - spans[row.course] / 2;
  const s1 = mid + spans[row.course] / 2;
  const turn = turnOf(recs, gates, mid);
  const inside = recs.filter((r) => r.started && r.s >= s0 && r.s <= s1);
  const plan = planOf(level, s0, s1);
  const crops = plan.pxPerM * CROP >= 10;
  const cropPx = Math.round(2 * CROP * plan.pxPerM);
  const cropView = (state: GameState): LensPose => {
    const c = state.skier;
    const y = level.groundAt(c.x, c.z);
    const lift = plan.height * 0.01;
    return {
      eye: { x: c.x + plan.dx * lift, y: y + plan.height, z: c.z + plan.dz * lift },
      target: { x: c.x, y, z: c.z },
      fov: 2 * Math.atan(CROP / plan.height) * (180 / Math.PI),
      roll: 0,
    };
  };

  // THE CAPTURES, in the order the run reaches them.
  type Capture = { t: number; kind: "strobe" | Moment };
  const captures: Capture[] = [];
  let next = -Infinity;
  for (const r of inside) {
    if (r.t >= next) {
      captures.push({ t: r.t, kind: "strobe" });
      next = r.t + strobe;
    }
  }
  if (turn) {
    for (const m of ["transition", "edge set", "apex", "exit"] as Moment[]) {
      captures.push({ t: turn.moments[m], kind: m });
    }
  }
  captures.sort((a, b) => a.t - b.t);
  const lastT = Math.max(inside[inside.length - 1]?.t ?? 0, ...captures.map((c) => c.t));
  const drawFrom = Math.max(0, (captures[0]?.t ?? lastT) - 2);

  // THE RUN AGAIN, drawn from a couple of seconds before the first capture
  // (every frame stamps the tracks), the skier photographed at each.
  const state = gameOf(row);
  renderer.setOverride(null);
  renderer.setCamera("chase", true);
  while (state.t < drawFrom && !state.progress.finished) skiOn(state);
  renderer.resize(cellW, cellH, 1);
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
  const strobes: { img: HTMLCanvasElement; at: [number, number]; heading: number }[] = [];
  const line: [number, number][] = [];
  const behind: Cell[] = [];
  const side: Cell[] = [];
  let apexAt: [number, number] | null = null;
  let k = 0;
  let drawnAt = state.t;
  while (k < captures.length && !state.progress.finished) {
    skiOn(state);
    const c = state.skier;
    if (c.speed > 0 && inside.length && state.t >= inside[0].t && state.t <= lastT) {
      line.push(plan.toPanel(c.x, level.groundAt(c.x, c.z), c.z));
    }
    if (state.t - drawnAt >= FRAME - 1e-9) {
      renderer.draw(state, 0, state.t - drawnAt, false);
      drawnAt = state.t;
    }
    while (k < captures.length && state.t >= captures[k].t) {
      const cap = captures[k++];
      if (cap.kind === "strobe") {
        const at = plan.toPanel(c.x, level.groundAt(c.x, c.z), c.z);
        strobes.push({
          img: crops
            ? shoot(state, cropView(state), cropPx, cropPx)
            : document.createElement("canvas"),
          at,
          heading: c.heading,
        });
        continue;
      }
      const body = bodyOf(state, level);
      const h = courseHeading(state);
      behind.push({
        img: shoot(
          state,
          lensAt(level, body, Math.sin(h), Math.cos(h), 10, 0, 3.5, 28),
          cellW,
          cellH,
        ),
        lines: readout(state, cap.kind, startAt),
      });
      if (cap.kind === "apex") {
        apexAt = plan.toPanel(c.x, level.groundAt(c.x, c.z), c.z);
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        // His inside, to his right in a right turn (the edge positive).
        const ins = Math.sign(c.edge) || 1;
        const views: [string, LensPose][] = [
          ["outside", lensAt(level, body, fx, fz, 0, -ins * 6.5, 0.25, 34)],
          ["front", lensAt(level, body, -fx, -fz, 6.5, 0, 0.35, 34)],
          ["inside", lensAt(level, body, fx, fz, 0, ins * 6.5, 0.25, 34)],
        ];
        for (const [name, view] of views) {
          side.push({
            img: shoot(state, view, cellW, cellH),
            lines: readout(state, `apex from ${name}`, startAt),
          });
        }
      }
    }
  }

  // THE PLAN, drawn at the stretch's end with every track cut, the skier
  // strobed into it and the lines laid over.
  renderer.resize(pathW, pathH, 1);
  renderer.setOverride(plan.view);
  renderer.draw(state, 0, 0, true);
  renderer.setOverride(null);
  const path = grab(pathW, pathH);
  const ctx = path.getContext("2d")!;
  for (const st of strobes) {
    if (crops) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(st.at[0], st.at[1], cropPx * CLIP, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(st.img, st.at[0] - cropPx / 2, st.at[1] - cropPx / 2);
      ctx.restore();
    }
  }
  // His line over the figures, thin enough to see them through.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,196,0,0.9)";
  ctx.beginPath();
  line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // The photographed turn's apex, a magenta cross.
  if (apexAt) {
    ctx.strokeStyle = "#ff3df2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(apexAt[0] - 6, apexAt[1] - 6);
    ctx.lineTo(apexAt[0] + 6, apexAt[1] + 6);
    ctx.moveTo(apexAt[0] + 6, apexAt[1] - 6);
    ctx.lineTo(apexAt[0] - 6, apexAt[1] + 6);
    ctx.stroke();
  }
  // The facing ticks, in the panel's own frame (a metre of heading).
  for (const st of strobes) {
    const r = Math.max(6, plan.pxPerM * 0.9);
    const dir = facingOnPanel(plan, st.heading);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(st.at[0], st.at[1]);
    ctx.lineTo(st.at[0] + dir[0] * r, st.at[1] + dir[1] * r);
    ctx.stroke();
    if (!crops) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(st.at[0], st.at[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The turning poles, ringed in their colour.
  for (const cp of level.checkpoints) {
    if (cp.s < s0 - 2 || cp.s > s1 + 2) continue;
    const half = cp.width / 2;
    const side = cp.turn ?? 0;
    const x = cp.x + Math.cos(cp.heading) * half * side;
    const z = cp.z - Math.sin(cp.heading) * half * side;
    const [px, py] = plan.toPanel(x, level.groundAt(x, z), z);
    ctx.strokeStyle = cp.colour === "red" ? "#ff3b30" : "#2f7bff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  const pathNote = [
    `${spans[row.course]} m of the ${row.course} from ${s0.toFixed(0)} m`,
    `${strobes.length} strobes · ${plan.pxPerM.toFixed(1)} px/m`,
  ];
  return {
    row,
    path,
    pathNote,
    behind,
    side,
    end,
    turn: turn
      ? `${turn.side > 0 ? "right" : "left"} turn, peak edge ${(turn.moments.apex - startAt).toFixed(2)} s` +
        (turn.gate === null
          ? ", no gate in it"
          : `, the gate ${Math.abs(turn.gate).toFixed(2)} s ${turn.gate < 0 ? "before" : "after"} it`)
      : "no turn found on the stretch",
  };
}

/** A heading's direction across the panel, unit. */
function facingOnPanel(plan: ReturnType<typeof planOf>, heading: number): [number, number] {
  const o = plan.toPanel(plan.view.target.x, plan.view.target.y, plan.view.target.z);
  const p = plan.toPanel(
    plan.view.target.x + Math.sin(heading) * 5,
    plan.view.target.y,
    plan.view.target.z + Math.cos(heading) * 5,
  );
  const l = Math.hypot(p[0] - o[0], p[1] - o[1]) || 1;
  return [(p[0] - o[0]) / l, (p[1] - o[1]) / l];
}

const drawn: Drawn[] = [];

const rowTitle = (r: Row) => `${r.technique.toUpperCase()} · ${r.skis} · ${r.course}`;

/** Lay out a sheet of `cols` cells a row on the page canvas. */
function layout(w: number, h: number): CanvasRenderingContext2D {
  sheetEl.width = w;
  sheetEl.height = h;
  const ctx = sheetEl.getContext("2d")!;
  ctx.fillStyle = "#0b1116";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e8eef4";
  ctx.font = "12px monospace";
  ctx.textBaseline = "middle";
  return ctx;
}

/** A cell with its readout over its foot. */
function cellAt(ctx: CanvasRenderingContext2D, cell: Cell, x: number, y: number): void {
  ctx.drawImage(cell.img, x, y, cellW, cellH);
  ctx.fillStyle = "rgba(11,17,22,0.72)";
  ctx.fillRect(x, y + cellH - 36, cellW, 36);
  ctx.fillStyle = "#e8eef4";
  cell.lines.forEach((l, i) => ctx.fillText(l, x + 6, y + cellH - 26 + i * 15));
}

function gridSheet(
  title: string,
  heads: string[],
  cellsOf: (d: Drawn) => Cell[],
): { w: number; h: number; note: string } {
  const labelW = 200;
  const headH = 34;
  const ctx = layout(labelW + cellW * heads.length, headH + cellH * drawn.length);
  ctx.fillText(title, 8, 10);
  heads.forEach((t, c) => ctx.fillText(t, labelW + c * cellW + 6, 26));
  drawn.forEach((d, r) => {
    const y0 = headH + r * cellH;
    cellsOf(d).forEach((cell, c) => cellAt(ctx, cell, labelW + c * cellW, y0));
    ctx.fillStyle = "#e8eef4";
    const label = [
      d.row.technique.toUpperCase(),
      `${d.row.skis} · ${d.row.course}`,
      ...d.turn.split(", "),
    ];
    label.forEach((l, i) =>
      wrap(ctx, l, 8, y0 + cellH / 2 - (label.length - 1) * 8 + i * 16, labelW - 14),
    );
  });
  return { w: sheetEl.width, h: sheetEl.height, note: title };
}

/** Text clipped to `w` px (the label column is narrow). */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number): void {
  let t = text;
  while (t.length > 4 && ctx.measureText(t).width > w) t = t.slice(0, -2);
  ctx.fillText(t === text ? t : `${t}…`, x, y);
}

window.__tech = {
  ready: (async () => {
    const slalom = createGame({ seed, mode: "slalom", rivals: 0, quiet: true }).level;
    courses = { slalom, piste: slalom.slalom!.base };
  })(),
  async run() {
    let loaded: Course | null = null;
    for (const row of rows) {
      if (loaded !== row.course) {
        const first = gameOf(row);
        await renderer.load(first);
        renderer.setSky({ weather: "clear", hour: hourAt(first.level, 25 * DEG) });
        loaded = row.course;
      }
      drawn.push(await shootRow(row));
      await new Promise((done) => setTimeout(done, 0));
    }
    return drawn.map((d) => ({ technique: d.row.technique, end: d.end, turn: d.turn }));
  },
  sheet(name) {
    if (name === "behind") {
      return gridSheet(
        `TECHNIQUE · BEHIND · seed ${seed} · a TV lens up the course behind him through one turn · ${tier}`,
        ["transition", "edge set (half the peak)", "apex (the peak edge)", "exit"],
        (d) => d.behind,
      );
    }
    if (name === "side") {
      return gridSheet(
        `TECHNIQUE · SIDE · seed ${seed} · the apex from his outside, the front and his inside · ${tier}`,
        ["from his outside", "from the front", "from his inside"],
        (d) => d.side,
      );
    }
    const head = [
      `TECHNIQUE · PATH · seed ${seed} · from straight above, the start of the stretch at the top`,
      `the skier strobed every ${strobe} s · yellow his centre of gravity · white where he faces`,
      "rings the turning poles in their colour · a magenta cross the apex the other sheets show",
    ];
    const headH = 18 + head.length * 14 + 20;
    const footH = 40;
    const gapW = 8;
    const ctx = layout(Math.max(720, drawn.length * (pathW + gapW) + gapW), headH + pathH + footH);
    head.forEach((l, i) => ctx.fillText(l, 8, 10 + i * 14));
    drawn.forEach((d, i) => {
      const x0 = gapW + i * (pathW + gapW);
      ctx.fillStyle = "#e8eef4";
      wrap(ctx, rowTitle(d.row), x0, headH - 12, pathW);
      ctx.drawImage(d.path, x0, headH);
      ctx.fillStyle = "#9fb0c0";
      d.pathNote.forEach((l, j) => wrap(ctx, l, x0, headH + pathH + 12 + j * 14, pathW));
    });
    return { w: sheetEl.width, h: sheetEl.height, note: "path" };
  },
};
