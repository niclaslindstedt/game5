// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SYNTHETIC maps for the rule suites and the ride lab — the §23.8 sequel
// test: the physics, the course, the bot and the simulator are all held to
// maps no generator built, so the rule suite passes with the generator
// deleted. Anything that needs a GENERATED map calls the generator itself.
//
// `syntheticLevel()` is THE SLOPE: one straight face falling along +z at
// `SLOPE.grade` (a 20° pitch) from a flat summit shelf to a flat run-out at
// the bottom, with an open PISTE graded straight down its middle — one
// gentle S-bend in it, a KICKER across it on the straight below the bend
// (a ramp rising 1.5 m over 8 m to a lip, then dropping away) — the start
// line at the top and the finish on the run-out, gates every 100 m
// between. Gentle hills roll either side of the piste, well clear of it. A
// few trees stand beside the piste in the powder and ONE stands alone in
// the powder east of it, at `LONE_TREE`, for the collision tests. The field
// stands on the start line four abreast, facing down the piste.
//
// `flatLevel()` is a drag strip: a huge flat square, all packed or all
// powder, an optional grade FALLING along +z past `slopeFrom` and an
// optional run of ROLLERS across it (`bumps`), with a straight piste down
// its middle only so the Level is whole.
//
// Both are skied in STILL AIR (`STILL_AIR`): a figure taken on the bench is
// the skier's own, with no wind in it. A test that wants the wind asks for
// it with `withSky`.

import {
  CLEAR_WEATHER,
  createHeightfield,
  fillField,
  pipeSection,
  withPipe,
  sampleField,
  type Checkpoint,
  type Heightfield,
  type Level,
  type PipeFrame,
  type Spawn,
  type TrackPoint,
  type TreeDef,
  type Weather,
} from "@engine";

/** The bench's sky: clear, and not a breath of wind. */
export const STILL_AIR: Readonly<Weather> = { ...CLEAR_WEATHER, wind: 0 };

/** The slope's geometry, m. */
export const SLOPE = {
  size: 1200,
  cell: 2,
  /** The piste's centre x, and where the face starts falling and stops. */
  x: 600,
  top: 100,
  bottom: 1000,
  /** The face's grade, m of fall per m along +z (0.36 is a 20° pitch). */
  grade: 0.36,
  /** Where the start line stands and where the finish line is laid. */
  startZ: 40,
  finishZ: 1100,
  width: 20,
  /** The S-bend: the centreline swings `swing` m either way over one sine
   * between `bendFrom` and `bendTo` along z. */
  bendFrom: 150,
  bendTo: 450,
  swing: 50,
  /** The kicker's lip on the straight below the bend, and its shape: rise
   * over the ramp, the ramp's length, the drop behind the lip. */
  kickerZ: 560,
  kickerRise: 1.5,
  kickerRamp: 8,
  kickerDrop: 4,
  /** Gates every this far along the piste; the start gate this far below
   * the start line. */
  gateEvery: 100,
  startGate: 8,
};

/** The lone tree in the powder east of the piste. */
export const LONE_TREE = { x: 700, z: 300 };

/** The piste's centreline x at `z`. */
export function pisteX(z: number): number {
  const S = SLOPE;
  if (z <= S.bendFrom || z >= S.bendTo) return S.x;
  return S.x + S.swing * Math.sin((Math.PI * (z - S.bendFrom)) / (S.bendTo - S.bendFrom));
}

/** The face's height at `z` before anything is stamped on it: level on the
 * summit shelf, falling at the grade, level again on the run-out. */
export function faceAt(z: number): number {
  const S = SLOPE;
  return -S.grade * Math.min(Math.max(z - S.top, 0), S.bottom - S.top);
}

/** Plan distance from the piste's centreline, m. */
function pisteDistance(x: number, z: number): number {
  return Math.abs(x - pisteX(z));
}

/** The kicker's height at (x, z): a ramp rising down the piste to the lip,
 * then a drop, across the piste's width. */
function kickerAt(x: number, z: number): number {
  const S = SLOPE;
  const across = pisteDistance(x, z);
  const halfW = S.width / 2 + 2;
  if (across > halfW + 3) return 0;
  const side = across <= halfW ? 1 : 1 - (across - halfW) / 3;
  // u runs along the direction of travel (+z): the ramp's foot at u = 0,
  // the lip at u = ramp, the drop's foot at ramp + drop.
  const u = z - (S.kickerZ - S.kickerRamp);
  let h = 0;
  if (u >= 0 && u <= S.kickerRamp) h = S.kickerRise * (u / S.kickerRamp);
  else if (u > S.kickerRamp && u <= S.kickerRamp + S.kickerDrop)
    h = S.kickerRise * (1 - (u - S.kickerRamp) / S.kickerDrop);
  return h * side;
}

/** Gentle hills either side of the piste, flat everywhere the piste and
 * the tests run. */
function hillsAt(x: number, z: number): number {
  const d = pisteDistance(x, z);
  if (d < 80) return 0;
  const fade = Math.min(1, (d - 80) / 60);
  return fade * (6 + 5 * Math.sin(x / 70) * Math.cos(z / 55));
}

function levelFrom(
  seed: number,
  size: number,
  cell: number,
  height: (x: number, z: number) => number,
  packed: (x: number, z: number) => number,
  points: TrackPoint[],
  length: number,
  gateEvery: number,
  startGate: number,
  spawn: Spawn,
  trees: TreeDef[],
): Level {
  const n = Math.round(size / cell) + 1;
  const ground: Heightfield = createHeightfield(0, 0, cell, n, n);
  fillField(ground, height);
  const groundAt = (x: number, z: number): number => sampleField(ground, x, z);
  const normalAt = (x: number, z: number, out: { x: number; y: number; z: number }): void => {
    const h = cell;
    const gx = (groundAt(x + h, z) - groundAt(x - h, z)) / (2 * h);
    const gz = (groundAt(x, z + h) - groundAt(x, z - h)) / (2 * h);
    const l = Math.hypot(gx, 1, gz);
    out.x = -gx / l;
    out.y = 1 / l;
    out.z = -gz / l;
  };
  for (const p of points) p.y = groundAt(p.x, p.z);
  // The gates: the start gate a few metres below the line, then every
  // `gateEvery` m, and the finish at the piste's end whatever the spacing
  // left.
  const at = (s: number): TrackPoint => {
    const k = Math.min(points.length - 1, Math.max(0, Math.round((s / length) * points.length)));
    return points[k];
  };
  const stations: number[] = [];
  for (let s = startGate; s < length - gateEvery / 2; s += gateEvery) stations.push(s);
  stations.push(length);
  const checkpoints: Checkpoint[] = stations.map((s, i) => {
    const p = at(s);
    return {
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      width: p.width,
      s: Math.min(s, p.s),
      colour: i % 2 === 0 ? "red" : "blue",
    };
  });
  const last = checkpoints[checkpoints.length - 1];
  last.s = length;
  const fx = Math.sin(spawn.heading);
  const fz = Math.cos(spawn.heading);
  const grid: Spawn[] = [0, 1, 2, 3].map((i) => {
    const lane = (i - 1.5) * 3;
    return { x: spawn.x + fz * lane, z: spawn.z - fx * lane, heading: spawn.heading };
  });
  for (const t of trees) t.y = groundAt(t.x, t.z);
  return {
    seed,
    size,
    cell,
    ground,
    groundAt,
    normalAt,
    packedAt: packed,
    track: { points, length, closed: false },
    checkpoints,
    spawn,
    grid,
    trees,
    sun: { hour: 13, dayOfYear: 60, latitude: 46 },
    weather: STILL_AIR,
    laps: 1,
  };
}

/** The piste's centreline as points every ~2 m, from the start line down
 * to the finish. */
function pistePoints(): { points: TrackPoint[]; length: number } {
  const S = SLOPE;
  const fine: { x: number; z: number }[] = [];
  for (let z = S.startZ; z <= S.finishZ; z += 0.5) fine.push({ x: pisteX(z), z });
  let length = 0;
  for (let i = 1; i < fine.length; i++)
    length += Math.hypot(fine[i].x - fine[i - 1].x, fine[i].z - fine[i - 1].z);
  const n = Math.round(length / 2);
  const step = length / n;
  const points: TrackPoint[] = [];
  let j = 1;
  let acc = 0;
  let seg = Math.hypot(fine[1].x - fine[0].x, fine[1].z - fine[0].z);
  for (let i = 0; i <= n; i++) {
    const want = Math.min(i * step, length);
    while (acc + seg < want && j < fine.length - 1) {
      acc += seg;
      j++;
      seg = Math.hypot(fine[j].x - fine[j - 1].x, fine[j].z - fine[j - 1].z);
    }
    const t = seg > 0 ? Math.min(1, (want - acc) / seg) : 0;
    const x = fine[j - 1].x + (fine[j].x - fine[j - 1].x) * t;
    const z = fine[j - 1].z + (fine[j].z - fine[j - 1].z) * t;
    points.push({ x, z, y: 0, s: want, heading: 0, width: S.width });
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    points[i].heading = Math.atan2(b.x - a.x, b.z - a.z);
  }
  return { points, length };
}

/** The packed corridor: 1 across the piste's width, fading to 0 over a 3 m
 * shoulder. */
function corridor(d: number, width: number): number {
  const half = width / 2;
  if (d <= half) return 1;
  if (d >= half + 3) return 0;
  return 1 - (d - half) / 3;
}

export type SyntheticOptions = {
  /** Leave the trees out. */
  noTrees?: boolean;
  /** Leave the kicker out. */
  noKicker?: boolean;
  /** Runs (always one on a piste; here for the callers that name it). */
  laps?: number;
};

/** THE SLOPE (see the header). */
export function syntheticLevel(options: SyntheticOptions = {}): Level {
  const S = SLOPE;
  const { points, length } = pistePoints();
  const height = (x: number, z: number): number =>
    faceAt(z) + hillsAt(x, z) + (options.noKicker ? 0 : kickerAt(x, z));
  const packed = (x: number, z: number): number => corridor(pisteDistance(x, z), S.width);
  const trees: TreeDef[] = [];
  if (!options.noTrees) {
    for (let i = 0; i < 8; i++) {
      trees.push({
        x: S.x + 40 + (i % 2) * 30,
        z: 620 + i * 40,
        y: 0,
        height: 10 + (i % 3),
        radius: 0.3,
        crown: 2.5,
      });
    }
    trees.push({ x: LONE_TREE.x, z: LONE_TREE.z, y: 0, height: 12, radius: 0.35, crown: 2.8 });
  }
  // The start line at the top of the piste, facing down it.
  const spawn: Spawn = { x: S.x, z: S.startZ, heading: 0 };
  const level = levelFrom(
    1,
    S.size,
    S.cell,
    height,
    packed,
    points,
    length,
    S.gateEvery,
    S.startGate,
    spawn,
    trees,
  );
  if (options.laps !== undefined) level.laps = options.laps;
  if (!options.noKicker) {
    const kx = pisteX(S.kickerZ);
    level.kickers = [
      {
        id: "K1",
        x: kx,
        z: S.kickerZ,
        y: level.groundAt(kx, S.kickerZ),
        heading: 0,
        height: S.kickerRise,
        ramp: S.kickerRamp,
        landing: S.kickerDrop,
        width: S.width + 4,
        onTrack: true,
        s: S.kickerZ - S.startZ,
      },
    ];
  }
  return level;
}

/** ROLLERS ACROSS THE STRIP: a row of smooth bumps `height` m from trough
 * to crest, one every `length` m, from z = `from` to z = `to` — the uneven
 * ground the legs ride over and the body above them should not. */
export type Bumps = { height: number; length: number; from: number; to: number };

/** The rollers' rise at `z`, m: a raised cosine, nought outside the run of
 * them, so the strip meets them level. */
export function bumpAt(b: Bumps, z: number): number {
  if (z <= b.from || z >= b.to) return 0;
  return (b.height / 2) * (1 - Math.cos((2 * Math.PI * (z - b.from)) / b.length));
}

/** THE DRAG STRIP: flat snow `size` m square, packed everywhere (`packed`
 * 1) or powder everywhere (0), with an optional slope FALLING along +z at
 * `grade` (m/m) past z = `slopeFrom` — RUN OUT onto the level again past
 * z = `runOut.at`, the grade easing off over `runOut.bend` m (a
 * compression of a constant curvature, `grade / bend` per metre) —
 * optional ROLLERS across it (`bumps`,
 * on a metre grid — keep `size` small with them), and a straight piste
 * down its middle from z = 100 to z = size − 100. */
export function flatLevel(
  options: {
    packed?: number;
    size?: number;
    grade?: number;
    slopeFrom?: number;
    runOut?: { at: number; bend: number };
    bumps?: Bumps;
  } = {},
): Level {
  const size = options.size ?? 3000;
  const packedShare = options.packed ?? 1;
  const grade = options.grade ?? 0;
  const from = options.slopeFrom ?? size;
  const bumps = options.bumps;
  const out = options.runOut;
  // How far the strip has fallen by `z`: the grade's own, eased off to the
  // level over the run-out's bend.
  const fallen = (z: number): number => {
    if (z <= from) return 0;
    if (!out || z <= out.at) return (z - from) * grade;
    const u = Math.min(z - out.at, out.bend);
    return grade * (out.at - from + u - (u * u) / (2 * out.bend));
  };
  const height = (_x: number, z: number): number => -fallen(z) + (bumps ? bumpAt(bumps, z) : 0);
  const m = 100;
  const length = size - 2 * m;
  const n = Math.round(length / 2);
  const points: TrackPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const s = Math.min((i * length) / n, length);
    points.push({ x: size / 2, z: m + s, y: 0, s, heading: 0, width: 20 });
  }
  return levelFrom(
    2,
    size,
    // A bump is a few metres long: the grid fine enough to carry it.
    bumps ? 1 : 10,
    height,
    () => packedShare,
    points,
    length,
    400,
    8,
    { x: size / 2, z: m, heading: 0 },
    [],
  );
}

/** THE PIPE ON THE BENCH: a 22-foot halfpipe (R41's section) cut down an
 * 18° packed pitch falling along +z on a drag strip, its centre line at x =
 * `PIPE.x` (+x is across it to the right), its mouth at z = `PIPE.mouth`
 * and its full walls from `PIPE.from` to `PIPE.to`. No generator built
 * it: the physics of riding a wall is held to it. */
export const PIPE = {
  x: 1500,
  mouth: 60,
  from: 82,
  to: 252,
  end: 270,
  grade: Math.tan(0.1 * Math.PI),
};

export function pipeLevel(): Level {
  const base = flatLevel({ packed: 1, grade: PIPE.grade, slopeFrom: 0 });
  const frame: PipeFrame = {
    x: PIPE.x,
    z: 0,
    heading: 0,
    mouth: PIPE.mouth,
    from: PIPE.from,
    to: PIPE.to,
    end: PIPE.end,
    section: pipeSection(),
    yAt: (d) => -Math.max(0, d) * PIPE.grade,
  };
  return withPipe(base, frame);
}

/** ANY GROUND ON THE BENCH: a strip `size` m square whose height is
 * `height(x, z)` on a `cell` m grid, packed to `packed` everywhere, with a
 * straight piste down its middle along +z — what a lab shapes its own
 * kicker, drop or cliff with. */
export function shapedLevel(
  height: (x: number, z: number) => number,
  options: { packed?: number; size?: number; cell?: number } = {},
): Level {
  const size = options.size ?? 600;
  const cell = options.cell ?? 0.5;
  const share = options.packed ?? 1;
  const m = 50;
  const length = size - 2 * m;
  const n = Math.round(length / 2);
  const points: TrackPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const s = Math.min((i * length) / n, length);
    points.push({ x: size / 2, z: m + s, y: 0, s, heading: 0, width: 20 });
  }
  return levelFrom(
    2,
    size,
    cell,
    height,
    () => share,
    points,
    length,
    400,
    8,
    { x: size / 2, z: m, heading: 0 },
    [],
  );
}
