// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB's FILM SCORE (driven by `snow-eval-harness.ts`): each
// of the scenes a film reference was read for (`spray-film.ts`: the carve,
// the ski hockey stop, the board's heelside and toeside stops, the powder
// turn) ridden from the reference's own speed and photographed at six
// moments from a lens set SIDE-ON to the throw — square across the way the
// drawn snow went — with the film's envelope dashed amber over the game's
// solid cyan, and every moment scored against the film (100 the film
// exactly, about 50 every number a factor of two off).
//
// What is measured is what the GPU draws (`renderer.plumes()`), and only
// the snow THIS manoeuvre threw: a bit older than the manoeuvre is left out
// (`bornSince`) — and on a carve older than the turn it is in, so a carve's
// earlier turns hanging on the line behind do not count as this one's.

import { step, type GameState, type SkierInput } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { createWorldRenderer } from "../game/renderer.ts";
import {
  bornSince,
  type PlumeBit,
  FILM,
  filmAt,
  frameScore,
  plumeOf,
  type FilmFrame,
  type FilmMove,
  type Plume,
} from "../game/spray-film.ts";

type Renderer = ReturnType<typeof createWorldRenderer>;

/** One scene's run as the harness stands it up: the state at the start and
 * the input that rides it at `t` s into the manoeuvre. */
export type FilmRun = {
  state: GameState;
  input: (state: GameState, t: number) => SkierInput;
};

/** A scene the film measures: its harness id and the reference it is
 * scored against. */
export type FilmScene = { id: string; move: FilmMove };

/** The eval scenes a film reference was read for. */
export const FILM_SCENES: readonly FilmScene[] = [
  { id: "carve", move: "carve" },
  { id: "hockey", move: "stop" },
  { id: "board-heel", move: "boardHeel" },
  { id: "board-toe", move: "boardToe" },
  { id: "powder", move: "powder" },
];

/** The moments measured, s into the manoeuvre. */
export const FILM_TIMES = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4];

export type FilmCell = {
  scene: string;
  light: string;
  move: FilmMove;
  t: number;
  /** The window of snow counted, s: the manoeuvre's age, or the turn's. */
  window: number;
  game: Plume;
  film: FilmFrame;
  score: number;
  /** WHICH WAY THE SNOW WENT, degrees: the drawn plume's mean way along the
   * snow off the way the rider was going when the manoeuvre began (0 the
   * spray thrown straight ahead of him, 90 square to his side), and off
   * the fall line (0 straight down the slope). */
  toTravel: number;
  toFall: number;
  /** WHICH WAY IT WAS THROWN, degrees: each drawn bit's way from where the
   * rider was when it was born (its age read back), weighed as the plume
   * is — the throw itself, which the rider sliding on past his own snow
   * does not turn round — off the travel and off the fall line. */
  throwTravel: number;
  throwFall: number;
};

/** Where the rider was, s into the manoeuvre. */
type Track = { t: number; x: number; z: number }[];

/** The drawn snow's mean way along the snow from where the rider was when
 * each bit was born (a unit vector), weighed by how much of it is seen;
 * null when nothing is. */
export function thrownWay(
  bits: readonly PlumeBit[],
  track: Track,
  now: number,
): { x: number; z: number } | null {
  let wx = 0;
  let wz = 0;
  for (const b of bits) {
    if (b.a < 0.03 || b.r <= 0 || b.age === undefined) continue;
    const born = now - b.age;
    // The track point at the bit's birth (the track is in time order).
    let k = track.length - 1;
    while (k > 0 && track[k].t > born) k--;
    const dx = b.x - track[k].x;
    const dz = b.z - track[k].z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) continue;
    const seen = b.a * b.r * b.r;
    wx += (dx / d) * seen;
    wz += (dz / d) * seen;
  }
  const l = Math.hypot(wx, wz);
  return l > 0 ? { x: wx / l, z: wz / l } : null;
}

const DEG = Math.PI / 180;
const FRAME = 1 / 60;

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

export type FilmSheetOptions = {
  renderer: Renderer;
  stage: HTMLCanvasElement;
  groundAt: (x: number, z: number) => number;
  /** The fall line at a point: a unit vector on the snow, downhill. */
  fallAt: (x: number, z: number) => { x: number; z: number };
  cellW: number;
  cellH: number;
  /** Stand a scene up for a light (its sky already set). */
  begin(scene: FilmScene, kmh: number): Promise<FilmRun>;
  /** Set a light by name; returns its caption. */
  light(name: string): string;
};

/**
 * Ride every film scene under every light, a row each, its moments the
 * columns, and score each moment. Draws onto `ctx` from (`labelW`, `headH`).
 */
export async function filmSheet(
  ctx: CanvasRenderingContext2D,
  o: FilmSheetOptions,
  scenes: readonly FilmScene[],
  lights: readonly string[],
  labelW: number,
  headH: number,
): Promise<FilmCell[]> {
  const { renderer, stage, groundAt, cellW, cellH } = o;
  const cells: FilmCell[] = [];
  const sideLens = (s: { x: number; z: number }, way: { x: number; z: number }, far: number) => {
    // Across the throw, the lens on its right-hand side.
    const ax = way.z;
    const az = -way.x;
    const mid = { x: s.x + way.x * 1.2, z: s.z + way.z * 1.2 };
    const ex = mid.x + ax * far;
    const ez = mid.z + az * far;
    return {
      eye: { x: ex, y: groundAt(ex, ez) + 1.3, z: ez },
      target: { x: mid.x, y: groundAt(mid.x, mid.z) + 0.7, z: mid.z },
      fov: 46,
      roll: 0,
    } satisfies LensPose;
  };
  const box = (
    project: ReturnType<typeof projector>,
    s: { x: number; z: number },
    way: { x: number; z: number },
    f: FilmFrame,
    x0: number,
    y0: number,
    colour: string,
    dashed: boolean,
  ) => {
    const at = (d: number, h: number) => {
      const x = s.x + way.x * d;
      const z = s.z + way.z * d;
      return project({ x, y: groundAt(x, z) + h, z });
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
  };
  const label = (lines: string[], x0: number, y0: number) => {
    ctx.fillStyle = "rgba(11,17,22,0.72)";
    ctx.fillRect(x0, y0 + cellH - 14 - 15 * lines.length, cellW, 14 + 15 * lines.length);
    ctx.fillStyle = "#e8eef4";
    lines.forEach((l, i) => ctx.fillText(l, x0 + 6, y0 + cellH - 4 - 15 * (lines.length - i)));
  };

  let row = 0;
  for (const scene of scenes) {
    const film = FILM[scene.move];
    for (const light of lights) {
      const caption = o.light(light);
      const run = await o.begin(scene, film.kmh);
      const state = run.state;
      const t0 = state.t;
      const travel = { x: Math.sin(state.skier.heading), z: Math.cos(state.skier.heading) };
      const fall = o.fallAt(state.skier.x, state.skier.z);
      const angle = (a: { x: number; z: number }, b: { x: number; z: number }) =>
        (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z))) * 180) / Math.PI;
      // The turn a carve is in: from the last time its edge changed side.
      let turnAt = 0;
      let side = Math.sign(state.skier.edge);
      const track: Track = [{ t: 0, x: state.skier.x, z: state.skier.z }];
      const y0 = headH + row * cellH;
      let sum = 0;
      for (let c = 0; c < FILM_TIMES.length; c++) {
        const t = FILM_TIMES[c];
        while (state.t - t0 < t) {
          for (let i = 0; i < 2; i++) step(state, run.input(state, state.t - t0));
          const now = Math.sign(state.skier.edge);
          if (now !== 0 && now !== side) {
            side = now;
            turnAt = state.t - t0;
          }
          track.push({ t: state.t - t0, x: state.skier.x, z: state.skier.z });
          renderer.draw(state, 0, FRAME, false);
        }
        const s = state.skier;
        const window = scene.move === "carve" ? Math.max(0.3, t - turnAt) : t;
        const measure = (view: { x: number; z: number }) =>
          plumeOf(bornSince(renderer.plumes(), window), groundAt, s.x, s.z, view, t);
        // The throw's way first, then the lens square across it.
        const rough = measure({ x: Math.sin(s.heading), z: Math.cos(s.heading) });
        const way =
          rough.bits > 0 && Math.hypot(rough.wayX, rough.wayZ) > 0.5
            ? { x: rough.wayX, z: rough.wayZ }
            : { x: -Math.sin(s.heading), z: -Math.cos(s.heading) };
        const ref = filmAt(scene.move, t);
        const lens = sideLens(s, way, Math.max(5, ref.reach * 1.6 + 2.5));
        renderer.setOverride(lens);
        renderer.draw(state, 0, 0, true);
        const game = measure({ x: -way.z, z: way.x });
        const score = frameScore(game, ref);
        sum += score;
        const thrown = { x: game.wayX, z: game.wayZ };
        const went = thrownWay(bornSince(renderer.plumes(), window), track, state.t - t0);
        cells.push({
          scene: scene.id,
          light,
          move: scene.move,
          t,
          window,
          game,
          film: ref,
          score,
          toTravel: game.bits ? angle(thrown, travel) : NaN,
          toFall: game.bits ? angle(thrown, fall) : NaN,
          throwTravel: went ? angle(went, travel) : NaN,
          throwFall: went ? angle(went, fall) : NaN,
        });
        const x0 = labelW + c * cellW;
        ctx.drawImage(stage, x0, y0, cellW, cellH);
        const project = projector(lens, cellW / cellH);
        box(project, s, way, ref, x0, y0, "#ffb347", true);
        box(project, s, way, game, x0, y0, "#5fd3ff", false);
        label(
          [
            `${t.toFixed(1)} s · ${(s.speed * 3.6).toFixed(0)} km/h · score ${score.toFixed(0)} · plume ${cells[cells.length - 1].toTravel.toFixed(0)}°/${cells[cells.length - 1].toFall.toFixed(0)}° · throw ${cells[cells.length - 1].throwTravel.toFixed(0)}°/${cells[cells.length - 1].throwFall.toFixed(0)}° off travel/fall`,
            `top ${game.top.toFixed(2)}/${ref.top.toFixed(2)} reach ${game.reach.toFixed(1)}/${ref.reach.toFixed(1)} area ${game.area.toFixed(2)}/${ref.area.toFixed(2)}`,
          ],
          x0,
          y0,
        );
        renderer.setOverride(null);
      }
      ctx.fillStyle = "#e8eef4";
      [film.title.toUpperCase(), caption, `mean ${(sum / FILM_TIMES.length).toFixed(0)}`].forEach(
        (l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 16 + i * 16),
      );
      row++;
      await new Promise((done) => setTimeout(done, 0));
    }
  }
  return cells;
}

/** The mean score of each scene under each light, and over all. */
export function filmMeans(cells: readonly FilmCell[]): {
  rows: {
    scene: string;
    light: string;
    mean: number;
    toTravel: number;
    toFall: number;
    throwTravel: number;
    throwFall: number;
  }[];
  overall: number;
} {
  type Sum = {
    scene: string;
    light: string;
    sum: number;
    n: number;
    tr: number;
    fl: number;
    m: number;
    ttr: number;
    tfl: number;
    tm: number;
  };
  const by = new Map<string, Sum>();
  for (const c of cells) {
    const k = `${c.scene}/${c.light}`;
    const r = by.get(k) ?? {
      scene: c.scene,
      light: c.light,
      sum: 0,
      n: 0,
      tr: 0,
      fl: 0,
      m: 0,
      ttr: 0,
      tfl: 0,
      tm: 0,
    };
    if (Number.isFinite(c.throwTravel)) {
      r.ttr += c.throwTravel;
      r.tfl += c.throwFall;
      r.tm++;
    }
    r.sum += c.score;
    r.n++;
    if (Number.isFinite(c.toTravel)) {
      r.tr += c.toTravel;
      r.fl += c.toFall;
      r.m++;
    }
    by.set(k, r);
  }
  const rows = [...by.values()].map((r) => ({
    scene: r.scene,
    light: r.light,
    mean: r.sum / r.n,
    toTravel: r.m ? r.tr / r.m : NaN,
    toFall: r.m ? r.fl / r.m : NaN,
    throwTravel: r.tm ? r.ttr / r.tm : NaN,
    throwFall: r.tm ? r.tfl / r.tm : NaN,
  }));
  const overall = rows.length ? rows.reduce((a, r) => a + r.mean, 0) / rows.length : 0;
  return { rows, overall };
}
