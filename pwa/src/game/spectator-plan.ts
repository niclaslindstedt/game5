// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPECTATORS, AS A PLAN — who has come to watch a race, where each one
// stands and what he brought. Three-free and DOM-free, so the suite reads
// it; `spectators.ts` draws it and animates every one of them in the shader.
//
// WHERE A SKI RACE'S CROWD STANDS, as the circuit's own organisers lay it
// out and as the fans' guides describe it:
//
//   * THE FINISH ARENA holds most of them — "the natural hub of the event",
//     reached on foot from the village. The line is at least 27 m between
//     the fences either side, under a banner 22 m across on a rope 7.5 m
//     up (the arch, `start-arch.ts`); past it the FINISH CIRCLE, the outrun
//     a racer stops in, closed by padded boards with one EXIT GATE 3.5 m
//     wide; behind the exit gate the LEADER'S BOARD on its 3.5 m square
//     platform with the LEADER'S CHAIR in front of it; a VIDEO WALL of 15
//     to 78 m² hung from scaffolding with a white roof and sides, where the
//     stands can see it; and GRANDSTANDS — tiered standing terraces —
//     either side of the last metres, "metres away from the athletes",
//     with the standing crowd rows deep behind the spectator fence along
//     the finish slope above them. That is where the banks are deepest.
//   * ON THE MOUNTAIN they stand in corridors along the safety nets, behind
//     the spectator fence (the C-fence of crowd control), where something
//     HAPPENS: at the JUMPS (to see the air), at the HARD TURNS and on the
//     STEEP PITCHES — and thin knots everywhere else, thicker the nearer
//     the finish, because the bottom of the hill is where people can walk.
//     At a turn they stand on the INSIDE: the outside is where a racer
//     who lets go ends up, which is why the nets and the A-fences are put
//     there and the crowd is not.
//   * A KNOT AT THE START: coaches, family, the few who rode the lift up.
//
// A SLALOM is watched otherwise — its course is short, netted from the
// start house to past the line, and every metre of it is a viewpoint:
// `spectator-slalom.ts` lays its banks behind the nets either side, the
// finish arena kept as it is here.
//
// And they CARRY what ski fans carry — COWBELLS, flags on poles, a board
// held over the head, a horn, a phone held up — and wear what a cold day
// in the stands is: bright jackets, bobble hats, a hood, a scarf, a
// backpack; children among them.
//
// A spectator's look and temperament are dealt here; how he MOVES is the
// shader's, a pure function of the clock and where the skiers are
// (`spectators.ts`). Dealt off the map's seed on a generator of its own
// (`FAN_SALT`) and reading the level without writing it, so no digest can
// see a spectator and nothing draws from `state.rng`.

import {
  createRng,
  nearestTrackPoint,
  raceCourseOf,
  speedCourseOf,
  trackPointAt,
  type Checkpoint,
  type Level,
  type Rng,
  type RunRules,
  type TrackPoint,
} from "@engine";

import { planSlalomBanks } from "./spectator-slalom.ts";
import { wildGround } from "./wild-ground.ts";

/** The salt on the map's seed the crowd is dealt off. */
export const FAN_SALT = 0x5ec7;

/** THE SAFETY NETS (the B-nets) along the piste's edges, m: how far up
 * the piste of the line they fence, how far past it, their height, how far
 * outside the piste's edge they stand, and their posts' spacing. Drawn by
 * `gates.ts`; every spectator stands behind them, the spectator fence
 * (`FANS.fence`) two metres further out — the gap a crowd-control plan
 * keeps between a net and what it protects. */
export const NETS = { before: 60, after: 30, height: 1.3, out: 1.2, post: 8 } as const;

/** WHERE THE NETS RUN down the piste, as arcs: the last stretch to the
 * line and past it — on a race's course (a slalom's, a downhill's, a
 * super-G's) the
 * whole course, from just above its start house. */
export function netStretch(level: Level, finish: Checkpoint): { from: number; to: number } {
  const course = raceCourseOf(level);
  return {
    from: course ? course.from - 2 : Math.max(0, finish.s - NETS.before),
    to: Math.min(level.track.length, finish.s + NETS.after),
  };
}

/** HOW THE NETS STAND: how far outside the piste's edge, and how tall, m —
 * the B-nets' (`NETS`), and on a DOWNHILL or a SUPER-G its A-nets (R32,
 * R33, `SpeedCourse.nets`), the engine's own line a racer is caught on. */
export function netShape(level: Level): { out: number; height: number } {
  const nets = speedCourseOf(level)?.nets;
  return nets ? { out: nets.gap, height: nets.height } : { out: NETS.out, height: NETS.height };
}

/** WHO GETS A CROWD: every run with something to watch — a course
 * counted (the race and the time trial) or a terrain park scored (the
 * tricks run). A free ride's ski area has its own people (`crowd.ts`). */
export function hasSpectators(rules: Pick<RunRules, "course" | "tricks">): boolean {
  return rules.course || rules.tricks;
}

/** What a fan DOES when a skier comes by — the shader's `aAct.w`. */
export const FAN_STYLES = [
  "clap", // claps over his head, faster the closer the racer
  "wave", // both arms up, waving
  "bell", // rings a cowbell, the arm shaking it
  "flag", // swings a flag on a pole in big arcs
  "jump", // jumps on the spot, fists pumping
  "sign", // holds a board up over his head and bounces it
  "horn", // blows a horn, the other arm waving
  "film", // holds a phone out and follows the racer with it
] as const;
export type FanStyle = (typeof FAN_STYLES)[number];

/** What a fan wears on his head — the shader's `aLook.z`. */
export const FAN_HATS = ["bare", "beanie", "bobble", "cap", "hood", "horns"] as const;
export type FanHat = (typeof FAN_HATS)[number];

/** WHAT THE CROWD WEARS AND WAVES: every colour a jacket, a pair of
 * trousers, a hat, a flag's stripe or a scarf is dealt from, linear-free
 * sRGB hex. A cold day's crowd is bright on top and dark below. */
export const FAN_PALETTE = [
  0xd8262f,
  0x1f5fbf,
  0xf2c21b,
  0x2c9a4a,
  0xf07a1a,
  0xe0559a,
  0x6a3fb5,
  0x16a4b8, // brights
  0x1b1e24,
  0x2b3a57,
  0x4a4f57,
  0x5b4636,
  0x2f4a33,
  0x7a1f26, // darks
  0xf4f5f2,
  0xc9ccd0, // whites
  0xf2d3b8,
  0xe0b48f,
  0xc28c62,
  0x8d5a3b,
  0x5a3a28, // skin
] as const;
const BRIGHT = [0, 1, 2, 3, 4, 5, 6, 7, 14, 8, 9];
const DARK = [8, 9, 10, 12, 8, 9, 8, 15, 0, 1];
const HAT = [0, 1, 2, 3, 4, 5, 6, 7, 14, 8, 15];
const SKIN = [16, 16, 17, 17, 18, 19, 20];
const STRIPE = [0, 1, 2, 3, 4, 14, 8, 6, 7];

/** What kind of bank a fan stands in. A slalom's banks line its course
 * (`course`) and crowd its combinations (`combo`). */
export type BankKind =
  "finish" | "stand" | "back" | "jump" | "turn" | "pitch" | "start" | "line" | "course" | "combo";

export type Fan = {
  x: number;
  /** Where his feet are: the snow, or the terrace's step. */
  y: number;
  z: number;
  /** The way he faces at rest (heading convention: 0 = +z). */
  yaw: number;
  /** Stature, m — a child at a metre and a bit, a tall man near two. */
  height: number;
  /** How broad he is against the figure, ×. */
  girth: number;
  style: number;
  hat: number;
  /** A long coat, a backpack, a scarf. */
  coat: boolean;
  pack: boolean;
  scarf: boolean;
  /** FAN_PALETTE indices: jacket, trousers, hat, accent (scarf, board). */
  dress: [number, number, number, number];
  /** Skin, then the three stripes of his flag. */
  dress2: [number, number, number, number];
  /** Where in his own rhythm he is, 0..1, and how hard he goes, 0..1. */
  phase: number;
  lively: number;
  /** How far off a racer starts to excite him, m. */
  reach: number;
  /** The bank he stands in. */
  kind: BankKind;
  /** Whether he stands in the finish arena, where the music keeps a crowd
   * moving between racers. */
  arena: boolean;
  /** Metres along his bank: where a crowd's wave is when it reaches him. */
  along: number;
  bank: number;
};

export type Bank = {
  kind: BankKind;
  /** The first fan and one past the last, in `fans`. */
  from: number;
  to: number;
  /** The centre and how far its fans reach from it, m — for the lens's
   * cut and the frustum. */
  x: number;
  y: number;
  z: number;
  radius: number;
};

/** A GRANDSTAND: a tiered standing terrace beside the finish. `x`, `z` is
 * the centre of its FRONT edge, `y` the height of its lowest step; it
 * faces `facing` (the way its crowd looks), `width` along, `rows` deep at
 * `tread` each, each row `rise` higher than the one in front. */
export type Grandstand = {
  x: number;
  y: number;
  z: number;
  facing: number;
  width: number;
  rows: number;
  tread: number;
  rise: number;
};

/** A run of fence on posts, its points in order, and its height, m. */
export type Fence = { points: { x: number; z: number }[]; height: number; kind: "net" | "board" };

/** THE FINISH ARENA's furniture past the line. */
export type Arena = {
  /** The line's centre, its height, and the way down it. */
  x: number;
  z: number;
  y: number;
  heading: number;
  /** Half the width between the fences at the line, m. */
  half: number;
  /** The outrun's depth past the line, m. */
  depth: number;
  /** The exit gate in the back boards: its centre. */
  exit: { x: number; z: number };
  /** The leader's platform behind the exit gate, facing up the piste. */
  leader: { x: number; z: number; facing: number };
  /** The video wall: the centre of its screen, its size, the way it faces. */
  screen: { x: number; z: number; y: number; facing: number; width: number; height: number };
};

export type SpectatorPlan = {
  fans: Fan[];
  banks: Bank[];
  stands: Grandstand[];
  fences: Fence[];
  arena: Arena | null;
};

/** The numbers the crowd is laid by, m unless said. */
export const FANS = {
  /** A standing fan's elbow room: along the fence, and row behind row. */
  spacing: 0.62,
  row: 0.72,
  /** The spectator fence, outside the piste's edge, and the first row
   * behind it. */
  fence: 3.2,
  front: 4.0,
  /** THE FINISH SLOPE: how far up the piste the standing crowd reaches,
   * and how many rows deep it is at the line and at its top. */
  slope: 190,
  deep: 7,
  shallow: 1,
  /** THE FINISH CIRCLE: the outrun past the line, and the exit gate. */
  outrun: 30,
  exit: 3.5,
  /** THE BACK TERRACES behind the finish circle: how far past its back
   * boards, the gap between them the exit gate and the leader's platform
   * stand in, and their rows. */
  back: { out: 3, gap: 12, rows: 6 },
  /** THE GRANDSTANDS: how far along each is, its rows, each row's depth
   * and rise, and how far up the piste of the line it starts. */
  stand: { width: 38, rows: 9, tread: 0.8, rise: 0.42, before: 20, out: 5 },
  /** THE VIDEO WALL: 7 × 4 m, its foot 3 m up, behind the outrun. */
  screen: { width: 7.2, height: 4, foot: 3 },
  /** ON THE MOUNTAIN: how long a bank is at a jump, a turn and a pitch,
   * and how deep; how far apart two of a kind must be. */
  jump: { length: 34, rows: 3, both: 2 },
  turn: { length: 36, rows: 3, bend: 0.3, apart: 110 },
  pitch: { length: 30, rows: 2, apart: 200, count: 3 },
  /** THE LOWER CORRIDOR: the bottom of the hill people walk up to from
   * the village — from this share of the way down, a row or two along
   * stretches of either side. */
  corridor: { from: 0.55, length: [24, 60], gap: [10, 40] },
  start: { length: 22, rows: 2 },
  /** The thin knots along the rest: one every so many metres. */
  line: { every: 32 },
  /** Ground a fan may stand on: rise over run. */
  steep: 0.62,
  /** Clear of every trunk, m. */
  trunk: 1.3,
  /** The most the plan lays — the draw's budget. */
  cap: 5200,
} as const;

/** A fan's own temperament, by where he stands: how far off a racer
 * reaches him, m. */
const REACH: Record<BankKind, [number, number]> = {
  finish: [38, 60],
  stand: [55, 85],
  back: [45, 70],
  jump: [40, 65],
  turn: [32, 52],
  pitch: [32, 52],
  start: [16, 26],
  line: [28, 46],
  course: [24, 40],
  combo: [28, 46],
};

/** What a course's own crowd is laid with (`spectator-slalom.ts`): the
 * plan's stream and its fans, and the ways a fan is put down — a bank
 * behind the fence, or one fan where the caller decides. */
export type FanDealer = {
  level: Level;
  rng: Rng;
  fans: readonly Fan[];
  /** Where the finish slope's standing crowd stops above the line, m of
   * arc: the grandstands stand below it. */
  slopeEnd: number;
  /** A standing bank behind the spectator fence, as `planSpectators` lays
   * the finish slope: from arc `s0` to `s1` on `side`, `rows(s)` deep,
   * each place taken at `fill(s)`. */
  standing(
    kind: BankKind,
    s0: number,
    s1: number,
    side: number,
    rows: (s: number) => number,
    fill: number | ((s: number) => number),
  ): void;
  /** One fan at (x, z) facing `yaw`, where the ground, the trunks, the
   * lifts and the next fan leave room — the piste NOT asked, so the caller
   * answers for it. Whether he was put down. */
  put(x: number, z: number, yaw: number, kind: BankKind, along: number): boolean;
  /** Close a bank over the fans laid since `from`. */
  close(kind: BankKind, from: number): void;
};

/** THE CROWD for `level`. The same map deals the same crowd every time. */
export function planSpectators(level: Level): SpectatorPlan {
  const rng = createRng((level.seed ^ FAN_SALT) >>> 0);
  const ground = wildGround(level);
  const fans: Fan[] = [];
  const banks: Bank[] = [];
  const stands: Grandstand[] = [];
  const fences: Fence[] = [];
  const taken = new Set<number>();
  const cellOf = (x: number, z: number): number =>
    Math.floor(x / 0.5) * 65536 + Math.floor(z / 0.5);
  const blocked = blockers(level);
  const points = level.track.points;
  const length = level.track.length;

  /** Whether a fan has room at (x, z), the piste aside: on the map, on
   * ground he can stand on, clear of the trunks, the lifts and the next
   * fan. */
  const room = (x: number, z: number): boolean => {
    if (!ground.inside(x, z, 6)) return false;
    if (taken.has(cellOf(x, z))) return false;
    if (ground.slope(x, z) > FANS.steep) return false;
    if (ground.onIce(x, z)) return false;
    if (ground.nearestTree(x, z, FANS.trunk)) return false;
    return !blocked(x, z);
  };
  /** Whether a fan can stand at (x, z): where he has room and off every
   * skier's line, behind the fence. */
  const free = (x: number, z: number): boolean => {
    if (!room(x, z)) return false;
    const hit = nearestTrackPoint(level, x, z);
    const w = points[hit.index]?.width ?? 30;
    return hit.distance >= w / 2 + FANS.fence + 0.4 || hit.s >= length;
  };

  /** One fan dealt his look and temperament. */
  const fan = (
    x: number,
    y: number,
    z: number,
    yaw: number,
    kind: BankKind,
    along: number,
  ): Fan => {
    const child = rng.chance(0.09);
    const height = child ? rng.range(1.05, 1.4) : rng.range(1.58, 1.95);
    const style = dealStyle(rng, kind);
    const [r0, r1] = REACH[kind];
    const stripes = [rng.pick(STRIPE), rng.pick(STRIPE), rng.pick(STRIPE)];
    if (stripes[1] === stripes[0]) stripes[1] = 14;
    return {
      x,
      y,
      z,
      yaw: yaw + rng.range(-0.35, 0.35),
      height,
      girth: child ? rng.range(0.8, 0.95) : rng.range(0.88, 1.3),
      style,
      hat: dealHat(rng),
      coat: !child && rng.chance(0.3),
      pack: rng.chance(0.18),
      scarf: rng.chance(0.35),
      dress: [rng.pick(BRIGHT), rng.pick(DARK), rng.pick(HAT), rng.pick(BRIGHT)],
      dress2: [rng.pick(SKIN), stripes[0], stripes[1], stripes[2]],
      phase: rng.next(),
      lively: Math.min(1, (child ? 0.3 : 0) + rng.range(0.35, 1)),
      reach: rng.range(r0, r1),
      kind,
      arena: kind === "finish" || kind === "stand" || kind === "back",
      along,
      bank: banks.length,
    };
  };

  /** Close a bank over the fans laid since `from`. */
  const close = (kind: BankKind, from: number): void => {
    if (fans.length <= from) return;
    // A long bank is cut in pieces a lens can pass over one at a time.
    for (let a = from; a < fans.length; a += 160) {
      const b = Math.min(fans.length, a + 160);
      let x = 0;
      let y = 0;
      let z = 0;
      for (let i = a; i < b; i++) {
        x += fans[i].x;
        y += fans[i].y;
        z += fans[i].z;
        fans[i].bank = banks.length;
      }
      const n = b - a;
      x /= n;
      y /= n;
      z /= n;
      let radius = 0;
      for (let i = a; i < b; i++) {
        radius = Math.max(radius, Math.hypot(fans[i].x - x, fans[i].y - y, fans[i].z - z));
      }
      banks.push({ kind, from: a, to: b, x, y, z, radius: radius + 2.5 });
    }
  };

  /** A STANDING BANK beside the piste: from arc `s0` to `s1` on `side`
   * (+1 right of the way down), `rows(s)` deep, its fence in front. */
  const standing = (
    kind: BankKind,
    s0: number,
    s1: number,
    side: number,
    rows: (s: number) => number,
    fill: number | ((s: number) => number) = 0.9,
  ): void => {
    const from = fans.length;
    const fence: { x: number; z: number }[] = [];
    const p: TrackPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0, width: 0 };
    let along = 0;
    let fenced = 0;
    for (let s = Math.max(0, s0); s <= Math.min(length, s1); s += FANS.spacing) {
      if (fans.length >= FANS.cap) break;
      trackPointAt(level, s, p);
      const rx = Math.cos(p.heading) * side;
      const rz = -Math.sin(p.heading) * side;
      const edge = p.width / 2;
      if (along - fenced >= 2 || fence.length === 0) {
        fenced = along;
        const fx = p.x + rx * (edge + FANS.fence);
        const fz = p.z + rz * (edge + FANS.fence);
        if (!blocked(fx, fz)) fence.push({ x: fx, z: fz });
      }
      // The crowd faces the piste, a little up it: the racer comes from
      // above.
      const facing = p.heading + Math.PI + side * -1.15;
      const deep = rows(s);
      const full = typeof fill === "number" ? fill : fill(s);
      for (let r = 0; r < deep; r++) {
        if (!rng.chance(full - r * 0.05)) continue;
        const out = edge + FANS.front + r * FANS.row + rng.range(-0.15, 0.2);
        const jog = rng.range(-0.2, 0.2);
        const x = p.x + rx * out + Math.sin(p.heading) * jog;
        const z = p.z + rz * out + Math.cos(p.heading) * jog;
        if (!free(x, z)) continue;
        taken.add(cellOf(x, z));
        fans.push(fan(x, ground.snowY(x, z), z, facing, kind, along));
      }
      along += FANS.spacing;
    }
    if (fence.length > 1 && fans.length > from)
      fences.push({ points: fence, height: 1.1, kind: "net" });
    close(kind, from);
  };

  // THE FINISH ARENA.
  const finishCp = level.checkpoints[level.checkpoints.length - 1];
  let arena: Arena | null = null;
  if (finishCp) {
    const h = finishCp.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = Math.cos(h);
    const rz = -Math.sin(h);
    const half = Math.max(13.5, finishCp.width / 2 + 1.2);
    const at = (along: number, across: number) => ({
      x: finishCp.x + fx * along + rx * across,
      z: finishCp.z + fz * along + rz * across,
    });
    // The finish circle: the boards on from the line either side, then
    // across the back with the exit gate in it.
    const d = FANS.outrun;
    for (const side of [-1, 1]) {
      const run: { x: number; z: number }[] = [];
      for (let a = 0; a <= d; a += 2) run.push(at(a, side * half));
      for (let c = half; c >= FANS.exit / 2; c -= 2) run.push(at(d, side * c));
      run.push(at(d, (side * FANS.exit) / 2));
      fences.push({ points: run, height: 1.0, kind: "board" });
    }
    const exit = at(d, 0);
    // The line's height: what the arena's furniture is raised to where the
    // ground falls away past the graded finish.
    const lineY = finishCp.y;

    /** A TERRACE of standing fans: `rows` deep behind its front edge's
     * centre `front`, `width` along it, the crowd facing `facing` and
     * looking at the line. Returns it, or null where the ground has no
     * room for it. */
    const st = FANS.stand;
    const terrace = (
      front: { x: number; z: number },
      facing: number,
      width: number,
      rows: number,
      kind: BankKind,
    ): Grandstand | null => {
      // Along it (`f`) and back away from what it watches (`b`).
      const bx = -Math.sin(facing);
      const bz = -Math.cos(facing);
      const fx2 = Math.cos(facing);
      const fz2 = -Math.sin(facing);
      let y0 = lineY - 0.5;
      for (let a = -width / 2; a <= width / 2; a += 4) {
        for (let r = 0; r <= rows; r++) {
          const x = front.x + fx2 * a + bx * r * st.tread;
          const z = front.z + fz2 * a + bz * r * st.tread;
          if (!ground.inside(x, z, 4) || blocked(x, z) || ground.nearestTree(x, z, 1.5))
            return null;
          y0 = Math.max(y0, level.groundAt(x, z) - Math.min(r, rows - 1) * st.rise);
        }
      }
      const stand: Grandstand = {
        x: front.x,
        y: y0 + 0.5,
        z: front.z,
        facing,
        width,
        rows,
        tread: st.tread,
        rise: st.rise,
      };
      stands.push(stand);
      const from = fans.length;
      const target = at(-25, 0);
      for (let r = 0; r < rows; r++) {
        for (let a = -width / 2 + 0.5; a <= width / 2 - 0.5; a += FANS.spacing - 0.04) {
          if (!rng.chance(0.93)) continue;
          const back = (r + 0.5) * st.tread + rng.range(-0.1, 0.1);
          const x = front.x + fx2 * (a + rng.range(-0.12, 0.12)) + bx * back;
          const z = front.z + fz2 * (a + rng.range(-0.12, 0.12)) + bz * back;
          const yaw = Math.atan2(target.x - x, target.z - z);
          fans.push(fan(x, stand.y + r * st.rise, z, yaw, kind, a + width / 2 + r * 0.37));
        }
      }
      close(kind, from);
      // Keep the standing crowd off its footprint.
      for (let a = -width / 2 - 1; a <= width / 2 + 1; a += 0.5) {
        for (let b = -1; b <= rows * st.tread + 1; b += 0.5) {
          taken.add(cellOf(front.x + fx2 * a + bx * b, front.z + fz2 * a + bz * b));
        }
      }
      return stand;
    };

    // THE GRANDSTANDS, either side of the line, set back past the boards
    // and facing across.
    for (const side of [-1, 1]) {
      terrace(
        at(st.width / 2 - st.before, side * (half + st.out)),
        h + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        st.width,
        st.rows,
        "stand",
      );
    }
    // THE BACK TERRACES behind the finish circle, either side of the exit
    // gate and the leader's platform behind it, facing up the piste: the
    // U of a finish stadium.
    const gap = FANS.back.gap;
    const backWidth = half + st.out + 4 - gap / 2;
    let backTop = lineY;
    for (const side of [-1, 1]) {
      const t = terrace(
        at(d + FANS.back.out, side * (gap / 2 + backWidth / 2)),
        h + Math.PI,
        backWidth,
        FANS.back.rows,
        "back",
      );
      if (t) backTop = Math.max(backTop, t.y + (t.rows - 1) * t.rise);
    }
    // The leader's platform behind the exit gate, beside the way out; the
    // video wall up over the back terraces, where every stand can see it.
    const leaderAt = at(d + 5, 3.2);
    const screenAt = at(
      d + FANS.back.out + FANS.back.rows * st.tread + 2.5,
      -(gap / 2 + backWidth / 2),
    );
    arena = {
      x: finishCp.x,
      z: finishCp.z,
      heading: h,
      half,
      depth: d,
      y: lineY,
      exit,
      leader: { ...leaderAt, facing: h + Math.PI },
      screen: {
        ...screenAt,
        y:
          Math.max(level.groundAt(screenAt.x, screenAt.z), backTop + 1.6) +
          FANS.screen.foot / 2 +
          FANS.screen.height / 2,
        facing: h + Math.PI,
        width: FANS.screen.width,
        height: FANS.screen.height,
      },
    };

    // THE FINISH SLOPE: rows deep at the line, thinning up the hill. A
    // slalom's is laid with its course.
    if (!level.slalom) {
      const top = length - FANS.slope;
      const end = length - st.before - 2;
      const rows = (s: number): number => {
        const k = Math.max(0, Math.min(1, (s - top) / (end - top)));
        return Math.round(FANS.shallow + (FANS.deep - FANS.shallow) * k * k);
      };
      for (const side of [-1, 1]) standing("finish", top, end, side, rows, 0.92);
    }
  }

  // A SLALOM: its course lined behind the nets from the start house to
  // the finish slope, and nothing of a downhill's.
  if (level.slalom && finishCp) {
    planSlalomBanks({
      level,
      rng,
      fans,
      slopeEnd: finishCp.s - FANS.stand.before - 2,
      standing,
      put(x, z, yaw, kind, along) {
        if (fans.length >= FANS.cap || !room(x, z)) return false;
        taken.add(cellOf(x, z));
        fans.push(fan(x, ground.snowY(x, z), z, yaw, kind, along));
        return true;
      },
      close,
    });
    return { fans, banks, stands, fences, arena };
  }

  // ON THE MOUNTAIN: the jumps, the hard turns, the steep pitches.
  const busy: { s: number; side: number }[] = [];
  const near = (s: number, side: number, gap: number) =>
    busy.some((b) => b.side === side && Math.abs(b.s - s) < gap) || s > length - FANS.slope - 20;
  // A speed course's jumps are the ones it keeps (R32, R33) — its kickers
  // levelled.
  const speed = speedCourseOf(level);
  const jumps: { s: number; landing: number; height: number }[] = speed
    ? speed.jumps.map((s) => ({ s, landing: 30, height: 1 }))
    : (level.kickers ?? [])
        .filter((k) => k.onTrack && k.s !== undefined)
        .map((k) => ({ s: k.s ?? 0, landing: k.landing, height: k.height }))
        .sort((a, b) => b.height - a.height);
  jumps.forEach((k, rank) => {
    const s = k.s + Math.min(k.landing, 30) * 0.3;
    const big = rank < FANS.jump.both;
    // The biggest jumps draw a crowd down both sides; the rest one.
    const sides = big ? [-1, 1] : [rng.chance(0.5) ? 1 : -1];
    for (const side of sides) {
      if (near(s, side, 40)) continue;
      busy.push({ s, side });
      const L = FANS.jump.length * (big ? 1.2 : 0.8);
      const deep = big ? FANS.jump.rows : FANS.jump.rows - 1;
      standing("jump", s - L / 2, s + L / 2, side, () => deep, 0.75);
    }
  });
  for (const t of turns(points)) {
    // The inside of the bend: a bend to the right has its inside on the
    // right.
    const side = t.bend > 0 ? 1 : -1;
    if (near(t.s, side, FANS.turn.apart)) continue;
    busy.push({ s: t.s, side });
    const L = FANS.turn.length;
    standing("turn", t.s - L / 2, t.s + L / 2, side, () => FANS.turn.rows, 0.75);
  }
  for (const p of pitches(points, FANS.pitch.count, FANS.pitch.apart)) {
    const side = rng.chance(0.5) ? 1 : -1;
    if (near(p, side, 80)) continue;
    busy.push({ s: p, side });
    const L = FANS.pitch.length;
    standing("pitch", p - L / 2, p + L / 2, side, () => FANS.pitch.rows, 0.7);
  }
  // THE LOWER CORRIDOR: stretches of a row or two down the bottom of the
  // hill, either side, wherever nothing bigger already stands.
  for (const side of [-1, 1]) {
    const C = FANS.corridor;
    let s = length * C.from + rng.range(0, C.gap[1]);
    while (s < length - FANS.slope - 10) {
      const L = rng.range(C.length[0], C.length[1]);
      if (!near(s + L / 2, side, L / 2 + 10)) {
        busy.push({ s: s + L / 2, side });
        const deep = rng.chance(0.4) ? 2 : 1;
        standing("line", s, s + L, side, () => deep, 0.7);
      }
      s += L + rng.range(C.gap[0], C.gap[1]);
    }
  }
  // THE START: a knot on the right, across from the hut.
  standing("start", 4, 4 + FANS.start.length, 1, () => FANS.start.rows, 0.55);
  // THE THIN KNOTS along the rest, thicker toward the bottom.
  {
    const from = fans.length;
    for (let s = 60; s < length - FANS.slope; s += FANS.line.every * rng.range(0.6, 1.4)) {
      const k = s / length;
      if (!rng.chance(0.45 + 0.5 * k)) continue;
      const side = rng.chance(0.5) ? 1 : -1;
      if (near(s, side, 20)) continue;
      const n = rng.int(3, 4 + Math.round(9 * k));
      const p = trackPointAt(level, s);
      const rx = Math.cos(p.heading) * side;
      const rz = -Math.sin(p.heading) * side;
      const facing = p.heading + Math.PI + side * -1.15;
      for (let i = 0; i < n; i++) {
        const along = (i - n / 2) * FANS.spacing * rng.range(1, 1.6);
        const out = p.width / 2 + FANS.front + rng.range(0, 2.2);
        const x = p.x + rx * out + Math.sin(p.heading) * along;
        const z = p.z + rz * out + Math.cos(p.heading) * along;
        if (fans.length >= FANS.cap || !free(x, z)) continue;
        taken.add(cellOf(x, z));
        fans.push(fan(x, ground.snowY(x, z), z, facing, "line", along));
      }
    }
    close("line", from);
  }

  return { fans, banks, stands, fences, arena };
}

/** What a fan does when a racer comes, by where he stands: the finish is
 * cowbells, flags and boards, the mountain more clapping and filming. */
function dealStyle(rng: ReturnType<typeof createRng>, kind: BankKind): number {
  const arena = kind === "finish" || kind === "stand" || kind === "back";
  //            clap wave bell flag jump sign horn film
  const odds = arena ? [24, 18, 20, 8, 11, 4, 6, 9] : [26, 18, 16, 10, 8, 3, 6, 13];
  let roll = rng.next() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    roll -= odds[i];
    if (roll < 0) return i;
  }
  return 0;
}

function dealHat(rng: ReturnType<typeof createRng>): number {
  //            bare beanie bobble cap hood horns
  const odds = [14, 30, 30, 10, 12, 4];
  let roll = rng.next() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    roll -= odds[i];
    if (roll < 0) return i;
  }
  return 1;
}

/** The HARD TURNS down the piste: where the heading swings more than
 * `FANS.turn.bend` over forty metres, each the apex of its bend. `bend` is
 * signed, + a turn to the right (the heading growing, clockwise). */
export function turns(points: readonly TrackPoint[]): { s: number; bend: number }[] {
  const out: { s: number; bend: number }[] = [];
  const span = 20;
  const step = 2;
  const k = Math.round(span / step);
  let best: { s: number; bend: number } | null = null;
  for (let i = k; i < points.length - k; i++) {
    let bend = points[i + k].heading - points[i - k].heading;
    bend = Math.atan2(Math.sin(bend), Math.cos(bend));
    if (Math.abs(bend) >= FANS.turn.bend) {
      if (!best || Math.abs(bend) > Math.abs(best.bend)) best = { s: points[i].s, bend };
    } else if (best) {
      out.push(best);
      best = null;
    }
  }
  if (best) out.push(best);
  return out;
}

/** The STEEPEST PITCHES: the `count` steepest forty-metre stretches at
 * least `apart` apart, as arcs down the piste. */
export function pitches(points: readonly TrackPoint[], count: number, apart: number): number[] {
  const k = 20;
  const grades: { s: number; g: number }[] = [];
  for (let i = k; i < points.length - k; i += 4) {
    const a = points[i - k];
    const b = points[i + k];
    grades.push({ s: points[i].s, g: (a.y - b.y) / Math.max(1, b.s - a.s) });
  }
  grades.sort((a, b) => b.g - a.g);
  const out: number[] = [];
  for (const g of grades) {
    if (out.length >= count) break;
    if (g.g < 0.18) break;
    if (out.every((s) => Math.abs(s - g.s) >= apart)) out.push(g.s);
  }
  return out;
}

/** Where nobody may stand: a lift's stations and the wind tunnels' line. */
function blockers(level: Level): (x: number, z: number) => boolean {
  const spots: { x: number; z: number; r: number }[] = [];
  for (const lift of level.resort?.lifts ?? []) {
    spots.push({ x: lift.bottom.x, z: lift.bottom.z, r: 22 });
    spots.push({ x: lift.top.x, z: lift.top.z, r: 22 });
  }
  for (const tunnel of level.resort?.tunnels ?? []) {
    for (let i = 0; i < tunnel.points.length; i += 2) {
      const p = tunnel.points[i];
      spots.push({ x: p.x, z: p.z, r: 9 });
    }
  }
  return (x, z) => spots.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r);
}
