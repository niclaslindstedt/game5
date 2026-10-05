// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW SMOOTH A MOTION IS — the lean lab's arithmetic (`scripts/lean-lab.mjs`)
// over one channel sampled at a fixed frame rate: an angle a frame (the
// trunk's lean, the head's roll), read the way an eye reads a motion on a
// screen. A slalom's lean is a slow swing, one side to the other a turn —
// about half a hertz — with a quick crossing between; what reads as HACKY
// is anything riding on that swing faster than a body moves: a frame-rate
// shiver, a kink where one rule hands over to another, a second bump inside
// one turn, a part of the body arriving late or early against the rest.
// Each reading below names one of those. Pure arithmetic; no game module.

/** The value at share `p` (0..1) of the sorted values. */
export function percentile(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
}

export const rms = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0) / Math.max(1, v.length));

/** The centred difference of `x` sampled every `h` s: its rate a sample. */
export function rate(x, h) {
  return x.map((_, i) => {
    const a = x[Math.max(0, i - 1)];
    const b = x[Math.min(x.length - 1, i + 1)];
    const span = (Math.min(x.length - 1, i + 1) - Math.max(0, i - 1)) * h;
    return span > 0 ? (b - a) / span : 0;
  });
}

/** `x` smoothed by a centred Gaussian `sigma` s wide (samples `h` s apart),
 * the window cut at three sigmas and renormalised at the ends. */
export function smoothed(x, h, sigma) {
  const r = Math.max(1, Math.ceil((3 * sigma) / h));
  const w = [];
  for (let k = -r; k <= r; k++) w.push(Math.exp(-0.5 * ((k * h) / sigma) ** 2));
  return x.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -r; k <= r; k++) {
      const j = i + k;
      if (j < 0 || j >= x.length) continue;
      s += w[k + r] * x[j];
      n += w[k + r];
    }
    return s / n;
  });
}

/** THE ROUGHNESS: the share of the RATE's power above `cut` Hz, % — the
 * motion's own swing and its crossings are slow, so a smooth lean has
 * almost all of its rate's power under a few hertz; a shiver, a kink or a
 * snap spreads it up the spectrum. Read off a plain DFT of the rate with
 * its mean taken out and a Hann window over it. */
export function roughness(x, h, cut = 5) {
  const n = x.length;
  if (n < 16) return null;
  const v = rate(x, h);
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const y = v.map((a, i) => (a - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  let low = 0;
  let high = 0;
  const top = Math.floor(n / 2);
  for (let k = 1; k <= top; k++) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) {
      re += y[i] * Math.cos(w * i);
      im -= y[i] * Math.sin(w * i);
    }
    const p = re * re + im * im;
    if (k / (n * h) >= cut) high += p;
    else low += p;
  }
  return low + high > 0 ? (100 * high) / (low + high) : 0;
}

/** THE TURNING POINTS of `x`: every local extreme standing at least
 * `prominence` above (or below) the motion on both sides of it before the
 * motion comes back past it — the turn's own peak, and any bump inside a
 * turn big enough to see. `{ i, v, kind }` a point, `kind` 1 a peak and −1
 * a trough. */
export function turningPoints(x, prominence) {
  const out = [];
  if (x.length < 3) return out;
  // A hysteresis walk: the running extreme is a turning point once the
  // motion has come back from it by the prominence.
  // Until the motion has moved by the prominence, the lowest and highest
  // seen so far (the run's own start is no turning point).
  let lo = 0;
  let hi = 0;
  let dir = 0;
  let ext = 0;
  for (let i = 1; i < x.length; i++) {
    if (dir === 0) {
      if (x[i] > x[hi]) hi = i;
      if (x[i] < x[lo]) lo = i;
      if (x[hi] - x[lo] >= prominence) {
        dir = hi > lo ? 1 : -1;
        ext = hi > lo ? hi : lo;
      }
      continue;
    }
    if (dir > 0) {
      if (x[i] >= x[ext]) ext = i;
      else if (x[ext] - x[i] >= prominence) {
        out.push({ i: ext, v: x[ext], kind: 1 });
        dir = -1;
        ext = i;
      }
    } else {
      if (x[i] <= x[ext]) ext = i;
      else if (x[i] - x[ext] >= prominence) {
        out.push({ i: ext, v: x[ext], kind: -1 });
        dir = 1;
        ext = i;
      }
    }
  }
  return out;
}

/** THE LAG of `y` behind `x`, s (negative: ahead), within `most` s: where
 * the two RATES line up best (the peak of their correlation, refined
 * between samples by a parabola) — and how well they line up there, −1..1. */
export function lagOf(x, y, h, most = 0.3) {
  const a = rate(x, h);
  const b = rate(y, h);
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  const r = Math.round(most / h);
  const corr = (k) => {
    let s = 0;
    let sa = 0;
    let sb = 0;
    for (let i = Math.max(0, -k); i < a.length && i + k < b.length; i++) {
      const u = a[i] - ma;
      const w = b[i + k] - mb;
      s += u * w;
      sa += u * u;
      sb += w * w;
    }
    return sa > 0 && sb > 0 ? s / Math.sqrt(sa * sb) : 0;
  };
  let best = 0;
  let bestC = -2;
  const cs = new Map();
  for (let k = -r; k <= r; k++) {
    const c = corr(k);
    cs.set(k, c);
    if (c > bestC) {
      bestC = c;
      best = k;
    }
  }
  const lo = cs.get(best - 1);
  const hi = cs.get(best + 1);
  let shift = 0;
  if (lo !== undefined && hi !== undefined) {
    const den = lo - 2 * bestC + hi;
    if (den < 0) shift = (0.5 * (lo - hi)) / den;
  }
  return { lag: (best + shift) * h, match: bestC };
}
