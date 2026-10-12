// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A WINGSUIT JUMP BEGINS — the CLIFF EXIT on a map (`wingsuitExitOf`:
// a point high on the mountain over its steepest ground, facing out over the
// drop, found by flying the start arc off each of the likeliest), the flyer
// stood on it (`standOnExit`), and the two ways into the suit's flight from
// elsewhere: out of a craft already moving (`suitExit`, off every craft in
// the air, and `wingsuitOut`) and a lab's moment in the air (`chute.ts`'s
// `skydiveAt` with its `suit`).
//
// The search reads only the map and the suit's own numbers, memoized per
// map: nothing here draws from the stream, so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { airDensity, airKelvin, airPressure, seaAltitude } from "./balloon-air.ts";
import { mendBody } from "./body.ts";
import { onFoot } from "./buzz.ts";
import { crownAt } from "./canopy.ts";
import { freshChute, type ChuteCraft, type ChuteState } from "./chute-state.ts";
import { standSkier } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import { WINGSUIT as W } from "./defs/wingsuit.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState } from "./state.ts";
import { freshWing, hoverHold, liftAndDrag, suitAero, suitUp, type SuitAero } from "./wingsuit.ts";

/** THE CLIFF EXIT: where he stands, m, the way he faces out over the drop,
 * rad, how much the start arc flown off it clears the snow by at the least,
 * m, and — where no edge on the map is steep enough for the start arc to
 * clear (a generated mountain's faces are steep, never sheer) — the height
 * over the snow there he is held at instead, m: a HOVER EXIT, stepped off a
 * helicopter's skid over the same drop (0 on a ledge). */
export type WingsuitExit = {
  x: number;
  z: number;
  y: number;
  heading: number;
  clear: number;
  hover: number;
};

const exits = new WeakMap<Level, WingsuitExit>();
const aero: SuitAero = { cL: 0, cp: 0, ci: 1, stalled: false };

/** THE START ARC flown off (x, z) facing `heading` — a point mass on the
 * suit's own lift and drag in the plane of its way, hands off — and the
 * least it clears the snow by over `search.arc` s, m. */
function arcClear(level: Level, x: number, z: number, heading: number, hover = 0): number {
  const S = W.search;
  const E = W.exit;
  const push = hover > 0 ? E.step : E.push;
  const dt = TUNING.dt * 2;
  const g = TUNING.g;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const ground = level.groundAt(x, z);
  let s = 0;
  let y = ground + S.stand + hover;
  let vs = push;
  let vy = hover > 0 ? 0 : E.up;
  let alpha = E.alpha;
  let pressure = 0;
  let least = Infinity;
  for (let t = 0; t < S.arc; t += dt) {
    const V = Math.max(0.5, hypot(vs, vy));
    const full = Math.min(
      1,
      Math.max(0, (V - W.pressure.from) / (W.pressure.full - W.pressure.from)),
    );
    pressure += (full - pressure) * (1 - Math.exp(-dt / W.pressure.time));
    if (V >= E.held) alpha += (W.trim.glide - alpha) * (1 - Math.exp(-dt));
    const alt = seaAltitude(level, y);
    const rho = airDensity(airPressure(alt), airKelvin(alt));
    suitAero(alpha, pressure, 0, 0, aero);
    const { L, D } = liftAndDrag(aero, rho * V * V);
    // Lift square to the way, up its side; drag down it.
    const ls = -vy / V;
    const ly = vs / V;
    vs += ((L * ls - (D * vs) / V) / S.mass) * dt;
    vy += ((L * ly - (D * vy) / V) / S.mass - g) * dt;
    s += vs * dt;
    y += vy * dt;
    if (t > 0.1) least = Math.min(least, y - W.body - level.groundAt(x + fx * s, z + fz * s));
  }
  return least;
}

/** THE CLIFF EXIT on `level` (`WINGSUIT.search`). Off a map with no
 * mountain (a lab's), the piste's head, facing down it. */
export function wingsuitExitOf(level: Level): WingsuitExit {
  const known = exits.get(level);
  if (known) return known;
  const S = W.search;
  const m = level.mountain;
  const head = level.track.points[0];
  let found: WingsuitExit = {
    x: head.x,
    z: head.z,
    y: head.y,
    heading: head.heading,
    clear: -Infinity,
    hover: 0,
  };
  if (m) {
    const low = m.base.y + m.vertical * (1 - S.top);
    // The likeliest: the steepest drops ahead of a point, the higher the
    // likelier (the longer the flight off it), kept sorted.
    const likely: { x: number; z: number; y: number; heading: number; drop: number }[] = [];
    for (let x = S.margin; x <= level.size - S.margin; x += S.grid) {
      for (let z = S.margin; z <= level.size - S.margin; z += S.grid) {
        const y = level.groundAt(x, z);
        if (y < low) continue;
        const gx = level.groundAt(x + 5, z) - level.groundAt(x - 5, z);
        const gz = level.groundAt(x, z + 5) - level.groundAt(x, z - 5);
        if (hypot(gx, gz) < 2) continue;
        const down = Math.atan2(-gx, -gz);
        for (const a of [down - S.spread, down, down + S.spread]) {
          const fx = Math.sin(a);
          const fz = Math.cos(a);
          const drop =
            y -
            level.groundAt(x + fx * 30, z + fz * 30) +
            0.3 * (y - level.groundAt(x + fx * 100, z + fz * 100)) +
            S.height * (y - low);
          if (likely.length >= S.tried && drop <= likely[likely.length - 1].drop) continue;
          let i = likely.length;
          while (i > 0 && likely[i - 1].drop < drop) i--;
          likely.splice(i, 0, { x, z, y, heading: a, drop });
          if (likely.length > S.tried) likely.pop();
        }
      }
    }
    let highest: (typeof likely)[number] | null = null;
    for (const p of likely) {
      if (crownAt(level, p.x, p.y + 1, p.z, 1) >= 0) continue;
      if (!highest || p.y > highest.y) highest = p;
      const clear = arcClear(level, p.x, p.z, p.heading);
      const ok = clear >= S.clear;
      const was = found.clear >= S.clear;
      const better = ok ? !was || p.y > found.y : !was && clear > found.clear;
      if (better) found = { x: p.x, z: p.z, y: p.y, heading: p.heading, clear, hover: 0 };
    }
    // No edge clears: the HOVER over the highest of them (the longest
    // flight), the least height (in `hoverStep` m) whose arc from rest
    // clears the snow.
    if (found.clear < S.clear && highest) {
      found = {
        x: highest.x,
        z: highest.z,
        y: highest.y,
        heading: highest.heading,
        clear: -Infinity,
        hover: 0,
      };
      for (let h = S.hoverLeast; h <= S.hoverMost; h += S.hoverStep) {
        const clear = arcClear(level, found.x, found.z, found.heading, h);
        found = { ...found, clear, hover: h };
        if (clear >= S.clear) break;
      }
      // Room to fly the suit before the pull, over the least that clears.
      const hover = found.hover + S.hoverRoom;
      found = { ...found, hover, clear: arcClear(level, found.x, found.z, found.heading, hover) };
    }
  }
  exits.set(level, found);
  return found;
}

/** STOOD ON THE CLIFF EXIT in the suit, facing out over the drop, mended —
 * the ride begun (again). */
export function standOnExit(state: GameState, events: GameEvent[]): void {
  const ex = wingsuitExitOf(state.level);
  const c = state.skier;
  standSkier(state, ex.x, ex.z, ex.heading);
  c.thrown = null;
  c.lift = null;
  c.tunnel = null;
  mendBody(c.body);
  onFoot(state, ex.x, ex.z, ex.heading, 0, 0);
  if (!state.wingsuit) state.wingsuit = { from: "cliff" };
  state.wingsuit.hover = ex.hover;
  const ch = freshChute(state, "ready", "plane", "wingsuit");
  ch.heading = ex.heading;
  ch.attitude = 0;
  ch.wing = freshWing(W.exit.alpha, 0);
  state.chute = ch;
  if (ex.hover > 0) hoverHold(state, ch);
  events.push({ kind: "chute", t: state.t, phase: "restart", x: c.x, y: c.y, z: c.z, speed: 0 });
}

/** INTO THE WINGSUIT'S START ARC where he is, with the way he has, out of
 * `from` — the suit filling in the air through him. The one way into the
 * suit's flight off a craft: `chute.ts`'s `craftFreefall` calls it off every
 * craft's way off in the air (the plane's jump, the helicopter's drop, the
 * balloon's jump, the paramotor's drop), and `wingsuitOut` below. */
export function suitExit(state: GameState, from: ChuteCraft): ChuteState {
  const ch = freshChute(state, "exit", from, "wingsuit");
  suitUp(ch);
  state.chute = ch;
  if (!state.wingsuit) state.wingsuit = { from: "air" };
  return ch;
}

/** OUT OF A CRAFT IN A WINGSUIT at a lab's or a test's moment: the flyer at
 * (x, y, z) moving (vx, vy, vz), m/s, facing `heading`, into the start arc
 * with that way (`suitExit`). A ride begun so restarts on the cliff exit
 * unless it already says where. */
export function wingsuitOut(
  state: GameState,
  at: { x: number; y: number; z: number; vx: number; vy: number; vz: number; heading: number },
  events: GameEvent[],
  from: ChuteCraft = "plane",
): void {
  const c = state.skier;
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  c.vx = at.vx;
  c.vy = at.vy;
  c.vz = at.vz;
  c.airborne = true;
  derive(c, state.level);
  suitExit(state, from).heading = at.heading;
  events.push({ kind: "chute", t: state.t, phase: "exit", x: c.x, y: c.y, z: c.z, speed: c.speed });
}

/** The ground speed across and down of the suit's steady glide hands off
 * at height `y` on `level`, m/s — what a flyer stood up already flying
 * (`skydiveAt`'s wingsuit) is started at. */
export function glideOf(level: Level, y: number): { across: number; down: number } {
  const alt = seaAltitude(level, y);
  const rho = airDensity(airPressure(alt), airKelvin(alt));
  suitAero(W.trim.glide, 1, 0, 0, aero);
  // L/D at the trim, and the speed whose lift holds the weight up the path.
  const G = aero.cL / (aero.cp + aero.cL ** 2 / aero.ci);
  const cos = G / Math.sqrt(1 + G * G);
  const V = Math.sqrt((W.search.mass * TUNING.g * cos) / (rho * aero.cL));
  return { across: V * cos, down: V / Math.sqrt(1 + G * G) };
}
