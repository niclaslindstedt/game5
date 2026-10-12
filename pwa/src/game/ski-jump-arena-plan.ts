// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING STADIUM AS PLANNED (R43): where the arena round a jumping
// hill's out-run stands — the stands, the boards, the counter-slope, the
// leader's box, the video wall, the flags, the banners and the arena's own
// floodlight masts — read off the hill the map publishes (`Level.skiJump`)
// in the hill's own frame (`ski-jump-frame.ts`). Three-free: the crowd is
// laid on it by `spectator-jump.ts`, the stands, the boards and the screen
// are drawn by `finish-arena.ts`, the rest by `ski-jump-arena.ts`, and the
// masts are lit with the hill's (`ski-jump-plan.ts`).
//
// WHAT A JUMPING STADIUM IS, as the large hills that hold the season's big
// contests are built (the research, in our own words; numbers, not names —
// `docs/freestyle.md` § *Ski jumping*):
//
//   * THE OUT-RUN levels off below the landing hill into a flat a jumper
//     sheds his last 90 km/h on, some 80–100 m of it on a large hill, and
//     ends against a COUNTER-SLOPE — the snow rising again in front of the
//     back of the arena, the bowl that stops a jumper who is still going
//     and that the back stands are built into.
//   * THE ARENA is a horseshoe round it, a stadium of 10–50 000 at the big
//     events: tiered GRANDSTANDS down both sides of the out-run, the
//     standing TERRACES across its foot, and the crowd spilling up the
//     slopes beside the landing hill behind its fences as far as the
//     knoll, the thickest by the out-run, every face turned up the hill.
//     The out-run is closed by 1 m BOARDS, padded and covered in banners,
//     with a gate the jumpers leave through; beside it the LEADER'S BOX,
//     where the man in front waits on a chair to see whether he stays
//     there; a VIDEO WALL of 50–100 m² over the back of the arena, facing
//     up the hill, shows the distance and the points the moment he lands.
//   * FLAGS fly along the stands' backs, the crowd's own flags wave in it,
//     and banners in the event's colours hang down the landing hill's
//     walls into the out-run.
//   * AT NIGHT a big contest is lit as television asks — some 1 000 lx or
//     more on the landing hill and the out-run, far over a public slope's
//     30 — by banks of floodlights on tall masts round the arena (30–40 m)
//     as well as down the hill, the stands and the snow white under them
//     and the woods round them dark.
//
// The out-run's ground is the engine's (level from U to its end, so no
// digest moves); the counter-slope is built past the back boards, where a
// jumper never reaches — he stops in the flat well short of them.

import { createRng, type Level } from "@engine";

import {
  hillFrame,
  hillPoint,
  landingWidth,
  type HillFrame,
  type SkiJumpHill,
} from "./ski-jump-frame.ts";
import { PISTE_LIGHT, solidOf, type PisteLamp, type PisteMast } from "./piste-light-plan.ts";
import { planOfDistance } from "./ski-jump-plan.ts";
import type { Arena, Fence, Grandstand } from "./spectator-plan.ts";

/** THE STADIUM'S NUMBERS (est., off photographs and plans of large hills'
 * arenas), m unless said:
 *   * `side`: the grandstands down both sides of the out-run — how far
 *     outside the landing area's edge their front stands, from how far
 *     above U and to how far past it they run, their rows, tread and rise,
 *     and how high their front row stands over the out-run.
 *   * `back`: the terraces across the out-run's foot — how far past its
 *     end, how wide the gap between them (the exit, the leader's box, the
 *     video wall), their width and rows.
 *   * `bank`: the COUNTER-SLOPE past the back boards — how far it runs up,
 *     how high it rises, the flat at its top the back terraces stand on,
 *     and how it spills off its flanks and back (a fall a metre out, and
 *     how far out it is drawn).
 *   * `boards`: the back boards' height and the exit gate in them (its
 *     place across the out-run and its width).
 *   * `leader`: the leader's box, before the back boards, past the edge.
 *   * `screen`: the video wall, 12 × 6.75 m, its foot over the terraces.
 *   * `hillBank`: the crowd beside the landing hill — from what share of K
 *     down, the fence past the landing area's edge (further on the left,
 *     where the broadcast's rail and landing camera run), the rows at its
 *     top and by the out-run.
 *   * `flag`: the stands' flagpoles — how far apart, how tall over the
 *     back rail, and a flag's size.
 *   * `banner`: the banners down the walls — from how far above U, and a
 *     banner's length.
 *   * `mast`: the arena's floodlight masts — how tall, how many lamps, and
 *     the light they are sized for, lx. */
export const SJ_ARENA = {
  side: { out: 4.6, above: 6, past: 58, rows: 12, tread: 0.8, rise: 0.45, over: 0.6 },
  back: { out: 11, gap: 15, width: 20, rows: 13 },
  bank: { from: 1.5, run: 7, rise: 2.4, top: 3, spill: 0.8, reach: 16 },
  boards: { high: 1.0, exit: 9, wide: 3.5 },
  leader: { before: 9, out: 4.2 },
  screen: { width: 12, height: 6.75, foot: 2.5 },
  hillBank: { from: 0.55, fence: 2.6, left: 6.4, top: 2, bottom: 8 },
  flag: { every: 6, pole: 8, long: 1.8, deep: 1.1 },
  banner: { above: 70, long: 6 },
  mast: { height: 36, lamps: 6, lux: 160 },
} as const;

/** A flag on a pole: the pole's foot and height, and its three stripes
 * (sRGB), the first at the hoist. */
export type ArenaFlag = { x: number; y: number; z: number; pole: number; stripes: number[] };

/** A banner hung on a landing wall's inside: m of plan, the side, its
 * colour and its stripe's (sRGB). */
export type ArenaBanner = { d0: number; d1: number; side: -1 | 1; colour: number; stripe: number };

/** Where the crowd beside the landing hill stands on one side: from `d0`
 * to `d1` of plan, its fence `fence(d)` m off the axis, its first row
 * `front(d)` m off, `rows(d)` deep. */
export type HillBank = {
  side: -1 | 1;
  d0: number;
  d1: number;
  fence: (d: number) => number;
  front: (d: number) => number;
  rows: (d: number) => number;
};

export type JumpArenaPlan = {
  frame: HillFrame;
  /** The side grandstands first (left, right), then the back terraces. */
  stands: Grandstand[];
  /** Where each stand's crowd looks: the landing hill. */
  looks: { x: number; y: number; z: number }[];
  fences: Fence[];
  arena: Arena;
  /** The counter-slope: m of plan its foot and its top's start and end,
   * how high it rises over the out-run, and how far across it runs. */
  bank: { d0: number; d1: number; d2: number; rise: number; half: number };
  hillBanks: HillBank[];
  flags: ArenaFlag[];
  banners: ArenaBanner[];
  masts: PisteMast[];
};

/** Tricolours the arena's flags fly — generic, dealt off the map's seed. */
const STRIPES = [
  0xd8262f, 0xf4f5f2, 0x1f5fbf, 0xf2c21b, 0x2c9a4a, 0x1b1e24, 0xf07a1a, 0x16a4b8,
] as const;
/** The banners' colours, the event's: deep blue, red, white, a yellow. */
const BANNERS = [0x1d4fa8, 0xd0202a, 0xf2f4f5, 0x0f2c5c, 0xf2c21b] as const;

/** The salt the arena's flags and banners are dealt off. */
const ARENA_SALT = 0x5a7e;

/** The world heading (0 = +z) of a direction (x, z). */
const headingOf = (x: number, z: number): number => Math.atan2(x, z);

/** A floodlight mast at `foot` (m of plan along, across) carrying `lamps`
 * lamps aimed at `targets` (m of plan along, across, over the snow), each
 * sized for `lux` over the `served` m² it lights. */
function arenaMast(
  f: HillFrame,
  level: Level,
  d: number,
  a: number,
  targets: readonly [number, number][],
  served: number,
): PisteMast {
  const M = SJ_ARENA.mast;
  const foot = hillPoint(f, d, a);
  const y = level.groundAt(foot.x, foot.z);
  const lumens = (M.lux * served) / PISTE_LIGHT.utilisation / targets.length;
  const side = a < 0 ? -1 : 1;
  const lamps: PisteLamp[] = targets.map(([td, ta], i) => {
    const spread = (i - (targets.length - 1) / 2) * 0.6;
    const lx = foot.x + f.rx * spread;
    const lz = foot.z + f.rz * spread;
    const ly = y + M.height;
    const t = hillPoint(f, td, ta);
    const ax = t.x - lx;
    const ay = t.y - ly;
    const az = t.z - lz;
    const n = Math.hypot(ax, ay, az);
    const aim = Math.atan2(Math.hypot(ax, az), -ay);
    return {
      x: lx,
      y: ly,
      z: lz,
      dx: ax / n,
      dy: ay / n,
      dz: az / n,
      aim,
      bearing: Math.atan2(ax, az),
      lumens,
      peak: lumens / solidOf(aim),
    };
  });
  // Facing the out-run's middle.
  const mid = hillPoint(f, (targets[0][0] + targets[targets.length - 1][0]) / 2, 0);
  return {
    x: foot.x,
    y,
    z: foot.z,
    height: M.height,
    side,
    heading: headingOf(mid.x - foot.x, mid.z - foot.z),
    lamps,
  };
}

/** THE ARENA'S MASTS for a hill: two behind each side stand and one at
 * each back corner, their lamps spread over the out-run, the landing
 * hill's foot and the stands. Read by `ski-jump-plan.ts` with the hill's
 * own masts, so they are lit, drawn and kept clear of a lens as those are. */
export function arenaMasts(f: HillFrame, level: Level): PisteMast[] {
  const hill = f.hill;
  const S = SJ_ARENA.side;
  const half = landingWidth(hill, hill.u) / 2;
  const back = half + S.out + S.rows * S.tread + 2.5;
  const out: PisteMast[] = [];
  const area = (hill.outrun - hill.l) * landingWidth(hill, hill.u) * 1.6;
  const n = SJ_ARENA.mast.lamps;
  const spread = (d0: number, d1: number, a0: number, a1: number): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const k = n > 1 ? i / (n - 1) : 0.5;
      return [d0 + (d1 - d0) * k, a0 + (a1 - a0) * (i % 2 ? 0.7 : 0.3)];
    });
  for (const side of [-1, 1] as const) {
    const across = -side * half;
    out.push(
      arenaMast(
        f,
        level,
        hill.u - 2,
        side * back,
        spread(hill.l - 15, hill.u + 25, across, 0),
        area / 6,
      ),
      arenaMast(
        f,
        level,
        hill.u + S.past - 6,
        side * back,
        spread(hill.u, hill.outrun, across, 0),
        area / 6,
      ),
      arenaMast(
        f,
        level,
        hill.outrun + SJ_ARENA.back.out + 6,
        side * (SJ_ARENA.back.gap / 2 + SJ_ARENA.back.width + 1.5),
        spread(hill.u + 20, hill.outrun - 4, 0, side * half),
        area / 6,
      ),
    );
  }
  return out;
}

const plans = new WeakMap<Level, JumpArenaPlan | null>();

/** THE STADIUM round `level`'s hill, or null on a map with none. */
export function jumpArenaPlan(level: Level): JumpArenaPlan | null {
  const kept = plans.get(level);
  if (kept !== undefined) return kept;
  const f = hillFrame(level);
  const plan = f ? planOver(f, level) : null;
  plans.set(level, plan);
  return plan;
}

/** A stand's lowest step: each row over the snow under it, and the front at
 * least `least`. */
function standHeight(level: Level, s: Omit<Grandstand, "y">, least: number): number {
  const bx = -Math.sin(s.facing);
  const bz = -Math.cos(s.facing);
  const ax = Math.cos(s.facing);
  const az = -Math.sin(s.facing);
  let y = least;
  for (let k = -s.width / 2; k <= s.width / 2; k += 3) {
    for (let r = 0; r < s.rows; r++) {
      const x = s.x + ax * k + bx * (r + 0.5) * s.tread;
      const z = s.z + az * k + bz * (r + 0.5) * s.tread;
      y = Math.max(y, level.groundAt(x, z) + 0.15 - r * s.rise);
    }
  }
  return y;
}

function planOver(f: HillFrame, level: Level): JumpArenaPlan {
  const hill: SkiJumpHill = f.hill;
  const A = SJ_ARENA;
  const S = A.side;
  const B = A.back;
  const rng = createRng((level.seed ^ ARENA_SALT) >>> 0);
  const half = landingWidth(hill, hill.u) / 2;
  const floor = hill.yAt(hill.outrun);
  const up = f.heading + Math.PI;
  const stands: Grandstand[] = [];
  const looks: JumpArenaPlan["looks"] = [];

  // THE SIDE GRANDSTANDS, facing across the out-run.
  const d0 = hill.u - S.above;
  const d1 = hill.u + S.past;
  for (const side of [-1, 1] as const) {
    const front = hillPoint(f, (d0 + d1) / 2, side * (half + S.out));
    const facing = headingOf(-side * f.rx, -side * f.rz);
    const s = {
      x: front.x,
      z: front.z,
      facing,
      width: d1 - d0,
      rows: S.rows,
      tread: S.tread,
      rise: S.rise,
    };
    stands.push({ ...s, y: standHeight(level, s, floor + S.over) });
    looks.push(hillPoint(f, hill.l, side * 2, 0));
  }

  // THE COUNTER-SLOPE past the back boards, and THE BACK TERRACES on its top.
  const bank = {
    d0: hill.outrun + A.bank.from,
    d1: hill.outrun + A.bank.from + A.bank.run,
    d2: hill.outrun + A.bank.from + A.bank.run + A.bank.top,
    rise: A.bank.rise,
    half: B.gap / 2 + B.width + 2,
  };
  for (const side of [-1, 1] as const) {
    const front = hillPoint(f, bank.d2 - 0.5, side * (B.gap / 2 + B.width / 2));
    const s = {
      x: front.x,
      z: front.z,
      facing: up,
      width: B.width,
      rows: B.rows,
      tread: S.tread,
      rise: S.rise,
    };
    stands.push({ ...s, y: standHeight(level, s, floor + bank.rise + 0.1) });
    looks.push(hillPoint(f, hill.k, 0, 0));
  }
  const backTop = Math.max(...stands.slice(2).map((s) => s.y + (s.rows - 1) * s.rise));

  // THE BACK BOARDS across the out-run's end, the exit gate in them.
  const fences: Fence[] = [];
  const gate = A.boards.exit;
  const w = A.boards.wide / 2;
  const run = (a0: number, a1: number): Fence => {
    const points: { x: number; z: number }[] = [];
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 2));
    for (let i = 0; i <= n; i++) {
      const p = hillPoint(f, hill.outrun, a0 + ((a1 - a0) * i) / n);
      points.push({ x: p.x, z: p.z });
    }
    return { points, height: A.boards.high, kind: "board" };
  };
  fences.push(run(-half, gate - w), run(gate + w, half));

  // THE LEADER'S BOX beside the out-run by the back boards; THE VIDEO WALL
  // over the gap between the back terraces, facing up the hill.
  const leader = hillPoint(f, hill.outrun - A.leader.before, half + A.leader.out);
  const exit = hillPoint(f, hill.outrun, gate);
  const screen = hillPoint(f, bank.d2 + 4, 0);
  const sy =
    Math.max(level.groundAt(screen.x, screen.z), backTop + 1.2) +
    A.screen.foot +
    A.screen.height / 2;
  const centre = hillPoint(f, hill.outrun, 0);
  const arena: Arena = {
    x: centre.x,
    z: centre.z,
    y: floor,
    heading: f.heading,
    half,
    depth: hill.outrun - hill.u,
    exit: { x: exit.x, z: exit.z },
    leader: { x: leader.x, z: leader.z, facing: headingOf(-f.rx, -f.rz) },
    screen: {
      x: screen.x,
      z: screen.z,
      y: sy,
      facing: up,
      width: A.screen.width,
      height: A.screen.height,
    },
  };

  // THE CROWD BESIDE THE LANDING HILL, from past the knoll to the stands.
  const H = A.hillBank;
  const top = planOfDistance(hill, hill.w * H.from);
  const bottom = hill.u - S.above - 2;
  const rows = (d: number): number => {
    const k = Math.max(0, Math.min(1, (d - top) / (bottom - top)));
    return Math.round(H.top + (H.bottom - H.top) * k * k);
  };
  const hillBanks: HillBank[] = ([-1, 1] as const).map((side) => {
    const off = side < 0 ? H.left : H.fence;
    return {
      side,
      d0: top,
      d1: bottom,
      fence: (d) => landingWidth(hill, d) / 2 + off,
      front: (d) => landingWidth(hill, d) / 2 + off + 0.7,
      rows,
    };
  });

  // THE FLAGS along each stand's back rail.
  const flags: ArenaFlag[] = [];
  const tricolour = (): number[] => {
    const a = rng.pick(STRIPES);
    let b = rng.pick(STRIPES);
    if (b === a) b = 0xf4f5f2;
    let c = rng.pick(STRIPES);
    if (c === b) c = a;
    return [a, b, c];
  };
  for (const s of stands) {
    const bx = -Math.sin(s.facing);
    const bz = -Math.cos(s.facing);
    const ax = Math.cos(s.facing);
    const az = -Math.sin(s.facing);
    const back = s.rows * s.tread;
    const rail = s.y + (s.rows - 1) * s.rise + 1.05;
    const n = Math.max(1, Math.floor(s.width / A.flag.every));
    for (let i = 0; i <= n; i++) {
      const k = -s.width / 2 + (i * s.width) / n;
      flags.push({
        x: s.x + ax * k + bx * back,
        y: rail - 1.05,
        z: s.z + az * k + bz * back,
        pole: A.flag.pole + 1.05,
        stripes: tricolour(),
      });
    }
  }

  // THE BANNERS down both walls into the out-run.
  const banners: ArenaBanner[] = [];
  for (const side of [-1, 1] as const) {
    let k = rng.int(0, BANNERS.length - 1);
    for (let d = hill.u - A.banner.above; d + A.banner.long <= hill.outrun; d += A.banner.long) {
      const colour = BANNERS[k % BANNERS.length];
      const stripe = colour === 0xf2f4f5 ? 0x1d4fa8 : 0xf2f4f5;
      banners.push({ d0: d + 0.15, d1: d + A.banner.long - 0.15, side, colour, stripe });
      k += 1 + rng.int(0, 1);
    }
  }

  return {
    frame: f,
    stands,
    looks,
    fences,
    arena,
    bank,
    hillBanks,
    flags,
    banners,
    masts: arenaMasts(f, level),
  };
}
