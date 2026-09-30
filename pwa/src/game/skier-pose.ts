// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S POSE, as arithmetic — where his hips, shoulders, hands and
// feet are in the pair's own body frame (x right, y up, z forward, the
// origin at the centre of gravity of skier and skis) for what the engine
// says he is doing. `skier-figure.ts` hangs the figure on these points;
// this module is three-free so the suite reads it
// (`tests/skier_pose_test.ts`, `tests/world_render_test.ts`).
//
// A SKIER STANDS ON HIS SKIS. His boots are clamped to them, so his feet go
// where the skis go — up toward his hips as a leg folds (`lift`, off the
// engine's `skiCompression`), turned with the skid's pivot, tipped with the
// edge — and everything above the boots is his to move. The base pose is
// the athletic stance every skier is taught: the ankles flexed into the
// boots' cuffs, the knees bent, the hips over the feet, the trunk pitched
// a little forward, the hands out ahead at hip height with the poles
// hanging back from them. Every input the engine reports moves it:
//
//   * `crouch` folds him into the TUCK: the hips drop toward the boots and
//     back, the trunk goes to near level, the hands come together ahead of
//     the face and the poles swing back under the arms — the shape every
//     downhill racer makes on a schuss;
//   * `hipRight` is the ANGULATION the engine has put on him (m): the hips
//     go inside the turn and the shoulders stay LEVEL — so the upper body
//     counter-rolls against the hips, the inside knee drives in and the
//     outside leg braces long. That is what a carved turn looks like from
//     behind: a hinge at the hip, not a lean;
//   * `hipAft` and `lean` are the fore and aft weight — back at speed and
//     for a landing, forward to load the tips;
//   * `bump` is his legs taking a hit (`skierSpring`): a landing folds him
//     down and he comes back up;
//   * `plant` (at a crawl, off `plantPulse`) reaches a pole forward to the
//     snow and pushes off it;
//   * on a tricks run a GRAB held in the air folds him to a hand on a ski,
//     kicks the skis apart (a spread) or fore and aft (a daffy).
//
// The limbs are two bones each, solved analytically (`solveLimb`) toward a
// pole — the knees forward and a little out, the elbows out and down — so a
// foot lifted by a folded leg bends the knee rather than stretching it.

import { RAGDOLL as R, type TrickPose } from "@engine";

export type V3 = { x: number; y: number; z: number };

/** Limb lengths and body proportions, m — the engine's own
 * (`TUNING.crash.body`), which the thrown body is built on. */
export const BODY = {
  thigh: 0.44,
  shin: 0.46,
  upperArm: 0.31,
  /** The elbow to the middle of the fist round the pole's grip — the
   * forearm and the hand as one bone, since the hand never leaves the grip. */
  forearm: 0.34,
  /** Hips to the base of the neck. */
  spine: 0.5,
  /** Half the shoulders' width, and of the hips'. */
  shoulder: 0.2,
  hip: 0.12,
  /** Base of the neck to the helmet's centre. */
  neck: 0.18,
  /** How far the shoulder joints sit below the base of the neck, and
   * forward of it — rounded forward, the way a skier holds himself. */
  shoulderDrop: 0.06,
  shoulderFore: 0.03,
};

/** Where the skier is fixed to his skis, and where his free parts settle,
 * in the body frame: for the REFERENCE pair (`SKIS`, a 0.3 m stance under
 * a 1.0 m centre of gravity). `mountsFor` states them for any pair. */
export type Mounts = {
  /** The ankles over the boots' cuffs: half the stance across, the cuff's
   * height over the body's origin, a hair ahead of the boot centre. */
  foot: V3;
  /** The hips standing, and folded into a full tuck. */
  hips: V3;
  tuckHips: V3;
  /** The hands standing (ahead at hip height, the poles hanging back), and
   * in a tuck (together ahead of the face). */
  hand: V3;
  tuckHand: V3;
  /** Where the snow is under the origin, m (negative), and how far ahead a
   * pole plants, m. */
  ground: number;
  poleReach: number;
  /** The pole's length, grip to basket, m. */
  pole: number;
  /** How far a full tuck drops the body's origin toward the skis, m
   * (`SkiSpec.crouchDrop`) — the feet rise by it in the body frame. */
  crouchDrop: number;
};

export const MOUNTS: Mounts = {
  foot: { x: 0.15, y: -0.71, z: 0.02 },
  hips: { x: 0, y: 0.04, z: -0.08 },
  tuckHips: { x: 0, y: -0.02, z: -0.2 },
  hand: { x: 0.3, y: 0.06, z: 0.34 },
  tuckHand: { x: 0.12, y: -0.1, z: 0.66 },
  ground: -1,
  poleReach: 0.9,
  pole: 1.2,
  crouchDrop: 0.3,
};

/** The mounts for a pair: its stance, its centre of gravity, its boots'
 * cuff (`cuff` m over the snow) and its poles. */
export function mountsFor(
  spec: { stance: number; cogHeight: number; poleReach: number; crouchDrop?: number },
  cuff = 0.29,
  pole = 1.2,
): Mounts {
  const dy = 1 - spec.cogHeight;
  return {
    foot: { x: spec.stance / 2, y: -spec.cogHeight + cuff, z: 0.02 },
    hips: { x: 0, y: MOUNTS.hips.y + dy, z: MOUNTS.hips.z },
    tuckHips: { x: 0, y: MOUNTS.tuckHips.y + dy, z: MOUNTS.tuckHips.z },
    hand: { x: MOUNTS.hand.x, y: MOUNTS.hand.y + dy, z: MOUNTS.hand.z },
    tuckHand: { x: MOUNTS.tuckHand.x, y: MOUNTS.tuckHand.y + dy, z: MOUNTS.tuckHand.z },
    ground: -spec.cogHeight,
    poleReach: spec.poleReach,
    pole,
    crouchDrop: spec.crouchDrop ?? MOUNTS.crouchDrop,
  };
}

/** How far the hips go inside for every metre the engine has moved his
 * mass — the hips go further than the centre of mass does, because the
 * feet stay on the skis. */
const HANG = 1.15;
/** The upper body's counter-roll at the engine's full reach, rad: the
 * shoulders held level over hips hung inside. */
const ANGULATE = 0.55;
/** The trunk's pitch standing and in a full tuck, rad (0 upright). */
const PITCH_STAND = 0.32;
const PITCH_TUCK = 1.25;
/** How far the shoulders turn into a turn, rad at full steer — a skier
 * looks and faces down the fall line, so it is little. */
const TWIST = 0.18;
/** How far back a hanging pole swings from the vertical, rad. */
const POLE_HANG = 0.75;

export type SkierPoseInput = {
  hipRight: number;
  hipAft: number;
  lean: number;
  steer: number;
  /** The skis' tilt in the body frame, rad (`skiTilt`), and the skid's
   * pivot, rad — the boots go with them. */
  edge?: number;
  skiAngle?: number;
  /** The tuck the body is in, 0..1 (`SkierState.crouch`). */
  crouch: number;
  /** How far the tuck has dropped the body's origin toward the skis, m —
   * the feet rise by it. `crouch` × the mounts' `crouchDrop` when left
   * out. */
  drop?: number;
  /** Each ski's lift off its rest, m (`gearLift`) — a folded leg. */
  lift?: readonly [number, number];
  airborne: boolean;
  /** Seconds since the last landing — a fresh landing folds the knees when
   * no `bump` is handed in. */
  landing: number;
  /** How far his legs are folded by a hit, m — positive is the body sunk
   * toward the skis (`skierSpring`). */
  bump?: number;
  /** A pole plant in hand, 0..1 (`plantPulse` at a crawl). */
  plant?: number;
  /** A TRICKS run's grab held in the air (`strokes.ts`), or none. */
  trick?: TrickPose | null;
  mounts?: Mounts;
};

export type SkierPose = {
  hips: V3;
  neck: V3;
  head: V3;
  /** Trunk pitch forward, rad, and roll toward the skier's right, rad. */
  pitch: number;
  roll: number;
  knees: [V3, V3];
  feet: [V3, V3];
  shoulders: [V3, V3];
  elbows: [V3, V3];
  hands: [V3, V3];
  /** Each pole's basket end, or null with the poles gone (a thrown skier
   * has let go of them). */
  poles: [V3, V3] | null;
  /** How far the skier looks into the turn, rad (positive to his right). */
  look: number;
};

function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function scale(a: V3, k: number): V3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}
function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function len(a: V3): number {
  return Math.sqrt(dot(a, a));
}
function norm(a: V3): V3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}
function mix(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * TWO BONES FROM `root` TOWARD `target`: the joint between them, bent
 * toward `pole`. Lengths `a` and `b`. A target out of reach is reached for
 * along the same line, fully extended.
 */
export function solveLimb(root: V3, target: V3, a: number, b: number, pole: V3): V3 {
  const span = sub(target, root);
  const d0 = len(span);
  const dir = d0 > 1e-6 ? scale(span, 1 / d0) : { x: 0, y: -1, z: 0 };
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const along = (a * a - b * b + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, a * a - along * along));
  let p = sub(pole, scale(dir, dot(pole, dir)));
  if (len(p) < 1e-6) p = { x: 0, y: 1, z: 0 };
  p = norm(p);
  return add(add(root, scale(dir, along)), scale(p, up));
}

/** A body's own frame in the world: the origin between the hips, `x`
 * across to his right, `y` up the spine, `z` out of his chest. */
export type BodyFrame = { origin: V3; x: V3; y: V3; z: V3 };

/**
 * THE SKIER THROWN — the engine's RAGDOLL (`Thrown.points`, in `RAGDOLL`'s
 * order, world frame) read as a pose: the frame of his trunk found off the
 * hips and the shoulders into `frame`, and every joint put in it, so the
 * figure is turned by the frame and hung on the joints exactly as it is on
 * the skis. Nothing is decided here — where every limb is, is the physics';
 * the lengths are the engine's, which are `BODY`'s. The poles are gone: a
 * thrown skier has let go of them.
 */
export function ragdollPose(points: readonly number[], frame: BodyFrame): SkierPose {
  const at = (i: number): V3 => ({ x: points[3 * i], y: points[3 * i + 1], z: points[3 * i + 2] });
  const hipL = at(R.hipL);
  const hipR = at(R.hipR);
  const shL = at(R.shoulderL);
  const shR = at(R.shoulderR);
  const origin = scale(add(hipL, hipR), 0.5);
  const neckW = scale(add(shL, shR), 0.5);
  const y = norm(sub(neckW, origin));
  const side = sub(shR, shL);
  const x = norm(sub(side, scale(y, dot(side, y))));
  const z = { x: x.y * y.z - x.z * y.y, y: x.z * y.x - x.x * y.z, z: x.x * y.y - x.y * y.x };
  frame.origin = origin;
  frame.x = x;
  frame.y = y;
  frame.z = z;
  const local = (p: V3): V3 => {
    const d = sub(p, origin);
    return { x: dot(d, x), y: dot(d, y), z: dot(d, z) };
  };
  return {
    hips: { x: 0, y: 0, z: 0 },
    neck: local(neckW),
    head: local(at(R.head)),
    pitch: 0,
    roll: 0,
    knees: [local(at(R.kneeL)), local(at(R.kneeR))],
    feet: [local(at(R.footL)), local(at(R.footR))],
    shoulders: [local(shL), local(shR)],
    elbows: [local(at(R.elbowL)), local(at(R.elbowR))],
    hands: [local(at(R.handL)), local(at(R.handR))],
    poles: null,
    look: 0,
  };
}

/** THE WHOLE POSE for one frame. */
export function skierPose(input: SkierPoseInput): SkierPose {
  const M = input.mounts ?? MOUNTS;
  const lean = Math.max(-1, Math.min(1, input.lean));
  const crouch = clamp01(input.crouch);
  const edge = input.edge ?? 0;
  const skiAngle = input.skiAngle ?? 0;
  const lift = input.lift ?? [0, 0];
  const drop = input.drop ?? crouch * M.crouchDrop;
  // A fresh landing takes it in the knees — the spring's, when there is
  // one, or else a fold over a third of a second.
  const bump = input.bump ?? (input.airborne ? 0 : Math.max(0, 1 - input.landing / 0.35) * 0.12);
  const fold = Math.max(0, bump);
  const plant = clamp01(input.plant ?? 0) * (1 - crouch) * (input.airborne ? 0 : 1);
  // Hung inside: how far, as a share of a full hang, signed to the side.
  const hang = Math.max(-1, Math.min(1, input.hipRight / 0.3));

  // THE FEET, on the boots: the cuff's height, raised by the tuck's drop
  // and the ski's lift, carried round by the skid's pivot and across by
  // the edge's tilt.
  const cuff = M.foot.y - M.ground;
  const c = Math.cos(skiAngle);
  const s = Math.sin(skiAngle);
  const feet: [V3, V3] = [-1, 1].map((side) => {
    const x = side * M.foot.x + cuff * Math.sin(edge);
    const z = M.foot.z;
    return { x: x * c + z * s, y: M.foot.y + drop + lift[side < 0 ? 0 : 1], z: -x * s + z * c };
  }) as [V3, V3];
  // The feet's average height: the hips stand over it — a skier hanging in
  // the air with his legs long is not folded by his own lift.
  const feetLift = (lift[0] + lift[1]) / 2;

  // THE HIPS: over the feet standing, down and back in a tuck, inside the
  // turn by the engine's angulation, aft of nominal by the engine's shift,
  // and sunk by a landing's fold.
  const rest = mix(M.hips, M.tuckHips, crouch);
  const hips: V3 = {
    x: rest.x + input.hipRight * HANG,
    y: rest.y + feetLift * 0.5 - 0.06 * Math.abs(hang) - bump + 0.05 * (input.airborne ? 1 : 0),
    z: rest.z - input.hipAft * 0.8 - 0.05 * lean + 0.03 * plant,
  };
  // THE TRUNK: pitched forward more the deeper the tuck, thrown back by a
  // lean, folded further by a landing.
  const pitch =
    PITCH_STAND + (PITCH_TUCK - PITCH_STAND) * crouch - 0.3 * lean * (1 - crouch) + fold * 1.4;
  // Angulated: the shoulders held level while the hips go inside, so the
  // trunk rolls AGAINST the hang.
  const roll = -hang * ANGULATE * (1 - 0.6 * crouch);
  const spineDir: V3 = {
    x: Math.sin(roll) * Math.cos(pitch),
    y: Math.cos(roll) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  const neck = add(hips, scale(norm(spineDir), BODY.spine));
  // The head held up to look down the hill: the neck bends back out of a
  // tuck's pitch, and turns into the turn.
  const look = input.steer * 0.35;
  const head = add(
    neck,
    scale(norm({ x: spineDir.x * 0.3, y: 1, z: spineDir.z * (0.35 + 0.45 * crouch) }), BODY.neck),
  );
  const twist = input.steer * TWIST;
  const across: V3 = norm({
    x: Math.cos(roll) * Math.cos(twist),
    y: -Math.sin(roll),
    z: -Math.cos(roll) * Math.sin(twist),
  });
  const spineUp = norm(spineDir);
  const chest = norm({
    x: across.y * spineUp.z - across.z * spineUp.y,
    y: across.z * spineUp.x - across.x * spineUp.z,
    z: across.x * spineUp.y - across.y * spineUp.x,
  });

  // THE GRABS, in the air: a DAFFY kicks one ski forward and one back, a
  // SPREAD flings both wide, a GRAB folds him to a hand on the outside of
  // his boot.
  if (input.trick === "daffy") {
    feet[0] = { x: feet[0].x, y: feet[0].y - 0.1, z: feet[0].z - 0.45 };
    feet[1] = { x: feet[1].x, y: feet[1].y + 0.1, z: feet[1].z + 0.5 };
  } else if (input.trick === "spread") {
    feet[0] = { x: feet[0].x - 0.45, y: feet[0].y + 0.15, z: feet[0].z + 0.08 };
    feet[1] = { x: feet[1].x + 0.45, y: feet[1].y + 0.15, z: feet[1].z + 0.08 };
  }
  // THE KNEES go forward and a little out; the INSIDE knee of an
  // angulated turn drives in across, the outside stays long.
  const knees = [-1, 1].map((side, i) => {
    const inside = side * hang > 0 ? Math.abs(hang) : 0;
    return solveLimb(add(hips, scale(across, side * BODY.hip)), feet[i], BODY.thigh, BODY.shin, {
      x: side * (0.25 - 0.4 * inside) - 0.2 * hang,
      y: 0.1 - 0.15 * crouch,
      z: 1,
    });
  }) as [V3, V3];
  // The shoulders a little below the base of the neck and rounded forward.
  const yoke = add(add(neck, scale(spineUp, -BODY.shoulderDrop)), scale(chest, BODY.shoulderFore));
  const shoulders = [-1, 1].map((side) => add(yoke, scale(across, side * BODY.shoulder))) as [
    V3,
    V3,
  ];
  // THE HANDS: ahead at hip height standing, together ahead of the face in
  // a tuck, carried in with the hips' hang, a planting hand reaching
  // forward and down to its pole.
  const hands = [-1, 1].map((side) => {
    const h = mix(
      { x: side * M.hand.x, y: M.hand.y, z: M.hand.z },
      { x: side * M.tuckHand.x, y: M.tuckHand.y, z: M.tuckHand.z },
      crouch,
    );
    return {
      x: h.x + input.hipRight * 0.7 + (input.airborne ? side * 0.1 : 0),
      y: h.y + feetLift * 0.3 - bump * 0.5 - 0.12 * plant * (side > 0 ? 1 : 0.4),
      z: h.z + 0.25 * plant + 0.08 * (input.airborne ? 1 : 0) - 0.15 * Math.max(0, lean),
    };
  }) as [V3, V3];
  if (input.trick === "grab") {
    // Folded to the right boot, the other hand out for balance.
    hands[1] = { x: feet[1].x + 0.12, y: feet[1].y + 0.04, z: feet[1].z + 0.12 };
    hands[0] = { x: -0.45, y: hips.y + 0.35, z: 0.1 };
  }
  // Elbows OUT and a little down, tucked in against the ribs in a tuck.
  const elbows = [-1, 1].map((side, i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, {
      x: side * (0.8 - 0.5 * crouch),
      y: -0.6,
      z: -0.35 + 0.3 * crouch,
    }),
  ) as [V3, V3];
  // THE POLES: hanging back from the grips, laid back under the arms in a
  // tuck, and a planted one reaching the snow ahead.
  const poles = [-1, 1].map((side, i) => {
    const hangDir = norm({ x: side * 0.12, y: -Math.cos(POLE_HANG), z: -Math.sin(POLE_HANG) });
    const tuckDir = norm({ x: side * 0.06, y: 0.1, z: -1 });
    const dir = norm(mix(hangDir, tuckDir, crouch));
    const free = add(hands[i], scale(dir, M.pole));
    const planted: V3 = { x: side * 0.4, y: M.ground + drop, z: M.poleReach * 0.9 };
    return mix(free, planted, plant * (side > 0 ? 1 : 0.35));
  }) as [V3, V3];
  return { hips, neck, head, pitch, roll, knees, feet, shoulders, elbows, hands, poles, look };
}

/** THE BODY ON ITS LEGS — the secondary motion a skier's own mass has on
 * top of the skis, kept by the view (it is the picture's, not the
 * physics'): a spring-damper in the pair's vertical, kicked by every change
 * in the pair's own climb, so a landing that stops the skis dead leaves the
 * body still coming down — the knees fold and spring back — and the chatter
 * of a hard piste is a jiggle. */
export type SkierSpring = {
  /** The fold, m (positive sunk), and its rate, m/s. */
  bump: number;
  rate: number;
  /** The pair's climb at the last frame, m/s, or NaN before the first. */
  lastVy: number;
};

/** The body's natural frequency on its legs, rad/s (about 2.3 Hz), its
 * damping ratio, the share of the pair's change of climb the body is
 * kicked by (the legs soak up the rest before the knees move), and the most
 * they fold or extend, m. */
const LEGS = { omega: 14.5, zeta: 0.42, kick: 0.5, fold: 0.22, extend: 0.05 };

export function createSkierSpring(): SkierSpring {
  return { bump: 0, rate: 0, lastVy: Number.NaN };
}

/** Advance the body on its legs by `dt` s for a pair climbing at `vy` m/s
 * (the engine's own), in the air or not. */
export function stepSkierSpring(s: SkierSpring, vy: number, airborne: boolean, dt: number): void {
  if (!(dt > 0)) return;
  if (!Number.isNaN(s.lastVy)) {
    // The pair's change of climb since the last frame is a kick the body
    // does not share: it keeps going the way it was.
    s.rate += (vy - s.lastVy) * LEGS.kick * (airborne ? 0 : 1);
  }
  s.lastVy = vy;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const acc = -LEGS.omega * LEGS.omega * s.bump - 2 * LEGS.zeta * LEGS.omega * s.rate;
    s.rate += acc * h;
    s.bump += s.rate * h;
  }
  if (s.bump > LEGS.fold) {
    s.bump = LEGS.fold;
    s.rate = Math.min(0, s.rate);
  } else if (s.bump < -LEGS.extend) {
    s.bump = -LEGS.extend;
    s.rate = Math.max(0, s.rate);
  }
}
