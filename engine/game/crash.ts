// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT — the skier thrown off his skis, and the few seconds before
// the reset stands him back on the piste.
//
// A PROFESSIONAL'S RESILIENCE: he goes down only when the body physically
// cannot stay up — and everything short of that he rides out, the save
// kept for the figure to play (`noteSave`, `SkierState.save`). SIX WAYS
// OFF, each a threshold on something the step has already measured, and
// each well past anything a clean run meets (`TUNING.crash`):
//   - a TRUNK met hard — the `hit` event's closing speed past `treeSpeed`
//     with the trunk square in front of the skis (it stops them, and the
//     man on them goes on), or past `treeShoulder` with it beside him (the
//     blow on the shoulder knocks him aside, his skis still under him);
//   - a LANDING OVER THE TIPS — a `land` ending a flight of `noseAir` s or
//     more, past `noseImpact` m/s into the slope with the tips more than
//     `noseDig` down in loose snow, or `noseAngle` on the groomer, where a
//     tip slaps down flat until it comes in steep enough to spear it. The
//     rebound hop after a touchdown is not judged — a skier who lands
//     tail-first and slaps down onto his tips is riding his own landing;
//   - THE BODY DOWN — the hips, the shoulders or the helmet driven into
//     the snow at `bodySlam` m/s (`SkierState.bodyHit`, off the hull's own
//     contacts): come down on his side, his back or his head, in a landing
//     or out of one, still going `rollSpeed`;
//   - a FALL AT SPEED — the body lying over on the SNOW (its up under
//     `reset.overUp` of the snow's normal) for `rollHold` s, still going
//     `rollSpeed` or more: an edge lost. Turning over in the air is not yet
//     a fall — the landing decides — and a slow sit-down he rides out, the
//     reset's own clock (`reset.overFor`) standing him up as before;
//   - THE LEGS FOLDED — a `land` whose load (`flight.ts`'s `landingLoad`:
//     the equivalent fall height over the legs' stroke and the snow's give)
//     is past `legsFold` g, more than legs can hold. How TRUE the skis came
//     down is not judged here: a landing on the skis is the snow's and the
//     legs' to sort out, and one that is not true enough ends on the body;
//   - a CAUGHT EDGE, the high-side — a ski stood well over on its edge
//     (`catchEdge`) while the snow slides past across it faster than
//     `catchSlip`: the edge bites all at once and the body is thrown over
//     it.
//
// THE SKIER THROWN is a body of his own (`Thrown`): a RAGDOLL
// (`ragdoll.ts`) — the hips, the shoulders, the head and the four limbs as
// thirteen points held at the joints — laid where he stood and sent off at
// `keep` of his velocity before the blow plus a climb, turning head over
// heels at his speed over `tumbleRadius` (with `carry` of his own turning
// on top). Every point meets the snow and the trunks on its own, so he goes
// over once or twice with his arms and legs flung, is dragged down by the
// snow on every turn — at once in deep powder — and slides to rest lying on
// it, the way a body does. None of it is drawn from the stream: a crash is
// a pure function of the moment it started, so a run replays wipeout for
// wipeout.
//
// THE SKIS go on without him — the yard sale: the controls let go
// (`run.ts`), the bindings released, the skis sliding on down the slope
// whatever the hull makes of the ground — and a landing over the tips is
// given the tip-over the tips digging in would put into them. He takes no
// gate while he is off them; the race clock runs.
//
// THE RESET comes once he has been off `lieMin` s and has lain still for
// `lieStill` of them, or at `lieMax` whatever he is doing — the engine's
// reset, reported `auto`. The still beat is the one the app's death cam
// (`camera-death.ts`) rises into the sky over him on.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { envelopeOf } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { centreOf, stepRagdoll, throwBody } from "./ragdoll.ts";
import type { CrashCause, GameEvent, GameState, SaveKind, SkierState, Thrown } from "./state.ts";

const K = TUNING.crash;
const dt = TUNING.dt;
const n: Vec3 = { x: 0, y: 1, z: 0 };

/** How far the skis' tips point DOWN against the snow under them, rad —
 * negative for tips up off the slope. */
export function noseDown(state: GameState): number {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  return Math.asin(clamp(-(f.x * n.x + f.y * n.y + f.z * n.z), -1, 1));
}

/** A threshold the crash reads, as the skier's own resilience sets it. */
export type CrashLimit = keyof typeof TUNING.crash.club;

/** THE SKIER'S OWN THRESHOLD: `TUNING.crash`'s professional's at a
 * resilience of 1, its club skier's (`crash.club`) at 0, the blend between —
 * written so 1 is the professional's number to the bit. */
export function crashLimit(c: SkierState, key: CrashLimit): number {
  const pro = K[key];
  return pro - (pro - K.club[key]) * (1 - c.resilience);
}

/** How far down the tips may come into a landing before they dig, rad:
 * `noseDig` in loose snow, `noseAngle` on the groomer. */
function noseLimit(c: SkierState): number {
  const dig = crashLimit(c, "noseDig");
  return dig + (crashLimit(c, "noseAngle") - dig) * clamp(c.packed, 0, 1);
}

/** Where a trunk met this step stands against the skier — its side, −1
 * left, 1 right — and the closing speed that throws him off it: on the
 * tips (`treeSpeed`) when it is in front of the skis (the tips' circle,
 * `collision.ts`), on the shoulder (`treeShoulder`) beside him. */
function trunkAt(c: SkierState, tx: number, tz: number): { limit: number; side: number } {
  const dx = tx - c.x;
  const dz = tz - c.z;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const ahead = dx * fx + dz * fz > 0.4 * (envelopeOf(c.spec).length / 2);
  return {
    limit: crashLimit(c, ahead ? "treeSpeed" : "treeShoulder"),
    side: dx * fz - dz * fx >= 0 ? 1 : -1,
  };
}

/** What, of this step's events and the skier's attitude, throws him — or
 * null. `speed0` is his speed before the step. */
export function wipeoutCause(
  state: GameState,
  events: readonly GameEvent[],
  speed0: number,
): CrashCause | null {
  const c = state.skier;
  let landed = false;
  for (const e of events) {
    if (e.kind === "hit") {
      if (e.speed >= trunkAt(c, e.x, e.z).limit) return "tree";
    }
    if (e.kind !== "land") continue;
    landed = true;
    // Only the touchdown that ends a real flight: the rebound hop off a
    // landing is that landing's own, however the nose comes down on it.
    if (e.airTime >= K.noseAir && e.impact >= K.noseImpact && noseDown(state) >= noseLimit(c)) {
      return "nose";
    }
    // A skier coming down on his side or his back is the body's (below),
    // not his legs'.
    if (e.airTime >= TUNING.landing.air && e.g >= crashLimit(c, "legsFold") && !overSnow(state)) {
      return "landing";
    }
  }
  // THE BODY DOWN: his hips, shoulders or helmet driven into the snow —
  // whatever the skis were doing, he is on the ground; a landing's, when
  // the skis touched down a moment before.
  if (c.bodyHit >= crashLimit(c, "bodySlam") && speed0 >= K.rollSpeed) {
    return landed || c.landing <= K.noseAir ? "landing" : "roll";
  }
  // Over is over against the SNOW, not the sky — a skier on a steep face
  // stands well off vertical — and ON the snow: a skier turning over in the
  // air has not fallen until he comes down, and one who clips a hip on the
  // way round and comes back onto his skis skis away. So the clock is
  // `rolledFor`, time lying over on the snow, held `rollHold` — and held,
  // not started over, through a bounce off it: a body sliding on its side
  // leaves the snow for a step at a time.
  const over = overSnow(state);
  c.rolledFor = !over ? 0 : c.airborne ? c.rolledFor : c.rolledFor + dt;
  if (c.rolledFor >= crashLimit(c, "rollHold") && speed0 >= K.rollSpeed) return "roll";
  // THE CAUGHT EDGE: on the snow, the ski well over, sliding across it fast
  // — and not in a SKID, which is a slide the skier asked for: a hockey
  // stop is the skis thrown across the way and slid on their edges.
  if (
    !c.airborne &&
    c.skid < K.catchSkid &&
    Math.abs(c.edge) >= crashLimit(c, "catchEdge") &&
    c.sideSlip >= crashLimit(c, "catchSlip")
  )
    return "catch";
  return null;
}

/** THE SAVE: on a step that did not throw him, how near anything came to
 * — a hard or crooked landing, a trunk, the body touching the snow, an
 * edge biting — kept on `SkierState.save` (its clock run on) for the
 * figure to play, and a `save` event when a new one is made. */
export function noteSave(state: GameState, events: GameEvent[]): void {
  const c = state.skier;
  if (c.save) c.save.t += dt;
  let kind: SaveKind | null = null;
  let size = 0;
  let side = 0;
  let fore = 0;
  const offer = (k: SaveKind, near: number, sd: number, f = 0): void => {
    if (near <= size) return;
    kind = k;
    size = near;
    side = sd;
    fore = f;
  };
  const sideOf = rolledSide(state);
  for (const e of events) {
    if (e.kind === "hit") {
      const at = trunkAt(c, e.x, e.z);
      offer("tree", e.speed / at.limit, at.side);
    } else if (e.kind === "land" && e.airTime >= TUNING.landing.air) {
      const tip = noseDown(state);
      const roll = Math.abs(sideOf.roll);
      const limit = noseLimit(c);
      offer(
        "landing",
        Math.max(
          (e.g - TUNING.landing.clean) / (crashLimit(c, "legsFold") - TUNING.landing.clean),
          (Math.abs(tip) - K.saveTip) / (limit - K.saveTip),
          (roll - K.saveRoll) / (Math.PI / 2 - K.saveRoll),
        ),
        roll > K.saveRoll ? sideOf.side : 0,
        clamp(tip / limit, -1, 1),
      );
    }
  }
  // The body touching or lying over — until he has lain over past what he
  // can push back up from, when he is down (at a crawl, only sat down) and
  // saving nothing.
  const hold = crashLimit(c, "rollHold");
  if (c.rolledFor < hold) {
    const slam = crashLimit(c, "bodySlam");
    if (c.bodyHit > 0) offer("body", Math.max(0.4, c.bodyHit / slam), c.bodySide || sideOf.side);
    if (c.rolledFor > 0) offer("body", 0.5 + (0.5 * c.rolledFor) / hold, sideOf.side);
  }
  // An edge is near catching only from `saveSlip` of the slide and
  // `saveEdge` of the edge that catch it: an ordinary skidded turn is not a
  // save.
  const slip = crashLimit(c, "catchSlip");
  if (
    !c.airborne &&
    c.skid < K.catchSkid &&
    Math.abs(c.edge) >= K.saveEdge * crashLimit(c, "catchEdge") &&
    c.sideSlip >= K.saveSlip * slip
  ) {
    const from = K.saveSlip * slip;
    offer(
      "edge",
      K.saveFrom + ((1 - K.saveFrom) * (c.sideSlip - from)) / (slip - from),
      Math.sign(c.edge),
    );
  }
  if (kind === null || size < K.saveFrom) return;
  size = Math.min(1, size);
  const cur = c.save;
  if (cur && cur.t < K.saveHold) {
    // The same save going on is the one already playing.
    if (cur.kind === kind) {
      cur.size = Math.max(cur.size, size);
      return;
    }
    if (size <= cur.size * (1 - cur.t / K.saveHold)) return;
  }
  c.save = { kind, t: 0, size, side, fore };
  events.push({ kind: "save", t: state.t, save: kind, size });
}

/** The skis' roll against the snow under them, rad (right side up
 * positive), and the side going down, −1 left, 1 right. */
function rolledSide(state: GameState): { roll: number; side: number } {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  const r = rotate(c.q, { x: 1, y: 0, z: 0 });
  const roll = Math.asin(clamp(r.x * n.x + r.y * n.y + r.z * n.z, -1, 1));
  return { roll, side: roll < 0 ? 1 : -1 };
}

/** Whether the skier's up axis is under `reset.overUp` of the snow's own. */
function overSnow(state: GameState): boolean {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  return up.x * n.x + up.y * n.y + up.z * n.z < TUNING.reset.overUp;
}

/** Throw the skier: `v0` is his velocity before the blow, which is what
 * he carries on with. */
export function throwRider(
  state: GameState,
  cause: CrashCause,
  v0: Vec3,
  events: GameEvent[],
): Thrown {
  const c = state.skier;
  const flat = hypot(v0.x, v0.z);
  const speed = hypot3(v0.x, v0.y, v0.z);
  const heading = flat > 1 ? Math.atan2(v0.x, v0.z) : c.heading;
  // Head over heels about the axis across the way he goes, forward
  // positive (a right-handed turn about his right), and a share of his own
  // turning — a body going over takes its turn with it.
  const over = Math.min(K.maxSpin, (flat * K.keep) / K.tumbleRadius);
  const own = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
  const w = {
    x: Math.cos(heading) * over + own.x * K.carry,
    y: own.y * K.carry,
    z: -Math.sin(heading) * over + own.z * K.carry,
  };
  const v = { x: v0.x * K.keep, y: Math.max(0, v0.y) * K.keep + K.throwUp, z: v0.z * K.keep };
  const body = throwBody(c.q, c.x, c.y, c.z, v, w);
  const com = centreOf(body.points);
  const thrown: Thrown = {
    cause,
    t: 0,
    x: com.x,
    y: com.y,
    z: com.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    heading,
    tumble: 0,
    points: body.points,
    last: body.last,
    touching: false,
    still: 0,
  };
  if (cause === "nose") {
    // The tips dig and the skis go over them: a tips-down pitch rate is a
    // positive `wx`.
    const e = events.find((ev) => ev.kind === "land");
    const impact = e && e.kind === "land" ? e.impact : 0;
    c.wx += Math.min(K.skiKickMax, K.skiKick * impact);
  }
  c.thrown = thrown;
  events.push({ kind: "wipeout", t: state.t, cause, speed, x: c.x, z: c.z });
  return thrown;
}

/** One step of the skier's own body on the snow. */
export function stepThrown(state: GameState, b: Thrown): void {
  b.t += dt;
  stepRagdoll(state, b);
}

/** Whether the skier has lain long enough for the reset to stand him up. */
export function crashOver(b: Thrown): boolean {
  if (b.t >= K.lieMax) return true;
  return b.t >= K.lieMin && b.still >= K.lieStill;
}

/** The skis' share of the step's bookkeeping with nobody on them: nothing
 * is asked of the automatic reset's clocks while the crash owns the run. */
export function quietClocks(c: SkierState): void {
  c.overFor = 0;
  c.stuckFor = 0;
  c.trenchFor = 0;
  c.boggedFor = 0;
  c.rolledFor = 0;
}
