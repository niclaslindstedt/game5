// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINE HE RIDES UNDER FIRE (`gunfire.ts`): the helicopter he stole
// or flies, the jump plane, the snowmobile, the balloon's envelope — each
// a hull a round is tested against, and the damage the rounds' energy
// does it (`GUNFIRE.machine`):
//   - SMOKE at `smoke` of what brings it down (the drawing trails it);
//   - THE ENGINE FAILING at `fail`: a helicopter's or the plane's engine
//     coughs and stops (the dealt stoppage of `mishaps.ts`, forced), and
//     he must autorotate or glide it down; the snowmobile's dies;
//   - LOST at 1: the helicopter's gearbox SEIZES and its rotor runs down
//     (`GUNFIRE.seize`) — it falls, and its own crash (`heli.ts`) burns it
//     and throws him; the snowmobile's tank lights (`sled-fire.ts`, on a
//     ride that has fires) or it dies where it stands;
//   - A ROCKET'S BURST on a machine is `rocket` of it at once, and in a
//     balloon's envelope sets it alight;
//   - AN ARMY VEHICLE HE TOOK (`armour.ts`) by its own numbers
//     (`ARMOUR.damage`): a carrier's or a truck's skin holed by belts of
//     rounds, a tank's armour by none — a burst `burst` of it — failing
//     (it will not drive) and lost (a wreck): `knockOut`.
// A round through a helicopter's or the plane's CABIN reaches the man at
// the controls `GUNFIRE.cabin` of the time (`gunfire.ts` wounds him).

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, unrotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { knockOut } from "./armour.ts";
import { specOf } from "./army-vehicle-body.ts";
import { ARMOUR } from "./defs/armour.ts";
import { BALLOON } from "./defs/balloon.ts";
import { SLED } from "./defs/sled.ts";
import { SLED_FIRE } from "./defs/sled-fire.ts";
import { GUNFIRE } from "./defs/weapons.ts";
import { TUNING } from "./defs/tuning.ts";
import { heliQuat } from "./heli-rotor.ts";
import { sayGunfire } from "./gunfire-log.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { GunfireState, GunMachine } from "./gunfire-state.ts";
import type { WeaponKind } from "./defs/weapons.ts";

const M = GUNFIRE.machine;

/** A HULL in its machine's own frame (x right, y up, z forward, m): a
 * capsule from `a` to `b`, `r` thick, and the stretch of z its cabin is. */
type Hull = { a: number[]; b: number[]; r: number; cabin: readonly [number, number] };

/** THE HELICOPTER: its cabin and engine bay round the datum, the tail boom
 * back to the tail rotor. */
const HELI_HULL: Hull[] = [
  { a: [0, 1.15, -1.9], b: [0, 1.15, 1.8], r: 1.0, cabin: [-0.6, 2.8] },
  { a: [0, 1.7, -2.0], b: [0, 2.0, -6.3], r: 0.35, cabin: [9, 9] },
];
/** THE PLANE: the fuselage nose to tail, the cabin from the firewall back. */
const PLANE_HULL: Hull[] = [{ a: [0, 1.7, -6.6], b: [0, 1.7, 3.9], r: 0.7, cabin: [-2, 1.3] }];

/** What a round struck of a machine he rides: which, how far along its
 * path (0..1), and whether through the cabin. */
export type MachineHit = { machine: GunMachine; s: number; cabin: boolean };

const toward = (p: readonly number[], q: readonly number[], s: number, k: number): number =>
  p[k] + (q[k] - p[k]) * s;

/** The share along p → q where it first comes within r of the segment
 * a → b (all in one frame), or −1: it passes wider. Marched, since a
 * round's step is a few metres and a hull a few across. */
function along(
  p: readonly number[],
  q: readonly number[],
  a: readonly number[],
  b: readonly number[],
  r: number,
): number {
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = toward(p, q, s, 0);
    const y = toward(p, q, s, 1);
    const z = toward(p, q, s, 2);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const L = dx * dx + dy * dy + dz * dz;
    const u =
      L > 0
        ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L))
        : 0;
    if (hypot3(x - a[0] - dx * u, y - a[1] - dy * u, z - a[2] - dz * u) <= r) return s;
  }
  return -1;
}

/** A path p → q (world) against a hull at (x, y, z) turned by `q`. */
function hullHit(
  p: readonly number[],
  q: readonly number[],
  at: { x: number; y: number; z: number },
  rot: ReturnType<typeof fromEuler>,
  hulls: readonly Hull[],
): { s: number; cabin: boolean } | null {
  // Far from it, nothing to march.
  const mid = [(p[0] + q[0]) / 2 - at.x, (p[1] + q[1]) / 2 - at.y, (p[2] + q[2]) / 2 - at.z];
  const half = hypot3(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 2;
  if (hypot3(mid[0], mid[1], mid[2]) > half + 9) return null;
  const lp = unrotate(rot, { x: p[0] - at.x, y: p[1] - at.y, z: p[2] - at.z });
  const lq = unrotate(rot, { x: q[0] - at.x, y: q[1] - at.y, z: q[2] - at.z });
  const P = [lp.x, lp.y, lp.z];
  const Q = [lq.x, lq.y, lq.z];
  let best: { s: number; cabin: boolean } | null = null;
  for (const h of hulls) {
    const s = along(P, Q, h.a, h.b, h.r);
    if (s < 0 || (best && s >= best.s)) continue;
    const z = toward(P, Q, s, 2);
    best = { s, cabin: z >= h.cabin[0] && z <= h.cabin[1] };
  }
  return best;
}

/** THE FIRST MACHINE HE RIDES that the path p → q strikes, or null. */
export function machineHit(
  state: GameState,
  p: readonly number[],
  q: readonly number[],
): MachineHit | null {
  const h = state.heli;
  if (h?.rider && h.mode !== "wreck") {
    const r = hullHit(p, q, h, heliQuat(h), HELI_HULL);
    if (r) return { machine: "heli", ...r };
  }
  const pl = state.plane;
  if (pl?.rider) {
    const r = hullHit(p, q, pl, fromEuler(pl.heading, pl.pitch, pl.roll), PLANE_HULL);
    if (r) return { machine: "plane", ...r };
  }
  const s = state.sled;
  if (s?.rider) {
    const half = SLED.length / 2;
    const hull: Hull[] = [{ a: [0, 0, -half], b: [0, 0, half], r: SLED.width / 2, cabin: [9, 9] }];
    const r = hullHit(p, q, s, fromEuler(s.heading, 0, 0), hull);
    if (r) return { machine: "sled", s: r.s, cabin: false };
  }
  const v = state.armour;
  if (v?.rider) {
    const o = v.body;
    const S = specOf(o);
    const L = S.halfLength;
    // Its hull a capsule along it; the carrier's and the truck's cab the
    // stretch a round finds him through, the tank's none.
    const cab: [number, number] =
      o.kind === "truck" ? [L - 1.9, L] : o.kind === "carrier" ? [-L, 0.5] : [9, 9];
    const half = S.height * 0.5;
    const hull: Hull[] = [
      { a: [0, half, -L], b: [0, half, L], r: Math.max(S.halfWidth, half), cabin: cab },
    ];
    const r = hullHit(p, q, o, fromEuler(o.heading, o.pitch, o.roll), hull);
    if (r) return { machine: "armour", ...r };
  }
  const b = state.balloon;
  if (b?.aboard) {
    const E = BALLOON.envelope;
    const c = { x: b.x, y: b.y + E.mouthHeight + E.equator, z: b.z };
    const rr = (E.diameter / 2) * (GUNFIRE.envelope / 0.5);
    const hull: Hull[] = [{ a: [0, 0, 0], b: [0, 0, 0], r: rr, cabin: [9, 9] }];
    const r = hullHit(p, q, c, fromEuler(0, 0, 0), hull);
    if (r) return { machine: "balloon", s: r.s, cabin: false };
  }
  return null;
}

/** Where the machine `m` is, world frame, m (its middle), or null when
 * he does not ride it. */
export function machineAt(
  state: GameState,
  m: GunMachine,
): { x: number; y: number; z: number } | null {
  if (m === "heli" && state.heli?.rider) return { ...xyz(state.heli), y: state.heli.y + 1.2 };
  if (m === "plane" && state.plane?.rider) return { ...xyz(state.plane), y: state.plane.y + 1.7 };
  if (m === "sled" && state.sled?.rider) return xyz(state.sled);
  if (m === "armour" && state.armour?.rider) {
    const o = state.armour.body;
    return { x: o.x, y: o.y + 1.2, z: o.z };
  }
  if (m === "balloon" && state.balloon?.aboard) {
    const b = state.balloon;
    return { x: b.x, y: b.y + BALLOON.envelope.mouthHeight + BALLOON.envelope.equator, z: b.z };
  }
  return null;
}

const xyz = (o: { x: number; y: number; z: number }) => ({ x: o.x, y: o.y, z: o.z });

/** THE MACHINES, in the order a burst asks them. */
export const MACHINES: readonly GunMachine[] = ["heli", "plane", "sled", "balloon", "armour"];

/** `j` J of a round's energy (or a burst's `rocket` share, `burst` true)
 * into machine `m`: its damage, and what it comes to. */
export function damageMachine(
  state: GameState,
  g: GunfireState,
  m: GunMachine,
  j: number,
  burst: boolean,
  weapon: WeaponKind,
  events: GameEvent[],
): void {
  if (g.lost[m]) return;
  const at = machineAt(state, m);
  if (!at) return;
  const say = (stage: "hit" | "smoke" | "fail" | "lost"): void => {
    sayGunfire(g, events, {
      kind: "gunfire",
      t: state.t,
      phase: "machine",
      weapon,
      ...at,
      machine: m,
      stage,
    });
  };
  // A balloon's envelope shrugs off rounds; a burst in it sets it alight.
  if (m === "balloon") {
    say("hit");
    if (!burst) return;
    const b = state.balloon!;
    b.scorch = 1;
    b.burning = true;
    g.lost.balloon = true;
    say("lost");
    return;
  }
  const was = g.damage[m];
  if (m === "armour") {
    // An army vehicle he took: by its own numbers, and knocked out under him.
    const kind = state.armour!.body.kind;
    const D = ARMOUR.damage;
    const now = was + (burst ? D.burst[kind] : j / D.rounds[kind]);
    g.damage.armour = now;
    say("hit");
    if (was < M.smoke && now >= M.smoke) say("smoke");
    if (was < M.fail && now >= M.fail) {
      knockOut(state, false, events);
      say("fail");
    }
    if (now >= 1) {
      g.lost.armour = true;
      knockOut(state, true, events);
      say("lost");
    }
    return;
  }
  const now = burst ? was + M.rocket : was + j / M[m];
  g.damage[m] = now;
  say("hit");
  if (was < M.smoke && now >= M.smoke) say("smoke");
  if (was < M.fail && now >= M.fail) {
    fail(state, m);
    say("fail");
  }
  if (now >= 1) {
    g.lost[m] = true;
    lose(state, m);
    say("lost");
  }
}

/** THE ENGINE FAILING: a helicopter's or the plane's coughs a moment and
 * stops (`mishaps.ts`' stoppage, forced now); the snowmobile's dies. */
function fail(state: GameState, m: GunMachine): void {
  if (m === "heli" && state.heli) {
    const e = state.heli.engine;
    if (!e || e.due > 0) state.heli.engine = { due: 0, cough: 1.5, out: false };
  } else if (m === "plane" && state.plane) {
    const e = state.plane.engine;
    if (!e || e.due > 0) state.plane.engine = { due: 0, cough: 1.5, out: false };
  } else if (m === "sled" && state.sled) {
    state.sled.running = false;
  }
}

/** LOST: the helicopter's gearbox seizes (held each step after by
 * `seizeLost`), the plane's engine is dead, the snowmobile's tank lights. */
function lose(state: GameState, m: GunMachine): void {
  fail(state, m);
  if ((m === "heli" || m === "plane") && state[m]?.engine) state[m]!.engine!.out = true;
  const s = state.sled;
  if (m === "sled" && s && !s.burn && state.rules.fires && !state.rules.sfw) {
    // Its tank alight: it goes up a moment later (`sled-fire.ts`).
    s.burn = { fire: "", t: state.t - SLED_FIRE.fuse + 0.6, boom: -1, x: 0, y: 0, z: 0, speed: 0 };
  }
}

/** A LOST HELICOPTER'S SEIZED GEARBOX, every step after: the rotor runs
 * down whatever the air through it would give it. */
export function seizeLost(state: GameState, g: GunfireState): void {
  const h = state.heli;
  if (!g.lost.heli || !h || h.mode === "wreck") return;
  h.spool = Math.max(0, h.spool - GUNFIRE.seize * TUNING.dt);
}
