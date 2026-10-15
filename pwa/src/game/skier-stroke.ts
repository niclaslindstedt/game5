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
  // Swung ahead of the plant (a swing under 0, the fists coming down into
  // it) the arm is as it is at the plant.
  const u = clamp01(swing / Math.max(1e-3, span));
  const give = pushing
    ? -a.bend * Math.sin(Math.PI * clamp01(swing))
    : a.lift * Math.sin(Math.PI * u) - a.bend * Math.sin(Math.PI * Math.min(1, span)) * u;
  // Carried on past the finish (a swing over 1, `holdPush`'s `over`) the
  // arm goes on round behind him, never longer than it is.
  const reach = Math.min(
    REACH_MOST,
    a.plant.reach + (a.finish.reach - a.plant.reach) * swing + give,
  );
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
 * the wrist and the forearm, the arm never thrown; how far off the
 * straight swing the rod is lifted going forward and trailing back, rad;
 * and how far out past his side it is carried as it passes under the fist,
 * as a share of the touch's lean, and how high its basket is carried over
 * the snow at the middle of the swing, m — a flick that lifts it clear,
 * never a basket dragged along the snow. */
export const TURN_PLANT = {
  touch: 0.55,
  basket: { x: 0.42 },
  reach: { z: 0.14, y: -0.05, x: 0.04 },
  swingLift: 0.12,
  trailLift: 0.2,
  pass: 1,
  clear: 0.05,
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

/** THE PUSH'S TWO ENDS, swung as a body swings them rather than started
 * and stopped. THE PLANT: the arms come down into it out of the recovery
 * already driving back at the pace the planted basket asks, swung up a
 * little ahead of the plant first — the most of a swing they may go ahead
 * of it (`ahead`) — and the pin is eased in over the first `PIN_EASE.in`
 * of the push. THE FINISH: a pole held to the snow sweeps the arm back as
 * fast as the snow passes, and the arm can only go so far; over the last
 * `knee` of its swing it lets the basket go, slowing onto its finish —
 * held to the snow to its very end instead, the fist went from the snow's
 * speed to rest in two frames. A basket that bit ahead of
 * where the arm would put it takes the arm `lead` ahead at the most.
 * THE FOLLOW-THROUGH — an arm let go of its pole at speed is still going
 * back, and carries on behind him, slowing, before it swings forward: the
 * most of a swing's rate it may carry on with, as the recovery's own pace. */
const PIN = { knee: 0.55, ahead: 0.08, lead: 0.05 };
const PIN_EASE = { in: 0.3 };
const FOLLOW = { most: 1.2 };
/** The most of the arm's length a fist swung on past the finish reaches. */
const REACH_MOST = 0.98;
/** The swell's scale: r²(1 − r)³ peaks at 0.4 of the recovery, 108/3125. */
const THROW = 3125 / 108;
const THROW_AT = 0.4;
/** The most the swell adds, as a multiple of `over` — so a follow-through
 * grows from nothing as he gathers speed, never all at once. */
const THROW_MOST = 3;

/** How far through its swing a push is with the basket held to the snow
 * `passed` m behind where it bit (`pinnedSwing`), eased past the knee onto
 * the arm's finish and softly ahead of its plant. */
function heldSwing(zAt: (s: number) => number, plant: number, passed: number): number {
  const knee = 1 - PIN.knee;
  const rest = plant - zAt(knee);
  if (passed > rest) {
    // Past the knee the swing closes on its end at an exponential, its
    // pace at the knee carried in: the arm slowing as the pole lets go,
    // never stopped.
    const rate = 1 / slopeAt(zAt, knee);
    return knee + PIN.knee * (1 - Math.exp(-((passed - rest) * rate) / PIN.knee));
  }
  const ahead = plant - Math.max(0, passed) - zAt(0);
  if (ahead > 0) return -PIN.lead * (1 - Math.exp(-ahead / slopeAt(zAt, 0) / PIN.lead));
  return pinnedSwing(zAt, plant, passed);
}

/** How far a basket goes back along him for a share of the swing at `s`,
 * m — the push's gearing from the snow passed to the arm's swing. */
function slopeAt(zAt: (s: number) => number, s: number): number {
  const a = Math.min(0.98, s);
  return Math.max(1e-3, (zAt(a) - zAt(a + 0.02)) / 0.02);
}

/** A stroke held to the snow: its swing now and where its push ends. */
export type Held = { push: number; end: number };

/** What a push held to the snow makes of the arms (`holdPush`): each
 * fist, each arm's swing off its shoulder as posed, and each stroke's
 * swing and where its push ends (for `strokePole`). */
export type HeldPush = {
  hands: [V3, V3];
  arm: [{ y: number; z: number }, { y: number; z: number }];
  held: [Held, Held];
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
  /** How far past the finish, as a share of the swing, the recovery may
   * carry the arm on behind him once the pole has let go (the
   * follow-through a fast skier throws, `Gait.follow`); 0 stops it there. */
  over?: number;
}): HeldPush {
  const { arms, armLength, ground, pole, duty, phase, bites } = o;
  const pushing = phase < duty;
  const over = Math.max(0, o.over ?? 0);
  // A fist moved from `from` (on the arm `base`) to `at` through a push.
  const swungTo = (from: V3, base: { y: number; z: number }, at: { y: number; z: number }): V3 => ({
    x: from.x,
    y: from.y + arms * armLength * (at.y - base.y),
    z: from.z + arms * armLength * (at.z - base.z),
  });
  // The snow passed since the plant as the view kept it (the gait's own
  // reckoning without it), held at the release through the recovery, and
  // where the push lets go: that, on from here at the stride's pace — the
  // release reckoned off the snow actually passed, so a skier gathering
  // speed is never swept on to a release the snow has not reached in the
  // push's last frames.
  const passed = o.poled ?? o.pass * Math.min(phase, duty);
  const release = pushing ? passed + (duty - phase) * o.pass : passed;
  const out = [-1, 1].map((side, i) => {
    const zAt = (s: number): number => {
      const h = swungTo(o.hands[i], o.arm, armAt(DOUBLE_ARM, s, true));
      return bitePoint(DOUBLE_BASKET, side, ground, easeFist(o.shoulders[i], h, o.reach), pole).z;
    };
    // The push: the basket's place along him as the snow carries it
    // (`heldSwing`), scaled onto the stroke's own end, so a part-biting
    // push (`bites`) still lets go exactly where the recovery takes it
    // from (`end`).
    const plant = o.plant ? o.plant[i].z : zAt(0);
    const pRel = heldSwing(zAt, plant, release);
    const end = 1 + (pRel - 1) * bites;
    const k = pRel > 1e-3 ? end / pRel : 1;
    const pinAt = (p: number): number => k * heldSwing(zAt, plant, p);
    // THE PLANT (`PIN`): the pace, a share of the swing a phase, the snow
    // will drive the arm back at once the basket bites — what the recovery
    // arrives at and the push sets off at, the pin eased in over it.
    const pace = Math.min((6.75 * PIN.ahead) / (1 - duty), (bites * k * o.pass) / slopeAt(zAt, 0));
    const u = phase / duty;
    const timed = end * (3 * u * u - 2 * u * u * u) + pace * duty * (u * u * u - 2 * u * u + u);
    const held = bites * smooth(u / PIN_EASE.in);
    // THE RECOVERY carries on from the release at the pace the push let
    // go at — back behind him, slowing — and swings forward to the next
    // plant, arriving at that plant's pace: a cubic off the swing and its
    // rate at each end. ...never past the arm's own reach behind, or past
    // it by `over` at speed: the cubic carries on some 4/27 of its rate
    // past where the push let go.
    const r = (phase - duty) / (1 - duty);
    const lag = 0.02 * Math.max(1e-3, release);
    const rate = ((bites * (end - pinAt(release - lag))) / lag) * o.pass;
    const follow = Math.min(
      FOLLOW.most,
      6.75 * Math.max(0, 1 - end),
      Math.max(0, rate * (1 - duty)),
    );
    // ...and at speed THROWN ON past it (`over`): a swell on the cubic that
    // leaves the release and the plant as they were (no step in the arm's
    // place or pace at either), carrying the arm on to `1 + over` behind
    // him a little before the recovery's middle.
    const cubic = (r: number): number =>
      end * (2 * r * r * r - 3 * r * r + 1) +
      follow * (r * r * r - 2 * r * r + r) +
      pace * (1 - duty) * (r * r * r - r * r);
    const throwOn = Math.min(THROW_MOST * over, Math.max(0, 1 + over - cubic(THROW_AT)));
    const at = pushing
      ? timed + (pinAt(passed) - timed) * held
      : cubic(r) + throwOn * THROW * r * r * (1 - r) ** 3;
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
  held?: Held,
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
  // ...the plant's rod taken, by the plant, off the fist itself: the arms
  // come into the plant already driving back (`holdPush`), so the rod
  // meets the snow as the push will hold it rather than carried along at
  // the fist's pace.
  const own = held && fist ? norm(sub(bitePoint(basket, side, ground, fist, pole), fist)) : null;
  const to = own
    ? norm(add(scale(toBasket(0), 1 - smooth(r)), scale(own, smooth(r))))
    : toBasket(0);
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
  // The rod swings FORE AND AFT, as a wrist flicks it: its lean along his
  // way going from the hang's (behind, negative) to the touch's, where its
  // basket just meets the snow ahead. A rod of the pole's own length from a
  // fist nearer the snow than that cannot pass under the fist upright, so
  // through the middle of the swing it is carried a little OUT past his
  // side, just enough to keep the basket off the snow, and back in to the
  // touch — a short swing beside the boot, never the long way round. The
  // hang's own set (how far out and across it leans) is carried in at the
  // start and let go of by the touch, so the swing leaves the hang without
  // a jump and comes back to it.
  const down = Math.min(1, (hand.y - ground) / pole);
  const touchTilt = Math.acos(down);
  const sinTilt = Math.sin(touchTilt);
  const along = (d: V3): number => Math.atan2(d.z, -d.y);
  const rodAt = (a: number, out: number): V3 => {
    const t = Math.min(Math.PI / 2, Math.hypot(a, out));
    const h = t > 1e-6 ? Math.atan2(Math.abs(out), a) : 0;
    return { x: side * Math.sin(t) * Math.sin(h), y: -Math.cos(t), z: Math.sin(t) * Math.cos(h) };
  };
  const a0 = along(hang);
  const set = sub(hang, rodAt(a0, 0));
  const [r, lift] =
    u < TURN_PLANT.touch
      ? [smooth(u / TURN_PLANT.touch), TURN_PLANT.swingLift]
      : [1 - smooth((u - TURN_PLANT.touch) / (1 - TURN_PLANT.touch)), TURN_PLANT.trailLift];
  const a = a0 + (touchTilt - a0) * r + lift * Math.sin(Math.PI * r);
  const out = TURN_PLANT.pass * touchTilt * Math.sin(Math.PI * r) * Math.min(1, sinTilt * 4);
  const clear = TURN_PLANT.clear * Math.sin(Math.PI * r);
  return clearSnow(
    norm(add(rodAt(a, out), scale(set, (1 - r) * (1 - r)))),
    hand,
    ground + clear,
    pole,
  );
}

/** How softly a rod is held off the snow (`clearSnow`), as a share of its
 * length: the basket eased up onto the surface over about a centimetre
 * rather than stopped on it in a frame. */
const SNOW_SOFT = 0.008;

/** A rod `dir` (unit) out of the fist at `hand`, its basket kept on or
 * over the snow at `ground`: lifted smoothly (a softplus) where it would
 * go under, its heading kept. */
function clearSnow(dir: V3, hand: V3, ground: number, pole: number): V3 {
  const least = Math.max(-1, (ground - hand.y) / pole);
  const k = (dir.y - least) / SNOW_SOFT;
  const y = least + SNOW_SOFT * (k > 20 ? k : Math.log1p(Math.exp(k)));
  if (y === dir.y || y >= 1) return dir;
  const flat = Math.hypot(dir.x, dir.z);
  const f = flat > 1e-9 ? Math.sqrt(Math.max(0, 1 - y * y)) / flat : 0;
  return { x: dir.x * f, y, z: dir.z * f };
}
