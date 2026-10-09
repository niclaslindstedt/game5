// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CIVILIAN KNOCKED — a person on foot (`civilian-plan.ts`) met by a
// skier, a snowmobile, a piste machine, a car or another person, and what
// his body does about it: a sway, a step, a stagger of several steps, a
// fall, or a flight off the front of a machine. Three-free, so the suite
// reads it (`tests/civilian_knock_test.ts`); who hits whom is
// `civilian-hits.ts`'s, and how he is drawn `civilians-view.ts`'s.
//
// EVERY REACTION IS THE RAGDOLL. The person is the engine's own body
// (`ragdoll.ts`, the thirteen points a thrown skier is) from the moment he
// is touched until he is back on his feet, stepped by `stepRagdoll` on the
// map's snow and trunks — and while he can still keep his feet he is an
// ACTIVE ragdoll: every point pulled by a damped spring toward a pose of
// the body in its boots (`party-pose.ts`'s keys, the civilians' own), the
// spring as strong as the balance he has left (`Knock.hold`). Lose the
// balance and the springs let go: what is left is the body falling the way
// its momentum and the snow take it, the protective reflex throwing the
// hands out (`ragdoll.ts`'s brace). Getting up is the springs coming back,
// pulling him through a sit and a crouch to his feet.
//
// THE BALANCE is the inverted pendulum every push-recovery study reads a
// shove by (`docs/civilians.md`, "Knocked"): the centre of mass a pendulum
// over the foot that bears it, its CAPTURE POINT (where the body would have
// to stand to come to rest over it: the centre of mass plus its velocity
// over the pendulum's own rate) the whole story. While the capture point is
// inside the feet the ankles and hips hold it (a sway); outside, a STEP is
// taken to put a foot beyond it, a quick one, the foot nearest the way he is
// going, as far as a step in boots on snow reaches — further ahead than
// behind or to the side, least of all crossed over; a step that lands short
// leaves the capture point outside and wants another (the stagger); and
// where no step can reach it any more — the capture point past a step's
// reach from the foot just planted, too many steps, or too fast — he
// cannot keep his feet and goes down. Struck harder than any stepping can
// answer (a machine's front at speed), he is FLOWN: the points below the
// blow taken at its speed and the rest lagging, so the legs are swept and
// he wraps over toward what hit him, lifted off the snow as a body is off a
// vehicle's front (the wrap and forward projection of the reconstruction
// literature).

import {
  RAGDOLL as R,
  TUNING,
  centreOf,
  stepRagdoll,
  type CrowdBody,
  type GameState,
  type Thrown,
} from "@engine";

import { moveOf, type CivilianTarget } from "./civilian-moves.ts";
import { ANKLE, keyPoints, movePoints, type Key } from "./party-pose.ts";

const dt = TUNING.dt;
const N = R.count;

/** THE KNOCK'S NUMBERS. */
export const KNOCK = {
  /** The pendulum's height, m — a person's centre of mass in boots. */
  height: 0.95,
  /** The capture point is held by the ankles and the hips while it is
   * within this of the line between the feet, m (half a boot's length). */
  support: 0.11,
  /** A STEP: how long one takes, s (a recovery step is quicker than a
   * walking one), how high the foot is lifted, m, and how far past the
   * capture point it is set, m, to brake the body over it. */
  stepTime: 0.27,
  stepLift: 0.11,
  stepPast: 0.07,
  /** How far a step reaches from the foot that bears him, m: ahead, back,
   * to the side, and crossed over in front of the other leg — in ski
   * boots, on snow. */
  reach: { ahead: 0.8, back: 0.55, side: 0.62, cross: 0.38 },
  /** The feet are never set nearer each other than this, m. */
  stance: 0.16,
  /** He cannot keep his feet past this many steps, this fast, m/s, or with
   * the capture point this share of a step's reach past the foot just
   * planted. */
  steps: 6,
  fast: 2.6,
  beyond: 1.15,
  /** The hips and the snow take this share of the body's way a second
   * while he staggers. */
  brake: 0.7,
  /** Back at rest: under this speed, m/s, this long, s. */
  rest: { speed: 0.07, hold: 0.5 },
  /** The springs that hold him to the pose: the trunk, the legs and the
   * arms, rad/s, and their damping, a share of critical. */
  spring: { trunk: 24, legs: 34, arms: 13, damp: 0.85 },
  /** Losing his feet: the springs let go over this long, s. */
  let: 0.22,
  /** A body faster than this off the front of what hit it is FLOWN, m/s. */
  fly: 3.2,
  /** Down: he lies once still this long, s — and at the latest this long
   * after he went down — then this long more, s, by how hard the blow
   * was (a light fall, a flight). */
  still: 0.6,
  longest: 9,
  lie: [1.4, 5] as const,
  /** Getting up, s: the sit, then the crouch and the rise. */
  sit: 0.9,
  rise: 1.7,
  /** Walking back to where his routine has him, m/s, and the furthest he
   * walks, s, before he is simply there. */
  back: 1.25,
  backMost: 40,
} as const;

/** What a knock came to, the hardest so far — the labs' and the tests'. */
export type KnockHow = "sway" | "step" | "stagger" | "fall" | "fly";

export type KnockPhase = "stagger" | "down" | "rise" | "back";

type XZ = { x: number; z: number };

/** A PERSON KNOCKED: his body (the ragdoll), the pendulum he balances by,
 * his feet, and where he is in the knock. */
export type Knock = {
  /** Whose body: the figure he is drawn as, his reach and his mass. */
  body: CrowdBody;
  phase: KnockPhase;
  /** Seconds in this phase, and since the first blow. */
  t: number;
  age: number;
  how: KnockHow;
  /** The body. */
  rag: Thrown;
  /** The way he faces, rad (0 = +z, clockwise), and his own frame's
   * origin on the snow — where he stood when first struck. */
  heading: number;
  ox: number;
  oz: number;
  /** The pendulum: the centre of mass over the snow and its velocity. */
  cx: number;
  cz: number;
  vx: number;
  vz: number;
  /** His feet over the snow (left, right), which is swinging and its way
   * from where to where, and how many steps he has taken. */
  feet: [XZ, XZ];
  swing: { foot: 0 | 1; from: XZ; to: XZ; u: number } | null;
  steps: number;
  /** The share of his balance he has left (1 on his feet … 0 gone), and
   * whether he is losing it. */
  hold: number;
  falling: boolean;
  /** Struck sat (on a bench, the snow, a deck chair): held in that pose,
   * never stood, as he tips over. */
  sat: boolean;
  /** How alarmed he is (0 … 1): the arms thrown out. */
  alarm: number;
  /** The trunk thrown by the blow: pitch and roll and their rates. */
  whip: { p: number; r: number; pv: number; rv: number };
  /** At rest this long, s. */
  rest: number;
  /** How hard the hardest blow was, m/s — how long he lies. */
  blow: number;
  /** On skis (a skater): no step is his. Sat when struck. */
  skis: boolean;
  /** Getting up: the body as it lay, the way he will face, where. */
  from: number[] | null;
  /** Walking back: where he is and how far he has walked, m. */
  bx: number;
  bz: number;
  walked: number;
  /** The targets the springs pull toward, last step's and this one's. */
  target: number[];
  was: number[];
};

const right = (h: number): XZ => ({ x: Math.cos(h), z: -Math.sin(h) });
const ahead = (h: number): XZ => ({ x: Math.sin(h), z: Math.cos(h) });
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const smooth = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};

/** A key's points (`keyPoints`, his frame, the floor at 0) laid in the world: his frame at (`ox`, `oz`) turned to `heading`,
 * each point stood on the snow under it as the floor under his feet is. */
function laid(
  state: GameState,
  p: readonly number[],
  ox: number,
  oz: number,
  heading: number,
): number[] {
  const r = right(heading);
  const f = ahead(heading);
  const g0 = state.level.groundAt(ox, oz);
  const out = new Array<number>(3 * N);
  for (let i = 0; i < N; i++) {
    const x = p[3 * i];
    const z = p[3 * i + 2];
    out[3 * i] = ox + r.x * x + f.x * z;
    out[3 * i + 2] = oz + r.z * x + f.z * z;
    out[3 * i + 1] = g0 + p[3 * i + 1];
  }
  // The feet and the knees on the snow under them, not his origin's.
  for (const i of [R.footL, R.footR, R.kneeL, R.kneeR]) {
    out[3 * i + 1] += state.level.groundAt(out[3 * i], out[3 * i + 2]) - g0;
  }
  return out;
}

/** The pose he stood in when struck: what his activity had him at (sat on
 * a bench, on the snow, in a deck chair — or stood). */
export function startTarget(activity: string, seat: number | null): CivilianTarget | "stand" {
  if (activity === "lounge") return "lounge";
  if (seat !== null) return seat > 0 ? "bench" : "snow";
  return "stand";
}

/**
 * A PERSON STRUCK where he stands (`x`, `z`) facing `heading`, in the pose
 * `target`: his body stood up as the ragdoll at that pose, at rest — the
 * blow is `strike`'s.
 */
export function knockOf(
  state: GameState,
  x: number,
  z: number,
  heading: number,
  target: CivilianTarget | "stand",
  skis: boolean,
  body: CrowdBody = "man",
): Knock {
  const pts = laid(state, keyPoints(moveOf(target).key, 0), x, z, heading);
  const com = centreOf(pts);
  const r = right(heading);
  const f = ahead(heading);
  const foot = (s: number): XZ => ({
    x: x + r.x * s * 0.13 + f.x * 0.02,
    z: z + r.z * s * 0.13 + f.z * 0.02,
  });
  const rag: Thrown = {
    cause: "skier",
    t: 0,
    x: com.x,
    y: com.y,
    z: com.z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading,
    tumble: 0,
    points: pts,
    last: pts.slice(),
    touching: true,
    planted: 0,
    // The muscles of a body lying (`ragdoll.ts`'s drive) are slack while
    // he is on his feet: the pose is held here.
    down: 10,
    still: 0,
    impacts: new Array<number>(N).fill(0),
    struck: new Array<number>(N).fill(0),
    netted: 0,
    skis: [],
  };
  const sat = target !== "stand";
  return {
    body,
    phase: "stagger",
    t: 0,
    age: 0,
    how: "sway",
    rag,
    heading,
    ox: x,
    oz: z,
    cx: com.x,
    cz: com.z,
    vx: 0,
    vz: 0,
    feet: [foot(-1), foot(1)],
    swing: null,
    steps: 0,
    hold: sat ? 0.6 : 1,
    // A person sat cannot step: any blow that moves him tips him over.
    falling: sat,
    sat,
    alarm: 0,
    whip: { p: 0, r: 0, pv: 0, rv: 0 },
    rest: 0,
    blow: 0,
    skis,
    from: null,
    bx: x,
    bz: z,
    walked: 0,
    target: pts.slice(),
    was: pts.slice(),
  };
}

const RANK: Record<KnockHow, number> = { sway: 0, step: 1, stagger: 2, fall: 3, fly: 4 };
const worse = (k: Knock, how: KnockHow): void => {
  if (RANK[how] > RANK[k.how]) k.how = how;
};

/**
 * A BLOW: `dv` the change of velocity it gives him (m/s, world, the snow's
 * plane), struck at `high` m over his feet, `lift` the share of it that
 * throws him up (a vehicle's front), from `fx`, `fz` (where the blow came
 * from). Under `KNOCK.fly` his pendulum takes it and his balance answers;
 * past it he is flown.
 */
export function strike(k: Knock, dvx: number, dvz: number, high: number, lift: number): void {
  const dv = Math.hypot(dvx, dvz);
  if (dv < 1e-4) return;
  k.blow = Math.max(k.blow, dv);
  const b = k.rag;
  const P = b.points;
  const L = b.last;
  if (k.phase === "back") restand(k);
  if (dv >= KNOCK.fly || k.phase === "down" || k.phase === "rise") {
    // FLOWN, or a body already down shoved along: every point at the
    // blow's speed below where it struck him and lagging above it — his
    // legs swept and his top wrapped back over toward what hit him — and
    // thrown up off the snow by `lift` of it.
    const floor = Math.min(P[3 * R.footL + 1], P[3 * R.footR + 1]) - ANKLE;
    const flown = dv >= KNOCK.fly && k.phase !== "down";
    for (let i = 0; i < N; i++) {
      const y = P[3 * i + 1] - floor;
      const share = flown ? (y <= high ? 1 : Math.max(0.35, 1 - (y - high) * 0.55)) : 1;
      const up = flown ? lift * dv * (0.6 + 0.4 * share) : 0;
      L[3 * i] -= dvx * share * dt;
      L[3 * i + 1] -= up * dt;
      L[3 * i + 2] -= dvz * share * dt;
    }
    if (flown || k.phase !== "down") letGo(k, flown ? "fly" : "fall");
    return;
  }
  // ON HIS FEET: the pendulum takes the blow, and the trunk is thrown by it
  // — struck high it bends away from the blow, struck low the hips go and
  // the trunk is left behind.
  k.vx += dvx;
  k.vz += dvz;
  for (let i = 0; i < N; i++) {
    L[3 * i] -= dvx * dt;
    L[3 * i + 2] -= dvz * dt;
  }
  const r = right(k.heading);
  const f = ahead(k.heading);
  const along = dvx * f.x + dvz * f.z;
  const across = dvx * r.x + dvz * r.z;
  const sign = high > 1.1 ? 1 : -1;
  k.whip.pv += sign * along * 1.6;
  k.whip.rv += sign * across * 1.6;
  k.rest = 0;
  if (k.phase !== "stagger") {
    k.phase = "stagger";
    k.t = 0;
  }
}

/** Stood up again where he walked back to, at rest, to take a new blow. */
function restand(k: Knock): void {
  // The body is the stance where he is (`stepKnock` keeps it there).
  k.phase = "stagger";
  k.t = 0;
  k.sat = false;
  k.ox = k.bx;
  k.oz = k.bz;
  k.cx = k.bx;
  k.cz = k.bz;
  k.vx = 0;
  k.vz = 0;
  const r = right(k.heading);
  k.feet = [
    { x: k.bx - r.x * 0.13, z: k.bz - r.z * 0.13 },
    { x: k.bx + r.x * 0.13, z: k.bz + r.z * 0.13 },
  ];
  k.swing = null;
  k.steps = 0;
  k.hold = 1;
  k.falling = false;
  k.rag.down = 10;
}

/** He has lost his feet: the springs let go, the reflex throws his hands
 * out (`ragdoll.ts`'s brace, from now till his trunk is down). */
function letGo(k: Knock, how: KnockHow): void {
  worse(k, how);
  k.falling = true;
  k.swing = null;
  k.rag.down = -1;
  if (how === "fly") {
    k.hold = 0;
    k.phase = "down";
    k.t = 0;
  }
}

/** The point on the segment between the feet nearest `p`. */
function nearestOnFeet(k: Knock, px: number, pz: number): XZ {
  const [a, b] = k.feet;
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const l2 = ex * ex + ez * ez || 1e-9;
  const u = clamp(((px - a.x) * ex + (pz - a.z) * ez) / l2, 0, 1);
  return { x: a.x + ex * u, z: a.z + ez * u };
}

/** How far a step may reach from `from` the way (`dx`, `dz`), m, for the
 * foot `foot` stepping — ahead of him, behind, to its own side or across. */
function reachOf(k: Knock, foot: 0 | 1, dx: number, dz: number): number {
  const l = Math.hypot(dx, dz) || 1;
  const r = right(k.heading);
  const f = ahead(k.heading);
  const along = (dx * f.x + dz * f.z) / l;
  const side = (dx * r.x + dz * r.z) / l;
  const own = foot === 1 ? side : -side;
  const lateral = own >= 0 ? KNOCK.reach.side : KNOCK.reach.cross;
  const fore = along >= 0 ? KNOCK.reach.ahead : KNOCK.reach.back;
  // An ellipse between the two.
  return 1 / Math.hypot(along / fore, Math.abs(side) / lateral);
}

const omega = Math.sqrt(TUNING.g / KNOCK.height);

/** THE BALANCE, a step: the pendulum, the step planned and swung, and
 * whether he keeps his feet. */
function balance(k: Knock): void {
  // The capture point, and where the feet hold him.
  const xi = { x: k.cx + k.vx / omega, z: k.cz + k.vz / omega };
  let px: number;
  let pz: number;
  let out = 0;
  if (k.swing) {
    // On one foot: the pressure under it, as far toward the capture point
    // as the boot goes.
    const s = k.feet[1 - k.swing.foot];
    const dx = xi.x - s.x;
    const dz = xi.z - s.z;
    const d = Math.hypot(dx, dz) || 1;
    const c = Math.min(d, KNOCK.support);
    px = s.x + (dx / d) * c;
    pz = s.z + (dz / d) * c;
    out = d - KNOCK.support;
  } else {
    const q = nearestOnFeet(k, xi.x, xi.z);
    const dx = xi.x - q.x;
    const dz = xi.z - q.z;
    const d = Math.hypot(dx, dz);
    out = d - KNOCK.support;
    if (out <= 0) {
      // Held: the pressure set past the capture point from the feet's
      // middle, so it comes back over them.
      const mx = (k.feet[0].x + k.feet[1].x) / 2;
      const mz = (k.feet[0].z + k.feet[1].z) / 2;
      const c = nearestOnFeet(k, xi.x + 0.6 * (xi.x - mx), xi.z + 0.6 * (xi.z - mz));
      const ex = xi.x + 0.6 * (xi.x - mx) - c.x;
      const ez = xi.z + 0.6 * (xi.z - mz) - c.z;
      const e = Math.hypot(ex, ez);
      const s = e > KNOCK.support ? KNOCK.support / e : 1;
      px = c.x + ex * s;
      pz = c.z + ez * s;
    } else {
      px = q.x + (dx / (d || 1)) * KNOCK.support;
      pz = q.z + (dz / (d || 1)) * KNOCK.support;
      if (!k.falling) begin(k, xi);
    }
  }
  k.alarm += ((clamp(Math.max(0, out + 0.08) / 0.3, 0, 1) - k.alarm) * dt) / (out > 0 ? 0.08 : 0.6);
  // The pendulum.
  const w2 = omega * omega;
  k.vx += w2 * (k.cx - px) * dt;
  k.vz += w2 * (k.cz - pz) * dt;
  const brake = Math.exp(-KNOCK.brake * dt);
  k.vx *= brake;
  k.vz *= brake;
  k.cx += k.vx * dt;
  k.cz += k.vz * dt;
  // The swing: re-aimed each step at where the capture point will be at
  // the touch-down, and set down when its time is up.
  const sw = k.swing;
  if (sw) {
    sw.u += dt / KNOCK.stepTime;
    const s = k.feet[1 - sw.foot];
    const left = Math.max(0, 1 - sw.u) * KNOCK.stepTime;
    const grow = Math.exp(omega * left);
    let tx = s.x + (xi.x - s.x) * grow;
    let tz = s.z + (xi.z - s.z) * grow;
    const dx = tx - s.x;
    const dz = tz - s.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    tx += (dx / d) * KNOCK.stepPast;
    tz += (dz / d) * KNOCK.stepPast;
    const most = reachOf(k, sw.foot, dx, dz);
    const want = d + KNOCK.stepPast;
    const l = Math.max(KNOCK.stance, Math.min(want, most));
    sw.to = { x: s.x + (dx / d) * l, z: s.z + (dz / d) * l };
    const e = smooth(sw.u);
    k.feet[sw.foot] = {
      x: sw.from.x + (sw.to.x - sw.from.x) * e,
      z: sw.from.z + (sw.to.z - sw.from.z) * e,
    };
    if (sw.u >= 1) {
      k.swing = null;
      k.steps += 1;
      worse(k, k.steps > 1 ? "stagger" : "step");
      // Planted: can the next step still catch him?
      const nx = xi.x - sw.to.x;
      const nz = xi.z - sw.to.z;
      const short = Math.hypot(nx, nz) - KNOCK.support;
      const next = reachOf(k, sw.foot === 0 ? 1 : 0, nx, nz);
      const speed = Math.hypot(k.vx, k.vz);
      if (short > next * KNOCK.beyond || k.steps >= KNOCK.steps || speed > KNOCK.fast) {
        letGo(k, "fall");
      }
    }
  }
}

/** A STEP BEGUN toward the capture point `xi`: the foot nearest the way he
 * is going steps (to its own side, or the one behind), the other bears him. */
function begin(k: Knock, xi: XZ): void {
  if (k.skis) {
    // On skis there is no step to take: the skis run out from under him.
    letGo(k, "fall");
    return;
  }
  const mx = (k.feet[0].x + k.feet[1].x) / 2;
  const mz = (k.feet[0].z + k.feet[1].z) / 2;
  const dx = xi.x - mx;
  const dz = xi.z - mz;
  const d = Math.hypot(dx, dz) || 1;
  const r = right(k.heading);
  const side = (dx * r.x + dz * r.z) / d;
  let foot: 0 | 1;
  if (Math.abs(side) > 0.72) {
    foot = side > 0 ? 1 : 0;
  } else {
    // The foot further behind the way he goes; the last stance foot's
    // other if they are level.
    const a = (k.feet[0].x - mx) * dx + (k.feet[0].z - mz) * dz;
    const b = (k.feet[1].x - mx) * dx + (k.feet[1].z - mz) * dz;
    foot = a < b ? 0 : 1;
  }
  const from = { ...k.feet[foot] };
  k.swing = { foot, from, to: from, u: 0 };
}

/** The pose the springs pull toward while he is on his feet: his hips over
 * the pendulum, the trunk leant with it and thrown by the blow, the feet
 * where they are (the swinging one lifted), the arms thrown out as far as
 * he is alarmed. */
function standKey(k: Knock): Key {
  const base = moveOf("stand").key;
  const r = right(k.heading);
  const f = ahead(k.heading);
  const loc = (x: number, z: number): { x: number; z: number } => ({
    x: (x - k.ox) * r.x + (z - k.oz) * r.z,
    z: (x - k.ox) * f.x + (z - k.oz) * f.z,
  });
  const c = loc(k.cx, k.cz);
  // Leaning as a pendulum leans: the hips over the pendulum, the trunk on
  // the line from the bearing foot through them.
  const bear = k.swing
    ? k.feet[1 - k.swing.foot]
    : {
        x: (k.feet[0].x + k.feet[1].x) / 2,
        z: (k.feet[0].z + k.feet[1].z) / 2,
      };
  const s = loc(bear.x, bear.z);
  const lx = c.x - s.x;
  const lz = c.z - s.z;
  const feet = [0, 1].map((i) => {
    const p = loc(k.feet[i].x, k.feet[i].z);
    const sw = k.swing && k.swing.foot === i ? k.swing : null;
    const lift = sw ? Math.sin(Math.PI * clamp(sw.u, 0, 1)) * KNOCK.stepLift : 0;
    return { x: p.x, y: ANKLE + lift, z: p.z };
  }) as [Key["feet"][0], Key["feet"][1]];
  // The hips as high as the furthest planted foot lets the leg reach.
  let reach = 0;
  for (const i of [0, 1]) {
    if (k.swing && k.swing.foot === i) continue;
    reach = Math.max(reach, Math.hypot(feet[i].x - c.x, feet[i].z - c.z));
  }
  const leg = 0.88;
  const hipY = Math.min(
    base.hipY - 0.07 * k.alarm,
    ANKLE + Math.sqrt(Math.max(0.2, leg * leg - reach * reach)),
  );
  const a = k.alarm;
  const t = k.age;
  // Arms: thrown out to the sides and up, and forward whichever way he
  // goes — ahead to catch a fall forward, swung forward against one
  // backward — the side he tips to reaching out that way, flapping.
  const dir =
    Math.hypot(lx, lz) > 1e-3
      ? { x: lx / Math.hypot(lx, lz), z: lz / Math.hypot(lx, lz) }
      : { x: 0, z: 0 };
  const hands = [0, 1].map((i) => {
    const side = i ? 1 : -1;
    const h = base.hands[i];
    const flap = 0.09 * Math.sin(t * 11 + i * 2.1);
    return {
      // The key's hands are in his frame, not the hips': carried with them.
      x: h.x + c.x - base.hipX + a * (side * 0.3 + dir.x * 0.16),
      y: h.y + hipY - base.hipY + a * (0.36 + flap),
      z: h.z + c.z - base.hipZ + a * (0.16 + Math.abs(dir.z) * 0.14 + flap),
    };
  }) as [Key["hands"][0], Key["hands"][1]];
  return {
    ...base,
    hipX: c.x,
    hipZ: c.z,
    hipY,
    pitch: base.pitch + Math.atan2(lz, KNOCK.height) * 0.8 + k.whip.p,
    roll: Math.atan2(lx, KNOCK.height) * 0.8 + k.whip.r,
    twist: 0.15 * a * Math.sin(t * 5),
    nod: -0.12 * a,
    feet,
    hands,
  };
}

/** The springs: every point pulled toward the target and its motion, by
 * how much balance (or how far up) he has. */
function pull(k: Knock, share: number): void {
  const P = k.rag.points;
  const L = k.rag.last;
  const T = k.target;
  const W = k.was;
  const S = KNOCK.spring;
  for (let i = 0; i < N; i++) {
    const w = i <= R.head ? S.trunk : i <= R.footR ? S.legs : S.arms;
    const ks = Math.min(0.45, (w * dt) ** 2) * share;
    const kd = Math.min(0.85, 2 * S.damp * w * dt) * share;
    for (let a = 0; a < 3; a++) {
      const j = 3 * i + a;
      const v = P[j] - L[j];
      const tv = T[j] - W[j];
      const dv = ks * (T[j] - P[j]) - kd * (v - tv);
      L[j] -= dv;
    }
  }
}

/** The whip: the trunk thrown by the blow springing back. */
function whip(k: Knock): void {
  const w = k.whip;
  const s = 90;
  const d = 2 * 0.55 * Math.sqrt(s);
  w.pv += (-s * w.p - d * w.pv) * dt;
  w.rv += (-s * w.r - d * w.rv) * dt;
  w.p = clamp(w.p + w.pv * dt, -0.6, 0.6);
  w.r = clamp(w.r + w.rv * dt, -0.5, 0.5);
}

/**
 * ONE STEP OF A KNOCKED PERSON. `home` is where his routine has him now
 * (null when it has none, or he is out of the picture): he walks back to
 * it once he is up. Returns false once he is home — the knock is over.
 */
export function stepKnock(state: GameState, k: Knock, home: XZ | null): boolean {
  k.t += dt;
  k.age += dt;
  const b = k.rag;
  switch (k.phase) {
    case "stagger": {
      whip(k);
      if (!k.falling) balance(k);
      else {
        k.hold = Math.max(0, k.hold - dt / KNOCK.let);
        // The pendulum follows the body he is losing.
        const c = centreOf(b.points);
        k.cx = c.x;
        k.cz = c.z;
      }
      // Sat, he keeps the seat's shape as he goes over; stood, his
      // balance's.
      k.was = k.target;
      if (!k.sat) k.target = laid(state, keyPoints(standKey(k), 0), k.ox, k.oz, k.heading);
      pull(k, k.hold);
      b.t += dt;
      stepRagdoll(state, b);
      if (k.falling && k.hold <= 0) {
        k.phase = "down";
        k.t = 0;
        break;
      }
      if (!k.falling) {
        const speed = Math.hypot(k.vx, k.vz);
        k.rest = speed < KNOCK.rest.speed && !k.swing ? k.rest + dt : 0;
        if (k.rest >= KNOCK.rest.hold) {
          // Kept his feet: stood where his feet are, as he faces.
          k.bx = (k.feet[0].x + k.feet[1].x) / 2;
          k.bz = (k.feet[0].z + k.feet[1].z) / 2;
          if (k.how === "sway" && k.steps === 0) worse(k, "sway");
          k.phase = "back";
          k.t = 0;
        }
      }
      break;
    }
    case "down": {
      b.t += dt;
      stepRagdoll(state, b);
      const lie = KNOCK.lie[0] + (KNOCK.lie[1] - KNOCK.lie[0]) * clamp(k.blow / 8, 0, 1);
      const settled = b.still >= KNOCK.still || k.t >= KNOCK.longest;
      if (!settled) k.rest = 0;
      else k.rest += dt;
      if (k.rest >= lie) {
        // Up: sat up facing his feet, from where his hips lie.
        const P = b.points;
        const hx = (P[3 * R.hipL] + P[3 * R.hipR]) / 2;
        const hz = (P[3 * R.hipL + 2] + P[3 * R.hipR + 2]) / 2;
        const fx = (P[3 * R.footL] + P[3 * R.footR]) / 2;
        const fz = (P[3 * R.footL + 2] + P[3 * R.footR + 2]) / 2;
        const h = Math.hypot(fx - hx, fz - hz) > 0.2 ? Math.atan2(fx - hx, fz - hz) : k.heading;
        k.heading = h;
        const f = ahead(h);
        // The sit's hips stand a quarter metre behind his frame's origin.
        k.ox = hx + f.x * 0.25;
        k.oz = hz + f.z * 0.25;
        k.from = P.slice();
        k.target = P.slice();
        k.was = P.slice();
        b.down = 10;
        k.phase = "rise";
        k.t = 0;
      }
      break;
    }
    case "rise": {
      const from = k.from!;
      const sit = KNOCK.sit;
      let pts: number[];
      if (k.t < sit) {
        const to = laid(state, risePoints(0), k.ox, k.oz, k.heading);
        const e = smooth(k.t / sit);
        pts = from.map((p, j) => p + (to[j] - p) * e);
      } else {
        const u = (k.t - sit) / KNOCK.rise;
        pts = laid(state, risePoints(smooth(u)), k.ox, k.oz, k.heading);
      }
      k.was = k.target;
      k.target = pts;
      pull(k, Math.min(1, 0.4 + k.t / sit));
      b.t += dt;
      stepRagdoll(state, b);
      if (k.t >= sit + KNOCK.rise) {
        const P = b.points;
        k.bx = (P[3 * R.footL] + P[3 * R.footR]) / 2;
        k.bz = (P[3 * R.footL + 2] + P[3 * R.footR + 2]) / 2;
        k.phase = "back";
        k.t = 0;
      }
      break;
    }
    case "back": {
      if (!home || k.t > KNOCK.backMost) return false;
      const dx = home.x - k.bx;
      const dz = home.z - k.bz;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) return false;
      const go = Math.min(d, KNOCK.back * dt);
      k.bx += (dx / d) * go;
      k.bz += (dz / d) * go;
      k.walked += go;
      // Turned toward where he is going, a person's way.
      const want = Math.atan2(dx, dz);
      let turn = want - k.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      k.heading += clamp(turn, -3 * dt, 3 * dt);
      break;
    }
  }
  return true;
}

/** The get-up at `k` of the way from the sit to his feet: the afterski's
 * own (`party-pose.ts`'s rise move), sat on the snow to stood. */
function risePoints(k: number): number[] {
  return movePoints({ kind: "rise", t: 0, k }, 0);
}

/** Whether a knock is drawn as the ragdoll (on his feet staggering, down,
 * getting up) rather than as the standing crowd draws him. */
export function onRagdoll(k: Knock): boolean {
  return k.phase !== "back";
}
