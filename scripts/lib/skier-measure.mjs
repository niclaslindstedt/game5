// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER MEASURED — a pose (`skierPose`'s, in the pair's body frame)
// read as a body: the angles a coach or a biomechanics paper would read off
// a photograph of a skier, where his centre of mass stands over his feet,
// whether a limb has gone through another, and whether any limb has been
// stretched. Pure arithmetic over the pose's points, so the metrics lab
// (`scripts/skier-metrics.mjs`) and anything else may ask it.
//
// The frame: x right, y up, z forward (the skis'), the snow at the mounts'
// `ground`. A world-frame reading (the head's roll against the horizon)
// takes the pair's orientation `q` as well.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => scale(a, 1 / (len(a) || 1));
const mid = (a, b) => scale(add(a, b), 0.5);
const DEG = 180 / Math.PI;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * DEG;

/** A body-frame vector turned into the world by the pair's quaternion. */
function rotate(q, v) {
  const { x, y, z, w } = q;
  const ix = w * v.x + y * v.z - z * v.y;
  const iy = w * v.y + z * v.x - x * v.z;
  const iz = w * v.z + x * v.y - y * v.x;
  const iw = -x * v.x - y * v.y - z * v.z;
  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}

/** The share of a man's mass in each segment and where along it its
 * centre lies (de Leva 1996, after Zatsiorsky): the trunk with the head
 * stated apart; the shank's own share with half the boot's (a ski boot is
 * two kilograms a foot) laid at the cuff. */
const MASS = {
  head: 0.069,
  trunk: 0.432,
  upperArm: 0.027,
  forearm: 0.022,
  thigh: 0.142,
  shank: 0.043,
  boot: 0.026,
};

/** A SKIER'S POSE MEASURED. `pose` is `skierPose`'s; `q` the pair's
 * orientation and `head` the head's frame in the body frame (both
 * optional — the head's world readings are left out without them);
 * `tilt` the skis' edge in the body frame (or each ski's, a pair) and
 * `turns` each ski's turn off the body's line (the skid's pivot and the skate's V), rad — the boots'
 * frames, pivoted in the snow's plane on a body `incline` rad to it
 * (`ski-stand.ts`); `hipHalf` half the hips' width (`BODY.hip`). */
export function measurePose(
  pose,
  { q = null, head = null, tilt = 0, turns = [0, 0], hipHalf = 0.12, incline = 0 } = {},
) {
  const p = pose;
  const up = norm(sub(p.neck, p.hips));
  const across = norm(sub(p.shoulders[1], p.shoulders[0]));
  const hipJ = p.hipJoints ?? [-1, 1].map((s) => add(p.hips, scale(across, s * hipHalf)));
  // THE CENTRE OF MASS, off the segments' shares.
  let com = { x: 0, y: 0, z: 0 };
  let m = 0;
  const put = (pt, w) => {
    com = add(com, scale(pt, w));
    m += w;
  };
  put(p.head, MASS.head);
  put(add(p.hips, scale(sub(p.neck, p.hips), 0.45)), MASS.trunk);
  for (const i of [0, 1]) {
    put(add(p.shoulders[i], scale(sub(p.elbows[i], p.shoulders[i]), 0.42)), MASS.upperArm);
    put(add(p.elbows[i], scale(sub(p.hands[i], p.elbows[i]), 0.45)), MASS.forearm);
    put(add(hipJ[i], scale(sub(p.knees[i], hipJ[i]), 0.41)), MASS.thigh);
    put(add(p.knees[i], scale(sub(p.feet[i], p.knees[i]), 0.44)), MASS.shank);
    put(p.feet[i], MASS.boot);
  }
  com = scale(com, 1 / m);
  const feetMid = mid(p.feet[0], p.feet[1]);

  // EACH BOOT'S FRAME: forward along its ski, up its tipped normal, right
  // across it.
  const tilts = Array.isArray(tilt) ? tilt : [tilt, tilt];
  const lean = (v) => ({
    x: v.x * Math.cos(incline) - v.y * Math.sin(incline),
    y: v.x * Math.sin(incline) + v.y * Math.cos(incline),
    z: v.z,
  });
  const boots = turns.map((t, i) => {
    const tilt = tilts[i] + incline;
    const f = { x: Math.sin(t), y: 0, z: Math.cos(t) };
    const r0 = { x: Math.cos(t), y: 0, z: -Math.sin(t) };
    const n = add(scale(r0, Math.sin(tilt)), { x: 0, y: Math.cos(tilt), z: 0 });
    const r = add(scale(r0, Math.cos(tilt)), { x: 0, y: -Math.sin(tilt), z: 0 });
    return { f: lean(f), n: lean(n), r: lean(r) };
  });
  // THE LEGS: the knee's flexion (0 straight), the shin's forward lean off
  // the skis' normal in the side view (the boot's cuff holds it at its own
  // lean), the hip's flexion between the thigh and the trunk.
  const leg = [0, 1].map((i) => {
    const thigh = sub(p.knees[i], hipJ[i]);
    const shin = sub(p.feet[i], p.knees[i]);
    const knee = angle(thigh, shin);
    const shinUp = scale(shin, -1);
    const shinLean = Math.atan2(dot(shinUp, boots[i].f), dot(shinUp, boots[i].n)) * DEG;
    const hip = angle(thigh, scale(up, -1));
    return { knee, shinLean, hip, length: len(sub(p.feet[i], hipJ[i])) };
  });
  // THE TRUNK: its pitch forward of the skis' normal, and its roll in the
  // back view; the ANGULATION is the trunk's line against the outside
  // leg's (hip to cuff) in the back view — the hinge at the hips a carved
  // turn is made of — and the INCLINATION is the whole body's lean
  // (cuffs to the neck) off the skis' normal in the same view.
  const trunkPitch = Math.atan2(up.z, up.y) * DEG;
  // The back's ROUNDING: how far the chest's span is bent off the
  // lumbar's at the small of the back.
  const backRound = p.waist ? angle(sub(p.waist, p.hips), sub(p.neck, p.waist)) : 0;
  const trunkRoll = Math.atan2(up.x, up.y) * DEG;
  const outer = p.hips.x > feetMid.x ? 0 : 1; // the leg on the far side from the hips
  const legLine = sub(hipJ[outer], p.feet[outer]);
  // The back view is taken along the SKIS (their mean turn), not the
  // way he travels: thrown across in a skid, the legs lean across the
  // skis, and a view along the travel sees them side on.
  const turn = (turns[0] + turns[1]) / 2;
  const acrossSkis = { x: Math.cos(turn), y: 0, z: -Math.sin(turn) };
  const frontal = (v) => Math.atan2(dot(v, acrossSkis), v.y) * DEG;
  const angulation = Math.abs(frontal(up) - frontal(legLine));
  const inclination = frontal(sub(p.neck, feetMid));
  // THE BOOTS hold the shins: a ski tipped on its edge tips its boot, and
  // the boot's cuff tips the shin with it — each shin's angle out of its
  // boot's own plane (the skis' length and their tipped normal, `tilt` rad
  // right edges down), whatever its forward lean.
  const shinTilt = [0, 1].map(
    (i) =>
      Math.asin(Math.max(-1, Math.min(1, dot(norm(sub(p.knees[i], p.feet[i])), boots[i].r)))) * DEG,
  );
  const bootOff = Math.max(...shinTilt.map(Math.abs));
  // IN THE WORLD: the trunk's and the legs' lean off the true vertical
  // across his way (+ toward his right), when the pair's turn is known.
  let trunkLean = null;
  let legLean = null;
  if (q) {
    const right = rotate(q, { x: 1, y: 0, z: 0 });
    const flat = norm({ x: right.x, y: 0, z: right.z });
    const lean = (v) => Math.asin(Math.max(-1, Math.min(1, dot(norm(rotate(q, v)), flat)))) * DEG;
    trunkLean = lean(up);
    legLean = lean(sub(p.hips, feetMid));
  }
  // THE SHOULDERS against the hips, seen from above: the upper body's
  // counter-rotation (+ his shoulders turned to his right of his hips).
  const hipAxis = sub(hipJ[1], hipJ[0]);
  const shAxis = sub(p.shoulders[1], p.shoulders[0]);
  const twist = (Math.atan2(-shAxis.z, shAxis.x) - Math.atan2(-hipAxis.z, hipAxis.x)) * DEG;
  // THE HEAD: the eye line's roll against the HORIZON and the gaze's
  // pitch below it, in the world, off the head's own frame (`head`: its
  // x across the eyes and z the way the face looks — `skierBones`'s).
  // The gaze is read against the SKIS' plane (the slope he skis), not
  // the horizon: down a pitch, a skier looks down it.
  let headRoll = null;
  let gaze = null;
  if (head) {
    gaze = -Math.asin(Math.max(-1, Math.min(1, head.z.y))) * DEG;
    if (q) headRoll = Math.asin(Math.max(-1, Math.min(1, rotate(q, head.x).y))) * DEG;
  }

  // THE HANDS: ahead of the hips (m), apart (m), and over the snow.
  const handsAhead = mid(p.hands[0], p.hands[1]).z - p.hips.z;
  const handsApart = Math.abs(p.hands[1].x - p.hands[0].x);

  // THROUGH HIMSELF: the least clearance between parts that must not meet
  // (m, negative is inside): a hand or an elbow in the trunk (a capsule
  // from the hips to the neck, 0.15 m round), the knees through each
  // other (0.06 m each), a forearm through a thigh (0.06 + 0.05 m).
  const segDist = (pt, a, b) => {
    const d = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(pt, a), d) / (dot(d, d) || 1)));
    return len(sub(pt, add(a, scale(d, t))));
  };
  const segSeg = (a0, a1, b0, b1) => {
    let best = Infinity;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      best = Math.min(best, segDist(add(a0, scale(sub(a1, a0), t)), b0, b1));
    }
    return best;
  };
  const trunkClear = Math.min(
    ...[0, 1].flatMap((i) => [
      segDist(p.hands[i], p.hips, p.neck) - 0.15 - 0.045,
      segDist(p.elbows[i], add(p.hips, scale(up, 0.15)), p.neck) - 0.15 - 0.05,
    ]),
  );
  // THE KNEES UNDER THE HIPS: how far the higher knee stands over its own
  // hip joint along the skis' normal, m — a skier's knees fold forward
  // over his boots, never up past his hips.
  const kneeRise = Math.max(...[0, 1].map((i) => p.knees[i].y - hipJ[i].y));
  const kneeClear = segSeg(p.knees[0], p.feet[0], p.knees[1], p.feet[1]) - 0.12;
  const thighClear = segSeg(hipJ[0], p.knees[0], hipJ[1], p.knees[1]) - 0.15;
  const armLeg = Math.min(
    ...[0, 1].flatMap((i) =>
      [0, 1].map((j) => segSeg(p.elbows[i], p.hands[i], hipJ[j], p.knees[j]) - 0.11),
    ),
  );
  return {
    com,
    comAhead: com.z - feetMid.z,
    comOver: com.x - feetMid.x,
    comHeight: com.y - feetMid.y,
    knee: leg.map((l) => l.knee),
    kneeRise,
    shinLean: leg.map((l) => l.shinLean),
    hip: leg.map((l) => l.hip),
    legLength: leg.map((l) => l.length),
    trunkPitch,
    trunkRoll,
    backRound,
    angulation,
    inclination,
    shinTilt,
    bootOff,
    trunkLean,
    legLean,
    twist,
    headRoll,
    gaze,
    handsAhead,
    handsApart,
    clear: { trunk: trunkClear, knees: kneeClear, thighs: thighClear, armLeg },
  };
}

/** The largest distance any joint moved between two poses, m, and which;
 * with a third (`c`, the one before `a`), the largest change in that
 * motion — the second difference, m a frame a frame, the measure of a
 * SNAP: a joint swung fast moves far between frames, but only a joint that
 * jumps changes its motion all at once. */
export function poseTravel(a, b, c = null) {
  let best = 0;
  let which = "";
  let snap = 0;
  let snapped = "";
  const visit = (name, pa, pb, pc) => {
    const d = len(sub(pa, pb));
    if (d > best) {
      best = d;
      which = name;
    }
    if (pc) {
      const k = len(add(sub(pb, pa), sub(pc, pa)));
      if (k > snap) {
        snap = k;
        snapped = name;
      }
    }
  };
  for (const k of ["hips", "neck", "head"]) visit(k, a[k], b[k], c?.[k]);
  for (const k of ["knees", "feet", "shoulders", "elbows", "hands"]) {
    visit(`${k}[0]`, a[k][0], b[k][0], c?.[k][0]);
    visit(`${k}[1]`, a[k][1], b[k][1], c?.[k][1]);
  }
  return { travel: best, joint: which, snap, snapped };
}
