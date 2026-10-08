// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS' MOVES — every pose a person on foot is drawn between, as
// KEYS of the body in its boots (`party-pose.ts`'s `Key`: the hips, the
// trunk's bend, roll and twist, the feet and the hands), laid on the
// engine's body by the same two-bone reach the afterski's dancer is, read
// into the figure's joints as a thrown skier's ragdoll is (`ragdollPose`)
// and sized to each of the crowd's eight bodies (`fromPlayer`). Three-free,
// so the suite reads it (`tests/civilian_figure_test.ts`).
//
// ONE MESH A BODY, MANY TARGETS — the crowd's way (`crowd-rig.ts`). A
// figure is built once at the stance and once at each pose of
// `CIVILIAN_POSES` (`civilian-shapes.ts`), and each person is drawn at the
// WEIGHTS `civilianDials` reads off his plan's pose (`civilianAt`): a cyclic
// move is a few keys of its cycle blended by phase (the walk's four, a
// dance's four on the terrace's beat, the shovel's scoop and throw, the
// broom's two sweeps), an arm's move a key it swings to and back (the cup
// up to the mouth, a hand up and waving, a word with a hand going). Every
// target is a WHOLE body, so the weights of one moment sum to one past the
// stance and nothing is added onto a pose it was not made on — save the
// skis on the shoulder (`carry`), which moves the left arm alone and so
// rides on every stood pose.
//
// WALKING IN SKI BOOTS (`BOOT_GAIT`, `docs/civilians.md`): the step short,
// the knees nearly straight, the foot set down flat and lifted little, the
// arms swinging little.
//
// The frame is the person's: x right, y up, z the way he faces, the floor
// under him at 0.

import { RAGDOLL as R } from "@engine";

import type { Activity } from "./civilian-roles.ts";
import { BOOT_GAIT } from "./civilian-roles.ts";
import type { CivilianPose } from "./civilian-plan.ts";
import { CROWD_LOOKS, fromPlayer, mapPosed, type CrowdLook, type Posed } from "./crowd-rig.ts";
import { ANKLE, BEAT, STAND, blend, dance, keyPoints, v, type Key } from "./party-pose.ts";
import { MOUNTS } from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { add, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** The poses a figure is built at besides the stance, in the order its
 * morph targets and weights go in. */
export const CIVILIAN_POSES = [
  "idle",
  "idleAway",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "carry",
  "drink",
  "talk0",
  "talk1",
  "wave0",
  "wave1",
  "cheer0",
  "cheer1",
  "danceA0",
  "danceA1",
  "danceA2",
  "danceA3",
  "danceB0",
  "danceB1",
  "danceB2",
  "danceB3",
  "shovel0",
  "shovel1",
  "sweep0",
  "sweep1",
  "throw0",
  "throw1",
  "build0",
  "build1",
  "bench",
  "benchDrink",
  "benchTalk",
  "snow",
  "snowDrink",
  "snowTalk",
  "lounge",
  "loungeSip",
] as const;
export type CivilianTarget = (typeof CIVILIAN_POSES)[number];

/** How a target holds a long tool (a shovel, a broom): `hold` upright in
 * the right hand, its foot on the snow beside him; `work` in both hands,
 * the right on the grip and the shaft down through the left. And how far a
 * cup is tipped toward his mouth, 0 upright … 1 tipped to drink. */
export type Holding = { tool: "hold" | "work"; tip: number };

/** STOOD IN SKI BOOTS: taller than the skier's athletic stance — the
 * knees all but straight, the shell holding the shins a little forward. */
const STOOD: Key = {
  ...blend(STAND, STAND, 0),
  hipY: 0.965,
  pitch: 0.03,
  hands: [v(-0.29, 0.83, 0.06), v(0.29, 0.83, 0.06)],
};

/** A key off the stance, with what is changed. */
const at = (over: Partial<Key>): Key => ({ ...blend(STOOD, STOOD, 0), ...over });

/** THE BOOT STRIDE at `u` of a stride (two steps), 0..1. */
function walkKey(u: number): Key {
  const key = at({ hipY: 0.945, pitch: 0.06 });
  const ph = u * Math.PI * 2;
  const half = BOOT_GAIT.step / 2;
  for (const i of [0, 1] as const) {
    const p = ph + i * Math.PI;
    // The foot swung forward while lifted, set down flat and rolled back.
    key.feet[i] = add(key.feet[i], v(0, Math.max(0, Math.cos(p)) * 0.08, half * Math.sin(p)));
    // The arm against the leg, a little.
    key.hands[i] = add(key.hands[i], v(0, 0.02, -0.12 * Math.sin(p)));
  }
  key.hipY -= 0.025 * Math.abs(Math.cos(ph));
  key.hipX = 0.025 * Math.sin(ph);
  key.twist = 0.08 * Math.sin(ph);
  return key;
}

/** The trunk of a key: its head's middle, its up and its forward. */
function trunkOf(key: Key): { head: V3; up: V3; fwd: V3 } {
  const p = keyPoints(key, 0);
  const pt = (i: number): V3 => v(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
  const hips = scale(add(pt(R.hipL), pt(R.hipR)), 0.5);
  const neck = scale(add(pt(R.shoulderL), pt(R.shoulderR)), 0.5);
  const up = norm(sub(neck, hips));
  const right = norm(sub(pt(R.shoulderR), pt(R.shoulderL)));
  const fwd = v(
    right.y * up.z - right.z * up.y,
    right.z * up.x - right.x * up.z,
    right.x * up.y - right.y * up.x,
  );
  return { head: pt(R.head), up, fwd };
}

/** The key with its right hand brought up to its mouth: the fist under
 * the chin and a hand in front, so the cup in it meets his lips. */
function sip(key: Key): Key {
  const { head, up, fwd } = trunkOf(key);
  const out = blend(key, key, 0);
  out.hands[1] = add(add(head, scale(fwd, 0.17)), scale(up, -0.12));
  out.hands[1] = add(out.hands[1], v(-0.02, 0, 0));
  return out;
}

const A = ANKLE;
const STOOD_HANDS: [V3, V3] = [v(-0.29, 0.83, 0.06), v(0.29, 0.83, 0.06)];

// THE SEATS: a terrace bench (`lodge-measure.ts`' 0.47 m), the snow, and a
// deck chair laid back (0.32 m at the seat, the back at 55°).
const BENCH = at({
  hipY: 0.56,
  hipZ: -0.05,
  pitch: 0.06,
  nod: -0.05,
  feet: [v(-0.15, A, 0.4), v(0.15, A, 0.42)],
  hands: [v(-0.18, 0.64, 0.22), v(0.18, 0.64, 0.24)],
});
const SNOW = at({
  hipY: 0.16,
  hipZ: -0.12,
  pitch: -0.2,
  nod: -0.15,
  feet: [v(-0.18, A, 0.5), v(0.2, A + 0.02, 0.56)],
  hands: [v(-0.32, 0.06, -0.38), v(0.32, 0.06, -0.36)],
});
const LOUNGE = at({
  hipY: 0.42,
  hipZ: -0.04,
  pitch: -0.95,
  nod: -0.4,
  feet: [v(-0.14, 0.24, 0.8), v(0.15, 0.22, 0.78)],
  hands: [v(-0.26, 0.42, 0.1), v(0.26, 0.42, 0.12)],
});

/** Every target's key and how it holds what it holds. */
const MOVES: Readonly<Record<CivilianTarget, { key: Key } & Partial<Holding>>> = {
  // STOOD, his weight on one leg and looking round — then the other.
  idle: {
    key: at({
      hipX: 0.045,
      roll: -0.03,
      twist: 0.2,
      nod: 0.06,
      feet: [v(-0.2, A, 0.06), v(0.12, A, 0)],
      hands: [v(-0.28, 0.8, 0.1), v(0.3, 0.82, 0.04)],
    }),
  },
  idleAway: {
    key: at({
      hipX: -0.045,
      roll: 0.03,
      twist: -0.2,
      nod: -0.02,
      feet: [v(-0.12, A, 0), v(0.2, A, 0.06)],
      hands: [v(-0.3, 0.82, 0.04), v(0.28, 0.8, 0.1)],
    }),
  },
  walk0: { key: walkKey(0) },
  walk1: { key: walkKey(0.25) },
  walk2: { key: walkKey(0.5) },
  walk3: { key: walkKey(0.75) },
  // His skis on his left shoulder, the left hand up in front on them.
  carry: { key: at({ hands: [v(-0.15, 1.36, 0.3), STOOD_HANDS[1]] }) },
  drink: { key: sip(STOOD), tip: 1 },
  // A word, a hand going: two places the right hand swings between.
  talk0: {
    key: at({
      nod: -0.06,
      twist: 0.08,
      hands: [v(-0.28, 0.82, 0.1), v(0.22, 1.08, 0.32)],
    }),
  },
  talk1: {
    key: at({
      nod: 0.05,
      twist: -0.05,
      hands: [v(-0.3, 0.86, 0.14), v(0.34, 1.16, 0.26)],
    }),
  },
  // An arm up over his head, waved side to side.
  wave0: { key: at({ roll: -0.04, hands: [STOOD_HANDS[0], v(0.52, 1.86, 0.1)] }) },
  wave1: { key: at({ roll: -0.02, hands: [STOOD_HANDS[0], v(0.3, 1.94, 0.12)] }) },
  // Both arms up, the glass highest: a toast to the terrace, bounced.
  cheer0: {
    key: at({ nod: 0.25, hands: [v(-0.3, 1.9, 0.06), v(0.22, 1.98, 0.12)] }),
  },
  cheer1: {
    key: at({
      hipY: 0.87,
      nod: 0.15,
      pitch: 0.1,
      hands: [v(-0.34, 1.76, 0.12), v(0.26, 1.84, 0.2)],
    }),
  },
  danceA0: { key: dance(0, 1, 1) },
  danceA1: { key: dance(0.25, 1, 1) },
  danceA2: { key: dance(0.5, 1, 1) },
  danceA3: { key: dance(0.75, 1, 1) },
  danceB0: { key: dance(0, 2, 1) },
  danceB1: { key: dance(0.25, 2, 1) },
  danceB2: { key: dance(0.5, 2, 1) },
  danceB3: { key: dance(0.75, 2, 1) },
  // THE SHOVEL: bent into the scoop, the right hand on the grip by his hip
  // and the left low on the shaft — then up and turned, the load thrown off
  // to his left.
  shovel0: {
    key: at({
      hipY: 0.8,
      hipZ: -0.1,
      pitch: 0.75,
      nod: -0.3,
      feet: [v(-0.18, A, 0.26), v(0.17, A, -0.14)],
      hands: [v(0.0, 0.55, 0.48), v(0.2, 0.85, 0.08)],
    }),
    tool: "work",
  },
  shovel1: {
    key: at({
      hipY: 0.88,
      pitch: 0.25,
      twist: -0.45,
      nod: -0.1,
      feet: [v(-0.2, A, 0.18), v(0.15, A, -0.08)],
      hands: [v(-0.32, 1.12, 0.46), v(0.06, 0.98, 0.24)],
    }),
    tool: "work",
  },
  // THE BROOM worked across the boards before him, one way and the other.
  sweep0: {
    key: at({
      pitch: 0.3,
      twist: 0.1,
      nod: -0.35,
      hands: [v(0.05, 0.76, 0.4), v(0.15, 1.0, 0.2)],
    }),
    tool: "work",
  },
  sweep1: {
    key: at({
      pitch: 0.3,
      twist: -0.15,
      nod: -0.35,
      hands: [v(0.26, 0.76, 0.4), v(0.1, 1.0, 0.24)],
    }),
    tool: "work",
  },
  // A SNOWBALL: wound up, the right arm back high — and let go.
  throw0: {
    key: at({
      hipZ: -0.06,
      pitch: 0.02,
      twist: 0.45,
      roll: -0.06,
      feet: [v(-0.15, A, 0.28), v(0.18, A, -0.2)],
      hands: [v(-0.26, 1.18, 0.42), v(0.42, 1.46, -0.32)],
    }),
  },
  throw1: {
    key: at({
      hipZ: 0.08,
      pitch: 0.28,
      twist: -0.35,
      feet: [v(-0.15, A, 0.3), v(0.18, A + 0.05, -0.24)],
      hands: [v(-0.36, 0.88, -0.1), v(0.06, 1.32, 0.58)],
    }),
  },
  // CROUCHED at the snowman, packing it with both hands.
  build0: {
    key: at({
      hipY: 0.5,
      hipZ: -0.14,
      pitch: 0.75,
      nod: -0.1,
      feet: [v(-0.2, A, 0.14), v(0.2, A, 0.04)],
      hands: [v(-0.15, 0.6, 0.55), v(0.16, 0.66, 0.54)],
    }),
  },
  build1: {
    key: at({
      hipY: 0.52,
      hipZ: -0.14,
      pitch: 0.7,
      twist: 0.12,
      nod: -0.15,
      feet: [v(-0.2, A, 0.14), v(0.2, A, 0.04)],
      hands: [v(-0.05, 0.74, 0.56), v(0.25, 0.52, 0.5)],
    }),
  },
  bench: { key: BENCH },
  benchDrink: { key: sip(BENCH), tip: 1 },
  benchTalk: {
    key: { ...blend(BENCH, BENCH, 0), hands: [BENCH.hands[0], v(0.26, 0.86, 0.36)], nod: 0.05 },
  },
  snow: { key: SNOW },
  snowDrink: { key: sip(SNOW), tip: 1 },
  snowTalk: {
    key: { ...blend(SNOW, SNOW, 0), hands: [SNOW.hands[0], v(0.24, 0.58, 0.2)], nod: 0 },
  },
  lounge: { key: LOUNGE },
  loungeSip: { key: sip(LOUNGE), tip: 1 },
};

/** A target's key, and how it holds a tool and a cup. */
export function moveOf(target: CivilianTarget | "stand"): { key: Key; holding: Holding } {
  const m = target === "stand" ? { key: STOOD } : MOVES[target];
  return { key: m.key, holding: { tool: m.tool ?? "hold", tip: m.tip ?? 0 } };
}

/** The player's figure is the reference man's, this tall, m. */
const REFERENCE_HEIGHT = 1.8;

const frame: BodyFrame = {
  origin: { x: 0, y: 0, z: 0 },
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** THE SKELETON of `look` at `key`, in his own frame, the floor at 0:
 * the key laid on the reference man, read as the figure's joints and
 * sized to the body about his feet. */
export function keyPosed(key: Key, look: CrowdLook): Posed {
  const pose = ragdollPose(keyPoints(key, 0), frame);
  const local = fromPlayer(pose, look);
  const k = look.height / REFERENCE_HEIGHT;
  const o = frame.origin;
  const X = frame.x;
  const Y = frame.y;
  const Z = frame.z;
  return mapPosed(local, (p) => {
    const y = p[1] + MOUNTS.ground * k;
    return [
      k * o.x + X.x * p[0] + Y.x * y + Z.x * p[2],
      k * o.y + X.y * p[0] + Y.y * y + Z.y * p[2],
      k * o.z + X.z * p[0] + Y.z * y + Z.z * p[2],
    ];
  });
}

/** The skeleton of a CROWD body at a target. */
export function civilianPosed(body: keyof typeof CROWD_LOOKS, target: CivilianTarget | "stand") {
  return keyPosed(moveOf(target).key, CROWD_LOOKS[body]);
}

/** Each target's place in `CIVILIAN_POSES`, the weights' order. */
const AT = Object.fromEntries(CIVILIAN_POSES.map((k, i) => [k, i])) as Record<
  CivilianTarget,
  number
>;

const ease = (u: number): number => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};
const frac = (u: number): number => u - Math.floor(u);

/** How long a cycle of each worked move is, s. */
const CYCLE = { shovel: 2.6, sweep: 1.3, wave: 0.55, talk: 1.7, cheer: 1 / BEAT, build: 1.1 };
/** Of a throw's span: the share wound up, then the release. */
const THROW = { wind: 0.55, release: 0.72 };

/** Put `w` on `name` and the rest of `whole` on `base`. */
function share(out: Float32Array, name: CivilianTarget, w: number, base: CivilianTarget | null) {
  out[AT[name]] += w;
  if (base) out[AT[base]] += 1 - w;
}

/** A cycle of `keys` targets at `u` of the way round, `w` of the weight. */
function cycle(out: Float32Array, keys: readonly CivilianTarget[], u: number, w = 1): void {
  const x = frac(u) * keys.length;
  const k = Math.floor(x) % keys.length;
  const f = x - Math.floor(x);
  out[AT[keys[k]]] += (1 - f) * w;
  out[AT[keys[(k + 1) % keys.length]]] += f * w;
}

/** A swing out to a target and back over a span: up over the first
 * `rise`, held, and back down over the last `fall` (shares of 0..1). */
function swing(u: number, rise = 0.2, fall = 0.2): number {
  return ease(u / rise) * (1 - ease((u - (1 - fall)) / fall));
}

const DANCE_A = ["danceA0", "danceA1", "danceA2", "danceA3"] as const;
const DANCE_B = ["danceB0", "danceB1", "danceB2", "danceB3"] as const;
const WALK = ["walk0", "walk1", "walk2", "walk3"] as const;

/** The seat a pose is drawn on: stood, on the snow, laid back in a deck
 * chair, or on a bench. */
export type Seated = "stood" | "snow" | "lounge" | "bench";
export function seatedOf(seat: number | null): Seated {
  return seat === null ? "stood" : seat < 0.1 ? "snow" : seat < 0.4 ? "lounge" : "bench";
}

/**
 * THE WEIGHTS a civilian is drawn at — one a target in `CIVILIAN_POSES`'
 * order, into `out` — off his plan's pose (`civilianAt`), the run's clock
 * `t` and his `id` (his own phase for an idle swing). What he does and how
 * far into it he is decides the move; whether he sits and on what decides
 * which of its versions is drawn.
 */
export function civilianDials(p: CivilianPose, t: number, id: number, out: Float32Array): void {
  out.fill(0);
  const seated = seatedOf(p.seat);
  const u = p.span > 0 ? Math.max(0, Math.min(1, p.clock / p.span)) : 0;
  const act: Activity = p.activity;
  if (seated !== "stood") {
    const base: CivilianTarget =
      seated === "snow" ? "snow" : seated === "lounge" ? "lounge" : "bench";
    if (act === "drink") {
      const sipOf: CivilianTarget =
        seated === "snow" ? "snowDrink" : seated === "lounge" ? "loungeSip" : "benchDrink";
      share(out, sipOf, swing(u, 0.25, 0.25), base);
    } else if (act === "talk" && seated !== "lounge") {
      const talk: CivilianTarget = seated === "snow" ? "snowTalk" : "benchTalk";
      const w = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.clock) / CYCLE.talk + id);
      share(out, talk, w * swing(u, 0.1, 0.1), base);
    } else out[AT[base]] = 1;
    return;
  }
  const carry = p.carry === "skis";
  switch (act) {
    case "walk": {
      // His stride off the ground he has covered: a key every half step.
      cycle(out, WALK, p.walked / (2 * BOOT_GAIT.step));
      break;
    }
    case "drink":
      share(out, "drink", swing(u, 0.25, 0.25), null);
      break;
    case "talk": {
      const w = swing(u, 0.1, 0.1);
      const s = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.clock) / CYCLE.talk + id);
      out[AT.talk0] += w * (1 - s);
      out[AT.talk1] += w * s;
      break;
    }
    case "wave": {
      const w = swing(u, 0.15, 0.15);
      const s = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.clock) / CYCLE.wave);
      out[AT.wave0] += w * s;
      out[AT.wave1] += w * (1 - s);
      break;
    }
    case "cheer": {
      const w = swing(u, 0.15, 0.15);
      const s = 0.5 + 0.5 * Math.cos(2 * Math.PI * BEAT * t);
      out[AT.cheer0] += w * s;
      out[AT.cheer1] += w * (1 - s);
      break;
    }
    case "dance":
      // The terrace's one beat: the run's own clock (`clock` is `t`), a
      // bar of two beats over the four keys.
      cycle(out, id % 2 ? DANCE_B : DANCE_A, (p.clock * BEAT) / 2);
      break;
    case "shovel": {
      // Into the scoop, lifted and thrown, back for the next.
      const c = frac(p.clock / CYCLE.shovel);
      const scoop = ease(c / 0.3) * (1 - ease((c - 0.45) / 0.15));
      const toss = ease((c - 0.45) / 0.15) * (1 - ease((c - 0.75) / 0.25));
      out[AT.shovel0] += scoop;
      out[AT.shovel1] += toss;
      // The rest of the cycle he stands leaning on it.
      break;
    }
    case "sweep": {
      const s = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.clock) / CYCLE.sweep);
      out[AT.sweep0] += s;
      out[AT.sweep1] += 1 - s;
      break;
    }
    case "throw": {
      const wind = ease(u / THROW.wind);
      const go = ease((u - THROW.wind) / (THROW.release - THROW.wind));
      const home = ease((u - THROW.release) / (1 - THROW.release));
      out[AT.throw0] += wind * (1 - go);
      out[AT.throw1] += go * (1 - home);
      break;
    }
    case "build": {
      const w = swing(u, 0.1, 0.1);
      const s = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.clock) / CYCLE.build);
      out[AT.build0] += w * s;
      out[AT.build1] += w * (1 - s);
      break;
    }
    default: {
      // STOOD ("stand", "lounge" off a chair): alive, his weight swung from
      // one leg to the other on his own clock.
      const s = Math.sin((2 * Math.PI * t) / 7.3 + id * 2.39);
      out[AT.idle] += Math.max(0, s) * 0.9;
      out[AT.idleAway] += Math.max(0, -s) * 0.9;
    }
  }
  // The skis on his shoulder ride every stood move but the ones that want
  // both hands.
  if (carry && act !== "shovel" && act !== "sweep" && act !== "build" && act !== "throw") {
    out[AT.carry] += 1;
  }
}

/** Whether a snowball is in his hand: wound up and until it leaves it. */
export function holdsSnowball(p: CivilianPose): boolean {
  return p.activity === "throw" && p.span > 0 && p.clock / p.span < THROW.wind + 0.12;
}

/** The far end of a hand's reach, for the suite: how far a key's hand
 * is from its shoulder, m. */
export function handReach(key: Key, right = true): number {
  const p = keyPoints(key, 0);
  const s = right ? R.shoulderR : R.shoulderL;
  const h = right ? R.handR : R.handL;
  return len(sub(v(p[3 * h], p[3 * h + 1], p[3 * h + 2]), v(p[3 * s], p[3 * s + 1], p[3 * s + 2])));
}
