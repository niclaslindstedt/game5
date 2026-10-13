// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRANSCEIVER AS THE HUD READS IT (`avalanche-rescue.ts`) — DOM-free,
// so the suite reads it; `hud-beacon.tsx` draws it. What a digital
// three-aerial avalanche transceiver switched to SEARCH shows the man
// holding it, off where the buried units lie and how each is turned:
//
//   * SIGNAL SEARCH — nothing heard yet: the unit's search pattern and no
//     number (the searcher crosses the debris in strips to pick one up);
//   * COARSE SEARCH — inside the receiving range (about 50 m): a DISTANCE
//     and a DIRECTION. Each buried unit sends a magnetic DIPOLE field off
//     its aerial; the arrow points along the field's FLUX LINE through
//     where the searcher stands, the way that leads in to the sender — so
//     followed, it takes him in on a CURVE, not straight, unless he started
//     on the aerial's axis. The number is what the unit makes of the field's
//     strength: off the axis the field is weaker, so the reading is longer
//     than the straight line (up to 2^⅓ ≈ 1.26 × across it) and it shortens
//     as the curve swings in. Both jitter as a real unit's do — the number
//     by a few per cent, the arrow by a few degrees, worse at the edge of
//     the range, where the signal drops out now and then;
//   * FINE SEARCH — under 3 m: the arrow goes out and only the number is
//     left, the straight distance to the unit in the snow (its depth
//     included), so the lowest number the searcher brackets for stands
//     over the body and reads its depth.
//
// The unit locks on the strongest signal and shows how many it hears. The
// beep quickens as the number falls. What to do next (stop, probe, dig) is
// the prompt beside it. Nothing here touches the run: the jitter is a hash
// of the clock, so a frame reads the same every time.

import { AVALANCHE_RESCUE, type AvalancheState, type Burial, type GameState } from "@engine";
import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import { SCREEN_TO_ENGINE } from "./input-model.ts";

const R = AVALANCHE_RESCUE;

/** The unit's face: `send` sending (no search), `signal` searching with
 * nothing heard, `coarse` the arrow and the number, `fine` the number
 * alone. */
export type BeaconMode = "send" | "signal" | "coarse" | "fine";

/** WHAT HE SHOULD DO NEXT, beside the unit: `slow` — near, slow down and
 * bring the unit to the snow; `stop` — on the lowest number, stop to probe;
 * `probe` — stopped over it, probe; `dig` — struck, dig; `digging` — at
 * it; null — follow the arrow. */
export type BeaconPrompt = "slow" | "stop" | "probe" | "dig" | "digging" | null;

export type BeaconRead = {
  mode: BeaconMode;
  /** The number on the display, m (one decimal under 10 m, whole above);
   * null with nothing heard. */
  metres: number | null;
  /** The direction along the flux line, a screen angle off the way he
   * faces (0 straight ahead, clockwise), rad; null outside the coarse
   * search. */
  arrow: number | null;
  /** The buried units the unit hears. */
  count: number;
  /** The signal's strength, 0..5 bars. */
  bars: number;
  /** Seconds between two beeps (the faster the nearer); 0 sending. */
  beep: number;
  prompt: BeaconPrompt;
  /** The burial's dug share, 0..1, once he is digging at it. */
  dug: number;
  /** Probe strokes he has pushed in, and whether one struck. */
  probes: number;
  struck: boolean;
};

/** A hash of an integer to 0..1 — the jitter's, off the clock. */
function hash(n: number): number {
  let h = Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A burial a searcher can hear: under the snow, and not the player's own. */
const heard = (b: Burial): boolean => b.phase === "buried" && b.who !== "player";

/** What the unit makes of burial `b` from (`x`, `z`): the reading, m, the
 * straight distance in the snow, m, and the flux line's way in, as a map
 * heading (engine space), rad. */
export function fieldAt(
  b: Burial,
  x: number,
  z: number,
): { reading: number; straight: number; way: number } {
  const rx = x - b.x;
  const rz = z - b.z;
  const r = Math.max(0.05, hypot(rx, rz));
  const ux = rx / r;
  const uz = rz / r;
  // The aerial lies flat, turned `aerial` off the map's +z.
  const mx = Math.sin(b.aerial);
  const mz = Math.cos(b.aerial);
  const cos = mx * ux + mz * uz;
  // The dipole's field in the plan, B ∝ 3(m·r̂)r̂ − m.
  const bx = 3 * cos * ux - mx;
  const bz = 3 * cos * uz - mz;
  // Along it, the way that leads IN (B·r̂ = 2 m·r̂).
  const s = cos > 0 ? -1 : 1;
  const way = Math.atan2(s * bx, s * bz);
  const straight = hypot(r, b.depth);
  // The strength read as if on the axis: weaker across it, so longer.
  const reading = straight * Math.cbrt(2 / Math.sqrt(1 + 3 * cos * cos));
  return { reading, straight, way };
}

/** THE TRANSCEIVER'S FACE this frame, or null when he has none to look at
 * (no avalanches, or he is under the snow himself). `t` the run's clock. */
export function beaconRead(state: GameState, t: number): BeaconRead | null {
  const a: AvalancheState | undefined = state.avalanche;
  if (!a || a.victim) return null;
  const B = a.beacon;
  const c = state.skier;
  let count = 0;
  let best: Burial | null = null;
  let near = Infinity;
  let any = false;
  for (const b of a.burials) {
    if (!heard(b)) continue;
    any = true;
    const f = fieldAt(b, c.x, c.z);
    if (f.reading > R.beacon.range) continue;
    count++;
    if (f.reading < near) {
      near = f.reading;
      best = b;
    }
  }
  if (!B.search) {
    // Sending: nothing to read, unless somebody is under to switch for.
    if (!any) return null;
    return blank("send", B.holes.length);
  }
  if (!best) return blank("signal", B.holes.length);
  const f = fieldAt(best, c.x, c.z);
  // THE JITTER, a new figure about three times a second: a few per cent
  // on the number and a few degrees on the arrow, worse toward the edge,
  // where the signal now and then drops out.
  const tick = Math.floor(t * 3);
  const edge = clamp((f.reading - 0.6 * R.beacon.range) / (0.4 * R.beacon.range), 0, 1);
  if (hash(tick * 7 + best.id) < 0.45 * edge) return blank("signal", B.holes.length);
  const jn = (hash(tick * 13 + best.id) - 0.5) * (0.04 + 0.1 * edge);
  const ja = (hash(tick * 17 + best.id * 3) - 0.5) * (0.14 + 0.5 * edge);
  const reading = f.reading * (1 + jn);
  const fine = f.straight < R.beacon.fine;
  const metres = fine
    ? Math.round(f.straight * 10) / 10
    : reading < 10
      ? Math.round(reading * 10) / 10
      : Math.round(reading);
  let arrow: number | null = null;
  if (!fine) {
    let d = f.way + ja - c.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    arrow = d * SCREEN_TO_ENGINE;
  }
  const bars = Math.max(1, Math.min(5, Math.ceil(5 * (1 - reading / R.beacon.range))));
  const beep = 0.12 + 0.9 * clamp(reading / R.beacon.range, 0, 1);
  // What next.
  const flat = hypot(best.x - c.x, best.z - c.z);
  let prompt: BeaconPrompt = null;
  let dug = 0;
  if (best.struck && flat <= R.dig.reach) {
    prompt = B.digging === best.id ? "digging" : "dig";
    dug = best.depth > 0 ? clamp(best.dug / best.depth, 0, 1) : 0;
  } else if (fine) prompt = c.speed > R.probe.still ? "stop" : "probe";
  else if (f.reading < R.beacon.slow) prompt = "slow";
  return {
    mode: fine ? "fine" : "coarse",
    metres,
    arrow,
    count,
    bars,
    beep,
    prompt,
    dug,
    probes: B.holes.length,
    struck: best.struck,
  };
}

function blank(mode: BeaconMode, probes: number): BeaconRead {
  return {
    mode,
    metres: null,
    arrow: null,
    count: 0,
    bars: 0,
    beep: mode === "signal" ? 1.2 : 0,
    prompt: null,
    dug: 0,
    probes,
    struck: false,
  };
}
