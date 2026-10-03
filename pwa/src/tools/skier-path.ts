// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB's PATH SHEET (`make skier ARGS=--sheet=path`): WHERE A MOVE
// TAKES HIM, drawn on the snow. A skate stride, a double pole, a start —
// the frame strips show the body, and none of them shows whether the body
// goes where his skis point. This sheet does, a move an image
// (previews/skier-path-<move>.png):
//
//   plan     straight down, the whole run as a multiple exposure — the
//            skier strobed every `STROBE` s or `SPACING` m — with his centre of gravity's
//            PATH as a yellow line on the snow, a white tick each strobe
//            where his body faces, and each ski's footprints (left blue,
//            right orange) where it stands on the snow
//   behind   the same exposure from behind and above, along the run
//   frames   the lab's shots from behind and above, the line under him
//
// and the numbers that say it (`pathStats`, printed too): how far the way
// he goes is off the way he faces (`drift`), how far off the GLIDING
// ski's line while he skates (`glide` — a skater rides the ski he has
// stepped onto, so this is the one that should be near nought), how far
// the path sways across the run's own line, the V the skis open, and the
// strides a second. Read by the skier lab's page (`skier-harness.ts`),
// which hands in its own renderer, scene and posing.

import * as THREE from "three";
import { TUNING, angleDiff, type SkierState, type TrickPose } from "@engine";

import { gaitOf } from "../game/skier-pose.ts";

type Frame = {
  t: number;
  skier: SkierState;
  trick: TrickPose | null;
  ground: [number, number, number, number];
  waiting?: boolean;
};
type Move = { id: string; title: string; frames: Frame[]; shots: number[] };
type Drawn = { rows: number; cols: number; note: string; table?: string[] };

/** What the sheet borrows from the page that draws it. */
export type PathHost = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Pose the skier at a frame `dt` s after the last; where to aim. */
  poseAt(f: Frame, dt: number): { centre: THREE.Vector3; heading: number };
  layout(rows: number, cols: number, w?: number, h?: number): { w: number; h: number; top: number };
  label(text: string, x: number, y: number, title?: boolean): void;
  cell: number;
};

/** The plan's exposures: every `STROBE` s at least, and far enough apart
 * that one skier does not stand on the last — `SPACING` m of run. */
const STROBE = 0.25;
const SPACING = 1.3;
/** How much snow the plan shows either side of the run's line, m. */
const ACROSS = 2.2;
/** The tallest sheet the lab's page photographs, px (`skier-preview.mjs`'s
 * viewport). */
const PAGE_H = 2600;
/** The line's colours and widths, m: the centre of gravity's, the feet's,
 * and the facing ticks (their length too). */
const LINE = { cog: 0xffc400, left: 0x2f7bff, right: 0xff7a1a, tick: 0xffffff };
const WIDTH = { cog: 0.07, foot: 0.035, tick: 0.035, tickLength: 0.6 };
/** A foot is on the snow while its gait lifts it less than this, m. */
const ON_SNOW = 0.02;

/** Where each foot is, in the world, as the gait draws it: a stance apart,
 * out along the skate's V and slid fore and aft, off the CoG on the
 * heading's own frame. */
function feetOf(c: SkierState, gait: ReturnType<typeof gaitOf>): [number, number][] {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  return [-1, 1].map((side, i) => {
    const x = (side * c.spec.stance) / 2 + gait.out[i];
    const z = gait.fore[i];
    return [c.x + fz * x + fx * z, c.z - fx * x + fz * z];
  });
}

/** THE NUMBERS: over the frames on the snow, the mean angle between the
 * way he goes and the way he faces (`drift`), and — gliding on a skate,
 * after the push — between the way he goes and the gliding ski
 * (`glide`), deg; the path's sway across the chord from the first frame
 * to the last, peak to peak, m; the V each ski opens off his line, deg;
 * strides a second; the mean speed, km/h. */
export function pathStats(frames: readonly Frame[]): {
  drift: number;
  glide: number;
  sway: number;
  vee: number;
  rate: number;
  kmh: number;
} {
  const on = frames.filter((f) => !f.skier.airborne && f.skier.thrown === null);
  if (on.length < 2) return { drift: 0, glide: 0, sway: 0, vee: 0, rate: 0, kmh: 0 };
  let drift = 0;
  let glide = 0;
  let glides = 0;
  let vee = 0;
  let vees = 0;
  let kmh = 0;
  for (const f of on) {
    const c = f.skier;
    const way = Math.atan2(c.vx, c.vz);
    drift += Math.abs(angleDiff(way, c.heading));
    kmh += c.speed * 3.6;
    const gait = gaitOf(c);
    if (gait.skate > 0.3) {
      vee += Math.abs(gait.splay[0] - gait.splay[1]) / 2;
      vees += 1;
      if (gait.phase >= TUNING.poles.duty) {
        const ski = c.heading + c.skiAngle + gait.splay[1 - gait.push];
        glide += Math.abs(angleDiff(way, ski));
        glides += 1;
      }
    }
  }
  const a = on[0].skier;
  const b = on[on.length - 1].skier;
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const across = on.map(
    (f) => ((f.skier.x - a.x) * (b.z - a.z) - (f.skier.z - a.z) * (b.x - a.x)) / len,
  );
  const deg = 180 / Math.PI;
  return {
    drift: (drift / on.length) * deg,
    glide: glides ? (glide / glides) * deg : 0,
    sway: Math.max(...across) - Math.min(...across),
    vee: vees ? (vee / vees) * deg : 0,
    rate: (b.stride - a.stride) / Math.max(1e-6, on[on.length - 1].t - on[0].t),
    kmh: kmh / on.length,
  };
}

/** A flat strip `width` m wide along `pts` (x, y, z), a whisker over the
 * snow, broken wherever `pts` holds a null. */
function strip(
  pts: ([number, number, number] | null)[],
  width: number,
  colour: number,
): THREE.Mesh {
  const pos: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    if (!p || !q) continue;
    const dx = q[0] - p[0];
    const dz = q[2] - p[2];
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) continue;
    const nx = (-dz / l) * (width / 2);
    const nz = (dx / l) * (width / 2);
    const lift = 0.012;
    const a = [p[0] - nx, p[1] + lift, p[2] - nz];
    const b = [p[0] + nx, p[1] + lift, p[2] + nz];
    const c = [q[0] - nx, q[1] + lift, q[2] - nz];
    const d = [q[0] + nx, q[1] + lift, q[2] + nz];
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  return new THREE.Mesh(geo, mat);
}

/** The snow's height under a frame's skier at (x, z), off the plane the
 * frame recorded. */
function groundAt(f: Frame, x: number, z: number): number {
  const [gy, nx, ny, nz] = f.ground;
  return gy - (nx * (x - f.skier.x) + nz * (z - f.skier.z)) / ny;
}

export function drawPath(h: PathHost, move: Move): Drawn {
  const { renderer, scene } = h;
  const frames = move.frames;
  const on = frames.filter((f) => !f.skier.thrown);
  const pace = on.reduce((sum, f) => sum + f.skier.speed, 0) / on.length;
  const every = Math.max(STROBE, SPACING / Math.max(0.5, pace));
  // THE LINES, laid on the snow for the sheet and taken up after.
  const cog: ([number, number, number] | null)[] = [];
  const feet: ([number, number, number] | null)[][] = [[], []];
  const ticks = new THREE.Group();
  let nextTick = 0;
  for (const f of frames) {
    const c = f.skier;
    const on = !c.airborne && c.thrown === null;
    cog.push(on ? [c.x, groundAt(f, c.x, c.z), c.z] : null);
    const gait = gaitOf(c);
    feetOf(c, gait).forEach(([x, z], i) => {
      feet[i].push(on && gait.lift[i] < ON_SNOW ? [x, groundAt(f, x, z), z] : null);
    });
    if (on && f.t >= nextTick) {
      nextTick = f.t + every;
      const y = groundAt(f, c.x, c.z);
      const l = WIDTH.tickLength;
      ticks.add(
        strip(
          [
            [c.x, y, c.z],
            [c.x + Math.sin(c.heading) * l, y, c.z + Math.cos(c.heading) * l],
          ],
          WIDTH.tick,
          LINE.tick,
        ),
      );
    }
  }
  const lines = new THREE.Group();
  lines.add(
    strip(feet[0], WIDTH.foot, LINE.left),
    strip(feet[1], WIDTH.foot, LINE.right),
    strip(cog, WIDTH.cog, LINE.cog),
    ticks,
  );
  scene.add(lines);

  // THE FRAME the run is drawn in: along the chord from where he starts to
  // where he ends, the plan wide enough for all of it.
  const a = on[0].skier;
  const b = on[on.length - 1].skier;
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  const fx = run > 0.5 ? (b.x - a.x) / run : Math.sin(a.heading);
  const fz = run > 0.5 ? (b.z - a.z) / run : Math.cos(a.heading);
  // A TURN bends the line off the chord: the plan is centred on the whole
  // of it, as seen along and across the chord, and as wide as it reaches.
  let lo = { along: Infinity, across: Infinity };
  let hi = { along: -Infinity, across: -Infinity };
  for (const f of on) {
    const along = (f.skier.x - a.x) * fx + (f.skier.z - a.z) * fz;
    const across = (f.skier.x - a.x) * fz - (f.skier.z - a.z) * fx;
    lo = { along: Math.min(lo.along, along), across: Math.min(lo.across, across) };
    hi = { along: Math.max(hi.along, along), across: Math.max(hi.across, across) };
  }
  const cAlong = (lo.along + hi.along) / 2;
  const cAcross = (lo.across + hi.across) / 2;
  const cx = a.x + fx * cAlong + fz * cAcross;
  const cz = a.z + fz * cAlong - fx * cAcross;
  const mid = new THREE.Vector3(cx, groundAt(on[0], a.x, a.z), cz);

  const cols = Math.max(move.shots.length, 6);
  const sheetW = cols * h.cell;
  // Straight down, the run left to right, `ACROSS` m of snow either side of
  // the run's line — the sheet as tall as that is at the run's scale, and
  // tall enough for all of a line that turns.
  // (Never taller than the page holds: a line turned right round widens
  // the plan's reach along instead.)
  const across = Math.max(ACROSS, (hi.across - lo.across) / 2 + ACROSS);
  const shotH = h.cell;
  const tallest = Math.round((PAGE_H - shotH) / 2.2);
  let half = Math.max((hi.along - lo.along) / 2 + 2, 4);
  half = Math.max(half, (sheetW * across) / tallest);
  const planH = Math.max(Math.round(h.cell * 1.1), Math.round((sheetW * across) / half));
  const { top } = h.layout(1, 1, sheetW, planH * 2 + shotH);
  const fullH = planH * 2 + shotH + top;
  const plan = new THREE.OrthographicCamera(
    -half,
    half,
    (half * planH) / sheetW,
    (-half * planH) / sheetW,
    0.1,
    100,
  );
  plan.position.set(mid.x, mid.y + 30, mid.z);
  // The lens's up is the run's left, so the run goes left to right.
  plan.up.set(-fz, 0, fx);
  plan.lookAt(mid);
  plan.updateProjectionMatrix();
  // From behind, above and off to his right, the first strides of the run
  // close, so the exposures stand apart rather than in a file.
  const behind = new THREE.PerspectiveCamera(40, sheetW / planH, 0.1, 400);
  behind.position.set(a.x - fx * 4 + fz * 2.5, mid.y + 3.4, a.z - fz * 4 - fx * 2.5);
  behind.lookAt(a.x + fx * 8, mid.y, a.z + fz * 8);
  behind.updateProjectionMatrix();
  const close = new THREE.PerspectiveCamera(40, h.cell / shotH, 0.1, 200);

  // Cells counted from the canvas's foot, as the viewport is.
  const planY = fullH - top - planH;
  const behindY = planY - planH;
  const cellAt = (x: number, y: number, w: number, hh: number, clear: number | null): void => {
    renderer.setViewport(x, y, w, hh);
    renderer.setScissor(x, y, w, hh);
    if (clear !== null) {
      renderer.setClearColor(clear);
      renderer.clear();
    }
  };
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  cellAt(0, planY, sheetW, planH, 0x51606f);
  cellAt(0, behindY, sheetW, planH, 0x5b6a79);
  // THE EXPOSURES: his legs' spring stepped through every frame, a strobe
  // drawn into both exposures without clearing them, a shot into its own
  // cell. The depth is kept between exposures, so each skier stands in
  // front of the snow and the line.
  let nextStrobe = 0;
  frames.forEach((f, i) => {
    const posed = h.poseAt(f, i > 0 ? f.t - frames[i - 1].t : 0);
    if (f.t >= nextStrobe && !f.skier.thrown) {
      nextStrobe = f.t + every;
      cellAt(0, planY, sheetW, planH, null);
      renderer.render(scene, plan);
      cellAt(0, behindY, sheetW, planH, null);
      renderer.render(scene, behind);
    }
    const col = move.shots.indexOf(i);
    if (col >= 0) {
      const c = posed.centre;
      const hx = Math.sin(posed.heading);
      const hz = Math.cos(posed.heading);
      close.position.set(c.x - hx * 3, c.y + 2.2, c.z - hz * 3);
      close.lookAt(c.x + hx * 0.6, c.y - 0.45, c.z + hz * 0.6);
      close.updateProjectionMatrix();
      cellAt(col * h.cell, 0, h.cell, shotH, col % 2 ? 0x51606f : 0x5b6a79);
      renderer.clearDepth();
      renderer.render(scene, close);
      const g = gaitOf(f.skier);
      const what = g.skate > 0.3 ? "skate" : g.pole > 0.3 ? "pole" : g.stride > 0.3 ? "stride" : "";
      h.label(
        `${f.t.toFixed(2)} s · ${Math.round(f.skier.speed * 3.6)} km/h ${what}`,
        col * h.cell,
        top + planH * 2,
      );
    }
  });
  renderer.autoClear = auto;
  scene.remove(lines);
  lines.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });

  const s = pathStats(move.frames.filter((f) => f.t >= move.frames[move.shots[0]].t));
  const line =
    `${move.id}: drift ${s.drift.toFixed(1)}° · glide ${s.glide.toFixed(1)}° · ` +
    `sway ${s.sway.toFixed(2)} m · V ${s.vee.toFixed(1)}° · ${s.rate.toFixed(2)} strides/s · ${s.kmh.toFixed(1)} km/h`;
  h.label(`path — ${move.title} · ${line}`, 0, 0, true);
  h.label(
    `plan: yellow his centre of gravity, white where he faces at each exposure, blue/orange each foot on the snow`,
    0,
    top,
  );
  h.label("behind and above, the same exposures — the first strides", 0, top + planH);
  return { rows: 3, cols, note: move.title, table: [line] };
}
