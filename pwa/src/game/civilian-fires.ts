// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE AT THE FIRES — skiers in their ski clothes and boots stopped
// at a ski area's CAMP FIRES and BONFIRES (`engine/game/fires.ts`) to warm
// up and grill a sausage: a camp fire's two to five, a bonfire's four to
// ten, each one FACING THE FIRE. A sitter is dealt a place on a log bench
// (his hips on its seat, `benchHome`), a stander a place on a ring round
// the hearth between the benches; whoever grills holds a long stick out
// over the embers (`stickTip`: from his hand, its tip on the line to the
// hearth's middle, over the flames), and each fire has a few pairs of skis
// and poles stuck upright in the snow a step behind its benches.
//
// Dealt round each fire by `civilian-plan.ts` (`dealFirePeople`) off the
// map's seed on a salt of their own — never `state.rng` — after every other
// civilian, so nobody else's lot moves; presentation only, like them. The
// rest of the free ride's people keep out of a fire's ring (`fireKeepOut`,
// read by `civilianClear`). Three-free: the suite reads it.

import {
  FIRE_KINDS,
  TAU,
  createRng,
  firesOf,
  type CrowdBody,
  type Fire,
  type Level,
  type Rng,
} from "@engine";

import { roleOf, type RoleId } from "./civilian-roles.ts";
import { CIVILIAN_POSES, civilianPosed, type CivilianTarget } from "./civilian-moves.ts";
import { CROWD_LOOKS } from "./crowd-rig.ts";
import { FIRE_KIT, snowFloor } from "./fire-plan.ts";

/** The salt on the map's seed the fireside people are dealt off. */
export const FIRE_PEOPLE_SALT = 0xf1e9;

/** THE FIRESIDE, m and counts.
 *   * `most`: the most fireside people a map deals.
 *   * `count`: how many round each kind (dealt between the two).
 *   * `slots`: where along a bench its sitters sit, m from its middle.
 *   * `stand`: how far from the hearth's middle a warmer and an eater
 *     stand, m (a griller stands where his stick reaches, `griller`).
 *   * `over`: how far out from the hearth's middle a sausage is held over
 *     the embers, m, and how high, m over the hearth — between `low` and
 *     `top` where his hand is higher or lower than a griller's.
 *   * `apart`: the least room between two standers, m; `bench` what a
 *     stander keeps from a bench's seat and `feet` from where its sitters'
 *     boots are, `pile` from the woodpile.
 *   * `skis`: the pairs stuck upright in the snow — how many, how far out
 *     past the bench ring, m, and the room they keep from a bench.
 *   * `keep`: how far past the benches' ends the fire's ring reaches,
 *     which the rest of the civilians keep out of, m. */
export const FIRESIDE = {
  most: 140,
  count: { camp: [2, 5], bonfire: [4, 10] },
  slots: { camp: [-0.42, 0.42], bonfire: [-0.78, 0, 0.78] },
  stand: { camp: { warm: 1.3, eat: 1.55 }, bonfire: { warm: 3.0, eat: 3.4 } },
  over: { camp: 0.3, bonfire: 1.9, high: 0.45, low: 0.25, top: 0.7 },
  stick: 1.2,
  apart: 0.8,
  bench: 0.75,
  feet: 0.55,
  pile: 1.2,
  skis: { camp: [1, 2], bonfire: [2, 4], out: 0.9, bench: 0.8 },
  /** The most a griller's bench may stand over the hearth, m. */
  benchOver: 0.25,
  keep: 1.0,
} as const;

/** The radius round fire `f` the rest of the civilians keep out of, m: its
 * benches' ends and a step past them. */
export function fireKeepOut(f: Fire): number {
  const S = FIRE_KINDS[f.kind].seats;
  return Math.hypot(S.ring, S.length / 2) + FIRESIDE.keep;
}

/** A seat on a bench: where his hips are, the floor he is drawn on (the
 * bench's seat less the bench pose's own seat, `civilian-moves.ts`' 0.47 m),
 * and the seat's height. */
const BENCH_POSE_SEAT = 0.47;

/** One person dealt at a fire: his role, where he stands or sits and the
 * way he faces (at the fire), the seat (null stood), how keen he is (out
 * while under the role's share for the hour) and the fire. */
export type FiresideHome = {
  role: RoleId;
  body: CrowdBody;
  x: number;
  y: number;
  z: number;
  heading: number;
  seat: number | null;
  keen: number;
  fire: Fire;
};

/** A pair of skis and its poles stuck in the snow by a fire. */
export type StuckSkis = { x: number; y: number; z: number; heading: number };

/** The heading from (x, z) to the fire's middle. */
const facing = (f: Fire, x: number, z: number): number => Math.atan2(f.x - x, f.z - z);

/** Distance from (x, z) to the segment a–b, m. */
function toSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const ex = bx - ax;
  const ez = bz - az;
  const l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
  return Math.hypot(ax + ex * t - x, az + ez * t - z);
}

/** How far (x, z) is from every bench of `f` — its seat, and the snow
 * before it where its sitters' boots are (`toFire` m toward the fire). */
function fromBenches(f: Fire, x: number, z: number, toFire: number): number {
  let d = Infinity;
  for (const s of f.seats) {
    // Along the bench: square to the way its sitter faces.
    const ax = Math.cos(s.heading);
    const az = -Math.sin(s.heading);
    const h = s.length / 2;
    const fx = Math.sin(s.heading) * toFire;
    const fz = Math.cos(s.heading) * toFire;
    d = Math.min(
      d,
      toSegment(x, z, s.x - ax * h + fx, s.z - az * h + fz, s.x + ax * h + fx, s.z + az * h + fz),
    );
  }
  return d;
}

/** A GRILLER'S HAND in his own frame, m (x right, y up, z ahead), at the
 * grill pose — stood or on a bench — sized to his body. */
function grillHand(body: keyof typeof CROWD_LOOKS, bench: boolean): [number, number, number] {
  const h = civilianPosed(body, bench ? "benchGrill" : "grill").handR;
  return [h[0], h[1], h[2]];
}

/** How far from the hearth's middle a griller of `body` stands so his
 * stick's tip is `over` out over the embers, m. */
function grillerReach(body: keyof typeof CROWD_LOOKS, f: Fire): number {
  const [, hy, hz] = grillHand(body, false);
  const drop = hy - FIRESIDE.over.high;
  const flat = Math.sqrt(Math.max(0.1, FIRESIDE.stick ** 2 - drop * drop));
  return FIRESIDE.over[f.kind] + hz + flat;
}

/** The free bench places of `f`: the slots along every bench, its sitter's
 * hips on its seat, facing the fire. */
function benchHomes(level: Level, f: Fire): { x: number; y: number; z: number; heading: number }[] {
  const out: { x: number; y: number; z: number; heading: number }[] = [];
  for (const s of f.seats) {
    const ax = Math.cos(s.heading);
    const az = -Math.sin(s.heading);
    // The bench's seat is level over its middle (`fire-plan.ts`).
    const top = snowFloor(level, s.x, s.z) + FIRE_KIT.bench.seat;
    for (const off of FIRESIDE.slots[f.kind]) {
      const x = s.x + ax * off;
      const z = s.z + az * off;
      out.push({ x, y: top - BENCH_POSE_SEAT, z, heading: facing(f, x, z) });
    }
  }
  return out;
}

/** `list` in an order dealt off `rng` (Fisher–Yates). */
function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A free place on a ring of `r` m round `f`: clear of the benches, the
 * woodpile and everyone placed (`taken`), and passed by `clear`. */
function ringPoint(
  rng: Rng,
  f: Fire,
  r: number,
  taken: readonly { x: number; z: number }[],
  clear: (x: number, z: number) => boolean,
  benchRoom: number,
  feetRoom: number,
): { x: number; z: number } | null {
  const a0 = rng.range(0, TAU);
  const tries = 28;
  const order = shuffled(
    rng,
    Array.from({ length: tries }, (_, k) => k),
  );
  for (const k of order) {
    const a = a0 + (k / tries) * TAU;
    const x = f.x + Math.sin(a) * r;
    const z = f.z + Math.cos(a) * r;
    if (fromBenches(f, x, z, 0) < benchRoom) continue;
    if (fromBenches(f, x, z, 0.45) < feetRoom) continue;
    if (f.woodpile && Math.hypot(f.woodpile.x - x, f.woodpile.z - z) < FIRESIDE.pile) continue;
    if (taken.some((o) => Math.hypot(o.x - x, o.z - z) < FIRESIDE.apart)) continue;
    if (!clear(x, z)) continue;
    return { x, z };
  }
  return null;
}

/**
 * EVERYONE AT EVERY FIRE of `level`, and the skis stuck by them: off the
 * map's seed on `FIRE_PEOPLE_SALT`. `clear` is where a person may stand on
 * the snow (the civilians' own test, the fires' rings left out); `bodyOf`
 * deals a role's body. A camp fire: one or two grilling (on a bench where
 * there is one free, else stood), maybe one eating and one warming his
 * hands, the rest sat; a bonfire: a ring of standers and sitters, a few
 * grilling. Each fire's people share a keenness ladder, so a fire fills
 * one by one as its hour comes and empties the same way.
 */
export function dealFirePeople(
  level: Level,
  clear: (x: number, z: number) => boolean,
): { homes: FiresideHome[]; skis: StuckSkis[] } {
  const rng = createRng((level.seed ^ FIRE_PEOPLE_SALT) >>> 0);
  const homes: FiresideHome[] = [];
  const skis: StuckSkis[] = [];
  for (const f of firesOf(level)) {
    if (homes.length >= FIRESIDE.most) break;
    const camp = f.kind === "camp";
    const [lo, hi] = FIRESIDE.count[f.kind];
    const n = Math.min(rng.int(lo, hi), FIRESIDE.most - homes.length);
    // Who: the grillers first (the most likely to be out), then the rest.
    const roles: RoleId[] = [];
    const grillers = camp ? rng.int(1, Math.min(2, n)) : rng.int(1, 3);
    for (let k = 0; k < grillers; k++) roles.push(camp ? "campGriller" : "bonfireGriller");
    while (roles.length < n) {
      const left = n - roles.length;
      if (camp) {
        if (!roles.includes("campEater") && (n >= 3 || rng.chance(0.4))) roles.push("campEater");
        else if (!roles.includes("campWarmer") && (left > 1 || rng.chance(0.4)))
          roles.push("campWarmer");
        else roles.push("campSitter");
      } else roles.push(rng.chance(0.45) ? "bonfireSitter" : "bonfireGuest");
    }
    const seats = shuffled(rng, benchHomes(level, f));
    const taken: { x: number; z: number }[] = [];
    roles.forEach((role, rank) => {
      // A ladder of keenness: the first out at the hour's least share.
      const keen = Math.min(0.97, ((rank + rng.range(0.1, 0.9)) / n) * 0.95);
      const sitter = role === "campSitter" || role === "bonfireSitter";
      const grill = role === "campGriller" || role === "bonfireGriller";
      // A camp fire's griller roasts from a bench as often as not — one
      // no higher than the hearth, so his stick reaches down over it.
      const low = seats.filter(
        (s) => s.y + BENCH_POSE_SEAT - FIRE_KIT.bench.seat - f.y < FIRESIDE.benchOver,
      );
      const sits = sitter || (role === "campGriller" && low.length > 0 && rng.chance(0.5));
      const body = rng.pick(roleOf(role).bodies);
      const sit = (from: typeof seats): boolean => {
        const s = from[from.length - 1];
        if (!s) return false;
        seats.splice(seats.indexOf(s), 1);
        homes.push({ role, body, ...s, seat: FIRE_KIT.bench.seat, keen, fire: f });
        taken.push(s);
        return true;
      };
      if (sits && sit(grill ? low : seats)) return;
      const stand = FIRESIDE.stand[f.kind];
      // A griller stands where his stick reaches.
      const r = grill
        ? grillerReach(body, f)
        : role === "campEater"
          ? stand.eat
          : stand.warm + rng.range(0, camp ? 0.15 : 0.6);
      const p = ringPoint(rng, f, r, taken, clear, FIRESIDE.bench, FIRESIDE.feet);
      // No room to stand: on a bench instead, where one is free (a
      // griller only on one his stick reaches down from).
      if (!p) {
        sit(grill ? (f.kind === "camp" ? low : []) : seats);
        return;
      }
      taken.push(p);
      homes.push({
        role,
        body,
        x: p.x,
        y: snowFloor(level, p.x, p.z),
        z: p.z,
        heading: facing(f, p.x, p.z),
        seat: null,
        keen,
        fire: f,
      });
    });
    // The skis and poles of whoever is here, stuck upright behind them.
    const [s0, s1] = FIRESIDE.skis[f.kind];
    const pairs = rng.int(s0, s1);
    const ring = FIRE_KINDS[f.kind].seats.ring + FIRESIDE.skis.out;
    const stuck: { x: number; z: number }[] = [...taken];
    for (let k = 0; k < pairs; k++) {
      const p = ringPoint(rng, f, ring, stuck, clear, FIRESIDE.skis.bench, 0);
      if (!p) break;
      stuck.push(p);
      const heading = facing(f, p.x, p.z) + rng.range(-0.5, 0.5);
      skis.push({ x: p.x, y: snowFloor(level, p.x, p.z), z: p.z, heading });
    }
  }
  return { homes, skis };
}

/** Every target's right hand per body, in his own frame. */
const HANDS = new Map<string, Float32Array>();
const STAND_HANDS = new Map<string, [number, number, number]>();

/**
 * HIS RIGHT HAND at the weights `dials` (`civilianDials`, in
 * `CIVILIAN_POSES`' order), in his own frame (x right, y up, z ahead) —
 * the targets' hands blended as the figure's morph targets blend his arm,
 * so what he holds stays in his fist through every move.
 */
export function heldHand(
  body: keyof typeof CROWD_LOOKS,
  dials: ArrayLike<number>,
  out: [number, number, number],
): [number, number, number] {
  let hands = HANDS.get(body);
  let stand = STAND_HANDS.get(body);
  if (!hands || !stand) {
    const s = civilianPosed(body, "stand").handR;
    stand = [s[0], s[1], s[2]];
    hands = new Float32Array(CIVILIAN_POSES.length * 3);
    CIVILIAN_POSES.forEach((t: CivilianTarget, j) => {
      const h = civilianPosed(body, t).handR;
      for (let k = 0; k < 3; k++) hands![3 * j + k] = h[k] - stand![k];
    });
    HANDS.set(body, hands);
    STAND_HANDS.set(body, stand);
  }
  out[0] = stand[0];
  out[1] = stand[1];
  out[2] = stand[2];
  for (let j = 0; j < CIVILIAN_POSES.length; j++) {
    const w = dials[j];
    if (w === 0) continue;
    out[0] += w * hands[3 * j];
    out[1] += w * hands[3 * j + 1];
    out[2] += w * hands[3 * j + 2];
  }
  return out;
}

/**
 * WHERE A SAUSAGE STICK'S TIP IS, held from `hand` (in the world) by a
 * griller at a fire of `kind` whose hearth is at (`hx`, `hy`, `hz`):
 * `FIRESIDE.stick` m from his hand, on the line from the hearth's middle
 * out toward him — `FIRESIDE.over[kind]` out over the embers at whatever
 * height that lays it, held between `over.low` and `over.top` over the
 * hearth (out further or in nearer where it would not be). Into `out`.
 */
export function stickTip(
  hand: { x: number; y: number; z: number },
  kind: Fire["kind"],
  hx: number,
  hy: number,
  hz: number,
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const L = FIRESIDE.stick;
  const O = FIRESIDE.over;
  const dx = hand.x - hx;
  const dz = hand.z - hz;
  const reach = Math.hypot(dx, dz) || 1;
  const flat = Math.min(L, Math.max(0, reach - O[kind]));
  let y = hand.y - Math.sqrt(L * L - flat * flat);
  let r: number = O[kind];
  if (y < hy + O.low || y > hy + O.top || reach - O[kind] > L) {
    y = Math.max(hy + O.low, Math.min(hy + O.top, y));
    const drop = Math.min(L, Math.abs(hand.y - y));
    r = Math.max(0, reach - Math.sqrt(L * L - drop * drop));
  }
  out.x = hx + (dx / reach) * r;
  out.z = hz + (dz / reach) * r;
  out.y = y;
  return out;
}
