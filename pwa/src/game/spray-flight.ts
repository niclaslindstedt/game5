// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WEIGHED PARCEL'S FLIGHT AS A FUNCTION OF THE CLOCK — what the GPU spray
// (`gpu-spray.ts`) flies in its vertex shader, stated once here in
// TypeScript (`flyLaunch`, three-free, so a test holds it to the CPU pool's
// own flight and the snow eval lab reads the ring back) and once in GLSL
// (`SPRAY_FLIGHT_GLSL`), line for line the same.
//
// The flight is the CPU pool's (`spray-mass-pool.ts`'s `step`): QUADRATIC
// drag against the air (the run's wind at the snow) set by the parcel's own
// fall speed, divided by (1 + φ)² for the air the parcel carries with it —
// φ its mass over the air in its own growing volume — and gravity. No closed
// form holds for that (the drag is quadratic in the speed and φ falls as the
// parcel spreads), so it is SOLVED FROM BIRTH ON A FIXED GRID of `FLIGHT
// .steps` steps over its life, graded (t = life·(i/N)²): fine where the
// throw is fast and the curtain thinning, long once it falls at its own
// speed. The grid is the parcel's own, never the frame's, so it lands at the
// same moment whatever frame looks at it. Each step takes the drag as LINEAR
// at the parcel's mean speed over it and is then exact (the exponential
// integrator), which a long step needs. On it is laid THE POOL'S FRAME: the
// pool moves a parcel on the speed it has at the end of each 60 Hz frame,
// so it trails the true path (by its first frame's loss and half a frame's
// of what it loses after), and it finds a parcel down only at the first
// frame past the crossing; both are stated here so the two agree a parcel
// at a time — 1–2 cm (p50) and under 10 cm (p90) on a stop, the fade to a
// frame (`tests/spray_flight_test.ts`). A parcel comes down where its path meets the snow's
// PLANE under where it was thrown (the ground's height and slope there), and
// then runs on down that plane against the snow's friction for a moment
// (`MASS.roll`) and is gone — as the CPU pool's does on the true ground. A
// berm's snow is on the snow from its first moment and only slides.
//
// What it does not do: the CPU's splash of a landed clump into grains is
// thrown by the ring at launch, timed to the landing `flyLaunch` reports.

import { MASS } from "./spray-mass.ts";

/** ONE THROW, as the emitter states it: where and how fast, how long it
 * may fly, its mass and its grains' fall speed, its radius at birth and the
 * eddies' spread, its grains' area a kilogram (0 a clump), the wind at the
 * snow when it left, and the snow's plane under it (its height at x0, z0
 * and its gradient). */
export type Launch = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mass: number;
  term: number;
  rad0: number;
  eddy: number;
  area: number;
  wx: number;
  wz: number;
  /** A berm's: on the snow from the first, sliding. */
  berm: boolean;
  hard: number;
  glint: number;
  h0: number;
  gx: number;
  gz: number;
};

export const emptyLaunch = (): Launch => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  mass: 0,
  term: 1,
  rad0: 0,
  eddy: 0,
  area: 0,
  wx: 0,
  wz: 0,
  berm: false,
  hard: 0,
  glint: 0,
  h0: 0,
  gx: 0,
  gz: 0,
});

/** Where a launch is at an age. `gone` past its life (or its run on the
 * snow); `landed` the moment it came down (−1 still flying). */
export type Flown = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  landed: number;
  gone: boolean;
};

export const emptyFlown = (): Flown => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  size: 0,
  alpha: 0,
  landed: -1,
  gone: true,
});

/** THE FLIGHT'S NUMBERS. */
export const FLIGHT = {
  /** Steps on the parcel's own grid, birth to the end of its life. */
  steps: 16,
  /** How the grid is graded: t = life·(i/N)^power. */
  power: 2,
  /** Steps of its run on the snow once down. */
  slide: 4,
  /** Over the snow it counts as down, m (the CPU pool's). */
  touch: 0.02,
  /** The CPU pool's first look at a parcel, s (a frame): one thrown out of
   * the snow a ski is sunk in that is still under it then is down at once,
   * as the pool has it; one that has risen clear flies. */
  first: 1 / 60,
  g: 9.81,
} as const;

/** The drag's strength a metre of relative speed, 1/m, at `t` s from
 * birth: g / v∞² over (1 + φ)², φ the parcel's mass over the air it
 * carries in its own volume. */
function dragOf(l: Launch, t: number): number {
  let phi = 0;
  if (l.area > 0) {
    const r = l.rad0 + Math.sqrt(2 * MASS.sheet * l.eddy * t);
    phi = l.mass / (MASS.air.rho * MASS.carried * 4.19 * r * r * r);
  }
  return FLIGHT.g / (l.term * l.term) / ((1 + phi) * (1 + phi));
}

/** The drag that would settle a grain at the speed the POOL settles it:
 * stepped a frame at a time, the drag taken on the speed and the frame's
 * fall added after, a grain falls faster than its fall speed v∞ — at v
 * with v² − g·F·v = v∞² (a fine grain's 0.33 m/s at 0.42) — so the clock's
 * form flies it under gravity raised by (v / v∞)², the drag left as it is. */
function flownDrag(l: Launch, t: number): number {
  const v = Math.sqrt(FLIGHT.g / dragOf(l, t));
  const gF = FLIGHT.g * FLIGHT.first;
  const u = 0.5 * (gF + Math.sqrt(gF * gF + 4 * v * v));
  return FLIGHT.g / (u * u);
}

/** One step of `h` s from `t`, the drag taken LINEAR over it at the speed
 * it has on average (a guess, then once more off the guess) and the step
 * then exact: with k = c·|v − wind|, e = e^(−kh), q = (1 − e)/k and
 * m = (h − q)/k (their series where kh is small, for a 32-bit float),
 * v − wind = (v0 − wind)·e − g·q up and x += wind·h + (v0 − wind)·q − g·m
 * up. */
function expStep(l: Launch, t: number, h: number, p: number[], v: number[]): void {
  const c = dragOf(l, t + 0.5 * h);
  // Gravity as the pool's frames have it (`flownDrag`): the fall's own
  // speed reached at the pool's.
  const g = (FLIGHT.g * c) / flownDrag(l, t + 0.5 * h);
  const rx = v[0] - l.wx;
  const ry = v[1];
  const rz = v[2] - l.wz;
  const s0 = Math.hypot(rx, ry, rz);
  let k = Math.max(1e-4, c * s0);
  let e = 0;
  let q = 0;
  let m = 0;
  for (let pass = 0; pass < 2; pass++) {
    const x = k * h;
    e = Math.exp(-x);
    if (x < 0.01) {
      q = h * (1 - x / 2 + (x * x) / 6);
      m = h * h * (0.5 - x / 6 + (x * x) / 24);
    } else {
      q = (1 - e) / k;
      m = (h - q) / k;
    }
    if (pass === 0) k = Math.max(1e-4, c * 0.5 * (s0 + Math.hypot(rx * e, ry * e - g * q, rz * e)));
  }
  p[0] += l.wx * h + rx * q;
  p[1] += ry * q - g * m;
  p[2] += l.wz * h + rz * q;
  v[0] = l.wx + rx * e;
  v[1] = ry * e - g * q;
  v[2] = l.wz + rz * e;
}

/** The snow's plane's height at (x, z). */
const planeAt = (l: Launch, x: number, z: number) => l.h0 + l.gx * (x - l.x) + l.gz * (z - l.z);

/** The plane's unit normal's parts, for the run down it. */
function slideOn(l: Launch, time: number, p: number[], v: number[]): void {
  const inv = 1 / Math.hypot(l.gx, 1, l.gz);
  const nx = -l.gx * inv;
  const ny = inv;
  const nz = -l.gz * inv;
  const h = Math.max(0, time) / FLIGHT.slide;
  const ux = v[0];
  const uz = v[2];
  for (let i = 0; i < FLIGHT.slide; i++) {
    let vx = v[0] + FLIGHT.g * ny * nx * h;
    let vz = v[2] + FLIGHT.g * ny * nz * h;
    const sp = Math.hypot(vx, vz);
    const brake = MASS.roll.mu * FLIGHT.g * ny * h;
    // Each step on its mean speed (the pull and the friction are steady
    // over it), and to where it stops when it stops inside it.
    if (sp > brake) {
      const keep = (sp - brake) / sp;
      p[0] += 0.5 * (v[0] + vx * keep) * h;
      p[2] += 0.5 * (v[2] + vz * keep) * h;
      vx *= keep;
      vz *= keep;
    } else {
      p[0] += 0.25 * (v[0] + vx) * h * (sp / brake);
      p[2] += 0.25 * (v[2] + vz) * h * (sp / brake);
      vx = 0;
      vz = 0;
    }
    v[0] = vx;
    v[2] = vz;
  }
  // The pool's half a frame behind, on the speed it lost.
  p[0] -= 0.5 * FLIGHT.first * (ux - v[0]);
  p[2] -= 0.5 * FLIGHT.first * (uz - v[2]);
  p[1] = planeAt(l, p[0], p[2]) + FLIGHT.touch;
  v[1] = 0;
}

const P = [0, 0, 0];
const V = [0, 0, 0];
const P1 = [0, 0, 0];
const V1 = [0, 0, 0];
const D = [0, 0, 0];
const C1 = [0, 0, 0];

/** WHERE LAUNCH `l` IS AT `age` s: flown on its own grid to the step
 * holding `age`, then the rest of the way; down where it meets the plane;
 * then run on down it. */
export function flyLaunch(l: Launch, age: number, out: Flown): Flown {
  out.landed = -1;
  out.gone = age < 0 || age >= l.life;
  P[0] = l.x;
  P[1] = l.y;
  P[2] = l.z;
  V[0] = l.vx;
  V[1] = l.vy;
  V[2] = l.vz;
  let life = l.life;
  if (l.berm) {
    // On the snow from the first: sliding with the ski that shoved it.
    slideOn(l, Math.min(age, l.life), P, V);
    out.landed = 0;
  } else if (!out.gone) {
    const n = FLIGHT.steps;
    let t = 0;
    let over = P[1] - planeAt(l, P[0], P[2]);
    // THE POOL'S LAG: it moves a parcel a frame at a time on the speed it
    // has at the END of the frame — all its first frame's loss at once,
    // then half a frame's of what it loses after — so it trails the true
    // path by `D` + F/2·(v₁ − v), laid on here so the throw leaves the
    // boots as the pool's does (F its frame, `first`).
    const F = FLIGHT.first;
    P1[0] = P[0];
    P1[1] = P[1];
    P1[2] = P[2];
    V1[0] = V[0];
    V1[1] = V[1];
    V1[2] = V[2];
    expStep(l, 0, F, P1, V1);
    // The pool's own first frame: the drag taken on the speed it was thrown
    // at, implicit, and the frame's fall after it (`spray-mass-pool.ts`).
    const rx = V[0] - l.wx;
    const ry = V[1];
    const rz = V[2] - l.wz;
    const keep = 1 / (1 + dragOf(l, F) * Math.hypot(rx, ry, rz) * F);
    C1[0] = l.wx + rx * keep;
    C1[1] = ry * keep - FLIGHT.g * F;
    C1[2] = l.wz + rz * keep;
    for (let k = 0; k < 3; k++) D[k] = P1[k] - P[k] - C1[k] * F;
    const lagged = (at: number, k: number): number =>
      at >= F ? D[k] + 0.5 * F * (V1[k] - V[k]) : (D[k] * at) / F;
    // THE POOL'S FIRST LOOK, a frame on: a throw skimming the snow, or out
    // of the snow a ski is sunk in, that the frame's move (on the speed the
    // drag has left it) has not carried clear is down there and then.
    const c1x = P[0] + C1[0] * F;
    const c1y = P[1] + C1[1] * F;
    const c1z = P[2] + C1[2] * F;
    const sunk = c1y - planeAt(l, c1x, c1z) < FLIGHT.touch;
    if (sunk && age < F) {
      for (let k = 0; k < 3; k++) P[k] += C1[k] * age;
    } else if (sunk) {
      P[0] = c1x;
      P[1] = c1y;
      P[2] = c1z;
      out.landed = F;
      life = Math.min(l.life, F + (l.area === 0 ? MASS.roll.clump : MASS.roll.time));
      V[0] = C1[0] * MASS.roll.keep;
      V[2] = C1[2] * MASS.roll.keep;
      V[1] = 0;
      slideOn(l, Math.min(age, life) - F, P, V);
    }
    // The last grid point as the pool would have it.
    let qx = P[0];
    let qy = P[1];
    let qz = P[2];
    for (let i = 1; i <= n && !sunk; i++) {
      // The WHOLE step, always: whether it comes down in it is the grid's,
      // never the frame's.
      const t1 = l.life * (i / n) ** FLIGHT.power;
      const h = t1 - t;
      const px = P[0];
      const py = P[1];
      const pz = P[2];
      const vx = V[0];
      const vy = V[1];
      const vz = V[2];
      expStep(l, t, h, P, V);
      const cx = P[0] - lagged(t1, 0);
      const cy = P[1] - lagged(t1, 1);
      const cz = P[2] - lagged(t1, 2);
      const now = cy - planeAt(l, cx, cz);
      // Down only coming DOWN onto the snow (clear of it at the first look).
      const down = now < FLIGHT.touch && V[1] - l.gx * V[0] - l.gz * V[2] < 0;
      // Where the path crossed, and when.
      const f = !down ? 1 : over > FLIGHT.touch ? (over - FLIGHT.touch) / (over - now) : 0;
      // Down at the pool's first frame past the crossing (`first`), when
      // it looks, and from where it then is.
      const tl = Math.ceil((t + f * h) / F - 1e-6) * F;
      const g = Math.min(1, Math.max(f, (tl - t) / h));
      if (down && tl <= age) {
        P[0] = qx + (cx - qx) * g;
        P[2] = qz + (cz - qz) * g;
        P[1] = qy + (cy - qy) * g;
        out.landed = tl;
        // Its run on the snow (`MASS.roll`): a share of its speed along it
        // kept, a moment long.
        life = Math.min(l.life, tl + (l.area === 0 ? MASS.roll.clump : MASS.roll.time));
        V[0] *= MASS.roll.keep;
        V[2] *= MASS.roll.keep;
        V[1] = 0;
        slideOn(l, Math.min(age, life) - tl, P, V);
        break;
      }
      if (t1 >= age) {
        // Still up at `age`, inside this step: the step again, to `age`.
        P[0] = px;
        P[1] = py;
        P[2] = pz;
        V[0] = vx;
        V[1] = vy;
        V[2] = vz;
        expStep(l, t, age - t, P, V);
        P[0] -= lagged(age, 0);
        P[1] -= lagged(age, 1);
        P[2] -= lagged(age, 2);
        // (Coming down later in the step: never under the snow before then.)
        if (down) P[1] = Math.max(P[1], planeAt(l, P[0], P[2]) + FLIGHT.touch);
        break;
      }
      over = now;
      qx = cx;
      qy = cy;
      qz = cz;
      t = t1;
    }
  }
  out.gone = age < 0 || age >= life;
  out.x = P[0];
  out.y = P[1];
  out.z = P[2];
  out.vx = V[0];
  out.vy = V[1];
  out.vz = V[2];
  const r = l.rad0 + Math.sqrt(2 * l.eddy * Math.max(0, age));
  out.size = 2 * r;
  const u = age / life;
  const fade = Math.min(1, age * 40) * (u > 0.8 ? Math.max(0, 1 - u) / 0.2 : 1);
  if (l.area > 0) {
    const tau = (MASS.optics * l.mass * l.area) / (Math.PI * r * r);
    out.alpha = (1 - Math.exp(-tau)) * fade;
  } else out.alpha = fade;
  if (out.gone) out.alpha = 0;
  return out;
}

/** A number as a GLSL float. */
const glf = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** THE SAME FLIGHT IN GLSL — `sprayVertex`'s source for the GPU ring
 * (`gpu-spray.ts`): the ring's five attributes (`RING_LAYOUT`) and
 * `sprayParcel`, `flyLaunch` line for line off the clock `uNow`. */
export const SPRAY_FLIGHT_GLSL = /* glsl */ `
  attribute vec4 aL0; // x0, y0, z0, birth
  attribute vec4 aL1; // vx, vy, vz, life
  attribute vec4 aL2; // mass, fall speed (negative: a berm's), radius at birth, eddies' spread
  attribute vec4 aL3; // grains' area a kilogram (0 a clump), wind x, wind z, hardness
  attribute vec4 aL4; // the snow's height at x0, z0, its slope along x and z, glint
  uniform float uNow;
  uniform float uOldest; // births before it are the ones the CPU pool has overwritten
  const int FLY_STEPS = ${FLIGHT.steps};
  const int FLY_SLIDE = ${FLIGHT.slide};
  const float FLY_POWER = ${glf(FLIGHT.power)};
  const float FLY_G = ${glf(FLIGHT.g)};
  const float FLY_TOUCH = ${glf(FLIGHT.touch)};
  const float FLY_FIRST = ${glf(FLIGHT.first)};
  const float FLY_SHEET = ${glf(MASS.sheet)};
  const float FLY_AIR = ${glf(MASS.air.rho * MASS.carried * 4.19)};
  const float FLY_OPTICS = ${glf(MASS.optics)};
  const float FLY_KEEP = ${glf(MASS.roll.keep)};
  const float FLY_MU = ${glf(MASS.roll.mu)};
  const float FLY_ROLL = ${glf(MASS.roll.time)};
  const float FLY_ROLL_CLUMP = ${glf(MASS.roll.clump)};

  float flyPlane(vec3 p) {
    return aL4.x + aL4.y * (p.x - aL0.x) + aL4.z * (p.z - aL0.z);
  }
  float flyDrag(float t, float term) {
    float phi = 0.0;
    if (aL3.x > 0.0) {
      float r = aL2.z + sqrt(2.0 * FLY_SHEET * aL2.w * t);
      phi = aL2.x / (FLY_AIR * r * r * r);
    }
    return FLY_G / (term * term) / ((1.0 + phi) * (1.0 + phi));
  }
  float flyFlown(float t, float term) {
    float v = sqrt(FLY_G / flyDrag(t, term));
    float gF = FLY_G * FLY_FIRST;
    float u = 0.5 * (gF + sqrt(gF * gF + 4.0 * v * v));
    return FLY_G / (u * u);
  }
  void flyStep(float t, float h, float term, inout vec3 p, inout vec3 v) {
    float c = flyDrag(t + 0.5 * h, term);
    float g = FLY_G * c / flyFlown(t + 0.5 * h, term);
    vec3 w = vec3(aL3.y, 0.0, aL3.z);
    vec3 r = v - w;
    float s0 = length(r);
    float k = max(1e-4, c * s0);
    float e = 0.0;
    float q = 0.0;
    float m = 0.0;
    for (int pass = 0; pass < 2; pass++) {
      float x = k * h;
      e = exp(-x);
      if (x < 0.01) {
        q = h * (1.0 - x / 2.0 + x * x / 6.0);
        m = h * h * (0.5 - x / 6.0 + x * x / 24.0);
      } else {
        q = (1.0 - e) / k;
        m = (h - q) / k;
      }
      if (pass == 0) k = max(1e-4, c * 0.5 * (s0 + length(vec3(r.x * e, r.y * e - g * q, r.z * e))));
    }
    p += vec3(w.x * h + r.x * q, r.y * q - g * m, w.z * h + r.z * q);
    v = vec3(w.x + r.x * e, r.y * e - g * q, w.z + r.z * e);
  }
  void flySlide(float time, inout vec3 p, inout vec3 v) {
    vec3 n = normalize(vec3(-aL4.y, 1.0, -aL4.z));
    float h = max(0.0, time) / float(FLY_SLIDE);
    vec2 u0 = v.xz;
    for (int i = 0; i < FLY_SLIDE; i++) {
      vec2 u = v.xz + FLY_G * n.y * n.xz * h;
      float sp = length(u);
      float brake = FLY_MU * FLY_G * n.y * h;
      if (sp > brake) {
        vec2 w = u * ((sp - brake) / sp);
        p.xz += 0.5 * (v.xz + w) * h;
        v.xz = w;
      } else {
        p.xz += 0.25 * (v.xz + u) * h * (sp / brake);
        v.xz = vec2(0.0);
      }
    }
    p.xz -= 0.5 * FLY_FIRST * (u0 - v.xz);
    p.y = flyPlane(p) + FLY_TOUCH;
    v.y = 0.0;
  }
  bool sprayParcel(out vec3 world, out vec3 move, out float size, out float alpha,
                   out float hard, out float glint, out float seed) {
    float age = uNow - aL0.w;
    float life = aL1.w;
    hard = aL3.w;
    glint = aL4.w;
    seed = fract(float(gl_InstanceID) * 0.618034);
    world = aL0.xyz;
    move = vec3(0.0);
    size = 0.0;
    alpha = 0.0;
    if (age < 0.0 || age >= life || aL0.w < uOldest) return false;
    float term = abs(aL2.y);
    vec3 p = aL0.xyz;
    vec3 v = aL1.xyz;
    if (aL2.y < 0.0) {
      flySlide(min(age, life), p, v);
    } else {
      float t = 0.0;
      float over = p.y - flyPlane(p);
      // The pool's lag (\`flyLaunch\`'s): its first frame's loss, then half a
      // frame's of what it loses after.
      vec3 p1 = p;
      vec3 v1 = v;
      flyStep(0.0, FLY_FIRST, term, p1, v1);
      // The pool's own first frame, and its first look a frame on.
      vec3 w1 = vec3(aL3.y, 0.0, aL3.z);
      vec3 cv = w1 + (v - w1) / (1.0 + flyDrag(FLY_FIRST, term) * length(v - w1) * FLY_FIRST);
      cv.y -= FLY_G * FLY_FIRST;
      vec3 d1 = p1 - p - cv * FLY_FIRST;
      vec3 c1 = p + cv * FLY_FIRST;
      bool sunk = c1.y - flyPlane(c1) < FLY_TOUCH;
      if (sunk && age < FLY_FIRST) {
        p += cv * age;
      } else if (sunk) {
        p = c1;
        life = min(life, FLY_FIRST + (aL3.x > 0.0 ? FLY_ROLL : FLY_ROLL_CLUMP));
        v = vec3(cv.x * FLY_KEEP, 0.0, cv.z * FLY_KEEP);
        flySlide(min(age, life) - FLY_FIRST, p, v);
      }
      vec3 q = p;
      for (int i = 1; i <= FLY_STEPS; i++) {
        if (sunk) break;
        float t1 = life * pow(float(i) / float(FLY_STEPS), FLY_POWER);
        float h = t1 - t;
        vec3 p0 = p;
        vec3 v0 = v;
        flyStep(t, h, term, p, v);
        vec3 c = p - (t1 >= FLY_FIRST ? d1 + 0.5 * FLY_FIRST * (v1 - v) : d1 * t1 / FLY_FIRST);
        float now = c.y - flyPlane(c);
        // The whole step, always: whether it comes down in it is the grid's.
        bool down = now < FLY_TOUCH && v.y - aL4.y * v.x - aL4.z * v.z < 0.0;
        float f = !down ? 1.0 : over > FLY_TOUCH ? (over - FLY_TOUCH) / (over - now) : 0.0;
        float tl = ceil((t + f * h) / FLY_FIRST - 1e-6) * FLY_FIRST;
        float g = min(1.0, max(f, (tl - t) / h));
        if (down && tl <= age) {
          p = q + (c - q) * g;
          life = min(life, tl + (aL3.x > 0.0 ? FLY_ROLL : FLY_ROLL_CLUMP));
          v.xz *= FLY_KEEP;
          v.y = 0.0;
          flySlide(min(age, life) - tl, p, v);
          break;
        }
        if (t1 >= age) {
          // Still up at age, inside this step: the step again, to age.
          p = p0;
          v = v0;
          flyStep(t, age - t, term, p, v);
          p -= age >= FLY_FIRST ? d1 + 0.5 * FLY_FIRST * (v1 - v) : d1 * age / FLY_FIRST;
          if (down) p.y = max(p.y, flyPlane(p) + FLY_TOUCH);
          break;
        }
        over = now;
        q = c;
        t = t1;
      }
    }
    if (age >= life) return false;
    float r = aL2.z + sqrt(2.0 * aL2.w * age);
    size = 2.0 * r;
    float u = age / life;
    float fade = min(1.0, age * 40.0) * (u > 0.8 ? max(0.0, 1.0 - u) / 0.2 : 1.0);
    alpha = aL3.x > 0.0 ? (1.0 - exp(-FLY_OPTICS * aL2.x * aL3.x / (3.14159265 * r * r))) * fade : fade;
    world = p;
    move = v;
    return true;
  }
`;
