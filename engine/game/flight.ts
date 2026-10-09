// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR — what a skier can still do once the snow has let go of him,
// and what the snow charges when it takes him back.
//
// A skier in the air answers to one lever about his pitch axis: the LEAN
// (the weight thrown back lifts the tips, forward drops them). The edge
// swings the skis across for a little yaw, the body keeps the roll level
// (no control rolls a skier in the air), and the air damps every rate. All
// of it in the BODY frame; tips up is a NEGATIVE torque about x.
//
// A LANDING is the legs' job and the knees take it — the model of a good
// one is nothing at all. What a bad one costs is decided here: past the
// pair's own `harshSpeedOf` (`air.harshSpeed` on the reference pair, less on
// a stiff race ski) of speed INTO the slope the legs have folded to their
// stop and the skier pays a share of his way per m/s over, which is why
// landing on the downslope of a kicker is fast and landing flat after
// overshooting it is not.
//
// AND WHETHER HE RIDES IT AWAY AT ALL (`landingLoad`, `landingFaults`): the
// speed into the slope read as an EQUIVALENT FALL HEIGHT and stopped over
// the legs' stroke and the snow's give is the landing's load in g; the
// bigger it is, the truer the skis have to come down to the slope
// (`landingTolerance`) — and a landing further off true than that, tips
// buried, back seat, on one edge or sideways to the way, throws him
// (`crash.ts`'s crooked landing), as does a load past what the legs hold.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { SKIS, inertiaOf } from "./defs/skis.ts";
import { pipeLanding } from "./pipe-air.ts";
import type { Level } from "../mapgen/types.ts";
import type { SkierState } from "./state.ts";

const A = TUNING.air;
const LD = TUNING.landing;

/** The skier's torques in the air, body frame, N·m, added into `out`.
 * `level` is how much of the roll-levelling the run's assist grants (0..1,
 * `Assist.air`); the damping is the air's and is always there. */
export function airTorque(
  c: SkierState,
  out: { x: number; y: number; z: number },
  level = 1,
  landing: Landing | null = null,
  backward = false,
): void {
  out.x += -A.leanTorque * c.lean;
  out.y += A.steerTorque * c.steer;
  // Roll right-side-down is a negative rotation about the forward axis, so
  // a positive torque takes it back. Past a steep roll the skier has lost
  // it: a body thrown onto its side comes down on its side.
  // A SKIER SPINNING A 360 holds himself upright through it and the hands
  // below let him: past `spinLevel` of yaw rate the roll's and the pitch's
  // levelling are let go. A spinning body's tilt reads as pitch, then as
  // roll, then as pitch again, once a turn — and a spring on each axis
  // chasing a reading that goes round at the spin's own rate is a driven
  // oscillator (the roll's natural rate is the spin's), which wound every
  // 360 into a tumble. Let go, the tilt he threw the spin with stays, a few
  // degrees, and the air's damping is all that touches it. Under
  // `spinFrom` he is not spinning at all — the yaw a landing's skid or a
  // steer left him with — and the hands are whole.
  const spinning = clamp((Math.abs(c.wy) - A.spinFrom) / (A.spinLevel - A.spinFrom), 0, 1);
  const reach = clamp((A.rollGiveUp - Math.abs(c.roll)) / 0.3, 0, 1) * (1 - spinning);
  out.z += (A.rollLevel * level * c.roll - A.rollDamp * c.wz) * reach;
  // ...AND THE PITCH, which is the arcade's: with the lean left alone his
  // body eases the tips toward half the line he is flying along — up off a
  // lip — and, over the last `landLook` s before the snow comes back,
  // toward THE SLOPE HE WILL LAND ON (`landingAhead`), so both skis meet it
  // along their length and the legs take the landing whole. A skier looks
  // at his landing; aimed at the flight path alone, one that overshot a
  // kicker onto the flat came down 20° tips-down and folded to the stop.
  // It gives way to the lean (a skier leaning is flying himself — a flip
  // is a lean carried round) and gives up past `pitchGiveUp`, and it is
  // never more than `pitchLevelMax`.
  // Flying tails first (`backward`, a 180 on a run that lets him), the
  // tails are what rises along the path: the tips aim the other way.
  // A LONG FALL (`fallFrom`): the landing spotted sooner, and laid onto
  // however steep it is.
  const path = Math.atan2(c.vy, hypot(c.vx, c.vz)) * (backward ? -1 : 1);
  const big = landing ? clamp((landing.into - A.fallFrom) / (A.fallFull - A.fallFrom), 0, 1) : 0;
  const spot = A.landLook + (A.fallLook - A.landLook) * big;
  const look = landing ? clamp(1 - landing.t / spot, 0, 1) : 0;
  const most = A.pitchAim + (A.fallAim - A.pitchAim) * big;
  const aim = clamp(
    clamp(path * 0.5, -A.pitchAim, A.pitchAim) * (1 - look) + (landing ? landing.slope : 0) * look,
    -most,
    most,
  );
  // Stated on the reference pair and scaled by this one's pitch inertia: a
  // hand is an acceleration, and a long downhill ski is more to swing.
  const heft = inertiaOf(c.spec).x / inertiaOf(SKIS).x;
  const hand =
    level *
    heft *
    (1 - spinning) *
    (1 - Math.min(1, Math.abs(c.lean))) *
    clamp((A.pitchGiveUp - Math.abs(c.pitch - aim)) / 0.3, 0, 1);
  out.x += clamp(A.pitchLevel * (c.pitch - aim), -A.pitchLevelMax, A.pitchLevelMax) * hand;
  // ...AND HE HOLDS HIS PITCH: a skier who is not leaning does not let a
  // lip or a bounce pitch him round — the turn the snow gave him is taken
  // out at `pitchSteady` (a held tuck carried off a crest included: a held
  // W leans nothing, `input-model.ts`'s `airLean`).
  out.x -= A.pitchSteady * heft * c.wx * hand;
  out.x -= A.damping * c.wx;
  out.y -= A.yawDamping * c.wy;
  out.z -= A.damping * c.wz;
}

/** Where a flight comes down: `t` s from now, onto snow whose slope along
 * the skis is `slope` rad (tips-up positive, as `pitch` is), meeting it at
 * `into` m/s into the slope. */
export type Landing = { t: number; slope: number; into: number };

/** The arc's own time step, s, and how far ahead it is traced, s. */
const ARC_STEP = 1 / 30;
const ARC_HORIZON = 3;

/** WHERE THIS FLIGHT COMES DOWN — the ballistic arc from the CoG under the
 * flight's pull `fall` m/s² (air drag left out: over the three seconds
 * traced it is centimetres), traced until the CoG is back at its standing
 * height over the snow, and the slope there along the skis; null if the
 * snow does not come back within `ARC_HORIZON`. A pure function of the
 * skier and the map: it draws nothing and remembers nothing. */
export function landingAhead(c: SkierState, level: Level, fall: number): Landing | null {
  // A pipe's wall is met along its normal, not under the CoG (`pipe-air.ts`).
  if (level.pipe) {
    const down = pipeLanding(level, c, fall);
    return down ? { t: down.t, slope: 0, into: 0 } : null;
  }
  const stand = c.spec.cogHeight;
  let x = c.x;
  let y = c.y;
  let z = c.z;
  let vy = c.vy;
  for (let t = ARC_STEP; t <= ARC_HORIZON; t += ARC_STEP) {
    x += c.vx * ARC_STEP;
    z += c.vz * ARC_STEP;
    vy -= fall * ARC_STEP;
    y += vy * ARC_STEP;
    if (y - stand > level.groundAt(x, z)) continue;
    level.normalAt(x, z, ground);
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const rise = -(ground.x * fx + ground.z * fz) / Math.max(0.2, ground.y);
    const into = -(c.vx * ground.x + vy * ground.y + c.vz * ground.z);
    return { t, slope: Math.atan(rise), into };
  }
  return null;
}

const ground = { x: 0, y: 1, z: 0 };

/** What a landing met at `impact` m/s into the slope costs a skier whose
 * legs take `harsh` m/s whole (`harshSpeedOf`): the share of the way lost,
 * 0 for one the legs took whole. */
export function landingLoss(impact: number, harsh: number = A.harshSpeed): number {
  if (impact <= harsh) return 0;
  return clamp((impact - harsh) * A.harshLoss, 0, A.harshMax);
}

/** THE EQUIVALENT FALL HEIGHT of a landing met at `impact` m/s into the
 * slope, m — the drop from rest that meets the snow as hard. */
export function fallHeight(impact: number): number {
  return (impact * impact) / (2 * TUNING.g);
}

/** WHAT THE LEGS COULD NOT STOP, m/s: a landing that loads them past
 * `landing.buckle` g folds them, and the body comes on down into the snow
 * with the speed left of `impact` once their whole stroke is spent at the
 * buckle. The fall height goes as the speed squared, so the legs stop
 * (buckle − 1) / (g − 1) of it; at or under the buckle, nothing is left. */
export function carriedThrough(impact: number, g: number): number {
  if (g <= LD.buckle) return 0;
  return impact * Math.sqrt(1 - (LD.buckle - 1) / (g - 1));
}

/** THE LOAD A LANDING PUTS ON HIM, g: the equivalent fall height stopped
 * over the legs' stroke — less what a tuck (`crouch` 0..1) has already
 * folded out of them, and as much of it as his legs stop his weight over
 * (`hold`, `RiderSpec.hold`: a heavy rider's legs less) — and the snow's
 * give, `loose` m of unpressed snow under the skis (`landing.give` of it
 * presses). On a face `slope` rad steep, what falls past
 * `landing.steep.over` m is drawn out down it (`landing.steep`). One g is
 * standing. */
export function landingLoad(
  impact: number,
  crouch: number,
  loose: number,
  hold = 1,
  slope = 0,
): number {
  const stroke =
    LD.stroke * hold * (1 - LD.tuckStroke * clamp(crouch, 0, 1)) + LD.give * Math.max(0, loose);
  const efh = fallHeight(impact);
  const S = LD.steep;
  const u = clamp((slope - S.from) / (S.full - S.from), 0, 1);
  const along = 1 + S.gain * u * u * (3 - 2 * u);
  const past = Math.max(0, efh - S.over);
  return 1 + (efh - past + past / along) / stroke;
}

/** How much of the clean landing's tolerance a load of `g` leaves: the
 * whole of it at `landing.clean` — and more under it, to `1 + slack` of it
 * for a hop that loads him no more than standing — easing to
 * `landing.tight` of it at `landing.buckle` and held there past it (past
 * `crash.legsFold` the legs go whatever the skis did). */
export function landingTolerance(g: number): number {
  if (g <= LD.clean) return 1 + (LD.slack * (LD.clean - Math.max(1, g))) / (LD.clean - 1);
  return 1 - (1 - LD.tight) * Math.min(1, (g - LD.clean) / (LD.buckle - LD.clean));
}

/** HOW FAR OFF TRUE the skis come down, AXIS BY AXIS, each as a share of
 * what a clean landing forgives on it (1 is the edge of it): `tips` the
 * leading end into the slope (`landing.tipsDown`), `tails` the trailing end
 * first (`landing.tailsDown`), `roll` across it (`landing.rolled`) and
 * `slide` sideways to the way (`landing.sideways`, a backward landing a
 * quarter turn more). */
export type LandingFaults = { tips: number; tails: number; roll: number; slide: number };

/** HOW FAR OFF TRUE the skis come down, as a share of what a clean landing
 * forgives (1 is the edge of it): the worst of the leading end into the
 * slope, the trailing end first, the roll across it and the slide sideways
 * to the way (`landingFaults`, axis by axis). The skis' `fwd` and `right`
 * and the ground's `normal` in the world frame, and the velocity.
 * `switchOk` (`RunRules.stunts`) lets him come down BACKWARD: the skis are
 * then judged against the way he is going tails first, the tails the end
 * that must not dig. */
export function landingOff(
  fwd: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  vx: number,
  vz: number,
  switchOk = false,
  vy?: number,
): number {
  const f = landingFaults(fwd, right, normal, vx, vz, switchOk, vy, faults);
  return Math.max(f.tips, f.tails, f.roll, f.slide);
}

const faults: LandingFaults = { tips: 0, tails: 0, roll: 0, slide: 0 };

/** `landingOff` axis by axis (`LandingFaults`), into `out`. */
export function landingFaults(
  fwd: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  vx: number,
  vz: number,
  switchOk = false,
  vy?: number,
  out: LandingFaults = { tips: 0, tails: 0, roll: 0, slide: 0 },
): LandingFaults {
  // On a wall (`vy` given), the slide is read in the snow's own plane: the
  // way across a wall at 80° has next to nothing level in it.
  if (vy !== undefined) return wallOff(fwd, right, normal, vx, vy, vz, switchOk, out);
  const flat = hypot(vx, vz);
  const tailsFirst = flat > 1 && fwd.x * vx + fwd.z * vz < 0;
  const ends = switchOk && tailsFirst ? -1 : 1;
  const pitch = Math.asin(
    clamp(-(fwd.x * normal.x + fwd.y * normal.y + fwd.z * normal.z) * ends, -1, 1),
  );
  // THE ROLL is judged against whichever is nearer of the snow's normal
  // and the plumb: a skier stood plumb onto a sidehill meets it on his
  // uphill edges, the stance he traverses it in, and one laid square onto
  // it is as right; only a body rolled outside both — down the hill past
  // plumb, or over past the slope's own tilt — has nothing under it.
  const across = Math.asin(
    clamp(right.x * normal.x + right.y * normal.y + right.z * normal.z, -1, 1),
  );
  const plumb = Math.asin(clamp(right.y, -1, 1));
  const roll = across * plumb <= 0 ? 0 : Math.min(Math.abs(across), Math.abs(plumb));
  const slide =
    flat > 1
      ? Math.abs(
          Math.asin(clamp((fwd.x * vz - fwd.z * vx) / (flat * (hypot(fwd.x, fwd.z) || 1)), -1, 1)),
        )
      : 0;
  // Landing backwards is landing sideways twice over — unless he may.
  const back = tailsFirst && ends > 0 ? Math.PI / 2 : 0;
  return faultsOf(pitch, roll, slide + back, out);
}

function faultsOf(pitch: number, roll: number, slide: number, out: LandingFaults): LandingFaults {
  out.tips = Math.max(0, pitch) / LD.tipsDown;
  out.tails = Math.max(0, -pitch) / LD.tailsDown;
  out.roll = Math.abs(roll) / LD.rolled;
  out.slide = slide / LD.sideways;
  return out;
}

/** `landingOff` on a WALL: the way and the skis both laid into the snow's
 * plane, the slide the angle between them there. */
function wallOff(
  fwd: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  vx: number,
  vy: number,
  vz: number,
  switchOk: boolean,
  out: LandingFaults,
): LandingFaults {
  const vn = vx * normal.x + vy * normal.y + vz * normal.z;
  const px = vx - vn * normal.x;
  const py = vy - vn * normal.y;
  const pz = vz - vn * normal.z;
  const way = Math.sqrt(px * px + py * py + pz * pz);
  const along = fwd.x * px + fwd.y * py + fwd.z * pz;
  const tailsFirst = way > 1 && along < 0;
  const ends = switchOk && tailsFirst ? -1 : 1;
  const pitch = Math.asin(
    clamp(-(fwd.x * normal.x + fwd.y * normal.y + fwd.z * normal.z) * ends, -1, 1),
  );
  const roll = Math.asin(
    clamp(right.x * normal.x + right.y * normal.y + right.z * normal.z, -1, 1),
  );
  const slide = way > 1 ? Math.acos(clamp(Math.abs(along) / way, 0, 1)) : 0;
  const back = tailsFirst && ends > 0 ? Math.PI / 2 : 0;
  return faultsOf(pitch, roll, slide + back, out);
}
