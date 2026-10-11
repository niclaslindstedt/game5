// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JACKETS AND THE PANTS, CUT — each garment of the catalog
// (`outfit.ts`) lofted on the loom (`dress-loft.ts`) over the body's
// measure (`dress-body.ts`) in the pose the rig is bound in, so it bends
// with the skier as one cloth.
//
// A garment is the body's sections PLUS ITS EASE — how loose it hangs off
// him, m a side (a race shell 2–3 cm, a puffer's down 4–5, a freeride
// shell cut big at 4) — down to its HEM (a level of the trunk: the race
// shell just under the seat, the freeride shell to the upper thigh, a
// retro jacket at the waist), with a FOLD (a puffer's baffles sewn through
// every 10 cm, the kangaroo pocket's bulge, a cargo pocket) and a COLOUR
// rule cut on clean lines (the yoke, the zip, the hem band, a sleeve's
// stripe, a retro jacket's slashed panels, a race pant's side stripe).
// The layers stand clear of each other by their ease: the pants under the
// jacket at the waist, the jacket's cuff over the glove's (or under the
// gauntlet's), the pants' gaiter over the boot's cuff.
//
// Angles round a ring: 0 its +x, π/2 its +z — on the trunk the chest, on a
// leg the knee's front, on a sleeve the elbow's point.

import {
  BODY_MEASURES,
  builtTo,
  trunkAt,
  type BodyMeasure,
  type TrunkLevel,
} from "./dress-body.ts";
import {
  add,
  bindPose,
  clothWeights,
  cross,
  dot,
  mul,
  norm,
  rides,
  smoothstep,
  sub,
  type Loom,
  type Section,
  type V3,
} from "./dress-loft.ts";
import { gearOf, type JacketId, type Outfit, type PantsId } from "./outfit.ts";

const TAU = Math.PI * 2;
const FRONT = Math.PI / 2;
/** The distance round from `a` to `b`, rad, either way. */
const gap = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
};

/** THE TRUNK'S LINE: from under the seat up the spine through the small of
 * the back to the base of the neck — `S(level)` m along it. */
const BELOW = 0.32;
function trunkLine() {
  const { frames: F, pose: P } = bindPose();
  // Straight down under the seat (the pelvis is pitched forward, and a
  // skirt lofted down its own axis would jut out behind).
  const down = norm({ x: 0, y: -1, z: 0.04 });
  return {
    path: [
      add(P.hips, mul(down, BELOW)),
      P.hips,
      P.waist,
      P.neck,
      add(P.neck, mul(F.chest.y, 0.1)),
    ],
    face: [F.pelvis.z, F.pelvis.z, norm(add(F.pelvis.z, F.chest.z)), F.chest.z, F.chest.z],
    S: (level: number) => BELOW + level * 0.5,
    L: (s: number) => (s - BELOW) / 0.5,
  };
}

/** A garment's trunk sections: the body's at every level from `from` to
 * `to`, eased `side`, `front` and `back` m, and `flare(level)` more. */
function trunkSections(
  m: BodyMeasure,
  from: number,
  to: number,
  ease: { side: number; front: number; back: number },
  flare: (level: number) => number = () => 0,
  hang: (level: number) => number = () => 1,
): Section[] {
  const S = trunkLine().S;
  const out: Section[] = [];
  const n = Math.max(3, Math.ceil((to - from) / 0.08));
  for (let i = 0; i <= n; i++) {
    const level = from + ((to - from) * i) / n;
    const t = trunkAt(m, level);
    const f = flare(level);
    const k = hang(level);
    out.push({
      s: S(level),
      w: t.w + ease.side * k + f,
      f: t.f + ease.front + f,
      b: t.b + ease.back + f,
    });
  }
  return out;
}

/** The level on the trunk's line at height `y` in the bind pose. */
function levelAtY(y: number): number {
  const line = trunkLine();
  let lo = 0;
  let hi = 1.2;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (alongPath(line.path, line.S(mid)).y < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** THE SHOULDER LINE: the jacket's top from the shoulder joints' height to
 * the collar's foot — the trapezius sloping 15–20° down and out from the
 * collar to the shoulder points, so the neck rises out of the shoulders
 * rather than the shoulders standing level up to it. The rig's shoulder
 * joints stand wider and higher under the neck than a body's, so the line
 * is laid by HEIGHT over the joints: full breadth to the deltoid's top
 * (where the sleeve's cap meets it), then in to the collar, the trunk's
 * depth thinning to the neck's with it. Levels, half breadths and depths,
 * m. */
function shoulderLine(m: BodyMeasure, ease: number): TrunkLevel[] {
  const { pose: P } = bindPose();
  const y0 = P.shoulders[0].y;
  const at = (dy: number) => levelAtY(y0 + dy);
  const base = trunkAt(m, at(0));
  const neck = m.neck + 0.026;
  const w = m.acromion + ease;
  const row = (dy: number, wk: number, dk: number, nk: number): TrunkLevel => ({
    level: at(dy),
    w: w * wk + neck * (1 - wk) * nk,
    f: (base.f + ease) * dk + neck * (1 - dk),
    b: (base.b + ease) * dk + neck * (1 - dk),
  });
  return [
    { level: at(0), w, f: base.f + ease, b: base.b + ease },
    row(0.016, 0.96, 0.95, 0),
    row(0.033, 0.8, 0.82, 0.5),
    row(0.05, 0.5, 0.5, 1),
    row(0.066, 0, 0, 0.85),
    row(0.074, 0, 0, 0.8),
  ];
}

/** The cut of a jacket. */
type JacketCut = {
  hem: number;
  ease: number;
  /** More ease at the hem (a shell's swing) or less (an elastic waist). */
  hemFlare: number;
  collar: number;
  square: number;
  sleeve: number;
  /** How straight it hangs from the chest to the hips (`drape`): a puffer
   * or a shell wholly, a fitted race shell much less. */
  drape: number;
  /** A quilt's baffles: their pitch, m along the cloth, and their bulge. */
  quilt?: { pitch: number; depth: number };
};

const JACKET_CUT: Record<JacketId, JacketCut> = {
  race: {
    hem: -0.13,
    ease: 0.024,
    hemFlare: 0.004,
    collar: 0.1,
    square: 2.25,
    sleeve: 0.02,
    drape: 0.35,
  },
  puffer: {
    hem: -0.07,
    ease: 0.04,
    hemFlare: -0.004,
    collar: 0.11,
    square: 2.3,
    sleeve: 0.034,
    drape: 1,
    quilt: { pitch: 0.075, depth: 0.014 },
  },
  shell: {
    hem: -0.24,
    ease: 0.036,
    hemFlare: 0.01,
    collar: 0.115,
    square: 2.4,
    sleeve: 0.03,
    drape: 1,
  },
  anorak: {
    hem: -0.17,
    ease: 0.04,
    hemFlare: 0.016,
    collar: 0.09,
    square: 2.3,
    sleeve: 0.032,
    drape: 1,
  },
  retro: {
    hem: -0.02,
    ease: 0.03,
    hemFlare: -0.012,
    collar: 0.08,
    square: 2.6,
    sleeve: 0.026,
    drape: 0.8,
  },
};

/** The cut of a pair of pants: the ease over the thigh and at the hem, the
 * hem's radius over the boot, how far the seat drops. */
type PantsCut = { ease: number; knee: number; hem: number; drop: number; square: number };
const PANTS_CUT: Record<PantsId, PantsCut> = {
  insulated: { ease: 0.024, knee: 0.022, hem: 0.088, drop: 0, square: 2.3 },
  race: { ease: 0.012, knee: 0.01, hem: 0.08, drop: 0, square: 2.2 },
  baggy: { ease: 0.05, knee: 0.05, hem: 0.11, drop: 0.06, square: 2.2 },
  cargo: { ease: 0.034, knee: 0.032, hem: 0.096, drop: 0.02, square: 2.3 },
};

/** How far the thighs' tops are drawn in toward the middle under the seat,
 * m: the rig's hip joints stand a stance apart (`BODY.hip`), wider than a
 * body's, and a thigh lofted round them would bulge out past the hips. */
const HIP_IN = 0.05;

/** How far down past the boot's cuff top the pants' hem reaches, m: over
 * the power strap and the top buckle, as a gaitered leg hangs over a boot. */
const HEM_DOWN = 0.11;

/** A jacket's hem, m: the band turned under (`in` drawn in at the edge,
 * `proud` standing out over the cord `width` above it). */
const HEM_ROLL = { in: 0.014, proud: 0.004, width: 0.02 };
/** A jacket's hem band, as a share of the trunk's levels: 7 cm of cuff
 * standing out in its own colour above the roll. */
const HEM_BAND = 0.14;
/** How far forward the trunk's line is leaned under a jacket's hem, m — the
 * hem's rings tilted, its back dropped below its front. */
const HEM_DROP = 0.06;
/** How far the back's flanks are eased off below the ribs, m: a squared
 * section stands out at the back's corners over the seat. */
const BACK_EASE = 0.02;
/** How far a woman's sleeves' tops are drawn in, m: the survey's
 * deltoids are 3.2 cm narrower a side than a man's, on the same joints. */
const SHOULDER_IN = 0.018;
/** A race shell's side panel's half width round the trunk, rad. */
const SIDE_PANEL = 0.3;

/** The most ease a pant's seat takes over the hips, m. */
const SEAT_EASE = 0.026;

/** The pants' seat at a level: the body's section eased, and wide enough to
 * take both thighs' tops — what the jacket must hang clear of. */
function seatAt(
  m: BodyMeasure,
  pc: PantsCut,
  level: number,
  from: number,
  close = true,
): { w: number; f: number; b: number } {
  const { pose: P } = bindPose();
  const t = trunkAt(m, level);
  // A baggy pant is baggy in the LEG: its seat is cut nearly as close as
  // any, or the jacket over it balloons out over the hips. `close` false is
  // the leg's own tops as well, which a fitted jacket's hug meets in a tuck.
  const ease = close ? Math.min(pc.ease, SEAT_EASE) : pc.ease;
  const give = close ? 0.6 : 1;
  const span = Math.abs(P.hipJoints[0].x) - HIP_IN + m.thigh * 0.78 + ease * give;
  const low = Math.max(0, Math.min(1, (level - from) / 0.12));
  // Wide only over the thighs' tops: above the hip joints the seat closes
  // in to the waist, which is the body's own (a woman's narrower).
  const high = 1 - Math.max(0, Math.min(1, (level - 0.1) / 0.16));
  // The seat is cut close over the hips (the flesh gives under a fitted
  // pant), so the jacket over it can hang no wider than the shoulders.
  return {
    w: Math.max(t.w * (close ? 0.93 : 1) + ease * give, span * (0.55 + 0.45 * low) * high),
    f: t.f + ease,
    b: t.b * (close ? 0.84 : 0.9) + ease * (close ? 0.7 : 1) + 0.004,
  };
}
const seatFrom = (m: BodyMeasure, pc: PantsCut) => m.crotch - 0.05 - pc.drop;
const seatTo = (m: BodyMeasure) => m.waist + 0.04;

/** The point `s` m along a polyline. */
function alongPath(path: V3[], s: number): V3 {
  let left = s;
  for (let i = 1; i < path.length; i++) {
    const d = sub(path[i], path[i - 1]);
    const l = Math.sqrt(dot(d, d));
    if (left <= l || i === path.length - 1) return add(path[i - 1], mul(d, left / (l || 1)));
    left -= l;
  }
  return path[0];
}

/** A quilt's baffle: the cloth bulging between two seams sewn `pitch`
 * apart, pinched at each. */
const baffle = (s: number, pitch: number, depth: number) =>
  depth * (Math.abs(Math.sin((Math.PI * s) / pitch)) ** 0.7 - 0.55);

/** The seams a quilt is sewn on, as cuts from `a` to `b`. */
function seams(a: number, b: number, pitch: number): number[] {
  const out: number[] = [];
  for (let s = Math.ceil(a / pitch) * pitch; s < b; s += pitch) out.push(s);
  return out;
}

// ---------------------------------------------------------------- jackets

/** A jacket's colour on the trunk at `level`, `t` round, `p` in the body. */
function jacketTrunkColour(
  id: JacketId,
  cut: JacketCut,
  level: number,
  t: number,
  p: V3,
  female: boolean,
): number {
  const j = gearOf("jacket", id);
  const front = gap(t, FRONT);
  const zip = front < 0.045;
  switch (id) {
    case "race":
      if (level > 0.8) return j.second;
      if (level < cut.hem + HEM_BAND) return j.second;
      if (zip) return j.third;
      // Side panels down the flanks; a woman's run the full height, so the
      // waist reads taken in between them.
      if ((gap(t, 0) < SIDE_PANEL || gap(t, Math.PI) < SIDE_PANEL) && (female || level < 0.62)) {
        return j.second;
      }
      return j.main;
    case "puffer":
      if (level < cut.hem + HEM_BAND) return j.second;
      if (zip && level > 0.1) return j.second;
      return j.main;
    case "shell":
      // Colour-blocked: charcoal across the shoulders, a teal panel across
      // the chest, the yellow body under them.
      if (level > 0.7) return j.second;
      if (level > 0.6 && front < 0.9) return j.third;
      if (zip) return j.second;
      return j.main;
    case "anorak":
      // The kangaroo pocket across the chest and the half zip over it.
      if (level > 0.44 && level < 0.66 && front < 0.75) return j.second;
      if (level > 0.68 && front < 0.04) return j.third;
      if (level < cut.hem + HEM_BAND) return j.third;
      return j.main;
    case "retro":
      return retroColour(p, level < cut.hem + 0.06);
  }
}

/** The late 80s: two bands slashed across a white body, continuous over
 * the trunk and the sleeves. */
function retroColour(p: V3, band: boolean): number {
  const j = gearOf("jacket", "retro");
  if (band) return j.third;
  const k = p.y * 1.0 + p.x * 0.75;
  if (k > 0.2 && k < 0.29) return j.second;
  if (k > 0.31 && k < 0.36) return j.third;
  if (k < -0.12 && k > -0.2) return j.second;
  return j.main;
}

/** A JACKET HANGS: cloth is not skin, and from the chest down it falls
 * straight to whatever is widest under it (the seat, the hips) rather than
 * following the body in at the waist and the small of the back — the
 * straight-sided box a ski jacket reads as from behind. `share` 1 hangs
 * wholly straight; a tailored cut (a woman's) keeps some of the waist. */
function drape(
  sections: Section[],
  L: (s: number) => number,
  waist: number,
  share: { w: number; f: number; b: number },
) {
  const below = sections.filter((q) => L(q.s) <= waist);
  const above = sections.filter((q) => L(q.s) > waist && L(q.s) < 0.8);
  if (!below.length || !above.length) return;
  for (const k of ["w", "f", "b"] as const) {
    const lo = below.reduce((a, q) => (q[k] > a[k] ? q : a));
    const hi = above.reduce((a, q) => (q[k] > a[k] ? q : a));
    for (const q of sections) {
      if (q.s <= lo.s || q.s >= hi.s) continue;
      const u = (q.s - lo.s) / (hi.s - lo.s);
      const hang = lo[k] + (hi[k] - lo[k]) * u;
      if (hang > q[k]) q[k] += (hang - q[k]) * share[k];
    }
  }
}

function cutJacket(loom: Loom, m: BodyMeasure, o: Outfit): void {
  const id = o.jacket;
  const cut = JACKET_CUT[id];
  const j = gearOf("jacket", id);
  const line = trunkLine();
  const { frames: F, pose: P } = bindPose();
  const quilt = cut.quilt;
  const from = cut.hem;
  const top = shoulderLine(m, cut.ease);
  const to = top[0].level;
  // Below the crotch a long jacket hangs over both thighs, and widens to.
  const legs = (level: number) =>
    level < m.crotch ? (m.crotch - level) * (0.12 + cut.hemFlare * 4) : 0;
  const flare = (level: number) =>
    legs(level) + cut.hemFlare * Math.max(0, 1 - (level - cut.hem) / 0.15);
  // Clear of the pants wherever it hangs over them.
  const pc = PANTS_CUT[o.pants];
  // A woman's cut is TAILORED: taken in at the waist and let out over the
  // hips, where a man's hangs straight.
  const female = gearOf("body", o.body).female;
  // A loose cut is taken in less: its waist pinched as a fitted shell's
  // reads, under its hang, as hips ballooning below it.
  const tailor = (level: number) =>
    female
      ? -0.026 *
        (1.2 - 0.7 * cut.drape) *
        Math.max(0, 1 - Math.abs(level - (m.waist + 0.08)) / 0.22)
      : 0;
  // How loose the cut hangs: a fitted race shell keeps its ease all the way
  // down, as it must to stay over the seat in a tuck.
  const loose = Math.max(0, cut.drape - 0.5) * 2;
  const sections = trunkSections(
    m,
    from,
    to,
    { side: cut.ease, front: cut.ease + 0.006, back: cut.ease },
    flare,
    // The ease is the shoulders' and the chest's: the cloth hangs from them
    // and only clears the hips, so the hem is about their breadth and never
    // wider than the shoulders.
    (level) =>
      1 - loose * 0.65 * (1 - smoothstep((level - m.crotch) / (m.waist + 0.25 - m.crotch))),
  )
    .concat(top.slice(1).map((q) => ({ s: line.S(q.level), w: q.w, f: q.f, b: q.b })))
    .map((given) => {
      let q = given;
      const level = line.L(q.s);
      const t = tailor(level);
      if (t) q = { ...q, w: q.w + t, f: q.f + t * 0.4, b: q.b + t * 0.6 };
      if (level > seatTo(m) + 0.06) return q;
      // The hem's rings are tilted (`HEM_DROP`): the back of a ring lies
      // over the seat a little lower down, so clear the seat there too.
      const sf = seatFrom(m, pc);
      // A fitted cut clears the baggy leg's tops too, which its hug would
      // meet in a tuck; a loose one hangs clear of them anyway.
      const seat = seatAt(m, pc, Math.max(level, sf), sf, loose > 0);
      const lower = seatAt(m, pc, Math.max(level - 0.1, sf), sf, loose > 0);
      return {
        ...q,
        w: Math.max(q.w, seat.w + 0.011, lower.w + 0.009),
        f: Math.max(q.f, seat.f + 0.012),
        b: Math.max(q.b, seat.b + 0.016, lower.b + 0.016),
      };
    });
  // The back falls straight from the blades over the small of the back to
  // the seat in every cut; across the back a fitted cut keeps the V from
  // the lats in to the waist, and a woman's keeps her waist.
  drape(sections, line.L, m.waist, {
    w: cut.drape * (female ? 0.3 : 0.55),
    f: cut.drape * (female ? 0.4 : 0.6),
    b: Math.max(cut.drape, 0.9),
  });
  // Below the crotch a long jacket falls STRAIGHT on from the hips — never
  // pinched in under the seat and flared out again at the hem, the bell a
  // shell's skirt reads as from behind.
  const hips = sections.filter((q) => {
    const level = line.L(q.s);
    return level >= m.crotch && level <= m.waist;
  });
  if (hips.length) {
    for (const k of ["w", "b"] as const) {
      const most = Math.max(...hips.map((q) => q[k]));
      for (const q of sections) {
        if (line.L(q.s) >= m.crotch) continue;
        // Across, no wider than the hips; through, never cut into the seat.
        q[k] = Math.max(q[k], most * 0.97);
        if (k === "w") q[k] = Math.min(q[k], most);
      }
    }
  }
  // THE HEM: the cloth turned under and drawn in by its cord, so its edge
  // rolls in over the pants rather than ending in an open ring — and the
  // whole hem DROPPED AT THE BACK, the rings below the hips tilted (the
  // trunk's line leaned forward under them, its middle put back), as a
  // jacket is cut longer behind to cover the seat in a crouch.
  const hem = sections[0];
  const next = sections[1];
  const u = HEM_ROLL.width / (next.s - hem.s);
  sections.splice(1, 0, {
    s: hem.s + HEM_ROLL.width,
    w: hem.w + (next.w - hem.w) * u + HEM_ROLL.proud,
    f: hem.f + (next.f - hem.f) * u + HEM_ROLL.proud,
    b: hem.b + (next.b - hem.b) * u + HEM_ROLL.proud,
  });
  hem.w -= HEM_ROLL.in;
  hem.f -= HEM_ROLL.in;
  hem.b -= HEM_ROLL.in;
  const lean = (s: number) => HEM_DROP * Math.max(0, 1 - s / BELOW);
  for (const q of sections) q.z = -lean(q.s);
  const path = [add(line.path[0], mul(F.pelvis.z, HEM_DROP)), ...line.path.slice(1)];
  // The yoke's line, the same height on the trunk and over the sleeves.
  const yokeY = alongPath(line.path, line.S(0.8)).y;
  const cuts = [line.S(cut.hem + HEM_BAND), line.S(0.8), line.S(0.7)];
  cuts.push(line.S(0.6), line.S(0.44), line.S(0.66), line.S(0.68), line.S(cut.hem + 0.06));
  if (quilt) cuts.push(...seams(line.S(from), line.S(top[top.length - 1].level), quilt.pitch));
  // The race shell's side panels, under the arms from the hem band to the
  // yoke.
  const panels =
    id === "race" ? [-SIDE_PANEL, SIDE_PANEL, Math.PI - SIDE_PANEL, Math.PI + SIDE_PANEL] : [];
  loom.tube({
    path,
    face: line.face,
    round: 0.08,
    sections,
    step: quilt ? quilt.pitch / 2 : 0.05,
    cuts,
    segments: 16,
    angles: [
      FRONT - 0.045,
      FRONT + 0.045,
      FRONT - 0.04,
      FRONT + 0.04,
      FRONT - 0.75,
      FRONT + 0.75,
      ...panels,
    ],
    square: cut.square,
    fold: (s, t) => {
      const level = line.L(s);
      let f = 0;
      if (quilt) f += baffle(s - line.S(from), quilt.pitch, quilt.depth);
      if (id === "anorak" && level > 0.44 && level < 0.66) {
        f += 0.012 * Math.max(0, Math.sin(t)) ** 3 * Math.sin((Math.PI * (level - 0.44)) / 0.22);
      }
      // The back hangs in a soft fold or two from the blades.
      f +=
        0.006 *
        Math.max(0, -Math.sin(t)) ** 2 *
        Math.sin(5 * t + level * 6) *
        (level < 0.4 ? 1 : 0);
      // Blousing over the hem band, which hugs the hips under it (a loose
      // cut's most).
      if (level < cut.hem + HEM_BAND) f -= 0.004;
      else
        f +=
          0.006 * cut.drape * Math.max(0, 1 - Math.abs(level - (cut.hem + HEM_BAND + 0.05)) / 0.07);
      // The back's groove down the spine, the shoulder blades either side
      // of it.
      const back = Math.max(0, -Math.sin(t));
      const spine = gap(t, -FRONT);
      if (level > 0.3 && level < 0.95) {
        const up = Math.sin((Math.PI * (level - 0.3)) / 0.65);
        f -= 0.005 * up * Math.exp(-((spine / 0.12) ** 2));
        const blade = Math.max(0, 1 - Math.abs(level - 0.74) / 0.14);
        f += 0.007 * blade * back * Math.exp(-(((spine - 0.55) / 0.3) ** 2));
      }
      // The back's corners eased off below the ribs: a squared section
      // stands out at the back's flanks over the seat.
      const low = Math.max(0, Math.min(1, (m.waist + 0.18 - level) / 0.16));
      f -= BACK_EASE * low * Math.sin(2 * t) ** 2 * (Math.sin(t) < 0 ? 1 : 0);
      return f;
    },
    colour: (s, t, p) => jacketTrunkColour(id, cut, line.L(s), t, p, female),
    cap: [false, true],
    // Below the chest the jacket rides the trunk alone: an arm's share,
    // however small, swings the hem as the arm comes forward.
    weights: (p) =>
      clothWeights(
        p,
        p.y < P.waist.y + 0.1 ? ["spine"] : ["spine", "upperarm_l", "upperarm_r", "head"],
      ),
  });

  // THE COLLAR, stood up round the helmet's rim, set back so it never juts
  // under the chin — and inside it the knit of a NECK GAITER up to the
  // helmet's rim, so no light shows between them.
  const up = norm(sub(P.head, P.neck));
  // The collar's foot sits where the shoulder line ends (`shoulderLine`).
  const foot = alongPath(line.path, line.S(top[top.length - 2].level)).y - P.neck.y;
  const neck = m.neck * 0.9;
  loom.tube({
    path: [add(P.neck, mul(up, -0.02)), add(P.neck, mul(up, 0.17))],
    face: [F.chest.z, F.chest.z],
    sections: [
      { s: 0, w: neck + 0.008, f: neck + 0.008, b: neck + 0.008, z: -0.006 },
      { s: 0.12, w: neck + 0.004, f: neck + 0.004, b: neck + 0.006, z: -0.012 },
      { s: 0.19, w: neck * 0.92, f: neck * 0.92, b: neck * 0.96, z: -0.016 },
    ],
    step: 0.05,
    segments: 10,
    colour: () => 0x26282c,
    cap: [false, false],
    among: ["spine", "head"],
  });
  // A stand collar 8–10 cm tall round the gaiter, its foot a little wider
  // and sunk into the shoulder line so no lip shows where they meet.
  const c0 = foot - 0.025;
  const c1 = foot + cut.collar * 0.7;
  loom.tube({
    path: [add(P.neck, mul(up, c0)), add(P.neck, mul(up, c1))],
    face: [F.chest.z, F.chest.z],
    sections: [
      { s: 0, w: neck + 0.03, f: neck + 0.03, b: neck + 0.03, z: 0 },
      { s: 0.03, w: neck + 0.026, f: neck + 0.026, b: neck + 0.024, z: -0.004 },
      { s: c1 - c0 - 0.012, w: neck + 0.022, f: neck + 0.022, b: neck + 0.019, z: -0.01 },
      { s: c1 - c0, w: neck + 0.02, f: neck + 0.019, b: neck + 0.017, z: -0.012 },
    ],
    step: 0.025,
    segments: 12,
    square: 2.1,
    // The collar in the body's colour, so it reads apart from the dark
    // gaiter in it (the freeride shell's in its yoke's charcoal, the
    // retro's in its trim).
    colour: () => (id === "shell" ? j.second : id === "retro" ? j.third : j.main),
    cap: [false, true],
    among: ["spine", "head"],
  });

  // THE HOOD, rolled into the collar's back (the freeride shell) or hung
  // down the upper back (the anorak).
  if (id === "shell" || id === "anorak") {
    const back = mul(F.chest.z, -1);
    const across = F.chest.x;
    // Rolled round the collar's back foot (the shell's) or hung below it.
    const at = add(
      P.neck,
      add(mul(back, m.neck + 0.035), mul(F.chest.y, id === "shell" ? 0.02 : -0.06)),
    );
    const half = id === "shell" ? 0.085 : 0.11;
    loom.tube({
      path: [add(at, mul(across, -half)), add(at, mul(across, half))],
      face: [F.chest.y, F.chest.y],
      sections: [
        { s: 0, w: 0.016, f: 0.018, b: 0.018 },
        { s: 0.04, w: 0.04, f: id === "shell" ? 0.034 : 0.06, b: 0.03 },
        { s: half * 2 - 0.04, w: 0.04, f: id === "shell" ? 0.034 : 0.06, b: 0.03 },
        { s: half * 2, w: 0.016, f: 0.018, b: 0.018 },
      ],
      step: 0.04,
      segments: 10,
      square: 2.2,
      colour: () => (id === "shell" ? j.second : j.main),
      weights: () => rides("chest"),
    });
  }

  // THE SLEEVES: from inside the shoulder over the deltoid, through the
  // elbow, to the cuff at the wrist — bunched toward it.
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const side = i === 0 ? -1 : 1;
    const ua = F[`upperarm_${s}`];
    const fa = F[`forearm_${s}`];
    const out = { x: side, y: 0, z: 0 };
    // Started low inside the shoulder, so the deltoid's top rounds off under
    // the shoulder line rather than standing over it as an epaulette.
    const start = add(P.shoulders[i], add(mul(out, -0.06), mul(F.chest.y, -0.03)));
    const wrist = add(fa.head, mul(fa.y, fa.length * m.wristAt));
    const path = [start, P.elbows[i], wrist, add(wrist, mul(fa.y, 0.04))];
    const L1 = 0.06 + ua.length;
    const L2 = L1 + fa.length * m.wristAt;
    const e = cut.sleeve;
    const b = m.biceps * 0.95;
    const f = m.forearm * 0.95;
    const w = m.wrist;
    const cap = m.deltoid - m.acromion;
    const sections: Section[] = [
      { s: 0, w: b * 0.8 + e, f: b * 1.05 + e, b: b * 1.05 + e },
      { s: 0.06, w: cap * 0.45 + b * 1.02 + e, f: b * 1.18 + e, b: b * 1.18 + e },
      { s: 0.11, w: b * 1.1 + e, f: b * 1.08 + e, b: b * 1.1 + e },
      { s: L1 * 0.55, w: b + e, f: b + e, b: b * 1.04 + e },
      { s: L1, w: b * 0.92 + e, f: b * 0.95 + e, b: b * 0.92 + e },
      { s: L1 + 0.1, w: f + e, f: f + e, b: f + e },
      { s: L2 - 0.06, w: (f + w) / 2 + e * 1.15, f: (f + w) / 2 + e, b: (f + w) / 2 + e },
      { s: L2, w: w + e * 1.25, f: w + e * 1.2, b: w + e * 1.2 },
      { s: L2 + 0.03, w: w + e * 1.2, f: w + e * 1.15, b: w + e * 1.15 },
    ];
    // The outside of the arm, as a turn round each ring (a sleeve's stripe
    // runs down it).
    const ringZ = norm(sub(ua.z, mul(ua.y, dot(ua.z, ua.y))));
    const ringX = cross(ua.y, ringZ);
    const tOut = Math.atan2(dot(out, ringZ), dot(out, ringX));
    // A woman's shoulders are narrower on the same bones: her sleeves' tops
    // are drawn in toward her, let out again by the elbow.
    if (female) {
      const inward = -Math.sign(dot(ringX, out)) * SHOULDER_IN;
      for (const q of sections)
        q.x = inward * Math.max(0, Math.min(1, (L1 * 0.6 - q.s) / (L1 * 0.6 - 0.11)));
    }
    const cuffAt = L2 - 0.045;
    // Where the sleeve's line crosses the yoke's height: above it the
    // sleeve's top is the yoke, on one line with the trunk's.
    const drop = start.y - P.elbows[i].y;
    const yokeAt = drop > 0 ? Math.max(0, ((start.y - yokeY) / drop) * L1) : 0;
    const stripe = id === "race" ? 0.22 : 0;
    loom.tube({
      path,
      face: [ua.z, ua.z, fa.z, fa.z],
      round: 0.07,
      sections,
      step: quilt ? quilt.pitch / 2 : 0.05,
      cuts: [cuffAt, yokeAt, L1 * 0.5, ...(quilt ? seams(0.06, L2, quilt.pitch) : [])].filter(
        (c) => c > 0,
      ),
      segments: 10,
      angles: stripe ? [tOut - stripe, tOut + stripe] : [],
      square: 2.1,
      fold: (sl, t) => {
        let k = 0;
        if (quilt) k += baffle(sl - 0.06, quilt.pitch, quilt.depth * 0.8) * (sl > 0.06 ? 1 : 0);
        // The cloth gathered in the crook of the elbow and bunched above
        // the cuff.
        const crook = Math.max(0, -Math.sin(t)) * Math.max(0, 1 - Math.abs(sl - L1) / 0.09);
        k += 0.006 * crook * Math.sin(((sl - L1) / 0.045) * TAU);
        const bunch = Math.max(0, 1 - Math.abs(sl - (L2 - 0.08)) / 0.06);
        k += 0.004 * bunch * Math.sin(((sl - L2) / 0.03) * TAU + t);
        return k;
      },
      colour: (sl, t, p) => {
        if (id === "retro") return retroColour(p, sl > cuffAt);
        const cuff = sl > cuffAt;
        const top = sl < yokeAt;
        switch (id) {
          case "race":
            if (top) return j.second;
            if (gap(t, tOut) < stripe) return j.second;
            return cuff ? j.second : j.main;
          case "puffer":
            return cuff ? j.second : j.main;
          case "shell":
            if (sl < L1 * 0.5) return j.second;
            return cuff ? j.second : j.main;
          case "anorak":
            return cuff ? j.third : j.main;
        }
      },
      cap: [true, true],
      among: [`upperarm_${s}`, `forearm_${s}`, "spine"],
    });
  }
}

// ---------------------------------------------------------------- pants

function cutPants(loom: Loom, m: BodyMeasure, o: Outfit): void {
  const id = o.pants;
  const cut = PANTS_CUT[id];
  const pd = gearOf("pants", id);
  const line = trunkLine();
  const { frames: F, pose: P } = bindPose();
  // THE SEAT, from the crotch (dropped, on a baggy pair) to the waist
  // under the jacket — wide enough to take both thighs' tops.
  const from = seatFrom(m, cut);
  const to = seatTo(m);
  // Wide over the thighs' tops, narrowing to the crotch under them.
  const seat: Section[] = [];
  for (let k = 0; k <= 6; k++) {
    const level = from + ((to - from) * k) / 6;
    seat.push({ s: line.S(level), ...seatAt(m, cut, level, from) });
  }
  loom.tube({
    path: line.path,
    face: line.face,
    round: 0.08,
    sections: seat,
    step: 0.04,
    segments: 14,
    square: 2.5,
    // Eased off at the back's flanks as the jacket over it is, so the two
    // keep their gap there.
    fold: (_s, t) => -BACK_EASE * Math.sin(2 * t) ** 2 * (Math.sin(t) < 0 ? 1 : 0),
    colour: () => pd.main,
    // The seat rides the pelvis as the jacket over it does, so neither
    // pierces the other as the hips fold; the legs carry the thighs.
    among: ["spine"],
  });

  // THE LEGS: from inside the seat over the hip joint, through the knee,
  // past the boot's cuff — gaitered over it.
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const side = i === 0 ? -1 : 1;
    const th = F[`thigh_${s}`];
    const sh = F[`shin_${s}`];
    // From the hip joint itself: a thigh's top lofted above it swings out
    // through the seat as the hips fold into a tuck.
    const top = P.hipJoints[i];
    const end = add(P.feet[i], mul(sh.y, HEM_DOWN));
    const path = [top, P.knees[i], P.feet[i], end];
    const K = th.length;
    const C = K + sh.length;
    const E = C + HEM_DOWN;
    const e = cut.ease;
    const ek = cut.knee;
    const baggy = id === "baggy";
    // At the top the leg is the seat's, cut as close as it.
    const et = Math.min(e, SEAT_EASE);
    const sections: Section[] = [
      {
        s: 0,
        w: m.thigh * 0.6 + et * 0.4,
        f: m.thigh * 0.7 + et * 0.5,
        b: m.thigh * 0.7 + et * 0.5,
      },
      { s: 0.1, w: m.thigh * 0.96 + et * 0.6, f: m.thigh + et * 0.8, b: m.thigh + et * 0.8 },
      {
        s: K - 0.17,
        w: (m.thigh + m.lowerThigh) / 2 + e,
        f: (m.thigh + m.lowerThigh) / 2 + e,
        b: (m.thigh + m.lowerThigh) / 2 + e,
      },
      { s: K, w: m.lowerThigh + ek, f: m.lowerThigh + ek + 0.006, b: m.lowerThigh + ek },
      { s: K + 0.1, w: m.calf * 0.9 + ek, f: m.calf * 0.8 + ek, b: m.calf * 1.12 + ek },
      {
        s: C - 0.06,
        w: Math.max(m.calf * 0.85 + ek, cut.hem - 0.006),
        f: Math.max(m.calf * 0.8 + ek, cut.hem - 0.008),
        b: Math.max(m.calf + ek, cut.hem - 0.004),
      },
      { s: C, w: cut.hem, f: cut.hem, b: cut.hem + 0.004 },
      {
        s: E,
        w: cut.hem + (baggy ? 0.012 : 0.004),
        f: cut.hem + (baggy ? 0.01 : 0.004),
        b: cut.hem + (baggy ? 0.016 : 0.006),
      },
    ];
    const ringZ = norm(sub(th.z, mul(th.y, dot(th.z, th.y))));
    const ringX = cross(th.y, ringZ);
    const out = { x: side, y: 0, z: 0 };
    // The thigh's top drawn in under the seat, let out by mid-thigh.
    const inward = -Math.sign(dot(ringX, out)) * HIP_IN;
    for (const q of sections) q.x = inward * Math.max(0, 1 - q.s / 0.26);
    const tOut = Math.atan2(dot(out, ringZ), dot(out, ringX));
    const tIn = tOut + Math.PI;
    const pocket = id === "cargo" ? { a: 0.1, b: 0.27, half: 0.55 } : null;
    const stripe = id === "race" ? 0.16 : 0;
    const angles = [
      ...(stripe ? [tOut - stripe, tOut + stripe] : []),
      ...(pocket ? [tOut - pocket.half, tOut + pocket.half] : []),
      tIn - 0.5,
      tIn + 0.5,
    ];
    loom.tube({
      path,
      face: [th.z, th.z, sh.z, sh.z],
      round: 0.08,
      sections,
      step: 0.055,
      cuts: [E - 0.04, C - 0.1, ...(pocket ? [pocket.a, pocket.b, pocket.a + 0.035] : [])],
      segments: 10,
      angles,
      square: cut.square,
      fold: (sl, t) => {
        let k = 0;
        // Creased in the crook of the knee, padded over its front.
        const crook = Math.max(0, -Math.sin(t)) * Math.max(0, 1 - Math.abs(sl - K) / 0.1);
        k += 0.008 * crook * Math.sin(((sl - K) / 0.05) * TAU);
        k += 0.006 * Math.max(0, Math.sin(t)) ** 2 * Math.max(0, 1 - Math.abs(sl - K) / 0.08);
        if (pocket && gap(t, tOut) < pocket.half && sl > pocket.a && sl < pocket.b) {
          k += 0.014 * Math.sin((Math.PI * (sl - pocket.a)) / (pocket.b - pocket.a)) ** 0.5;
        }
        // A baggy leg stacks in rolls over the boot.
        if (baggy && sl > C - 0.16) k += 0.008 * Math.sin(((sl - C) / 0.05) * TAU + t * 2);
        return k;
      },
      colour: (sl, t) => {
        if (stripe && gap(t, tOut) < stripe) return pd.second;
        if (pocket && gap(t, tOut) < pocket.half && sl > pocket.a && sl < pocket.a + 0.035) {
          return pd.second;
        }
        // A baggy pair's reinforced cuff all round its foot, every other
        // pair's kick patch inside the ankle, where the other boot scuffs.
        if (baggy && sl > C - 0.1) return pd.third;
        if (sl > C - 0.1 && sl < E - 0.04 && gap(t, tIn) < 0.5) return pd.third;
        return pd.main;
      },
      cap: [false, false],
      among: ["spine", `thigh_${s}`, `shin_${s}`],
    });
  }
}

// ---------------------------------------------------------------- the feet

/** HIS FEET, in the boots' padded liners — hidden in the shells while he
 * stands on his skis, his own when he is thrown off them. */
function cutFeet(loom: Loom): void {
  const { pose: P } = bindPose();
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const bt = P.boots[i];
    const n = { x: bt.n.x, y: bt.n.y, z: bt.n.z };
    const f = { x: bt.f.x, y: bt.f.y, z: bt.f.z };
    const top = P.feet[i];
    loom.tube({
      path: [top, add(top, mul(n, -0.24))],
      face: [f, f],
      sections: [
        { s: 0, w: 0.05, f: 0.055, b: 0.052 },
        { s: 0.24, w: 0.046, f: 0.05, b: 0.05 },
      ],
      step: 0.12,
      segments: 8,
      colour: () => 0x26282c,
      weights: () => rides(`boot_${s}`),
    });
    const sole = add(top, mul(n, -0.275));
    loom.tube({
      path: [add(sole, mul(f, -0.11)), add(sole, mul(f, 0.16))],
      face: [n, n],
      sections: [
        { s: 0, w: 0.035, f: 0.03, b: 0.02 },
        { s: 0.06, w: 0.044, f: 0.045, b: 0.03 },
        { s: 0.2, w: 0.045, f: 0.035, b: 0.03 },
        { s: 0.27, w: 0.03, f: 0.015, b: 0.02 },
      ],
      step: 0.08,
      segments: 8,
      colour: () => 0x26282c,
      weights: () => rides(`boot_${s}`),
    });
  }
}

/** The jacket, the pants and the feet of an outfit, cut onto `loom`. */
export function cutClothes(loom: Loom, o: Outfit): void {
  const m = builtTo(
    BODY_MEASURES[gearOf("body", o.body).female ? "woman" : "man"],
    gearOf("weight", o.weight),
  );
  cutPants(loom, m, o);
  cutJacket(loom, m, o);
  cutFeet(loom);
}
