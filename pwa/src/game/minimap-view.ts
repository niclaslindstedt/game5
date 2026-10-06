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

import { angleDiff, type GameState, type Level, type TrackPoint } from "@engine";

import { GRADE_LOOK } from "./grade-look.ts";
import { tunnelPaint, tunnelPointAt, tunnelsOf } from "./wind-tunnel-plan.ts";
import { helipadOf } from "@engine";

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

/** HOW MUCH MAP THE WINDOW HOLDS ALOFT, m: on the helicopter's skid the
 * plate is for getting one's bearings, not for the next bend, so it opens
 * with the hub's height over the snow — `per` metres of window for every
 * metre climbed past `from` (about the hover a landing is flown from), on
 * top of the speedo's widest window, and never wider than the map. At
 * 100 m over the snow that is a kilometre; at 300 m, two. */
export const AIR_ZOOM = { from: 20, per: 6 };

/** The window for a height over the snow, m — 0 below `AIR_ZOOM.from`, so
 * the speedo's window rules on the pad and in a low hover. */
export function airSpanFor(agl: number, mapSize: number): number {
  if (agl <= AIR_ZOOM.from) return 0;
  return Math.min(mapSize, ZOOM.far + (agl - AIR_ZOOM.from) * AIR_ZOOM.per);
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

/** ONE RUN OF THE RESORT (R27) under the raced course, cut once per map:
 * its centreline in world metres, a piste in its grade's paint (CSS) and a
 * transport lane as a light line with no grade to show. */
export type RunMark = { id: string; d: string; road: boolean; paint: string };

/** ONE LIFT (R26): its line from the bottom station to the top, world
 * metres — a lift is straight, so the two ends are the whole of it. */
export type LiftMark = { id: string; a: [number, number]; b: [number, number] };

/** ONE WIND TUNNEL along the valley floor: its line in world metres, its
 * paint (CSS, the colour it is drawn in on the snow), and an ARROW every
 * `TUNNEL_ARROW` m of it pointing the way it blows — at (x, z), turned
 * `angle` degrees clockwise from up-the-world-group, so a chevron path that
 * points up is laid along the lane. */
export type TunnelMark = {
  id: string;
  d: string;
  paint: string;
  arrows: { x: number; z: number; angle: number }[];
};

/** An arrow on a tunnel every this many metres, the first half a gap in. */
export const TUNNEL_ARROW = 70;

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
  /** Every run of the resort, lanes first so the pistes lie over them, and
   * every lift — both cut once per map, and empty on a map that is only
   * its one piste. */
  runs: readonly RunMark[];
  lifts: readonly LiftMark[];
  /** The wind tunnels, each with its arrows; cut once per map. */
  tunnels: readonly TunnelMark[];
  checkpoints: CheckpointMark[];
  /** The field, in world metres. */
  rivals: SkierMark[];
  /** A skier dot's radius in world metres at this zoom. */
  dot: number;
  chevron: MinimapChevron | null;
  /** THE HELICOPTER (`heli.ts`) on a free ride: where it is and where its
   * pad stands, world metres; null on a run with none. */
  heli: { x: number; z: number; pad: { x: number; z: number } } | null;
  /** THE SNOWMOBILE (`sled.ts`) on a free ride, where it was left — null
   * while he rides it (he is the dot) and on a run with none. */
  sled: { x: number; z: number } | null;
};

/** The zoom where it has got to, and the turn: frame state keyed by the map
 * and the ENGINE's clock, so neither runs while the pause card holds the
 * race, and a clock gone backwards (a new race on the same map) lands
 * rather than slides. */
let held: { level: Level; t: number; span: number; angle: number } | null = null;

/** The window this snapshot shows, m — `spanFor`'s answer, chased. */
function spanNow(level: Level, speedKmh: number, agl: number, t: number): number {
  const want = Math.max(spanFor(speedKmh), airSpanFor(agl, level.size));
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

/** A centreline as an SVG path, every `TRACK_STRIDE`th station and the
 * last one always, so the line reaches its end whatever the stride; and
 * never closed — a run ends where it ends. */
function pathOf(pts: readonly TrackPoint[]): string {
  let d = "";
  for (let i = 0; i < pts.length; i += TRACK_STRIDE) {
    d += `${i === 0 ? "M" : "L"}${pts[i].x.toFixed(1)} ${pts[i].z.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  if ((pts.length - 1) % TRACK_STRIDE !== 0) d += `L${last.x.toFixed(1)} ${last.z.toFixed(1)}`;
  return d;
}

function trackLine(level: Level): { d: string; width: number } {
  if (trackOf?.level === level) return trackOf;
  const pts = level.track.points;
  let width = 0;
  for (let i = 0; i < pts.length; i += TRACK_STRIDE) width += pts[i].width;
  trackOf = { level, d: pathOf(pts), width: width / Math.ceil(pts.length / TRACK_STRIDE) };
  return trackOf;
}

/** The resort's runs, lifts and tunnels, cut once per map. */
let resortOf: { level: Level; runs: RunMark[]; lifts: LiftMark[]; tunnels: TunnelMark[] } | null =
  null;

/** A heading (0 is +z, clockwise from above) as the turn, degrees, of a
 * mark drawn pointing UP the world group: the group's up is −z, and
 * `rotate` turns clockwise with y down, so +z is half a turn. */
export function arrowAngle(heading: number): number {
  return 180 - (heading * 180) / Math.PI;
}

/** A tunnel's mark: its line every station and its arrows. */
export function tunnelMarks(level: Level): TunnelMark[] {
  return tunnelsOf(level)
    .filter((t) => t.points.length > 1)
    .map((t, i) => {
      const arrows: TunnelMark["arrows"] = [];
      const gap = Math.min(TUNNEL_ARROW, t.length / 2);
      for (let s = gap / 2; s < t.length; s += gap) {
        const p = tunnelPointAt(t, s);
        arrows.push({ x: p.x, z: p.z, angle: arrowAngle(p.heading) });
      }
      const d = t.points
        .map((p, k) => `${k === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
        .join("");
      return { id: t.id, d, paint: `#${tunnelPaint(i).toString(16).padStart(6, "0")}`, arrows };
    });
}

function resortLines(level: Level): {
  runs: RunMark[];
  lifts: LiftMark[];
  tunnels: TunnelMark[];
} {
  if (resortOf?.level === level) return resortOf;
  const resort = level.resort;
  const runs = (resort?.runs ?? [])
    .filter((r) => r.points.length > 1)
    .map((r) => ({
      id: r.id,
      d: pathOf(r.points),
      road: r.kind === "road",
      paint: GRADE_LOOK[r.grade].paint,
    }))
    .sort((a, b) => Number(b.road) - Number(a.road));
  const lifts = (resort?.lifts ?? []).map((l) => ({
    id: l.id,
    a: [l.bottom.x, l.bottom.z] as [number, number],
    b: [l.top.x, l.top.z] as [number, number],
  }));
  resortOf = { level, runs, lifts, tunnels: tunnelMarks(level) };
  return resortOf;
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
  // Aloft only while he rides it: the machine flown home without him is a
  // mark on the plate, not the lens.
  const agl = state.heli?.rider ? state.heli.agl : 0;
  const span = spanNow(level, skier.speed * 3.6, agl, state.t);
  const angle = angleNow(level, skier.heading, state.t);
  held = { level, t: state.t, span, angle };
  const scale = VIEW / span;
  const pose = { x: skier.x, z: skier.z, angle, scale };
  const track = trackLine(level);
  const resort = resortLines(level);
  return {
    level,
    pose,
    track: track.d,
    trackWidth: Math.max(track.width, TRACK_MIN / scale),
    runs: resort.runs,
    lifts: resort.lifts,
    tunnels: resort.tunnels,
    checkpoints: checkpointMarks(state),
    rivals: state.rivals.map((r) => ({ slot: r.id + 1, x: r.run.skier.x, z: r.run.skier.z })),
    dot: DOT / scale,
    chevron: chevronFor(state, pose),
    heli: state.heli ? { x: state.heli.x, z: state.heli.z, pad: helipadOf(level) } : null,
    sled: state.sled && !state.sled.rider ? { x: state.sled.x, z: state.sled.z } : null,
  };
}
