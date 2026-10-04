// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FLEX POLES — the poles of a slalom's gates (R31) as things a racer
// meets. Every pole of a pole gate stands on a hinge at the snow: the
// racer's shins, guards, knees, hands and arm knock it over as he clears
// it — the turning pole above all, which a slalom racer skis straight
// through with his body while his feet pass outside it — and it stands
// itself back up, swinging past upright and settling, a damped spring on
// its tilt (`TUNING.flex`).
//
// THE BODY as a pole sees it is a plan line from his feet (the skis' middle
// stations) to his shoulders, `flex.reach` either side of it, so a racer
// angulated into a turn knocks the pole with his upper body while his feet
// are still a metre outside it. A pole inside that reach is pushed over
// until it clears him, as far over as its hinge lets it lie; the push he
// drove into it costs him a little of his speed (`flex.share`, never more
// than `flex.loss` at a blow), and a knock worth hearing is an event.
//
// A pole knocked over is still the gate: the line is where the poles stand
// in the snow (`strict.ts` judges the feet against the poles' places, never
// against the poles as they lie). Every run keeps its own poles
// (`GameState.gatePoles`) — the player's are the ones drawn, and a racer of
// the field knocks his own — and nothing here draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Level } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GamePoles, GameState } from "./state.ts";

const K = TUNING.flex;

/** Where every pole of a map's pole gates stands in the snow: x, z pairs,
 * two to a gate (its left end as it is crossed, then its right), and the
 * gate each belongs to. */
type PolePlan = { xz: Float64Array; gate: Int32Array; count: number };

const plans = new WeakMap<Level, PolePlan>();

/** THE POLES of `level`: both ends of every pole gate's line. Kept per map. */
export function polePlan(level: Level): PolePlan {
  const known = plans.get(level);
  if (known) return known;
  const gates = level.checkpoints.filter((c) => c.pole !== undefined);
  const xz = new Float64Array(gates.length * 4);
  const gate = new Int32Array(gates.length * 2);
  let k = 0;
  level.checkpoints.forEach((c, index) => {
    if (c.pole === undefined) return;
    // The gate's line runs across the way it is crossed: right is the
    // heading turned a quarter clockwise.
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    for (const side of [-1, 1]) {
      xz[k * 2] = c.x + rx * side * (c.width / 2);
      xz[k * 2 + 1] = c.z + rz * side * (c.width / 2);
      gate[k] = index;
      k += 1;
    }
  });
  const plan = { xz, gate, count: k };
  plans.set(level, plan);
  return plan;
}

/** A run's poles all standing — or nothing, on a map with no pole gate. */
export function freshGatePoles(level: Level): GamePoles | undefined {
  const n = polePlan(level).count;
  if (n === 0) return undefined;
  return {
    tilt: new Float32Array(n),
    spin: new Float32Array(n),
    dirX: new Float32Array(n),
    dirZ: new Float32Array(n),
  };
}

/** How many gates either side of the one owed a body can be at. */
const NEAR = 3;

/** Step a run's poles by the step the world has just taken: the body
 * against the poles near the gate it owes, then every pole's hinge. A
 * thrown skier's body is the ragdoll's, and knocks nothing here. */
export function stepGatePoles(state: GameState, events: GameEvent[], thrown: boolean): void {
  const poles = state.gatePoles;
  if (!poles) return;
  const plan = polePlan(state.level);
  const dt = TUNING.dt;
  if (!thrown && state.rules.course) knock(state, poles, plan, events);
  for (let i = 0; i < plan.count; i++) {
    const tilt = poles.tilt[i];
    const spin = poles.spin[i];
    if (tilt === 0 && spin === 0) continue;
    // The hinge's spring stands it back up — and past upright, the other
    // way, where the tilt goes negative along the same line.
    const next = spin + (-K.stiff * tilt - K.damp * spin) * dt;
    let t = tilt + next * dt;
    let w = next;
    if (t > K.most) {
      t = K.most;
      w = Math.min(0, w);
    } else if (t < -K.most) {
      t = -K.most;
      w = Math.max(0, w);
    }
    if (Math.abs(t) < 1e-4 && Math.abs(w) < 1e-3) {
      t = 0;
      w = 0;
    }
    poles.tilt[i] = t;
    poles.spin[i] = w;
  }
}

/** The body against the poles near the gate the run owes. */
function knock(state: GameState, poles: GamePoles, plan: PolePlan, events: GameEvent[]): void {
  const c = state.skier;
  // His feet: the middle of his two skis' middle stations.
  let fx = 0;
  let fz = 0;
  let fy = 0;
  let feet = 0;
  for (const contact of c.contacts) {
    if (contact.station !== "mid") continue;
    fx += contact.x;
    fz += contact.z;
    fy += contact.y;
    feet += 1;
  }
  if (feet === 0) return;
  fx /= feet;
  fz /= feet;
  fy /= feet;
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  const sx = c.x + up.x * K.shoulder;
  const sz = c.z + up.z * K.shoulder;
  const sy = c.y + up.y * K.shoulder;
  const owed = state.progress.nextCheckpoint;
  for (let i = 0; i < plan.count; i++) {
    const gate = plan.gate[i];
    if (gate < owed - NEAR || gate > owed + NEAR) continue;
    const px = plan.xz[i * 2];
    const pz = plan.xz[i * 2 + 1];
    // The nearest point of his body's plan line to the pole's foot.
    const ax = sx - fx;
    const az = sz - fz;
    const len2 = ax * ax + az * az;
    const u = len2 > 1e-9 ? Math.min(1, Math.max(0, ((px - fx) * ax + (pz - fz) * az) / len2)) : 0;
    const qx = fx + ax * u;
    const qz = fz + az * u;
    const snow = state.level.groundAt(px, pz);
    const h = Math.max(0.25, fy + (sy - fy) * u - snow);
    if (h > K.height) continue;
    // Where the pole stands at that height, lying as it lies.
    const lean = Math.tan(Math.min(Math.abs(poles.tilt[i]), 1.45)) * h * Math.sign(poles.tilt[i]);
    const ox = px + poles.dirX[i] * lean;
    const oz = pz + poles.dirZ[i] * lean;
    const dx = ox - qx;
    const dz = oz - qz;
    const d = hypot(dx, dz);
    if (d >= K.reach) continue;
    // Pushed away from him: the way from his body to the pole, or his own
    // way where he is right on it.
    const speed = hypot(c.vx, c.vz);
    const nx = d > 1e-6 ? dx / d : speed > 1e-6 ? c.vx / speed : 1;
    const nz = d > 1e-6 ? dz / d : speed > 1e-6 ? c.vz / speed : 0;
    const closing = Math.max(0, c.vx * nx + c.vz * nz);
    // Over until it clears him, as far as its hinge lets it lie.
    const clear = Math.min(K.most, Math.atan((K.reach - d + Math.abs(lean)) / h));
    const fresh = Math.abs(poles.tilt[i]) < 0.05;
    if (fresh || poles.tilt[i] < clear) {
      poles.dirX[i] = nx;
      poles.dirZ[i] = nz;
      poles.tilt[i] = clear;
      poles.spin[i] = Math.max(poles.spin[i], closing / h);
    }
    if (closing <= 0) continue;
    // What it cost him: a share of the speed he drove into it.
    const lost = Math.min(K.loss, K.share * closing);
    c.vx -= nx * lost;
    c.vz -= nz * lost;
    if (fresh && closing >= K.knock) {
      events.push({ kind: "pole", t: state.t, gate, speed: closing });
    }
  }
}
