// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS, taken off the state about twelve times a second. The
// canvas is the sixty-frame surface; the HUD is not, and a readout that
// re-rendered every frame would spend more on the DOM than on the snow. So
// the loop takes THIS every ~80 ms and the HUD draws from it. DOM-free — a
// snapshot is numbers, and the same numbers a lab could print.
//
// Nothing in here decides anything: the speed is the engine's `speed`, the
// edge is the engine's own edge against the pair's full edge, the gate
// count is the progress the engine keeps, the place is `racePlace` and the
// standings are `fieldOrder`. A number that decided an outcome would be a
// rule in the shell (§23.2), and there are none.

import {
  TUNING,
  bearingToNext,
  fieldOrder,
  racePlace,
  trenched,
  type GameState,
  type Progress,
} from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";
import { buildMinimap, type HudMinimap } from "./minimap-view.ts";
import { splitGap, type RunLedger } from "./records.ts";
import { comboTile, type TrickTile } from "./trick-tile.ts";

/** The brake's share past which the edge bar says the skid is on. */
const BRAKE_SHOWN = 0.05;

/** How long GO stays on screen after the lights go out, s of race clock. */
const GO_HOLD = 1;

/** How long the SPLIT chip holds the clock at the last gate, s of run
 * clock — long enough to read it off the corner between two gates, gone
 * before the next so a stale split is never read as a fresh one. */
const SPLIT_HOLD = 6;

/** One skier on the finish plate's table. */
export type Standing = {
  /** 1-based, in `fieldOrder`'s order. */
  place: number;
  /** Start-line slot, 1-based: the player is 1, the rivals 2… — what a
   * rival is called on the table (`strings.ts`). */
  slot: number;
  you: boolean;
  /** The run clock at the finish, or null while still out on the piste. */
  time: number | null;
  /** Gates taken, for a skier still out. */
  taken: number;
};

export type HudSnapshot = {
  speedKmh: number;
  /** THE EDGE the skis stand on, as a share of the pair's full edge at a
   * standstill, -1..1 — SCREEN-space, so positive is the skis tipped to
   * the player's right. */
  edge: number;
  /** THE TUCK the body is actually in, 0 standing tall … 1 folded — the
   * bar's speed line. */
  tuck: number;
  /** The skid is on (the body's own reading of the brake, after its lag). */
  braking: boolean;
  /** The run clock, s, and whether it has stopped. */
  time: number;
  finished: boolean;
  /** THE LIGHTS: the whole second showing (3, 2, 1) while they hold the
   * field, and 0 once they are out. `go` is the moment after, read off the
   * engine's clock so nothing here keeps time. */
  countdown: number;
  go: boolean;
  /** THE FIELD: where the skier stands, 1-based, and how many are in it. */
  place: number;
  skiers: number;
  /** Gates taken — the start gate the first — and how many the piste has,
   * the finish the last. */
  taken: number;
  gates: number;
  /** THE VERTICAL DROPPED since the start line, m of height. */
  dropped: number;
  /** The run clock at the last gate taken, while it is fresh; null
   * otherwise. */
  split: number | null;
  /** THE GAP to the record at that same crossing, s — negative is ahead —
   * while the split is up and there is a row to be measured against. */
  gap: number | null;
  /** The mode being ridden, and the record standing when the run began
   * (`records.ts`) — what the finish plate bills the result against. */
  mode: RunLedger["mode"];
  best: { time: number; skis: string; at: number } | null;
  /** THE AIR CLOCK, s — the flight so far, and 0 until it has lasted
   * `TUNING.air.counts`: a hop off a bump is not air time, and a readout
   * that counted it would flicker through every mogul. */
  airTime: number;
  /** The flight in progress is the race's longest so far. */
  airBest: boolean;
  /** THE MISSED GATE: where it is as a SCREEN angle, rad clockwise from
   * straight ahead, and how far, m — or null with nothing owed. */
  missed: { angle: number; distance: number } | null;
  seed: number;
  /** A FREE RIDE: no field, no gates owed — the HUD shows the run's best
   * air and the distance skied in their place. */
  free: boolean;
  /** The run's longest flight so far, s. */
  bestAir: number;
  /** How far has been skied, m. */
  distance: number;
  /** THE FINISH: the player's own result once he is through the finish,
   * and the whole field's table under it — live, because the field is
   * still coming down behind him. Null until then. */
  result: { place: number; time: number } | null;
  standings: Standing[] | null;
  /** THE MINIMAP: the plate's pose and every mark on it
   * (`minimap-view.ts`). */
  minimap: HudMinimap;
  /** BOGGED: the skier is sunk to the knees in powder (`trench.ts`) and
   * must pole out — the standing hint, up while he is. */
  stuck: boolean;
  /** THE DAMAGE INSTRUMENT: each part 0 sound … 1 wrecked, or null on a
   * run without damage (`GameState.damage`). */
  damage: { skiLeft: number; skiRight: number; legs: number } | null;
  /** THE SCORE over the nose (`trick-tile.ts`), on a tricks run; null on
   * any other. */
  tricks: TrickTile | null;
};

/** Gates taken so far, the start gate counted as the first, and never
 * more than the piste has: before the start gate none; through the finish,
 * all of them. */
export function gatesTaken(p: Progress, gates: number): number {
  if (p.finished) return gates;
  if (!p.started) return 0;
  return Math.min(gates, p.passed);
}

/** THE TABLE: every skier in `fieldOrder`'s order. */
export function standingsOf(state: GameState): Standing[] {
  const gates = state.level.checkpoints.length;
  return fieldOrder(state).map((id, i) => {
    const rival = id === null ? null : state.rivals.find((r) => r.id === id);
    const run = rival ? rival.run : state;
    const p = run.progress;
    return {
      place: i + 1,
      slot: id === null ? 1 : id + 2,
      you: id === null,
      time: p.finished ? p.time : null,
      taken: gatesTaken(p, gates),
    };
  });
}

/** The vertical dropped since the start line, m: the snow under the start
 * line less the snow under the skier — never negative, so a hike back up to
 * a missed gate reads as nothing dropped rather than a climb. */
export function droppedOf(state: GameState): number {
  const { level, skier } = state;
  const top = level.groundAt(level.spawn.x, level.spawn.z);
  return Math.max(0, top - level.groundAt(skier.x, skier.z));
}

/** A run with no book behind it: a race, measured against nothing. */
const NO_LEDGER: RunLedger = { mode: "race", standing: null };

export function takeSnapshot(state: GameState, ledger: RunLedger = NO_LEDGER): HudSnapshot {
  const c = state.skier;
  const p = state.progress;
  const n = state.level.checkpoints.length;
  const last = p.lastCheckpoint;
  const lastAt = last >= 0 ? p.splits[last] : Number.NaN;
  const airTime = c.airborne && c.airTime > TUNING.air.counts ? c.airTime : 0;
  const split =
    Number.isFinite(lastAt) && p.time - lastAt < SPLIT_HOLD && !p.finished ? lastAt : null;
  const standing = ledger.standing;
  const owed = p.missed !== null ? bearingToNext(state) : null;
  return {
    speedKmh: c.speed * 3.6,
    edge: (c.edge / c.spec.edgeMax) * SCREEN_TO_ENGINE,
    tuck: c.crouch,
    braking: c.brake > BRAKE_SHOWN,
    time: p.time,
    finished: p.finished,
    countdown: state.phase === "countdown" ? Math.ceil(state.countdown) : 0,
    go: state.rules.countdown > 0 && state.phase !== "countdown" && p.time < GO_HOLD,
    place: racePlace(state),
    skiers: state.rivals.length + 1,
    taken: gatesTaken(p, n),
    gates: n,
    dropped: droppedOf(state),
    split,
    gap: split !== null ? splitGap(standing, p.passed - 1, split) : null,
    mode: ledger.mode,
    best: standing ? { time: standing.value, skis: standing.skis, at: standing.at } : null,
    airTime,
    airBest: airTime > 0 && airTime > p.bestAir,
    missed: owed ? { angle: owed.error * SCREEN_TO_ENGINE, distance: owed.distance } : null,
    seed: state.seed,
    free: !state.rules.course,
    bestAir: p.bestAir,
    distance: p.distance,
    result: p.finished ? { place: racePlace(state), time: p.time } : null,
    standings: p.finished ? standingsOf(state) : null,
    minimap: buildMinimap(state),
    stuck: trenched(c.trench) && c.thrown === null,
    damage: state.damage
      ? {
          skiLeft: c.damage.ski[0],
          skiRight: c.damage.ski[1],
          legs: c.damage.legs,
        }
      : null,
    tricks: comboTile(state),
  };
}
