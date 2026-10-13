// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE — a dry SLAB breaking on a loaded slope off the groomed runs
// of a free ride, the flow it becomes, and the skier it takes. The app asks
// for it (`CreateGameOptions.avalanche`); a run without it never steps any of
// this and carries nothing of it (`GameState.avalanche` absent).
//
// THE HAZARD is a pure function of the map, its day and the snow
// (`avalancheHazard`): a slope in the release band (`AVALANCHE.steep`, about
// 30–50°), off the packed runs (a groomed, controlled piste holds), out of
// the dense woods (trees anchor the snowpack), times the run's SLAB LOAD
// (`loadOf`: a settled base, the new snow the run has laid, the snow dial,
// a snowing sky) — the storm's share lying on every aspect and the WIND'S
// lying on the LEE slopes, the ones facing down the map's wind, the more the
// harder it blows past the drift's threshold.
//
// THE TRIGGER: a skier crossing a slope of hazard h sets it off with a dealt
// chance of h × `trigger.perMetre` a metre (probed every `trigger.probe` m of
// his way), a landing on it adds a chance by its impact, a snowmobile's
// weight and churn multiply it. Every draw is off the avalanches' own stream
// (`AVALANCHE_SALT`), never `state.rng`.
//
// THE RELEASE: the crack runs up the weak layer to a CROWN a few to tens of
// metres above him, across the slope to FLANKS where the slope stops being
// steep, open and loaded, and the slab below the crown down to its
// STAUCHWALL, where the slope eases off. The slab is cut into parcels — a
// few hundred at most (`AVALANCHE.cells`) — each carrying its share of the
// slab's volume.
//
// THE FLOW: each parcel runs down the snow it is over under VOELLMY'S
// friction — gravity along the slope, a Coulomb part μ against the normal
// load and a turbulent drag g·v²/(ξ·h) — accelerating to tens of metres a
// second on the steep, spreading a little as the slab breaks up, and coming
// to rest where the slope is flatter than atan μ — or PILED UP on the
// debris already lying ahead of it (`AVALANCHE.pile`, found through a small
// plan hash), so the deposit builds back up the path from its toe.
//
// CAUGHT, CARRIED, BURIED: a running parcel near him faster than he is
// going its way takes him — he is thrown onto his own ragdoll (the
// `avalanche` crash cause) and dragged along at the flow's speed, meeting
// the snow and every trunk in the way through the body's own blows
// (`body.ts`). Where the flow round him stops he is put down under the
// debris lying there: a share of its depth, his head out under
// `headFree` m (he gets up as from any fall), under it BURIED — held, the
// reset waiting, while a dealt time off the SURVIVAL CURVE (compressed for
// play) runs out. OUTSKIED: a skier who gets out of the flow's way —
// across and out of the flank, or ahead faster than it comes — is never
// taken, and once he is clear of it he has escaped.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { weatherOf } from "../mapgen/weather.ts";
import { AVALANCHE } from "./defs/avalanche.ts";
import { TUNING } from "./defs/tuning.ts";
import { throwRider } from "./crash.ts";
import { treesNear } from "./upright-grid.ts";
import { windFromOf } from "./wind.ts";
import { RAGDOLL } from "./ragdoll.ts";
import { smother } from "./gore.ts";
import { addBurial, catchOthers, freshBeacon, stepRescue } from "./avalanche-rescue.ts";
import {
  CELL,
  type AvalancheState,
  type AvalancheVictim,
  type SlabFrame,
  type Slide,
} from "./avalanche-state.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";

const K = AVALANCHE;
const dt = TUNING.dt;
const G = TUNING.g;
const DEG = 180 / Math.PI;
const S = CELL.stride;

/** The avalanches' stream's salt off the run's seed — no other stream
 * shares it. */
const AVALANCHE_SALT = 0x2f6c1d93;

/** A free ride's avalanches before any has released. */
export function freshAvalanche(state: GameState): AvalancheState {
  return {
    rng: createRng((state.seed ^ AVALANCHE_SALT) >>> 0),
    load: loadOf(state),
    travel: 0,
    quiet: 0,
    slide: null,
    beds: [],
    victim: null,
    count: 0,
    burials: [],
    ids: 0,
    beacon: freshBeacon(),
    patrol: null,
  };
}

/** THE RUN'S SLAB LOAD now, 0..1: the settled base, the new snow the run
 * has laid, the snow dial past the ordinary, and a snowing sky. */
export function loadOf(state: Pick<GameState, "level" | "fresh" | "snowDepth">): number {
  const L = K.load;
  const fall = weatherOf(state.level).snowfall;
  return clamp(
    L.base +
      L.perFresh * Math.max(0, state.fresh) +
      L.perDial * Math.max(0, state.snowDepth - 1) +
      L.perFall * fall,
    0,
    1,
  );
}

/** The share of a slab's chance the slope's pitch allows, 0..1 (`steep`). */
export function steepShare(deg: number): number {
  const s = K.steep;
  if (deg <= s.rise || deg >= s.gone) return 0;
  if (deg < s.full) return (deg - s.rise) / (s.full - s.rise);
  if (deg <= s.fade) return 1;
  return (s.gone - deg) / (s.gone - s.fade);
}

const n = { x: 0, y: 1, z: 0 };
const near: number[] = [];

/** The slope's pitch at a point, degrees, its fall line left in `n`. */
function pitchAt(level: Level, x: number, z: number): number {
  level.normalAt(x, z, n);
  return Math.acos(clamp(n.y, -1, 1)) * DEG;
}

/** How open a point's snow is to sliding, 0..1: none on a packed run, none
 * in the dense woods. */
function openAt(level: Level, x: number, z: number): number {
  const packed = level.packedAt(x, z);
  if (packed >= K.packedHolds) return 0;
  const trees = treesNear(level, x, z, K.anchorReach, near).length;
  if (trees >= K.anchorTrees) return 0;
  return (1 - packed / K.packedHolds) * (1 - trees / K.anchorTrees);
}

/** Whether a point could be part of a slab at all: steep, open. */
function slabby(level: Level, x: number, z: number): boolean {
  return steepShare(pitchAt(level, x, z)) > 0 && openAt(level, x, z) > 0;
}

/**
 * THE HAZARD at a plan point of `level` under a slab load `load` (0..1):
 * the chance-weight a skier crossing it sets a slab off, 0..1 — its pitch
 * in the release band, how open it is (off the runs, out of the woods), and
 * the slab lying on it: the storm's share everywhere, the wind's on the lee
 * slopes. A pure function of the map and the load.
 */
export function avalancheHazard(level: Level, load: number, x: number, z: number): number {
  if (load <= 0) return 0;
  const steep = steepShare(pitchAt(level, x, z));
  if (steep <= 0) return 0;
  // The fall line, read before `openAt` reuses nothing of `n`.
  const fl = hypot(n.x, n.z);
  const fx = fl > 1e-6 ? n.x / fl : 0;
  const fz = fl > 1e-6 ? n.z / fl : 0;
  const open = openAt(level, x, z);
  if (open <= 0) return 0;
  const W = K.wind;
  const w = weatherOf(level);
  const blow = clamp((w.wind - W.from) / (W.full - W.from), 0, 1);
  // The air moves toward the bearing opposite the one it blows from.
  const toward = windFromOf(level) + Math.PI;
  const lee = Math.max(0, fx * Math.sin(toward) + fz * Math.cos(toward));
  const slab = load * (W.storm + W.lee * lee * blow);
  return steep * open * Math.min(1, slab);
}

/** Whether a plan point lies on a slab that has already released. */
function onBed(beds: readonly SlabFrame[], x: number, z: number): boolean {
  for (const b of beds) {
    const dx = x - b.x;
    const dz = z - b.z;
    const along = dx * b.fx + dz * b.fz;
    const across = dx * b.fz - dz * b.fx;
    if (along > -8 && along < b.length + 8 && across < b.left + 8 && across > -b.right - 8) {
      return true;
    }
  }
  return false;
}

/** The skier out on the snow on his own skis or riding the snowmobile —
 * the only weight that loads a weak layer: not thrown, not on a lift, a
 * tunnel's wind, a rail, nor carried by anything in the air. Where, how
 * fast and how hard (the trigger's multiple), or null. */
function loading(state: GameState): { x: number; z: number; speed: number; weight: number } | null {
  const c = state.skier;
  if (state.sled?.mode === "ridden") {
    const s = state.sled;
    return { x: s.x, z: s.z, speed: hypot(s.vx, s.vz), weight: K.trigger.sled };
  }
  if (c.thrown || c.lift || c.tunnel || c.jib || c.grind || c.airborne) return null;
  if (state.heli?.rider) return null;
  if (state.para && state.para.mode !== "dropped") return null;
  if (state.balloon?.aboard) return null;
  return { x: c.x, z: c.z, speed: c.speed, weight: 1 };
}

/** One step of the avalanches, after the skier's own — `input` the
 * player's, for his transceiver, probe and shovel (`avalanche-rescue.ts`). */
export function stepAvalanche(state: GameState, events: GameEvent[], input?: SkierInput): void {
  const a = state.avalanche;
  if (!a) return;
  a.load = loadOf(state);
  // A RESET took him out of it.
  const v = a.victim;
  if (v && !state.skier.thrown) {
    if (v.phase !== "lost") push(state, events, "freed", a.slide, v.x, v.z, v.depth);
    a.victim = null;
  }
  const slide = a.slide;
  if (slide?.running) {
    stepFlow(state, slide);
    meetFlow(state, a, slide, events);
    // ...and the crowd and the keen skiers in its way (`avalanche-rescue.ts`).
    if (slide.running) catchOthers(state, a, slide, events);
    if (!slide.running) {
      push(state, events, "stopped", slide, slide.slab.x, slide.slab.z, 0);
      if (slide.involved && !slide.caught && !slide.escaped) escape(state, slide, events);
    }
  }
  if (a.victim) stepVictim(state, a, a.victim, events);
  // THE SEARCH AND THE PATROL (`avalanche-rescue.ts`).
  stepRescue(state, a, input, events);
  if (a.quiet > 0) a.quiet = Math.max(0, a.quiet - dt);
  if (state.phase === "racing") trigger(state, a, events);
}

/** THE TRIGGER: the hazard probed along his way, and any landing on it. */
function trigger(state: GameState, a: AvalancheState, events: GameEvent[]): void {
  const on = loading(state);
  if (!on) return;
  if (a.quiet > 0 || a.slide?.running) return;
  // Nor while anybody is still under the last one's debris.
  for (const b of a.burials) if (b.phase !== "out") return;
  const T = K.trigger;
  let chance = 0;
  a.travel += on.speed * dt;
  if (a.travel >= T.probe) {
    a.travel -= T.probe;
    const h = avalancheHazard(state.level, a.load, on.x, on.z);
    if (h > 0) chance = 1 - Math.exp(-h * T.perMetre * T.probe * on.weight);
  }
  for (const e of events) {
    if (e.kind !== "land" || !(e.impact > 0)) continue;
    const h = avalancheHazard(state.level, a.load, on.x, on.z);
    if (h > 0) chance = Math.max(chance, h * T.landing * Math.min(2, e.impact / T.landRef));
  }
  if (chance <= 0 || onBed(a.beds, on.x, on.z)) return;
  if (!a.rng.chance(chance)) return;
  release(state, a, on.x, on.z, events);
}

/**
 * THE RELEASE at the skier standing at (`x`, `z`): the crown above him,
 * the flanks across, the stauchwall below, the slab cut into its parcels.
 * Exported for the labs and the tests, which stand a release where they
 * want one.
 */
export function release(
  state: GameState,
  a: AvalancheState,
  x: number,
  z: number,
  events: GameEvent[],
): Slide {
  const level = state.level;
  const rng = a.rng;
  const hazard = Math.max(0.2, avalancheHazard(level, Math.max(a.load, 0.01), x, z));
  pitchAt(level, x, z);
  const fl = Math.max(1e-6, hypot(n.x, n.z));
  const fx = n.x / fl;
  const fz = n.z / fl;
  // Across to the LEFT of the fall line.
  const ax = fz;
  const az = -fx;
  // THE CROWN: up the fall line from him, as far as the slope stays steep.
  const above = rng.range(K.crownAbove[0], K.crownAbove[1]);
  let up = 0;
  for (let d = 2; d <= above; d += 2) {
    if (!slabby(level, x - fx * d, z - fz * d)) break;
    up = d;
  }
  const cx = x - fx * up;
  const cz = z - fz * up;
  // THE FLANKS: across from the crown's middle each way, as far as the
  // slope stays a slab, up to half the width dealt.
  const half = (rng.range(K.width[0], K.width[1]) * (0.6 + 0.6 * hazard)) / 2;
  const flank = (sx: number, sz: number): number => {
    let reach = K.cell.across / 2;
    for (let d = K.cell.across / 2; d <= half; d += 3) {
      if (!slabby(level, cx + sx * d, cz + sz * d)) break;
      reach = d;
    }
    return reach;
  };
  const left = flank(ax, az);
  const right = flank(-ax, -az);
  // THE STAUCHWALL: down the fall line from the crown to where it eases off.
  let length = 0;
  for (let d = 3; d <= K.slabMost; d += 3) {
    length = d;
    if (pitchAt(level, cx + fx * d, cz + fz * d) < K.stauch) break;
  }
  length = Math.max(length, up + 12);
  // THE SLAB'S THICKNESS: log-spread about its median, deepened by the load.
  const spread = Math.exp(rng.range(-1, 1) * Math.log(K.depth[1] / K.depthMid));
  const depth = clamp(K.depthMid * spread * (0.7 + 0.6 * a.load), K.depth[0], K.depth[1]);
  const slab: SlabFrame = {
    x: cx,
    y: level.groundAt(cx, cz),
    z: cz,
    fx,
    fz,
    left,
    right,
    length,
    depth,
  };
  // THE PARCELS: a grid over the slab, each nudged off its row a little.
  const wide = left + right;
  const across = clamp(Math.round(wide / K.cell.across), 1, K.cellsAcross);
  let along = clamp(Math.round(length / K.cell.along), 1, K.cellsAlong);
  while (across * along > K.cells && along > 1) along--;
  const count = across * along;
  const volume = wide * length * depth;
  const cells = new Float64Array(count * S);
  const h = Math.min(K.heightMost, depth * K.bulk);
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < across; i++) {
      const k = (j * across + i) * S;
      const u = -right + ((i + 0.5 + rng.range(-0.3, 0.3)) * wide) / across;
      const w = ((j + 0.5 + rng.range(-0.3, 0.3)) * length) / along;
      cells[k + CELL.x] = cx + ax * u + fx * w;
      cells[k + CELL.z] = cz + az * u + fz * w;
      cells[k + CELL.h] = h;
      cells[k + CELL.vol] = volume / count;
      cells[k + CELL.run] = 1;
      cells[k + CELL.side] = wide > 0 ? (2 * (u + right)) / wide - 1 : 0;
    }
  }
  const slide: Slide = {
    id: a.count + 1,
    slab,
    t: 0,
    count,
    cells,
    moving: count,
    front: 0,
    top: 0,
    runout: length,
    volume,
    running: true,
    involved: false,
    caught: false,
    escaped: false,
    away: 0,
    heap: new Map(),
    next: new Int32Array(count).fill(-1),
  };
  a.count += 1;
  a.slide = slide;
  a.quiet = K.again;
  a.beds.push(slab);
  if (a.beds.length > K.beds) a.beds.shift();
  push(state, events, "release", slide, cx, cz, depth);
  return slide;
}

/** One step of the flow: every running parcel down the snow it is on. */
function stepFlow(state: GameState, s: Slide): void {
  const level = state.level;
  const c = s.cells;
  const { fx, fz } = s.slab;
  const ax = fz;
  const az = -fx;
  const edge = level.size;
  s.t += dt;
  const over = s.t >= K.runMost;
  let moving = 0;
  let front = 0;
  let runout = s.runout;
  for (let k = 0; k < c.length; k += S) {
    if (c[k + CELL.run] === 0) continue;
    const x = c[k + CELL.x];
    const z = c[k + CELL.z];
    level.normalAt(x, z, n);
    // GRAVITY ALONG THE SLOPE, in plan: g·cosθ times the normal's lean.
    const drive = G * n.y;
    let vx = c[k + CELL.vx] + drive * n.x * dt;
    let vz = c[k + CELL.vz] + drive * n.z * dt;
    // ...and the slab breaking up spreads out across its way.
    const pull = drive * hypot(n.x, n.z) * K.fan * c[k + CELL.side] * dt;
    vx += ax * pull;
    vz += az * pull;
    // VOELLMY: the Coulomb part against the normal load, the turbulent
    // drag on the speed squared over the flow height.
    const v = hypot(vx, vz);
    // ...and ploughing into debris already lying.
    const piled = onHeap(s, x, z);
    const friction =
      K.mu * drive + (G * v * v) / (K.xi * c[k + CELL.h]) + (piled ? K.pile.decel : 0);
    const slowed = Math.max(0, v - friction * dt);
    const share = v > 1e-9 ? slowed / v : 0;
    vx *= share;
    vz *= share;
    const nx = x + vx * dt;
    const nz = z + vz * dt;
    // AT REST where the slope cannot keep it going against its friction,
    // or off the map's edge.
    const steep = hypot(n.x, n.z) / Math.max(1e-6, n.y);
    const rest =
      (slowed < K.rest && steep < K.mu) ||
      (piled && slowed < K.pile.stop) ||
      over ||
      nx < 0 ||
      nz < 0 ||
      nx > edge ||
      nz > edge;
    c[k + CELL.vx] = rest ? 0 : vx;
    c[k + CELL.vz] = rest ? 0 : vz;
    if (rest) {
      c[k + CELL.run] = 0;
      lay(s, k / S, x, z);
      continue;
    }
    c[k + CELL.x] = nx;
    c[k + CELL.z] = nz;
    moving++;
    if (slowed > front) front = slowed;
    const down = (nx - s.slab.x) * fx + (nz - s.slab.z) * fz;
    if (down > runout) runout = down;
  }
  s.moving = moving;
  s.front = front;
  if (front > s.top) s.top = front;
  s.runout = runout;
  if (moving === 0) s.running = false;
}

/** The hash key of the plan bucket a point lies in. */
function bucketKey(x: number, z: number): number {
  const b = K.pile.bucket;
  return Math.floor(x / b) * 4096 + Math.floor(z / b);
}

/** A parcel come to rest, laid in its bucket of the debris. */
function lay(s: Slide, i: number, x: number, z: number): void {
  const key = bucketKey(x, z);
  s.next[i] = s.heap.get(key) ?? -1;
  s.heap.set(key, i);
}

/** Whether debris at rest lies within `pile.reach` of a point. */
function onHeap(s: Slide, x: number, z: number): boolean {
  if (s.heap.size === 0) return false;
  const b = K.pile.bucket;
  const r2 = K.pile.reach * K.pile.reach;
  const bx = Math.floor(x / b);
  const bz = Math.floor(z / b);
  const c = s.cells;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      let p = s.heap.get((bx + i) * 4096 + bz + j) ?? -1;
      while (p >= 0) {
        const dx = c[p * S + CELL.x] - x;
        const dz = c[p * S + CELL.z] - z;
        if (dx * dx + dz * dz < r2) return true;
        p = s.next[p];
      }
    }
  }
  return false;
}

/** The skier against the running flow: caught, involved, or clear. */
function meetFlow(state: GameState, a: AvalancheState, s: Slide, events: GameEvent[]): void {
  const c = state.skier;
  if (c.thrown || s.caught) return;
  const on = loading(state);
  const air = c.airborne && !c.thrown && !c.lift;
  if (!on && !air) return;
  const x = c.x;
  const z = c.z;
  const cells = s.cells;
  const reach2 = K.reach * K.reach;
  const near2 = K.near * K.near;
  let close = false;
  for (let k = 0; k < cells.length; k += S) {
    if (cells[k + CELL.run] === 0) continue;
    const dx = cells[k + CELL.x] - x;
    const dz = cells[k + CELL.z] - z;
    const d2 = dx * dx + dz * dz;
    if (d2 > near2) continue;
    close = true;
    if (d2 > reach2) continue;
    const vx = cells[k + CELL.vx];
    const vz = cells[k + CELL.vz];
    const sp = hypot(vx, vz);
    if (sp < K.catchSpeed) continue;
    // Coming on at him: its speed less his own along its way — running
    // ahead of it as fast as it comes, he stays ahead of it.
    const along = (c.vx * vx + c.vz * vz) / sp;
    if (sp - along < K.catchSpeed) continue;
    // Riding the snowmobile, he is thrown off it as off his skis — the
    // machine left where the flow took him off it (`sled.ts`).
    catchSkier(state, a, s, k / S, events);
    return;
  }
  if (close) {
    s.involved = true;
    s.away = 0;
  } else if (s.involved && !s.escaped) {
    s.away += dt;
    if (s.away >= K.escapeAfter) escape(state, s, events);
  }
}

function escape(state: GameState, s: Slide, events: GameEvent[]): void {
  s.escaped = true;
  push(state, events, "escaped", s, state.skier.x, state.skier.z, 0);
}

/** CAUGHT: thrown onto his body, carried with the flow. */
function catchSkier(
  state: GameState,
  a: AvalancheState,
  s: Slide,
  parcel: number,
  events: GameEvent[],
): void {
  const c = state.skier;
  const vx = s.cells[parcel * S + CELL.vx];
  const vz = s.cells[parcel * S + CELL.vz];
  s.caught = true;
  s.involved = true;
  throwRider(state, "avalanche", { x: (c.vx + vx) / 2, y: c.vy, z: (c.vz + vz) / 2 }, events);
  a.victim = {
    slide: s.id,
    parcel,
    phase: "carried",
    t: 0,
    depth: 0,
    air: 0,
    clear: 0,
    x: c.x,
    z: c.z,
  };
  push(state, events, "caught", s, c.x, c.z, 0);
}

/** THE DEBRIS' DEPTH at a plan point, m: every parcel's settled volume laid
 * over a cone `spread` m in radius round where it is. */
export function debrisDepth(s: Slide, x: number, z: number): number {
  const R = K.spread;
  const norm = 3 / (Math.PI * R * R);
  const c = s.cells;
  let depth = 0;
  for (let k = 0; k < c.length; k += S) {
    const d = hypot(c[k + CELL.x] - x, c[k + CELL.z] - z);
    if (d >= R) continue;
    depth += c[k + CELL.vol] * K.settle * norm * (1 - d / R);
  }
  return depth;
}

/** THE SKIER IN IT: dragged along while the flow round him runs, put down
 * under the debris where it stops, and his air running out under it. */
function stepVictim(
  state: GameState,
  a: AvalancheState,
  v: AvalancheVictim,
  events: GameEvent[],
): void {
  const b = state.skier.thrown;
  if (!b) return;
  v.t += dt;
  const s = a.slide;
  if (v.phase === "carried") {
    v.x = b.x;
    v.z = b.z;
    // Carried in the parcel that took him: at its speed, and drawn back
    // into it where the snow under him has held him back.
    const k = v.parcel * S;
    if (s && s.cells[k + CELL.run] === 1) {
      const c = s.cells;
      v.clear = 0;
      carryBody(
        b.points,
        b.last,
        c[k + CELL.vx] + (c[k + CELL.x] - b.x) * K.hold,
        c[k + CELL.vz] + (c[k + CELL.z] - b.z) * K.hold,
      );
      return;
    }
    v.clear += dt;
    if (v.clear < K.settleFor) return;
    bury(state, a, v, events);
    return;
  }
  // Held where he lies under the snow.
  holdBody(b.points, b.last);
  if (v.phase === "buried" && v.t >= v.air) {
    v.phase = "lost";
    v.t = 0;
    push(state, events, "lost", s, v.x, v.z, v.depth);
    // On a run that carries its injuries he dies of it (`gore.ts`).
    smother(state, events);
  }
}

/** Every point of the body taken toward the flow's velocity, and held up
 * in it (Verlet: a point's step is `points − last`). */
export function carryBody(points: number[], last: number[], vx: number, vz: number): void {
  const k = 1 - Math.exp(-K.drag * dt);
  for (let i = 0; i < RAGDOLL.count; i++) {
    const j = 3 * i;
    const sx = points[j] - last[j];
    const sy = points[j + 1] - last[j + 1];
    const sz = points[j + 2] - last[j + 2];
    const nx = sx + (vx * dt - sx) * k;
    const ny = Math.max(sy, K.lift * dt * k);
    const nz = sz + (vz * dt - sz) * k;
    last[j] = points[j] - nx;
    last[j + 1] = points[j + 1] - ny;
    last[j + 2] = points[j + 2] - nz;
  }
}

/** Every point of the body stilled where it is. */
export function holdBody(points: number[], last: number[]): void {
  for (let i = 0; i < 3 * RAGDOLL.count; i++) last[i] = points[i];
}

/** PUT DOWN where the flow round him stopped: under a share of the debris
 * lying there, or with his head out of it. */
function bury(state: GameState, a: AvalancheState, v: AvalancheVictim, events: GameEvent[]): void {
  const s = a.slide;
  const lying = s ? debrisDepth(s, v.x, v.z) : 0;
  const depth = lying * a.rng.range(K.under[0], K.under[1]);
  if (depth < K.headFree) {
    push(state, events, "surfaced", s, v.x, v.z, depth);
    a.victim = null;
    return;
  }
  v.phase = "buried";
  v.t = 0;
  v.depth = depth;
  v.air = (survivalMinutes(a.rng.next(), depth) * 60) / K.timeScale;
  // On the list the patrol works from (`avalanche-rescue.ts`).
  const b = addBurial(a, "player", -1, s, v.parcel, v.x, v.z);
  if (b) {
    b.phase = "buried";
    b.depth = depth;
    b.air = v.air;
  }
  push(state, events, "buried", s, v.x, v.z, depth);
}

/** THE MINUTES A BURIED SKIER LIVES, off the survival curve at a share `u`
 * (0..1) of the buried population — the minute by which all but `u` of
 * them are still alive — shortened for every metre past the mean depth. */
export function survivalMinutes(u: number, depth: number): number {
  const C = K.survival;
  let minutes = C[C.length - 1][0];
  for (let i = 1; i < C.length; i++) {
    const [m0, s0] = C[i - 1];
    const [m1, s1] = C[i];
    if (u <= s0 && u >= s1) {
      minutes = m0 + ((s0 - u) / (s0 - s1)) * (m1 - m0);
      break;
    }
  }
  return minutes / (1 + K.deeper * Math.max(0, depth - 1));
}

/** Whether the avalanche holds him where he is — carried, buried, or lost
 * and not yet taken back: the run's automatic reset waits on it. */
export function avalancheHolds(state: Pick<GameState, "avalanche">): boolean {
  const v = state.avalanche?.victim;
  if (!v) return false;
  return v.phase !== "lost" || v.t < K.lostFor;
}

function push(
  state: GameState,
  events: GameEvent[],
  phase: "release" | "caught" | "buried" | "surfaced" | "escaped" | "stopped" | "lost" | "freed",
  s: Slide | null,
  x: number,
  z: number,
  depth: number,
): void {
  events.push({
    kind: "avalanche",
    t: state.t,
    phase,
    id: s ? s.id : 0,
    x,
    z,
    size: s ? s.volume : 0,
    depth,
  });
}
