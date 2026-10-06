// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R37 — A BIG AIR JUMP BUILT OVER A BUILT MAP. Not a kicker on the piste: a
// jump of its own, shaped STRAIGHT down the face as a real one is pushed up
// out of a mountain's side — a start platform, a drop-in, a flat, the
// kicker, the table, the knuckle, the landing and a run-out, graded smooth
// and groomed hard, the woods cleared round it.
//
// THE PROFILE IS DESIGNED, then FITTED. It is built against the horizontal
// (a table must be level in absolute terms — the ski cross's lesson), its
// drop-in as long as brings a tucked skier to the lip at the design speed
// (a point mass with the rule's skier, down the profile itself), and its
// LANDING SHAPED by the equivalent fall height: at every point past the
// knuckle the flight that reaches it is worked out back to the take-off
// speed it needs, and the slope there is laid just steeper than that
// flight by what a fall of `bigAir.fall` metres meets the snow at. Whoever
// lands on it — a little slow, a little fast — lands on a slope matched to
// his own flight, until the slope reaches its steepest. The profile is the
// same on every map: only WHERE it stands is the map's.
//
// THE LINE IS SEARCHED, as a speed track's is (R34): every column of the
// face and a few bearings either side of the fall line, every start down
// each, the profile dropped onto the ground there at the height that cuts
// and fills least; the line that cuts and fills least of all and keeps
// clear of the ski area's stations and village is the jump's. Everything
// is a pure function of the map, drawing nothing from any stream — so no
// digest moves and a restart stands on the very jump it left.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { LEVEL_RULES } from "./rules.ts";
import { TRICK_RULES } from "./trick-rules.ts";
import type { BigAirCourse, Checkpoint, Kicker, Level, Spawn, TrackPoint, Vec3 } from "./types.ts";

const B = TRICK_RULES.bigAir;
const G = 9.81;
const RAD = Math.PI / 180;

/** THE JUMP'S PROFILE: its height every `dx` m of plan from the platform's
 * back (`y`, the lip at 0), and where its parts begin, m of plan. */
export type JumpProfile = {
  dx: number;
  y: Float64Array;
  gate: number;
  foot: number;
  lip: number;
  knuckle: number;
  landing: number;
  outrun: number;
  finish: number;
  end: number;
  /** The lip's height over the flat, m. */
  height: number;
};

/** The profile's height `x` m of plan along it, m. */
export function jumpHeightAt(p: JumpProfile, x: number): number {
  const f = clamp(x / p.dx, 0, p.y.length - 1);
  const i = Math.min(p.y.length - 2, Math.floor(f));
  return p.y[i] + (p.y[i + 1] - p.y[i]) * (f - i);
}

/** The profile with a drop-in `run` m long at its full angle. */
function shape(run: number): JumpProfile {
  const dx = 0.25;
  const ys: number[] = [0];
  let x = 0;
  let y = 0;
  /** The descent here, rad: down the fall line positive. */
  let a = 0;
  const step = (to: number): void => {
    x += dx;
    y -= Math.tan(to) * dx;
    a = to;
    ys.push(y);
  };
  /** Bend toward `to` on `radius` m — down (`+1`) or up (`−1`). */
  const bend = (to: number, radius: number): void => {
    const sign = Math.sign(to - a);
    while (sign !== 0 && Math.sign(to - a) === sign) {
      const turn = dx / Math.cos(a) / radius;
      step(sign > 0 ? Math.min(to, a + turn) : Math.max(to, a - turn));
    }
  };
  const straight = (length: number, at: number): void => {
    const end = x + length;
    while (x < end) step(at);
  };
  straight(B.platform, 0);
  const gate = x;
  bend(B.dropIn * RAD, B.roll);
  straight(run, B.dropIn * RAD);
  bend(0, B.toFlat);
  straight(B.flat, 0);
  const foot = x;
  const yFoot = y;
  const kick = B.kick * RAD;
  bend(-kick, B.kicker);
  const lip = x;
  const yLip = y;
  straight(B.table, 0);
  const knuckle = x;
  // THE LANDING, shaped by the equivalent fall height until a skier
  // `bigAir.fast` times the design speed has come down on it.
  const u = Math.sqrt(2 * G * B.fall);
  const fast = B.speed * B.fast;
  let down: number | null = null;
  for (let i = 0; i < 8000; i++) {
    const lx = x + dx - lip;
    const ly = y - yLip;
    // The take-off speed whose flight passes through here.
    const den = 2 * Math.cos(kick) ** 2 * (lx * Math.tan(kick) - ly);
    const v0 = Math.sqrt((G * lx * lx) / den);
    const vx = v0 * Math.cos(kick);
    const vy = v0 * Math.sin(kick) - (G * lx) / vx;
    const fall = -Math.atan2(vy, vx);
    const want = clamp(fall - Math.asin(Math.min(1, u / hypot(vx, vy))), 0, B.steepest * RAD);
    // Rounded over at the knuckle, never sharper than its radius.
    step(Math.min(want, a + dx / Math.cos(a) / B.knuckle));
    if (down === null && v0 > fast) down = x;
    if (down !== null && x > down + B.past) break;
  }
  const landing = x;
  bend(B.outrun.grade * RAD, B.round);
  const outrun = x;
  straight(B.outrun.length, B.outrun.grade * RAD);
  const y0 = Float64Array.from(ys, (v) => v - yLip);
  return {
    dx,
    y: y0,
    gate,
    foot,
    lip,
    knuckle,
    landing,
    outrun,
    finish: outrun + B.finish,
    end: x,
    height: yLip - yFoot,
  };
}

/** The speed, m/s, the rule's skier carries tucked from the start gate to
 * the lip of `p`. */
export function lipSpeed(p: JumpProfile): number {
  const S = B.skier;
  const k = (0.5 * S.air * S.tuck) / S.mass;
  const dx = p.dx;
  let v = 1.5;
  let was = 0;
  for (let x = p.gate; x < p.lip; x += dx) {
    const dy = jumpHeightAt(p, x) - jumpHeightAt(p, x + dx);
    const ds = hypot(dx, dy);
    v = Math.sqrt(Math.max(0.01, v * v + 2 * ds * ((G * (dy - S.friction * dx)) / ds - k * v * v)));
    // A COMPRESSION: the snow turning him upward costs his speed's square
    // its share for every radian it turns him (`skier.compression`).
    const fall = Math.atan2(dy, dx);
    if (x > p.gate && fall < was) v *= Math.exp(-0.5 * S.compression * (was - fall));
    was = fall;
  }
  return v;
}

let designed: JumpProfile | null = null;

/** THE JUMP (R37), as designed: the drop-in's length found so the rule's
 * skier reaches the lip at `bigAir.speed`. The same on every map. */
export function jumpProfile(): JumpProfile {
  if (designed) return designed;
  let lo = 2;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lipSpeed(shape(mid)) < B.speed) lo = mid;
    else hi = mid;
  }
  designed = shape(hi);
  return designed;
}

/** A line down the face and how the jump sits on it. */
type Fit = { x: number; z: number; heading: number; shift: number; cost: number };

/** THE JUMP'S LINE on `level` (R37): the column, the bearing and the start
 * where the profile cuts and fills least, clear of the stations and the
 * village; null on a map too small for it. */
function findLine(level: Level, p: JumpProfile): Fit | null {
  const S = B.search;
  const n = Math.ceil(p.end / S.step) + 1;
  const prof = new Float64Array(n);
  for (let k = 0; k < n; k++) prof[k] = jumpHeightAt(p, k * S.step);
  const ground = new Float64Array(n);
  let best: Fit | null = null;
  const resort = level.resort;
  for (let cx = S.edge; cx <= level.size - S.edge; cx += S.stride) {
    for (const deg of S.bearings) {
      const heading = deg * RAD;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      for (let d = 0; ; d += S.starts) {
        const x0 = cx + fx * d;
        const z0 = S.top + fz * d;
        const x1 = x0 + fx * p.end;
        const z1 = z0 + fz * p.end;
        if (z1 > level.size - S.edge || x1 < S.edge || x1 > level.size - S.edge) break;
        if (x0 < S.edge || x0 > level.size - S.edge) continue;
        let mean = 0;
        for (let k = 0; k < n; k++) {
          ground[k] = level.groundAt(x0 + fx * k * S.step, z0 + fz * k * S.step);
          mean += ground[k] - prof[k];
        }
        mean /= n;
        let sq = 0;
        let deepest = 0;
        for (let k = 0; k < n; k++) {
          const e = prof[k] + mean - ground[k];
          sq += e * e;
          deepest = Math.max(deepest, Math.abs(e));
        }
        const cost = Math.sqrt(sq / n) + B.fit.deepest * deepest;
        if (best && cost >= best.cost) continue;
        if (resort && near(resort, x0, z0, heading, p.end)) continue;
        best = { x: x0, z: z0, heading, shift: mean, cost };
      }
    }
  }
  return best;
}

/** Whether a lift station or the village stands on or beside the jump. */
function near(
  resort: NonNullable<Level["resort"]>,
  x: number,
  z: number,
  heading: number,
  length: number,
): boolean {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const at = (q: Vec3, r: number): boolean => {
    const along = (q.x - x) * fx + (q.z - z) * fz;
    const across = (q.x - x) * fz - (q.z - z) * fx;
    return along > -r && along < length + r && Math.abs(across) < B.width / 2 + B.ease + r;
  };
  for (const l of resort.lifts) {
    if (at(l.bottom, B.fit.stations) || at(l.top, B.fit.stations)) return true;
  }
  return at(resort.village, B.fit.village);
}

const built = new WeakMap<Level, Level>();

/** R37 — A BIG AIR JUMP BUILT OVER `level`: the jump shaped down the face
 * as the map's own `track`, its checkpoints the start gate and the finish
 * line, its spawn the start platform, its kicker the map's one kicker. A
 * map already carrying a jump is that map; one carrying any other course
 * is built over the map under it. Kept per map, so a restart or a replay
 * stands on the jump the renderer already built. The jump keeps the day
 * and the sky of the map it was built over. */
export function setBigAir(level: Level): Level {
  if (level.bigAir) return level;
  const original =
    level.slalom?.base ??
    level.downhill?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.skiCross?.base ??
    level;
  let jump = built.get(original);
  if (!jump) {
    jump = buildOver(original);
    built.set(original, jump);
  }
  return jump.sun === level.sun && jump.weather === level.weather
    ? jump
    : { ...jump, sun: level.sun, weather: level.weather };
}

/** The jump over `original`, a map with no course on it. */
function buildOver(original: Level): Level {
  const p = jumpProfile();
  const fit = findLine(original, p) ?? {
    x: original.size / 2,
    z: B.search.top,
    heading: 0,
    shift: original.groundAt(original.size / 2, B.search.top),
    cost: 0,
  };
  const fx = Math.sin(fit.heading);
  const fz = Math.cos(fit.heading);
  const rx = Math.cos(fit.heading);
  const rz = -Math.sin(fit.heading);
  const yAt = (d: number): number => jumpHeightAt(p, d) + fit.shift;
  // The track, every 2 m of plan — the arc IS the plan distance along the
  // line, as on a speed track.
  const points: TrackPoint[] = [];
  for (let s = 0; s <= p.end + 1e-6; s += 2) {
    points.push({
      x: fit.x + fx * s,
      z: fit.z + fz * s,
      y: yAt(s),
      s,
      heading: fit.heading,
      width: B.width,
    });
  }
  const length = points[points.length - 1].s;
  // THE GROUND graded to the profile across the jump, eased out past it.
  const half = B.width / 2;
  const field = original.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const packedField = original.packed;
  const packed = packedField ? { ...packedField, data: new Float32Array(packedField.data) } : null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const reach = half + Math.max(B.ease, fade) + 2;
  const corners = [
    [-B.ease, -reach],
    [-B.ease, reach],
    [length + B.ease, -reach],
    [length + B.ease, reach],
  ].map(([a, c]) => ({ x: fit.x + fx * a + rx * c, z: fit.z + fz * a + rz * c }));
  const xs = corners.map((q) => q.x);
  const zs = corners.map((q) => q.z);
  const c0 = clamp(Math.floor((Math.min(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const c1 = clamp(Math.ceil((Math.max(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const r0 = clamp(Math.floor((Math.min(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  const r1 = clamp(Math.ceil((Math.max(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = field.originX + c * field.cell;
      const z = field.originZ + r * field.cell;
      const dx = x - fit.x;
      const dz = z - fit.z;
      const along = dx * fx + dz * fz;
      const across = Math.abs(dx * rx + dz * rz);
      const ends = smoothstep(-B.ease, 0, along) * (1 - smoothstep(length, length + B.ease, along));
      if (ends <= 0) continue;
      const i = r * field.cols + c;
      const w = (1 - smoothstep(half, half + B.ease, across)) * ends;
      if (w > 0) ground.data[i] += w * (yAt(clamp(along, 0, length)) - ground.data[i]);
      if (packed) {
        const firm = (1 - smoothstep(half, half + fade, across)) * ends;
        if (firm > packed.data[i]) packed.data[i] = firm;
      }
    }
  }
  // THE WOODS and the finish arena cleared; the piste's kickers and drops
  // in the cut taken out with the ground they stood on.
  const A = B.arena;
  const off = (x: number, z: number, r: number): boolean => {
    const dx = x - fit.x;
    const dz = z - fit.z;
    const along = dx * fx + dz * fz;
    const across = Math.abs(dx * rx + dz * rz);
    if (along > -20 && along < length + 10 && across < half + r) return true;
    return along > p.finish - A.before && along < p.finish + A.past && across < A.half;
  };
  const trees = original.trees.filter((t) => !off(t.x, t.z, B.margin));
  const kickers = (original.kickers ?? [])
    .filter((k) => !off(k.x, k.z, B.ease + k.ramp))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  const cliffs = (original.cliffs ?? [])
    .filter((k) => !off(k.x, k.z, B.ease + k.width / 2))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  // THE KICKER, as every reader of a kicker knows one: its lip, its ramp
  // and its built landing — what arms a trick thrown up its ramp
  // (`strokes.ts`).
  const kicker: Kicker = {
    id: "BA",
    x: fit.x + fx * p.lip,
    z: fit.z + fz * p.lip,
    y: yAt(p.lip),
    heading: fit.heading,
    height: p.height,
    ramp: p.lip - p.foot,
    landing: p.outrun - p.lip,
    width: B.width,
    onTrack: true,
    s: p.lip,
    trick: true,
    shape: { deck: p.knuckle - p.lip, fall: p.landing - p.knuckle, dig: 0 },
  };
  const scratch = new Float64Array(3);
  const level: Level = {
    ...original,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, n: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      n.x = nx * inv;
      n.y = inv;
      n.z = nz * inv;
    },
    ...(packed ? { packed, packedAt: (x: number, z: number) => sampleField(packed, x, z) } : {}),
    track: { points, length, closed: false },
    trees,
    kickers: [...kickers, kicker],
    cliffs,
    drifts: [],
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    speedSki: undefined,
    skiCross: undefined,
  };
  const across = (s: number, width: number): Checkpoint => ({
    x: fit.x + fx * s,
    z: fit.z + fz * s,
    y: yAt(s),
    heading: fit.heading,
    width,
    s,
    colour: "red",
  });
  const start = across(p.gate, 6);
  const finish = across(p.finish, B.width);
  const spawn: Spawn = {
    x: fit.x + fx * (p.gate - 2),
    z: fit.z + fz * (p.gate - 2),
    heading: fit.heading,
  };
  const bigAir: BigAirCourse = {
    base: original,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    foot: p.foot,
    lip: p.lip,
    knuckle: p.knuckle,
    landing: p.landing,
    outrun: p.outrun,
    height: p.height,
    kick: B.kick * RAD,
    speed: B.speed,
    width: B.width,
  };
  return { ...level, checkpoints: [start, finish], spawn, grid: [spawn], bigAir };
}
