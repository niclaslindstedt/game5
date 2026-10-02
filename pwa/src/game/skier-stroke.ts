// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMS' STROKES — what the hands and the poles do through a stride, a
// skate, a double pole and a turn's pole plant, as arithmetic over a
// cycle's phase: where each fist goes off its stance, and each pole as a
// rigid rod TURNED through it, never a tip placed and jumped to. Read by
// `skier-pose.ts`; three-free, so the suite reads it.

import { add, clamp01, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** WHERE A WORKING POLE BITES: `x` out from the centre, m, and the least
 * its basket stands behind the fist, m — a pole is planted angled back,
 * never ahead of the hand that pushes on it. */
export type Basket = { x: number; behind: number };
/** THE DIAGONAL STRIDE'S ARMS: where the hands are, off their stance, at
 * the PLANT (ahead and up) and at the FINISH of the push (down and back
 * past the hips), m, and how far below the straight line between them
 * the hands pass — one arm at a time, a short stroke. */
export type Stroke = {
  plant: { y: number; z: number };
  finish: { y: number; z: number };
  dip: number;
  basket: Basket;
};
/** The double pole's baskets: wide of the boots, and planted with the
 * poles near upright — some 75° to the snow at the plant in measured
 * double poling, so a basket a quarter of the rod behind its fist. The
 * hands' path is `DOUBLE_ARM`'s. */
export const DOUBLE_BASKET: Basket = { x: 0.38, behind: 0.3 };
export const STRIDE_STROKE: Stroke = {
  plant: { y: 0.1, z: 0.26 },
  finish: { y: -0.12, z: -0.4 },
  dip: 0.06,
  basket: { x: 0.3, behind: 0.15 },
};
/** THE DOUBLE POLE'S ARMS, SWUNG FROM THE SHOULDERS: each arm's angle off
 * straight down, rad (forward positive), and its reach as a share of the
 * whole arm, at the PLANT (well ahead, the elbows bent and out, the fists
 * a little under the shoulders) and at the FINISH (long behind the hips);
 * how far the elbows bend through the push, as a share of the arm lost at
 * its middle — the arms pressing down on the poles as the trunk crunches
 * over them — and how much the arm gives at the elbow as it swings
 * forward through the recovery (a share of the arm, shorter negative):
 * hanging loose from the shoulder, a little bent, so the fists come
 * through clear of the thighs. Measured double poling has the elbow bent
 * some 120° at the plant, bent further early in the push and near straight
 * (about 140° open) at the pole's release. Stated off the shoulders rather
 * than the stance, a trunk folded over the poles carries the arms with it
 * and a fist never passes up by the shoulder with the arm folded tight. */
export type ArmSwing = {
  plant: { angle: number; reach: number };
  finish: { angle: number; reach: number };
  bend: number;
  lift: number;
};
export const DOUBLE_ARM: ArmSwing = {
  plant: { angle: 1.2, reach: 0.74 },
  finish: { angle: -0.95, reach: 0.97 },
  bend: 0.3,
  lift: -0.05,
};

/** Where a fist is off its shoulder at `swing` through an arm's stroke
 * (`pushing`, or swung back through the recovery), as shares of the arm's
 * length: down (`y`, negative) and forward (`z`). `span` is how far the
 * push swung (one the snow cut short, `pinnedSwing`): the recovery starts
 * with the elbow bent as that push left it and lets it go on the way
 * forward, so a short stroke turns into its recovery without the arm
 * jumping. */
export function armAt(
  a: ArmSwing,
  swing: number,
  pushing: boolean,
  span = 1,
): { y: number; z: number } {
  const angle = a.plant.angle + (a.finish.angle - a.plant.angle) * swing;
  const u = Math.min(1, swing / Math.max(1e-3, span));
  const give = pushing
    ? -a.bend * Math.sin(Math.PI * swing)
    : a.lift * Math.sin(Math.PI * u) - a.bend * Math.sin(Math.PI * Math.min(1, span)) * u;
  const reach = a.plant.reach + (a.finish.reach - a.plant.reach) * swing + give;
  return { y: -Math.cos(angle) * reach, z: Math.sin(angle) * reach };
}

/** WHERE A PUSHED POLE BITES for a fist at `hand`: its basket on the snow
 * at `ground`, `basket.x` out on the skier's `side`, as far behind the
 * fist as the rod's length leaves once the fist's height is taken off it. */
export function bitePoint(
  basket: Basket,
  side: number,
  ground: number,
  hand: V3,
  pole: number,
): V3 {
  const x = side * basket.x;
  const drop = hand.y - ground;
  const reach = pole * pole - drop * drop - (x - hand.x) ** 2;
  const behind = Math.max(basket.behind, Math.sqrt(Math.max(0, reach)));
  return { x, y: ground, z: hand.z - behind };
}

/** THE STROKE HELD TO THE SNOW: how far through its swing (0..1) a push
 * must be for the basket to be where it bit — `plant` m along the skis at
 * the plant, and the skier `passed` m on past it since — `zAt(s)` the
 * basket's place along him at a swing `s`, falling as the arm drives back.
 * The arm goes back exactly as fast as the snow goes by, so a planted pole
 * stays planted; past what the stroke can sweep it is the whole swing. */
export function pinnedSwing(zAt: (s: number) => number, plant: number, passed: number): number {
  const target = plant - Math.max(0, passed);
  if (zAt(0) <= target) return 0;
  if (zAt(1) >= target) return 1;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 16; k++) {
    const m = (lo + hi) / 2;
    if (zAt(m) > target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** THE POLE PLANT AT SPEED, as shares of the plant: the swing forward
 * ends at the `touch` — a tap at speed — and the rest of it the basket
 * trails back up to its hang. Where the basket touches (`x` out from the
 * centre, m — the rod's own length puts it on the snow ahead of the fist);
 * how far the fist reaches for it — forward, down and out, m — a flick of
 * the wrist and the forearm, the arm never thrown; and how far off the
 * straight swing the rod is lifted going forward and trailing back, rad. */
export const TURN_PLANT = {
  touch: 0.35,
  basket: { x: 0.42 },
  reach: { z: 0.14, y: -0.05, x: 0.04 },
  swingLift: 0.12,
  trailLift: 0.2,
};
/** How a pole swings through the recovery: how far over the snow it is
 * carried, m, and the least tilt off straight down it steps round the
 * outside at, rad. */
const POLE_TRAIL = { clear: 0.04, turn: 0.15 };

/** Ease in and out over 0..1. */
export const smooth = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/** Where an arm is in its stroke at `phase` 0..1 of its own cycle, the
 * push the first `duty` of it: 0 planted, 1 at the finish, and back. Eased
 * at both ends, so an arm comes to the plant and leaves it at rest. */
export const strokeSwing = (phase: number, duty: number): number =>
  phase < duty ? smooth(phase / duty) : 1 - smooth((phase - duty) / (1 - duty));

/** A reach of `l` m eased short of a limb's full `length`: whole under
 * 85 % of it, closing smoothly on 97 %. */
export function easeReach(l: number, length: number): number {
  const knee = 0.85 * length;
  const top = 0.97 * length;
  return l <= knee ? l : knee + (top - knee) * Math.tanh((l - knee) / (top - knee));
}

/** A fist at `hand` eased in toward its `shoulder`, short of the arm's
 * `length` (`easeReach`). */
export function easeFist(shoulder: V3, hand: V3, length: number): V3 {
  const d = sub(hand, shoulder);
  const l = Math.hypot(d.x, d.y, d.z);
  const eased = easeReach(l, length);
  return eased < l ? add(shoulder, scale(d, eased / l)) : hand;
}

/** The shares of a push the pin is eased in over at the plant and out
 * over toward the release — the longer, where the last of the arm's
 * reach would have to be thrown back to keep up with the snow. */
const PIN_EASE = { in: 0.25, out: 0.4 };

/** What a push held to the snow makes of the arms (`holdPush`): each
 * fist, each arm's swing off its shoulder as posed, and each stroke's
 * swing and where its push ends (for `strokePole`). */
export type HeldPush = {
  hands: [V3, V3];
  arm: [{ y: number; z: number }, { y: number; z: number }];
  held: [{ push: number; end: number }, { push: number; end: number }];
};

/**
 * THE DOUBLE POLE'S PUSH HELD TO THE SNOW: a basket bites where the plant
 * put it and stays there while he goes by, the arm driven back exactly as
 * fast as the snow passes (`pinnedSwing`) — a pole pushed on never slides.
 * The engine keeps a push to one sweep of the pole (`strideRate`), so the
 * faster he goes the quicker and harder he works; at a crawl less snow
 * passes than the arm can sweep, the push ends short and the recovery
 * swings back from where it did.
 *
 * `hands` are the fists posed on the clock's swing `arm` (`armAt`), worked
 * by `arms` of the stroke; `plant` the baskets where they bit (the pose at
 * the stroke's plant); `bites` how much of a plant the stroke makes, 0..1
 * (a stroke too short for the snow swings on the clock); `pass` the snow
 * passed in a stride, m, `poled` the snow passed since the plant as the
 * view kept it.
 */
export function holdPush(o: {
  hands: readonly [V3, V3];
  shoulders: readonly [V3, V3];
  plant: readonly V3[] | null;
  arms: number;
  armLength: number;
  arm: { y: number; z: number };
  ground: number;
  pole: number;
  bites: number;
  pass: number;
  phase: number;
  duty: number;
  poled?: number;
  reach: number;
}): HeldPush {
  const { arms, armLength, ground, pole, duty, phase, bites } = o;
  const pushing = phase < duty;
  // A fist moved from `from` (on the arm `base`) to `at` through a push.
  const swungTo = (from: V3, base: { y: number; z: number }, at: { y: number; z: number }): V3 => ({
    x: from.x,
    y: from.y + arms * armLength * (at.y - base.y),
    z: from.z + arms * armLength * (at.z - base.z),
  });
  // The snow passed as the view kept it, handed over to the gait's
  // reckoning by the push's end — which is where the recovery starts.
  const reckoned = o.pass * phase;
  const passed =
    o.poled === undefined
      ? reckoned
      : o.poled + (reckoned - o.poled) * smooth((phase / duty - 0.75) / 0.25);
  const out = [-1, 1].map((side, i) => {
    const zAt = (s: number): number => {
      const h = swungTo(o.hands[i], o.arm, armAt(DOUBLE_ARM, s, true));
      return bitePoint(DOUBLE_BASKET, side, ground, easeFist(o.shoulders[i], h, o.reach), pole).z;
    };
    // The pin eased in over the plant and out over the release: the fist
    // comes to each end of its push at rest, as it leaves the recovery and
    // goes into it, rather than at the snow's speed in a frame.
    const plant = o.plant ? o.plant[i].z : zAt(0);
    const end = 1 + (pinnedSwing(zAt, plant, o.pass * duty) - 1) * bites;
    const u = phase / duty;
    const held = bites * smooth(u / PIN_EASE.in) * smooth((1 - u) / PIN_EASE.out);
    const timed = end * strokeSwing(phase, duty);
    const at = pushing
      ? timed + (pinnedSwing(zAt, plant, passed) - timed) * held
      : end * (1 - smooth((phase - duty) / (1 - duty)));
    const arm = armAt(DOUBLE_ARM, at, pushing, end);
    return {
      hand: easeFist(o.shoulders[i], swungTo(o.hands[i], o.arm, arm), o.reach),
      arm,
      held: { push: at, end },
    };
  });
  return {
    hands: [out[0].hand, out[1].hand],
    arm: [out[0].arm, out[1].arm],
    held: [out[0].held, out[1].held],
  };
}

/** A hand's offset off its stance at `swing` through a stroke. */
export function strokeHand(st: Stroke, swing: number): { y: number; z: number } {
  return {
    y: st.plant.y + (st.finish.y - st.plant.y) * swing - st.dip * Math.sin(Math.PI * swing),
    z: st.plant.z + (st.finish.z - st.plant.z) * swing,
  };
}

/**
 * THE POLE THROUGH A STROKE, as a direction out of the fist `pole` m long:
 * on the push BITING — its basket on the snow behind the fist, as far
 * behind as the rod's length leaves once the fist's height is taken off
 * it, so a pole pushed on is a pole in the snow, angled back further the
 * lower and further back the fist drives; on the recovery turned from
 * where the push left it to where the next plant wants it, the basket
 * trailing. A fist too high for the snow holds the pole at its plant's
 * angle, the basket just off it. A rigid pole whose angle only ever turns,
 * so nothing jumps at the plant or the release. `handAt(swing)` is the
 * fist at a point of the stroke, everything else held; `fist` the fist as
 * posed now, which the recovery carries the basket clear of the snow from.
 */
export function strokePole(
  basket: Basket,
  side: number,
  ground: number,
  phase: number,
  duty: number,
  handAt: (swing: number) => V3,
  pole: number,
  held?: { push: number; end: number },
  fist?: V3,
): V3 {
  const toBasket = (swing: number): V3 => {
    const hand = handAt(swing);
    return norm(sub(bitePoint(basket, side, ground, hand, pole), hand));
  };
  // HELD TO THE SNOW (`pinnedSwing`): the push's swing as the snow has
  // carried it, and where it ended.
  if (phase < duty) return toBasket(held ? held.push : strokeSwing(phase, duty));
  // THE RECOVERY, as a heading and a tilt: the rod swung forward like a
  // pendulum from where the push let go, trailing behind, to the next
  // plant ahead — and where it would pass straight down under the fist,
  // into the snow, stepped round the OUTSIDE at the least tilt the snow
  // leaves it, so the basket is never lower than it can be carried. Two
  // rods blended instead pass through the snow with no heading at all.
  const r = (phase - duty) / (1 - duty);
  const end = held ? held.end : 1;
  const hand = fist ?? handAt(end * (1 - smooth(r)));
  const from = toBasket(end);
  const to = toBasket(0);
  const heading = (d: V3): number => Math.atan2(side * d.x, d.z);
  const tilt = (d: V3): number => Math.acos(Math.max(-1, Math.min(1, -d.y)));
  const t0 = tilt(from);
  const t1 = tilt(to);
  const clear = POLE_TRAIL.clear * Math.sin(Math.PI * r);
  const snow = Math.max(
    POLE_TRAIL.turn,
    Math.acos(Math.max(-1, Math.min(1, (hand.y - ground - clear) / pole))),
  );
  // ...eased at either end into the rod the push left and the plant wants,
  // where either already stands steeper than that.
  const low =
    snow -
    Math.max(0, snow - t0) * (1 - smooth(r / 0.3)) -
    Math.max(0, snow - t1) * smooth((r - 0.7) / 0.3);
  // Along the swing, its tilt signed: behind negative, ahead positive.
  let h0 = heading(from);
  let h1 = heading(to);
  const a0 = Math.cos(h0) < 0 ? -t0 : t0;
  const a1 = Math.cos(h1) < 0 ? -t1 : t1;
  const along = a0 + (a1 - a0) * smooth(r);
  // The heading turns the short way round — out past his side when it
  // passes from behind to ahead, where the swing would go straight down.
  if (h1 - h0 > Math.PI) h0 += 2 * Math.PI;
  else if (h0 - h1 > Math.PI) h1 += 2 * Math.PI;
  const across = a0 < 0 && a1 > 0 ? smooth((along + low) / (2 * low)) : smooth(r);
  const h = h0 + (h1 - h0) * across;
  const t = Math.max(Math.abs(along), low);
  return { x: side * Math.sin(t) * Math.sin(h), y: -Math.cos(t), z: Math.sin(t) * Math.cos(h) };
}

/** Where the turn's planting fist reaches for the touch, 0..1 of
 * `TURN_PLANT.reach`, at `u` through the plant: out to the touch and back. */
export function plantReach(u: number): number {
  return u < TURN_PLANT.touch
    ? smooth(u / TURN_PLANT.touch)
    : 1 - smooth((u - TURN_PLANT.touch) / (1 - TURN_PLANT.touch));
}

/**
 * THE PLANTING POLE'S DIRECTION out of its fist at `u` 0..1 through the
 * plant, from its `hang` (unit), the fist at `hand`, the snow at `ground`
 * and the pole `pole` m long, on the skier's `side` (−1 left).
 */
export function plantPole(
  hang: V3,
  hand: V3,
  ground: number,
  side: number,
  u: number,
  pole: number,
): V3 {
  // A rod of the pole's own length from a fist nearer the snow than
  // that cannot stand vertical, so it swings round the OUTSIDE: its
  // heading turned from trailing behind, out past his side, to the
  // basket ahead and back again, and its angle off the vertical never
  // less than the one that just puts the basket on the snow — which it
  // reaches at the touch.
  const down = Math.min(1, (hand.y - ground) / pole);
  const touchTilt = Math.acos(down);
  const hangTilt = Math.acos(Math.max(-1, Math.min(1, -hang.y)));
  const hangHeading = Math.atan2(side * hang.x, hang.z);
  const touchHeading = Math.atan2(TURN_PLANT.basket.x - side * hand.x, pole * Math.sin(touchTilt));
  const [r, lift] =
    u < TURN_PLANT.touch
      ? [smooth(u / TURN_PLANT.touch), TURN_PLANT.swingLift]
      : [1 - smooth((u - TURN_PLANT.touch) / (1 - TURN_PLANT.touch)), TURN_PLANT.trailLift];
  const tilt = hangTilt + (touchTilt - hangTilt) * r + lift * Math.sin(Math.PI * r);
  const heading = hangHeading + (touchHeading - hangHeading) * r;
  const dir = {
    x: side * Math.sin(tilt) * Math.sin(heading),
    y: -Math.cos(tilt),
    z: Math.sin(tilt) * Math.cos(heading),
  };
  return dir;
}
