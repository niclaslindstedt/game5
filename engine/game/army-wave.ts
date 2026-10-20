// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES — the army coming UP THE MOUNTAIN from the valley at a
// man it has hunted long enough (`WANTED.waves`, read with `groundWave`
// and counted with `wavesSent`): the longer he lasts and the more stars he
// carries, the bigger every wave, until the mountain below him is
// soldiers.
//
// THE COLUMN. A wave's men are brought up the valley and DISMOUNT out of
// his sight: `ARMY_WAVE.start` m down THE WAY UP from him — the ski area's
// own runs and cat tracks, from the one nearest him down the network each
// merges into to the village (`wayDown`) — and further while he could
// see the place, to `hidden` m. There they form a column of files, as
// many abreast as the run is wide, rank behind rank down it, and climb it:
// most on skis with skins (the skins' herringbone and their traverse up
// the steep, `army-troop.ts`), every `slog`th man on foot in his boots.
// A man leaves the column for the fight once he sees him within a rifle's
// range (`ARMY_GROUND.fire.range`), or is within `engage` m of where he was
// last seen, or has climbed the whole way: from
// there he is a soldier on the ground like any other (`army-ground.ts`'
// chase — the stop to fire, the arrest with SAFE FOR WORK on).
//
// THE SNOWMOBILES a wave brings are the army's own (`army-sled.ts`): a
// wave raises how many it keeps out on top of the roster's (`waveSleds`).
// The carriers, the trucks and the tanks a wave's mix names come up the
// same way from further down it (`army-vehicle.ts`).
//
// THE COST is bounded: `ARMY_WAVE.most` men of the waves out at once by
// stars, a man left far behind (`behind`) taken off the map, and — the
// hunt over — every man of them out of his sight (`home`).
//
// Nothing here draws from any stream: where a column forms, how it is laid
// and who walks are pure functions of the map, the state and the men's ids.
// `ArmyState.waves` stays 0 on a run whose hunt never reached two stars.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { ARMY_WAVE } from "./defs/army-wave.ts";
import { TUNING } from "./defs/tuning.ts";
import { enlist, goToward } from "./army-troop.ts";
import { fit } from "./army-lift.ts";
import { callVehicles } from "./army-vehicle.ts";
import { groundWave, quarryOf, seesQuarry, wavesSent } from "./wanted.ts";
import type { ArmyState, Soldier, WaveRoute } from "./army-state.ts";
import type { Run } from "../mapgen/types.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const K = ARMY_WAVE;
const dt = TUNING.dt;
/** A wave's squad: numbered past every lift's and snowmobile's. */
export const WAVE_SQUAD = 30_000;

type P = WaveRoute["pts"][number];
const n = { x: 0, y: 1, z: 0 };

// ─── the way up ────────────────────────────────────────────────────────

/** THE WAY DOWN from (x, z) to the valley, a point every `sample` m: the
 * ski area's run nearest him from its nearest point to its end, then the
 * run it merges into from where it does, and on to the village — the way
 * a column climbs, read backwards. On a map with no ski area, the fall
 * line straight down. */
export function wayDown(level: GameState["level"], x: number, z: number): P[] {
  const runs: readonly Run[] = level.resort?.runs ?? [];
  let run: Run | null = null;
  let at = 0;
  let best = Infinity;
  for (const r of runs) {
    // A link lane ends at a lift's foot, not in the valley.
    if (r.to) continue;
    const pts = r.points;
    for (let i = 0; i < pts.length; i += 4) {
      const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
      if (d < best) {
        best = d;
        run = r;
        at = i;
      }
    }
  }
  if (!run) return fallLine(level, x, z);
  const out: P[] = [];
  let next = -Infinity;
  for (let guard = 0; run && guard < 32; guard++) {
    const pts = run.points;
    for (let i = at; i < pts.length; i++) {
      const p = pts[i];
      if (p.s < next) continue;
      out.push({ x: p.x, z: p.z, w: p.width });
      next = p.s + K.sample;
    }
    const into: Run["into"] = run.into;
    if (!into) break;
    const to: Run | undefined = runs.find((r) => r.id === into.run);
    if (!to) break;
    run = to;
    at = Math.max(
      0,
      to.points.findIndex((p) => p.s >= into.s),
    );
    next = -Infinity;
  }
  return out.length >= 2 ? out : fallLine(level, x, z);
}

/** The fall line down from (x, z), a point every `sample` m, to `hidden`
 * m and a column's length past it or the map's edge. */
function fallLine(level: GameState["level"], x: number, z: number): P[] {
  const out: P[] = [{ x, z, w: 16 }];
  const edge = 20;
  for (let d = 0; d < K.hidden + 200; d += K.sample) {
    level.normalAt(x, z, n);
    const h = hypot(n.x, n.z);
    if (h < 1e-3) break;
    x += (n.x / h) * K.sample;
    z += (n.z / h) * K.sample;
    if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) break;
    out.push({ x, z, w: 16 });
  }
  return out;
}

/** THE WAY CARRIED ON STRAIGHT along its last line, a point every
 * `sample` m, until it is `apart` m and a column's length from `q`, or at
 * the map's edge. */
function extend(level: GameState["level"], down: P[], q: { x: number; z: number }): void {
  const edge = 20;
  const a = down[Math.max(0, down.length - 2)];
  const b = down[down.length - 1];
  let fx = b.x - a.x;
  let fz = b.z - a.z;
  if (hypot(fx, fz) < 1e-3) {
    fx = b.x - q.x;
    fz = b.z - q.z;
  }
  if (hypot(fx, fz) < 1e-3) {
    // No line to carry on (a way of one point, on the flat valley floor):
    // away from the summit, or from the map's middle on a map without one.
    const top = level.mountain?.summit ?? { x: level.size / 2, z: level.size / 2 };
    fx = b.x - top.x;
    fz = b.z - top.z;
    if (hypot(fx, fz) < 1e-3) fz = 1;
  }
  const f = hypot(fx, fz);
  let { x, z } = b;
  // Bounded: a straight line leaves the circle round him, or the map.
  for (let i = 0; i < level.size / K.sample + 1 && hypot(x - q.x, z - q.z) < K.apart + 60; i++) {
    x += (fx / f) * K.sample;
    z += (fz / f) * K.sample;
    if (x < edge || z < edge || x > level.size - edge || z > level.size - edge) break;
    down.push({ x, z, w: 16 });
  }
}

/** Whether he, at `q`, could see a column formed up at (x, z). */
function inHisSight(
  state: GameState,
  x: number,
  z: number,
  q: { x: number; y: number; z: number },
) {
  const y = state.level.groundAt(x, z) + 1.6;
  return seesQuarry(state.level, { kind: "soldier", x, y, z }, q);
}

// ─── the waves ─────────────────────────────────────────────────────────

/** A WAVE sent up the mountain: the snowmobiles it keeps out, and its
 * men on foot formed up in a column out of his sight down the way up and
 * set climbing it. */
function sendWave(state: GameState, a: ArmyState, w: WantedState, events: GameEvent[]): void {
  const mix = groundWave(w.stars, a.waves);
  const id = a.waves++;
  if (!mix) return;
  a.waveSleds = Math.min(K.sleds, mix.snowmobiles);
  let live = 0;
  for (const s of a.troops) if (s.from === "wave" && fit(s)) live++;
  const men = Math.max(0, Math.min(mix.foot, K.most[w.stars] - live));
  const q = quarryOf(state);
  const down = wayDown(state.level, q.x, q.z);
  // A way that ends near him (he is low on the mountain): on down the fall
  // line from its end, so the column still forms out of the way.
  const end = down[down.length - 1];
  if (hypot(end.x - q.x, end.z - q.z) < K.apart) {
    for (const p of fallLine(state.level, end.x, end.z).slice(1)) {
      // ...as long as it leads away from him.
      const last = down[down.length - 1];
      if (hypot(p.x - q.x, p.z - q.z) <= hypot(last.x - q.x, last.z - q.z)) break;
      down.push(p);
    }
    // ...and where even that stays near him (he is down on the valley
    // floor), straight on along the way's last line to the open valley.
    extend(state.level, down, q);
  }
  // Where it forms up: `start` m down the way, and on while he could see it.
  const path = [0];
  for (let k = 1; k < down.length; k++)
    path.push(path[k - 1] + hypot(down[k].x - down[k - 1].x, down[k].z - down[k - 1].z));
  const apart = (k: number) => hypot(down[k].x - q.x, down[k].z - q.z);
  let k0 = path.findIndex((d, k) => d >= K.start && apart(k) >= K.apart);
  if (k0 < 0) {
    // Never so far off: the furthest from him the way goes.
    k0 = 0;
    for (let k = 1; k < down.length; k++) if (apart(k) > apart(k0)) k0 = k;
  }
  while (
    k0 < down.length - 1 &&
    path[k0] < K.hidden &&
    apart(k0 + 1) >= apart(k0) - K.sample &&
    inHisSight(state, down[k0].x, down[k0].z, q)
  )
    k0++;
  // THE VEHICLES it brings, up the same way from further down it.
  callVehicles(state, a, w, mix, id, down, path, k0, events);
  const head = down[k0];
  events.push({
    kind: "army",
    t: state.t,
    change: "wave",
    id,
    x: head.x,
    y: state.level.groundAt(head.x, head.z),
    z: head.z,
  });
  if (men === 0) return;
  // THE COLUMN: rank behind rank down the way from its head.
  const across = (p: P) => clamp(Math.floor((p.w - 2 * K.margin) / K.gap) + 1, 1, K.abreast);
  const ranks: number[] = [];
  let placed = 0;
  for (let r = 0; placed < men; r++) {
    const want = path[k0] + r * K.rank;
    let k = k0;
    while (k < down.length - 1 && path[k] < want) k++;
    ranks.push(k);
    placed += across(down[k]);
  }
  // The way up, climbed from the column's tail to him.
  const tail = ranks[ranks.length - 1];
  const pts = down.slice(0, tail + 1).reverse();
  const squad = WAVE_SQUAD + id;
  a.routes.push({ squad, pts });
  let made = 0;
  for (let r = 0; r < ranks.length && made < men; r++) {
    const k = ranks[r];
    const p = down[k];
    const up = k > 0 ? down[k - 1] : p;
    const heading = Math.atan2(up.x - p.x, up.z - p.z);
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    const m = Math.min(across(p), men - made);
    for (let c = 0; c < m; c++) {
      // Each man a little off his file and his rank (his id's own), so
      // the column reads as men, not a grid.
      const j = a.nextSoldier;
      const lane = (c - (m - 1) / 2) * K.gap + (((j * 0.618) % 1) - 0.5) * 1.2;
      const back = (((j * 0.382) % 1) - 0.5) * 1.5;
      const role: Soldier["role"] = j % K.slog === K.slog - 1 ? "foot" : "rifle";
      const x = p.x + rx * lane - Math.sin(heading) * back;
      const z = p.z + rz * lane - Math.cos(heading) * back;
      const s = enlist(state, a, role, "wave", squad, "climb", x, z, heading);
      s.leg = tail - k + 1;
      s.lane = lane;
      made++;
    }
  }
  a.marched += made;
}

/** SEND THE WAVES the hunt has come to: counted at the star he carries
 * from when he reached it, each one bigger than the last. */
export function sendWaves(state: GameState, a: ArmyState, w: WantedState, events: GameEvent[]) {
  if (a.waveStar !== w.stars) {
    a.waveStar = w.stars;
    a.waveAt = 0;
  }
  const due = wavesSent(w, state.t);
  while (a.waveAt < due) {
    a.waveAt++;
    sendWave(state, a, w, events);
  }
}

/** THE WAVES' MEN SENT HOME: left far behind him while the hunt runs, or
 * — the hunt over — out of his sight; and the ways up nobody climbs any
 * more let go. */
export function retireWaves(state: GameState, a: ArmyState, w: WantedState, on: boolean): void {
  const q = quarryOf(state);
  for (const s of a.troops) {
    if (s.from !== "wave" || s.mode === "arrest" || s.mode === "cover") continue;
    const d = on ? hypot(s.x - w.lastSeen.x, s.z - w.lastSeen.z) : hypot(s.x - q.x, s.z - q.z);
    if (d > (on ? K.behind : K.home)) s.mode = "gone";
  }
  if (a.routes.length === 0) return;
  a.routes = a.routes.filter((r) =>
    a.troops.some((s) => s.squad === r.squad && s.mode === "climb"),
  );
}

/** ONE STEP OF A MAN CLIMBING WITH HIS WAVE: on up the way to the next
 * point of it, on his own file; true once he is to leave the column for
 * the fight — he sees him in range, is near where he was last seen, or has climbed
 * the whole way. */
export function climbWithWave(
  state: GameState,
  a: ArmyState,
  s: Soldier,
  w: WantedState,
  sees: boolean,
): boolean {
  const q = quarryOf(state);
  const to = w.seen ? q : w.lastSeen;
  const route = a.routes.find((r) => r.squad === s.squad);
  const d = hypot(to.x - s.x, to.z - s.z);
  if (!route || (sees && d < ARMY_GROUND.fire.range) || d < K.engage) return true;
  const pts = route.pts;
  let tx = 0;
  let tz = 0;
  for (;;) {
    if (s.leg >= pts.length) return true;
    const p = pts[s.leg];
    const b = pts[Math.max(0, s.leg - 1)];
    const len = Math.max(0.1, hypot(p.x - b.x, p.z - b.z));
    const fx = (p.x - b.x) / len;
    const fz = (p.z - b.z) / len;
    // On his own file: off the line by his lane, kept on the run.
    const lane = clamp(s.lane, -(p.w / 2 - K.margin), p.w / 2 - K.margin);
    tx = p.x + fz * lane;
    tz = p.z - fx * lane;
    const past = (s.x - tx) * fx + (s.z - tz) * fz;
    if (hypot(tx - s.x, tz - s.z) > K.reach && past < 0) break;
    s.leg++;
  }
  // Caught on something (a side-step running): a point further on.
  if (s.slow >= 2 && s.until > state.t && s.until - state.t < dt * 1.5) s.leg++;
  goToward(state, s, a.troops, tx, tz);
  return false;
}
