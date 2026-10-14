// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM CAMERA — the lens the menu's backdrop and a replay's FILM angle
// are seen through: an action film's ski sequence cut live off the run
// (`docs/cinema-camera.md` is the research it is built off). The director
// (`cinema-director.ts`) says which shot and for how long; this module says
// where each lens stands, where it looks and how wide, and keeps it there.
//
// THE SHOTS (`CINEMA`, one row a framing, metres, degrees and seconds):
//
//   establish  the wide aerial: high and far behind, him small on the face.
//   heli       the helicopter tracking alongside, high and on a long lens.
//   chase      the camera skier behind him and off to the side of his spray, hand-held.
//   lead       the camera skier skiing backward ahead of him.
//   boots      down by his boots, the edges and the spray they throw.
//   powder     low in the snow ahead, the powder thrown at the lens.
//   dutch      alongside on a tilted horizon.
//   arc        a slow arc round him — the crawl, the fall, the body lying.
//   hang       the top of a long flight: a lens flown alongside him and a
//              little under him, swinging from behind him to ahead of him.
//   headon     the long lens far down the fall line, the slope compressed
//              behind him as he comes at it; cut before he arrives.
//   rideby     at the snow beside his line: he comes at it and is gone past
//              in a whip pan.
//   lip        beside the kicker's lip, low: the take-off.
//   hero       down by the landing and off to the side, looking UP at him
//              in the air against the sky.
//   crash      off where the blow lands, the zoom crashing in on it.
//
// THE RULES OVER ALL OF THEM are the replay's (`camera-replay.ts`): every
// lens is AIMED AT HIM (the boots' a little under his hips, so the skis are
// in it too), stands over the snow under it, and has the line to him open of
// the slope and the trunks — a follow lens is lifted until it is; a planted
// one is planted only where it is, and given up (`Director.end`) the moment
// the line closes. A follow lens EASES to where it wants to stand; a cut is
// a hard cut. Three-free: a subject in, a `LensPose` out.

import { angleDiff, solidsNear, solidsOf, TUNING, type Level } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, RigPose, Vec3 } from "./camera-rigs.ts";
import {
  createReplayCamera,
  snowBetween,
  subjectOf,
  type ReplayView,
  type ReplayWorld,
  type Subject,
  type ThrownBody,
} from "./camera-replay.ts";
import {
  createDirector,
  DIRECTOR,
  type Director,
  type Framing,
  type Take,
} from "./cinema-director.ts";
import type { ReplayShot } from "./replay-shots.ts";

const HZ = TUNING.physicsHz;

/** THE WHOLE CAMERA, as numbers. In the frame of the way he is going:
 * `back` m behind (negative ahead), `side` m to the take's side, `up` m
 * over his hips or `lift` m over the snow; `fov` deg; `follow` 1/s how
 * fast it eases to where it wants to stand. A planted lens's `width` is
 * the metres of world its zoom holds round him. */
export const CINEMA = {
  /** The wide aerial PUSHES IN over its take: to `push` of its stand and
   * `narrow` deg tighter by its end. */
  establish: { back: 30, side: 16, up: 15, fov: 32, follow: 2.5, push: 0.72, narrow: 5 },
  heli: { back: 5, side: 24, up: 12, fov: 17, follow: 2.5 },
  chase: { back: 4.6, side: 2.2, up: 1.3, fov: 50, follow: 10 },
  lead: { back: -5.2, side: 1, up: 0.9, fov: 50, follow: 6 },
  /** The boots' lens slides `slide` m back along him over the take. */
  boots: { back: -1.6, side: 2.6, lift: 0.35, fov: 50, follow: 9, aimDown: 0.2, slide: 2.4 },
  powder: { back: -6.5, side: 1.3, lift: 0.35, fov: 50, follow: 5 },
  dutch: { back: -0.6, side: 6, up: 0.6, fov: 44, follow: 5, roll: 0.24 },
  arc: { range: 8, up: 2.2, rate: 0.32, fov: 46, follow: 5 },
  /** Alongside him through the hang: `side` m off, `up` m under his hips,
   * from `from` m behind him to `to` m ahead over the take. */
  hang: { side: 4.2, up: -1.1, from: 2.8, to: -2.4, fov: 40, follow: 12 },
  /** Planted where he will be `ahead` s on, `side` m off, `lift` m up,
   * zoomed to hold `width` m of world (the frame's height) round him; cut
   * once he is `leave` m off it. Tight: he fills a third of the frame and
   * more as he comes through. */
  headon: { ahead: 3.2, side: 2, lift: 1.6, width: 5, leave: 14 },
  rideby: { ahead: 1.8, side: 3.6, lift: 0.55, width: 3.4, leave: 40 },
  lip: { past: 2.5, side: 4.5, lift: 0.45, width: 3.6, leave: 40 },
  /** At `share` of the flight's length past the lip, `side` m off his line
   * and low, looking UP at him against the sky — zoomed to hold `width` m,
   * so at the top of the flight he stands a third to half of the frame. */
  hero: { share: 0.75, side: 6, lift: 0.35, width: 4.4, leave: 50 },
  /** THE HAND-HELD LOOK: how much of the camera skier's shake each
   * hand-held framing has, and how much wider the follow lenses open with
   * his speed, deg a m/s past `from` m/s, to `most` deg. */
  handheld: { chase: 1, lead: 1, boots: 0.8, powder: 1.3, hang: 0.6 } as Partial<
    Record<Framing, number>
  >,
  speedFov: { from: 12, per: 0.45, most: 9 },
  /** The crash zoom: from `fovFrom` to `fovTo` over `zoom` s at the blow. */
  crash: { ahead: 7, side: 6, lift: 1.2, fovFrom: 44, fovTo: 17, zoom: 0.35 },
  /** A planted zoom's ends, deg, and the least range it solves for, m. */
  fovMin: 7,
  fovMax: 66,
  near: 3,
  /** How far out each try to plant pushes the lens, m, and how many. */
  push: 2.5,
  pushes: 3,
  /** The CAMERA SKIER's hand on the chase: three slow sines, m and rad. */
  shake: { pos: 0.05, roll: 0.014, hz: [1.3, 2.1, 3.7] as readonly number[] },
  /** The least height of a lens over the snow under it, m, and of the
   * sightline over the snow it crosses; each lift to open a line, m, and
   * the most. */
  floor: 0.25,
  sight: 0.12,
  raise: 0.5,
  raiseMost: 10,
  /** The shares of its offset a follow lens shut off from him is pulled in
   * to, nearest last. */
  pull: [1, 0.7, 0.45, 0.28] as readonly number[],
  /** How low a pulled-in lens looks under the crowns, m over the snow. */
  under: 0.5,
  /** A planted lens is kept this far off any solid, m. */
  room: 1.5,
  /** How much of the sightline must be clear of the trunks. */
  sightline: 0.999,
  /** A planted line shut this long, s, gives the take up. */
  shut: 0.3,
  /** The way he is going is eased toward his travel at this, 1/s. */
  turn: 2.5,
  /** Under this speed, m/s, his facing is the way he is going. */
  still: 1.5,
  /** A zoom eases at this, 1/s. */
  zoom: 3,
  /** A jump of the clock past this, s, is a seek: a cut. */
  jump: 0.5,
} as const;

/** What the film camera is handed: the replay's view, with its moments. */
export type FilmView = ReplayView;

/** The framings whose lens is planted off his line before he arrives. */
const PLANTED: ReadonlySet<Framing> = new Set(["headon", "rideby", "lip", "hero", "crash"]);

export type CinemaCamera = {
  update: (
    view: FilmView,
    rig: RigPose,
    body: ThrownBody | null,
    t: number,
    dt: number,
    /** The WALL seconds since the last frame, where the run is slowed or
     * sped (the renderer's pace): the lens eases and the director times its
     * takes on it. Left out, `dt`. */
    wall?: number,
  ) => LensPose | null;
  drop: () => void;
  /** The take on the picture, for the labs; null before the first frame. */
  take: () => Take | null;
};

/** Whether the slope or a trunk shuts the line from `at` to `eye`. */
export function shut(level: Level, at: Vec3, eye: Vec3, clear: LineClear): boolean {
  return snowBetween(level, at, eye, CINEMA.sight) || clear(at, eye) < CINEMA.sightline;
}

const ids: number[] = [];

/** WHETHER A LENS AT `p` STANDS INSIDE SOMETHING SOLID: the solids the
 * line is asked of (`camera-clear.ts`'s `inside`: the crowns, the houses,
 * the cabins, the course's marks, the machines) and everything the engine
 * stands in the snow (`solidsOf`: the trunks, the lifts' towers, the masts,
 * the buildings' walls, the rock walls) — a lens kept `pad` m off each. */
export function lensInSolid(level: Level, clear: LineClear, p: Vec3, pad = 0.45): boolean {
  if (clear.inside?.(p)) return true;
  const list = solidsOf(level);
  for (const i of solidsNear(level, p.x, p.z, 4, ids)) {
    const u = list[i];
    if (p.y < u.y - pad || p.y > u.y + u.height + pad) continue;
    if (Math.hypot(p.x - u.x, p.z - u.z) < u.radius + pad) return true;
  }
  return false;
}

/** A follow lens held over the snow and lifted until the line to him is
 * open; where no lift up to `raiseMost` opens it (deep in the woods), PULLED
 * IN toward him a share at a time — lifted, or kept LOW under the crowns'
 * skirts, as a camera skier closes in among the trunks. Where nothing opens
 * the line, it is at least stood clear of every solid. Returns how far it
 * was lifted. The film's own floor, low enough for a lens down by the boots. */
export function openFilmLine(level: Level, at: Vec3, eye: Vec3, clear: LineClear): number {
  const blocked = (): boolean => shut(level, at, eye, clear) || lensInSolid(level, clear, eye);
  const from = { x: eye.x, y: eye.y, z: eye.z };
  const place = (share: number): number => {
    eye.x = at.x + (from.x - at.x) * share;
    eye.z = at.z + (from.z - at.z) * share;
    eye.y = at.y + (from.y - at.y) * share;
    const floor = level.groundAt(eye.x, eye.z) + CINEMA.floor;
    if (eye.y < floor) eye.y = floor;
    return floor;
  };
  for (const share of CINEMA.pull) {
    const floor = place(share);
    const most = share === 1 ? CINEMA.raiseMost : CINEMA.raiseMost / 2;
    let lifted = 0;
    for (; lifted < most && blocked(); lifted += CINEMA.raise) eye.y += CINEMA.raise;
    if (!blocked()) return lifted;
    if (share < 1) {
      eye.y = floor + CINEMA.under;
      if (!blocked()) return 0;
    }
  }
  // Nowhere open: where it wanted to be, lifted out of whatever it is in.
  place(1);
  let lifted = 0;
  for (; lifted < 2 * CINEMA.raiseMost && lensInSolid(level, clear, eye); lifted += CINEMA.raise)
    eye.y += CINEMA.raise;
  return lifted;
}

/** The fov that holds `width` m of world at `range` m. */
export function zoomFor(width: number, range: number): number {
  const r = Math.max(CINEMA.near, range);
  return clamp((2 * Math.atan(width / (2 * r)) * 180) / Math.PI, CINEMA.fovMin, CINEMA.fovMax);
}

/** WHERE A LENS IS PLANTED: off `anchor` (a point on his line) by `along`
 * m the way `heading` runs and `side` m across, `lift` m over the snow,
 * pushed out on the other side and further until the line from `target`
 * to it is open and it stands in nothing solid. Null where nowhere near
 * is. Pure. */
export function plantNear(
  level: Level,
  anchor: Vec3,
  heading: number,
  along: number,
  side: number,
  first: 1 | -1,
  lift: number,
  targets: readonly Vec3[],
  clear: LineClear,
): Vec3 | null {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const bx = anchor.x + fx * along;
  const bz = anchor.z + fz * along;
  for (let push = 0; push <= CINEMA.pushes; push++) {
    const out = side + push * CINEMA.push;
    for (const s of [first, -first]) {
      const x = bx + rx * out * s;
      const z = bz + rz * out * s;
      if (x < 0 || z < 0 || x > level.size || z > level.size) continue;
      const stand = { x, y: level.groundAt(x, z) + lift, z };
      // Planted with room round it: never hard against a wall or a roof.
      if (lensInSolid(level, clear, stand, CINEMA.room)) continue;
      if (targets.every((t) => !shut(level, t, stand, clear))) return stand;
    }
  }
  return null;
}

/** How far his centre of gravity rides over the snow standing on it, m. */
const CG = 0.85;

/** THE MOMENTS THE FILM FRAMES out of `plan`: every one but a flight too
 * LOW for a planted lens — where the run read ahead has him, his feet never
 * `DIRECTOR.high` m over the snow under him through the middle of it. A
 * small air is followed by the shot on the picture, never planted for. */
export function filmPlan(
  plan: readonly ReplayShot[],
  path: ((step: number) => Vec3 | null) | undefined,
  level: Level,
): readonly ReplayShot[] {
  if (!path || !plan.some((m) => m.kind === "air")) return plan;
  return plan.filter((m) => {
    if (m.kind !== "air") return true;
    let top = -Infinity;
    for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const p = path(m.at + Math.round(m.runs * f));
      if (p) top = Math.max(top, p.y - CG - level.groundAt(p.x, p.z));
    }
    return top === -Infinity || top >= DIRECTOR.high;
  });
}

/** Where he will be at `step`: the run read ahead where it has him, else
 * carried on along his travel and set on the snow. */
function predict(view: FilmView, s: Subject, step: number, now: number, level: Level): Vec3 {
  const p = view.path?.(step);
  if (p) return { x: p.x, y: p.y, z: p.z };
  const dt = (step - now) / HZ;
  const x = clamp(s.x + s.vx * dt, 0, level.size);
  const z = clamp(s.z + s.vz * dt, 0, level.size);
  return { x, y: level.groundAt(x, z) + 0.9, z };
}

/** The take the last film lens drawn was on — a readout for the labs
 * (`make cinema` captions every frame with it); nothing in the game reads it. */
let lastTake: Take | null = null;
export function filmTake(): Take | null {
  return lastTake;
}

/** Where he is `share` of the way through a flight: the run read ahead
 * where it has him, else the take-off carried on along his line, a little
 * over the snow. */
function flightAt(view: FilmView, m: ReplayShot, share: number, level: Level): Vec3 {
  const p = view.path?.(m.at + Math.round(m.runs * share));
  if (p) return { x: p.x, y: p.y, z: p.z };
  const reach = (m.speed * m.runs * share) / HZ;
  const x = m.x + Math.sin(m.heading) * reach;
  const z = m.z + Math.cos(m.heading) * reach;
  return { x, y: Math.max(level.groundAt(x, z), m.y) + 1.5, z };
}

export function createCinemaCamera(world: ReplayWorld, director?: Director): CinemaCamera {
  const dir = director ?? createDirector();
  let take: Take | null = null;
  /** Where the take's lens is planted, or null for a follow lens. */
  let stand: Vec3 | null = null;
  let shutFor = 0;
  let way = 0;
  let lastWay = 0;
  let fov = 50;
  let roll = 0;
  let last = -Infinity;
  let lastStep = -1;
  /** The wall clock the director times its takes on, s. */
  let clock = 0;
  const eye = { x: 0, y: 0, z: 0 };
  const aim = { x: 0, y: 0, z: 0 };
  const wantEye = { x: 0, y: 0, z: 0 };
  const subject: Subject = { x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0, thrown: false };
  const pose: LensPose = { eye, target: aim, fov, roll: 0 };

  /** Plant the lens for a planted take, or null where it cannot be. */
  const plant = (
    t: Take,
    view: FilmView,
    level: Level,
    clear: LineClear,
    now: number,
  ): Vec3 | null => {
    const s = subject;
    const hips = { x: s.x, y: s.y, z: s.z };
    const m = t.moment;
    switch (t.framing) {
      case "headon": {
        const C = CINEMA.headon;
        const at = predict(view, s, now + Math.round(C.ahead * HZ), now, level);
        // Looking back UP his line: the lens stands down it, facing him.
        const h = Math.atan2(at.x - s.x, at.z - s.z);
        return plantNear(level, at, h, 0, C.side, t.side, C.lift, [hips, at], clear);
      }
      case "rideby": {
        const C = CINEMA.rideby;
        const at = m
          ? { x: m.x, y: m.y + 0.9, z: m.z }
          : predict(view, s, now + Math.round(C.ahead * HZ), now, level);
        return plantNear(level, at, way, 0, C.side, t.side, C.lift, [at, hips], clear);
      }
      case "lip": {
        if (!m) return null;
        const C = CINEMA.lip;
        const lip = { x: m.x, y: level.groundAt(m.x, m.z) + 0.9, z: m.z };
        return plantNear(level, lip, m.heading, C.past, C.side, t.side, C.lift, [lip], clear);
      }
      case "hero": {
        if (!m) return null;
        const C = CINEMA.hero;
        const touch = m.at + Math.round(m.runs * C.share);
        const p = view.path?.(touch);
        const reach = (m.speed * m.runs * C.share) / HZ;
        const at = p ?? {
          x: m.x + Math.sin(m.heading) * reach,
          y: 0,
          z: m.z + Math.cos(m.heading) * reach,
        };
        const land = { x: at.x, y: level.groundAt(at.x, at.z) + 1.5, z: at.z };
        // The line open to him in the air too, not just where he comes down.
        const up = [0.35, 0.6].map((f) => flightAt(view, m, f, level));
        return plantNear(level, land, m.heading, 0, C.side, t.side, C.lift, [land, ...up], clear);
      }
      case "crash": {
        if (!m) return null;
        const C = CINEMA.crash;
        const at = { x: m.x, y: level.groundAt(m.x, m.z) + 0.6, z: m.z };
        return plantNear(level, at, m.heading, C.ahead, C.side, t.side, C.lift, [at], clear);
      }
      default:
        return null;
    }
  };

  /** Where a follow lens wants to stand this frame; its fov. */
  const followWant = (f: Framing, t: Take, level: Level, now: number): number => {
    const s = subject;
    const fx = Math.sin(way);
    const fz = Math.cos(way);
    const rx = Math.cos(way) * t.side;
    const rz = -Math.sin(way) * t.side;
    const put = (back: number, side: number, up: number | null, lift?: number): void => {
      wantEye.x = s.x - fx * back + rx * side;
      wantEye.z = s.z - fz * back + rz * side;
      wantEye.y = up !== null ? s.y + up : level.groundAt(wantEye.x, wantEye.z) + (lift ?? 0);
    };
    const k = clamp((now - t.from) / Math.max(1, t.until - t.from), 0, 1);
    switch (f) {
      case "establish": {
        // THE PUSH-IN: eased in from the take's start to its end.
        const C = CINEMA.establish;
        const e = k * k * (3 - 2 * k);
        const near = 1 + (C.push - 1) * e;
        put(C.back * near, C.side * near, C.up * near);
        return C.fov - C.narrow * e;
      }
      case "heli":
      case "chase":
      case "lead":
      case "dutch": {
        const C = CINEMA[f];
        put(C.back, C.side, C.up);
        return C.fov;
      }
      case "hang": {
        const C = CINEMA.hang;
        const e = k * k * (3 - 2 * k);
        put(C.from + (C.to - C.from) * e, C.side, C.up);
        return C.fov;
      }
      case "boots": {
        const C = CINEMA.boots;
        put(C.back + C.slide * k, C.side, null, C.lift);
        return C.fov;
      }
      case "powder": {
        const C = CINEMA.powder;
        put(C.back, C.side, null, C.lift);
        return C.fov;
      }
      case "arc": {
        const C = CINEMA.arc;
        const a = way + t.side * (Math.PI / 2 + (C.rate * (now - t.from)) / HZ);
        wantEye.x = s.x + Math.sin(a) * C.range;
        wantEye.z = s.z + Math.cos(a) * C.range;
        wantEye.y = s.y + C.up;
        return C.fov;
      }
      default:
        return 50;
    }
  };

  return {
    take: () => take,
    drop: () => {
      dir.drop();
      take = null;
      stand = null;
    },
    update: (view, rig, body, t, step, wall = step) => {
      const map = world();
      if (!map) return null;
      const { level, clear } = map;
      const dt = Math.min(wall, 0.1);
      clock += Math.max(0, wall);
      const now = view.step ?? Math.round(t * HZ);
      if (t < last || t > last + CINEMA.jump) {
        dir.drop();
        take = null;
      }
      last = t;
      subjectOf(rig, body, subject);
      const at = { x: subject.x, y: subject.y, z: subject.z };
      const speed = Math.hypot(subject.vx, subject.vz);
      const going = speed > CINEMA.still ? Math.atan2(subject.vx, subject.vz) : subject.heading;
      if (!take) way = going;
      // HOW FAST HIS WAY TURNS, rad/s, off the steps since the last frame.
      const span = lastStep >= 0 && now > lastStep ? (now - lastStep) / HZ : 0;
      const turnRate = span > 0 ? Math.abs(angleDiff(lastWay, going)) / span : 0;
      lastWay = going;
      lastStep = now;

      const sit = {
        step: now,
        speed,
        packed: rig.packed,
        turn: turnRate,
        airborne: rig.airborne,
        thrown: subject.thrown,
        wall: clock,
      };
      const plan = filmPlan(view.plan ?? [], view.path, level);
      let next = dir.call(sit, plan);
      const cut = next !== take;
      if (cut) {
        way = going;
        shutFor = 0;
        stand = null;
        // A planted take with nowhere open to stand is given up for the next.
        for (let tries = 0; tries < 4 && PLANTED.has(next.framing); tries++) {
          stand = plant(next, view, level, clear, now);
          if (stand) break;
          dir.end();
          next = dir.call(sit, plan);
        }
        take = next;
      } else {
        way += angleDiff(way, going) * clamp(CINEMA.turn * dt, 0, 1);
      }
      const tk = take!;
      const lens = PLANTED.has(tk.framing) ? "chase" : tk.framing;

      let want: number;
      let wantRoll = 0;
      let target: Vec3 = at;
      if (stand) {
        Object.assign(wantEye, stand);
        const range = Math.hypot(at.x - stand.x, at.y - stand.y, at.z - stand.z);
        const f = tk.framing;
        if (f === "crash") {
          const C = CINEMA.crash;
          const k = clamp((now - (tk.moment?.at ?? now)) / HZ / C.zoom, 0, 1);
          want = C.fovFrom + (C.fovTo - C.fovFrom) * k * k * (3 - 2 * k);
        } else {
          const width = f === "headon" ? CINEMA.headon.width : CINEMA[f as "rideby"].width;
          want = zoomFor(width, range);
        }
        // GIVEN UP: the line shut for a beat, or he is gone well past it —
        // but the lip's lens is never given up for the kicker hiding him on
        // his way up it: he bursts into its frame at the take-off.
        const waiting = f === "lip" && tk.moment !== null && now < tk.moment.at;
        // (A body lying in a crown is shut off from every planted lens.)
        const hidden = shut(level, at, stand, clear) || (clear.inside?.(at) ?? false);
        shutFor = !waiting && hidden ? shutFor + dt : 0;
        const leave = f === "crash" ? Infinity : CINEMA[f as "headon"].leave;
        const passed = f === "headon" && range < leave;
        if (shutFor > CINEMA.shut || passed || (f !== "headon" && range > leave)) dir.end();
      } else {
        want = followWant(lens, tk, level, now);
        if (lens === "boots") target = { x: at.x, y: at.y - CINEMA.boots.aimDown, z: at.z };
        if (lens === "dutch") wantRoll = CINEMA.dutch.roll * tk.side;
        // The camera skier's lenses open with his speed.
        if (lens === "chase" || lens === "lead" || lens === "boots" || lens === "powder") {
          const V = CINEMA.speedFov;
          want += clamp((speed - V.from) * V.per, 0, V.most);
        }
        // HAND-HELD: three slow sines, as much as the framing is held by hand.
        const hand = CINEMA.handheld[lens] ?? 0;
        if (hand > 0) {
          const S = CINEMA.shake;
          const [a, b, c] = S.hz;
          const w = 2 * Math.PI;
          wantEye.x += hand * S.pos * Math.sin(t * a * w);
          wantEye.y += hand * S.pos * 0.7 * Math.sin(t * b * w + 1.3);
          wantEye.z += hand * S.pos * Math.sin(t * c * w + 2.1);
          wantRoll += hand * S.roll * Math.sin(t * b * w + 0.4);
        }
        openFilmLine(level, target, wantEye, clear);
      }

      if (cut) {
        Object.assign(eye, wantEye);
        fov = want;
        roll = wantRoll;
      } else {
        const C = stand ? null : CINEMA[lens as "chase"];
        const f = C ? clamp(C.follow * dt, 0, 1) : 1;
        eye.x += (wantEye.x - eye.x) * f;
        eye.y += (wantEye.y - eye.y) * f;
        eye.z += (wantEye.z - eye.z) * f;
        fov =
          tk.framing === "crash" ? want : fov + (want - fov) * clamp(CINEMA.zoom * dt * 2, 0, 1);
        roll += (wantRoll - roll) * clamp(8 * dt, 0, 1);
        // KEPT OUT OF EVERY SOLID: an eased lens that would pass through a
        // crown, a trunk, a tower or a wall is put where it wants to be,
        // which was opened clear of them.
        if (!stand && lensInSolid(level, clear, eye)) Object.assign(eye, wantEye);
      }
      // The eased lens may have drifted under a crest the wanted one cleared.
      const floor = level.groundAt(eye.x, eye.z) + CINEMA.floor;
      if (eye.y < floor) eye.y = floor;
      Object.assign(aim, target);
      pose.fov = fov;
      pose.roll = roll;
      lastTake = tk;
      return pose;
    },
  };
}

/** THE REPLAY'S LENSES AS THE RENDERER HOLDS THEM: the film camera on the
 * FILM angle, the replay's own (`camera-replay.ts`) on every other. */
export function createWatchCamera(world: ReplayWorld): Pick<CinemaCamera, "update" | "drop"> {
  const replay = createReplayCamera(world);
  const film = createCinemaCamera(world);
  return {
    update: (view, rig, body, t, dt, wall) =>
      view.angle === "film"
        ? film.update(view, rig, body, t, dt, wall)
        : replay.update(view, rig, body, t, dt),
    drop: () => {
      replay.drop();
      film.drop();
    },
  };
}
