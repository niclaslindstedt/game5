// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL: the army hunting a skier who stole a helicopter.
//
// Five stars. An OFFENCE raises the heat (`raiseHeat` — THE hook: the
// theft of the air ambulance or the police helicopter calls it) to at
// least its floor and a star more than he had; from then on the hunt
// itself climbs it — a star every `WANTED.climb` s while a pursuer has him
// in sight, at half that pace while they only search — so the longer he
// survives, the worse it gets. What each star sends is `WANTED.roster`
// (the helicopters, the door gunners, the soldiers on skis, the
// snowmobiles, the rules of fire) and `WANTED.waves` (the ground waves up
// the mountain); the parts that fly, ski and drive them read those rows
// and write where every one of them is into `pursuers`.
//
// SEEN OR SEARCHING: every `lookEvery` s each pursuer looks — near enough
// for his kind (`WANTED.sight`) and with no ground between his eyes and the
// skier's chest (`seesQuarry`). For `fix` s after an offence they know
// where he is whatever they see. Seen, the stars are solid and the search
// centres on him; out of every pursuer's sight, they flash, and once he
// has stayed out of sight for `WANTED.lose` s the stars are dropped.
//
// THE SURVIVAL TIMER starts at the first raise and stops when the hunt
// ends: the stars lost, the skier dead, or — with SAFE FOR WORK on, where
// the army does not kill — ARRESTED (`arrestSkier`), which ends the run.
//
// Nothing here draws from any stream, and `GameState.wanted` is absent
// until the heat is first raised, so a run that never raises it moves no
// digest.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { treesNear } from "./upright-grid.ts";
import {
  WANTED,
  type GroundWaves,
  type WantedCause,
  type WantedRoster,
  type WaveMix,
} from "./defs/wanted.ts";
import type { Level } from "../mapgen/types.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { Pursuer, WantedState } from "./wanted-state.ts";

/** Where the hunted man is, world frame, m: his body — or the machine he
 * rides, whose seat carries him. */
export function quarryOf(state: GameState): { x: number; y: number; z: number } {
  const m =
    (state.heli?.rider && state.heli) ||
    (state.plane?.rider && state.plane) ||
    (state.sled?.rider && state.sled) ||
    (state.armour?.rider && state.armour.body) ||
    null;
  const c = m ?? state.skier;
  return { x: c.x, y: c.y, z: c.z };
}

/** A WANTED LEVEL at nothing, the hunt's clock at `t`. */
export function freshWanted(state: GameState): WantedState {
  const q = quarryOf(state);
  return {
    stars: 0,
    heat: 0,
    seen: false,
    unseen: 0,
    fix: 0,
    lastSeen: q,
    look: 0,
    pursuers: [],
    lethal: !state.rules.sfw,
    since: state.t,
    stopped: null,
    ended: null,
    endedAt: 0,
    peak: 0,
    reached: [state.t, NaN, NaN, NaN, NaN, NaN],
    cause: null,
  };
}

/** The wanted level ready for a raise: made on the first, and begun again
 * after a hunt he escaped. Null once a hunt ended in his arrest or death —
 * that run is over. */
function huntOf(state: GameState): WantedState | null {
  const w = state.wanted;
  if (!w) return (state.wanted = freshWanted(state));
  if (w.ended === "arrested" || w.ended === "killed") return null;
  if (w.ended === "escaped" || w.stars === 0) {
    const again = freshWanted(state);
    again.pursuers = w.pursuers;
    state.wanted = again;
    return again;
  }
  return w;
}

/** Set the heat to `heat` star units and say what the stars did. */
function heatTo(state: GameState, w: WantedState, heat: number, cause?: WantedCause): void {
  const was = w.stars;
  w.heat = Math.max(0, Math.min(WANTED.maxStars, heat));
  const stars = Math.min(WANTED.maxStars, Math.floor(w.heat));
  if (stars === was) return;
  w.stars = stars;
  for (let s = was + 1; s <= stars; s++) w.reached[s] = state.t;
  w.peak = Math.max(w.peak, stars);
  state.events.push({
    kind: "wanted",
    t: state.t,
    change: stars > was ? "raised" : "lowered",
    stars,
    ...(cause ? { cause } : {}),
  });
}

/** THE OFFENCE they now know about: they know where he is (`WANTED.fix`
 * s) and look again at once. */
function spotted(state: GameState, w: WantedState): void {
  w.fix = WANTED.fix;
  w.unseen = 0;
  w.look = 0;
  w.lastSeen = quarryOf(state);
  if (!w.seen) {
    w.seen = true;
    if (w.stars > 0)
      state.events.push({ kind: "wanted", t: state.t, change: "seen", stars: w.stars });
  }
}

/** RAISE THE HEAT for an offence — THE HOOK the steal-a-helicopter code
 * calls (`stole-ambulance`, `stole-police`) and the later parts call for
 * what he does to the army (`downed-helicopter`, `hit-soldier`): a star
 * (or its `add`) more than he had, to at least the offence's `floor`.
 * Makes the wanted level on the run's first offence. Returns the stars he
 * carries now (0 once a hunt ended in his arrest or death). */
export function raiseHeat(state: GameState, cause: WantedCause): number {
  const w = huntOf(state);
  if (!w) return 0;
  const o = WANTED.offences[cause] ?? WANTED.offences.dev;
  w.cause = cause;
  heatTo(state, w, Math.max(w.heat + o.add, o.floor), cause);
  spotted(state, w);
  return w.stars;
}

/** SET THE STARS to `stars` exactly (0..5) — a link's `?wanted=N`, the
 * developer page's row. 0 drops them as a search run out would. */
export function setWanted(state: GameState, stars: number): void {
  const n = Math.max(0, Math.min(WANTED.maxStars, Math.round(stars)));
  if (n === 0) {
    if (state.wanted && state.wanted.stars > 0) loseStars(state, state.wanted);
    return;
  }
  const w = huntOf(state);
  if (!w) return;
  w.cause = "dev";
  heatTo(state, w, n, "dev");
  spotted(state, w);
}

/** THE STARS DROPPED: a search that ran out (or a hand that cleared them).
 * The survival timer stops; the pursuers are the later parts' to send
 * home. */
function loseStars(state: GameState, w: WantedState): void {
  w.stars = 0;
  w.heat = 0;
  w.seen = false;
  w.fix = 0;
  endHunt(state, w, "escaped");
  state.events.push({ kind: "wanted", t: state.t, change: "lost", stars: 0 });
}

function endHunt(state: GameState, w: WantedState, how: "escaped" | "arrested" | "killed"): void {
  w.ended = how;
  w.endedAt = state.t;
  w.stopped = state.t;
}

/** THE ARREST: with SAFE FOR WORK on the army takes him in rather than
 * kill him — a soldier who reaches him (`WANTED.arrest.reach`) calls this.
 * The hunt ends `arrested`, the survival timer stops and the app ends the
 * run. Refused (false) where the army shoots to kill, or nobody hunts him. */
export function arrestSkier(state: GameState): boolean {
  const w = state.wanted;
  if (!w || w.lethal || w.ended !== null || w.stars === 0) return false;
  endHunt(state, w, "arrested");
  w.seen = true;
  state.events.push({ kind: "wanted", t: state.t, change: "arrested", stars: w.stars });
  return true;
}

/** Seconds since the army took him in, or null: it has not. */
export function arrestedOf(state: GameState): number | null {
  const w = state.wanted;
  return w && w.ended === "arrested" ? Math.max(0, state.t - w.endedAt) : null;
}

/** THE TIME SURVIVED this hunt, s — still counting while it runs. */
export function survivedOf(w: WantedState, t: number): number {
  return Math.max(0, (w.stopped ?? t) - w.since);
}

/** WHAT `stars` SEND: the roster row (none past the table's ends). */
export function rosterOf(stars: number): WantedRoster {
  const i = Math.max(0, Math.min(WANTED.maxStars, Math.floor(stars)));
  return WANTED.roster[i];
}

/** THE `n`TH GROUND WAVE (0 the first) a hunt at `stars` sends up the
 * mountain, or null where that star sends none: each kind its base plus
 * its growth for every wave before, rounded down, up to its cap. */
export function groundWave(stars: number, n: number): WaveMix | null {
  const i = Math.max(0, Math.min(WANTED.maxStars, Math.floor(stars)));
  const row: GroundWaves | null = WANTED.waves[i];
  if (!row) return null;
  const k = Math.max(0, Math.floor(n));
  const of = (key: keyof WaveMix): number =>
    Math.min(row.cap[key], Math.floor(row.base[key] + row.grow[key] * k));
  return {
    snowmobiles: of("snowmobiles"),
    tracked: of("tracked"),
    trucks: of("trucks"),
    tanks: of("tanks"),
    foot: of("foot"),
  };
}

/** How many ground waves a hunt at `stars` has sent by now: counted from
 * when it reached the star (`WantedState.reached`). */
export function wavesSent(w: WantedState, t: number): number {
  const row = WANTED.waves[w.stars];
  const at = w.reached[w.stars];
  if (!row || !Number.isFinite(at)) return 0;
  const after = t - at - row.first;
  return after < 0 ? 0 : 1 + Math.floor(after / row.every);
}

/** WHETHER PURSUER `p` SEES THE MAN at `q` (his feet, world frame, m):
 * within his kind's sight (`WANTED.sight`), or near enough to hear
 * (`WANTED.close`), with no ground rising between his eyes and the man's
 * chest — and from a man on the snow, no woods between them
 * (`throughWoods`); from the air, not `cover`ed (`underCover`) past
 * `WANTED.cover.near`. */
export function seesQuarry(
  level: Pick<Level, "groundAt">,
  p: Pick<Pursuer, "kind" | "x" | "y" | "z">,
  q: { x: number; y: number; z: number },
  cover = false,
): boolean {
  const L = WANTED.line;
  const tx = q.x;
  const ty = q.y + L.chest;
  const tz = q.z;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dz = tz - p.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d <= WANTED.close) return true;
  if (d > WANTED.sight[p.kind]) return false;
  // UNDER COVER (`underCover`): stood under a crown, hidden from aloft.
  if (cover && !LOW.has(p.kind) && d > WANTED.cover.near) return false;
  const run = Math.sqrt(dx * dx + dz * dz);
  const n = Math.floor(run / L.step);
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const x = p.x + dx * k;
    const z = p.z + dz * k;
    if (level.groundAt(x, z) + L.clear > p.y + dy * k) return false;
  }
  // THE WOODS hide him from a man on the snow: a line through `woods`
  // crowns is blocked. From the air a man under the trees is seen between
  // them, so the woods hide nothing from aloft.
  if (LOW.has(p.kind) && "trees" in level) {
    if (throughWoods(level as Level, p.x, p.y, p.z, tx, ty, tz)) return false;
  }
  return true;
}

/** The pursuers who look from the snow, whom the woods hide him from. */
const LOW: ReadonlySet<Pursuer["kind"]> = new Set(["soldier", "snowmobile", "vehicle"]);
const crowns: number[] = [];

/** WHETHER THE LINE from (x0, y0, z0) to (x1, y1, z1) PASSES THROUGH THE
 * WOODS: through the crowns of `WANTED.line.woods` trees or more — a
 * crown read as a cone from the trunk's foot, `crown` of its height
 * across at its base. */
export function throughWoods(
  level: Level,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): boolean {
  const L = WANTED.line;
  const run = hypot(x1 - x0, z1 - z0);
  const n = Math.floor(run / L.woodStep);
  const met: number[] = [];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k;
    const z = z0 + (z1 - z0) * k;
    const y = y0 + (y1 - y0) * k;
    for (const t of treesNear(level, x, z, L.woodStep, crowns)) {
      if (met.includes(t)) continue;
      const tree = level.trees[t];
      const up = y - tree.y;
      if (up < 0.5 || up > tree.height) continue;
      // The cone narrows to its tip: its reach at this height.
      const reach = Math.max(tree.radius, L.crown * tree.height * (1 - up / tree.height));
      if (hypot(tree.x - x, tree.z - z) > reach) continue;
      met.push(t);
      if (met.length >= L.woods) return true;
    }
  }
  return false;
}

/** WHETHER HE IS UNDER COVER from the air: on foot (no machine carrying
 * him), slower than `WANTED.cover.speed`, a tree's crown over his head. */
export function underCover(state: GameState): boolean {
  const C = WANTED.cover;
  const c = state.skier;
  if (quarryOf(state).x !== c.x || hypot(c.vx, c.vz) > C.speed) return false;
  const L = WANTED.line;
  for (const t of treesNear(state.level, c.x, c.z, 8, crowns)) {
    const tree = state.level.trees[t];
    const up = c.y + C.head - tree.y;
    if (up < 0 || up > tree.height) continue;
    const reach = Math.max(tree.radius, L.crown * tree.height * (1 - up / tree.height)) * C.crown;
    if (hypot(tree.x - c.x, tree.z - c.z) <= reach) return true;
  }
  return false;
}

/** Whether any pursuer out has him in sight. */
function anySees(state: GameState, w: WantedState): boolean {
  if (w.pursuers.length === 0) return false;
  const q = quarryOf(state);
  const cover = underCover(state);
  for (const p of w.pursuers) if (seesQuarry(state.level, p, q, cover)) return true;
  return false;
}

/** THE WANTED LEVEL'S STEP, on a run that has one: the death that ends
 * it, the look, the climb of the heat, the search running out. */
export function stepWanted(state: GameState, events: GameEvent[]): void {
  const w = state.wanted;
  if (!w || w.ended !== null || w.stars === 0) return;
  const dt = TUNING.dt;
  if (state.gore && state.gore.dead >= 0) {
    endHunt(state, w, "killed");
    return;
  }
  w.fix = Math.max(0, w.fix - dt);
  w.look -= dt;
  if (w.look <= 0) {
    w.look += WANTED.lookEvery;
    const seen = w.fix > 0 || anySees(state, w);
    if (seen !== w.seen) {
      w.seen = seen;
      events.push({
        kind: "wanted",
        t: state.t,
        change: seen ? "seen" : "searching",
        stars: w.stars,
      });
    }
    if (seen) w.lastSeen = quarryOf(state);
  }
  if (w.seen) w.unseen = 0;
  else w.unseen += dt;
  if (!w.seen && w.unseen >= WANTED.lose[w.stars]) {
    loseStars(state, w);
    return;
  }
  // THE LONGER HE SURVIVES, the hotter it gets.
  const climb = WANTED.climb[w.stars];
  if (Number.isFinite(climb)) {
    const pace = w.seen ? 1 : WANTED.searchClimb;
    heatTo(state, w, w.heat + (dt * pace) / climb);
  }
}
