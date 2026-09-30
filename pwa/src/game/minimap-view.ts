// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT STANDS ON THE MINIMAP, AND HOW THE MAP IS TURNED — the payload the
// HUD's round plate is drawn from (`minimap.tsx`), DOM-free like every HUD
// payload here, so `tests/minimap_test.ts` reads it without a browser.
//
// The plate is a window of the map `span` metres across with the skier at
// its middle, HEADING-UP: the map turns about him so what is ahead of the
// skis is up the plate, and a bend the skier sees going left on the snow
// goes left on the map. The ground under it is one picture of the whole map
// baked once (`minimap-bake.ts`); everything here is either a pose for that
// picture or a mark laid over it.
//
// THE SIGNS. Heading 0 is +z and grows clockwise from above, and the chase
// camera sees engine +x on its LEFT when facing +z (three.js is right-handed
// and the renderer takes the engine's axes as they are — `input-model.ts`'s
// `SCREEN_TO_ENGINE` is the same fact at the thumbs). So the map is the
// world turned by the heading plus half a turn, with no mirror: on screen,
// `rotate(heading + 180°)` of the world's own (x, z) — CSS's rotate turns
// clockwise with y down, and at heading 0 that puts +z up and +x left,
// which is what the skier is looking at.
//
// What moves is posed rather than re-cut: the picture and the vectors live
// in one world-space group whose transform is the pose, and the group is
// what the CSS tweens between two snapshots. Only the rim's chevron lives
// in the plate's own space, because it is pinned to the rim however the
// world is turned.

import { angleDiff, type GameState, type Level } from "@engine";

/** The plate's own square user space. */
export const VIEW = 100;

/** How far inside the plate's circle a chevron rides, view units — clear of
 * the rim's own stroke. */
const RIM = 8;

/** HOW MUCH MAP THE WINDOW HOLDS, m edge to edge, and how it breathes with
 * the speedo — game3's rule, restated for snow: what the plate owes the
 * skier is a steady amount of WARNING, and warning is time. At a crawl in
 * the woods the window closes to the next few bends; flat out it opens to
 * half a kilometre of the piste. `at` is the speed it is fully open at, a
 * little under a tuck's top, so it is open at race pace rather than only
 * flat out. */
export const ZOOM = { close: 240, far: 560, at: 105 };

/** How long the window takes to follow the speedo, s of e-folding. The
 * speedo is `|v|` with the vertical in it, and it jumps at every mogul; the
 * zoom is for the difference between creeping and racing, which takes
 * seconds. */
const ZOOM_LAG = 0.6;

/** The window for a speed, m. */
export function spanFor(speedKmh: number): number {
  const t = Math.min(1, Math.max(0, speedKmh / ZOOM.at));
  return ZOOM.close + (ZOOM.far - ZOOM.close) * t;
}

/** The mark on the plate at a size a skier reads: a dot of this many view
 * units whatever the zoom, so it is carried into the world group divided by
 * the scale. */
const DOT = 3.4;

/** The piste's stroke, view units at least — a piste twenty metres wide in
 * a window half a kilometre across is a hair, and the piste is the thing the
 * map is for. The world's own width is used when it is wider. */
const TRACK_MIN = 3.2;

/** How many of the piste's 2 m points go into the drawn line. Every fourth
 * is a point every eight metres — tighter than any bend on the piste and a
 * quarter of the string. */
const TRACK_STRIDE = 4;

/** Where one gate stands on the plate, in WORLD metres: the bar across the
 * piste from one edge to the other, and how the run stands against it.
 * `owed` is the one being skied for; `missed` is the same one when the
 * skier has gone past it, which is when the HUD's arrow is up too. */
export type CheckpointMark = {
  index: number;
  a: [number, number];
  b: [number, number];
  state: "owed" | "missed" | "start" | "other";
};

/** Another skier, where the map has him: the start-line slot names the
 * colour. */
export type SkierMark = { slot: number; x: number; z: number };

/** The owed gate once it is off the plate: a point on the rim and the way
 * to it, degrees clockwise from up-plate. */
export type MinimapChevron = { x: number; y: number; angle: number; missed: boolean };

export type HudMinimap = {
  /** The map the picture under all this is of — the one reference in the
   * snapshot, because the picture is keyed by it (`minimap.tsx`). */
  level: Level;
  /** The world group's pose: the skier's world point is laid at the
   * plate's middle, the world turned by `angle` degrees (continuous — see
   * `angleNow`) and scaled by `scale` view units per metre. */
  pose: { x: number; z: number; angle: number; scale: number };
  /** The piste's centreline in world metres, one OPEN path from the start
   * line to the finish, cut once per map. */
  track: string;
  /** Its stroke, m. */
  trackWidth: number;
  checkpoints: CheckpointMark[];
  /** The field, in world metres. */
  rivals: SkierMark[];
  /** A skier dot's radius in world metres at this zoom. */
  dot: number;
  chevron: MinimapChevron | null;
};

/** The zoom where it has got to, and the turn: frame state keyed by the map
 * and the ENGINE's clock, so neither runs while the pause card holds the
 * race, and a clock gone backwards (a new race on the same map) lands
 * rather than slides. */
let held: { level: Level; t: number; span: number; angle: number } | null = null;

/** The window this snapshot shows, m — `spanFor`'s answer, chased. */
function spanNow(level: Level, speedKmh: number, t: number): number {
  const want = spanFor(speedKmh);
  if (held === null || held.level !== level || t < held.t) return want;
  const dt = Math.min(1, t - held.t);
  return held.span + (want - held.span) * (1 - Math.exp(-dt / ZOOM_LAG));
}

/** THE TURN, degrees, kept CONTINUOUS from one snapshot to the next. The
 * plate is tweened between snapshots, and a tween from 179° to −179° goes
 * the long way round — a whole spin of the map every time the skier's
 * heading crosses south. So each turn is the last one plus the shortest
 * difference to the new heading, and the number is allowed to grow. */
function angleNow(level: Level, heading: number, t: number): number {
  const want = ((heading + Math.PI) * 180) / Math.PI;
  if (held === null || held.level !== level || t < held.t) return want;
  const last = (held.angle * Math.PI) / 180;
  return held.angle + (angleDiff(last, (want * Math.PI) / 180) * 180) / Math.PI;
}

/** A world point on the plate, view units — the pose applied by hand, for
 * the one mark that is not drawn inside the group (and for the tests). */
export function project(pose: HudMinimap["pose"], x: number, z: number): [number, number] {
  const a = (pose.angle * Math.PI) / 180;
  const dx = (x - pose.x) * pose.scale;
  const dz = (z - pose.z) * pose.scale;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [VIEW / 2 + dx * c - dz * s, VIEW / 2 + dx * s + dz * c];
}

/** The piste's line, cut once per map. */
let trackOf: { level: Level; d: string; width: number } | null = null;

function trackLine(level: Level): { d: string; width: number } {
  if (trackOf?.level === level) return trackOf;
  const pts = level.track.points;
  let d = "";
  let width = 0;
  for (let i = 0; i < pts.length; i += TRACK_STRIDE) {
    d += `${i === 0 ? "M" : "L"}${pts[i].x.toFixed(1)} ${pts[i].z.toFixed(1)}`;
    width += pts[i].width;
  }
  // The last point always, so the line reaches the finish whatever the
  // stride; and never closed — a piste ends where it ends.
  const last = pts[pts.length - 1];
  if ((pts.length - 1) % TRACK_STRIDE !== 0) d += `L${last.x.toFixed(1)} ${last.z.toFixed(1)}`;
  trackOf = { level, d, width: width / Math.ceil(pts.length / TRACK_STRIDE) };
  return trackOf;
}

/** Which gate the run owes, or null once the finish is crossed — and on a
 * free ride, which owes none. */
function owedOf(state: GameState): number | null {
  return state.progress.finished || !state.rules.course ? null : state.progress.nextCheckpoint;
}

function checkpointMarks(state: GameState): CheckpointMark[] {
  // A free ride's plate is the mountain and the piste down it: a gate
  // nothing counts is not a mark worth the skier's eye.
  if (!state.rules.course) return [];
  const owed = owedOf(state);
  const missed = state.progress.missed;
  return state.level.checkpoints.map((cp, index) => {
    // The bar is square to the piste: the heading's own right-hand side is
    // (cos h, −sin h) in (x, z) for heading-from-+z-clockwise.
    const hx = (Math.cos(cp.heading) * cp.width) / 2;
    const hz = (-Math.sin(cp.heading) * cp.width) / 2;
    return {
      index,
      a: [cp.x - hx, cp.z - hz],
      b: [cp.x + hx, cp.z + hz],
      state:
        index === owed ? (missed === index ? "missed" : "owed") : index === 0 ? "start" : "other",
    };
  });
}

/** The owed gate, once it is off the plate; null while the plate shows it
 * (the bar carries it then) and after the finish. */
function chevronFor(state: GameState, pose: HudMinimap["pose"]): MinimapChevron | null {
  const owed = owedOf(state);
  if (owed === null) return null;
  const cp = state.level.checkpoints[owed];
  const [x, y] = project(pose, cp.x, cp.z);
  const dx = x - VIEW / 2;
  const dy = y - VIEW / 2;
  const dist = Math.hypot(dx, dy);
  const inner = VIEW / 2 - RIM;
  if (dist <= inner) return null;
  return {
    x: VIEW / 2 + (dx / dist) * inner,
    y: VIEW / 2 + (dy / dist) * inner,
    angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
    missed: state.progress.missed === owed,
  };
}

/** The HUD's minimap for this snapshot. */
export function buildMinimap(state: GameState): HudMinimap {
  const { level, skier } = state;
  const span = spanNow(level, skier.speed * 3.6, state.t);
  const angle = angleNow(level, skier.heading, state.t);
  held = { level, t: state.t, span, angle };
  const scale = VIEW / span;
  const pose = { x: skier.x, z: skier.z, angle, scale };
  const track = trackLine(level);
  return {
    level,
    pose,
    track: track.d,
    trackWidth: Math.max(track.width, TRACK_MIN / scale),
    checkpoints: checkpointMarks(state),
    rivals: state.rivals.map((r) => ({ slot: r.id + 1, x: r.run.skier.x, z: r.run.skier.z })),
    dot: DOT / scale,
    chevron: chevronFor(state, pose),
  };
}
