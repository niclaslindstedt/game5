// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI — a free ride's lodges open their doors (`RunRules.afterski`).
// The AFTERSKI LODGES stand where the ski area keeps them (`cabins.ts`'s
// `placeLodges`: one on the valley floor, and on most maps one part way
// down): a skier who skis up to the racks before a lodge's terrace and
// stops there gives THE MACHINE PRESS (`SkierInput.machine`: ENTER, a
// double tap on touch) — the press the snowmobile and the helicopter are
// taken on — racks his skis and goes IN. Inside, the step is the lodge's:
// he stands at the bar and on the dance floor, a beer in his hand every
// `AFTERSKI.beers.every` s (the jump press orders the next one at once),
// each raising THE BUZZ (`SkierState.buzz`, `buzz.ts`). The same press
// takes him out again: stood before the racks with his skis back on,
// facing his run, and whatever the beer has done to him goes with him.
//
// Pure over the level, the state and the clock: a lodge is a pure function
// of the map, nothing here draws from the stream, and a run whose rules
// open no lodge never comes in here.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { cabinsOf, type Cabin } from "./cabins.ts";
import { standSkier } from "./course.ts";
import { AFTERSKI } from "./defs/afterski.ts";
import { CABINS } from "./defs/cabins.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Level } from "../mapgen/types.ts";
import type { AfterskiState, GameEvent, GameState, SkierInput } from "./state.ts";

const dt = TUNING.dt;
const B = AFTERSKI.beers;

const lodges = new WeakMap<Level, Cabin[]>();

/** EVERY AFTERSKI LODGE of `level` (`Cabin.kind` "afterski"), the valley's
 * first. */
export function lodgesOf(level: Level): readonly Cabin[] {
  let list = lodges.get(level);
  if (!list) {
    list = cabinsOf(level).filter((c) => c.kind === "afterski");
    lodges.set(level, list);
  }
  return list;
}

/** THE DOOR of a lodge as a skier meets it: the spot on the snow before
 * the racks, `AFTERSKI.door` m out past the terrace's edge in the middle of
 * its front, and the way out of the door (the lodge's own heading). */
export function doorOf(lodge: Cabin): { x: number; z: number; heading: number } {
  const d = CABINS.afterski;
  const out = d.depth / 2 + d.reach.front + AFTERSKI.door;
  return {
    x: lodge.x + Math.sin(lodge.heading) * out,
    z: lodge.z + Math.cos(lodge.heading) * out,
    heading: lodge.heading,
  };
}

/** A run's afterski at the start: outside, nothing drunk. */
export function freshAfterski(): AfterskiState {
  return { inside: null, t: 0, beers: 0, total: 0, last: -1, sip: -1, out: null };
}

/** THE LODGE HE CAN GO INTO NOW, or null: on a run that opens the lodges,
 * on his skis (not thrown, not fetching them, not on a lift, in a tunnel
 * or on a machine), stopped — no faster than `AFTERSKI.slowest` — within
 * `AFTERSKI.reach` of a lodge's door. */
export function afterskiNear(run: GameState): Cabin | null {
  const a = run.afterski;
  if (!a || a.inside !== null || !run.rules.afterski) return null;
  const c = run.skier;
  if (c.thrown || c.fetch || c.lift || c.tunnel || c.jib) return null;
  if (run.heli?.rider || run.sled?.rider) return null;
  if (run.para && run.para.mode !== "dropped") return null;
  if (hypot3(c.vx, c.vy, c.vz) > AFTERSKI.slowest) return null;
  for (const lodge of lodgesOf(run.level)) {
    if (lodge.id === a.out) continue;
    const door = doorOf(lodge);
    if (hypot(c.x - door.x, c.z - door.z) <= AFTERSKI.reach) return lodge;
  }
  return null;
}

/** Clears `AfterskiState.out` once he is out of that door's reach. */
function walkedAway(run: GameState, a: AfterskiState): void {
  if (a.out === null) return;
  const lodge = lodgesOf(run.level).find((l) => l.id === a.out);
  const door = lodge ? doorOf(lodge) : null;
  const c = run.skier;
  if (!door || hypot(c.x - door.x, c.z - door.z) > AFTERSKI.reach) a.out = null;
}

/** Whether the machine press would take him into a lodge now. */
export function afterskiWithin(run: GameState): boolean {
  return afterskiNear(run) !== null;
}

/** The lodge he is inside, or null. */
export function insideOf(run: GameState): Cabin | null {
  const id = run.afterski?.inside;
  if (!id) return null;
  return lodgesOf(run.level).find((l) => l.id === id) ?? null;
}

/** ONE STEP OF THE AFTERSKI, before the skier is stepped: taken in on the
 * machine press, the beers inside, and out again on the same press. True
 * while he is inside — the step is the lodge's, and the snow, the trees and
 * his clock wait. `events` is the run's own list. */
/** IN: his skis in the rack, stood at `lodge`'s door — where he will be
 * stood again on the way out — the beers of this visit counted from none.
 * The machine press at the door (`stepAfterski`), or a run begun inside
 * (`CreateGameOptions.inLodge`). */
export function enterLodge(run: GameState, lodge: Cabin, events: GameEvent[]): void {
  const a = run.afterski;
  if (!a) return;
  const door = doorOf(lodge);
  standSkier(run, door.x, door.z, door.heading);
  a.inside = lodge.id;
  a.out = null;
  a.t = 0;
  a.beers = 0;
  a.last = -1;
  a.sip = -1;
  events.push({ kind: "afterski", t: run.t, phase: "in", beers: 0, buzz: run.skier.buzz ?? 0 });
}

export function stepAfterski(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const a = run.afterski;
  if (!a) return false;
  const c = run.skier;
  if (a.inside === null) {
    walkedAway(run, a);
    if (!input.machine) return false;
    const lodge = afterskiNear(run);
    if (!lodge) return false;
    enterLodge(run, lodge, events);
    return true;
  }
  // OUT on the same press: his skis back on, stood before the racks facing
  // his run.
  if (input.machine) {
    const lodge = insideOf(run);
    const door = lodge ? doorOf(lodge) : { x: c.x, z: c.z, heading: c.heading };
    standSkier(run, door.x, door.z, door.heading);
    a.out = a.inside;
    a.inside = null;
    a.sip = -1;
    events.push({ kind: "afterski", t: run.t, phase: "out", beers: a.beers, buzz: c.buzz ?? 0 });
    return true;
  }
  a.t += dt;
  // THE BEERS: the first `first` s in, then one every `every` s after the
  // last — or at once on the jump press, never sooner than `least` s after
  // the last — each drunk over `sip` s and finished into the buzz.
  if (a.sip < 0) {
    const due = a.beers === 0 ? B.first - B.sip : a.last + B.every - B.sip;
    const asked = input.jump === true && (a.last < 0 || a.t - a.last >= B.least);
    if (a.t >= due || asked) a.sip = 0;
  } else {
    a.sip += dt;
    if (a.sip >= B.sip) {
      a.sip = -1;
      a.beers++;
      a.total++;
      a.last = a.t;
      c.buzz = Math.min(1, (c.buzz ?? 0) + B.beer);
      events.push({ kind: "afterski", t: run.t, phase: "beer", beers: a.beers, buzz: c.buzz });
    }
  }
  // Held where he stands — nothing moves him inside.
  c.vx = c.vy = c.vz = 0;
  c.speed = 0;
  c.way = 0;
  return true;
}
