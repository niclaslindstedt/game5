// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER OFF HIS SKIS, ON HIS FEET — the moves a body makes in its boots
// that no ski pose covers, PROCEDURALLY: getting up off the snow, walking
// (and weaving, with a buzz), bending for a ski, stamping back into the
// bindings, DANCING and lifting a BEER to his mouth. Each is a handful of
// keys (where the hips are, how far the trunk is bent, where the feet and
// the hands are) blended and laid on a body of the engine's lengths with a
// two-bone reach for every limb, then read into the figure's joints the way
// a thrown skier's ragdoll is (`skier-ragdoll.ts`'s `ragdollPose`), so the
// dressed figure hangs on either the same way. Three-free, so the suite
// reads it.
//
// THE FRAME is the one the move is laid in: x to his right, y up, z the
// way he faces, the snow (or the lodge's floor) at `ground`.

import { BUZZ, RAGDOLL as R, type Fetch, type SkierState } from "@engine";

import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { BODY } from "./skier-mounts.ts";
import type { SkierPose } from "./skier-pose.ts";
import { add, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** A move and how far into it he is.
 *   * `walk`: `t` s walking, `pace` 0 stood to 1 a full stride.
 *   * `rise`: `k` 0 sat in the snow to 1 stood up.
 *   * `pick`: `k` 0..1 down to the snow and back up.
 *   * `clip`: `k` 0..1 the right boot stamped in, then the left.
 *   * `dance`: `t` s into it, `style` which of the dances.
 *   * `drink`: `k` 0..1 the glass up, the swallow and down, over a dance.
 * `sway` is the buzz's weave, 0..1; `carry` whether his skis are on his
 * shoulder (his right hand up on them); `glass` whether a beer is in his
 * right hand (dancing, it is raised in a TOAST). */
export type BodyMove = {
  kind: "walk" | "rise" | "pick" | "clip" | "dance" | "drink";
  t: number;
  k?: number;
  pace?: number;
  style?: number;
  sway?: number;
  carry?: boolean;
  glass?: boolean;
};

/** One key of a move: the hips over the ground and off the middle, the
 * trunk's bend forward and its roll and twist, the head's nod, where each
 * ankle stands (y over the ground) and each hand is. The civilians' moves
 * (`civilian-moves.ts`) are keys too. */
export type Key = {
  hipY: number;
  hipX: number;
  hipZ: number;
  pitch: number;
  roll: number;
  twist: number;
  nod: number;
  feet: [V3, V3];
  hands: [V3, V3];
};

export const v = (x: number, y: number, z: number): V3 => ({ x, y, z });

/** The ankle over the sole, m. */
export const ANKLE = 0.09;
/** The beat a crowd dances to, Hz: the thump through the floor. */
export const BEAT = 2.0;

export const STAND: Key = {
  hipY: 0.93,
  hipX: 0,
  hipZ: 0,
  pitch: 0.05,
  roll: 0,
  twist: 0,
  nod: 0,
  feet: [v(-0.13, ANKLE, 0.02), v(0.13, ANKLE, 0.02)],
  hands: [v(-0.3, 0.8, 0.06), v(0.3, 0.8, 0.06)],
};
const SIT: Key = {
  hipY: 0.14,
  hipX: 0,
  hipZ: -0.25,
  pitch: -0.3,
  roll: 0.1,
  twist: 0,
  nod: 0.2,
  feet: [v(-0.2, ANKLE, 0.55), v(0.22, ANKLE + 0.05, 0.62)],
  hands: [v(-0.32, 0.05, -0.5), v(0.32, 0.05, -0.48)],
};
const CROUCH: Key = {
  hipY: 0.46,
  hipX: 0,
  hipZ: -0.12,
  pitch: 0.95,
  roll: -0.05,
  twist: 0,
  nod: -0.2,
  feet: [v(-0.18, ANKLE, 0.18), v(0.17, ANKLE, 0.04)],
  hands: [v(-0.18, 0.46, 0.38), v(0.2, 0.48, 0.36)],
};
const BENT: Key = {
  hipY: 0.62,
  hipX: 0,
  hipZ: -0.18,
  pitch: 1.25,
  roll: 0,
  twist: 0.15,
  nod: -0.4,
  feet: [v(-0.2, ANKLE, 0.05), v(0.16, ANKLE, 0.32)],
  hands: [v(-0.08, 0.1, 0.62), v(0.12, 0.1, 0.6)],
};

export function blend(a: Key, b: Key, k: number): Key {
  const n = (p: number, q: number): number => p + (q - p) * k;
  return {
    hipY: n(a.hipY, b.hipY),
    hipX: n(a.hipX, b.hipX),
    hipZ: n(a.hipZ, b.hipZ),
    pitch: n(a.pitch, b.pitch),
    roll: n(a.roll, b.roll),
    twist: n(a.twist, b.twist),
    nod: n(a.nod, b.nod),
    feet: [mix(a.feet[0], b.feet[0], k), mix(a.feet[1], b.feet[1], k)],
    hands: [mix(a.hands[0], b.hands[0], k), mix(a.hands[1], b.hands[1], k)],
  };
}

const ease = (k: number): number => k * k * (3 - 2 * k);
const clamp = (k: number): number => Math.max(0, Math.min(1, k));

/** A copy of a key to change. */
function copy(k: Key): Key {
  return blend(k, k, 0);
}

/** THE KEY a move is at. */
function keyOf(m: BodyMove): Key {
  const t = m.t;
  const sway = m.sway ?? 0;
  let key: Key;
  switch (m.kind) {
    case "rise": {
      const k = clamp(m.k ?? 1);
      key =
        k < 0.5 ? blend(SIT, CROUCH, ease(k / 0.5)) : blend(CROUCH, STAND, ease((k - 0.5) / 0.5));
      break;
    }
    case "pick": {
      key = blend(STAND, BENT, ease(Math.sin(Math.PI * clamp(m.k ?? 0))));
      break;
    }
    case "clip": {
      key = copy(STAND);
      const k = clamp(m.k ?? 0);
      // Each boot: the toe set in, the heel stamped down.
      for (const [i, a] of [
        [1, 0],
        [0, 0.5],
      ] as const) {
        const s = clamp((k - a) / 0.42);
        const lift = Math.sin(Math.PI * s) * 0.16;
        key.feet[i] = add(key.feet[i], v(0, lift, 0.06 * Math.sin(Math.PI * s)));
        key.hipX += (i ? -1 : 1) * 0.05 * Math.sin(Math.PI * s);
      }
      key.pitch = 0.3;
      key.nod = -0.35;
      key.hands = [v(-0.32, 0.7, 0.2), v(0.32, 0.72, 0.2)];
      break;
    }
    case "walk": {
      key = copy(STAND);
      const pace = clamp(m.pace ?? 1);
      const ph = t * Math.PI * 2 * 0.85;
      const stride = 0.34 * pace;
      for (const i of [0, 1] as const) {
        const p = ph + i * Math.PI;
        key.feet[i] = add(
          key.feet[i],
          v(0, Math.max(0, Math.cos(p)) * 0.13 * pace, stride * Math.sin(p)),
        );
        // The arms swing against the legs.
        key.hands[i] = add(key.hands[i], v(0, 0.04 * pace, -0.22 * pace * Math.sin(p)));
      }
      key.hipY -= 0.03 * pace * Math.abs(Math.cos(ph));
      key.pitch = 0.12 + 0.08 * pace;
      key.twist = 0.12 * pace * Math.sin(ph);
      break;
    }
    case "dance":
    case "drink": {
      key = dance(t, m.style ?? 0, m.kind === "drink" ? 0.35 : 1);
      if (m.kind === "drink") {
        // The glass up to his mouth, held there for the swallow and down,
        // the head back for it.
        const k = clamp(m.k ?? 0);
        const up = ease(clamp(k / 0.25)) * (1 - ease(clamp((k - 0.78) / 0.22)));
        const mouth = v(0.02, key.hipY + 0.66, 0.24);
        key.hands[1] = mix(v(0.24, key.hipY + 0.12, 0.3), mouth, up);
        key.hands[0] = v(-0.22, key.hipY + 0.02, 0.08);
        key.nod = -0.1 + 0.55 * up;
        key.pitch = Math.max(-0.25, key.pitch - 0.3 * up);
      } else if (m.glass) {
        // THE TOAST: the glass held up high and out in front, lifted on the
        // beat and swung over the bar.
        const b = t * Math.PI * 2 * BEAT;
        key.hands[1] = v(
          0.27 + 0.07 * Math.sin(b / 2),
          key.hipY + 0.86 + 0.07 * (0.5 + 0.5 * Math.cos(b)),
          0.3,
        );
      }
      break;
    }
  }
  // THE BUZZ'S WEAVE: the hips off his middle and the trunk rolled with
  // them, slow, out of time with anything.
  if (sway > 0) {
    key.hipX += sway * 0.09 * Math.sin(t * 1.3);
    key.roll += sway * 0.16 * Math.sin(t * 1.3 + 0.6);
    key.nod += sway * 0.12 * Math.sin(t * 0.7);
    key.twist += sway * 0.1 * Math.sin(t * 0.9);
  }
  if (m.carry) {
    // His skis on his right shoulder, his right hand up on them in front.
    key.hands[1] = v(0.24, key.hipY + 0.5, 0.26);
  }
  return key;
}

/** THE DANCES, `amp` of their size (a man drinking dances small): each a
 * bounce on the beat, the hips swaying over two, and the arms its own. */
export function dance(t: number, style: number, amp: number): Key {
  const key = copy(STAND);
  const b = t * Math.PI * 2 * BEAT;
  const bar = b / 2;
  const bounce = 0.5 + 0.5 * Math.cos(b);
  key.hipY -= amp * 0.08 * bounce;
  key.hipX = amp * 0.07 * Math.sin(bar);
  key.roll = amp * 0.12 * Math.sin(bar);
  key.pitch = 0.08 + amp * 0.06 * bounce;
  key.nod = amp * 0.15 * bounce;
  // A foot in time: each lifted on its own beat.
  for (const i of [0, 1] as const) {
    const lift = Math.max(0, Math.sin(bar + i * Math.PI));
    key.feet[i] = add(key.feet[i], v(i ? 0.03 : -0.03, amp * 0.07 * lift, 0));
  }
  const hy = key.hipY;
  switch (((style % 4) + 4) % 4) {
    case 0: {
      // The fist pumped at the roof on the beat, the other at his chest.
      key.hands[1] = v(0.24, hy + 0.85 + amp * 0.18 * bounce, 0.18);
      key.hands[0] = v(-0.2, hy + 0.35, 0.28);
      key.twist = amp * 0.12 * Math.sin(bar);
      break;
    }
    case 1: {
      // Both arms up and swaying over the crowd.
      const s = Math.sin(bar);
      key.hands = [v(-0.36 + 0.18 * s, hy + 0.98, 0.08), v(0.36 + 0.18 * s, hy + 0.98, 0.08)];
      key.twist = 0;
      break;
    }
    case 2: {
      // Elbows bent, the fists rolled side to side, the shoulders twisting.
      const s = Math.sin(bar);
      key.hands = [v(-0.22 + 0.14 * s, hy + 0.4, 0.3), v(0.22 + 0.14 * s, hy + 0.4, 0.3)];
      key.twist = amp * 0.35 * s;
      break;
    }
    default: {
      // Arms round the next man's shoulders, swaying with the line.
      key.hands = [v(-0.55, hy + 0.55, -0.02), v(0.55, hy + 0.55, -0.02)];
      key.roll = amp * 0.2 * Math.sin(bar);
      key.hipX = amp * 0.12 * Math.sin(bar);
    }
  }
  return key;
}

/** A two-bone reach from `root` toward `to` over `a` and `b`, the middle
 * joint bent toward `bend`: the middle joint and where the end gets to. */
function reach(root: V3, to: V3, a: number, b: number, bend: V3): [V3, V3] {
  const d0 = sub(to, root);
  const along = norm(d0);
  const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(len(d0), (a + b) * 0.999));
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const off = sub(bend, scale(along, bend.x * along.x + bend.y * along.y + bend.z * along.z));
  const perp = len(off) < 1e-6 ? v(0, 0, 1) : norm(off);
  return [add(add(root, scale(along, x)), scale(perp, h)), add(root, scale(along, d))];
}

/** THE POINTS a move puts the body's joints at, in the ragdoll's order
 * (`RAGDOLL`) and its frame: x right, y up, z ahead, the snow at `ground`. */
export function movePoints(m: BodyMove, ground: number): number[] {
  return keyPoints(keyOf(m), ground);
}

/** THE POINTS a key puts the body's joints at, in the ragdoll's order and
 * the move's frame, the snow at `ground`. */
export function keyPoints(k: Key, ground: number): number[] {
  const g = ground;
  const centre = v(k.hipX, g + k.hipY, k.hipZ);
  // The trunk: bent forward by `pitch`, rolled to his right by `roll`.
  const up = norm(v(Math.sin(k.roll), Math.cos(k.pitch) * Math.cos(k.roll), Math.sin(k.pitch)));
  const right0 = v(Math.cos(k.twist), 0, -Math.sin(k.twist));
  const right = norm(sub(right0, scale(up, right0.x * up.x + right0.y * up.y + right0.z * up.z)));
  const fwd = v(
    right.y * up.z - right.z * up.y,
    right.z * up.x - right.x * up.z,
    right.x * up.y - right.y * up.x,
  );
  const hips: [V3, V3] = [
    sub(centre, scale(v(1, 0, 0), BODY.hip)),
    add(centre, scale(v(1, 0, 0), BODY.hip)),
  ];
  const neck = add(centre, scale(up, BODY.spine));
  const shoulders: [V3, V3] = [
    sub(neck, scale(right, BODY.shoulder)),
    add(neck, scale(right, BODY.shoulder)),
  ];
  const head = add(
    add(neck, scale(up, BODY.neck * Math.cos(k.nod))),
    scale(fwd, 0.02 + BODY.neck * Math.sin(-k.nod) * 0.6),
  );
  const out: V3[] = new Array(R.count);
  out[R.hipL] = hips[0];
  out[R.hipR] = hips[1];
  out[R.shoulderL] = shoulders[0];
  out[R.shoulderR] = shoulders[1];
  out[R.head] = head;
  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1;
    const foot = add(k.feet[i], v(0, g, 0));
    const [knee, ankle] = reach(hips[i], foot, BODY.thigh, BODY.shin, v(side * 0.15, 0, 1));
    out[i ? R.kneeR : R.kneeL] = knee;
    out[i ? R.footR : R.footL] = ankle;
    const hand = add(k.hands[i], v(0, g, 0));
    const [elbow, at] = reach(
      shoulders[i],
      hand,
      BODY.upperArm,
      BODY.forearm,
      v(side * 0.6, -0.4, -0.7),
    );
    out[i ? R.elbowR : R.elbowL] = elbow;
    out[i ? R.handR : R.handL] = at;
  }
  const flat: number[] = [];
  for (const p of out) flat.push(p.x, p.y, p.z);
  return flat;
}

/** THE POSE a move puts him in, in the frame its trunk makes (written into
 * `frame`, as `ragdollPose` does): the figure is laid at the frame and hung
 * on the pose. */
export function movePose(m: BodyMove, ground: number, frame: BodyFrame): SkierPose {
  return ragdollPose(movePoints(m, ground), frame);
}

/** Where his right hand is in the move's frame — a glass's place. */
export function handAt(points: readonly number[], right = true): V3 {
  const i = right ? R.handR : R.handL;
  return v(points[3 * i], points[3 * i + 1], points[3 * i + 2]);
}

/** THE MOVE a buzzed skier on his feet is making (`buzz.ts`'s fetch): up
 * off the snow, walking to his skis (weaving with the buzz), bent for one,
 * stamping back into the bindings — his skis on his shoulder once he has
 * one. */
export function fetchMove(f: Fetch, skier: SkierState): BodyMove {
  const F = BUZZ.fetch;
  const sway = skier.buzz ?? 0;
  const carry = f.carried[0] || f.carried[1];
  switch (f.phase) {
    case "rise":
      return { kind: "rise", t: f.t, k: f.phaseT / F.rise, sway };
    case "pick":
      return { kind: "pick", t: f.t, k: f.phaseT / F.pick, sway, carry };
    case "clip":
      return { kind: "clip", t: f.t, k: f.phaseT / F.clip, sway };
    default:
      return {
        kind: "walk",
        t: f.walked / 1.1,
        pace: Math.min(1, skier.speed / F.walk + 0.2),
        sway,
        carry,
      };
  }
}
