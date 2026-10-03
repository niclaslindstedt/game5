// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS ON THE SNOW, AS DRAWN — where each ski stands under an inclined
// skier, and which of the two carries him.
//
// The engine stands both skis on the snow whatever the body does above
// them: each leg is cast down the SNOW'S normal from a point half the
// stance across the snow (`skier.ts`), so a body inclined 40° into a turn
// still has two loaded legs. The pair is DRAWN in the body's own frame,
// though, and a ski hung half the stance out along a body rolled into the
// turn rides that roll up off the snow — the outside one by most, a
// quarter of a metre and more in every hard turn. So the drawing is turned
// back onto the snow here, in two parts:
//
//   * THE BODY TURNS ABOUT ITS FEET. A skier inclines over his skis, not
//     his skis under him: the drawn body is pivoted about the point between
//     the boots on the snow (`pivot`) — the centre of gravity carried
//     INSIDE the turn by the legs' length times the sine of the
//     inclination, which is where a real skier's hips are — so the skis
//     stay on the tracks the engine cuts.
//   * THE INSIDE LEG IS SHORT. Two skis a stance apart ACROSS THE SNOW,
//     seen from a body inclined `r` to it, stand `stance · sin r` apart
//     along the body's own up: the inside ski is lifted toward the hips by
//     half of that and the outside one let down by the other half (`lift`),
//     so the outside leg is long and the inside one folded, and both bases
//     are on the snow. Measured on racers: the outside knee opens to some
//     130°, the inside folds to some 60° (`docs/riding.md`).
//   * THE STANCE TURNS WITH THE PIVOT. A skid or a hockey stop throws the
//     skis across about the pair's middle, in the snow's own plane: the
//     two stay a stance apart square to their own line (never closing up
//     into one line, as two skis each pivoted on its own binding do) and
//     flat on the snow — so the pivot is taken about the snow's normal
//     and then rolled into the inclined body, the bindings with it.
//
// Both ease out in the air (`ground`, the view's own eased flag): a flying
// skier turns about his centre of gravity and his skis hang off his legs.
//
// THE LOAD. The legs are springs of one rate cast from the same height, so
// the engine's two skis carry alike in a turn; a skier does not. Measured
// under the bindings, the OUTSIDE ski carries nearly all of him in a wedge
// at a crawl, three quarters in a long turn at a cruise, and two thirds in
// a fast, high-edged carve (when the inside ski is laid on its edge too),
// handing over to the new outside ski within a tenth of a second of the
// edge changing. `share` is that split laid over the engine's own (so a
// ski off the snow carries nothing whatever the turn), and the spray and
// the snow cloud are thrown by it — the outside ski's edge throws the
// sheet. Presentation only: the physics' grip and forces are the engine's.

import { probesOf, rotate, type Level, type SkierState } from "@engine";

import { gearLift, skiTilt } from "./ski-gear.ts";

/** THE OUTSIDE SKI'S SHARE of the load at the height of a turn, by speed
 * (m/s): a wedge at a crawl, a long turn at a cruise, a racer's carve. */
export const OUTSIDE_SHARE = {
  speeds: [5, 12, 20] as const,
  shares: [0.95, 0.77, 0.66] as const,
};

/** How far over the skis must be, rad, for the turn's split to be whole,
 * and the speeds (m/s) between which a turn shares the load at all — a
 * skier stood still on his edges stands on both feet. */
const TURN = { edge: 0.5, still: 0.5, moving: 3 };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The outside ski's share of the load at the height of a turn at
 * `speed` m/s (`OUTSIDE_SHARE`, straight between its rows). */
export function outsideShare(speed: number): number {
  const { speeds, shares } = OUTSIDE_SHARE;
  if (speed <= speeds[0]) return shares[0];
  for (let i = 1; i < speeds.length; i++) {
    if (speed <= speeds[i]) {
      const f = (speed - speeds[i - 1]) / (speeds[i] - speeds[i - 1]);
      return shares[i - 1] + (shares[i] - shares[i - 1]) * f;
    }
  }
  return shares[shares.length - 1];
}

/** HOW FAR INTO A TURN, −1..1, signed to its INSIDE (+1 a turn to the
 * right): the edge the skis stand on — which changes sides as the skier
 * changes edges, so the load goes over with it — faded out at a standstill
 * and in the air. */
export function turnOf(skier: Pick<SkierState, "edge" | "speed" | "airborne">): number {
  if (skier.airborne) return 0;
  const over = smooth(0.05, TURN.edge, Math.abs(skier.edge));
  return Math.sign(skier.edge) * over * smooth(TURN.still, TURN.moving, skier.speed);
}

/** Each ski's share of the load, left then right, into `out`: the turn's
 * split laid over the engine's own two loads (each ski's three stations
 * summed). Both 0 with nothing on the snow. */
export function skiShares(
  skier: Pick<SkierState, "edge" | "speed" | "airborne" | "contacts">,
  out: [number, number] = [0.5, 0.5],
): [number, number] {
  let left = 0;
  let right = 0;
  for (let i = 0; i < skier.contacts.length; i++) {
    const c = skier.contacts[i];
    if (!c.touching) continue;
    if (i < 3) left += c.load;
    else right += c.load;
  }
  const turn = turnOf(skier);
  const lean = (outsideShare(skier.speed) - 0.5) * Math.abs(turn);
  // The inside ski is the right in a turn to the right.
  const l = left * (0.5 + (turn > 0 ? lean : -lean));
  const r = right * (0.5 + (turn > 0 ? -lean : lean));
  const sum = l + r;
  out[0] = sum > 0 ? l / sum : 0;
  out[1] = sum > 0 ? r / sum : 0;
  return out;
}

/** WHERE THE DRAWN PAIR STANDS, in the body frame. */
export type Stand = {
  /** The inclination the drawing stands on, rad: the engine's `incline`
   * as far as he is on the snow (`ground`). */
  incline: number;
  /** Each ski's lift toward the body, m — the leg's compression
   * (`gearLift`) and the inside ski's rise on the inclined stance. */
  lift: [number, number];
  /** Each ski's shift across the body, m, off half the stance, and along
   * it, m: the stance seen across from an inclined body is narrower, and
   * turned with the skid's pivot it is square to the skis. */
  out: [number, number];
  fore: [number, number];
  /** The skis' tilt about their own length in the body frame, rad —
   * the edge less the inclination they stand on (`skiTilt`). */
  tilt: number;
  /** Where the drawn body's origin goes, body frame, m: turned about the
   * feet rather than the centre of gravity. */
  pivot: { x: number; y: number };
  /** Each ski's share of the load (`skiShares`). */
  share: [number, number];
  /** Each ski's tip lifted about its binding, rad (tips up positive), and
   * its edge rocked about its length, rad (right edge down positive) — the
   * chatter at speed (`ski-chatter.ts`); nought off `standOf`. */
  pitch: [number, number];
  rock: [number, number];
};

export function emptyStand(): Stand {
  return {
    incline: 0,
    lift: [0, 0],
    out: [0, 0],
    fore: [0, 0],
    tilt: 0,
    pivot: { x: 0, y: 0 },
    share: [0.5, 0.5],
    pitch: [0, 0],
    rock: [0, 0],
  };
}

/** THE PAIR ON THE SNOW for one frame, into `out`: `ground` is how far he
 * stands on it, 0..1 (the view's own eased flag; 0 in the air and thrown);
 * `incline` the inclination the body is drawn at (the engine's, carried
 * to the drawn orientation when that is between two steps); `angle` the
 * skid's pivot as drawn (`drawnSkiAngle`). */
export function standOf(
  skier: SkierState,
  ground: number,
  out: Stand = emptyStand(),
  incline = skier.incline,
  angle = skier.skiAngle,
): Stand {
  const g = clamp(ground, 0, 1);
  const r = incline * g;
  const sr = Math.sin(r);
  const cr = Math.cos(r);
  const w = skier.spec.stance / 2;
  const lift = gearLift(skier);
  out.incline = r;
  // Each binding on the snow — half the stance across the skis' own line,
  // turned with the pivot — rolled into the body.
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const across = side * w * ca;
    out.lift[i] = lift[i] + across * sr;
    out.out[i] = across * cr - side * w;
    out.fore[i] = -side * w * sa;
    out.pitch[i] = 0;
    out.rock[i] = 0;
  }
  // On the snow the skis' edge is taken against the snow he inclines to;
  // in the air against the world, as before.
  out.tilt = skiTilt({ edge: skier.edge, roll: r + skier.roll * (1 - g), speed: skier.speed });
  // The legs' length, from the body's origin to the snow along its up.
  const legs =
    skier.spec.cogHeight - (lift[0] + lift[1]) / 2 - skier.spec.crouchDrop * skier.crouch;
  out.pivot.x = legs * sr;
  out.pivot.y = legs * (1 - cr);
  skiShares(skier, out.share);
  return out;
}

/** The drawn orientation's inclination: the engine's at the step, moved by
 * as much as the drawn orientation `q` (between two steps) has rolled off
 * the step's own `skier.q`. */
export function inclineAt(
  skier: Pick<SkierState, "incline" | "q">,
  q: { x: number; y: number; z: number; w: number },
): number {
  // The body's right's climb: −sin of its roll against the vertical.
  const climb = (o: { x: number; y: number; z: number; w: number }) => 2 * (o.x * o.y + o.w * o.z);
  return (
    skier.incline + Math.asin(clamp(-climb(q), -1, 1)) - Math.asin(clamp(-climb(skier.q), -1, 1))
  );
}

/** A ski's offsets off the stance a crawl's gait draws it at (`gaitOf`):
 * out across, forward, its turn off the pair's — none when left out. */
export type GaitOffsets = {
  out: readonly [number, number];
  fore: readonly [number, number];
  splay: readonly [number, number];
};

/** EACH DRAWN SKI'S GAP TO THE SNOW, m, left then right, into `out`: the
 * lowest of its three stations (`probesOf`) over the snow's support under
 * it (the surface less the engine's sink there) — positive a ski floating,
 * negative one buried — laid as the game lays the pair: the body turned
 * about its feet, each ski where the stance puts it, pivoted by `angle`
 * (the skid's, as drawn) about the snow's normal. What the turns lab prints
 * and the suite holds; `drop` is the tuck's (the skis rise toward the
 * body by it). */
export function skiGaps(
  skier: SkierState,
  stand: Stand,
  level: Level,
  angle = skier.skiAngle,
  gait?: GaitOffsets,
  out: [number, number] = [0, 0],
): [number, number] {
  const spec = skier.spec;
  const probes = probesOf(spec);
  const drop = spec.crouchDrop * skier.crouch;
  const cr = Math.cos(stand.incline);
  const sr = Math.sin(stand.incline);
  for (let k = 0; k < 2; k++) {
    const turn = angle + (gait?.splay[k] ?? 0);
    let low = Infinity;
    for (let j = 0; j < 3; j++) {
      // Along the ski, pivoted in the snow's plane and rolled into the body.
      const bz = probes[k * 3 + j].bz;
      const sx = bz * Math.sin(turn);
      const b = rotate(skier.q, {
        x:
          stand.pivot.x +
          ((k ? 1 : -1) * spec.stance) / 2 +
          stand.out[k] +
          (gait?.out[k] ?? 0) +
          sx * cr,
        y: stand.pivot.y - spec.cogHeight + stand.lift[k] + drop + sx * sr,
        z: stand.fore[k] + (gait?.fore[k] ?? 0) + bz * Math.cos(turn),
      });
      const support = level.groundAt(skier.x + b.x, skier.z + b.z) - skier.sinks[k * 3 + j];
      low = Math.min(low, skier.y + b.y - support);
    }
    out[k] = low;
  }
  return out;
}
